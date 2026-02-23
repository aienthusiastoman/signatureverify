import { useState, FormEvent } from 'react';
import { FileSignature, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  onBack: () => void;
}

export default function LoginPage({ onBack }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-teal-500/6 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm font-medium mb-8 transition-colors"
        >
          <ArrowLeft size={16} /> Back to home
        </button>

        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-8 shadow-2xl">
          <div className="text-center space-y-4 mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-500/15 border border-teal-500/30 rounded-2xl">
              <FileSignature size={26} className="text-teal-400" />
            </div>
            <div>
              <h1 className="text-white text-2xl font-black tracking-tight">Sign in</h1>
              <p className="text-slate-400 text-sm mt-1 font-light">Access your SignatureVerify account</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-slate-300 text-sm font-semibold">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@signatureverify.local"
                required
                className="w-full bg-slate-800 border border-slate-600 focus:border-teal-500 text-white rounded-xl px-4 py-3 text-sm outline-none transition-colors placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 text-sm font-semibold">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-800 border border-slate-600 focus:border-teal-500 text-white rounded-xl px-4 py-3 pr-11 text-sm outline-none transition-colors placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors shadow-lg shadow-teal-500/20"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-slate-500 text-xs">
            <ShieldCheck size={13} className="text-teal-500/60" />
            Secured with Supabase Authentication
          </div>
        </div>
      </div>
    </div>
  );
}
