import { AlertCircle } from 'lucide-react';
import type { SignatureRegion } from '../types';

interface Props {
  region1: SignatureRegion | null;
  region2: SignatureRegion | null;
  label1: string;
  label2: string;
}

export default function SignaturePreview({ region1, region2, label1, label2 }: Props) {
  if (!region1 && !region2) return null;

  return (
    <div className="grid grid-cols-2 gap-4">
      {[{ region: region1, label: label1 }, { region: region2, label: label2 }].map(({ region, label }, i) => (
        <div key={i} className="bg-surface border border-white/8 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-font text-sm font-semibold">{label}</h3>
            {region && (
              <span className="text-font/40 text-xs bg-white/8 px-2 py-0.5 rounded-full">
                {region.mask.width} × {region.mask.height}px
              </span>
            )}
          </div>
          {region ? (
            <div className="bg-white rounded-xl overflow-hidden border border-white/15 flex items-center justify-center min-h-24">
              <img
                src={region.dataUrl}
                alt={`Signature ${i + 1}`}
                className="max-w-full max-h-32 object-contain"
              />
            </div>
          ) : (
            <div className="bg-black/20 rounded-xl border border-white/8 flex flex-col items-center justify-center min-h-24 gap-2">
              <AlertCircle size={20} className="text-font/25" />
              <p className="text-font/35 text-xs">No region selected</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
