import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Buffer } from "node:buffer";
import { createClient } from "npm:@supabase/supabase-js@2";
import Jimp from "npm:jimp@0.22.12";
import { PDFDocument, rgb, StandardFonts, PageSizes } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function jimpToGray(img: Jimp): { gray: Uint8Array; w: number; h: number } {
  const w = img.getWidth();
  const h = img.getHeight();
  const gray = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const { r, g, b } = Jimp.intToRGBA(img.getPixelColor(x, y));
      gray[y * w + x] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
  }
  return { gray, w, h };
}

function gaussianKernel1D(sigma: number): number[] {
  const half = Math.floor(sigma * 3);
  const kernel: number[] = [];
  let sum = 0;
  for (let i = -half; i <= half; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(v);
    sum += v;
  }
  return kernel.map(v => v / sum);
}

function buildGaussianIntegral(gray: Uint8Array, w: number, h: number, blockSize: number): Float64Array {
  const sigma = (blockSize - 1) / 6;
  const kernel = gaussianKernel1D(sigma);
  const half = Math.floor(kernel.length / 2);

  const tmp = new Float64Array(w * h);
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

  const blurred = new Float64Array(w * h);
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
  return blurred;
}

function adaptiveThresholdGaussian(gray: Uint8Array, w: number, h: number, blockSize: number, C: number): Uint8Array {
  const blurred = buildGaussianIntegral(gray, w, h, blockSize);
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

function extractLargestBlob(bin: Uint8Array, w: number, h: number): { pixels: Uint8Array; area: number } {
  const labels = new Int32Array(w * h);
  let nextLabel = 1;
  const parent: number[] = [0];

  const find = (x: number): number => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (bin[y * w + x] === 0) continue;
      const idx = y * w + x;
      const left = x > 0 ? labels[idx - 1] : 0;
      const top = y > 0 ? labels[(y - 1) * w + x] : 0;
      if (left === 0 && top === 0) {
        labels[idx] = nextLabel;
        parent.push(nextLabel);
        nextLabel++;
      } else if (left > 0 && top === 0) {
        labels[idx] = left;
      } else if (top > 0 && left === 0) {
        labels[idx] = top;
      } else {
        const minL = Math.min(left, top);
        labels[idx] = minL;
        union(left, top);
      }
    }
  }

  for (let i = 0; i < w * h; i++) {
    if (labels[i] > 0) labels[i] = find(labels[i]);
  }

  const areas = new Map<number, number>();
  for (let i = 0; i < w * h; i++) {
    if (labels[i] > 0) areas.set(labels[i], (areas.get(labels[i]) ?? 0) + 1);
  }

  if (areas.size === 0) return { pixels: new Uint8Array(w * h), area: 0 };

  let bestLabel = 0, bestArea = 0;
  for (const [lbl, area] of areas) {
    if (area > bestArea) { bestArea = area; bestLabel = lbl; }
  }

  const result = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (labels[i] === bestLabel) result[i] = 255;
  }
  return { pixels: result, area: bestArea };
}

function removeSmallBlobsInPlace(bin: Uint8Array, w: number, h: number, minArea: number): void {
  const labels = new Int32Array(w * h);
  let labelId = 0;
  const blobMap = new Map<number, number[]>();

  for (let i = 0; i < w * h; i++) {
    if (bin[i] === 0 || labels[i] !== 0) continue;
    labelId++;
    const stack = [i];
    labels[i] = labelId;
    const pixels = [i];
    while (stack.length > 0) {
      const idx = stack.pop()!;
      const cx = idx % w, cy = Math.floor(idx / w);
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const nidx = ny * w + nx;
        if (bin[nidx] === 0 || labels[nidx] !== 0) continue;
        labels[nidx] = labelId;
        stack.push(nidx);
        pixels.push(nidx);
      }
    }
    blobMap.set(labelId, pixels);
  }

  for (const pixels of blobMap.values()) {
    if (pixels.length < minArea) {
      for (const idx of pixels) bin[idx] = 0;
    }
  }
}

