import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { useSearchParams } from 'react-router-dom';

// Dashboard user shape
type AppUser = { id: string; full_name: string; email: string; role: string; status: string; permissions: string[] };

type TabKey = 'overview' | 'settings' | 'security' | 'notifications';

const ProfilePage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [me, setMe] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('overview');

  // Settings form
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  // Security form
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const canSaveName = useMemo(()=> !!me && name.trim() && name.trim() !== me.full_name, [me, name]);
  const canSavePass = useMemo(()=> newPass.length >= 8 && newPass === confirmPass, [newPass, confirmPass]);

  useEffect(() => {
    const t = (params.get('tab') as TabKey) || 'overview';
    setTab(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: au } = await supabase.auth.getUser();
      const email = au.user?.email || '';
      const { data } = await supabase.from('dashboard_users').select('*').eq('email', email).maybeSingle();
      if (data) { setMe(data as any); setName((data as any).full_name || ''); }
      setLoading(false);

      // subscribe to own user row updates
      const channel = supabase
        .channel('rt:dashboard_users:self')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dashboard_users' }, (payload) => {
          const row = (payload.new || payload.old) as any;
          if (row?.email === email) {
            if (payload.eventType !== 'DELETE') {
              setMe(row);
              setName(row.full_name || '');
            }
          }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    })();
  }, [params]);

  const changeTab = (key: TabKey) => { setTab(key); params.set('tab', key); setParams(params, { replace: true }); };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me) return;
    if (!canSaveName) return;
    setSaving(true);
    try {
      await supabase.from('dashboard_users').update({ full_name: name.trim() }).eq('id', me.id);
      // realtime subscription will refresh UI
      alert('Profile updated');
    } catch (err: any) {
      alert(`Failed: ${err.message || err}`);
    } finally { setSaving(false); }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSavePass) { alert('Password must be at least 8 characters and match confirmation.'); return; }
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) { alert(`Failed to change password: ${error.message}`); return; }
    setNewPass(''); setConfirmPass('');
    alert('Password updated');
  };

  return (
    <main className="w-full min-h-screen bg-background-main flex">
      <Helmet><title>My Profile | GSL Pakistan CRM</title></Helmet>
      <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
      <div className="flex-1 flex flex-col">
        <Header />

        <section className="px-4 sm:px-6 lg:px-8 mt-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">My Profile</h1>
          </div>
          <div className="mt-4 bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a]">
            {/* Top user summary */}
            {loading ? (
              <div className="text-text-secondary">Loading...</div>
            ) : me ? (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center font-bold text-lg">
                  {me.full_name?.[0] || me.email?.[0] || 'U'}
                </div>
                <div>
                  <div className="text-lg font-bold">{me.full_name || me.email}</div>
                  <div className="text-sm text-text-secondary">{me.email} • {me.role} • {me.status}</div>
                </div>
              </div>
            ) : (
              <div className="text-text-secondary">No profile found for current session.</div>
            )}
          </div>

          {/* Tabs */}
          <div className="mt-6 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a]">
            <div className="p-3 border-b flex flex-wrap gap-2">
              {(['overview','settings','security','notifications'] as TabKey[]).map(t => (
                <button key={t} onClick={()=>changeTab(t)} className={`px-4 py-2 rounded-full text-sm font-semibold ${tab===t? 'bg-[#ffa332] text-white':'text-text-secondary'}`}>{t[0].toUpperCase()+t.slice(1)}</button>
              ))}
            </div>
            <div className="p-4">
              {tab==='overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="border rounded p-3">
                    <div className="font-semibold mb-2">Account</div>
                    <div>Name: {me?.full_name || '—'}</div>
                    <div>Email: {me?.email || '—'}</div>
                    <div>Role: {me?.role || '—'}</div>
                    <div>Status: {me?.status || '—'}</div>
                  </div>
                  <div className="border rounded p-3">
                    <div className="font-semibold mb-2">Permissions</div>
                    <div className="flex flex-wrap gap-2">
                      {(me?.permissions||[]).map(p => (<span key={p} className="px-2 py-1 rounded bg-orange-50 text-[#ffa332] text-xs">{p}</span>))}
                      {(!me?.permissions || me.permissions.length===0) && <span className="text-text-secondary">No permissions</span>}
                    </div>
                  </div>
                </div>
              )}

              {tab==='settings' && (
                <form onSubmit={saveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="border rounded p-3">
                    <div className="font-semibold mb-2">Profile Settings</div>
                    <label className="block mb-2">
                      <span className="text-text-secondary">Full Name</span>
                      <input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full border rounded p-2"/>
                    </label>
                    <div className="text-right">
                      <button disabled={!canSaveName || saving} className="px-3 py-2 rounded bg-[#ffa332] text-white font-bold">Save</button>
                    </div>
                  </div>
                  <div className="border rounded p-3">
                    <div className="font-semibold mb-2">Preferences</div>
                    <div className="text-text-secondary">(Coming soon) Theme, time zone, layout. For now, preferences are stored locally.</div>
                  </div>
                </form>
              )}

              {tab==='security' && (
                <form onSubmit={changePassword} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="border rounded p-3">
                    <div className="font-semibold mb-2">Change Password</div>
                    <label className="block mb-2">
                      <span className="text-text-secondary">New Password</span>
                      <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} className="mt-1 w-full border rounded p-2"/>
                    </label>
                    <label className="block mb-2">
                      <span className="text-text-secondary">Confirm Password</span>
                      <input type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} className="mt-1 w-full border rounded p-2"/>
                    </label>
                    <div className="text-right"><button disabled={!canSavePass} className="px-3 py-2 rounded bg-gray-800 text-white font-bold">Update Password</button></div>
                  </div>
                  <div className="border rounded p-3">
                    <div className="font-semibold mb-2">Security Tips</div>
                    <ul className="list-disc pl-5 text-text-secondary">
                      <li>Use a strong, unique password.</li>
                      <li>Change your password regularly.</li>
                    </ul>
                  </div>
                </form>
              )}

              {tab==='notifications' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="border rounded p-3">
                    <div className="font-semibold mb-2">Notifications</div>
                    <div className="text-text-secondary">(Coming soon) Email and in-app notifications preferences.</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default ProfilePage;

