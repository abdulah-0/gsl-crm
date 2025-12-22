import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';

import { supabase } from '../../lib/supabaseClient';

// Minimal shapes
type Teacher = { id: string; full_name: string; email: string };
type Service = { id: string; name: string };
type Assignment = { service_id?: string|null; service_name?: string|null; batch_no?: string|null };
type Student = { id: string; full_name?: string; first_name?: string; last_name?: string; program_title?: string; batch_no?: string|null; created_at?: string; status?: string };
type Material = { id?: number; title: string; description?: string; file_url?: string|null; link_url?: string|null; service_id?: string|null; batch_no?: string|null };


const TeachersPanel: React.FC = () => {
  const [role, setRole] = useState<'super'|'admin'|'teacher'|'other'|'loading'>('loading');
  const navigate = useNavigate();

  const [meEmail, setMeEmail] = useState<string>('');
  const [teacherId, setTeacherId] = useState<string>('');
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);

  // Data
  const [services, setServices] = useState<Service[]>([]);
  const [assigns, setAssigns] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & UI
  const [courseFilter, setCourseFilter] = useState('All');
  const [batchFilter, setBatchFilter] = useState('All');
  const [q, setQ] = useState('');
  const [date, setDate] = useState<string>(()=> new Date().toISOString().slice(0,10));
  const [att, setAtt] = useState<Record<string, 'Present'|'Absent'|'Late'|''>>({});
  const [showStudent, setShowStudent] = useState<Student|null>(null);

  // New material form
  const [mTitle, setMTitle] = useState('');
  const [mDesc, setMDesc] = useState('');
  const [mLink, setMLink] = useState('');
  const [mFile, setMFile] = useState<File|null>(null);
  const [mServiceId, setMServiceId] = useState('');
  const [mBatchNo, setMBatchNo] = useState('');
  const [savingMat, setSavingMat] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getUser();
      const email = sess.user?.email || '';
      setMeEmail(email);
      const { data: me } = await supabase.from('dashboard_users').select('role,full_name').eq('email', email).maybeSingle();
      const r = (me?.role || (sess.user as any)?.app_metadata?.role || (sess.user as any)?.user_metadata?.role || '').toString().toLowerCase();
      if (r.includes('super')) setRole('super');
      else if (r.includes('admin')) setRole('admin');
      else if (r.includes('teacher')) setRole('teacher');
      else setRole('other');

      // Determine teacher id
      const { data: thisTeacher } = await supabase.from('dashboard_teachers').select('*').eq('email', email).maybeSingle();
      if (thisTeacher?.id) setTeacherId(thisTeacher.id);
      // If teacher not found but the user is a teacher, auto-create a teacher profile for convenience
      if (!thisTeacher?.id && r.includes('teacher')) {
        try {
          await supabase.from('dashboard_teachers').upsert([
            { id: `TEA${Date.now().toString().slice(-8)}`, full_name: (me as any)?.full_name || (email.split('@')[0]||'').toUpperCase(), email, status: 'Active' }
          ], { onConflict: 'email' } as any);
          const { data: t2 } = await supabase.from('dashboard_teachers').select('*').eq('email', email).maybeSingle();
          if (t2?.id) setTeacherId(t2.id);
        } catch (e) { console.warn('auto-create teacher profile failed', e); }
      }

      if (r.includes('super') || r.includes('admin')) {
        const { data: list } = await supabase.from('dashboard_teachers').select('id,full_name,email').order('full_name');
        setAllTeachers((list||[]) as any);
        if (!thisTeacher?.id && list && list.length) setTeacherId(list[0].id);
      }
    })();
  }, []);

  useEffect(() => { if (teacherId) loadAll(); }, [teacherId, date]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: svcs }, { data: asg }, { data: allSt }, { data: mats }, { data: attRows }] = await Promise.all([
      supabase.from('dashboard_services').select('id,name').order('name'),
      supabase.from('dashboard_teacher_assignments').select('*').eq('teacher_id', teacherId),
      supabase.from('dashboard_students').select('*'),
      supabase.from('dashboard_study_materials').select('*').eq('teacher_id', teacherId),
      supabase.from('dashboard_attendance').select('student_id,status').eq('teacher_id', teacherId).eq('attendance_date', date)
    ]);
    setServices((svcs||[]) as any);
    setAssigns((asg||[]) as any);

    const svcById: Record<string,string> = {}; (svcs||[]).forEach((s:any)=> svcById[s.id]=s.name);
    const progNames = (asg||[]).map((a:any)=> a.service_id ? svcById[a.service_id] : (a.service_name||'')).filter(Boolean);
    const matched = (allSt||[]).filter((st:any) => {
      const program = (st.program_title||'').toString();
      const okProg = progNames.includes(program);
      if (!okProg) return false;
      const relevantAssigns = (asg||[]).filter((a:any)=> (a.service_id? svcById[a.service_id] : (a.service_name||''))===program);
      if (relevantAssigns.some((a:any)=> !a.batch_no)) return true;
      return relevantAssigns.some((a:any)=> (a.batch_no||'') === (st.batch_no||''));
    });
    setStudents(matched);

    setMaterials((mats||[]) as any);
    const map: Record<string,'Present'|'Absent'|'Late'|''> = {}; (attRows||[]).forEach((a:any)=>{ map[a.student_id]=a.status;}); setAtt(map);
    setLoading(false);
  };

  const allCourses = useMemo(() => {
    const svcById: Record<string,string> = {}; services.forEach(s=>svcById[s.id]=s.name);
    return Array.from(new Set(assigns.map(a=> a.service_id ? (svcById[a.service_id]||'') : (a.service_name||'')))).filter(Boolean);
  }, [assigns, services]);

  const allBatches = useMemo(() => Array.from(new Set(assigns.map(a=> a.batch_no||''))).filter(Boolean), [assigns]);

  const visibleStudents = useMemo(() => {
    const term = q.toLowerCase();
    return students.filter(st => {
      const full = (st.full_name || `${st.first_name||''} ${st.last_name||''}`).trim();
      const prog = st.program_title||'';
      const batch = st.batch_no||'';
      if (courseFilter!=='All' && prog !== courseFilter) return false;
      if (batchFilter!=='All' && batch !== batchFilter) return false;
      if (term && !(`${full} ${prog} ${batch}`.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [students, q, courseFilter, batchFilter]);

  const saveAttendance = async () => {
    if (!teacherId) return;
    const rows = visibleStudents.map(st => ({ teacher_id: teacherId, student_id: st.id, attendance_date: date, status: att[st.id] || 'Absent' }));
    if (rows.length===0) return;
    await supabase.from('dashboard_attendance').upsert(rows, { onConflict: 'teacher_id,student_id,attendance_date' } as any);
    alert('Attendance saved');
  };

  const addMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !mTitle) return;
    setSavingMat(true);
    try {
      let file_url: string | null = null;
      if (mFile) {
        const path = `${teacherId}/${Date.now()}_${mFile.name}`;
        const { data: up, error } = await supabase.storage.from('materials').upload(path, mFile);
        if (!error && up) {
          const { data: pub } = supabase.storage.from('materials').getPublicUrl(up.path);
          file_url = pub?.publicUrl || null;
        }
      }
      await supabase.from('dashboard_study_materials').insert([{ teacher_id: teacherId, service_id: mServiceId||null, batch_no: mBatchNo||null, title: mTitle, description: mDesc||null, file_url, link_url: mLink||null }]);
      setMTitle(''); setMDesc(''); setMLink(''); setMFile(null); setMServiceId(''); setMBatchNo('');
      const { data: mats } = await supabase.from('dashboard_study_materials').select('*').eq('teacher_id', teacherId);
      setMaterials((mats||[]) as any);
    } finally { setSavingMat(false); }
  };

  const removeMaterial = async (id: number) => {
    if (!confirm('Remove material?')) return;
    await supabase.from('dashboard_study_materials').delete().eq('id', id);
    const { data: mats } = await supabase.from('dashboard_study_materials').select('*').eq('teacher_id', teacherId);
    setMaterials((mats||[]) as any);
  };

  const studentAttendanceSummary = async (studentId: string) => {
    const { data } = await supabase.from('dashboard_attendance').select('status').eq('teacher_id', teacherId).eq('student_id', studentId);
    const total = (data||[]).length; const present = (data||[]).filter((r:any)=>r.status==='Present').length;
    return { total, present, pct: total? Math.round((present/total)*100) : 0 };
  };

  const [remarkText, setRemarkText] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, { note: string; created_at: string }[]>>({});
  const loadRemarks = async () => {
    const { data } = await supabase.from('dashboard_student_remarks').select('student_id,note,created_at').eq('teacher_id', teacherId).order('created_at', { ascending: false });
    const rem: Record<string, { note: string; created_at: string }[]> = {};
    (data||[]).forEach((r:any)=> { if (!rem[r.student_id]) rem[r.student_id]=[]; rem[r.student_id].push({ note: r.note, created_at: r.created_at }); });
    setRemarks(rem);
  };
  useEffect(()=>{ if (teacherId) loadRemarks(); }, [teacherId]);

  const addRemark = async (studentId: string) => {
    const text = (remarkText[studentId]||'').trim();
    if (!text || !teacherId) return;
    await supabase.from('dashboard_student_remarks').insert([{ teacher_id: teacherId, student_id: studentId, note: text }]);
    setRemarkText(prev => ({ ...prev, [studentId]: '' }));
    await loadRemarks();
  };

  const assignedCounts = useMemo(() => {
    const svcById: Record<string,string> = {}; services.forEach(s=>svcById[s.id]=s.name);
    const byKey: Record<string, { course: string; batch: string; students: number; materials: number; }> = {};
    const studentsByKey: Record<string, number> = {};
    students.forEach(st => { const key = `${st.program_title||''}||${st.batch_no||''}`; studentsByKey[key] = (studentsByKey[key]||0)+1; });
    materials.forEach(m => { const course = m.service_id ? (svcById[m.service_id]||'') : ''; const key = `${course}||${m.batch_no||''}`; byKey[key] = byKey[key]||{ course, batch: m.batch_no||'', students: studentsByKey[key]||0, materials:0 }; byKey[key].materials += 1; });
    Object.keys(studentsByKey).forEach(key => { byKey[key] = byKey[key]||{ course: key.split('||')[0], batch: key.split('||')[1], students: studentsByKey[key], materials: byKey[key]?.materials||0 }; });
    return Object.values(byKey);
  }, [students, materials, services]);

  const totals = useMemo(() => ({ totalStudents: students.length, totalBatches: assignedCounts.length }), [students, assignedCounts]);

  const canSwitchTeacher = role==='super' || role==='admin';

  return (
    <main className="w-full min-h-screen bg-background-main flex">
      <Helmet><title>Teachers | GSL Pakistan CRM</title></Helmet>
      <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
      <div className="flex-1 flex flex-col">
        <Header />

        {/* Summary widgets */}
        <div className="px-4 sm:px-6 lg:px-8 mt-6">
          <div className="bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a] flex flex-wrap items-center gap-4 justify-between">
            <div className="font-bold">Teacher Panel</div>
            {canSwitchTeacher && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-text-secondary">View as</span>
                <select value={teacherId} onChange={e=>setTeacherId(e.target.value)} className="border rounded p-2">
                  {allTeachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-center gap-4 text-sm">
              <div>Total Students: <span className="font-bold">{totals.totalStudents}</span></div>
              <div>Total Batches: <span className="font-bold">{totals.totalBatches}</span></div>
              <div>Attendance Today: <span className="font-bold">{Object.values(att).filter(s=>s==='Present').length}</span></div>
              <div>Materials Uploaded: <span className="font-bold">{materials.length}</span></div>
            </div>
            {teacherId && (
              <button onClick={()=>navigate(`/teachers/${teacherId}`)} className="px-3 py-2 rounded bg-[#ffa332] text-white font-bold">
                Assign Students
              </button>
            )}

          </div>
        </div>

        {/* Assigned Students & Attendance */}
        <section className="px-4 sm:px-6 lg:px-8 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Assigned Students</h2>
              <div className="flex items-center gap-2 text-sm">
                <input placeholder="Search" value={q} onChange={e=>setQ(e.target.value)} className="border rounded p-2" />
                <select value={courseFilter} onChange={e=>setCourseFilter(e.target.value)} className="border rounded p-2"><option>All</option>{allCourses.map(c=><option key={c}>{c}</option>)}</select>
                <select value={batchFilter} onChange={e=>setBatchFilter(e.target.value)} className="border rounded p-2"><option>All</option>{allBatches.map(b=><option key={b}>{b}</option>)}</select>
              </div>
            </div>
            <div className="mt-3 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-text-secondary border-b">
                    <th className="py-2 pr-4">Student</th>
                    <th className="py-2 pr-4">Batch / Course</th>
                    <th className="py-2 pr-4">Enrollment Date</th>
                    <th className="py-2 pr-4">Attendance %</th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (<tr><td colSpan={5} className="py-4 text-center text-text-secondary">Loading...</td></tr>)}
                  {!loading && visibleStudents.map(st => (
                    <tr key={st.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={()=>setShowStudent(st)}>
                      <td className="py-2 pr-4 font-semibold">{st.full_name || `${st.first_name||''} ${st.last_name||''}`.trim()}</td>
                      <td className="py-2 pr-4">{st.program_title||''}{st.batch_no?` (${st.batch_no})`:''}</td>
                      <td className="py-2 pr-4">{st.created_at ? new Date(st.created_at).toLocaleDateString() : '-'}</td>
                      <td className="py-2 pr-4">{/* computed async in detail */}-</td>
                      <td className="py-2 pr-4">{st.status||'Active'}</td>
                    </tr>
                  ))}
                  {!loading && visibleStudents.length===0 && (<tr><td colSpan={5} className="py-4 text-center text-text-secondary">No students found</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>

          {/* Attendance panel */}
          <div className="bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Attendance</h2>
              <label className="text-sm flex items-center gap-2">Date <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border rounded p-1"/></label>
            </div>
            <div className="mt-3 max-h-80 overflow-auto">
              {visibleStudents.map(st => (
                <div key={st.id} className="flex items-center justify-between py-2 border-b">
                  <div className="font-medium mr-2 truncate">{st.full_name || `${st.first_name||''} ${st.last_name||''}`.trim()}</div>
                  <div className="flex items-center gap-3 text-sm">
                    {(['Present','Absent','Late'] as const).map(opt => (
                      <label key={opt} className="flex items-center gap-1">
                        <input type="radio" name={`att-${st.id}`} checked={(att[st.id]||'')===opt} onChange={()=>setAtt(prev=>({ ...prev, [st.id]: opt }))} /> {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-right mt-3"><button onClick={saveAttendance} className="px-3 py-2 rounded bg-[#ffa332] text-white font-bold">Save Attendance</button></div>
          </div>
        </section>

        {/* Materials & Batch Overview */}
        <section className="px-4 sm:px-6 lg:px-8 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a] lg:col-span-2">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Study Materials</h2></div>
            <form onSubmit={addMaterial} className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <label><span className="text-text-secondary">Title</span><input value={mTitle} onChange={e=>setMTitle(e.target.value)} className="mt-1 w-full border rounded p-2" required/></label>
              <label><span className="text-text-secondary">Description</span><input value={mDesc} onChange={e=>setMDesc(e.target.value)} className="mt-1 w-full border rounded p-2"/></label>
              <label><span className="text-text-secondary">Course</span>
                <select value={mServiceId} onChange={e=>setMServiceId(e.target.value)} className="mt-1 w-full border rounded p-2"><option value="">Select Course</option>{services.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              </label>
              <label><span className="text-text-secondary">Batch No (optional)</span><input value={mBatchNo} onChange={e=>setMBatchNo(e.target.value)} className="mt-1 w-full border rounded p-2"/></label>
              <label><span className="text-text-secondary">File</span><input type="file" onChange={e=>setMFile((e.target.files&&e.target.files[0])||null)} className="mt-1 w-full border rounded p-2"/></label>
              <label><span className="text-text-secondary">Link (optional)</span><input value={mLink} onChange={e=>setMLink(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="https://..."/></label>
              <div className="md:col-span-2 text-right"><button disabled={savingMat} type="submit" className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold">Add Material</button></div>
            </form>

            <div className="mt-4">
              <div className="text-sm text-text-secondary mb-2">Uploaded</div>
              <div className="divide-y">
                {materials.map((m:any) => (
                  <div key={m.id} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{m.title}</div>
                      <div className="text-xs text-text-secondary">{m.description||''}</div>
                      <div className="text-xs text-text-secondary">{m.file_url ? <a className="text-blue-600" href={m.file_url} target="_blank" rel="noreferrer">File</a> : null} {m.link_url ? <a className="text-blue-600 ml-2" href={m.link_url} target="_blank" rel="noreferrer">Link</a> : null}</div>
                    </div>
                    <button onClick={()=>removeMaterial(m.id)} className="text-red-600 text-sm">Delete</button>
                  </div>
                ))}
                {materials.length===0 && (<div className="text-sm text-text-secondary">No materials uploaded yet</div>)}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a]">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Batch Overview</h2></div>
            <div className="mt-3 text-sm divide-y">
              {assignedCounts.map((b,idx)=> (
                <div key={idx} className="py-2">
                  <div className="font-semibold">{b.course || '(Course)'}{b.batch?` (${b.batch})`:''}</div>
                  <div className="text-text-secondary">Students: {b.students} • Materials: {b.materials}</div>
                </div>
              ))}
              {assignedCounts.length===0 && (<div className="text-text-secondary">No batches assigned</div>)}
            </div>
          </div>
        </section>
      </div>

      {/* Student Detail Panel */}
      {showStudent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-4xl rounded-xl p-5 shadow-xl max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">Student Detail</h3><button onClick={()=>setShowStudent(null)} className="text-text-secondary">\u2715</button></div>
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-5 text-sm">
              <div>
                <div className="font-semibold mb-1">Personal Information</div>
                <div className="border rounded p-3">Name: {showStudent.full_name || `${showStudent.first_name||''} ${showStudent.last_name||''}`.trim()}<br/>Email: {(showStudent as any).email || '-'}<br/>Batch/Course: {showStudent.program_title||''}{showStudent.batch_no?` (${showStudent.batch_no})`:''}</div>
                <div className="font-semibold my-2">Attendance History</div>
                <AttendanceHistory teacherId={teacherId} studentId={showStudent.id} />
              </div>
              <div>
                <div className="font-semibold mb-1">Uploaded Documents</div>
                <div className="border rounded p-3 text-text-secondary">—</div>
                <div className="font-semibold my-2">Teacher Remarks</div>
                <div className="border rounded p-3 max-h-48 overflow-auto">
                  {(remarks[showStudent.id]||[]).map((r,i)=> (
                    <div key={i} className="mb-2"><div className="font-medium">{new Date(r.created_at).toLocaleString()}</div><div>{r.note}</div></div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input placeholder="Add remark" value={remarkText[showStudent.id]||''} onChange={e=>setRemarkText(prev=>({...prev, [showStudent.id]: e.target.value}))} className="border rounded p-2 flex-1"/>
                  <button onClick={()=>addRemark(showStudent.id)} className="px-3 py-2 rounded bg-gray-800 text-white">Add</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

const AttendanceHistory: React.FC<{ teacherId: string; studentId: string }> = ({ teacherId, studentId }) => {
  const [rows, setRows] = useState<{ attendance_date: string; status: string }[]>([]);
  useEffect(()=>{ (async ()=>{ const { data } = await supabase.from('dashboard_attendance').select('attendance_date,status').eq('teacher_id', teacherId).eq('student_id', studentId).order('attendance_date', { ascending: false }); setRows((data||[]) as any); })(); }, [teacherId, studentId]);
  return (
    <div className="border rounded p-3 max-h-48 overflow-auto text-sm">
      {rows.map((r,i)=>(<div key={i} className="flex items-center justify-between border-b py-1"><div>{new Date(r.attendance_date).toLocaleDateString()}</div><div className="font-semibold">{r.status}</div></div>))}
      {rows.length===0 && (<div className="text-text-secondary">No attendance yet</div>)}
    </div>
  );
};

export default TeachersPanel;

