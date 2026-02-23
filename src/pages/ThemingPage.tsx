import { useState } from 'react';
import { Palette, Save, Plus, Trash2, CheckCircle, RotateCcw, Loader2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeSettings } from '../contexts/ThemeContext';

const PRESET_THEMES: { label: string; settings: Partial<ThemeSettings> }[] = [
  {
    label: 'Teal Dark',
    settings: { themeColor: '#14b8a6', bgColor: '#020617', surfaceColor: '#0f172a', fontColor: '#f8fafc' },
  },
  {
    label: 'Blue Slate',
    settings: { themeColor: '#3b82f6', bgColor: '#0a0f1e', surfaceColor: '#0d1526', fontColor: '#f1f5f9' },
  },
  {
    label: 'Emerald Dark',
    settings: { themeColor: '#10b981', bgColor: '#030f0b', surfaceColor: '#071a11', fontColor: '#ecfdf5' },
  },
  {
    label: 'Amber Dark',
    settings: { themeColor: '#f59e0b', bgColor: '#0c0a01', surfaceColor: '#1a1603', fontColor: '#fffbeb' },
  },
  {
    label: 'Rose Dark',
    settings: { themeColor: '#f43f5e', bgColor: '#0f0204', surfaceColor: '#1a0408', fontColor: '#fff1f2' },
  },
  {
    label: 'Light Mode',
    settings: { themeColor: '#0d9488', bgColor: '#f8fafc', surfaceColor: '#ffffff', fontColor: '#0f172a' },
  },
];

interface ColorFieldProps {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
}

function ColorField({ label, description, value, onChange }: ColorFieldProps) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-slate-700/40 last:border-0">
      <div className="flex items-center gap-4">
        <div
          className="w-10 h-10 rounded-xl border-2 border-white/10 shadow-lg shrink-0 cursor-pointer overflow-hidden"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        <div>
          <p className="text-white text-sm font-semibold">{label}</p>
          <p className="text-slate-500 text-xs">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={e => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          className="w-28 bg-slate-800 border border-slate-700 focus:border-teal-500 text-white text-xs font-mono rounded-lg px-3 py-2 outline-none text-right transition-colors"
        />
      </div>
    </div>
  );
}

