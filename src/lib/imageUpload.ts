const MAX_DATA_URL_LENGTH = 360000;

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

export async function compressImageFileForCatalog(file: File): Promise<{
  dataUrl: string;
  sizeKb: number;
}> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Por favor selecciona un archivo de imagen (JPG, PNG o WebP).');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('La imagen pesa más de 20 MB. Elige una foto más ligera.');
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(rawDataUrl);

  const dimensionSteps = [960, 780, 620];
  const qualitySteps = [0.84, 0.72, 0.58, 0.45];

  for (const maxSide of dimensionSteps) {
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const width = Math.max(1, Math.round((img.naturalWidth || maxSide) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || maxSide) * scale));

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

    for (const quality of qualitySteps) {
      const candidate = canvas.toDataURL('image/jpeg', quality);
      if (candidate.length <= MAX_DATA_URL_LENGTH) {
        const sizeKb = Math.max(1, Math.round((candidate.length * 0.75) / 1024));
        return { dataUrl: candidate, sizeKb };
      }
    }
  }

  throw new Error(
    'La imagen sigue siendo demasiado pesada tras optimizarla. Prueba con otra fotografía.'
  );
}
