import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import HistoryTable from './HistoryTable';
import { exportToXLSX, getCurrentUserInfo } from './utils';

const AdminView: React.FC = () => {
  const [me, setMe] = useState<{email:string;name:string}>({ email: '', name: '' });
  const [branch, setBranch] = useState<string>('All');
  const [branches, setBranches] = useState<string[]>(['All']);
  const [employeeEmail, setEmployeeEmail] = useState<string>('');
  const [users, setUsers] = useState<{email:string; name:string}[]>([]);
  const [pending, setPending] = useState<any[]>([]);

  // Aggregates
  const [stats, setStats] = useState<{students:number; activeCases:number; teachers:number; attendance:number; finance:number|undefined}>({ students: 0, activeCases: 0, teachers: 0, attendance: 0, finance: undefined });

  useEffect(() => {
    (async () => {
      const u = await getCurrentUserInfo();
      setMe({ email: u.email, name: u.name });
      const { data: cases } = await supabase.from('dashboard_cases').select('branch');
      const br = Array.from(new Set((cases||[]).map((c:any)=>c.branch).filter(Boolean)));
      setBranches(['All', ...br]);
      const { data: us } = await supabase.from('dashboard_users').select('full_name, email').order('full_name', { ascending: true });
      setUsers((us||[]).map((x:any)=>({ email: x.email, name: x.full_name||x.email })));
      const { data: pend } = await supabase.from('dashboard_reports').select('*').eq('status','Pending').order('created_at', { ascending: false }).limit(50);
      setPending(pend||[]);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      // Compute aggregates depending on branch
      // Students: global count (no branch column available), so total
      const { count: students } = await supabase.from('dashboard_students').select('*', { count: 'exact', head: true });
      // Active cases: filter by branch if selected
      let q = supabase.from('dashboard_cases').select('*', { count: 'exact', head: true }).eq('status','In Progress');
      if (branch !== 'All') q = q.eq('branch', branch);
      const { count: activeCases } = await q;
      // Teachers assigned (approx: unique teacher_id in assignments)
      const { data: assigns } = await supabase.from('dashboard_teacher_assignments').select('teacher_id');
      const teachers = Array.from(new Set((assigns||[]).map((a:any)=>a.teacher_id))).length;
      // Attendance entries in last 30 days
      const since = new Date(Date.now() - 30*24*3600*1000).toISOString();
      const { count: attendance } = await supabase.from('dashboard_attendance').select('*', { count: 'exact', head: true }).gte('created_at', since);
      // Finance: sum vouchers by branch
      let finance: number | undefined = undefined;
      try {
        if (branch !== 'All') {
          const { data: v } = await supabase.from('vouchers').select('amount, vtype, branch');
          finance = (v||[]).filter((x:any)=>x.branch===branch).reduce((acc:number, x:any)=> acc + (x.vtype==='cash_out'?-1:1) * Number(x.amount||0), 0);
        }
      } catch {}
      setStats({ students: students||0, activeCases: activeCases||0, teachers, attendance: attendance||0, finance });
    })();
  }, [branch]);

  const exportPending = () => {
    const rows = pending.map((r:any)=>({ id: r.id, type: r.report_type, by: r.author_name||r.author_email, date: r.created_at, status: r.status }));
    exportToXLSX('pending-reports.xlsx', rows);
  };

  const overviewCards = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white p-4 rounded-xl shadow">Total Students: <b>{stats.students}</b></div>
      <div className="bg-white p-4 rounded-xl shadow">Active Cases: <b>{stats.activeCases}</b></div>
      <div className="bg-white p-4 rounded-xl shadow">Teachers Assigned: <b>{stats.teachers}</b></div>
      <div className="bg-white p-4 rounded-xl shadow">Attendance (30d): <b>{stats.attendance}</b></div>
      <div className="bg-white p-4 rounded-xl shadow">Financial (net, branch): <b>{stats.finance ?? 'N/A'}</b></div>
    </div>
  );

  return (
    <div>
      <section className="mt-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <label className="text-sm">Branch
            <select value={branch} onChange={e=>setBranch(e.target.value)} className="ml-2 border rounded p-2">
              {branches.map(b=> <option key={b}>{b}</option>)}
            </select>
          </label>
          <button onClick={exportPending} className="px-3 py-2 rounded bg-secondary text-white">Export Pending</button>
        </div>
        {overviewCards}
      </section>

      {/* Employee Performance Snapshot */}
      <section className="mt-6 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-6">
        <h2 className="text-lg font-bold mb-3">Employee Performance</h2>
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <select value={employeeEmail} onChange={e=>setEmployeeEmail(e.target.value)} className="border rounded p-2">
            <option value="">Select employee...</option>
            {users.map(u=> <option key={u.email} value={u.email}>{u.name} ({u.email})</option>)}
          </select>
        </div>
        {employeeEmail && <EmployeePerf email={employeeEmail} />}
      </section>

      {/* Approvals */}
      <section className="mt-6">
        <h2 className="text-lg font-bold mb-3">Moderate Reports</h2>
        <HistoryTable scope="all" currentEmail={me.email} allowModeration />
      </section>
    </div>
  );
};

const EmployeePerf: React.FC<{email:string}> = ({ email }) => {
  const [summary, setSummary] = useState<{cases:number; reports:number; attendance:number}>({ cases: 0, reports: 0, attendance: 0 });

  useEffect(() => {
    (async () => {
      const { count: cases } = await supabase.from('dashboard_cases').select('*', { count: 'exact', head: true }).eq('employee', email);
      const { count: reports } = await supabase.from('dashboard_reports').select('*', { count: 'exact', head: true }).eq('author_email', email);
      const { data: t } = await supabase.from('dashboard_teachers').select('id').eq('email', email).maybeSingle();
      const tid = (t as any)?.id;
      let attendance = 0;
      if (tid) {
        const { count } = await supabase.from('dashboard_attendance').select('*', { count: 'exact', head: true }).eq('teacher_id', tid);
        attendance = count || 0;
      }
      setSummary({ cases: cases||0, reports: reports||0, attendance });
    })();
  }, [email]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white p-4 rounded-xl shadow">Cases handled: <b>{summary.cases}</b></div>
      <div className="bg-white p-4 rounded-xl shadow">Reports submitted: <b>{summary.reports}</b></div>
      <div className="bg-white p-4 rounded-xl shadow">Attendance marked: <b>{summary.attendance}</b></div>
    </div>
  );
};

export default AdminView;

