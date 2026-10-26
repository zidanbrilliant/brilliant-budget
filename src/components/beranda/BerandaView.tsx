import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatIDR, formatCompactIDR, formatDateRelative } from '../../utils/formatters';
import { AppIcon } from '../common/IconHelper';
import {
  Mic,
  Camera,
  QrCode,
  Edit3,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  Trash2,
  TrendingUp,
  CreditCard,
  Sparkles,
  Heart,
} from 'lucide-react';

export const BerandaView: React.FC = () => {
  const {
    accounts,
    categories,
    transactions,
    budget,
    goals,
    getAccountBalance,
    getMonthSummary,
    confirmDraft,
    confirmAllDrafts,
    discardDraft,
    openCatat,
    setActiveTab,
    settings,
  } = useApp();

  const isPinkTheme = settings.theme === 'pink';

  const summary = getMonthSummary();
  const totalBudget = budget.total_limit || 0;
  const budgetSpentPercent = totalBudget > 0 ? Math.min(100, Math.round((summary.expense / totalBudget) * 100)) : 0;
  const isBudgetWarning = totalBudget > 0 && budgetSpentPercent >= 80 && budgetSpentPercent < 100;
  const isBudgetExceeded = totalBudget > 0 && budgetSpentPercent >= 100;

  const drafts = transactions.filter(t => t.status === 'draft' && !t.deleted_at);
  const confirmedTxns = transactions
    .filter(t => t.status === 'confirmed' && !t.deleted_at)
    .slice(0, 5);

  const getCategoryInfo = (catId?: string) => {
    return categories.find(c => c.id === catId) || {
      name: 'Lainnya',
      icon: 'Heart',
      color: '#FB7185',
    };
  };

  const getAccountInfo = (accId: string) => {
    return accounts.find(a => a.id === accId) || {
      name: 'Dompet',
      icon: 'PiggyBank',
      color: '#FB7185',
    };
  };

  return (
    <div className="px-5 py-4 space-y-6">
      {/* 1. HERO: Balance & Budget Card */}
      <section className={`rounded-3xl p-5 shadow-sm ${
        isPinkTheme
          ? 'bg-gradient-to-br from-[#E11D48] to-[#BE123C] text-white shadow-rose-200/50'
          : 'bg-[#0F172A] dark:bg-[#111827] text-white border border-slate-800'
      }`}>
        <div className="flex items-center justify-between gap-2">
          <span className={`uppercase tracking-wider font-bold text-[11px] ${isPinkTheme ? 'text-pink-100' : 'text-slate-400'}`}>
            {isPinkTheme ? 'Sisa Anggaran Bulan Ini ✨' : 'Sisa Anggaran Bulan Ini'}
          </span>
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold tabular-nums border shrink-0 ${
              isBudgetExceeded
                ? 'bg-rose-500/25 text-rose-100 border-rose-300/40'
                : isBudgetWarning
                ? 'bg-amber-400/20 text-amber-100 border-amber-300/40'
                : isPinkTheme
                ? 'bg-white/15 text-white border-white/20'
                : 'bg-emerald-400/15 text-emerald-200 border-emerald-300/30'
            }`}
          >
            {budgetSpentPercent}% terpakai
          </span>
        </div>

        <div className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums truncate">
          {formatIDR(summary.remainingBudget)}
        </div>
        <div className={`text-[11px] mt-0.5 tabular-nums ${isPinkTheme ? 'text-pink-100/90' : 'text-slate-400'}`}>
          dari {formatIDR(totalBudget)}
        </div>

        <div className={`w-full ${isPinkTheme ? 'bg-black/20' : 'bg-slate-800'} rounded-full h-2.5 mt-3.5 overflow-hidden`}>
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isBudgetExceeded
                ? 'bg-rose-300'
                : isBudgetWarning
                ? 'bg-amber-300'
                : isPinkTheme
                ? 'bg-white'
                : 'bg-emerald-400'
            }`}
            style={{ width: `${budgetSpentPercent}%` }}
          ></div>
        </div>

        <div className={`grid grid-cols-2 gap-3 mt-5 pt-4 border-t ${isPinkTheme ? 'border-white/15' : 'border-white/10'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isPinkTheme ? 'bg-white/10 text-white' : 'bg-rose-500/15 text-rose-300'}`}>
              <ArrowUpRight className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className={`text-[11px] font-semibold ${isPinkTheme ? 'text-pink-100/80' : 'text-slate-400'}`}>Pengeluaran</div>
              <div className="text-sm font-bold tabular-nums truncate text-white">
                {formatIDR(summary.expense)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isPinkTheme ? 'bg-white/10 text-emerald-200' : 'bg-emerald-500/15 text-emerald-300'}`}>
              <ArrowDownLeft className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className={`text-[11px] font-semibold ${isPinkTheme ? 'text-pink-100/80' : 'text-slate-400'}`}>Pemasukan</div>
              <div className={`text-sm font-bold tabular-nums truncate ${isPinkTheme ? 'text-emerald-100' : 'text-emerald-300'}`}>
                {formatIDR(summary.income)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ACTION CAPSULES: Clean Fast-Entry Row */}
      <section>
        <div className="grid grid-cols-5 gap-1.5">
          <button
            onClick={() => openCatat('manual')}
            className={`min-h-[64px] flex flex-col items-center justify-center py-3 px-1.5 ${
              isPinkTheme
                ? 'bg-white hover:border-pink-300 text-pink-900 border-pink-200/80 shadow-pink-100/20'
                : 'bg-white dark:bg-[#151E2E] border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-500 shadow-2xs'
            } rounded-2xl border active:scale-95 transition`}
          >
            <Edit3 className={`w-5 h-5 mb-1.5 ${isPinkTheme ? 'text-pink-600' : 'text-slate-700 dark:text-slate-300'}`} />
            <span className="text-[11px] font-bold">Ketik</span>
          </button>

          <button
            onClick={() => openCatat('manual', 'income')}
            className={`min-h-[64px] flex flex-col items-center justify-center py-3 px-1.5 ${
              isPinkTheme
                ? 'bg-white hover:border-pink-300 text-pink-900 border-pink-200/80 shadow-pink-100/20'
                : 'bg-white dark:bg-[#151E2E] border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-500 shadow-2xs'
            } rounded-2xl border active:scale-95 transition`}
          >
            <ArrowDownLeft className={`w-5 h-5 mb-1.5 ${isPinkTheme ? 'text-emerald-600' : 'text-emerald-600 dark:text-emerald-400'}`} />
            <span className="text-[11px] font-bold">Masuk</span>
          </button>

          <button
            onClick={() => openCatat('voice')}
            className={`min-h-[64px] flex flex-col items-center justify-center py-3 px-1.5 ${
              isPinkTheme
                ? 'bg-white hover:border-pink-300 text-pink-900 border-pink-200/80 shadow-pink-100/20'
                : 'bg-white dark:bg-[#151E2E] border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-500 shadow-2xs'
            } rounded-2xl border active:scale-95 transition`}
          >
            <Mic className={`w-5 h-5 mb-1.5 ${isPinkTheme ? 'text-pink-600' : 'text-slate-700 dark:text-slate-300'}`} />
            <span className="text-[11px] font-bold">Suara</span>
          </button>

          <button
            onClick={() => openCatat('ocr')}
            className={`min-h-[64px] flex flex-col items-center justify-center py-3 px-1.5 ${
              isPinkTheme
                ? 'bg-white hover:border-pink-300 text-pink-900 border-pink-200/80 shadow-pink-100/20'
                : 'bg-white dark:bg-[#151E2E] border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-500 shadow-2xs'
            } rounded-2xl border active:scale-95 transition`}
          >
            <Camera className={`w-5 h-5 mb-1.5 ${isPinkTheme ? 'text-pink-600' : 'text-slate-700 dark:text-slate-300'}`} />
            <span className="text-[11px] font-bold">Foto Nota</span>
          </button>

          <button
            onClick={() => openCatat('qr')}
            className={`min-h-[64px] flex flex-col items-center justify-center py-3 px-1.5 ${
              isPinkTheme
                ? 'bg-white hover:border-pink-300 text-pink-900 border-pink-200/80 shadow-pink-100/20'
                : 'bg-white dark:bg-[#151E2E] border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-500 shadow-2xs'
            } rounded-2xl border active:scale-95 transition`}
          >
            <QrCode className={`w-5 h-5 mb-1.5 ${isPinkTheme ? 'text-pink-600' : 'text-slate-700 dark:text-slate-300'}`} />
            <span className="text-[11px] font-bold">QRIS</span>
          </button>
        </div>
      </section>

      {/* 3. INBOX DRAFT */}
      {drafts.length > 0 && (
        <section className={`${isPinkTheme ? 'bg-pink-100/70 border-pink-200' : 'bg-amber-500/10 border-amber-500/20'} border rounded-2xl p-3 space-y-2`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isPinkTheme ? 'bg-pink-500' : 'bg-amber-500'} animate-pulse`}></span>
              <span className={`text-xs font-bold ${isPinkTheme ? 'text-pink-900' : 'text-amber-900 dark:text-amber-200'}`}>
                {drafts.length} Transaksi Menunggu Konfirmasi
              </span>
            </div>
            <button
              onClick={confirmAllDrafts}
              className={`text-[11px] font-bold ${isPinkTheme ? 'text-pink-700 hover:text-pink-900' : 'text-amber-800 dark:text-amber-300'} hover:underline`}
            >
              Konfirmasi Semua
            </button>
          </div>

          <div className="space-y-1.5">
            {drafts.map(draft => {
              const cat = getCategoryInfo(draft.category_id);
              return (
                <div
                  key={draft.id}
                  className={`bg-white dark:bg-[#151E2E] rounded-xl p-2.5 border ${isPinkTheme ? 'border-pink-200/60' : 'border-slate-200/60 dark:border-slate-800'} flex items-center justify-between text-xs`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }}></span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {draft.merchant || cat.name}
                      </div>
                      <div className="text-[10px] text-slate-400 capitalize truncate">
                        {draft.source} • {draft.note || 'Draft'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-extrabold tabular-nums text-slate-900 dark:text-white">
                      {formatIDR(draft.amount)}
                    </span>
                    <button
                      onClick={() => confirmDraft(draft.id)}
                      className={`p-1.5 rounded-lg ${isPinkTheme ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-600 hover:bg-emerald-500'} text-white transition active:scale-90`}
                      title="Konfirmasi"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => discardDraft(draft.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition active:scale-90"
                      title="Buang"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. WALLET CARDS */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold uppercase tracking-wider ${isPinkTheme ? 'text-pink-600/80' : 'text-slate-400'}`}>
            Dompet & Tabungan 👛
          </span>
          <button
            onClick={() => setActiveTab('lainnya')}
            className={`text-xs font-semibold ${isPinkTheme ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'} hover:underline flex items-center`}
          >
            Semua <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1.5 scrollbar-none snap-x">
          {accounts.map(acc => {
            const balance = getAccountBalance(acc.id);
            return (
              <div
                key={acc.id}
                onClick={() => setActiveTab('lainnya')}
                className={`min-w-[168px] p-4 rounded-2xl bg-white dark:bg-[#151E2E] border ${
                  isPinkTheme
                    ? 'border-pink-200/80 hover:border-pink-300 shadow-pink-100/20'
                    : 'border-slate-200/70 dark:border-slate-800 hover:border-emerald-500 shadow-2xs'
                } snap-start flex flex-col justify-between h-28 cursor-pointer transition active:scale-95`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: acc.color }}
                  >
                    <AppIcon name={acc.icon} className="w-4 h-4 text-white" />
                  </div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${isPinkTheme ? 'text-pink-500' : 'text-slate-400'}`}>
                    {acc.type}
                  </span>
                </div>

                <div>
                  <div className={`text-xs font-semibold truncate ${isPinkTheme ? 'text-[#881337]' : 'text-slate-700 dark:text-slate-300'}`}>
                    {acc.name}
                  </div>
                  <div className={`text-base font-extrabold tabular-nums mt-0.5 ${isPinkTheme ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                    {formatCompactIDR(balance)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. SAVINGS GOALS */}
      {goals.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${isPinkTheme ? 'text-pink-600/80' : 'text-slate-400'}`}>
              Target Impian 🎯
            </span>
            <button
              onClick={() => setActiveTab('budget')}
              className={`text-xs font-semibold ${isPinkTheme ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'} hover:underline`}
            >
              Atur
            </button>
          </div>

          <div className={`bg-white dark:bg-[#151E2E] rounded-2xl p-4 border ${isPinkTheme ? 'border-pink-200/80' : 'border-slate-200/70 dark:border-slate-800'} shadow-2xs space-y-3`}>
            {goals.map(goal => {
              const progress = goal.target_amount > 0 ? Math.min(100, Math.round((goal.saved_amount / goal.target_amount) * 100)) : 0;
              return (
                <div key={goal.id} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold truncate pr-2 text-slate-800 dark:text-slate-200">
                      {goal.name}
                    </span>
                    <span className={`font-bold tabular-nums ${isPinkTheme ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                      {progress}%
                    </span>
                  </div>
                  <div className={`w-full ${isPinkTheme ? 'bg-pink-100' : 'bg-slate-100 dark:bg-slate-800'} rounded-full h-2 overflow-hidden`}>
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${isPinkTheme ? 'bg-gradient-to-r from-pink-400 to-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. TRANSAKSI TERAKHIR */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold uppercase tracking-wider ${isPinkTheme ? 'text-pink-600/80' : 'text-slate-400'}`}>
            Aktivitas Terakhir ✨
          </span>
          <button
            onClick={() => setActiveTab('transaksi')}
            className={`text-xs font-semibold ${isPinkTheme ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'} hover:underline flex items-center`}
          >
            Lihat Semua ({transactions.filter(t => !t.deleted_at && t.status === 'confirmed').length}){' '}
            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>

        <div className={`bg-white dark:bg-[#151E2E] rounded-2xl divide-y ${isPinkTheme ? 'divide-pink-100 border-pink-200/80' : 'divide-slate-100 dark:divide-slate-800/80 border-slate-200/70 dark:border-slate-800'} border shadow-2xs overflow-hidden`}>
          {confirmedTxns.length === 0 ? (
            <div className="py-8 px-4 text-center space-y-1.5">
              <Sparkles className={`w-6 h-6 mx-auto ${isPinkTheme ? 'text-pink-400' : 'text-slate-400'}`} />
              <p className={`text-xs font-bold ${isPinkTheme ? 'text-pink-900' : 'text-slate-700 dark:text-slate-300'}`}>
                {isPinkTheme ? 'Belum ada transaksi gemas tercatat 🌸' : 'Belum ada transaksi tercatat'}
              </p>
              <p className={`text-xs ${isPinkTheme ? 'text-pink-600/70' : 'text-slate-400'}`}>
                Ketuk tombol Catat (+) di bawah untuk mulai mencatat keuanganmu ya!
              </p>
            </div>
          ) : (
            confirmedTxns.map(t => {
              const cat = getCategoryInfo(t.category_id);
              const isExpense = t.type === 'expense';
              const isIncome = t.type === 'income';

              return (
                <div key={t.id} className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white text-xs shadow-2xs"
                      style={{ backgroundColor: cat.color }}
                    >
                      <AppIcon name={cat.icon} className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate text-slate-800 dark:text-slate-200">
                        {t.merchant || cat.name}
                      </div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">
                        {formatDateRelative(t.occurred_at)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm font-bold tabular-nums ${
                        isIncome
                          ? isPinkTheme ? 'text-emerald-600' : 'text-emerald-600 dark:text-emerald-400'
                          : isExpense
                          ? isPinkTheme ? 'text-rose-500' : 'text-slate-900 dark:text-slate-100'
                          : 'text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {isIncome ? '+' : isExpense ? '-' : ''}
                      {formatIDR(t.amount)}
                    </div>
                    <div className="text-xs text-slate-400 capitalize mt-0.5">
                      {t.type === 'transfer' ? 'Transfer' : getAccountInfo(t.account_id).name}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
