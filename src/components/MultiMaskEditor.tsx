import { useRef, useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, ChevronLeft, ChevronRight, FileText,
  Wand2, RotateCcw, Move, Scan, ScanText, Square, X, Scale, MapPin
} from 'lucide-react';
import type { MaskDefinition, MaskRegion, UploadedFile } from '../types';
import { autoDetectSignature } from '../lib/signatureDetect';
import { renderPdfPageToCanvas, renderPdfThumbnail, captureStructuralThumbnail, findAnchorTextPixelBounds } from '../lib/imageUtils';

let maskIdCounter = 0;
function newMaskId() { return `mask-${++maskIdCounter}-${Date.now()}`; }

interface Props {
  file: UploadedFile;
  masks: MaskDefinition[];
  onMasksChange: (masks: MaskDefinition[]) => void;
}

interface CanvasState {
  dataUrl: string;
  displayW: number;
  displayH: number;
  naturalW: number;
  naturalH: number;
}

export function createEmptyMask(pageCount: number, index: number): MaskDefinition {
  return {
    id: newMaskId(),
    label: `Mask ${index + 1}`,
    page: 1,
    regions: [],
    autoDetect: false,
  };
}

export default function MultiMaskEditor({ file, masks, onMasksChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const thumbStripRef = useRef<HTMLDivElement>(null);
  const nativeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [activeMaskIdx, setActiveMaskIdx] = useState(0);
  const [pageCount, setPageCount] = useState(file.pageCount ?? 1);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [thumbsLoading, setThumbsLoading] = useState(false);
  const [canvasState, setCanvasState] = useState<CanvasState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [liveRect, setLiveRect] = useState<MaskRegion | null>(null);
  const [anchorSearchFailed, setAnchorSearchFailed] = useState(false);
  const [anchorSearching, setAnchorSearching] = useState(false);

  const isPdf = file.type === 'pdf';
  const activeMask = masks[activeMaskIdx] ?? null;
  const selectedPage = activeMask?.page ?? 1;

  useEffect(() => {
    const count = file.pageCount ?? 1;
    setPageCount(count);
    if (!isPdf || count <= 1) return;
    setThumbsLoading(true);
    Promise.all(
      Array.from({ length: count }, (_, i) =>
        renderPdfThumbnail(file.file, i + 1).then(url => ({ page: i + 1, url }))
      )
    ).then(results => {
      const map: Record<number, string> = {};
      results.forEach(r => { map[r.page] = r.url; });
      setThumbnails(map);
    }).finally(() => setThumbsLoading(false));
  }, [file]);

  const renderPage = useCallback(async (pageNum: number) => {
    setLoadError(null);
    setCanvasState(null);
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
          img.onerror = () => rej(new Error('Failed'));
          img.src = file.previewUrl;
        });
      }
      nativeCanvasRef.current = srcCanvas;
      const containerWidth = containerRef.current?.clientWidth || 640;
      const scale = Math.min(1, containerWidth / srcCanvas.width, 480 / srcCanvas.height);
      setCanvasState({
        dataUrl: srcCanvas.toDataURL('image/png'),
        displayW: Math.round(srcCanvas.width * scale),
        displayH: Math.round(srcCanvas.height * scale),
        naturalW: srcCanvas.width,
        naturalH: srcCanvas.height,
      });
    } catch {
      setLoadError('Failed to render document.');
    }
  }, [file, isPdf]);

  useEffect(() => {
    renderPage(selectedPage);
  }, [selectedPage, renderPage]);

  const scaleToNatural = (r: MaskRegion, cs: CanvasState): MaskRegion => ({
    x: Math.round(r.x * (cs.naturalW / cs.displayW)),
    y: Math.round(r.y * (cs.naturalH / cs.displayH)),
    width: Math.round(r.width * (cs.naturalW / cs.displayW)),
    height: Math.round(r.height * (cs.naturalH / cs.displayH)),
  });

  const scaleToDisplay = (r: MaskRegion, cs: CanvasState): MaskRegion => ({
    x: Math.round(r.x * (cs.displayW / cs.naturalW)),
    y: Math.round(r.y * (cs.displayW / cs.naturalW)),
    width: Math.round(r.width * (cs.displayW / cs.naturalW)),
    height: Math.round(r.height * (cs.displayH / cs.naturalH)),
  });

  const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
  const maskColor = (idx: number) => COLORS[idx % COLORS.length];

  const drawAllOverlays = useCallback((liveDraw?: MaskRegion | null) => {
    const overlay = overlayRef.current;
    const cs = canvasState;
    if (!overlay || !cs) return;
    overlay.width = cs.displayW;
    overlay.height = cs.displayH;
    const ctx = overlay.getContext('2d')!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const activeMaskData = masks[activeMaskIdx];
    if (!activeMaskData) return;

    if (activeMaskData.autoDetect) {
      ctx.fillStyle = 'rgba(16,185,129,0.12)';
      ctx.fillRect(0, 0, cs.displayW, cs.displayH);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(2, 2, cs.displayW - 4, cs.displayH - 4);
      ctx.setLineDash([]);
      return;
    }

    const maskOnThisPage = activeMaskData.page === selectedPage || !isPdf;
    if (!maskOnThisPage) return;

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, cs.displayW, cs.displayH);

    const allRects = [...activeMaskData.regions];
    if (liveDraw) allRects.push(liveDraw);

    for (const r of allRects) {
      const dr = scaleToDisplay(r, cs);
      ctx.clearRect(dr.x, dr.y, dr.width, dr.height);
    }

    const color = maskColor(activeMaskIdx);
    for (let i = 0; i < activeMaskData.regions.length; i++) {
      const r = activeMaskData.regions[i];
      const dr = scaleToDisplay(r, cs);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(dr.x, dr.y, dr.width, dr.height);
      ctx.setLineDash([]);

      ctx.fillStyle = color;
      [[dr.x, dr.y], [dr.x + dr.width, dr.y], [dr.x, dr.y + dr.height], [dr.x + dr.width, dr.y + dr.height]].forEach(([hx, hy]) => {
        ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill();
      });

      ctx.fillStyle = color + 'cc';
      ctx.fillRect(dr.x + 2, dr.y + 2, 18, 14);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(String(i + 1), dr.x + 6, dr.y + 13);
    }

    if (liveDraw) {
      const dr = scaleToDisplay(liveDraw, cs);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(dr.x, dr.y, dr.width, dr.height);
      ctx.setLineDash([]);
    }
  }, [canvasState, masks, activeMaskIdx, selectedPage, isPdf]);

  useEffect(() => {
    drawAllOverlays(liveRect);
  }, [drawAllOverlays, liveRect, canvasState]);

  const getRelPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    const cs = canvasState!;
    return {
      x: Math.max(0, Math.min(cs.displayW, e.clientX - rect.left)),
      y: Math.max(0, Math.min(cs.displayH, e.clientY - rect.top)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!activeMask || activeMask.autoDetect) return;
    setStartPos(getRelPos(e));
    setDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !canvasState) return;
    const pos = getRelPos(e);
    setLiveRect({
      x: Math.min(pos.x, startPos.x),
      y: Math.min(pos.y, startPos.y),
      width: Math.abs(pos.x - startPos.x),
      height: Math.abs(pos.y - startPos.y),
    });
  };

  const handleMouseUp = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !canvasState) return;
    setDrawing(false);
    setLiveRect(null);
    const pos = getRelPos(e);
    const displayRegion: MaskRegion = {
      x: Math.min(pos.x, startPos.x),
      y: Math.min(pos.y, startPos.y),
      width: Math.abs(pos.x - startPos.x),
      height: Math.abs(pos.y - startPos.y),
    };
    if (displayRegion.width < 5 || displayRegion.height < 5) return;
    const natural = scaleToNatural(displayRegion, canvasState);

    let anchorRelativeOffset: { dx: number; dy: number } | undefined;
    const currentMask = masks[activeMaskIdx];
    if (currentMask?.anchorText?.trim() && isPdf) {
      try {
        const anchorBounds = await findAnchorTextPixelBounds(file.file, selectedPage, currentMask.anchorText);
        if (anchorBounds) {
          anchorRelativeOffset = { dx: natural.x - anchorBounds.x, dy: natural.y - anchorBounds.y };
        }
      } catch { /* non-fatal */ }
    }

    const naturalWithOffset: MaskRegion = { ...natural, anchorRelativeOffset };
    const updated = masks.map((m, idx) => {
      if (idx !== activeMaskIdx) return m;
      return { ...m, regions: [...m.regions, naturalWithOffset] };
    });
    onMasksChange(updated);
  };

  const handleAutoDetect = () => {
    const c = nativeCanvasRef.current;
    if (!c) return;
    const detected = autoDetectSignature(c);
    const updated = masks.map((m, idx) => {
      if (idx !== activeMaskIdx) return m;
      return { ...m, regions: [detected], autoDetect: false };
    });
    onMasksChange(updated);
  };

  const handleToggleAutoDetect = () => {
    const c = nativeCanvasRef.current;
    const newVal = !(activeMask?.autoDetect ?? false);
    const updated = masks.map((m, idx) => {
      if (idx !== activeMaskIdx) return m;
      if (newVal && c) {
        const thumb = captureStructuralThumbnail(c);
        return { ...m, autoDetect: true, regions: [], pageThumbnail: thumb };
      }
      return { ...m, autoDetect: false };
    });
    onMasksChange(updated);
  };

  const handleRemoveRegion = (regionIdx: number) => {
    const updated = masks.map((m, idx) => {
      if (idx !== activeMaskIdx) return m;
      return { ...m, regions: m.regions.filter((_, ri) => ri !== regionIdx) };
    });
    onMasksChange(updated);
  };

  const handleResetRegions = () => {
    const updated = masks.map((m, idx) => idx !== activeMaskIdx ? m : { ...m, regions: [], autoDetect: false });
    onMasksChange(updated);
  };

  const handleAddMask = () => {
    const newMask = createEmptyMask(pageCount, masks.length);
    onMasksChange([...masks, newMask]);
    setActiveMaskIdx(masks.length);
  };

  const handleRemoveMask = (idx: number) => {
    if (masks.length <= 1) return;
    const updated = masks.filter((_, i) => i !== idx);
    onMasksChange(updated);
    setActiveMaskIdx(Math.min(activeMaskIdx, updated.length - 1));
  };

  const handlePageSelect = (page: number) => {
    const updated = masks.map((m, idx) => idx !== activeMaskIdx ? m : { ...m, page });
    onMasksChange(updated);
    thumbStripRef.current
      ?.querySelector(`[data-page="${page}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  const handleLabelChange = (val: string) => {
    const updated = masks.map((m, idx) => idx !== activeMaskIdx ? m : { ...m, label: val });
    onMasksChange(updated);
  };

  const handleAnchorChange = (val: string) => {
    setAnchorSearchFailed(false);
    const updated = masks.map((m, idx) => idx !== activeMaskIdx ? m : {
      ...m,
      anchorText: val,
      regions: m.regions.map(r => ({ ...r, anchorRelativeOffset: undefined })),
    });
    onMasksChange(updated);
  };

  const handleWeightChange = (val: string) => {
    const w = parseFloat(val);
    const updated = masks.map((m, idx) => idx !== activeMaskIdx ? m : { ...m, weight: isNaN(w) ? undefined : Math.max(0, w) });
    onMasksChange(updated);
  };

  const handleRegionWeightChange = (regionIdx: number, val: string) => {
    const w = parseFloat(val);
    const updated = masks.map((m, idx) => {
      if (idx !== activeMaskIdx) return m;
      const rw = [...(m.regionWeights ?? m.regions.map(() => 1))];
      rw[regionIdx] = isNaN(w) ? 1 : Math.max(0, w);
      return { ...m, regionWeights: rw };
    });
    onMasksChange(updated);
  };

  const maskOnThisPage = !isPdf || activeMask?.page === selectedPage;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-font/70 text-sm font-semibold">Masks for Document 2</p>
        <button
          onClick={handleAddMask}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-theme hover:bg-theme text-font text-xs font-semibold rounded-lg transition-colors"
        >
          <Plus size={13} /> Add Mask
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {masks.map((m, idx) => {
          const isActive = idx === activeMaskIdx;
          const hasRegions = m.regions.length > 0 || m.autoDetect;
          const color = maskColor(idx);
          return (
            <div key={m.id} className="flex items-center">
              <button
                onClick={() => setActiveMaskIdx(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg text-xs font-semibold transition-all border ${
                  isActive
                    ? 'border-transparent text-font shadow-sm'
                    : 'bg-black/20 border-white/8 text-font/40 hover:text-font hover:border-white/25'
                }`}
                style={isActive ? { backgroundColor: color + 'cc', borderColor: color } : {}}
              >
                <Square size={10} style={{ color: hasRegions ? color : undefined }} fill={hasRegions ? color : 'none'} />
                {m.label}
                {m.page && isPdf && <span className="opacity-60">p{m.page}</span>}
                {hasRegions && !m.autoDetect && (
                  <span className="bg-white/20 rounded px-1">{m.regions.length}</span>
                )}
                {m.autoDetect && <Scan size={10} className="text-emerald-300" />}
              </button>
              {masks.length > 1 && (
                <button
                  onClick={() => handleRemoveMask(idx)}
                  className={`px-1.5 py-1.5 rounded-r-lg border-y border-r text-xs transition-colors ${
                    isActive
                      ? 'border-transparent text-white/70 hover:text-white'
                      : 'bg-black/20 border-white/8 text-font/35 hover:text-red-400 hover:border-red-500/40'
                  }`}
                  style={isActive ? { backgroundColor: color + 'cc', borderColor: color } : {}}
                >
                  <X size={10} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {activeMask && (
        <div className="bg-surface/60 border border-white/8 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-32">
              <input
                type="text"
                value={activeMask.label}
                onChange={e => handleLabelChange(e.target.value)}
                className="w-full bg-black/20 border border-white/10 focus:border-theme outline-none rounded-lg px-3 py-1.5 text-font text-sm placeholder:text-font/35 transition-colors"
                placeholder="Mask label"
              />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Scale size={12} className="text-font/40" />
              <span className="text-font/40 text-xs">Weight</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={activeMask.weight ?? ''}
                onChange={e => handleWeightChange(e.target.value)}
                placeholder="1"
                className="w-16 bg-black/20 border border-white/10 focus:border-theme outline-none rounded-lg px-2 py-1.5 text-font text-xs text-center font-mono placeholder:text-font/25 transition-colors"
              />
            </div>

            {!activeMask.autoDetect && (
              <button
                onClick={handleAutoDetect}
                disabled={!canvasState}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Wand2 size={13} /> Auto-Detect
              </button>
            )}
            <button
              onClick={handleResetRegions}
              disabled={!canvasState}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/12 disabled:opacity-40 text-font text-xs font-medium rounded-lg transition-colors"
            >
              <RotateCcw size={13} /> Reset
            </button>

            <label className="flex items-center gap-2 cursor-pointer select-none ml-auto">
              <div
                onClick={handleToggleAutoDetect}
                className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer ${
                  activeMask.autoDetect ? 'bg-emerald-500' : 'bg-white/10'
                }`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  activeMask.autoDetect ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Scan size={12} className={activeMask.autoDetect ? 'text-emerald-400' : 'text-font/35'} />
                <span className={activeMask.autoDetect ? 'text-emerald-300 font-semibold' : 'text-font/40'}>
                  Auto-detect
                </span>
              </div>
            </label>
          </div>

          {activeMask.autoDetect && (
            <div className="flex items-start gap-2 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5 text-emerald-300">
              <Scan size={13} className="shrink-0 mt-0.5" />
              <span>Full page will be scanned automatically to find the signature.</span>
            </div>
          )}

          {!activeMask.autoDetect && activeMask.regions.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-font/40 text-xs font-medium">Regions in this mask</p>
                {activeMask.regions.length > 1 && (
                  <p className="text-font/30 text-xs">Set weight per region to adjust sub-score influence</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {activeMask.regions.map((r, ri) => {
                  const rw = activeMask.regionWeights?.[ri];
                  return (
                    <div key={ri} className="flex items-center gap-1.5 bg-black/20 border border-white/8 rounded-lg px-2 py-1 text-xs">
                      <span
                        className="w-4 h-4 rounded-sm flex items-center justify-center text-white font-bold text-[10px]"
                        style={{ backgroundColor: maskColor(activeMaskIdx) }}
                      >
                        {ri + 1}
                      </span>
                      <span className="text-font/70 font-mono">{r.width}×{r.height}</span>
                      {activeMask.regions.length > 1 && (
                        <div className="flex items-center gap-1">
                          <Scale size={9} className="text-font/30" />
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={rw ?? ''}
                            onChange={e => handleRegionWeightChange(ri, e.target.value)}
                            placeholder="1"
                            className="w-11 bg-surface border border-white/10 focus:border-theme outline-none rounded px-1 py-0.5 text-font text-xs text-center font-mono placeholder:text-font/25 transition-colors"
                          />
                        </div>
                      )}
                      <button onClick={() => handleRemoveRegion(ri)} className="text-font/35 hover:text-red-400 transition-colors">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!activeMask.autoDetect && (
            <div className="flex items-center gap-1.5 text-font/40 text-xs">
              <Move size={12} /> Draw to add a region — multiple allowed
            </div>
          )}

          {isPdf && pageCount > 1 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-font/40 text-xs font-medium">Page for this mask</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => handlePageSelect(Math.max(1, selectedPage - 1))} disabled={selectedPage <= 1}
                    className="p-1 rounded hover:bg-white/8 disabled:opacity-30 text-font/40">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-font/70 text-xs px-1">{selectedPage} / {pageCount}</span>
                  <button onClick={() => handlePageSelect(Math.min(pageCount, selectedPage + 1))} disabled={selectedPage >= pageCount}
                    className="p-1 rounded hover:bg-white/8 disabled:opacity-30 text-font/40">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div ref={thumbStripRef} className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map(pageNum => {
                  const isSelected = pageNum === selectedPage;
                  return (
                    <button
                      key={pageNum}
                      data-page={pageNum}
                      onClick={() => handlePageSelect(pageNum)}
                      className={`shrink-0 relative rounded-lg overflow-hidden border-2 transition-all`}
                      style={{
                        width: 80,
                        borderColor: isSelected ? maskColor(activeMaskIdx) : '#475569',
                        boxShadow: isSelected ? `0 0 0 2px ${maskColor(activeMaskIdx)}44` : undefined,
                      }}
                    >
                      {thumbnails[pageNum] ? (
                        <img src={thumbnails[pageNum]} alt={`Page ${pageNum}`} className="w-full block bg-white" />
                      ) : (
                        <div className="w-full h-24 bg-black/20 flex items-center justify-center">
                          <FileText size={16} className="text-font/35" />
                        </div>
                      )}
                      <div className={`absolute bottom-0 left-0 right-0 text-center py-0.5 text-xs font-medium ${
                        isSelected ? 'text-white' : 'bg-black/20 text-font/70'
                      }`} style={isSelected ? { backgroundColor: maskColor(activeMaskIdx) } : {}}>
                        {pageNum}
                      </div>
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

          <div className="bg-black/20 border border-white/8 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <ScanText size={13} className="text-theme shrink-0" />
              <p className="text-font/70 text-xs font-semibold">Smart Page Detection &amp; Anchor Positioning</p>
            </div>
            <input
              type="text"
              value={activeMask.anchorText ?? ''}
              onChange={e => handleAnchorChange(e.target.value)}
              onBlur={async e => {
                const text = e.target.value.trim();
                if (!text || !isPdf || !activeMask || activeMask.regions.length === 0) return;
                setAnchorSearching(true);
                setAnchorSearchFailed(false);
                const anchorBounds = await findAnchorTextPixelBounds(file.file, selectedPage, text).catch(() => null);
                setAnchorSearching(false);
                if (!anchorBounds) {
                  setAnchorSearchFailed(true);
                  return;
                }
                setAnchorSearchFailed(false);
                const updated = masks.map((m, idx) => idx !== activeMaskIdx ? m : {
                  ...m,
                  regions: m.regions.map(r => ({
                    ...r,
                    anchorRelativeOffset: { dx: r.x - anchorBounds.x, dy: r.y - anchorBounds.y },
                  })),
                });
                onMasksChange(updated);
              }}
              placeholder="e.g. SIGNATURE, Authorized Signatory (optional)"
              className="w-full bg-surface border border-white/10 focus:border-theme outline-none rounded-lg px-3 py-2 text-font text-sm placeholder:text-font/35 transition-colors"
            />
            {anchorSearching && (
              <p className="text-font/50 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-font/50 rounded-full animate-pulse" />
                Searching document text layer...
              </p>
            )}
            {!anchorSearching && anchorSearchFailed && activeMask.anchorText && (
              <p className="text-amber-400 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full shrink-0" />
                Text &ldquo;{activeMask.anchorText}&rdquo; not found in the document&rsquo;s text layer. This document may be a scanned image without selectable text. The page fingerprint will still be used for page matching.
              </p>
            )}
            {!anchorSearching && !anchorSearchFailed && activeMask.anchorText && !activeMask.regions.some(r => r.anchorRelativeOffset) && (
              <p className="text-theme text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-theme rounded-full" />
                Draw regions to lock positions relative to &ldquo;{activeMask.anchorText}&rdquo;
              </p>
            )}
            {activeMask.anchorText && activeMask.regions.some(r => r.anchorRelativeOffset) && (
              <p className="text-emerald-400 text-xs flex items-center gap-1">
                <MapPin size={11} className="shrink-0" />
                Anchor offset locked for {activeMask.regions.filter(r => r.anchorRelativeOffset).length}/{activeMask.regions.length} region(s) — positions track &ldquo;{activeMask.anchorText}&rdquo;
              </p>
            )}
          </div>

          <div ref={containerRef} className="relative bg-surface rounded-xl overflow-hidden border border-white/8">
            {!canvasState && !loadError && (
              <div className="flex items-center justify-center h-52">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-font/40 text-xs">Rendering page {selectedPage}...</p>
                </div>
              </div>
            )}
            {loadError && (
              <div className="flex items-center justify-center h-52">
                <p className="text-red-400 text-xs">{loadError}</p>
              </div>
            )}
            {canvasState && maskOnThisPage && (
              <div className="relative" style={{ width: canvasState.displayW, height: canvasState.displayH, maxWidth: '100%' }}>
                <img
                  src={canvasState.dataUrl}
                  alt={`Page ${selectedPage}`}
                  style={{ width: canvasState.displayW, height: canvasState.displayH, display: 'block' }}
                />
                <canvas
                  ref={overlayRef}
                  width={canvasState.displayW}
                  height={canvasState.displayH}
                  className={`absolute inset-0 ${activeMask.autoDetect ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
                  style={{ width: canvasState.displayW, height: canvasState.displayH }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => { setDrawing(false); setLiveRect(null); }}
                />
                {activeMask.autoDetect && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-xl px-4 py-2 flex items-center gap-2">
                      <Scan size={14} className="text-emerald-400" />
                      <span className="text-emerald-300 text-xs font-semibold">Full page will be scanned automatically</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {canvasState && !maskOnThisPage && (
              <div className="flex items-center justify-center h-40">
                <p className="text-amber-400 text-xs text-center px-4">
                  This mask targets page {activeMask.page}. Switch to page {activeMask.page} to see the overlay, or change the page above.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
