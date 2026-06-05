/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Account } from '../types';

interface AccountsPageProps {
  accounts: Account[];
  onSaveAccount: (account: Account) => void;
  onDeleteAccount: (id: string) => void;
  onModifyBalances: (fromId: string, toId: string, amount: number) => void;
}

export default function AccountsPage({ accounts, onSaveAccount, onDeleteAccount, onModifyBalances }: AccountsPageProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('SAR');
  const [code, setCode] = useState('');
  const [balance, setBalance] = useState<number>(0);
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<'Cash' | 'Bank'>('Bank');
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterType, setFilterType] = useState<'' | 'Cash' | 'Bank'>('');

  // Transfer state
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [showTransferForm, setShowTransferForm] = useState(false);

  const resetForm = () => {
    setName('');
    setCode('');
    setBalance(0);
    setAccountHolderName('');
    setAccountNumber('');
    setAccountType('Bank');
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleEditAccount = (acc: Account) => {
    setEditingId(acc.id);
    setName(acc.name);
    setCode(acc.code || '');
    setBalance(acc.balance);
    setAccountHolderName(acc.accountHolderName || '');
    setAccountNumber(acc.accountNumber || '');
    setAccountType(acc.type);
    setShowAddForm(true);
    setShowTransferForm(false);
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) {
      alert('Please fill out Name and Account Number.');
      return;
    }

    const newAcc: Account = {
      id: editingId || `acc_${Date.now()}`,
      name,
      currency,
      code,
      balance,
      accountHolderName,
      accountNumber,
      type: accountType
    };

    onSaveAccount(newAcc);
    resetForm();
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (transferAmount <= 0) {
      alert('Amount must be positive.');
      return;
    }
    if (!fromAccountId || !toAccountId) {
      alert('Please select both origin and target accounts.');
      return;
    }
    if (fromAccountId === toAccountId) {
      alert('Origin and target accounts cannot be identical.');
      return;
    }

    const source = accounts.find(a => a.id === fromAccountId);
    if (source && source.balance < transferAmount) {
      if (!confirm('Warning: Origin account balance is insufficient, proceed into negative balance?')) {
        return;
      }
    }

    onModifyBalances(fromAccountId, toAccountId, transferAmount);
    setTransferAmount(0);
    setFromAccountId('');
    setToAccountId('');
    setShowTransferForm(false);
    alert('💸 Account transfer settled successfully!');
  };

  // Compute KPIs
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const bankAccounts = accounts.filter(a => a.type === 'Bank');
  const cashAccounts = accounts.filter(a => a.type === 'Cash');
  const bankBalance = bankAccounts.reduce((s, a) => s + a.balance, 0);
  const cashBalance = cashAccounts.reduce((s, a) => s + a.balance, 0);
  const filteredAccounts = filterType ? accounts.filter(a => a.type === filterType) : accounts;

  return (
    <div className="space-y-5 text-xs">
      
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Total Balance</div>
          <div className="text-xl font-black text-slate-900">{totalBalance.toLocaleString()} SAR</div>
        </div>
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-indigo-600 mb-1">Bank Accounts</div>
          <div className="text-xl font-black text-indigo-800">{bankAccounts.length}</div>
          <div className="text-[9px] text-indigo-500 font-mono mt-0.5">{bankBalance.toLocaleString()} SAR</div>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-amber-600 mb-1">Cash Safes</div>
          <div className="text-xl font-black text-amber-800">{cashAccounts.length}</div>
          <div className="text-[9px] text-amber-500 font-mono mt-0.5">{cashBalance.toLocaleString()} SAR</div>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Total Accounts</div>
          <div className="text-xl font-black text-emerald-800">{accounts.length}</div>
        </div>
      </div>

      {/* Upper header action blocks */}
      <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm">
        <div className="border-b border-slate-100 pb-4 mb-4 flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Banks & Cash Safes Ledger</h2>
            <p className="text-xs text-slate-500">Configure bank accounts, credit portfolios, cash tills, and handle transfers.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                setShowTransferForm(false);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow"
            >
              Add Bank/Safe Account
            </button>
            <button
              onClick={() => {
                setShowTransferForm(!showTransferForm);
                setShowAddForm(false);
              }}
              className="bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl transition"
            >
              Transfer Funds
            </button>
          </div>
        </div>

        {/* Action Form Blocks */}
        {showAddForm && (
          <form onSubmit={handleAddAccount} className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl max-w-xl space-y-3 mb-4 animate-in fade-in duration-200">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">Add Account Specs</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Account Type</label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs font-bold"
                >
                  <option value="Bank">🏛️ Bank Account</option>
                  <option value="Cash">💵 Cash Safe</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Account Label</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Al Rajhi Bank 3340"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs font-semibold focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Account Number</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. 1205"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs font-semibold focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Base Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs font-mono font-bold"
                >
                  <option value="SAR">SAR</option>
                  <option value="EGP">EGP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Account Holder Name (Beneficiary)</label>
                <input
                  type="text"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="e.g. Zumra Hotels LLC"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs font-semibold focus:outline-none"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">IBAN</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. SA000000000000"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs font-semibold focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Starting Balance (SAR)</label>
                <input
                  type="number"
                  value={balance || ''}
                  onChange={(e) => setBalance(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white font-bold text-xs px-4 py-1.5 rounded-lg">{editingId ? 'Update Account' : 'Save Account'}</button>
              <button type="button" onClick={resetForm} className="bg-slate-200 text-slate-700 font-medium text-xs px-4 py-1.5 rounded-lg">Cancel</button>
            </div>
          </form>
        )}

        {showTransferForm && (
          <form onSubmit={handleTransfer} className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl max-w-lg space-y-3 mb-4 animate-in fade-in duration-200">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">Transfer Book Values Between Accounts</h3>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Origin Account</label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded text-xs"
                >
                  <option value="">-- Origin Source --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} (SAR {a.balance.toLocaleString()})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Target Destination</label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded text-xs"
                >
                  <option value="">-- Target Destination --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} (SAR {a.balance.toLocaleString()})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Transfer Sum (SAR)</label>
                <input
                  type="number"
                  value={transferAmount || ''}
                  onChange={(e) => setTransferAmount(Number(e.target.value))}
                  placeholder="e.g. 5000"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs font-semibold focus:outline-none"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white font-bold text-xs px-4 py-1.5 rounded-lg">Execute Fund Transfer</button>
              <button type="button" onClick={() => setShowTransferForm(false)} className="bg-slate-200 text-slate-700 font-medium text-xs px-4 py-1.5 rounded-lg">Cancel</button>
            </div>
          </form>
        )}

        {/* Visual accounts card flow with filter */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilterType('')}
            className={`py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase transition ${!filterType ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            All ({accounts.length})
          </button>
          <button
            onClick={() => setFilterType('Bank')}
            className={`py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase transition ${filterType === 'Bank' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            🏛️ Banks ({bankAccounts.length})
          </button>
          <button
            onClick={() => setFilterType('Cash')}
            className={`py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase transition ${filterType === 'Cash' ? 'bg-amber-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            💵 Cash ({cashAccounts.length})
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredAccounts.map((acc) => (
            <div key={acc.id} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/40 hover:shadow-md transition text-xs flex flex-col justify-between group">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                    CODE {acc.code}
                  </span>
                  <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${acc.type === 'Bank' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}`}>
                    {acc.type === 'Bank' ? '🏛️ Bank' : '💵 Cash'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase font-mono font-bold text-slate-400">{acc.currency} Wallet</span>
                    <button 
                      onClick={() => handleEditAccount(acc)}
                      className="text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={() => {
                        if(window.confirm(`Delete account ${acc.name}?`)){
                          onDeleteAccount(acc.id);
                        }
                      }}
                      className="text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete Account"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <h3 className="font-bold text-slate-800 text-xs mt-3 uppercase">{acc.name}</h3>
              </div>
              <div className="mt-6 flex justify-between items-baseline">
                <span className="text-slate-400 text-[9px] uppercase">Ledger Balance</span>
                <span className="font-mono text-lg font-bold text-slate-900">{acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR</span>
              </div>
            </div>
          ))}
        </div>

      </div>

    </div>
  );
}
