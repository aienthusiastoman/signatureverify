import type { MaskRect } from '../types';

function getPdfjsLib() {
  const lib = (window as any).pdfjsLib;
  if (!lib) throw new Error('PDF.js not loaded');
  return lib;
}

export async function getPdfPageCount(file: File): Promise<number> {
  const pdfjsLib = getPdfjsLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return pdf.numPages;
}

export async function renderPdfPageToCanvas(file: File, pageNum = 1): Promise<HTMLCanvasElement> {
  const pdfjsLib = getPdfjsLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
  return canvas;
}

export async function renderPdfThumbnail(file: File, pageNum: number, maxWidth = 120): Promise<string> {
  const pdfjsLib = getPdfjsLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(pageNum);
  const baseViewport = page.getViewport({ scale: 1.0 });
  const scale = maxWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.7);
}

export async function renderPdfToCanvas(file: File): Promise<HTMLCanvasElement> {
  return renderPdfPageToCanvas(file, 1);
}

function getRegionInkRatio(
  canvas: HTMLCanvasElement,
  mask: { x: number; y: number; width: number; height: number }
): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  const x = Math.max(0, Math.round(mask.x));
  const y = Math.max(0, Math.round(mask.y));
  const w = Math.min(canvas.width - x, Math.max(1, Math.round(mask.width)));
  const h = Math.min(canvas.height - y, Math.max(1, Math.round(mask.height)));
  if (w <= 0 || h <= 0) return 0;
  const data = ctx.getImageData(x, y, w, h).data;
  let dark = 0;
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 180) dark++;
  }
  return dark / (w * h);
}

function countInkBands(
  canvas: HTMLCanvasElement,
  mask: { x: number; y: number; width: number; height: number },
  sliceHeight = 12
): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 1;
  const x = Math.max(0, Math.round(mask.x));
  const y = Math.max(0, Math.round(mask.y));
  const w = Math.min(canvas.width - x, Math.max(1, Math.round(mask.width)));
  const h = Math.min(canvas.height - y, Math.max(1, Math.round(mask.height)));
  let bands = 0;
  for (let sy = 0; sy < h; sy += sliceHeight) {
    const sh = Math.min(sliceHeight, h - sy);
    if (sh <= 0) break;
    const data = ctx.getImageData(x, y + sy, w, sh).data;
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 180) dark++;
    }
    if (dark / (w * sh) >= 0.005) bands++;
  }
  return Math.max(1, bands);
}

function regionHasInkContent(
  canvas: HTMLCanvasElement,
  mask: { x: number; y: number; width: number; height: number },
  minDarkRatio = 0.002
): boolean {
  return getRegionInkRatio(canvas, mask) >= minDarkRatio;
}

export function captureStructuralThumbnail(
  canvas: HTMLCanvasElement,
  naturalMask?: { x: number; y: number; width: number; height: number },
  targetWidth = 150
): string {
  const scale = targetWidth / canvas.width;
  const w = targetWidth;
  const h = Math.round(canvas.height * scale);
  const thumb = document.createElement('canvas');
  thumb.width = w;
  thumb.height = h;
  const ctx = thumb.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  if (naturalMask && canvas.width > 0 && canvas.height > 0) {
    const mx = Math.round(naturalMask.x * scale);
    const my = Math.round(naturalMask.y * scale);
    const mw = Math.round(naturalMask.width * scale);
    const mh = Math.round(naturalMask.height * scale);
    for (let py = my; py < Math.min(h, my + mh); py++) {
      for (let px = mx; px < Math.min(w, mx + mw); px++) {
        const idx = (py * w + px) * 4;
        d[idx] = d[idx + 1] = d[idx + 2] = 200;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return thumb.toDataURL('image/jpeg', 0.75);
}

function nccPixels(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let sA = 0, sB = 0;
  for (let i = 0; i < n; i++) { sA += a[i]; sB += b[i]; }
  const mA = sA / n, mB = sB / n;
  let num = 0, dA = 0, dB = 0;
  for (let i = 0; i < n; i++) {
    const a_ = a[i] - mA, b_ = b[i] - mB;
    num += a_ * b_; dA += a_ * a_; dB += b_ * b_;
  }
  const den = Math.sqrt(dA * dB);
  return den < 1e-10 ? 0 : num / den;
}

function canvasToGrayPixels(canvas: HTMLCanvasElement, w: number, h: number): number[] {
  const scaled = document.createElement('canvas');
  scaled.width = w; scaled.height = h;
  scaled.getContext('2d')!.drawImage(canvas, 0, 0, w, h);
  const d = scaled.getContext('2d')!.getImageData(0, 0, w, h).data;
  const pixels: number[] = [];
  for (let i = 0; i < d.length; i += 4) {
    pixels.push(Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]));
  }
  return pixels;
}

async function dataUrlToGrayPixels(dataUrl: string, w: number, h: number): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      const d = c.getContext('2d')!.getImageData(0, 0, w, h).data;
      const pixels: number[] = [];
      for (let i = 0; i < d.length; i += 4) {
        pixels.push(Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]));
      }
      resolve(pixels);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function neutralizeRegion(
  pixels: number[],
  frac: { x: number; y: number; w: number; h: number },
  imgW: number,
  imgH: number,
  value = 200
): number[] {
  const out = pixels.slice();
  const px = Math.round(frac.x * imgW);
  const py = Math.round(frac.y * imgH);
  const pw = Math.round(frac.w * imgW);
  const ph = Math.round(frac.h * imgH);
  for (let y = py; y < Math.min(imgH, py + ph); y++) {
    for (let x = px; x < Math.min(imgW, px + pw); x++) {
      out[y * imgW + x] = value;
    }
  }
  return out;
}

