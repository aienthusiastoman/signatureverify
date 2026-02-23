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
