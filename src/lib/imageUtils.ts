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

function gaussianAdaptiveThreshold(gray: Uint8Array, w: number, h: number, blockSize = 31, C = 15): Uint8Array {
  const sigma = (blockSize - 1) / 6;
  const half = Math.floor(blockSize / 2);
  const kernel: number[] = [];
  let kSum = 0;
  for (let i = -half; i <= half; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(v);
    kSum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= kSum;

  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let val = 0;
      for (let k = 0; k < kernel.length; k++) {
        const sx = Math.max(0, Math.min(w - 1, x - half + k));
        val += gray[y * w + sx] * kernel[k];
      }
      tmp[y * w + x] = val;
    }
  }

  const blurred = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let val = 0;
      for (let k = 0; k < kernel.length; k++) {
        const sy = Math.max(0, Math.min(h - 1, y - half + k));
        val += tmp[sy * w + x] * kernel[k];
      }
      blurred[y * w + x] = val;
    }
  }

  const result = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    result[i] = gray[i] < blurred[i] - C ? 255 : 0;
  }
  return result;
}

function morphOpenH(bin: Uint8Array, w: number, h: number, kernelW: number): Uint8Array {
  const eroded = new Uint8Array(w * h);
  const half = Math.floor(kernelW / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let allSet = true;
      for (let dx = -half; dx <= half; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= w || bin[y * w + nx] === 0) { allSet = false; break; }
      }
      eroded[y * w + x] = allSet ? 255 : 0;
    }
  }
  const dilated = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (eroded[y * w + x] === 0) continue;
      for (let dx = -half; dx <= half; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < w) dilated[y * w + nx] = 255;
      }
    }
  }
  return dilated;
}

function morphOpenV(bin: Uint8Array, w: number, h: number, kernelH: number): Uint8Array {
  const eroded = new Uint8Array(w * h);
  const half = Math.floor(kernelH / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let allSet = true;
      for (let dy = -half; dy <= half; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h || bin[ny * w + x] === 0) { allSet = false; break; }
      }
      eroded[y * w + x] = allSet ? 255 : 0;
    }
  }
  const dilated = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (eroded[y * w + x] === 0) continue;
      for (let dy = -half; dy <= half; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < h) dilated[ny * w + x] = 255;
      }
    }
  }
  return dilated;
}

function subtractBin(src: Uint8Array, mask: Uint8Array): void {
  for (let i = 0; i < src.length; i++) {
    if (mask[i] > 0) src[i] = 0;
  }
}

function extractLargestComponent(bin: Uint8Array, w: number, h: number): number {
  const labels = new Int32Array(w * h);
  let labelId = 0;
  let bestLabel = -1;
  let bestArea = 0;

  for (let i = 0; i < w * h; i++) {
    if (bin[i] === 0 || labels[i] !== 0) continue;
    labelId++;
    const stack = [i];
    labels[i] = labelId;
    let area = 0;
    while (stack.length > 0) {
      const idx = stack.pop()!;
      area++;
      const cx = idx % w, cy = Math.floor(idx / w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as [number, number][]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const nidx = ny * w + nx;
        if (bin[nidx] === 0 || labels[nidx] !== 0) continue;
        labels[nidx] = labelId;
        stack.push(nidx);
      }
    }
    if (area > bestArea) { bestArea = area; bestLabel = labelId; }
  }

  if (bestLabel < 0) return 0;

  for (let i = 0; i < w * h; i++) {
    bin[i] = labels[i] === bestLabel ? 255 : 0;
  }
  return bestArea;
}

