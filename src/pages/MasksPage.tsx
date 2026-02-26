import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Trash2, ArrowLeft, Save, Loader2, FileSearch, CheckCircle2, AlertCircle, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import FileDropZone from '../components/FileDropZone';
import MaskEditor from '../components/MaskEditor';
import MultiMaskEditor, { createEmptyMask } from '../components/MultiMaskEditor';
import type { SavedTemplate, UploadedFile, MaskRect, MaskDefinition } from '../types';

function maskSummary(m: MaskRect): string {
  const parts: string[] = [];
  if (m.page && m.page > 1) parts.push(`Page ${m.page}`);
  if (m.width > 0 && m.height > 0) parts.push(`${m.width}×${m.height}px`);
  if (m.autoDetect) parts.push('Auto-detect');
  return parts.length > 0 ? parts.join(' · ') : 'No region';
}

interface CreateState {
  name: string;
  file1: UploadedFile | null;
  file2: UploadedFile | null;
  mask1: MaskRect | null;
  masks2: MaskDefinition[];
}

const emptyCreate = (): CreateState => ({
  name: '',
  file1: null,
  file2: null,
  mask1: null,
  masks2: [createEmptyMask(1, 0)],
});

export default function MasksPage() {
  const [masks, setMasks] = useState<SavedTemplate[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateState>(emptyCreate());

  const canvas1Ref = useRef<HTMLCanvasElement | null>(null);

  const fetchMasks = useCallback(async () => {
    setLoadingList(true);
    const { data } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false });
    setMasks((data as SavedTemplate[]) ?? []);
    setLoadingList(false);
  }, []);

  useEffect(() => { fetchMasks(); }, [fetchMasks]);

  const handleStartCreate = () => {
    setForm(emptyCreate());
    setSaveError(null);
    setSaveSuccess(false);
    canvas1Ref.current = null;
    setCreating(true);
  };

  const handleCancelCreate = () => {
    if (form.file1?.previewUrl) URL.revokeObjectURL(form.file1.previewUrl);
    if (form.file2?.previewUrl) URL.revokeObjectURL(form.file2.previewUrl);
    setCreating(false);
    setForm(emptyCreate());
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    const masks2HasContent = form.masks2.some(m => m.autoDetect || m.regions.length > 0);
    if (!form.name.trim() || !form.mask1 || !masks2HasContent) return;
    setSaving(true);
    setSaveError(null);

    const firstMask2 = form.masks2[0];
    const legacyMask2: MaskRect = firstMask2.regions[0]
      ? { x: firstMask2.regions[0].x, y: firstMask2.regions[0].y, width: firstMask2.regions[0].width, height: firstMask2.regions[0].height, page: firstMask2.page, anchorText: firstMask2.anchorText }
      : { x: 0, y: 0, width: 0, height: 0, page: firstMask2.page };

    const { error } = await supabase.from('templates').insert({
      name: form.name.trim(),
      mask1: form.mask1,
      mask2: legacyMask2,
      masks2: form.masks2,
    });
    setSaving(false);
    if (error) {
      setSaveError(error.message);
    } else {
      setSaveSuccess(true);
      await fetchMasks();
      setTimeout(() => {
        handleCancelCreate();
      }, 900);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await supabase.from('templates').delete().eq('id', id);
    setMasks(prev => prev.filter(m => m.id !== id));
    setDeletingId(null);
  };

  const canSave = !!form.name.trim() &&
    !!form.mask1 && (form.mask1.autoDetect || form.mask1.width > 5) &&
    form.masks2.some(m => m.autoDetect || m.regions.length > 0);

  if (creating) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleCancelCreate}
            className="flex items-center gap-2 px-4 py-2 bg-black/20 hover:bg-white/10 text-font/70 text-sm font-semibold rounded-xl transition-colors"
          >
            <ArrowLeft size={15} /> Back
          </button>
          <div>
            <h2 className="text-font text-xl font-black">Create New Mask</h2>
            <p className="text-font/50 text-sm font-light">Upload a sample document for each slot and draw the signature region</p>
          </div>
        </div>

        <div className="bg-surface/80 border border-white/8 rounded-2xl p-5 space-y-3">
          <label className="text-font/70 text-sm font-semibold">Mask Name</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Insurance Form — Insured Signature"
            className="w-full bg-surface border border-white/12 focus:border-theme/60 outline-none rounded-xl px-4 py-3 text-font text-sm placeholder:text-font/25 transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-surface/80 border border-white/8 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-teal-400" />
              <p className="text-font/70 text-sm font-bold">Document 1 — Reference</p>
              {form.mask1 && (form.mask1.autoDetect || form.mask1.width > 5) && (
                <CheckCircle2 size={14} className="text-emerald-400 ml-auto" />
              )}
            </div>
            <p className="text-font/40 text-xs">Upload a sample PDF to draw the signature region for document type 1</p>
            {!form.file1 ? (
              <FileDropZone
                label="Drop sample PDF here"
                file={null}
                onFile={f => setForm(prev => ({ ...prev, file1: f, mask1: null }))}
                onClear={() => {}}
              />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-black/20 rounded-xl px-3 py-2">
                  <span className="text-font/70 text-xs flex-1 truncate">{form.file1.file.name}</span>
                  <button
                    onClick={() => {
                      if (form.file1?.previewUrl) URL.revokeObjectURL(form.file1.previewUrl);
                      canvas1Ref.current = null;
                      setForm(f => ({ ...f, file1: null, mask1: null }));
                    }}
                    className="text-font/40 hover:text-red-400 transition-colors"
                  >
                    ×
                  </button>
                </div>
                <MaskEditor
                  file={form.file1}
                  mask={form.mask1}
                  onMaskChange={m => setForm(f => ({ ...f, mask1: m }))}
                  canvasRef={canvas1Ref}
                  showAnchorText
                />
              </div>
            )}
          </div>

          <div className="bg-surface/80 border border-white/8 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <p className="text-font/70 text-sm font-bold">Document 2 — To Verify</p>
              {form.masks2.some(m => m.autoDetect || m.regions.length > 0) && (
                <CheckCircle2 size={14} className="text-emerald-400 ml-auto" />
              )}
            </div>
            <p className="text-font/40 text-xs">Upload a sample PDF to define one or more signature mask regions for document type 2</p>
            {!form.file2 ? (
              <FileDropZone
                label="Drop sample PDF here"
                file={null}
                onFile={f => setForm(prev => ({ ...prev, file2: f, masks2: [createEmptyMask(f.pageCount ?? 1, 0)] }))}
                onClear={() => {}}
              />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-black/20 rounded-xl px-3 py-2">
                  <span className="text-font/70 text-xs flex-1 truncate">{form.file2.file.name}</span>
                  <button
                    onClick={() => {
                      if (form.file2?.previewUrl) URL.revokeObjectURL(form.file2.previewUrl);
                      setForm(f => ({ ...f, file2: null, masks2: [createEmptyMask(1, 0)] }));
                    }}
                    className="text-font/40 hover:text-red-400 transition-colors"
                  >
                    ×
                  </button>
                </div>
                <MultiMaskEditor
                  file={form.file2}
                  masks={form.masks2}
                  onMasksChange={m => setForm(f => ({ ...f, masks2: m }))}
                />
              </div>
            )}
          </div>
        </div>

        {saveError && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle size={15} />
            {saveError}
          </div>
        )}

        <div className="flex justify-end gap-3 pb-8">
          <button
            onClick={handleCancelCreate}
            className="px-5 py-3 bg-black/20 hover:bg-white/10 text-font font-semibold rounded-xl transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving || saveSuccess}
            className="flex items-center gap-2 px-6 py-3 bg-theme hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-font font-bold rounded-xl transition-colors shadow-lg shadow-teal-500/20 text-sm"
          >
            {saveSuccess ? (
              <><CheckCircle2 size={15} /> Saved!</>
            ) : saving ? (
              <><Loader2 size={15} className="animate-spin" /> Saving...</>
            ) : (
              <><Save size={15} /> Save Mask</>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-font text-xl font-black">Masks</h2>
          <p className="text-font/50 text-sm font-light mt-0.5">
            Define signature regions for document pairs — reuse across comparisons
          </p>
        </div>
        <button
          onClick={handleStartCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-theme hover:bg-teal-400 text-font font-bold rounded-xl text-sm transition-colors shadow-lg shadow-teal-500/20"
        >
          <Plus size={15} /> New Mask
        </button>
      </div>

      {loadingList ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-theme border-t-transparent rounded-full animate-spin" />
            <p className="text-font/50 text-sm">Loading masks...</p>
          </div>
        </div>
      ) : masks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-black/20 border border-white/8 flex items-center justify-center">
            <FileSearch size={24} className="text-font/40" />
          </div>
          <div className="text-center">
            <p className="text-font/70 font-semibold">No masks yet</p>
            <p className="text-font/40 text-sm mt-1">Create a mask to save signature regions for quick reuse</p>
          </div>
          <button
            onClick={handleStartCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-theme hover:bg-teal-400 text-font font-bold rounded-xl text-sm transition-colors"
          >
            <Plus size={14} /> Create Your First Mask
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {masks.map(mask => (
            <MaskCard
              key={mask.id}
              mask={mask}
              deleting={deletingId === mask.id}
              onDelete={() => handleDelete(mask.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MaskCardProps {
  mask: SavedTemplate;
  deleting: boolean;
  onDelete: () => void;
}

function MaskCard({ mask, deleting, onDelete }: MaskCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="bg-surface/80 border border-white/8 hover:border-white/12 rounded-2xl p-5 space-y-4 transition-colors group">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-font font-bold text-sm truncate">{mask.name}</p>
          <p className="text-font/40 text-xs mt-0.5">
            {new Date(mask.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/15 text-font/40 hover:text-red-400 transition-all"
          >
            <Trash2 size={14} />
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { onDelete(); setConfirmDelete(false); }}
              disabled={deleting}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-500 hover:bg-red-400 text-font transition-colors"
            >
              {deleting ? '...' : 'Delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/12 text-font/70 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <RegionRow label="Doc 1" color="teal" maskSummaryText={maskSummary(mask.mask1)} />
        {mask.masks2 && mask.masks2.length > 0 ? (
          <div className="space-y-1.5">
            {mask.masks2.map((m, idx) => {
              const regionCount = m.regions.length;
              const parts: string[] = [];
              if (m.page && m.page > 1) parts.push(`Page ${m.page}`);
              if (regionCount > 1) parts.push(`${regionCount} regions`);
              else if (regionCount === 1) parts.push(`${m.regions[0].width}×${m.regions[0].height}px`);
              if (m.autoDetect) parts.push('Auto-detect');
              const summary = parts.length > 0 ? parts.join(' · ') : 'No region';
              return (
                <div key={m.id} className="flex items-center gap-2.5 bg-black/15 rounded-xl px-3 py-2">
                  <div className="w-2 h-2 rounded-full shrink-0 bg-amber-400" />
                  <span className="text-xs font-bold shrink-0 text-amber-400">Doc 2</span>
                  <span className="text-font/40 text-xs shrink-0">{m.label}</span>
                  <span className="text-font/50 text-xs truncate">{summary}</span>
                  {mask.masks2 && mask.masks2.length > 1 && idx === 0 && (
                    <span className="ml-auto flex items-center gap-0.5 text-teal-400/60 text-xs shrink-0">
                      <Layers size={10} /> {mask.masks2.length}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <RegionRow label="Doc 2" color="amber" maskSummaryText={maskSummary(mask.mask2)} />
        )}
      </div>
    </div>
  );
}

function RegionRow({ label, color, maskSummaryText }: { label: string; color: 'teal' | 'amber'; maskSummaryText: string }) {
  const dot = color === 'teal' ? 'bg-teal-400' : 'bg-amber-400';
  const text = color === 'teal' ? 'text-teal-400' : 'text-amber-400';
  return (
    <div className="flex items-center gap-2.5 bg-black/15 rounded-xl px-3 py-2">
      <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
      <span className={`text-xs font-bold shrink-0 ${text}`}>{label}</span>
      <span className="text-font/50 text-xs truncate">{maskSummaryText}</span>
    </div>
  );
}
