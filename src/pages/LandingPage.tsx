import { useState } from 'react';
import { ArrowRight, FileSignature, ShieldCheck, Zap, Key, BarChart2, CheckCircle, Mail, ScanLine, LayoutTemplate, FileCheck } from 'lucide-react';

interface Props {
  onGetStarted: () => void;
  onLogin: () => void;
  siteName?: string;
}

const BRAND = '#006080';

const flipCards = [
  {
    icon: ScanLine,
    title: 'Multi-Region Masks',
    front: 'Define precise signature regions with multi-region masks — even across different pages of a document.',
    back: {
      heading: 'Visual mask editor',
      points: [
        'Draw regions directly on document preview',
        'Stack multiple regions per signature slot',
        'Auto-detect signature blobs within a zone',
        'Anchor to text for dynamic page matching',
      ],
    },
  },
  {
    icon: BarChart2,
    title: 'Weighted Scoring',
    front: 'Assign custom weights to each mask or region to reflect their relative importance in the final score.',
    back: {
      heading: 'Full score breakdown',
      points: [
        'Per-mask confidence scores shown individually',
        'Custom weights per mask slot',
        'Region-level sub-score weights',
        'Weighted average in audit PDF report',
      ],
    },
  },
  {
    icon: LayoutTemplate,
    title: 'Reusable Templates',
    front: 'Save document layouts as templates. One click applies the entire mask configuration to new files.',
    back: {
      heading: 'Template management',
      points: [
        'Save mask configs by document type',
        'Load template in API with template_id',
        'Edit, rename and delete templates',
        'Used automatically in API calls',
      ],
    },
  },
  {
    icon: FileCheck,
    title: 'PDF Audit Reports',
    front: 'Every verification generates a downloadable PDF with the score, formula, and side-by-side images.',
    back: {
      heading: 'What\'s in the report',
      points: [
        'Confidence score with visual meter',
        'Weighted formula shown explicitly',
        'Per-mask score breakdown table',
        'Signature crop images side by side',
      ],
    },
  },
  {
    icon: Key,
    title: 'REST API',
    front: 'Generate API keys and integrate signature verification directly into your own systems and workflows.',
    back: {
      heading: 'API capabilities',
      points: [
        'POST base64-encoded PDFs or images',
        'Use template_id for zero-config regions',
        'Receive score + PDF result URL',
        'Code examples in 5 languages',
      ],
    },
  },
  {
    icon: Zap,
    title: 'Edge-Fast Processing',
    front: 'Verification runs on globally distributed edge functions — typical response under 2 seconds.',
    back: {
      heading: 'Under the hood',
      points: [
        'Normalized cross-correlation algorithm',
        'Ink stroke isolation from printed text',
        'Lenient, strict & super-lenient modes',
        'Blob extraction with dilation control',
      ],
    },
  },
];

const steps = [
  {
    n: '01',
    title: 'Upload your documents',
    desc: 'Drop two PDFs or images — the reference signature document and the one to verify.',
    detail: 'Supports multi-page PDFs with page-level anchor detection.',
  },
  {
    n: '02',
    title: 'Define signature regions',
    desc: 'Draw selection boxes around each signature area. Add multiple regions per slot if needed.',
    detail: 'Save as a named template to reuse on the same document type instantly.',
  },
  {
    n: '03',
    title: 'Run the comparison',
    desc: 'The engine extracts ink strokes, normalizes them, and computes a similarity score.',
    detail: 'Choose lenient, strict, or super-lenient mode to tune sensitivity.',
  },
  {
    n: '04',
    title: 'Download your report',
    desc: 'Get an instant confidence score and a detailed PDF audit report for your records.',
    detail: 'Includes the weighted formula, per-mask breakdown, and cropped signature images.',
  },
];

