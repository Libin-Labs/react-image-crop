import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  constrainCrop,
  moveCrop,
  resizeCrop,
  toNaturalCrop,
  toDisplayCrop,
  exportCrop,
} from '../dist/index.js';

test('crop geometry clamps, preserves aspect and anchors, converts displayed pixels', () => {
  const bounds = { width: 400, height: 200 };
  const crop = { x: 20, y: 30, width: 100, height: 50 };
  assert.deepEqual(moveCrop(crop, 1000, -1000, bounds), { x: 300, y: 0, width: 100, height: 50 });
  const resized = resizeCrop(crop, 'nw', -50, -20, bounds, 2);
  assert.equal(resized.x + resized.width, 120);
  assert.equal(resized.y + resized.height, 80);
  assert.equal(resized.width / resized.height, 2);
  assert.deepEqual(
    toNaturalCrop(
      toDisplayCrop(crop, bounds, { width: 200, height: 100 }),
      { width: 200, height: 100 },
      bounds,
    ),
    crop,
  );
  assert.throws(() => constrainCrop(crop, bounds, 0), RangeError);
  assert.throws(() => constrainCrop({ ...crop, x: NaN }, bounds), RangeError);
  assert.deepEqual(resizeCrop({ x: 400, y: 200, width: 0, height: 0 }, 'se', 10, 10, bounds, 2), {
    x: 400,
    y: 200,
    width: 0,
    height: 0,
  });
  const extreme = resizeCrop(crop, 'se', 0, 100, bounds, Number.MAX_VALUE);
  assert.ok(Object.values(extreme).every(Number.isFinite));
  assert.equal(
    createRequire(import.meta.url)('../dist/cjs/index.js').constrainCrop(crop, bounds).width,
    100,
  );
});

test('controlled keyboard, aspect resize, pointer drag, load and disabled behavior', async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM("<div id='root'></div>", { pretendToBeVisual: true });
  for (const name of [
    'window',
    'document',
    'HTMLElement',
    'HTMLImageElement',
    'MouseEvent',
    'KeyboardEvent',
    'Event',
  ])
    globalThis[name] = dom.window[name];
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createElement, useState, act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { ImageCrop } = await import('../dist/index.js');
  let latest;
  let completions = 0;
  let disabled = false;
  function App() {
    const [value, setValue] = useState({ x: 20, y: 20, width: 100, height: 50 });
    latest = value;
    return createElement(ImageCrop, {
      src: 'photo.png',
      value,
      aspect: 2,
      disabled,
      onChange: setValue,
      onChangeComplete: () => completions++,
    });
  }
  const root = createRoot(document.getElementById('root'));
  await act(() => root.render(createElement(App)));
  const img = document.querySelector('img');
  Object.defineProperties(img, { naturalWidth: { value: 400 }, naturalHeight: { value: 200 } });
  img.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 });
  await act(() => img.dispatchEvent(new Event('load')));
  const selection = document.querySelector('[role=group]');
  await act(() =>
    selection.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }),
    ),
  );
  assert.equal(latest.x, 30);
  const handle = document.querySelector("[aria-label='Resize bottom right']");
  await act(() =>
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })),
  );
  assert.equal(latest.width, 101);
  assert.equal(latest.width / latest.height, 2);
  const pointer = (type, x, y) =>
    new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
  await act(() => selection.dispatchEvent(pointer('pointerdown', 10, 10)));
  await act(() => selection.dispatchEvent(pointer('pointermove', 20, 15)));
  await act(() => selection.dispatchEvent(pointer('pointerup', 20, 15)));
  assert.equal(latest.x, 50);
  assert.equal(latest.y, 30);
  assert.equal(completions, 3);
  await act(() => handle.dispatchEvent(pointer('pointerdown', 10, 10)));
  await act(() => handle.dispatchEvent(pointer('pointermove', 20, 15)));
  await act(() => handle.dispatchEvent(pointer('pointercancel', 20, 15)));
  assert.equal(latest.width, 121);
  assert.equal(latest.height, 60.5);
  assert.equal(completions, 4);
  disabled = true;
  await act(() => root.render(createElement(App)));
  await act(() =>
    selection.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })),
  );
  assert.equal(latest.x, 50);
  assert.equal(selection.tabIndex, -1);
  await act(() => root.unmount());
  dom.window.close();
});

test('blob export uses natural coordinates and reports taint and empty crops', async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<img>');
  const image = dom.window.document.querySelector('img');
  Object.defineProperties(image, {
    complete: { value: true },
    naturalWidth: { value: 400 },
    naturalHeight: { value: 200 },
  });
  let args;
  let exportCanvas;
  dom.window.HTMLCanvasElement.prototype.getContext = () => ({
    drawImage: (...values) => {
      args = values;
    },
  });
  dom.window.HTMLCanvasElement.prototype.toBlob = function (callback) {
    exportCanvas = this;
    callback(new Blob(['pixels'], { type: 'image/png' }));
  };
  const blob = await exportCrop(image, { x: 10, y: 20, width: 80, height: 40 });
  assert.equal(blob.type, 'image/png');
  assert.deepEqual(args.slice(1), [10, 20, 80, 40, 0, 0, 80, 40]);
  assert.equal(exportCanvas.width, 0);
  assert.equal(exportCanvas.height, 0);
  await assert.rejects(exportCrop(image, { x: 0, y: 0, width: 0, height: 0 }), {
    code: 'INVALID_CROP',
  });
  dom.window.HTMLCanvasElement.prototype.toBlob = () => {
    const error = new Error('tainted');
    error.name = 'SecurityError';
    throw error;
  };
  await assert.rejects(exportCrop(image, { x: 0, y: 0, width: 1, height: 1 }), { code: 'CORS' });
  dom.window.HTMLCanvasElement.prototype.toBlob = (callback) => callback(null);
  await assert.rejects(exportCrop(image, { x: 0, y: 0, width: 1, height: 1 }), {
    code: 'ENCODING',
  });
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  await assert.rejects(exportCrop(image, { x: 0, y: 0, width: 1, height: 1 }), {
    code: 'CANVAS_UNAVAILABLE',
  });
  dom.window.close();
});
