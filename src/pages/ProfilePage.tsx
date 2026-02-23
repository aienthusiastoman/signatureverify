import { useState, FormEvent } from 'react';
import { User, Lock, CheckCircle, AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  onBack: () => void;
}

export default function ProfilePage({ onBack }: Props) {
  const { user, updatePassword } = useAuth();

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPw.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(newPw);
    if (error) {
      setError(error);
    } else {
      setSuccess('Password updated successfully.');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    }
    setLoading(false);
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm font-medium mb-8 transition-colors"
        >
          <ArrowLeft size={16} /> Back to app
        </button>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-6 flex items-center gap-5">
            <div className="w-16 h-16 bg-teal-500/20 border border-teal-500/30 rounded-2xl flex items-center justify-center text-teal-400 text-xl font-black">
              {initials}
            </div>
            <div>
              <h1 className="text-white text-xl font-black">{displayName}</h1>
              <p className="text-slate-400 text-sm mt-0.5">{user?.email}</p>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                <span className="text-emerald-400 text-xs font-medium">Active session</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Lock size={17} className="text-teal-400" />
              <h2 className="text-white font-bold">Change Password</h2>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-slate-300 text-sm font-semibold">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-800 border border-slate-600 focus:border-teal-500 text-white rounded-xl px-4 py-3 pr-11 text-sm outline-none transition-colors placeholder:text-slate-500"
                  />
                  <button type="button" onClick={() => setShowCurrent(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                    {showCurrent ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 text-sm font-semibold">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                    className="w-full bg-slate-800 border border-slate-600 focus:border-teal-500 text-white rounded-xl px-4 py-3 pr-11 text-sm outline-none transition-colors placeholder:text-slate-500"
                  />
                  <button type="button" onClick={() => setShowNew(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                    {showNew ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 text-sm font-semibold">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-800 border border-slate-600 focus:border-teal-500 text-white rounded-xl px-4 py-3 pr-11 text-sm outline-none transition-colors placeholder:text-slate-500"
                  />
                  <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                    {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {success && (
                <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-400 text-sm">
                  <CheckCircle size={15} className="shrink-0 mt-0.5" />
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !currentPw || !newPw || !confirmPw}
                className="w-full py-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors shadow-lg shadow-teal-500/20"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <User size={17} className="text-teal-400" />
              <h2 className="text-white font-bold">Account Details</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 text-xs mb-0.5">User ID</p>
                <p className="text-slate-300 font-mono text-xs">{user?.id?.slice(0, 16)}...</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Email</p>
                <p className="text-slate-300">{user?.email}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Account Created</p>
                <p className="text-slate-300">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Last Sign In</p>
                <p className="text-slate-300">{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
