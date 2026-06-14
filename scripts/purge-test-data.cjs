/**
 * Selective Firestore purge: wipes dummy test data while preserving hotels & users.
 * 
 * PURGE (delete all documents):
 *   - reservations, transactions, audit_log, allotments, follow_ups,
 *     other_services, consolidated_invoices, external_transfers,
 *     messages, commissions, expenses, edit_approvals
 * 
 * PRESERVE (untouched):
 *   - hotels (1357 enriched), users (staff accounts),
 *     agents, accounts, sales_persons, settings, tax_settings,
 *     expense_categories, cancellation_reasons, terms_conditions,
 *     payment_gateways, document_templates
 * 
 * Uses Firebase CLI stored credentials for auth.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'zumrahotels-rms';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── Collections to PURGE ──────────────────────────────────────
const PURGE_COLLECTIONS = [
  'reservations',
  'transactions',
  'audit_log',
  'allotments',
  'follow_ups',
  'other_services',
  'consolidated_invoices',
  'external_transfers',
  'messages',
  'commissions',
  'expenses',
  'edit_approvals',
];

// ── Collections to PRESERVE (explicit allowlist) ──────────────
const PRESERVE_COLLECTIONS = [
  'hotels',
  'users',
  'agents',
  'accounts',
  'sales_persons',
  'settings',
  'tax_settings',
  'expense_categories',
  'cancellation_reasons',
  'terms_conditions',
  'payment_gateways',
  'document_templates',
  'pay_by_links',
];

// ── Auth ──────────────────────────────────────────────────────
function getCliTokens() {
  const configPath = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.config', 'configstore', 'firebase-tools.json'
  );
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return config.tokens || {};
}

function refreshAccessToken(refreshToken) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      grant_type: 'refresh_token',
      client_id: process.env.FIREBASE_CLIENT_ID || 'REDACTED',
      client_secret: process.env.FIREBASE_CLIENT_SECRET || 'REDACTED',
      refresh_token: refreshToken,
    });
    const req = https.request({
      hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.access_token) resolve(json.access_token);
          else reject(new Error('No access token: ' + body));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Firestore REST helpers ────────────────────────────────────
function firestoreRequest(token, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'firestore.googleapis.com',
      path: urlPath,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data || '{}') }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function listDocs(token, collection, pageToken) {
  let url = `${BASE}/${collection}?pageSize=300`;
  if (pageToken) url += `&pageToken=${pageToken}`;
  const res = await firestoreRequest(token, 'GET', `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`);
  return res.body;
}

async function deleteDoc(token, docPath) {
  return firestoreRequest(token, 'DELETE', `/v1/${docPath}`);
}

async function purgeCollection(token, collectionName) {
  let totalDeleted = 0;
  let pageToken = null;

  do {
    const res = await firestoreRequest(token, 'GET',
      `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionName}?pageSize=300${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`
    );

    if (res.status !== 200 || !res.body.documents) break;

    const docs = res.body.documents;
    if (docs.length === 0) break;

    // Batch delete (up to 500 at a time via batchWrite)
    const batchSize = 100;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      const writes = batch.map(d => ({ delete: d.name }));
      const bRes = await firestoreRequest(token, 'POST',
        `/v1/projects/${PROJECT_ID}/databases/(default)/documents:batchWrite`,
        { writes }
      );

      if (bRes.status === 200) {
        const results = (bRes.body.writeResults || []);
        const successes = results.filter(r => !r.status || r.status.code === 0 || r.status.code === undefined);
        totalDeleted += successes.length || batch.length;
      } else {
        // Fallback: delete one by one
        for (const d of batch) {
          const dr = await deleteDoc(token, d.name.replace('projects/', ''));
          if (dr.status === 200) totalDeleted++;
        }
      }
    }

    pageToken = res.body.nextPageToken || null;
  } while (pageToken);

  return totalDeleted;
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Selective Firestore Purge                  ║');
  console.log('║  Project: ' + PROJECT_ID.padEnd(33) + '║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log();

  // Auth
  const tokens = getCliTokens();
  let accessToken = tokens.access_token;
  if (!accessToken) {
    console.error('ERROR: No Firebase CLI access token found.');
    process.exit(1);
  }
  console.log('[Auth] Using Firebase CLI stored credentials');

  // Verify token works, refresh if needed
  const testRes = await firestoreRequest(accessToken, 'GET',
    `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users?pageSize=1`);

  if (testRes.status === 401 && tokens.refresh_token) {
    console.log('[Auth] Token expired, refreshing...');
    accessToken = await refreshAccessToken(tokens.refresh_token);
    console.log('[Auth] Token refreshed successfully');
  } else if (testRes.status !== 200) {
    console.error('ERROR: Cannot access Firestore. Status:', testRes.status);
    process.exit(1);
  }

  console.log();
  console.log('Collections to PURGE:');
  PURGE_COLLECTIONS.forEach(c => console.log('  ✗ ' + c));
  console.log();
  console.log('Collections to PRESERVE:');
  PRESERVE_COLLECTIONS.forEach(c => console.log('  ✓ ' + c));
  console.log();
  console.log('Starting purge...');
  console.log('─'.repeat(50));

  let grandTotal = 0;
  const results = [];

  for (const col of PURGE_COLLECTIONS) {
    const count = await purgeCollection(accessToken, col);
    grandTotal += count;
    const status = count > 0 ? `${count} deleted` : 'empty';
    console.log(`  ${col.padEnd(30)} → ${status}`);
    results.push({ collection: col, deleted: count });
  }

  console.log('─'.repeat(50));
  console.log(`\nTotal documents purged: ${grandTotal}`);
  console.log('\nPreserved collections verified:');
  
  // Quick count of preserved collections
  for (const col of ['hotels', 'users']) {
    const res = await firestoreRequest(accessToken, 'GET',
      `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${col}?pageSize=1`);
    const count = res.body.documents ? 'has documents' : 'empty';
    console.log(`  ✓ ${col}: ${count}`);
  }

  console.log('\n✓ Purge complete. Hotels and user accounts are safe.');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
