import { ArrowRight, FileSignature, ShieldCheck, Zap, BookOpen, Key, BarChart2, CheckCircle } from 'lucide-react';

interface Props {
  onGetStarted: () => void;
  onLogin: () => void;
}

const features = [
  {
    icon: Zap,
    title: 'AI-Powered Detection',
    desc: 'Advanced pixel-analysis with normalized cross-correlation isolates ink strokes — ignoring typed text.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure & Private',
    desc: 'Documents are processed in isolated edge functions. Nothing is stored beyond what you choose.',
  },
  {
    icon: BookOpen,
    title: 'Reusable Templates',
    desc: 'Save signature region layouts and apply them instantly to new documents of the same format.',
  },
  {
    icon: Key,
    title: 'REST API Access',
    desc: 'Generate API keys and integrate signature verification directly into your own workflows.',
  },
  {
    icon: BarChart2,
    title: 'Confidence Scoring',
    desc: 'Get a precise 0–100% match score with full PDF report, ready for audit trails.',
  },
  {
    icon: FileSignature,
    title: 'PDF & Image Support',
    desc: 'Upload scanned images, PDFs, or send base64-encoded files via the API.',
  },
];

const steps = [
  { n: '01', title: 'Upload Documents', desc: 'Drop two PDFs or images containing the signatures you want to compare.' },
  { n: '02', title: 'Define Regions', desc: 'Draw a selection box around each signature. Save as a template for future use.' },
  { n: '03', title: 'Compare & Report', desc: 'Get an instant confidence score and download a detailed PDF comparison report.' },
];

export default function LandingPage({ onGetStarted, onLogin }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <header className="fixed top-0 inset-x-0 z-50 bg-slate-950/80 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/30">
              <FileSignature size={18} className="text-white" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">SignatureVerify</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#api" className="hover:text-white transition-colors">API</a>
          </nav>
          <div className="flex items-center gap-3">
            <button
              onClick={onLogin}
              className="text-sm font-semibold text-slate-300 hover:text-white transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={onGetStarted}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-teal-500/25"
            >
              Get Started <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </header>

      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-teal-500/8 rounded-full blur-3xl" />
          <div className="absolute top-20 right-1/4 w-64 h-64 bg-teal-600/10 rounded-full blur-2xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-500/10 border border-teal-500/30 rounded-full text-teal-400 text-xs font-semibold tracking-wide uppercase">
            <ShieldCheck size={13} />
            Enterprise-Grade Signature Verification
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-tight">
            Verify signatures
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-teal-200">
              with confidence
            </span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-light">
            AI-powered comparison that isolates ink strokes, ignores printed text, and delivers
            an auditable confidence score — in seconds.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-2">
            <button
              onClick={onGetStarted}
              className="flex items-center gap-2 px-8 py-4 bg-teal-500 hover:bg-teal-400 text-white font-bold rounded-xl transition-all shadow-xl shadow-teal-500/30 hover:shadow-teal-400/40 hover:-translate-y-0.5"
            >
              Start Comparing Now <ArrowRight size={18} />
            </button>
            <button
              onClick={onLogin}
              className="flex items-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors border border-slate-700"
            >
              Sign In
            </button>
          </div>

          <div className="flex items-center justify-center gap-8 pt-4 text-sm text-slate-500">
            {['No credit card required', 'PDF & image support', 'REST API included'].map(t => (
              <div key={t} className="flex items-center gap-1.5">
                <CheckCircle size={14} className="text-teal-500" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-6 overflow-hidden border-y border-slate-800/50 bg-slate-900/40">
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-1 overflow-hidden shadow-2xl">
            <div className="bg-slate-800/40 rounded-xl p-6 grid grid-cols-3 gap-4">
              {[
                { label: 'Comparison Score', value: '94.7%', color: 'text-emerald-400', bg: 'bg-emerald-500' },
                { label: 'Processing Time', value: '1.2s', color: 'text-teal-400', bg: 'bg-teal-500' },
                { label: 'Confidence Level', value: 'High Match', color: 'text-emerald-400', bg: 'bg-emerald-500' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-slate-900/80 rounded-xl p-4 text-center border border-slate-700/40">
                  <p className="text-slate-500 text-xs mb-1">{label}</p>
                  <p className={`text-2xl font-black ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-4xl font-black tracking-tight">Everything you need</h2>
            <p className="text-slate-400 text-lg font-light">Built for accuracy, designed for real workflows</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-6 space-y-4 hover:border-teal-500/40 transition-colors group"
              >
                <div className="w-10 h-10 bg-teal-500/15 border border-teal-500/25 rounded-xl flex items-center justify-center group-hover:bg-teal-500/25 transition-colors">
                  <Icon size={20} className="text-teal-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold mb-1.5">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed font-light">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24 px-6 bg-slate-900/30 border-y border-slate-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-4xl font-black tracking-tight">How it works</h2>
            <p className="text-slate-400 text-lg font-light">Three simple steps to a verified result</p>
          </div>
          <div className="space-y-6">
            {steps.map(({ n, title, desc }, i) => (
              <div key={n} className="flex gap-6 items-start group">
                <div className="shrink-0 w-14 h-14 bg-teal-500/10 border border-teal-500/25 rounded-2xl flex items-center justify-center group-hover:bg-teal-500/20 transition-colors">
                  <span className="text-teal-400 font-black text-lg">{n}</span>
                </div>
                <div className="flex-1 pt-3">
                  <h3 className="text-white font-bold text-lg mb-1">{title}</h3>
                  <p className="text-slate-400 font-light leading-relaxed">{desc}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute left-7 mt-14 w-0.5 h-6 bg-slate-700 relative shrink-0" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <button
              onClick={onGetStarted}
              className="inline-flex items-center gap-2 px-8 py-4 bg-teal-500 hover:bg-teal-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-teal-500/25"
            >
              Try it now <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      <section id="api" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-500/10 border border-teal-500/30 rounded-full text-teal-400 text-xs font-semibold tracking-wide uppercase">
                <Key size={13} />
                REST API
              </div>
              <h2 className="text-4xl font-black tracking-tight leading-tight">
                Integrate into<br />your workflow
              </h2>
              <p className="text-slate-400 leading-relaxed font-light">
                Generate API keys from your profile, then call our REST endpoint with base64-encoded PDFs or images.
                Works with saved templates for zero-config region detection.
              </p>
              <button
                onClick={onGetStarted}
                className="flex items-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-colors"
              >
                View API Docs <ArrowRight size={16} />
              </button>
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 font-mono text-sm overflow-x-auto">
              <div className="text-slate-500 text-xs mb-3">POST /functions/v1/signature-process</div>
              <pre className="text-slate-300 whitespace-pre-wrap leading-relaxed text-xs">{`{
  "api_key": "svk_live_...",
  "file1_base64": "JVBERi0x...",
  "file2_base64": "JVBERi0x...",
  "template_id": "tpl_abc123"
}`}</pre>
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="text-slate-500 text-xs mb-2">Response</div>
                <pre className="text-emerald-400 whitespace-pre-wrap text-xs leading-relaxed">{`{
  "jobId": "abc-123",
  "confidenceScore": 94.7,
  "status": "completed",
  "resultUrl": "https://..."
}`}</pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-teal-500 rounded-lg flex items-center justify-center">
              <FileSignature size={15} className="text-white" />
            </div>
            <span className="text-white font-bold">SignatureVerify</span>
          </div>
          <p className="text-slate-500 text-sm">
            AI-Powered Signature Comparison — For authorized use only.
          </p>
        </div>
      </footer>
    </div>
  );
}
