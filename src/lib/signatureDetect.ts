import type { MaskRect } from '../types';
import { extractSignatureStrokes } from './imageUtils';

export function autoDetectSignature(canvas: HTMLCanvasElement): MaskRect {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const DARK_THRESHOLD = 160;
  const MARGIN = 10;

  let minX = width, minY = height, maxX = 0, maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const brightness = (r + g + b) / 3;
      if (brightness < DARK_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }

  if (!found) {
    return {
      x: Math.round(width * 0.1),
      y: Math.round(height * 0.6),
      width: Math.round(width * 0.8),
      height: Math.round(height * 0.3),
    };
  }

  const padX = Math.max(MARGIN, Math.round((maxX - minX) * 0.05));
  const padY = Math.max(MARGIN, Math.round((maxY - minY) * 0.05));

  const x = Math.max(0, minX - padX);
  const y = Math.max(0, minY - padY);
  const w = Math.min(width - x, maxX - minX + padX * 2);
  const h = Math.min(height - y, maxY - minY + padY * 2);

  return { x, y, width: w, height: h };
}

export function detectSignatureInRegionFiltered(
  canvas: HTMLCanvasElement,
  searchRegion?: Partial<MaskRect>
): MaskRect {
  const { width, height } = canvas;
  const rx = Math.max(0, searchRegion?.x ?? 0);
  const ry = Math.max(0, searchRegion?.y ?? 0);
  const rw = Math.min(width - rx, searchRegion?.width ?? width);
  const rh = Math.min(height - ry, searchRegion?.height ?? height);

  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.getImageData(rx, ry, rw, rh);
  const d = imgData.data;
  const sw = imgData.width;
  const sh = imgData.height;

  const gray = new Uint8Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      gray[y * sw + x] = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    }
  }

  const result = extractSignatureStrokes(gray, sw, sh, 80, 200);

  if (!result) return { x: rx, y: ry, width: rw, height: rh };

  const cleaned = result.cleaned;
  let minX = sw, minY = sh, maxX = 0, maxY = 0;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (cleaned[y * sw + x] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const PAD = 20;
  const absX = Math.max(0, rx + minX - PAD);
  const absY = Math.max(0, ry + minY - PAD);
  const absW = Math.min(width - absX, maxX - minX + PAD * 2 + PAD);
  const absH = Math.min(height - absY, maxY - minY + PAD * 2 + PAD);
  return { x: absX, y: absY, width: Math.max(10, absW), height: Math.max(10, absH) };
}

export function detectSignatureInRegion(
  canvas: HTMLCanvasElement,
  searchRegion?: Partial<MaskRect>
): MaskRect {
  const { width, height } = canvas;

  const rx = searchRegion?.x ?? 0;
  const ry = searchRegion?.y ?? Math.round(height * 0.5);
  const rw = searchRegion?.width ?? width;
  const rh = searchRegion?.height ?? Math.round(height * 0.4);

  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(rx, ry, rw, rh);
  const data = imageData.data;

  const DARK_THRESHOLD = 150;
  const MARGIN = 8;

  let minX = rw, minY = rh, maxX = 0, maxY = 0;
  let found = false;

  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const idx = (y * rw + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      if (brightness < DARK_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }

  if (!found) {
    return { x: rx, y: ry, width: rw, height: rh };
  }

  return {
    x: Math.max(0, rx + minX - MARGIN),
    y: Math.max(0, ry + minY - MARGIN),
    width: Math.min(width, maxX - minX + MARGIN * 2),
    height: Math.min(height, maxY - minY + MARGIN * 2),
  };
}
