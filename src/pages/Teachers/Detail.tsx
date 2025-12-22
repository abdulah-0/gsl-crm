import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

// Local error boundary to prevent blank screens if something throws during render
class DetailErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: any }> {
  constructor(props: any){ super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: any){ return { error }; }
  componentDidCatch(error: any, info: any){ console.error('TeacherDetail render crashed', error, info); }
  render(){ if (this.state.error){ return (<main className="w-full min-h-screen bg-background-main flex"><div className="flex-1 flex items-center justify-center p-6"><div className="bg-white rounded-xl p-4 shadow">Something went wrong loading this page. Please reload.</div></div></main>); } return this.props.children as any; }
}


interface Teacher { id: string; full_name: string; email: string; }
interface Service { id: string; name: string; }
interface Assignment { service_id?: string|null; service_name?: string|null; batch_no?: string|null; }
interface Student { id: string; full_name?: string; first_name?: string; last_name?: string; program_title?: string; batch_no?: string|null; email?: string; }

const TeacherDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState<Teacher|null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [assignStudentId, setAssignStudentId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string>('');

  // Attendance state
  const [date, setDate] = useState<string>(()=> new Date().toISOString().slice(0,10));
  const [attendance, setAttendance] = useState<Record<string, 'Present'|'Absent'|'Late'|''>>({});

  // Remarks state (per student)
  const [remarkText, setRemarkText] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, { note: string; created_at: string }[]>>({});

  const [batchFilter, setBatchFilter] = useState<string>('All');

  // If route param is missing, show a friendly message instead of rendering nothing
  if (!id) {
    return (
      <main className="w-full min-h-screen bg-background-main flex">
        <Helmet><title>Teacher Detail | GSL Pakistan CRM</title></Helmet>
        <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
        <div className="flex-1 flex flex-col">
          <Header />
          <div className="p-6"><div className="bg-white rounded-xl p-4">Invalid teacher link. Please go back to Teachers and try again.</div></div>
        </div>
      </main>
    );
  }

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: t, error: tErr } = await supabase.from('dashboard_teachers').select('*').eq('id', id).maybeSingle();
      if (tErr) throw tErr;
      if (!t) { setFatalError('Teacher not found'); return; }
      setTeacher((t as any) || null);

      const [{ data: svcs }, { data: assigns }] = await Promise.all([
        supabase.from('dashboard_services').select('id,name'),
        supabase.from('dashboard_teacher_assignments').select('*').eq('teacher_id', id)
      ]);
      setServices((svcs||[]) as any);
      setAssignments((assigns||[]) as any);

      // Build student list by matching program_title to assigned service name, and batch if present
      const svcById: Record<string,string> = {};
      (svcs||[]).forEach((s:any)=>{ svcById[s.id]=s.name; });
      const progNames = (assigns||[]).map((a:any)=> a.service_id ? svcById[a.service_id] : (a.service_name||'')).filter(Boolean);

      // Fetch students that match any of the program names; filtering by batch_no if provided
      const { data: allSt } = await supabase.from('dashboard_students').select('*');
      setAllStudents((allSt||[]) as any);
      // explicit mappings
      const { data: mapped } = await supabase.from('dashboard_teacher_student').select('student_id').eq('teacher_id', id);
      const mapIds: string[] = (mapped||[]).map((m:any)=> m.student_id);
      setAssignedIds(mapIds);
      const matched = (allSt||[]).filter((st:any) => {
        const program = (st.program_title||'').toString();
        const okProg = progNames.includes(program);
        if (!okProg) return false;
        // If any assignment has batch_no, accept if matches any batch for that program
        const relevantAssigns = (assigns||[]).filter((a:any)=> (a.service_id? svcById[a.service_id] : (a.service_name||''))===program);
        if (relevantAssigns.some((a:any)=> !a.batch_no)) return true;
        return relevantAssigns.some((a:any)=> (a.batch_no||'') === (st.batch_no||''));
      });
      const extras = (allSt||[]).filter((st:any)=> mapIds.includes(st.id) && !matched.some((m:any)=> m.id===st.id));
      setStudents([...(matched as any), ...extras]);

      // Load existing attendance for the date
      const { data: att } = await supabase.from('dashboard_attendance')
        .select('student_id,status')
        .eq('teacher_id', id)
        .eq('attendance_date', date);
      const map: Record<string, 'Present'|'Absent'|'Late'|''> = {};
      (att||[]).forEach((a:any) => { map[a.student_id] = a.status; });
      setAttendance(map);

      // Load recent remarks per student
      const { data: rmk } = await supabase.from('dashboard_student_remarks')
        .select('student_id,note,created_at')
        .eq('teacher_id', id)
        .order('created_at', { ascending: false });
      const rem: Record<string, { note: string; created_at: string }[]> = {};
      (rmk||[]).forEach((r:any)=> { if (!rem[r.student_id]) rem[r.student_id]=[]; rem[r.student_id].push({ note: r.note, created_at: r.created_at }); });
      setRemarks(rem);
    } catch (e) {
      console.error('Teacher detail load failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { // reload attendance when date changes
    (async () => {
      if (!id) return;
      const { data: att } = await supabase.from('dashboard_attendance')
        .select('student_id,status')
        .eq('teacher_id', id)
        .eq('attendance_date', date);
      const map: Record<string, 'Present'|'Absent'|'Late'|''> = {};
      (att||[]).forEach((a:any) => { map[a.student_id] = a.status; });
      setAttendance(map);
    })();
  }, [date, id]);

  const filteredStudents = useMemo(() => {
    if (batchFilter==='All') return students;
    return students.filter(s => (s.batch_no||'') === batchFilter);
  }, [students, batchFilter]);

  const uniqueBatches = useMemo(() => Array.from(new Set(students.map(s=>s.batch_no||''))).filter(Boolean), [students]);

  const assignableStudents = useMemo(() => {
    const currentIds = new Set(students.map(s=>s.id));
    return (allStudents||[])
      .filter((s:any)=> (s.status||'Active')==='Active' && !s.archived)
      .filter((s:any)=> !currentIds.has(s.id))
      .map((s:any)=> ({ id: s.id, name: s.full_name || `${s.first_name||''} ${s.last_name||''}`.trim(), label: `${s.full_name || `${s.first_name||''} ${s.last_name||''}`.trim()} — ${s.program_title||''}${s.batch_no?` (${s.batch_no})`:''}` }));
  }, [students, allStudents]);

  const assignStudent = async () => {
    if (!id || !assignStudentId) return;
    setAssigning(true);
    try {
      await supabase.from('dashboard_teacher_student').insert([{ teacher_id: id, student_id: assignStudentId }]);
      setAssignStudentId('');
      await load();
    } catch (e:any) {
      alert(e.message||String(e));
    } finally { setAssigning(false); }
  };

  const unassignStudent = async (studentId: string) => {
    if (!id) return;
    try { await supabase.from('dashboard_teacher_student').delete().eq('teacher_id', id).eq('student_id', studentId); await load(); } catch {}
  };

  const saveAttendance = async () => {
    if (!id) return;
    const rows = filteredStudents.map(st => ({ teacher_id: id, student_id: st.id, attendance_date: date, status: attendance[st.id] || 'Absent' }));
    if (rows.length===0) return;
    await supabase.from('dashboard_attendance').upsert(rows, { onConflict: 'teacher_id,student_id,attendance_date' } as any);
    alert('Attendance saved');
  };

  const addRemark = async (studentId: string) => {
    const text = (remarkText[studentId]||'').trim();
    if (!text || !id) return;
    await supabase.from('dashboard_student_remarks').insert([{ teacher_id: id, student_id: studentId, note: text }]);
    setRemarkText(prev => ({ ...prev, [studentId]: '' }));
    await load();
  };

  return (
    <DetailErrorBoundary>
      <main className="w-full min-h-screen bg-background-main flex">
        <Helmet><title>Teacher Detail | GSL Pakistan CRM</title></Helmet>
        <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
        <div className="flex-1 flex flex-col">
          <Header />

          <div className="px-4 sm:px-6 lg:px-8 mt-6">
            <button className="text-sm text-blue-600" onClick={()=>navigate('/teachers')}>{'< Back to Teachers'}</button>
            <div className="bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a] mt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">{teacher?.full_name || 'Teacher'} — Students</h2>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex items-center gap-2">Date <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border rounded p-1"/></label>

                  <label className="flex items-center gap-2">Batch <select value={batchFilter} onChange={e=>setBatchFilter(e.target.value)} className="border rounded p-1"><option>All</option>{uniqueBatches.map(b=><option key={b}>{b}</option>)}</select></label>

                  {fatalError && (
                    <div className="bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a] text-red-700 mt-3">
                      {fatalError}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <select value={assignStudentId} onChange={e=>setAssignStudentId(e.target.value)} className="border rounded p-1 min-w-[240px]">
                      <option value="">Assign student...</option>
                      {assignableStudents.map(s=> <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <button disabled={!assignStudentId || assigning} onClick={assignStudent} className="px-3 py-2 rounded bg-gray-800 text-white disabled:opacity-50">{assigning?'Assigning...':'Assign'}</button>
                  </div>
                  <button onClick={saveAttendance} className="px-3 py-2 rounded bg-[#ffa332] text-white font-bold">Save Attendance</button>
                </div>
              </div>

              <div className="mt-3 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-secondary border-b">
                      <th className="py-2 pr-4">Student</th>
                      <th className="py-2 pr-4">Batch / Course</th>
                      <th className="py-2 pr-4">Attendance %</th>
                      <th className="py-2 pr-4">Mark Attendance</th>
                      <th className="py-2 pr-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (<tr><td colSpan={5} className="py-4 text-center text-text-secondary">Loading...</td></tr>)}
                    {!loading && filteredStudents.map(st => {
                      const full = st.full_name || `${st.first_name||''} ${st.last_name||''}`.trim();
                      const prog = st.program_title || '';
                      const batch = st.batch_no || '';
                      // Attendance % (simple: fetch counts)
                      const [attended, total] = [0,0]; // Placeholder (could compute via extra queries for accuracy)
                      const pct = total>0 ? Math.round((attended/total)*100) : 0;
                      return (
                        <tr key={st.id} className="border-b align-top">
                          <td className="py-2 pr-4 font-semibold">{full}{assignedIds.includes(st.id) && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">Explicit</span>}</td>
                          <td className="py-2 pr-4">{prog}{batch?` (${batch})`:''}</td>
                          <td className="py-2 pr-4">{pct}%</td>
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-3">
                              {(['Present','Absent','Late'] as const).map(opt => (
                                <label key={opt} className="flex items-center gap-1">
                                  <input type="radio" name={`att-${st.id}`} checked={(attendance[st.id]||'')===opt} onChange={()=>setAttendance(prev=>({ ...prev, [st.id]: opt }))} /> {opt}
                                </label>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 pr-4">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <input placeholder="Add remark" value={remarkText[st.id]||''} onChange={e=>setRemarkText(prev=>({ ...prev, [st.id]: e.target.value }))} className="border rounded p-2 flex-1"/>
                                <button className="px-3 py-1 rounded bg-gray-800 text-white" onClick={()=>addRemark(st.id)}>Add</button>
                                  {assignedIds.includes(st.id) && <button className="px-3 py-1 rounded bg-red-600 text-white" onClick={()=>unassignStudent(st.id)}>Unassign</button>}
                              </div>
                              <div className="text-xs text-text-secondary max-h-24 overflow-auto">
                                {(remarks[st.id]||[]).slice(0,3).map((r,i)=>(
                                  <div key={i} className="border rounded p-2 mb-1"><div className="font-medium">{new Date(r.created_at).toLocaleString()}</div><div>{r.note}</div></div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!loading && filteredStudents.length===0 && (<tr><td colSpan={5} className="py-4 text-center text-text-secondary">No students found for this teacher</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </DetailErrorBoundary>
  );
};

export default TeacherDetailPage;

