/**
 * One-time push script: Write enrichment data to Firestore via REST API.
 * Uses Firebase CLI stored refresh token for auth.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = 'AIzaSyDHkLzahkk0ZKckDqmS0AZNnoLqgRFEQ4A';
const PROJECT_ID = 'zumrahotels-rms';
const INPUT_PATH = path.join(__dirname, 'enrichment-output.json');

// Read Firebase CLI stored credentials
function getCliTokens() {
  const configPath = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.config', 'configstore', 'firebase-tools.json'
  );
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return config.tokens || {};
}

// Exchange refresh token for access token
function refreshAccessToken(refreshToken) {
  return new Promise((resolve, reject) => {
    // Firebase CLI OAuth client credentials
    const data = JSON.stringify({
      grant_type: 'refresh_token',
      client_id: process.env.FIREBASE_CLIENT_ID || 'REDACTED',
      client_secret: process.env.FIREBASE_CLIENT_SECRET || 'REDACTED',
      refresh_token: refreshToken,
    });

    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.access_token) {
            resolve(json.access_token);
          } else {
            reject(new Error('No access token: ' + body));
          }
        } catch (e) {
          reject(new Error('Parse error: ' + body));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Write a single document to Firestore via REST API
function writeDoc(accessToken, docId, payload) {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/hotels/${docId}`;
    const data = JSON.stringify({
      fields: toFirestoreFields(payload),
    });

    const req = https.request(url + '?updateMask.fieldPaths=roomTypes&updateMask.fieldPaths=mealPlans&updateMask.fieldPaths=views&updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=updatedBy&updateMask.fieldPaths=_enrichedAt&updateMask.fieldPaths=name&updateMask.fieldPaths=arabicName&updateMask.fieldPaths=city&updateMask.fieldPaths=stars', {
      hostname: 'firestore.googleapis.com',
      path: url.replace('https://firestore.googleapis.com', '') + '?updateMask.fieldPaths=roomTypes&updateMask.fieldPaths=mealPlans&updateMask.fieldPaths=views&updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=updatedBy&updateMask.fieldPaths=_enrichedAt&updateMask.fieldPaths=name&updateMask.fieldPaths=arabicName&updateMask.fieldPaths=city&updateMask.fieldPaths=stars',
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Convert plain object to Firestore REST API field format
function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === '_enrichedAt' || key === 'updatedAt') {
      fields[key] = { timestampValue: new Date().toISOString() };
    } else if (Array.isArray(value)) {
      fields[key] = { arrayValue: { values: value.map(v => ({ stringValue: String(v) })) } };
    } else if (typeof value === 'number') {
      fields[key] = { integerValue: String(value) };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else {
      fields[key] = { stringValue: String(value || '') };
    }
  }
  return fields;
}

// Batch write using Firestore batchWrite REST endpoint
function batchWrite(accessToken, writes) {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:batchWrite`;
    const data = JSON.stringify({ writes });

    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents:batchWrite`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          reject(new Error(`HTTP ${res.statusCode}: ${body.substring(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Step 1: Getting credentials from Firebase CLI...');
  const cliTokens = getCliTokens();

  let accessToken;
  if (cliTokens.access_token && cliTokens.expires_at && Date.now() < cliTokens.expires_at - 60000) {
    accessToken = cliTokens.access_token;
    console.log('  Using stored access token (not expired).');
  } else {
    console.log('  Access token expired or missing, refreshing...');
    accessToken = await refreshAccessToken(cliTokens.refresh_token);
    console.log('  Access token refreshed.');
  }

  console.log('Step 3: Loading enrichment data...');
  const hotels = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf-8'));
  console.log(`  Total hotels: ${hotels.length}`);

  console.log('Step 4: Pushing to Firestore...');
  let committed = 0;
  let failed = 0;

  // Process in chunks of 500 (batchWrite limit)
  for (let i = 0; i < hotels.length; i += 500) {
    const chunk = hotels.slice(i, i + 500);

    const writes = chunk.map(hotel => {
      const docId = String(hotel.id);
      return {
        update: {
          name: `projects/${PROJECT_ID}/databases/(default)/documents/hotels/${docId}`,
          fields: toFirestoreFields({
            id: docId,
            name: hotel.name,
            arabicName: hotel.arabicName || '',
            displayName: hotel.displayName || hotel.name,
            country: hotel.country || '',
            city: hotel.city || '',
            stars: hotel.stars || 0,
            address: hotel.address || '',
            website: hotel.website || '',
            email: hotel.email || '',
            gaztNo: hotel.gaztNo || '',
            vatNo: hotel.vatNo || '',
            switchCode: hotel.switchCode || '',
            roomTypes: hotel.roomTypes || [],
            mealPlans: hotel.mealPlans || [],
            views: hotel.views || [],
            updatedAt: new Date().toISOString(),
            updatedBy: 'admin-migration-script',
            _enrichedAt: new Date().toISOString(),
          }),
        },
        updateMask: {
          fieldPaths: [
            'id', 'name', 'arabicName', 'displayName', 'country', 'city', 'stars',
            'address', 'website', 'email', 'gaztNo', 'vatNo', 'switchCode',
            'roomTypes', 'mealPlans', 'views', 'updatedAt', 'updatedBy', '_enrichedAt',
          ],
        },
      };
    });

    try {
      const result = await batchWrite(accessToken, writes);
      const statuses = result.status || [];
      const okCount = statuses.filter(s => !s.code || s.code === 0).length;
      const errCount = statuses.length - okCount;
      committed += okCount;
      failed += errCount;

      if (errCount > 0) {
        const firstErr = statuses.find(s => s.code && s.code !== 0);
        console.log(`  Batch ${Math.floor(i / 500) + 1}: ${okCount} OK, ${errCount} ERR`);
        if (firstErr) console.log('    First error:', JSON.stringify(firstErr).substring(0, 200));
      } else {
        console.log(`  Batch ${Math.floor(i / 500) + 1}: ${chunk.length} committed (total: ${committed})`);
      }
    } catch (err) {
      failed += chunk.length;
      console.error(`  Batch ${Math.floor(i / 500) + 1} FAILED:`, err.message);

      // If token expired, try refreshing
      if (err.message.includes('401') || err.message.includes('UNAUTHENTICATED')) {
        console.log('  Token expired, refreshing...');
        const newToken = await refreshAccessToken(cliTokens.refresh_token);
        // Retry this chunk
        try {
          await batchWrite(newToken, writes);
          committed += chunk.length;
          failed -= chunk.length;
          console.log('  Retry succeeded.');
        } catch (retryErr) {
          console.error('  Retry failed:', retryErr.message);
        }
      }
    }
  }

  console.log(`\n=== COMPLETE ===`);
  console.log(`Committed: ${committed}`);
  console.log(`Failed: ${failed}`);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
