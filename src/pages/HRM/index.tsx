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

            {/* Time Record tab: skeleton */}
            {tab==='timerecord' && (
              <div className="mt-6 bg-white border rounded-lg shadow-sm p-4">
                <div className="text-lg font-semibold">Time Record</div>
                <div className="text-sm text-text-secondary">Track attendance, check-in/out, hours and overtime. Filters and export coming soon.</div>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-text-secondary">
                        <th className="p-2">Date</th>
                        <th className="p-2">Employee</th>
                        <th className="p-2">Check-in</th>
                        <th className="p-2">Check-out</th>
                        <th className="p-2">Hours</th>
                        <th className="p-2">Overtime</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr><td colSpan={6} className="p-4 text-center text-text-secondary">No records</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payroll tab: skeleton */}
            {tab==='payroll' && (
              <div className="mt-6 bg-white border rounded-lg shadow-sm p-4">
                <div className="text-lg font-semibold">Payroll</div>
                <div className="text-sm text-text-secondary">Manage salary generation and payslips. Editing and reports coming soon.</div>
                <div className="mt-2 text-text-secondary text-sm">No payroll batches yet.</div>
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
    </>
  );
};

export default HRMPage;

