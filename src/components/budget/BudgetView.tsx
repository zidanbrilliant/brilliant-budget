import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatIDR, formatCompactIDR } from '../../utils/formatters';
import { AppIcon } from '../common/IconHelper';
import {
  AlertTriangle,
  Plus,
  Repeat,
  Percent,
} from 'lucide-react';
import { BudgetMethod } from '../../types/index.ts';

export const BudgetView: React.FC = () => {
  const {
    budget,
    updateBudget,
    categories,
    accounts,
    getMonthSummary,
    getCategorySpending,
    recurring,
    addRecurring,
    goals,
    contributeToGoal,
    addGoal,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'budget' | 'recurring' | 'goals'>('budget');
  const [isEditingBudgetModal, setIsEditingBudgetModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<BudgetMethod>(budget.method);
  const [totalLimitInput, setTotalLimitInput] = useState<number>(budget.total_limit);

  // New Goal modal state
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState(0);

  // New Recurring modal state
  const [isAddRecurringOpen, setIsAddRecurringOpen] = useState(false);
  const [recName, setRecName] = useState('');
  const [recAmount, setRecAmount] = useState(0);
  const [recDay, setRecDay] = useState(1);
  const [recIsSub, setRecIsSub] = useState(true);
  const [recTenor, setRecTenor] = useState(12);
  const [recAccount, setRecAccount] = useState('acc-bca');
  const [recCategory, setRecCategory] = useState('cat-hiburan');

  // Summary
  const summary = getMonthSummary();
  const totalBudget = budget.total_limit || 0;
  const totalSpent = summary.expense;
  const spentPercent = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;

  const subscriptions = recurring.filter(r => r.is_subscription);
  const monthlySubCost = subscriptions.reduce((sum, r) => sum + r.amount, 0);
  const annualSubCost = monthlySubCost * 12;

  const handleSaveBudget = () => {
    updateBudget({
      ...budget,
      method: selectedMethod,
      total_limit: totalLimitInput,
    });
    setIsEditingBudgetModal(false);
  };

  const handleCreateGoal = () => {
    if (!goalName.trim()) return;
    addGoal({
      name: goalName.trim(),
      target_amount: goalTarget,
      saved_amount: 0,
      due_at: Date.now() + 90 * 86400000,
    });
    setGoalName('');
    setIsGoalModalOpen(false);
  };

  const handleCreateRecurring = () => {
    if (!recName.trim() || recAmount <= 0) return;
    addRecurring({
      name: recName.trim(),
      type: 'expense',
      amount: recAmount,
      account_id: recAccount || accounts[0]?.id || 'acc-bca',
      category_id: recCategory,
      frequency: 'monthly',
      day_of_month: recDay,
      next_run_at: Date.now() + 30 * 86400000,
      mode: 'auto',
      is_active: true,
      is_subscription: recIsSub,
      total_tenor: recIsSub ? undefined : recTenor,
      remaining_tenor: recIsSub ? undefined : recTenor,
    });
    setRecName('');
    setIsAddRecurringOpen(false);
  };

  return (
    <div className="p-4 space-y-3.5">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Budget & Perencanaan
          </h1>
          <p className="text-xs text-slate-400">
            Metode: {budget.method === 'category' ? 'Per Kategori' : budget.method === 'percent' ? '50/30/20' : budget.method === 'envelope' ? 'Amplop' : 'Total Bulanan'}
          </p>
        </div>
        <button
          onClick={() => setIsEditingBudgetModal(true)}
          className="text-xs font-bold px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs transition active:scale-95"
        >
          Atur Budget
        </button>
      </div>

      {/* iOS Segmented Tabs */}
      <div className="grid grid-cols-3 gap-1 bg-slate-200/60 dark:bg-slate-800/80 p-0.5 rounded-xl text-xs font-medium">
        <button
          onClick={() => setActiveTab('budget')}
          className={`py-1.5 rounded-lg transition text-center ${
            activeTab === 'budget'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-2xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Budget Bulanan
        </button>
        <button
          onClick={() => setActiveTab('recurring')}
          className={`py-1.5 rounded-lg transition text-center ${
            activeTab === 'recurring'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-2xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Langganan
        </button>
        <button
          onClick={() => setActiveTab('goals')}
          className={`py-1.5 rounded-lg transition text-center ${
            activeTab === 'goals'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-2xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Target Tabungan
        </button>
      </div>

      {/* ======================= TAB 1: BUDGET BULANAN ======================= */}
      {activeTab === 'budget' && (
        <div className="space-y-3.5">
          {/* Overview Card */}
          <div className="bg-[#0F172A] dark:bg-[#111827] text-white p-5 rounded-2xl border border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Batas Pengeluaran Bulan Ini</span>
              <span>Hari Mulai: Tgl {budget.start_day}</span>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-black tabular-nums">{formatIDR(totalSpent)}</span>
                <span className="text-xs text-slate-400 ml-1 tabular-nums">
                  / {formatIDR(totalBudget)}
                </span>
              </div>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-md tabular-nums ${
                  spentPercent >= 100
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : spentPercent >= 80
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {spentPercent}%
              </span>
            </div>

            {/* Main Bar */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  spentPercent >= 100
                    ? 'bg-rose-500'
                    : spentPercent >= 80
                    ? 'bg-amber-400'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${spentPercent}%` }}
              ></div>
            </div>

            {spentPercent >= 100 && (
              <div className="flex items-center gap-1.5 text-xs text-rose-300 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>Peringatan: Anggaran bulan ini telah melampaui batas!</span>
              </div>
            )}
            {spentPercent >= 80 && spentPercent < 100 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Peringatan: Pemakaian anggaran di atas 80%.</span>
              </div>
            )}
          </div>

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
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Rincian per Kategori
            </h3>

            <div className="bg-white dark:bg-[#151E2E] rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
              {budget.lines.map(line => {
                const cat = categories.find(c => c.id === line.category_id);
                const spent = line.category_id ? getCategorySpending(line.category_id) : 0;
                const percent = line.amount > 0 ? Math.min(100, Math.round((spent / line.amount) * 100)) : 0;
                const isOver = line.amount > 0 && spent > line.amount;
                const isNear = line.amount > 0 && percent >= 80 && !isOver;

                return (
                  <div key={line.id} className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs shadow-2xs"
                          style={{ backgroundColor: cat?.color || '#6B7280' }}
                        >
                          <AppIcon name={cat?.icon || 'CircleEllipsis'} className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {line.name || cat?.name}
                        </span>
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
                          isOver ? 'bg-rose-500' : isNear ? 'bg-amber-400' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB 2: LANGGANAN ======================= */}
      {activeTab === 'recurring' && (
        <div className="space-y-3.5">
          <div className="bg-[#0F172A] dark:bg-[#111827] text-white p-4 rounded-2xl border border-slate-800 shadow-xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Total Biaya Langganan Rutin
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <div>
                <span className="text-2xl font-black tabular-nums">{formatIDR(monthlySubCost)}</span>
                <span className="text-xs text-slate-400 ml-1">/ bulan</span>
              </div>
              <div className="text-xs text-slate-400 tabular-nums">
                ≈ {formatCompactIDR(annualSubCost)} / thn
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Pengeluaran Terjadwal ({recurring.length})
              </h3>
              <button
                onClick={() => setIsAddRecurringOpen(true)}
                className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1.5 rounded-lg transition active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Langganan</span>
              </button>
            </div>

            <div className="bg-white dark:bg-[#151E2E] rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
              {recurring.length === 0 ? (
                <div className="py-8 px-4 text-center space-y-1">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Belum ada langganan atau cicilan
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Ketuk tombol + Langganan untuk menambahkan layanan rutin.
                  </p>
                </div>
              ) : (
                recurring.map(rule => {
                  return (
                    <div
                      key={rule.id}
                      className="p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                          <Repeat className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            {rule.name}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span>Tiap tgl {rule.day_of_month || 1}</span>
                            {rule.total_tenor && (
                              <>
                                <span>•</span>
                                <span className="font-semibold text-emerald-600">
                                  Tenor: {rule.remaining_tenor}/{rule.total_tenor} bln
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold tabular-nums text-slate-900 dark:text-white">
                          {formatIDR(rule.amount)}
                        </div>
                        <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1 py-0.2 rounded font-medium">
                          {rule.mode === 'auto' ? 'Otomatis' : 'Draft'}
                        </span>
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
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Target Aktif ({goals.length})
            </h3>
            <button
              onClick={() => setIsGoalModalOpen(true)}
              className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1.5 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat Target</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {goals.length === 0 ? (
              <div className="bg-white dark:bg-[#151E2E] rounded-2xl p-8 text-center border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-1">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Belum ada target tabungan
                </p>
                <p className="text-[11px] text-slate-400">
                  Mulai rencanakan impian Anda dengan mengetuk tombol Buat Target.
                </p>
              </div>
            ) : (
              goals.map(goal => {
                const progress = goal.target_amount > 0 ? Math.min(
                  100,
                  Math.round((goal.saved_amount / goal.target_amount) * 100)
                ) : 0;
                const remaining = Math.max(0, goal.target_amount - goal.saved_amount);

                return (
                  <div
                    key={goal.id}
                    className="bg-white dark:bg-[#151E2E] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {goal.name}
                        </h4>
                        <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                          Sisa: {formatIDR(remaining)}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md tabular-nums">
                        {progress}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                        {formatCompactIDR(goal.saved_amount)} / {formatCompactIDR(goal.target_amount)}
                      </span>
                      <button
                        onClick={() => contributeToGoal(goal.id, 500000)}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        + Nabung 500rb
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Edit Budget Modal */}
      {isEditingBudgetModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151E2E] rounded-2xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-up">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Metode Anggaran
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1.5">Pilih Gaya Budgeting</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedMethod('category')}
                    className={`p-2.5 rounded-xl border text-left font-semibold ${
                      selectedMethod === 'category'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Per Kategori
                  </button>
                  <button
                    onClick={() => setSelectedMethod('percent')}
                    className={`p-2.5 rounded-xl border text-left font-semibold ${
                      selectedMethod === 'percent'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Aturan 50/30/20
                  </button>
                  <button
                    onClick={() => setSelectedMethod('envelope')}
                    className={`p-2.5 rounded-xl border text-left font-semibold ${
                      selectedMethod === 'envelope'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Sistem Amplop
                  </button>
                  <button
                    onClick={() => setSelectedMethod('total')}
                    className={`p-2.5 rounded-xl border text-left font-semibold ${
                      selectedMethod === 'total'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Batas Total
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                  Batas Bulanan (Rp)
                </label>
                <input
                  type="number"
                  value={totalLimitInput}
                  onChange={e => setTotalLimitInput(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-bold outline-none tabular-nums"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setIsEditingBudgetModal(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Batal
              </button>
              <button
                onClick={handleSaveBudget}
                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Goal Modal */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151E2E] rounded-2xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-up">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Target Tabungan Baru
            </h3>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Nama Target</label>
                <input
                  type="text"
                  value={goalName}
                  onChange={e => setGoalName(e.target.value)}
                  placeholder="Mis. Dana Darurat, Liburan"
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Nominal Target (Rp)</label>
                <input
                  type="number"
                  value={goalTarget}
                  onChange={e => setGoalTarget(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none font-bold tabular-nums"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setIsGoalModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold"
              >
                Batal
              </button>
              <button
                onClick={handleCreateGoal}
                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Recurring Modal */}
      {isAddRecurringOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151E2E] rounded-2xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-up">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Tambah Pengeluaran Rutin
            </h3>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Nama Layanan</label>
                <input
                  type="text"
                  value={recName}
                  onChange={e => setRecName(e.target.value)}
                  placeholder="Mis. Spotify, iCloud, BPJS"
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  value={recAmount}
                  onChange={e => setRecAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none font-bold tabular-nums"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Tanggal Tiap Bulan</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={recDay}
                    onChange={e => setRecDay(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Jenis</label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setRecIsSub(true)}
                      className={`flex-1 py-2 rounded-lg font-bold text-[11px] transition ${
                        recIsSub ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      Langganan
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecIsSub(false)}
                      className={`flex-1 py-2 rounded-lg font-bold text-[11px] transition ${
                        !recIsSub ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      Cicilan
                    </button>
                  </div>
                </div>
              </div>

              {!recIsSub && (
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Total Tenor (Bulan)</label>
                  <input
                    type="number"
                    value={recTenor}
                    onChange={e => setRecTenor(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none tabular-nums"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setIsAddRecurringOpen(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Batal
              </button>
              <button
                onClick={handleCreateRecurring}
                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500"
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