function integralImage(gray: Uint8Array, w: number, h: number): Int32Array {
  const integral = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      integral[(y + 1) * (w + 1) + (x + 1)] =
        gray[y * w + x] +
        integral[y * (w + 1) + (x + 1)] +
        integral[(y + 1) * (w + 1) + x] -
        integral[y * (w + 1) + x];
    }
  }
  return integral;
}

function adaptiveThresholdGray(gray: Uint8Array, w: number, h: number, blockSize: number, C: number): Uint8Array {
  const integral = integralImage(gray, w, h);
  const half = Math.floor(blockSize / 2);
  const result = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - half), y1 = Math.max(0, y - half);
      const x2 = Math.min(w - 1, x + half), y2 = Math.min(h - 1, y + half);
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * (w + 1) + (x2 + 1)] -
        integral[y1 * (w + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (w + 1) + x1] +
        integral[y1 * (w + 1) + x1];
      result[y * w + x] = gray[y * w + x] < sum / area - C ? 255 : 0;
    }
  }
  return result;
}

function removeLongRunsH(bin: Uint8Array, w: number, h: number, minLen: number): void {
  for (let y = 0; y < h; y++) {
    let runStart = 0, run = 0;
    for (let x = 0; x <= w; x++) {
      if (x < w && bin[y * w + x] > 0) {
        if (run === 0) runStart = x;
        run++;
      } else {
        if (run >= minLen) for (let rx = runStart; rx < runStart + run; rx++) bin[y * w + rx] = 0;
        run = 0;
      }
    }
  }
}

function removeLongRunsV(bin: Uint8Array, w: number, h: number, minLen: number): void {
  for (let x = 0; x < w; x++) {
    let runStart = 0, run = 0;
    for (let y = 0; y <= h; y++) {
      if (y < h && bin[y * w + x] > 0) {
        if (run === 0) runStart = y;
        run++;
      } else {
        if (run >= minLen) for (let ry = runStart; ry < runStart + run; ry++) bin[ry * w + x] = 0;
        run = 0;
      }
    }
  }
}

function largestBlobArea(bin: Uint8Array, w: number, h: number): number {
  const visited = new Uint8Array(w * h);
  let maxArea = 0;
  for (let i = 0; i < w * h; i++) {
    if (bin[i] === 0 || visited[i]) continue;
    const stack = [i];
    visited[i] = 1;
    let area = 0;
    while (stack.length > 0) {
      const idx = stack.pop()!;
      area++;
      const x = idx % w, y = Math.floor(idx / w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const nidx = ny * w + nx;
        if (bin[nidx] === 0 || visited[nidx]) continue;
        visited[nidx] = 1;
        stack.push(nidx);
      }
    }
    if (area > maxArea) maxArea = area;
  }
  return maxArea;
}

