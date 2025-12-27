/**
 * @fileoverview Users Page
 * 
 * User management system for the GSL CRM (Super Admin only).
 * Manages dashboard users, roles, permissions, and access control.
 * 
 * **Key Features:**
 * - User CRUD operations (Super Admin only)
 * - Role management (Super Admin, Admin, Counsellor, Staff, Teacher, Custom)
 * - Granular module permissions (Add, Edit, Delete per module)
 * - Module access control for 13 modules
 * - Auth account provisioning
 * - Teacher profile synchronization
 * - Real-time user updates
 * - Status management (Active, Inactive, Dormant)
 * 
 * **Modules:**
 * Dashboard, Students, Products & Services, Cases, Calendar, Accounts,
 * Universities, Employees, Teachers, Messenger, Info Portal, Reports, Users
 * 
 * **Permissions System:**
 * - Legacy: Array-based permissions
 * - Modern: Granular per-module permissions (can_add, can_edit, can_delete)
 * - Super Admin: Full CRUD access to all modules
 * 
 * @module pages/Users
 */

import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { useBranches } from '../../hooks/useBranches';

// Types
type AppUser = {
  id: string;
  full_name: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Counsellor' | 'Staff' | 'Teacher' | 'Director' | 'Reporter' | string;
  status: 'Active' | 'Inactive' | 'Dormant' | string;
  permissions: string[]; // ['dashboard','students','services',...]
  branch?: string | null;
  created_at?: string;
};

const ALL_TABS: { id: string; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'students', label: 'Students' },
  { id: 'services', label: 'Products & Services' },
  { id: 'cases', label: 'On-Going Cases' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'universities', label: 'Universities' },
  { id: 'employees', label: 'Employees' },
  { id: 'teachers', label: 'Teachers' },
  { id: 'teacher-assignments', label: 'Assign Students (Teachers)' },
  { id: 'leaves', label: 'Leaves' },
  { id: 'messenger', label: 'Messenger' },
  { id: 'info-portal', label: 'Info Portal' },
  { id: 'reports', label: 'Reports' },
  { id: 'users', label: 'Users' }, // Only super admin can see even if checked
];

type ModulePermissions = { add: boolean; edit: boolean; del: boolean };
const normalizeModule = (id: string) => {
  if (id === 'info-portal') return 'info';
  if (id === 'finances') return 'accounts';
  if (id === 'teacher-assignments') return 'teacher_assignments';
  return id;
};
const MODULE_IDS = ALL_TABS.map(t => t.id);
const emptyPermMap = (): Record<string, ModulePermissions> => (
  Object.fromEntries(MODULE_IDS.map(m => [m, { add: false, edit: false, del: false }])) as Record<string, ModulePermissions>
);
const rowsFromPerms = (email: string, map: Record<string, ModulePermissions>) => (
  Object.entries(map).flatMap(([module, p]) => {
    const hasAny = !!(p?.add || p?.edit || p?.del);
    if (!hasAny && module !== 'dashboard') return [] as any[];
    return [{
      user_email: email,
      module: normalizeModule(module),
      access: hasAny ? 'CRUD' : 'VIEW',
      can_add: !!p?.add,
      can_edit: !!p?.edit,
      can_delete: !!p?.del,
    }];
  })
);


