/**
 * Data Backup Utility for Zumra Hotels RMS
 * Exports all app data from localStorage to a downloadable JSON backup.
 */

const BACKUP_PREFIX = 'zumra_';

export interface BackupData {
  version: string;
  exportedAt: string;
  app: string;
  collections: Record<string, any>;
}

/** Collect all Zumra data from localStorage */
export function collectAllData(): BackupData {
  const collections: Record<string, any> = {};
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(BACKUP_PREFIX)) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          collections[key] = JSON.parse(raw);
        }
      } catch {
        // Skip unparseable items
        collections[key] = localStorage.getItem(key);
      }
    }
  }

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    app: 'Zumra Hotels RMS',
    collections,
  };
}

/** Download all app data as a JSON file */
export function downloadBackup(): void {
  const data = collectAllData();
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toISOString().split('T')[0];
  link.download = `zumra-hotels-backup-${dateStr}.json`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }, 250);
}

/** Import data from a backup JSON file */
export async function importBackup(file: File): Promise<{ success: boolean; message: string; collectionsRestored: number }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data: BackupData = JSON.parse(reader.result as string);
        if (!data.collections || !data.app) {
          resolve({ success: false, message: 'Invalid backup file format', collectionsRestored: 0 });
          return;
        }
        
        let count = 0;
        for (const [key, value] of Object.entries(data.collections)) {
          try {
            localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
            count++;
          } catch (err) {
            console.warn(`[Backup] Failed to restore ${key}:`, err);
          }
        }
        
        resolve({
          success: true,
          message: `Restored ${count} data collections from backup dated ${data.exportedAt}`,
          collectionsRestored: count,
        });
      } catch (err: any) {
        resolve({ success: false, message: `Failed to parse backup: ${err.message}`, collectionsRestored: 0 });
      }
    };
    reader.onerror = () => resolve({ success: false, message: 'Failed to read file', collectionsRestored: 0 });
    reader.readAsText(file);
  });
}

/** Get summary of all stored data */
export function getDataSummary(): Record<string, { count: number; sizeKB: number }> {
  const summary: Record<string, { count: number; sizeKB: number }> = {};
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(BACKUP_PREFIX)) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const count = Array.isArray(parsed) ? parsed.length : 1;
          const sizeKB = Math.round((raw.length * 2) / 1024 * 10) / 10; // UTF-16 estimate
          summary[key.replace(BACKUP_PREFIX, '')] = { count, sizeKB };
        }
      } catch {
        // Skip
      }
    }
  }
  
  return summary;
}
