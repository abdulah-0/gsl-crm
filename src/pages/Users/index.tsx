import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';

// Types
type AppUser = {
  id: string;
  full_name: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Counsellor' | 'Staff' | string;
  status: 'Active' | 'Inactive' | string;
  permissions: string[]; // ['dashboard','students','services',...]
  created_at?: string;
};

const ALL_TABS: { id: string; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'students', label: 'Students' },
  { id: 'services', label: 'Products & Services' },
  { id: 'cases', label: 'On-Going Cases' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'finances', label: 'Finances' },
  { id: 'employees', label: 'Employees' },
  { id: 'messenger', label: 'Messenger' },
  { id: 'info-portal', label: 'Info Portal' },
  { id: 'reports', label: 'Reports' },
  { id: 'users', label: 'Users' }, // Only super admin can see even if checked
];

const UsersPage: React.FC = () => {
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>('');

  const [items, setItems] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [roleF, setRoleF] = useState('All');
  const [statusF, setStatusF] = useState('All');

  // Add form state
  const [nFull, setNFull] = useState('');
  const [nEmail, setNEmail] = useState('');
  const [nPassword, setNPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [nRole, setNRole] = useState<'Super Admin'|'Admin'|'Counsellor'|'Staff'|'Custom'>('Staff');
  const [nPerms, setNPerms] = useState<string[]>(['dashboard']);
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [eFull, setEFull] = useState('');
  const [eEmail, setEEmail] = useState('');
  const [ePassword, setEPassword] = useState('');
  const [eShowPw, setEShowPw] = useState(false);
  const [eRole, setERole] = useState<'Super Admin'|'Admin'|'Counsellor'|'Staff'|'Custom'>('Staff');
  const [eStatus, setEStatus] = useState<'Active'|'Inactive'>('Active');
  const [ePerms, setEPerms] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const email = auth.user?.email || null;
      setCurrentEmail(email);
      // Try to read current role from dashboard_users; if not found, fall back to metadata role
      if (email) {
        const { data: me } = await supabase.from('dashboard_users').select('role').eq('email', email).maybeSingle();
        if (me?.role) setCurrentRole(me.role);
      }
      if (!currentRole) {
        const jwt = (auth as any)?.user?.app_metadata?.role || (auth as any)?.user?.user_metadata?.role || '';
        if (jwt) setCurrentRole(jwt);
      }
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('dashboard_users').select('*').order('created_at', { ascending: false });
    setItems((data as any as AppUser[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return items.filter(u => {
      if (roleF !== 'All' && u.role !== roleF) return false;
      if (statusF !== 'All' && u.status !== statusF) return false;
      if (term && !(`${u.full_name} ${u.email}`.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [items, q, roleF, statusF]);

  const isSuper = (currentRole||'').toLowerCase().includes('super');

  const togglePerm = (list: string[], setList: (v: string[]) => void, id: string, fullControl?: boolean) => {
    if (fullControl && !isSuper) return; // safety
    const has = list.includes(id);
    const next = has ? list.filter(x => x !== id) : [...list, id];
    setList(next);
  };

  const saveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nFull || !nEmail) { alert('Full Name and Email are required'); return; }
    setSaving(true);
    try {
      const id = `USR${Date.now().toString().slice(-8)}`;
      // Note: Password creation for authentication must be handled via Supabase Admin API on a secure server.
      const perms = nRole === 'Super Admin' ? ALL_TABS.map(t => t.id) : nPerms;
      await supabase.from('dashboard_users').insert([{ id, full_name: nFull, email: nEmail, role: nRole, status: 'Active', permissions: perms }]);
      setNFull(''); setNEmail(''); setNPassword(''); setNRole('Staff'); setNPerms(['dashboard']);
      await load();
      alert('User added');
    } catch (err: any) {
      alert(err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (u: AppUser) => {
    setEditing(u);
    setEFull(u.full_name); setEEmail(u.email); setEPassword(''); setERole(u.role as any); setEStatus(u.status as any); setEPerms(u.permissions||[]);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const perms = eRole === 'Super Admin' ? ALL_TABS.map(t => t.id) : ePerms;
    await supabase.from('dashboard_users').update({ full_name: eFull, email: eEmail, role: eRole, status: eStatus, permissions: perms }).eq('id', editing.id);
    setEditing(null);
    await load();
  };

  const delUser = async (u: AppUser) => {
    if (!confirm(`Delete user ${u.full_name}?`)) return;
    await supabase.from('dashboard_users').delete().eq('id', u.id);
    await load();
  };

  if (!isSuper) {
    return (
      <main className="w-full min-h-screen bg-background-main flex">
        <Helmet><title>Users | GSL Pakistan CRM</title></Helmet>
        <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
        <div className="flex-1 flex flex-col">
          <Header />
          <div className="px-4 sm:px-6 lg:px-8 mt-10">
            <div className="bg-white rounded-xl p-6 shadow-[0px_6px_58px_#c3cbd61a]">403 — Only Super Admin can access Users</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full min-h-screen bg-background-main flex">
      <Helmet><title>Users | GSL Pakistan CRM</title></Helmet>
      <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
      <div className="flex-1 flex flex-col">
        <Header />

        <section className="px-4 sm:px-6 lg:px-8 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add New User */}
          <form onSubmit={saveNew} className="bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a] lg:col-span-1">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Add New User</h2></div>
            <div className="mt-3 grid grid-cols-1 gap-3 text-sm">
              <label><span className="text-text-secondary">Full Name</span><input value={nFull} onChange={e=>setNFull(e.target.value)} className="mt-1 w-full border rounded p-2" required/></label>
              <label><span className="text-text-secondary">Email</span><input type="email" value={nEmail} onChange={e=>setNEmail(e.target.value)} className="mt-1 w-full border rounded p-2" required/></label>
              <label><span className="text-text-secondary">Password</span>
                <div className="mt-1 flex items-center gap-2">
                  <input type={showPw ? 'text' : 'password'} value={nPassword} onChange={e=>setNPassword(e.target.value)} className="flex-1 border rounded p-2" placeholder="(Auth created server-side)" />
                  <button type="button" onClick={()=>setShowPw(s=>!s)} className="px-2 py-1 border rounded text-xs">{showPw?'Hide':'Show'}</button>
                </div>
              </label>
              <label><span className="text-text-secondary">Role</span>
                <select value={nRole} onChange={e=>{ const v=e.target.value as any; setNRole(v); if (v==='Super Admin') setNPerms(ALL_TABS.map(t=>t.id)); }} className="mt-1 w-full border rounded p-2">
                  <option>Super Admin</option>
                  <option>Admin</option>
                  <option>Counsellor</option>
                  <option>Staff</option>
                  <option>Custom</option>
                </select>
              </label>
              <div>
                <div className="text-text-secondary mb-1">Accessible Tabs</div>
                <div className="grid grid-cols-2 gap-2 border rounded p-2 max-h-40 overflow-auto">
                  {ALL_TABS.map(t => (
                    <label key={t.id} className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={nRole==='Super Admin' ? true : nPerms.includes(t.id)} onChange={()=>togglePerm(nPerms, setNPerms, t.id, nRole==='Super Admin')} disabled={nRole==='Super Admin'} />
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="text-right"><button disabled={saving} type="submit" className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold">Save</button></div>
            </div>
          </form>

          {/* User List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a]">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <h2 className="text-lg font-bold">Users</h2>
                <div className="flex items-center gap-2 text-sm">
                  <input placeholder="Search" value={q} onChange={e=>setQ(e.target.value)} className="border rounded p-2" />
                  <select value={roleF} onChange={e=>setRoleF(e.target.value)} className="border rounded p-2"><option>All</option><option>Super Admin</option><option>Admin</option><option>Counsellor</option><option>Staff</option></select>
                  <select value={statusF} onChange={e=>setStatusF(e.target.value)} className="border rounded p-2"><option>All</option><option>Active</option><option>Inactive</option></select>
                </div>
              </div>
              <div className="mt-3 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-secondary border-b">
                      <th className="py-2 pr-4">Full Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr><td colSpan={5} className="py-4 text-center text-text-secondary">Loading...</td></tr>
                    )}
                    {!loading && filtered.map(u => (
                      <tr key={u.id} className="border-b">
                        <td className="py-2 pr-4 font-semibold">{u.full_name}</td>
                        <td className="py-2 pr-4">{u.email}</td>
                        <td className="py-2 pr-4">{u.role}</td>
                        <td className="py-2 pr-4">{u.status}</td>
                        <td className="py-2 pr-4">
                          <button onClick={()=>openEdit(u)} className="text-blue-600 hover:underline mr-3">Edit</button>
                          <button onClick={()=>delUser(u)} className="text-red-600 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                    {!loading && filtered.length===0 && (
                      <tr><td colSpan={5} className="py-4 text-center text-text-secondary">No users found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Edit User Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <form onSubmit={saveEdit} className="bg-white w-full max-w-lg rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">Edit User</h3><button type="button" onClick={()=>setEditing(null)} className="text-text-secondary">✕</button></div>
            <div className="mt-3 grid grid-cols-1 gap-3 text-sm">
              <label><span className="text-text-secondary">Full Name</span><input value={eFull} onChange={e=>setEFull(e.target.value)} className="mt-1 w-full border rounded p-2" required/></label>
              <label><span className="text-text-secondary">Email</span><input type="email" value={eEmail} onChange={e=>setEEmail(e.target.value)} className="mt-1 w-full border rounded p-2" required/></label>
              <label><span className="text-text-secondary">Password (optional)</span>
                <div className="mt-1 flex items-center gap-2">
                  <input type={eShowPw ? 'text' : 'password'} value={ePassword} onChange={e=>setEPassword(e.target.value)} className="flex-1 border rounded p-2" placeholder="(not stored here)" />
                  <button type="button" onClick={()=>setEShowPw(s=>!s)} className="px-2 py-1 border rounded text-xs">{eShowPw?'Hide':'Show'}</button>
                </div>
              </label>
              <label><span className="text-text-secondary">Role</span>
                <select value={eRole} onChange={e=>{ const v=e.target.value as any; setERole(v); if (v==='Super Admin') setEPerms(ALL_TABS.map(t=>t.id)); }} className="mt-1 w-full border rounded p-2">
                  <option>Super Admin</option>
                  <option>Admin</option>
                  <option>Counsellor</option>
                  <option>Staff</option>
                  <option>Custom</option>
                </select>
              </label>
              <label><span className="text-text-secondary">Status</span>
                <select value={eStatus} onChange={e=>setEStatus(e.target.value as any)} className="mt-1 w-full border rounded p-2">
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </label>
              <div>
                <div className="text-text-secondary mb-1">Accessible Tabs</div>
                <div className="grid grid-cols-2 gap-2 border rounded p-2 max-h-40 overflow-auto">
                  {ALL_TABS.map(t => (
                    <label key={t.id} className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={eRole==='Super Admin' ? true : ePerms.includes(t.id)} onChange={()=>togglePerm(ePerms, setEPerms, t.id, eRole==='Super Admin')} disabled={eRole==='Super Admin'} />
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="text-right"><button type="submit" className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold">Save Changes</button></div>
            </div>
          </form>
        </div>
      )}
    </main>
  );
};

export default UsersPage;