function dilate3(bin: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (bin[y * w + x] === 0) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w) out[ny * w + nx] = 255;
        }
      }
    }
  }
  return out;
}

function inwardCropGray(gray: Uint8Array, w: number, h: number, margin: number): { gray: Uint8Array; w: number; h: number } {
  const x0 = Math.min(margin, Math.floor(w / 4));
  const y0 = Math.min(margin, Math.floor(h / 4));
  const x1 = w - x0;
  const y1 = h - y0;
  const nw = x1 - x0;
  const nh = y1 - y0;
  const out = new Uint8Array(nw * nh);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      out[y * nw + x] = gray[(y + y0) * w + (x + x0)];
    }
  }
  return { gray: out, w: nw, h: nh };
}

function tryExtractBlob(gray: Uint8Array, w: number, h: number, C: number): { pixels: Uint8Array; area: number; w: number; h: number } | null {
  const cropped = inwardCropGray(gray, w, h, 6);
  const cg = cropped.gray, cw = cropped.w, ch = cropped.h;

  const thresh = adaptiveThresholdGaussian(cg, cw, ch, 31, C);

  const hLines = morphOpenH(thresh, cw, ch, Math.max(20, Math.floor(cw * 0.15)));
  subtractBin(thresh, hLines);
  const vLines = morphOpenV(thresh, cw, ch, Math.max(20, Math.floor(ch * 0.15)));
  subtractBin(thresh, vLines);

  removeSmallBlobsInPlace(thresh, cw, ch, 20);

  const dilated = dilate3(thresh, cw, ch);
  const { pixels: blobMask, area: blobArea } = extractLargestBlob(dilated, cw, ch);
  if (blobArea < 100) return null;

  if (blobArea > cw * ch * 0.6) return null;

  const result = new Uint8Array(cw * ch);
  for (let i = 0; i < cw * ch; i++) {
    result[i] = blobMask[i] > 0 ? thresh[i] : 0;
  }
  let actualArea = 0;
  for (let i = 0; i < cw * ch; i++) if (result[i] > 0) actualArea++;
  if (actualArea < 50) return null;

  return { pixels: result, area: actualArea, w: cw, h: ch };
}

function extractSignatureBlob(img: Jimp): { pixels: Uint8Array; w: number; h: number } | null {
  const { gray, w, h } = jimpToGray(img);

  let blob = tryExtractBlob(gray, w, h, 15);
  if (!blob) blob = tryExtractBlob(gray, w, h, 10);
  if (!blob) blob = tryExtractBlob(gray, w, h, 20);
  if (!blob) return null;

  return { pixels: blob.pixels, w: blob.w, h: blob.h };
}

function normalizeSignature(bin: Uint8Array, w: number, h: number, targetW = 600, targetH = 250): Uint8Array | null {
  let minX = w, maxX = 0, minY = h, maxY = 0, found = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (bin[y * w + x] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }
  if (!found) return null;

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const scale = Math.min(targetH / cropH, targetW / cropW);
  const newW = Math.round(cropW * scale);
  const newH = Math.round(cropH * scale);

  const resized = new Uint8Array(newW * newH);
  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < newW; x++) {
      const srcX = minX + Math.min(cropW - 1, Math.floor(x / scale));
      const srcY = minY + Math.min(cropH - 1, Math.floor(y / scale));
      resized[y * newW + x] = bin[srcY * w + srcX];
    }
  }

  const canvas = new Uint8Array(targetW * targetH);
  const offsetX = Math.floor((targetW - newW) / 2);
  const offsetY = Math.floor((targetH - newH) / 2);
  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < newW; x++) {
      canvas[(y + offsetY) * targetW + (x + offsetX)] = resized[y * newW + x];
    }
  }
  return canvas;
}

