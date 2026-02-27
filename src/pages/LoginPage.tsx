import { useState, FormEvent } from 'react';
import { FileSignature, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const BRAND = '#006080';

interface Props {
  onBack: () => void;
}

export default function LoginPage({ onBack }: Props) {
  const { signIn } = useAuth();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const brandColor = theme.themeColor || BRAND;
  const siteName = theme.siteName || 'SignatureVerify';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError('Invalid email or password. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white/90 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {theme.logoUrl ? (
              <img src={theme.logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md"
                style={{ backgroundColor: brandColor }}
              >
                <FileSignature size={17} className="text-white" />
              </div>
            )}
            <span className="text-slate-900 font-bold text-lg tracking-tight">{siteName}</span>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors"
          >
            <ArrowLeft size={16} /> Back to home
          </button>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-1/3 right-0 w-[600px] h-[600px] rounded-full opacity-5 translate-x-1/3"
            style={{ backgroundColor: brandColor }}
          />
          <div
            className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-5 -translate-x-1/4 translate-y-1/2"
            style={{ backgroundColor: brandColor }}
          />
        </div>

        <div className="relative w-full max-w-md">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl">
            <div className="text-center space-y-4 mb-8">
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg mx-auto"
                style={{ backgroundColor: brandColor }}
              >
                <FileSignature size={26} className="text-white" />
              </div>
              <div>
                <h1 className="text-slate-900 text-2xl font-black tracking-tight">Sign in</h1>
                <p className="text-slate-500 text-sm mt-1 font-light">
                  Access your {siteName} account
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-slate-700 text-sm font-semibold">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-slate-50 border border-slate-200 focus:border-transparent text-slate-900 rounded-xl px-4 py-3 text-sm outline-none transition-all placeholder:text-slate-400"
                  style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                  onFocus={e => { e.currentTarget.style.borderColor = brandColor; e.currentTarget.style.boxShadow = `0 0 0 3px ${brandColor}18`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 text-sm font-semibold">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 pr-11 text-sm outline-none transition-all placeholder:text-slate-400"
                    onFocus={e => { e.currentTarget.style.borderColor = brandColor; e.currentTarget.style.boxShadow = `0 0 0 3px ${brandColor}18`; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-3.5 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                style={{ backgroundColor: brandColor }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-2 text-slate-400 text-xs">
              <ShieldCheck size={13} style={{ color: brandColor, opacity: 0.7 }} />
              Secured with Supabase Authentication
            </div>
          </div>

          <p className="text-center text-slate-400 text-xs mt-6">
            Contact your administrator if you need access.
          </p>
        </div>
      </div>
    </div>
  );
}
