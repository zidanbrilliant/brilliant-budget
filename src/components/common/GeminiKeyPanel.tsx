import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
  AlertCircle,
  Zap,
} from 'lucide-react';
import {
  getEngineMode,
  setEngineMode,
  type ProcessingEngineMode,
} from '../../utils/aiMode';
import {
  clearStoredGeminiKey,
  getAIStatus,
  getStoredGeminiKey,
  maskGeminiKey,
  setStoredGeminiKey,
  testGeminiKey,
  GeminiError,
  geminiErrorMessage,
  type AIStatus,
} from '../../services/gemini';

type MessageKind = 'success' | 'error' | 'info';

interface PanelMessage {
  kind: MessageKind;
  text: string;
}

export const GeminiKeyPanel: React.FC = () => {
  const { settings, showToast } = useApp();
  const isPinkTheme = settings.theme === 'pink';

  const [engineMode, setEngineModeState] = useState<ProcessingEngineMode>(() => getEngineMode());
  const [savedKey, setSavedKey] = useState(() => getStoredGeminiKey());
  const [inputKey, setInputKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<PanelMessage | null>(null);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) setEngineModeState(e.detail);
    };
    window.addEventListener('bb_engine_mode_changed', handler);
    return () => window.removeEventListener('bb_engine_mode_changed', handler);
  }, []);

  useEffect(() => {
    let mounted = true;
    getAIStatus(true)
      .then(nextStatus => {
        if (mounted) setStatus(nextStatus);
      })
      .catch(() => {
        if (mounted) setStatus(null);
      })
      .finally(() => {
        if (mounted) setIsLoadingStatus(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const refreshStatus = async () => {
    const nextStatus = await getAIStatus(true);
    setStatus(nextStatus);
    return nextStatus;
  };

  const handleSaveAndTest = async () => {
    const trimmed = inputKey.trim();
    if (trimmed.length < 20) {
      setMessage({
        kind: 'error',
        text: 'Kunci Gemini terlalu pendek. Salin ulang kunci dari Google AI Studio.',
      });
      return;
    }

    setStoredGeminiKey(trimmed);
    setSavedKey(trimmed);
    setInputKey('');
    setIsTesting(true);
    setMessage({ kind: 'info', text: 'Menguji kunci ke Gemini...' });

    try {
      const model = await testGeminiKey(trimmed);
      await refreshStatus();
      setMessage({
        kind: 'success',
        text: `Kunci valid. Model aktif: ${model}. Suara dan scan nota siap dipakai.`,
      });
      showToast('Gemini AI aktif');
    } catch (error) {
      if (error instanceof GeminiError && error.code === 'auth') {
        clearStoredGeminiKey();
        setSavedKey('');
      }
      setMessage({ kind: 'error', text: geminiErrorMessage(error) });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestSaved = async () => {
    if (!savedKey) {
      const nextStatus = await refreshStatus();
      setMessage({
        kind: nextStatus.server_available ? 'success' : 'info',
        text: nextStatus.server_available
          ? 'Server AI sudah aktif. Kunci perangkat tidak diperlukan.'
          : 'Belum ada kunci. Tempel kunci Gemini gratis di atas.',
      });
      return;
    }

    setIsTesting(true);
    setMessage({ kind: 'info', text: 'Menguji kunci tersimpan...' });
    try {
      const model = await testGeminiKey(savedKey);
      await refreshStatus();
      setMessage({ kind: 'success', text: `Kunci valid. Model aktif: ${model}.` });
    } catch (error) {
      setMessage({ kind: 'error', text: geminiErrorMessage(error) });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRemove = async () => {
    clearStoredGeminiKey();
    setSavedKey('');
    setInputKey('');
    setMessage({ kind: 'info', text: 'Kunci Gemini di perangkat ini dihapus.' });
    try {
      await refreshStatus();
    } catch {
      setStatus(null);
    }
    showToast('Kunci Gemini dihapus');
  };

  const cardClass = isPinkTheme
    ? 'bg-white border-pink-200/80 text-[#37131D]'
    : 'bg-white dark:bg-[#151E2E] border-slate-200/80 dark:border-slate-800/80 text-slate-900 dark:text-white';
  const fieldClass = isPinkTheme
    ? 'bg-pink-50/60 border-pink-200 text-[#37131D] placeholder:text-pink-300 focus:border-pink-400'
    : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-slate-300 dark:focus:border-slate-700';
  const primaryBtn = isPinkTheme
    ? 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white shadow-xs shadow-rose-200'
    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs';
  const secondaryBtn = isPinkTheme
    ? 'bg-pink-100 text-pink-700 hover:bg-pink-200'
    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700';
  const mutedText = isPinkTheme ? 'text-pink-500/80' : 'text-slate-400';
  const active = Boolean(status?.available);

  const messageClass =
    message?.kind === 'success'
      ? isPinkTheme
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-800/60'
      : message?.kind === 'error'
        ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200/70 dark:border-rose-900/60'
        : isPinkTheme
          ? 'bg-pink-50 text-pink-700 border-pink-200'
          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-700';

  return (
    <div className="space-y-3.5">
      {/* Pilihan Engine Utama */}
      <div className={`rounded-2xl p-4 border shadow-xs space-y-3 ${cardClass}`}>
        <div>
          <h3 className="font-bold text-sm">Mode Ekstraksi Utama</h3>
          <p className={`text-[11px] mt-0.5 ${mutedText}`}>
            Tentukan engine untuk memproses input suara & scan nota
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setEngineMode('local');
              setEngineModeState('local');
              showToast('Mode Lokal On-Device aktif (Instan & Bebas Kuota)');
            }}
            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
              engineMode === 'local'
                ? isPinkTheme
                  ? 'border-rose-400 bg-rose-50/60 text-rose-950'
                  : 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400 opacity-70 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5 font-bold text-xs">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                Lokal On-Device
              </span>
              {engineMode === 'local' && (
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              )}
            </div>
            <p className="text-[10px] leading-tight text-slate-500 dark:text-slate-400">
              Instan &lt;100ms, 100% on-device, tanpa kuota, tanpa batas timeout.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setEngineMode('cloud');
              setEngineModeState('cloud');
              showToast('Mode Cloud Gemini aktif');
            }}
            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
              engineMode === 'cloud'
                ? isPinkTheme
                  ? 'border-rose-400 bg-rose-50/60 text-rose-950'
                  : 'border-fuchsia-500 bg-fuchsia-50/60 dark:bg-fuchsia-950/40 text-fuchsia-950 dark:text-fuchsia-100'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400 opacity-70 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5 font-bold text-xs">
                <Sparkles className="w-3.5 h-3.5 text-fuchsia-500" />
                Cloud Gemini
              </span>
              {engineMode === 'cloud' && (
                <span className="w-2 h-2 rounded-full bg-fuchsia-500"></span>
              )}
            </div>
            <p className="text-[10px] leading-tight text-slate-500 dark:text-slate-400">
              Membutuhkan koneksi serverless / BYOK Gemini.
            </p>
          </button>
        </div>
      </div>

      <div className={`rounded-2xl p-4 border shadow-xs space-y-3.5 ${cardClass}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-rose-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Gemini AI</h3>
              <p className={`text-[11px] ${mutedText}`}>
                Input suara & scan nota dengan AI gratis
              </p>
            </div>
          </div>
          <span
            className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap ${
              active
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {isLoadingStatus ? 'Memeriksa...' : active ? 'Aktif' : 'Belum aktif'}
          </span>
        </div>

        <p className={`text-xs leading-relaxed ${isPinkTheme ? 'text-pink-900/70' : 'text-slate-500 dark:text-slate-400'}`}>
          Gemini mengubah ucapan dan foto struk menjadi transaksi terstruktur: total, merchant,
          kategori, dompet, tanggal, dan rincian item. Jika AI tidak tersedia, aplikasi otomatis
          memakai parser lokal dan OCR on-device.
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 font-medium">
              <Server className={`w-3.5 h-3.5 ${mutedText}`} />
              Server AI
            </span>
            <span
              className={`font-bold flex items-center gap-1 ${
                status?.server_available
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-400'
              }`}
            >
              {status?.server_available ? (
                <Wifi className="w-3.5 h-3.5" />
              ) : (
                <WifiOff className="w-3.5 h-3.5" />
              )}
              {status?.server_available ? 'Aktif' : 'Belum aktif'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 font-medium">
              <KeyRound className={`w-3.5 h-3.5 ${mutedText}`} />
              Kunci perangkat
            </span>
            <span
              className={`font-bold ${
                savedKey ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
              }`}
            >
              {savedKey ? maskGeminiKey(savedKey) : 'Belum ada'}
            </span>
          </div>
        </div>
      </div>

      <div className={`rounded-2xl p-4 border shadow-xs space-y-3 ${cardClass}`}>
        <div>
          <label className="text-[11px] font-bold uppercase block mb-1.5">
            Kunci API Gemini (opsional)
          </label>
          <p className={`text-[11px] leading-relaxed ${mutedText}`}>
            Tempel kunci dari Google AI Studio. Kunci hanya disimpan di perangkat ini dan dikirim
            langsung ke Google, bukan ke server Brilliant Budget.
          </p>
        </div>

        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={inputKey}
            onChange={event => setInputKey(event.target.value)}
            placeholder={savedKey ? 'Tempel kunci baru untuk mengganti...' : 'AQ.Ab8... atau AIza...'}
            autoComplete="off"
            spellCheck={false}
            className={`w-full px-3 py-2.5 pr-10 rounded-xl border outline-none text-xs font-mono transition ${fieldClass}`}
          />
          <button
            type="button"
            onClick={() => setShowKey(value => !value)}
            aria-label={showKey ? 'Sembunyikan kunci' : 'Tampilkan kunci'}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition ${secondaryBtn}`}
          >
            {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSaveAndTest}
            disabled={isTesting || inputKey.trim().length === 0}
            className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 ${primaryBtn}`}
          >
            {isTesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>{isTesting ? 'Menguji...' : 'Simpan & Uji'}</span>
          </button>

          <button
            type="button"
            onClick={handleTestSaved}
            disabled={isTesting}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50 ${secondaryBtn}`}
          >
            Uji Koneksi
          </button>

          {savedKey && (
            <button
              type="button"
              onClick={handleRemove}
              aria-label="Hapus kunci Gemini"
              className="py-2.5 px-3 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-950/70 transition active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {message && (
          <div className={`p-2.5 rounded-xl border text-[11px] leading-relaxed flex items-start gap-2 ${messageClass}`}>
            {message.kind === 'error' ? (
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            ) : (
              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noreferrer"
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${
            isPinkTheme ? 'text-pink-600 hover:text-pink-700' : 'text-emerald-600 dark:text-emerald-400 hover:underline'
          }`}
        >
          <span>Dapatkan kunci Gemini gratis</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div
        className={`rounded-2xl p-3.5 border text-[11px] leading-relaxed flex items-start gap-2.5 ${
          isPinkTheme
            ? 'bg-pink-50/70 border-pink-200 text-pink-900/70'
            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-700/60 text-slate-500 dark:text-slate-400'
        }`}
      >
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
        <div className="space-y-1">
          <p className="font-bold">Keamanan & biaya</p>
          <p>
            Kunci perangkat tidak masuk ke bundle aplikasi dan tidak dikirim ke server kami.
            Untuk pemakaian bersama, lebih aman menambahkan <code>GEMINI_API_KEY</code> sebagai
            environment variable di Vercel. Gemini Flash memiliki kuota gratis harian.
          </p>
        </div>
      </div>
    </div>
  );
};
