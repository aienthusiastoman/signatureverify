import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutTemplate, Pencil, Trash2, Check, X, Loader2, AlertCircle,
  CheckCircle, FileText, ChevronLeft, Save, RotateCcw, Scale, Layers
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SavedTemplate, MaskRect, MaskDefinition } from '../types';

const DOC_W = 240;
const DOC_H = 320;
const ASSUMED_DOC_W = 1000;
const ASSUMED_DOC_H = 1400;

function scale(v: number, srcMax: number, dstMax: number) {
  return Math.round((v / srcMax) * dstMax);
}

function RegionDiagram({ mask, label, color }: { mask: MaskRect; label: string; color: string }) {
  const x = scale(mask.x, ASSUMED_DOC_W, DOC_W);
  const y = scale(mask.y, ASSUMED_DOC_H, DOC_H);
  const w = Math.max(scale(mask.width, ASSUMED_DOC_W, DOC_W), 6);
  const h = Math.max(scale(mask.height, ASSUMED_DOC_H, DOC_H), 4);

  const clampedX = Math.min(x, DOC_W - w);
  const clampedY = Math.min(y, DOC_H - h);

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-font/50 text-xs font-semibold uppercase tracking-wide">{label}</p>
      <div
        className="relative rounded-lg overflow-hidden border border-white/12 shrink-0"
        style={{ width: DOC_W, height: DOC_H, background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}
      >
        {Array.from({ length: 18 }, (_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: 20 + (i % 3) * 4,
              top: 28 + i * 14,
              width: i % 4 === 0 ? 60 : i % 3 === 0 ? 140 : i % 2 === 0 ? 100 : 170,
              height: 3,
              background: 'rgba(100,116,139,0.25)',
            }}
          />
        ))}

        <div
          className="absolute rounded"
          style={{
            left: clampedX,
            top: clampedY,
            width: w,
            height: h,
            backgroundColor: color + '33',
            border: `2px solid ${color}`,
            boxShadow: `0 0 12px ${color}44`,
          }}
        />
        <div
          className="absolute -top-px -right-px px-1.5 py-0.5 text-font text-xs font-bold rounded-bl-lg rounded-tr-lg"
          style={{ backgroundColor: color, fontSize: 9 }}
        >
          p{mask.page ?? 1}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs font-mono text-font/50 text-center">
        <span>x: {mask.x}</span>
        <span>y: {mask.y}</span>
        <span>w: {mask.width}</span>
        <span>h: {mask.height}</span>
      </div>
    </div>
  );
}

interface MaskInput { x: string; y: string; width: string; height: string; page: string; anchorText?: string; }

function maskToInput(m: MaskRect): MaskInput {
  return { x: String(m.x), y: String(m.y), width: String(m.width), height: String(m.height), page: String(m.page ?? 1), anchorText: m.anchorText ?? '' };
}

function inputToMask(i: MaskInput): MaskRect {
  return { x: +i.x, y: +i.y, width: +i.width, height: +i.height, page: +i.page, anchorText: i.anchorText?.trim() || undefined };
}

function MaskInputFields({
  label, value, onChange, color,
}: { label: string; value: MaskInput; onChange: (v: MaskInput) => void; color: string }) {
  const dot = <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: color }} />;
  const field = (key: keyof MaskInput, lbl: string) => (
    <div key={key} className="space-y-1">
      <label className="text-font/40 text-xs">{lbl}</label>
      <input
        type="number"
        value={value[key]}
        onChange={e => onChange({ ...value, [key]: e.target.value })}
        className="w-full bg-black/20 border border-white/8 focus:border-theme/60 text-font text-xs rounded-lg px-2.5 py-2 outline-none transition-colors font-mono"
      />
    </div>
  );
  return (
    <div className="space-y-3">
      <p className="text-font/70 text-xs font-semibold flex items-center">{dot}{label}</p>
      <div className="grid grid-cols-5 gap-2">
        {field('x', 'X')} {field('y', 'Y')} {field('width', 'Width')}
        {field('height', 'Height')} {field('page', 'Page')}
      </div>
      <div className="space-y-1">
        <label className="text-font/40 text-xs">Anchor Text (Smart Page Detection)</label>
        <input
          type="text"
          value={value.anchorText ?? ''}
          onChange={e => onChange({ ...value, anchorText: e.target.value })}
          placeholder="e.g. Authorized Signatory"
          className="w-full bg-black/20 border border-white/8 focus:border-theme/60 text-font text-xs rounded-lg px-2.5 py-2 outline-none transition-colors placeholder:text-font/25"
        />
      </div>
    </div>
  );
}

