import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import HistoryTable from './HistoryTable';
import { getCurrentUserInfo, uploadAttachments } from './utils';

const CounselorView: React.FC = () => {
  const [me, setMe] = useState<{email:string;name:string}>({ email: '', name: '' });
  const [cases, setCases] = useState<any[]>([]);
  const [caseId, setCaseId] = useState<string>('');
  const [status, setStatus] = useState<'Pending'|'In Progress'|'Completed'|' '>(' ');
  const [notes, setNotes] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUserInfo();
      setMe({ email: u.email, name: u.name });
      const { data } = await supabase.from('dashboard_cases').select('id, case_number, title, status, student_info, branch').order('created_at', { ascending: false }).limit(200);
      setCases(data||[]);
    })();
  }, []);

  const selected = useMemo(()=> cases.find(c=>c.id===caseId), [cases, caseId]);
  const canSave = useMemo(()=> !!caseId && status.trim() && (notes || nextSteps), [caseId,status,notes,nextSteps]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      const payload = {
        case_number: selected?.case_number,
        student: selected?.student_info?.full_name || selected?.title,
        status,
        notes,
        next_steps: nextSteps,
      };
      await supabase.from('dashboard_reports').insert({ id, report_type: 'case_progress', role: 'Counselor', author_email: me.email, author_name: me.name, case_id: caseId, branch: selected?.branch || null, payload });
      if (files.length) {
        const up = await uploadAttachments(files, id, me.email);
        await supabase.from('dashboard_reports').update({ payload: { ...payload, files: up } }).eq('id', id);
      }
      setCaseId(''); setStatus(' '); setNotes(''); setNextSteps(''); setFiles([]);
    } finally { setSaving(false); }
  };

  return (
    <div>
      <section className="mt-6 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-6">
        <h2 className="text-lg font-bold mb-4">Case Progress Report</h2>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm">Case<select value={caseId} onChange={e=>setCaseId(e.target.value)} className="mt-1 border rounded p-2 w-full" required>
            <option value="">Select...</option>
            {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} — {c.title}</option>)}
          </select></label>
          <label className="text-sm">Stage / Status<select value={status} onChange={e=>setStatus(e.target.value as any)} className="mt-1 border rounded p-2 w-full" required>
            <option value=" ">Select...</option>
            {['Pending','In Progress','Completed'].map(s=> <option key={s}>{s}</option>)}
          </select></label>
          <label className="text-sm md:col-span-2">Notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} className="mt-1 border rounded p-2 w-full" rows={3}/></label>
          <label className="text-sm md:col-span-2">Next Steps<textarea value={nextSteps} onChange={e=>setNextSteps(e.target.value)} className="mt-1 border rounded p-2 w-full" rows={3}/></label>
          <label className="text-sm md:col-span-2">Attach Documents<input type="file" multiple onChange={e=>setFiles(Array.from(e.target.files||[]))} className="mt-1"/></label>
          <div className="md:col-span-2">
            <button disabled={!canSave || saving} className="px-4 py-2 rounded bg-primary text-white disabled:opacity-50">{saving?'Saving...':'Submit Report'}</button>
          </div>
        </form>
      </section>

      <HistoryTable scope="self" currentEmail={me.email} />
    </div>
  );
};

export default CounselorView;