const UsersPage: React.FC = () => {
  const branches = useBranches();
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>('');

  const [items, setItems] = useState<AppUser[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]); // For reporting hierarchy dropdown
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [roleF, setRoleF] = useState('All');
  const [nAccess, setNAccess] = useState<Record<string, ModulePermissions>>(() => emptyPermMap());

  const [statusF, setStatusF] = useState('All');

  // Add form state
  const [nFull, setNFull] = useState('');
  const [nEmail, setNEmail] = useState('');
  const [nPassword, setNPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [nRole, setNRole] = useState<'Super Admin' | 'Admin' | 'Counsellor' | 'Staff' | 'Teacher' | 'Director' | 'Reporter' | 'Custom'>('Staff');
  const [nBranch, setNBranch] = useState<string>('');
  const [nReportsTo, setNReportsTo] = useState<string[]>([]); // Array of emails user reports to
  const [eAccess, setEAccess] = useState<Record<string, ModulePermissions>>({});

  const [nPerms, setNPerms] = useState<string[]>(['dashboard']);
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [eFull, setEFull] = useState('');
  const [eEmail, setEEmail] = useState('');
  const [ePassword, setEPassword] = useState('');
  const [eShowPw, setEShowPw] = useState(false);
  const [eRole, setERole] = useState<'Super Admin' | 'Admin' | 'Counsellor' | 'Staff' | 'Teacher' | 'Director' | 'Reporter' | 'Custom'>('Staff');
  const [eStatus, setEStatus] = useState<'Active' | 'Inactive' | 'Dormant'>('Active');
  const [eBranch, setEBranch] = useState<string>('');
  const [eReportsTo, setEReportsTo] = useState<string[]>([]); // Array of emails user reports to
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
    const users = (data as any as AppUser[]) || [];
    setItems(users);
    setAllUsers(users); // Store for reporting hierarchy dropdown
    setLoading(false);
  };

  useEffect(() => { load(); }, []);


  // Realtime: reload when users change
  useEffect(() => {
    const chan = supabase
      .channel('public:dashboard_users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dashboard_users' }, () => load())
      .subscribe();
    return () => { try { supabase.removeChannel(chan); } catch { } };
  }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return items.filter(u => {
      if (roleF !== 'All' && u.role !== roleF) return false;
      if (statusF !== 'All' && u.status !== statusF) return false;
      if (term && !(`${u.full_name} ${u.email}`.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [items, q, roleF, statusF]);

  const isSuper = (currentRole || '').toLowerCase().includes('super');

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
      // Build permissions array (for sidebar gating) and granular rows
      const baseModules = nRole === 'Super Admin' ? ALL_TABS.map(t => normalizeModule(t.id)) : nPerms;
      const modulesWithCRUD = Object.entries(nAccess).filter(([_, p]) => !!(p?.add || p?.edit || p?.del)).map(([id]) => normalizeModule(id));
      let permsArray = Array.from(new Set([...baseModules, ...modulesWithCRUD, 'dashboard']));
      // If user has teacher_assignments permission, ensure they also have teachers module access
      if (permsArray.includes('teacher_assignments') && !permsArray.includes('teachers')) {
        permsArray.push('teachers');
      }
      await supabase.from('dashboard_users').insert([{ id, full_name: nFull, email: nEmail, role: nRole, status: 'Active', permissions: permsArray, branch: nBranch || null }]);

      // Insert reporting hierarchy relationships
      if (nReportsTo.length > 0) {
        const reportingRows = nReportsTo.map(supervisorEmail => ({
          user_email: nEmail,
          reports_to_email: supervisorEmail,
          created_by: currentEmail || 'system'
        }));
        await supabase.from('user_reporting_hierarchy').insert(reportingRows);
      }
      // If role is Teacher, ensure a teacher profile exists as well (matched by email)
      if (nRole === 'Teacher') {
        try {
          await supabase.from('dashboard_teachers').upsert([
            { id: `TEA${Date.now().toString().slice(-8)}`, full_name: nFull, email: nEmail, status: 'Active' }
          ], { onConflict: 'email' } as any);
        } catch (e) { console.warn('teacher upsert (new) failed', e); }
      }
      // Upsert granular permissions
      const rows = nRole === 'Super Admin'
        ? ALL_TABS.map(t => ({ user_email: nEmail, module: normalizeModule(t.id), access: 'CRUD' as const, can_add: true, can_edit: true, can_delete: true }))
        : rowsFromPerms(nEmail, nAccess);
      if (rows.length) {
        await supabase.from('user_permissions').upsert(rows, { onConflict: 'user_email,module' });
      }
      // Try to provision an Auth account immediately (secure serverless)
      const pwd = (nPassword || '').trim();
      let provisioned = false;
      if (pwd) {
        try {
          const resp = await fetch('/api/admin/create-auth-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: nEmail, password: pwd, full_name: nFull, role: nRole })
          });
          const j = await resp.json().catch(() => ({}));
          if (!resp.ok) throw new Error(j.error || 'Failed to create account');
          provisioned = true;
        } catch (e) {
          console.error('Auth provision failed', e);
        }
      }
      if (!provisioned) {
        // Fallback: send a magic login link
        try { await supabase.auth.signInWithOtp({ email: nEmail }); } catch { }
      }
      // Reset
      setNFull(''); setNEmail(''); setNPassword(''); setNRole('Staff'); setNBranch(''); setNReportsTo([]); setNPerms(['dashboard']); setNAccess(() => emptyPermMap());
      await load();
      alert(provisioned ? 'User added and Auth account created.' : 'User added. Invitation email sent (if email auth is configured).');
    } catch (err: any) {
      alert(err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (u: AppUser) => {
    setEditing(u);
    setEFull(u.full_name); setEEmail(u.email); setEPassword(''); setERole(u.role as any); setEStatus(u.status as any); setEBranch(u.branch || ''); setEPerms(u.permissions || []);

    // Load reporting hierarchy
    (async () => {
      const { data } = await supabase.from('user_reporting_hierarchy').select('reports_to_email').eq('user_email', u.email);
      setEReportsTo((data || []).map((r: any) => r.reports_to_email));
    })();
    // Load granular permissions
    (async () => {
      try {
        if (u.role === 'Super Admin') {
          const m: Record<string, ModulePermissions> = {} as any; MODULE_IDS.forEach(id => { m[id] = { add: true, edit: true, del: true }; }); setEAccess(m);
          return;
        }
        const { data } = await supabase.from('user_permissions').select('module, access, can_add, can_edit, can_delete').eq('user_email', u.email);
        const base = emptyPermMap();
        (data || []).forEach((r: any) => {
          const mod = r.module as string;
          const hasCrud = (r.access === 'CRUD');
          base[mod] = {
            add: r.can_add ?? hasCrud,
            edit: r.can_edit ?? hasCrud,
            del: r.can_delete ?? hasCrud,
          };
        });
        if (!data || data.length === 0) {
          // Fallback: from old array permissions — mark those modules as view-only (no flags)
          (u.permissions || []).forEach(p => { if (!base[p]) base[p] = { add: false, edit: false, del: false }; });
        }
        setEAccess(base);
      } catch {
        setEAccess(prev => Object.keys(prev).length ? prev : emptyPermMap());
      }
    })();
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const baseModules = eRole === 'Super Admin' ? ALL_TABS.map(t => normalizeModule(t.id)) : ePerms;
      const modulesWithCRUD = Object.entries(eAccess).filter(([_, p]) => !!(p?.add || p?.edit || p?.del)).map(([id]) => normalizeModule(id));
      let permsArray = Array.from(new Set([...baseModules, ...modulesWithCRUD, 'dashboard']));
      // If user has teacher_assignments permission, ensure they also have teachers module access
      if (permsArray.includes('teacher_assignments') && !permsArray.includes('teachers')) {
        permsArray.push('teachers');
      }
      await supabase.from('dashboard_users').update({ full_name: eFull, email: eEmail, role: eRole, status: eStatus, permissions: permsArray, branch: eBranch || null }).eq('id', editing.id);

      // Update reporting hierarchy
      // Delete existing relationships
      await supabase.from('user_reporting_hierarchy').delete().eq('user_email', editing.email);
      // Insert new relationships
      if (eReportsTo.length > 0) {
        const reportingRows = eReportsTo.map(supervisorEmail => ({
          user_email: editing.email,
          reports_to_email: supervisorEmail,
          created_by: currentEmail || 'system'
        }));
        await supabase.from('user_reporting_hierarchy').insert(reportingRows);
      }
      // Ensure teacher profile reflects role/status
      try {
        if (eRole === 'Teacher') {
          // Update by previous email if exists, then upsert by new email to ensure presence
          await supabase.from('dashboard_teachers').update({ full_name: eFull, email: eEmail, status: eStatus }).eq('email', editing.email);
          await supabase.from('dashboard_teachers').upsert([
            { id: `TEA${Date.now().toString().slice(-8)}`, full_name: eFull, email: eEmail, status: eStatus }
          ], { onConflict: 'email' } as any);
        } else if ((editing.role || '').toString() === 'Teacher') {
          // Role changed away from Teacher — mark teacher record inactive
          await supabase.from('dashboard_teachers').update({ status: 'Inactive' }).eq('email', editing.email);
        }
      } catch (e) { console.warn('teacher upsert (edit) failed', e); }
      // Replace granular permissions
      await supabase.from('user_permissions').delete().eq('user_email', editing.email);
      const rows = eRole === 'Super Admin'
        ? ALL_TABS.map(t => ({ user_email: editing.email, module: normalizeModule(t.id), access: 'CRUD' as const, can_add: true, can_edit: true, can_delete: true }))
        : rowsFromPerms(editing.email, eAccess);
      if (rows.length) {
        await supabase.from('user_permissions').upsert(rows, { onConflict: 'user_email,module' });
      }
      alert('Updated');
      setEditing(null);
      await load();
    } catch (err: any) {
      alert(err.message || String(err));
    } finally {
      setSaving(false);
    }
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
              <label><span className="text-text-secondary">Full Name</span><input value={nFull} onChange={e => setNFull(e.target.value)} className="mt-1 w-full border rounded p-2" required /></label>
              <label><span className="text-text-secondary">Email</span><input type="email" value={nEmail} onChange={e => setNEmail(e.target.value)} className="mt-1 w-full border rounded p-2" required /></label>
              <label><span className="text-text-secondary">Password</span>
                <div className="mt-1 flex items-center gap-2">
                  <input type={showPw ? 'text' : 'password'} value={nPassword} onChange={e => setNPassword(e.target.value)} className="flex-1 border rounded p-2" placeholder="(Auth created server-side)" />
                  <button type="button" onClick={() => setShowPw(s => !s)} className="px-2 py-1 border rounded text-xs">{showPw ? 'Hide' : 'Show'}</button>
                </div>
              </label>
              <label><span className="text-text-secondary">Role</span>
                <select value={nRole} onChange={e => { const v = e.target.value as any; setNRole(v); if (v === 'Super Admin') { const m: Record<string, ModulePermissions> = {}; MODULE_IDS.forEach(id => { m[id] = { add: true, edit: true, del: true }; }); setNAccess(m); setNPerms(ALL_TABS.map(t => normalizeModule(t.id))); } else if (v === 'Teacher') { const m = emptyPermMap(); setNAccess(m); setNPerms(['dashboard', 'teachers']); } else { const m = emptyPermMap(); setNAccess(m); setNPerms(['dashboard']); } }} className="mt-1 w-full border rounded p-2">
                  <option>Super Admin</option>
                  <option>Admin</option>
                  <option>Counsellor</option>
                  <option>Staff</option>
                  <option>Teacher</option>
                  <option>Director</option>
                  <option>Reporter</option>
                  <option>Custom</option>
                </select>
              </label>
              <label><span className="text-text-secondary">Branch</span>
                <select value={nBranch} onChange={e => setNBranch(e.target.value)} className="mt-1 w-full border rounded p-2" required>
                  <option value="">Select Branch</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.branch_code || b.id}>{b.branch_name}</option>
                  ))}
                </select>
              </label>
              <label><span className="text-text-secondary">Reports To (Supervisors)</span>
                <div className="mt-1 border rounded p-2 max-h-32 overflow-auto">
                  {allUsers.filter(u => u.email !== nEmail).map(u => (
                    <label key={u.email} className="flex items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={nReportsTo.includes(u.email)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNReportsTo([...nReportsTo, u.email]);
                          } else {
                            setNReportsTo(nReportsTo.filter(email => email !== u.email));
                          }
                        }}
                      />
                      <span>{u.full_name} ({u.role})</span>
                    </label>
                  ))}
                  {allUsers.filter(u => u.email !== nEmail).length === 0 && (
                    <div className="text-text-secondary text-xs">No other users available</div>
                  )}
                </div>
              </label>
              <div>
                <div className="text-text-secondary mb-1">Module Access</div>
                <div className="border rounded p-2 max-h-64 overflow-auto text-xs divide-y">
                  {ALL_TABS.map(t => {
                    const perm = nAccess[t.id] || { add: false, edit: false, del: false };
                    const value = nRole === 'Super Admin' ? 'CRUD' : (
                      perm.add && perm.edit && perm.del ? 'CRUD' :
                        perm.add && perm.edit ? 'ADD_EDIT' :
                          perm.add && perm.del ? 'ADD_DELETE' :
                            perm.edit && perm.del ? 'EDIT_DELETE' :
                              perm.add ? 'ADD' :
                                perm.edit ? 'EDIT' :
                                  perm.del ? 'DELETE' :
                                    (nPerms.includes(normalizeModule(t.id)) ? 'VIEW' : 'NONE')
                    );
                    return (
                      <div key={t.id} className="flex items-center justify-between gap-3 py-1.5">
                        <span className="truncate">{t.label}</span>
                        <select
                          disabled={nRole === 'Super Admin'}
                          value={value}
                          onChange={(e) => {
                            const v = e.target.value as 'NONE' | 'VIEW' | 'ADD' | 'EDIT' | 'DELETE' | 'ADD_EDIT' | 'ADD_DELETE' | 'EDIT_DELETE' | 'CRUD';
                            setNAccess(prev => {
                              const base = { ...(prev[t.id] || { add: false, edit: false, del: false }) };
                              switch (v) {
                                case 'NONE': base.add = false; base.edit = false; base.del = false; break;
                                case 'VIEW': base.add = false; base.edit = false; base.del = false; break;
                                case 'ADD': base.add = true; base.edit = false; base.del = false; break;
                                case 'EDIT': base.add = false; base.edit = true; base.del = false; break;
                                case 'DELETE': base.add = false; base.edit = false; base.del = true; break;
                                case 'ADD_EDIT': base.add = true; base.edit = true; base.del = false; break;
                                case 'ADD_DELETE': base.add = true; base.edit = false; base.del = true; break;
                                case 'EDIT_DELETE': base.add = false; base.edit = true; base.del = true; break;
                                case 'CRUD': base.add = true; base.edit = true; base.del = true; break;
                              }
                              return { ...prev, [t.id]: base };
                            });
                            setNPerms(prev => {
                              const mod = normalizeModule(t.id);
                              if (v === 'NONE') return prev.filter(x => x !== mod);
                              return prev.includes(mod) ? prev : [...prev, mod];
                            });
                          }}
                          className="border rounded p-1 text-xs"
                        >
                          <option value="NONE">None</option>
                          <option value="VIEW">View</option>
                          <option value="ADD">Add</option>
                          <option value="EDIT">Edit</option>
                          <option value="DELETE">Delete</option>
                          <option value="ADD_EDIT">Add + Edit</option>
                          <option value="ADD_DELETE">Add + Delete</option>
                          <option value="EDIT_DELETE">Edit + Delete</option>
                          <option value="CRUD">Full (CRUD)</option>
                        </select>
                      </div>
                    );
                  })}
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
                  <input placeholder="Search" value={q} onChange={e => setQ(e.target.value)} className="border rounded p-2" />
                  <select value={roleF} onChange={e => setRoleF(e.target.value)} className="border rounded p-2"><option>All</option><option>Super Admin</option><option>Admin</option><option>Counsellor</option><option>Staff</option><option>Teacher</option><option>Director</option><option>Reporter</option></select>
                  <select value={statusF} onChange={e => setStatusF(e.target.value)} className="border rounded p-2"><option>All</option><option>Active</option><option>Inactive</option><option>Dormant</option></select>
                </div>
              </div>
              <div className="mt-3 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-secondary border-b">
                      <th className="py-2 pr-4">Full Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-4">Branch</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr><td colSpan={6} className="py-4 text-center text-text-secondary">Loading...</td></tr>
                    )}
                    {!loading && filtered.map(u => (
                      <tr key={u.id} className="border-b">
                        <td className="py-2 pr-4 font-semibold">{u.full_name}</td>
                        <td className="py-2 pr-4">{u.email}</td>
                        <td className="py-2 pr-4">{u.role}</td>
                        <td className="py-2 pr-4">{u.branch || 'N/A'}</td>
                        <td className="py-2 pr-4">{u.status}</td>
                        <td className="py-2 pr-4">
                          <button onClick={() => openEdit(u)} className="text-blue-600 hover:underline mr-3">Edit</button>
                          <button onClick={() => delUser(u)} className="text-red-600 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                    {!loading && filtered.length === 0 && (
                      <tr><td colSpan={6} className="py-4 text-center text-text-secondary">No users found</td></tr>
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
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">Edit User</h3><button type="button" onClick={() => setEditing(null)} className="text-text-secondary">✕</button></div>
            <div className="mt-3 grid grid-cols-1 gap-3 text-sm">
              <label><span className="text-text-secondary">Full Name</span><input value={eFull} onChange={e => setEFull(e.target.value)} className="mt-1 w-full border rounded p-2" required /></label>
              <label><span className="text-text-secondary">Email</span><input type="email" value={eEmail} onChange={e => setEEmail(e.target.value)} className="mt-1 w-full border rounded p-2" required /></label>
              <label><span className="text-text-secondary">Password (optional)</span>
                <div className="mt-1 flex items-center gap-2">
                  <input type={eShowPw ? 'text' : 'password'} value={ePassword} onChange={e => setEPassword(e.target.value)} className="flex-1 border rounded p-2" placeholder="(not stored here)" />
                  <button type="button" onClick={() => setEShowPw(s => !s)} className="px-2 py-1 border rounded text-xs">{eShowPw ? 'Hide' : 'Show'}</button>
                </div>
              </label>
              <label><span className="text-text-secondary">Role</span>
                <select value={eRole} onChange={e => { const v = e.target.value as any; setERole(v); if (v === 'Super Admin') { const m: Record<string, ModulePermissions> = {} as any; MODULE_IDS.forEach(id => { m[id] = { add: true, edit: true, del: true }; }); setEAccess(m); setEPerms(ALL_TABS.map(t => normalizeModule(t.id))); } else if (v === 'Teacher') { const m = emptyPermMap(); setEAccess(m); setEPerms(['dashboard', 'teachers']); } else { const m = emptyPermMap(); setEAccess(m); setEPerms(['dashboard']); } }} className="mt-1 w-full border rounded p-2">
                  <option>Super Admin</option>
                  <option>Admin</option>
                  <option>Counsellor</option>
                  <option>Staff</option>
                  <option>Teacher</option>
                  <option>Director</option>
                  <option>Reporter</option>
                  <option>Custom</option>
                </select>
              </label>
              <label><span className="text-text-secondary">Branch</span>
                <select value={eBranch} onChange={e => setEBranch(e.target.value)} className="mt-1 w-full border rounded p-2" required>
                  <option value="">Select Branch</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.branch_code || b.id}>{b.branch_name}</option>
                  ))}
                </select>
              </label>
              <label><span className="text-text-secondary">Reports To (Supervisors)</span>
                <div className="mt-1 border rounded p-2 max-h-32 overflow-auto">
                  {allUsers.filter(u => u.email !== editing?.email).map(u => (
                    <label key={u.email} className="flex items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={eReportsTo.includes(u.email)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEReportsTo([...eReportsTo, u.email]);
                          } else {
                            setEReportsTo(eReportsTo.filter(email => email !== u.email));
                          }
                        }}
                      />
                      <span>{u.full_name} ({u.role})</span>
                    </label>
                  ))}
                  {allUsers.filter(u => u.email !== editing?.email).length === 0 && (
                    <div className="text-text-secondary text-xs">No other users available</div>
                  )}
                </div>
              </label>
              <label><span className="text-text-secondary">Status</span>
                <select value={eStatus} onChange={e => setEStatus(e.target.value as any)} className="mt-1 w-full border rounded p-2">
                  <option>Active</option>
                  <option>Inactive</option>
                  <option>Dormant</option>
                </select>
              </label>
              <div>
                <div className="text-text-secondary mb-1">Module Access</div>
                <div className="grid grid-cols-2 gap-2 border rounded p-2 max-h-56 overflow-auto text-xs">
                  {ALL_TABS.map(t => (
                    <div key={t.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{t.label}</span>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1">
                          <input type="checkbox" disabled={eRole === 'Super Admin'} checked={eRole === 'Super Admin' || !!eAccess[t.id]?.add} onChange={(ev) => setEAccess(prev => ({ ...prev, [t.id]: { ...(prev[t.id] || { add: false, edit: false, del: false }), add: ev.target.checked } }))} />
                          <span>Add</span>
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" disabled={eRole === 'Super Admin'} checked={eRole === 'Super Admin' || !!eAccess[t.id]?.edit} onChange={(ev) => setEAccess(prev => ({ ...prev, [t.id]: { ...(prev[t.id] || { add: false, edit: false, del: false }), edit: ev.target.checked } }))} />
                          <span>Edit</span>
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" disabled={eRole === 'Super Admin'} checked={eRole === 'Super Admin' || !!eAccess[t.id]?.del} onChange={(ev) => setEAccess(prev => ({ ...prev, [t.id]: { ...(prev[t.id] || { add: false, edit: false, del: false }), del: ev.target.checked } }))} />
                          <span>Delete</span>
                        </label>
                      </div>
                    </div>
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

