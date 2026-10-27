import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatIDR, formatCompactIDR } from '../../utils/formatters';
import { AppIcon } from '../common/IconHelper';
import { DateField } from '../common/DateField';
import { DayOfMonthField } from '../common/DayOfMonthField';
import { getNextRunForDay } from '../../utils/recurring';
import {
  AlertTriangle,
  Plus,
  Repeat,
  Percent,
  X,
  Trash2,
  Edit2,
  Check,
  PiggyBank,
  Plane,
  Home,
  Car,
  Laptop,
  ShieldCheck,
  GraduationCap,
  Gift,
  Heart,
  CalendarDays,
  CheckCircle2,
} from 'lucide-react';
import { BudgetMethod, BudgetLine, Goal, RecurringRule, TxnType } from '../../types/index.ts';

const toGoalDateInput = (timestamp?: number) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const fromGoalDateInput = (value: string) => {
  if (!value) return undefined;
  return new Date(`${value}T12:00:00`).getTime();
};

const formatGoalDate = (timestamp?: number) => {
  if (!timestamp) return null;
  return new Date(timestamp).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getGoalDaysLeft = (timestamp?: number) => {
  if (!timestamp) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(timestamp);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
};

const getGoalIcon = (name: string) => {
  const lower = name.toLowerCase();
  if (/(liburan|jalan|trip|travel|wisata|jepang|bali|korea|eropa)/.test(lower)) return Plane;
  if (/(rumah|apartemen|home|renovasi)/.test(lower)) return Home;
  if (/(mobil|motor|kendaraan|sepeda)/.test(lower)) return Car;
  if (/(laptop|komputer|hp|handphone|gadget|kamera)/.test(lower)) return Laptop;
  if (/(darurat|emergency|asuransi|dana cadangan)/.test(lower)) return ShieldCheck;
  if (/(pendidikan|sekolah|kuliah|kursus)/.test(lower)) return GraduationCap;
  if (/(nikah|menikah|wedding|pernikahan)/.test(lower)) return Heart;
  if (/(hadiah|gift|kado)/.test(lower)) return Gift;
  return PiggyBank;
};

export const BudgetView: React.FC = () => {
  const {
    budget,
    updateBudget,
    updateBudgetLine,
    categories,
    accounts,
    getAccountBalance,
    getMonthSummary,
    getCategorySpending,
    recurring,
    addRecurring,
    updateRecurring,
    deleteRecurring,
    goals,
    contributeToGoal,
    addGoal,
    updateGoal,
    deleteGoal,
    settings,
    showToast,
  } = useApp();

  const isPinkTheme = settings.theme === 'pink';

  const modalSurface = isPinkTheme
    ? 'bg-[#FFF5F7] border-pink-200 text-[#37131D]'
    : 'bg-white dark:bg-[#151E2E] border-slate-200 dark:border-slate-800';
  const modalCard = `rounded-2xl p-5 max-w-sm w-full shadow-2xl border animate-scale-up ${modalSurface}`;
  const fieldClass = `w-full px-3 py-2 rounded-xl border outline-none transition ${
    isPinkTheme
      ? 'bg-white border-pink-200 text-[#37131D] placeholder:text-pink-300 focus:border-pink-400'
      : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-slate-300 dark:focus:border-slate-600'
  }`;
  const labelClass = `text-[11px] font-bold uppercase block mb-1 ${
    isPinkTheme ? 'text-pink-500/80' : 'text-slate-400'
  }`;
  const modalTitle = `font-bold text-sm ${
    isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'
  }`;
  const primaryBtn = `text-white transition active:scale-[0.98] ${
    isPinkTheme
      ? 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 shadow-xs shadow-rose-200'
      : 'bg-emerald-600 hover:bg-emerald-500 shadow-xs'
  }`;
  const secondaryBtn = `transition active:scale-[0.98] ${
    isPinkTheme
      ? 'bg-pink-100 text-pink-700 hover:bg-pink-200'
      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
  }`;
  const dangerBtn = `transition active:scale-[0.98] ${
    isPinkTheme
      ? 'text-rose-600 bg-rose-100/70 hover:bg-rose-200/70'
      : 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/60'
  }`;
  const methodCard = (active: boolean) =>
    `p-2.5 rounded-xl border text-left font-semibold transition active:scale-[0.98] ${
      active
        ? isPinkTheme
          ? 'border-pink-400 bg-pink-100/80 text-pink-700'
          : 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
        : isPinkTheme
        ? 'border-pink-200/80 bg-white text-[#37131D] hover:border-pink-300'
        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
    }`;

  const [activeTab, setActiveTab] = useState<'budget' | 'recurring' | 'goals'>('budget');

  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector('main')?.scrollTo(0, 0);
  }, [activeTab]);
  const [isEditingBudgetModal, setIsEditingBudgetModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<BudgetMethod>(budget.method);
  const [totalLimitInput, setTotalLimitInput] = useState<number>(budget.total_limit);

  // Per-category budget customization map inside the modal
  const [customCategoryAmounts, setCustomCategoryAmounts] = useState<Record<string, number>>({});
  const [customCategoryRollover, setCustomCategoryRollover] = useState<Record<string, boolean>>({});

  // Single line quick-edit modal
  const [editingLineCatId, setEditingLineCatId] = useState<string | null>(null);
  const [editingLineAmount, setEditingLineAmount] = useState<number>(0);
  const [editingLineRollover, setEditingLineRollover] = useState<boolean>(false);

  // New Goal modal state
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState(5000000);
  const [goalDueDate, setGoalDueDate] = useState('');

  // Edit Goal modal state
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editGoalName, setEditGoalName] = useState('');
  const [editGoalTarget, setEditGoalTarget] = useState<number>(0);
  const [editGoalDueDate, setEditGoalDueDate] = useState('');

  // Custom Deposit modal state
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const [contributeAmount, setContributeAmount] = useState<number>(100000);
  const [contributeAccountId, setContributeAccountId] = useState<string>('');

  // New / Edit Recurring modal state
  const [isAddRecurringOpen, setIsAddRecurringOpen] = useState(false);
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(null);
  const [recName, setRecName] = useState('');
  const [recAmount, setRecAmount] = useState(0);
  const [recDay, setRecDay] = useState<number | null>(null);
  const [recDayError, setRecDayError] = useState('');
  const [recIsSub, setRecIsSub] = useState(true);
  const [recTenor, setRecTenor] = useState(12);
  const [recAccount, setRecAccount] = useState('acc-bca');
  const [recCategory, setRecCategory] = useState('cat-hiburan');
  const [recType, setRecType] = useState<TxnType>('expense');
  const [recMode, setRecMode] = useState<'auto' | 'draft'>('auto');

  // Summary
  const summary = getMonthSummary();
  const totalBudget = budget.total_limit || 0;
  const totalSpent = summary.expense;
  const spentPercent = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;

  const subscriptions = recurring.filter(r => r.is_subscription && r.type === 'expense');
  const monthlySubCost = subscriptions.reduce((sum, r) => sum + r.amount, 0);
  const annualSubCost = monthlySubCost * 12;

  // Semua biaya rutin (langganan + cicilan) mengurangi jatah budget kategori
  const monthlyCommittedCost = recurring
    .filter(r => r.is_active && r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);
  const availableForCategories = Math.max(0, totalBudget - monthlyCommittedCost);
  const categoryAllocated = budget.lines.reduce((sum, l) => sum + (l.amount || 0), 0);

  const expenseCategories = categories.filter(c => c.kind === 'expense');
  const recurringCategories = categories.filter(c => (recType === 'income' ? c.kind === 'income' : c.kind === 'expense'));

  const draftCategoryTotal = expenseCategories.reduce(
    (sum, c) => sum + Math.max(0, customCategoryAmounts[c.id] || 0),
    0
  );
  const draftMaxAllocation = Math.max(0, Math.max(0, totalLimitInput) - monthlyCommittedCost);

  const openEditBudgetModal = () => {
    setSelectedMethod(budget.method);
    const lineTotal = budget.lines.reduce((sum, l) => sum + (l.amount || 0), 0);
    setTotalLimitInput(budget.total_limit || lineTotal);

    // Initialize custom category amounts map
    const amounts: Record<string, number> = {};
    const rollovers: Record<string, boolean> = {};
    expenseCategories.forEach(c => {
      const existingLine = budget.lines.find(l => l.category_id === c.id);
      amounts[c.id] = existingLine ? existingLine.amount : 0;
      rollovers[c.id] = existingLine ? Boolean(existingLine.rollover) : false;
    });
    setCustomCategoryAmounts(amounts);
    setCustomCategoryRollover(rollovers);
    setIsEditingBudgetModal(true);
  };

  const handleSaveBudget = () => {
    const isCategoryBased = selectedMethod === 'category' || selectedMethod === 'envelope';

    if (isCategoryBased) {
      const newLines: BudgetLine[] = [];
      let computedTotal = 0;

      expenseCategories.forEach(c => {
        const amt = Math.max(0, customCategoryAmounts[c.id] || 0);
        if (amt > 0) {
          computedTotal += amt;
          newLines.push({
            id: 'b-line-' + c.id,
            category_id: c.id,
            name: c.name,
            amount: amt,
            rollover: customCategoryRollover[c.id] || false,
          });
        }
      });

      let monthlyLimit = Math.max(0, totalLimitInput);
      if (monthlyLimit <= 0 && computedTotal > 0) {
        monthlyLimit = computedTotal + monthlyCommittedCost;
      }
      const maxAllocation = Math.max(0, monthlyLimit - monthlyCommittedCost);

      if (monthlyLimit <= 0 && computedTotal <= 0) {
        showToast('Tentukan batas budget bulanan atau isi anggaran kategori');
        return;
      }

      if (computedTotal > maxAllocation) {
        monthlyLimit = computedTotal + monthlyCommittedCost;
      }

      updateBudget({
        ...budget,
        method: selectedMethod,
        total_limit: monthlyLimit,
        lines: newLines,
      });
      showToast('Budget bulanan berhasil disimpan');
    } else {
      updateBudget({
        ...budget,
        method: selectedMethod,
        total_limit: Math.max(0, totalLimitInput),
      });
      showToast('Budget bulanan berhasil disimpan');
    }

    setIsEditingBudgetModal(false);
  };

  const handleSaveQuickLine = () => {
    if (!editingLineCatId) return;
    const otherLinesTotal = budget.lines
      .filter(l => l.category_id !== editingLineCatId)
      .reduce((sum, l) => sum + (l.amount || 0), 0);
    const nextTotal = otherLinesTotal + Math.max(0, editingLineAmount);
    const maxAllocation = Math.max(0, totalBudget - monthlyCommittedCost);

    if (nextTotal > maxAllocation) {
      showToast(
        `Anggaran kategori melebihi jatah ${formatIDR(maxAllocation)} (budget bulanan - biaya rutin)`
      );
      return;
    }

    updateBudgetLine(editingLineCatId, editingLineAmount, editingLineRollover);
    setEditingLineCatId(null);
  };

  const handleRemoveLine = (catId: string) => {
    const updatedLines = budget.lines.filter(l => l.category_id !== catId);
    updateBudget({
      ...budget,
      lines: updatedLines,
    });
    setEditingLineCatId(null);
  };

  const totalGoalSaved = goals.reduce((sum, goal) => sum + Math.max(0, goal.saved_amount), 0);
  const totalGoalTarget = goals.reduce((sum, goal) => sum + Math.max(0, goal.target_amount), 0);
  const overallGoalProgress =
    totalGoalTarget > 0 ? Math.min(100, Math.round((totalGoalSaved / totalGoalTarget) * 100)) : 0;
  const achievedGoalCount = goals.filter(
    goal => goal.target_amount > 0 && goal.saved_amount >= goal.target_amount
  ).length;

  const openAddGoalModal = () => {
    setGoalName('');
    setGoalTarget(5000000);
    setGoalDueDate(toGoalDateInput(Date.now() + 90 * 86400000));
    setIsGoalModalOpen(true);
  };

  const handleCreateGoal = () => {
    if (!goalName.trim() || goalTarget <= 0) return;
    addGoal({
      name: goalName.trim(),
      target_amount: goalTarget,
      saved_amount: 0,
      due_at: fromGoalDateInput(goalDueDate),
    });
    setGoalName('');
    setIsGoalModalOpen(false);
  };

  const openEditGoalModal = (goal: Goal) => {
    setEditingGoal(goal);
    setEditGoalName(goal.name);
    setEditGoalTarget(goal.target_amount);
    setEditGoalDueDate(toGoalDateInput(goal.due_at));
  };

  const handleUpdateGoal = () => {
    if (!editingGoal || !editGoalName.trim() || editGoalTarget <= 0) return;
    updateGoal(editingGoal.id, {
      name: editGoalName.trim(),
      target_amount: editGoalTarget,
      due_at: fromGoalDateInput(editGoalDueDate),
    });
    setEditingGoal(null);
  };

  const handleDeleteGoal = (id: string) => {
    if (window.confirm('Hapus target tabungan ini?')) {
      deleteGoal(id);
      if (editingGoal?.id === id) setEditingGoal(null);
    }
  };

  const openContributeModal = (goal: Goal) => {
    setContributeGoal(goal);
    setContributeAmount(100000);
    setContributeAccountId(accounts[0]?.id || 'acc-bca');
  };

  const handleConfirmContribute = () => {
    if (!contributeGoal || contributeAmount <= 0) return;
    contributeToGoal(contributeGoal.id, contributeAmount, contributeAccountId);
    setContributeGoal(null);
  };

  const resetRecurringForm = () => {
    setEditingRecurringId(null);
    setRecName('');
    setRecAmount(0);
    setRecDay(null);
    setRecDayError('');
    setRecIsSub(true);
    setRecTenor(12);
    setRecAccount(accounts[0]?.id || 'acc-bca');
    setRecType('expense');
    setRecMode('auto');
    setRecCategory(categories.find(c => c.kind === 'expense')?.id || 'cat-hiburan');
  };

  const openAddRecurring = () => {
    resetRecurringForm();
    setIsAddRecurringOpen(true);
  };

  const openEditRecurring = (rule: RecurringRule) => {
    setEditingRecurringId(rule.id);
    setRecName(rule.name);
    setRecAmount(rule.amount);
    setRecDay(rule.day_of_month || null);
    setRecDayError('');
    setRecIsSub(Boolean(rule.is_subscription));
    setRecTenor(rule.total_tenor || 12);
    setRecAccount(rule.account_id || accounts[0]?.id || 'acc-bca');
    setRecCategory(rule.category_id || categories.find(c => c.kind === rule.type)?.id || 'cat-lainnya');
    setRecType(rule.type);
    setRecMode(rule.mode);
    setIsAddRecurringOpen(true);
  };

  const handleSaveRecurring = () => {
    if (!recName.trim() || recAmount <= 0) {
      showToast('Isi nama dan nominal yang valid');
      return;
    }
    if (recDay === null) {
      setRecDayError('Pilih tanggal dulu.');
      return;
    }
    setRecDayError('');

    const existing = editingRecurringId
      ? recurring.find(r => r.id === editingRecurringId)
      : undefined;
    const isInstallment = recType === 'expense' && !recIsSub;
    const remainingTenor = isInstallment
      ? existing && existing.total_tenor === recTenor && typeof existing.remaining_tenor === 'number'
        ? existing.remaining_tenor
        : recTenor
      : undefined;

    const payload: Omit<RecurringRule, 'id'> = {
      name: recName.trim(),
      type: recType,
      amount: recAmount,
      account_id: recAccount || accounts[0]?.id || 'acc-bca',
      category_id: recCategory,
      frequency: 'monthly',
      day_of_month: recDay,
      next_run_at: getNextRunForDay(recDay),
      mode: recMode,
      is_active: true,
      is_subscription: recType === 'expense' ? recIsSub : false,
      total_tenor: isInstallment ? recTenor : undefined,
      remaining_tenor: remainingTenor,
    };

    if (editingRecurringId) {
      updateRecurring(editingRecurringId, payload);
    } else {
      addRecurring(payload);
    }

    setIsAddRecurringOpen(false);
    setEditingRecurringId(null);
  };

  const handleDeleteRecurring = (rule: RecurringRule) => {
    if (window.confirm(`Hapus "${rule.name}" dari daftar langganan/rutinitas?`)) {
      deleteRecurring(rule.id);
    }
  };

  return (
    <div className="p-4 space-y-3.5">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-bold tracking-tight ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
            {isPinkTheme ? 'Budget & Impian 🌸' : 'Budget & Perencanaan'}
          </h1>
          <p className="text-xs text-slate-400">
            Metode: {budget.method === 'category' ? 'Per Kategori' : budget.method === 'percent' ? '50/30/20' : budget.method === 'envelope' ? 'Amplop' : 'Total Bulanan'}
          </p>
        </div>
        <button
          onClick={openEditBudgetModal}
          className={`text-xs font-bold px-3 py-1.5 rounded-xl border shadow-2xs transition active:scale-95 ${isPinkTheme ? 'bg-white border-pink-200 text-pink-900 hover:border-pink-400' : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700'}`}
        >
          Atur Budget
        </button>
      </div>

      {/* iOS Segmented Tabs */}
      <div className={`grid grid-cols-3 gap-1 p-0.5 rounded-xl text-xs font-medium ${isPinkTheme ? 'bg-pink-100/70' : 'bg-slate-200/60 dark:bg-slate-800/80'}`}>
        <button
          onClick={() => setActiveTab('budget')}
          className={`py-1.5 rounded-lg transition text-center ${
            activeTab === 'budget'
              ? isPinkTheme ? 'bg-white text-rose-600 font-bold shadow-2xs' : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-2xs'
              : isPinkTheme ? 'text-pink-600/70 hover:text-pink-900' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Budget Bulanan
        </button>
        <button
          onClick={() => setActiveTab('recurring')}
          className={`py-1.5 rounded-lg transition text-center ${
            activeTab === 'recurring'
              ? isPinkTheme ? 'bg-white text-rose-600 font-bold shadow-2xs' : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-2xs'
              : isPinkTheme ? 'text-pink-600/70 hover:text-pink-900' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Langganan
        </button>
        <button
          onClick={() => setActiveTab('goals')}
          className={`py-1.5 rounded-lg transition text-center ${
            activeTab === 'goals'
              ? isPinkTheme ? 'bg-white text-rose-600 font-bold shadow-2xs' : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-2xs'
              : isPinkTheme ? 'text-pink-600/70 hover:text-pink-900' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Target Tabungan
        </button>
      </div>

      {/* ======================= TAB 1: BUDGET BULANAN ======================= */}
      {activeTab === 'budget' && (
        <div className="space-y-3.5">
          {/* Overview Card */}
          <div className={`${
            isPinkTheme
              ? 'bg-gradient-to-br from-[#E11D48] to-[#BE123C] text-white shadow-rose-200/50'
              : 'bg-[#0F172A] dark:bg-[#111827] text-white border border-slate-800'
          } p-4 rounded-2xl shadow-xs space-y-3.5`}>
            <div className={`flex items-center justify-between ${isPinkTheme ? 'text-pink-100' : 'text-slate-400'} text-[11px] font-semibold`}>
              <span className="uppercase tracking-wider">Budget Bulanan</span>
              <span className={`px-2 py-0.5 rounded-full ${isPinkTheme ? 'bg-white/15' : 'bg-white/10'}`}>
                Mulai tgl {budget.start_day}
              </span>
            </div>

            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <div className={`text-[11px] ${isPinkTheme ? 'text-pink-100' : 'text-slate-400'}`}>Sisa anggaran</div>
                <div className="text-2xl font-black tabular-nums truncate">
                  {formatIDR(Math.max(0, totalBudget - totalSpent))}
                </div>
                <div className={`text-[11px] ${isPinkTheme ? 'text-pink-100/90' : 'text-slate-400'} tabular-nums mt-0.5`}>
                  dari {formatIDR(totalBudget)}
                </div>
              </div>
              <span
                className={`text-xs font-bold px-2 py-1 rounded-lg tabular-nums shrink-0 ${
                  spentPercent >= 100
                    ? 'bg-rose-500/25 text-rose-100 border border-rose-400/40'
                    : spentPercent >= 80
                    ? 'bg-amber-400/20 text-amber-100 border border-amber-300/40'
                    : isPinkTheme
                    ? 'bg-white/15 text-white border border-white/20'
                    : 'bg-emerald-400/20 text-emerald-100 border border-emerald-300/40'
                }`}
              >
                {spentPercent}% terpakai
              </span>
            </div>

            {/* Main Bar */}
            <div className={`w-full ${isPinkTheme ? 'bg-black/20' : 'bg-slate-800'} rounded-full h-2 overflow-hidden`}>
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  spentPercent >= 100
                    ? 'bg-rose-400'
                    : spentPercent >= 80
                    ? 'bg-amber-300'
                    : isPinkTheme
                    ? 'bg-white'
                    : 'bg-emerald-400'
                }`}
                style={{ width: `${spentPercent}%` }}
              ></div>
            </div>

            {/* Ringkasan alokasi */}
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className={`rounded-xl px-1.5 py-2 ${isPinkTheme ? 'bg-white/10' : 'bg-white/5'}`}>
                <div className={`text-[9px] uppercase tracking-wide ${isPinkTheme ? 'text-pink-100' : 'text-slate-400'}`}>Terpakai</div>
                <div className="text-[11px] font-bold tabular-nums mt-0.5 truncate">{formatCompactIDR(totalSpent)}</div>
              </div>
              <div className={`rounded-xl px-1.5 py-2 ${isPinkTheme ? 'bg-white/10' : 'bg-white/5'}`}>
                <div className={`text-[9px] uppercase tracking-wide ${isPinkTheme ? 'text-pink-100' : 'text-slate-400'}`}>Biaya rutin</div>
                <div className="text-[11px] font-bold tabular-nums mt-0.5 truncate">{formatCompactIDR(monthlyCommittedCost)}</div>
              </div>
              <div className={`rounded-xl px-1.5 py-2 ${isPinkTheme ? 'bg-white/10' : 'bg-white/5'}`}>
                <div className={`text-[9px] uppercase tracking-wide ${isPinkTheme ? 'text-pink-100' : 'text-slate-400'}`}>Jatah kategori</div>
                <div className="text-[11px] font-bold tabular-nums mt-0.5 truncate">{formatCompactIDR(availableForCategories)}</div>
              </div>
            </div>

            {monthlyCommittedCost > 0 && (
              <p className={`text-[10px] leading-relaxed ${isPinkTheme ? 'text-pink-100/90' : 'text-slate-400'}`}>
                Budget kategori dibatasi {formatIDR(availableForCategories)} setelah dipotong biaya langganan/rutin {formatIDR(monthlyCommittedCost)}.
              </p>
            )}

            {spentPercent >= 100 && (
              <div className="flex items-center gap-1.5 text-xs text-rose-100 bg-rose-950/30 p-2 rounded-lg border border-rose-400/30">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-200" />
                <span>Peringatan: Anggaran bulan ini telah melampaui batas!</span>
              </div>
            )}
            {spentPercent >= 80 && spentPercent < 100 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-100 bg-amber-950/25 p-2 rounded-lg border border-amber-300/30">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-200" />
                <span>Peringatan: Pemakaian anggaran di atas 80%.</span>
              </div>
            )}
          </div>

          {categoryAllocated > availableForCategories && (
            <div className={`flex items-start gap-2 p-3 rounded-xl border text-[11px] ${
              isPinkTheme
                ? 'bg-pink-50 border-pink-200 text-pink-800'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200'
            }`}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Alokasi kategori {formatIDR(categoryAllocated)} melebihi jatah {formatIDR(availableForCategories)}.
                Kurangi anggaran kategori atau naikkan budget bulanan.
              </span>
            </div>
          )}

          {/* Metode 50/30/20 */}
          {budget.method === 'percent' && (
            <div className="bg-white dark:bg-[#151E2E] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-emerald-600" />
                <span>Alokasi Aturan 50 / 30 / 20</span>
              </h3>
              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span>Kebutuhan Pokok (50%)</span>
                    <span className="tabular-nums font-bold">{formatIDR(totalBudget * 0.5)}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-slate-800 dark:bg-slate-300 h-full w-[50%]"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span>Keinginan (30%)</span>
                    <span className="tabular-nums font-bold">{formatIDR(totalBudget * 0.3)}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-slate-500 dark:bg-slate-500 h-full w-[30%]"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span>Tabungan & Investasi (20%)</span>
                    <span className="tabular-nums font-bold">{formatIDR(totalBudget * 0.2)}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full w-[20%]"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rincian Kategori (Grouped Inset List) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Rincian per Kategori
              </h3>
              <button
                onClick={openEditBudgetModal}
                className={`text-[11px] font-semibold ${isPinkTheme ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'} hover:underline`}
              >
                + Kelola Kategori
              </button>
            </div>

            <div className="bg-white dark:bg-[#151E2E] rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
              {budget.lines.length === 0 ? (
                <div className="py-8 px-4 text-center space-y-2">
                  <p className={`text-xs font-bold ${isPinkTheme ? 'text-pink-900' : 'text-slate-700 dark:text-slate-300'}`}>
                    Belum ada anggaran per kategori yang diatur
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Tentukan anggaran berbeda untuk setiap kategori pengeluaran Anda.
                  </p>
                  <button
                    onClick={openEditBudgetModal}
                    className={`mt-1 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 shadow-xs ${
                      isPinkTheme ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    }`}
                  >
                    + Atur Anggaran Kategori
                  </button>
                </div>
              ) : (
                budget.lines.map(line => {
                  const cat = categories.find(c => c.id === line.category_id);
                  const spent = line.category_id ? getCategorySpending(line.category_id) : 0;
                  const percent = line.amount > 0 ? Math.min(100, Math.round((spent / line.amount) * 100)) : 0;
                  const isOver = line.amount > 0 && spent > line.amount;
                  const isNear = line.amount > 0 && percent >= 80 && !isOver;

                  return (
                    <div
                      key={line.id}
                      onClick={() => {
                        setEditingLineCatId(line.category_id || null);
                        setEditingLineAmount(line.amount);
                        setEditingLineRollover(Boolean(line.rollover));
                      }}
                      className="p-3.5 space-y-2 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition active:scale-[0.99] group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs shadow-2xs"
                            style={{ backgroundColor: cat?.color || '#6B7280' }}
                          >
                            <AppIcon name={cat?.icon || 'CircleEllipsis'} className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                              {line.name || cat?.name}
                            </span>
                            {line.rollover && (
                              <span className={`text-[9px] font-semibold ${isPinkTheme ? 'text-pink-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                Rollover Aktif
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right text-xs">
                          <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                            {formatIDR(spent)}
                          </span>
                          <span className="text-slate-400 tabular-nums"> / {formatCompactIDR(line.amount)}</span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOver ? 'bg-rose-500' : isNear ? 'bg-amber-400' : isPinkTheme ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB 2: LANGGANAN ======================= */}
      {activeTab === 'recurring' && (
        <div className="space-y-3.5">
          <div className={`${
            isPinkTheme
              ? 'bg-gradient-to-br from-[#E11D48] to-[#BE123C] text-white shadow-rose-200/50'
              : 'bg-[#0F172A] dark:bg-[#111827] text-white border border-slate-800'
          } p-4 rounded-2xl shadow-xs`}>
            <span className={`text-[10px] ${isPinkTheme ? 'text-pink-100' : 'text-slate-400'} font-bold uppercase tracking-wider block`}>
              Total Biaya Rutin Bulanan
            </span>
            <div className="flex items-end justify-between gap-2 mt-1">
              <div className="min-w-0">
                <span className="text-2xl font-black tabular-nums">{formatIDR(monthlySubCost)}</span>
                <span className={`text-xs ml-1 ${isPinkTheme ? 'text-pink-100/80' : 'text-slate-400'}`}>/ bulan</span>
              </div>
              <div className={`text-[11px] tabular-nums text-right shrink-0 ${isPinkTheme ? 'text-pink-100/80' : 'text-slate-400'}`}>
                <div>{subscriptions.length} langganan</div>
                <div>≈ {formatCompactIDR(annualSubCost)} / thn</div>
              </div>
            </div>
            {monthlyCommittedCost > monthlySubCost && (
              <p className={`text-[10px] mt-1.5 ${isPinkTheme ? 'text-pink-100/90' : 'text-slate-400'}`}>
                Termasuk cicilan: total komitmen rutin {formatIDR(monthlyCommittedCost)}/bulan.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Langganan & Rutinitas ({recurring.length})
              </h3>
              <button
                onClick={openAddRecurring}
                className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition active:scale-95 ${
                  isPinkTheme
                    ? 'text-rose-600 bg-pink-100 hover:bg-pink-200'
                    : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Langganan</span>
              </button>
            </div>

            <div className="bg-white dark:bg-[#151E2E] rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
              {recurring.length === 0 ? (
                <div className="py-8 px-4 text-center space-y-1">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Belum ada langganan atau cicilan
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Ketuk tombol Langganan untuk menambahkan layanan rutin.
                  </p>
                </div>
              ) : (
                recurring.map(rule => {
                  const cat = categories.find(c => c.id === rule.category_id);
                  return (
                    <div
                      key={rule.id}
                      className={`p-3.5 flex items-center gap-3 ${rule.is_active ? '' : 'opacity-60'}`}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white shadow-2xs"
                        style={{ backgroundColor: cat?.color || '#64748B' }}
                      >
                        <AppIcon name={cat?.icon || 'Repeat'} className="w-4 h-4 text-white" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                            {rule.name}
                          </div>
                          <div className={`text-xs font-bold tabular-nums shrink-0 ${rule.type === 'income' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>
                            {rule.type === 'income' ? '+' : ''}{formatIDR(rule.amount)}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-1">
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 min-w-0">
                            <span className="truncate">
                              Tiap tgl {rule.day_of_month || 1} · {cat?.name || (rule.type === 'income' ? 'Pemasukan' : 'Pengeluaran')}
                            </span>
                            {rule.total_tenor && (
                              <span className={`shrink-0 text-[9px] font-bold ${isPinkTheme ? 'text-pink-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {rule.remaining_tenor}/{rule.total_tenor}
                              </span>
                            )}
                            {!rule.is_active && (
                              <span className="shrink-0 text-[9px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                Nonaktif
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0 -mr-1">
                            <span
                              title={
                                rule.mode === 'auto'
                                  ? 'Otomatis: transaksi langsung dicatat saat jatuh tempo.'
                                  : 'Draft: transaksi masuk draf dan perlu dikonfirmasi di Beranda.'
                              }
                              className={`text-[9px] px-1.5 py-0.5 rounded font-semibold cursor-help ${
                                rule.mode === 'auto'
                                  ? isPinkTheme
                                    ? 'bg-pink-50 text-pink-600'
                                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                              }`}
                            >
                              {rule.mode === 'auto' ? 'Otomatis' : 'Draft'}
                            </span>
                            <button
                              onClick={() => openEditRecurring(rule)}
                              aria-label={`Edit ${rule.name}`}
                              title="Edit"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRecurring(rule)}
                              aria-label={`Hapus ${rule.name}`}
                              title="Hapus"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB 3: TARGET TABUNGAN ======================= */}
      {activeTab === 'goals' && (
        <div className="space-y-3.5">
          <div className="flex items-end justify-between gap-3 px-1">
            <div className="min-w-0">
              <h3 className={`text-base font-bold tracking-tight ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
                Target Aktif
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                {goals.length === 0
                  ? 'Mulai rencanakan impian Anda'
                  : `${goals.length} target · ${achievedGoalCount} tercapai`}
              </p>
            </div>
            <button
              onClick={openAddGoalModal}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition active:scale-95 shadow-2xs shrink-0 ${
                isPinkTheme
                  ? 'bg-rose-500 text-white hover:bg-rose-600'
                  : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/80 dark:text-emerald-400 hover:bg-emerald-100'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Target Baru</span>
            </button>
          </div>

          {goals.length === 0 ? (
            <div className="bg-white dark:bg-[#151E2E] rounded-2xl p-7 text-center border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-3">
              <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${
                isPinkTheme
                  ? 'bg-gradient-to-br from-pink-100 to-rose-100 text-rose-500'
                  : 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/30 text-emerald-500'
              }`}>
                <PiggyBank className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Belum ada target tabungan
                </p>
                <p className="text-xs text-slate-400 max-w-[250px] mx-auto leading-relaxed">
                  Mulai dari impian kecil. Tentukan nominal dan tenggat, lalu setor sedikit demi sedikit.
                </p>
              </div>
              <button
                onClick={openAddGoalModal}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition active:scale-95 shadow-xs ${
                  isPinkTheme ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                Buat Target Pertama
              </button>
            </div>
          ) : (
            <>
              {/* Ringkasan semua target */}
              <div className={`rounded-2xl p-4 shadow-xs space-y-3 ${
                isPinkTheme
                  ? 'bg-gradient-to-br from-[#E11D48] to-[#BE123C] text-white shadow-rose-200/50'
                  : 'bg-[#0F172A] dark:bg-[#111827] text-white border border-slate-800'
              }`}>
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className={`uppercase tracking-wider ${isPinkTheme ? 'text-pink-100' : 'text-slate-400'}`}>
                    Total terkumpul
                  </span>
                  <span className={`px-2 py-0.5 rounded-full tabular-nums ${isPinkTheme ? 'bg-white/15' : 'bg-white/10'}`}>
                    {overallGoalProgress}%
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="text-2xl font-black tabular-nums truncate">
                    {formatIDR(totalGoalSaved)}
                  </div>
                  <div className={`text-[11px] mt-0.5 tabular-nums ${isPinkTheme ? 'text-pink-100/90' : 'text-slate-400'}`}>
                    dari {formatIDR(totalGoalTarget)}
                  </div>
                </div>

                <div className={`w-full ${isPinkTheme ? 'bg-black/20' : 'bg-slate-800'} rounded-full h-2 overflow-hidden`}>
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${isPinkTheme ? 'bg-white' : 'bg-emerald-400'}`}
                    style={{ width: `${overallGoalProgress}%` }}
                  ></div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-center">
                  <div className={`rounded-xl px-1.5 py-2 ${isPinkTheme ? 'bg-white/10' : 'bg-white/5'}`}>
                    <div className={`text-[9px] uppercase tracking-wide ${isPinkTheme ? 'text-pink-100' : 'text-slate-400'}`}>
                      Sisa
                    </div>
                    <div className="text-[11px] font-bold tabular-nums mt-0.5 truncate">
                      {formatCompactIDR(Math.max(0, totalGoalTarget - totalGoalSaved))}
                    </div>
                  </div>
                  <div className={`rounded-xl px-1.5 py-2 ${isPinkTheme ? 'bg-white/10' : 'bg-white/5'}`}>
                    <div className={`text-[9px] uppercase tracking-wide ${isPinkTheme ? 'text-pink-100' : 'text-slate-400'}`}>
                      Tercapai
                    </div>
                    <div className="text-[11px] font-bold tabular-nums mt-0.5 truncate">
                      {achievedGoalCount} dari {goals.length}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {goals.map(goal => {
                  const progress = goal.target_amount > 0
                    ? Math.min(100, Math.round((goal.saved_amount / goal.target_amount) * 100))
                    : 0;
                  const remaining = Math.max(0, goal.target_amount - goal.saved_amount);
                  const isAchieved = goal.target_amount > 0 && goal.saved_amount >= goal.target_amount;
                  const dueDate = formatGoalDate(goal.due_at);
                  const daysLeft = getGoalDaysLeft(goal.due_at);
                  const GoalIcon = getGoalIcon(goal.name);
                  const dueTone = isAchieved
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : daysLeft !== null && daysLeft < 0
                      ? 'text-rose-500'
                      : daysLeft !== null && daysLeft <= 30
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-400';
                  const dueText = daysLeft === null
                    ? null
                    : daysLeft < 0
                      ? `Lewat ${Math.abs(daysLeft)} hari`
                      : daysLeft === 0
                        ? 'Jatuh tempo hari ini'
                        : `${daysLeft} hari lagi`;

                  return (
                    <div
                      key={goal.id}
                      className={`rounded-2xl border p-4 space-y-3 ${
                        isAchieved
                          ? isPinkTheme
                            ? 'bg-pink-50/70 border-pink-200'
                            : 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                          : isPinkTheme
                            ? 'bg-white border-pink-200/80 shadow-xs'
                            : 'bg-white dark:bg-[#151E2E] border-slate-200/80 dark:border-slate-800/80 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isAchieved
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                            : isPinkTheme
                              ? 'bg-pink-100 text-pink-600'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                          <GoalIcon className="w-5 h-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate" title={goal.name}>
                              {goal.name}
                            </h4>
                            {isAchieved && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                          </div>
                          <div className={`flex items-center gap-1 mt-0.5 text-[11px] ${dueTone}`}>
                            <CalendarDays className="w-3 h-3 shrink-0" />
                            {dueDate ? (
                              <>
                                <span className="truncate">{dueDate}</span>
                                <span className="opacity-60">·</span>
                                <span className="shrink-0 font-medium">{dueText}</span>
                              </>
                            ) : (
                              <span>Tanpa tenggat waktu</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-1">
                          <button
                            onClick={() => openEditGoalModal(goal)}
                            aria-label={`Edit target ${goal.name}`}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteGoal(goal.id)}
                            aria-label={`Hapus target ${goal.name}`}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="min-w-0 text-xs truncate">
                            <span className={`text-sm font-bold tabular-nums ${isPinkTheme ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                              {formatIDR(goal.saved_amount)}
                            </span>
                            <span className="text-slate-400"> / {formatIDR(goal.target_amount)}</span>
                          </div>
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md tabular-nums shrink-0 ${
                            isAchieved
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                              : isPinkTheme
                                ? 'bg-pink-100 text-pink-700'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {progress}%
                          </span>
                        </div>

                        <div className={`w-full ${isPinkTheme ? 'bg-pink-100' : 'bg-slate-100 dark:bg-slate-800'} h-2 rounded-full overflow-hidden`}>
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isAchieved
                                ? 'bg-emerald-500'
                                : isPinkTheme
                                  ? 'bg-gradient-to-r from-pink-400 to-rose-500'
                                  : 'bg-emerald-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[11px] font-medium min-w-0 truncate ${
                          isAchieved ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                        }`}>
                          {isAchieved ? 'Target tercapai. Pertahankan!' : `Kurang ${formatIDR(remaining)}`}
                        </span>
                        {!isAchieved && (
                          <button
                            onClick={() => openContributeModal(goal)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition active:scale-95 shrink-0 ${
                              isPinkTheme
                                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 hover:bg-emerald-100'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Setor</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Edit Budget Modal */}
      {isEditingBudgetModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className={`w-full max-w-md ${modalSurface} rounded-t-[28px] sm:rounded-2xl p-5 max-h-[88dvh] flex flex-col shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 animate-slide-up sm:animate-scale-up`}>
            <div className="shrink-0 flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <h3 className={modalTitle}>Metode Anggaran</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Pilih gaya budgeting dan atur batas bulananmu.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingBudgetModal(false)}
                aria-label="Tutup"
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-3 pr-1 space-y-3 text-xs overscroll-contain scrollbar-none">
              <div>
                <label className={labelClass}>Pilih Gaya Budgeting</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedMethod('category')}
                    aria-pressed={selectedMethod === 'category'}
                    className={methodCard(selectedMethod === 'category')}
                  >
                    Per Kategori
                  </button>
                  <button
                    onClick={() => setSelectedMethod('percent')}
                    aria-pressed={selectedMethod === 'percent'}
                    className={methodCard(selectedMethod === 'percent')}
                  >
                    Aturan 50/30/20
                  </button>
                  <button
                    onClick={() => setSelectedMethod('envelope')}
                    aria-pressed={selectedMethod === 'envelope'}
                    className={methodCard(selectedMethod === 'envelope')}
                  >
                    Sistem Amplop
                  </button>
                  <button
                    onClick={() => setSelectedMethod('total')}
                    aria-pressed={selectedMethod === 'total'}
                    className={methodCard(selectedMethod === 'total')}
                  >
                    Batas Total
                  </button>
                </div>
              </div>

              {/* Custom Category Amounts (when category or envelope method) */}
              {selectedMethod === 'category' || selectedMethod === 'envelope' ? (
                <div className="space-y-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelClass}>
                        Batas Budget Bulanan (Rp)
                      </label>
                      {draftCategoryTotal > 0 && totalLimitInput !== draftCategoryTotal + monthlyCommittedCost && (
                        <button
                          type="button"
                          onClick={() => setTotalLimitInput(draftCategoryTotal + monthlyCommittedCost)}
                          className={`text-[10px] font-bold ${isPinkTheme ? 'text-rose-600 hover:underline' : 'text-emerald-600 hover:underline'}`}
                        >
                          Hitung Otomatis ({formatCompactIDR(draftCategoryTotal + monthlyCommittedCost)})
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={totalLimitInput || ''}
                      onChange={e => setTotalLimitInput(Math.max(0, Number(e.target.value)))}
                      placeholder={draftCategoryTotal > 0 ? String(draftCategoryTotal + monthlyCommittedCost) : "Mis. 5000000"}
                      className={`${fieldClass} text-sm font-bold tabular-nums`}
                    />
                    <div className="flex items-center justify-between gap-2 mt-1 text-[10px]">
                      <span className="text-slate-400">
                        Biaya rutin: <span className="font-semibold text-slate-600 dark:text-slate-300">{formatIDR(monthlyCommittedCost)}</span>
                      </span>
                      <span className={`font-bold tabular-nums ${isPinkTheme ? 'text-rose-600' : 'text-emerald-600'}`}>
                        Maks kategori: {formatIDR(draftMaxAllocation)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={`text-[11px] font-bold uppercase ${isPinkTheme ? 'text-pink-600/80' : 'text-slate-400'}`}>
                        Batas Tiap Kategori
                      </label>
                      <span className={`text-[10px] font-bold tabular-nums ${totalLimitInput > 0 && draftCategoryTotal > draftMaxAllocation ? 'text-rose-500' : isPinkTheme ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatIDR(draftCategoryTotal)} / {formatIDR(draftMaxAllocation)}
                      </span>
                    </div>
                    {totalLimitInput > 0 && draftCategoryTotal > draftMaxAllocation && (
                      <p className="text-[10px] text-rose-500 font-semibold mb-1.5">
                        Total kategori melebihi jatah. Simpan otomatis menyesuaikan batas total.
                      </p>
                    )}
                    <div className="space-y-1.5">
                      {expenseCategories.map(c => (
                        <div
                          key={c.id}
                          className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${isPinkTheme ? 'bg-pink-50/60 border-pink-100' : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60'}`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0 text-xs"
                              style={{ backgroundColor: c.color }}
                            >
                              <AppIcon name={c.icon} className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className={`font-semibold text-xs truncate ${isPinkTheme ? 'text-pink-900' : 'text-slate-800 dark:text-slate-200'}`}>
                              {c.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 w-28 shrink-0">
                            <span className="text-[10px] text-slate-400">Rp</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={customCategoryAmounts[c.id] || ''}
                              placeholder="0"
                              onChange={e =>
                                setCustomCategoryAmounts({
                                  ...customCategoryAmounts,
                                  [c.id]: Math.max(0, Number(e.target.value)),
                                })
                              }
                              className={`w-full px-2 py-1 rounded-lg text-right font-bold text-xs outline-none tabular-nums ${isPinkTheme ? 'bg-white text-rose-600 border border-pink-200' : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white'}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className={labelClass}>
                    Batas Bulanan (Rp)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={totalLimitInput || ''}
                    placeholder="Mis. 5000000"
                    onChange={e => setTotalLimitInput(Math.max(0, Number(e.target.value)))}
                    className={`${fieldClass} text-sm font-bold tabular-nums`}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-3 pb-safe-bottom shrink-0 border-t border-slate-100 dark:border-slate-800/80">
              <button
                onClick={() => setIsEditingBudgetModal(false)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${secondaryBtn}`}
              >
                Batal
              </button>
              <button
                onClick={handleSaveBudget}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${primaryBtn}`}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Edit Single Category Line Modal */}
      {editingLineCatId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`${modalCard} space-y-3.5`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className={modalTitle}>
                  Sesuaikan Anggaran Kategori
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Atur batas pengeluaran khusus kategori ini.
                </p>
              </div>
              <button
                onClick={() => setEditingLineCatId(null)}
                aria-label="Tutup"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className={`p-3 rounded-xl flex items-center gap-2.5 border ${isPinkTheme ? 'bg-pink-50 border-pink-100' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/60'}`}>
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: categories.find(c => c.id === editingLineCatId)?.color || '#FB7185' }}
                >
                  <AppIcon name={categories.find(c => c.id === editingLineCatId)?.icon || 'Heart'} className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className={`font-bold ${isPinkTheme ? 'text-pink-900' : 'text-slate-900 dark:text-white'}`}>
                    {categories.find(c => c.id === editingLineCatId)?.name}
                  </div>
                  <div className="text-[10px] text-slate-400">Batas bulanan saat ini</div>
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  Nominal Anggaran Bulanan (Rp)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={editingLineAmount || ''}
                  placeholder="0"
                  onChange={e => setEditingLineAmount(Math.max(0, Number(e.target.value)))}
                  className={`${fieldClass} text-base font-bold tabular-nums`}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Maksimal untuk semua kategori: {formatIDR(Math.max(0, totalBudget - monthlyCommittedCost))}
                </p>
              </div>

              <label className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border ${isPinkTheme ? 'bg-pink-50/50 border-pink-200' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'}`}>
                <input
                  type="checkbox"
                  checked={editingLineRollover}
                  onChange={e => setEditingLineRollover(e.target.checked)}
                  className={`w-4 h-4 ${isPinkTheme ? 'accent-rose-500' : 'accent-emerald-600'}`}
                />
                <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                  Rollover sisa anggaran ke bulan berikutnya
                </span>
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleRemoveLine(editingLineCatId)}
                className={`px-3 py-2 rounded-xl text-xs font-bold ${dangerBtn}`}
              >
                Hapus
              </button>
              <button
                onClick={handleSaveQuickLine}
                className={`flex-1 py-2 rounded-xl text-xs font-bold ${primaryBtn}`}
              >
                Simpan Nominal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Goal Modal */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`${modalCard} space-y-4`}>
            <div>
              <h3 className={modalTitle}>
                Target Tabungan Baru
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tentukan impian dan nominal yang ingin dicapai.
              </p>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className={labelClass}>Nama Target</label>
                <input
                  type="text"
                  value={goalName}
                  onChange={e => setGoalName(e.target.value)}
                  placeholder="Mis. Dana Darurat, Liburan"
                  className={`${fieldClass} text-xs font-semibold`}
                />
              </div>
              <div>
                <label className={labelClass}>Nominal Target (Rp)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={goalTarget || ''}
                  onChange={e => setGoalTarget(Math.max(0, Number(e.target.value)))}
                  placeholder="5000000"
                  className={`${fieldClass} text-sm font-bold tabular-nums`}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Tenggat Waktu <span className="normal-case font-medium text-slate-400/80">(opsional)</span>
                </label>
                <DateField
                  value={goalDueDate}
                  onChange={setGoalDueDate}
                  ariaLabel="Tenggat waktu"
                  isPinkTheme={isPinkTheme}
                />
              </div>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setIsGoalModalOpen(false)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${secondaryBtn}`}
              >
                Batal
              </button>
              <button
                onClick={handleCreateGoal}
                disabled={!goalName.trim() || goalTarget <= 0}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 ${primaryBtn}`}
              >
                Simpan Target
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Setor Tabungan (Nominal Custom & Pilih Dompet) */}
      {contributeGoal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`${modalCard} space-y-4`}>
            <div>
              <h3 className={modalTitle}>
                Setor ke: {contributeGoal.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Target: {formatIDR(contributeGoal.target_amount)} • Terkumpul: {formatIDR(contributeGoal.saved_amount)}
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className={labelClass}>
                  Nominal Setor (Rp)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={contributeAmount || ''}
                  onChange={e => setContributeAmount(Math.max(0, Number(e.target.value)))}
                  placeholder="Masukkan nominal bebas"
                  className={`${fieldClass} text-base font-bold tabular-nums`}
                />
              </div>

              {/* Quick Chips */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Pilihan Cepat
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[50000, 100000, 250000, 500000, 1000000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setContributeAmount(amt)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition active:scale-95 ${
                        contributeAmount === amt
                          ? isPinkTheme
                            ? 'bg-rose-500 text-white border-rose-500'
                            : 'bg-emerald-600 text-white border-emerald-600'
                          : isPinkTheme
                          ? 'border-pink-200 bg-white text-pink-700 hover:border-pink-300'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      +{formatCompactIDR(amt)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Source Account Selector */}
              <div>
                <label className={labelClass}>
                  Potong Dari Dompet
                </label>
                <select
                  value={contributeAccountId}
                  onChange={e => setContributeAccountId(e.target.value)}
                  className={`${fieldClass} py-2.5 font-semibold text-xs`}
                >
                  {accounts.map(acc => {
                    return (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatCompactIDR(getAccountBalance(acc.id))})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setContributeGoal(null)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${secondaryBtn}`}
              >
                Batal
              </button>
              <button
                onClick={handleConfirmContribute}
                disabled={contributeAmount <= 0}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 ${primaryBtn}`}
              >
                Konfirmasi Setor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Target Tabungan */}
      {editingGoal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`${modalCard} space-y-4`}>
            <div>
              <h3 className={modalTitle}>
                Edit Target Tabungan
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Perbarui nama, nominal, atau tenggat target.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className={labelClass}>
                  Nama Target
                </label>
                <input
                  type="text"
                  value={editGoalName}
                  onChange={e => setEditGoalName(e.target.value)}
                  placeholder="Mis. Dana Darurat, Beli HP"
                  className={`${fieldClass} text-xs font-semibold`}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Nominal Target (Rp)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={editGoalTarget || ''}
                  onChange={e => setEditGoalTarget(Math.max(0, Number(e.target.value)))}
                  className={`${fieldClass} text-sm font-bold tabular-nums`}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Tenggat Waktu <span className="normal-case font-medium text-slate-400/80">(opsional)</span>
                </label>
                <DateField
                  value={editGoalDueDate}
                  onChange={setEditGoalDueDate}
                  ariaLabel="Tenggat waktu"
                  isPinkTheme={isPinkTheme}
                />
              </div>

              <div className={`text-[11px] p-2.5 rounded-xl border ${
                isPinkTheme
                  ? 'text-pink-600/80 bg-pink-50 border-pink-100'
                  : 'text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-800'
              }`}>
                Terkumpul saat ini: <span className={`font-bold ${isPinkTheme ? 'text-pink-800' : 'text-slate-700 dark:text-slate-200'}`}>{formatIDR(editingGoal.saved_amount)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleDeleteGoal(editingGoal.id)}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold ${dangerBtn}`}
              >
                Hapus
              </button>
              <button
                type="button"
                onClick={() => setEditingGoal(null)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${secondaryBtn}`}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleUpdateGoal}
                disabled={!editGoalName.trim() || editGoalTarget <= 0}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 ${primaryBtn}`}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Recurring Modal */}
      {isAddRecurringOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`${modalCard} max-h-[90vh] flex flex-col`}>
            <div className="flex items-start justify-between gap-3 shrink-0">
              <div>
                <h3 className={modalTitle}>
                  {editingRecurringId ? 'Edit Langganan / Rutinitas' : 'Tambah Langganan / Rutinitas'}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Catat otomatis tiap bulan atau minta konfirmasi dulu.
                </p>
              </div>
              <button
                onClick={() => setIsAddRecurringOpen(false)}
                aria-label="Tutup"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs overflow-y-auto pr-1 mt-3 scrollbar-none">
              {/* Jenis transaksi */}
              <div>
                <label className={labelClass}>Jenis Transaksi</label>
                <div className={`flex p-1 rounded-xl ${isPinkTheme ? 'bg-pink-100/70' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setRecType('expense');
                      setRecCategory(categories.find(c => c.kind === 'expense')?.id || 'cat-lainnya');
                    }}
                    className={`flex-1 py-2 rounded-lg font-bold text-[11px] transition ${
                      recType === 'expense'
                        ? `bg-white dark:bg-slate-700 shadow-2xs ${isPinkTheme ? 'text-rose-600' : 'text-rose-600'}`
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Pengeluaran
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecType('income');
                      setRecIsSub(false);
                      setRecCategory(categories.find(c => c.kind === 'income')?.id || 'cat-gaji');
                    }}
                    className={`flex-1 py-2 rounded-lg font-bold text-[11px] transition ${
                      recType === 'income'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Pemasukan
                  </button>
                </div>
              </div>

              <div>
                <label className={labelClass}>Nama</label>
                <input
                  type="text"
                  value={recName}
                  onChange={e => setRecName(e.target.value)}
                  placeholder={recType === 'income' ? 'Mis. Gaji Pokok, Bonus' : 'Mis. Spotify, iCloud, BPJS'}
                  className={`${fieldClass} py-2.5 text-base sm:text-xs font-semibold`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>Nominal (Rp)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={recAmount || ''}
                    placeholder="0"
                    onChange={e => setRecAmount(Math.max(0, Number(e.target.value)))}
                    className={`${fieldClass} py-2.5 font-bold tabular-nums`}
                  />
                </div>
                <div>
                  <label className={labelClass}>Tanggal</label>
                  <DayOfMonthField
                    value={recDay}
                    onChange={day => {
                      setRecDay(day);
                      setRecDayError('');
                    }}
                    ariaLabel="Tanggal jatuh tempo"
                    isPinkTheme={isPinkTheme}
                    error={recDayError}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>Dompet</label>
                  <select
                    value={recAccount}
                    onChange={e => setRecAccount(e.target.value)}
                    className={`${fieldClass} px-2.5 py-2.5 font-semibold text-xs`}
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Kategori</label>
                  <select
                    value={recCategory}
                    onChange={e => setRecCategory(e.target.value)}
                    className={`${fieldClass} px-2.5 py-2.5 font-semibold text-xs`}
                  >
                    {recurringCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mode pencatatan */}
              <div>
                <label className={labelClass}>Mode Pencatatan</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRecMode('auto')}
                    className={`p-2.5 rounded-xl border text-left transition active:scale-[0.98] ${
                      recMode === 'auto'
                        ? isPinkTheme
                          ? 'border-pink-400 bg-pink-100/80'
                          : 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60'
                        : isPinkTheme
                        ? 'border-pink-200/80 bg-white'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className={`font-bold text-[11px] ${
                      recMode === 'auto'
                        ? isPinkTheme ? 'text-pink-700' : 'text-emerald-700 dark:text-emerald-300'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}>
                      Otomatis
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5 leading-snug">Langsung dicatat saat jatuh tempo</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecMode('draft')}
                    className={`p-2.5 rounded-xl border text-left transition active:scale-[0.98] ${
                      recMode === 'draft'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60'
                        : isPinkTheme
                        ? 'border-pink-200/80 bg-white'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className={`font-bold text-[11px] ${recMode === 'draft' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-600 dark:text-slate-300'}`}>
                      Draft
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5 leading-snug">Perlu konfirmasi di Beranda</div>
                  </button>
                </div>
              </div>

              {recType === 'expense' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>Tipe</label>
                    <div className={`flex p-1 gap-1 rounded-xl ${isPinkTheme ? 'bg-pink-100/70' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      <button
                        type="button"
                        onClick={() => setRecIsSub(true)}
                        className={`flex-1 py-2 rounded-lg font-bold text-[11px] transition ${
                          recIsSub
                            ? isPinkTheme
                              ? 'bg-white text-pink-700 shadow-2xs'
                              : 'bg-emerald-600 text-white'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        Langganan
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecIsSub(false)}
                        className={`flex-1 py-2 rounded-lg font-bold text-[11px] transition ${
                          !recIsSub
                            ? isPinkTheme
                              ? 'bg-white text-pink-700 shadow-2xs'
                              : 'bg-emerald-600 text-white'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        Cicilan
                      </button>
                    </div>
                  </div>
                  {!recIsSub && (
                    <div>
                      <label className={labelClass}>Tenor (Bulan)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={recTenor || ''}
                        placeholder="12"
                        onChange={e => setRecTenor(Math.max(1, Number(e.target.value) || 1))}
                        className={`${fieldClass} py-2 tabular-nums`}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-3 shrink-0">
              <button
                onClick={() => setIsAddRecurringOpen(false)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${secondaryBtn}`}
              >
                Batal
              </button>
              <button
                onClick={handleSaveRecurring}
                disabled={!recName.trim() || recAmount <= 0}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 ${primaryBtn}`}
              >
                {editingRecurringId ? 'Simpan Perubahan' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
