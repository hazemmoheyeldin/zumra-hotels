/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Expenses Management Page - CRUD for expenses with categories and financial integration
 */

import React, { useState, useMemo } from 'react';
import { Expense, ExpenseCategory, Account } from '../types';
import { useLang } from '../lib/LanguageContext';
import { showToast } from './Toast';

interface ExpensesPageProps {
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  accounts: Account[];
  onSaveExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onSaveCategory: (category: ExpenseCategory) => void;
  currentUserId: string;
}

export default function ExpensesPage({
  expenses,
  expenseCategories,
  accounts,
  onSaveExpense,
  onDeleteExpense,
  onSaveCategory,
  currentUserId,
}: ExpensesPageProps) {
  const { t, lang } = useLang();

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [fromAccountId, setFromAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [receiptNo, setReceiptNo] = useState('');

  // Category management
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Saved expense names for autocomplete
  const savedExpenseNames = useMemo(() => {
    const names = new Set<string>();
    expenses.forEach(e => names.add(e.name));
    return Array.from(names);
  }, [expenses]);

  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleNameInput = (val: string) => {
    setName(val);
    if (val.trim().length > 0) {
      const matches = savedExpenseNames.filter(n => n.toLowerCase().includes(val.toLowerCase()));
      setNameSuggestions(matches.slice(0, 8));
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (s: string) => {
    setName(s);
    setShowSuggestions(false);
    // Also auto-fill category from last expense with this name
    const lastExpense = expenses.find(e => e.name === s);
    if (lastExpense) {
      setCategory(lastExpense.category);
      setFromAccountId(lastExpense.fromAccountId);
    }
  };

  // Summary calculations
  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);
  
  const thisMonthTotal = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    return expenses.filter(e => e.date >= monthStart).reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const byCategoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (searchTerm && !e.name.toLowerCase().includes(searchTerm.toLowerCase()) && !e.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterCategory && e.category !== filterCategory) return false;
      if (filterAccount && e.fromAccountId !== filterAccount) return false;
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, searchTerm, filterCategory, filterAccount, dateFrom, dateTo]);

  const handleEdit = (exp: Expense) => {
    setEditingId(exp.id);
    setName(exp.name);
    setCategory(exp.category);
    setAmount(exp.amount.toString());
    setDate(exp.date);
    setFromAccountId(exp.fromAccountId);
    setDescription(exp.description);
    setReceiptNo(exp.receiptNo || '');
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { showToast('Please enter expense name', 'warning'); return; }
    if (!amount || parseFloat(amount) <= 0) { showToast('Please enter a valid amount', 'warning'); return; }
    if (!fromAccountId) { showToast('Please select the paying account', 'warning'); return; }

    const expense: Expense = {
      id: editingId || `exp_${Date.now()}`,
      expenseNumber: editingId ? expenses.find(e => e.id === editingId)?.expenseNumber || expenses.length + 1 : expenses.length + 1,
      name: name.trim(),
      category: category || 'Other',
      amount: parseFloat(amount),
      date,
      fromAccountId,
      description: description.trim(),
      receiptNo: receiptNo.trim() || undefined,
      createdBy: currentUserId,
      createdAt: editingId ? expenses.find(e => e.id === editingId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
    };

    onSaveExpense(expense);
    resetForm();
    showToast(editingId ? 'Expense updated' : 'Expense added', 'success');
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setCategory('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setFromAccountId('');
    setDescription('');
    setReceiptNo('');
    setShowForm(false);
    setShowSuggestions(false);
  };

  const getCategoryName = (catId: string) => {
    return expenseCategories.find(c => c.id === catId || c.name === catId)?.name || catId;
  };

  const getAccountName = (accId: string) => {
    return accounts.find(a => a.id === accId)?.name || accId;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-6 shadow-sm">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{lang === 'ar' ? 'المصروفات' : 'Expenses'}</h2>
            <p className="text-xs text-slate-500">{lang === 'ar' ? 'إدارة المصروفات والمدفوعات' : 'Track and manage expenses and payments'}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCategoryManager(!showCategoryManager)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3 py-2 rounded-xl transition"
            >
              {lang === 'ar' ? 'إدارة الفئات' : 'Categories'}
            </button>
            <button
              onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition shadow flex items-center gap-1"
            >
              {showForm ? (lang === 'ar' ? 'عرض القائمة' : 'View List') : `+ ${lang === 'ar' ? 'إضافة مصروف' : 'Add Expense'}`}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-200/50 rounded-xl p-3">
            <p className="text-[9px] uppercase font-bold text-rose-600">{lang === 'ar' ? 'إجمالي المصروفات' : 'Total Expenses'}</p>
            <p className="text-lg font-black text-rose-800">{totalExpenses.toLocaleString()} SAR</p>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200/50 rounded-xl p-3">
            <p className="text-[9px] uppercase font-bold text-amber-600">{lang === 'ar' ? 'هذا الشهر' : 'This Month'}</p>
            <p className="text-lg font-black text-amber-800">{thisMonthTotal.toLocaleString()} SAR</p>
          </div>
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-200/50 rounded-xl p-3">
            <p className="text-[9px] uppercase font-bold text-indigo-600">{lang === 'ar' ? 'عدد المصروفات' : 'Total Entries'}</p>
            <p className="text-lg font-black text-indigo-800">{expenses.length}</p>
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200/50 rounded-xl p-3">
            <p className="text-[9px] uppercase font-bold text-slate-600">{lang === 'ar' ? 'الفئات' : 'Categories'}</p>
            <p className="text-lg font-black text-slate-800">{expenseCategories.filter(c => c.active).length}</p>
          </div>
        </div>

        {/* By Category Breakdown */}
        {byCategoryTotals.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {byCategoryTotals.map(([cat, total]) => (
              <span key={cat} className="text-[10px] font-semibold bg-slate-100 px-2 py-1 rounded-lg text-slate-600">
                {getCategoryName(cat)}: <span className="font-bold text-slate-800">{total.toLocaleString()} SAR</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Category Manager */}
      {showCategoryManager && (
        <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-3">{lang === 'ar' ? 'إدارة فئات المصروفات' : 'Expense Categories'}</h3>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder={lang === 'ar' ? 'اسم الفئة الجديدة' : 'New category name...'}
              className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
            />
            <button
              onClick={() => {
                if (newCatName.trim()) {
                  const newCat: ExpenseCategory = { id: `cat_${Date.now()}`, name: newCatName.trim(), active: true };
                  onSaveCategory(newCat);
                  setNewCatName('');
                  showToast('Category added', 'success');
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {expenseCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  onSaveCategory({ ...cat, active: !cat.active });
                }}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition ${
                  cat.active ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {editingId ? (lang === 'ar' ? 'تعديل المصروف' : 'Edit Expense') : (lang === 'ar' ? 'مصروف جديد' : 'New Expense')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Expense Name with Autocomplete */}
              <div className="md:col-span-2 relative">
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{lang === 'ar' ? 'اسم المصروف' : 'Expense Name'}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameInput(e.target.value)}
                  onFocus={() => { if (name.trim()) setShowSuggestions(true); }}
                  placeholder={lang === 'ar' ? 'مثل: كهرباء، شحن هاتف...' : 'e.g. Electricity, Phone Recharge, Transport...'}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
                  required
                />
                {showSuggestions && nameSuggestions.length > 0 && (
                  <div className="absolute z-30 w-full mt-0.5 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {nameSuggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => selectSuggestion(s)}
                        className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-amber-50 transition border-b border-slate-50 last:border-0"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{lang === 'ar' ? 'الفئة' : 'Category'}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:border-amber-500 focus:outline-none"
                >
                  <option value="">{lang === 'ar' ? 'اختر الفئة' : 'Select category'}</option>
                  {expenseCategories.filter(c => c.active).map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{lang === 'ar' ? 'المبلغ' : 'Amount'} (SAR)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              {/* Date */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{lang === 'ar' ? 'التاريخ' : 'Date'}</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              {/* From Account */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{lang === 'ar' ? 'من حساب' : 'From Account'}</label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:border-amber-500 focus:outline-none"
                  required
                >
                  <option value="">{lang === 'ar' ? 'اختر الحساب' : 'Select account'}</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.type === 'Cash' ? '💵' : '🏦'} {a.name} ({a.balance.toLocaleString()} SAR)</option>
                  ))}
                </select>
              </div>

              {/* Receipt Number */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{lang === 'ar' ? 'رقم الإيصال' : 'Receipt No.'}</label>
                <input
                  type="text"
                  value={receiptNo}
                  onChange={(e) => setReceiptNo(e.target.value)}
                  placeholder={lang === 'ar' ? 'اختياري' : 'Optional'}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">{lang === 'ar' ? 'الوصف' : 'Description'}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={lang === 'ar' ? 'تفاصيل إضافية...' : 'Additional details...'}
                  rows={2}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:border-amber-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2 rounded-xl transition shadow">
                {editingId ? (lang === 'ar' ? 'تحديث' : 'Update') : (lang === 'ar' ? 'حفظ' : 'Save Expense')}
              </button>
              <button type="button" onClick={resetForm} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs px-5 py-2 rounded-xl transition">
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Expense List */}
      <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-6 shadow-sm">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            type="text"
            placeholder={lang === 'ar' ? 'بحث...' : 'Search expenses...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs w-full max-w-xs"
          />
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
            <option value="">{lang === 'ar' ? 'كل الفئات' : 'All Categories'}</option>
            {expenseCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
            <option value="">{lang === 'ar' ? 'كل الحسابات' : 'All Accounts'}</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs" />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-2 font-bold text-slate-600">#</th>
                <th className="text-left py-2 px-2 font-bold text-slate-600">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="text-left py-2 px-2 font-bold text-slate-600">{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                <th className="text-left py-2 px-2 font-bold text-slate-600">{lang === 'ar' ? 'الفئة' : 'Category'}</th>
                <th className="text-left py-2 px-2 font-bold text-slate-600">{lang === 'ar' ? 'الحساب' : 'Account'}</th>
                <th className="text-right py-2 px-2 font-bold text-slate-600">{lang === 'ar' ? 'المبلغ' : 'Amount'}</th>
                <th className="text-center py-2 px-2 font-bold text-slate-600">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">{lang === 'ar' ? 'لا توجد مصروفات' : 'No expenses found'}</td></tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                    <td className="py-2 px-2 font-mono text-slate-400">{exp.expenseNumber}</td>
                    <td className="py-2 px-2 font-mono text-slate-600">{exp.date}</td>
                    <td className="py-2 px-2">
                      <span className="font-semibold text-slate-800">{exp.name}</span>
                      {exp.receiptNo && <span className="text-[9px] text-slate-400 ml-1">(#{exp.receiptNo})</span>}
                    </td>
                    <td className="py-2 px-2">
                      <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[9px] font-bold border border-indigo-100">
                        {getCategoryName(exp.category)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-slate-600">{getAccountName(exp.fromAccountId)}</td>
                    <td className="py-2 px-2 text-right font-bold text-rose-700">{exp.amount.toLocaleString()} SAR</td>
                    <td className="py-2 px-2 text-center">
                      <button onClick={() => handleEdit(exp)} className="text-amber-600 hover:text-amber-800 mr-2" title="Edit">✏️</button>
                      <button onClick={() => { if (confirm(lang === 'ar' ? 'حذف هذا المصروف؟' : 'Delete this expense?')) onDeleteExpense(exp.id); }} className="text-red-500 hover:text-red-700" title="Delete">🗑️</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredExpenses.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300">
                  <td colSpan={5} className="py-2 px-2 font-bold text-slate-700 text-right">{lang === 'ar' ? 'الإجمالي:' : 'Total:'}</td>
                  <td className="py-2 px-2 text-right font-black text-rose-800 text-sm">{filteredExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString()} SAR</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