function zhangSuenSkeleton(bin: Uint8Array, w: number, h: number): Uint8Array {
  const img = new Uint8Array(bin);
  const get = (x: number, y: number) =>
    x >= 0 && x < w && y >= 0 && y < h && img[y * w + x] > 0 ? 1 : 0;

  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      const toRemove: number[] = [];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (img[y * w + x] === 0) continue;
          const p2 = get(x, y - 1), p3 = get(x + 1, y - 1), p4 = get(x + 1, y),
            p5 = get(x + 1, y + 1), p6 = get(x, y + 1), p7 = get(x - 1, y + 1),
            p8 = get(x - 1, y), p9 = get(x - 1, y - 1);
          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (B < 2 || B > 6) continue;
          const A = (p2 === 0 && p3 === 1 ? 1 : 0) + (p3 === 0 && p4 === 1 ? 1 : 0) +
            (p4 === 0 && p5 === 1 ? 1 : 0) + (p5 === 0 && p6 === 1 ? 1 : 0) +
            (p6 === 0 && p7 === 1 ? 1 : 0) + (p7 === 0 && p8 === 1 ? 1 : 0) +
            (p8 === 0 && p9 === 1 ? 1 : 0) + (p9 === 0 && p2 === 1 ? 1 : 0);
          if (A !== 1) continue;
          if (pass === 0 && p2 * p4 * p6 !== 0) continue;
          if (pass === 0 && p4 * p6 * p8 !== 0) continue;
          if (pass === 1 && p2 * p4 * p8 !== 0) continue;
          if (pass === 1 && p2 * p6 * p8 !== 0) continue;
          toRemove.push(y * w + x);
        }
      }
      for (const idx of toRemove) { img[idx] = 0; changed = true; }
    }
  }
  return img;
}

function curveProfileSimilarity(sig1: Uint8Array, sig2: Uint8Array, w: number, h: number): number {
  const c1 = new Float64Array(w);
  const c2 = new Float64Array(w);

  for (let x = 0; x < w; x++) {
    let sum1 = 0, cnt1 = 0, sum2 = 0, cnt2 = 0;
    for (let y = 0; y < h; y++) {
      if (sig1[y * w + x] > 0) { sum1 += y; cnt1++; }
      if (sig2[y * w + x] > 0) { sum2 += y; cnt2++; }
    }
    c1[x] = cnt1 > 0 ? sum1 / cnt1 : h;
    c2[x] = cnt2 > 0 ? sum2 / cnt2 : h;
  }

  let m1 = 0, m2 = 0;
  for (let x = 0; x < w; x++) { m1 += c1[x]; m2 += c2[x]; }
  m1 /= w; m2 /= w;

  let s1 = 0, s2 = 0;
  for (let x = 0; x < w; x++) { s1 += (c1[x] - m1) ** 2; s2 += (c2[x] - m2) ** 2; }
  s1 = Math.sqrt(s1 / w) + 1e-6;
  s2 = Math.sqrt(s2 / w) + 1e-6;

  let corr = 0;
  for (let x = 0; x < w; x++) corr += ((c1[x] - m1) / s1) * ((c2[x] - m2) / s2);
  corr /= w;

  return Math.max(0, corr) * 100;
}

function gridDensitySimilarity(img1: Uint8Array, img2: Uint8Array, w: number, h: number, cols = 10, rows = 4): number {
  const cellW = w / cols;
  const cellH = h / rows;
  const d1 = new Float64Array(cols * rows);
  const d2 = new Float64Array(cols * rows);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor(c * cellW), x1 = Math.floor((c + 1) * cellW);
      const y0 = Math.floor(r * cellH), y1 = Math.floor((r + 1) * cellH);
      const cellPx = (x1 - x0) * (y1 - y0);
      let ink1 = 0, ink2 = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (img1[y * w + x] > 0) ink1++;
          if (img2[y * w + x] > 0) ink2++;
        }
      }
      const idx = r * cols + c;
      d1[idx] = cellPx > 0 ? ink1 / cellPx : 0;
      d2[idx] = cellPx > 0 ? ink2 / cellPx : 0;
    }
  }

  const n = cols * rows;
  let m1 = 0, m2 = 0;
  for (let i = 0; i < n; i++) { m1 += d1[i]; m2 += d2[i]; }
  m1 /= n; m2 /= n;

  let num = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < n; i++) {
    const a = d1[i] - m1, b = d2[i] - m2;
    num += a * b; s1 += a * a; s2 += b * b;
  }
  const den = Math.sqrt(s1 * s2);
  return den < 1e-10 ? 0 : Math.max(0, num / den) * 100;
}

