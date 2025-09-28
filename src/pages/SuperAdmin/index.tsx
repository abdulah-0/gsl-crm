import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';

// Types
interface StatCard { label: string; value: number | string; delta?: number; prefix?: string; suffix?: string; }
interface EmployeePerf { id: string; name: string; cases: number; successRate: number; active: number; status: 'Active' | 'Inactive'; }
interface Activity { id: string; text: string; at: string; }
interface CaseItem { id: string; student: string; branch: string; type: string; employee: string; status: 'Pending' | 'In Progress' | 'Completed'; }

// Realtime state (replaces mocks)
const BRANCHES = ['All Branches', 'IG Branch', 'PWD Branch', 'DHA Branch'] as const;

const fmtMonth = (d: Date) => d.toLocaleString(undefined, { month: 'short' });


// Simple number bar for charts
const Bar = ({ pct, color = '#ffa332', label }: { pct: number; color?: string; label?: string }) => (
  <div className="flex items-center gap-2 w-full">
    <div className="flex-1 bg-gray-100 rounded h-2">
      <div className="h-2 rounded" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }} />
    </div>
    {label && <span className="text-xs text-text-secondary min-w-[56px] text-right">{label}</span>}
  </div>
);

const HBar = ({ pct, color = '#3b82f6', name }: { pct: number; color?: string; name: string }) => (
  <div className="flex items-center gap-2">
    <span className="w-28 text-sm text-text-secondary truncate">{name}</span>
    <div className="flex-1 bg-gray-100 rounded h-2">
      <div className="h-2 rounded" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
    <span className="text-xs text-text-secondary w-10 text-right">{pct}%</span>
  </div>
);

