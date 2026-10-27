import assert from 'node:assert';
import { shouldApplyIosNavGap } from '../src/utils/iosViewport.ts';

console.log('--- Testing iOS Standalone Nav Gap Detection ---');

const base = {
  isIOS: true,
  isStandalone: true,
  isPortrait: true,
  safeBottom: 34,
  screenHeight: 844,
  innerHeight: 810,
  visualViewportHeight: 810,
};

assert.strictEqual(
  shouldApplyIosNavGap(base),
  true,
  'iOS 26 standalone dengan gap 34px harus terdeteksi'
);
assert.strictEqual(
  shouldApplyIosNavGap({ ...base, isIOS: false }),
  false,
  'Android tidak boleh kena patch iOS'
);
assert.strictEqual(
  shouldApplyIosNavGap({ ...base, isStandalone: false }),
  false,
  'Browser tab biasa tidak boleh kena patch'
);
assert.strictEqual(
  shouldApplyIosNavGap({ ...base, isPortrait: false }),
  false,
  'Landscape tidak boleh kena patch'
);
assert.strictEqual(
  shouldApplyIosNavGap({ ...base, safeBottom: 0 }),
  false,
  'Tanpa safe area tidak perlu patch'
);
assert.strictEqual(
  shouldApplyIosNavGap({
    ...base,
    screenHeight: 844,
    innerHeight: 844,
    visualViewportHeight: 844,
  }),
  false,
  'iOS lama yang sudah memasukkan safe area tidak boleh kena patch'
);
assert.strictEqual(
  shouldApplyIosNavGap({
    ...base,
    screenHeight: 900,
    innerHeight: 820,
    visualViewportHeight: 800,
  }),
  false,
  'Gap yang tidak cocok dengan safe area tidak boleh kena patch'
);
assert.strictEqual(
  shouldApplyIosNavGap({
    ...base,
    screenHeight: 900,
    innerHeight: 820,
    visualViewportHeight: 786,
  }),
  true,
  'Fallback visualViewport harus mendeteksi gap yang sama'
);

console.log('=== SEMUA PENGUJIAN IOS NAV GAP LULUS ===');
