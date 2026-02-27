import { useState, useEffect, useCallback } from 'react';
import { Bookmark, BookmarkCheck, Trash2, ChevronDown, ChevronUp, Loader2, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SavedTemplate, MaskRect, MaskDefinition } from '../types';

interface Props {
  onLoad: (mask1: MaskRect, mask2: MaskRect, masks2?: MaskDefinition[]) => void;
  mask1?: MaskRect | null;
  mask2?: MaskRect | null;
  masks2?: MaskDefinition[] | null;
  showSave?: boolean;
}

export default function TemplatePanel({ onLoad, mask1, mask2, masks2, showSave = false }: Props) {
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveError, setSaveError] = useState('');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false });
    setTemplates((data as SavedTemplate[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (expanded) fetchTemplates();
  }, [expanded, fetchTemplates]);

  const handleSave = async () => {
    if (!mask1 || !mask2 || !templateName.trim()) {
      setSaveError('Please enter a name and ensure both regions are defined.');
      return;
    }
    setSaving(true);
    setSaveError('');

    const insertPayload: Record<string, unknown> = {
      name: templateName.trim(),
      mask1,
      mask2,
    };

    if (masks2 && masks2.length > 0) {
      insertPayload.masks2 = masks2;
    }

    const { data: { user } } = await supabase.auth.getUser();
    insertPayload.user_id = user?.id ?? null;
    const { error } = await supabase.from('templates').insert(insertPayload);
    if (error) {
      setSaveError('Failed to save template.');
    } else {
      setTemplateName('');
      setShowSaveForm(false);
      setExpanded(true);
      fetchTemplates();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('templates').delete().eq('id', id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const handleLoad = (t: SavedTemplate) => {
    const loadedMasks2 = t.masks2 && t.masks2.length > 0 ? t.masks2 : undefined;
    onLoad(t.mask1, t.mask2, loadedMasks2);
  };

  const formatMaskLabel = (m: MaskRect) => {
    const page = m.page ? ` · p${m.page}` : '';
    const anchor = m.anchorText ? ` · "${m.anchorText}"` : '';
    return `${m.width}×${m.height}${page}${anchor}`;
  };

  const canSave = !!mask1 && !!mask2;

  return (
    <div className="border border-white/8 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-black/20 hover:bg-white/[0.04] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bookmark size={15} className="text-theme" />
          <span className="text-sm font-medium text-font">Saved Templates</span>
          {templates.length > 0 && (
            <span className="text-xs bg-theme/20 text-theme px-1.5 py-0.5 rounded-full">
              {templates.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={15} className="text-font/40" /> : <ChevronDown size={15} className="text-font/40" />}
      </button>

      {expanded && (
        <div className="bg-black/10 border-t border-white/8">
          {showSave && canSave && (
            <div className="p-3 border-b border-white/8">
              {!showSaveForm ? (
                <button
                  onClick={() => setShowSaveForm(true)}
                  className="flex items-center gap-2 text-xs text-theme hover:opacity-80 transition-opacity"
                >
                  <BookmarkCheck size={13} />
                  Save current regions as template
                  {masks2 && masks2.length > 1 && (
                    <span className="text-font/35">({masks2.length} masks)</span>
                  )}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={templateName}
                      onChange={e => setTemplateName(e.target.value)}
                      placeholder="Template name..."
                      className="flex-1 bg-black/20 border border-white/10 text-font text-xs rounded-lg px-3 py-1.5 placeholder:text-font/25 focus:outline-none focus:border-theme/60"
                      onKeyDown={e => e.key === 'Enter' && handleSave()}
                      autoFocus
                    />
                    <button
                      onClick={handleSave}
                      disabled={saving || !templateName.trim()}
                      className="px-3 py-1.5 bg-theme hover:opacity-90 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-opacity flex items-center gap-1"
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                    </button>
                    <button
                      onClick={() => { setShowSaveForm(false); setSaveError(''); }}
                      className="px-3 py-1.5 bg-white/8 hover:bg-white/12 text-font/60 text-xs rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                  {saveError && <p className="text-red-400 text-xs">{saveError}</p>}
                </div>
              )}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={16} className="text-font/40 animate-spin" />
            </div>
          )}

          {!loading && templates.length === 0 && (
            <p className="text-font/35 text-xs text-center py-6">No saved templates yet</p>
          )}

          {!loading && templates.map(t => {
            const maskCount = t.masks2 && t.masks2.length > 1 ? t.masks2.length : null;
            return (
              <div
                key={t.id}
                onClick={() => handleLoad(t)}
                className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] cursor-pointer border-b border-white/6 last:border-0 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-font text-sm font-medium truncate">{t.name}</p>
                    {maskCount && (
                      <span className="flex items-center gap-0.5 text-theme/70 text-xs shrink-0">
                        <Layers size={10} />
                        {maskCount}
                      </span>
                    )}
                  </div>
                  <p className="text-font/35 text-xs mt-0.5">
                    Doc1: {formatMaskLabel(t.mask1)} &nbsp;·&nbsp;
                    {maskCount
                      ? `Doc2: ${maskCount} masks`
                      : `Doc2: ${formatMaskLabel(t.mask2)}`
                    }
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-theme text-xs opacity-0 group-hover:opacity-100 transition-opacity">Apply</span>
                  <button
                    onClick={e => handleDelete(t.id, e)}
                    className="p-1 rounded hover:bg-red-500/20 text-font/35 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
