// ponytail: client-side Tesseract WebAssembly OCR with contrast enhancement & dual ind+eng language
import { createWorker } from 'tesseract.js';

let workerPromise: Promise<any> | null = null;
let currentProgressCallback: ((progress: number, status: string) => void) | null = null;

async function getWorker(onProgress?: (progress: number, status: string) => void) {
  if (onProgress) currentProgressCallback = onProgress;
  if (!workerPromise) {
    workerPromise = (async () => {
      try {
        const worker = await createWorker(['ind', 'eng'], 1, {
          logger: (m: any) => {
            if (currentProgressCallback && m && typeof m.progress === 'number') {
              currentProgressCallback(Math.round(m.progress * 100), m.status || 'Memproses OCR');
            }
          },
        });
        return worker;
      } catch (err) {
        console.warn('OCR dual-lang worker init failed, trying eng:', err);
        try {
          const fallbackWorker = await createWorker('eng', 1, {
            logger: (m: any) => {
              if (currentProgressCallback && m && typeof m.progress === 'number') {
                currentProgressCallback(Math.round(m.progress * 100), m.status || 'Memproses OCR');
              }
            },
          });
          return fallbackWorker;
        } catch (err2) {
          console.warn('OCR fallback worker init failed:', err2);
          workerPromise = null;
          return null;
        }
      }
    })();
  }
  return workerPromise;
}

export async function preprocessReceiptImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxW = 1400;
      const scale = Math.min(1.5, maxW / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        const totalPixels = d.length / 4;
        const grays = new Float32Array(totalPixels);

        let min = 255;
        let max = 0;
        for (let i = 0, j = 0; i < d.length; i += 4, j++) {
          const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
          grays[j] = g;
          if (g < min) min = g;
          if (g > max) max = g;
        }

        const range = Math.max(1, max - min);
        for (let i = 0, j = 0; i < d.length; i += 4, j++) {
          const normalized = ((grays[j] - min) / range) * 255;
          const enhanced = normalized < 135 ? normalized * 0.82 : Math.min(255, normalized * 1.12 + 10);
          d[i] = enhanced;
          d[i + 1] = enhanced;
          d[i + 2] = enhanced;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function recognizeReceiptText(
  dataUrl: string,
  onProgress?: (progress: number, status: string) => void
): Promise<string | null> {
  try {
    const worker = await Promise.race([
      getWorker(onProgress),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 25000)),
    ]);

    if (!worker) return null;

    const preprocessed = await preprocessReceiptImage(dataUrl);
    const { data } = await worker.recognize(preprocessed);
    return data?.text?.trim() || null;
  } catch (err) {
    console.warn('Tesseract OCR recognition error:', err);
    return null;
  }
}
