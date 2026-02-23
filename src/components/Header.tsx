import { useState, useRef, useEffect } from 'react';
import { FileSignature, ShieldCheck, User, Key, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export type AppView = 'app' | 'profile' | 'api-keys';

interface Props {
  onNavigate: (view: AppView) => void;
  currentView: AppView;
}

export default function Header({ onNavigate, currentView }: Props) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <header className="bg-teal-900/80 backdrop-blur border-b border-teal-800/60 shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
        <button
          onClick={() => onNavigate('app')}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="p-1.5 bg-teal-500 rounded-xl shadow-lg shadow-teal-500/30">
            <FileSignature size={20} className="text-white" />
          </div>
          <div className="text-left">
            <h1 className="text-white font-black text-lg leading-none tracking-tight">SignatureVerify</h1>
            <p className="text-teal-200/70 text-xs font-light leading-none mt-0.5">AI Signature Comparison</p>
          </div>
        </button>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5 bg-teal-500/20 border border-teal-500/30 rounded-full px-3 py-1.5">
            <ShieldCheck size={13} className="text-teal-300" />
            <span className="text-teal-200 text-xs font-medium">Secure</span>
          </div>

          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen(p => !p)}
              className="flex items-center gap-2.5 px-3 py-2 bg-teal-800/60 hover:bg-teal-800 border border-teal-700/50 rounded-xl transition-colors"
            >
              <div className="w-7 h-7 bg-teal-500/30 border border-teal-400/40 rounded-lg flex items-center justify-center text-teal-200 text-xs font-black">
                {initials}
              </div>
              <span className="text-teal-100 text-sm font-semibold hidden sm:block max-w-28 truncate">
                {displayName}
              </span>
              <ChevronDown size={14} className={`text-teal-300 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-slate-700/50">
                  <p className="text-white text-sm font-semibold truncate">{displayName}</p>
                  <p className="text-slate-400 text-xs truncate">{user?.email}</p>
                </div>

                <div className="py-1.5">
                  <button
                    onClick={() => { onNavigate('profile'); setOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors ${currentView === 'profile' ? 'text-teal-400 bg-teal-500/10' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  >
                    <User size={15} className={currentView === 'profile' ? 'text-teal-400' : 'text-slate-400'} />
                    Profile
                  </button>
                  <button
                    onClick={() => { onNavigate('api-keys'); setOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors ${currentView === 'api-keys' ? 'text-teal-400 bg-teal-500/10' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  >
                    <Key size={15} className={currentView === 'api-keys' ? 'text-teal-400' : 'text-slate-400'} />
                    API Keys
                  </button>
                </div>

                <div className="py-1.5 border-t border-slate-700/50">
                  <button
                    onClick={() => { signOut(); setOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
