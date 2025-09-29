import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { supabase } from '../../lib/supabaseClient';

// Simple number bar
const Dot: React.FC<{ color: string }> = ({ color }) => (
  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
);

const BRANCHES = ['All Branches', 'F-8 Branch', 'I-8 Branch', 'PWD Branch', 'Peshawar Branch'] as const;

const timeAgo = (d: string | Date) => {
  const t = typeof d === 'string' ? new Date(d) : d;
  const diffMs = Date.now() - t.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs===1?'':'s'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days===1?'':'s'} ago`;
};

interface CaseRow { id: string; title: string; branch?: string; status?: string; created_at?: string; }
interface ActivityRow { id: string; action: string; created_at: string; }

const ConsultantDashboard: React.FC = () => {
  const [branch, setBranch] = useState<typeof BRANCHES[number]>('All Branches');
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: casesData } = await supabase
        .from('dashboard_cases')
        .select('id, title, branch, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      if (!cancelled && casesData) setCases(casesData as any);

      const { data: actData } = await supabase
        .from('activity_log')
        .select('id, action, created_at')
        .order('created_at', { ascending: false })
        .limit(7);
      if (!cancelled && actData) setActivities(actData as any);
    };
    load();
    const casesCh = supabase
      .channel('public:dashboard_cases:consultant')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dashboard_cases' }, load)
      .subscribe();
    const actCh = supabase
      .channel('public:activity_log:consultant')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, load)
      .subscribe();
    return () => { supabase.removeChannel(casesCh); supabase.removeChannel(actCh); cancelled = true; };
  }, []);

  const filteredCases = useMemo(() => {
    if (branch === 'All Branches') return cases;
    return cases.filter(c => c.branch === branch);
  }, [cases, branch]);

  // Active cases by stage (simple mapping)
  const stageCounts = useMemo(() => {
    const counts = { initial: 0, cas: 0, visa: 0 };
    for (const c of filteredCases) {
      const s = (c.status || '').toLowerCase();
      if (s.includes('initial')) counts.initial++;
      else if (s.includes('cas')) counts.cas++;
      else if (s.includes('visa')) counts.visa++;
    }
    return counts;
  }, [filteredCases]);

  // Employee performance demo data (static – can be wired later)
  const employees = [
    { name: 'Ayesha Khan', role: 'Consultant', cases: 34, successRate: 86 },
    { name: 'Bilal Ahmed', role: 'Consultant', cases: 28, successRate: 72 },
    { name: 'Sara Iqbal', role: 'Associate', cases: 19, successRate: 65 },
  ];

  // Branch metrics demo data (static per spec)
  const branchMetrics = [
    { label: 'Active Cases', value: '156' },
    { label: 'Success Rate', value: '89%' },
    { label: 'Revenue', value: 'Rs 45K' },
    { label: 'Staff', value: '12' },
  ];

  return (
    <>
      <Helmet>
        <title>Consultant Dashboard</title>
      </Helmet>
      <main className="w-full min-h-screen bg-background-main flex">
        {/* Sidebar */}
        <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
        {/* Content */}
        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          {/* Title */}
          <div className="mt-8 lg:mt-12">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-text-primary">Consultant Dashboard</h1>
          </div>

          {/* KPIs */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
              <div className="text-sm text-text-secondary">Visa Success</div>
              <div className="mt-1 flex items-end gap-2">
                <div className="text-2xl font-bold text-emerald-600">87%</div>
                <span className="text-xs font-semibold text-emerald-600">+5% from last month</span>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
              <div className="text-sm text-text-secondary">CAS Issued</div>
              <div className="mt-1 flex items-end gap-2">
                <div className="text-2xl font-bold">245</div>
                <span className="text-xs font-semibold text-orange-500">+12 this week</span>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
              <div className="text-sm text-text-secondary">In Progress</div>
              <div className="mt-1 flex items-end gap-2">
                <div className="text-2xl font-bold text-text-primary">156</div>
                <span className="text-xs font-semibold text-orange-500">new cases</span>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
              <div className="text-sm text-text-secondary">Total Students</div>
              <div className="mt-1 flex items-end gap-2">
                <div className="text-2xl font-bold text-purple-600">50</div>
                <span className="text-xs font-semibold text-text-secondary">This month</span>
              </div>
            </div>
          </div>

          {/* Branch Performance */}
          <div className="mt-8 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a]">
            <div className="p-4 flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-xl font-bold text-text-primary">Branch Performance</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {BRANCHES.slice(1).map(b => (
                  <button key={b} onClick={()=>setBranch(b)} className={`px-3 py-1 rounded-full border ${branch===b ? 'bg-orange-50 border-[#ffa332] text-[#ffa332]' : 'hover:bg-gray-50'}`}>{b}</button>
                ))}
              </div>
            </div>
            <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Employee Performance */}
              <div>
                <h3 className="text-lg font-bold text-text-primary mb-3">Employee Performance</h3>
                <div className="grid grid-cols-12 text-sm font-semibold text-text-secondary mb-2">
                  <div className="col-span-6">Employee</div>
                  <div className="col-span-3">Cases</div>
                  <div className="col-span-3">Success</div>
                </div>
                <div className="divide-y">
                  {employees.map((e, idx) => (
                    <div key={idx} className="grid grid-cols-12 items-center py-2">
                      <div className="col-span-6 flex items-center gap-3">
                        <img src="/images/img_image.svg" alt="avatar" className="w-8 h-8 rounded-full" />
                        <div>
                          <div className="font-medium">{e.name}</div>
                          <div className="text-xs text-text-secondary">{e.role}</div>
                        </div>
                      </div>
                      <div className="col-span-3"><span className="px-2 py-0.5 text-xs rounded bg-gray-100">{e.cases}</span></div>
                      <div className="col-span-3">
                        <span className={`px-2 py-0.5 text-xs rounded ${e.successRate>=70?'bg-emerald-100 text-emerald-700': e.successRate>=40? 'bg-yellow-100 text-yellow-800':'bg-red-100 text-red-700'}`}>{e.successRate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Branch Metrics */}
              <div>
                <h3 className="text-lg font-bold text-text-primary mb-3">Branch Metrics</h3>
                <div className="grid grid-cols-2 gap-3">
                  {branchMetrics.map((m) => (
                    <div key={m.label} className="bg-gray-50 rounded p-3">
                      <div className="text-text-secondary">{m.label}</div>
                      <div className={`text-lg font-bold ${m.label==='Revenue'?'text-purple-600':''}`}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Cases + Quick Actions */}
          <div className="mt-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Recent Cases */}
            <div className="xl:col-span-2 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-text-primary">Recent Cases</h2>
              </div>
              <div className="divide-y">
                {filteredCases.slice(0,6).map((c) => {
                  const stage = (c.status||'').toLowerCase().includes('cas') ? 'CAS Stage' : (c.status||'').toLowerCase().includes('visa') ? 'Visa Stage' : (c.status||'').toLowerCase().includes('completed') ? 'Completed' : 'Initial Stage';
                  const stageClass = stage==='Visa Stage' ? 'bg-emerald-100 text-emerald-700' : stage==='CAS Stage' ? 'bg-yellow-100 text-yellow-800' : stage==='Completed' ? 'bg-gray-100 text-gray-700' : 'bg-orange-100 text-orange-800';
                  return (
                    <div key={c.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{c.title}</div>
                        <div className="text-xs text-text-secondary">{c.branch || '—'} • {timeAgo(c.created_at || new Date())}</div>
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded whitespace-nowrap ${stageClass}`}>{stage}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
              <h2 className="text-xl font-bold text-text-primary mb-3">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <a href="/cases" className="border rounded-lg p-3 text-center hover:bg-gray-50">New Case</a>
                <a href="/finances" className="border rounded-lg p-3 text-center hover:bg-gray-50">Generate Voucher</a>
                <a href="/messenger" className="border rounded-lg p-3 text-center hover:bg-gray-50">Send Update</a>
                <a href="/reports" className="border rounded-lg p-3 text-center hover:bg-gray-50">View Reports</a>
              </div>
            </div>
          </div>

          {/* Active Cases by Stage + Recent Activities */}
          <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Active by Stage */}
            <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-text-primary">Active Cases (By Stage)</h2>
                <select value={branch} onChange={(e)=>setBranch(e.target.value as any)} className="border rounded-lg p-1 text-sm">
                  {BRANCHES.map(b => (<option key={b}>{b}</option>))}
                </select>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Dot color="#f59e0b" /><span>Initial Stage</span></div>
                  <div className="font-semibold">{stageCounts.initial}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Dot color="#eab308" /><span>CAS Stage</span></div>
                  <div className="font-semibold">{stageCounts.cas}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Dot color="#22c55e" /><span>Visa Stage</span></div>
                  <div className="font-semibold">{stageCounts.visa}</div>
                </div>
              </div>
            </div>

            {/* Recent Activities */}
            <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
              <h2 className="text-xl font-bold text-text-primary mb-3">Recent Activities</h2>
              <div className="space-y-3">
                {activities.map((a) => {
                  const low = a.action.toLowerCase();
                  const color = low.includes('approved') ? '#22c55e' : low.includes('uploaded') ? '#ef4444' : '#f59e0b';
                  return (
                    <div key={a.id} className="flex items-start gap-3">
                      <Dot color={color} />
                      <div className="flex-1">
                        <div className="font-semibold">{a.action}</div>
                        <div className="text-xs text-text-secondary">{timeAgo(a.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default ConsultantDashboard;

