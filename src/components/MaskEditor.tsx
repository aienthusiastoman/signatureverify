import { useRef, useState, useEffect, useCallback } from 'react';
import { Wand2, RotateCcw, Move, ChevronLeft, ChevronRight, FileText, ScanText, Scan, MapPin } from 'lucide-react';
import type { MaskRect, UploadedFile } from '../types';
import { autoDetectSignature } from '../lib/signatureDetect';
import { renderPdfPageToCanvas, renderPdfThumbnail, captureStructuralThumbnail, findAnchorTextPixelBounds } from '../lib/imageUtils';

interface Props {
  file: UploadedFile;
  mask: MaskRect | null;
  onMaskChange: (mask: MaskRect) => void;
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  showAnchorText?: boolean;
}

export default function MaskEditor({ file, mask, onMaskChange, canvasRef, showAnchorText = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const thumbStripRef = useRef<HTMLDivElement>(null);

  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [displayDataUrl, setDisplayDataUrl] = useState('');
  const [pageCount, setPageCount] = useState(1);
  const [selectedPage, setSelectedPage] = useState(mask?.page ?? 1);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [thumbsLoading, setThumbsLoading] = useState(false);

  const isPdf = file.type === 'pdf';
  const autoDetect = mask?.autoDetect ?? false;

  useEffect(() => {
    const count = file.pageCount ?? 1;
    setPageCount(count);
    setSelectedPage(mask?.page ?? 1);

    if (!isPdf || count <= 1) return;

    setThumbsLoading(true);
    const promises = Array.from({ length: count }, (_, i) =>
      renderPdfThumbnail(file.file, i + 1).then(url => ({ page: i + 1, url }))
    );
    Promise.all(promises)
      .then(results => {
        const map: Record<number, string> = {};
        results.forEach(r => { map[r.page] = r.url; });
        setThumbnails(map);
      })
      .finally(() => setThumbsLoading(false));
  }, [file]);

  const renderPage = useCallback(async (pageNum: number) => {
    setLoaded(false);
    setLoadError(null);
    setDisplayDataUrl('');

    try {
      let srcCanvas: HTMLCanvasElement;

      if (isPdf) {
        srcCanvas = await renderPdfPageToCanvas(file.file, pageNum);
      } else {
        srcCanvas = document.createElement('canvas');
        const img = new Image();
        await new Promise<void>((res, rej) => {
          img.onload = () => {
            srcCanvas.width = img.naturalWidth;
            srcCanvas.height = img.naturalHeight;
            srcCanvas.getContext('2d')!.drawImage(img, 0, 0);
            res();
          };
          img.onerror = () => rej(new Error('Image failed to load'));
          img.src = file.previewUrl;
        });
      }

      const offscreen = document.createElement('canvas');
      offscreen.width = srcCanvas.width;
      offscreen.height = srcCanvas.height;
      offscreen.getContext('2d')!.drawImage(srcCanvas, 0, 0);
      canvasRef.current = offscreen;

      const containerWidth = containerRef.current?.clientWidth || 640;
      const scale = Math.min(1, containerWidth / srcCanvas.width, 480 / srcCanvas.height);
      setDisplaySize({ w: Math.round(srcCanvas.width * scale), h: Math.round(srcCanvas.height * scale) });
      setDisplayDataUrl(offscreen.toDataURL('image/png'));
      setLoaded(true);
    } catch (e) {
      setLoadError('Failed to render document.');
    }
  }, [file, isPdf, canvasRef]);

  useEffect(() => {
    renderPage(selectedPage);
  }, [selectedPage, renderPage]);

  const handlePageSelect = (page: number) => {
    if (page === selectedPage) return;
    setSelectedPage(page);
    onMaskChange({ x: 0, y: 0, width: 0, height: 0, page, anchorText: mask?.anchorText, autoDetect: mask?.autoDetect });
    thumbStripRef.current
      ?.querySelector(`[data-page="${page}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  const getRelPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(displaySize.w, e.clientX - rect.left)),
      y: Math.max(0, Math.min(displaySize.h, e.clientY - rect.top)),
    };
  };

  const scaleToNatural = (r: MaskRect): MaskRect => {
    const c = canvasRef.current;
    if (!c || !displaySize.w) return r;
    return {
      x: Math.round(r.x * (c.width / displaySize.w)),
      y: Math.round(r.y * (c.height / displaySize.h)),
      width: Math.round(r.width * (c.width / displaySize.w)),
      height: Math.round(r.height * (c.height / displaySize.h)),
      page: selectedPage,
    };
  };

  const scaleToDisplay = (r: MaskRect): MaskRect => {
    const c = canvasRef.current;
    if (!c || !displaySize.w) return r;
    return {
      x: Math.round(r.x * (displaySize.w / c.width)),
      y: Math.round(r.y * (displaySize.h / c.height)),
      width: Math.round(r.width * (displaySize.w / c.width)),
      height: Math.round(r.height * (displaySize.h / c.height)),
    };
  };

  const drawOverlay = useCallback((displayMask: MaskRect | null, isAuto = false) => {
    const overlay = overlayRef.current;
    if (!overlay || !displaySize.w) return;
    overlay.width = displaySize.w;
    overlay.height = displaySize.h;
    const ctx = overlay.getContext('2d')!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (!displayMask || displayMask.width < 2 || displayMask.height < 2) return;

    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(0, 0, overlay.width, overlay.height);
    ctx.clearRect(displayMask.x, displayMask.y, displayMask.width, displayMask.height);

    ctx.strokeStyle = isAuto ? '#10b981' : '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(displayMask.x, displayMask.y, displayMask.width, displayMask.height);
    ctx.setLineDash([]);

    ctx.fillStyle = isAuto ? '#10b981' : '#3b82f6';
    [[displayMask.x, displayMask.y],
     [displayMask.x + displayMask.width, displayMask.y],
     [displayMask.x, displayMask.y + displayMask.height],
     [displayMask.x + displayMask.width, displayMask.y + displayMask.height],
    ].forEach(([hx, hy]) => {
      ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill();
    });
  }, [displaySize]);

  useEffect(() => {
    if (!loaded) return;
    const maskOnThisPage = mask && (mask.page === selectedPage || !isPdf);
    if (!maskOnThisPage || !mask || mask.width < 2) { drawOverlay(null); return; }
    drawOverlay(scaleToDisplay(mask), mask.autoDetect);
  }, [mask, loaded, selectedPage, drawOverlay]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (autoDetect) return;
    setStartPos(getRelPos(e));
    setDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || autoDetect) return;
    const pos = getRelPos(e);
    drawOverlay({ x: Math.min(pos.x, startPos.x), y: Math.min(pos.y, startPos.y), width: Math.abs(pos.x - startPos.x), height: Math.abs(pos.y - startPos.y) });
  };

  const makeFrac = (natural: { x: number; y: number; width: number; height: number }, c: HTMLCanvasElement) => ({
    x: natural.x / c.width,
    y: natural.y / c.height,
    w: natural.width / c.width,
    h: natural.height / c.height,
  });

  const handleMouseUp = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || autoDetect) return;
    setDrawing(false);
    const pos = getRelPos(e);
    const displayMask: MaskRect = { x: Math.min(pos.x, startPos.x), y: Math.min(pos.y, startPos.y), width: Math.abs(pos.x - startPos.x), height: Math.abs(pos.y - startPos.y) };
    if (displayMask.width > 5 && displayMask.height > 5) {
      const natural = scaleToNatural(displayMask);
      const c = canvasRef.current;
      const frac = c ? makeFrac(natural, c) : undefined;
      const thumb = c ? captureStructuralThumbnail(c, natural) : undefined;

      let anchorRelativeOffset: { dx: number; dy: number } | undefined;
      if (mask?.anchorText?.trim() && isPdf) {
        try {
          const anchorBounds = await findAnchorTextPixelBounds(file.file, selectedPage, mask.anchorText);
          if (anchorBounds) {
            anchorRelativeOffset = { dx: natural.x - anchorBounds.x, dy: natural.y - anchorBounds.y };
          }
        } catch { /* non-fatal */ }
      }

      onMaskChange({ ...natural, anchorText: mask?.anchorText, pageThumbnail: thumb, pageThumbnailMaskFrac: frac, autoDetect: false, anchorRelativeOffset });
    }
  };

  const handleAutoDetect = async () => {
    const c = canvasRef.current;
    if (!c) return;
    const detected = autoDetectSignature(c);
    const frac = makeFrac(detected, c);
    const thumb = captureStructuralThumbnail(c, detected);

    let anchorRelativeOffset: { dx: number; dy: number } | undefined;
    if (mask?.anchorText?.trim() && isPdf) {
      try {
        const anchorBounds = await findAnchorTextPixelBounds(file.file, selectedPage, mask.anchorText);
        if (anchorBounds) {
          anchorRelativeOffset = { dx: detected.x - anchorBounds.x, dy: detected.y - anchorBounds.y };
        }
      } catch { /* non-fatal */ }
    }

    onMaskChange({ ...detected, page: selectedPage, anchorText: mask?.anchorText, pageThumbnail: thumb, pageThumbnailMaskFrac: frac, autoDetect: false, anchorRelativeOffset });
  };

  const handleToggleAutoDetect = () => {
    const c = canvasRef.current;
    const newVal = !autoDetect;
    if (newVal && c) {
      const thumb = captureStructuralThumbnail(c);
      onMaskChange({ x: 0, y: 0, width: c.width, height: c.height, page: selectedPage, anchorText: mask?.anchorText, pageThumbnail: thumb, pageThumbnailMaskFrac: undefined, autoDetect: true });
    } else {
      onMaskChange({ x: 0, y: 0, width: 0, height: 0, page: selectedPage, anchorText: mask?.anchorText, pageThumbnail: mask?.pageThumbnail, pageThumbnailMaskFrac: mask?.pageThumbnailMaskFrac, autoDetect: false });
    }
  };

  const handleReset = () => {
    onMaskChange({ x: 0, y: 0, width: 0, height: 0, page: selectedPage, anchorText: mask?.anchorText, autoDetect: false });
    drawOverlay(null);
  };

  const maskOnThisPage = mask && (mask.page === selectedPage || !isPdf);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {!autoDetect && (
          <button onClick={handleAutoDetect} disabled={!loaded}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors">
            <Wand2 size={13} /> Auto-Detect
          </button>
        )}
        <button onClick={handleReset} disabled={!loaded}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/12 disabled:opacity-40 disabled:cursor-not-allowed text-font text-xs font-medium rounded-lg transition-colors">
          <RotateCcw size={13} /> Reset
        </button>

        <label className="flex items-center gap-2 ml-auto cursor-pointer select-none">
          <div
            onClick={handleToggleAutoDetect}
            className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer ${
              autoDetect ? 'bg-emerald-500' : 'bg-white/10'
            }`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              autoDetect ? 'translate-x-4' : 'translate-x-0.5'
            }`} />
          </div>
          <div className="flex items-center gap-1 text-xs">
            <Scan size={12} className={autoDetect ? 'text-emerald-400' : 'text-font/35'} />
            <span className={autoDetect ? 'text-emerald-300 font-semibold' : 'text-font/40'}>
              Auto-detect signature
            </span>
          </div>
        </label>
      </div>

      {autoDetect && (
        <div className="flex items-start gap-2 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5 text-emerald-300">
          <Scan size={13} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Auto-detect enabled</span>
            <span className="text-emerald-400/70 ml-1">— the entire page will be scanned to find and extract the signature automatically. No need to draw a region.</span>
            {mask?.pageThumbnail && (
              <span className="block mt-1 text-emerald-400/60">Page fingerprint captured for reliable page matching.</span>
            )}
          </div>
        </div>
      )}

      {!autoDetect && (
        <div className="flex items-center gap-1.5 text-font/40 text-xs">
          <Move size={12} /> <span>Draw to select region manually</span>
        </div>
      )}

      {isPdf && pageCount > 1 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-font/40 text-xs font-medium">
              Select page containing the signature
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => handlePageSelect(Math.max(1, selectedPage - 1))} disabled={selectedPage <= 1}
                className="p-1 rounded hover:bg-white/8 disabled:opacity-30 text-font/40 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <span className="text-font/70 text-xs px-1">
                {selectedPage} / {pageCount}
              </span>
              <button onClick={() => handlePageSelect(Math.min(pageCount, selectedPage + 1))} disabled={selectedPage >= pageCount}
                className="p-1 rounded hover:bg-white/8 disabled:opacity-30 text-font/40 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div
            ref={thumbStripRef}
            className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin"
            style={{ scrollbarWidth: 'thin' }}
          >
            {Array.from({ length: pageCount }, (_, i) => i + 1).map(pageNum => {
              const isSelected = pageNum === selectedPage;
              const hasMask = mask?.page === pageNum && (mask?.width ?? 0) > 2;
              const isAutoPage = mask?.page === pageNum && mask?.autoDetect;
              return (
                <button
                  key={pageNum}
                  data-page={pageNum}
                  onClick={() => handlePageSelect(pageNum)}
                  className={`shrink-0 relative rounded-lg overflow-hidden border-2 transition-all ${
                    isSelected
                      ? isAutoPage ? 'border-emerald-500 shadow-lg shadow-emerald-500/30' : 'border-blue-500 shadow-lg shadow-blue-500/30'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                  style={{ width: 80 }}
                >
                  {thumbnails[pageNum] ? (
                    <img src={thumbnails[pageNum]} alt={`Page ${pageNum}`} className="w-full block bg-white" />
                  ) : (
                    <div className="w-full h-24 bg-black/20 flex items-center justify-center">
                      <FileText size={16} className="text-font/35" />
                    </div>
                  )}
                  <div className={`absolute bottom-0 left-0 right-0 text-center py-0.5 text-xs font-medium ${
                    isSelected
                      ? isAutoPage ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
                      : 'bg-black/20 text-font/70'
                  }`}>
                    {pageNum}
                  </div>
                  {(hasMask || isAutoPage) && (
                    <div className={`absolute top-1 right-1 w-2 h-2 rounded-full shadow-sm ${isAutoPage ? 'bg-emerald-400' : 'bg-emerald-400'}`} />
                  )}
                </button>
              );
            })}
            {thumbsLoading && !Object.keys(thumbnails).length && (
              <div className="shrink-0 w-20 h-28 bg-black/20 rounded-lg border border-white/10 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}

      {showAnchorText && isPdf && (
        <div className="bg-black/20 border border-white/8 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <ScanText size={14} className="text-theme shrink-0" />
            <p className="text-font/70 text-xs font-semibold">Smart Page Detection</p>
            {mask?.pageThumbnail && (
              <span className="ml-auto text-xs text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /> Page fingerprint saved
              </span>
            )}
          </div>
          <p className="text-font/35 text-xs leading-relaxed">
            A page fingerprint is captured automatically when you draw a region. Optionally add anchor text as a fallback for extra reliability.
          </p>
          <input
            type="text"
            value={mask?.anchorText ?? ''}
            onChange={e => onMaskChange({ ...(mask ?? { x: 0, y: 0, width: 0, height: 0 }), anchorText: e.target.value, anchorRelativeOffset: undefined })}
            onBlur={async e => {
              const text = e.target.value.trim();
              if (!text || !isPdf || !mask || mask.width <= 5) return;
              const page = mask.page ?? selectedPage;
              const anchorBounds = await findAnchorTextPixelBounds(file.file, page, text).catch(() => null);
              if (anchorBounds) {
                onMaskChange({ ...mask, anchorRelativeOffset: { dx: mask.x - anchorBounds.x, dy: mask.y - anchorBounds.y } });
              }
            }}
            placeholder="e.g. SIGNATURE, Authorized Signatory (optional)"
            className="w-full bg-surface border border-white/10 focus:border-theme outline-none rounded-lg px-3 py-2 text-font text-sm placeholder:text-font/35 transition-colors"
          />
          {mask?.anchorText && !mask?.anchorRelativeOffset && (
            <p className="text-theme text-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-theme rounded-full" />
              Draw or auto-detect the region to lock the position relative to &ldquo;{mask.anchorText}&rdquo;
            </p>
          )}
          {mask?.anchorRelativeOffset && (
            <p className="text-emerald-400 text-xs flex items-center gap-1">
              <MapPin size={11} className="shrink-0" />
              Anchor offset locked — signature position will track &ldquo;{mask.anchorText}&rdquo; across documents
            </p>
          )}
        </div>
      )}

      <div ref={containerRef} className="relative bg-surface rounded-xl overflow-hidden border border-white/8">
        {!loaded && !loadError && (
          <div className="flex items-center justify-center h-52">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-font/40 text-xs">
                {isPdf ? `Rendering page ${selectedPage}...` : 'Loading document...'}
              </p>
            </div>
          </div>
        )}
        {loadError && (
          <div className="flex items-center justify-center h-52">
            <p className="text-red-400 text-xs">{loadError}</p>
          </div>
        )}
        {loaded && displayDataUrl && (
          <div className="relative" style={{ width: displaySize.w, height: displaySize.h, maxWidth: '100%' }}>
            <img src={displayDataUrl} alt={`Page ${selectedPage}`} style={{ width: displaySize.w, height: displaySize.h, display: 'block' }} />
            <canvas
              ref={overlayRef}
              width={displaySize.w}
              height={displaySize.h}
              className={`absolute inset-0 ${autoDetect ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
              style={{ width: displaySize.w, height: displaySize.h }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            {autoDetect && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-xl px-4 py-2 flex items-center gap-2">
                  <Scan size={14} className="text-emerald-400" />
                  <span className="text-emerald-300 text-xs font-semibold">Full page will be scanned automatically</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!autoDetect && maskOnThisPage && mask && mask.width > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {[{ label: 'X', value: mask.x }, { label: 'Y', value: mask.y }, { label: 'W', value: mask.width }, { label: 'H', value: mask.height }].map(({ label, value }) => (
            <div key={label} className="bg-black/20 rounded-lg p-2 text-center border border-white/8">
              <p className="text-font/40 text-xs">{label}</p>
              <p className="text-font text-sm font-mono font-semibold">{value}px</p>
            </div>
          ))}
        </div>
      )}

      {!autoDetect && isPdf && !maskOnThisPage && mask && mask.width > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <span>Region defined on page {mask.page}. Switch to that page to see it, or draw a new one on this page.</span>
        </div>
      )}
    </div>
  );
}
