/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { EditApprovalRequest, User } from '../types';

interface EditApprovalModalProps {
  approvals: EditApprovalRequest[];
  currentUser: User;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onClose: () => void;
}

export default function EditApprovalModal({ approvals, currentUser, onApprove, onReject, onClose }: EditApprovalModalProps) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const pending = approvals.filter(a => a.status === 'Pending');
  const processed = approvals.filter(a => a.status !== 'Pending').slice(0, 20);

  const handleReject = (id: string) => {
    onReject(id, rejectReason);
    setRejectingId(null);
    setRejectReason('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Edit Approval Requests</h2>
            <p className="text-xs text-gray-500">{pending.length} pending request{pending.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Pending Requests */}
          {pending.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-4xl mb-2">&#10003;</p>
              <p className="font-medium">No pending approval requests</p>
            </div>
          ) : (
            pending.map(req => (
              <div key={req.id} className="border border-amber-200 rounded-xl p-4 bg-amber-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900">
                      RSV-{req.reservationId} - Edit Request
                    </h4>
                    <p className="text-xs text-gray-500">
                      Requested by <span className="font-medium">{req.requestedBy}</span> on{' '}
                      {new Date(req.requestedAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">Pending</span>
                </div>

                {/* Changes diff */}
                <div className="bg-white border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">Field</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">Current Value</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">Proposed Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {req.changes.map((change, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-medium">{change.field}</td>
                          <td className="px-3 py-2 text-red-700 bg-red-50/50">
                            <span className="line-through">{change.oldValue || '(empty)'}</span>
                          </td>
                          <td className="px-3 py-2 text-emerald-700 bg-emerald-50/50 font-medium">
                            {change.newValue || '(empty)'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Actions */}
                {rejectingId === req.id ? (
                  <div className="space-y-2">
                    <input
                      placeholder="Rejection reason (optional)"
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleReject(req.id)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                        Confirm Reject
                      </button>
                      <button onClick={() => { setRejectingId(null); setRejectReason(''); }} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => onApprove(req.id)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
                      Approve & Apply
                    </button>
                    <button onClick={() => setRejectingId(req.id)} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200">
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Processed History */}
          {processed.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-700 text-sm border-t pt-4">Recent Processed</h3>
              {processed.map(req => (
                <div key={req.id} className={`border rounded-lg p-3 text-xs ${req.status === 'Approved' ? 'bg-emerald-50/30 border-emerald-200' : 'bg-red-50/30 border-red-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">RSV-{req.reservationId} by {req.requestedBy}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${req.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      {req.status}
                    </span>
                  </div>
                  {req.approvedBy && <p className="text-gray-500 mt-0.5">by {req.approvedBy} on {req.approvedAt ? new Date(req.approvedAt).toLocaleDateString() : ''}</p>}
                  {req.rejectionReason && <p className="text-red-600 mt-0.5">Reason: {req.rejectionReason}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
