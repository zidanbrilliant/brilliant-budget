import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getSheetWebhookUrl, setSheetWebhookUrl } from '../../services/googleSheets';
import {
  ShieldCheck,
  Zap,
  Wallet,
  PieChart,
  CheckCircle,
  ArrowRight,
  CloudDownload,
  Loader2,
} from 'lucide-react';

export const OnboardingModal: React.FC = () => {
  const { settings, updateSettings, restoreConfigFromSheet, showToast } = useApp();
  const [step, setStep] = useState(1);
  const [restoreUrl, setRestoreUrl] = useState(() => getSheetWebhookUrl());
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const isPinkTheme = settings.theme === 'pink';

  if (settings.onboarding_completed) return null;

  const handleFinish = () => {
    if (restoreUrl.trim()) setSheetWebhookUrl(restoreUrl);
    updateSettings({ onboarding_completed: true });
  };

  const handleRestore = async () => {
    if (!restoreUrl.trim()) {
      setRestoreMessage({ ok: false, text: 'Tempel URL Web App Apps Script terlebih dahulu.' });
      return;
    }

    setIsRestoring(true);
    setRestoreMessage(null);
    setSheetWebhookUrl(restoreUrl);

    const result = await restoreConfigFromSheet();
    setIsRestoring(false);
    setRestoreMessage({ ok: result.ok, text: result.message });
    if (result.ok) showToast(result.message);
  };

  const primaryButton = isPinkTheme
    ? 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 shadow-rose-300/40'
    : 'bg-emerald-600 hover:bg-emerald-500 shadow-xs';
  const fieldClass = `w-full px-3 py-2 rounded-xl border outline-none transition text-xs ${
    isPinkTheme
      ? 'bg-white border-pink-200 text-[#37131D] placeholder:text-pink-300 focus:border-pink-400'
      : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-900 dark:text-slate-100 focus:border-slate-300 dark:focus:border-slate-700'
  }`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className={`rounded-3xl p-6 max-w-sm w-full shadow-2xl border space-y-5 animate-scale-up ${
          isPinkTheme
            ? 'bg-[#FFF5F7] border-pink-200 text-[#37131D]'
            : 'bg-white dark:bg-[#151E2E] border-slate-200 dark:border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isPinkTheme ? 'text-pink-500' : 'text-slate-400'}`}>
            Langkah {step} dari 5
          </span>
          <button
            onClick={handleFinish}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition ${
              isPinkTheme
                ? 'text-pink-600 hover:bg-pink-100'
                : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            Lewati
          </button>
        </div>

        {/* Step Indicators */}
        <div className="flex gap-1.5" aria-hidden="true">
          {[1, 2, 3, 4, 5].map(s => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                step >= s
                  ? isPinkTheme
                    ? 'bg-rose-500'
                    : 'bg-emerald-600'
                  : isPinkTheme
                  ? 'bg-pink-200'
                  : 'bg-slate-200 dark:bg-slate-700'
              }`}
            ></div>
          ))}
        </div>

        {/* Screen 1: Welcome & Offline Principles */}
        {step === 1 && (
          <div className="text-center space-y-2.5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-2xs ${
              isPinkTheme
                ? 'bg-pink-100 text-pink-600'
                : 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
            }`}>
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2
              id="onboarding-title"
              className={`text-lg font-bold tracking-tight ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}
            >
              Selamat Datang di Brilliant Budget
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Aplikasi keuangan pribadi <strong>100% offline</strong>. Seluruh data tersimpan aman
              di perangkat Anda tanpa server dan tanpa pelacakan luar.
            </p>
          </div>
        )}

        {/* Screen 2: Restore from Google Sheets Config */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="text-center space-y-2.5">
              <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto shadow-2xs">
                <CloudDownload className="w-7 h-7" />
              </div>
              <h2 className={`text-lg font-bold tracking-tight ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
                Pulihkan Data Lama
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Baru pasang ulang atau ganti perangkat? Tempel URL Web App Apps Script yang sama
                untuk memulihkan dompet, kategori, budget, target, dan setelan.
              </p>
            </div>

            <div>
              <label className={`text-[11px] font-bold uppercase block mb-1 ${isPinkTheme ? 'text-pink-500/80' : 'text-slate-400'}`}>
                URL Webhook Apps Script
              </label>
              <input
                type="url"
                value={restoreUrl}
                onChange={e => setRestoreUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className={`${fieldClass} font-mono text-[11px]`}
              />
            </div>

            <button
              type="button"
              onClick={handleRestore}
              disabled={isRestoring || !restoreUrl.trim()}
              className={`w-full py-2.5 ${primaryButton} text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50`}
            >
              {isRestoring ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CloudDownload className="w-4 h-4" />
              )}
              <span>{isRestoring ? 'Memulihkan...' : 'Pulihkan Sekarang'}</span>
            </button>

            {restoreMessage && (
              <p
                className={`text-[11px] leading-relaxed rounded-xl px-3 py-2 ${
                  restoreMessage.ok
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                }`}
              >
                {restoreMessage.text}
              </p>
            )}

            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              Belum punya cadangan? Lewati langkah ini. Kamu bisa memulihkan kapan saja dari menu
              Lainnya → Google Sheets.
            </p>
          </div>
        )}

        {/* Screen 3: Dompet Awal */}
        {step === 3 && (
          <div className="text-center space-y-2.5">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-2xs">
              <Wallet className="w-7 h-7" />
            </div>
            <h2 className={`text-lg font-bold tracking-tight ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
              Siapkan Dompet Anda
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Brilliant Budget mendukung rekening bank, e-wallet (GoPay, OVO, ShopeePay), dan tunai.
              Saldo awal dapat disesuaikan kapan saja.
            </p>
          </div>
        )}

        {/* Screen 4: Metode Budgeting */}
        {step === 4 && (
          <div className="text-center space-y-2.5">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto shadow-2xs">
              <PieChart className="w-7 h-7" />
            </div>
            <h2 className={`text-lg font-bold tracking-tight ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
              Pilih Gaya Budgeting
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Pilih metode anggaran: batas total bulanan, amplop pengeluaran, atau aturan 50/30/20.
              Dapat berganti kapan saja tanpa kehilangan data.
            </p>
          </div>
        )}

        {/* Screen 5: Kecepatan Mencatat */}
        {step === 5 && (
          <div className="text-center space-y-2.5">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-2xs">
              <Zap className="w-7 h-7" />
            </div>
            <h2 className={`text-lg font-bold tracking-tight ${isPinkTheme ? 'text-[#881337]' : 'text-slate-900 dark:text-white'}`}>
              Catat Dalam ≤ 5 Detik
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Gunakan suara, foto nota, scan QRIS, atau keypad cepat dengan tombol <strong>000</strong>.
              Data langsung terekam dengan rapi!
            </p>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="pt-1">
          {step < 5 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className={`w-full py-2.5 ${primaryButton} text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95`}
            >
              <span>Lanjut</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className={`w-full py-2.5 ${primaryButton} text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>Mulai Mencatat 🌸</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
