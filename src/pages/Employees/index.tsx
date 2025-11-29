/**
 * @fileoverview Employees Page
 * 
 * Employee directory and management system for the GSL CRM.
 * Provides employee CRUD operations and activity tracking.
 * 
 * **Key Features:**
 * - Employee directory with pagination
 * - Add/Edit/Remove employees
 * - Employee details view
 * - Activity feed tracking employee actions
 * - Real-time updates via Supabase
 * - Automatic user account creation
 * - Teacher profile synchronization
 * 
 * **Employee Information:**
 * - Full name, email, gender, birthday, position, level
 * - Age calculation
 * - Avatar support
 * 
 * **Activity Tracking:**
 * - Profile updates
 * - Onboarding completion
 * - Level changes
 * - Case assignments
 * 
 * **Integration:**
 * - Creates user accounts via RPC `app_create_user_local`
 * - Syncs with dashboard_users and dashboard_teachers for Teacher roles
 * - Logs all actions to activity_log
 * 
 * @module pages/Employees
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';

import { supabase } from '../../lib/supabaseClient';

// Types
type Level = 'Junior' | 'Middle' | 'Senior';

type Employee = {
  id: string;
  fullName: string;
  email: string;
  gender: 'Male' | 'Female' | 'Other';
  birthday: string; // YYYY-MM-DD
  position: string;
  level: Level;
  avatar?: string;
};

type Activity = {
  id: string;
  employeeId: string;
  text: string;
  at: string; // ISO
};

// Utils
const calcAge = (dob: string): number => {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();

const LEVEL_TAG: Record<Level, { bg: string; text: string }> = {
  Junior: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Middle: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  Senior: { bg: 'bg-purple-100', text: 'text-purple-700' },
};

const seedEmployees = (): Employee[] => {
  const firstNames = ['Evan', 'Ayesha', 'John', 'Sana', 'Amir', 'Anna', 'Zara', 'Bilal', 'Usman', 'Fatima', 'Ali', 'Noor', 'Hassan', 'Hina'];
  const lastNames = ['Yates', 'Khan', 'Doe', 'Tariq', 'Ali', 'Smith', 'Ahmed', 'Akram', 'Saeed', 'Ibrahim', 'Raza'];
  const positions = ['Admissions Officer', 'Case Manager', 'Finance Assistant', 'HR Specialist', 'Marketing Exec', 'Developer', 'Designer'];
  const genders: Array<Employee['gender']> = ['Male', 'Female'];
  const levels: Level[] = ['Junior', 'Middle', 'Senior'];

  const arr: Employee[] = [];
  let id = 1;
  while (arr.length < 28) {
    const fn = firstNames[id % firstNames.length];
    const ln = lastNames[id % lastNames.length];
    const fullName = `${fn} ${ln}`;
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com`;
    const gender = genders[id % genders.length];
    const level = levels[id % levels.length];
    const position = positions[id % positions.length];
    const year = 1988 + (id % 12); // 1988..1999
    const month = ((id % 12) + 1).toString().padStart(2, '0');
    const day = ((id % 27) + 1).toString().padStart(2, '0');
    arr.push({
      id: `emp-${id}`,
      fullName,
      email,
      gender,
      birthday: `${year}-${month}-${day}`,
      position,
      level,
      avatar: '/images/img_image.svg',
    });
    id++;
  }
  return arr;
};

const seedActivities = (emps: Employee[]): Activity[] => {
  const now = Date.now();
  const texts = [
    (e: Employee) => `${e.fullName} updated profile`,
    (e: Employee) => `${e.fullName} completed onboarding`,
    (e: Employee) => `${e.fullName} changed level to ${e.level}`,
    (e: Employee) => `${e.fullName} was assigned to a new case`,
  ];
  const out: Activity[] = [];
  let i = 0;
  for (const e of emps) {
    out.push({ id: `act-${i++}`, employeeId: e.id, text: texts[i % texts.length](e), at: new Date(now - i * 3600_000).toISOString() });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
};

const Employees: React.FC = () => {
  // Realtime employees + activity from Supabase
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, user_id, role_title, joined_on, user:users(name,email)')
        .order('created_at', { ascending: false });
      if (!cancelled && data) {
        const mapped: Employee[] = (data as any[]).map((row: any) => ({
          id: String(row.id),
          fullName: row.user?.name || 'Unknown',
          email: row.user?.email || '-',
          gender: 'Other',
          birthday: (row.joined_on ? String(row.joined_on) : '1995-01-01'),
          position: row.role_title || 'Employee',
          level: 'Junior',
          avatar: '/images/img_image.svg',
        }));
        setEmployees(mapped);
      }
      if (error) console.error('load employees error', error);
    };
    load();

    const chan = supabase
      .channel('public:employees')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(chan); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadActs = async () => {
      const { data, error } = await supabase
        .from('activity_log')
        .select('id, action, detail, created_at')
        .eq('entity', 'employee')
        .order('created_at', { ascending: false })
        .limit(200);
      if (!cancelled && data) {
        const mapped: Activity[] = (data as any[]).map((row: any) => ({
          id: String(row.id),
          employeeId: String(row.detail?.employee_id ?? ''),
          text: row.action,
          at: row.created_at,
        }));
        setActivities(mapped);
      }
      if (error) console.error('load activity error', error);
    };
    loadActs();

    const chan = supabase
      .channel('public:activity_log')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, (payload) => {
        const row: any = payload.new;
        if (row?.entity === 'employee') loadActs();
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(chan); };
  }, []);

  // View/UI state
  const [view, setView] = useState<'list' | 'activity'>('list');
  const total = employees.length;

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const pagedEmployees = useMemo(() => {
    const start = (page - 1) * pageSize;
    return employees.slice(start, start + pageSize);
  }, [employees, page]);

  // Add Employee modal
  const [showAdd, setShowAdd] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formGender, setFormGender] = useState<Employee['gender']>('Male');
  const [formBirthday, setFormBirthday] = useState('1995-01-01');
  const [formPosition, setFormPosition] = useState('Admissions Officer');
  const [formLevel, setFormLevel] = useState<Level>('Junior');

  const saveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    const email = formEmail.trim();
    if (!name || !email) return;

    // 1) Create local user via RPC (superadmin-only); fallback to null user_id on failure
    let userId: number | null = null;
    try {
      const tempPass = Math.random().toString(36).slice(2) + 'A1!';
      const { data: createdUserId, error: rpcErr } = await supabase.rpc('app_create_user_local', {
        p_name: name,
        p_email: email,
        p_password: tempPass,
        p_role: 'employee'
      });
      if (rpcErr) { console.warn('create user rpc failed', rpcErr.message); }
      if (createdUserId) userId = Number(createdUserId);
    } catch (err) { console.warn('rpc error', err); }

    // 2) Insert employee row
    const { data: empRow, error: empErr } = await supabase
      .from('employees')
      .insert([{ user_id: userId, role_title: formPosition, joined_on: new Date().toISOString().slice(0, 10) }])
      .select('id')
      .single();
    if (empErr) {
      alert(`Could not add employee. ${empErr.message}\n\nTip: This action may require Super Admin permissions. Please ensure you are logged in as Super Admin or adjust RLS policies for employees.`);
      return;
    }

    // 3) Log activity
    await supabase.from('activity_log').insert([{
      entity: 'employee',
      entity_id: empRow?.id,
      action: `Added employee ${name}`,
      detail: { employee_id: empRow?.id, name, email, position: formPosition }
    }]);

    // 4) If role/position indicates Teacher, ensure RBAC + teacher profile
    try {
      if (formPosition.toLowerCase().includes('teacher')) {
        // dashboard_users upsert
        await supabase.from('dashboard_users').upsert([
          { id: `USR${Date.now().toString().slice(-8)}`, full_name: name, email, role: 'Teacher', status: 'Active', permissions: ['teachers'] }
        ], { onConflict: 'email' } as any);
        // dashboard_teachers upsert
        await supabase.from('dashboard_teachers').upsert([
          { id: `TEA${Date.now().toString().slice(-8)}`, full_name: name, email, status: 'Active' }
        ], { onConflict: 'email' } as any);
      }
    } catch (e) {
      console.warn('teacher onboarding warn', e);
    }

    // Reset
    setShowAdd(false);
    setFormName(''); setFormEmail(''); setFormGender('Male'); setFormBirthday('1995-01-01'); setFormPosition('Admissions Officer'); setFormLevel('Junior');
  };
  // Row actions
  const [viewEmp, setViewEmp] = useState<Employee | null>(null);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editJoinedOn, setEditJoinedOn] = useState('');

  const openView = (emp: Employee) => setViewEmp(emp);
  const openEdit = (emp: Employee) => { setEditEmp(emp); setEditName(emp.fullName); setEditEmail(emp.email); setEditPosition(emp.position); setEditJoinedOn(emp.birthday); };
  const closeMenus = () => setOpenMenuId(null);

  const removeEmp = async (emp: Employee) => {
    if (!confirm(`Remove ${emp.fullName}?`)) return;
    // employees.id is numeric in DB, we stored as string
    const idNum = Number(emp.id.replace(/^emp-/, '')); // tolerate old seed id format
    const { error } = await supabase.from('employees').delete().eq('id', isNaN(idNum) ? emp.id : idNum);
    if (error) alert(`Failed to remove: ${error.message}`);
    else await supabase.from('activity_log').insert([{ entity: 'employee', entity_id: isNaN(idNum) ? emp.id : idNum, action: `Removed employee ${emp.fullName}`, detail: { employee_id: emp.id, name: emp.fullName, email: emp.email } }]);
    setOpenMenuId(null);
  };

  const saveEdit = async () => {
    if (!editEmp) return;
    // Update user name/email if possible
    try {
      // Find employee row by matching current list index (we don't have employee row id separate)
      // We'll update by joining on users via email, which is unique in users table.
      // First, update users.name where email=original email
      if (editEmp.email) {
        await supabase.from('users').update({ name: editName }).eq('email', editEmp.email);
        if (editEmail && editEmail !== editEmp.email) {
          await supabase.from('users').update({ email: editEmail }).eq('email', editEmp.email);
        }
      }
    } catch (e) { console.warn('user update warn', e); }

    // Update employee role_title / joined_on
    const idNum = Number(editEmp.id.replace(/^emp-/, ''));
    const { error } = await supabase
      .from('employees')
      .update({ role_title: editPosition, joined_on: editJoinedOn || null })
      .eq('id', isNaN(idNum) ? editEmp.id : idNum);
    if (error) { alert(`Failed to update: ${error.message}`); return; }

    await supabase.from('activity_log').insert([{ entity: 'employee', entity_id: isNaN(idNum) ? editEmp.id : idNum, action: `Updated employee ${editName}`, detail: { employee_id: editEmp.id, name: editName, email: editEmail || editEmp.email, position: editPosition } }]);

    setEditEmp(null);
  };


  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <>
      <Helmet>
        <title>Employees | GSL Pakistan CRM</title>
        <meta name="description" content="Employee directory, attendance, performance, and payroll management." />
      </Helmet>

      <main className="w-full min-h-screen bg-background-main flex">
        <div className="w-[14%] min-w-[200px] hidden lg:block">
          <Sidebar />
        </div>

        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          <section className="mt-8 lg:mt-12">
            {/* Top header row */}
            <div className="flex items-center justify-between">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-4xl text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>
                Employees ({total})
              </h1>
              <button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-full font-bold text-white bg-[#ffa332] shadow-[0px_6px_12px_#3f8cff43] hover:opacity-95">
                + Add Employee
              </button>
            </div>

            {/* View toggles + filter */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setView('list')} className={`px-3 py-1 rounded ${view === 'list' ? 'bg-gray-100 font-semibold' : ''}`}>List</button>
                <button onClick={() => setView('activity')} className={`px-3 py-1 rounded ${view === 'activity' ? 'bg-gray-100 font-semibold' : ''}`}>Activity</button>
              </div>
            </div>

            {/* Content card */}
            <div className="mt-4 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a]">
              {view === 'list' ? (
                <div className="p-4">
                  {/* Header row */}
                  <div className="hidden md:grid grid-cols-12 text-xs text-text-secondary px-3 py-2">
                    <div className="col-span-3">Employee</div>
                    <div className="col-span-2">Email</div>
                    <div className="col-span-1">Gender</div>
                    <div className="col-span-2">Birthday</div>
                    <div className="col-span-1">Age</div>
                    <div className="col-span-2">Position / Level</div>
                    <div className="col-span-1 text-right">Actions</div>
                  </div>
                  <div className="divide-y">
                    {pagedEmployees.map(emp => (
                      <div key={emp.id} className="grid grid-cols-12 items-center px-3 py-3">
                        {/* Employee */}
                        <div className="col-span-12 md:col-span-3 flex items-center gap-3">
                          <img src={emp.avatar || '/images/img_image.svg'} alt="avatar" className="w-9 h-9 rounded-full" />
                          <div>
                            <div className="font-semibold">{emp.fullName}</div>
                            <div className="md:hidden text-xs text-text-secondary">{emp.email}</div>
                          </div>
                        </div>
                        {/* Email */}
                        <div className="hidden md:block col-span-2 truncate">{emp.email}</div>
                        {/* Gender */}
                        <div className="hidden md:block col-span-1">{emp.gender}</div>
                        {/* Birthday */}
                        <div className="hidden md:block col-span-2">{fmtDate(emp.birthday)}</div>
                        {/* Age */}
                        <div className="hidden md:block col-span-1">{calcAge(emp.birthday)}</div>
                        {/* Position / Level */}
                        <div className="col-span-8 md:col-span-2 mt-2 md:mt-0">
                          <div className="flex items-center gap-2">
                            <span>{emp.position}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${LEVEL_TAG[emp.level].bg} ${LEVEL_TAG[emp.level].text}`}>{emp.level}</span>
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="col-span-4 md:col-span-1 flex justify-end relative">
                          <button onClick={() => setOpenMenuId(openMenuId === emp.id ? null : emp.id)} className="px-2 py-1 rounded hover:bg-gray-100" aria-haspopup="menu" aria-expanded={openMenuId === emp.id}>
                            \u22EE
                          </button>
                          {openMenuId === emp.id && (
                            <div className="absolute right-0 top-8 bg-white border rounded shadow z-10 w-40">
                              <button onClick={() => { openView(emp); closeMenus(); }} className="w-full text-left px-3 py-2 hover:bg-gray-50">View</button>
                              <button onClick={() => { openEdit(emp); closeMenus(); }} className="w-full text-left px-3 py-2 hover:bg-gray-50">Edit</button>
                              <button onClick={() => { removeEmp(emp); }} className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50">Remove</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-3 px-3">
                    <div className="text-sm text-text-secondary">{`${(page - 1) * pageSize + 1}\u2013${Math.min(page * pageSize, total)} of ${total}`}</div>
                    <div className="flex items-center gap-2">
                      <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1 rounded border disabled:opacity-50">Prev</button>
                      <span className="text-sm">Page {page} / {pageCount}</span>
                      <button disabled={page >= pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))} className="px-3 py-1 rounded border disabled:opacity-50">Next</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className="space-y-4">
                    {activities.slice(0, 40).map(a => {
                      const emp = employees.find(e => e.id === a.employeeId);
                      if (!emp) return null;
                      return (
                        <div key={a.id} className="flex items-start gap-3">
                          <img src={emp.avatar || '/images/img_image.svg'} alt="avatar" className="w-8 h-8 rounded-full" />
                          <div>
                            <div className="text-sm"><span className="font-semibold">{emp.fullName}</span> <span className="text-text-secondary">{a.text.replace(emp.fullName, '')}</span></div>
                            <div className="text-xs text-text-secondary">{new Date(a.at).toLocaleString()}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Add Employee Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={saveEmployee} className="bg-white w-full max-w-lg rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Add Employee</h3>
              <button type="button" onClick={() => setShowAdd(false)} className="text-text-secondary hover:opacity-70">\u2715</button>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="text-text-secondary">Full Name</span>
                <input value={formName} onChange={e => setFormName(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="e.g., Evan Yates" required />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Email</span>
                <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="name@example.com" required />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Gender</span>
                <select value={formGender} onChange={e => setFormGender(e.target.value as Employee['gender'])} className="mt-1 w-full border rounded p-2">
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Birthday</span>
                <input type="date" value={formBirthday} onChange={e => setFormBirthday(e.target.value)} className="mt-1 w-full border rounded p-2" />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Position</span>
                <input value={formPosition} onChange={e => setFormPosition(e.target.value)} className="mt-1 w-full border rounded p-2" />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Level</span>
                <select value={formLevel} onChange={e => setFormLevel(e.target.value as Level)} className="mt-1 w-full border rounded p-2">
                  <option>Junior</option>
                  <option>Middle</option>
                  <option>Senior</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-2 rounded border hover:bg-gray-50">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold shadow-[0px_6px_12px_#3f8cff43]">Save Employee</button>

            </div>
          </form>
        </div>
      )}

      {/* View Employee Modal */}
      {viewEmp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Employee Details</h3>
              <button type="button" onClick={() => setViewEmp(null)} className="text-text-secondary hover:opacity-70">✕</button>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-text-secondary">Full Name</div>
                <div className="font-semibold">{viewEmp.fullName}</div>
              </div>
              <div>
                <div className="text-text-secondary">Email</div>
                <div className="font-semibold">{viewEmp.email}</div>
              </div>
              <div>
                <div className="text-text-secondary">Position</div>
                <div className="font-semibold">{viewEmp.position}</div>
              </div>
              <div>
                <div className="text-text-secondary">Joined On</div>
                <div className="font-semibold">{viewEmp.birthday ? new Date(viewEmp.birthday).toLocaleDateString() : '—'}</div>
              </div>
            </div>
            <div className="mt-5 text-right">
              <button type="button" onClick={() => setViewEmp(null)} className="px-3 py-2 rounded border hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editEmp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Edit Employee</h3>
              <button type="button" onClick={() => setEditEmp(null)} className="text-text-secondary hover:opacity-70">✕</button>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label className="text-sm">
                <span className="text-text-secondary">Full Name</span>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="mt-1 w-full border rounded p-2" />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Email</span>
                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="mt-1 w-full border rounded p-2" />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Position</span>
                <input value={editPosition} onChange={e => setEditPosition(e.target.value)} className="mt-1 w-full border rounded p-2" />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Joined On</span>
                <input type="date" value={editJoinedOn} onChange={e => setEditJoinedOn(e.target.value)} className="mt-1 w-full border rounded p-2" />
              </label>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setEditEmp(null)} className="px-3 py-2 rounded border hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={saveEdit} className="px-3 py-2 rounded bg-[#ffa332] text-white font-bold shadow-[0px_6px_12px_#3f8cff43]">Save</button>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

export default Employees;
