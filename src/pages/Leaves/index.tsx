import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';

// Types
 type Role = 'super' | 'admin' | 'other';
 type LeaveType = 'Sick' | 'Remote' | 'Vacation';
 type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';
 interface LeaveRec {
  id: string;
  employee_email: string;
  type: LeaveType;
  start_date: string; // ISO date
  end_date: string;   // ISO date
  status: LeaveStatus;
  reason?: string | null;
  created_at?: string;
  created_by?: string | null;
 }
 interface Employee {
  email: string;
  full_name?: string;
 }

 const COLORS: Record<LeaveType, { fill: string; outline: string }> = {
  Sick: { fill: 'bg-red-500', outline: 'border-red-500' },
  Remote: { fill: 'bg-blue-500', outline: 'border-blue-500' },
  Vacation: { fill: 'bg-emerald-500', outline: 'border-emerald-500' },
 };

 const LeavesPage: React.FC = () => {
  const [role, setRole] = useState<Role>('other');
  const isAdmin = role === 'super' || role === 'admin';

  // Month navigation
  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth()); // 0-based
  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);
  const monthStartISO = useMemo(() => new Date(year, month, 1).toISOString().slice(0, 10), [year, month]);
  const monthEndISO = useMemo(() => new Date(year, month, daysInMonth).toISOString().slice(0, 10), [year, month, daysInMonth]);

  const [tab, setTab] = useState<'summary' | 'calendar'>('summary');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<LeaveRec[]>([]);
  const [search, setSearch] = useState('');

  // Request modal
  const [requestOpen, setRequestOpen] = useState(false);
  const [reqType, setReqType] = useState<LeaveType>('Sick');
  const [reqStart, setReqStart] = useState<string>('');
  const [reqEnd, setReqEnd] = useState<string>('');
  const [reqReason, setReqReason] = useState<string>('');
  const [reqForEmail, setReqForEmail] = useState<string>(''); // admin only
  const [submitting, setSubmitting] = useState(false);

  // Manage modal (approve/reject)
  const [manageEmail, setManageEmail] = useState<string | null>(null);

  // Role detection
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const email = data.user?.email || '';
        const { data: u } = await supabase.from('dashboard_users').select('role,email,full_name').eq('email', email).maybeSingle();
        const r = (u?.role || (data.user as any)?.app_metadata?.role || (data.user as any)?.user_metadata?.role || '').toString().toLowerCase();
        if (r.includes('super')) mounted && setRole('super');
        else if (r.includes('admin')) mounted && setRole('admin');
        else mounted && setRole('other');
      } catch {
        mounted && setRole('other');
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load employees
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const me = auth.user?.email || '';
        if (isAdmin) {
          const { data } = await supabase.from('dashboard_users').select('email,full_name').order('full_name', { ascending: true });
          mounted && setEmployees((data || []).map((d:any) => ({ email: d.email, full_name: d.full_name })));
        } else {
          const { data } = await supabase.from('dashboard_users').select('email,full_name').eq('email', me).maybeSingle();
          mounted && setEmployees(data ? [{ email: data.email, full_name: data.full_name }] : [{ email: me }]);
        }
      } catch {}
    })();
  }, [isAdmin]);

  // Load leaves for month
  const loadLeaves = async () => {
    const { data, error } = await supabase
      .from('leaves')
      .select('*')
      .lte('start_date', monthEndISO)
      .gte('end_date', monthStartISO);
    if (!error) setLeaves((data as any) || []);
  };
  useEffect(() => { loadLeaves();
    const ch = supabase
      .channel('realtime:leaves')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, loadLeaves)
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, [monthStartISO, monthEndISO]);

  const filteredEmployees = useMemo(() => {
    const s = search.toLowerCase();
    return employees.filter(e => (e.full_name || e.email).toLowerCase().includes(s));
  }, [employees, search]);

  // Index leaves by employee and by day
  const leavesByEmployee = useMemo(() => {
    const map: Record<string, LeaveRec[]> = {};
    for (const lv of leaves) {
      if (!map[lv.employee_email]) map[lv.employee_email] = [];
      map[lv.employee_email].push(lv);
    }
    return map;
  }, [leaves]);

  // Aggregations per employee for current month
  const totalsByEmployee = useMemo(() => {
    const res: Record<string, { Sick: number; Remote: number; Vacation: number }> = {} as any;
    const monthStart = new Date(monthStartISO);
    const monthEnd = new Date(monthEndISO);
    for (const lv of leaves) {
      const s = new Date(lv.start_date);
      const e = new Date(lv.end_date);
      const from = s > monthStart ? s : monthStart;
      const to = e < monthEnd ? e : monthEnd;
      if (to < from) continue;
      const days = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
      if (!res[lv.employee_email]) res[lv.employee_email] = { Sick: 0, Remote: 0, Vacation: 0 } as any;
      (res[lv.employee_email] as any)[lv.type] += days;
    }
    return res;
  }, [leaves, monthStartISO, monthEndISO]);

  const prevMonth = () => {
    const d = new Date(year, month, 1);
    d.setMonth(d.getMonth() - 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const nextMonth = () => {
    const d = new Date(year, month, 1);
    d.setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const onSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqStart || !reqEnd) { alert('Please select start and end dates'); return; }
    setSubmitting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.email || '';
      const target = isAdmin && reqForEmail ? reqForEmail : me;
      const payload = {
        employee_email: target,
        type: reqType,
        start_date: reqStart,
        end_date: reqEnd,
        status: 'Pending' as LeaveStatus,
        reason: reqReason || null,
        created_by: me,
      };
      const { error } = await supabase.from('leaves').insert(payload);
      if (error) throw error;
      setRequestOpen(false);
      setReqStart(''); setReqEnd(''); setReqReason(''); setReqForEmail(''); setReqType('Sick');
      await loadLeaves();
    } catch (err:any) {
      alert(err?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const approveReject = async (leaveId: string, action: 'Approved' | 'Rejected') => {
    if (!isAdmin) return;
    const { error } = await supabase.from('leaves').update({ status: action }).eq('id', leaveId);
    if (!error) await loadLeaves();
  };

  return (
    <>
      <Helmet>
        <title>Leaves - GSL Pakistan CRM</title>
      </Helmet>
      <main className="w-full min-h-screen bg-background-main flex">
        <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          {/* Header */}
          <section className="mt-8 lg:mt-12">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-4xl text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Leaves</h1>
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="px-2 py-1 border rounded">◀</button>
                <div className="font-semibold w-40 text-center">{new Date(year, month, 1).toLocaleString(undefined,{ month:'long', year:'numeric'})}</div>
                <button onClick={nextMonth} className="px-2 py-1 border rounded">▶</button>
                <button onClick={()=>setRequestOpen(true)} className="ml-2 px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">+ Add Request</button>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-4 flex gap-2">
              <button onClick={()=>setTab('summary')} className={`px-3 py-1 rounded ${tab==='summary'?'bg-[#ffa332] text-white':'bg-white border'}`}>Employees’ Leaves</button>
              <button onClick={()=>setTab('calendar')} className={`px-3 py-1 rounded ${tab==='calendar'?'bg-[#ffa332] text-white':'bg-white border'}`}>Calendar</button>
            </div>

            {/* Search */}
            <div className="mt-4">
              <input className="border rounded px-3 py-2 w-full md:w-96" placeholder="Search employees" value={search} onChange={e=>setSearch(e.target.value)} />
            </div>

            {/* Summary view */}
            {tab==='summary' && (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-secondary">
                      <th className="p-2">Employee</th>
                      <th className="p-2">Sick Leaves</th>
                      <th className="p-2">Work Remotely</th>
                      <th className="p-2">Vacation</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredEmployees.map(emp => {
                      const t = totalsByEmployee[emp.email] || { Sick: 0, Remote: 0, Vacation: 0 };
                      return (
                        <tr key={emp.email}>
                          <td className="p-2 font-semibold">{emp.full_name || emp.email}</td>
                          <td className="p-2">{t.Sick}</td>
                          <td className="p-2">{t.Remote}</td>
                          <td className="p-2">{t.Vacation}</td>
                          <td className="p-2 text-right">
                            <button onClick={()=>setManageEmail(emp.email)} className="text-blue-600 hover:underline">Manage</button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredEmployees.length===0 && (
                      <tr><td colSpan={5} className="p-4 text-center text-text-secondary">No employees</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Calendar view */}
            {tab==='calendar' && (
              <div className="mt-4 border rounded-lg bg-white">
                <div className="grid" style={{ gridTemplateColumns: `240px repeat(${daysInMonth}, minmax(28px,1fr))` }}>
                  {/* Header row */}
                  <div className="sticky left-0 z-10 bg-white border-b p-2 font-semibold">Employee</div>
                  {Array.from({ length: daysInMonth }, (_,i)=>i+1).map(d => (
                    <div key={`h${d}`} className="border-b text-center text-xs p-1 text-text-secondary">{d}</div>
                  ))}
                  {/* Rows */}
                  {filteredEmployees.map(emp => {
                    const empLeaves = leavesByEmployee[emp.email] || [];
                    return (
                      <React.Fragment key={emp.email}>
                        <div className="sticky left-0 z-10 bg-white border-r p-2 text-sm font-semibold">{emp.full_name || emp.email}</div>
                        {Array.from({ length: daysInMonth }, (_,i)=>i+1).map(day => {
                          const date = new Date(year, month, day).toISOString().slice(0,10);
                          const lv = empLeaves.find(l => l.start_date <= date && l.end_date >= date);
                          if (!lv) return <div key={day} className="border h-7" />;
                          const typ = COLORS[lv.type];
                          const cls = lv.status==='Approved' ? `${typ.fill}` : `border ${typ.outline}`;
                          return <div key={day} className={`border h-7 flex items-center justify-center`}>
                            <div title={`${lv.type} (${lv.status})`} className={`h-4 w-4 rounded ${cls}`} />
                          </div>;
                        })}
                      </React.Fragment>
                    );
                  })}
                  {filteredEmployees.length===0 && (
                    <div className="col-span-full p-4 text-center text-text-secondary">No employees</div>
                  )}
                </div>
              </div>
            )}

          </section>
        </div>
      </main>

      {/* Request Modal */}
      {requestOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <form onSubmit={onSubmitRequest} className="bg-white rounded-lg p-4 w-[92%] max-w-lg space-y-3">
            <div className="text-lg font-semibold">New Leave Request</div>
            {isAdmin && (
              <div>
                <label className="text-sm font-semibold">For (email)</label>
                <input className="mt-1 w-full border rounded px-2 py-1" placeholder="employee@example.com" value={reqForEmail} onChange={e=>setReqForEmail(e.target.value)} />
              </div>
            )}
            <div>
              <label className="text-sm font-semibold">Type</label>
              <select className="mt-1 w-full border rounded px-2 py-1" value={reqType} onChange={e=>setReqType(e.target.value as LeaveType)}>
                <option value="Sick">Sick Leave</option>
                <option value="Remote">Work Remotely</option>
                <option value="Vacation">Vacation</option>
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Start date</label>
                <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={reqStart} onChange={e=>setReqStart(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold">End date</label>
                <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={reqEnd} onChange={e=>setReqEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold">Reason (optional)</label>
              <textarea className="mt-1 w-full border rounded px-2 py-1" rows={3} value={reqReason} onChange={e=>setReqReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={()=>setRequestOpen(false)} className="px-3 py-2 rounded border">Cancel</button>
              <button disabled={submitting} className="px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">Submit</button>
            </div>
          </form>
        </div>
      )}

      {/* Manage Modal */}
      {manageEmail && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={()=>setManageEmail(null)}>
          <div className="bg-white rounded-lg p-4 w-[92%] max-w-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Manage Leaves — {manageEmail}</div>
              <button onClick={()=>setManageEmail(null)} className="text-sm">✕</button>
            </div>
            {!isAdmin && <div className="text-sm text-red-600 mt-1">Only Admin/Super Admin can approve or reject.</div>}
            <div className="mt-3 max-h-[60vh] overflow-auto divide-y">
              {leaves.filter(l=>l.employee_email===manageEmail).map(lv => (
                <div key={lv.id} className="py-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-sm">{lv.type} — {lv.status}</div>
                    <div className="text-xs text-text-secondary">{lv.start_date} → {lv.end_date}</div>
                    {lv.reason && <div className="text-xs text-text-secondary">{lv.reason}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded ${COLORS[lv.type].fill}`} />
                    {isAdmin && (
                      <>
                        <button onClick={()=>approveReject(lv.id,'Approved')} className="px-2 py-1 text-xs rounded border border-emerald-500 text-emerald-700">Approve</button>
                        <button onClick={()=>approveReject(lv.id,'Rejected')} className="px-2 py-1 text-xs rounded border border-red-500 text-red-700">Reject</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {leaves.filter(l=>l.employee_email===manageEmail).length===0 && (
                <div className="py-6 text-center text-text-secondary">No requests</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
 };

 export default LeavesPage;

