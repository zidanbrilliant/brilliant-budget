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
    settings,
  } = useApp();

  const isPinkTheme = settings.theme === 'pink';

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
  const [customVoiceInput, setCustomVoiceInput] = useState<string>('');

  // OCR State
  const [ocrSampleText, setOcrSampleText] = useState('');
  const [ocrEditText, setOcrEditText] = useState('');
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [ocrParsedResult, setOcrParsedResult] = useState<ParsedItem | null>(null);

  // QRIS State
  const [qrisCustomInput, setQrisCustomInput] = useState('');
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
      setCustomVoiceInput('');
      setOcrSampleText('');
      setOcrEditText('');
      setUploadedImageUrl(null);
      setOcrParsedResult(null);
      setQrisCustomInput('');
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
          setCustomVoiceInput(transcript);
          triggerVoiceParse(transcript);
        };

        recognition.onerror = () => {
          setIsRecording(false);
          const el = document.getElementById('custom-voice-input');
          el?.focus();
          showToast('Gunakan ikon mic 🎤 di keyboard iPhone untuk dikte suara');
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

    // iOS WKWebView fallback: Focus input so iPhone keyboard opens with native dictation mic button
    const el = document.getElementById('custom-voice-input');
    el?.focus();
    showToast('Ketuk ikon mic 🎤 pada keyboard iPhone untuk dikte suara');
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
    setUploadedImageUrl(null);
    setOcrSampleText(sample);
    setOcrEditText(sample);
    const result = parseOCRText(sample);
    setOcrParsedResult(result);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setUploadedImageUrl(url);

    const filename = file.name.toLowerCase();
    let sample = '';
    if (filename.includes('bca') || filename.includes('transfer') || filename.includes('tf')) {
      sample = 'TRANSFER BERHASIL\n09 OKT 2026 14:32\nKe: Budi Santoso\nNominal: Rp 750.000\nNo. Ref: 88192301\nm-BCA';
    } else if (filename.includes('gopay') || filename.includes('qris')) {
      sample = 'PEMBAYARAN QRIS BERHASIL\nKopi Kenangan Senayan\nRp 35.000\n09 Okt 2026 10:15\nGoPay Saldo\nID: GP-882391';
    } else {
      sample = `STRUK BELANJA\n${file.name.replace(/\.[^/.]+$/, '').toUpperCase()}\n09/10/2026 11:20\n1x Belanja Barang Rp 48.000\nTOTAL: Rp 48.000\nREF: STRUK-${Date.now().toString().slice(-6)}`;
    }
    setOcrSampleText(sample);
    setOcrEditText(sample);
    const result = parseOCRText(sample);
    setOcrParsedResult(result);
    showToast('Foto struk berhasil dimuat');
  };

  const handleOcrTextChange = (text: string) => {
    setOcrEditText(text);
    const result = parseOCRText(text);
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
      raw_source_text: ocrEditText || ocrParsedResult.raw_source_text,
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
          raw_source_text: ocrEditText || ocrParsedResult.raw_source_text,
        });
      }
      closeCatat();
    } else {
      handleSaveOCR(asDraft);
    }
  };

  const handleProcessQrisPayload = (raw: string) => {
    const qris = parseQRISCode(raw || '00020101021226610014ID.LINKAJA.WWW0118936009110023451000201');
    setQrisData(qris);
    showToast('Kode QRIS berhasil didekode');
  };

  const handleQrisFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setUploadedImageUrl(url);
    handleProcessQrisPayload('00020101021226610014ID.LINKAJA.WWW0118936009110023451000201');
  };

  const handleSimulateScanQR = () => {
    handleProcessQrisPayload('00020101021226610014ID.LINKAJA.WWW0118936009110023451000201');
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
      <div className={`${isPinkTheme ? 'bg-[#FFF5F7] border-pink-200 text-[#37131D]' : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800'} w-full max-w-md rounded-t-[28px] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-slide-up border-t`}>
        {/* Grab bar & Header */}
        <div className={`pt-3 px-5 pb-2 shrink-0 border-b ${isPinkTheme ? 'border-pink-200/60' : 'border-slate-100 dark:border-slate-800/80'}`}>
          <div className={`w-10 h-1 ${isPinkTheme ? 'bg-pink-300' : 'bg-slate-300 dark:bg-slate-700'} rounded-full mx-auto mb-3`}></div>
          <div className="flex items-center justify-between">
            <h2 className={`text-sm font-bold tracking-tight ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
              {isPinkTheme ? 'Catat Pengeluaran Lucu 🎀' : 'Catat Transaksi'}
            </h2>
            <button
              onClick={closeCatat}
              className={`p-1.5 rounded-full ${isPinkTheme ? 'text-pink-400 hover:text-pink-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Segmented Control 4 Mode Tabs (Apple iOS style) */}
          <div className={`grid grid-cols-4 gap-1 mt-3 p-1 ${isPinkTheme ? 'bg-pink-100/70' : 'bg-slate-100 dark:bg-slate-800'} rounded-xl text-xs font-semibold`}>
            <button
              onClick={() => setActiveTab('manual')}
              className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                activeTab === 'manual'
                  ? isPinkTheme ? 'bg-white text-rose-600 shadow-xs font-bold' : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : isPinkTheme ? 'text-pink-600/70 hover:text-pink-900' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Ketik</span>
            </button>
            <button
              onClick={() => setActiveTab('voice')}
              className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                activeTab === 'voice'
                  ? isPinkTheme ? 'bg-white text-rose-600 shadow-xs font-bold' : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : isPinkTheme ? 'text-pink-600/70 hover:text-pink-900' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Suara</span>
            </button>
            <button
              onClick={() => setActiveTab('ocr')}
              className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                activeTab === 'ocr' || activeTab === 'screenshot'
                  ? isPinkTheme ? 'bg-white text-rose-600 shadow-xs font-bold' : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : isPinkTheme ? 'text-pink-600/70 hover:text-pink-900' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Nota</span>
            </button>
            <button
              onClick={() => setActiveTab('qr')}
              className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                activeTab === 'qr'
                  ? isPinkTheme ? 'bg-white text-rose-600 shadow-xs font-bold' : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : isPinkTheme ? 'text-pink-600/70 hover:text-pink-900' : 'text-slate-500 hover:text-slate-800'
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
              <div className={`text-center py-2.5 rounded-2xl border ${isPinkTheme ? 'bg-white border-pink-200/80 shadow-pink-100/30' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800'}`}>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isPinkTheme ? 'text-pink-600/70' : 'text-slate-400'}`}>
                  Nominal Transaksi (IDR)
                </span>
                <div className={`text-3xl font-extrabold tracking-tight tabular-nums mt-0.5 ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
                  {formatIDR(currentAmount)}
                </div>
              </div>

              {/* Template Transaksi 1 Ketuk (FR-4) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${isPinkTheme ? 'text-pink-600/70' : 'text-slate-400'}`}>
                    Pintasan Cepat (≤ 5 Detik)
                  </span>
                  <span className={`text-[10px] font-bold ${isPinkTheme ? 'text-pink-600' : 'text-emerald-600'}`}>1 Ketuk ✨</span>
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
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold shrink-0 transition active:scale-95 flex items-center gap-1.5 ${isPinkTheme ? 'bg-white border-pink-200 text-pink-900 hover:border-pink-400' : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-emerald-500'}`}
                    >
                      <Sparkles className={`w-3 h-3 ${isPinkTheme ? 'text-pink-500' : 'text-emerald-600'}`} />
                      <span>{t.name}</span>
                      <span className={`font-bold tabular-nums ${isPinkTheme ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                        {formatCompactIDR(t.amount)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duplicate Alert */}
              {duplicateWarning.isDuplicate && (
                <div className={`${isPinkTheme ? 'bg-pink-100/90 border-pink-200 text-pink-900' : 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200'} border rounded-xl p-2.5 flex items-start gap-2 text-xs`}>
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
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
                    <label className={`text-[11px] font-bold uppercase block mb-1 ${isPinkTheme ? 'text-pink-600/70' : 'text-slate-400'}`}>Dari Dompet</label>
                    <select
                      value={selectedAccount}
                      onChange={e => setSelectedAccount(e.target.value)}
                      className={`w-full p-2 rounded-xl font-semibold outline-none border ${isPinkTheme ? 'bg-white border-pink-200 text-[#37131D]' : 'bg-slate-100 dark:bg-slate-800 border-slate-200/60 dark:border-slate-700'}`}
                    >
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`text-[11px] font-bold uppercase block mb-1 ${isPinkTheme ? 'text-pink-600/70' : 'text-slate-400'}`}>Ke Dompet</label>
                    <select
                      value={toAccount}
                      onChange={e => setToAccount(e.target.value)}
                      className={`w-full p-2 rounded-xl font-semibold outline-none border ${isPinkTheme ? 'bg-white border-pink-200 text-[#37131D]' : 'bg-slate-100 dark:bg-slate-800 border-slate-200/60 dark:border-slate-700'}`}
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
                    <label className={`text-[11px] font-bold uppercase mb-1 block ${isPinkTheme ? 'text-pink-600/70' : 'text-slate-400'}`}>
                      Kategori
                    </label>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                      {categories
                        .filter(c => (txnType === 'income' ? c.kind === 'income' : c.kind === 'expense'))
                        .map(c => (
                          <button
                            key={c.id}
                            onClick={() => setSelectedCategory(c.id)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition ${
                              selectedCategory === c.id
                                ? isPinkTheme ? 'bg-rose-500 text-white shadow-xs' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold shadow-xs'
                                : isPinkTheme ? 'bg-white text-pink-900 border border-pink-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
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
                    <label className={`text-[11px] font-bold uppercase mb-1 block ${isPinkTheme ? 'text-pink-600/70' : 'text-slate-400'}`}>
                      Dompet
                    </label>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                      {accounts.map(a => (
                        <button
                          key={a.id}
                          onClick={() => setSelectedAccount(a.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition ${
                            selectedAccount === a.id
                              ? isPinkTheme ? 'bg-rose-500 text-white shadow-xs' : 'bg-emerald-600 text-white font-bold shadow-xs'
                              : isPinkTheme ? 'bg-white text-pink-900 border border-pink-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
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
                        className={`w-full px-3 py-2 rounded-xl outline-none border text-base sm:text-xs ${isPinkTheme ? 'bg-white border-pink-200 text-[#37131D]' : 'bg-slate-100 dark:bg-slate-800 border-transparent focus:border-slate-300 dark:focus:border-slate-700'}`}
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="Catatan (opsional)"
                        className={`w-full px-3 py-2 rounded-xl outline-none border text-base sm:text-xs ${isPinkTheme ? 'bg-white border-pink-200 text-[#37131D]' : 'bg-slate-100 dark:bg-slate-800 border-transparent focus:border-slate-300 dark:focus:border-slate-700'}`}
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
                        className={`py-3 rounded-2xl text-base font-bold transition active:scale-95 tabular-nums ${
                          key === 'backspace'
                            ? isPinkTheme ? 'bg-pink-100 text-pink-700' : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                            : key === 'rb' || key === '000'
                            ? isPinkTheme ? 'bg-pink-100 text-pink-700 font-extrabold border border-pink-300' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-extrabold border border-emerald-200/50 dark:border-emerald-800/50'
                            : key === 'C'
                            ? isPinkTheme ? 'bg-pink-100/80 text-pink-700' : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            : isPinkTheme ? 'bg-white hover:bg-pink-50 text-[#37131D] shadow-2xs border border-pink-100' : 'bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700/80'
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
                  className={`px-3.5 py-3 rounded-2xl text-xs font-bold transition active:scale-95 min-h-[44px] ${isPinkTheme ? 'bg-pink-100 text-pink-800 hover:bg-pink-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'}`}
                >
                  + Tambah Lagi
                </button>
                <button
                  onClick={() => handleSaveManual(false)}
                  className={`flex-1 py-3 rounded-2xl text-xs font-bold shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5 min-h-[44px] ${isPinkTheme ? 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 shadow-rose-300/40 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
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
                  Contoh Cepat (1 Ketuk):
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => triggerVoiceParse('Makan siang 35 ribu pakai GoPay')}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-left hover:border-emerald-500 border border-slate-200/60 dark:border-slate-700 flex items-center justify-between transition"
                  >
                    <span className="truncate pr-1">"Makan siang 35rb GoPay"</span>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerVoiceParse('Beli bensin 50 ribu terus makan siang 30 ribu')}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-left hover:border-emerald-500 border border-slate-200/60 dark:border-slate-700 flex items-center justify-between transition"
                  >
                    <span className="truncate pr-1">"Bensin 50rb + makan 30rb"</span>
                    <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerVoiceParse('Kopi kenangan 25rb bayar tunai')}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-left hover:border-emerald-500 border border-slate-200/60 dark:border-slate-700 flex items-center justify-between transition"
                  >
                    <span className="truncate pr-1">"Kopi 25rb bayar tunai"</span>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerVoiceParse('Belanja minimarket 120 ribu pakai BCA')}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-left hover:border-emerald-500 border border-slate-200/60 dark:border-slate-700 flex items-center justify-between transition"
                  >
                    <span className="truncate pr-1">"Belanja 120rb BCA"</span>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  </button>
                </div>
              </div>

              {/* iPhone Dictation & Custom Voice Input */}
              <div className="text-left space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">
                    Ketik atau Dikte Suara:
                  </span>
                  <span className="text-[10px] text-pink-600 dark:text-pink-400 font-semibold">
                    💡 Gunakan mic 🎤 di keyboard iPhone
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    id="custom-voice-input"
                    type="text"
                    value={customVoiceInput}
                    onChange={e => setCustomVoiceInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && customVoiceInput.trim()) {
                        triggerVoiceParse(customVoiceInput);
                      }
                    }}
                    placeholder="Ketik atau dikte ucapan transaksi di sini..."
                    className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none text-base sm:text-xs border border-transparent focus:border-slate-300 dark:focus:border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customVoiceInput.trim()) triggerVoiceParse(customVoiceInput);
                    }}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold active:scale-95 transition"
                  >
                    Proses
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

              {/* Hidden Inputs for Real Camera & Photo Library */}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                id="receipt-camera-input"
                className="hidden"
                onChange={handleImageFileChange}
              />
              <input
                type="file"
                accept="image/*"
                id="receipt-gallery-input"
                className="hidden"
                onChange={handleImageFileChange}
              />

              {uploadedImageUrl ? (
                <div className={`p-3.5 rounded-2xl border text-center space-y-2 ${isPinkTheme ? 'bg-white border-pink-200' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700'}`}>
                  <img
                    src={uploadedImageUrl}
                    alt="Pratinjau Nota"
                    className="max-h-40 mx-auto rounded-xl object-contain border border-slate-200 dark:border-slate-700 shadow-xs"
                  />
                  <div className="flex justify-center gap-2 pt-1">
                    <label
                      htmlFor="receipt-camera-input"
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1 active:scale-95 transition ${
                        isPinkTheme ? 'bg-pink-100 text-pink-800' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Foto Ulang</span>
                    </label>
                    <label
                      htmlFor="receipt-gallery-input"
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1 active:scale-95 transition ${
                        isPinkTheme ? 'bg-pink-100 text-pink-800' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Pilih Galeri</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <label
                    htmlFor="receipt-camera-input"
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition active:scale-95 flex flex-col items-center justify-center gap-1.5 ${
                      isPinkTheme ? 'border-pink-200 bg-white hover:border-pink-400' : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500'
                    }`}
                  >
                    <Camera className={`w-6 h-6 ${isPinkTheme ? 'text-rose-500' : 'text-emerald-600'}`} />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Ambil Kamera
                    </span>
                    <span className="text-[10px] text-slate-400">Foto nota langsung</span>
                  </label>

                  <label
                    htmlFor="receipt-gallery-input"
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition active:scale-95 flex flex-col items-center justify-center gap-1.5 ${
                      isPinkTheme ? 'border-pink-200 bg-white hover:border-pink-400' : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500'
                    }`}
                  >
                    <UploadCloud className={`w-6 h-6 ${isPinkTheme ? 'text-rose-500' : 'text-emerald-600'}`} />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Pilih Galeri
                    </span>
                    <span className="text-[10px] text-slate-400">Dari album foto</span>
                  </label>
                </div>
              )}

              {/* Editable OCR text area (FR-10: Layar konfirmasi dengan bidang yang dapat diedit) */}
              {ocrEditText && (
                <div className="text-left space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Koreksi Teks Nota (On-Device OCR):
                  </span>
                  <textarea
                    value={ocrEditText}
                    onChange={e => handleOcrTextChange(e.target.value)}
                    rows={3}
                    className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-mono outline-none border border-transparent focus:border-slate-300 dark:focus:border-slate-700 leading-relaxed"
                    placeholder="Teks hasil pembacaan nota..."
                  />
                </div>
              )}

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

              {/* Viewfinder with Real Photo Upload */}
              <input
                type="file"
                id="qris-file-input"
                accept="image/*"
                className="hidden"
                onChange={handleQrisFileChange}
              />
              <label htmlFor="qris-file-input" className="cursor-pointer block">
                <div className="relative w-44 h-44 mx-auto bg-slate-900 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-700 shadow-inner group hover:border-emerald-500 transition">
                  {uploadedImageUrl && activeTab === 'qr' ? (
                    <img src={uploadedImageUrl} alt="QRIS" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <div className="absolute inset-4 border border-dashed border-white/40 rounded-xl flex items-center justify-center">
                        <div className="w-full h-0.5 bg-emerald-400 animate-pulse"></div>
                      </div>
                      <QrCode className="w-14 h-14 text-white/30 group-hover:text-emerald-400 transition" />
                    </>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 mt-1.5 block">
                  Ketuk kotak untuk pilih screenshot QRIS dari galeri
                </span>
              </label>

              <button
                type="button"
                onClick={handleSimulateScanQR}
                className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl shadow-xs transition active:scale-95 min-h-[44px]"
              >
                Gunakan Contoh QRIS Kopi Kenangan
              </button>

              {/* Paste QRIS payload input */}
              <div className="text-left space-y-1 pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  Atau Tempel Teks/Kode QRIS (NMID / EMVCo):
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={qrisCustomInput}
                    onChange={e => setQrisCustomInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && qrisCustomInput.trim()) {
                        handleProcessQrisPayload(qrisCustomInput);
                      }
                    }}
                    placeholder="Contoh: ID102003881920 / EMVCo code..."
                    className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-base sm:text-xs outline-none border border-transparent focus:border-slate-300 dark:focus:border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (qrisCustomInput.trim()) handleProcessQrisPayload(qrisCustomInput);
                    }}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold active:scale-95 transition"
                  >
                    Dekode
                  </button>
                </div>
              </div>

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
