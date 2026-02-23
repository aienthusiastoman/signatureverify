import { Download, CheckCircle, XCircle, AlertTriangle, BarChart2, Clock, FileText } from 'lucide-react';
import type { ProcessResponse, VerificationJob } from '../types';

interface Props {
  result: ProcessResponse;
  job: VerificationJob | null;
}

function ConfidenceGauge({ score }: { score: number }) {
  const clamp = Math.max(0, Math.min(100, score));
  const color =
    clamp >= 75 ? 'text-emerald-400' :
    clamp >= 50 ? 'text-amber-400' :
    'text-red-400';
  const bgColor =
    clamp >= 75 ? 'bg-emerald-500' :
    clamp >= 50 ? 'bg-amber-500' :
    'bg-red-500';
  const label =
    clamp >= 75 ? 'High Confidence Match' :
    clamp >= 50 ? 'Moderate Match' :
    'Low Match / Mismatch';
  const Icon =
    clamp >= 75 ? CheckCircle :
    clamp >= 50 ? AlertTriangle :
    XCircle;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">Confidence Score</h3>
        <div className={`flex items-center gap-1.5 text-sm font-medium ${color}`}>
          <Icon size={16} />
          <span>{label}</span>
        </div>
      </div>

      <div className="flex items-end gap-4">
        <span className={`text-6xl font-black tabular-nums ${color}`}>
          {clamp.toFixed(1)}
        </span>
        <span className="text-slate-400 text-2xl font-light mb-2">%</span>
      </div>

      <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${bgColor}`}
          style={{ width: `${clamp}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-xs">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
          <p className="text-red-400 font-semibold">0–49%</p>
          <p className="text-slate-400 mt-0.5">Mismatch</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
          <p className="text-amber-400 font-semibold">50–74%</p>
          <p className="text-slate-400 mt-0.5">Moderate</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
          <p className="text-emerald-400 font-semibold">75–100%</p>
          <p className="text-slate-400 mt-0.5">Match</p>
        </div>
      </div>
    </div>
  );
}

export default function ResultsPanel({ result, job }: Props) {
  const handleDownload = () => {
    window.open(result.resultUrl, '_blank');
  };

  return (
    <div className="space-y-4">
      <ConfidenceGauge score={result.confidenceScore} />

      {job && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <BarChart2 size={16} className="text-teal-400" />
            Analysis Details
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-2">
              <div>
                <p className="text-slate-400 text-xs">Document 1</p>
                <p className="text-white truncate">{job.file1_name}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Document 2</p>
                <p className="text-white truncate">{job.file2_name}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-slate-400 text-xs">Job ID</p>
                <p className="text-white font-mono text-xs">{job.id.slice(0, 8)}...</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs flex items-center gap-1">
                  <Clock size={11} />
                  Processed
                </p>
                <p className="text-white text-xs">
                  {new Date(job.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleDownload}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-teal-500/20"
      >
        <FileText size={18} />
        Download Comparison PDF
        <Download size={16} className="ml-1" />
      </button>

      <p className="text-center text-slate-500 text-xs">
        PDF contains side-by-side signature comparison with full analysis metrics
      </p>
    </div>
  );
}