function pixelSimilarity(img1: Uint8Array, img2: Uint8Array, n: number): number {
  let inter = 0, union = 0;
  for (let i = 0; i < n; i++) {
    const a = img1[i] > 0 ? 1 : 0;
    const b = img2[i] > 0 ? 1 : 0;
    if (a && b) inter++;
    if (a || b) union++;
  }
  if (union === 0) return 0;
  return (inter / union) * 100;
}

function dilate1(bin: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (bin[y * w + x] === 0) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w) out[ny * w + nx] = 255;
        }
      }
    }
  }
  return out;
}

async function compareSignatures(buf1: ArrayBuffer, buf2: ArrayBuffer, mode: 'lenient' | 'strict' = 'lenient'): Promise<number> {
  const raw1 = await Jimp.read(Buffer.from(buf1));
  const raw2 = await Jimp.read(Buffer.from(buf2));
  raw1.grayscale();
  raw2.grayscale();

  const blob1 = extractSignatureBlob(raw1);
  const blob2 = extractSignatureBlob(raw2);
  if (!blob1 || !blob2) return 0;

  const TARGET_W = 600, TARGET_H = 250;
  const norm1 = normalizeSignature(blob1.pixels, blob1.w, blob1.h, TARGET_W, TARGET_H);
  const norm2 = normalizeSignature(blob2.pixels, blob2.w, blob2.h, TARGET_W, TARGET_H);
  if (!norm1 || !norm2) return 0;

  const skel1 = zhangSuenSkeleton(norm1, TARGET_W, TARGET_H);
  const skel2 = zhangSuenSkeleton(norm2, TARGET_W, TARGET_H);

  const curveScore = curveProfileSimilarity(skel1, skel2, TARGET_W, TARGET_H);
  const gridScore = gridDensitySimilarity(norm1, norm2, TARGET_W, TARGET_H);

  if (mode === 'strict') {
    const iouScore = pixelSimilarity(skel1, skel2, TARGET_W * TARGET_H);
    const rawScore = curveScore * 0.60 + iouScore * 0.30 + gridScore * 0.10;
    return Math.min(100, Math.max(0, rawScore * 1.05));
  }

  const dilSkel1 = dilate1(skel1, TARGET_W, TARGET_H);
  const dilSkel2 = dilate1(skel2, TARGET_W, TARGET_H);
  const iouScore = pixelSimilarity(dilSkel1, dilSkel2, TARGET_W * TARGET_H);
  const rawScore = gridScore * 0.50 + iouScore * 0.30 + curveScore * 0.20;
  return Math.min(100, Math.max(0, rawScore * 1.40));
}

async function cropImageToMask(
  buf: ArrayBuffer,
  mask: { x: number; y: number; width: number; height: number }
): Promise<ArrayBuffer> {
  const img = await Jimp.read(Buffer.from(buf));
  const imgW = img.getWidth();
  const imgH = img.getHeight();
  const x = Math.max(0, Math.min(Math.round(mask.x), imgW - 1));
  const y = Math.max(0, Math.min(Math.round(mask.y), imgH - 1));
  const w = Math.max(1, Math.min(Math.round(mask.width), imgW - x));
  const h = Math.max(1, Math.min(Math.round(mask.height), imgH - y));
  img.crop(x, y, w, h);
  const outBuf = await img.getBufferAsync(Jimp.MIME_PNG);
  return outBuf.buffer as ArrayBuffer;
}