export default function ThemingPage() {
  const { theme, swatches, saving, saveTheme, saveSwatch, deleteSwatch } = useTheme();
  const [draft, setDraft] = useState<ThemeSettings>({ ...theme });
  const [newSwatchName, setNewSwatchName] = useState('');
  const [newSwatchColor, setNewSwatchColor] = useState('#14b8a6');
  const [saved, setSaved] = useState(false);

  const update = (key: keyof ThemeSettings) => (value: string) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await saveTheme(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    setDraft({ ...theme });
  };

  const applyPreset = (preset: Partial<ThemeSettings>) => {
    setDraft(prev => ({ ...prev, ...preset }));
  };

  const handleAddSwatch = async () => {
    if (!newSwatchName.trim()) return;
    await saveSwatch(newSwatchName.trim(), newSwatchColor);
    setNewSwatchName('');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-500/15 border border-teal-500/30 rounded-xl flex items-center justify-center">
            <Palette size={18} className="text-teal-400" />
          </div>
          <div>
            <h1 className="text-white text-xl font-black">Theming</h1>
            <p className="text-slate-400 text-sm font-light">Customize the look and feel of the application</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-teal-500/20"
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Saving...</>
              : saved
                ? <><CheckCircle size={14} /> Saved!</>
                : <><Save size={14} /> Save Theme</>}
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 space-y-2">
        <h2 className="text-white font-bold text-sm mb-4">Preset Themes</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESET_THEMES.map(preset => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset.settings)}
              className="flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-teal-500/40 rounded-xl transition-all text-left group"
            >
              <div className="flex gap-1 shrink-0">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.settings.themeColor }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.settings.bgColor }} />
              </div>
              <span className="text-slate-300 group-hover:text-white text-xs font-semibold transition-colors">{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5">
        <h2 className="text-white font-bold text-sm mb-2">Colors</h2>

        <ColorField
          label="Theme / Accent Color"
          description="Buttons, active states, highlights"
          value={draft.themeColor}
          onChange={update('themeColor')}
        />
        <ColorField
          label="Background Color"
          description="Main page background"
          value={draft.bgColor}
          onChange={update('bgColor')}
        />
        <ColorField
          label="Surface Color"
          description="Cards, sidebar, panels"
          value={draft.surfaceColor}
          onChange={update('surfaceColor')}
        />
        <ColorField
          label="Font Color"
          description="Primary text and icons"
          value={draft.fontColor}
          onChange={update('fontColor')}
        />
      </div>

      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 space-y-4">
        <h2 className="text-white font-bold text-sm">Logo URL</h2>
        <p className="text-slate-500 text-xs -mt-2">Provide a public image URL to replace the default icon in the sidebar.</p>
        <input
          type="url"
          value={draft.logoUrl}
          onChange={e => update('logoUrl')(e.target.value)}
          placeholder="https://example.com/logo.png"
          className="w-full bg-slate-800 border border-slate-700 focus:border-teal-500 text-white text-sm rounded-xl px-4 py-3 outline-none transition-colors placeholder:text-slate-600"
        />
        {draft.logoUrl && (
          <div className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700/40">
            <img src={draft.logoUrl} alt="Logo preview" className="h-8 w-auto object-contain" />
            <span className="text-slate-400 text-xs">Preview</span>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 space-y-4">
        <h2 className="text-white font-bold text-sm">Preview</h2>
        <div
          className="rounded-xl p-5 space-y-3 border border-white/8"
          style={{ backgroundColor: draft.bgColor }}
        >
          <div
            className="rounded-xl p-4 border border-white/8"
            style={{ backgroundColor: draft.surfaceColor }}
          >
            <p className="font-bold text-sm mb-1" style={{ color: draft.fontColor }}>SignatureVerify</p>
            <p className="text-xs opacity-60 mb-3" style={{ color: draft.fontColor }}>Sample card preview</p>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 rounded-lg text-xs font-bold text-white"
                style={{ backgroundColor: draft.themeColor }}
              >
                Primary Button
              </button>
              <button
                className="px-4 py-2 rounded-lg text-xs font-semibold border border-white/15"
                style={{ color: draft.fontColor, opacity: 0.7 }}
              >
                Secondary
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 space-y-4">
        <h2 className="text-white font-bold text-sm">Color Swatches</h2>
        <p className="text-slate-500 text-xs -mt-2">Save frequently used colors for quick access.</p>

        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl border-2 border-white/10 shrink-0 cursor-pointer overflow-hidden"
            style={{ backgroundColor: newSwatchColor }}
          >
            <input
              type="color"
              value={newSwatchColor}
              onChange={e => setNewSwatchColor(e.target.value)}
              className="w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <input
            type="text"
            value={newSwatchName}
            onChange={e => setNewSwatchName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddSwatch()}
            placeholder="Swatch name (e.g. Brand Blue)"
            className="flex-1 bg-slate-800 border border-slate-700 focus:border-teal-500 text-white text-sm rounded-xl px-4 py-3 outline-none transition-colors placeholder:text-slate-600"
          />
          <button
            onClick={handleAddSwatch}
            disabled={!newSwatchName.trim()}
            className="flex items-center gap-2 px-4 py-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
          >
            <Plus size={15} /> Add
          </button>
        </div>

        {swatches.length > 0 && (
          <div className="grid grid-cols-1 gap-2 pt-1">
            {swatches.map(swatch => (
              <div
                key={swatch.id}
                className="flex items-center gap-4 px-4 py-3 bg-slate-800/60 border border-slate-700/40 rounded-xl group hover:border-slate-600 transition-colors"
              >
                <button
                  className="w-8 h-8 rounded-lg border border-white/15 shrink-0 transition-transform hover:scale-110"
                  style={{ backgroundColor: swatch.color }}
                  onClick={() => update('themeColor')(swatch.color)}
                  title="Apply as theme color"
                />
                <span className="flex-1 text-white text-sm font-medium">{swatch.name}</span>
                <code className="text-slate-500 text-xs font-mono">{swatch.color}</code>
                <button
                  onClick={() => deleteSwatch(swatch.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {swatches.length === 0 && (
          <p className="text-slate-600 text-sm italic">No swatches saved yet.</p>
        )}
      </div>
    </div>
  );
}
