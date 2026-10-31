import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import {
  constrainCrop,
  moveCrop,
  resizeCrop,
  type Crop,
  type CropHandle,
  type Size,
} from './geometry.js';

export * from './geometry.js';
export * from './export.js';

export interface ImageCropProps {
  src: string;
  value: Crop;
  onChange: (crop: Crop) => void;
  onChangeComplete?: (crop: Crop) => void;
  onImageLoad?: (image: HTMLImageElement) => void;
  onImageError?: () => void;
  aspect?: number;
  disabled?: boolean;
  alt?: string;
  label?: string;
  crossOrigin?: 'anonymous' | 'use-credentials';
  className?: string;
  style?: CSSProperties;
}

interface Gesture {
  pointerId: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  crop: Crop;
  handle?: CropHandle;
  latest: Crop;
}

const handles: CropHandle[] = ['nw', 'ne', 'sw', 'se'];
const handleNames = { nw: 'top left', ne: 'top right', sw: 'bottom left', se: 'bottom right' };

export function ImageCrop({
  src,
  value,
  onChange,
  onChangeComplete,
  onImageLoad,
  onImageError,
  aspect,
  disabled = false,
  alt = 'Crop source',
  label = 'Image crop selection',
  crossOrigin,
  className = '',
  style,
}: ImageCropProps) {
  const image = useRef<HTMLImageElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [loaded, setLoaded] = useState<{ src: string; bounds: Size } | null>(null);
  const [failed, setFailed] = useState(false);
  const bounds = loaded?.src === src ? loaded.bounds : null;
  const crop = bounds ? constrainCrop(value, bounds, aspect) : null;

  useEffect(() => {
    gesture.current = null;
    setFailed(false);
  }, [src]);
  useEffect(() => {
    if (disabled) gesture.current = null;
  }, [disabled]);
  useEffect(
    () => () => {
      gesture.current = null;
    },
    [],
  );

  const start = (event: PointerEvent<HTMLElement>, handle?: CropHandle) => {
    if (disabled || !crop || !bounds || (event.button !== 0 && event.button !== undefined)) return;
    const rect = image.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gesture.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scaleX: bounds.width / rect.width,
      scaleY: bounds.height / rect.height,
      crop,
      handle,
      latest: crop,
    };
  };

  const finish = (event: PointerEvent) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    gesture.current = null;
    onChangeComplete?.(active.latest);
  };

  const key = (event: KeyboardEvent, handle?: CropHandle) => {
    if (
      disabled ||
      !crop ||
      !bounds ||
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 10 : 1;
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    const next = handle
      ? resizeCrop(crop, handle, dx, dy, bounds, aspect)
      : moveCrop(crop, dx, dy, bounds);
    onChange(next);
    onChangeComplete?.(next);
  };

  return (
    <div
      className={`lp-image-crop ${className}`}
      style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', ...style }}
      onPointerMove={(event) => {
        const active = gesture.current;
        if (!active || !bounds || active.pointerId !== event.pointerId || disabled) return;
        const dx = (event.clientX - active.x) * active.scaleX;
        const dy = (event.clientY - active.y) * active.scaleY;
        const next = active.handle
          ? resizeCrop(active.crop, active.handle, dx, dy, bounds, aspect)
          : moveCrop(active.crop, dx, dy, bounds);
        active.latest = next;
        onChange(next);
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
    >
      <img
        ref={image}
        key={`${src}:${crossOrigin ?? ''}`}
        src={src}
        crossOrigin={crossOrigin}
        alt={alt}
        draggable={false}
        style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
        onLoad={(event) => {
          const element = event.currentTarget;
          if (!element.naturalWidth || !element.naturalHeight) return;
          setLoaded({
            src,
            bounds: { width: element.naturalWidth, height: element.naturalHeight },
          });
          setFailed(false);
          onImageLoad?.(element);
        }}
        onError={() => {
          setLoaded(null);
          setFailed(true);
          gesture.current = null;
          onImageError?.();
        }}
      />
      {failed && <span role="alert">Image could not be loaded.</span>}
      {crop && bounds && (
        <div
          className="lp-image-crop__selection"
          role="group"
          aria-label={label}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          aria-description="Arrow keys move; Shift increases the step. Focus corner buttons to resize."
          style={{
            position: 'absolute',
            boxSizing: 'border-box',
            touchAction: 'none',
            left: `${(crop.x / bounds.width) * 100}%`,
            top: `${(crop.y / bounds.height) * 100}%`,
            width: `${(crop.width / bounds.width) * 100}%`,
            height: `${(crop.height / bounds.height) * 100}%`,
          }}
          onPointerDown={(event) => start(event)}
          onKeyDown={(event) => key(event)}
        >
          {handles.map((handle) => (
            <button
              key={handle}
              type="button"
              className={`lp-image-crop__handle lp-image-crop__handle--${handle}`}
              disabled={disabled}
              aria-label={`Resize ${handleNames[handle]}`}
              style={{
                position: 'absolute',
                touchAction: 'none',
                left: handle.includes('w') ? 0 : '100%',
                top: handle.includes('n') ? 0 : '100%',
                transform: 'translate(-50%, -50%)',
              }}
              onPointerDown={(event) => start(event, handle)}
              onKeyDown={(event) => key(event, handle)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
