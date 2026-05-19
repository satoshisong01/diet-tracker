// Client-side image utilities — resize + JPEG-compress before upload
// so Gemini Vision calls stay fast & cheap.

export type CompressedImage = { base64: string; mimeType: string; sizeKB: number };

export async function compressImage(
  file: File,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<CompressedImage> {
  const maxDim = opts.maxDim ?? 1024;
  const quality = opts.quality ?? 0.82;

  const bitmap = await createImageBitmap(file);
  const { width: w, height: h } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const targetW = Math.round(w * scale);
  const targetH = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Blob 생성 실패'))),
      'image/jpeg',
      quality,
    );
  });
  const arrayBuf = await blob.arrayBuffer();
  const base64 = bufferToBase64(new Uint8Array(arrayBuf));
  return { base64, mimeType: 'image/jpeg', sizeKB: Math.round(blob.size / 1024) };
}

function bufferToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