async function generatePDF(
  sig1Bytes: Uint8Array,
  sig2Bytes: Uint8Array,
  score: number,
  file1Name: string,
  file2Name: string,
  jobId: string,
  timestamp: string,
  matchedPage1?: number,
  matchedPage2?: number,
  mode: 'lenient' | 'strict' = 'lenient'
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(PageSizes.A4);
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);

  const scoreColor =
    score >= 75 ? rgb(0.13, 0.77, 0.37) :
    score >= 50 ? rgb(0.96, 0.62, 0.04) :
    rgb(0.93, 0.27, 0.27);

  const darkBg = rgb(0.07, 0.09, 0.13);
  const cardBg = rgb(0.12, 0.15, 0.20);
  const borderColor = rgb(0.22, 0.28, 0.36);
  const white = rgb(1, 1, 1);
  const muted = rgb(0.55, 0.63, 0.72);
  const teal = rgb(0.0, 0.38, 0.50);

  page.drawRectangle({ x: 0, y: 0, width, height, color: darkBg });

  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: teal });
  page.drawText("SignatureVerify", { x: 40, y: height - 35, size: 22, font, color: white });
  page.drawText("Signature Comparison Report", { x: 40, y: height - 58, size: 11, font: fontReg, color: rgb(0.8, 0.95, 1.0) });
  page.drawText(`Generated: ${timestamp}`, { x: width - 220, y: height - 35, size: 10, font: fontReg, color: rgb(0.8, 0.95, 1.0) });
  page.drawText(`Job: ${jobId.slice(0, 8).toUpperCase()}`, { x: width - 220, y: height - 55, size: 10, font: fontReg, color: rgb(0.8, 0.95, 1.0) });

  const scoreSectionY = height - 180;
  page.drawRectangle({ x: 30, y: scoreSectionY - 10, width: width - 60, height: 80, color: cardBg, borderColor, borderWidth: 1 });
  page.drawText("CONFIDENCE SCORE", { x: 50, y: scoreSectionY + 48, size: 9, font, color: muted });

  const scoreLabel = score >= 75 ? "HIGH CONFIDENCE MATCH" : score >= 50 ? "MODERATE MATCH" : "LOW MATCH / MISMATCH";
  page.drawText(`${score.toFixed(1)}%`, { x: 50, y: scoreSectionY + 18, size: 36, font, color: scoreColor });
  page.drawText(scoreLabel, { x: 180, y: scoreSectionY + 28, size: 11, font, color: scoreColor });

  const barX = 180, barY = scoreSectionY + 10, barW = width - 230, barH = 10;
  page.drawRectangle({ x: barX, y: barY, width: barW, height: barH, color: borderColor });
  page.drawRectangle({ x: barX, y: barY, width: Math.max(2, barW * (score / 100)), height: barH, color: scoreColor });

  const docSectionY = scoreSectionY - 30;
  const colW = (width - 90) / 2;

  for (let i = 0; i < 2; i++) {
    const colX = 30 + i * (colW + 30);
    const label = i === 0 ? "Document 1 — Reference" : "Document 2 — To Verify";
    const fname = i === 0 ? file1Name : file2Name;
    const matchedPage = i === 0 ? matchedPage1 : matchedPage2;

    page.drawRectangle({ x: colX, y: docSectionY - 220, width: colW, height: 210, color: cardBg, borderColor, borderWidth: 1 });
    page.drawRectangle({ x: colX, y: docSectionY - 30, width: colW, height: 30, color: i === 0 ? teal : rgb(0.06, 0.62, 0.45) });
    page.drawText(label, { x: colX + 12, y: docSectionY - 20, size: 9, font, color: white });
    page.drawText(fname.length > 35 ? fname.slice(0, 32) + "..." : fname, { x: colX + 12, y: docSectionY - 50, size: 8, font: fontReg, color: muted });
    if (matchedPage !== undefined) {
      page.drawText(`Source page: ${matchedPage}`, { x: colX + 12, y: docSectionY - 63, size: 8, font, color: rgb(0.0, 0.75, 0.65) });
      page.drawText("Extracted Signature Region (ink strokes only)", { x: colX + 12, y: docSectionY - 75, size: 7, font: fontReg, color: muted });
    } else {
      page.drawText("Extracted Signature Region (ink strokes only)", { x: colX + 12, y: docSectionY - 65, size: 8, font: fontReg, color: muted });
    }
  }

  const imgMaxW = colW - 30;
  const imgMaxH = 100;

  try {
    const img1 = await doc.embedPng(sig1Bytes);
    const img2 = await doc.embedPng(sig2Bytes);

    const dims1 = img1.scaleToFit(imgMaxW, imgMaxH);
    const dims2 = img2.scaleToFit(imgMaxW, imgMaxH);

    const img1X = 30 + (colW - dims1.width) / 2;
    const img1Y = docSectionY - 185;
    page.drawRectangle({ x: img1X - 4, y: img1Y - 4, width: dims1.width + 8, height: dims1.height + 8, color: white });
    page.drawImage(img1, { x: img1X, y: img1Y, width: dims1.width, height: dims1.height });

    const img2X = 30 + colW + 30 + (colW - dims2.width) / 2;
    const img2Y = docSectionY - 185;
    page.drawRectangle({ x: img2X - 4, y: img2Y - 4, width: dims2.width + 8, height: dims2.height + 8, color: white });
    page.drawImage(img2, { x: img2X, y: img2Y, width: dims2.width, height: dims2.height });
  } catch (_) {
  }

  const analysisY = docSectionY - 270;
  page.drawRectangle({ x: 30, y: analysisY - 90, width: width - 60, height: 80, color: cardBg, borderColor, borderWidth: 1 });
  const modeLabel = mode === 'strict' ? 'STRICT' : 'LENIENT';
  const modeDesc = mode === 'strict'
    ? 'Strict mode: curve-profile Pearson (60%) + skeleton IoU (30%) + grid density (10%). Boost ×1.05.'
    : 'Lenient mode: grid density correlation (50%) + dilated skeleton IoU (30%) + curve profile (20%). Boost ×1.40.';
  const thresholdDesc = mode === 'strict'
    ? 'Thresholds: 0-59% Mismatch  |  60-79% Moderate Match  |  80-100% High Confidence Match'
    : 'Thresholds: 0-49% Mismatch  |  50-74% Moderate Match  |  75-100% High Confidence Match';

  page.drawText(`ANALYSIS METHODOLOGY  —  ${modeLabel} MODE`, { x: 50, y: analysisY - 18, size: 9, font, color: muted });
  page.drawText(
    "Border-stripped adaptive thresholding + morphological line removal isolates ink strokes.",
    { x: 50, y: analysisY - 35, size: 8, font: fontReg, color: rgb(0.7, 0.77, 0.85) }
  );
  page.drawText(modeDesc, { x: 50, y: analysisY - 48, size: 8, font: fontReg, color: rgb(0.7, 0.77, 0.85) });
  page.drawText(thresholdDesc, { x: 50, y: analysisY - 63, size: 8, font: fontReg, color: rgb(0.7, 0.77, 0.85) });

  page.drawText("This report is generated automatically and should be reviewed by a qualified professional.", {
    x: width / 2 - 165, y: 20, size: 8, font: fontReg, color: rgb(0.4, 0.5, 0.6)
  });

  return doc.save();
}

