import { useState, useEffect, useCallback } from 'react';
import { Bookmark, BookmarkCheck, Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SavedTemplate, MaskRect } from '../types';

interface Props {
  onLoad: (mask1: MaskRect, mask2: MaskRect) => void;
  mask1?: MaskRect | null;
  mask2?: MaskRect | null;
  showSave?: boolean;
}

export default function TemplatePanel({ onLoad, mask1, mask2, showSave = false }: Props) {
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
    const { error } = await supabase.from('templates').insert({
      name: templateName.trim(),
      mask1,
      mask2,
    });
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

  const formatMaskLabel = (m: MaskRect) => {
    const page = m.page ? ` · p${m.page}` : '';
    const anchor = m.anchorText ? ` · "${m.anchorText}"` : '';
    return `${m.width}×${m.height}${page}${anchor}`;
  };

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-700/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bookmark size={15} className="text-teal-400" />
          <span className="text-sm font-medium text-white">Saved Templates</span>
          {templates.length > 0 && (
            <span className="text-xs bg-teal-600/30 text-teal-300 px-1.5 py-0.5 rounded-full">
              {templates.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="bg-slate-900 border-t border-slate-700">
          {showSave && mask1 && mask2 && (
            <div className="p-3 border-b border-slate-700/50">
              {!showSaveForm ? (
                <button
                  onClick={() => setShowSaveForm(true)}
                  className="flex items-center gap-2 text-xs text-teal-400 hover:text-teal-300 transition-colors"
                >
                  <BookmarkCheck size={13} />
                  Save current regions as template
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={templateName}
                      onChange={e => setTemplateName(e.target.value)}
                      placeholder="Template name..."
                      className="flex-1 bg-slate-800 border border-slate-600 text-white text-xs rounded-lg px-3 py-1.5 placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                      onKeyDown={e => e.key === 'Enter' && handleSave()}
                      autoFocus
                    />
                    <button
                      onClick={handleSave}
                      disabled={saving || !templateName.trim()}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                    </button>
                    <button
                      onClick={() => { setShowSaveForm(false); setSaveError(''); }}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors"
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
              <Loader2 size={16} className="text-slate-400 animate-spin" />
            </div>
          )}

          {!loading && templates.length === 0 && (
            <p className="text-slate-500 text-xs text-center py-6">No saved templates yet</p>
          )}

          {!loading && templates.map(t => (
            <div
              key={t.id}
              onClick={() => onLoad(t.mask1, t.mask2)}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/60 cursor-pointer border-b border-slate-700/30 last:border-0 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{t.name}</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  Doc1: {formatMaskLabel(t.mask1)} &nbsp;·&nbsp; Doc2: {formatMaskLabel(t.mask2)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-teal-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">Apply</span>
                <button
                  onClick={e => handleDelete(t.id, e)}
                  className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
