import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatIDR, formatCompactIDR } from '../../utils/formatters';
import { AppIcon } from '../common/IconHelper';
import { ReportPieChart } from '../common/ReportPieChart';
import { GeminiKeyPanel } from '../common/GeminiKeyPanel';
import { buildReportSummary, type ReportPeriodMode } from '../../utils/reporting';
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
  X,
  Edit2,
  Trash2,
  Clipboard,
  Check,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { parseOCRText } from '../../utils/parser';
import { Account, Category } from '../../types/index.ts';
import {
  getSheetWebhookUrl,
  setSheetWebhookUrl,
  getQueue,
  flushSheetQueue,
  sendToWebhook,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
} from '../../services/googleSheets';

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
    deleteAccount,
    addCategory,
    updateCategory,
    deleteCategory,
    settings,
    updateSettings,
    exportBackupData,
    importBackupData,
    resetAllData,
    showToast,
    addTransaction,
    syncFromSheet,
  } = useApp();

  const [activeSection, setActiveSection] = useState<'menu' | 'dompet' | 'laporan' | 'backup' | 'sms_simulator' | 'kategori' | 'googlesheets' | 'ai'>('menu');
  const isPinkTheme = settings.theme === 'pink';

  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector('main')?.scrollTo(0, 0);
  }, [activeSection]);

  const sectionMeta: Record<string, { title: string; subtitle: string }> = {
    dompet: { title: 'Dompet & Rekening', subtitle: 'Kelola saldo dan transfer antar dompet' },
    kategori: { title: 'Kategori Transaksi', subtitle: 'Atur kategori pengeluaran dan pemasukan' },
    laporan: { title: 'Laporan & Wawasan', subtitle: 'Ringkasan dan analisis keuanganmu' },
    backup: { title: 'Cadangan & Pemulihan', subtitle: 'Simpan data ke file lokal yang aman' },
    sms_simulator: { title: 'Uji Parser SMS', subtitle: 'Simulasi otomatisasi dari teks SMS bank' },
    googlesheets: { title: 'Google Sheets', subtitle: 'Sinkronkan transaksi secara otomatis' },
    ai: { title: 'Gemini AI', subtitle: 'Input suara & scan nota dengan AI gratis' },
  };
  const activeMeta = activeSection === 'menu' ? null : sectionMeta[activeSection];
  const primaryBtn = isPinkTheme
    ? 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white shadow-xs shadow-rose-200'
    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs';
  const secondaryBtn = isPinkTheme
    ? 'bg-pink-100 text-pink-700 hover:bg-pink-200'
    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700';
  const segmentIdle = isPinkTheme
    ? 'bg-pink-100/70 text-pink-700 hover:bg-pink-200/70'
    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
  const softAccent = isPinkTheme
    ? 'text-pink-600 bg-pink-50 dark:bg-pink-950/40 dark:text-pink-300'
    : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/80 dark:text-emerald-400';
  const fieldClass = `w-full px-3 py-2 rounded-xl border outline-none transition ${
    isPinkTheme
      ? 'bg-white border-pink-200 text-[#37131D] placeholder:text-pink-300 focus:border-pink-400'
      : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-900 dark:text-slate-100 focus:border-slate-300 dark:focus:border-slate-700'
  }`;
  const modalCard = `rounded-2xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl border animate-scale-up ${
    isPinkTheme
      ? 'bg-[#FFF5F7] border-pink-200 text-[#37131D]'
      : 'bg-white dark:bg-[#151E2E] border-slate-200 dark:border-slate-800'
  }`;
  const labelClass = `text-[11px] font-bold uppercase block mb-1 ${isPinkTheme ? 'text-pink-500/80' : 'text-slate-400'}`;

  // Google Sheets state
  const [sheetUrl, setSheetUrl] = useState(getSheetWebhookUrl());
  const [queueCount, setQueueCount] = useState(getQueue().length);
  const [isTestingSheet, setIsTestingSheet] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isCopiedCode, setIsCopiedCode] = useState(false);

  // Custom Category Modal (FR-35)
  const [isAddCatOpen, setIsAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatKind, setNewCatKind] = useState<'expense' | 'income'>('expense');
  const [newCatColor, setNewCatColor] = useState('#FB7185');

  // Edit Category Modal
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatKind, setEditCatKind] = useState<'expense' | 'income'>('expense');
  const [editCatColor, setEditCatColor] = useState('#FB7185');

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

  // Delete Wallet modal
  const [deletingWallet, setDeletingWallet] = useState<Account | null>(null);
  const [reassignWalletId, setReassignWalletId] = useState('');

  // Financial report period
  const [reportMode, setReportMode] = useState<ReportPeriodMode>('month');
  const [reportMonth, setReportMonth] = useState(() => new Date().getMonth());
  const [reportYear, setReportYear] = useState(() => new Date().getFullYear());

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

  const reportCard = isPinkTheme
    ? 'bg-white border-pink-200/80'
    : 'bg-white dark:bg-[#151E2E] border-slate-200/80 dark:border-slate-800/80';
  const reportSummary = useMemo(
    () => buildReportSummary(transactions, categories, reportMode, reportYear, reportMonth),
    [transactions, categories, reportMode, reportYear, reportMonth]
  );
  const reportPeriodLabel = useMemo(
    () =>
      reportMode === 'year'
        ? `Tahun ${reportYear}`
        : new Date(reportYear, reportMonth, 1).toLocaleDateString('id-ID', {
            month: 'long',
            year: 'numeric',
          }),
    [reportMode, reportMonth, reportYear]
  );
  const topExpense = reportSummary.slices[0];

  const shiftReportPeriod = (delta: number) => {
    if (reportMode === 'month') {
      const next = new Date(reportYear, reportMonth + delta, 1);
      setReportMonth(next.getMonth());
      setReportYear(next.getFullYear());
      return;
    }
    setReportYear(year => year + delta);
  };

  const openDeleteWallet = (account: Account) => {
    setDeletingWallet(account);
    setReassignWalletId(accounts.find(a => a.id !== account.id)?.id || '');
  };

  const confirmDeleteWallet = () => {
    if (!deletingWallet) return;
    deleteAccount(deletingWallet.id, reassignWalletId);
    setDeletingWallet(null);
  };

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

  const handlePasteClipboardSMS = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setSmsInput(text.trim());
          showToast('Teks SMS ditempel dari clipboard');
          return;
        }
      }
      showToast('Clipboard kosong atau belum diizinkan');
    } catch {
      showToast('Gunakan tempel manual di kotak teks');
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Top Header with Back Navigation if in sub-section */}
      <div className="flex items-start justify-between gap-3">
        {activeSection === 'menu' ? (
          <div>
            <h1 className={`text-xl font-bold tracking-tight ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
              Pengaturan
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Kelola dompet, kategori, laporan & keamanan
            </p>
          </div>
        ) : (
          <div className="min-w-0">
            <button
              onClick={() => setActiveSection('menu')}
              className={`inline-flex items-center gap-1 text-[11px] font-bold mb-2 transition ${
                isPinkTheme
                  ? 'text-pink-600 hover:text-pink-700'
                  : 'text-emerald-600 dark:text-emerald-400 hover:underline'
              }`}
            >
              <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Kembali ke Pengaturan</span>
            </button>
            <h1 className={`text-xl font-bold tracking-tight ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
              {activeMeta?.title}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">{activeMeta?.subtitle}</p>
          </div>
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

              <button
                onClick={() => {
                  setSheetUrl(getSheetWebhookUrl());
                  setQueueCount(getQueue().length);
                  setActiveSection('googlesheets');
                }}
                className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Auto-Sync Google Sheets</div>
                    <div className="text-[11px] text-slate-400">
                      {sheetUrl ? 'Aktif (Tersambung ke Google Drive)' : 'Belum tersambung (Pasang Webhook)'}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            </div>
          </div>

          {/* Section: Keamanan & Cadangan */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Keamanan & Privasi
            </span>
            <div className="bg-white dark:bg-[#151E2E] rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
              <button
                onClick={() => setActiveSection('backup')}
                className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Cadangan Lokal (.catatbak)</div>
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

          {/* Section: AI & Otomatisasi */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
              AI & Otomatisasi
            </span>
            <div className="bg-white dark:bg-[#151E2E] rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
              <button
                onClick={() => setActiveSection('ai')}
                className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Gemini AI</div>
                    <div className="text-[11px] text-slate-400">
                      Input suara & scan nota dengan AI gratis
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            </div>
          </div>

          {/* Section: Sistem */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Sistem & Tema
            </span>
            <div className="bg-white dark:bg-[#151E2E] rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs text-xs overflow-hidden">
              <div className="p-3.5 space-y-2.5">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">Tema Warna</div>
                  <div className="text-[11px] text-slate-400">Pilih estetika tampilan favoritmu</div>
                </div>
                <div
                  role="group"
                  aria-label="Pilih tema warna"
                  className={`grid grid-cols-3 gap-1 p-1 rounded-xl ${isPinkTheme ? 'bg-pink-100/70' : 'bg-slate-100 dark:bg-slate-800/80'}`}
                >
                  {([
                    { id: 'pink', label: 'Pink', emoji: '🌸' },
                    { id: 'light', label: 'Light', emoji: '⚪' },
                    { id: 'dark', label: 'Dark', emoji: '🌙' },
                  ] as const).map(t => {
                    const selected = settings.theme === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => updateSettings({ theme: t.id })}
                        aria-pressed={selected}
                        className={`py-1.5 rounded-lg text-xs transition active:scale-95 flex items-center justify-center gap-1 ${
                          selected
                            ? `bg-white dark:bg-slate-700 shadow-2xs font-bold ${isPinkTheme ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <span aria-hidden="true">{t.emoji}</span>
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3.5 flex items-center justify-between">
                <span className="font-medium text-slate-700 dark:text-slate-300">Privasi Server</span>
                <span className={`font-bold ${isPinkTheme ? 'text-pink-600' : 'text-emerald-600'}`}>100% On-Device</span>
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

            {/* App Version Info Badge */}
            <div className="text-center pt-2 pb-4 space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isPinkTheme ? 'bg-pink-500' : 'bg-emerald-500'}`}></span>
                <span>Brilliant Budget v0.2.1</span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span>Build 20261012</span>
              </div>
              <p className="text-[10px] text-slate-400">
                100% Offline-First SQLite · PWA & iOS Ready
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SUB SECTION: DOMPET ===================== */}
      {activeSection === 'dompet' && (
        <div className="space-y-3.5">
          <div className="flex items-end justify-between gap-2 px-1">
            <div>
              <span className="text-[11px] text-slate-400 font-semibold">Total saldo</span>
              <div className={`text-base font-extrabold tabular-nums ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
                {formatIDR(totalNetWorth)}
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => setIsTransferOpen(true)}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2.5 py-1.5 rounded-lg transition active:scale-95"
              >
                Transfer
              </button>
              <button
                onClick={() => setIsAddWalletOpen(true)}
                className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition active:scale-95 ${softAccent}`}
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
                  className="p-3.5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: acc.color }}
                    >
                      <AppIcon name={acc.icon} className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {acc.name}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        {acc.type}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-extrabold tabular-nums text-slate-900 dark:text-white">
                        {formatIDR(balance)}
                      </div>
                      <button
                        onClick={() => {
                          setAdjustAccId(acc.id);
                          setNewBalanceInput(balance);
                        }}
                        className={`text-[11px] font-semibold hover:underline mt-0.5 ${isPinkTheme ? 'text-pink-600' : 'text-emerald-600 dark:text-emerald-400'}`}
                      >
                        Sesuaikan Saldo
                      </button>
                    </div>
                    {accounts.length > 1 && (
                      <button
                        onClick={() => openDeleteWallet(acc)}
                        aria-label={`Hapus dompet ${acc.name}`}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition shrink-0 ${
                          isPinkTheme
                            ? 'text-pink-400 hover:text-rose-600 hover:bg-rose-50'
                            : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
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
            <span className="text-[11px] text-slate-400 font-semibold">
              {categories.length} kategori aktif
            </span>
            <button
              onClick={() => setIsAddCatOpen(true)}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition active:scale-95 ${softAccent}`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#151E2E] rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
            {categories.map(c => (
              <div
                key={c.id}
                className="p-3 flex items-center justify-between text-xs gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: c.color }}
                  >
                    <AppIcon name={c.icon} className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 dark:text-white truncate block">{c.name}</span>
                    <span className="text-[10px] text-slate-400 capitalize">
                      {c.kind === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setEditingCat(c);
                      setEditCatName(c.name);
                      setEditCatKind(c.kind);
                      setEditCatColor(c.color);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Ubah Kategori"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {c.id !== 'cat-lainnya' && (
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `Hapus kategori "${c.name}"? Transaksi yang menggunakan kategori ini akan dialihkan ke "Lainnya".`
                          )
                        ) {
                          deleteCategory(c.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      title="Hapus Kategori"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== SUB SECTION: LAPORAN & WAWASAN ===================== */}
      {activeSection === 'laporan' && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] text-slate-400 font-semibold">
              Ringkasan {reportMode === 'month' ? 'bulanan' : 'tahunan'}
            </span>
            <button
              onClick={() => setIsPdfModalOpen(true)}
              className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2.5 py-1.5 rounded-lg transition active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak PDF</span>
            </button>
          </div>

          {/* Period selector */}
          <div className={`rounded-2xl border p-3 shadow-xs ${reportCard}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                className={`flex rounded-xl p-0.5 ${
                  isPinkTheme ? 'bg-pink-100/70' : 'bg-slate-100 dark:bg-slate-800'
                }`}
              >
                <button
                  onClick={() => setReportMode('month')}
                  aria-pressed={reportMode === 'month'}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition ${
                    reportMode === 'month'
                      ? isPinkTheme
                        ? 'bg-white text-rose-600 shadow-2xs'
                        : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : isPinkTheme
                      ? 'text-pink-600/70'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Bulanan
                </button>
                <button
                  onClick={() => setReportMode('year')}
                  aria-pressed={reportMode === 'year'}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition ${
                    reportMode === 'year'
                      ? isPinkTheme
                        ? 'bg-white text-rose-600 shadow-2xs'
                        : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : isPinkTheme
                      ? 'text-pink-600/70'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Tahunan
                </button>
              </div>

              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => shiftReportPeriod(-1)}
                  aria-label="Periode sebelumnya"
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                    isPinkTheme
                      ? 'text-pink-500 hover:bg-pink-50'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span
                  className={`min-w-[92px] text-center text-[11px] font-bold tabular-nums ${
                    isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {reportPeriodLabel}
                </span>
                <button
                  onClick={() => shiftReportPeriod(1)}
                  aria-label="Periode berikutnya"
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                    isPinkTheme
                      ? 'text-pink-500 hover:bg-pink-50'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Summary for the selected period */}
          <div
            className={`rounded-2xl border p-3.5 space-y-1.5 text-xs shadow-xs ${reportCard} ${
              isPinkTheme ? 'text-[#4C1D2E]' : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex justify-between gap-2">
              <span className="text-slate-400">Total Pemasukan</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatIDR(reportSummary.income)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400">Total Pengeluaran</span>
              <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                {formatIDR(reportSummary.expense)}
              </span>
            </div>
            <div
              className={`flex justify-between gap-2 border-t pt-1.5 font-bold ${
                isPinkTheme ? 'border-pink-100' : 'border-slate-100 dark:border-slate-800'
              }`}
            >
              <span>Arus Bersih</span>
              <span
                className={`tabular-nums ${
                  reportSummary.balance >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatIDR(reportSummary.balance)}
              </span>
            </div>
          </div>

          {/* Expense pie chart */}
          <div className={`rounded-2xl border p-4 shadow-xs ${reportCard}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div
                  className={`text-xs font-bold ${
                    isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'
                  }`}
                >
                  Diagram Pengeluaran
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{reportPeriodLabel}</div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 ${
                  isPinkTheme
                    ? 'bg-pink-50 text-pink-600'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300'
                }`}
              >
                {reportSummary.slices.length} kategori
              </span>
            </div>
            <ReportPieChart
              slices={reportSummary.slices}
              total={reportSummary.expense}
              isPinkTheme={isPinkTheme}
              periodLabel={reportPeriodLabel}
            />
          </div>

          {/* Wawasan Card */}
          <div className="bg-[#0F172A] dark:bg-[#111827] text-white p-4 rounded-2xl border border-slate-800 space-y-2">
            <div
              className={`flex items-center gap-1.5 text-xs font-bold ${
                isPinkTheme ? 'text-pink-300' : 'text-emerald-400'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Wawasan On-Device</span>
            </div>
            <div className="space-y-1 text-xs text-slate-300 leading-relaxed">
              <div>
                • Pengeluaran {reportPeriodLabel}:{' '}
                <strong className="tabular-nums">{formatIDR(reportSummary.expense)}</strong>.
              </div>
              <div>
                • Kategori terbesar:{' '}
                {topExpense ? (
                  <strong>
                    {topExpense.name} ({Math.round(topExpense.percent)}%)
                  </strong>
                ) : (
                  'belum ada data'
                )}
                .
              </div>
              <div>
                • Langganan aktif: {recurring.filter(r => r.is_subscription).length} layanan (
                {formatIDR(recurring.filter(r => r.is_subscription).reduce((s, r) => s + r.amount, 0))}
                /bln).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SUB SECTION: GEMINI AI ===================== */}
      {activeSection === 'ai' && <GeminiKeyPanel />}

      {/* ===================== SUB SECTION: BACKUP ===================== */}
      {activeSection === 'backup' && (
        <div className="space-y-3.5">
          <div className="bg-white dark:bg-[#151E2E] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 space-y-3 text-xs">
            <div className={`font-bold text-sm ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>File Cadangan Lokal (.catatbak)</div>
            <p className="text-slate-400 leading-relaxed">
              Semua data disimpan di file lokal perangkat Anda. Anda dapat mencadangkan atau memulihkannya kapan saja.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleExportBackup}
                className={`flex-1 py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition active:scale-95 ${primaryBtn}`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Simpan File</span>
              </button>
              <label className={`flex-1 py-2.5 rounded-xl font-bold text-center cursor-pointer flex items-center justify-center gap-1.5 transition active:scale-95 ${secondaryBtn}`}>
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
          <h3 className={`font-bold text-sm ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
            Uji Coba Otomatisasi SMS Bank
          </h3>
          <p className="text-slate-400 leading-relaxed">
            Simulasi cara kerja Shortcuts App Intent `ParseTransactionText(text)` tanpa jaringan.
          </p>
          <textarea
            value={smsInput}
            onChange={e => setSmsInput(e.target.value)}
            rows={3}
            className={`${fieldClass} font-mono`}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePasteClipboardSMS}
              className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition active:scale-95 ${secondaryBtn}`}
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>Tempel Clipboard</span>
            </button>
            <button
              type="button"
              onClick={handleProcessSMS}
              className={`flex-1 py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition active:scale-95 ${primaryBtn}`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim & Ekstraksi ke Inbox Draft</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================== SUB SECTION: GOOGLE SHEETS ===================== */}
      {activeSection === 'googlesheets' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#151E2E] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-3.5 text-xs">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Hubungkan ke Google Sheets Pribadi
              </h3>
              <p className="text-slate-400 mt-1 leading-relaxed">
                Tiap transaksi tersimpan akan otomatis dikirim ke Google Sheets Anda. Jika sedang offline, data diantrekan dan dikirim otomatis saat online.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1.5">
                URL Webhook Apps Script
              </label>
              <input
                type="url"
                value={sheetUrl}
                onChange={e => setSheetUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className={`${fieldClass} font-mono text-[11px]`}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSheetWebhookUrl(sheetUrl);
                  showToast('URL Google Sheets disimpan');
                }}
                className={`flex-1 min-w-[120px] py-2.5 rounded-xl font-bold transition active:scale-95 ${primaryBtn}`}
              >
                Simpan URL
              </button>
              <button
                type="button"
                disabled={!sheetUrl || isPulling}
                onClick={async () => {
                  if (!sheetUrl) return;
                  setIsPulling(true);
                  await syncFromSheet(false);
                  setIsPulling(false);
                }}
                className={`px-3 py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 ${
                  isPinkTheme
                    ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                    : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPulling ? 'animate-spin' : ''}`} />
                <span>{isPulling ? 'Menarik...' : 'Tarik Data'}</span>
              </button>
              <button
                type="button"
                disabled={!sheetUrl || isTestingSheet}
                onClick={async () => {
                  if (!sheetUrl) return;
                  setIsTestingSheet(true);
                  const ok = await sendToWebhook(sheetUrl, {
                    date: new Date().toLocaleString('sv-SE'),
                    type: 'income',
                    category: 'Uji Coba',
                    amount: 10000,
                    account: 'Dompet',
                    note: 'Tes Sambungan Brilliant Budget',
                    source: 'test',
                  });
                  setIsTestingSheet(false);
                  if (ok) {
                    showToast('Baris tes berhasil dikirim ke Sheets!');
                  } else {
                    showToast('Gagal kirim, periksa izin deployment Web App');
                  }
                }}
                className={`px-3 py-2.5 rounded-xl font-bold transition active:scale-95 disabled:opacity-50 ${secondaryBtn}`}
              >
                {isTestingSheet ? 'Mengirim...' : 'Tes Kirim'}
              </button>
            </div>

            {/* Auto-Sync Real-time Info */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Sinkronisasi 2 Arah Otomatis Aktif</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Data ditarik otomatis tiap aplikasi dibuka, pindah tab, dan berkala tiap 30 detik. Pasang URL Webhook yang sama di laptop dan HP agar transaksi tersinkron di kedua perangkat.
              </p>
            </div>

            {/* Offline Queue info */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Antrean Tertunda:
                </span>{' '}
                <span className={`font-bold ${isPinkTheme ? 'text-pink-600' : 'text-teal-600'}`}>{queueCount} transaksi</span>
              </div>
              <button
                type="button"
                disabled={queueCount === 0}
                onClick={async () => {
                  const flushed = await flushSheetQueue();
                  setQueueCount(getQueue().length);
                  if (flushed > 0) {
                    showToast(`${flushed} transaksi disinkronkan`);
                  } else {
                    showToast('Gagal sinkron atau antrean kosong');
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition active:scale-95 disabled:opacity-40 ${
                  isPinkTheme
                    ? 'bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 hover:bg-pink-100'
                    : 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 hover:bg-teal-100'
                }`}
              >
                <RefreshCw className="w-3 h-3" />
                <span>Kirim Antrean</span>
              </button>
            </div>
          </div>

          {/* Setup Guide Card */}
          <div className="bg-white dark:bg-[#151E2E] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                Panduan Setup 1 Menit
              </h4>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
                  setIsCopiedCode(true);
                  showToast('Kode skrip disalin ke clipboard');
                  setTimeout(() => setIsCopiedCode(false), 2000);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] transition active:scale-95 ${secondaryBtn}`}
              >
                {isCopiedCode ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{isCopiedCode ? 'Tersalin' : 'Salin Kode Skrip'}</span>
              </button>
            </div>

            <ol className="list-decimal pl-4 space-y-1.5 text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
              <li>Buat file Spreadsheet baru di Google Drive Anda.</li>
              <li>Buka menu <b>Extensions (Ekstensi) &gt; Apps Script</b>.</li>
              <li>Hapus semua teks yang ada, tempel <b>Kode Skrip</b> yang sudah disalin di atas, lalu klik <b>Simpan</b>.</li>
              <li>Klik tombol biru <b>Deploy &gt; New deployment</b>, pilih jenis <b>Web app</b>.</li>
              <li>Atur <i>Who has access (Akses)</i> menjadi <b>Anyone (Siapa saja)</b>, lalu klik <b>Deploy</b>.</li>
              <li>Salin <b>Web app URL</b> yang muncul dan tempel ke kolom di atas. Selesai!</li>
            </ol>
          </div>
        </div>
      )}

      {/* Modal Penyesuaian Saldo (FR-30) */}
      {adjustAccId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={modalCard}>
            <h3 className={`font-bold text-sm ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
              Sesuaikan Saldo Nyata
            </h3>
            <p className="text-xs text-slate-400">
              Sistem akan membuat transaksi koreksi otomatis untuk menyelaraskan saldo fisik.
            </p>
            <input
              type="number"
              inputMode="numeric"
              value={newBalanceInput || ''}
              placeholder="0"
              onChange={e => setNewBalanceInput(Math.max(0, Number(e.target.value)))}
              className={`${fieldClass} text-sm font-bold tabular-nums`}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setAdjustAccId(null)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold ${secondaryBtn}`}
              >
                Batal
              </button>
              <button
                onClick={() => {
                  adjustAccountBalance(adjustAccId, newBalanceInput);
                  setAdjustAccId(null);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition active:scale-[0.98] ${primaryBtn}`}
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
          <div className={modalCard}>
            <h3 className={`font-bold text-sm ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
              Tambah Dompet Baru
            </h3>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className={labelClass}>Nama Dompet</label>
                <input
                  type="text"
                  value={newWalletName}
                  onChange={e => setNewWalletName(e.target.value)}
                  placeholder="Mis. Mandiri Tabungan"
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Jenis</label>
                <select
                  value={newWalletType}
                  onChange={e => setNewWalletType(e.target.value as any)}
                  className={`${fieldClass} font-semibold`}
                >
                  <option value="bank">Rekening Bank</option>
                  <option value="ewallet">E-Wallet</option>
                  <option value="cash">Uang Tunai</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Saldo Awal (Rp)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={newWalletBalance || ''}
                  placeholder="0"
                  onChange={e => setNewWalletBalance(Math.max(0, Number(e.target.value)))}
                  className={`${fieldClass} font-bold tabular-nums`}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setIsAddWalletOpen(false)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold ${secondaryBtn}`}
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
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition active:scale-[0.98] ${primaryBtn}`}
              >
                Tambah
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hapus Dompet */}
      {deletingWallet && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-wallet-title"
            className={modalCard}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="delete-wallet-title"
                  className={`font-bold text-sm ${
                    isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'
                  }`}
                >
                  Hapus Dompet?
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Transaksi dan saldo tidak akan hilang.
                </p>
              </div>
              <button
                onClick={() => setDeletingWallet(null)}
                aria-label="Tutup"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className={`rounded-xl border p-3 text-xs space-y-1.5 ${
                isPinkTheme
                  ? 'bg-white border-pink-200/70 text-[#4C1D2E]'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Dompet</span>
                <span className="font-bold text-right truncate">{deletingWallet.name}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Saldo saat ini</span>
                <span className="font-bold tabular-nums">
                  {formatIDR(getAccountBalance(deletingWallet.id))}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Transaksi terkait</span>
                <span className="font-bold tabular-nums">
                  {
                    transactions.filter(
                      t =>
                        t.account_id === deletingWallet.id ||
                        t.to_account_id === deletingWallet.id
                    ).length
                  }
                </span>
              </div>
            </div>

            <div>
              <label className={labelClass}>Pindahkan ke Dompet</label>
              <select
                value={reassignWalletId}
                onChange={e => setReassignWalletId(e.target.value)}
                className={`${fieldClass} font-semibold`}
              >
                {accounts
                  .filter(a => a.id !== deletingWallet.id)
                  .map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              Semua transaksi, langganan, dan target tabungan yang memakai dompet ini akan
              dialihkan. Saldo dompet ini ikut dipindahkan ke dompet tujuan.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setDeletingWallet(null)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${secondaryBtn}`}
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteWallet}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition active:scale-[0.98]"
              >
                Hapus Dompet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Transfer Antar Dompet */}
      {isTransferOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={modalCard}>
            <h3 className={`font-bold text-sm ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
              Transfer Antar Dompet
            </h3>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className={labelClass}>Dari Dompet Asal</label>
                <select
                  value={fromAcc}
                  onChange={e => setFromAcc(e.target.value)}
                  className={`${fieldClass} font-semibold`}
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCompactIDR(getAccountBalance(a.id))})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Ke Dompet Tujuan</label>
                <select
                  value={toAcc}
                  onChange={e => setToAcc(e.target.value)}
                  className={`${fieldClass} font-semibold`}
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
                <label className={labelClass}>Nominal (Rp)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={transferAmount || ''}
                  placeholder="0"
                  onChange={e => setTransferAmount(Math.max(0, Number(e.target.value)))}
                  className={`${fieldClass} font-bold tabular-nums`}
                />
              </div>

              <div>
                <label className={labelClass}>Biaya Admin (Opsional)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={transferFee || ''}
                  onChange={e => setTransferFee(Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                  className={`${fieldClass} tabular-nums`}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setIsTransferOpen(false)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold ${secondaryBtn}`}
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
          <div className={modalCard}>
            <h3 className={`font-bold text-sm ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
              Tambah Kategori Baru
            </h3>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className={labelClass}>Nama Kategori</label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="Mis. Skincare, Zakat"
                  className={fieldClass}
                />
              </div>

              <div>
                <label className={labelClass}>Jenis Kategori</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCatKind('expense')}
                    aria-pressed={newCatKind === 'expense'}
                    className={`flex-1 py-2 rounded-xl font-bold transition ${
                      newCatKind === 'expense'
                        ? 'bg-rose-500 text-white'
                        : segmentIdle
                    }`}
                  >
                    Pengeluaran
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCatKind('income')}
                    aria-pressed={newCatKind === 'income'}
                    className={`flex-1 py-2 rounded-xl font-bold transition ${
                      newCatKind === 'income'
                        ? 'bg-emerald-600 text-white'
                        : segmentIdle
                    }`}
                  >
                    Pemasukan
                  </button>
                </div>
              </div>

              <div>
                <label className={labelClass}>Pilih Warna</label>
                <div className="flex gap-2">
                  {['#FB7185', '#F472B6', '#FDA4AF', '#FB923C', '#C084FC', '#10B981'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCatColor(color)}
                      aria-label={`Pilih warna ${color}`}
                      aria-pressed={newCatColor === color}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        newCatColor === color
                          ? `scale-125 ring-2 ${isPinkTheme ? 'ring-pink-400' : 'ring-slate-400'}`
                          : ''
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
                className={`flex-1 py-2 rounded-xl text-xs font-bold ${secondaryBtn}`}
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (!newCatName.trim()) return;
                  addCategory({
                    name: newCatName.trim(),
                    kind: newCatKind,
                    icon: newCatKind === 'expense' ? 'Heart' : 'Gift',
                    color: newCatColor,
                  });
                  setNewCatName('');
                  setIsAddCatOpen(false);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition active:scale-[0.98] ${primaryBtn}`}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Kategori */}
      {editingCat && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={modalCard}>
            <div className="flex items-center justify-between">
              <h3 className={`font-bold text-sm ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
                Ubah Kategori
              </h3>
              <button
                onClick={() => setEditingCat(null)}
                aria-label="Tutup"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className={labelClass}>Nama Kategori</label>
                <input
                  type="text"
                  value={editCatName}
                  onChange={e => setEditCatName(e.target.value)}
                  className={fieldClass}
                />
              </div>

              <div>
                <label className={labelClass}>Jenis Kategori</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditCatKind('expense')}
                    aria-pressed={editCatKind === 'expense'}
                    className={`flex-1 py-2 rounded-xl font-bold transition ${
                      editCatKind === 'expense'
                        ? 'bg-rose-500 text-white'
                        : segmentIdle
                    }`}
                  >
                    Pengeluaran
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditCatKind('income')}
                    aria-pressed={editCatKind === 'income'}
                    className={`flex-1 py-2 rounded-xl font-bold transition ${
                      editCatKind === 'income'
                        ? 'bg-emerald-600 text-white'
                        : segmentIdle
                    }`}
                  >
                    Pemasukan
                  </button>
                </div>
              </div>

              <div>
                <label className={labelClass}>Pilih Warna</label>
                <div className="flex gap-2">
                  {['#FB7185', '#F472B6', '#FDA4AF', '#FB923C', '#C084FC', '#10B981'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditCatColor(color)}
                      aria-label={`Pilih warna ${color}`}
                      aria-pressed={editCatColor === color}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        editCatColor === color
                          ? `scale-125 ring-2 ${isPinkTheme ? 'ring-pink-400' : 'ring-slate-400'}`
                          : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditingCat(null)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold ${secondaryBtn}`}
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (!editCatName.trim()) return;
                  updateCategory(editingCat.id, {
                    name: editCatName.trim(),
                    kind: editCatKind,
                    color: editCatColor,
                  });
                  setEditingCat(null);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition active:scale-[0.98] ${primaryBtn}`}
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cetak PDF */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`rounded-2xl p-5 max-w-md w-full space-y-3.5 shadow-2xl max-h-[85vh] overflow-y-auto animate-scale-up border ${
            isPinkTheme
              ? 'bg-[#FFF5F7] border-pink-200 text-[#37131D]'
              : 'bg-white dark:bg-[#151E2E] border-slate-200 dark:border-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b pb-2.5 border-slate-200 dark:border-slate-800">
              <div>
                <h3 className={`font-bold text-sm ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
                  Ringkasan Laporan Keuangan
                </h3>
                <span className="text-[11px] text-slate-400">
                  {reportPeriodLabel} • Format ringkas siap cetak atau simpan PDF
                </span>
              </div>
              <button
                onClick={() => setIsPdfModalOpen(false)}
                aria-label="Tutup"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`space-y-3 text-xs ${isPinkTheme ? 'text-[#4C1D2E]' : 'text-slate-700 dark:text-slate-300'}`}>
              <div className={`p-3 rounded-xl space-y-1.5 border ${
                isPinkTheme
                  ? 'bg-white border-pink-200/70'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-800'
              }`}>
                <div className="flex justify-between">
                  <span>Total Pemasukan:</span>
                  <span className="font-bold text-emerald-600 tabular-nums">{formatIDR(reportSummary.income)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Pengeluaran:</span>
                  <span className="font-bold text-rose-600 tabular-nums">{formatIDR(reportSummary.expense)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold">
                  <span>Arus Bersih:</span>
                  <span className="tabular-nums">{formatIDR(reportSummary.balance)}</span>
                </div>
              </div>

              <div>
                <span className="font-bold block mb-1">Rincian Pengeluaran Teratas:</span>
                <div className="space-y-1">
                  {reportSummary.slices.length === 0 ? (
                    <div className="text-slate-400 py-1">Belum ada pengeluaran pada periode ini.</div>
                  ) : (
                    reportSummary.slices.slice(0, 5).map(c => (
                      <div
                        key={c.id}
                        className="flex justify-between gap-2 py-1 border-b border-slate-100 dark:border-slate-800"
                      >
                        <span className="min-w-0 truncate">
                          {c.name} ({Math.round(c.percent)}%)
                        </span>
                        <span className="font-semibold tabular-nums shrink-0">
                          {formatIDR(c.amount)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold ${secondaryBtn}`}
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
