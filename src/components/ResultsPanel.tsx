import { Download, CheckCircle, XCircle, AlertTriangle, BarChart2, Clock, FileText, Layers } from 'lucide-react';
import type { ProcessResponse, VerificationJob, MaskScoreBreakdown } from '../types';

interface Props {
  result: ProcessResponse;
  job: VerificationJob | null;
}

function ScoreBadge({ score, size = 'lg' }: { score: number; size?: 'sm' | 'lg' }) {
  const clamp = Math.max(0, Math.min(100, score));
  const color =
    clamp >= 75 ? 'text-emerald-400' :
    clamp >= 50 ? 'text-amber-400' :
    'text-red-400';
  const bgColor =
    clamp >= 75 ? 'bg-emerald-500' :
    clamp >= 50 ? 'bg-amber-500' :
    'bg-red-500';
  const Icon =
    clamp >= 75 ? CheckCircle :
    clamp >= 50 ? AlertTriangle :
    XCircle;
  const label =
    clamp >= 75 ? 'High Confidence Match' :
    clamp >= 50 ? 'Moderate Match' :
    'Low Match / Mismatch';

  if (size === 'sm') {
    return (
      <div className="flex items-center gap-2">
        <Icon size={14} className={color} />
        <span className={`text-2xl font-black tabular-nums ${color}`}>{clamp.toFixed(1)}%</span>
        <span className={`text-xs font-medium ${color} opacity-80`}>{label}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-font font-semibold">
          {score !== undefined ? 'Final Confidence Score' : 'Confidence Score'}
        </h3>
        <div className={`flex items-center gap-1.5 text-sm font-medium ${color}`}>
          <Icon size={16} />
          <span>{label}</span>
        </div>
      </div>

      <div className="flex items-end gap-4">
        <span className={`text-6xl font-black tabular-nums ${color}`}>
          {clamp.toFixed(1)}
        </span>
        <span className="text-font/40 text-2xl font-light mb-2">%</span>
      </div>

      <div className="h-3 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${bgColor}`}
          style={{ width: `${clamp}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-xs">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
          <p className="text-red-400 font-semibold">0–49%</p>
          <p className="text-font/40 mt-0.5">Mismatch</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
          <p className="text-amber-400 font-semibold">50–74%</p>
          <p className="text-font/40 mt-0.5">Moderate</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
          <p className="text-emerald-400 font-semibold">75–100%</p>
          <p className="text-font/40 mt-0.5">Match</p>
        </div>
      </div>
    </div>
  );
}

function MaskBreakdownPanel({ breakdown }: { breakdown: MaskScoreBreakdown[] }) {
  return (
    <div className="bg-surface border border-white/8 rounded-2xl p-4 space-y-3">
      <h3 className="text-font font-semibold flex items-center gap-2">
        <Layers size={16} className="text-theme" />
        Mask-by-Mask Breakdown
        <span className="ml-auto text-xs text-font/35 font-normal">{breakdown.length} masks</span>
      </h3>

      <div className="space-y-2">
        {breakdown.map((item) => {
          const clamp = Math.max(0, Math.min(100, item.score));
          const barColor =
            clamp >= 75 ? 'bg-emerald-500' :
            clamp >= 50 ? 'bg-amber-500' :
            'bg-red-500';
          const textColor =
            clamp >= 75 ? 'text-emerald-400' :
            clamp >= 50 ? 'text-amber-400' :
            'text-red-400';
          const Icon =
            clamp >= 75 ? CheckCircle :
            clamp >= 50 ? AlertTriangle :
            XCircle;

          return (
            <div key={item.maskIndex} className="bg-black/20 border border-white/8 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 w-5 h-5 rounded bg-white/10 text-font/60 text-xs font-bold flex items-center justify-center">
                    {item.maskIndex + 1}
                  </span>
                  <span className="text-font/70 text-sm font-medium truncate">{item.maskLabel}</span>
                  <span className="shrink-0 text-xs text-theme">p{item.page}</span>
                </div>
                <div className={`flex items-center gap-1.5 shrink-0 ${textColor}`}>
                  <Icon size={13} />
                  <span className="font-black tabular-nums text-base">{clamp.toFixed(1)}%</span>
                </div>
              </div>

              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                  style={{ width: `${clamp}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/8 pt-2 flex items-center justify-between text-xs">
        <span className="text-font/35">Average score</span>
        <span className="text-font/60 font-mono">
          ({breakdown.map(b => b.score.toFixed(1)).join(' + ')}) ÷ {breakdown.length}
        </span>
      </div>
    </div>
  );
}

export default function ResultsPanel({ result, job }: Props) {
  const handleDownload = () => {
    window.open(result.resultUrl, '_blank');
  };

  const hasBreakdown = result.maskBreakdown && result.maskBreakdown.length > 1;

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-white/8 rounded-2xl p-6">
        <ScoreBadge score={result.confidenceScore} size="lg" />
        {hasBreakdown && (
          <p className="text-font/35 text-xs mt-3">
            Averaged from {result.maskBreakdown!.length} mask scores — see breakdown below
          </p>
        )}
      </div>

      {hasBreakdown && <MaskBreakdownPanel breakdown={result.maskBreakdown!} />}

      {job && (
        <div className="bg-surface border border-white/8 rounded-2xl p-4 space-y-3">
          <h3 className="text-font font-semibold flex items-center gap-2">
            <BarChart2 size={16} className="text-theme" />
            Analysis Details
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-2">
              <div>
                <p className="text-font/40 text-xs">Document 1</p>
                <p className="text-font truncate">{job.file1_name}</p>
              </div>
              <div>
                <p className="text-font/40 text-xs">Document 2</p>
                <p className="text-font truncate">{job.file2_name}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-font/40 text-xs">Job ID</p>
                <p className="text-font/70 font-mono text-xs">{job.id.slice(0, 8)}...</p>
              </div>
              <div>
                <p className="text-font/40 text-xs flex items-center gap-1">
                  <Clock size={11} />
                  Processed
                </p>
                <p className="text-font/70 text-xs">
                  {new Date(job.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleDownload}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-theme hover:opacity-90 active:opacity-80 text-white font-semibold rounded-xl transition-opacity shadow-lg shadow-theme/20"
      >
        <FileText size={18} />
        Download Comparison PDF
        <Download size={16} className="ml-1" />
      </button>

      <p className="text-center text-font/35 text-xs">
        {hasBreakdown
          ? `PDF includes per-mask breakdown with all ${result.maskBreakdown!.length} signature comparisons`
          : 'PDF contains side-by-side signature comparison with full analysis metrics'}
      </p>
    </div>
  );
}
