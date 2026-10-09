import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { formatIDR, formatCompactIDR } from '../../utils/formatters';
import { AppIcon } from '../common/IconHelper';
import {
  parseVoiceInput,
  parseOCRText,
  parseQRISCode,
  detectDuplicate,
  guessCategory,
  DEFAULT_TEMPLATES,
  ParsedItem,
} from '../../utils/parser';
import {
  X,
  Mic,
  Camera,
  QrCode,
  Edit3,
  Check,
  AlertCircle,
  Sparkles,
  UploadCloud,
  Layers,
  Trash2,
} from 'lucide-react';
import { TxnType } from '../../types/index.ts';

export const CatatModal: React.FC = () => {
  const {
    isCatatOpen,
    closeCatat,
    catatInitialMode,
    accounts,
    categories,
    transactions,
    addTransaction,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'manual' | 'voice' | 'ocr' | 'screenshot' | 'qr'>(
    catatInitialMode
  );

  useEffect(() => {
    setActiveTab(catatInitialMode);
  }, [catatInitialMode]);

  // Form State
  const [txnType, setTxnType] = useState<TxnType>('expense');
  const [amountStr, setAmountStr] = useState<string>('0');
  const [selectedCategory, setSelectedCategory] = useState<string>('cat-makan');
  const [selectedAccount, setSelectedAccount] = useState<string>('acc-bca');
  const [toAccount, setToAccount] = useState<string>('acc-gopay');
  const [merchant, setMerchant] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [adminFee, setAdminFee] = useState<number>(0);

  // Voice State
  const [isRecording, setIsRecording] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceParsedItems, setVoiceParsedItems] = useState<ParsedItem[]>([]);

  // OCR State
  const [ocrSampleText, setOcrSampleText] = useState('');
  const [ocrParsedResult, setOcrParsedResult] = useState<ParsedItem | null>(null);

  // QRIS State
  const [qrisData, setQrisData] = useState<{ merchant: string; nmid?: string; city?: string; amount?: number } | null>(
    null
  );

  // Reset form when modal opens
  useEffect(() => {
    if (isCatatOpen) {
      setAmountStr('0');
      setMerchant('');
      setNote('');
      setAdminFee(0);
      setVoiceText('');
      setVoiceParsedItems([]);
      setOcrParsedResult(null);
      setQrisData(null);
    }
  }, [isCatatOpen]);

  if (!isCatatOpen) return null;

  const currentAmount = parseInt(amountStr.replace(/\D/g, ''), 10) || 0;

  // Keypad Handlers (FR-2: custom keypad with '000' and 'rb')
  const handleKeypadPress = (val: string) => {
    if (val === 'C') {
      setAmountStr('0');
      return;
    }
    if (val === 'backspace') {
      const next = amountStr.slice(0, -1);
      setAmountStr(next.length ? next : '0');
      return;
    }
    if (val === 'rb') {
      const num = parseInt(amountStr, 10) || 0;
      if (num > 0) setAmountStr((num * 1000).toString());
      return;
    }
    if (val === '000') {
      if (amountStr !== '0') setAmountStr(amountStr + '000');
      return;
    }

    if (amountStr === '0') {
      setAmountStr(val);
    } else {
      if (amountStr.length < 11) {
        setAmountStr(amountStr + val);
      }
    }
  };

  const handleMerchantChange = (text: string) => {
    setMerchant(text);
    const guessed = guessCategory(text);
    if (guessed && guessed !== 'cat-lainnya') {
      setSelectedCategory(guessed);
    }
  };

  // Duplicate Check
  const duplicateWarning = detectDuplicate(
    {
      amount: currentAmount,
      account_id: selectedAccount,
      merchant,
      occurred_at: Date.now(),
    },
    transactions
  );

  // Save manual transaction
  const handleSaveManual = (addAnother = false) => {
    if (currentAmount <= 0) {
      showToast('Masukkan nominal transaksi');
      return;
    }

    addTransaction({
      type: txnType,
      amount: currentAmount,
      category_id: txnType === 'transfer' ? undefined : selectedCategory,
      account_id: selectedAccount,
      to_account_id: txnType === 'transfer' ? toAccount : undefined,
      merchant: merchant.trim() || undefined,
      note: note.trim() || undefined,
      admin_fee: txnType === 'transfer' && adminFee > 0 ? adminFee : undefined,
      source: 'manual',
      status: 'confirmed',
    });

    if (addAnother) {
      setAmountStr('0');
      setMerchant('');
      setNote('');
    } else {
      closeCatat();
    }
  };

  // Voice Simulation & Speech Recognition
  const triggerVoiceParse = (text: string) => {
    setVoiceText(text);
    const parsed = parseVoiceInput(text);
    setVoiceParsedItems(parsed);
  };

  const handleStartVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'id-ID';
        recognition.interimResults = false;
        setIsRecording(true);

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setIsRecording(false);
          triggerVoiceParse(transcript);
        };

        recognition.onerror = () => {
          setIsRecording(false);
          triggerVoiceParse('Makan siang soto 35 ribu pakai GoPay');
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognition.start();
        return;
      } catch {
        // Fallback below
      }
    }

    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      triggerVoiceParse('Makan siang soto 35 ribu pakai GoPay');
    }, 1200);
  };

  const handleSaveVoiceItems = (asDraft = false) => {
    if (voiceParsedItems.length === 0) return;
    for (const item of voiceParsedItems) {
      addTransaction({
        type: item.type,
        amount: item.amount,
        category_id: item.category_id,
        account_id: item.account_id || selectedAccount,
        merchant: item.merchant,
        note: item.note,
        source: 'voice',
        confidence: item.confidence,
        status: asDraft ? 'draft' : 'confirmed',
        raw_source_text: item.raw_source_text,
      });
    }
    closeCatat();
  };

  const handleSelectOCRSample = (sampleType: 'bca' | 'indomaret' | 'gopay') => {
    let sample = '';
    if (sampleType === 'bca') {
      sample =
        'TRANSFER BERHASIL\n08 OKT 2026 14:32:10\nKe: Budi Santoso\nNominal: Rp 1.250.000\nNo. Ref: 771283921\nBCA Mobile';
    } else if (sampleType === 'indomaret') {
      sample =
        'INDOMARET POINT SUDIRMAN\nJL JEND SUDIRMAN NO 45\n08/10/2026 11:20\n1x Roti Tawar Rp 18.000\n1x Susu Kotak Rp 20.500\nTOTAL: Rp 38.500\nREF: IND-88192';
    } else {
      sample =
        'PEMBAYARAN QRIS BERHASIL\nKopi Kenangan Senayan\nRp 32.000\n08 Okt 2026 09:15\nGoPay Saldo\nID: GP-992384';
    }
    setOcrSampleText(sample);
    const result = parseOCRText(sample);
    setOcrParsedResult(result);
  };

  const handleSaveOCR = (asDraft = false) => {
    if (!ocrParsedResult) return;
    addTransaction({
      type: ocrParsedResult.type,
      amount: ocrParsedResult.amount,
      category_id: ocrParsedResult.category_id,
      account_id: ocrParsedResult.account_id,
      merchant: ocrParsedResult.merchant,
      external_ref: ocrParsedResult.external_ref,
      note: ocrParsedResult.note,
      source: 'ocr',
      confidence: ocrParsedResult.confidence,
      status: asDraft ? 'draft' : 'confirmed',
      raw_source_text: ocrParsedResult.raw_source_text,
      items: ocrParsedResult.items,
    });
    closeCatat();
  };

  const handleSaveOCRSplit = (asDraft = false) => {
    if (!ocrParsedResult) return;
    if (ocrParsedResult.items && ocrParsedResult.items.length > 0) {
      for (const item of ocrParsedResult.items) {
        addTransaction({
          type: 'expense',
          amount: item.total,
          category_id: item.category_id || ocrParsedResult.category_id,
          account_id: ocrParsedResult.account_id || selectedAccount,
          merchant: ocrParsedResult.merchant,
          external_ref: ocrParsedResult.external_ref,
          note: `${item.name} (${ocrParsedResult.merchant})`,
          source: 'ocr',
          confidence: ocrParsedResult.confidence,
          status: asDraft ? 'draft' : 'confirmed',
          raw_source_text: ocrParsedResult.raw_source_text,
        });
      }
      closeCatat();
    } else {
      handleSaveOCR(asDraft);
    }
  };

  const handleSimulateScanQR = () => {
    const qris = parseQRISCode('00020101021226610014ID.LINKAJA.WWW0118936009110023451000201');
    setQrisData(qris);
  };

  const handleSaveQRIS = () => {
    if (!qrisData) return;
    addTransaction({
      type: 'expense',
      amount: qrisData.amount || 28000,
      category_id: 'cat-makan',
      account_id: 'acc-gopay',
      merchant: qrisData.merchant,
      note: `QRIS NMID: ${qrisData.nmid || '-'} (${qrisData.city || 'ID'})`,
      source: 'qr',
      confidence: 0.99,
      status: 'confirmed',
    });
    closeCatat();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end justify-center">
      <div className="bg-white dark:bg-[#111827] w-full max-w-md rounded-t-[28px] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-slide-up border-t border-slate-200 dark:border-slate-800">
        {/* Grab bar & Header */}
        <div className="pt-3 px-5 pb-2 shrink-0 border-b border-slate-100 dark:border-slate-800/80">
          <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3"></div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Catat Transaksi
            </h2>
            <button
              onClick={closeCatat}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Segmented Control 4 Mode Tabs (Apple iOS style) */}
          <div className="grid grid-cols-4 gap-1 mt-3 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('manual')}
              className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                activeTab === 'manual'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Ketik</span>
            </button>
            <button
              onClick={() => setActiveTab('voice')}
              className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                activeTab === 'voice'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Suara</span>
            </button>
            <button
              onClick={() => setActiveTab('ocr')}
              className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                activeTab === 'ocr' || activeTab === 'screenshot'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Nota</span>
            </button>
            <button
              onClick={() => setActiveTab('qr')}
              className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                activeTab === 'qr'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QRIS</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* ===================== MODE 1: FORM KETIK MANUAL ===================== */}
          {activeTab === 'manual' && (
            <div className="space-y-3.5">
              {/* Type Switcher */}
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setTxnType('expense')}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    txnType === 'expense'
                      ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  Uang Keluar
                </button>
                <button
                  onClick={() => setTxnType('income')}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    txnType === 'income'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  Uang Masuk
                </button>
                <button
                  onClick={() => setTxnType('transfer')}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    txnType === 'transfer'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  Transfer
                </button>
              </div>

              {/* Amount Display */}
              <div className="text-center py-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Nominal Transaksi (IDR)
                </span>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums mt-0.5">
                  {formatIDR(currentAmount)}
                </div>
              </div>

              {/* Template Transaksi 1 Ketuk (FR-4) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Pintasan Cepat (≤ 5 Detik)
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-600">1 Ketuk</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {DEFAULT_TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setAmountStr(t.amount.toString());
                        setSelectedCategory(t.category_id);
                        setSelectedAccount(t.account_id);
                        setMerchant(t.merchant || t.name);
                        setNote(t.name);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium shrink-0 hover:border-emerald-500 transition active:scale-95 flex items-center gap-1.5 shadow-2xs"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span>{t.name}</span>
                      <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                        {formatCompactIDR(t.amount)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duplicate Alert */}
              {duplicateWarning.isDuplicate && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Mungkin Duplikat:</span>{' '}
                    {duplicateWarning.reason}
                  </div>
                </div>
              )}

              {/* Fields: Category & Account */}
              {txnType === 'transfer' ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Dari Dompet</label>
                    <select
                      value={selectedAccount}
                      onChange={e => setSelectedAccount(e.target.value)}
                      className="w-full p-2 bg-slate-100 dark:bg-slate-800 rounded-lg font-semibold outline-none border border-slate-200/60 dark:border-slate-700"
                    >
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Ke Dompet</label>
                    <select
                      value={toAccount}
                      onChange={e => setToAccount(e.target.value)}
                      className="w-full p-2 bg-slate-100 dark:bg-slate-800 rounded-lg font-semibold outline-none border border-slate-200/60 dark:border-slate-700"
                    >
                      {accounts
                        .filter(a => a.id !== selectedAccount)
                        .map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              ) : (
                <>
                  {/* Category Chips */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                      Kategori
                    </label>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                      {categories
                        .filter(c => (txnType === 'income' ? c.kind === 'income' : c.kind === 'expense'))
                        .map(c => (
                          <button
                            key={c.id}
                            onClick={() => setSelectedCategory(c.id)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium shrink-0 transition ${
                              selectedCategory === c.id
                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: c.color }}
                            ></span>
                            <span>{c.name}</span>
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* Account Chips */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">
                      Dompet
                    </label>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                      {accounts.map(a => (
                        <button
                          key={a.id}
                          onClick={() => setSelectedAccount(a.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium shrink-0 transition ${
                            selectedAccount === a.id
                              ? 'bg-emerald-600 text-white font-bold shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <AppIcon name={a.icon} className="w-3 h-3" />
                          <span>{a.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toko / Note */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <input
                        type="text"
                        value={merchant}
                        onChange={e => handleMerchantChange(e.target.value)}
                        placeholder="Toko / Merchant"
                        className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg outline-none border border-transparent focus:border-slate-300 dark:focus:border-slate-700 text-base sm:text-xs"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="Catatan (opsional)"
                        className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg outline-none border border-transparent focus:border-slate-300 dark:focus:border-slate-700 text-base sm:text-xs"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Tactile Keypad */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {['1', '2', '3', 'backspace', '4', '5', '6', 'rb', '7', '8', '9', '000', 'C', '0'].map(
                  key => {
                    return (
                      <button
                        key={key}
                        onClick={() => handleKeypadPress(key)}
                        className={`py-3 rounded-xl text-base font-bold transition active:scale-95 tabular-nums ${
                          key === 'backspace'
                            ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                            : key === 'rb' || key === '000'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-extrabold border border-emerald-200/50 dark:border-emerald-800/50'
                            : key === 'C'
                            ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            : 'bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700/80'
                        }`}
                      >
                        {key === 'backspace' ? '⌫' : key}
                      </button>
                    );
                  }
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1 pb-safe-bottom">
                <button
                  onClick={() => handleSaveManual(true)}
                  className="px-3.5 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 transition active:scale-95 min-h-[44px]"
                >
                  + Tambah Lagi
                </button>
                <button
                  onClick={() => handleSaveManual(false)}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5 min-h-[44px]"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Simpan Transaksi</span>
                </button>
              </div>
            </div>
          )}

          {/* ===================== MODE 2: VOICE (FR-6 to FR-11) ===================== */}
          {activeTab === 'voice' && (
            <div className="space-y-4 text-center py-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ucapkan transaksi dalam Bahasa Indonesia. Sistem on-device memproses secara instan.
              </p>

              {/* Mic Button */}
              <div className="py-2">
                <button
                  onClick={handleStartVoice}
                  className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center transition shadow-md ${
                    isRecording
                      ? 'bg-rose-500 text-white animate-pulse ring-4 ring-rose-500/20'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 ring-4 ring-emerald-500/10'
                  }`}
                >
                  <Mic className="w-7 h-7" />
                </button>
                <div className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isRecording ? 'Mendengarkan...' : 'Ketuk untuk Bicara'}
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="text-left space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase">
                  Contoh Percakapan (1 Ketuk):
                </span>
                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  <button
                    onClick={() => triggerVoiceParse('Makan siang 35 ribu pakai GoPay')}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-left hover:border-emerald-500 border border-slate-200/60 dark:border-slate-700 flex items-center justify-between transition"
                  >
                    <span>"Makan siang 35 ribu pakai GoPay"</span>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  </button>
                  <button
                    onClick={() =>
                      triggerVoiceParse('Beli bensin 50 ribu terus makan siang 30 ribu')
                    }
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-left hover:border-emerald-500 border border-slate-200/60 dark:border-slate-700 flex items-center justify-between transition"
                  >
                    <span>"Beli bensin 50 ribu terus makan siang 30 ribu" (Multi)</span>
                    <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  </button>
                </div>
              </div>

              {/* Parsed Results */}
              {voiceParsedItems.length > 0 && (
                <div className="space-y-2 pt-2 text-left">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                    <span>Hasil Ekstraksi ({voiceParsedItems.length} Transaksi)</span>
                    <span className="text-emerald-600 text-[11px]">On-device NLP</span>
                  </div>

                  {voiceParsedItems.map((item, idx) => {
                    const cat = categories.find(c => c.id === item.category_id);
                    return (
                      <div
                        key={idx}
                        className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {item.merchant || 'Pengeluaran'}
                          </span>
                          <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                            {formatIDR(item.amount)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-medium text-[11px]">
                            {cat?.name || 'Makan'}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            Keyakinan: {Math.round(item.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex gap-2 pt-2 pb-safe-bottom">
                    <button
                      onClick={() => handleSaveVoiceItems(true)}
                      className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold min-h-[44px] active:scale-95 transition"
                    >
                      Simpan sbg Draft
                    </button>
                    <button
                      onClick={() => handleSaveVoiceItems(false)}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-xs font-bold min-h-[44px] active:scale-95 transition shadow-sm"
                    >
                      Konfirmasi Simpan
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===================== MODE 3: OCR & RECEIPT (FR-12 to FR-18) ===================== */}
          {(activeTab === 'ocr' || activeTab === 'screenshot') && (
            <div className="space-y-3.5">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pindai struk belanja atau bukti transfer bank/e-wallet via OCR on-device.
              </p>

              {/* Sample Document Selectors */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase">
                  Contoh Dokumen:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleSelectOCRSample('indomaret')}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold text-center hover:border-emerald-500 transition"
                  >
                    Struk Indomaret
                  </button>
                  <button
                    onClick={() => handleSelectOCRSample('bca')}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold text-center hover:border-emerald-500 transition"
                  >
                    Transfer BCA
                  </button>
                  <button
                    onClick={() => handleSelectOCRSample('gopay')}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold text-center hover:border-emerald-500 transition"
                  >
                    Bukti QRIS
                  </button>
                </div>
              </div>

              {/* Dropzone */}
              <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-center space-y-2">
                <UploadCloud className="w-7 h-7 mx-auto text-slate-400" />
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Ambil Foto Nota atau Unggah Bukti
                </div>
                <p className="text-[11px] text-slate-400">
                  100% diproses di perangkat tanpa keluar jaringan.
                </p>
              </div>

              {/* OCR Result Card (Structured Paper Style) */}
              {ocrParsedResult && (
                <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b pb-2 border-slate-200/80 dark:border-slate-700">
                    <span className="font-bold text-slate-600 dark:text-slate-300">Hasil Parser Dokumen</span>
                    <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md text-[10px]">
                      Akurasi: {Math.round(ocrParsedResult.confidence * 100)}%
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Penerima/Merchant:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {ocrParsedResult.merchant}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Nominal:</span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                        {formatIDR(ocrParsedResult.amount)}
                      </span>
                    </div>
                    {ocrParsedResult.external_ref && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">No. Referensi:</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {ocrParsedResult.external_ref}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Rincian Item Struk */}
                  {ocrParsedResult.items && ocrParsedResult.items.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          Item Struk ({ocrParsedResult.items.length})
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold">Pecah Item (FR-16)</span>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                        {ocrParsedResult.items.map(item => (
                          <div key={item.id} className="flex justify-between items-center text-[11px]">
                            <span className="truncate pr-2 text-slate-800 dark:text-slate-200">
                              {item.name}
                            </span>
                            <span className="font-bold tabular-nums text-slate-900 dark:text-white shrink-0">
                              {formatIDR(item.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1 pb-safe-bottom">
                    <button
                      onClick={() => handleSaveOCR(true)}
                      className="px-3.5 py-3 rounded-xl bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold min-h-[44px] active:scale-95 transition"
                    >
                      Draft
                    </button>
                    <button
                      onClick={() => handleSaveOCR(false)}
                      className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold min-h-[44px] active:scale-95 transition"
                    >
                      Simpan Total
                    </button>
                    {ocrParsedResult.items && ocrParsedResult.items.length > 0 && (
                      <button
                        onClick={() => handleSaveOCRSplit(false)}
                        className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold min-h-[44px] active:scale-95 transition shadow-sm"
                      >
                        Pecah Kategori
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===================== MODE 4: QRIS (FR-19 to FR-21) ===================== */}
          {activeTab === 'qr' && (
            <div className="space-y-4 text-center py-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pindai QRIS merchant untuk mengambil nama toko dan NMID secara otomatis.
              </p>

              {/* Viewfinder Overlay Simulation */}
              <div className="relative w-44 h-44 mx-auto bg-slate-900 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-700 shadow-inner">
                <div className="absolute inset-4 border border-dashed border-white/40 rounded-xl flex items-center justify-center">
                  <div className="w-full h-0.5 bg-emerald-400 animate-pulse"></div>
                </div>
                <QrCode className="w-14 h-14 text-white/30" />
              </div>

              <button
                onClick={handleSimulateScanQR}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 min-h-[44px]"
              >
                Simulasi Pindai QRIS Kopi Kenangan
              </button>

              {qrisData && (
                <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-left space-y-2 text-xs">
                  <div className="font-bold text-slate-900 dark:text-white text-sm">
                    {qrisData.merchant}
                  </div>
                  <div className="text-slate-500">
                    NMID: <span className="font-mono text-slate-800 dark:text-slate-200">{qrisData.nmid}</span> • Kota: {qrisData.city}
                  </div>
                  {qrisData.amount && (
                    <div className="font-bold text-slate-900 dark:text-white text-sm tabular-nums">
                      Nominal: {formatIDR(qrisData.amount)}
                    </div>
                  )}

                  <div className="pt-1 pb-safe-bottom">
                    <button
                      onClick={handleSaveQRIS}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl min-h-[44px] active:scale-95 transition shadow-sm"
                    >
                      Konfirmasi Simpan
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
