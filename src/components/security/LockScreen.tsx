import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, Fingerprint } from 'lucide-react';

export const LockScreen: React.FC = () => {
  const { isLocked, setIsLocked, settings } = useApp();
  const [pinInput, setPinInput] = useState('');
  const [isBiometricAuthenticating, setIsBiometricAuthenticating] = useState(false);

  const isPinkTheme = settings.theme === 'pink';

  if (!isLocked) return null;

  const handleKeyClick = (num: string) => {
    if (pinInput.length < 4) {
      const next = pinInput + num;
      setPinInput(next);
      if (next.length === 4) {
        setTimeout(() => {
          setIsLocked(false);
          setPinInput('');
        }, 250);
      }
    }
  };

  const handleBackspace = () => {
    setPinInput(prev => prev.slice(0, -1));
  };

  const handleSimulateFaceID = () => {
    setIsBiometricAuthenticating(true);
    setTimeout(() => {
      setIsBiometricAuthenticating(false);
      setIsLocked(false);
    }, 600);
  };

  return (
    <div className={`fixed inset-0 z-50 ${isPinkTheme ? 'bg-[#2E1019]/96' : 'bg-[#0B0F19]/95'} backdrop-blur-xl flex flex-col items-center justify-between px-6 py-4 text-white select-none animate-scale-up`}>
      <div className="w-full flex justify-center pt-safe-top">
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${isPinkTheme ? 'text-pink-200 bg-pink-900/60 border-pink-700/60' : 'text-slate-300 bg-slate-800/80 border-slate-700/60'} px-3.5 py-1.5 rounded-full border shadow-xs`}>
          <ShieldCheck className={`w-3.5 h-3.5 ${isPinkTheme ? 'text-rose-400' : 'text-emerald-400'}`} />
          <span>{isPinkTheme ? 'Brilliant Budget Terkunci 🎀' : 'Brilliant Budget Terkunci'}</span>
        </div>
      </div>

      {/* Center Biometrics / PIN Dots */}
      <div className="flex flex-col items-center space-y-4">
        <button
          onClick={handleSimulateFaceID}
          className={`w-16 h-16 rounded-full ${isPinkTheme ? 'bg-pink-950/80 border-pink-700/70' : 'bg-slate-800/80 border-slate-700/80'} border flex items-center justify-center hover:scale-105 active:scale-95 transition shadow-xs group`}
        >
          <Fingerprint
            className={`w-8 h-8 ${
              isBiometricAuthenticating ? (isPinkTheme ? 'text-rose-400 animate-pulse' : 'text-emerald-400 animate-pulse') : 'text-slate-300'
            }`}
          />
        </button>

        <div className="text-center">
          <h2 className="text-base font-bold tracking-tight">Masukkan Kode Sandi</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gunakan Face ID atau ketik 4 digit
          </p>
        </div>

        {/* 4 PIN Dots */}
        <div className="flex gap-4 pt-1">
          {[0, 1, 2, 3].map(idx => (
            <div
              key={idx}
              className={`w-3 h-3 rounded-full border border-slate-600 transition-all ${
                pinInput.length > idx ? (isPinkTheme ? 'bg-rose-400 border-rose-400 scale-110' : 'bg-white border-white scale-110') : 'bg-transparent'
              }`}
            ></div>
          ))}
        </div>
      </div>

      {/* Keypad with Bottom Safe Area Clearance */}
      <div className="w-full max-w-xs grid grid-cols-3 gap-3 pb-safe-bottom place-items-center">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'FaceID', '0', '⌫'].map(key => {
          if (key === 'FaceID') {
            return (
              <button
                key={key}
                onClick={handleSimulateFaceID}
                className="w-16 h-16 rounded-full flex items-center justify-center text-xs font-semibold text-emerald-400 hover:bg-slate-800 transition active:scale-95"
              >
                Face ID
              </button>
            );
          }
          if (key === '⌫') {
            return (
              <button
                key={key}
                onClick={handleBackspace}
                className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold text-slate-400 hover:bg-slate-800 transition active:scale-95"
              >
                ⌫
              </button>
            );
          }
          return (
            <button
              key={key}
              onClick={() => handleKeyClick(key)}
              className="w-16 h-16 rounded-full bg-slate-800/80 hover:bg-slate-700/80 active:bg-slate-600 flex items-center justify-center text-xl font-bold transition active:scale-95 tabular-nums"
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
};
