import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { formatIDR, formatCompactIDR } from '../../utils/formatters';
import { AppIcon } from '../common/IconHelper';
import {
  parseVoiceInput,
  parseOCRText,
  detectDuplicate,
  guessCategory,
  DEFAULT_TEMPLATES,
  ParsedItem,
} from '../../utils/parser';
import {
  X,
  Mic,
  Camera,
  Edit3,
  Check,
  AlertCircle,
  Sparkles,
  UploadCloud,
  Layers,
  Trash2,
  Clipboard,
  Loader2,
  Square,
  Zap,
} from 'lucide-react';
import { getEngineMode, setEngineMode, type ProcessingEngineMode } from '../../utils/aiMode';
import { TxnType } from '../../types/index.ts';
import { pickPhoto, downscaleImage, savePendingUpload } from '../../utils/cameraHelper';
import { recognizeReceiptText } from '../../utils/ocr';
import { VoiceRecorder, isVoiceRecordingSupported } from '../../utils/audioRecorder';
import {
  getAIStatus,
  getStoredGeminiKey,
  transcribeVoiceWithAI,
  geminiErrorMessage,
  type AIStatus,
} from '../../services/gemini';
import type { AIContext } from '../../utils/aiSchemas';
import { formatDateTimeID, todayInJakarta } from '../../utils/dateParsing';

const MAX_RECORDING_SECONDS = 60;

function formatRecordingDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export const CatatModal: React.FC = () => {
  const {
    isCatatOpen,
    closeCatat,
    catatInitialMode,
    catatInitialType,
    accounts,
    categories,
    transactions,
    addTransaction,
    showToast,
    settings,
  } = useApp();

  const isPinkTheme = settings.theme === 'pink';

  const aiContext: AIContext = useMemo(
    () => ({
      categories: categories.map(category => ({
        id: category.id,
        name: category.name,
        kind: category.kind,
      })),
      accounts: accounts.map(account => ({
        id: account.id,
        name: account.name,
        type: account.type,
      })),
      today: todayInJakarta(),
    }),
    [categories, accounts]
  );

  const [activeTab, setActiveTab] = useState<'manual' | 'voice' | 'ocr' | 'screenshot'>(
    catatInitialMode
  );

  useEffect(() => {
    setActiveTab(catatInitialMode);
  }, [catatInitialMode]);

  // Form State
  const [txnType, setTxnType] = useState<TxnType>(catatInitialType);
  const [amountStr, setAmountStr] = useState<string>('0');
  const [selectedCategory, setSelectedCategory] = useState<string>('cat-makan');
  const [selectedAccount, setSelectedAccount] = useState<string>('acc-bca');
  const [toAccount, setToAccount] = useState<string>('acc-gopay');
  const [merchant, setMerchant] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [adminFee, setAdminFee] = useState<number>(0);

  // Voice State
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [voiceParsedItems, setVoiceParsedItems] = useState<ParsedItem[]>([]);
  const [customVoiceInput, setCustomVoiceInput] = useState<string>('');

  // OCR State
  const [ocrSampleText, setOcrSampleText] = useState('');
  const [ocrEditText, setOcrEditText] = useState('');
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [ocrParsedResult, setOcrParsedResult] = useState<ParsedItem | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrEngine, setOcrEngine] = useState<'gemini' | 'tesseract' | 'local' | null>(null);
  const [ocrProgressText, setOcrProgressText] = useState<string>('');
  const [engineMode, setEngineModeState] = useState<ProcessingEngineMode>(() => getEngineMode());

  // Gemini AI State
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceEngine, setVoiceEngine] = useState<'gemini' | 'local' | 'speech' | null>(null);
  const [voiceRecordingSeconds, setVoiceRecordingSeconds] = useState(0);
  const voiceRecorderRef = useRef<VoiceRecorder | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const hasAI = Boolean(getStoredGeminiKey()) || Boolean(aiStatus?.available);

  // Sync with engine mode changes from settings
  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) setEngineModeState(e.detail);
    };
    window.addEventListener('bb_engine_mode_changed', handler);
    return () => window.removeEventListener('bb_engine_mode_changed', handler);
  }, []);

  // Cek ketersediaan Gemini saat modal dibuka (server proxy atau kunci perangkat).
  useEffect(() => {
    if (!isCatatOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isCatatOpen]);

  useEffect(() => {
    if (!isCatatOpen) return;
    let mounted = true;
    getAIStatus()
      .then(status => {
        if (mounted) setAiStatus(status);
      })
      .catch(() => {
        if (mounted) setAiStatus(null);
      });
    return () => {
      mounted = false;
    };
  }, [isCatatOpen]);

  // Hentikan rekaman & timer saat modal ditutup atau komponen dilepas.
  useEffect(() => {
    if (isCatatOpen) return;
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    try { speechRecognitionRef.current?.stop(); } catch {}
    speechRecognitionRef.current = null;
    voiceRecorderRef.current?.cancel();
    voiceRecorderRef.current = null;
    setIsRecording(false);
    setVoiceRecordingSeconds(0);
  }, [isCatatOpen]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current !== null) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      try { speechRecognitionRef.current?.stop(); } catch {}
      speechRecognitionRef.current = null;
      voiceRecorderRef.current?.cancel();
      voiceRecorderRef.current = null;
    };
  }, []);

  // Reset form when modal opens
  useEffect(() => {
    if (isCatatOpen) {
      setTxnType(catatInitialType);
      const kind = catatInitialType === 'income' ? 'income' : 'expense';
      const firstCategory = categories.find(c => c.kind === kind);
      if (firstCategory) setSelectedCategory(firstCategory.id);

      setAmountStr('0');
      setMerchant('');
      setNote('');
      setAdminFee(0);
      setVoiceParsedItems([]);
      setCustomVoiceInput('');
      setVoiceError(null);
      setVoiceEngine(null);
      setOcrSampleText('');
      setOcrEditText('');
      setUploadedImageUrl(null);
      setOcrParsedResult(null);
      setOcrError(null);
      setOcrEngine(null);
    }
  }, [isCatatOpen, catatInitialType]);

  if (!isCatatOpen) return null;

  const currentAmount = parseInt(amountStr.replace(/\D/g, ''), 10) || 0;

  const handleTypeChange = (type: TxnType) => {
    setTxnType(type);
    if (type !== 'transfer') {
      const kind = type === 'income' ? 'income' : 'expense';
      const firstCategory = categories.find(c => c.kind === kind);
      if (firstCategory) setSelectedCategory(firstCategory.id);
    }
  };

  // Keypad Handlers (FR-2: custom keypad with '000')
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
    setCustomVoiceInput(text);
    const parsed = parseVoiceInput(text);
    setVoiceParsedItems(parsed);
    setVoiceEngine('local');
    setVoiceError(null);
    if (parsed.length > 0) {
      setTimeout(() => {
        document.getElementById('voice-results')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 150);
    }
    return parsed;
  };

  const updateVoiceItem = (index: number, updates: Partial<ParsedItem>) => {
    setVoiceParsedItems(prev =>
      prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item))
    );
  };

  const updateVoiceItemType = (index: number, type: TxnType) => {
    setVoiceParsedItems(prev =>
      prev.map((item, idx) => {
        if (idx !== index) return item;

        if (type === 'transfer') {
          const from = item.account_id || selectedAccount;
          const to =
            item.to_account_id && item.to_account_id !== from
              ? item.to_account_id
              : accounts.find(account => account.id !== from)?.id || from;
          return {
            ...item,
            type,
            category_id: undefined,
            account_id: from,
            to_account_id: to,
          };
        }

        const currentCategory = categories.find(category => category.id === item.category_id);
        const nextCategory =
          currentCategory && currentCategory.kind === type
            ? currentCategory.id
            : categories.find(category => category.kind === type)?.id;

        return {
          ...item,
          type,
          category_id: nextCategory,
          to_account_id: undefined,
        };
      })
    );
  };

  const handleProcessVoiceInput = () => {
    const text = customVoiceInput.trim();
    if (!text) {
      showToast('Ketik atau dikte transaksi dulu');
      document.getElementById('custom-voice-input')?.focus();
      return;
    }

    setIsVoiceProcessing(true);
    setTimeout(() => {
      const parsed = triggerVoiceParse(text);
      setIsVoiceProcessing(false);
      const missingAmount = parsed.filter(item => item.amount <= 0).length;
      if (parsed.length === 0) {
        showToast('Belum ada transaksi yang bisa dibaca');
      } else if (missingAmount > 0) {
        showToast(`${parsed.length} transaksi terbaca, ${missingAmount} nominal perlu diisi`);
      } else {
        showToast(`${parsed.length} transaksi berhasil dibaca`);
      }
    }, 200);
  };

  const clearRecordingTimer = () => {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const stopVoiceAndProcess = async () => {
    const recorder = voiceRecorderRef.current;
    if (!recorder) return;

    voiceRecorderRef.current = null;
    clearRecordingTimer();
    setIsRecording(false);
    setVoiceError(null);
    setIsVoiceProcessing(true);

    try {
      const clip = await recorder.stop();
      if (clip.durationMs < 700) {
        setVoiceError('Rekaman terlalu pendek. Tahan mikrofon dan bicara lebih jelas.');
        showToast('Rekaman terlalu pendek');
        return;
      }

      const result = await transcribeVoiceWithAI(clip.base64, clip.mimeType, aiContext);
      const items = result.items || [];
      setCustomVoiceInput(result.transcript || '');
      setVoiceParsedItems(items);
      setVoiceEngine('gemini');
      setVoiceError(null);

      if (items.length > 0) {
        showToast(`${items.length} transaksi terbaca dengan Gemini AI`);
        setTimeout(() => {
          document.getElementById('voice-results')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 150);
      } else {
        showToast('Suara terbaca, tetapi transaksi belum bisa dipastikan. Lengkapi manual.');
        document.getElementById('custom-voice-input')?.focus();
      }
    } catch (error) {
      const message = geminiErrorMessage(error);
      setVoiceError(message);
      showToast(message);
      document.getElementById('custom-voice-input')?.focus();
    } finally {
      setIsVoiceProcessing(false);
    }
  };

  const startRecordingTimer = () => {
    clearRecordingTimer();
    setVoiceRecordingSeconds(0);
    let elapsed = 0;
    recordingTimerRef.current = window.setInterval(() => {
      elapsed += 1;
      setVoiceRecordingSeconds(elapsed);
      if (elapsed >= MAX_RECORDING_SECONDS) {
        clearRecordingTimer();
        void stopVoiceAndProcess();
      }
    }, 1000);
  };

  const handleStartVoice = async () => {
    if (isVoiceProcessing) return;
    if (isRecording) {
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch {}
        speechRecognitionRef.current = null;
        clearRecordingTimer();
        setIsRecording(false);
        return;
      }
      if (voiceRecorderRef.current) {
        await stopVoiceAndProcess();
        return;
      }
      setIsRecording(false);
      return;
    }
    if (voiceRecorderRef.current) return;

    setVoiceError(null);

    // 100% LOKAL ON-DEVICE (Web Speech API id-ID + Native Keyboard Dictation)
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'id-ID';
        recognition.interimResults = true;
        recognition.continuous = false;
        speechRecognitionRef.current = recognition;

        setIsRecording(true);
        setVoiceEngine('speech');
        startRecordingTimer();
        showToast('Mendengarkan (Bahasa Indonesia)...');

        recognition.onresult = (event: any) => {
          let interim = '';
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const res = event.results[i];
            if (res.isFinal) {
              final += res[0].transcript;
            } else {
              interim += res[0].transcript;
            }
          }
          const current = (final || interim).trim();
          if (current) {
            setCustomVoiceInput(current);
          }
          if (final) {
            clearRecordingTimer();
            setIsRecording(false);
            speechRecognitionRef.current = null;
            const parsed = triggerVoiceParse(final);
            if (parsed.length > 0) {
              showToast(`${parsed.length} transaksi terbaca (Lokal on-device)`);
            }
          }
        };

        recognition.onerror = (e: any) => {
          clearRecordingTimer();
          setIsRecording(false);
          speechRecognitionRef.current = null;
          if (e.error !== 'no-speech') {
            const el = document.getElementById('custom-voice-input');
            el?.focus();
            showToast('Ketuk ikon mic 🎤 pada keyboard untuk dikte suara');
          }
        };

        recognition.onend = () => {
          clearRecordingTimer();
          setIsRecording(false);
          speechRecognitionRef.current = null;
        };

        recognition.start();
        return;
      } catch (err) {
        console.warn('SpeechRecognition start failed:', err);
      }
    }

    // Fallback for browsers without SpeechRecognition
    const el = document.getElementById('custom-voice-input');
    el?.focus();
    showToast('Gunakan ikon mic 🎤 pada keyboard untuk dikte suara');
  };

  const handlePasteClipboardVoice = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setCustomVoiceInput(text.trim());
          triggerVoiceParse(text.trim());
          showToast('Teks ditempel & diproses');
          return;
        }
      }
      showToast('Clipboard kosong');
    } catch {
      showToast('Gunakan tempel manual di kotak input');
    }
  };

  const handleSaveVoiceItems = (asDraft = false) => {
    if (voiceParsedItems.length === 0) {
      showToast('Belum ada transaksi untuk disimpan');
      return;
    }
    if (voiceParsedItems.some(item => item.amount <= 0)) {
      showToast('Masih ada nominal 0. Lengkapi dulu sebelum menyimpan');
      return;
    }
    for (const item of voiceParsedItems) {
      addTransaction({
        type: item.type,
        amount: item.amount,
        category_id: item.category_id,
        account_id: item.account_id || selectedAccount,
        to_account_id: item.to_account_id,
        merchant: item.merchant,
        note: item.note,
        occurred_at: item.occurred_at,
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
    setOcrEngine('local');
    setOcrError(null);
  };

  const runLocalReceiptScan = async (compressed: string, filename: string) => {
    let sample = '';
    let engine: 'tesseract' | 'local' = 'local';

    try {
      const recognized = await recognizeReceiptText(compressed, (progress, status) => {
        setOcrProgressText(`${status} (${progress}%)`);
      });
      if (recognized && recognized.trim().length > 5) {
        sample = recognized;
        engine = 'tesseract';
      }
    } catch {
      // OCR gagal membaca teks
    }

    setOcrSampleText(sample);
    setOcrEditText(sample);
    setOcrParsedResult(sample ? parseOCRText(sample) : null);
    setOcrEngine(sample ? engine : null);
    return { sample, engine };
  };

  const processImagePhoto = async (dataUrlOrFile: string | File) => {
    savePendingUpload('ocr');
    let dataUrl: string;
    let filename = 'struk.jpg';

    if (typeof dataUrlOrFile === 'string') {
      dataUrl = dataUrlOrFile;
    } else {
      filename = dataUrlOrFile.name.toLowerCase();
      dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(dataUrlOrFile);
      });
    }

    // 1600px cukup untuk teks struk kecil, tetap di bawah batas body Vercel.
    const compressed = await downscaleImage(dataUrl, 1600);
    setUploadedImageUrl(compressed);
    setOcrSampleText('');
    setOcrEditText('');
    setOcrParsedResult(null);
    setOcrError(null);
    setOcrEngine(null);
    setIsOcrProcessing(true);

    try {
      setOcrProgressText('Membaca nota on-device...');
      const local = await runLocalReceiptScan(compressed, filename);
      if (local.sample) {
        showToast('Nota dibaca dengan OCR on-device');
      } else {
        showToast('Teks nota tidak terbaca jelas. Silakan ketik manual.');
      }
    } finally {
      setIsOcrProcessing(false);
      setOcrProgressText('');
    }
  };

  const handleRetryAIScan = async () => {
    if (!uploadedImageUrl) {
      showToast('Pilih foto nota terlebih dahulu');
      return;
    }

    setIsOcrProcessing(true);
    setOcrError(null);
    try {
      setOcrProgressText('Membaca ulang nota on-device...');
      const local = await runLocalReceiptScan(uploadedImageUrl, 'struk.jpg');
      if (local.sample) {
        showToast('Nota berhasil dibaca ulang');
      } else {
        showToast('Teks nota tidak terbaca jelas. Silakan ketik manual.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memproses nota';
      setOcrError(message);
      showToast(message);
    } finally {
      setIsOcrProcessing(false);
      setOcrProgressText('');
    }
  };

  const handleReparseLocal = () => {
    const text = (ocrEditText || ocrSampleText).trim();
    if (!text) {
      showToast('Belum ada teks nota untuk diproses');
      return;
    }
    setOcrParsedResult(parseOCRText(text));
    setOcrEngine('local');
    setOcrError(null);
    showToast('Nota diproses ulang dengan parser lokal');
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImagePhoto(file);
  };

  const handleNativeCamera = async () => {
    savePendingUpload('ocr');
    const photo = await pickPhoto('camera');
    if (photo) {
      await processImagePhoto(photo);
    } else {
      document.getElementById('receipt-camera-input')?.click();
    }
  };

  const handleNativeGallery = async () => {
    savePendingUpload('ocr');
    const photo = await pickPhoto('photos');
    if (photo) {
      await processImagePhoto(photo);
    } else {
      document.getElementById('receipt-gallery-input')?.click();
    }
  };

  const handleOcrTextChange = (text: string) => {
    setOcrEditText(text);
    const result = parseOCRText(text);
    setOcrParsedResult(result);
    setOcrEngine('local');
  };

  const handleSaveOCR = (asDraft = false) => {
    if (!ocrParsedResult) return;
    addTransaction({
      type: ocrParsedResult.type,
      amount: ocrParsedResult.amount,
      category_id: ocrParsedResult.category_id,
      account_id: ocrParsedResult.account_id,
      to_account_id: ocrParsedResult.to_account_id,
      merchant: ocrParsedResult.merchant,
      external_ref: ocrParsedResult.external_ref,
      note: ocrParsedResult.note,
      occurred_at: ocrParsedResult.occurred_at,
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
          occurred_at: ocrParsedResult.occurred_at,
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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end justify-center">
      <div className={`${isPinkTheme ? 'bg-[#FFF5F7] border-pink-200 text-[#37131D]' : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800'} w-full max-w-md rounded-t-[28px] shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden animate-slide-up border-t`}>
        {/* Grab bar & Header */}
        <div className={`pt-3 px-5 pb-2 shrink-0 border-b ${isPinkTheme ? 'border-pink-200/60' : 'border-slate-100 dark:border-slate-800/80'}`}>
          <div className={`w-10 h-1 ${isPinkTheme ? 'bg-pink-300' : 'bg-slate-300 dark:bg-slate-700'} rounded-full mx-auto mb-3`}></div>
          <div className="flex items-center justify-between">
            <h2 className={`text-sm font-bold tracking-tight ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
              {txnType === 'income'
                ? 'Catat Pemasukan'
                : txnType === 'transfer'
                ? 'Catat Transfer'
                : 'Catat Pengeluaran'}{' '}
              {isPinkTheme ? '🎀' : ''}
            </h2>
            <button
              onClick={closeCatat}
              aria-label="Tutup modal"
              className={`p-1.5 rounded-full ${isPinkTheme ? 'text-pink-400 hover:text-pink-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Segmented Control 3 Mode Tabs (Apple iOS style) */}
          <div className={`grid grid-cols-3 gap-1 mt-3 p-1 ${isPinkTheme ? 'bg-pink-100/70' : 'bg-slate-100 dark:bg-slate-800'} rounded-xl text-xs font-semibold`}>
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
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3.5 pb-safe-bottom space-y-3.5 overscroll-contain">
          {/* ===================== MODE 1: FORM KETIK MANUAL ===================== */}
          {activeTab === 'manual' && (
            <div className="space-y-3">
              {/* Type Switcher */}
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => handleTypeChange('expense')}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    txnType === 'expense'
                      ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  Uang Keluar
                </button>
                <button
                  onClick={() => handleTypeChange('income')}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    txnType === 'income'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  Uang Masuk
                </button>
                <button
                  onClick={() => handleTypeChange('transfer')}
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
              <div className={`relative text-center py-2 rounded-2xl border ${isPinkTheme ? 'bg-white border-pink-200/80 shadow-pink-100/30' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800'}`}>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isPinkTheme ? 'text-pink-600/70' : 'text-slate-400'}`}>
                  Nominal Transaksi (IDR)
                </span>
                <div className={`text-3xl font-extrabold tracking-tight tabular-nums mt-0.5 ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
                  {formatIDR(currentAmount)}
                </div>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('backspace')}
                  aria-label="Hapus digit terakhir"
                  className={`absolute right-2 top-2 w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold transition active:scale-95 ${
                    isPinkTheme
                      ? 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                      : 'bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  ⌫
                </button>
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
                        className={`w-full px-3 py-1.5 rounded-xl outline-none border text-base sm:text-xs ${isPinkTheme ? 'bg-white border-pink-200 text-[#37131D]' : 'bg-slate-100 dark:bg-slate-800 border-transparent focus:border-slate-300 dark:focus:border-slate-700'}`}
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="Catatan (opsional)"
                        className={`w-full px-3 py-1.5 rounded-xl outline-none border text-base sm:text-xs ${isPinkTheme ? 'bg-white border-pink-200 text-[#37131D]' : 'bg-slate-100 dark:bg-slate-800 border-transparent focus:border-slate-300 dark:focus:border-slate-700'}`}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Tactile Keypad */}
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '000'].map(
                  key => {
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleKeypadPress(key)}
                        className={`h-11 sm:h-12 rounded-xl text-base font-bold flex items-center justify-center transition active:scale-95 tabular-nums ${
                          key === '000'
                            ? isPinkTheme ? 'bg-pink-100 text-pink-700 font-extrabold border border-pink-300' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-extrabold border border-emerald-200/50 dark:border-emerald-800/50'
                            : key === 'C'
                            ? isPinkTheme ? 'bg-pink-100/80 text-pink-700' : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            : isPinkTheme ? 'bg-white hover:bg-pink-50 text-[#37131D] shadow-2xs border border-pink-100' : 'bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700/80'
                        }`}
                      >
                        {key}
                      </button>
                    );
                  }
                )}
              </div>

            </div>
          )}

          {/* ===================== MODE 2: VOICE (FR-6 to FR-11) ===================== */}
          {activeTab === 'voice' && (
            <div className="space-y-4 text-center py-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ucapkan transaksi dalam Bahasa Indonesia. Pengenalan suara on-device memproses instan tanpa kuota.
              </p>

              <div className="flex items-center justify-center">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                  isPinkTheme ? 'bg-pink-100 text-pink-700' : 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                }`}>
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>On-Device Instan (Bebas Kuota)</span>
                </span>
              </div>

              {/* Mic Button */}
              <div className="py-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleStartVoice();
                  }}
                  disabled={isVoiceProcessing}
                  aria-label={isRecording ? 'Berhenti merekam dan proses' : 'Mulai rekam suara'}
                  className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center transition shadow-md ${
                    isRecording
                      ? 'bg-rose-500 text-white animate-pulse ring-4 ring-rose-500/20'
                      : isVoiceProcessing
                        ? 'bg-slate-400 dark:bg-slate-600 text-white cursor-wait'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 ring-4 ring-emerald-500/10'
                  }`}
                >
                  {isVoiceProcessing ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : isRecording ? (
                    <Square className="w-6 h-6 fill-current" />
                  ) : (
                    <Mic className="w-7 h-7" />
                  )}
                </button>
                <div className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isVoiceProcessing
                    ? 'Memproses dengan Gemini AI...'
                    : isRecording
                      ? `Mendengarkan... ${formatRecordingDuration(voiceRecordingSeconds)}`
                      : 'Ketuk untuk Bicara'}
                </div>
                <div className="mt-1 text-[10px] text-slate-400">
                  {isVoiceProcessing
                    ? 'Mengubah suara menjadi transaksi terstruktur'
                    : isRecording
                      ? `Ketuk lagi untuk berhenti (maks. ${MAX_RECORDING_SECONDS} detik)`
                      : 'Dikte suara on-device (Web Speech API) · atau gunakan mic keyboard'}
                </div>
              </div>

              {voiceError && (
                <div className="text-left p-2.5 rounded-xl border border-amber-200/70 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[11px] leading-relaxed flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p>{voiceError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setVoiceError(null);
                        document.getElementById('custom-voice-input')?.focus();
                      }}
                      className="mt-1 font-bold underline underline-offset-2"
                    >
                      Dikte manual lewat keyboard
                    </button>
                  </div>
                </div>
              )}

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
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleProcessVoiceInput();
                      }
                    }}
                    placeholder="Ketik atau dikte ucapan transaksi di sini..."
                    className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none text-base sm:text-xs border border-transparent focus:border-slate-300 dark:focus:border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={handlePasteClipboardVoice}
                    title="Tempel dari clipboard"
                    className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold active:scale-95 transition flex items-center justify-center"
                  >
                    <Clipboard className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleProcessVoiceInput}
                    disabled={isVoiceProcessing}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold active:scale-95 transition disabled:opacity-60 whitespace-nowrap"
                  >
                    {isVoiceProcessing ? 'Memproses...' : 'Proses'}
                  </button>
                </div>
              </div>

              {/* Parsed Results */}
              {voiceParsedItems.length > 0 && (
                <div id="voice-results" className="space-y-2 pt-2 text-left">
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                    <span>Hasil Ekstraksi ({voiceParsedItems.length} Transaksi)</span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                          voiceEngine === 'gemini'
                            ? 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {voiceEngine === 'gemini'
                          ? 'Gemini AI'
                          : voiceEngine === 'speech'
                            ? 'Dikte Browser'
                            : 'Parser Lokal'}
                      </span>
                      <span className="text-emerald-600 text-[11px]">Bisa diedit</span>
                    </div>
                  </div>

                  {voiceParsedItems.map((item, idx) => {
                    const cat = categories.find(c => c.id === item.category_id);
                    const itemCategories = categories.filter(c => c.kind === item.type);
                    const transferTargets = accounts.filter(
                      account => account.id !== item.account_id
                    );
                    return (
                      <div
                        key={idx}
                        className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={item.merchant || ''}
                            onChange={e => updateVoiceItem(idx, { merchant: e.target.value })}
                            placeholder="Judul transaksi"
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none text-xs font-bold text-slate-900 dark:text-white"
                          />
                          <div className="flex items-center gap-1 w-28 shrink-0 px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] text-slate-400">Rp</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={item.amount || ''}
                              placeholder="0"
                              onChange={e =>
                                updateVoiceItem(idx, { amount: Math.max(0, Number(e.target.value)) })
                              }
                              className="w-full bg-transparent outline-none text-right text-xs font-bold tabular-nums text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex-1">
                            {([
                              { value: 'expense', label: 'Pengeluaran', active: 'bg-rose-500 text-white' },
                              { value: 'income', label: 'Pemasukan', active: 'bg-emerald-600 text-white' },
                              { value: 'transfer', label: 'Transfer', active: 'bg-sky-600 text-white' },
                            ] as const).map(option => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => updateVoiceItemType(idx, option.value)}
                                aria-pressed={item.type === option.value}
                                className={`min-h-[32px] rounded-md text-[10px] font-bold transition ${
                                  item.type === option.value
                                    ? option.active
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                          <span
                            className="text-slate-400 text-[10px] shrink-0"
                            title={`Keyakinan ${Math.round(item.confidence * 100)}%`}
                          >
                            {Math.round(item.confidence * 100)}%
                          </span>
                        </div>

                        {item.type === 'transfer' ? (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <label className="flex items-center gap-1 min-w-0 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Dari</span>
                              <select
                                value={item.account_id || ''}
                                onChange={e => {
                                  const nextFrom = e.target.value;
                                  const nextTo =
                                    nextFrom === item.to_account_id
                                      ? accounts.find(account => account.id !== nextFrom)?.id ||
                                        item.to_account_id
                                      : item.to_account_id;
                                  updateVoiceItem(idx, {
                                    account_id: nextFrom,
                                    to_account_id: nextTo,
                                  });
                                }}
                                className="flex-1 min-w-0 bg-transparent text-[11px] font-semibold outline-none"
                              >
                                {accounts.map(account => (
                                  <option key={account.id} value={account.id}>
                                    {account.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex items-center gap-1 min-w-0 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Ke</span>
                              <select
                                value={item.to_account_id || ''}
                                onChange={e =>
                                  updateVoiceItem(idx, { to_account_id: e.target.value })
                                }
                                className="flex-1 min-w-0 bg-transparent text-[11px] font-semibold outline-none"
                              >
                                {(transferTargets.length > 0 ? transferTargets : accounts).map(
                                  account => (
                                    <option key={account.id} value={account.id}>
                                      {account.name}
                                    </option>
                                  )
                                )}
                              </select>
                            </label>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs">
                            <select
                              value={item.category_id || ''}
                              onChange={e =>
                                updateVoiceItem(idx, { category_id: e.target.value })
                              }
                              className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold outline-none max-w-[70%]"
                            >
                              {itemCategories.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                              {!cat && <option value={item.category_id || ''}>Lainnya</option>}
                            </select>
                          </div>
                        )}

                        {item.amount <= 0 && (
                          <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            Nominal belum terbaca. Isi manual sebelum menyimpan.
                          </p>
                        )}

                        {item.note && (
                          <p className="text-[10px] text-slate-400 italic truncate" title={item.note}>
                            “{item.note}”
                          </p>
                        )}

                        {item.occurred_at && (
                          <p className="text-[10px] text-slate-400">
                            Tanggal: {formatDateTimeID(item.occurred_at)}
                          </p>
                        )}
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
                Pindai struk belanja atau bukti transfer bank/e-wallet via OCR on-device WebAssembly (100% lokal & privat).
              </p>

              <div className="flex items-center justify-center">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                  isPinkTheme ? 'bg-pink-100 text-pink-700' : 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                }`}>
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>OCR On-Device (Tesseract Wasm)</span>
                </span>
              </div>

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
                    <button
                      type="button"
                      onClick={handleNativeCamera}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1 active:scale-95 transition ${
                        isPinkTheme ? 'bg-pink-100 text-pink-800' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Foto Ulang</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleNativeGallery}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1 active:scale-95 transition ${
                        isPinkTheme ? 'bg-pink-100 text-pink-800' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Pilih Galeri</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleNativeCamera}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition active:scale-95 flex flex-col items-center justify-center gap-1.5 ${
                      isPinkTheme ? 'border-pink-200 bg-white hover:border-pink-400' : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500'
                    }`}
                  >
                    <Camera className={`w-6 h-6 ${isPinkTheme ? 'text-rose-500' : 'text-emerald-600'}`} />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Ambil Kamera
                    </span>
                    <span className="text-[10px] text-slate-400">Foto nota langsung</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNativeGallery}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition active:scale-95 flex flex-col items-center justify-center gap-1.5 ${
                      isPinkTheme ? 'border-pink-200 bg-white hover:border-pink-400' : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500'
                    }`}
                  >
                    <UploadCloud className={`w-6 h-6 ${isPinkTheme ? 'text-rose-500' : 'text-emerald-600'}`} />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Pilih Galeri
                    </span>
                    <span className="text-[10px] text-slate-400">Dari album foto</span>
                  </button>
                </div>
              )}

              {isOcrProcessing && (
                <div className="p-3 rounded-2xl border border-emerald-200/70 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 flex items-center gap-3 text-left">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {ocrProgressText || 'Membaca nota dengan OCR on-device...'}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Biasanya 2–5 detik. Hasil tetap bisa diedit sebelum disimpan.
                    </p>
                  </div>
                </div>
              )}

              {ocrError && !isOcrProcessing && (
                <div className="p-2.5 rounded-xl border border-amber-200/70 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 text-left">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                        OCR belum berhasil membaca teks
                      </p>
                      <p className="text-[10px] leading-relaxed text-amber-700/90 dark:text-amber-300/90 mt-0.5">
                        {ocrError}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            void handleRetryAIScan();
                          }}
                          disabled={!uploadedImageUrl}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold active:scale-95 transition disabled:opacity-50"
                        >
                          Coba Pindai Ulang
                        </button>
                        <button
                          type="button"
                          onClick={handleReparseLocal}
                          className="px-2.5 py-1.5 rounded-lg bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-amber-200/70 dark:border-amber-900/60 text-[10px] font-bold active:scale-95 transition"
                        >
                          Parser Lokal
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Editable OCR text area (FR-10: Layar konfirmasi dengan bidang yang dapat diedit) */}
              {ocrEditText && (
                <div className="text-left space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Koreksi Teks Nota ({ocrEngine === 'gemini' ? 'Gemini AI' : 'On-Device OCR'}):
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
                  <div className="flex items-center justify-between gap-2 border-b pb-2 border-slate-200/80 dark:border-slate-700">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-slate-600 dark:text-slate-300">Hasil Parser Dokumen</span>
                      {ocrEngine && (
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                            ocrEngine === 'gemini'
                              ? 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-300'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {ocrEngine === 'gemini' ? 'Gemini AI' : 'OCR Lokal'}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md text-[10px] shrink-0">
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
                    {ocrParsedResult.occurred_at && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Tanggal:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {formatDateTimeID(ocrParsedResult.occurred_at)}
                        </span>
                      </div>
                    )}
                    {ocrParsedResult.to_account_id && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Dompet Tujuan:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {accounts.find(account => account.id === ocrParsedResult.to_account_id)?.name ||
                            ocrParsedResult.to_account_id}
                        </span>
                      </div>
                    )}
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
                        <span className={`text-[10px] font-semibold ${isPinkTheme ? 'text-pink-600' : 'text-emerald-600'}`}>Pecah Item</span>
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
        </div>

        {/* Manual Save Footer (fixed outside scroll area) */}
        {activeTab === 'manual' && (
          <div className={`shrink-0 flex gap-2 px-4 pt-3 pb-safe-bottom border-t ${
            isPinkTheme
              ? 'bg-[#FFF5F7] border-pink-200/60'
              : 'bg-white dark:bg-[#111827] border-slate-100 dark:border-slate-800/80'
          }`}>
            <button
              onClick={() => handleSaveManual(true)}
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition active:scale-95 min-h-[44px] ${
                isPinkTheme
                  ? 'bg-pink-100 text-pink-800 hover:bg-pink-200'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
              }`}
            >
              + Tambah Lagi
            </button>
            <button
              onClick={() => handleSaveManual(false)}
              className={`flex-1 py-2.5 rounded-2xl text-xs font-bold shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5 min-h-[44px] ${
                isPinkTheme
                  ? 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 shadow-rose-300/40 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Simpan Transaksi</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
