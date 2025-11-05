import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import HistoryTable from './HistoryTable';
import { getCurrentUserInfo, uploadAttachments } from './utils';

const TeacherView: React.FC = () => {
  const [me, setMe] = useState<{email:string;name:string}>({ email: '', name: '' });
  // Class Report form
  const [date, setDate] = useState<string>('');
  const [batch, setBatch] = useState<string>('');
  const [topics, setTopics] = useState<string>('');
  const [present, setPresent] = useState<number>(0);
  const [progress, setProgress] = useState<'Excellent'|'Good'|'Average'|'Poor'|' '>(' ');
  const [remarks, setRemarks] = useState<string>('');
  const [classFiles, setClassFiles] = useState<File[]>([]);
  const [savingClass, setSavingClass] = useState(false);

  // Student Performance
  const [teacherId, setTeacherId] = useState<string>('');
  const [students, setStudents] = useState<{id:string; name:string}[]>([]);
  const [studentId, setStudentId] = useState<string>('');
  const [participation, setParticipation] = useState<string>('');
  const [acadProgress, setAcadProgress] = useState<'Excellent'|'Good'|'Average'|'Poor'|' '>(' ');
  const [spRemarks, setSpRemarks] = useState<string>('');
  const [spFiles, setSpFiles] = useState<File[]>([]);
  const [savingSp, setSavingSp] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUserInfo();
      setMe({ email: u.email, name: u.name });
      // Map teacher by email
      const { data: t } = await supabase.from('dashboard_teachers').select('id,email').eq('email', u.email).maybeSingle();
      const tid = (t as any)?.id || '';
      setTeacherId(tid);
      // Load assigned students via teacher assignments (approx: by service_name + batch_no)
      if (tid) {
        const { data: assigns } = await supabase.from('dashboard_teacher_assignments').select('service_name,batch_no').eq('teacher_id', tid);
        const pairs = (assigns || []).map((a:any) => [a.service_name, a.batch_no] as [string,string]);
        if (pairs.length) {
          const clauses = pairs.map(([s,b]) => `program_title.eq.${s},batch_no.eq.${b}`).join('|');
          // OR is limited; fallback to fetch all and filter client-side
          const { data: stu } = await supabase.from('dashboard_students').select('id, full_name, program_title, batch_no').limit(500);
          let list = (stu||[]).filter((st:any)=> pairs.some(([s,b]) => st.program_title===s && st.batch_no===b)).map((st:any)=>({ id: st.id, name: st.full_name }));
          // union with explicit mappings
          const { data: mapped } = await supabase.from('dashboard_teacher_student').select('student_id').eq('teacher_id', tid);
          const mapIds: string[] = (mapped||[]).map((m:any)=> m.student_id);
          const extraIds = mapIds.filter(id => !list.some(s => s.id === id));
          if (extraIds.length) {
            const { data: extras } = await supabase.from('dashboard_students').select('id, full_name').in('id', extraIds);
            list = [...list, ...((extras||[]) as any[]).map(s=>({ id: s.id, name: s.full_name }))];
          }
          setStudents(list);
        } else {
          // fallback: all students (limited) + explicit mappings
          const { data: stu } = await supabase.from('dashboard_students').select('id, full_name').limit(200);
          let list = ((stu||[]) as any[]).map(s=>({ id: s.id, name: s.full_name }));
          const { data: mapped } = await supabase.from('dashboard_teacher_student').select('student_id').eq('teacher_id', tid);
          const mapIds: string[] = (mapped||[]).map((m:any)=> m.student_id);
          const extraIds = mapIds.filter(id => !list.some(s => s.id === id));
          if (extraIds.length) {
            const { data: extras } = await supabase.from('dashboard_students').select('id, full_name').in('id', extraIds);
            list = [...list, ...((extras||[]) as any[]).map(s=>({ id: s.id, name: s.full_name }))];
          }
          setStudents(list);
        }
      }
    })();
  }, []);

  const canSaveClass = useMemo(()=> date && batch && topics && progress.trim() && present>=0, [date,batch,topics,progress,present]);
  const canSaveSp = useMemo(()=> studentId && acadProgress.trim(), [studentId, acadProgress]);

  const submitClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSaveClass) return;
    setSavingClass(true);
    try {
      const id = crypto.randomUUID();
      const payload = { date, batch, topics, present, progress, remarks };
      await supabase.from('dashboard_reports').insert({ id, report_type: 'class', role: 'Teacher', author_email: me.email, author_name: me.name, batch_no: batch, payload });
      if (classFiles.length) {
        const files = await uploadAttachments(classFiles, id, me.email);
        await supabase.from('dashboard_reports').update({ payload: { ...payload, files } }).eq('id', id);
      }
      // reset
      setDate(''); setBatch(''); setTopics(''); setPresent(0); setProgress(' '); setRemarks(''); setClassFiles([]);
    } finally { setSavingClass(false); }
  };

  const submitSp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSaveSp) return;
    setSavingSp(true);
    try {
      const id = crypto.randomUUID();
      // Basic attendance summary is out of scope; placeholder pulls recent 30 days count
      const { data: att } = await supabase.from('dashboard_attendance').select('status').eq('student_id', studentId).order('attendance_date', { ascending: false }).limit(60);
      const attendanceSummary = (att||[]).reduce((acc:any, a:any)=>{ acc[a.status]=(acc[a.status]||0)+1; return acc; }, {});
      const payload = { student_id: studentId, participation, acad_progress: acadProgress, remarks: spRemarks, attendance_summary: attendanceSummary };
      await supabase.from('dashboard_reports').insert({ id, report_type: 'student_performance', role: 'Teacher', author_email: me.email, author_name: me.name, student_id: studentId, payload });
      if (spFiles.length) {
        const files = await uploadAttachments(spFiles, id, me.email);
        await supabase.from('dashboard_reports').update({ payload: { ...payload, files } }).eq('id', id);
      }
      setStudentId(''); setParticipation(''); setAcadProgress(' '); setSpRemarks(''); setSpFiles([]);
    } finally { setSavingSp(false); }
  };

  return (
    <div>
      {/* Class Report */}
      <section className="mt-6 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-6">
        <h2 className="text-lg font-bold mb-4">Class Report</h2>
        <form onSubmit={submitClass} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm">Date<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-1 border rounded p-2 w-full" required/></label>
          <label className="text-sm">Batch / Course<input value={batch} onChange={e=>setBatch(e.target.value)} placeholder="e.g., IELTS / B-12" className="mt-1 border rounded p-2 w-full" required/></label>
          <label className="text-sm md:col-span-2">Topics Covered<input value={topics} onChange={e=>setTopics(e.target.value)} className="mt-1 border rounded p-2 w-full" required/></label>
          <label className="text-sm">Students Present<input type="number" min={0} value={present} onChange={e=>setPresent(parseInt(e.target.value||'0'))} className="mt-1 border rounded p-2 w-full" required/></label>
          <label className="text-sm">Overall Progress<select value={progress} onChange={e=>setProgress(e.target.value as any)} className="mt-1 border rounded p-2 w-full" required>
            <option value=" ">Select...</option>
            {['Excellent','Good','Average','Poor'].map(x=> <option key={x}>{x}</option>)}
          </select></label>
          <label className="text-sm md:col-span-2">Remarks / Challenges<textarea value={remarks} onChange={e=>setRemarks(e.target.value)} className="mt-1 border rounded p-2 w-full" rows={3}/></label>
          <label className="text-sm md:col-span-2">Upload Files<input type="file" multiple onChange={e=>setClassFiles(Array.from(e.target.files||[]))} className="mt-1"/></label>
          <div className="md:col-span-2">
            <button disabled={!canSaveClass || savingClass} className="px-4 py-2 rounded bg-primary text-white disabled:opacity-50">{savingClass?'Saving...':'Submit Report'}</button>
          </div>
        </form>
      </section>

      {/* Student Performance */}
      <section className="mt-6 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-6">
        <h2 className="text-lg font-bold mb-4">Student Performance Report</h2>
        <form onSubmit={submitSp} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm">Student<select value={studentId} onChange={e=>setStudentId(e.target.value)} className="mt-1 border rounded p-2 w-full" required>
            <option value="">Select...</option>
            {students.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
          <label className="text-sm">Participation / Behavior<input value={participation} onChange={e=>setParticipation(e.target.value)} className="mt-1 border rounded p-2 w-full"/></label>
          <label className="text-sm">Academic Progress<select value={acadProgress} onChange={e=>setAcadProgress(e.target.value as any)} className="mt-1 border rounded p-2 w-full" required>
            <option value=" ">Select...</option>
            {['Excellent','Good','Average','Poor'].map(x=> <option key={x}>{x}</option>)}
          </select></label>
          <label className="text-sm md:col-span-2">Remarks / Suggestions<textarea value={spRemarks} onChange={e=>setSpRemarks(e.target.value)} className="mt-1 border rounded p-2 w-full" rows={3}/></label>
          <label className="text-sm md:col-span-2">Upload Files<input type="file" multiple onChange={e=>setSpFiles(Array.from(e.target.files||[]))} className="mt-1"/></label>
          <div className="md:col-span-2">
            <button disabled={!canSaveSp || savingSp} className="px-4 py-2 rounded bg-primary text-white disabled:opacity-50">{savingSp?'Saving...':'Submit Report'}</button>
          </div>
        </form>
      </section>

      {/* History */}
      <HistoryTable scope="self" currentEmail={me.email} />
    </div>
  );
};

export default TeacherView;

