import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';

// Types
interface StatCard { label: string; value: number | string; delta?: number; prefix?: string; suffix?: string; }
interface EmployeePerf { id: string; name: string; cases: number; successRate: number; active: number; status: 'Active' | 'Inactive'; }
interface Activity { id: string; text: string; at: string; }
interface CaseItem { id: string; student: string; branch: string; type: string; employee: string; status: 'Pending' | 'In Progress' | 'Completed'; }

// Mock data
const STAT_CARDS: StatCard[] = [
  { label: 'Visa Successes', value: 124, delta: 12 },
  { label: 'Cases Issued', value: 342, delta: 5 },
  { label: 'In Progress Cases', value: 87, delta: -3 },
  { label: 'Revenue', value: 18.6, prefix: '$', suffix: 'k', delta: 9 },
];

const EMPLOYEES: EmployeePerf[] = [
  { id: 'e1', name: 'Evan Yates', cases: 58, successRate: 82, active: 9, status: 'Active' },
  { id: 'e2', name: 'Ayesha Khan', cases: 49, successRate: 76, active: 12, status: 'Active' },
  { id: 'e3', name: 'John Doe', cases: 32, successRate: 64, active: 7, status: 'Inactive' },
  { id: 'e4', name: 'Sana Tariq', cases: 61, successRate: 88, active: 10, status: 'Active' },
  { id: 'e5', name: 'Amir Ali', cases: 27, successRate: 58, active: 3, status: 'Active' },
];

const ACTIVITIES: Activity[] = [
  { id: 'a1', text: 'Visa approved for Ahmed Khan (IG Branch)', at: '2025-09-23T10:32:00Z' },
  { id: 'a2', text: 'CAS submitted for Fatima Ali (PWD Branch)', at: '2025-09-23T09:10:00Z' },
  { id: 'a3', text: 'Fee payment pending for Usman Raza (DHA Branch)', at: '2025-09-22T16:48:00Z' },
  { id: 'a4', text: 'New case created for Zara Iqbal (IG Branch)', at: '2025-09-22T13:15:00Z' },
];

const RECENT_CASES: CaseItem[] = [
  { id: 'c1', student: 'Ahmed Khan', branch: 'IG Branch', type: 'Visa', employee: 'Evan Yates', status: 'Completed' },
  { id: 'c2', student: 'Fatima Ali', branch: 'PWD Branch', type: 'CAS', employee: 'Ayesha Khan', status: 'In Progress' },
  { id: 'c3', student: 'Usman Raza', branch: 'DHA Branch', type: 'Fee', employee: 'John Doe', status: 'Pending' },
  { id: 'c4', student: 'Zara Iqbal', branch: 'IG Branch', type: 'Visa', employee: 'Sana Tariq', status: 'In Progress' },
  { id: 'c5', student: 'Bilal Ahmed', branch: 'PWD Branch', type: 'Completed', employee: 'Amir Ali', status: 'Completed' },
];

const BRANCHES = ['All Branches', 'IG Branch', 'PWD Branch', 'DHA Branch'] as const;

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

  const filteredEmployees = useMemo(() => {
    // For mock, just return all; could filter by branch mapping
    return EMPLOYEES;
  }, [branch]);

  // Pipeline mock
  const pipeline = [
    { name: 'Visa', value: 48, color: '#16a34a' },
    { name: 'Fee', value: 35, color: '#f59e0b' },
    { name: 'CAS', value: 29, color: '#3b82f6' },
    { name: 'Completed', value: 62, color: '#8b5cf6' },
  ];
  const maxPipeline = Math.max(...pipeline.map(p => p.value));

  // Financial overview (monthly revenue in k)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep'];
  const revenue = [8, 9.5, 10, 12.2, 11.4, 13.8, 15.2, 17.5, 18.6];
  const maxRev = Math.max(...revenue);

  // Cash snapshot
  const cashIn = 125000; // current month
  const cashOut = 73000;
  const netFlow = cashIn - cashOut;

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
              {STAT_CARDS.map((s) => {
                const isRev = s.label === 'Revenue';
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
                  {ACTIVITIES.map(a => (
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
                  <div className="bg-gray-50 rounded p-3"><div className="text-text-secondary">Cash In</div><div className="text-lg font-bold">$125,000</div></div>
                  <div className="bg-gray-50 rounded p-3"><div className="text-text-secondary">Cash Out</div><div className="text-lg font-bold">$73,000</div></div>
                  <div className="bg-gray-50 rounded p-3"><div className="text-text-secondary">Net Flow</div><div className="text-lg font-bold text-emerald-600">+$52,000</div></div>
                </div>
              </div>
            </div>

            {/* Recent Cases */}
            <div className="mt-8 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a]">
              <div className="p-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-text-primary">Recent Cases</h2>
                <button className="px-4 py-2 rounded-full font-bold text-white bg-[#ffa332] shadow-[0px_6px_12px_#3f8cff43] hover:opacity-95">+ New Case</button>
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
                  {RECENT_CASES.map(c => (
                    <div key={c.id} className="grid grid-cols-12 items-center px-2 py-3">
                      <div className="col-span-3">{c.student}</div>
                      <div className="col-span-2">{c.branch}</div>
                      <div className="col-span-2">{c.type}</div>
                      <div className="col-span-3">{c.employee}</div>
                      <div className="col-span-2"><span className={`px-2 py-0.5 text-xs rounded ${c.status==='Completed'?'bg-emerald-100 text-emerald-700': c.status==='In Progress'?'bg-blue-100 text-blue-700':'bg-yellow-100 text-yellow-800'}`}>{c.status}</span></div>
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
                  <HBar name="IG Branch" pct={78} color="#22c55e" />
                  <HBar name="PWD Branch" pct={64} color="#f59e0b" />
                  <HBar name="DHA Branch" pct={52} color="#3b82f6" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export default SuperAdmin;

