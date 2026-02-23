import { Check } from 'lucide-react';
import type { AppStep } from '../types';

const STEPS: { key: AppStep; label: string }[] = [
  { key: 'upload', label: 'Upload Files' },
  { key: 'mask', label: 'Define Regions' },
  { key: 'preview', label: 'Preview' },
  { key: 'results', label: 'Results' },
];

interface Props {
  current: AppStep;
}

export default function StepIndicator({ current }: Props) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  done
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30'
                    : active
                    ? 'bg-teal-500 text-white ring-4 ring-teal-500/20 shadow-lg'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {done ? <Check size={16} /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  active ? 'text-teal-400' : done ? 'text-slate-300' : 'text-slate-500'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-16 h-0.5 mb-5 mx-1 transition-all duration-500 ${
                  i < currentIndex ? 'bg-teal-600' : 'bg-slate-700'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