async function resolveImageBuffers(formData: FormData): Promise<{ buf1: ArrayBuffer; buf2: ArrayBuffer; file1Name: string; file2Name: string; file1Path: string; file2Path: string; mask1Raw: string | null; mask2Raw: string | null; scaleFile2: number; matchedPage1: number | undefined; matchedPage2: number | undefined; mode: 'lenient' | 'strict' }> {
  const file1Name = (formData.get("file1_name") as string) || "document1";
  const file2Name = (formData.get("file2_name") as string) || "document2";
  const file1Path = (formData.get("file1_path") as string) || "";
  const file2Path = (formData.get("file2_path") as string) || "";
  const mask1Raw = formData.get("mask1") as string | null;
  const mask2Raw = formData.get("mask2") as string | null;
  const scaleFile2 = parseFloat((formData.get("scale_file2") as string) || "1.5");
  const mp1 = formData.get("matched_page1") as string | null;
  const mp2 = formData.get("matched_page2") as string | null;
  const matchedPage1 = mp1 ? parseInt(mp1) : undefined;
  const matchedPage2 = mp2 ? parseInt(mp2) : undefined;
  const modeRaw = (formData.get("mode") as string) || "lenient";
  const mode: 'lenient' | 'strict' = modeRaw === 'strict' ? 'strict' : 'lenient';

  const sig1File = formData.get("signature1") as File | null;
  const sig2File = formData.get("signature2") as File | null;

  const b64f1 = formData.get("file1_base64") as string | null;
  const b64f2 = formData.get("file2_base64") as string | null;

  let buf1: ArrayBuffer;
  let buf2: ArrayBuffer;

  if (sig1File && sig2File) {
    buf1 = await sig1File.arrayBuffer();
    buf2 = await sig2File.arrayBuffer();
  } else if (b64f1 && b64f2) {
    buf1 = Buffer.from(b64f1, "base64").buffer;
    buf2 = Buffer.from(b64f2, "base64").buffer;
  } else {
    throw new Error("Either signature files or base64-encoded files are required");
  }

  return { buf1, buf2, file1Name, file2Name, file1Path, file2Path, mask1Raw, mask2Raw, scaleFile2, matchedPage1, matchedPage2, mode };
}

