import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Layers, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SavedTemplate, MaskRect, MaskDefinition } from '../types';

interface Props {
  onApply: (mask1: MaskRect, mask2: MaskRect, masks2?: MaskDefinition[]) => void;
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
    const loadedMasks2 = mask.masks2 && mask.masks2.length > 0 ? mask.masks2 : undefined;
    onApply(mask.mask1, mask.mask2, loadedMasks2);
  };

  if (loading || masks.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-font/50 shrink-0">
          <Layers size={13} />
          <span className="text-xs font-semibold">Apply saved mask</span>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all min-w-0 flex-1 ${
            selected
              ? 'bg-theme/10 border-theme/40 text-theme'
              : 'bg-black/20 border-white/10 hover:border-white/20 text-font/60'
          }`}
        >
          <span className="truncate flex-1 text-left text-xs">
            {selected ? selected.name : 'Select a mask...'}
          </span>
          <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-surface border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          <div className="max-h-60 overflow-y-auto">
            {masks.map(mask => {
              const maskCount = mask.masks2 && mask.masks2.length > 1 ? mask.masks2.length : null;
              return (
                <button
                  key={mask.id}
                  onClick={() => handleSelect(mask)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-font text-xs font-semibold truncate">{mask.name}</p>
                      {selected?.id === mask.id && <Check size={12} className="text-theme shrink-0" />}
                      {maskCount && (
                        <span className="flex items-center gap-0.5 text-teal-400/60 text-xs shrink-0">
                          <Layers size={10} />
                          {maskCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-teal-400/70 text-xs">
                        Doc1: {mask.mask1.page ? `p${mask.mask1.page}` : 'p1'}
                        {mask.mask1.width > 0 ? ` · ${mask.mask1.width}×${mask.mask1.height}` : ''}
                      </span>
                      <span className="text-amber-400/70 text-xs">
                        {maskCount
                          ? `Doc2: ${maskCount} masks`
                          : `Doc2: ${mask.mask2.page ? `p${mask.mask2.page}` : 'p1'}${mask.mask2.width > 0 ? ` · ${mask.mask2.width}×${mask.mask2.height}` : ''}`
                        }
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
