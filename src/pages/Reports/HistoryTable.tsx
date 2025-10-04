import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export type ReportRow = {
  id: string;
  report_type: string;
  role: string;
  author_email: string;
  author_name?: string;
  status: 'Pending'|'Approved'|'Rejected';
  created_at: string;
  payload: any;
};

type Props = {
  scope: 'self' | 'all';
  currentEmail: string;
  allowModeration?: boolean;
};

const HistoryTable: React.FC<Props> = ({ scope, currentEmail, allowModeration }) => {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'All'|'Pending'|'Approved'|'Rejected'>('All');
  const [type, setType] = useState<'All'|string>('All');

  useEffect(() => {
    (async () => {
      let query = supabase.from('dashboard_reports').select('*').order('created_at', { ascending: false });
      if (scope === 'self') query = query.eq('author_email', currentEmail);
      const { data } = await query.range(0, 199);
      setRows((data as any as ReportRow[]) || []);
    })();
  }, [scope, currentEmail]);

  const types = useMemo(() => {
    const t = new Set(rows.map(r => r.report_type));
    return ['All', ...Array.from(t)];
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (status !== 'All' && r.status !== status) return false;
      if (type !== 'All' && r.report_type !== type) return false;
      if (q) {
        const s = `${r.report_type} ${r.author_name || ''} ${r.author_email} ${r.status} ${JSON.stringify(r.payload || {})}`.toLowerCase();
        if (!s.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, q, status, type]);

  const moderate = async (id: string, next: 'Approved'|'Rejected') => {
    if (!allowModeration) return;
    await supabase.from('dashboard_reports').update({ status: next }).eq('id', id);
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: next } : r));
  };

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search" className="border rounded p-2" />
        <select value={status} onChange={e=>setStatus(e.target.value as any)} className="border rounded p-2">
          {['All','Pending','Approved','Rejected'].map(s=> <option key={s}>{s}</option>)}
        </select>
        <select value={type} onChange={e=>setType(e.target.value)} className="border rounded p-2">
          {types.map(t=> <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="overflow-auto bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a]">
        <table className="min-w-[800px] w-full">
          <thead>
            <tr className="text-left bg-gray-50">
              <th className="p-3">Report Type</th>
              <th className="p-3">Submitted By</th>
              <th className="p-3">Date</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-3 capitalize">{r.report_type.replace('_',' ')}</td>
                <td className="p-3">{r.author_name || r.author_email}</td>
                <td className="p-3">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${r.status==='Approved'?'bg-green-100 text-green-700':r.status==='Rejected'?'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-700'}`}>{r.status}</span>
                </td>
                <td className="p-3 text-sm flex gap-2">
                  {allowModeration && r.status==='Pending' && (
                    <>
                      <button onClick={()=>moderate(r.id,'Approved')} className="px-2 py-1 rounded bg-green-600 text-white">Approve</button>
                      <button onClick={()=>moderate(r.id,'Rejected')} className="px-2 py-1 rounded bg-red-600 text-white">Reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={5} className="p-6 text-center text-text-secondary">No reports found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistoryTable;

