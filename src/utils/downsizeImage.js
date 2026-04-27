export const MAX_EDGE_PX = 1600;
export const JPEG_QUALITY = 0.85;
export const MAX_OUTPUT_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Compute resized dimensions preserving aspect ratio,
 * such that the longest edge is at most MAX_EDGE_PX.
 */
export function calcResizedDimensions(width, height) {
  const longest = Math.max(width, height);
  if (longest <= MAX_EDGE_PX) return { width, height };
  const scale = MAX_EDGE_PX / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Downsize an image File to a JPEG Blob.
 * Throws if the resulting blob exceeds MAX_OUTPUT_BYTES.
 *
 * Browser-only (uses Image, canvas, FileReader). Not unit-tested directly
 * because jsdom doesn't implement canvas drawing.
 */
export async function downsizeImage(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  const { width, height } = calcResizedDimensions(img.naturalWidth, img.naturalHeight);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/jpeg',
      JPEG_QUALITY
    );
  });

  if (blob.size > MAX_OUTPUT_BYTES) {
    throw new Error('Image is too large after compression. Please choose a smaller image.');
  }

  return blob;
}
