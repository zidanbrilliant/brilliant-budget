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
  } = useApp();

  const summary = getMonthSummary();
  const totalBudget = budget.total_limit || 5500000;
  const budgetSpentPercent = Math.min(100, Math.round((summary.expense / totalBudget) * 100));
  const isBudgetWarning = budgetSpentPercent >= 80 && budgetSpentPercent < 100;
  const isBudgetExceeded = budgetSpentPercent >= 100;

  const drafts = transactions.filter(t => t.status === 'draft' && !t.deleted_at);
  const confirmedTxns = transactions
    .filter(t => t.status === 'confirmed' && !t.deleted_at)
    .slice(0, 5);

  const getCategoryInfo = (catId?: string) => {
    return categories.find(c => c.id === catId) || {
      name: 'Lainnya',
      icon: 'CircleEllipsis',
      color: '#6B7280',
    };
  };

  const getAccountInfo = (accId: string) => {
    return accounts.find(a => a.id === accId) || {
      name: 'Dompet',
      icon: 'CreditCard',
      color: '#10B981',
    };
  };

  return (
    <div className="px-5 py-4 space-y-6">
      {/* 1. EDITORIAL HERO: Balance & Budget (Apple Wallet / Monzo style) */}
      <section className="pt-2">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span className="uppercase tracking-wider font-semibold text-[11px]">Sisa Anggaran Bulan Ini</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
              isBudgetExceeded
                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                : isBudgetWarning
                ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
            }`}
          >
            {budgetSpentPercent}% terpakai
          </span>
        </div>

        {/* Large Crisp Title Typography */}
        <div className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums text-slate-900 dark:text-white">
          {formatIDR(summary.remainingBudget)}
        </div>

        {/* Minimalist Micro Progress Line */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isBudgetExceeded
                ? 'bg-rose-500'
                : isBudgetWarning
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${budgetSpentPercent}%` }}
          ></div>
        </div>

        {/* Cash Flow Summary Row */}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-semibold text-slate-400">Pengeluaran</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                {formatIDR(summary.expense)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ArrowDownLeft className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-semibold text-slate-400">Pemasukan</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                {formatIDR(summary.income)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ACTION CAPSULES: Clean Fast-Entry Row (No Rainbow Colors) */}
      <section>
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => openCatat('manual')}
            className="flex flex-col items-center justify-center py-2.5 px-1 bg-white dark:bg-[#151E2E] rounded-xl border border-slate-200/70 dark:border-slate-800 shadow-2xs hover:border-emerald-500 active:scale-95 transition"
          >
            <Edit3 className="w-4 h-4 text-slate-700 dark:text-slate-300 mb-1" />
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Ketik</span>
          </button>

          <button
            onClick={() => openCatat('voice')}
            className="flex flex-col items-center justify-center py-2.5 px-1 bg-white dark:bg-[#151E2E] rounded-xl border border-slate-200/70 dark:border-slate-800 shadow-2xs hover:border-emerald-500 active:scale-95 transition"
          >
            <Mic className="w-4 h-4 text-slate-700 dark:text-slate-300 mb-1" />
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Suara</span>
          </button>

          <button
            onClick={() => openCatat('ocr')}
            className="flex flex-col items-center justify-center py-2.5 px-1 bg-white dark:bg-[#151E2E] rounded-xl border border-slate-200/70 dark:border-slate-800 shadow-2xs hover:border-emerald-500 active:scale-95 transition"
          >
            <Camera className="w-4 h-4 text-slate-700 dark:text-slate-300 mb-1" />
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Foto Nota</span>
          </button>

          <button
            onClick={() => openCatat('qr')}
            className="flex flex-col items-center justify-center py-2.5 px-1 bg-white dark:bg-[#151E2E] rounded-xl border border-slate-200/70 dark:border-slate-800 shadow-2xs hover:border-emerald-500 active:scale-95 transition"
          >
            <QrCode className="w-4 h-4 text-slate-700 dark:text-slate-300 mb-1" />
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">QRIS</span>
          </button>
        </div>
      </section>

      {/* 3. INBOX DRAFT (FR-25): Compact High-Priority Bar */}
      {drafts.length > 0 && (
        <section className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                {drafts.length} Transaksi Menunggu Konfirmasi
              </span>
            </div>
            <button
              onClick={confirmAllDrafts}
              className="text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:underline"
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
                  className="bg-white dark:bg-[#151E2E] rounded-lg p-2.5 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }}></span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {draft.merchant || cat.name}
                      </div>
                      <div className="text-[10px] text-slate-400 capitalize truncate">
                        {draft.source} • {draft.note || 'Draft Otomatis'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-extrabold tabular-nums text-slate-900 dark:text-white">
                      {formatIDR(draft.amount)}
                    </span>
                    <button
                      onClick={() => confirmDraft(draft.id)}
                      className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 transition"
                      title="Konfirmasi"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => discardDraft(draft.id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-500 transition"
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

      {/* 4. WALLET CARDS (Apple Wallet Card Pass Style) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Dompet & Kartu
          </span>
          <button
            onClick={() => setActiveTab('lainnya')}
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center"
          >
            Semua <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none snap-x">
          {accounts.map(acc => {
            const balance = getAccountBalance(acc.id);
            return (
              <div
                key={acc.id}
                onClick={() => setActiveTab('lainnya')}
                className="min-w-[150px] p-3 rounded-xl bg-white dark:bg-[#151E2E] border border-slate-200/70 dark:border-slate-800 shadow-2xs snap-start flex flex-col justify-between h-24 cursor-pointer hover:border-emerald-500 transition active:scale-95"
              >
                <div className="flex items-center justify-between">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-white"
                    style={{ backgroundColor: acc.color }}
                  >
                    <AppIcon name={acc.icon} className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-[9px] uppercase font-bold text-slate-400">
                    {acc.type}
                  </span>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                    {acc.name}
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {formatCompactIDR(balance)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. SAVINGS GOALS (Minimalist Progress) */}
      {goals.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Target Tabungan
            </span>
            <button
              onClick={() => setActiveTab('budget')}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Atur
            </button>
          </div>

          <div className="bg-white dark:bg-[#151E2E] rounded-xl p-3.5 border border-slate-200/70 dark:border-slate-800 shadow-2xs space-y-2.5">
            {goals.map(goal => {
              const progress = Math.min(100, Math.round((goal.saved_amount / goal.target_amount) * 100));
              return (
                <div key={goal.id} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
                      {goal.name}
                    </span>
                    <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                      {progress}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. TRANSAKSI TERAKHIR (Apple Inset List Style) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Aktivitas Terakhir
          </span>
          <button
            onClick={() => setActiveTab('transaksi')}
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center"
          >
            Lihat Semua ({transactions.filter(t => !t.deleted_at && t.status === 'confirmed').length}){' '}
            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>

        <div className="bg-white dark:bg-[#151E2E] rounded-xl divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/70 dark:border-slate-800 shadow-2xs overflow-hidden">
          {confirmedTxns.map(t => {
            const cat = getCategoryInfo(t.category_id);
            const isExpense = t.type === 'expense';
            const isIncome = t.type === 'income';

            return (
              <div key={t.id} className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-xs"
                    style={{ backgroundColor: cat.color }}
                  >
                    <AppIcon name={cat.icon} className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {t.merchant || cat.name}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {formatDateRelative(t.occurred_at)}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div
                    className={`text-xs font-bold tabular-nums ${
                      isIncome
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isExpense
                        ? 'text-slate-900 dark:text-slate-100'
                        : 'text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {isIncome ? '+' : isExpense ? '-' : ''}
                    {formatIDR(t.amount)}
                  </div>
                  <div className="text-[10px] text-slate-400 capitalize">
                    {t.type === 'transfer' ? 'Transfer' : getAccountInfo(t.account_id).name}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