const SuperAdmin: React.FC = () => {
  const [branch, setBranch] = useState<typeof BRANCHES[number]>('All Branches');

  const [employeesPerf, setEmployeesPerf] = useState<EmployeePerf[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [recentCases, setRecentCases] = useState<CaseItem[]>([]);
  const [statCards, setStatCards] = useState<StatCard[]>([]);

  const [pipeline, setPipeline] = useState<{ name: string; value: number; color: string }[]>([]);
  const [maxPipeline, setMaxPipeline] = useState<number>(1);

  const [months, setMonths] = useState<string[]>([]);
  const [revenue, setRevenue] = useState<number[]>([]);

  const [cashIn, setCashIn] = useState<number>(0);
  const [cashOut, setCashOut] = useState<number>(0);


  const [branchRev, setBranchRev] = useState<{ name: string; pct: number }[]>([]);

  // New Case modal state
  const [showAddCase, setShowAddCase] = useState(false);
  const [formStudent, setFormStudent] = useState('');
  const [formBranch, setFormBranch] = useState('IG Branch');
  const [formType, setFormType] = useState<'Visa' | 'Fee' | 'CAS' | 'Completed'>('Visa');
  const [formEmployee, setFormEmployee] = useState('');
  const [formStatus, setFormStatus] = useState<'Pending' | 'In Progress' | 'Completed'>('In Progress');
  const [savingCase, setSavingCase] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Case modal state
  const [showEditCase, setShowEditCase] = useState(false);
  const [editCaseId, setEditCaseId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      // Cases (for recent list, pipeline, employees performance, stat cards)
      const { data: cases, error: casesErr } = await supabase
        .from('dashboard_cases')
        .select('id, title, branch, type, employee, status, created_at')
        .order('created_at', { ascending: false })
        .limit(25);
      const casesRows = cases ?? [];

      setRecentCases(casesRows.map((c: any) => ({
        id: String(c.id),
        student: c.title,
        branch: c.branch ?? '—',
        type: c.type ?? 'Visa',
        employee: c.employee ?? '—',
        status: c.status ?? 'Pending'
      })));

      // Employees performance derived from cases
      const byEmp = new Map<string, { cases: number; completed: number; active: number }>();
      for (const c of casesRows) {
        const name = c.employee ?? 'Unassigned';
        const stat = byEmp.get(name) || { cases: 0, completed: 0, active: 0 };
        stat.cases += 1;
        if (c.status === 'Completed') stat.completed += 1;
        if (c.status === 'In Progress') stat.active += 1;
        byEmp.set(name, stat);
      }
      const empPerf: EmployeePerf[] = Array.from(byEmp.entries()).map(([name, v], idx) => ({
        id: String(idx + 1),
        name,
        cases: v.cases,
        successRate: v.cases ? Math.round((v.completed / v.cases) * 100) : 0,
        active: v.active,
        status: v.active > 0 ? 'Active' : 'Inactive'
      }));
      setEmployeesPerf(empPerf);

      // Pipeline by case type
      const typeColors: Record<string, string> = { Visa: '#16a34a', Fee: '#f59e0b', CAS: '#3b82f6', Completed: '#8b5cf6' };
      const byType = new Map<string, number>();
      for (const c of casesRows) {
        const t = c.type ?? 'Visa';
        byType.set(t, (byType.get(t) || 0) + 1);
      }
      const pipelineArr = Array.from(byType.entries()).map(([name, value]) => ({ name, value, color: typeColors[name] || '#ffa332' }));
      setPipeline(pipelineArr);
      setMaxPipeline(Math.max(1, ...pipelineArr.map(p => p.value)));

      // Vouchers for finance-derived stats
      const yearStart = new Date(new Date().getFullYear(), 0, 1);
      const { data: vouchers } = await supabase
        .from('vouchers')
        .select('amount, vtype, branch, occurred_at')
        .gte('occurred_at', yearStart.toISOString());
      const vouchersRows = vouchers ?? [];

      // Revenue series (last 9 months)
      const now = new Date();
      const monthsArr: string[] = [];
      const revenueArr: number[] = [];
      for (let i = 8; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthsArr.push(fmtMonth(d));
        const monthSum = vouchersRows
          .filter((v: any) => {
            const vd = new Date(v.occurred_at);
            return vd.getFullYear() === d.getFullYear() && vd.getMonth() === d.getMonth();
          })
          .filter((v: any) => ['cash_in', 'online', 'bank'].includes(v.vtype))
          .reduce((acc: number, v: any) => acc + Number(v.amount || 0), 0);
        revenueArr.push(Number((monthSum / 1000).toFixed(1))); // in k
      }
      setMonths(monthsArr);
      setRevenue(revenueArr);

      // Cash snapshot (current month)
      const cur = new Date();
      const inSum = vouchersRows
        .filter((v: any) => {
          const vd = new Date(v.occurred_at);
          return vd.getFullYear() === cur.getFullYear() && vd.getMonth() === cur.getMonth();
        })
        .reduce((acc: number, v: any) => acc + (['cash_in','online','bank'].includes(v.vtype) ? Number(v.amount || 0) : 0), 0);
      const outSum = vouchersRows
        .filter((v: any) => {
          const vd = new Date(v.occurred_at);
          return vd.getFullYear() === cur.getFullYear() && vd.getMonth() === cur.getMonth();
        })
        .reduce((acc: number, v: any) => acc + (v.vtype === 'cash_out' ? Number(v.amount || 0) : 0), 0);
      setCashIn(inSum);
      setCashOut(outSum);

      // Branch revenue (current month) normalized to % of max
      const byBranch = new Map<string, number>();
      for (const v of vouchersRows) {
        const vd = new Date(v.occurred_at);
        if (vd.getFullYear() !== cur.getFullYear() || vd.getMonth() !== cur.getMonth()) continue;
        if (!['cash_in','online','bank'].includes(v.vtype)) continue;
        const key = v.branch || 'Unknown';
        byBranch.set(key, (byBranch.get(key) || 0) + Number(v.amount || 0));
      }
      const maxBranch = Math.max(1, ...Array.from(byBranch.values()));
      setBranchRev(Array.from(byBranch.entries()).map(([name, val]) => ({ name, pct: Math.round((val / maxBranch) * 100) })));

      // Activities
      const { data: acts } = await supabase
        .from('activity_log')
        .select('id, action, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      setActivities((acts ?? []).map((a: any) => ({ id: String(a.id), text: a.action, at: a.created_at })));

      // Stat cards
      const monthIssued = casesRows.filter((c: any) => {
        const d = new Date(c.created_at);
        const cur2 = new Date();
        return d.getFullYear() === cur2.getFullYear() && d.getMonth() === cur2.getMonth();
      }).length;
      const inProgress = casesRows.filter((c: any) => c.status === 'In Progress').length;
      const visaSuccess = casesRows.filter((c: any) => c.type === 'Visa' && c.status === 'Completed').length;
      const revenueK = Number((inSum / 1000).toFixed(1));
      setStatCards([
        { label: 'Visa Successes', value: visaSuccess, delta: 0 },
        { label: 'Cases Issued', value: monthIssued, delta: 0 },
        { label: 'In Progress Cases', value: inProgress, delta: 0 },
        { label: 'Revenue', value: revenueK, prefix: '$', suffix: 'k', delta: 0 },
      ]);
    };

    load();

    const cChan = supabase
      .channel('public:dashboard_cases')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dashboard_cases' }, () => load())
      .subscribe();
    const vChan = supabase
      .channel('public:vouchers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vouchers' }, () => load())
      .subscribe();
    const aChan = supabase
      .channel('public:activity_log')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(cChan);
      supabase.removeChannel(vChan);
      supabase.removeChannel(aChan);
    };
  }, []);

  const filteredEmployees = useMemo(() => {
    if (branch === 'All Branches') return employeesPerf;
    const namesInBranch = new Set(recentCases.filter(rc => rc.branch === branch).map(rc => rc.employee));
    return employeesPerf.filter(e => namesInBranch.has(e.name));
  }, [employeesPerf, recentCases, branch]);

  const netFlow = cashIn - cashOut;
  const maxRev = Math.max(...revenue, 1);

  const handleNewCase = () => {
    setFormStudent('');
    setFormBranch('IG Branch');
    setFormType('Visa');
    setFormEmployee('');
    setFormStatus('In Progress');
    setFormError(null);
    setShowAddCase(true);
  };

  const saveNewCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudent.trim()) { setFormError('Student name is required'); return; }
    setSavingCase(true);
    const caseNumber = `PN${Date.now()}`;
    const { data, error } = await supabase
      .from('dashboard_cases')
      .insert([{ case_number: caseNumber, title: formStudent.trim(), branch: formBranch, type: formType, employee: formEmployee.trim(), status: formStatus }])
      .select('id, title, branch, type, employee, status, created_at')
      .single();
    setSavingCase(false);
    if (error) { setFormError(error.message); return; }
    if (data) {
      setRecentCases(prev => [{ id: String(data.id), student: data.title, branch: data.branch ?? '—', type: data.type ?? 'Visa', employee: data.employee ?? '—', status: data.status ?? 'Pending' }, ...prev]);
      // Log activity (fire-and-forget)
      await supabase.from('activity_log').insert([{ entity: 'dashboard_case', action: `Created case ${caseNumber} for ${formStudent.trim()} in ${formBranch}`, detail: { case_number: caseNumber, student: formStudent.trim(), branch: formBranch } }]);
    }
    setShowAddCase(false);
  };

  const openEditCase = (c: CaseItem) => {
    setFormStudent(c.student);
    setFormBranch(c.branch || 'IG Branch');
    setFormType(c.type as any);
    setFormEmployee(c.employee || '');
    setFormStatus(c.status as any);
    setFormError(null);
    setEditCaseId(c.id);
    setShowEditCase(true);
  };

  const saveEditCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCaseId) return;
    if (!formStudent.trim()) { setFormError('Student name is required'); return; }
    setSavingCase(true);
    const { data, error } = await supabase
      .from('dashboard_cases')
      .update({ title: formStudent.trim(), branch: formBranch, type: formType, employee: formEmployee.trim(), status: formStatus })
      .eq('id', editCaseId)
      .select('id, title, branch, type, employee, status, created_at')
      .single();
    setSavingCase(false);
    if (error) { setFormError(error.message); return; }
    if (data) {
      setRecentCases(prev => prev.map(rc => rc.id === String(data.id)
        ? { id: String(data.id), student: data.title, branch: data.branch ?? '—', type: data.type ?? 'Visa', employee: data.employee ?? '—', status: data.status ?? 'Pending' }
        : rc
      ));
    }
    setShowEditCase(false);
    setEditCaseId(null);
  };

  const deleteCase = async (c: CaseItem) => {
    const ok = window.confirm(`Delete case for ${c.student}?`);
    if (!ok) return;
    await supabase.from('dashboard_cases').delete().eq('id', c.id);
    setRecentCases(prev => prev.filter(x => x.id !== c.id));
  };

  return (
    <>
      <Helmet>
        <title>Super Admin Dashboard | GSL Pakistan CRM</title>
        <meta name="description" content="Full overview of branches, performance, pipeline, finance and activities for super admins." />
      </Helmet>

      <main className="w-full min-h-screen bg-background-main flex">
        {/* Sidebar */}
        <div className="w-[14%] min-w-[200px] hidden lg:block">
          <Sidebar />
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          {/* Title + quick context */}
          <section className="mt-8 lg:mt-12">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-4xl text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>
              Super Admin Dashboard
            </h1>

            {/* Top stat cards */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {statCards.map((s) => {
                const positive = (s.delta ?? 0) >= 0;
                return (
                  <div key={s.label} className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
                    <div className="text-sm text-text-secondary">{s.label}</div>
                    <div className="mt-1 flex items-end gap-2">
                      <div className="text-2xl font-bold">
                        {s.prefix || ''}{s.value}{s.suffix || ''}
                      </div>
                      {typeof s.delta === 'number' && (
                        <span className={`text-xs font-semibold ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
                          {positive ? '▲' : '▼'} {Math.abs(s.delta)}% vs last month
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Branch Performance */}
            <div className="mt-8 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a]">
              <div className="p-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-text-primary">Branch Performance</h2>
                <div className="flex items-center gap-2">
                  {BRANCHES.map(b => (
                    <button key={b} onClick={()=>setBranch(b)} className={`px-3 py-1 rounded-full border ${branch===b ? 'bg-orange-50 border-[#ffa332] text-[#ffa332]' : 'hover:bg-gray-50'}`}>{b}</button>
                  ))}
                </div>
              </div>
              <div className="px-4 pb-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-text-secondary">
                    <tr className="grid grid-cols-12 px-2 py-2">
                      <th className="col-span-4 text-left font-medium">Employee</th>
                      <th className="col-span-2 text-left font-medium">Cases</th>
                      <th className="col-span-2 text-left font-medium">Success Rate</th>
                      <th className="col-span-2 text-left font-medium">Active Cases</th>
                      <th className="col-span-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredEmployees.map(e => (
                      <tr key={e.id} className="grid grid-cols-12 items-center px-2 py-3">
                        <td className="col-span-4">{e.name}</td>
                        <td className="col-span-2">{e.cases}</td>
                        <td className="col-span-2">{e.successRate}%</td>
                        <td className="col-span-2">{e.active}</td>
                        <td className="col-span-2">
                          <span className={`px-2 py-0.5 text-xs rounded ${e.status==='Active'?'bg-emerald-100 text-emerald-700':'bg-gray-100 text-gray-700'}`}>{e.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pipeline + Activities */}
            <div className="mt-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-bold text-text-primary">Case Pipeline</h2>
                </div>
                <div className="space-y-3">
                  {pipeline.map(p => (
                    <div key={p.name} className="flex items-center gap-3">
                      <span className="w-24 text-sm text-text-secondary">{p.name}</span>
                      <Bar pct={(p.value / maxPipeline) * 100} color={p.color} label={String(p.value)} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
                <h2 className="text-xl font-bold text-text-primary mb-3">Recent Activities</h2>
                <div className="space-y-3">
                  {activities.map(a => (
                    <div key={a.id} className="text-sm">
                      <div className="font-medium">{a.text}</div>
                      <div className="text-xs text-text-secondary">{new Date(a.at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Financial Overview + Cash snapshot */}
            <div className="mt-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-bold text-text-primary">Financial Overview</h2>
                </div>
                <div className="grid grid-cols-9 gap-3 items-end" style={{ height: 160 }}>
                  {revenue.map((v, i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <div className="w-6 bg-[#ffa332] rounded" style={{ height: `${(v / maxRev) * 100}%` }} />
                      <span className="text-xs text-text-secondary">{months[i]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
                <h2 className="text-xl font-bold text-text-primary">Cash Balance</h2>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span>Cash In</span><span className="font-semibold">${cashIn.toLocaleString()}</span></div>
                  <div className="flex items-center justify-between"><span>Cash Out</span><span className="font-semibold">${cashOut.toLocaleString()}</span></div>
                  <div className="flex items-center justify-between"><span>Net Flow</span><span className={`font-semibold ${netFlow>=0?'text-emerald-600':'text-red-600'}`}>{netFlow>=0?'+':''}${netFlow.toLocaleString()}</span></div>
                </div>
              </div>
            </div>

            {/* Student Communication + Accounts Overview */}
            <div className="mt-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
                <h2 className="text-xl font-bold text-text-primary">Student Communication</h2>
                <div className="mt-3 text-sm space-y-2">
                  <div className="flex items-center justify-between"><span>Pending updates</span><span className="font-semibold">14</span></div>
                  <div className="flex items-center justify-between"><span>Emails sent today</span><span className="font-semibold">56</span></div>
                </div>
              </div>
              <div className="xl:col-span-2 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
                <h2 className="text-xl font-bold text-text-primary">Accounts Overview</h2>
                <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-gray-50 rounded p-3"><div className="text-text-secondary">Cash In</div><div className="text-lg font-bold">${cashIn.toLocaleString()}</div></div>
                  <div className="bg-gray-50 rounded p-3"><div className="text-text-secondary">Cash Out</div><div className="text-lg font-bold">${cashOut.toLocaleString()}</div></div>
                  <div className="bg-gray-50 rounded p-3"><div className="text-text-secondary">Net Flow</div><div className={`text-lg font-bold ${netFlow>=0?'text-emerald-600':'text-red-600'}`}>{netFlow>=0?'+':''}${netFlow.toLocaleString()}</div></div>
                </div>
              </div>
            </div>

            {/* Recent Cases */}
            <div className="mt-8 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a]">
              <div className="p-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-text-primary">Recent Cases</h2>
                <button onClick={handleNewCase} className="px-4 py-2 rounded-full font-bold text-white bg-[#ffa332] shadow-[0px_6px_12px_#3f8cff43] hover:opacity-95">+ New Case</button>
              </div>
              <div className="px-4 pb-4 overflow-x-auto text-sm">
                <div className="grid grid-cols-12 text-text-secondary px-2 py-2">
                  <div className="col-span-3">Student</div>
                  <div className="col-span-2">Branch</div>
                  <div className="col-span-2">Case Type</div>
                  <div className="col-span-3">Assigned To</div>
                  <div className="col-span-2">Status</div>
                </div>
                <div className="divide-y">
                  {recentCases.map(c => (
                    <div key={c.id} className="grid grid-cols-12 items-center px-2 py-3">
                      <div className="col-span-3">{c.student}</div>
                      <div className="col-span-2">{c.branch}</div>
                      <div className="col-span-2">{c.type}</div>
                      <div className="col-span-3">{c.employee}</div>
                      <div className="col-span-2 flex items-center justify-between gap-2">
                        <span className={`px-2 py-0.5 text-xs rounded ${c.status==='Completed'?'bg-emerald-100 text-emerald-700': c.status==='In Progress'?'bg-blue-100 text-blue-700':'bg-yellow-100 text-yellow-800'}`}>{c.status}</span>
                        <span className="flex items-center gap-2">
                          <button onClick={()=>openEditCase(c)} className="text-[11px] text-blue-600 hover:underline">Edit</button>
                          <button onClick={()=>deleteCase(c)} className="text-[11px] text-red-600 hover:underline">Delete</button>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Charts */}
            <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Cash Flow by stage */}
              <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
                <h2 className="text-xl font-bold text-text-primary mb-3">Cash Flow by Case Stage</h2>

                <div className="space-y-3">
                  {pipeline.map(p => (
                    <div key={p.name} className="flex items-center gap-3">
                      <span className="w-24 text-sm text-text-secondary">{p.name}</span>
                      <Bar pct={(p.value / maxPipeline) * 100} color={p.color} label={`$${(p.value*1.2).toFixed(1)}k`} />
                    </div>
                  ))}
                </div>
              </div>
              {/* Branch Revenue comparison */}
              <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
                <h2 className="text-xl font-bold text-text-primary mb-3">Branch Revenue</h2>
                <div className="space-y-3">
                  {branchRev.map((b, idx) => (
                    <HBar key={b.name + idx} name={b.name} pct={b.pct} color={idx % 3 === 0 ? '#22c55e' : idx % 3 === 1 ? '#f59e0b' : '#3b82f6'} />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      {/* New Case Modal */}
      {showAddCase && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={saveNewCase} className="bg-white w-full max-w-lg rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">New Case</h3>
              <button type="button" onClick={()=>setShowAddCase(false)} className="text-text-secondary hover:opacity-70">✕</button>
            </div>
            {formError && <div className="mt-3 text-red-600 text-sm">{formError}</div>}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="text-text-secondary">Student</span>
                <input value={formStudent} onChange={e=>setFormStudent(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="Student full name" required />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Branch</span>
                <select value={formBranch} onChange={e=>setFormBranch(e.target.value)} className="mt-1 w-full border rounded p-2">
                  <option>IG Branch</option>
                  <option>PWD Branch</option>
                  <option>DHA Branch</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Type</span>
                <select value={formType} onChange={e=>setFormType(e.target.value as any)} className="mt-1 w-full border rounded p-2">
                  <option>Visa</option>
                  <option>Fee</option>
                  <option>CAS</option>
                  <option>Completed</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Assigned To</span>
                <input value={formEmployee} onChange={e=>setFormEmployee(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="Employee name" />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Status</span>
                <select value={formStatus} onChange={e=>setFormStatus(e.target.value as any)} className="mt-1 w-full border rounded p-2">
                  <option>In Progress</option>
                  <option>Pending</option>
                  <option>Completed</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={()=>setShowAddCase(false)} className="px-3 py-2 rounded border hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={savingCase} className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold shadow-[0px_6px_12px_#3f8cff43]">
                {savingCase ? 'Saving...' : 'Save Case'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Case Modal */}
      {showEditCase && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={saveEditCase} className="bg-white w-full max-w-lg rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Edit Case</h3>
              <button type="button" onClick={()=>setShowEditCase(false)} className="text-text-secondary hover:opacity-70">✕</button>
            </div>
            {formError && <div className="mt-3 text-red-600 text-sm">{formError}</div>}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="text-text-secondary">Student</span>
                <input value={formStudent} onChange={e=>setFormStudent(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="Student full name" required />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Branch</span>
                <select value={formBranch} onChange={e=>setFormBranch(e.target.value)} className="mt-1 w-full border rounded p-2">
                  <option>IG Branch</option>
                  <option>PWD Branch</option>
                  <option>DHA Branch</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Type</span>
                <select value={formType} onChange={e=>setFormType(e.target.value as any)} className="mt-1 w-full border rounded p-2">
                  <option>Visa</option>
                  <option>Fee</option>
                  <option>CAS</option>
                  <option>Completed</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Assigned To</span>
                <input value={formEmployee} onChange={e=>setFormEmployee(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="Employee name" />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Status</span>
                <select value={formStatus} onChange={e=>setFormStatus(e.target.value as any)} className="mt-1 w-full border rounded p-2">
                  <option>In Progress</option>
                  <option>Pending</option>
                  <option>Completed</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={()=>setShowEditCase(false)} className="px-3 py-2 rounded border hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={savingCase} className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold shadow-[0px_6px_12px_#3f8cff43]">
                {savingCase ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

    </>
  );
};

export default SuperAdmin;

