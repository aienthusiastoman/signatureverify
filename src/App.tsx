import { useState, useRef, useCallback } from 'react';
import { ArrowRight, ArrowLeft, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import Sidebar from './components/Sidebar';
import StepIndicator from './components/StepIndicator';
import FileDropZone from './components/FileDropZone';
import MaskEditor from './components/MaskEditor';
import SignaturePreview from './components/SignaturePreview';
import ResultsPanel from './components/ResultsPanel';
import TemplatePanel from './components/TemplatePanel';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import ApiKeysPage from './pages/ApiKeysPage';
import ApiDocPage from './pages/ApiDocPage';
import ApiTestPage from './pages/ApiTestPage';
import CustomerManagementPage from './pages/CustomerManagementPage';
import ThemingPage from './pages/ThemingPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { useSignatureProcess } from './hooks/useSignatureProcess';
import { extractRegion, renderPdfPageToCanvas } from './lib/imageUtils';
import type { UploadedFile, MaskRect, SignatureRegion, AppStep, AppView } from './types';

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
  const [mask2, setMask2] = useState<MaskRect | null>(null);
  const [region1, setRegion1] = useState<SignatureRegion | null>(null);
  const [region2, setRegion2] = useState<SignatureRegion | null>(null);
  const [activeDoc, setActiveDoc] = useState<1 | 2>(1);
  const [extracting, setExtracting] = useState(false);

  const canvas1Ref = useRef<HTMLCanvasElement | null>(null);
  const canvas2Ref = useRef<HTMLCanvasElement | null>(null);

  const { loading, error, job, result, processSignatures } = useSignatureProcess();

  const clearFile1 = useCallback(() => {
    if (file1?.previewUrl) URL.revokeObjectURL(file1.previewUrl);
    setFile1(null); setMask1(null); setRegion1(null);
    canvas1Ref.current = null;
  }, [file1]);

  const clearFile2 = useCallback(() => {
    if (file2?.previewUrl) URL.revokeObjectURL(file2.previewUrl);
    setFile2(null); setMask2(null); setRegion2(null);
    canvas2Ref.current = null;
  }, [file2]);

  const handleLoadTemplate = useCallback((m1: MaskRect, m2: MaskRect) => {
    setMask1(m1); setMask2(m2); setActiveDoc(1);
  }, []);

  const handleProceedToMask = () => { if (file1 && file2) setStep('mask'); };

  const handleProceedToPreview = async () => {
    if (!file1 || !file2 || !mask1 || !mask2) return;
    setExtracting(true);
    try {
      const page1 = mask1.page ?? 1;
      const page2 = mask2.page ?? 1;
      const c1 = await renderPageCanvas(file1, page1);
      const c2 = await renderPageCanvas(file2, page2);
      canvas1Ref.current = c1;
      canvas2Ref.current = c2;
      const crop1 = extractRegion(c1, mask1);
      const crop2 = extractRegion(c2, mask2);
      setRegion1({ dataUrl: crop1.toDataURL('image/png'), mask: mask1, naturalWidth: c1.width, naturalHeight: c1.height });
      setRegion2({ dataUrl: crop2.toDataURL('image/png'), mask: mask2, naturalWidth: c2.width, naturalHeight: c2.height });
      setStep('preview');
    } catch { /* silent */ }
    finally { setExtracting(false); }
  };

  const handleProcess = async () => {
    if (!file1 || !file2 || !region1 || !region2) return;
    setStep('results');
    await processSignatures(file1.file, file2.file, region1, region2);
  };

  const handleReset = () => { clearFile1(); clearFile2(); setStep('upload'); };

  const canProceedToMask = !!file1 && !!file2;
  const canProceedToPreview = !!mask1 && mask1.width > 5 && !!mask2 && mask2.width > 5;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-white text-xl font-black">Verify Signatures</h1>
        <p className="text-slate-400 text-sm font-light">Upload and compare two document signatures</p>
      </div>

      <div className="mb-6">
        <StepIndicator current={step} />
      </div>

      {step === 'upload' && (
        <div className="max-w-2xl space-y-6">
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
            <p className="text-slate-400 font-light text-sm">Select the page and draw a rectangle around the signature</p>
          </div>

          <div className="max-w-3xl mx-auto">
            <TemplatePanel onLoad={handleLoadTemplate} mask1={mask1} mask2={mask2} />
          </div>

          <div className="flex justify-center gap-2">
            {([1, 2] as const).map((n) => {
              const hasMask = n === 1 ? (mask1 && mask1.width > 5) : (mask2 && mask2.width > 5);
              const maskPage = n === 1 ? mask1?.page : mask2?.page;
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
                      {maskPage && <span className="text-xs opacity-70">p{maskPage}</span>}
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
                <MaskEditor file={file1} mask={mask1} onMaskChange={setMask1} canvasRef={canvas1Ref} />
              </div>
            )}
            {activeDoc === 2 && file2 && (
              <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-5">
                <p className="text-slate-300 text-sm font-semibold mb-3 truncate">{file2.file.name}</p>
                <MaskEditor file={file2} mask={mask2} onMaskChange={setMask2} canvasRef={canvas2Ref} />
              </div>
            )}
          </div>

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
                ? <><Loader2 size={16} className="animate-spin" /> Extracting regions...</>
                : <>Preview Signatures <ArrowRight size={18} /></>}
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="max-w-2xl space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-black text-white">Preview Signature Regions</h2>
            <p className="text-slate-400 font-light text-sm">Confirm the extracted regions look correct before comparison</p>
          </div>

          <SignaturePreview
            region1={region1}
            region2={region2}
            label1={`Document 1${mask1?.page ? ` — Page ${mask1.page}` : ''} — ${file1?.file.name ?? ''}`}
            label2={`Document 2${mask2?.page ? ` — Page ${mask2.page}` : ''} — ${file2?.file.name ?? ''}`}
          />

          <div className="flex gap-3">
            <button
              onClick={() => setStep('mask')}
              className="flex items-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors"
            >
              <ArrowLeft size={16} /> Adjust Regions
            </button>
            <button
              onClick={handleProcess}
              disabled={!region1 || !region2}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors shadow-lg shadow-teal-500/20"
            >
              Compare Signatures <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {step === 'results' && (
        <div className="max-w-xl space-y-6">
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
              <TemplatePanel onLoad={handleLoadTemplate} mask1={mask1} mask2={mask2} showSave={true} />
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
    'profile': 'Profile',
    'api-keys': 'API Keys',
    'api-docs': 'API Documentation',
    'api-test': 'API Testing',
    'customers': 'Customers',
    'theming': 'Theming',
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
          {appView === 'profile' && <ProfilePage />}
          {appView === 'api-keys' && <ApiKeysPage />}
          {appView === 'api-docs' && <ApiDocPage />}
          {appView === 'api-test' && <ApiTestPage />}
          {appView === 'customers' && <CustomerManagementPage />}
          {appView === 'theming' && <ThemingPage />}
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
