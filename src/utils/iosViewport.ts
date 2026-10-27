export interface IosNavGapProbe {
  isIOS: boolean;
  isStandalone: boolean;
  isPortrait: boolean;
  safeBottom: number;
  screenHeight: number;
  innerHeight: number;
  visualViewportHeight?: number;
}

/**
 * iOS 26 standalone PWAs report a layout viewport that already excludes the
 * bottom safe area, while the TabBar still applies env(safe-area-inset-bottom).
 * That double inset is what makes the bar look "high" on short pages.
 *
 * We only opt into the CSS patch when the measured viewport gap matches the
 * device's bottom inset. Older iOS versions (where 100dvh already includes the
 * safe area) keep the original layout.
 */
export function shouldApplyIosNavGap(probe: IosNavGapProbe): boolean {
  if (!probe.isIOS || !probe.isStandalone || !probe.isPortrait) return false;
  if (!Number.isFinite(probe.safeBottom) || probe.safeBottom <= 0) return false;

  const screenGap = probe.screenHeight - probe.innerHeight;
  if (Math.abs(screenGap - probe.safeBottom) <= 4) return true;

  if (
    typeof probe.visualViewportHeight === 'number' &&
    Number.isFinite(probe.visualViewportHeight)
  ) {
    const visualGap = Math.abs(probe.visualViewportHeight - probe.innerHeight);
    if (Math.abs(visualGap - probe.safeBottom) <= 4) return true;
  }

  return false;
}

export function isIosStandalone(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;

  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const nav = navigator as Navigator & { standalone?: boolean };
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;

  return isIOS && isStandalone;
}

export function measureSafeAreaBottom(): number {
  if (typeof document === 'undefined' || !document.body) return 0;

  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;left:0;bottom:0;width:1px;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none;';
  document.body.appendChild(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();
  return height;
}

export function applyIosNavGapFix(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Selalu evaluasi ulang agar kelas ikut dilepas saat rotasi ke landscape
  // atau saat aplikasi dibuka bukan sebagai PWA standalone.
  const canApply = isIosStandalone() && window.innerWidth <= window.innerHeight;
  let affected = false;

  if (canApply) {
    const safeBottom = measureSafeAreaBottom();
    affected = shouldApplyIosNavGap({
      isIOS: true,
      isStandalone: true,
      isPortrait: true,
      safeBottom,
      screenHeight: window.screen.height,
      innerHeight: window.innerHeight,
      visualViewportHeight: window.visualViewport?.height,
    });
  }

  document.documentElement.classList.toggle('ios-nav-gap', affected);
}