export async function findPageBySignatureBlob(
  file: File,
  maskFrac: { x: number; y: number; w: number; h: number }
): Promise<number> {
  const pdfjsLib = getPdfjsLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let bestPage = 1;
  let bestArea = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;

    const pw = canvas.width, ph = canvas.height;
    const cx = Math.round(maskFrac.x * pw);
    const cy = Math.round(maskFrac.y * ph);
    const cw = Math.max(1, Math.round(maskFrac.w * pw));
    const ch = Math.max(1, Math.round(maskFrac.h * ph));

    const imgData = canvas.getContext('2d')!.getImageData(cx, cy, cw, ch);
    const d = imgData.data;

    const gray = new Uint8Array(cw * ch);
    for (let j = 0; j < cw * ch; j++) {
      gray[j] = Math.round(0.299 * d[j * 4] + 0.587 * d[j * 4 + 1] + 0.114 * d[j * 4 + 2]);
    }

    const thresh = adaptiveThresholdGray(gray, cw, ch, 31, 15);
    removeLongRunsH(thresh, cw, ch, Math.max(20, Math.round(cw * 0.4)));
    removeLongRunsV(thresh, cw, ch, Math.max(20, Math.round(ch * 0.4)));

    const area = largestBlobArea(thresh, cw, ch);
    if (area > bestArea) {
      bestArea = area;
      bestPage = i;
    }
  }

  return bestPage;
}

export async function findPageByAnchorText(
  file: File,
  anchorText: string,
  mask?: { x: number; y: number; width: number; height: number }
): Promise<number | null> {
  const pdfjsLib = getPdfjsLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const search = anchorText.toLowerCase().trim().replace(/\s+/g, ' ');
  const searchNoSpaces = search.replace(/\s/g, '');

  const words = search.split(' ').filter(w => w.length > 0);
  const escapedWords = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const loosePattern = new RegExp(escapedWords.join('[\\s\\S]{0,80}'));

  const matchingPages: number[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = (textContent.items as any[]).map((item: any) => item.str);
    const pageText = items.join(' ').toLowerCase().replace(/\s+/g, ' ');
    const pageTextNoSpaces = items.join(' ').toLowerCase().replace(/\s+/g, '');
    const hasExact = pageText.includes(search) || pageTextNoSpaces.includes(searchNoSpaces);
    const hasLoose = loosePattern.test(pageText);
    const hasAllWords = words.length >= 3 && words.filter(w => w.length > 2).every(w => pageText.includes(w));
    if (hasExact || hasLoose || hasAllWords) matchingPages.push(i);
  }

  const renderPage = async (pageNum: number): Promise<HTMLCanvasElement> => {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
    return canvas;
  };

  const pickBestByInk = async (pages: number[]): Promise<number> => {
    const SIGNATURE_MIN = 0.004;
    const entries: { page: number; maskRatio: number; score: number }[] = [];
    for (const p of pages) {
      const canvas = await renderPage(p);
      const maskRatio = getRegionInkRatio(canvas, mask!);
      const fullPage = { x: 0, y: 0, width: canvas.width, height: canvas.height };
      const pageRatio = getRegionInkRatio(canvas, fullPage);
      const bands = countInkBands(canvas, mask!);
      // Reward: concentrated mask ink (high maskRatio)
      // Penalise: dense pages (high pageRatio) and ink spread across many bands (high bands)
      const score = maskRatio >= SIGNATURE_MIN ? maskRatio / (pageRatio * bands + 0.01) : 0;
      entries.push({ page: p, maskRatio, score });
    }
    const candidates = entries.filter(e => e.maskRatio >= SIGNATURE_MIN && e.score > 0);
    if (candidates.length === 0) return pages[0];
    return candidates.reduce((a, b) => a.score > b.score ? a : b).page;
  };

  if (matchingPages.length === 0) {
    if (!mask) return null;
    const allPages = Array.from({ length: pdf.numPages }, (_, i) => i + 1);
    return pickBestByInk(allPages);
  }

  if (matchingPages.length === 1 || !mask) return matchingPages[0];

  return pickBestByInk(matchingPages);
}

export async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    if (file.type === 'application/pdf') {
      reject(new Error('Use renderPdfPageToCanvas for PDF files'));
      return;
    }
    const canvas = document.createElement('canvas');
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

export function extractRegion(canvas: HTMLCanvasElement, mask: MaskRect): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = Math.max(1, mask.width);
  output.height = Math.max(1, mask.height);
  const ctx = output.getContext('2d')!;
  ctx.drawImage(canvas, mask.x, mask.y, mask.width, mask.height, 0, 0, mask.width, mask.height);
  return output;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to convert canvas to blob'));
    }, 'image/png');
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)![1];
  const binary = atob(data);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
