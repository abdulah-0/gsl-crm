import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';

// Simple role type
type Role = 'super' | 'admin' | 'other';

// Dashboard user shape (extend later as schema evolves)
interface EmpRow {
  id?: string;
  email: string;
  full_name?: string | null;
  role?: string | null;
  department?: string | null;
  designation?: string | null;
  joining_date?: string | null; // ISO date
  status?: string | null; // Active/Inactive, etc
  branch?: string | null;
}

const HRMPage: React.FC = () => {
  const [role, setRole] = useState<Role>('other');
  const [myBranch, setMyBranch] = useState<string | null>(null);
  const isAdmin = role === 'super' || role === 'admin';

  // Sub-tabs
  const [tab, setTab] = useState<'employees' | 'leaves' | 'timerecord' | 'payroll'>('employees');

  // Employees state
  const [rows, setRows] = useState<EmpRow[]>([]);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  // HRM -> Leaves management state
  interface LeaveRow {
    id: number;
    employee_email: string;
    type: string | null;
    start_date: string | null;
    end_date: string | null;
    status: string | null;
    reason?: string | null;
    branch?: string | null;
    created_at?: string | null;
  }
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [lEmail, setLEmail] = useState('');
  const [lType, setLType] = useState('');
  const [lStatus, setLStatus] = useState('');
  const [lFrom, setLFrom] = useState('');
  const [lTo, setLTo] = useState('');
  // HRM -> Time Record state
  interface TimeRecordRow {
    id: number;
    employee_email: string;
    work_date: string;
    check_in: string | null;
    check_out: string | null;
    hours: number | null;
    overtime: number | null;
    branch?: string | null;
  }
  const [trs, setTrs] = useState<TimeRecordRow[]>([]);
  const [tEmail, setTEmail] = useState('');
  const [tFrom, setTFrom] = useState('');
  const [tTo, setTTo] = useState('');

  const loadTimeRecords = async () => {
    let q = supabase
      .from('time_records')
      .select('id, employee_email, work_date, check_in, check_out, hours, overtime, branch')
      .order('work_date', { ascending: false })
      .limit(500);
    if (role !== 'super') q = q.eq('branch', myBranch);
    if (tEmail) q = q.ilike('employee_email', `%${tEmail}%`);
    if (tFrom) q = q.gte('work_date', tFrom);
    if (tTo) q = q.lte('work_date', tTo);
    const { data } = await q;
    setTrs((data as any) || []);
  };
  useEffect(() => { if (tab==='timerecord' && (role==='super' || myBranch!==null)) loadTimeRecords(); }, [tab, role, myBranch, tEmail, tFrom, tTo]);

  // Add/Edit modal
  const [showTRModal, setShowTRModal] = useState(false);
  const [editTR, setEditTR] = useState<TimeRecordRow | null>(null);
  const openAddTR = () => { setEditTR({ id: 0, employee_email: '', work_date: new Date().toISOString().slice(0,10), check_in: null, check_out: null, hours: null, overtime: null, branch: myBranch||null }); setShowTRModal(true); };
  const openEditTR = (r: TimeRecordRow) => { setEditTR(r); setShowTRModal(true); };
  const saveTR = async () => {
    if (!isAdmin || !editTR) { setShowTRModal(false); return; }
    const payload: any = {
      employee_email: editTR.employee_email,
      work_date: editTR.work_date,
      check_in: editTR.check_in || null,
      check_out: editTR.check_out || null,
      hours: editTR.hours,
      overtime: editTR.overtime,
      branch: role==='super' ? (editTR.branch||null) : (myBranch||null),
    };
    if (editTR.id && editTR.id !== 0) {
      const { error } = await supabase.from('time_records').update(payload).eq('id', editTR.id);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from('time_records').insert(payload);
      if (error) return alert(error.message);
    }
    setShowTRModal(false); setEditTR(null); await loadTimeRecords();
  };
  const deleteTR = async (id: number) => {
    if (!isAdmin) return;
    if (!confirm('Delete this record?')) return;
    const { error } = await supabase.from('time_records').delete().eq('id', id);
    if (error) alert(error.message); else loadTimeRecords();
  };
  // Payroll state
  interface PayrollBatch { id: number; year: number; month: number; branch?: string | null; created_at?: string | null; }
  interface PayrollItem { id: number; batch_id: number; employee_email: string; payable_amount: number | null; details?: any; }
  const [payrollBatches, setPayrollBatches] = useState<PayrollBatch[]>([]);
  const [batchItems, setBatchItems] = useState<PayrollItem[]>([]);
  const [pyMonth, setPyMonth] = useState<number>(new Date().getMonth()+1);
  const [pyYear, setPyYear] = useState<number>(new Date().getFullYear());
  const [activeBatchId, setActiveBatchId] = useState<number | null>(null);

  const loadBatches = async () => {
    let q = supabase.from('payroll_batches').select('id, year, month, branch, created_at').order('created_at', { ascending: false });
    if (role !== 'super') q = q.eq('branch', myBranch);
    const { data } = await q as any;
    setPayrollBatches(data || []);
  };
  const loadBatchItems = async (batchId: number) => {
    const { data } = await supabase.from('payroll_items').select('id, batch_id, employee_email, payable_amount, details').eq('batch_id', batchId).order('employee_email', { ascending: true });
    setBatchItems((data as any) || []);
  };
  useEffect(() => { if (tab==='payroll' && (role==='super' || myBranch!==null)) loadBatches(); }, [tab, role, myBranch]);

  const generatePayroll = async () => {
    if (!isAdmin) return;
    // 1) Create batch
    const batchPayload: any = { year: pyYear, month: pyMonth, branch: role==='super' ? null : myBranch };
    const { data: batch, error: bErr } = await supabase.from('payroll_batches').insert(batchPayload).select().single();
    if (bErr) return alert(bErr.message);
    // 2) gather employees in scope
    let eQ = supabase.from('dashboard_users').select('email, full_name, branch');
    if (role !== 'super') eQ = eQ.eq('branch', myBranch);
    const { data: emps, error: eErr } = await eQ as any;
    if (eErr) { alert(eErr.message); return; }
    // 3) For each employee, compute simple payable (placeholder logic: base 0, compute from hours at 0 rate)
    // Example: 8 hours per day base rate 0 — extend later. We'll just count working days from time_records
    const start = new Date(pyYear, pyMonth-1, 1);
    const end = new Date(pyYear, pyMonth, 0);
    const from = start.toISOString().slice(0,10);
    const to = end.toISOString().slice(0,10);

    for (const emp of (emps||[])) {
      let trQ = supabase.from('time_records').select('hours').gte('work_date', from).lte('work_date', to).eq('employee_email', emp.email);
      if (role !== 'super') trQ = trQ.eq('branch', myBranch);
      const { data: trsData } = await trQ as any;
      const totalHours = (trsData||[]).reduce((acc: number, r: any)=> acc + (Number(r.hours)||0), 0);
      const payable = Math.round(totalHours * 0); // placeholder for now
      await supabase.from('payroll_items').insert({ batch_id: (batch as any).id, employee_email: emp.email, payable_amount: payable, details: { totalHours } });
    }
    await loadBatches();
  };

  const printPayslip = (item: PayrollItem) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Payslip</title></head><body style="font-family:sans-serif;padding:24px;">
      <h2 style="margin:0 0 12px">Payslip</h2>
      <div>Employee: ${item.employee_email}</div>
      <div>Amount: ${item.payable_amount ?? 0}</div>
      <pre style="margin-top:12px;background:#f7f7f7;padding:12px;border:1px solid #eee">${JSON.stringify(item.details||{}, null, 2)}</pre>
      <button onclick="window.print()" style="margin-top:16px;padding:8px 12px">Print</button>
    </body></html>`);
    w.document.close();
  };



  const loadLeaves = async () => {
    let q = supabase
      .from('leaves')
      .select('id, employee_email, type, start_date, end_date, status, reason, branch, created_at')
      .order('created_at', { ascending: false });
    if (role !== 'super') q = q.eq('branch', myBranch);
    if (lEmail) q = q.ilike('employee_email', `%${lEmail}%`);
    if (lType) q = q.eq('type', lType);
    if (lStatus) q = q.eq('status', lStatus);
    if (lFrom) q = q.gte('start_date', lFrom);
    if (lTo) q = q.lte('end_date', lTo);
    const { data } = await q;
    setLeaves((data as any) || []);
  };
  useEffect(() => { if (tab==='leaves' && (role==='super' || myBranch!==null)) loadLeaves(); }, [tab, role, myBranch, lEmail, lType, lStatus, lFrom, lTo]);

  const updateLeaveStatus = async (id: number, status: 'Approved' | 'Rejected') => {
    const { error } = await supabase.from('leaves').update({ status }).eq('id', id);
    if (error) alert(error.message); else loadLeaves();
  };


  // Load role
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const email = data.user?.email || '';
        const { data: u } = await supabase.from('dashboard_users').select('role, branch').eq('email', email).maybeSingle();
        const r = (u?.role || (data.user as any)?.app_metadata?.role || (data.user as any)?.user_metadata?.role || '').toString().toLowerCase();
        if (r.includes('super')) mounted && setRole('super');
        else if (r.includes('admin')) mounted && setRole('admin');
        else mounted && setRole('other');
        mounted && setMyBranch(u?.branch || null);
      } catch {
        mounted && setRole('other');
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load employees list
  const loadEmployees = async () => {
    let query = supabase
      .from('dashboard_users')
      .select('email, full_name, role, department, designation, joining_date, status, branch')
      .order('full_name', { ascending: true });
    if (role !== 'super') {
      query = query.eq('branch', myBranch);
    }
    const { data } = await query;
    setRows((data as any) || []);
  };
  useEffect(() => { if (role==='super' || myBranch!==null) loadEmployees(); }, [role, myBranch]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return rows.filter(r =>
      (!s || (r.full_name||'').toLowerCase().includes(s) || (r.email||'').toLowerCase().includes(s)) &&
      (!filterRole || (r.role||'').toLowerCase() === filterRole.toLowerCase()) &&
      (!filterStatus || (r.status||'').toLowerCase() === filterStatus.toLowerCase())
    );
  }, [rows, search, filterRole, filterStatus]);

  // CRUD placeholders (extend later)
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editRow, setEditRow] = useState<EmpRow | null>(null);

  const openAdd = () => { setEditRow({ email: '', full_name: '', role: 'Employee', status: 'Active', branch: myBranch||'' }); setShowEmpModal(true); };
  const openEdit = (r: EmpRow) => { setEditRow(r); setShowEmpModal(true); };
  const onSave = async () => {
    if (!isAdmin || !editRow) { setShowEmpModal(false); return; }
    const branchVal = role==='super' ? (editRow.branch || null) : (myBranch || null);
    const payload = {
      email: editRow.email,
      full_name: editRow.full_name,
      role: editRow.role,
      department: editRow.department,
      designation: editRow.designation,
      joining_date: editRow.joining_date,
      status: editRow.status,
      branch: branchVal,
    } as any;
    // Upsert basic employee profile (does not create auth account)
    const { error } = await supabase.from('dashboard_users').upsert(payload, { onConflict: 'email' } as any);
    if (!error) { setShowEmpModal(false); setEditRow(null); await loadEmployees(); } else { alert(error.message); }
  };
  const onDelete = async (email: string) => {
    if (!isAdmin) return;
    if (!window.confirm('Remove this employee record?')) return;
    const { error } = await supabase.from('dashboard_users').delete().eq('email', email);
    if (!error) await loadEmployees(); else alert(error.message);
  };

  return (
    <>
      <Helmet>
        <title>HRM - GSL Pakistan CRM</title>
      </Helmet>
      <main className="w-full min-h-screen bg-background-main flex">
        <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          <section className="mt-8 lg:mt-12">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-4xl text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>HRM</h1>
            </div>

            {/* Sub-tabs */}
            <div className="mt-4 inline-flex bg-white border rounded-lg p-1">
              <button onClick={()=>setTab('employees')} className={`px-3 py-1 rounded-md text-sm font-semibold ${tab==='employees'?'bg-[#ffa332] text-white':'text-text-secondary'}`}>Employees</button>
              <button onClick={()=>setTab('leaves')} className={`ml-1 px-3 py-1 rounded-md text-sm font-semibold ${tab==='leaves'?'bg-[#ffa332] text-white':'text-text-secondary'}`}>Leaves</button>
              <button onClick={()=>setTab('timerecord')} className={`ml-1 px-3 py-1 rounded-md text-sm font-semibold ${tab==='timerecord'?'bg-[#ffa332] text-white':'text-text-secondary'}`}>Time Record</button>
              <button onClick={()=>setTab('payroll')} className={`ml-1 px-3 py-1 rounded-md text-sm font-semibold ${tab==='payroll'?'bg-[#ffa332] text-white':'text-text-secondary'}`}>Payroll</button>
            </div>

            {/* Employees tab */}
            {tab==='employees' && (
              <div className="mt-6 space-y-3">
                <div className="bg-white border rounded-lg shadow-sm p-3 flex flex-wrap items-center gap-2">
                  <input className="border rounded px-3 py-2 w-full md:w-80" placeholder="Search name or email" value={search} onChange={e=>setSearch(e.target.value)} />
                  <select className="border rounded px-2 py-2" value={filterRole} onChange={e=>setFilterRole(e.target.value)}>
                    <option value="">All Roles</option>
                    <option value="super admin">Super Admin</option>
                    <option value="admin">Admin</option>
                    <option value="teacher">Teacher</option>
                    <option value="counselor">Counselor</option>
                    <option value="employee">Employee</option>
                  </select>
                  <select className="border rounded px-2 py-2" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  {isAdmin && (
                    <button onClick={openAdd} className="ml-auto px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">+ Add Employee</button>
                  )}
                  {!isAdmin && myBranch && (
                    <div className="ml-auto text-sm text-text-secondary">Branch: <span className="font-semibold text-text-primary">{myBranch}</span></div>
                  )}
                </div>

                <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-text-secondary">
                        <th className="p-2">Name</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Role</th>
                        <th className="p-2">Department</th>
                        <th className="p-2">Designation</th>
                        <th className="p-2">Joining Date</th>
                        <th className="p-2">Status</th>
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filtered.map(r => (
                        <tr key={r.email}>
                          <td className="p-2 font-semibold text-text-primary">{r.full_name || '-'}</td>
                          <td className="p-2">{r.email}</td>
                          <td className="p-2">{r.role || '-'}</td>
                          <td className="p-2">{r.department || '-'}</td>
                          <td className="p-2">{r.designation || '-'}</td>
                          <td className="p-2">{r.joining_date || '-'}</td>
                          <td className="p-2">{r.status || '-'}</td>
                          <td className="p-2 text-right">
                            {isAdmin ? (
                              <>
                                <button onClick={()=>openEdit(r)} className="text-blue-600 hover:underline mr-3">Edit</button>
                                <button onClick={()=>onDelete(r.email)} className="text-red-600 hover:underline">Remove</button>
                              </>
                            ) : (
                              <span className="text-text-secondary">View only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filtered.length===0 && (
                        <tr><td colSpan={8} className="p-4 text-center text-text-secondary">No employees</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Leaves tab: branch-scoped approvals with filters */}
            {tab==='leaves' && (
              <div className="mt-6 space-y-3">
                <div className="bg-white border rounded-lg shadow-sm p-3 flex flex-wrap items-center gap-2">
                  <input className="border rounded px-3 py-2 w-full md:w-64" placeholder="Filter by employee email" value={lEmail} onChange={e=>setLEmail(e.target.value)} />
                  <select className="border rounded px-2 py-2" value={lType} onChange={e=>setLType(e.target.value)}>
                    <option value="">All Types</option>
                    <option value="Sick">Sick</option>
                    <option value="Remote">Remote</option>
                    <option value="Vacation">Vacation</option>
                  </select>
                  <select className="border rounded px-2 py-2" value={lStatus} onChange={e=>setLStatus(e.target.value)}>
                    <option value="">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                  <input type="date" className="border rounded px-2 py-2" value={lFrom} onChange={e=>setLFrom(e.target.value)} />
                  <span className="text-text-secondary">to</span>
                  <input type="date" className="border rounded px-2 py-2" value={lTo} onChange={e=>setLTo(e.target.value)} />
                  <button onClick={loadLeaves} className="ml-auto px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">Apply</button>
                </div>

                <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-text-secondary">
                        <th className="p-2">Employee</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Start</th>
                        <th className="p-2">End</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Reason</th>
                        {role==='super' && <th className="p-2">Branch</th>}
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {leaves.map(l => (
                        <tr key={l.id}>
                          <td className="p-2 font-semibold text-text-primary">{l.employee_email}</td>
                          <td className="p-2">{l.type || '-'}</td>
                          <td className="p-2">{l.start_date || '-'}</td>
                          <td className="p-2">{l.end_date || '-'}</td>
                          <td className="p-2">{l.status || '-'}</td>
                          <td className="p-2">{l.reason || '-'}</td>
                          {role==='super' && <td className="p-2">{l.branch || '-'}</td>}
                          <td className="p-2 text-right">
                            {isAdmin ? (
                              <div className="inline-flex items-center gap-2">
                                <button onClick={()=>updateLeaveStatus(l.id, 'Approved')} className="text-green-600 hover:underline">Approve</button>
                                <button onClick={()=>updateLeaveStatus(l.id, 'Rejected')} className="text-red-600 hover:underline">Reject</button>
                              </div>
                            ) : (
                              <span className="text-text-secondary">View only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {leaves.length===0 && (
                        <tr><td colSpan={role==='super'?8:7} className="p-4 text-center text-text-secondary">No leaves</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Time Record tab: CRUD + filters */}
            {tab==='timerecord' && (
              <div className="mt-6 space-y-3">
                <div className="bg-white border rounded-lg shadow-sm p-3 flex flex-wrap items-center gap-2">
                  <input className="border rounded px-3 py-2 w-full md:w-64" placeholder="Filter by employee email" value={tEmail} onChange={e=>setTEmail(e.target.value)} />
                  <input type="date" className="border rounded px-2 py-2" value={tFrom} onChange={e=>setTFrom(e.target.value)} />
                  <span className="text-text-secondary">to</span>
                  <input type="date" className="border rounded px-2 py-2" value={tTo} onChange={e=>setTTo(e.target.value)} />
                  <button onClick={loadTimeRecords} className="px-3 py-2 rounded border">Apply</button>
                  {isAdmin && <button onClick={openAddTR} className="ml-auto px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">+ Add Record</button>}
                </div>

                <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-text-secondary">
                        <th className="p-2">Date</th>
                        <th className="p-2">Employee</th>
                        <th className="p-2">Check-in</th>
                        <th className="p-2">Check-out</th>
                        <th className="p-2">Hours</th>
                        <th className="p-2">Overtime</th>
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {trs.map(r => (
                        <tr key={r.id}>
                          <td className="p-2">{r.work_date}</td>
                          <td className="p-2 font-semibold text-text-primary">{r.employee_email}</td>
                          <td className="p-2">{r.check_in ? new Date(r.check_in).toLocaleTimeString() : '-'}</td>
                          <td className="p-2">{r.check_out ? new Date(r.check_out).toLocaleTimeString() : '-'}</td>
                          <td className="p-2">{r.hours ?? '-'}</td>
                          <td className="p-2">{r.overtime ?? '-'}</td>
                          <td className="p-2 text-right">
                            {isAdmin ? (
                              <>
                                <button onClick={()=>openEditTR(r)} className="text-blue-600 hover:underline mr-3">Edit</button>
                                <button onClick={()=>deleteTR(r.id)} className="text-red-600 hover:underline">Delete</button>
                              </>
                            ) : (
                              <span className="text-text-secondary">View only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {trs.length===0 && (
                        <tr><td colSpan={7} className="p-4 text-center text-text-secondary">No records</td></tr>
                      )}


                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payroll tab: batches, generate, and items */}
            {tab==='payroll' && (
              <div className="mt-6 space-y-3">
                <div className="bg-white border rounded-lg shadow-sm p-3 flex flex-wrap items-center gap-2">
                  <select className="border rounded px-2 py-2" value={pyMonth} onChange={e=>setPyMonth(Number(e.target.value))}>
                    {Array.from({length:12}).map((_,i)=> <option key={i+1} value={i+1}>{i+1}</option>)}
                  </select>
                  <input type="number" className="border rounded px-2 py-2 w-28" value={pyYear} onChange={e=>setPyYear(Number(e.target.value))} />
                  {isAdmin && <button onClick={generatePayroll} className="ml-auto px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">Generate Payroll</button>}
                </div>

                <div className="bg-white border rounded-lg shadow-sm">
                  <div className="p-3 text-lg font-semibold">Batches</div>
                  <div className="divide-y">
                    {payrollBatches.map(b => (
                      <div key={b.id} className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold">{b.year}-{String(b.month).padStart(2,'0')}</div>
                          {b.branch && <div className="text-sm text-text-secondary">Branch: {b.branch}</div>}
                          <button onClick={()=>{ setActiveBatchId(b.id); loadBatchItems(b.id); }} className="ml-auto text-blue-600 hover:underline">View</button>
                        </div>
                        {activeBatchId===b.id && (
                          <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr className="text-left text-text-secondary">
                                  <th className="p-2">Employee</th>
                                  <th className="p-2">Amount</th>
                                  <th className="p-2 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {batchItems.map(it => (
                                  <tr key={it.id}>
                                    <td className="p-2 font-semibold text-text-primary">{it.employee_email}</td>
                                    <td className="p-2">{it.payable_amount ?? 0}</td>
                                    <td className="p-2 text-right">
                                      <button onClick={()=>printPayslip(it)} className="text-[#ffa332] hover:underline">Print Payslip</button>
                                    </td>
                                  </tr>
                                ))}
                                {batchItems.length===0 && (
                                  <tr><td colSpan={3} className="p-4 text-center text-text-secondary">No items</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                    {payrollBatches.length===0 && (
                      <div className="p-4 text-center text-text-secondary">No payroll batches</div>
                    )}
                  </div>
                </div>
              </div>
            )}


          </section>
        </div>
      </main>

      {/* Add/Edit Employee Modal */}
      {showEmpModal && editRow && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <form onSubmit={(e)=>{e.preventDefault(); onSave();}} className="bg-white rounded-lg border shadow-lg p-4 w-[92%] max-w-xl space-y-3">
            <div className="text-lg font-semibold">{editRow?.email ? 'Edit Employee' : 'Add Employee'}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Full name</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editRow.full_name||''} onChange={e=>setEditRow({...editRow, full_name: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-semibold">Email</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editRow.email} onChange={e=>setEditRow({...editRow, email: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-semibold">Branch</label>
                {role==='super' ? (
                  <input className="mt-1 w-full border rounded px-2 py-1" value={editRow.branch||''} onChange={e=>setEditRow({...editRow, branch: e.target.value})} />
                ) : (
                  <input className="mt-1 w-full border rounded px-2 py-1 bg-gray-50" value={myBranch||''} disabled />
                )}
              </div>
              <div>
                <label className="text-sm font-semibold">Role</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editRow.role||''} onChange={e=>setEditRow({...editRow, role: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-semibold">Department</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editRow.department||''} onChange={e=>setEditRow({...editRow, department: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-semibold">Designation</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editRow.designation||''} onChange={e=>setEditRow({...editRow, designation: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-semibold">Joining Date</label>
                <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={editRow.joining_date||''} onChange={e=>setEditRow({...editRow, joining_date: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-semibold">Status</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editRow.status||''} onChange={e=>setEditRow({...editRow, status: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={()=>{setShowEmpModal(false); setEditRow(null);}} className="px-3 py-2 rounded border">Cancel</button>
              {isAdmin && <button className="px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">Save</button>}
            </div>
          </form>
        </div>
      )}
      {/* Add/Edit Time Record Modal */}
      {showTRModal && editTR && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <form onSubmit={(e)=>{e.preventDefault(); saveTR();}} className="bg-white rounded-lg border shadow-lg p-4 w-[92%] max-w-xl space-y-3">
            <div className="text-lg font-semibold">{editTR.id? 'Edit Time Record' : 'Add Time Record'}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Employee Email</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editTR.employee_email} onChange={e=>setEditTR({...editTR, employee_email: e.target.value})} required />
              </div>
              <div>
                <label className="text-sm font-semibold">Date</label>
                <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={editTR.work_date} onChange={e=>setEditTR({...editTR, work_date: e.target.value})} required />
              </div>
              {role==='super' && (
                <div>
                  <label className="text-sm font-semibold">Branch</label>
                  <input className="mt-1 w-full border rounded px-2 py-1" value={editTR.branch||''} onChange={e=>setEditTR({...editTR, branch: e.target.value})} />
                </div>
              )}
              <div>
                <label className="text-sm font-semibold">Check-in</label>
                <input type="datetime-local" className="mt-1 w-full border rounded px-2 py-1" value={editTR.check_in || ''} onChange={e=>setEditTR({...editTR, check_in: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-semibold">Check-out</label>
                <input type="datetime-local" className="mt-1 w-full border rounded px-2 py-1" value={editTR.check_out || ''} onChange={e=>setEditTR({...editTR, check_out: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-semibold">Hours</label>
                <input type="number" step="0.1" className="mt-1 w-full border rounded px-2 py-1" value={editTR.hours ?? ''} onChange={e=>setEditTR({...editTR, hours: e.target.value===''? null : Number(e.target.value)})} />
              </div>
              <div>
                <label className="text-sm font-semibold">Overtime</label>
                <input type="number" step="0.1" className="mt-1 w-full border rounded px-2 py-1" value={editTR.overtime ?? ''} onChange={e=>setEditTR({...editTR, overtime: e.target.value===''? null : Number(e.target.value)})} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={()=>{setShowTRModal(false); setEditTR(null);}} className="px-3 py-2 rounded border">Cancel</button>
              {isAdmin && <button className="px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">Save</button>}
            </div>
          </form>
        </div>
      )}

    </>
  );
};

export default HRMPage;

