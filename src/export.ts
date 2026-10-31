import { constrainCrop, type Crop } from './geometry.js';

export type CropExportErrorCode =
  'NOT_LOADED' | 'INVALID_CROP' | 'CANVAS_UNAVAILABLE' | 'CORS' | 'ENCODING';

export class CropExportError extends Error {
  readonly code: CropExportErrorCode;

  constructor(code: CropExportErrorCode, message: string) {
    super(message);
    this.name = 'CropExportError';
    this.code = code;
  }
}

export interface ExportCropOptions {
  type?: 'image/png' | 'image/jpeg' | 'image/webp';
  quality?: number;
  width?: number;
  height?: number;
}

export async function exportCrop(
  image: HTMLImageElement,
  crop: Crop,
  options: ExportCropOptions = {},
): Promise<Blob> {
  if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    throw new CropExportError('NOT_LOADED', 'Wait for the image to load before exporting');
  }
  let safe: Crop;
  try {
    safe = constrainCrop(crop, { width: image.naturalWidth, height: image.naturalHeight });
  } catch {
    throw new CropExportError('INVALID_CROP', 'Crop coordinates must be finite');
  }
  if (safe.width <= 0 || safe.height <= 0) {
    throw new CropExportError('INVALID_CROP', 'Select a nonempty crop');
  }
  const width = options.width ?? Math.max(1, Math.round(safe.width));
  const height = options.height ?? Math.max(1, Math.round(safe.height));
  if (
    ![width, height].every((value) => Number.isSafeInteger(value) && value > 0) ||
    (options.quality !== undefined &&
      (!Number.isFinite(options.quality) || options.quality < 0 || options.quality > 1))
  ) {
    throw new CropExportError(
      'INVALID_CROP',
      'Output dimensions must be positive integers; quality must be between zero and one',
    );
  }
  const canvas = image.ownerDocument.createElement('canvas');
  try {
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context)
      throw new CropExportError('CANVAS_UNAVAILABLE', 'A 2D canvas context is required');
    context.drawImage(image, safe.x, safe.y, safe.width, safe.height, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new CropExportError('ENCODING', 'The browser could not encode the crop'));
        },
        options.type ?? 'image/png',
        options.quality,
      );
    });
  } catch (error) {
    if (error instanceof CropExportError) throw error;
    if (error instanceof Error && error.name === 'SecurityError') {
      throw new CropExportError(
        'CORS',
        'Canvas is tainted. Load the image with crossOrigin and enable CORS on its server',
      );
    }
    throw new CropExportError(
      'ENCODING',
      error instanceof Error ? error.message : 'Canvas export failed',
    );
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
