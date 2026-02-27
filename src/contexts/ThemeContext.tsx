import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface ThemeSettings {
  themeColor: string;
  bgColor: string;
  surfaceColor: string;
  fontColor: string;
  logoUrl: string;
  siteName: string;
}

export interface ColorSwatch {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

const DEFAULTS: ThemeSettings = {
  themeColor: '#006080',
  bgColor: '#f8fafc',
  surfaceColor: '#ffffff',
  fontColor: '#0f172a',
  logoUrl: '',
  siteName: 'SignatureVerify',
};

interface ThemeContextType {
  theme: ThemeSettings;
  swatches: ColorSwatch[];
  saving: boolean;
  saveTheme: (settings: ThemeSettings) => Promise<void>;
  saveSwatch: (name: string, color: string) => Promise<void>;
  deleteSwatch: (id: string) => Promise<void>;
  reloadSwatches: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULTS);
  const [swatches, setSwatches] = useState<ColorSwatch[]>([]);
  const [saving, setSaving] = useState(false);

  const applyTheme = (t: ThemeSettings) => {
    const root = document.documentElement;
    root.style.setProperty('--theme-color', t.themeColor);
    root.style.setProperty('--bg-color', t.bgColor);
    root.style.setProperty('--surface-color', t.surfaceColor);
    root.style.setProperty('--font-color', t.fontColor);

    const hex = t.surfaceColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const isLight = lum > 0.5;

    root.style.setProperty('--divider-color', isLight ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.09)');
    root.style.setProperty('--input-bg', isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)');
    root.style.setProperty('--input-border', isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)');
    root.style.setProperty('--card-hover', isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)');
    root.style.setProperty('--badge-bg', isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)');
  };

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('key, value')
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        data.forEach(row => { map[row.key] = row.value; });
        const loaded: ThemeSettings = {
          themeColor: map['theme_color'] || DEFAULTS.themeColor,
          bgColor: map['bg_color'] || DEFAULTS.bgColor,
          surfaceColor: map['surface_color'] || DEFAULTS.surfaceColor,
          fontColor: map['font_color'] || DEFAULTS.fontColor,
          logoUrl: map['logo_url'] || DEFAULTS.logoUrl,
          siteName: map['site_name'] || DEFAULTS.siteName,
        };
        setTheme(loaded);
        applyTheme(loaded);
      });
  }, []);

  const reloadSwatches = async () => {
    const { data } = await supabase
      .from('color_swatches')
      .select('*')
      .order('sort_order', { ascending: true });
    setSwatches((data as ColorSwatch[]) ?? []);
  };

  useEffect(() => { reloadSwatches(); }, []);

  const saveTheme = async (settings: ThemeSettings) => {
    setSaving(true);
    const rows = [
      { key: 'theme_color', value: settings.themeColor },
      { key: 'bg_color', value: settings.bgColor },
      { key: 'surface_color', value: settings.surfaceColor },
      { key: 'font_color', value: settings.fontColor },
      { key: 'logo_url', value: settings.logoUrl },
      { key: 'site_name', value: settings.siteName },
    ];
    for (const row of rows) {
      await supabase
        .from('app_settings')
        .upsert(row, { onConflict: 'key' });
    }
    setTheme(settings);
    applyTheme(settings);
    setSaving(false);
  };

  const saveSwatch = async (name: string, color: string) => {
    const maxOrder = swatches.length > 0 ? Math.max(...swatches.map(s => s.sort_order)) + 1 : 0;
    await supabase.from('color_swatches').insert({ name, color, sort_order: maxOrder });
    await reloadSwatches();
  };

  const deleteSwatch = async (id: string) => {
    await supabase.from('color_swatches').delete().eq('id', id);
    setSwatches(prev => prev.filter(s => s.id !== id));
  };

  return (
    <ThemeContext.Provider value={{ theme, swatches, saving, saveTheme, saveSwatch, deleteSwatch, reloadSwatches }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
