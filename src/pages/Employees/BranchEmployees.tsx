import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';

interface EmpRow {
  email: string;
  full_name?: string | null;
  role?: string | null;
  designation?: string | null;
  status?: string | null;
  branch?: string | null;
}

const BranchEmployeesPage: React.FC = () => {
  const [isSuper, setIsSuper] = useState(false);
  const [myBranch, setMyBranch] = useState<string | null>(null);
  const [rows, setRows] = useState<EmpRow[]>([]);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email || '';
      const { data: du } = await supabase.from('dashboard_users').select('role, branch').eq('email', email).maybeSingle();
      const r = (du?.role || (data.user as any)?.app_metadata?.role || (data.user as any)?.user_metadata?.role || '').toString().toLowerCase();
      setIsSuper(r.includes('super'));
      setMyBranch(du?.branch || null);
    })();
  }, []);

  const loadEmployees = async () => {
    const base = supabase.from('dashboard_users').select('email, full_name, role, designation, status, branch').order('full_name', { ascending: true });
    const { data } = isSuper ? await base : await base.eq('branch', myBranch);
    setRows((data as any) || []);
  };
  useEffect(() => { if (isSuper || myBranch !== null) loadEmployees(); }, [isSuper, myBranch]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return rows.filter(r =>
      (!s || (r.full_name||'').toLowerCase().includes(s) || (r.email||'').toLowerCase().includes(s)) &&
      (!filterRole || (r.role||'').toLowerCase() === filterRole.toLowerCase()) &&
      (!filterStatus || (r.status||'').toLowerCase() === filterStatus.toLowerCase())
    );
  }, [rows, search, filterRole, filterStatus]);

  return (
    <>
      <Helmet><title>Employees - GSL Pakistan CRM</title></Helmet>
      <main className="w-full min-h-screen bg-background-main flex">
        <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          <section className="mt-8 lg:mt-12">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-4xl text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Employees</h1>
            </div>

            <div className="mt-4 bg-white border rounded-lg shadow-sm p-3 flex flex-wrap items-center gap-2">
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
              {!isSuper && myBranch && (
                <div className="ml-auto text-sm text-text-secondary">Branch: <span className="font-semibold text-text-primary">{myBranch}</span></div>
              )}
            </div>

            <div className="mt-4 bg-white border rounded-lg shadow-sm overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-text-secondary">
                    <th className="p-2">Name</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Designation</th>
                    <th className="p-2">Status</th>
                    {isSuper && <th className="p-2">Branch</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(r => (
                    <tr key={r.email}>
                      <td className="p-2 font-semibold text-text-primary">{r.full_name || '-'}</td>
                      <td className="p-2">{r.email}</td>
                      <td className="p-2">{r.role || '-'}</td>
                      <td className="p-2">{r.designation || '-'}</td>
                      <td className="p-2">{r.status || '-'}</td>
                      {isSuper && <td className="p-2">{r.branch || '-'}</td>}
                    </tr>
                  ))}
                  {filtered.length===0 && (
                    <tr><td colSpan={isSuper ? 6 : 5} className="p-4 text-center text-text-secondary">No employees</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-2 text-xs text-text-secondary">Note: Employee management (add/edit/remove) has moved to HRM → Employees.</div>
          </section>
        </div>
      </main>
    </>
  );
};

export default BranchEmployeesPage;

