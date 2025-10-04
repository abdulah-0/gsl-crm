import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

// Types
interface Teacher { id: string; full_name: string; email: string; phone?: string; cnic?: string; status: 'Active'|'Inactive'|string; created_at?: string; }
interface Service { id: string; name: string; }
interface Assignment { id?: number; service_id?: string|null; service_name?: string|null; batch_no?: string|null; }

const TeachersPage: React.FC = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<string>('');
  const [allowed, setAllowed] = useState<string[]|null>(null);

  // Lists
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [assignMap, setAssignMap] = useState<Record<string, Assignment[]>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('All');

  // Add Form
  const [nFull, setNFull] = useState('');
  const [nEmail, setNEmail] = useState('');
  const [nPassword, setNPassword] = useState('');
  const [nPhone, setNPhone] = useState('');
  const [nCnic, setNCnic] = useState('');
  const [nAssignments, setNAssignments] = useState<Assignment[]>([{ service_id: undefined, service_name: undefined, batch_no: '' }]);
  const [saving, setSaving] = useState(false);

  // Edit Modal
  const [editing, setEditing] = useState<Teacher|null>(null);
  const [eFull, setEFull] = useState('');
  const [eEmail, setEEmail] = useState('');
  const [ePhone, setEPhone] = useState('');
  const [eCnic, setECnic] = useState('');
  const [eStatus, setEStatus] = useState<'Active'|'Inactive'>('Active');
  const [eAssignments, setEAssignments] = useState<Assignment[]>([]);

  useEffect(() => {
    (async () => {
      // determine role and allowed tabs for conditional access
      const { data: sess } = await supabase.auth.getUser();
      const email = sess.user?.email;
      if (email) {
        const { data: me } = await supabase.from('dashboard_users').select('role, permissions').eq('email', email).maybeSingle();
        const roleStr = (me?.role || (sess.user as any)?.app_metadata?.role || (sess.user as any)?.user_metadata?.role || '').toString();
        setRole(roleStr);
        const perms = Array.isArray(me?.permissions) ? (me?.permissions as any as string[]) : [];
        const rl = roleStr.toLowerCase();
        if (rl.includes('super')) setAllowed(['teachers']);
        else if (rl.includes('admin')) setAllowed(['teachers']);
        else if (rl.includes('teacher')) setAllowed(['teachers']);
        else setAllowed(perms.length?perms:null);
      }
      await loadAll();
    })();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: ts }, { data: svcs }, { data: assigns }] = await Promise.all([
      supabase.from('dashboard_teachers').select('*').order('created_at', { ascending: false }),
      supabase.from('dashboard_services').select('id,name').order('name'),
      supabase.from('dashboard_teacher_assignments').select('*')
    ]);
    setTeachers((ts||[]) as any);
    setServices((svcs||[]) as any);
    const grouped: Record<string, Assignment[]> = {};
    (assigns||[]).forEach((a: any) => { const t = a.teacher_id; if (!grouped[t]) grouped[t]=[]; grouped[t].push(a); });
    setAssignMap(grouped);
    setLoading(false);
  };

  const visible = useMemo(() => {
    const term = q.toLowerCase().trim();
    return teachers.filter(t => {
      if (statusF !== 'All' && t.status !== statusF) return false;
      const slist = (assignMap[t.id]||[]).map(a=>{
        const svc = services.find(s=>s.id===a.service_id);
        return `${svc?.name||a.service_name||''} ${a.batch_no||''}`.trim();
      }).join(', ');
      if (term && !(`${t.full_name} ${t.email} ${slist}`.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [teachers, assignMap, services, q, statusF]);

  const addAssignmentRow = () => setNAssignments(rows=>[...rows, { service_id: undefined, service_name: undefined, batch_no: '' }]);
  const removeAssignmentRow = (i: number) => setNAssignments(rows=>rows.filter((_,idx)=>idx!==i));
  const updateAssignment = (i: number, patch: Partial<Assignment>) => setNAssignments(rows=>rows.map((r,idx)=> idx===i ? { ...r, ...patch } : r));

  const saveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nFull || !nEmail) { alert('Full Name and Email are required'); return; }
    setSaving(true);
    try {
      const id = `TEA${Date.now().toString().slice(-8)}`;
      await supabase.from('dashboard_teachers').insert([{ id, full_name: nFull, email: nEmail, phone: nPhone, cnic: nCnic, status: 'Active' }]);
      const rows = (nAssignments||[]).map(a=>({ teacher_id: id, service_id: a.service_id||null, service_name: (services.find(s=>s.id===a.service_id)?.name)||a.service_name||null, batch_no: a.batch_no||null }));
      if (rows.length) await supabase.from('dashboard_teacher_assignments').insert(rows);
      // Also add to dashboard_users with Teacher role & default permissions ['teachers']
      await supabase.from('dashboard_users').insert([{ id: `USR${Date.now().toString().slice(-8)}`, full_name: nFull, email: nEmail, role: 'Teacher', status: 'Active', permissions: ['teachers'] }]);
      // Note: creating auth user/password should be done via Admin API from a secure backend.
      setNFull(''); setNEmail(''); setNPassword(''); setNPhone(''); setNCnic(''); setNAssignments([{ service_id: undefined, service_name: undefined, batch_no: '' }]);
      await loadAll();
      alert('Teacher added');
    } catch (err: any) {
      alert(err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = async (t: Teacher) => {
    setEditing(t);
    setEFull(t.full_name); setEEmail(t.email); setEPhone(t.phone||''); setECnic(t.cnic||''); setEStatus((t.status as any)||'Active');
    setEAssignments(assignMap[t.id] ? [...assignMap[t.id]] : []);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await supabase.from('dashboard_teachers').update({ full_name: eFull, email: eEmail, phone: ePhone, cnic: eCnic, status: eStatus }).eq('id', editing.id);
    // Reset assignments: delete then insert
    await supabase.from('dashboard_teacher_assignments').delete().eq('teacher_id', editing.id);
    const rows = (eAssignments||[]).map(a=>({ teacher_id: editing.id, service_id: a.service_id||null, service_name: (services.find(s=>s.id===a.service_id)?.name)||a.service_name||null, batch_no: a.batch_no||null }));
    if (rows.length) await supabase.from('dashboard_teacher_assignments').insert(rows);
    setEditing(null);
    await loadAll();
  };

  const delTeacher = async (t: Teacher) => {
    if (!confirm(`Delete teacher ${t.full_name}?`)) return;
    await supabase.from('dashboard_teachers').delete().eq('id', t.id);
    await loadAll();
  };

  // Access control: if user is Teacher role, they should only see this tab; already handled by Sidebar. No extra UI restrictions here.

  return (
    <main className="w-full min-h-screen bg-background-main flex">
      <Helmet><title>Teachers | GSL Pakistan CRM</title></Helmet>
      <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
      <div className="flex-1 flex flex-col">
        <Header />

        <section className="px-4 sm:px-6 lg:px-8 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Teacher */}
          <form onSubmit={saveNew} className="bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a] lg:col-span-1">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Add Teacher</h2></div>
            <div className="mt-3 grid grid-cols-1 gap-3 text-sm">
              <label><span className="text-text-secondary">Full Name</span><input value={nFull} onChange={e=>setNFull(e.target.value)} className="mt-1 w-full border rounded p-2" required/></label>
              <label><span className="text-text-secondary">Email</span><input type="email" value={nEmail} onChange={e=>setNEmail(e.target.value)} className="mt-1 w-full border rounded p-2" required/></label>
              <label><span className="text-text-secondary">Password</span><input type="password" value={nPassword} onChange={e=>setNPassword(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="(Auth created server-side)"/></label>
              <label><span className="text-text-secondary">Phone</span><input value={nPhone} onChange={e=>setNPhone(e.target.value)} className="mt-1 w-full border rounded p-2"/></label>
              <label><span className="text-text-secondary">CNIC (optional)</span><input value={nCnic} onChange={e=>setNCnic(e.target.value)} className="mt-1 w-full border rounded p-2"/></label>
              <div>
                <div className="text-text-secondary mb-1">Assignments (Course + Batch)</div>
                {nAssignments.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <select value={row.service_id||''} onChange={e=>updateAssignment(idx,{ service_id: e.target.value||undefined })} className="border rounded p-2 flex-1">
                      <option value="">Select Course</option>
                      {services.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <input placeholder="Batch No (optional)" value={row.batch_no||''} onChange={e=>updateAssignment(idx,{ batch_no: e.target.value })} className="border rounded p-2 w-40"/>
                    <button type="button" onClick={()=>removeAssignmentRow(idx)} className="text-red-600">Remove</button>
                  </div>
                ))}
                <button type="button" onClick={addAssignmentRow} className="text-blue-600 text-xs">+ Add Another</button>
              </div>
              <div className="text-right"><button disabled={saving} type="submit" className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold">Save</button></div>
            </div>
          </form>

          {/* Teachers List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a]">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <h2 className="text-lg font-bold">Teachers</h2>
                <div className="flex items-center gap-2 text-sm">
                  <input placeholder="Search" value={q} onChange={e=>setQ(e.target.value)} className="border rounded p-2" />
                  <select value={statusF} onChange={e=>setStatusF(e.target.value)} className="border rounded p-2"><option>All</option><option>Active</option><option>Inactive</option></select>
                </div>
              </div>
              <div className="mt-3 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-secondary border-b">
                      <th className="py-2 pr-4">Full Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Assigned Batches / Courses</th>
                      <th className="py-2 pr-4">Total Students</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (<tr><td colSpan={6} className="py-4 text-center text-text-secondary">Loading...</td></tr>)}
                    {!loading && visible.map(t => {
                      const assignments = assignMap[t.id]||[];
                      const assignedLabel = assignments.map(a => {
                        const svc = services.find(s=>s.id===a.service_id);
                        return `${svc?.name||a.service_name||''}${a.batch_no?` (${a.batch_no})`:''}`;
                      }).join(', ');
                      // Total students will be computed on detail page; here we leave blank or estimate
                      return (
                        <tr key={t.id} className="border-b">
                          <td className="py-2 pr-4 font-semibold">{t.full_name}</td>
                          <td className="py-2 pr-4">{t.email}</td>
                          <td className="py-2 pr-4">{assignedLabel||'-'}</td>
                          <td className="py-2 pr-4">-</td>
                          <td className="py-2 pr-4">{t.status}</td>
                          <td className="py-2 pr-4">
                            <button onClick={()=>navigate(`/teachers/${t.id}`)} className="text-blue-600 hover:underline mr-3">View</button>
                            <button onClick={()=>openEdit(t)} className="text-indigo-600 hover:underline mr-3">Edit</button>
                            <button onClick={()=>delTeacher(t)} className="text-red-600 hover:underline">Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                    {!loading && visible.length===0 && (<tr><td colSpan={6} className="py-4 text-center text-text-secondary">No teachers found</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <form onSubmit={saveEdit} className="bg-white w-full max-w-2xl rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">Edit Teacher</h3><button type="button" onClick={()=>setEditing(null)} className="text-text-secondary">✕</button></div>
            <div className="mt-3 grid grid-cols-1 gap-3 text-sm">
              <label><span className="text-text-secondary">Full Name</span><input value={eFull} onChange={e=>setEFull(e.target.value)} className="mt-1 w-full border rounded p-2" required/></label>
              <label><span className="text-text-secondary">Email</span><input type="email" value={eEmail} onChange={e=>setEEmail(e.target.value)} className="mt-1 w-full border rounded p-2" required/></label>
              <div className="grid grid-cols-2 gap-3">
                <label><span className="text-text-secondary">Phone</span><input value={ePhone} onChange={e=>setEPhone(e.target.value)} className="mt-1 w-full border rounded p-2"/></label>
                <label><span className="text-text-secondary">CNIC</span><input value={eCnic} onChange={e=>setECnic(e.target.value)} className="mt-1 w-full border rounded p-2"/></label>
              </div>
              <label><span className="text-text-secondary">Status</span>
                <select value={eStatus} onChange={e=>setEStatus(e.target.value as any)} className="mt-1 w-full border rounded p-2"><option>Active</option><option>Inactive</option></select>
              </label>
              <div>
                <div className="text-text-secondary mb-1">Assignments</div>
                {(eAssignments||[]).map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <select value={row.service_id||''} onChange={e=>setEAssignments(list=>list.map((r,i)=> i===idx?{...r, service_id: e.target.value||undefined}:r))} className="border rounded p-2 flex-1">
                      <option value="">Select Course</option>
                      {services.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <input placeholder="Batch No (optional)" value={row.batch_no||''} onChange={e=>setEAssignments(list=>list.map((r,i)=> i===idx?{...r, batch_no: e.target.value}:r))} className="border rounded p-2 w-40"/>
                    <button type="button" onClick={()=>setEAssignments(list=>list.filter((_,i)=>i!==idx))} className="text-red-600">Remove</button>
                  </div>
                ))}
                <button type="button" onClick={()=>setEAssignments(list=>[...list, { service_id: undefined, batch_no: '' }])} className="text-blue-600 text-xs">+ Add Another</button>
              </div>
              <div className="text-right"><button type="submit" className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold">Save Changes</button></div>
            </div>
          </form>
        </div>
      )}
    </main>
  );
};

export default TeachersPage;

