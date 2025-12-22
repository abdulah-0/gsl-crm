/**
 * @fileoverview Super Admin Dashboard
 * 
 * Comprehensive analytics and management dashboard for Super Admins.
 * Provides organization-wide insights, performance metrics, and administrative controls.
 * 
 * **Key Features:**
 * - Branch performance analytics
 * - Employee performance tracking
 * - Case pipeline visualization (13 stages)
 * - Financial overview and cash flow
 * - Revenue growth charts
 * - Recent activities feed
 * - Student communication summary
 * - Branch management (CRUD)
 * - Case management
 * - Real-time updates across all metrics
 * 
 * **Metrics Tracked:**
 * - Visa successes
 * - Cases issued (monthly)
 * - In-progress cases
 * - Revenue (monthly)
 * - Cash in/out
 * - Branch revenue distribution
 * - Employee success rates
 * 
 * **Case Stages:**
 * Initial Stage, Offer Applied, Offer Received, Fee Paid, Interview,
 * CAS Applied, CAS Received, Visa Applied, Visa Received, Enrollment,
 * Not Enrolled, Backout, Visa Rejected
 * 
 * @module pages/SuperAdmin
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';

// Types
interface StatCard { label: string; value: number | string; delta?: number; prefix?: string; suffix?: string; }
interface EmployeePerf { id: string; name: string; cases: number; successRate: number; active: number; status: 'Active' | 'Inactive'; }
interface Activity { id: string; text: string; at: string; }

const CASE_STAGES = [
  'Initial Stage', 'Offer Applied', 'Offer Received', 'Fee Paid', 'Interview',
  'CAS Applied', 'CAS Received', 'Visa Applied', 'Visa Received', 'Enrollment', 'Not Enrolled', 'Backout', 'Visa Rejected',
] as const;

type CaseStage = typeof CASE_STAGES[number];

interface CaseItem { id: string; student: string; branch: string; type: string; employee: string; status: CaseStage; createdAt?: string; email?: string; }


const normalizeCaseStage = (row: { stage?: string | null; status?: string | null; type?: string | null }): CaseStage => {
  const stageVal = (row.stage || '').toString().trim();
  if (stageVal) {
    const match = CASE_STAGES.find(s => s.toLowerCase() === stageVal.toLowerCase());
    if (match) return match;
  }
  const status = (row.status || '').toString();
  const type = (row.type || '').toString();
  if (status.toLowerCase().includes('completed')) return 'Visa Received';
  if (type.toLowerCase().includes('visa')) return 'Visa Applied';
  if (type.toLowerCase().includes('cas')) return 'CAS Applied';
  if (type.toLowerCase().includes('offer') && status.toLowerCase().includes('appl')) return 'Offer Applied';
  return 'Initial Stage';
};

// Realtime state (replaces mocks)
const BRANCHES = ['All Branches', 'F-8 Branch', 'I-8 Branch', 'PWD Branch', 'Peshawar Branch'] as const;

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

const HBar = ({ pct, color = '#3b82f6', name, label }: { pct: number; color?: string; name: string; label?: string }) => (
  <div className="flex items-center gap-2">
    <span className="w-28 text-sm text-text-secondary truncate">{name}</span>
    <div className="flex-1 bg-gray-100 rounded h-2">
      <div className="h-2 rounded" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
    <span className="text-xs text-text-secondary w-16 text-right">{label ?? `${pct}%`}</span>
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
  const [outflow, setOutflow] = useState<number[]>([]);

  const [cashIn, setCashIn] = useState<number>(0);
  const [cashOut, setCashOut] = useState<number>(0);


  const [branchRev, setBranchRev] = useState<{ name: string; pct: number }[]>([]);


  // Student Communication (realtime tasks summary)
  const [commCounts, setCommCounts] = useState<{ pending: number; completed: number }>({ pending: 0, completed: 0 });


  // Branches management state
  const [branchesList, setBranchesList] = useState<Array<{ id: string; branch_name: string; branch_code: string }>>([]);
  const [brName, setBrName] = useState('');
  const [brCode, setBrCode] = useState('');
  const [brSaving, setBrSaving] = useState(false);
  const [brError, setBrError] = useState<string | null>(null);
  const [branchesSchema, setBranchesSchema] = useState<'modern' | 'legacy' | 'unknown'>('unknown');

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('id, branch_name, branch_code')
          .order('branch_name', { ascending: true });
        if (error) throw error;
        if (data) { setBranchesList(data as any); setBranchesSchema('modern'); }
      } catch (err) {
        // Fallback for older schema with columns "name" and "code"
        try {
          const { data, error } = await supabase
            .from('branches')
            .select('id, name, code')
            .order('name', { ascending: true });
          if (!error && data) {
            const mapped = (data as any[]).map(r => ({ id: r.id, branch_name: r.name, branch_code: r.code }));
            setBranchesList(mapped as any);
            setBranchesSchema('legacy');
          }
        } catch { }
      }
    })();

    // Realtime: keep branches list in sync across tabs
    const chan = supabase
      .channel('public:branches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, async () => {
        try {
          const { data, error } = await supabase
            .from('branches')
            .select('id, branch_name, branch_code')
            .order('branch_name', { ascending: true });
          if (!error && data) { setBranchesList(data as any); setBranchesSchema('modern'); return; }
        } catch { }
        try {
          const { data } = await supabase
            .from('branches')
            .select('id, name, code')
            .order('name', { ascending: true });
          const mapped = ((data as any[]) || []).map((r: any) => ({ id: r.id, branch_name: r.name, branch_code: r.code }));
          setBranchesList(mapped as any);
          setBranchesSchema('legacy');
        } catch { }
      })
      .subscribe();
    return () => { try { supabase.removeChannel(chan); } catch { } };

  }, []);

  const addBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrError(null);
    const name = brName.trim();
    const code = brCode.trim();
    if (!name || !code) { setBrError('Both Branch Name and Branch Code are required'); return; }
    setBrSaving(true);
    try {
      const { data: au } = await supabase.auth.getUser();
      const created_by = (au as any)?.user?.email || null;

      // Build robust payload attempts: try both sets first, then modern, then legacy, then mixed
      const payloads: any[] = [
        { branch_name: name, branch_code: code, name, code, created_by },
        { branch_name: name, branch_code: code, name, code },
        { branch_name: name, branch_code: code, created_by },
        { branch_name: name, branch_code: code },
        { name, code, created_by },
        { name, code },
        { branch_name: name, code, created_by },
        { branch_name: name, code },
        { name, branch_code: code, created_by },
        { name, branch_code: code },
      ];

      let ins: any = { data: null, error: null };
      for (const p of payloads) {
        ins = await supabase
          .from('branches')
          .insert([p])
          .select('*')
          .single();
        if (!ins.error) break;
        // If RLS/permission error, no need to continue
        const msg = (ins.error.message || '').toLowerCase();
        if (msg.includes('row level security') || msg.includes('permission')) break;
      }

      if (ins.error) {
        const msg = ins.error.message || '';
        if (msg.toLowerCase().includes('row level security')) {
          setBrError('Only Super Admin can add branches. Please ensure your profile role is Super Admin.');
        } else {
          setBrError(msg);
        }
        setBrSaving(false);
        return;
      }

      const inserted = ins.data as any;
      const mapped = {
        id: inserted.id,
        branch_name: inserted.branch_name ?? inserted.name,
        branch_code: inserted.branch_code ?? inserted.code,
      } as any;

      setBranchesList(prev => [...prev, mapped].sort((a, b) => (a.branch_name || '').localeCompare(b.branch_name || '')));
      setBrName(''); setBrCode('');
    } catch (er: any) {
      const msg = er?.message || '';
      if (msg.toLowerCase().includes('row level security')) {
        setBrError('Only Super Admin can add branches. Please ensure your profile role is Super Admin.');
      } else {
        setBrError(msg || 'Failed to add branch');
      }
    } finally { setBrSaving(false); }
  };

  const deleteBranch = async (id: string) => {
    const ok = window.confirm('Delete this branch? This cannot be undone.');
    if (!ok) return;
    try {
      const { error } = await supabase.from('branches').delete().eq('id', id);
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('row level security')) {
          alert('Only Super Admin can delete branches. Please ensure your profile role is Super Admin.');
        } else {
          alert(`Failed to delete branch: ${error.message}`);
        }
        return;
      }
      setBranchesList(prev => prev.filter(b => b.id !== id));
    } catch (er: any) {
      alert(er?.message || 'Failed to delete branch');
    }
  };

  // New Case modal state
  const [showAddCase, setShowAddCase] = useState(false);
  const [formStudent, setFormStudent] = useState('');
  const [formBranch, setFormBranch] = useState('IG Branch');
  const [formType, setFormType] = useState<'Visa' | 'Fee' | 'CAS' | 'Completed'>('Visa');
  const [formEmployee, setFormEmployee] = useState('');
  const [formStatus, setFormStatus] = useState<CaseStage>('Initial Stage');
  const [savingCase, setSavingCase] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Case modal state
  const [showEditCase, setShowEditCase] = useState(false);
  const [editCaseId, setEditCaseId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      // Cases (for recent list, pipeline, employees performance, stat cards)
      let { data: cases, error: casesErr } = await supabase
        .from('dashboard_cases')
        .select('id, title, branch, type, stage, employee, status, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (casesErr) {
        // fallback if stage column doesn't exist in older schemas
        const res2 = await supabase
          .from('dashboard_cases')
          .select('id, title, branch, type, employee, status, created_at')
          .order('created_at', { ascending: false })
          .limit(200);
        cases = res2.data as any;
      }
      const casesRows = cases ?? [];
      const casesWithStage = (casesRows as any[]).map((c) => ({
        ...c,
        _stage: normalizeCaseStage(c),
      }));

      setRecentCases(casesWithStage.map((c: any) => ({
        id: String(c.id),
        student: c.title,
        branch: c.branch ?? '—',
        type: c.type ?? 'Visa',
        employee: c.employee ?? '—',
        status: c._stage as CaseStage,
        createdAt: c.created_at,
        email: c.email ?? undefined
      })));

      // Employees performance derived from cases
      const byEmp = new Map<string, { cases: number; completed: number; active: number }>();
      for (const c of casesWithStage) {
        const name = (c as any).employee ?? 'Unassigned';
        const stat = byEmp.get(name) || { cases: 0, completed: 0, active: 0 };
        stat.cases += 1;
        const stage = (c as any)._stage as CaseStage;
        if (stage === 'Visa Received') stat.completed += 1;
        if (stage !== 'Visa Received' && stage !== 'Backout' && stage !== 'Visa Rejected') stat.active += 1;
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

      // Pipeline by stage (11 stages) with branch filtering
      const pipelineStages = CASE_STAGES;
      const stageColors: Record<CaseStage, string> = {
        'Initial Stage': '#f59e0b',
        'Offer Applied': '#06b6d4',
        'Offer Received': '#0ea5e9',
        'Fee Paid': '#84cc16',
        'Interview': '#a855f7',
        'CAS Applied': '#3b82f6',
        'CAS Received': '#60a5fa',
        'Visa Applied': '#16a34a',
        'Visa Received': '#22c55e',
        'Enrollment': '#14b8a6',
        'Not Enrolled': '#9ca3af',
        'Backout': '#f97316',
        'Visa Rejected': '#ef4444',
      };
      const casesForPipeline = branch === 'All Branches'
        ? casesWithStage
        : casesWithStage.filter((c: any) => (c.branch || '') === branch);
      const counts = new Map<string, number>();
      for (const s of pipelineStages) counts.set(s, 0);
      for (const c of casesForPipeline) {
        const stage = (c as any)._stage as CaseStage;
        const key = pipelineStages.includes(stage) ? stage : 'Initial Stage';
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      const pipelineArr = pipelineStages.map((name) => ({ name, value: counts.get(name) || 0, color: stageColors[name] }));
      setPipeline(pipelineArr);
      setMaxPipeline(Math.max(1, ...pipelineArr.map(p => p.value)));

      // Vouchers for finance-derived stats
      const yearStart = new Date(new Date().getFullYear(), 0, 1);
      const { data: vouchers } = await supabase
        .from('vouchers')
        .select('amount, vtype, branch, occurred_at')
        .gte('occurred_at', yearStart.toISOString());
      const vouchersRows = vouchers ?? [];

      // Cash flow series (last 9 months)
      const now = new Date();
      const monthsArr: string[] = [];
      const revenueArr: number[] = [];
      const outArr: number[] = [];
      for (let i = 8; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthsArr.push(fmtMonth(d));
        const incomes = vouchersRows
          .filter((v: any) => {
            const vd = new Date(v.occurred_at);
            return vd.getFullYear() === d.getFullYear() && vd.getMonth() === d.getMonth();
          })
          .filter((v: any) => ['cash_in', 'online', 'bank'].includes(v.vtype))
          .reduce((acc: number, v: any) => acc + Number(v.amount || 0), 0);
        const outs = vouchersRows
          .filter((v: any) => {
            const vd = new Date(v.occurred_at);
            return vd.getFullYear() === d.getFullYear() && vd.getMonth() === d.getMonth();
          })
          .filter((v: any) => v.vtype === 'cash_out')
          .reduce((acc: number, v: any) => acc + Math.abs(Number(v.amount || 0)), 0);
        revenueArr.push(Number((incomes / 1000).toFixed(1))); // in k
        outArr.push(Number((outs / 1000).toFixed(1))); // in k
      }
      setMonths(monthsArr);
      setRevenue(revenueArr);
      setOutflow(outArr);

      // Cash snapshot (current month)
      const cur = new Date();
      const inSum = vouchersRows
        .filter((v: any) => {
          const vd = new Date(v.occurred_at);
          return vd.getFullYear() === cur.getFullYear() && vd.getMonth() === cur.getMonth();
        })
        .reduce((acc: number, v: any) => acc + (['cash_in', 'online', 'bank'].includes(v.vtype) ? Number(v.amount || 0) : 0), 0);
      const outSum = vouchersRows
        .filter((v: any) => {
          const vd = new Date(v.occurred_at);
          return vd.getFullYear() === cur.getFullYear() && vd.getMonth() === cur.getMonth();
        })
        .reduce((acc: number, v: any) => acc + (v.vtype === 'cash_out' ? Math.abs(Number(v.amount || 0)) : 0), 0);
      setCashIn(inSum);
      setCashOut(outSum);

      // Branch revenue (current month) normalized to % of max
      const byBranch = new Map<string, number>();
      for (const v of vouchersRows) {
        const vd = new Date(v.occurred_at);
        if (vd.getFullYear() !== cur.getFullYear() || vd.getMonth() !== cur.getMonth()) continue;
        if (!['cash_in', 'online', 'bank'].includes(v.vtype)) continue;
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
      const inProgress = (casesWithStage as any[]).filter((c: any) => {
        const stage = c._stage as CaseStage;
        return stage !== 'Visa Received' && stage !== 'Backout' && stage !== 'Visa Rejected';
      }).length;
      const visaSuccess = (casesWithStage as any[]).filter((c: any) => {
        const stage = c._stage as CaseStage;
        return (c.type || '').toString().toLowerCase().includes('visa') && stage === 'Visa Received';
      }).length;
      const revenueK = Number((inSum / 1000).toFixed(1));
      setStatCards([
        { label: 'Visa Successes', value: visaSuccess, delta: 0 },
        { label: 'Cases Issued', value: monthIssued, delta: 0 },
        { label: 'In Progress Cases', value: inProgress, delta: 0 },
        { label: 'Revenue', value: revenueK, prefix: 'Rs ', suffix: 'k', delta: 0 },
      ]);

      // Student Communication counts (tasks across cases)
      const { count: pending } = await supabase
        .from('dashboard_tasks')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Todo', 'In Progress', 'In Review']);
      const { count: completed } = await supabase
        .from('dashboard_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Done');
      setCommCounts({ pending: pending || 0, completed: completed || 0 });
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
    const tChan = supabase
      .channel('public:dashboard_tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dashboard_tasks' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(cChan);
      supabase.removeChannel(vChan);
      supabase.removeChannel(aChan);
      supabase.removeChannel(tChan);
    };
  }, []);

  const filteredEmployees = useMemo(() => {
    if (branch === 'All Branches') return employeesPerf;
    const namesInBranch = new Set(recentCases.filter(rc => rc.branch === branch).map(rc => rc.employee));
    return employeesPerf.filter(e => namesInBranch.has(e.name));
  }, [employeesPerf, recentCases, branch]);

  const netFlow = cashIn - cashOut;
  const maxRev = Math.max(...revenue, 1);
  const maxOut = Math.max(...outflow, 1);

  const handleNewCase = () => {
    setFormStudent('');
    setFormBranch('IG Branch');
    setFormType('Visa');
    setFormEmployee('');
    setFormStatus('Initial Stage');
    setFormError(null);
    setShowAddCase(true);
  };

  const saveNewCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudent.trim()) { setFormError('Student name is required'); return; }
    setSavingCase(true);
    const { data, error } = await supabase
      .from('dashboard_cases')
      .insert([{ title: formStudent.trim(), branch: formBranch, type: formType, employee: formEmployee.trim(), status: formStatus, stage: formStatus }])
      .select('id, case_number, title, branch, type, employee, status, stage, created_at')
      .single();
    setSavingCase(false);
    if (error) { setFormError(error.message); return; }
    if (data) {
      const stage = normalizeCaseStage(data as any);
      setRecentCases(prev => [{ id: String(data.id), student: data.title, branch: data.branch ?? '—', type: data.type ?? 'Visa', employee: data.employee ?? '—', status: stage }, ...prev]);
      // Log activity (fire-and-forget)
      await supabase.from('activity_log').insert([{ entity: 'dashboard_case', action: `Created case ${data.case_number} for ${formStudent.trim()} in ${formBranch}`, detail: { case_number: data.case_number, student: formStudent.trim(), branch: formBranch } }]);
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
      .update({ title: formStudent.trim(), branch: formBranch, type: formType, employee: formEmployee.trim(), status: formStatus, stage: formStatus })
      .eq('id', editCaseId)
      .select('id, title, branch, type, employee, status, stage, created_at')
      .single();
    setSavingCase(false);
    if (error) { setFormError(error.message); return; }
    if (data) {
      const stage = normalizeCaseStage(data as any);
      setRecentCases(prev => prev.map(rc => rc.id === String(data.id)
        ? { id: String(data.id), student: data.title, branch: data.branch ?? '—', type: data.type ?? 'Visa', employee: data.employee ?? '—', status: stage }
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

            {/* Top Summary Cards (KPIs) */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {statCards.map((s) => (
                <div key={s.label} className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
                  <div className="text-sm text-text-secondary">{s.label}</div>
                  <div className="mt-1 flex items-end gap-2">
                    <div className={`text-2xl font-bold ${s.label.includes('Revenue') ? 'text-purple-600' : s.label.includes('Visa') ? 'text-emerald-600' : ''}`}>
                      {s.prefix ?? ''}{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}{s.suffix ?? ''}
                    </div>
                    {typeof s.delta === 'number' && (
                      <span className={`text-xs font-semibold ${s.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {s.delta >= 0 ? '▲' : '▼'} {Math.abs(s.delta)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Branch Performance (Tabs + Table) */}
            <div className="mt-8 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a]">
              <div className="p-4 flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-xl font-bold text-text-primary">Branch Performance</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  {['F-8 Branch', 'I-8 Branch', 'PWD Branch', 'Peshawar Branch'].map(b => (
                    <button key={b} onClick={() => setBranch(b as any)} className={`px-3 py-1 rounded-full border ${branch === b ? 'bg-orange-50 border-[#ffa332] text-[#ffa332]' : 'hover:bg-gray-50'}`}>{b}</button>
                  ))}
                </div>
              </div>
              <div className="px-4 pb-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-text-secondary">
                    <tr className="grid grid-cols-12 px-2 py-2">
                      <th className="col-span-4 text-left font-medium">Employee</th>
                      <th className="col-span-2 text-left font-medium">Cases Handled</th>
                      <th className="col-span-2 text-left font-medium">Success Rate</th>
                      <th className="col-span-2 text-left font-medium">Activities</th>
                      <th className="col-span-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredEmployees.map((e, idx) => (
                      <tr key={e.id} className="grid grid-cols-12 items-center px-2 py-3">
                        {/* Employee (avatar + name + role) */}
                        <td className="col-span-4 flex items-center gap-3">
                          <img src="/images/img_image.svg" alt="avatar" className="w-8 h-8 rounded-full" />
                          <div>
                            <div className="font-medium">{e.name}</div>
                            <div className="text-xs text-text-secondary">Case Manager</div>
                          </div>
                        </td>
                        <td className="col-span-2">{e.cases}</td>
                        {/* Success Rate with colored badge */}
                        <td className="col-span-2">
                          <span className={`px-2 py-0.5 text-xs rounded ${e.successRate >= 70 ? 'bg-emerald-100 text-emerald-700' : e.successRate >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-700'}`}>{e.successRate}%</span>
                        </td>
                        <td className="col-span-2">{e.active}</td>
                        <td className="col-span-2">
                          <span className={`px-2 py-0.5 text-xs rounded ${e.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>{e.status}</span>
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
                  <h2 className="text-xl font-bold text-text-primary">Revenue growth (Jan  Jun)</h2>
                </div>
                <div className="mt-2">
                  <svg viewBox="0 0 300 120" className="w-full h-36">
                    <polyline points="0,90 50,80 100,85 150,70 200,55 250,40" stroke="#8b5cf6" strokeWidth="3" fill="none" />
                    {[[0, 90], [50, 80], [100, 85], [150, 70], [200, 55], [250, 40]].map((p, i) => (
                      <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#8b5cf6" />
                    ))}
                  </svg>
                  <div className="mt-2 flex items-center justify-between text-xs text-text-secondary">
                    <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
                <h2 className="text-xl font-bold text-text-primary">Financial Snapshot (This Month)</h2>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span>Cash In</span><span className="font-semibold">Rs {cashIn.toLocaleString()}</span></div>
                  <div className="flex items-center justify-between"><span>Cash Out</span><span className="font-semibold">Rs {Math.abs(cashOut).toLocaleString()}</span></div>
                  <div className="flex items-center justify-between"><span>Net Flow</span><span className={`font-semibold ${cashIn - Math.abs(cashOut) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Rs {(cashIn - Math.abs(cashOut)).toLocaleString()}</span></div>
                </div>
              </div>
            </div>

            {/* Student Communication + Accounts Overview */}
            <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Student Communication */}
              <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
                <h2 className="text-xl font-bold text-text-primary">Student Communication</h2>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-yellow-50 flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-yellow-700">Pending Tasks</div>
                      <div className="text-yellow-800">{commCounts.pending} pending across student cases</div>
                    </div>
                    <span className="text-yellow-700 font-semibold">!</span>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-50 flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-emerald-700">Completed Tasks</div>
                      <div className="text-emerald-800">{commCounts.completed} done</div>
                    </div>
                    <span className="text-emerald-700 font-semibold">✓</span>
                  </div>
                </div>
                <div className="mt-3 text-xs text-text-secondary">Realtime: updates as tasks change in Cases.</div>
              </div>
              {/* Accounts Overview */}
              <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
                <h2 className="text-xl font-bold text-text-primary">Accounts Overview</h2>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="bg-gray-50 rounded p-3">
                    <div className="text-text-secondary">Cash In (Today)</div>
                    <div className="text-lg font-bold text-emerald-600">Rs 2,45,000</div>
                  </div>
                  <div className="bg-gray-50 rounded p-3">
                    <div className="text-text-secondary">Cash Out (Today)</div>
                    <div className="text-lg font-bold text-red-600">Rs 85,000</div>
                  </div>
                  <div className="bg-gray-50 rounded p-3">
                    <div className="text-text-secondary">Net Flow</div>
                    <div className="text-lg font-bold">Rs 1,60,000</div>
                  </div>
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
                  <div className="col-span-2">Stage</div>
                  <div className="col-span-2">Assigned To</div>
                  <div className="col-span-2">Last Update</div>
                  <div className="col-span-1 text-right">Actions</div>
                </div>
                <div className="divide-y">
                  {recentCases.map(c => (
                    <div key={c.id} className="grid grid-cols-12 items-center px-2 py-3">
                      {/* Student (avatar + name + email) */}
                      <div className="col-span-3 flex items-center gap-3">
                        <img src="/images/img_image.svg" alt="avatar" className="w-8 h-8 rounded-full" />


                        <div>
                          <div className="font-medium">{c.student}</div>
                          <div className="text-xs text-text-secondary">{c.email || 'student@example.com'}</div>
                        </div>
                      </div>
                      <div className="col-span-2">{c.branch}</div>
                      <div className="col-span-2">
                        <span className={`px-2 py-0.5 text-xs rounded ${c.type === 'Visa' ? 'bg-emerald-100 text-emerald-700' : c.type === 'CAS' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-800'}`}>{c.type}</span>
                      </div>
                      <div className="col-span-2">{c.employee}</div>
                      <div className="col-span-2">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</div>
                      <div className="col-span-1 flex items-center justify-end gap-2">
                        <button onClick={() => openEditCase(c)} className="text-[11px] text-purple-700 hover:underline">View</button>
                        <button onClick={() => openEditCase(c)} className="text-[11px] text-blue-600 hover:underline">Edit</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Charts */}
            <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Cash Flow (last 9 months) */}
              <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
                <h2 className="text-xl font-bold text-text-primary mb-3">Cash Flow (Last 9 Months)</h2>
                <div className="space-y-3">
                  {months.map((m, idx) => (
                    <div key={m + idx} className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="w-12 text-sm text-text-secondary">{m}</span>
                        <div className="flex-1">
                          <Bar pct={(revenue[idx] / Math.max(maxRev, 1)) * 100} color="#22c55e" label={`Rs ${revenue[idx]}k`} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-12" />
                        <div className="flex-1">
                          <Bar pct={(outflow[idx] / Math.max(maxOut, 1)) * 100} color="#ef4444" label={`Rs ${outflow[idx]}k`} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Branch Revenue comparison */}
              <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
                <h2 className="text-xl font-bold text-text-primary mb-3">Branch Revenue</h2>
                <div className="space-y-3">
                  {branchRev.map((b, i) => (
                    <HBar key={b.name + i} name={b.name} pct={b.pct} color={i === 0 ? '#22c55e' : i === 1 ? '#f59e0b' : '#3b82f6'} label={`${b.pct}%`} />
                  ))}
                </div>
              </div>
            </div>

            {/* Branches Management */}
            <div className="mt-8 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-text-primary">Branches</h2>
              </div>
              <form onSubmit={addBranch} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <label className="text-sm">
                  <span className="text-text-secondary">Branch Code</span>
                  <input value={brCode} onChange={e => setBrCode(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="e.g., IG" />
                </label>
                <label className="text-sm">
                  <span className="text-text-secondary">Branch Name</span>
                  <input value={brName} onChange={e => setBrName(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="e.g., IG Branch" />
                </label>
                <div className="flex items-end">
                  <button type="submit" disabled={brSaving} className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold shadow-[0px_6px_12px_#3f8cff43] w-full">
                    {brSaving ? 'Adding...' : 'Add Branch'}
                  </button>
                </div>
              </form>
              {brError && <div className="mt-2 text-red-600 text-sm">{brError}</div>}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-text-secondary">
                    <tr className="grid grid-cols-12 px-2 py-2">
                      <th className="col-span-3 text-left font-medium">Code</th>
                      <th className="col-span-7 text-left font-medium">Name</th>
                      <th className="col-span-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {branchesList.map(b => (
                      <tr key={b.id} className="grid grid-cols-12 items-center px-2 py-2">
                        <td className="col-span-3">{b.branch_code}</td>
                        <td className="col-span-7">{b.branch_name}</td>
                        <td className="col-span-2 text-right">
                          <button onClick={() => deleteBranch(b.id)} className="text-[11px] text-red-600 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                    {branchesList.length === 0 && (
                      <tr className="grid grid-cols-12 items-center px-2 py-3 text-text-secondary">
                        <td className="col-span-12">No branches yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
              <button type="button" onClick={() => setShowAddCase(false)} className="text-text-secondary hover:opacity-70">✕</button>
            </div>
            {formError && <div className="mt-3 text-red-600 text-sm">{formError}</div>}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="text-text-secondary">Student</span>
                <input value={formStudent} onChange={e => setFormStudent(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="Student full name" required />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Branch</span>
                <select value={formBranch} onChange={e => setFormBranch(e.target.value)} className="mt-1 w-full border rounded p-2">
                  <option>IG Branch</option>
                  <option>PWD Branch</option>
                  <option>Peshawar Branch</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Type</span>
                <select value={formType} onChange={e => setFormType(e.target.value as any)} className="mt-1 w-full border rounded p-2">
                  <option>Visa</option>
                  <option>Fee</option>
                  <option>CAS</option>
                  <option>Completed</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Assigned To</span>
                <input value={formEmployee} onChange={e => setFormEmployee(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="Employee name" />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Stage</span>
                <select value={formStatus} onChange={e => setFormStatus(e.target.value as CaseStage)} className="mt-1 w-full border rounded p-2">
                  {CASE_STAGES.map(stage => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowAddCase(false)} className="px-3 py-2 rounded border hover:bg-gray-50">Cancel</button>


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
              <button type="button" onClick={() => setShowEditCase(false)} className="text-text-secondary hover:opacity-70">✕</button>
            </div>
            {formError && <div className="mt-3 text-red-600 text-sm">{formError}</div>}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="text-text-secondary">Student</span>
                <input value={formStudent} onChange={e => setFormStudent(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="Student full name" required />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Branch</span>
                <select value={formBranch} onChange={e => setFormBranch(e.target.value)} className="mt-1 w-full border rounded p-2">
                  <option>IG Branch</option>
                  <option>PWD Branch</option>
                  <option>Peshawar Branch</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Type</span>
                <select value={formType} onChange={e => setFormType(e.target.value as any)} className="mt-1 w-full border rounded p-2">
                  <option>Visa</option>
                  <option>Fee</option>
                  <option>CAS</option>
                  <option>Completed</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Assigned To</span>
                <input value={formEmployee} onChange={e => setFormEmployee(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="Employee name" />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Stage</span>
                <select value={formStatus} onChange={e => setFormStatus(e.target.value as CaseStage)} className="mt-1 w-full border rounded p-2">
                  {CASE_STAGES.map(stage => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowEditCase(false)} className="px-3 py-2 rounded border hover:bg-gray-50">Cancel</button>
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

