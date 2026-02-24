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

function regionHasInkContent(
  canvas: HTMLCanvasElement,
  mask: { x: number; y: number; width: number; height: number },
  minDarkRatio = 0.002
): boolean {
  return getRegionInkRatio(canvas, mask) >= minDarkRatio;
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
    const SIGNATURE_MIN = 0.008;
    const SIGNATURE_MAX = 0.12;
    const entries: { page: number; ratio: number }[] = [];
    for (const p of pages) {
      const canvas = await renderPage(p);
      entries.push({ page: p, ratio: getRegionInkRatio(canvas, mask!) });
    }
    const inRange = entries.filter(e => e.ratio >= SIGNATURE_MIN && e.ratio <= SIGNATURE_MAX);
    const pool = inRange.length > 0 ? inRange : entries.filter(e => e.ratio >= SIGNATURE_MIN);
    if (pool.length === 0) return pages[0];
    return pool.reduce((a, b) => a.ratio > b.ratio ? a : b).page;
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
