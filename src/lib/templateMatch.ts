import type { VisualAnchor } from '../types';

const ANCHOR_PATCH_SIZE = 150;

function canvasToGray(canvas: HTMLCanvasElement): { gray: Uint8Array; w: number; h: number } {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const d = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
  }
  return { gray, w, h };
}

function imageDataToGray(data: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
  }
  return gray;
}

function dataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')!.drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function selectAnchorPatchAuto(
  canvas: HTMLCanvasElement,
  maskRect: { x: number; y: number; width: number; height: number }
): { patchRect: { x: number; y: number; width: number; height: number }; patchDataUrl: string } | null {
  const cw = canvas.width;
  const ch = canvas.height;
  if (cw < 40 || ch < 40) return null;

  const ctx = canvas.getContext('2d')!;
  const patchW = Math.min(ANCHOR_PATCH_SIZE, Math.floor(cw * 0.25));
  const patchH = Math.min(ANCHOR_PATCH_SIZE, Math.floor(ch * 0.25));

  const candidates: { x: number; y: number; score: number }[] = [];

  const maskCX = maskRect.x + maskRect.width / 2;
  const maskCY = maskRect.y + maskRect.height / 2;

  const offsets = [
    { x: maskRect.x - patchW - 20, y: maskRect.y },
    { x: maskRect.x + maskRect.width + 20, y: maskRect.y },
    { x: maskRect.x, y: maskRect.y - patchH - 20 },
    { x: maskRect.x, y: maskRect.y + maskRect.height + 20 },
    { x: 20, y: 20 },
    { x: cw - patchW - 20, y: 20 },
    { x: 20, y: ch - patchH - 20 },
    { x: cw - patchW - 20, y: ch - patchH - 20 },
    { x: Math.floor(cw / 2 - patchW / 2), y: 20 },
    { x: 20, y: Math.floor(ch / 2 - patchH / 2) },
  ];

  for (const pos of offsets) {
    const px = Math.max(0, Math.min(cw - patchW, Math.round(pos.x)));
    const py = Math.max(0, Math.min(ch - patchH, Math.round(pos.y)));

    const overlapX = Math.max(0, Math.min(px + patchW, maskRect.x + maskRect.width) - Math.max(px, maskRect.x));
    const overlapY = Math.max(0, Math.min(py + patchH, maskRect.y + maskRect.height) - Math.max(py, maskRect.y));
    if (overlapX > 0 && overlapY > 0) continue;

    const imgData = ctx.getImageData(px, py, patchW, patchH);
    const d = imgData.data;

    let sum = 0;
    let sumSq = 0;
    const n = patchW * patchH;
    for (let i = 0; i < n; i++) {
      const g = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
      sum += g;
      sumSq += g * g;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;

    let edgeCount = 0;
    const gray = imageDataToGray(d, patchW, patchH);
    for (let y = 1; y < patchH - 1; y++) {
      for (let x = 1; x < patchW - 1; x++) {
        const gx = gray[y * patchW + x + 1] - gray[y * patchW + x - 1];
        const gy = gray[(y + 1) * patchW + x] - gray[(y - 1) * patchW + x];
        if (Math.abs(gx) + Math.abs(gy) > 40) edgeCount++;
      }
    }

    const edgeDensity = edgeCount / n;
    const patchCX = px + patchW / 2;
    const patchCY = py + patchH / 2;
    const dist = Math.sqrt((patchCX - maskCX) ** 2 + (patchCY - maskCY) ** 2);
    const maxDist = Math.sqrt(cw * cw + ch * ch);
    const proxPenalty = 1 - (dist / maxDist) * 0.3;

    const score = (variance * 0.4 + edgeDensity * 15000 * 0.6) * proxPenalty;

    if (variance > 100 && edgeDensity > 0.02) {
      candidates.push({ x: px, y: py, score });
    }
  }

  if (candidates.length === 0) {
    for (const pos of offsets) {
      const px = Math.max(0, Math.min(cw - patchW, Math.round(pos.x)));
      const py = Math.max(0, Math.min(ch - patchH, Math.round(pos.y)));
      const overlapX = Math.max(0, Math.min(px + patchW, maskRect.x + maskRect.width) - Math.max(px, maskRect.x));
      const overlapY = Math.max(0, Math.min(py + patchH, maskRect.y + maskRect.height) - Math.max(py, maskRect.y));
      if (overlapX > 0 && overlapY > 0) continue;
      candidates.push({ x: px, y: py, score: 1 });
      break;
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  const patchCanvas = document.createElement('canvas');
  patchCanvas.width = patchW;
  patchCanvas.height = patchH;
  patchCanvas.getContext('2d')!.drawImage(canvas, best.x, best.y, patchW, patchH, 0, 0, patchW, patchH);

  return {
    patchRect: { x: best.x, y: best.y, width: patchW, height: patchH },
    patchDataUrl: patchCanvas.toDataURL('image/png'),
  };
}

export function captureVisualAnchor(
  canvas: HTMLCanvasElement,
  maskRect: { x: number; y: number; width: number; height: number }
): VisualAnchor | null {
  const result = selectAnchorPatchAuto(canvas, maskRect);
  if (!result) return null;

  return {
    patchDataUrl: result.patchDataUrl,
    patchRect: result.patchRect,
    offsetToMask: {
      dx: maskRect.x - result.patchRect.x,
      dy: maskRect.y - result.patchRect.y,
    },
  };
}

export async function findVisualAnchorOnCanvas(
  canvas: HTMLCanvasElement,
  anchor: VisualAnchor
): Promise<{ x: number; y: number; confidence: number } | null> {
  const patchCanvas = await dataUrlToCanvas(anchor.patchDataUrl);
  const pw = patchCanvas.width;
  const ph = patchCanvas.height;

  const { gray: pageGray, w: pageW, h: pageH } = canvasToGray(canvas);
  const { gray: patchGray } = canvasToGray(patchCanvas);

  let patchSum = 0;
  let patchSumSq = 0;
  const patchN = pw * ph;
  for (let i = 0; i < patchN; i++) {
    patchSum += patchGray[i];
    patchSumSq += patchGray[i] * patchGray[i];
  }
  const patchMean = patchSum / patchN;
  const patchStd = Math.sqrt(Math.max(0, patchSumSq / patchN - patchMean * patchMean));
  if (patchStd < 1) return null;

  const stepX = Math.max(1, Math.floor(pw / 8));
  const stepY = Math.max(1, Math.floor(ph / 8));

  let bestNcc = -1;
  let bestX = 0;
  let bestY = 0;

  for (let ty = 0; ty <= pageH - ph; ty += stepY) {
    for (let tx = 0; tx <= pageW - pw; tx += stepX) {
      let regionSum = 0;
      let regionSumSq = 0;
      let crossSum = 0;

      for (let y = 0; y < ph; y++) {
        const rowOffset = (ty + y) * pageW + tx;
        const patchRowOffset = y * pw;
        for (let x = 0; x < pw; x++) {
          const v = pageGray[rowOffset + x];
          const p = patchGray[patchRowOffset + x];
          regionSum += v;
          regionSumSq += v * v;
          crossSum += v * p;
        }
      }

      const regionMean = regionSum / patchN;
      const regionStd = Math.sqrt(Math.max(0, regionSumSq / patchN - regionMean * regionMean));
      if (regionStd < 1) continue;

      const ncc = (crossSum / patchN - regionMean * patchMean) / (regionStd * patchStd);

      if (ncc > bestNcc) {
        bestNcc = ncc;
        bestX = tx;
        bestY = ty;
      }
    }
  }

  if (bestNcc < 0.3) return null;

  const refineRadius = Math.max(stepX, stepY);
  let refinedNcc = bestNcc;
  let refinedX = bestX;
  let refinedY = bestY;

  for (let ty = Math.max(0, bestY - refineRadius); ty <= Math.min(pageH - ph, bestY + refineRadius); ty++) {
    for (let tx = Math.max(0, bestX - refineRadius); tx <= Math.min(pageW - pw, bestX + refineRadius); tx++) {
      let regionSum = 0;
      let regionSumSq = 0;
      let crossSum = 0;

      for (let y = 0; y < ph; y++) {
        const rowOffset = (ty + y) * pageW + tx;
        const patchRowOffset = y * pw;
        for (let x = 0; x < pw; x++) {
          const v = pageGray[rowOffset + x];
          const p = patchGray[patchRowOffset + x];
          regionSum += v;
          regionSumSq += v * v;
          crossSum += v * p;
        }
      }

      const regionMean = regionSum / patchN;
      const regionStd = Math.sqrt(Math.max(0, regionSumSq / patchN - regionMean * regionMean));
      if (regionStd < 1) continue;

      const ncc = (crossSum / patchN - regionMean * patchMean) / (regionStd * patchStd);

      if (ncc > refinedNcc) {
        refinedNcc = ncc;
        refinedX = tx;
        refinedY = ty;
      }
    }
  }

  return {
    x: refinedX,
    y: refinedY,
    confidence: refinedNcc,
  };
}

export async function resolveVisualAnchorPosition(
  canvas: HTMLCanvasElement,
  anchor: VisualAnchor
): Promise<{ maskX: number; maskY: number; confidence: number } | null> {
  const found = await findVisualAnchorOnCanvas(canvas, anchor);
  if (!found) return null;

  return {
    maskX: Math.round(found.x + anchor.offsetToMask.dx),
    maskY: Math.round(found.y + anchor.offsetToMask.dy),
    confidence: found.confidence,
  };
}

export async function findPageByVisualAnchor(
  anchor: VisualAnchor,
  renderPage: (pageNum: number) => Promise<HTMLCanvasElement>,
  totalPages: number
): Promise<{ page: number; confidence: number } | null> {
  let bestPage = -1;
  let bestConfidence = 0;

  for (let i = 1; i <= totalPages; i++) {
    const canvas = await renderPage(i);
    const result = await findVisualAnchorOnCanvas(canvas, anchor);
    if (result && result.confidence > bestConfidence) {
      bestConfidence = result.confidence;
      bestPage = i;
    }
  }

  if (bestPage < 0 || bestConfidence < 0.3) return null;
  return { page: bestPage, confidence: bestConfidence };
}
