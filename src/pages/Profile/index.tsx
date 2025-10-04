import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { useSearchParams } from 'react-router-dom';

// Dashboard user shape
type AppUser = { id: string; full_name: string; email: string; role: string; status: string; permissions: string[]; avatar_url?: string; phone?: string; city?: string; job_title?: string; about?: string };

type TabKey = 'overview' | 'settings' | 'security' | 'notifications';

const ProfilePage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [me, setMe] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('overview');

  // Settings form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [title, setTitle] = useState('');
  const [about, setAbout] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Security form
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const canSaveName = useMemo(()=> !!me && (
    name.trim() !== (me.full_name||'') || phone !== (me.phone||'') || city !== (me.city||'') || title !== (me.job_title||'') || about !== (me.about||'') || !!avatarFile
  ), [me, name, phone, city, title, about, avatarFile]);
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
      if (data) {
        const u = data as any;
        setMe(u);
        setName(u.full_name || '');
        setPhone(u.phone || '');
        setCity(u.city || '');
        setTitle(u.job_title || '');
        setAbout(u.about || '');
        setAvatarUrl(u.avatar_url || '');
      }
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
              setPhone(row.phone || '');
              setCity(row.city || '');
              setTitle(row.job_title || '');
              setAbout(row.about || '');
              setAvatarUrl(row.avatar_url || '');
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
      let newAvatarUrl = avatarUrl;

      // Upload avatar first (optional)
      if (avatarFile) {
        try {
          const path = `${me.id}/${Date.now()}_${avatarFile.name}`;
          const { error: upErr } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
          newAvatarUrl = pub.publicUrl || newAvatarUrl;
        } catch (uploadErr: any) {
          console.warn('Avatar upload failed:', uploadErr?.message || uploadErr);
          alert('Avatar upload failed. Saving profile without avatar.');
        }
      }

      // Detect which columns exist to avoid schema drift issues
      const colsResp = await supabase
        .from('information_schema.columns' as any)
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'dashboard_users');
      const existingCols: string[] = (colsResp.data || []).map((r: any) => r.column_name);

      // Build payload only with existing columns
      const updatePayload: any = { full_name: name.trim() };
      if (existingCols.includes('phone')) updatePayload.phone = phone || null;
      if (existingCols.includes('city')) updatePayload.city = city || null;
      if (existingCols.includes('job_title')) updatePayload.job_title = title || null;
      if (existingCols.includes('about')) updatePayload.about = about || null;
      if (existingCols.includes('avatar_url')) updatePayload.avatar_url = newAvatarUrl || null;

      // Update by id -> by email
      let { error: updErr } = await supabase
        .from('dashboard_users')
        .update(updatePayload)
        .eq('id', me.id)
        .select('id')
        .single();

      if (updErr) {
        console.warn('Update by id failed, retry by email:', updErr.message);
        const retryByEmail = await supabase
          .from('dashboard_users')
          .update(updatePayload)
          .eq('email', me.email)
          .select('id')
          .single();
        updErr = retryByEmail.error || null;
      }

      if (updErr) {
        alert(`Failed to update profile: ${updErr.message}`);
      } else {
        setAvatarFile(null);
        alert('Profile updated');
      }
    } catch (err: any) {
      console.error('Save profile error:', err);
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
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" className="w-12 h-12 rounded-full object-cover"/>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center font-bold text-lg">
                    {me.full_name?.[0] || me.email?.[0] || 'U'}
                  </div>
                )}
                <div>
                  <div className="text-lg font-bold">{me.full_name || 'Unnamed User'}</div>
                  <div className="text-sm text-text-secondary">{me.role} • {me.status}</div>
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
                    <div>Job Title: {me?.job_title || '2014'}</div>
                    <div>Phone: {me?.phone || '2014'}</div>
                    <div>City: {me?.city || '2014'}</div>
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
                  <div className="border rounded p-3 space-y-2">
                    <div className="font-semibold">Profile Settings</div>
                    <label className="block">
                      <span className="text-text-secondary">Full Name</span>
                      <input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full border rounded p-2"/>
                    </label>
                    <label className="block">
                      <span className="text-text-secondary">Job Title</span>
                      <input value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full border rounded p-2"/>
                    </label>
                    <label className="block">
                      <span className="text-text-secondary">Phone</span>
                      <input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 w-full border rounded p-2"/>
                    </label>
                    <label className="block">
                      <span className="text-text-secondary">City</span>
                      <input value={city} onChange={e=>setCity(e.target.value)} className="mt-1 w-full border rounded p-2"/>
                    </label>
                    <label className="block">
                      <span className="text-text-secondary">About</span>
                      <textarea value={about} onChange={e=>setAbout(e.target.value)} className="mt-1 w-full border rounded p-2" rows={3}/>
                    </label>
                  </div>
                  <div className="border rounded p-3 space-y-3">
                    <div className="font-semibold">Avatar</div>
                    <div className="flex items-center gap-3">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="avatar" className="w-16 h-16 rounded-full object-cover"/>
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center font-bold text-lg">
                          {name?.[0] || me?.full_name?.[0] || 'U'}
                        </div>
                      )}
                      <div>
                        <input type="file" accept="image/*" onChange={e=>setAvatarFile((e.target.files&&e.target.files[0])||null)} />
                        <div className="text-xs text-text-secondary">PNG/JPG up to ~2MB recommended</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <button type="submit" disabled={!canSaveName || saving} className="px-3 py-2 rounded bg-[#ffa332] text-white font-bold">{saving? 'Saving...' : 'Save Changes'}</button>
                    </div>
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