async function resolveFromJson(body: Record<string, unknown>): Promise<{ buf1: ArrayBuffer; buf2: ArrayBuffer; file1Name: string; file2Name: string; file1Path: string; file2Path: string; mask1Raw: string | null; mask2Raw: string | null; scaleFile2: number; templateId: string | null; matchedPage1: number | undefined; matchedPage2: number | undefined; mode: 'lenient' | 'strict' }> {
  const file1Name = (body.file1_name as string) || "document1";
  const file2Name = (body.file2_name as string) || "document2";
  const file1Path = (body.file1_path as string) || "";
  const file2Path = (body.file2_path as string) || "";
  const mask1Raw = body.mask1 ? JSON.stringify(body.mask1) : null;
  const mask2Raw = body.mask2 ? JSON.stringify(body.mask2) : null;
  const scaleFile2 = parseFloat(String(body.scale_file2 || "1.5"));
  const templateId = (body.template_id as string) || null;
  const matchedPage1 = body.matched_page1 !== undefined ? Number(body.matched_page1) : undefined;
  const matchedPage2 = body.matched_page2 !== undefined ? Number(body.matched_page2) : undefined;
  const mode: 'lenient' | 'strict' = body.mode === 'strict' ? 'strict' : 'lenient';

  const b64f1 = body.file1_base64 as string | null;
  const b64f2 = body.file2_base64 as string | null;

  if (!b64f1 || !b64f2) throw new Error("file1_base64 and file2_base64 are required for JSON requests");

  const buf1 = Buffer.from(b64f1, "base64").buffer;
  const buf2 = Buffer.from(b64f2, "base64").buffer;

  return { buf1, buf2, file1Name, file2Name, file1Path, file2Path, mask1Raw, mask2Raw, scaleFile2, templateId, matchedPage1, matchedPage2, mode };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const contentType = req.headers.get("content-type") || "";
    let buf1: ArrayBuffer, buf2: ArrayBuffer;
    let file1Name: string, file2Name: string, file1Path: string, file2Path: string;
    let mask1Raw: string | null, mask2Raw: string | null;
    let scaleFile2: number;
    let matchedPage1: number | undefined;
    let matchedPage2: number | undefined;
    let mode: 'lenient' | 'strict' = 'lenient';

    if (contentType.includes("application/json")) {
      const body = await req.json() as Record<string, unknown>;
      const resolved = await resolveFromJson(body);
      buf1 = resolved.buf1; buf2 = resolved.buf2;
      file1Name = resolved.file1Name; file2Name = resolved.file2Name;
      file1Path = resolved.file1Path; file2Path = resolved.file2Path;
      mask1Raw = resolved.mask1Raw; mask2Raw = resolved.mask2Raw;
      scaleFile2 = resolved.scaleFile2;
      matchedPage1 = resolved.matchedPage1;
      matchedPage2 = resolved.matchedPage2;
      mode = resolved.mode;

      if (resolved.templateId) {
        const { data: tpl } = await supabase.from("templates").select("mask1, mask2").eq("id", resolved.templateId).maybeSingle();
        if (tpl) {
          mask1Raw = JSON.stringify(tpl.mask1);
          mask2Raw = JSON.stringify(tpl.mask2);
        }
      }

      if (mask1Raw && mask2Raw) {
        const m1 = JSON.parse(mask1Raw);
        const m2 = JSON.parse(mask2Raw);
        buf1 = await cropImageToMask(buf1, m1);
        buf2 = await cropImageToMask(buf2, m2);
      }
    } else {
      const formData = await req.formData();
      const resolved = await resolveImageBuffers(formData);
      buf1 = resolved.buf1; buf2 = resolved.buf2;
      file1Name = resolved.file1Name; file2Name = resolved.file2Name;
      file1Path = resolved.file1Path; file2Path = resolved.file2Path;
      mask1Raw = resolved.mask1Raw; mask2Raw = resolved.mask2Raw;
      scaleFile2 = resolved.scaleFile2;
      matchedPage1 = resolved.matchedPage1;
      matchedPage2 = resolved.matchedPage2;
      mode = resolved.mode;
    }

    const { data: job, error: jobErr } = await supabase
      .from("verification_jobs")
      .insert({
        file1_name: file1Name,
        file2_name: file2Name,
        file1_path: file1Path,
        file2_path: file2Path,
        mask1: mask1Raw ? JSON.parse(mask1Raw) : null,
        mask2: mask2Raw ? JSON.parse(mask2Raw) : null,
        status: "processing",
      })
      .select()
      .single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Failed to create job" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const confidenceScore = await compareSignatures(buf1, buf2, mode);

    const timestamp = new Date().toLocaleString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });

    const pdfBytes = await generatePDF(
      new Uint8Array(buf1),
      new Uint8Array(buf2),
      confidenceScore,
      file1Name,
      file2Name,
      job.id,
      timestamp,
      matchedPage1,
      matchedPage2,
      mode
    );

    const resultPath = `results/${job.id}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("signature-results")
      .upload(resultPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      await supabase.from("verification_jobs").update({
        status: "failed",
        error_message: uploadErr.message,
      }).eq("id", job.id);

      return new Response(JSON.stringify({ error: `Failed to store result: ${uploadErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: urlData } = supabase.storage.from("signature-results").getPublicUrl(resultPath);

    await supabase.from("verification_jobs").update({
      status: "completed",
      confidence_score: confidenceScore,
      result_path: resultPath,
    }).eq("id", job.id);

    const responseBody: Record<string, unknown> = {
      jobId: job.id,
      confidenceScore: Math.round(confidenceScore * 10) / 10,
      status: "completed",
      resultUrl: urlData.publicUrl,
      mode,
    };
    if (matchedPage1 !== undefined) responseBody.matchedPage1 = matchedPage1;
    if (matchedPage2 !== undefined) responseBody.matchedPage2 = matchedPage2;

    return new Response(
      JSON.stringify(responseBody),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
