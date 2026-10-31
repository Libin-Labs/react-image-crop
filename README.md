# @lp-labs/react-image-crop

Package version: `1.0.0`.

A controlled image selection in natural image pixels, with corner resizing,
keyboard movement and asynchronous canvas export. React `^18.2.0 || ^19.0.0`
is the only runtime peer. ESM, CommonJS and declarations are provided.

```sh
npm install @lp-labs/react-image-crop react
```

```tsx
import { useRef, useState } from "react";
import { ImageCrop, exportCrop, type Crop } from "@lp-labs/react-image-crop";
import "@lp-labs/react-image-crop/style.css";

export function AvatarCrop() {
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, width: 200, height: 200 });
  const image = useRef<HTMLImageElement | null>(null);
  const [message, setMessage] = useState("");
  return <>
    <ImageCrop src="/portrait.jpg" value={crop} onChange={setCrop} aspect={1}
      onImageLoad={element => { image.current = element; }}
      onImageError={() => { image.current = null; setMessage("Image failed"); }}
      alt="Portrait to crop" />
    <button onClick={async () => {
      if (!image.current) return;
      try {
        const blob = await exportCrop(image.current, crop, { type: "image/png" });
        setMessage(`Ready: ${blob.size} bytes`);
        // Upload the Blob or create an object URL; revoke that URL when finished.
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Export failed");
      }
    }}>Prepare crop</button>
    <p role="status">{message}</p>
  </>;
}
```

## Component API

`Crop = { x: number; y: number; width: number; height: number }`;
`Size = { width: number; height: number }`. Values may be fractional. Coordinates
refer to the browser's decoded `naturalWidth`/`naturalHeight`, not CSS pixels.
Replace controlled `value` in `onChange` to show an interaction's result.

| `ImageCropProps` prop | Type | Default / behavior |
| --- | --- | --- |
| `src` | `string` | Required image URL |
| `value` | `Crop` | Required controlled selection |
| `onChange` | `(crop: Crop) => void` | Required; fires while moving/resizing and for arrows |
| `onChangeComplete` | `(crop: Crop) => void` | Optional; pointer up/cancel/capture loss or each keyboard change |
| `aspect` | `number` | Unconstrained; positive natural-pixel width/height ratio |
| `onImageLoad` | `(image: HTMLImageElement) => void` | Loaded image for export and dimensions |
| `onImageError` | `() => void` | Load failure; also displays an alert |
| `disabled` | `boolean` | `false`; removes selection from tab order and disables handles |
| `alt` | `string` | `"Crop source"` |
| `label` | `string` | `"Image crop selection"` accessible group name |
| `crossOrigin` | `"anonymous" \| "use-credentials"` | Omitted; set before loading remote images |
| `className`, `style` | `string`, `CSSProperties` | Wrapper customization |

On load, the controlled value is clamped for display without emitting a change.
An aspect ratio shrinks the supplied rectangle to fit the ratio; it does not
expand outside the image. Zero-area selections are permitted (but not
exportable); initialize with a usable nonzero area. Non-finite coordinates,
invalid aspect, or invalid helper image dimensions throw `RangeError`.
Source changes hide stale selections until the new image loads.

## Geometry helpers

All return new objects and never mutate inputs:

- `constrainCrop(crop, bounds, aspect?): Crop` clamps size and position.
- `moveCrop(crop, dx, dy, bounds): Crop` clamps translation.
- `resizeCrop(crop, handle, dx, dy, bounds, aspect?): Crop` keeps the opposite
  corner anchored and constrains size to available space. Deltas are natural
  pixels; `CropHandle = "nw" | "ne" | "sw" | "se"`. The moving corner cannot
  cross the anchor. Minimum attempted size is one pixel, reduced when required
  by image bounds or aspect.
- `toNaturalCrop(crop, displayed: Size, natural: Size): Crop` converts a
  displayed rectangle to a bounded natural selection.
- `toDisplayCrop(crop, natural: Size, displayed: Size): Crop` does the reverse.
- `validateSize(size): void` validates positive finite dimensions.

## Blob export and errors

`exportCrop(image: HTMLImageElement, crop: Crop, options?: ExportCropOptions):
Promise<Blob>` draws the bounded crop onto a fresh canvas. `options` contains
`type` (`"image/png"` default, `"image/jpeg"` or `"image/webp"`),
`quality` (browser default, otherwise 0..1), and `width`/`height` (positive
integer output pixels, default rounded crop dimensions). Supplying both output
dimensions can stretch the crop. Browsers may fall back to PNG for unsupported
encoders; inspect `blob.type`. Export releases the canvas backing store.

Rejections are `CropExportError` with a `code: CropExportErrorCode`:
`NOT_LOADED`, `INVALID_CROP`, `CANVAS_UNAVAILABLE`, `CORS`, or `ENCODING`.
Cross-origin images need an appropriate `crossOrigin` setting **and** server
Access-Control-Allow-Origin support. Otherwise a tainted canvas throws an
explicit `CORS` error; this library cannot bypass browser security. Set
`crossOrigin` before loading and export the same loaded image. No network
requests, uploads or object URLs are created by the export helper.

`CropExportError(code: CropExportErrorCode, message: string)` is an exported
Error subclass with readonly `code` and name `"CropExportError"`. All exports
are named; `Crop`, `Size`, `CropHandle`, `ImageCropProps`, `ExportCropOptions`,
and `CropExportErrorCode` are type-only. There is no AbortSignal export option:
unmounting or changing the source cannot cancel an in-flight canvas encode.
Ignore stale results in the application and avoid starting many concurrent
exports. Importing does not decode an image or allocate a canvas; those require
a DOM image/browser at use time and DOM declarations for TypeScript consumers.

## Accessibility, styling and limits

Import the CSS for the dimmed outside region, border and corner buttons.
Override `.lp-image-crop__selection` and `.lp-image-crop__handle` to theme them;
preserve visible focus. The selection is focusable: arrows move one natural
pixel, Shift+arrows move ten. Focus a labeled corner button and use arrows
to resize. Pointer capture supports mouse, pen and touch. Provide explanatory
text and status/output as appropriate; no live region announces every pixel.

Use the image at its intrinsic aspect ratio; do not override it with
object-fit/cropping or CSS transforms. The component uses percentage overlays
and remeasures the image on each gesture, so normal responsive scaling works
without a persistent observer. No rotation, flip, perspective transforms,
EXIF editing, image decoding worker, multi-selection or pinch-to-zoom is
implemented. Browser-decoded orientation is used as-is. Huge images/output
sizes may exceed browser memory or canvas limits; downsize output yourself.
Source images must load before selection and export; SSR renders the preview
but interaction begins only after load. Consumers own upload/download and
object-URL cleanup.

## License

[MIT](./LICENSE).

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
