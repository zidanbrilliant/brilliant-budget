export const DEFAULT_PIN_HASH = '3e6f586ebe5cc35fde9659de4ce0591799eb634bc82eec18492416e991be614a';

export async function hashPin(pin: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(`catat_salt_${pin}`));
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    hash = (hash << 5) - hash + pin.charCodeAt(i);
    hash |= 0;
  }
  return `h_${hash}`;
}

export async function verifyPin(inputPin: string, targetHash?: string): Promise<boolean> {
  const hash = targetHash || DEFAULT_PIN_HASH;
  const computed = await hashPin(inputPin);
  return computed === hash;
}
