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
    <header className="bg-surface/80 backdrop-blur border-b border-white/8 shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
        <button
          onClick={() => onNavigate('app')}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="p-1.5 bg-theme rounded-xl shadow-lg shadow-theme/30">
            <FileSignature size={20} className="text-white" />
          </div>
          <div className="text-left">
            <h1 className="text-font font-black text-lg leading-none tracking-tight">SignatureVerify</h1>
            <p className="text-font/50 text-xs font-light leading-none mt-0.5">AI Signature Comparison</p>
          </div>
        </button>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5 bg-theme/20 border border-theme/30 rounded-full px-3 py-1.5">
            <ShieldCheck size={13} className="text-theme" />
            <span className="text-font/70 text-xs font-medium">Secure</span>
          </div>

          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen(p => !p)}
              className="flex items-center gap-2.5 px-3 py-2 bg-white/8 hover:bg-white/12 border border-white/10 rounded-xl transition-colors"
            >
              <div className="w-7 h-7 bg-theme/30 border border-theme/40 rounded-lg flex items-center justify-center text-font text-xs font-black">
                {initials}
              </div>
              <span className="text-font text-sm font-semibold hidden sm:block max-w-28 truncate">
                {displayName}
              </span>
              <ChevronDown size={14} className={`text-font/50 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-white/8">
                  <p className="text-font text-sm font-semibold truncate">{displayName}</p>
                  <p className="text-font/40 text-xs truncate">{user?.email}</p>
                </div>

                <div className="py-1.5">
                  <button
                    onClick={() => { onNavigate('profile'); setOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors ${currentView === 'profile' ? 'text-theme bg-theme/10' : 'text-font/60 hover:text-font hover:bg-white/5'}`}
                  >
                    <User size={15} className={currentView === 'profile' ? 'text-theme' : 'text-font/40'} />
                    Profile
                  </button>
                  <button
                    onClick={() => { onNavigate('api-keys'); setOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors ${currentView === 'api-keys' ? 'text-theme bg-theme/10' : 'text-font/60 hover:text-font hover:bg-white/5'}`}
                  >
                    <Key size={15} className={currentView === 'api-keys' ? 'text-theme' : 'text-font/40'} />
                    API Keys
                  </button>
                </div>

                <div className="py-1.5 border-t border-white/8">
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
