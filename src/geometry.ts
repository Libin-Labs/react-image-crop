export interface Size {
  width: number;
  height: number;
}

export interface Crop extends Size {
  x: number;
  y: number;
}

export type CropHandle = 'nw' | 'ne' | 'sw' | 'se';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function validateSize(size: Size): void {
  if (
    !Number.isFinite(size.width) ||
    !Number.isFinite(size.height) ||
    size.width <= 0 ||
    size.height <= 0
  ) {
    throw new RangeError('Image dimensions must be finite and positive');
  }
}

export function constrainCrop(crop: Crop, bounds: Size, aspect?: number): Crop {
  validateSize(bounds);
  if (![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite)) {
    throw new RangeError('Crop coordinates must be finite');
  }
  if (aspect !== undefined && (!Number.isFinite(aspect) || aspect <= 0)) {
    throw new RangeError('aspect must be finite and positive');
  }
  let width = clamp(crop.width, 0, bounds.width);
  let height = clamp(crop.height, 0, bounds.height);
  if (aspect !== undefined) {
    width = Math.min(width, height * aspect);
    height = width / aspect;
  }
  return {
    x: clamp(crop.x, 0, bounds.width - width),
    y: clamp(crop.y, 0, bounds.height - height),
    width,
    height,
  };
}

export function moveCrop(crop: Crop, dx: number, dy: number, bounds: Size): Crop {
  return constrainCrop({ ...crop, x: crop.x + dx, y: crop.y + dy }, bounds);
}

/** Resize around the opposite corner; aspect is measured in natural pixels. */
export function resizeCrop(
  crop: Crop,
  handle: CropHandle,
  dx: number,
  dy: number,
  bounds: Size,
  aspect?: number,
): Crop {
  const start = constrainCrop(crop, bounds, aspect);
  if (!Number.isFinite(dx) || !Number.isFinite(dy))
    throw new RangeError('Resize deltas must be finite');
  const east = handle.includes('e');
  const south = handle.includes('s');
  const anchorX = east ? start.x : start.x + start.width;
  const anchorY = south ? start.y : start.y + start.height;
  const maxWidth = east ? bounds.width - anchorX : anchorX;
  const maxHeight = south ? bounds.height - anchorY : anchorY;
  let width = clamp(start.width + (east ? dx : -dx), Math.min(1, maxWidth), maxWidth);
  let height = clamp(start.height + (south ? dy : -dy), Math.min(1, maxHeight), maxHeight);
  if (aspect !== undefined) {
    const desiredWidth = Math.abs(dx) >= Math.abs(dy * aspect) ? width : height * aspect;
    width = Math.min(desiredWidth, maxWidth, maxHeight * aspect);
    height = width / aspect;
  }
  return {
    x: east ? anchorX : anchorX - width,
    y: south ? anchorY : anchorY - height,
    width,
    height,
  };
}

export function toNaturalCrop(crop: Crop, displayed: Size, natural: Size): Crop {
  validateSize(displayed);
  validateSize(natural);
  const safe = constrainCrop(crop, displayed);
  return constrainCrop(
    {
      x: (safe.x / displayed.width) * natural.width,
      y: (safe.y / displayed.height) * natural.height,
      width: (safe.width / displayed.width) * natural.width,
      height: (safe.height / displayed.height) * natural.height,
    },
    natural,
  );
}

export function toDisplayCrop(crop: Crop, natural: Size, displayed: Size): Crop {
  validateSize(natural);
  validateSize(displayed);
  const safe = constrainCrop(crop, natural);
  return {
    x: (safe.x / natural.width) * displayed.width,
    y: (safe.y / natural.height) * displayed.height,
    width: (safe.width / natural.width) * displayed.width,
    height: (safe.height / natural.height) * displayed.height,
  };
}
