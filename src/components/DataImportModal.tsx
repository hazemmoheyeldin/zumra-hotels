/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from 'react';
import { showToast } from './Toast';

type EntityType = 'Hotels' | 'Agents' | 'Reservations' | 'Transactions';

interface DataImportModalProps {
  onClose: () => void;
  onImport: (entity: EntityType, rows: Record<string, string>[]) => Promise<number>;
}

const entityTemplates: Record<EntityType, { columns: string[]; sample: Record<string, string> }> = {
  Hotels: {
    columns: ['name', 'city', 'stars', 'address', 'contact', 'roomTypes', 'views', 'mealPlans'],
    sample: { name: 'Grand Palace Hotel', city: 'Cairo', stars: '5', address: '123 Nile Corniche', contact: '+20-2-12345', roomTypes: 'Single,Double,Suite', views: 'City,Pool', mealPlans: 'BB,HB,FB' },
  },
  Agents: {
    columns: ['name', 'companyName', 'country', 'type', 'phone', 'email', 'address', 'balance'],
    sample: { name: 'John Travel', companyName: 'TravelCo', country: 'Egypt', type: 'Customer', phone: '+20-100-1234', email: 'john@travelco.com', address: '456 Tahrir St', balance: '0' },
  },
  Reservations: {
    columns: ['checkIn', 'checkOut', 'clientId', 'hotelId', 'guestName', 'guestNationality', 'supplierId', 'status', 'roomType', 'rooms', 'sellRate', 'buyRate'],
    sample: { checkIn: '2025-02-01', checkOut: '2025-02-05', clientId: 'C-001', hotelId: 'H001', guestName: 'Ahmed Ali', guestNationality: 'Egyptian', supplierId: 'S-001', status: 'Confirmed', roomType: 'Double', rooms: '1', sellRate: '500', buyRate: '350' },
  },
  Transactions: {
    columns: ['date', 'type', 'amount', 'agentId', 'reservationId', 'description', 'paymentMethod', 'fromAccountId'],
    sample: { date: '2025-01-15', type: 'ClientPayment', amount: '5000', agentId: 'C-001', reservationId: '1', description: 'Payment for RSV-1', paymentMethod: 'Bank Transfer', fromAccountId: '' },
  },
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSVText(text: string): string[][] {
  return text.split(/\r?\n/).filter(l => l.trim()).map(parseCSVLine);
}

export default function DataImportModal({ onClose, onImport }: DataImportModalProps) {
  const [entity, setEntity] = useState<EntityType>('Hotels');
  const [rawRows, setRawRows] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const headers = rawRows ? rawRows[0] : null;
  const dataRows = rawRows ? rawRows.slice(1) : [];
  const previewRows = dataRows.slice(0, 5);

  // Column mapping: auto-map by header name
  const columnMap = useMemo(() => {
    if (!headers) return {};
    const template = entityTemplates[entity].columns;
    const map: Record<number, string> = {};
    headers.forEach((h, i) => {
      const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      const match = template.find(c => c.toLowerCase().replace(/[^a-z0-9]/g, '') === clean);
      if (match) map[i] = match;
    });
    return map;
  }, [headers, entity]);

  const mappedColumns = Object.values(columnMap);
  const requiredColumns = entityTemplates[entity].columns;
  const missingColumns = requiredColumns.filter(c => !mappedColumns.includes(c));

  // Validation
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!rawRows) return errors;
    if (dataRows.length === 0) errors.push('No data rows found in file');
    if (missingColumns.length > 0) errors.push(`Missing columns: ${missingColumns.join(', ')}`);
    // Check first few rows for empty required fields
    previewRows.forEach((row, ri) => {
      requiredColumns.forEach(col => {
        const colIdx = Object.entries(columnMap).find(([, v]) => v === col)?.[0];
        if (colIdx !== undefined && (!row[Number(colIdx)] || row[Number(colIdx)].trim() === '')) {
          errors.push(`Row ${ri + 1}: missing value for "${col}"`);
        }
      });
    });
    return errors;
  }, [rawRows, dataRows, missingColumns, previewRows, columnMap, requiredColumns]);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setRawRows(null);
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv' || ext === 'txt') {
      const text = await file.text();
      const rows = parseCSVText(text);
      setRawRows(rows);
    } else if (ext === 'xlsx' || ext === 'xls') {
      try {
        const XLSX = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
        setRawRows(data.map(r => r.map(c => String(c ?? ''))));
      } catch (e) {
        showToast('Failed to parse Excel file', 'error');
      }
    } else {
      showToast('Unsupported file format. Use CSV or Excel.', 'error');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (!rawRows || missingColumns.length > 0) {
      showToast('Fix column mapping issues before importing', 'warning');
      return;
    }
    setImporting(true);
    setProgress(0);

    // Convert rows to records
    const rows: Record<string, string>[] = dataRows.map(row => {
      const record: Record<string, string> = {};
      Object.entries(columnMap).forEach(([idx, col]) => {
        record[col] = row[Number(idx)] || '';
      });
      return record;
    });

    try {
      const count = await onImport(entity, rows);
      showToast(`Successfully imported ${count} ${entity}`, 'success');
      onClose();
    } catch (e: any) {
      showToast(`Import failed: ${e.message || 'Unknown error'}`, 'error');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const tmpl = entityTemplates[entity];
    const csvContent = [tmpl.columns.join(','), Object.values(tmpl.sample).join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entity.toLowerCase()}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[95dvh] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span>📥</span> Import Data
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Entity selector */}
          <div className="flex items-center gap-3">
            <label className="text-[10px] uppercase font-bold text-slate-500">Entity Type</label>
            <select
              value={entity}
              onChange={e => { setEntity(e.target.value as EntityType); setRawRows(null); }}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold"
            >
              {(['Hotels', 'Agents', 'Reservations', 'Transactions'] as EntityType[]).map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
            <button
              onClick={downloadTemplate}
              className="ml-auto text-[10px] font-bold text-amber-600 hover:text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 transition"
            >
              Download Template CSV
            </button>
          </div>

          {/* File upload zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer ${
              dragOver ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50'
            }`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />
            <div className="text-3xl mb-2">📁</div>
            <p className="text-sm font-medium text-slate-600">
              {fileName ? fileName : 'Drop CSV or Excel file here, or click to browse'}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Supports .csv, .xlsx, .xls</p>
          </div>

          {/* Column mapping preview */}
          {rawRows && headers && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-slate-700">
                  Preview ({dataRows.length} rows)
                </h3>
                <div className="text-[10px] text-slate-500">
                  {mappedColumns.length}/{requiredColumns.length} columns mapped
                </div>
              </div>

              {/* Mapping summary */}
              <div className="flex flex-wrap gap-1.5">
                {requiredColumns.map(col => {
                  const isMapped = mappedColumns.includes(col);
                  return (
                    <span
                      key={col}
                      className={`text-[9px] font-bold px-2 py-1 rounded-full ${
                        isMapped ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {isMapped ? '✓' : '✗'} {col}
                    </span>
                  );
                })}
              </div>

              {/* Data preview table */}
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="text-[10px] w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      {headers.map((h, i) => (
                        <th key={i} className="px-2 py-1.5 border-r border-slate-200 text-left font-bold text-slate-600 whitespace-nowrap">
                          {h}
                          {columnMap[i] && (
                            <div className="text-[8px] font-normal text-emerald-600">→ {columnMap[i]}</div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map((row, ri) => (
                      <tr key={ri} className="hover:bg-slate-50">
                        {headers.map((_, ci) => (
                          <td key={ci} className="px-2 py-1 border-r border-slate-100 text-slate-700 font-mono whitespace-nowrap max-w-[150px] truncate">
                            {row[ci] || <span className="text-slate-300 italic">empty</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {dataRows.length > 5 && (
                <p className="text-[10px] text-slate-400 text-center">
                  Showing 5 of {dataRows.length} rows
                </p>
              )}
            </div>
          )}

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
              <div className="text-[10px] font-bold uppercase text-rose-600 mb-1">Validation Issues</div>
              <ul className="text-[10px] text-rose-700 space-y-0.5">
                {validationErrors.map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Import button */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleImport}
              disabled={!rawRows || missingColumns.length > 0 || importing}
              className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition shadow"
            >
              {importing ? `Importing... ${progress}%` : `Import ${dataRows.length} ${entity}`}
            </button>
            <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-700 font-medium">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
