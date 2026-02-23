import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutTemplate, Pencil, Trash2, Check, X, Loader2, AlertCircle,
  CheckCircle, FileText, ChevronLeft, Save, RotateCcw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SavedTemplate, MaskRect } from '../types';

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
      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">{label}</p>
      <div
        className="relative rounded-lg overflow-hidden border border-slate-600 shrink-0"
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
          className="absolute -top-px -right-px px-1.5 py-0.5 text-white text-xs font-bold rounded-bl-lg rounded-tr-lg"
          style={{ backgroundColor: color, fontSize: 9 }}
        >
          p{mask.page ?? 1}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs font-mono text-slate-400 text-center">
        <span>x: {mask.x}</span>
        <span>y: {mask.y}</span>
        <span>w: {mask.width}</span>
        <span>h: {mask.height}</span>
      </div>
    </div>
  );
}

interface MaskInput { x: string; y: string; width: string; height: string; page: string; }

function maskToInput(m: MaskRect): MaskInput {
  return { x: String(m.x), y: String(m.y), width: String(m.width), height: String(m.height), page: String(m.page ?? 1) };
}

function inputToMask(i: MaskInput): MaskRect {
  return { x: +i.x, y: +i.y, width: +i.width, height: +i.height, page: +i.page };
}

function MaskInputFields({
  label, value, onChange, color,
}: { label: string; value: MaskInput; onChange: (v: MaskInput) => void; color: string }) {
  const dot = <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: color }} />;
  const field = (key: keyof MaskInput, lbl: string) => (
    <div key={key} className="space-y-1">
      <label className="text-slate-500 text-xs">{lbl}</label>
      <input
        type="number"
        value={value[key]}
        onChange={e => onChange({ ...value, [key]: e.target.value })}
        className="w-full bg-slate-800 border border-slate-700 focus:border-teal-500 text-white text-xs rounded-lg px-2.5 py-2 outline-none transition-colors font-mono"
      />
    </div>
  );
  return (
    <div>
      <p className="text-slate-300 text-xs font-semibold mb-2 flex items-center">{dot}{label}</p>
      <div className="grid grid-cols-5 gap-2">
        {field('x', 'X')} {field('y', 'Y')} {field('width', 'Width')}
        {field('height', 'Height')} {field('page', 'Page')}
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SavedTemplate | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMask1, setEditMask1] = useState<MaskInput>({ x: '0', y: '0', width: '0', height: '0', page: '1' });
  const [editMask2, setEditMask2] = useState<MaskInput>({ x: '0', y: '0', width: '0', height: '0', page: '1' });
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

  const handleEdit = () => {
    if (!selected) return;
    setEditName(selected.name);
    setEditMask1(maskToInput(selected.mask1));
    setEditMask2(maskToInput(selected.mask2));
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  const handleSave = async () => {
    if (!selected || !editName.trim()) return;
    setSaving(true);
    const updated = {
      name: editName.trim(),
      mask1: inputToMask(editMask1),
      mask2: inputToMask(editMask2),
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
          <LayoutTemplate size={18} className="text-teal-400" />
        </div>
        <div>
          <h1 className="text-white text-xl font-black">Templates</h1>
          <p className="text-slate-400 text-sm font-light">Saved signature region configurations</p>
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
        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-700/40 flex items-center justify-between">
            <h2 className="text-white font-bold text-sm">All Templates</h2>
            <span className="text-slate-500 text-xs">{templates.length}</span>
          </div>

          {loading && (
            <div className="py-10 flex justify-center">
              <Loader2 size={20} className="animate-spin text-teal-500" />
            </div>
          )}

          {!loading && templates.length === 0 && (
            <div className="py-10 text-center px-4">
              <LayoutTemplate size={28} className="text-slate-700 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No templates yet</p>
              <p className="text-slate-600 text-xs mt-1">Save a template from the Verify tool</p>
            </div>
          )}

          {!loading && templates.map(t => (
            <div
              key={t.id}
              onClick={() => handleSelect(t)}
              className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer border-b border-slate-700/30 last:border-0 transition-colors group ${
                selected?.id === t.id
                  ? 'bg-teal-500/10 border-l-2 border-l-teal-500'
                  : 'hover:bg-slate-800/50'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                selected?.id === t.id ? 'bg-teal-500/20' : 'bg-slate-800'
              }`}>
                <FileText size={14} className={selected?.id === t.id ? 'text-teal-400' : 'text-slate-500'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${selected?.id === t.id ? 'text-teal-300' : 'text-white'}`}>
                  {t.name}
                </p>
                <p className="text-slate-600 text-xs">
                  {new Date(t.created_at).toLocaleDateString()}
                </p>
              </div>
              {deleteConfirm === t.id ? (
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="p-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white transition-colors"
                    title="Confirm delete"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={e => { e.stopPropagation(); setDeleteConfirm(t.id); }}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/15 text-slate-500 hover:text-red-400 transition-all shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden">
          {!selected ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <ChevronLeft size={24} className="text-slate-700" />
              <p className="text-slate-500 text-sm">Select a template to view details</p>
            </div>
          ) : (
            <div>
              <div className="px-6 py-4 border-b border-slate-700/40 flex items-center justify-between gap-4">
                {editing ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-1 bg-slate-800 border border-teal-500/50 text-white font-bold text-base rounded-xl px-4 py-2 outline-none"
                    autoFocus
                  />
                ) : (
                  <h3 className="text-white font-bold text-base flex-1 truncate">{selected.name}</h3>
                )}

                <div className="flex items-center gap-2 shrink-0">
                  {editing ? (
                    <>
                      <button
                        onClick={handleCancelEdit}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
                      >
                        <RotateCcw size={13} /> Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving || !editName.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
                      >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        Save Changes
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleEdit}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors border border-slate-700 hover:border-slate-600"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-6">
                <p className="text-slate-500 text-xs">
                  Created {new Date(selected.created_at).toLocaleString()}
                </p>

                <div className="flex flex-wrap gap-8 justify-center">
                  {previewMask1 && (
                    <RegionDiagram mask={previewMask1} label="Document 1 — Reference" color="#14b8a6" />
                  )}
                  {previewMask2 && (
                    <RegionDiagram mask={previewMask2} label="Document 2 — To Verify" color="#f59e0b" />
                  )}
                </div>

                {editing && (
                  <div className="space-y-4 pt-4 border-t border-slate-700/40">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Edit Region Coordinates</p>
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
                      <div key={label} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 space-y-2">
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
                              <span className="text-slate-500 text-xs">{k}</span>
                              <span className="text-white text-xs font-mono font-semibold">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
