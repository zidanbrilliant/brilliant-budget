import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatIDR, formatCompactIDR } from '../../utils/formatters';
import { AppIcon } from '../common/IconHelper';
import {
  CreditCard,
  PieChart,
  Shield,
  Download,
  Upload,
  FileSpreadsheet,
  Plus,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Send,
  Printer,
  Tag,
  Lock,
  X,
} from 'lucide-react';
import { parseOCRText } from '../../utils/parser';

export const LainnyaView: React.FC = () => {
  const {
    accounts,
    categories,
    transactions,
    recurring,
    getAccountBalance,
    getTotalNetWorth,
    adjustAccountBalance,
    addAccount,
    addCategory,
    getMonthSummary,
    settings,
    updateSettings,
    setIsLocked,
    exportBackupData,
    importBackupData,
    resetAllData,
    showToast,
    addTransaction,
  } = useApp();

  const [activeSection, setActiveSection] = useState<'menu' | 'dompet' | 'laporan' | 'backup' | 'sms_simulator' | 'kategori'>('menu');

  // Custom Category Modal (FR-35)
  const [isAddCatOpen, setIsAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatKind, setNewCatKind] = useState<'expense' | 'income'>('expense');
  const [newCatColor, setNewCatColor] = useState('#10B981');

  // PDF Print Modal (FR-52)
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Reconciliation modal
  const [adjustAccId, setAdjustAccId] = useState<string | null>(null);
  const [newBalanceInput, setNewBalanceInput] = useState<number>(0);

  // New Wallet modal
  const [isAddWalletOpen, setIsAddWalletOpen] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletType, setNewWalletType] = useState<'bank' | 'ewallet' | 'cash'>('bank');
  const [newWalletBalance, setNewWalletBalance] = useState<number>(0);

  // Transfer modal
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [fromAcc, setFromAcc] = useState(accounts[0]?.id || '');
  const [toAcc, setToAcc] = useState(accounts[1]?.id || '');
  const [transferAmount, setTransferAmount] = useState(0);
  const [transferFee, setTransferFee] = useState(0);

  // SMS Simulator (FR-22: App Intent ParseTransactionText)
  const [smsInput, setSmsInput] = useState(
    'BCA: Trx Rp 250.000 di RESTO SEDAP tgl 08/10 19:40. Ref: 881920'
  );

  const totalNetWorth = getTotalNetWorth();

  // Export CSV (FR-52)
  const handleExportCSV = () => {
    const headers = 'ID,Tanggal,Tipe,Nominal,Kategori,Dompet,Merchant,Catatan,Status\n';
    const rows = transactions
      .filter(t => !t.deleted_at)
      .map(t => {
        const d = new Date(t.occurred_at).toISOString().split('T')[0];
        const cat = categories.find(c => c.id === t.category_id)?.name || '';
        const acc = accounts.find(a => a.id === t.account_id)?.name || '';
        return `"${t.id}","${d}","${t.type}","${t.amount}","${cat}","${acc}","${t.merchant || ''}","${t.note || ''}","${t.status}"`;
      })
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `brilliant-budget-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('File CSV berhasil diunduh');
  };

  // Export Encrypted Backup .catatbak (FR-55)
  const handleExportBackup = () => {
    const data = exportBackupData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `brilliant-budget-${Date.now()}.catatbak`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('File backup .catatbak tersimpan');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result as string;
      if (content) {
        importBackupData(content);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteTransfer = () => {
    if (fromAcc === toAcc || transferAmount <= 0) return;
    addTransaction({
      type: 'transfer',
      amount: transferAmount,
      account_id: fromAcc,
      to_account_id: toAcc,
      admin_fee: transferFee,
      source: 'manual',
      status: 'confirmed',
      note: `Transfer ke ${accounts.find(a => a.id === toAcc)?.name}`,
    });
    setIsTransferOpen(false);
  };

  const handleProcessSMS = () => {
    const res = parseOCRText(smsInput);
    addTransaction({
      type: res.type,
      amount: res.amount,
      category_id: res.category_id,
      account_id: 'acc-bca',
      merchant: res.merchant,
      note: `SMS Bank: ${smsInput}`,
      external_ref: res.external_ref,
      source: 'sms',
      confidence: 0.94,
      status: 'draft',
      raw_source_text: smsInput,
    });
    showToast('SMS diproses → Masuk Inbox Draft');
  };

  return (
    <div className="p-4 space-y-4">
      {/* Top Header with Back Navigation if in sub-section */}
      <div className="flex items-center justify-between">
        {activeSection === 'menu' ? (
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Pengaturan
            </h1>
            <p className="text-xs text-slate-400">
              Kelola dompet, kategori, laporan & keamanan
            </p>
          </div>
        ) : (
          <button
            onClick={() => setActiveSection('menu')}
            className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Kembali ke Pengaturan</span>
          </button>
        )}
      </div>

      {/* ===================== VIEW 1: MAIN SETTINGS MENU (Apple Grouped Inset) ===================== */}
      {activeSection === 'menu' && (
        <div className="space-y-4">
          {/* Section: Akun & Kategori */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Akun & Kategori
            </span>
            <div className="bg-white dark:bg-[#151E2E] rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
              <button
                onClick={() => setActiveSection('dompet')}
                className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Dompet & Rekening</div>
                    <div className="text-[11px] text-slate-400">{accounts.length} dompet • Total {formatCompactIDR(totalNetWorth)}</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button
                onClick={() => setActiveSection('kategori')}
                className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Kategori Transaksi</div>
                    <div className="text-[11px] text-slate-400">{categories.length} kategori aktif</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            </div>
          </div>

          {/* Section: Laporan & Ekspor */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Laporan & Ekspor
            </span>
            <div className="bg-white dark:bg-[#151E2E] rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
              <button
                onClick={() => setActiveSection('laporan')}
                className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <PieChart className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Laporan Keuangan & Wawasan</div>
                    <div className="text-[11px] text-slate-400">Analisis pengeluaran on-device</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button
                onClick={() => setIsPdfModalOpen(true)}
                className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Cetak Ringkasan PDF</div>
                    <div className="text-[11px] text-slate-400">Format ringkas siap simpan / cetak</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button
                onClick={handleExportCSV}
                className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Unduh Spreadsheet CSV</div>
                    <div className="text-[11px] text-slate-400">Ekspor semua baris transaksi</div>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            </div>
          </div>

          {/* Section: Keamanan & Cadangan */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Keamanan & Privasi
            </span>
            <div className="bg-white dark:bg-[#151E2E] rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
              <div className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Kunci PIN / Biometrik</div>
                    <div className="text-[11px] text-slate-400">Kunci otomatis saat keluar aplikasi</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const next = !settings.pin_enabled;
                    updateSettings({ pin_enabled: next });
                    if (next) setIsLocked(true);
                  }}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                    settings.pin_enabled ? 'bg-emerald-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-xs"></div>
                </button>
              </div>

              <button
                onClick={() => setActiveSection('backup')}
                className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Cadangan Terenkripsi (.catatbak)</div>
                    <div className="text-[11px] text-slate-400">Simpan atau pulihkan file cadangan</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button
                onClick={() => setActiveSection('sms_simulator')}
                className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Uji Parser SMS Shortcuts</div>
                    <div className="text-[11px] text-slate-400">Simulasi Apple Shortcuts App Intent</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            </div>
          </div>

          {/* Section: Sistem */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Sistem
            </span>
            <div className="bg-white dark:bg-[#151E2E] rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs text-xs overflow-hidden">
              <div className="p-3.5 flex items-center justify-between">
                <span className="font-medium text-slate-700 dark:text-slate-300">Privasi Server</span>
                <span className="font-bold text-emerald-600">100% On-Device</span>
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <span className="font-medium text-slate-700 dark:text-slate-300">Mata Uang</span>
                <span className="font-bold text-slate-500">IDR (Rupiah)</span>
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <span className="font-semibold text-rose-600">Reset Semua Data</span>
                <button
                  onClick={() => {
                    if (window.confirm('Kembalikan semua data ke setelan awal?')) {
                      resetAllData();
                    }
                  }}
                  className="text-rose-600 font-bold hover:underline"
                >
                  Reset Pabrik
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SUB SECTION: DOMPET ===================== */}
      {activeSection === 'dompet' && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Dompet & Rekening (Total: {formatIDR(totalNetWorth)})
            </h3>
            <div className="flex gap-1.5">
              <button
                onClick={() => setIsTransferOpen(true)}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2.5 py-1 rounded-lg"
              >
                Transfer
              </button>
              <button
                onClick={() => setIsAddWalletOpen(true)}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-1 rounded-lg"
              >
                + Dompet
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#151E2E] rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
            {accounts.map(acc => {
              const balance = getAccountBalance(acc.id);
              return (
                <div
                  key={acc.id}
                  className="p-3.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                      style={{ backgroundColor: acc.color }}
                    >
                      <AppIcon name={acc.icon} className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {acc.name}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        {acc.type}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-extrabold tabular-nums text-slate-900 dark:text-white">
                      {formatIDR(balance)}
                    </div>
                    <button
                      onClick={() => {
                        setAdjustAccId(acc.id);
                        setNewBalanceInput(balance);
                      }}
                      className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline mt-0.5"
                    >
                      Sesuaikan Saldo
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================== SUB SECTION: KATEGORI ===================== */}
      {activeSection === 'kategori' && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Kategori Aktif ({categories.length})
            </h3>
            <button
              onClick={() => setIsAddCatOpen(true)}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-lg flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#151E2E] rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
            {categories.map(c => (
              <div
                key={c.id}
                className="p-3 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: c.color }}
                  >
                    <AppIcon name={c.icon} className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">{c.name}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 capitalize px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                  {c.kind === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== SUB SECTION: LAPORAN & WAWASAN ===================== */}
      {activeSection === 'laporan' && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Laporan Keuangan
            </h3>
            <button
              onClick={() => setIsPdfModalOpen(true)}
              className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-lg"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak PDF</span>
            </button>
          </div>

          {/* Wawasan Card */}
          <div className="bg-[#0F172A] dark:bg-[#111827] text-white p-4 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <Sparkles className="w-4 h-4" />
              <span>Wawasan On-Device (FR-53)</span>
            </div>
            <div className="space-y-1 text-xs text-slate-300 leading-relaxed">
              <div>• Pengeluaran bulan ini: <strong className="tabular-nums">{formatIDR(getMonthSummary().expense)}</strong>.</div>
              <div>• Langganan aktif: {recurring.filter(r => r.is_subscription).length} layanan ({formatIDR(recurring.filter(r => r.is_subscription).reduce((s, r) => s + r.amount, 0))}/bln).</div>
            </div>
          </div>

          {/* Breakdown per category */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Pengeluaran Terbesar per Kategori:
            </span>
            <div className="bg-white dark:bg-[#151E2E] rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
              {categories
                .filter(c => c.kind === 'expense')
                .map(cat => {
                  const spent = transactions
                    .filter(t => t.category_id === cat.id && t.status === 'confirmed' && !t.deleted_at)
                    .reduce((sum, t) => sum + t.amount, 0);

                  if (spent === 0) return null;

                  return (
                    <div
                      key={cat.id}
                      className="p-3 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        ></span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {cat.name}
                        </span>
                      </div>
                      <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                        {formatIDR(spent)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ===================== SUB SECTION: BACKUP ===================== */}
      {activeSection === 'backup' && (
        <div className="space-y-3.5">
          <div className="bg-white dark:bg-[#151E2E] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 space-y-3 text-xs">
            <div className="font-bold text-slate-900 dark:text-white text-sm">Cadangan Terenkripsi (.catatbak)</div>
            <p className="text-slate-400 leading-relaxed">
              Semua data disimpan di file lokal perangkat Anda. Anda dapat mencadangkan atau memulihkannya kapan saja.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleExportBackup}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Simpan File</span>
              </button>
              <label className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-center cursor-pointer flex items-center justify-center gap-1.5 hover:bg-slate-200 transition">
                <Upload className="w-3.5 h-3.5" />
                <span>Pulihkan</span>
                <input
                  type="file"
                  accept=".catatbak,.json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SUB SECTION: SMS TESTER ===================== */}
      {activeSection === 'sms_simulator' && (
        <div className="space-y-3 bg-white dark:bg-[#151E2E] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 text-xs">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Uji Coba Otomatisasi SMS Bank (FR-22)
          </h3>
          <p className="text-slate-400 leading-relaxed">
            Simulasi cara kerja Shortcuts App Intent `ParseTransactionText(text)` tanpa jaringan.
          </p>
          <textarea
            value={smsInput}
            onChange={e => setSmsInput(e.target.value)}
            rows={3}
            className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-transparent focus:border-slate-300 dark:focus:border-slate-700 outline-none font-mono"
          />
          <button
            onClick={handleProcessSMS}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Kirim & Ekstraksi ke Inbox Draft</span>
          </button>
        </div>
      )}

      {/* Modal Penyesuaian Saldo (FR-30) */}
      {adjustAccId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151E2E] rounded-2xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-up">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Sesuaikan Saldo Nyata
            </h3>
            <p className="text-xs text-slate-400">
              Sistem akan membuat transaksi koreksi otomatis untuk menyelaraskan saldo fisik.
            </p>
            <input
              type="number"
              value={newBalanceInput}
              onChange={e => setNewBalanceInput(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-bold outline-none tabular-nums"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setAdjustAccId(null)}
                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  adjustAccountBalance(adjustAccId, newBalanceInput);
                  setAdjustAccId(null);
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Dompet Baru */}
      {isAddWalletOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151E2E] rounded-2xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-up">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Tambah Dompet Baru
            </h3>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Nama Dompet</label>
                <input
                  type="text"
                  value={newWalletName}
                  onChange={e => setNewWalletName(e.target.value)}
                  placeholder="Mis. Mandiri Tabungan"
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Jenis</label>
                <select
                  value={newWalletType}
                  onChange={e => setNewWalletType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none font-semibold"
                >
                  <option value="bank">Rekening Bank</option>
                  <option value="ewallet">E-Wallet</option>
                  <option value="cash">Uang Tunai</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Saldo Awal (Rp)</label>
                <input
                  type="number"
                  value={newWalletBalance}
                  onChange={e => setNewWalletBalance(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none font-bold tabular-nums"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setIsAddWalletOpen(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (!newWalletName.trim()) return;
                  addAccount({
                    name: newWalletName.trim(),
                    type: newWalletType,
                    currency: 'IDR',
                    opening_balance: newWalletBalance,
                    icon: newWalletType === 'bank' ? 'Landmark' : newWalletType === 'ewallet' ? 'Smartphone' : 'Banknote',
                    color: newWalletType === 'bank' ? '#2563EB' : newWalletType === 'ewallet' ? '#06B6D4' : '#16A34A',
                    is_archived: false,
                  });
                  setNewWalletName('');
                  setNewWalletBalance(0);
                  setIsAddWalletOpen(false);
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500"
              >
                Tambah
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Transfer Antar Dompet */}
      {isTransferOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151E2E] rounded-2xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-up">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Transfer Antar Dompet
            </h3>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Dari Dompet Asal</label>
                <select
                  value={fromAcc}
                  onChange={e => setFromAcc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-semibold"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCompactIDR(getAccountBalance(a.id))})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Ke Dompet Tujuan</label>
                <select
                  value={toAcc}
                  onChange={e => setToAcc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-semibold"
                >
                  {accounts
                    .filter(a => a.id !== fromAcc)
                    .map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={e => setTransferAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold tabular-nums"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Biaya Admin (Opsional)</label>
                <input
                  type="number"
                  value={transferFee}
                  onChange={e => setTransferFee(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl tabular-nums"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setIsTransferOpen(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteTransfer}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
              >
                Kirim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Kategori */}
      {isAddCatOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151E2E] rounded-2xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-up">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Tambah Kategori Baru
            </h3>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Nama Kategori</label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="Mis. Skincare, Zakat"
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Jenis Kategori</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCatKind('expense')}
                    className={`flex-1 py-2 rounded-xl font-bold transition ${
                      newCatKind === 'expense'
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Pengeluaran
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCatKind('income')}
                    className={`flex-1 py-2 rounded-xl font-bold transition ${
                      newCatKind === 'income'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Pemasukan
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Pilih Warna</label>
                <div className="flex gap-2">
                  {['#059669', '#1E293B', '#334155', '#475569', '#64748B'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCatColor(color)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        newCatColor === color ? 'scale-125 ring-2 ring-slate-400' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setIsAddCatOpen(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (!newCatName.trim()) return;
                  addCategory({
                    name: newCatName.trim(),
                    kind: newCatKind,
                    icon: 'Tag',
                    color: newCatColor,
                  });
                  setNewCatName('');
                  setIsAddCatOpen(false);
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cetak PDF */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151E2E] rounded-2xl p-5 max-w-md w-full space-y-3.5 shadow-2xl max-h-[85vh] overflow-y-auto animate-scale-up border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b pb-2.5 border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Ringkasan Laporan Keuangan
                </h3>
                <span className="text-[11px] text-slate-400">Format Cetak / PDF Siap Cetak (FR-52)</span>
              </div>
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1.5 border border-slate-200/60 dark:border-slate-800">
                <div className="flex justify-between">
                  <span>Total Pemasukan:</span>
                  <span className="font-bold text-emerald-600 tabular-nums">{formatIDR(getMonthSummary().income)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Pengeluaran:</span>
                  <span className="font-bold text-rose-600 tabular-nums">{formatIDR(getMonthSummary().expense)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold">
                  <span>Arus Bersih:</span>
                  <span className="tabular-nums">{formatIDR(getMonthSummary().balance)}</span>
                </div>
              </div>

              <div>
                <span className="font-bold block mb-1">Rincian Pengeluaran Teratas:</span>
                <div className="space-y-1">
                  {categories.filter(c => c.kind === 'expense').slice(0, 5).map(c => {
                    const spent = transactions
                      .filter(t => t.category_id === c.id && t.status === 'confirmed' && !t.deleted_at)
                      .reduce((sum, t) => sum + t.amount, 0);
                    return (
                      <div key={c.id} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span>{c.name}</span>
                        <span className="font-semibold tabular-nums">{formatIDR(spent)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold"
              >
                Tutup
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak / PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
