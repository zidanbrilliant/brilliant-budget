import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { formatIDR, formatDateHeading } from '../../utils/formatters';
import { AppIcon } from '../common/IconHelper';
import {
  Search,
  Filter,
  X,
  Trash2,
  Plus,
} from 'lucide-react';
import { Txn, TxnType } from '../../types/index.ts';

export const TransaksiView: React.FC = () => {
  const {
    transactions,
    categories,
    accounts,
    deleteTransaction,
    updateTransaction,
    openCatat,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | TxnType>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingTxn, setEditingTxn] = useState<Txn | null>(null);

  const filteredTxns = useMemo(() => {
    return transactions.filter(t => {
      if (t.deleted_at || t.status === 'draft') return false;

      if (selectedType !== 'all' && t.type !== selectedType) return false;

      if (selectedAccount !== 'all' && t.account_id !== selectedAccount && t.to_account_id !== selectedAccount)
        return false;

      if (selectedCategory !== 'all' && t.category_id !== selectedCategory) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const merchantMatch = t.merchant?.toLowerCase().includes(query);
        const noteMatch = t.note?.toLowerCase().includes(query);
        const amountMatch = t.amount.toString().includes(query);
        const catName = categories.find(c => c.id === t.category_id)?.name.toLowerCase();
        const catMatch = catName?.includes(query);
        if (!merchantMatch && !noteMatch && !amountMatch && !catMatch) return false;
      }

      return true;
    });
  }, [transactions, selectedType, selectedAccount, selectedCategory, searchQuery, categories]);

  const groupedByDay = useMemo(() => {
    const groups: { [key: string]: { date: Date; items: Txn[]; subtotalExpense: number; subtotalIncome: number } } = {};

    filteredTxns.forEach(t => {
      const d = new Date(t.occurred_at);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;

      if (!groups[dayKey]) {
        groups[dayKey] = {
          date: d,
          items: [],
          subtotalExpense: 0,
          subtotalIncome: 0,
        };
      }

      groups[dayKey].items.push(t);
      if (t.type === 'expense') groups[dayKey].subtotalExpense += t.amount;
      if (t.type === 'income') groups[dayKey].subtotalIncome += t.amount;
    });

    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredTxns]);

  const getCategoryInfo = (catId?: string) => {
    return (
      categories.find(c => c.id === catId) || {
        name: 'Lainnya',
        icon: 'CircleEllipsis',
        color: '#6B7280',
      }
    );
  };

  const getAccountName = (accId: string) => {
    return accounts.find(a => a.id === accId)?.name || 'Dompet';
  };

  return (
    <div className="p-4 space-y-3.5">
      {/* Title & Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Riwayat Transaksi
          </h1>
          <p className="text-xs text-slate-400">
            {filteredTxns.length} transaksi tercatat
          </p>
        </div>
        <button
          onClick={() => openCatat('manual')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Tambah</span>
        </button>
      </div>

      {/* Apple-style Inset Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Cari transaksi, toko, nominal..."
          className="w-full pl-9 pr-8 py-2 bg-slate-200/50 dark:bg-slate-800/80 rounded-xl text-xs border border-transparent focus:border-slate-300 dark:focus:border-slate-700 outline-none placeholder:text-slate-400 text-slate-800 dark:text-slate-100 transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* iOS Segmented Filter Controls */}
      <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-200/60 dark:bg-slate-800/80 rounded-xl text-xs font-medium">
        <button
          onClick={() => setSelectedType('all')}
          className={`py-1.5 rounded-lg transition text-center ${
            selectedType === 'all'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-2xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Semua
        </button>
        <button
          onClick={() => setSelectedType('expense')}
          className={`py-1.5 rounded-lg transition text-center ${
            selectedType === 'expense'
              ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 font-bold shadow-2xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Keluar
        </button>
        <button
          onClick={() => setSelectedType('income')}
          className={`py-1.5 rounded-lg transition text-center ${
            selectedType === 'income'
              ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 font-bold shadow-2xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Masuk
        </button>
        <button
          onClick={() => setSelectedType('transfer')}
          className={`py-1.5 rounded-lg transition text-center ${
            selectedType === 'transfer'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-bold shadow-2xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Transfer
        </button>
      </div>

      {/* Grouped Daily Inset Lists */}
      {groupedByDay.length === 0 ? (
        <div className="text-center py-14 space-y-2">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Filter className="w-5 h-5" />
          </div>
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Tidak ada transaksi
          </div>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
            Coba ubah kata kunci atau filter pencarian.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDay.map(([dayKey, group]) => {
            return (
              <div key={dayKey} className="space-y-1.5">
                {/* Section Header */}
                <div className="flex items-center justify-between px-1 text-[11px]">
                  <span className="font-bold text-slate-400 uppercase tracking-wider">
                    {formatDateHeading(group.date.getTime())}
                  </span>
                  <div className="font-bold tabular-nums space-x-2">
                    {group.subtotalExpense > 0 && (
                      <span className="text-rose-600 dark:text-rose-400">
                        -{formatIDR(group.subtotalExpense)}
                      </span>
                    )}
                    {group.subtotalIncome > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        +{formatIDR(group.subtotalIncome)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Group Inset Card */}
                <div className="bg-white dark:bg-[#151E2E] rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
                  {group.items.map(t => {
                    const cat = getCategoryInfo(t.category_id);
                    const timeStr = new Date(t.occurred_at).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={t.id}
                        className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition group"
                      >
                        <div
                          className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                          onClick={() => setEditingTxn(t)}
                        >
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white text-xs shadow-2xs"
                            style={{ backgroundColor: cat.color }}
                          >
                            <AppIcon name={cat.icon} className="w-4 h-4 text-white" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {t.merchant || cat.name}
                              </span>
                              {t.source !== 'manual' && (
                                <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1 py-0.2 rounded font-medium">
                                  {t.source}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                              <span>{timeStr}</span>
                              <span>•</span>
                              <span>{getAccountName(t.account_id)}</span>
                              {t.note && (
                                <>
                                  <span>•</span>
                                  <span className="truncate italic">{t.note}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div
                              className={`text-xs font-bold tabular-nums ${
                                t.type === 'income'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : t.type === 'expense'
                                  ? 'text-slate-900 dark:text-slate-100'
                                  : 'text-blue-600 dark:text-blue-400'
                              }`}
                            >
                              {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}
                              {formatIDR(t.amount)}
                            </div>
                          </div>

                          <button
                            onClick={() => deleteTransaction(t.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition"
                            title="Hapus Transaksi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingTxn && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151E2E] rounded-2xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-up">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Edit Transaksi
              </h3>
              <button
                onClick={() => setEditingTxn(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  value={editingTxn.amount}
                  onChange={e =>
                    setEditingTxn({ ...editingTxn, amount: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-bold outline-none tabular-nums"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Toko / Penerima</label>
                <input
                  type="text"
                  value={editingTxn.merchant || ''}
                  onChange={e =>
                    setEditingTxn({ ...editingTxn, merchant: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Catatan</label>
                <input
                  type="text"
                  value={editingTxn.note || ''}
                  onChange={e => setEditingTxn({ ...editingTxn, note: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Kategori</label>
                <select
                  value={editingTxn.category_id || ''}
                  onChange={e =>
                    setEditingTxn({ ...editingTxn, category_id: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.kind === 'expense' ? 'Keluar' : 'Masuk'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Dompet</label>
                <select
                  value={editingTxn.account_id}
                  onChange={e =>
                    setEditingTxn({ ...editingTxn, account_id: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  deleteTransaction(editingTxn.id);
                  setEditingTxn(null);
                }}
                className="px-3 py-2 text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-xs font-bold hover:bg-rose-100 transition"
              >
                Hapus
              </button>
              <button
                onClick={() => {
                  updateTransaction(editingTxn.id, editingTxn);
                  setEditingTxn(null);
                }}
                className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-500 transition"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
