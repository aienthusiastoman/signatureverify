import { useState, useEffect, useCallback } from 'react';
import { History, FileText, Trash2, ExternalLink, AlertCircle, Loader2, RefreshCw, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import type { VerificationJob } from '../types';

const PAGE_SIZE = 20;

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-500 text-xs">—</span>;
  const color =
    score >= 75 ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' :
    score >= 50 ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' :
    'text-red-400 bg-red-400/10 border-red-400/20';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${color}`}>
      {score.toFixed(1)}%
    </span>
  );
}

function StatusBadge({ status }: { status: VerificationJob['status'] }) {
  const map = {
    completed: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    processing: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    pending: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
    failed: 'text-red-400 bg-red-400/10 border-red-400/20',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border capitalize ${map[status]}`}>
      {status}
    </span>
  );
}

export default function HistoryPage() {
  const { theme } = useTheme();
  const [jobs, setJobs] = useState<VerificationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('verification_jobs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: sortDir === 'asc' })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search.trim()) {
        query = query.or(`file1_name.ilike.%${search.trim()}%,file2_name.ilike.%${search.trim()}%`);
      }

      const { data, count, error } = await query;
      if (!error) {
        setJobs((data as VerificationJob[]) ?? []);
        setTotalCount(count ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, sortDir, search]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleDelete = async (job: VerificationJob) => {
    setDeleting(job.id);
    try {
      if (job.result_path) {
        await supabase.storage.from('signature-results').remove([job.result_path]);
      }
      await supabase.from('verification_jobs').delete().eq('id', job.id);
      setJobs(prev => prev.filter(j => j.id !== job.id));
      setTotalCount(prev => prev - 1);
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  const openResult = (job: VerificationJob) => {
    if (!job.result_path) return;
    const { data } = supabase.storage.from('signature-results').getPublicUrl(job.result_path);
    window.open(data.publicUrl, '_blank');
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: theme.themeColor + '22' }}
          >
            <History size={20} style={{ color: theme.themeColor }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: theme.fontColor }}>
              Verification History
            </h1>
            <p className="text-xs" style={{ color: theme.fontColor, opacity: 0.45 }}>
              {totalCount} record{totalCount !== 1 ? 's' : ''} total
            </p>
          </div>
        </div>
        <button
          onClick={fetchJobs}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
          style={{ color: theme.fontColor, opacity: 0.6, backgroundColor: 'rgba(255,255,255,0.05)' }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search by file name..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: theme.fontColor,
          }}
        />
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.08)', backgroundColor: theme.surfaceColor }}
      >
        <div
          className="grid grid-cols-[1fr_1fr_100px_90px_100px_90px] gap-4 px-5 py-3 border-b text-xs font-bold uppercase tracking-wider"
          style={{ borderBottomColor: 'rgba(255,255,255,0.07)', color: theme.fontColor, opacity: 1 }}
        >
          <span style={{ opacity: 0.4 }}>Document 1</span>
          <span style={{ opacity: 0.4 }}>Document 2</span>
          <span style={{ opacity: 0.4 }}>Score</span>
          <span style={{ opacity: 0.4 }}>Status</span>
          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1 hover:opacity-100 transition-opacity"
            style={{ opacity: 0.4, color: theme.fontColor }}
          >
            Date
            {sortDir === 'desc' ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
          </button>
          <span style={{ opacity: 0.4 }}>Actions</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin" style={{ color: theme.themeColor }} />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <History size={32} style={{ color: theme.fontColor, opacity: 0.2 }} />
            <p className="text-sm" style={{ color: theme.fontColor, opacity: 0.4 }}>
              {search ? 'No results match your search.' : 'No verification jobs yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {jobs.map(job => (
              <div
                key={job.id}
                className="grid grid-cols-[1fr_1fr_100px_90px_100px_90px] gap-4 px-5 py-4 items-center hover:bg-white/[0.03] transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText size={13} style={{ color: theme.fontColor, opacity: 0.35, flexShrink: 0 }} />
                    <span className="text-sm truncate font-medium" style={{ color: theme.fontColor }}>
                      {job.file1_name}
                    </span>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText size={13} style={{ color: theme.fontColor, opacity: 0.35, flexShrink: 0 }} />
                    <span className="text-sm truncate font-medium" style={{ color: theme.fontColor }}>
                      {job.file2_name}
                    </span>
                  </div>
                </div>
                <div>
                  <ScoreBadge score={job.confidence_score} />
                </div>
                <div>
                  <StatusBadge status={job.status} />
                </div>
                <div>
                  <span className="text-xs" style={{ color: theme.fontColor, opacity: 0.45 }}>
                    {new Date(job.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                  <p className="text-xs mt-0.5" style={{ color: theme.fontColor, opacity: 0.3 }}>
                    {new Date(job.created_at).toLocaleTimeString('en-US', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {job.result_path && (
                    <button
                      onClick={() => openResult(job)}
                      className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                      title="View report"
                      style={{ color: theme.themeColor }}
                    >
                      <ExternalLink size={14} />
                    </button>
                  )}
                  {confirmDelete === job.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(job)}
                        disabled={deleting === job.id}
                        className="px-2 py-1 rounded-md text-xs font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                      >
                        {deleting === job.id ? <Loader2 size={10} className="animate-spin" /> : 'Yes'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-2 py-1 rounded-md text-xs font-semibold transition-colors"
                        style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: theme.fontColor }}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(job.id)}
                      className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                      title="Delete record"
                      style={{ color: theme.fontColor, opacity: 0.4 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: theme.fontColor, opacity: 0.4 }}>
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: theme.fontColor }}
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: theme.fontColor }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm z-50"
          style={{
            backgroundColor: theme.surfaceColor,
            borderColor: 'rgba(248,113,113,0.3)',
            color: theme.fontColor,
          }}
        >
          <AlertCircle size={15} className="text-red-400 shrink-0" />
          This will also delete the stored report PDF.
        </div>
      )}
    </div>
  );
}
