import { createWorker } from 'tesseract.js';

let workerPromise: Promise<any> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('ind', 1, {
        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@v5.0.0/dist/worker.min.js',
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0/tesseract-core.wasm.js',
        logger: () => {},
      });
      return worker;
    })().catch((err) => {
      console.warn('OCR worker init fallback:', err);
      workerPromise = null;
      return null;
    });
  }
  return workerPromise;
}

export async function preprocessReceiptImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxW = 1200;
      const scale = Math.min(1, maxW / img.width);
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
        for (let i = 0; i < d.length; i += 4) {
          const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
          d[i] = gray;
          d[i + 1] = gray;
          d[i + 2] = gray;
        }
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function recognizeReceiptText(dataUrl: string): Promise<string | null> {
  try {
    const worker = await Promise.race([
      getWorker(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
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
