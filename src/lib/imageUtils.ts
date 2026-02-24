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

export function captureStructuralThumbnail(canvas: HTMLCanvasElement, targetWidth = 150): string {
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

export async function findPageByThumbnail(file: File, refThumbnailDataUrl: string): Promise<number> {
  const pdfjsLib = getPdfjsLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const MATCH_W = 120;
  const MATCH_H = 160;
  const refPixels = await dataUrlToGrayPixels(refThumbnailDataUrl, MATCH_W, MATCH_H);

  let bestPage = 1;
  let bestScore = -Infinity;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const baseVP = page.getViewport({ scale: 1.0 });
    const scale = MATCH_W / baseVP.width;
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
    const pixels = canvasToGrayPixels(canvas, MATCH_W, MATCH_H);
    const score = nccPixels(refPixels, pixels);
    if (score > bestScore) { bestScore = score; bestPage = i; }
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
