import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, UserCheck, UserX, Trash2, Loader2, AlertCircle, CheckCircle, X, ShieldCheck, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ManagedUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  app_metadata: { role?: string };
}

const ADMIN_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Authorization': `Bearer ${session?.access_token ?? ''}`,
    'Content-Type': 'application/json',
  };
}

export default function CustomerManagementPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const notify = (msg: string, isError = false) => {
    if (isError) { setError(msg); setSuccess(''); }
    else { setSuccess(msg); setError(''); }
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(ADMIN_FN, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load users');
      setUsers(data.users ?? []);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load users', true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const isActive = (u: ManagedUser) => {
    if (!u.banned_until) return true;
    return new Date(u.banned_until) < new Date();
  };

  const toggleActive = async (u: ManagedUser) => {
    setActionId(u.id);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(ADMIN_FN, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'update', userId: u.id, active: !isActive(u) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify(`User ${isActive(u) ? 'deactivated' : 'activated'} successfully`);
      fetchUsers();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Action failed', true);
    } finally {
      setActionId(null);
    }
  };

  const deleteUser = async (id: string) => {
    setActionId(id);
    setDeleteConfirm(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(ADMIN_FN, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'delete', userId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify('User deleted');
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Delete failed', true);
    } finally {
      setActionId(null);
    }
  };

  const createUser = async () => {
    if (!newEmail.trim() || !newPassword.trim()) return;
    setCreating(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(ADMIN_FN, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'create', email: newEmail.trim(), password: newPassword, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify('User created successfully');
      setNewEmail('');
      setNewPassword('');
      setNewRole('user');
      setShowCreate(false);
      fetchUsers();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Create failed', true);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-theme/15 border border-theme/30 rounded-xl flex items-center justify-center">
            <Users size={18} className="text-theme" />
          </div>
          <div>
            <h1 className="text-font text-xl font-black">Customers</h1>
            <p className="text-font/50 text-sm font-light">Manage user accounts and access</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(p => !p)}
          className="flex items-center gap-2 px-4 py-2.5 bg-theme hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity shadow-lg"
        >
          <Plus size={15} /> New User
        </button>
      </div>

      {(error || success) && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
          error
            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
            : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
        }`}>
          {error ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
          {error || success}
        </div>
      )}

      {showCreate && (
        <div className="bg-surface border border-theme/30 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-font font-bold text-sm">Create New User</h2>
            <button onClick={() => setShowCreate(false)} className="text-font/40 hover:text-font transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-font/50 text-xs font-semibold">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full bg-black/20 border border-white/10 focus:border-theme/60 text-font text-sm rounded-xl px-4 py-3 outline-none transition-colors placeholder:text-font/25"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-font/50 text-xs font-semibold">Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full bg-black/20 border border-white/10 focus:border-theme/60 text-font text-sm rounded-xl px-4 py-3 outline-none transition-colors placeholder:text-font/25"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-font/50 text-xs font-semibold">Role</label>
            <div className="flex gap-3">
              {(['user', 'admin'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setNewRole(r)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    newRole === r
                      ? 'bg-theme/15 border-theme/40 text-theme'
                      : 'bg-black/10 border-white/10 text-font/50 hover:border-white/20'
                  }`}
                >
                  {r === 'admin' ? <ShieldCheck size={14} /> : <User size={14} />}
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={createUser}
            disabled={creating || !newEmail.trim() || !newPassword.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-theme hover:opacity-90 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-opacity"
          >
            {creating ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : <><Plus size={14} /> Create User</>}
          </button>
        </div>
      )}

      <div className="bg-surface border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-font font-bold text-sm">All Users</h2>
          <span className="text-font/35 text-xs">{users.length} total</span>
        </div>

        {loading && (
          <div className="py-16 flex flex-col items-center gap-3">
            <Loader2 size={24} className="animate-spin text-theme" />
            <p className="text-font/40 text-sm">Loading users...</p>
          </div>
        )}

        {!loading && users.length === 0 && (
          <div className="py-16 text-center">
            <Users size={32} className="text-font/15 mx-auto mb-3" />
            <p className="text-font/50 font-medium">No users found</p>
          </div>
        )}

        {!loading && users.map(u => {
          const active = isActive(u);
          const role = u.app_metadata?.role || 'user';
          const isDeleting = deleteConfirm === u.id;

          return (
            <div
              key={u.id}
              className="flex items-center gap-4 px-5 py-4 border-b border-white/6 last:border-0 hover:bg-white/[0.02] transition-colors"
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                  active ? 'bg-theme/15 text-theme' : 'bg-white/8 text-font/35'
                }`}
              >
                {(u.email?.[0] ?? '?').toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-font text-sm font-semibold truncate">{u.email}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    role === 'admin'
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-white/8 text-font/40'
                  }`}>
                    {role}
                  </span>
                </div>
                <p className="text-font/30 text-xs mt-0.5">
                  Created {new Date(u.created_at).toLocaleDateString()}
                  {u.last_sign_in_at && ` · Last login ${new Date(u.last_sign_in_at).toLocaleDateString()}`}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={`hidden sm:block text-xs px-2.5 py-1 rounded-full font-semibold ${
                  active
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-white/8 text-font/35'
                }`}>
                  {active ? 'Active' : 'Inactive'}
                </span>

                {isDeleting ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-400 font-medium">Confirm delete?</span>
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-font/60 text-xs rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => toggleActive(u)}
                      disabled={actionId === u.id}
                      title={active ? 'Deactivate' : 'Activate'}
                      className={`p-2 rounded-lg transition-colors ${
                        active
                          ? 'hover:bg-amber-500/15 text-font/30 hover:text-amber-400'
                          : 'hover:bg-emerald-500/15 text-font/30 hover:text-emerald-400'
                      }`}
                    >
                      {actionId === u.id
                        ? <Loader2 size={15} className="animate-spin" />
                        : active ? <UserX size={15} /> : <UserCheck size={15} />}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(u.id)}
                      title="Delete user"
                      className="p-2 rounded-lg hover:bg-red-500/15 text-font/30 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
