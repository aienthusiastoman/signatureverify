import type { VisualAnchor } from '../types';

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

export function captureVisualAnchorFromRect(
  canvas: HTMLCanvasElement,
  anchorRect: { x: number; y: number; width: number; height: number },
  maskRect: { x: number; y: number; width: number; height: number }
): VisualAnchor {
  const patchCanvas = document.createElement('canvas');
  patchCanvas.width = anchorRect.width;
  patchCanvas.height = anchorRect.height;
  patchCanvas.getContext('2d')!.drawImage(
    canvas,
    anchorRect.x, anchorRect.y, anchorRect.width, anchorRect.height,
    0, 0, anchorRect.width, anchorRect.height
  );

  const cw = canvas.width;
  const ch = canvas.height;

  return {
    patchDataUrl: patchCanvas.toDataURL('image/png'),
    patchRect: { ...anchorRect },
    offsetToMask: {
      dx: maskRect.x - anchorRect.x,
      dy: maskRect.y - anchorRect.y,
    },
    anchorFrac: {
      x: anchorRect.x / cw,
      y: anchorRect.y / ch,
      w: anchorRect.width / cw,
      h: anchorRect.height / ch,
    },
    maskFrac: {
      x: maskRect.x / cw,
      y: maskRect.y / ch,
      w: maskRect.width / cw,
      h: maskRect.height / ch,
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
  if (pw < 4 || ph < 4) return null;

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

  const downscale = Math.max(1, Math.floor(Math.max(pageW, pageH) / 600));
  const dsW = Math.floor(pageW / downscale);
  const dsH = Math.floor(pageH / downscale);
  const dsPw = Math.max(2, Math.floor(pw / downscale));
  const dsPh = Math.max(2, Math.floor(ph / downscale));

  let dsPageGray: Uint8Array;
  let dsPatchGray: Uint8Array;

  if (downscale > 1) {
    dsPageGray = new Uint8Array(dsW * dsH);
    for (let y = 0; y < dsH; y++) {
      for (let x = 0; x < dsW; x++) {
        dsPageGray[y * dsW + x] = pageGray[y * downscale * pageW + x * downscale];
      }
    }
    dsPatchGray = new Uint8Array(dsPw * dsPh);
    for (let y = 0; y < dsPh; y++) {
      for (let x = 0; x < dsPw; x++) {
        dsPatchGray[y * dsPw + x] = patchGray[y * downscale * pw + x * downscale];
      }
    }
  } else {
    dsPageGray = pageGray;
    dsPatchGray = patchGray;
  }

  let dsPatchSum = 0;
  let dsPatchSumSq = 0;
  const dsPatchN = dsPw * dsPh;
  for (let i = 0; i < dsPatchN; i++) {
    dsPatchSum += dsPatchGray[i];
    dsPatchSumSq += dsPatchGray[i] * dsPatchGray[i];
  }
  const dsPatchMean = dsPatchSum / dsPatchN;
  const dsPatchStd = Math.sqrt(Math.max(0, dsPatchSumSq / dsPatchN - dsPatchMean * dsPatchMean));
  if (dsPatchStd < 1) return null;

  const coarseStep = Math.max(1, Math.floor(Math.min(dsPw, dsPh) / 4));
  let bestNcc = -1;
  let bestDsX = 0;
  let bestDsY = 0;

  for (let ty = 0; ty <= dsH - dsPh; ty += coarseStep) {
    for (let tx = 0; tx <= dsW - dsPw; tx += coarseStep) {
      let rSum = 0, rSumSq = 0, crossSum = 0;
      for (let y = 0; y < dsPh; y++) {
        const rowOff = (ty + y) * dsW + tx;
        const pRowOff = y * dsPw;
        for (let x = 0; x < dsPw; x++) {
          const v = dsPageGray[rowOff + x];
          const p = dsPatchGray[pRowOff + x];
          rSum += v;
          rSumSq += v * v;
          crossSum += v * p;
        }
      }
      const rMean = rSum / dsPatchN;
      const rStd = Math.sqrt(Math.max(0, rSumSq / dsPatchN - rMean * rMean));
      if (rStd < 1) continue;
      const ncc = (crossSum / dsPatchN - rMean * dsPatchMean) / (rStd * dsPatchStd);
      if (ncc > bestNcc) {
        bestNcc = ncc;
        bestDsX = tx;
        bestDsY = ty;
      }
    }
  }

  if (bestNcc < 0.25) return null;

  let bestFullX = bestDsX * downscale;
  let bestFullY = bestDsY * downscale;
  let bestFullNcc = bestNcc;

  const searchR = Math.max(coarseStep * downscale, 20);
  const refineStep = Math.max(1, Math.floor(Math.min(pw, ph) / 12));

  for (let ty = Math.max(0, bestFullY - searchR); ty <= Math.min(pageH - ph, bestFullY + searchR); ty += refineStep) {
    for (let tx = Math.max(0, bestFullX - searchR); tx <= Math.min(pageW - pw, bestFullX + searchR); tx += refineStep) {
      let rSum = 0, rSumSq = 0, crossSum = 0;
      for (let y = 0; y < ph; y++) {
        const rowOff = (ty + y) * pageW + tx;
        const pRowOff = y * pw;
        for (let x = 0; x < pw; x++) {
          const v = pageGray[rowOff + x];
          const p = patchGray[pRowOff + x];
          rSum += v;
          rSumSq += v * v;
          crossSum += v * p;
        }
      }
      const rMean = rSum / patchN;
      const rStd = Math.sqrt(Math.max(0, rSumSq / patchN - rMean * rMean));
      if (rStd < 1) continue;
      const ncc = (crossSum / patchN - rMean * patchMean) / (rStd * patchStd);
      if (ncc > bestFullNcc) {
        bestFullNcc = ncc;
        bestFullX = tx;
        bestFullY = ty;
      }
    }
  }

  const fineR = refineStep;
  let finalNcc = bestFullNcc;
  let finalX = bestFullX;
  let finalY = bestFullY;

  for (let ty = Math.max(0, bestFullY - fineR); ty <= Math.min(pageH - ph, bestFullY + fineR); ty++) {
    for (let tx = Math.max(0, bestFullX - fineR); tx <= Math.min(pageW - pw, bestFullX + fineR); tx++) {
      let rSum = 0, rSumSq = 0, crossSum = 0;
      for (let y = 0; y < ph; y++) {
        const rowOff = (ty + y) * pageW + tx;
        const pRowOff = y * pw;
        for (let x = 0; x < pw; x++) {
          const v = pageGray[rowOff + x];
          const p = patchGray[pRowOff + x];
          rSum += v;
          rSumSq += v * v;
          crossSum += v * p;
        }
      }
      const rMean = rSum / patchN;
      const rStd = Math.sqrt(Math.max(0, rSumSq / patchN - rMean * rMean));
      if (rStd < 1) continue;
      const ncc = (crossSum / patchN - rMean * patchMean) / (rStd * patchStd);
      if (ncc > finalNcc) {
        finalNcc = ncc;
        finalX = tx;
        finalY = ty;
      }
    }
  }

  if (finalNcc < 0.3) return null;

  return { x: finalX, y: finalY, confidence: finalNcc };
}

export function resolveVisualAnchorByFraction(
  canvas: HTMLCanvasElement,
  anchor: VisualAnchor
): { maskX: number; maskY: number } | null {
  if (!anchor.maskFrac) return null;
  const cw = canvas.width;
  const ch = canvas.height;
  return {
    maskX: Math.round(anchor.maskFrac.x * cw),
    maskY: Math.round(anchor.maskFrac.y * ch),
  };
}

export async function resolveVisualAnchorPosition(
  canvas: HTMLCanvasElement,
  anchor: VisualAnchor
): Promise<{ maskX: number; maskY: number; confidence: number }> {
  const fracResult = resolveVisualAnchorByFraction(canvas, anchor);

  const nccResult = await findVisualAnchorOnCanvas(canvas, anchor);
  if (nccResult && nccResult.confidence >= 0.5) {
    return {
      maskX: Math.round(nccResult.x + anchor.offsetToMask.dx),
      maskY: Math.round(nccResult.y + anchor.offsetToMask.dy),
      confidence: nccResult.confidence,
    };
  }

  if (fracResult) {
    return { ...fracResult, confidence: 0.6 };
  }

  return {
    maskX: anchor.patchRect.x + anchor.offsetToMask.dx,
    maskY: anchor.patchRect.y + anchor.offsetToMask.dy,
    confidence: 0.3,
  };
}
