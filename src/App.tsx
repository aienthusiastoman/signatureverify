import { useState, useRef, useCallback } from 'react';
import { ArrowRight, ArrowLeft, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import Sidebar from './components/Sidebar';
import StepIndicator from './components/StepIndicator';
import FileDropZone from './components/FileDropZone';
import MaskEditor from './components/MaskEditor';
import MultiMaskEditor, { createEmptyMask } from './components/MultiMaskEditor';
import SignaturePreview from './components/SignaturePreview';
import ResultsPanel from './components/ResultsPanel';
import TemplatePanel from './components/TemplatePanel';
import MaskSelector from './components/MaskSelector';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import ApiKeysPage from './pages/ApiKeysPage';
import ApiDocPage from './pages/ApiDocPage';
import ApiTestPage from './pages/ApiTestPage';
import CustomerManagementPage from './pages/CustomerManagementPage';
import ThemingPage from './pages/ThemingPage';
import TemplatesPage from './pages/TemplatesPage';
import HistoryPage from './pages/HistoryPage';
import MasksPage from './pages/MasksPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { useSignatureProcess } from './hooks/useSignatureProcess';
import {
  extractRegion, extractCompositeRegion, renderPdfPageToCanvas,
  findPageByAnchorText, findPageBySignatureBlob
} from './lib/imageUtils';
import { detectSignatureInRegionFiltered } from './lib/signatureDetect';
import type {
  UploadedFile, MaskRect, MaskDefinition, SignatureRegion,
  MultiSignatureRegion, AppStep, AppView, CompareMode
} from './types';

async function renderPageCanvas(file: UploadedFile, page: number): Promise<HTMLCanvasElement> {
  if (file.type === 'pdf') return renderPdfPageToCanvas(file.file, page);
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = file.previewUrl;
  });
}

type RootView = 'landing' | 'login';

