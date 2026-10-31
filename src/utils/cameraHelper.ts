import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

const UPLOAD_STATE_KEY = 'CATAT_PENDING_UPLOAD_MODE';

export function savePendingUpload(mode: 'ocr') {
  try {
    sessionStorage.setItem(UPLOAD_STATE_KEY, JSON.stringify({ mode, time: Date.now() }));
  } catch {}
}

export function consumePendingUpload(): 'ocr' | null {
  try {
    const raw = sessionStorage.getItem(UPLOAD_STATE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(UPLOAD_STATE_KEY);
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.time < 300000) {
      return parsed.mode;
    }
  } catch {}
  return null;
}

export async function downscaleImage(dataUrl: string, maxDimension = 1200): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function pickPhoto(source: 'camera' | 'photos'): Promise<string | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      width: 1200,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
    });
    if (photo.dataUrl) {
      return await downscaleImage(photo.dataUrl);
    }
  } catch (err: any) {
    const msg = String(err?.message || err).toLowerCase();
    if (msg.includes('cancel') || msg.includes('user cancelled')) {
      return null;
    }
  }
  return null;
}
