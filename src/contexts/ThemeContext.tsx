import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface ThemeSettings {
  themeColor: string;
  bgColor: string;
  surfaceColor: string;
  fontColor: string;
  logoUrl: string;
}

export interface ColorSwatch {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

const DEFAULTS: ThemeSettings = {
  themeColor: '#14b8a6',
  bgColor: '#020617',
  surfaceColor: '#0f172a',
  fontColor: '#f8fafc',
  logoUrl: '',
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
