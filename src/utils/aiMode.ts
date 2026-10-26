// ponytail: local vs cloud engine preference - default local on-device for zero timeout & zero cost
export type ProcessingEngineMode = 'local' | 'cloud';

const STORAGE_ENGINE_KEY = 'bb_engine_mode';

export function getEngineMode(): ProcessingEngineMode {
  try {
    const val = localStorage.getItem(STORAGE_ENGINE_KEY);
    return val === 'cloud' ? 'cloud' : 'local';
  } catch {
    return 'local';
  }
}

export function setEngineMode(mode: ProcessingEngineMode): void {
  try {
    localStorage.setItem(STORAGE_ENGINE_KEY, mode);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bb_engine_mode_changed', { detail: mode }));
    }
  } catch {}
}
