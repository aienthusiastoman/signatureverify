import { useState } from 'react';
import { Palette, Save, Plus, Trash2, CheckCircle, RotateCcw, Loader2, ChevronDown } from 'lucide-react';
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

const COLOR_FIELD_TARGETS: { key: keyof ThemeSettings; label: string }[] = [
  { key: 'themeColor', label: 'Theme Color' },
  { key: 'bgColor', label: 'Background' },
  { key: 'surfaceColor', label: 'Surface' },
  { key: 'fontColor', label: 'Font Color' },
];

interface ColorFieldProps {
  label: string;
  description: string;
  value: string;
  fontColor: string;
  onChange: (v: string) => void;
}

function ColorField({ label, description, value, fontColor, onChange }: ColorFieldProps) {
  return (
    <div
      className="flex items-center justify-between py-4 border-b last:border-0"
      style={{ borderBottomColor: 'rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center gap-4">
        <div
          className="w-10 h-10 rounded-xl border-2 shadow-lg shrink-0 cursor-pointer overflow-hidden"
          style={{ backgroundColor: value, borderColor: 'rgba(255,255,255,0.12)' }}
        >
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: fontColor }}>{label}</p>
          <p className="text-xs opacity-50" style={{ color: fontColor }}>{description}</p>
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
          className="w-28 border focus:outline-none text-xs font-mono rounded-lg px-3 py-2 text-right transition-colors"
          style={{
            backgroundColor: 'rgba(0,0,0,0.25)',
            borderColor: 'rgba(255,255,255,0.1)',
            color: fontColor,
          }}
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

  const panelStyle = {
    backgroundColor: draft.surfaceColor,
    borderColor: 'rgba(255,255,255,0.08)',
  };

  const subPanelStyle = {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderColor: 'rgba(255,255,255,0.06)',
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center border"
            style={{ backgroundColor: draft.themeColor + '22', borderColor: draft.themeColor + '44' }}
          >
            <Palette size={18} style={{ color: draft.themeColor }} />
          </div>
          <div>
            <h1 className="text-xl font-black" style={{ color: draft.fontColor }}>Theming</h1>
            <p className="text-sm font-light opacity-50" style={{ color: draft.fontColor }}>Customize the look and feel of the application</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors border"
            style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.1)', color: draft.fontColor }}
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-colors disabled:opacity-50 text-white shadow-lg"
            style={{ backgroundColor: draft.themeColor, boxShadow: `0 4px 14px ${draft.themeColor}40` }}
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Saving...</>
              : saved
                ? <><CheckCircle size={14} /> Saved!</>
                : <><Save size={14} /> Save Theme</>}
          </button>
        </div>
      </div>

      <div className="rounded-2xl p-5 border space-y-2" style={panelStyle}>
        <h2 className="font-bold text-sm mb-4" style={{ color: draft.fontColor }}>Preset Themes</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESET_THEMES.map(preset => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset.settings)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left group border"
              style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <div className="flex gap-1 shrink-0">
                <div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: preset.settings.themeColor }} />
                <div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: preset.settings.bgColor }} />
                <div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: preset.settings.surfaceColor }} />
              </div>
              <span className="text-xs font-semibold transition-colors" style={{ color: draft.fontColor }}>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl p-5 border" style={panelStyle}>
        <h2 className="font-bold text-sm mb-2" style={{ color: draft.fontColor }}>Colors</h2>
        <ColorField
          label="Theme / Accent Color"
          description="Buttons, active states, highlights"
          value={draft.themeColor}
          fontColor={draft.fontColor}
          onChange={update('themeColor')}
        />
        <ColorField
          label="Background Color"
          description="Main page background"
          value={draft.bgColor}
          fontColor={draft.fontColor}
          onChange={update('bgColor')}
        />
        <ColorField
          label="Surface Color"
          description="Cards, sidebar, panels"
          value={draft.surfaceColor}
          fontColor={draft.fontColor}
          onChange={update('surfaceColor')}
        />
        <ColorField
          label="Font Color"
          description="Primary text and icons"
          value={draft.fontColor}
          fontColor={draft.fontColor}
          onChange={update('fontColor')}
        />
      </div>

      <div className="rounded-2xl p-5 border space-y-4" style={panelStyle}>
        <h2 className="font-bold text-sm" style={{ color: draft.fontColor }}>Logo URL</h2>
        <p className="text-xs -mt-2 opacity-50" style={{ color: draft.fontColor }}>Provide a public image URL to replace the default icon in the sidebar.</p>
        <input
          type="url"
          value={draft.logoUrl}
          onChange={e => update('logoUrl')(e.target.value)}
          placeholder="https://example.com/logo.png"
          className="w-full text-sm rounded-xl px-4 py-3 outline-none transition-colors border placeholder:opacity-30"
          style={{
            backgroundColor: 'rgba(0,0,0,0.25)',
            borderColor: 'rgba(255,255,255,0.1)',
            color: draft.fontColor,
          }}
        />
        {draft.logoUrl && (
          <div
            className="flex items-center gap-3 p-3 rounded-xl border"
            style={subPanelStyle}
          >
            <img src={draft.logoUrl} alt="Logo preview" className="h-8 w-auto object-contain" />
            <span className="text-xs opacity-50" style={{ color: draft.fontColor }}>Preview</span>
          </div>
        )}
      </div>

      <div className="rounded-2xl p-5 border space-y-4" style={panelStyle}>
        <h2 className="font-bold text-sm" style={{ color: draft.fontColor }}>Preview</h2>
        <div
          className="rounded-xl p-5 space-y-3 border"
          style={{ backgroundColor: draft.bgColor, borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div
            className="rounded-xl p-4 border"
            style={{ backgroundColor: draft.surfaceColor, borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <p className="font-bold text-sm mb-1" style={{ color: draft.fontColor }}>SignatureVerify</p>
            <p className="text-xs mb-3 opacity-50" style={{ color: draft.fontColor }}>Sample card preview</p>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 rounded-lg text-xs font-bold text-white"
                style={{ backgroundColor: draft.themeColor }}
              >
                Primary Button
              </button>
              <button
                className="px-4 py-2 rounded-lg text-xs font-semibold border"
                style={{ color: draft.fontColor, borderColor: 'rgba(255,255,255,0.15)', opacity: 0.7 }}
              >
                Secondary
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-5 border space-y-4" style={panelStyle}>
        <div>
          <h2 className="font-bold text-sm" style={{ color: draft.fontColor }}>Color Swatches</h2>
          <p className="text-xs mt-0.5 opacity-50" style={{ color: draft.fontColor }}>Save and apply frequently used colors to any field.</p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl border-2 shrink-0 cursor-pointer overflow-hidden"
            style={{ backgroundColor: newSwatchColor, borderColor: 'rgba(255,255,255,0.12)' }}
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
            className="flex-1 text-sm rounded-xl px-4 py-3 outline-none transition-colors border placeholder:opacity-30"
            style={{
              backgroundColor: 'rgba(0,0,0,0.25)',
              borderColor: 'rgba(255,255,255,0.1)',
              color: draft.fontColor,
            }}
          />
          <button
            onClick={handleAddSwatch}
            disabled={!newSwatchName.trim()}
            className="flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl transition-colors shrink-0 disabled:opacity-40 text-white"
            style={{ backgroundColor: draft.themeColor }}
          >
            <Plus size={15} /> Add
          </button>
        </div>

        {swatches.length > 0 && (
          <div className="space-y-2 pt-1">
            {swatches.map(swatch => (
              <div
                key={swatch.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl group border transition-colors"
                style={subPanelStyle}
              >
                <div
                  className="w-8 h-8 rounded-lg border shrink-0"
                  style={{ backgroundColor: swatch.color, borderColor: 'rgba(255,255,255,0.15)' }}
                />
                <span className="flex-1 text-sm font-medium" style={{ color: draft.fontColor }}>{swatch.name}</span>
                <code className="text-xs font-mono opacity-50" style={{ color: draft.fontColor }}>{swatch.color}</code>
                <div className="relative shrink-0">
                  <select
                    onChange={e => {
                      const key = e.target.value as keyof ThemeSettings;
                      if (key) update(key)(swatch.color);
                      e.target.value = '';
                    }}
                    defaultValue=""
                    className="appearance-none text-xs font-semibold rounded-lg px-3 py-1.5 pr-7 border outline-none cursor-pointer transition-colors"
                    style={{
                      backgroundColor: draft.themeColor + '20',
                      borderColor: draft.themeColor + '50',
                      color: draft.fontColor,
                    }}
                    title="Apply swatch to a color field"
                  >
                    <option value="" disabled>Apply to...</option>
                    {COLOR_FIELD_TARGETS.map(t => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" style={{ color: draft.fontColor }} />
                </div>
                <button
                  onClick={() => deleteSwatch(swatch.id)}
                  className="opacity-0 group-hover:opacity-100 transition-all p-1"
                  style={{ color: 'rgba(248,113,113,0.8)' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {swatches.length === 0 && (
          <p className="text-sm italic opacity-30" style={{ color: draft.fontColor }}>No swatches saved yet.</p>
        )}
      </div>
    </div>
  );
}
