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
        <div key={i} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white text-sm font-semibold">{label}</h3>
            {region && (
              <span className="text-slate-400 text-xs bg-slate-700 px-2 py-0.5 rounded-full">
                {region.mask.width} × {region.mask.height}px
              </span>
            )}
          </div>
          {region ? (
            <div className="bg-white rounded-xl overflow-hidden border border-slate-600 flex items-center justify-center min-h-24">
              <img
                src={region.dataUrl}
                alt={`Signature ${i + 1}`}
                className="max-w-full max-h-32 object-contain"
              />
            </div>
          ) : (
            <div className="bg-slate-900 rounded-xl border border-slate-700 flex flex-col items-center justify-center min-h-24 gap-2">
              <AlertCircle size={20} className="text-slate-500" />
              <p className="text-slate-500 text-xs">No region selected</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