function removeSmallBlobs(bin: Uint8Array, w: number, h: number, minBlobArea: number): void {
  const labels = new Int32Array(w * h);
  let labelId = 0;
  const blobPixels = new Map<number, number[]>();

  for (let i = 0; i < w * h; i++) {
    if (bin[i] === 0 || labels[i] !== 0) continue;
    labelId++;
    const stack = [i];
    labels[i] = labelId;
    const pixels = [i];
    while (stack.length > 0) {
      const idx = stack.pop()!;
      const cx = idx % w, cy = Math.floor(idx / w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const nidx = ny * w + nx;
        if (bin[nidx] === 0 || labels[nidx] !== 0) continue;
        labels[nidx] = labelId;
        stack.push(nidx);
        pixels.push(nidx);
      }
    }
    blobPixels.set(labelId, pixels);
  }

  for (const pixels of blobPixels.values()) {
    if (pixels.length < minBlobArea) {
      for (const idx of pixels) bin[idx] = 0;
    }
  }
}

export function extractSignatureStrokes(
  gray: Uint8Array,
  w: number,
  h: number,
  lineKernelLen = 29,
  minArea = 50
): { cleaned: Uint8Array; area: number } | null {
  const thresh = gaussianAdaptiveThreshold(gray, w, h, 31, 15);

  const hLines = morphOpenH(thresh, w, h, lineKernelLen);
  subtractBin(thresh, hLines);

  const vLines = morphOpenV(thresh, w, h, lineKernelLen);
  subtractBin(thresh, vLines);

  removeSmallBlobs(thresh, w, h, Math.max(10, Math.round(w * h * 0.0005)));

  let totalArea = 0;
  for (let i = 0; i < w * h; i++) { if (thresh[i] > 0) totalArea++; }

  if (totalArea < minArea) return null;

  const largestArea = extractLargestComponent(thresh, w, h);
  if (largestArea < minArea) return null;

  return { cleaned: thresh, area: largestArea };
}

const RENDER_SCALE = 2.0;
const RENDER_DPI = 72 * RENDER_SCALE;
const PYTHON_DPI = 400;
const DPI_RATIO = RENDER_DPI / PYTHON_DPI;
export const LINE_KERNEL = Math.max(10, Math.round(80 * DPI_RATIO));
export const MIN_AREA = 50;

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
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;

    const pw = canvas.width, ph = canvas.height;
    const cx = Math.max(0, Math.min(pw - 1, Math.round(maskFrac.x * pw)));
    const cy = Math.max(0, Math.min(ph - 1, Math.round(maskFrac.y * ph)));
    const cw = Math.max(1, Math.min(pw - cx, Math.round(maskFrac.w * pw)));
    const ch = Math.max(1, Math.min(ph - cy, Math.round(maskFrac.h * ph)));

    const imgData = canvas.getContext('2d')!.getImageData(cx, cy, cw, ch);
    const d = imgData.data;

    const gray = new Uint8Array(cw * ch);
    for (let j = 0; j < cw * ch; j++) {
      gray[j] = Math.round(0.299 * d[j * 4] + 0.587 * d[j * 4 + 1] + 0.114 * d[j * 4 + 2]);
    }

    const result = extractSignatureStrokes(gray, cw, ch, LINE_KERNEL, MIN_AREA);
    if (result && result.area > bestArea) {
      bestArea = result.area;
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
    let bestPage = pages[0];
    let bestArea = 0;
    for (const p of pages) {
      const canvas = await renderPage(p);
      const pw = canvas.width, ph = canvas.height;
      const cx = Math.max(0, Math.min(pw - 1, Math.round(mask!.x)));
      const cy = Math.max(0, Math.min(ph - 1, Math.round(mask!.y)));
      const cw = Math.max(1, Math.min(pw - cx, Math.round(mask!.width)));
      const ch = Math.max(1, Math.min(ph - cy, Math.round(mask!.height)));
      const imgData = canvas.getContext('2d')!.getImageData(cx, cy, cw, ch);
      const d = imgData.data;
      const gray = new Uint8Array(cw * ch);
      for (let j = 0; j < cw * ch; j++) {
        gray[j] = Math.round(0.299 * d[j * 4] + 0.587 * d[j * 4 + 1] + 0.114 * d[j * 4 + 2]);
      }
      const result = extractSignatureStrokes(gray, cw, ch, LINE_KERNEL, MIN_AREA);
      if (result && result.area > bestArea) {
        bestArea = result.area;
        bestPage = p;
      }
    }
    return bestPage;
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