function FlipCard({ icon: Icon, title, front, back }: typeof flipCards[0]) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="h-56 cursor-pointer"
      style={{ perspective: '1000px' }}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
    >
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        <div
          className="absolute inset-0 rounded-2xl p-6 flex flex-col gap-4 border border-slate-200 bg-white shadow-sm"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: BRAND + '12', border: `1px solid ${BRAND}25` }}
          >
            <Icon size={20} style={{ color: BRAND }} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 mb-1.5">{title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed font-light">{front}</p>
          </div>
          <p className="text-xs mt-auto" style={{ color: BRAND }}>Hover for details →</p>
        </div>

        <div
          className="absolute inset-0 rounded-2xl p-6 flex flex-col gap-3 text-white"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            backgroundColor: BRAND,
          }}
        >
          <p className="text-xs font-bold uppercase tracking-widest opacity-70">{back.heading}</p>
          <ul className="space-y-2 flex-1">
            {back.points.map(pt => (
              <li key={pt} className="flex items-start gap-2 text-sm">
                <CheckCircle size={14} className="shrink-0 mt-0.5 opacity-80" />
                <span className="opacity-90 leading-snug">{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage({ onGetStarted, onLogin, siteName = 'SignatureVerify' }: Props) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md"
              style={{ backgroundColor: BRAND }}
            >
              <FileSignature size={17} className="text-white" />
            </div>
            <span className="text-slate-900 font-bold text-lg tracking-tight">{siteName}</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">How it works</a>
            <a href="#api" className="hover:text-slate-900 transition-colors">API</a>
            <a href="#contact" className="hover:text-slate-900 transition-colors">Contact</a>
          </nav>
          <div className="flex items-center gap-3">
            <button
              onClick={onLogin}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={onGetStarted}
              className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-semibold rounded-lg transition-all shadow-md hover:shadow-lg hover:-translate-y-px"
              style={{ backgroundColor: BRAND }}
            >
              Get Started <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </header>

      <section className="relative pt-32 pb-28 px-6 overflow-hidden bg-white">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full opacity-5 -translate-y-1/3 translate-x-1/3"
            style={{ backgroundColor: BRAND }}
          />
          <div
            className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-5 translate-y-1/2 -translate-x-1/4"
            style={{ backgroundColor: BRAND }}
          />
        </div>

        <div className="relative max-w-4xl mx-auto text-center space-y-8">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase border"
            style={{ backgroundColor: BRAND + '10', borderColor: BRAND + '30', color: BRAND }}
          >
            <ShieldCheck size={13} />
            Enterprise-Grade Signature Verification
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-tight text-slate-900">
            Verify signatures
            <br />
            <span style={{ color: BRAND }}>with confidence</span>
          </h1>

          <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed font-light">
            AI-powered comparison that isolates ink strokes, ignores printed text, and delivers
            an auditable confidence score — in seconds.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-2">
            <button
              onClick={onGetStarted}
              className="flex items-center gap-2 px-8 py-4 text-white font-bold rounded-xl transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
              style={{ backgroundColor: BRAND }}
            >
              Start Comparing Now <ArrowRight size={18} />
            </button>
            <button
              onClick={onLogin}
              className="flex items-center gap-2 px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-colors border border-slate-200 shadow-sm"
            >
              Sign In
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-sm text-slate-400">
            {['No credit card required', 'PDF & image support', 'REST API included'].map(t => (
              <div key={t} className="flex items-center gap-1.5">
                <CheckCircle size={14} style={{ color: BRAND }} />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 border-y border-slate-100 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-1 shadow-sm overflow-hidden">
            <div className="bg-slate-50 rounded-xl p-6 grid grid-cols-3 gap-4">
              {[
                { label: 'Comparison Score', value: '94.7%', color: '#16a34a' },
                { label: 'Processing Time', value: '1.2s', color: BRAND },
                { label: 'Confidence Level', value: 'High Match', color: '#16a34a' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-xl p-4 text-center border border-slate-100 shadow-sm">
                  <p className="text-slate-400 text-xs mb-1">{label}</p>
                  <p className="text-2xl font-black" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: BRAND }}>Capabilities</p>
            <h2 className="text-4xl font-black tracking-tight text-slate-900">Everything you need</h2>
            <p className="text-slate-500 text-lg font-light">Built for accuracy, designed for real document workflows</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {flipCards.map(card => (
              <FlipCard key={card.title} {...card} />
            ))}
          </div>
          <p className="text-center text-slate-400 text-sm mt-8">Hover a card to see details</p>
        </div>
      </section>

      <section id="how-it-works" className="py-24 px-6 bg-slate-50 border-y border-slate-100">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: BRAND }}>Process</p>
            <h2 className="text-4xl font-black tracking-tight text-slate-900">How it works</h2>
            <p className="text-slate-500 text-lg font-light">Four simple steps to a verified, auditable result</p>
          </div>
          <div className="space-y-5">
            {steps.map(({ n, title, desc, detail }, i) => (
              <div
                key={n}
                className="flex gap-6 items-start bg-white rounded-2xl p-6 border border-slate-100 shadow-sm group hover:border-slate-200 transition-colors"
              >
                <div
                  className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: BRAND + '12', border: `1px solid ${BRAND}25` }}
                >
                  <span className="font-black text-lg" style={{ color: BRAND }}>{n}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-slate-900 font-bold text-lg mb-1">{title}</h3>
                  <p className="text-slate-500 font-light leading-relaxed">{desc}</p>
                  <p className="text-sm mt-2 font-medium" style={{ color: BRAND + 'cc' }}>{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <button
              onClick={onGetStarted}
              className="inline-flex items-center gap-2 px-8 py-4 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              style={{ backgroundColor: BRAND }}
            >
              Try it now <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      <section id="api" className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase border"
                style={{ backgroundColor: BRAND + '10', borderColor: BRAND + '30', color: BRAND }}
              >
                <Key size={13} />
                REST API
              </div>
              <h2 className="text-4xl font-black tracking-tight leading-tight text-slate-900">
                Integrate into<br />your workflow
              </h2>
              <p className="text-slate-500 leading-relaxed font-light">
                Generate API keys from your profile, then call our REST endpoint with base64-encoded PDFs or images.
                Works with saved templates for zero-config region detection.
              </p>
              <ul className="space-y-2">
                {['Supports JSON and multipart/form-data', 'Template-based zero-config calls', 'Returns score + downloadable PDF report', 'Code examples in cURL, JS, Python, PHP, Go'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle size={14} style={{ color: BRAND }} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={onGetStarted}
                className="flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-xl transition-colors shadow-md hover:shadow-lg"
                style={{ backgroundColor: BRAND }}
              >
                View API Docs <ArrowRight size={16} />
              </button>
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 font-mono text-sm overflow-x-auto shadow-xl">
              <div className="text-slate-500 text-xs mb-3">POST /functions/v1/signature-process</div>
              <pre className="text-slate-300 whitespace-pre-wrap leading-relaxed text-xs">{`{
  "api_key": "svk_live_...",
  "file1_base64": "JVBERi0x...",
  "file2_base64": "JVBERi0x...",
  "template_id": "tpl_abc123",
  "mode": "lenient"
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

      <section className="py-24 px-6 bg-slate-50 border-y border-slate-100">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: BRAND }}>Comparison modes</p>
            <h2 className="text-4xl font-black tracking-tight text-slate-900">Tune sensitivity to your needs</h2>
            <p className="text-slate-500 text-lg font-light">Pick the mode that fits how strict your verification requirement is</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { mode: 'Super Lenient', icon: '◎', desc: 'Wide dilation, 2× score boost. Best for faint or stylized signatures where absolute match is less critical.', tag: 'High recall' },
              { mode: 'Lenient', icon: '◉', desc: 'Balanced ink extraction and scoring. Ideal for most document verification use cases.', tag: 'Recommended' },
              { mode: 'Strict', icon: '⊙', desc: 'Precise curve matching with minimal tolerance. For forensic or legal-grade verification.', tag: 'High precision' },
            ].map(({ mode, icon, desc, tag }) => (
              <div key={mode} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{icon}</span>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: BRAND + '12', color: BRAND }}
                  >{tag}</span>
                </div>
                <h3 className="font-bold text-slate-800 text-lg">{mode}</h3>
                <p className="text-slate-500 text-sm leading-relaxed font-light">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: BRAND }}>Use cases</p>
            <h2 className="text-4xl font-black tracking-tight text-slate-900">Who uses {siteName}?</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: '🏦', title: 'Financial Services', desc: 'Verify authorization signatures on cheques, mandates, and forms before processing.' },
              { icon: '⚖️', title: 'Legal & Compliance', desc: 'Confirm signatory identity on contracts, NDAs, and regulatory documents.' },
              { icon: '🏥', title: 'Healthcare', desc: 'Authenticate consent forms, prescriptions, and medical authorizations.' },
              { icon: '🏢', title: 'HR & Onboarding', desc: 'Validate employment agreements and policy acknowledgement signatures at scale.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-3">
                <span className="text-3xl">{icon}</span>
                <h3 className="font-bold text-slate-800">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed font-light">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="contact"
        className="py-24 px-6"
        style={{ backgroundColor: BRAND }}
      >
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase bg-white/15 text-white border border-white/25">
            <Mail size={13} />
            Get in touch
          </div>
          <h2 className="text-4xl font-black tracking-tight text-white">
            Questions or enterprise enquiries?
          </h2>
          <p className="text-white/70 text-lg font-light leading-relaxed max-w-xl mx-auto">
            Whether you need a custom deployment, volume licensing, or just have a question about the platform — we're happy to help.
          </p>
          <a
            href="mailto:hello@krri.sh"
            className="inline-flex items-center gap-3 px-8 py-4 bg-white font-bold rounded-xl transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 text-lg"
            style={{ color: BRAND }}
          >
            <Mail size={20} />
            hello@krri.sh
          </a>
          <p className="text-white/50 text-sm">We typically respond within one business day.</p>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-12 px-6 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shadow-md"
              style={{ backgroundColor: BRAND }}
            >
              <FileSignature size={15} className="text-white" />
            </div>
            <span className="text-slate-800 font-bold">{siteName}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <a href="#features" className="hover:text-slate-700 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-slate-700 transition-colors">How it works</a>
            <a href="#api" className="hover:text-slate-700 transition-colors">API</a>
            <a href="mailto:hello@krri.sh" className="hover:text-slate-700 transition-colors">Contact</a>
          </div>
          <p className="text-slate-400 text-sm">
            AI-Powered Signature Comparison — For authorized use only.
          </p>
        </div>
      </footer>
    </div>
  );
}
