import { FileSignature, User, Key, BookOpen, FlaskConical, Users, Palette, LogOut, ChevronRight, LayoutTemplate, History, ScanLine } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import type { AppView } from '../types';

interface NavItem {
  id: AppView;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'app', label: 'Verify Signatures', icon: FileSignature },
      { id: 'history', label: 'History', icon: History },
      { id: 'masks', label: 'Masks', icon: ScanLine },
    ],
  },
  {
    label: 'API',
    items: [
      { id: 'api-keys', label: 'API Keys', icon: Key },
      { id: 'api-docs', label: 'Documentation', icon: BookOpen },
      { id: 'api-test', label: 'API Testing', icon: FlaskConical },
      { id: 'templates', label: 'Templates', icon: LayoutTemplate },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'profile', label: 'Profile', icon: User },
    ],
  },
  {
    label: 'Admin',
    items: [
      { id: 'customers', label: 'Customers', icon: Users, adminOnly: true },
      { id: 'theming', label: 'Theming', icon: Palette, adminOnly: true },
    ],
  },
];

interface Props {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

export default function Sidebar({ currentView, onNavigate }: Props) {
  const { user, signOut } = useAuth();
  const { theme } = useTheme();

  const isAdmin = user?.app_metadata?.role === 'admin';
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <aside
      className="fixed left-0 top-0 h-full w-60 flex flex-col z-40 border-r border-white/8"
      style={{ backgroundColor: theme.surfaceColor }}
    >
      <div
        className="px-5 py-5 border-b border-white/8 flex items-center gap-3 shrink-0"
        style={{ borderBottomColor: 'rgba(255,255,255,0.07)' }}
      >
        {theme.logoUrl ? (
          <img src={theme.logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
        ) : (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shrink-0"
            style={{ backgroundColor: theme.themeColor }}
          >
            <FileSignature size={16} className="text-white" />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-black text-sm leading-tight truncate" style={{ color: theme.fontColor }}>
            {theme.siteName || 'SignatureVerify'}
          </p>
          <p className="text-xs leading-tight mt-0.5 truncate" style={{ color: theme.fontColor, opacity: 0.45 }}>
            AI Comparison
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV_SECTIONS.map(section => {
          const visibleItems = section.items.filter(item => !item.adminOnly || isAdmin);
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label}>
              <p
                className="px-3 py-1 text-xs font-bold uppercase tracking-widest mb-1"
                style={{ color: theme.fontColor, opacity: 0.3 }}
              >
                {section.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map(item => {
                  const Icon = item.icon;
                  const active = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group"
                      style={{
                        backgroundColor: active ? theme.themeColor + '22' : 'transparent',
                        color: active ? theme.themeColor : theme.fontColor,
                        opacity: active ? 1 : 0.65,
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          (e.currentTarget as HTMLButtonElement).style.opacity = '0.65';
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <Icon size={16} className="shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {active && <ChevronRight size={13} className="shrink-0 opacity-60" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div
        className="px-2 py-3 border-t shrink-0"
        style={{ borderTopColor: 'rgba(255,255,255,0.07)' }}
      >
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
            style={{ backgroundColor: theme.themeColor + '33', color: theme.themeColor }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate leading-tight" style={{ color: theme.fontColor }}>
              {displayName}
            </p>
            <p className="text-xs truncate leading-tight" style={{ color: theme.fontColor, opacity: 0.4 }}>
              {user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          style={{ color: '#f87171', opacity: 0.8 }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '1';
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(248,113,113,0.1)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '0.8';
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          }}
        >
          <LogOut size={15} className="shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