function CompareToolContent() {
  const [step, setStep] = useState<AppStep>('upload');
  const [file1, setFile1] = useState<UploadedFile | null>(null);
  const [file2, setFile2] = useState<UploadedFile | null>(null);
  const [mask1, setMask1] = useState<MaskRect | null>(null);
  const [masks2, setMasks2] = useState<MaskDefinition[]>([createEmptyMask(1, 0)]);
  const [region1, setRegion1] = useState<SignatureRegion | null>(null);
  const [multiRegions2, setMultiRegions2] = useState<MultiSignatureRegion[]>([]);
  const [activeDoc, setActiveDoc] = useState<1 | 2>(1);
  const [extracting, setExtracting] = useState(false);
  const [anchorWarning, setAnchorWarning] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<CompareMode>('lenient');

  const canvas1Ref = useRef<HTMLCanvasElement | null>(null);

  const { loading, error, job, result, processSignatures, processMultiMaskSignatures } = useSignatureProcess();

  const clearFile1 = useCallback(() => {
    if (file1?.previewUrl) URL.revokeObjectURL(file1.previewUrl);
    setFile1(null); setMask1(null); setRegion1(null);
    canvas1Ref.current = null;
  }, [file1]);

  const clearFile2 = useCallback(() => {
    if (file2?.previewUrl) URL.revokeObjectURL(file2.previewUrl);
    setFile2(null);
    setMasks2([createEmptyMask(1, 0)]);
    setMultiRegions2([]);
  }, [file2]);

  const handleLoadTemplate = useCallback((m1: MaskRect, m2: MaskRect, loadedMasks2?: MaskDefinition[]) => {
    setMask1(m1);
    if (loadedMasks2 && loadedMasks2.length > 0) {
      setMasks2(loadedMasks2);
    } else {
      setMasks2([{
        id: `tpl-${Date.now()}`,
        label: 'Mask 1',
        page: m2.page ?? 1,
        anchorText: m2.anchorText,
        pageThumbnail: m2.pageThumbnail,
        pageThumbnailMaskFrac: m2.pageThumbnailMaskFrac,
        autoDetect: m2.autoDetect ?? false,
        regions: (m2.width > 0 && m2.height > 0) ? [{ x: m2.x, y: m2.y, width: m2.width, height: m2.height }] : [],
      }]);
    }
    setActiveDoc(1);
  }, []);

  const handleProceedToMask = () => { if (file1 && file2) setStep('mask'); };

  const resolvePageForMask1 = async (file: UploadedFile, mask: MaskRect): Promise<{ mask: MaskRect; warning?: string }> => {
    if (file.type !== 'pdf') return { mask };

    let frac = mask.pageThumbnailMaskFrac;
    if (!frac && mask.width > 5 && mask.height > 5) {
      const refPage = mask.page ?? 1;
      const refCanvas = await renderPdfPageToCanvas(file.file, refPage);
      const rw = refCanvas.width, rh = refCanvas.height;
      if (rw > 0 && rh > 0) {
        frac = { x: mask.x / rw, y: mask.y / rh, w: mask.width / rw, h: mask.height / rh };
      }
    }

    if (frac) {
      const foundPage = await findPageBySignatureBlob(file.file, frac);
      return { mask: { ...mask, page: foundPage } };
    }

    if (mask.anchorText?.trim()) {
      const textFound = await findPageByAnchorText(file.file, mask.anchorText, mask);
      if (textFound !== null) return { mask: { ...mask, page: textFound } };
      return { mask, warning: `Could not locate "${mask.anchorText}" in ${file.file.name}. Using page ${mask.page ?? 1}.` };
    }

    return { mask };
  };

  const resolvePageForMaskDef = async (
    file: UploadedFile,
    maskDef: MaskDefinition
  ): Promise<{ page: number; warning?: string }> => {
    if (file.type !== 'pdf') return { page: maskDef.page ?? 1 };

    const firstRegion = maskDef.regions[0];

    let frac = maskDef.pageThumbnailMaskFrac;
    if (!frac && firstRegion && firstRegion.width > 5) {
      const refPage = maskDef.page ?? 1;
      const refCanvas = await renderPdfPageToCanvas(file.file, refPage);
      const rw = refCanvas.width, rh = refCanvas.height;
      if (rw > 0 && rh > 0) {
        frac = { x: firstRegion.x / rw, y: firstRegion.y / rh, w: firstRegion.width / rw, h: firstRegion.height / rh };
      }
    }

    if (frac) {
      const foundPage = await findPageBySignatureBlob(file.file, frac);
      return { page: foundPage };
    }

    if (maskDef.anchorText?.trim()) {
      const pseudoMask: MaskRect = firstRegion
        ? { x: firstRegion.x, y: firstRegion.y, width: firstRegion.width, height: firstRegion.height, page: maskDef.page }
        : { x: 0, y: 0, width: 0, height: 0, page: maskDef.page };
      const textFound = await findPageByAnchorText(file.file, maskDef.anchorText, pseudoMask);
      if (textFound !== null) return { page: textFound };
      return { page: maskDef.page ?? 1, warning: `Could not locate "${maskDef.anchorText}" in ${file.file.name}. Using page ${maskDef.page ?? 1}.` };
    }

    return { page: maskDef.page ?? 1 };
  };

  const handleProceedToPreview = async () => {
    if (!file1 || !file2 || !mask1) return;
    setExtracting(true);
    setAnchorWarning(null);

    try {
      const r1 = await resolvePageForMask1(file1, mask1);
      if (r1.warning) setAnchorWarning(r1.warning);

      let resolvedMask1 = r1.mask;
      setMask1(resolvedMask1);

      const page1 = resolvedMask1.page ?? 1;
      const c1 = await renderPageCanvas(file1, page1);
      canvas1Ref.current = c1;

      if (resolvedMask1.autoDetect) {
        const detected = detectSignatureInRegionFiltered(c1, resolvedMask1);
        resolvedMask1 = { ...resolvedMask1, ...detected };
      }

      const crop1 = extractRegion(c1, resolvedMask1);
      setRegion1({
        dataUrl: crop1.toDataURL('image/png'),
        mask: resolvedMask1,
        naturalWidth: c1.width,
        naturalHeight: c1.height,
      });

      const resolvedMultiRegions: MultiSignatureRegion[] = [];

      for (const maskDef of masks2) {
        const { page: resolvedPage, warning } = await resolvePageForMaskDef(file2, maskDef);
        if (warning && !anchorWarning) setAnchorWarning(warning);

        const c2 = await renderPageCanvas(file2, resolvedPage);
        let effectiveRegions = maskDef.regions;

        if (maskDef.autoDetect) {
          const pseudoMask: MaskRect = { x: 0, y: 0, width: c2.width, height: c2.height, page: resolvedPage, autoDetect: true };
          const detected = detectSignatureInRegionFiltered(c2, pseudoMask);
          effectiveRegions = [{ x: detected.x, y: detected.y, width: detected.width, height: detected.height }];
        }

        const crop = extractCompositeRegion(c2, effectiveRegions);
        resolvedMultiRegions.push({
          dataUrl: crop.toDataURL('image/png'),
          maskDef,
          page: resolvedPage,
          naturalWidth: c2.width,
          naturalHeight: c2.height,
        });
      }

      setMultiRegions2(resolvedMultiRegions);
      setStep('preview');
    } catch {
    } finally {
      setExtracting(false);
    }
  };

  const handleProcess = async () => {
    if (!file1 || !file2 || !region1) return;
    setStep('results');
    if (multiRegions2.length === 1 && masks2[0].regions.length <= 1 && !masks2[0].autoDetect) {
      const singleRegion: SignatureRegion = {
        dataUrl: multiRegions2[0].dataUrl,
        mask: {
          x: masks2[0].regions[0]?.x ?? 0,
          y: masks2[0].regions[0]?.y ?? 0,
          width: masks2[0].regions[0]?.width ?? 0,
          height: masks2[0].regions[0]?.height ?? 0,
          page: multiRegions2[0].page,
        },
        naturalWidth: multiRegions2[0].naturalWidth,
        naturalHeight: multiRegions2[0].naturalHeight,
      };
      await processSignatures(file1.file, file2.file, region1, singleRegion, 1.0, compareMode);
    } else {
      await processMultiMaskSignatures(file1.file, file2.file, region1, multiRegions2, compareMode);
    }
  };

  const handleReset = () => { clearFile1(); clearFile2(); setStep('upload'); setAnchorWarning(null); };

  const canProceedToMask = !!file1 && !!file2;
  const maskReady = (m: MaskRect | null) => !!m && (m.autoDetect === true || m.width > 5);
  const masks2Ready = masks2.some(m => m.autoDetect || m.regions.length > 0);
  const canProceedToPreview = maskReady(mask1) && masks2Ready;

  const mask1Summary = mask1 && mask1.width > 0
    ? (masks2.length === 1 && masks2[0].regions.length <= 1)
    : false;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-white text-xl font-black">Verify Signatures</h1>
        <p className="text-slate-400 text-sm font-light">Upload and compare two document signatures</p>
      </div>

      <div className="mb-6">
        <StepIndicator current={step} />
      </div>

      {step === 'upload' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-slate-300 text-sm font-semibold">Document 1 — Reference</label>
              <FileDropZone label="Drop Document 1 here" file={file1} onFile={setFile1} onClear={clearFile1} />
            </div>
            <div className="space-y-2">
              <label className="text-slate-300 text-sm font-semibold">Document 2 — To Verify</label>
              <FileDropZone label="Drop Document 2 here" file={file2} onFile={setFile2} onClear={clearFile2} />
            </div>
          </div>
          <button
            onClick={handleProceedToMask}
            disabled={!canProceedToMask}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors shadow-lg shadow-teal-500/20"
          >
            Define Signature Regions <ArrowRight size={18} />
          </button>
        </div>
      )}

      {step === 'mask' && (
        <div className="space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-black text-white">Define Signature Regions</h2>
            <p className="text-slate-400 font-light text-sm">
              Select regions on Document 1 and define one or more masks on Document 2
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <MaskSelector onApply={handleLoadTemplate} />
          </div>

          <div className="flex justify-center gap-2">
            {([1, 2] as const).map((n) => {
              const hasMask = n === 1
                ? (mask1 && mask1.width > 5)
                : masks2.some(m => m.regions.length > 0 || m.autoDetect);
              const maskPage = n === 1 ? mask1?.page : masks2[0]?.page;
              return (
                <button
                  key={n}
                  onClick={() => setActiveDoc(n)}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                    activeDoc === n ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Document {n}
                  {hasMask && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                      {n === 1 && maskPage && <span className="text-xs opacity-70">p{maskPage}</span>}
                      {n === 2 && <span className="text-xs opacity-70">{masks2.length} mask{masks2.length > 1 ? 's' : ''}</span>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="max-w-3xl mx-auto">
            {activeDoc === 1 && file1 && (
              <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-5">
                <p className="text-slate-300 text-sm font-semibold mb-3 truncate">{file1.file.name}</p>
                <MaskEditor file={file1} mask={mask1} onMaskChange={setMask1} canvasRef={canvas1Ref} showAnchorText />
              </div>
            )}
            {activeDoc === 2 && file2 && (
              <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-5">
                <p className="text-slate-300 text-sm font-semibold mb-3 truncate">{file2.file.name}</p>
                <MultiMaskEditor file={file2} masks={masks2} onMasksChange={setMasks2} />
              </div>
            )}
          </div>

          {anchorWarning && (
            <div className="max-w-3xl mx-auto flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{anchorWarning}</span>
            </div>
          )}

          <div className="max-w-3xl mx-auto flex gap-3">
            <button
              onClick={() => setStep('upload')}
              className="flex items-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              onClick={handleProceedToPreview}
              disabled={!canProceedToPreview || extracting}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors shadow-lg shadow-teal-500/20"
            >
              {extracting
                ? <><Loader2 size={16} className="animate-spin" /> Scanning pages &amp; extracting regions...</>
                : <>Preview Signatures <ArrowRight size={18} /></>}
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-black text-white">Preview Signature Regions</h2>
            <p className="text-slate-400 font-light text-sm">Confirm the extracted regions look correct before comparison</p>
          </div>

          {region1 && (
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 space-y-3">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Document 1 — Reference</p>
              <div className="flex items-center gap-3">
                <p className="text-slate-300 text-xs truncate flex-1">{file1?.file.name}</p>
                {mask1?.page && <span className="text-xs text-teal-400">Page {mask1.page}</span>}
              </div>
              <div className="bg-white rounded-lg p-2 inline-block">
                <img src={region1.dataUrl} alt="Reference signature" className="max-h-24 w-auto" />
              </div>
            </div>
          )}

          {(() => {
            const totalWeight = multiRegions2.reduce((sum, mr) => sum + (mr.maskDef.weight ?? 1), 0);
            const hasWeights = multiRegions2.some(mr => mr.maskDef.weight !== undefined);
            return (
              <div className="space-y-3">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
                  Document 2 — Masks to Verify ({multiRegions2.length})
                  {hasWeights && <span className="ml-2 text-teal-400/70 normal-case font-normal">weighted</span>}
                </p>
                {multiRegions2.map((mr, idx) => {
                  const w = mr.maskDef.weight ?? 1;
                  const pct = totalWeight > 0 ? Math.round((w / totalWeight) * 100) : Math.round(100 / multiRegions2.length);
                  return (
                    <div key={mr.maskDef.id} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-slate-300 text-sm font-semibold">{mr.maskDef.label}</p>
                        <div className="flex items-center gap-2">
                          {hasWeights && (
                            <span className="text-xs bg-slate-800 border border-slate-600 text-slate-400 rounded px-1.5 py-0.5 font-mono">
                              {pct}%
                            </span>
                          )}
                          <span className="text-xs text-teal-400">Page {mr.page}</span>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-2 inline-block">
                        <img src={mr.dataUrl} alt={`Mask ${idx + 1} signature`} className="max-h-24 w-auto" />
                      </div>
                      {mr.maskDef.regions.length > 1 && (
                        <p className="text-slate-500 text-xs">{mr.maskDef.regions.length} regions composited</p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 space-y-2">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Comparison Mode</p>
            <div className="flex items-stretch gap-3">
              <button
                onClick={() => setCompareMode('lenient')}
                className={`flex-1 rounded-xl px-4 py-3 text-left transition-all border ${
                  compareMode === 'lenient'
                    ? 'bg-teal-500/15 border-teal-500/50 text-white'
                    : 'bg-slate-800/60 border-slate-700/40 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <p className="font-bold text-sm">Lenient</p>
                <p className="text-xs opacity-70 mt-0.5">Overall shape similarity — tolerates ink variation and background noise</p>
              </button>
              <button
                onClick={() => setCompareMode('strict')}
                className={`flex-1 rounded-xl px-4 py-3 text-left transition-all border ${
                  compareMode === 'strict'
                    ? 'bg-amber-500/15 border-amber-500/50 text-white'
                    : 'bg-slate-800/60 border-slate-700/40 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <p className="font-bold text-sm">Strict</p>
                <p className="text-xs opacity-70 mt-0.5">Precise curve matching — penalises stroke position and direction differences</p>
              </button>
              <button
                onClick={() => setCompareMode('super_lenient')}
                className={`flex-1 rounded-xl px-4 py-3 text-left transition-all border ${
                  compareMode === 'super_lenient'
                    ? 'bg-sky-500/15 border-sky-500/50 text-white'
                    : 'bg-slate-800/60 border-slate-700/40 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <p className="font-bold text-sm">Super Lenient</p>
                <p className="text-xs opacity-70 mt-0.5">2× boost with wide stroke dilation — best for noisy or ID-card backgrounds</p>
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('mask')}
              className="flex items-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors"
            >
              <ArrowLeft size={16} /> Adjust Regions
            </button>
            <button
              onClick={handleProcess}
              disabled={!region1 || multiRegions2.length === 0}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors shadow-lg shadow-teal-500/20"
            >
              Compare Signatures <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {step === 'results' && (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-black text-white">Comparison Results</h2>
            <p className="text-slate-400 font-light text-sm">Signature analysis complete</p>
          </div>

          {loading && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-10 flex flex-col items-center gap-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-teal-500/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-white font-bold">Analyzing signatures...</p>
                <p className="text-slate-400 text-sm mt-1 font-light">Isolating ink strokes and generating report</p>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 font-bold">Processing Failed</p>
                  <p className="text-red-400/80 text-sm mt-1 font-light">{error}</p>
                </div>
              </div>
              <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-colors">
                <RefreshCw size={15} /> Start Over
              </button>
            </div>
          )}

          {result && !loading && (
            <>
              <ResultsPanel result={result} job={job} />
              <TemplatePanel onLoad={handleLoadTemplate} mask1={mask1} mask2={masks2[0] && masks2[0].regions[0] ? {
                x: masks2[0].regions[0].x,
                y: masks2[0].regions[0].y,
                width: masks2[0].regions[0].width,
                height: masks2[0].regions[0].height,
                page: masks2[0].page,
                anchorText: masks2[0].anchorText,
              } : null} masks2={masks2} showSave={true} />
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('mask')}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors"
                >
                  <ArrowLeft size={16} /> Run Again
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-colors"
                >
                  <RefreshCw size={16} /> New Comparison
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AuthenticatedApp() {
  const { theme } = useTheme();
  const [appView, setAppView] = useState<AppView>('app');

  const PAGE_TITLES: Record<AppView, string> = {
    'app': 'Verify Signatures',
    'history': 'Verification History',
    'masks': 'Masks',
    'profile': 'Profile',
    'api-keys': 'API Keys',
    'api-docs': 'API Documentation',
    'api-test': 'API Testing',
    'customers': 'Customers',
    'theming': 'Theming',
    'templates': 'Templates',
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.bgColor }}>
      <Sidebar currentView={appView} onNavigate={setAppView} />

      <div className="ml-60">
        <header
          className="sticky top-0 z-30 border-b px-8 py-4 flex items-center"
          style={{
            backgroundColor: theme.surfaceColor + 'ee',
            borderBottomColor: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <h2 className="text-sm font-bold tracking-wide" style={{ color: theme.fontColor, opacity: 0.5 }}>
            {PAGE_TITLES[appView]}
          </h2>
        </header>

        <main className="px-8 py-8">
          {appView === 'app' && <CompareToolContent />}
          {appView === 'history' && <HistoryPage />}
          {appView === 'masks' && <MasksPage />}
          {appView === 'profile' && <ProfilePage />}
          {appView === 'api-keys' && <ApiKeysPage />}
          {appView === 'api-docs' && <ApiDocPage />}
          {appView === 'api-test' && <ApiTestPage />}
          {appView === 'customers' && <CustomerManagementPage />}
          {appView === 'theming' && <ThemingPage />}
          {appView === 'templates' && <TemplatesPage />}
        </main>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const [rootView, setRootView] = useState<RootView>('landing');

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    if (rootView === 'login') return <LoginPage onBack={() => setRootView('landing')} />;
    return (
      <LandingPage
        onGetStarted={() => setRootView('login')}
        onLogin={() => setRootView('login')}
      />
    );
  }

  return (
    <ThemeProvider>
      <AuthenticatedApp />
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