const MASK_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

interface MaskWeightEdit {
  weight: string;
  regionWeights: string[];
}

function MultiMaskWeightEditor({
  masks,
  edits,
  onChange,
}: {
  masks: MaskDefinition[];
  edits: MaskWeightEdit[];
  onChange: (edits: MaskWeightEdit[]) => void;
}) {
  const totalWeight = edits.reduce((sum, e) => sum + (parseFloat(e.weight) || 1), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Scale size={13} className="text-theme" />
        <p className="text-font/70 text-xs font-semibold">Mask Weights</p>
        <span className="ml-auto text-font/30 text-xs">Leave blank for equal weights</span>
      </div>

      <div className="space-y-2">
        {masks.map((mask, idx) => {
          const color = MASK_COLORS[idx % MASK_COLORS.length];
          const edit = edits[idx] ?? { weight: '', regionWeights: [] };
          const w = parseFloat(edit.weight) || 1;
          const pct = totalWeight > 0 ? Math.round((w / totalWeight) * 100) : Math.round(100 / masks.length);

          return (
            <div key={mask.id} className="bg-black/20 border border-white/8 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center gap-3">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-font/80 text-sm font-medium flex-1 truncate">{mask.label}</span>
                {mask.page && (
                  <span className="text-xs text-theme/70 shrink-0">p{mask.page}</span>
                )}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-font/30 text-xs font-mono">{pct}%</span>
                  <div className="flex items-center gap-1.5">
                    <Scale size={11} className="text-font/35" />
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={edit.weight}
                      placeholder="1"
                      onChange={e => {
                        const next = [...edits];
                        next[idx] = { ...edit, weight: e.target.value };
                        onChange(next);
                      }}
                      className="w-16 bg-surface border border-white/10 focus:border-theme outline-none rounded-lg px-2 py-1 text-font text-xs text-center font-mono placeholder:text-font/25 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {mask.regions.length > 1 && (
                <div className="pl-5 space-y-1.5">
                  <p className="text-font/30 text-xs">Region weights within this mask</p>
                  <div className="flex flex-wrap gap-2">
                    {mask.regions.map((r, ri) => {
                      const rw = edit.regionWeights[ri] ?? '';
                      return (
                        <div key={ri} className="flex items-center gap-1.5 bg-black/20 border border-white/8 rounded-lg px-2 py-1 text-xs">
                          <span
                            className="w-4 h-4 rounded-sm flex items-center justify-center text-white font-bold text-[10px]"
                            style={{ backgroundColor: color }}
                          >
                            {ri + 1}
                          </span>
                          <span className="text-font/50 font-mono">{r.width}×{r.height}</span>
                          <div className="flex items-center gap-1">
                            <Scale size={9} className="text-font/30" />
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={rw}
                              placeholder="1"
                              onChange={e => {
                                const next = [...edits];
                                const newRW = [...(edit.regionWeights ?? [])];
                                newRW[ri] = e.target.value;
                                next[idx] = { ...edit, regionWeights: newRW };
                                onChange(next);
                              }}
                              className="w-11 bg-surface border border-white/10 focus:border-theme outline-none rounded px-1 py-0.5 text-font text-xs text-center font-mono placeholder:text-font/25 transition-colors"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-font/35 bg-black/10 border border-white/5 rounded-lg px-3 py-2">
        <span>Total weight</span>
        <span className="font-mono">{totalWeight.toFixed(1)}</span>
      </div>
    </div>
  );
}

function masksToWeightEdits(masks: MaskDefinition[]): MaskWeightEdit[] {
  return masks.map(m => ({
    weight: m.weight !== undefined ? String(m.weight) : '',
    regionWeights: (m.regionWeights ?? []).map(w => String(w)),
  }));
}

function applyWeightEdits(masks: MaskDefinition[], edits: MaskWeightEdit[]): MaskDefinition[] {
  return masks.map((m, idx) => {
    const edit = edits[idx];
    if (!edit) return m;
    const w = parseFloat(edit.weight);
    const rw = edit.regionWeights.map(v => parseFloat(v)).filter(v => !isNaN(v));
    return {
      ...m,
      weight: isNaN(w) ? undefined : w,
      regionWeights: rw.length > 0 ? rw : undefined,
    };
  });
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SavedTemplate | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMask1, setEditMask1] = useState<MaskInput>({ x: '0', y: '0', width: '0', height: '0', page: '1' });
  const [editMask2, setEditMask2] = useState<MaskInput>({ x: '0', y: '0', width: '0', height: '0', page: '1' });
  const [editMasks2Weights, setEditMasks2Weights] = useState<MaskWeightEdit[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ msg: string; ok: boolean } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const notify = (msg: string, ok = true) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice({ msg, ok });
    noticeTimer.current = setTimeout(() => setNotice(null), 3500);
  };

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false });
    setTemplates((data as SavedTemplate[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleSelect = (t: SavedTemplate) => {
    setSelected(t);
    setEditing(false);
  };

  const isMultiMask = (t: SavedTemplate) => !!(t.masks2 && t.masks2.length > 0);

  const handleEdit = () => {
    if (!selected) return;
    setEditName(selected.name);
    setEditMask1(maskToInput(selected.mask1));
    setEditMask2(maskToInput(selected.mask2));
    if (selected.masks2 && selected.masks2.length > 0) {
      setEditMasks2Weights(masksToWeightEdits(selected.masks2));
    }
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  const handleSave = async () => {
    if (!selected || !editName.trim()) return;
    setSaving(true);

    const updatedMasks2 = selected.masks2 && selected.masks2.length > 0
      ? applyWeightEdits(selected.masks2, editMasks2Weights)
      : selected.masks2;

    const updated = {
      name: editName.trim(),
      mask1: inputToMask(editMask1),
      mask2: inputToMask(editMask2),
      masks2: updatedMasks2,
    };
    const { error } = await supabase.from('templates').update(updated).eq('id', selected.id);
    if (error) {
      notify('Failed to save changes', false);
    } else {
      const newTemplate = { ...selected, ...updated };
      setSelected(newTemplate);
      setTemplates(prev => prev.map(t => t.id === selected.id ? newTemplate : t));
      setEditing(false);
      notify('Template saved');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirm(null);
    const { error } = await supabase.from('templates').delete().eq('id', id);
    if (error) {
      notify('Failed to delete template', false);
      return;
    }
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (selected?.id === id) { setSelected(null); setEditing(false); }
    notify('Template deleted');
  };

  const previewMask1 = editing ? inputToMask(editMask1) : selected?.mask1;
  const previewMask2 = editing ? inputToMask(editMask2) : selected?.mask2;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-teal-500/15 border border-teal-500/30 rounded-xl flex items-center justify-center">
          <LayoutTemplate size={18} className="text-theme" />
        </div>
        <div>
          <h1 className="text-font text-xl font-black">Templates</h1>
          <p className="text-font/50 text-sm font-light">Saved signature region configurations</p>
        </div>
      </div>

      {notice && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
          notice.ok
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {notice.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {notice.msg}
        </div>
      )}

      <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
        <div className="bg-surface border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-white/8 flex items-center justify-between">
            <h2 className="text-font font-bold text-sm">All Templates</h2>
            <span className="text-font/40 text-xs">{templates.length}</span>
          </div>

          {loading && (
            <div className="py-10 flex justify-center">
              <Loader2 size={20} className="animate-spin text-theme" />
            </div>
          )}

          {!loading && templates.length === 0 && (
            <div className="py-10 text-center px-4">
              <LayoutTemplate size={28} className="text-font/20 mx-auto mb-2" />
              <p className="text-font/40 text-sm">No templates yet</p>
              <p className="text-font/30 text-xs mt-1">Save a template from the Verify tool</p>
            </div>
          )}

          {!loading && templates.map(t => (
            <div
              key={t.id}
              onClick={() => handleSelect(t)}
              className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer border-b border-white/8 last:border-0 transition-colors group ${
                selected?.id === t.id
                  ? 'bg-teal-500/10 border-l-2 border-l-teal-500'
                  : 'hover:bg-white/[0.04]'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                selected?.id === t.id ? 'bg-teal-500/20' : 'bg-black/20'
              }`}>
                {isMultiMask(t)
                  ? <Layers size={14} className={selected?.id === t.id ? 'text-theme' : 'text-font/40'} />
                  : <FileText size={14} className={selected?.id === t.id ? 'text-theme' : 'text-font/40'} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${selected?.id === t.id ? 'text-teal-300' : 'text-font'}`}>
                  {t.name}
                </p>
                <p className="text-font/30 text-xs flex items-center gap-1.5">
                  {new Date(t.created_at).toLocaleDateString()}
                  {isMultiMask(t) && (
                    <span className="bg-theme/15 text-theme rounded px-1">{t.masks2!.length} masks</span>
                  )}
                </p>
              </div>
              {deleteConfirm === t.id ? (
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="p-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-font transition-colors"
                    title="Confirm delete"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/12 text-font/70 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={e => { e.stopPropagation(); setDeleteConfirm(t.id); }}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/15 text-font/40 hover:text-red-400 transition-all shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="bg-surface border border-white/8 rounded-2xl overflow-hidden">
          {!selected ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <ChevronLeft size={24} className="text-font/20" />
              <p className="text-font/40 text-sm">Select a template to view details</p>
            </div>
          ) : (
            <div>
              <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between gap-4">
                {editing ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-1 bg-black/20 border border-teal-500/50 text-font font-bold text-base rounded-xl px-4 py-2 outline-none"
                    autoFocus
                  />
                ) : (
                  <h3 className="text-font font-bold text-base flex-1 truncate">{selected.name}</h3>
                )}

                <div className="flex items-center gap-2 shrink-0">
                  {editing ? (
                    <>
                      <button
                        onClick={handleCancelEdit}
                        className="flex items-center gap-1.5 px-3 py-2 bg-black/20 hover:bg-white/10 text-font/70 text-sm font-semibold rounded-xl transition-colors"
                      >
                        <RotateCcw size={13} /> Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving || !editName.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-theme hover:bg-teal-400 disabled:opacity-40 text-font text-sm font-semibold rounded-xl transition-colors"
                      >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        Save Changes
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleEdit}
                      className="flex items-center gap-1.5 px-4 py-2 bg-black/20 hover:bg-white/10 text-font/70 text-sm font-semibold rounded-xl transition-colors border border-white/8 hover:border-white/12"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-6">
                <p className="text-font/40 text-xs">
                  Created {new Date(selected.created_at).toLocaleString()}
                </p>

                {!isMultiMask(selected) && (
                  <>
                    <div className="flex flex-wrap gap-8 justify-center">
                      {previewMask1 && (
                        <RegionDiagram mask={previewMask1} label="Document 1 — Reference" color="#14b8a6" />
                      )}
                      {previewMask2 && (
                        <RegionDiagram mask={previewMask2} label="Document 2 — To Verify" color="#f59e0b" />
                      )}
                    </div>

                    {editing && (
                      <div className="space-y-4 pt-4 border-t border-white/8">
                        <p className="text-font/50 text-xs font-semibold uppercase tracking-wide">Edit Region Coordinates</p>
                        <MaskInputFields
                          label="Document 1 — Reference region"
                          value={editMask1}
                          onChange={setEditMask1}
                          color="#14b8a6"
                        />
                        <MaskInputFields
                          label="Document 2 — To Verify region"
                          value={editMask2}
                          onChange={setEditMask2}
                          color="#f59e0b"
                        />
                      </div>
                    )}

                    {!editing && (
                      <div className="grid sm:grid-cols-2 gap-4 pt-2">
                        {[
                          { label: 'Document 1 Region', mask: selected.mask1, color: '#14b8a6' },
                          { label: 'Document 2 Region', mask: selected.mask2, color: '#f59e0b' },
                        ].map(({ label, mask, color }) => (
                          <div key={label} className="bg-black/15 border border-white/8 rounded-xl p-4 space-y-2">
                            <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color }}>
                              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                              {label}
                            </p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              {[
                                ['X offset', mask.x + 'px'],
                                ['Y offset', mask.y + 'px'],
                                ['Width', mask.width + 'px'],
                                ['Height', mask.height + 'px'],
                                ['Page', String(mask.page ?? 1)],
                              ].map(([k, v]) => (
                                <div key={k} className="flex items-center justify-between">
                                  <span className="text-font/40 text-xs">{k}</span>
                                  <span className="text-font text-xs font-mono font-semibold">{v}</span>
                                </div>
                              ))}
                            </div>
                            {mask.anchorText && (
                              <div className="mt-2 pt-2 border-t border-white/8">
                                <span className="text-font/40 text-xs block mb-0.5">Anchor Text</span>
                                <span className="text-theme text-xs font-mono">&ldquo;{mask.anchorText}&rdquo;</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {isMultiMask(selected) && (
                  <>
                    {!editing && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Layers size={14} className="text-theme" />
                          <p className="text-font/70 text-sm font-semibold">Multi-Mask Configuration</p>
                          <span className="text-font/35 text-xs">{selected.masks2!.length} masks</span>
                        </div>
                        <div className="space-y-2">
                          {selected.masks2!.map((mask, idx) => {
                            const color = MASK_COLORS[idx % MASK_COLORS.length];
                            const hasWeight = mask.weight !== undefined;
                            const totalW = selected.masks2!.reduce((s, m) => s + (m.weight ?? 1), 0);
                            const pct = Math.round(((mask.weight ?? 1) / totalW) * 100);
                            return (
                              <div key={mask.id} className="bg-black/15 border border-white/8 rounded-xl p-3 space-y-2">
                                <div className="flex items-center gap-2.5">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                  <span className="text-font/80 text-sm font-medium flex-1">{mask.label}</span>
                                  {mask.page && <span className="text-xs text-theme/70">p{mask.page}</span>}
                                  {hasWeight && (
                                    <span className="text-xs text-font/40 bg-white/5 border border-white/8 rounded px-1.5 py-0.5 font-mono flex items-center gap-1">
                                      <Scale size={9} />
                                      {mask.weight} ({pct}%)
                                    </span>
                                  )}
                                </div>
                                <div className="pl-5 flex flex-wrap gap-1.5">
                                  {mask.regions.map((r, ri) => {
                                    const rw = mask.regionWeights?.[ri];
                                    return (
                                      <span key={ri} className="text-xs bg-black/20 border border-white/8 rounded px-2 py-0.5 text-font/50 font-mono flex items-center gap-1">
                                        <span className="w-3.5 h-3.5 rounded-sm flex items-center justify-center text-white font-bold text-[9px]" style={{ backgroundColor: color }}>{ri + 1}</span>
                                        {r.width}×{r.height}
                                        {rw !== undefined && <span className="text-font/35">×{rw}</span>}
                                      </span>
                                    );
                                  })}
                                  {mask.autoDetect && (
                                    <span className="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded px-2 py-0.5">Auto-detect</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {editing && (
                      <div className="space-y-6 pt-4 border-t border-white/8">
                        <div className="space-y-4">
                          <p className="text-font/50 text-xs font-semibold uppercase tracking-wide">Reference Region (Document 1)</p>
                          <MaskInputFields
                            label="Document 1 — Reference region"
                            value={editMask1}
                            onChange={setEditMask1}
                            color="#14b8a6"
                          />
                        </div>

                        <div className="pt-4 border-t border-white/8">
                          <MultiMaskWeightEditor
                            masks={selected.masks2!}
                            edits={editMasks2Weights}
                            onChange={setEditMasks2Weights}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
