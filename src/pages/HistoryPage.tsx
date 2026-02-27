import { useState, useEffect, useCallback } from 'react';
import { History, FileText, Trash2, ExternalLink, AlertCircle, Loader2, RefreshCw, ChevronDown, ChevronUp, Search, CheckSquare, Square, X, Users, ChevronDown as ChevronDownSmall } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import type { VerificationJob } from '../types';

const PAGE_SIZE = 20;
const ADMIN_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;

interface UserOption {
  id: string;
  email: string;
}

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
  const { user } = useAuth();
  const isAdmin = user?.app_metadata?.role === 'admin';

  const [jobs, setJobs] = useState<VerificationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [userPickerOpen, setUserPickerOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(ADMIN_FN, {
          headers: {
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await res.json();
        if (res.ok) {
          setUserOptions((data.users ?? []).map((u: { id: string; email: string }) => ({ id: u.id, email: u.email })));
        }
      } catch { /* non-fatal */ }
    })();
  }, [isAdmin]);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      let query = supabase
        .from('verification_jobs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: sortDir === 'asc' })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (isAdmin && viewingUserId) {
        query = query.eq('user_id', viewingUserId);
      }

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
  }, [page, sortDir, search, isAdmin, viewingUserId]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const deleteJobById = async (job: VerificationJob): Promise<boolean> => {
    if (job.result_path) {
      await supabase.storage.from('signature-results').remove([job.result_path]);
    }
    const { error } = await supabase.from('verification_jobs').delete().eq('id', job.id);
    return !error;
  };

  const handleDelete = async (job: VerificationJob) => {
    setDeleting(job.id);
    setErrorMsg(null);
    try {
      const ok = await deleteJobById(job);
      if (ok) {
        setJobs(prev => prev.filter(j => j.id !== job.id));
        setTotalCount(prev => prev - 1);
        setSelectedIds(prev => { const n = new Set(prev); n.delete(job.id); return n; });
      } else {
        setErrorMsg('Failed to delete record. Please try again.');
      }
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    setErrorMsg(null);
    const toDelete = jobs.filter(j => selectedIds.has(j.id));
    const resultPaths = toDelete.map(j => j.result_path).filter(Boolean) as string[];
    if (resultPaths.length > 0) {
      await supabase.storage.from('signature-results').remove(resultPaths);
    }
    const ids = toDelete.map(j => j.id);
    const { error } = await supabase.from('verification_jobs').delete().in('id', ids);
    if (!error) {
      setJobs(prev => prev.filter(j => !selectedIds.has(j.id)));
      setTotalCount(prev => prev - ids.length);
      setSelectedIds(new Set());
    } else {
      setErrorMsg('Bulk delete failed. Please try again.');
    }
    setBulkDeleting(false);
    setConfirmBulk(false);
  };

  const openResult = (job: VerificationJob) => {
    if (!job.result_path) return;
    const { data } = supabase.storage.from('signature-results').getPublicUrl(job.result_path);
    window.open(data.publicUrl, '_blank');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const allSelected = jobs.length > 0 && jobs.every(j => selectedIds.has(j.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(jobs.map(j => j.id)));
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const viewingUser = viewingUserId ? userOptions.find(u => u.id === viewingUserId) : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
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
              {viewingUser && <span className="ml-1">— viewing <span style={{ color: theme.themeColor }}>{viewingUser.email}</span></span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <div className="relative">
              <button
                onClick={() => setUserPickerOpen(p => !p)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors border"
                style={{
                  backgroundColor: viewingUserId ? theme.themeColor + '18' : 'rgba(255,255,255,0.06)',
                  borderColor: viewingUserId ? theme.themeColor + '40' : 'rgba(255,255,255,0.10)',
                  color: viewingUserId ? theme.themeColor : theme.fontColor,
                  opacity: viewingUserId ? 1 : 0.7,
                }}
              >
                <Users size={12} />
                {viewingUser ? viewingUser.email : 'All users'}
                <ChevronDownSmall size={11} />
              </button>

              {userPickerOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-64 rounded-xl shadow-2xl z-50 border overflow-hidden"
                  style={{ backgroundColor: theme.surfaceColor, borderColor: 'rgba(255,255,255,0.10)' }}
                >
                  <div className="p-1.5 space-y-0.5 max-h-64 overflow-y-auto">
                    <button
                      onClick={() => { setViewingUserId(null); setPage(0); setUserPickerOpen(false); }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors hover:bg-white/[0.06]"
                      style={{
                        color: !viewingUserId ? theme.themeColor : theme.fontColor,
                        backgroundColor: !viewingUserId ? theme.themeColor + '18' : 'transparent',
                      }}
                    >
                      All users (admin view)
                    </button>
                    {userOptions.map(u => (
                      <button
                        key={u.id}
                        onClick={() => { setViewingUserId(u.id); setPage(0); setUserPickerOpen(false); }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs transition-colors hover:bg-white/[0.06] truncate"
                        style={{
                          color: viewingUserId === u.id ? theme.themeColor : theme.fontColor,
                          backgroundColor: viewingUserId === u.id ? theme.themeColor + '18' : 'transparent',
                          opacity: viewingUserId === u.id ? 1 : 0.75,
                        }}
                      >
                        {u.email}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {someSelected && (
            <button
              onClick={() => setConfirmBulk(true)}
              disabled={bulkDeleting}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20 disabled:opacity-50"
            >
              {bulkDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Delete {selectedIds.size} selected
            </button>
          )}
          <button
            onClick={fetchJobs}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
            style={{ color: theme.fontColor, opacity: 0.6, backgroundColor: 'rgba(255,255,255,0.05)' }}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {userPickerOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setUserPickerOpen(false)} />
      )}

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
          className="grid grid-cols-[40px_1fr_1fr_100px_90px_100px_80px] gap-4 px-5 py-3 border-b text-xs font-bold uppercase tracking-wider"
          style={{ borderBottomColor: 'rgba(255,255,255,0.07)', color: theme.fontColor }}
        >
          <div className="flex items-center">
            <button onClick={toggleSelectAll} className="opacity-50 hover:opacity-100 transition-opacity">
              {allSelected
                ? <CheckSquare size={14} style={{ color: theme.themeColor }} />
                : <Square size={14} style={{ color: theme.fontColor }} />}
            </button>
          </div>
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
            {jobs.map(job => {
              const isSelected = selectedIds.has(job.id);
              return (
                <div
                  key={job.id}
                  className="grid grid-cols-[40px_1fr_1fr_100px_90px_100px_80px] gap-4 px-5 py-4 items-center hover:bg-white/[0.03] transition-colors"
                  style={isSelected ? { backgroundColor: theme.themeColor + '10' } : {}}
                >
                  <div className="flex items-center">
                    <button
                      onClick={() => toggleSelect(job.id)}
                      className="opacity-50 hover:opacity-100 transition-opacity"
                    >
                      {isSelected
                        ? <CheckSquare size={14} style={{ color: theme.themeColor }} />
                        : <Square size={14} style={{ color: theme.fontColor }} />}
                    </button>
                  </div>
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
                  <div><ScoreBadge score={job.confidence_score} /></div>
                  <div><StatusBadge status={job.status} /></div>
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
                  <div className="flex items-center gap-1">
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
                          className="p-1 rounded-md transition-colors hover:bg-white/10"
                          style={{ color: theme.fontColor, opacity: 0.5 }}
                        >
                          <X size={12} />
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
              );
            })}
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

      {confirmBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            className="rounded-2xl p-6 shadow-2xl border max-w-sm w-full mx-4 space-y-4"
            style={{ backgroundColor: theme.surfaceColor, borderColor: 'rgba(248,113,113,0.3)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: theme.fontColor }}>
                  Delete {selectedIds.size} record{selectedIds.size !== 1 ? 's' : ''}?
                </p>
                <p className="text-xs mt-0.5" style={{ color: theme.fontColor, opacity: 0.45 }}>
                  This will also remove the stored report PDFs. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmBulk(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: theme.fontColor }}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors bg-red-500/20 hover:bg-red-500/30 text-red-400 disabled:opacity-50 flex items-center gap-2"
              >
                {bulkDeleting && <Loader2 size={12} className="animate-spin" />}
                Delete all
              </button>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm z-50"
          style={{
            backgroundColor: theme.surfaceColor,
            borderColor: 'rgba(248,113,113,0.3)',
            color: theme.fontColor,
          }}
        >
          <AlertCircle size={15} className="text-red-400 shrink-0" />
          {errorMsg}
          <button onClick={() => setErrorMsg(null)} className="ml-2 opacity-50 hover:opacity-100">
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
