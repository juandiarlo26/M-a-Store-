import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

const MAX_FALLBACK_DATA_URL_LENGTH = 140000;
const STORAGE_MAX_SIDE = 1600;
const STORAGE_QUALITY = 0.82;
const STORAGE_UPLOAD_TIMEOUT_MS = 6500;

export interface UploadProductImageResult {
  url: string;
  sizeKb: number;
  source: 'storage' | 'inline-webp';
  fallbackReason?: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('No pudimos leer el archivo de imagen.'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer la imagen seleccionada.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('El archivo seleccionado no es una imagen válida.'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

function validateImageFile(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Por favor selecciona un archivo de imagen (JPG, PNG o WebP).');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('La imagen pesa más de 20 MB. Elige una foto más ligera.');
  }
}

function drawResizedCanvas(img: HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const natW = img.naturalWidth || maxSide;
  const natH = img.naturalHeight || maxSide;
  const scale = Math.min(1, maxSide / Math.max(natW, natH));
  const width = Math.max(1, Math.round(natW * scale));
  const height = Math.max(1, Math.round(natH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Tu navegador no pudo procesar la imagen.');
  }

  ctx.fillStyle = '#F8EFEA';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function compressToInlineWebpDataUrl(img: HTMLImageElement): { dataUrl: string; sizeKb: number } {
  const dimensionSteps = [1000, 800, 640, 480];
  const qualitySteps = [0.78, 0.66, 0.54, 0.42];

  for (const maxSide of dimensionSteps) {
    const canvas = drawResizedCanvas(img, maxSide);
    for (const quality of qualitySteps) {
      let candidate = canvas.toDataURL('image/webp', quality);
      if (!candidate.startsWith('data:image/webp')) {
        candidate = canvas.toDataURL('image/jpeg', quality);
      }
      if (candidate.length <= MAX_FALLBACK_DATA_URL_LENGTH) {
        const sizeKb = Math.max(1, Math.round((candidate.length * 0.75) / 1024));
        return { dataUrl: candidate, sizeKb };
      }
    }
  }

  throw new Error(
    'La imagen sigue siendo demasiado pesada tras optimizarla. Prueba con otra fotografía.'
  );
}

function sanitizeStorageProductId(productId: string): string {
  const clean = productId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
  return clean || 'prenda';
}

export async function uploadProductImage(
  file: File,
  productId: string
): Promise<UploadProductImageResult> {
  validateImageFile(file);

  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(rawDataUrl);

  // Primary path: compress to WebP (max 1600px, quality 0.82) & upload to Firebase Storage
  const storageCanvas = drawResizedCanvas(img, STORAGE_MAX_SIDE);
  let blob = await canvasToBlob(storageCanvas, 'image/webp', STORAGE_QUALITY);
  let ext = 'webp';
  if (!blob || blob.type !== 'image/webp') {
    blob = await canvasToBlob(storageCanvas, 'image/jpeg', STORAGE_QUALITY);
    ext = 'jpg';
  }

  if (blob && blob.size < 2 * 1024 * 1024) {
    const safeProductId = sanitizeStorageProductId(productId);
    const objectPath = `products/${safeProductId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const storageRef = ref(storage, objectPath);

    try {
      const uploadTask = (async () => {
        await uploadBytes(storageRef, blob, {
          contentType: blob.type || 'image/webp',
          cacheControl: 'public, max-age=31536000',
        });
        return getDownloadURL(storageRef);
      })();

      const timeoutPromise = new Promise<never>((_, reject) => {
        window.setTimeout(
          () => reject(new Error('Tiempo de espera agotado al conectar con Firebase Storage.')),
          STORAGE_UPLOAD_TIMEOUT_MS
        );
      });

      const downloadUrl = await Promise.race([uploadTask, timeoutPromise]);
      return {
        url: downloadUrl,
        sizeKb: Math.max(1, Math.round(blob.size / 1024)),
        source: 'storage',
      };
    } catch (storageErr) {
      const reason =
        storageErr instanceof Error
          ? storageErr.message
          : 'Firebase Storage no está disponible en este momento.';
      const fallback = compressToInlineWebpDataUrl(img);
      return {
        url: fallback.dataUrl,
        sizeKb: fallback.sizeKb,
        source: 'inline-webp',
        fallbackReason: reason,
      };
    }
  }

  const fallback = compressToInlineWebpDataUrl(img);
  return {
    url: fallback.dataUrl,
    sizeKb: fallback.sizeKb,
    source: 'inline-webp',
    fallbackReason: 'La imagen optimizada superó el límite de Firebase Storage.',
  };
}

export async function compressImageFileForCatalog(file: File): Promise<{
  dataUrl: string;
  sizeKb: number;
}> {
  validateImageFile(file);
  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(rawDataUrl);
  return compressToInlineWebpDataUrl(img);
}
