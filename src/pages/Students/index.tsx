import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';

// Types
type Student = {
  id: string; // STxxxxxxxx
  program_title: string;
  batch_no: string;
  full_name: string;
  father_name: string;
  phone: string;
  email: string;
  cnic: string;
  dob: string;
  city: string;
  reference?: string;
  status: 'Active' | 'Completed' | 'Withdrawn';
  photo_url?: string;
  archived?: boolean;
  created_at?: string;
};

type Academic = { id?: number; student_id: string; serial: number; degree_name: string; grade: string; year: string; institute: string };
type Experience = { id?: number; student_id: string; serial: number; org: string; designation: string; period: string };

const defaultStudent: Omit<Student, 'id'> = {
  program_title: '',
  batch_no: '',
  full_name: '',
  father_name: '',
  phone: '',
  email: '',
  cnic: '',
  dob: '',
  city: '',
  reference: '',
  status: 'Active',
  photo_url: '',
  archived: false,
};

const StudentsPage: React.FC = () => {
  const [tab, setTab] = useState<'add' | 'list'>('add');

  // Add form state
  const [s, setS] = useState(defaultStudent);
  const [academics, setAcademics] = useState<Academic[]>([{ student_id: '', serial: 1, degree_name: '', grade: '', year: '', institute: '' }]);
  const [experiences, setExperiences] = useState<Experience[]>([{ student_id: '', serial: 1, org: '', designation: '', period: '' }]);
  const [agreeAll, setAgreeAll] = useState(false);
  const [declTextAgree, setDeclTextAgree] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // List state
  const [items, setItems] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [fProgram, setFProgram] = useState('All');
  const [fBatch, setFBatch] = useState('All');
  const [fCity, setFCity] = useState('All');
  const [fStatus, setFStatus] = useState('All');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [editItem, setEditItem] = useState<Student | null>(null);

  const resetForm = () => {
    setS(defaultStudent);
    setAcademics([{ student_id: '', serial: 1, degree_name: '', grade: '', year: '', institute: '' }]);
    setExperiences([{ student_id: '', serial: 1, org: '', designation: '', period: '' }]);
    setAgreeAll(false);
    setDeclTextAgree(false);
    setPhotoFile(null);
  };

  const validateForm = (): string | null => {
    if (!s.program_title) return 'Program Title is required';
    if (!s.batch_no) return 'Batch No. is required';
    if (!s.full_name || s.full_name !== s.full_name.toUpperCase()) return 'Full Name must be in CAPITAL letters';
    if (!s.father_name) return 'Father/Guardian Name is required';
    if (!/^\+?[0-9]{10,15}$/.test(s.phone)) return 'Invalid phone number format';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) return 'Invalid email format';
    if (!/^[0-9]{13}$/.test(s.cnic)) return 'CNIC must be 13 digits';
    if (!s.dob) return 'Date of Birth is required';
    if (!s.city) return 'City is required';
    if (!agreeAll) return 'You must agree to Terms & Conditions';
    if (!declTextAgree) return 'You must accept the Declaration';
    return null;
  };

  const onAddAcademic = () => setAcademics(prev => [...prev, { student_id: '', serial: prev.length + 1, degree_name: '', grade: '', year: '', institute: '' }]);
  const onAddExperience = () => setExperiences(prev => [...prev, { student_id: '', serial: prev.length + 1, org: '', designation: '', period: '' }]);
  const onRemoveAcademic = (i: number) => setAcademics(prev => prev.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, serial: idx + 1 })));
  const onRemoveExperience = (i: number) => setExperiences(prev => prev.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, serial: idx + 1 })));

  const fileUrl = (path: string) => supabase.storage.from('attachments').getPublicUrl(path).data.publicUrl;

  const submitStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateForm();
    if (err) { alert(err); return; }
    setSaving(true);
    try {
      const id = `ST${Date.now().toString().slice(-8)}`;
      let photo_url: string | undefined = undefined;
      if (photoFile) {
        const path = `students/${id}/photo_${Date.now()}_${photoFile.name}`;
        await supabase.storage.from('attachments').upload(path, photoFile);
        photo_url = fileUrl(path);
      }
      const payload = { id, program_title: s.program_title, batch_no: s.batch_no, full_name: s.full_name, father_name: s.father_name, phone: s.phone, email: s.email, cnic: s.cnic, dob: s.dob, city: s.city, reference: s.reference || null, status: s.status, photo_url, archived: false };
      const { error: e1 } = await supabase.from('dashboard_students').insert([payload]);
      if (e1) throw e1;
      if (academics.length) {
        const acadRows = academics.map(a => ({ student_id: id, serial: a.serial, degree_name: a.degree_name, grade: a.grade, year: a.year, institute: a.institute }));
        await supabase.from('dashboard_student_academics').insert(acadRows);
      }
      if (experiences.length) {
        const expRows = experiences.map(w => ({ student_id: id, serial: w.serial, org: w.org, designation: w.designation, period: w.period }));
        await supabase.from('dashboard_student_experiences').insert(expRows);
      }
      resetForm();
      setTab('list');
      await loadList();
      alert('Student added successfully');
    } catch (err: any) {
      alert(`Failed to save student: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  // List loading
  const loadList = useCallback(async () => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase.from('dashboard_students').select('*', { count: 'exact' }).eq('archived', false);
    if (search) {
      // search by name, cnic, program, batch
      query = query.or(`full_name.ilike.%${search}%,cnic.ilike.%${search}%,program_title.ilike.%${search}%,batch_no.ilike.%${search}%`);
    }
    if (fProgram !== 'All') query = query.eq('program_title', fProgram);
    if (fBatch !== 'All') query = query.eq('batch_no', fBatch);
    if (fCity !== 'All') query = query.eq('city', fCity);
    if (fStatus !== 'All') query = query.eq('status', fStatus);
    const { data, count } = await query.order('created_at', { ascending: false }).range(from, to);
    setItems((data as any as Student[]) || []);
    setTotal(count || 0);
  }, [page, search, fProgram, fBatch, fCity, fStatus]);

  useEffect(() => { loadList(); }, [loadList]);

  // Distincts for filters
  const programs = useMemo(() => Array.from(new Set(items.map(i => i.program_title))).filter(Boolean), [items]);
  const batches = useMemo(() => Array.from(new Set(items.map(i => i.batch_no))).filter(Boolean), [items]);
  const cities = useMemo(() => Array.from(new Set(items.map(i => i.city))).filter(Boolean), [items]);

  const archiveStudent = async (id: string) => {
    if (!confirm('Archive this student?')) return;
    await supabase.from('dashboard_students').update({ archived: true }).eq('id', id);
    await loadList();
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    const { id, full_name, father_name, phone, email, cnic, dob, city, reference, status, program_title, batch_no } = editItem;
    await supabase.from('dashboard_students').update({ full_name, father_name, phone, email, cnic, dob, city, reference, status, program_title, batch_no }).eq('id', id);
    setEditItem(null);
    await loadList();
  };

  return (
    <main className="w-full min-h-screen bg-background-main flex">
      <Helmet><title>Students | GSL Pakistan CRM</title></Helmet>
      <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar/></div>
      <div className="flex-1 flex flex-col">
        <Header />

        <section className="px-4 sm:px-6 lg:px-8 mt-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Students</h1>
            <div className="bg-white rounded-full p-1 shadow flex">
              <button onClick={()=>setTab('add')} className={`px-4 py-2 rounded-full text-sm font-semibold ${tab==='add'?'bg-[#ffa332] text-white':'text-text-secondary'}`}>Add New Student</button>
              <button onClick={()=>setTab('list')} className={`px-4 py-2 rounded-full text-sm font-semibold ${tab==='list'?'bg-[#ffa332] text-white':'text-text-secondary'}`}>Currently Enrolled</button>
            </div>
          </div>

          {tab==='add' && (
            <form onSubmit={submitStudent} className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a]">
                <h3 className="font-bold text-lg">Program Information</h3>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-sm"><span className="text-text-secondary">Program Title</span><input value={s.program_title} onChange={e=>setS({...s, program_title:e.target.value})} className="mt-1 w-full border rounded p-2" required/></label>
                  <label className="text-sm"><span className="text-text-secondary">Batch No.</span><input value={s.batch_no} onChange={e=>setS({...s, batch_no:e.target.value})} className="mt-1 w-full border rounded p-2" placeholder="e.g., 2025-01" required/></label>
                </div>

                <h3 className="mt-6 font-bold text-lg">Personal Details</h3>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-sm sm:col-span-2"><span className="text-text-secondary">Full Name (CAPITAL)</span><input value={s.full_name} onChange={e=>setS({...s, full_name:e.target.value.toUpperCase()})} className="mt-1 w-full border rounded p-2" required/></label>
                  <label className="text-sm sm:col-span-2"><span className="text-text-secondary">Father/Guardian Name</span><input value={s.father_name} onChange={e=>setS({...s, father_name:e.target.value})} className="mt-1 w-full border rounded p-2" required/></label>
                  <label className="text-sm"><span className="text-text-secondary">Phone</span><input value={s.phone} onChange={e=>setS({...s, phone:e.target.value})} className="mt-1 w-full border rounded p-2" required/></label>
                  <label className="text-sm"><span className="text-text-secondary">Email</span><input type="email" value={s.email} onChange={e=>setS({...s, email:e.target.value})} className="mt-1 w-full border rounded p-2" required/></label>
                  <label className="text-sm"><span className="text-text-secondary">CNIC No.</span><input value={s.cnic} onChange={e=>setS({...s, cnic:e.target.value.replace(/[^0-9]/g,'')})} className="mt-1 w-full border rounded p-2" placeholder="13 digits" required/></label>
                  <label className="text-sm"><span className="text-text-secondary">Date of Birth</span><input type="date" value={s.dob} onChange={e=>setS({...s, dob:e.target.value})} className="mt-1 w-full border rounded p-2" required/></label>
                  <label className="text-sm"><span className="text-text-secondary">City</span><input value={s.city} onChange={e=>setS({...s, city:e.target.value})} className="mt-1 w-full border rounded p-2" required/></label>
                  <label className="text-sm"><span className="text-text-secondary">Reference (optional)</span><input value={s.reference} onChange={e=>setS({...s, reference:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
                </div>

                <h3 className="mt-6 font-bold text-lg">Academic Background</h3>
                <div className="mt-3 space-y-3">
                  {academics.map((a, i) => (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
                      <div>
                        <div className="text-xs text-text-secondary">S. No</div>
                        <input readOnly value={i+1} className="w-full border rounded p-2" />
                      </div>
                      <label className="text-sm"><span className="text-text-secondary">Degree Name</span><input value={a.degree_name} onChange={e=>{
                        const v=e.target.value; setAcademics(p=>p.map((r,idx)=>idx===i?{...r, degree_name:v}:r));
                      }} className="mt-1 w-full border rounded p-2" required/></label>
                      <label className="text-sm"><span className="text-text-secondary">Grade</span><input value={a.grade} onChange={e=>{
                        const v=e.target.value; setAcademics(p=>p.map((r,idx)=>idx===i?{...r, grade:v}:r));
                      }} className="mt-1 w-full border rounded p-2" required/></label>
                      <label className="text-sm"><span className="text-text-secondary">Year</span><input value={a.year} onChange={e=>{
                        const v=e.target.value; setAcademics(p=>p.map((r,idx)=>idx===i?{...r, year:v}:r));
                      }} className="mt-1 w-full border rounded p-2" required/></label>
                      <label className="text-sm"><span className="text-text-secondary">Institute/University</span><input value={a.institute} onChange={e=>{
                        const v=e.target.value; setAcademics(p=>p.map((r,idx)=>idx===i?{...r, institute:v}:r));
                      }} className="mt-1 w-full border rounded p-2" required/></label>
                      {i>0 && <button type="button" onClick={()=>onRemoveAcademic(i)} className="text-xs text-red-600">Remove</button>}
                    </div>
                  ))}
                  <button type="button" onClick={onAddAcademic} className="px-3 py-2 rounded bg-gray-100 text-sm font-semibold">+ Add Row</button>
                </div>

                <h3 className="mt-6 font-bold text-lg">Professional Detail / Work Experience</h3>
                <div className="mt-3 space-y-3">
                  {experiences.map((w, i) => (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                      <div>
                        <div className="text-xs text-text-secondary">S. No</div>
                        <input readOnly value={i+1} className="w-full border rounded p-2" />
                      </div>
                      <label className="text-sm"><span className="text-text-secondary">Name of Organization</span><input value={w.org} onChange={e=>{ const v=e.target.value; setExperiences(p=>p.map((r,idx)=>idx===i?{...r, org:v}:r)); }} className="mt-1 w-full border rounded p-2"/></label>
                      <label className="text-sm"><span className="text-text-secondary">Designation</span><input value={w.designation} onChange={e=>{ const v=e.target.value; setExperiences(p=>p.map((r,idx)=>idx===i?{...r, designation:v}:r)); }} className="mt-1 w-full border rounded p-2"/></label>
                      <label className="text-sm"><span className="text-text-secondary">Period</span><input value={w.period} onChange={e=>{ const v=e.target.value; setExperiences(p=>p.map((r,idx)=>idx===i?{...r, period:v}:r)); }} className="mt-1 w-full border rounded p-2"/></label>
                      {i>0 && <button type="button" onClick={()=>onRemoveExperience(i)} className="text-xs text-red-600">Remove</button>}
                    </div>
                  ))}
                  <button type="button" onClick={onAddExperience} className="px-3 py-2 rounded bg-gray-100 text-sm font-semibold">+ Add Row</button>
                </div>

                <h3 className="mt-6 font-bold text-lg">Terms & Conditions</h3>
                <div className="mt-2 space-y-2 text-sm">
                  {[
                    'Institute reserves the right to change the date or schedule.',
                    'Permission for recording/exposure in front of the camera.',
                    'Attendance must be 90%.',
                    'Course fee payable before classes commence.',
                    'Registration fee Rs. 1000.',
                    'Tuition fee is non-refundable.',
                  ].map((t, i)=> (
                    <label key={i} className="flex items-start gap-2"><input type="checkbox" checked={agreeAll} onChange={(e)=>setAgreeAll(e.target.checked)} className="mt-1"/><span>{t}</span></label>
                  ))}
                </div>

                <h3 className="mt-6 font-bold text-lg">Declaration</h3>
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={declTextAgree} onChange={(e)=>setDeclTextAgree(e.target.checked)} className="mt-1"/><span>I declare that I have read and agree with the above rules and regulations. I affirm that the above information is correct to the best of my knowledge. If I violate rules, the institute reserves the right to expel me.</span></label>

                <div className="mt-6 text-right">
                  <button type="submit" disabled={saving} className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold disabled:opacity-60">{saving?'Saving...':'Submit'}</button>
                </div>
              </div>

              <aside className="bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a]">
                <h3 className="font-bold text-lg">Student Photo</h3>
                <input type="file" accept="image/*" onChange={(e)=> setPhotoFile(e.target.files?.[0] || null)} className="mt-2 text-sm" />
                {photoFile && <div className="mt-2 text-xs text-text-secondary">{photoFile.name}</div>}

                <div className="mt-6">
                  <h3 className="font-bold text-lg">Status</h3>
                  <select value={s.status} onChange={e=>setS({...s, status: e.target.value as Student['status']})} className="mt-2 w-full border rounded p-2 text-sm">
                    <option>Active</option>
                    <option>Completed</option>
                    <option>Withdrawn</option>
                  </select>
                </div>
              </aside>
            </form>
          )}

          {tab==='list' && (
            <div className="mt-6">
              <div className="flex flex-wrap items-center gap-2">
                <input placeholder="Search name, CNIC, program, batch" value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }} className="w-full sm:w-64 border rounded p-2 text-sm" />
                <select value={fProgram} onChange={e=>{ setFProgram(e.target.value); setPage(1); }} className="border rounded p-2 text-sm"><option>All</option>{programs.map(p=><option key={p}>{p}</option>)}</select>
                <select value={fBatch} onChange={e=>{ setFBatch(e.target.value); setPage(1); }} className="border rounded p-2 text-sm"><option>All</option>{batches.map(b=><option key={b}>{b}</option>)}</select>
                <select value={fCity} onChange={e=>{ setFCity(e.target.value); setPage(1); }} className="border rounded p-2 text-sm"><option>All</option>{cities.map(c=><option key={c}>{c}</option>)}</select>
                <select value={fStatus} onChange={e=>{ setFStatus(e.target.value); setPage(1); }} className="border rounded p-2 text-sm"><option>All</option><option>Active</option><option>Completed</option><option>Withdrawn</option></select>
              </div>

              <div className="mt-4 overflow-auto bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a]">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Student ID</th>
                      <th className="text-left p-2">Full Name</th>
                      <th className="text-left p-2">Program Title</th>
                      <th className="text-left p-2">Batch No.</th>
                      <th className="text-left p-2">Phone</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">City</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-right p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(st => (
                      <tr key={st.id} className="border-t">
                        <td className="p-2">{st.id}</td>
                        <td className="p-2">{st.full_name}</td>
                        <td className="p-2">{st.program_title}</td>
                        <td className="p-2">{st.batch_no}</td>
                        <td className="p-2">{st.phone}</td>
                        <td className="p-2">{st.email}</td>
                        <td className="p-2">{st.city}</td>
                        <td className="p-2">{st.status}</td>
                        <td className="p-2 text-right">
                          <button onClick={()=>setEditItem(st)} className="text-blue-600 hover:underline mr-3">Edit</button>
                          <button onClick={()=>archiveStudent(st.id)} className="text-red-600 hover:underline">Archive</button>
                        </td>
                      </tr>
                    ))}
                    {items.length===0 && (
                      <tr><td className="p-3 text-text-secondary" colSpan={9}>No students found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <div>Page {page} of {totalPages}</div>
                <div className="flex items-center gap-2">
                  <button onClick={()=> setPage(p=> Math.max(1, p-1))} className="px-3 py-1.5 border rounded" disabled={page<=1}>Prev</button>
                  <button onClick={()=> setPage(p=> Math.min(totalPages, p+1))} className="px-3 py-1.5 border rounded" disabled={page>=totalPages}>Next</button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {editItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <form onSubmit={saveEdit} className="bg-white w-full max-w-xl rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">Edit Student</h3><button type="button" onClick={()=>setEditItem(null)} className="text-text-secondary">✕</button></div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label><span className="text-text-secondary">Full Name</span><input value={editItem.full_name} onChange={e=>setEditItem({...editItem, full_name:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
              <label><span className="text-text-secondary">Father/Guardian Name</span><input value={editItem.father_name} onChange={e=>setEditItem({...editItem, father_name:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
              <label><span className="text-text-secondary">Phone</span><input value={editItem.phone} onChange={e=>setEditItem({...editItem, phone:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
              <label><span className="text-text-secondary">Email</span><input value={editItem.email} onChange={e=>setEditItem({...editItem, email:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
              <label><span className="text-text-secondary">CNIC</span><input value={editItem.cnic} onChange={e=>setEditItem({...editItem, cnic:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
              <label><span className="text-text-secondary">DOB</span><input type="date" value={editItem.dob} onChange={e=>setEditItem({...editItem, dob:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
              <label><span className="text-text-secondary">City</span><input value={editItem.city} onChange={e=>setEditItem({...editItem, city:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
              <label><span className="text-text-secondary">Reference</span><input value={editItem.reference||''} onChange={e=>setEditItem({...editItem, reference:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
              <label><span className="text-text-secondary">Program Title</span><input value={editItem.program_title} onChange={e=>setEditItem({...editItem, program_title:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
              <label><span className="text-text-secondary">Batch No.</span><input value={editItem.batch_no} onChange={e=>setEditItem({...editItem, batch_no:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
              <label><span className="text-text-secondary">Status</span><select value={editItem.status} onChange={e=>setEditItem({...editItem!, status: e.target.value as Student['status']})} className="mt-1 w-full border rounded p-2"><option>Active</option><option>Completed</option><option>Withdrawn</option></select></label>
            </div>
            <div className="mt-5 text-right"><button type="submit" className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold">Save</button></div>
          </form>
        </div>
      )}
    </main>
  );
};

export default StudentsPage;

