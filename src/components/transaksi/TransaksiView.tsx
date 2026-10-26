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
  ReceiptText,
  SearchX,
} from 'lucide-react';
import { Txn, TxnType } from '../../types/index.ts';

const SOURCE_LABELS: Record<string, string> = {
  voice: 'Suara',
  ocr: 'Foto',
  qr: 'QRIS',
  sms: 'SMS',
  notification: 'Notif',
  recurring: 'Rutin',
  import: 'Impor',
};

export const TransaksiView: React.FC = () => {
  const {
    transactions,
    categories,
    accounts,
    deleteTransaction,
    updateTransaction,
    openCatat,
    settings,
  } = useApp();

  const isPinkTheme = settings.theme === 'pink';

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

  const totalConfirmed = transactions.filter(t => !t.deleted_at && t.status !== 'draft').length;
  const hasActiveFilters = Boolean(searchQuery.trim()) || selectedType !== 'all' || selectedAccount !== 'all' || selectedCategory !== 'all';
  const inputClass = `w-full px-3 py-2 rounded-xl text-sm outline-none border transition ${
    isPinkTheme
      ? 'bg-white border-pink-200 text-[#37131D] focus:border-pink-400'
      : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-900 dark:text-slate-100 focus:border-slate-300 dark:focus:border-slate-600'
  }`;
  const labelClass = `text-[11px] font-bold uppercase block mb-1 ${isPinkTheme ? 'text-pink-500/80' : 'text-slate-400'}`;

  return (
    <div className="p-4 space-y-3.5">
      {/* Title & Add button */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className={`text-xl font-bold tracking-tight ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
            {isPinkTheme ? 'Riwayat Transaksi ✨' : 'Riwayat Transaksi'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {filteredTxns.length} dari {totalConfirmed} transaksi
          </p>
        </div>
        <button
          onClick={() => openCatat('manual')}
          aria-label="Tambah transaksi"
          className={`flex items-center gap-1.5 px-3.5 py-2 ${isPinkTheme ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200' : 'bg-emerald-600 hover:bg-emerald-500'} text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95 shrink-0`}
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
          aria-label="Cari transaksi"
          className={`w-full pl-9 pr-9 py-2.5 rounded-xl text-base sm:text-xs border outline-none placeholder:text-slate-400 transition ${
            isPinkTheme
              ? 'bg-white border-pink-200 text-[#37131D] focus:border-pink-400'
              : 'bg-slate-100/80 dark:bg-slate-800/80 border-transparent focus:border-slate-300 dark:focus:border-slate-700 text-slate-800 dark:text-slate-100'
          }`}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            aria-label="Hapus pencarian"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* iOS Segmented Filter Controls */}
      <div
        role="group"
        aria-label="Filter jenis transaksi"
        className={`grid grid-cols-4 gap-1 p-0.5 rounded-xl text-xs font-medium ${isPinkTheme ? 'bg-pink-100/70' : 'bg-slate-200/60 dark:bg-slate-800/80'}`}
      >
        <button
          onClick={() => setSelectedType('all')}
          aria-pressed={selectedType === 'all'}
          className={`py-1.5 rounded-lg transition text-center ${
            selectedType === 'all'
              ? isPinkTheme ? 'bg-white text-rose-600 font-bold shadow-2xs' : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-2xs'
              : isPinkTheme ? 'text-pink-600/70 hover:text-pink-900' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Semua
        </button>
        <button
          onClick={() => setSelectedType('expense')}
          aria-pressed={selectedType === 'expense'}
          className={`py-1.5 rounded-lg transition text-center ${
            selectedType === 'expense'
              ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 font-bold shadow-2xs'
              : isPinkTheme ? 'text-pink-600/70 hover:text-pink-900' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Keluar
        </button>
        <button
          onClick={() => setSelectedType('income')}
          aria-pressed={selectedType === 'income'}
          className={`py-1.5 rounded-lg transition text-center ${
            selectedType === 'income'
              ? isPinkTheme ? 'bg-white text-emerald-600 font-bold shadow-2xs' : 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 font-bold shadow-2xs'
              : isPinkTheme ? 'text-pink-600/70 hover:text-pink-900' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Masuk
        </button>
        <button
          onClick={() => setSelectedType('transfer')}
          aria-pressed={selectedType === 'transfer'}
          className={`py-1.5 rounded-lg transition text-center ${
            selectedType === 'transfer'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-bold shadow-2xs'
              : isPinkTheme ? 'text-pink-600/70 hover:text-pink-900' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Transfer
        </button>
      </div>

      {/* Grouped Daily Inset Lists */}
      {groupedByDay.length === 0 ? (
        <div className={`text-center py-12 px-4 rounded-2xl border ${isPinkTheme ? 'bg-white/70 border-pink-200/70' : 'bg-white dark:bg-[#151E2E] border-slate-200/80 dark:border-slate-800/80'}`}>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mx-auto ${isPinkTheme ? 'bg-pink-50 text-pink-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
            {totalConfirmed === 0 ? <ReceiptText className="w-5 h-5" /> : <SearchX className="w-5 h-5" />}
          </div>
          <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-2.5">
            {totalConfirmed === 0 ? 'Belum ada transaksi' : 'Tidak ada hasil'}
          </div>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">
            {totalConfirmed === 0
              ? 'Mulai catat pengeluaran atau pemasukan pertamamu. Bisa lewat keypad, suara, foto nota, atau QRIS.'
              : 'Coba ubah kata kunci atau filter pencarian.'}
          </p>
          {totalConfirmed === 0 ? (
            <button
              onClick={() => openCatat('manual')}
              className={`mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition active:scale-95 ${isPinkTheme ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-600 hover:bg-emerald-500'}`}
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              Catat Transaksi
            </button>
          ) : hasActiveFilters ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedType('all');
                setSelectedAccount('all');
                setSelectedCategory('all');
              }}
              className={`mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
                isPinkTheme ? 'bg-pink-100 text-pink-700 hover:bg-pink-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Reset Filter
            </button>
          ) : null}
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
                    const accountLabel =
                      t.type === 'transfer' && t.to_account_id
                        ? `${getAccountName(t.account_id)} → ${getAccountName(t.to_account_id)}`
                        : getAccountName(t.account_id);
                    const sourceLabel = SOURCE_LABELS[t.source];

                    return (
                      <div
                        key={t.id}
                        className={`p-3.5 flex items-center justify-between gap-3 transition group ${isPinkTheme ? 'hover:bg-pink-50/60' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/50'}`}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`Edit transaksi ${t.merchant || cat.name}`}
                          className="flex items-center gap-3 min-w-0 cursor-pointer flex-1 rounded-lg outline-none"
                          onClick={() => setEditingTxn(t)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setEditingTxn(t);
                            }
                          }}
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
                              {sourceLabel && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                                  isPinkTheme
                                    ? 'bg-pink-50 text-pink-500'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                }`}>
                                  {sourceLabel}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                              <span>{timeStr}</span>
                              <span>•</span>
                              <span className="truncate">{accountLabel}</span>
                              {t.note && (
                                <>
                                  <span>•</span>
                                  <span className="truncate italic">{t.note}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
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

                          <button
                            onClick={() => {
                              if (window.confirm('Hapus transaksi ini? Tindakan tidak bisa dibatalkan.')) {
                                deleteTransaction(t.id);
                              }
                            }}
                            aria-label={`Hapus transaksi ${t.merchant || cat.name}`}
                            title="Hapus transaksi"
                            className="w-8 h-8 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
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
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEditingTxn(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-txn-title"
            onClick={e => e.stopPropagation()}
            className={`rounded-2xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl border animate-scale-up ${
              isPinkTheme
                ? 'bg-[#FFF5F7] border-pink-200 text-[#37131D]'
                : 'bg-white dark:bg-[#151E2E] border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="edit-txn-title"
                  className={`font-bold text-sm ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}
                >
                  Edit Transaksi
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Perubahan langsung tersimpan di perangkat.
                </p>
              </div>
              <button
                onClick={() => setEditingTxn(null)}
                aria-label="Tutup"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label htmlFor="edit-txn-amount" className={labelClass}>Nominal (Rp)</label>
                <input
                  id="edit-txn-amount"
                  type="number"
                  inputMode="numeric"
                  value={editingTxn.amount || ''}
                  placeholder="0"
                  onChange={e =>
                    setEditingTxn({ ...editingTxn, amount: Math.max(0, Number(e.target.value)) })
                  }
                  className={`${inputClass} font-bold tabular-nums`}
                />
              </div>

              <div>
                <label htmlFor="edit-txn-merchant" className={labelClass}>Toko / Penerima</label>
                <input
                  id="edit-txn-merchant"
                  type="text"
                  value={editingTxn.merchant || ''}
                  onChange={e =>
                    setEditingTxn({ ...editingTxn, merchant: e.target.value })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="edit-txn-note" className={labelClass}>Catatan</label>
                <input
                  id="edit-txn-note"
                  type="text"
                  value={editingTxn.note || ''}
                  onChange={e => setEditingTxn({ ...editingTxn, note: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="edit-txn-category" className={labelClass}>Kategori</label>
                <select
                  id="edit-txn-category"
                  value={editingTxn.category_id || ''}
                  onChange={e =>
                    setEditingTxn({ ...editingTxn, category_id: e.target.value })
                  }
                  className={inputClass}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.kind === 'expense' ? 'Keluar' : 'Masuk'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit-txn-account" className={labelClass}>Dompet</label>
                <select
                  id="edit-txn-account"
                  value={editingTxn.account_id}
                  onChange={e =>
                    setEditingTxn({ ...editingTxn, account_id: e.target.value })
                  }
                  className={inputClass}
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
                  if (window.confirm('Hapus transaksi ini? Tindakan tidak bisa dibatalkan.')) {
                    deleteTransaction(editingTxn.id);
                    setEditingTxn(null);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
                  isPinkTheme
                    ? 'text-rose-600 bg-rose-100/70 hover:bg-rose-200/70'
                    : 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus
              </button>
              <button
                onClick={() => {
                  updateTransaction(editingTxn.id, editingTxn);
                  setEditingTxn(null);
                }}
                className={`flex-1 py-2 text-white rounded-xl text-xs font-bold transition active:scale-[0.98] ${
                  isPinkTheme
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 shadow-xs shadow-rose-200'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
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
