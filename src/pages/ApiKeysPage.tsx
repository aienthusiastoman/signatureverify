import { useState, useEffect, useCallback } from 'react';
import { Key, Plus, Trash2, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const arr = new Uint8Array(40);
  crypto.getRandomValues(arr);
  return 'svk_live_' + Array.from(arr).map(b => chars[b % chars.length]).join('');
}

async function hashKey(key: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(key));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function ApiKeysPage() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const fetchKeys = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, is_active, last_used_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setKeys((data as ApiKey[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleCreate = async () => {
    if (!user || !newKeyName.trim()) return;
    setCreating(true);
    setError('');
    const rawKey = generateApiKey();
    const hash = await hashKey(rawKey);
    const prefix = rawKey.slice(0, 16);
    const { error } = await supabase.from('api_keys').insert({
      user_id: user.id,
      name: newKeyName.trim(),
      key_hash: hash,
      key_prefix: prefix,
    });
    if (error) {
      setError('Failed to create API key.');
    } else {
      setNewlyCreatedKey(rawKey);
      setNewKeyName('');
      setShowCreateForm(false);
      fetchKeys();
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('api_keys').delete().eq('id', id);
    setKeys(prev => prev.filter(k => k.id !== id));
  };

  const copyKey = () => {
    if (!newlyCreatedKey) return;
    navigator.clipboard.writeText(newlyCreatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-theme/15 border border-theme/30 rounded-xl flex items-center justify-center">
          <Key size={18} className="text-theme" />
        </div>
        <div>
          <h1 className="text-font text-xl font-black">API Keys</h1>
          <p className="text-font/50 text-sm font-light">Manage access keys for the REST API</p>
        </div>
      </div>

      {newlyCreatedKey && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <CheckCircle size={16} />
            API Key Created — Copy it now, it won't be shown again
          </div>
          <div className="flex items-center gap-3 bg-black/20 border border-white/10 rounded-xl px-4 py-3">
            <code className="flex-1 font-mono text-sm text-font break-all">{newlyCreatedKey}</code>
            <button
              onClick={copyKey}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                copied ? 'bg-emerald-600 text-white' : 'bg-white/10 hover:bg-white/15 text-font/70'
              }`}
            >
              {copied ? <><CheckCircle size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
          </div>
          <button
            onClick={() => setNewlyCreatedKey(null)}
            className="text-font/40 hover:text-font/70 text-xs transition-colors"
          >
            I've saved my key, dismiss
          </button>
        </div>
      )}

      <div className="bg-surface border border-white/8 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h2 className="font-bold text-font text-sm">Your Keys</h2>
          <button
            onClick={() => setShowCreateForm(p => !p)}
            className="flex items-center gap-1.5 px-4 py-2 bg-theme hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity"
          >
            <Plus size={15} /> New Key
          </button>
        </div>

        {showCreateForm && (
          <div className="px-5 py-4 border-b border-white/8 bg-black/10 space-y-3">
            <div className="flex gap-3">
              <input
                type="text"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g. Production)"
                className="flex-1 bg-black/20 border border-white/10 focus:border-theme/60 text-font rounded-xl px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-font/30"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newKeyName.trim()}
                className="px-4 py-2.5 bg-theme hover:opacity-90 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-opacity"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => { setShowCreateForm(false); setError(''); }}
                className="px-4 py-2.5 bg-white/8 hover:bg-white/12 text-font/60 text-sm rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
            {error && <p className="text-red-400 text-xs flex items-center gap-1.5"><AlertCircle size={13} />{error}</p>}
          </div>
        )}

        {loading && <div className="py-12 text-center text-font/40 text-sm">Loading...</div>}

        {!loading && keys.length === 0 && (
          <div className="py-12 text-center space-y-2">
            <Key size={28} className="text-font/20 mx-auto" />
            <p className="text-font/50 font-medium">No API keys yet</p>
            <p className="text-font/35 text-sm font-light">Create your first key to start using the API</p>
          </div>
        )}

        {!loading && keys.map(k => (
          <div key={k.id} className="flex items-center justify-between px-5 py-4 border-b border-white/6 last:border-0 hover:bg-white/[0.03] transition-colors">
            <div className="space-y-0.5 min-w-0">
              <p className="text-font font-semibold text-sm">{k.name}</p>
              <p className="text-font/40 font-mono text-xs">{k.key_prefix}•••••••••••••••</p>
              <p className="text-font/25 text-xs">
                Created {new Date(k.created_at).toLocaleDateString()}
                {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-4">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${k.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/8 text-font/40'}`}>
                {k.is_active ? 'Active' : 'Inactive'}
              </span>
              <button
                onClick={() => handleDelete(k.id)}
                className="p-1.5 rounded-lg hover:bg-red-500/15 text-font/30 hover:text-red-400 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
