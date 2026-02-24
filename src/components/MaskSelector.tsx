import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Layers, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SavedTemplate, MaskRect } from '../types';

interface Props {
  onApply: (mask1: MaskRect, mask2: MaskRect) => void;
}

export default function MaskSelector({ onApply }: Props) {
  const [masks, setMasks] = useState<SavedTemplate[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SavedTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setMasks((data as SavedTemplate[]) ?? []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (mask: SavedTemplate) => {
    setSelected(mask);
    setOpen(false);
    onApply(mask.mask1, mask.mask2);
  };

  if (loading || masks.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
          <Layers size={13} />
          <span className="text-xs font-semibold">Apply saved mask</span>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all min-w-0 flex-1 ${
            selected
              ? 'bg-teal-500/10 border-teal-500/40 text-teal-300'
              : 'bg-slate-800 border-slate-600 hover:border-slate-400 text-slate-300'
          }`}
        >
          <span className="truncate flex-1 text-left text-xs">
            {selected ? selected.name : 'Select a mask...'}
          </span>
          <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden">
          <div className="max-h-60 overflow-y-auto">
            {masks.map(mask => (
              <button
                key={mask.id}
                onClick={() => handleSelect(mask)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-xs font-semibold truncate">{mask.name}</p>
                    {selected?.id === mask.id && <Check size={12} className="text-teal-400 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-teal-400/70 text-xs">
                      Doc1: {mask.mask1.page ? `p${mask.mask1.page}` : 'p1'}
                      {mask.mask1.width > 0 ? ` · ${mask.mask1.width}×${mask.mask1.height}` : ''}
                    </span>
                    <span className="text-amber-400/70 text-xs">
                      Doc2: {mask.mask2.page ? `p${mask.mask2.page}` : 'p1'}
                      {mask.mask2.width > 0 ? ` · ${mask.mask2.width}×${mask.mask2.height}` : ''}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
