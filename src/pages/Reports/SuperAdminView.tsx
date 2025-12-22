import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import HistoryTable from './HistoryTable';
import { exportToXLSX } from './utils';

const SuperAdminView: React.FC = () => {
  const [roleF, setRoleF] = useState<'All'|'Teacher'|'Admin'|'Super Admin'|'Counselor'>('All');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      let q: any = supabase.from('dashboard_reports').select('*').order('created_at', { ascending: false }).limit(500);
      const { data } = await q;
      setReports(data||[]);
    })();
  }, []);

  const filtered = useMemo(() => {
    return (reports||[]).filter((r:any)=>{
      if (roleF !== 'All' && r.role !== roleF) return false;
      const t = new Date(r.created_at).getTime();
      if (from && t < new Date(from).getTime()) return false;
      if (to && t > new Date(to).getTime()) return false;
      return true;
    });
  }, [reports, roleF, from, to]);

  const exportAll = () => {
    const rows = filtered.map((r:any)=>({ id: r.id, date: r.created_at, role: r.role, type: r.report_type, by: r.author_name||r.author_email, status: r.status }));
    exportToXLSX('reports-export.xlsx', rows);
  };

  // Basic KPIs
  const kpis = useMemo(() => {
    const total = filtered.length;
    const byType: Record<string, number> = {};
    for (const r of filtered) byType[r.report_type] = (byType[r.report_type]||0)+1;
    return { total, byType };
  }, [filtered]);

  return (
    <div>
      <section className="mt-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <select value={roleF} onChange={e=>setRoleF(e.target.value as any)} className="border rounded p-2">
            {['All','Teacher','Admin','Super Admin','Counselor'].map(r=> <option key={r}>{r}</option>)}
          </select>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="border rounded p-2" />
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="border rounded p-2" />
          <button onClick={exportAll} className="px-3 py-2 rounded bg-secondary text-white">Export</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl shadow">Total Reports: <b>{kpis.total}</b></div>
          <div className="bg-white p-4 rounded-xl shadow">Class Reports: <b>{kpis.byType['class']||0}</b></div>
          <div className="bg-white p-4 rounded-xl shadow">Case Progress: <b>{kpis.byType['case_progress']||0}</b></div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold mb-3">All Reports</h2>
        <HistoryTable scope="all" currentEmail="" allowModeration />
      </section>
    </div>
  );
};

export default SuperAdminView;

