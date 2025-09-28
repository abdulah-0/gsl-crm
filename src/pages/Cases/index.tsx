import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { supabase } from '../../lib/supabaseClient';

// Types
type Priority = 'Low' | 'Medium' | 'High';
type Status = 'Todo' | 'In Progress' | 'Done';

type Task = {
  id: string;
  name: string;
  estimateMins: number;
  spentMins: number;
  assignee: { name: string; avatar?: string };
  priority: Priority;
  status: Status;
  description?: string;
};

type CaseItem = {
  caseId: string; // e.g., PN001245
  title: string; // e.g., University of ... or Case 1
  estimateMins?: number;
  priority?: Priority;
  assignees: string[];
  active: Task[];
  backlog: Task[];
};

// Utils
const mins = (d: number = 0, h: number = 0, m: number = 0) => d*24*60 + h*60 + m;
const fmtDur = (totalMins: number) => {
  const d = Math.floor(totalMins / (24*60));
  const h = Math.floor((totalMins % (24*60)) / 60);
  const m = totalMins % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || parts.length===0) parts.push(`${m}m`);
  return parts.join(' ');
};

const PRIORITY_STYLES: Record<Priority, { text: string; bg: string; arrow: '↑' | '↓'; border?: string }> = {
  High: { text: 'text-red-700', bg: 'bg-red-100', arrow: '↑', border: 'border-red-200' },
  Medium: { text: 'text-yellow-800', bg: 'bg-yellow-100', arrow: '↑', border: 'border-yellow-200' },
  Low: { text: 'text-emerald-700', bg: 'bg-emerald-100', arrow: '↓', border: 'border-emerald-200' },
};

const STATUS_STYLES: Record<Status, { text: string; bg: string; dot: string }> = {
  'Done': { text: 'text-emerald-700', bg: 'bg-emerald-100', dot: 'bg-emerald-500' },
  'In Progress': { text: 'text-blue-700', bg: 'bg-blue-100', dot: 'bg-blue-500' },
  'Todo': { text: 'text-gray-700', bg: 'bg-gray-100', dot: 'bg-gray-400' },
};

const Cases: React.FC = () => {
  // Realtime cases from Supabase (dashboard_cases)
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('dashboard_cases')
        .select('id, case_number, title, assignees, employee, status, created_at')
        .order('created_at', { ascending: false });
      if (!error) {
        const mapped: CaseItem[] = (data ?? []).map((row: any) => ({
          caseId: row.case_number || String(row.id),
          title: row.title || 'Untitled',
          assignees: Array.isArray(row.assignees) ? row.assignees : (row.employee ? [row.employee] : []),
          active: [],
          backlog: [],
        }));
        setCases(mapped);
        if (!activeCaseId && mapped[0]) setActiveCaseId(mapped[0].caseId);
      }
    };
    load();

    const chan = supabase
      .channel('public:dashboard_cases')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dashboard_cases' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [activeCaseId]);

  // UI state
  const [tab, setTab] = useState<'Active' | 'Backlog'>('Active');
  const [view, setView] = useState<'list' | 'grid' | 'board'>('list');

  // Add Case modal state
  const [showAddCase, setShowAddCase] = useState(false);
  const [formCaseId, setFormCaseId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formAssignees, setFormAssignees] = useState('');
  const [formEstimate, setFormEstimate] = useState(0);
  const [formPriority, setFormPriority] = useState<Priority>('Medium');

  // Task Details modal
  const [selectedTask, setSelectedTask] = useState<{ caseId: string; task: Task } | null>(null);

  const activeCase = useMemo(() => cases.find(c => c.caseId === activeCaseId) || cases[0], [cases, activeCaseId]);
  const tasks = tab === 'Active' ? activeCase?.active || [] : activeCase?.backlog || [];

  const updateTaskStatus = (taskId: string, next: Status) => {
    setCases(prev => prev.map(c => {
      if (c.caseId !== activeCaseId) return c;
      const mapper = (arr: Task[]) => arr.map(t => t.id === taskId ? { ...t, status: next } : t);
      return { ...c, active: mapper(c.active), backlog: mapper(c.backlog) };
    }));
  };

  const addCase = async (e: React.FormEvent) => {
    e.preventDefault();
    const case_number = formCaseId.trim();
    const title = formTitle.trim();
    if (!case_number || !title) return;
    const assignees = formAssignees.split(',').map(s => s.trim()).filter(Boolean);
    const { data, error } = await supabase
      .from('dashboard_cases')
      .insert([{ case_number, title, assignees, status: 'In Progress' }])
      .select('case_number')
      .single();
    if (!error && data) {
      setActiveCaseId(data.case_number);
      setShowAddCase(false);
      setFormCaseId(''); setFormTitle(''); setFormAssignees(''); setFormEstimate(0); setFormPriority('Medium');
    }
  };

  return (
    <>
      <Helmet>
        <title>On Going Cases | GSL Pakistan CRM</title>
        <meta name="description" content="Manage and track ongoing cases, tasks, and assignees." />
      </Helmet>

      <main className="w-full min-h-screen bg-background-main flex">
        {/* App Sidebar (global) */}
        <div className="w-[14%] min-w-[200px] hidden lg:block">
          <Sidebar />
        </div>

        {/* Page content */}
        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          {/* Page Header */}
          <section className="mt-8 lg:mt-12">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-4xl text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>On Going Cases</h1>
              <button onClick={()=>setShowAddCase(true)} className="px-4 py-2 rounded-full font-bold text-white bg-[#ffa332] shadow-[0px_6px_12px_#3f8cff43] hover:opacity-95">
                + Add Case
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Cases Sidebar */}
              <aside className="lg:col-span-4 xl:col-span-3 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold">All Cases</h3>
                  <span className="text-sm text-text-secondary">{cases.length} total</span>
                </div>
                {/* Dropdown filter (mock) */}
                <details className="mb-3">
                  <summary className="cursor-pointer text-sm text-text-secondary select-none">Current Cases</summary>
                  <div className="mt-2 text-xs text-text-muted">Filters coming soon.</div>
                </details>

                <div className="-mx-2 px-2 overflow-y-auto" style={{ maxHeight: '520px' }}>
                  {cases.map((c, idx) => {
                    const active = c.caseId === activeCaseId;
                    return (
                      <div key={c.caseId} className={`mb-2 rounded-lg border ${active ? 'border-[#ffa332] bg-orange-50/30' : 'border-gray-200'} p-3`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs text-text-muted">{c.caseId}</div>
                            <div className="font-semibold">{c.title}</div>
                          </div>
                          <button onClick={()=>setActiveCaseId(c.caseId)} className={`text-xs font-semibold ${active ? 'text-[#ffa332]' : 'text-blue-600'} hover:underline`}>
                            View details &gt;
                          </button>
                        </div>
                        {!active && (
                          <div className="mt-1 text-xs text-text-secondary">{c.assignees.join(', ') || 'Unassigned'}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </aside>

              {/* Tasks Section */}
              <section className="lg:col-span-8 xl:col-span-9 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">Tasks</h3>
                  {/* View toggles */}
                  <div className="flex items-center gap-1">
                    <button onClick={()=>setView('list')} className={`px-2 py-1 rounded ${view==='list'?'bg-gray-100':''}`} aria-label="List view">≣</button>
                    <button onClick={()=>setView('grid')} className={`px-2 py-1 rounded ${view==='grid'?'bg-gray-100':''}`} aria-label="Grid view">▦</button>
                    <button onClick={()=>setView('board')} className={`px-2 py-1 rounded ${view==='board'?'bg-gray-100':''}`} aria-label="Board view">▤</button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="mt-3 flex items-center gap-3 border-b">
                  {['Active','Backlog'].map(t => (
                    <button key={t} onClick={()=>setTab(t as any)} className={`px-3 py-2 -mb-px border-b-2 ${tab===t? 'border-[#ffa332] text-[#ffa332] font-semibold':'border-transparent text-text-secondary'}`}>{t} Tasks</button>
                  ))}
                </div>

                {/* Task list header */}
                <div className="mt-3 grid grid-cols-12 text-xs text-text-secondary px-2">
                  <div className="col-span-4">Task Name</div>
                  <div className="col-span-2">Estimate</div>
                  <div className="col-span-2">Spent</div>
                  <div className="col-span-2">Assignee</div>
                  <div className="col-span-1">Priority</div>
                  <div className="col-span-1 text-right">Status</div>
                </div>

                {/* Task list */}
                <div className="mt-1 divide-y overflow-y-auto" style={{ maxHeight: '520px' }}>
                  {tasks.length === 0 && (
                    <div className="py-8 text-center text-text-secondary">No tasks in this list.</div>
                  )}
                  {tasks.map(task => {
                    const pStyle = PRIORITY_STYLES[task.priority];
                    const sStyle = STATUS_STYLES[task.status];
                    return (
                      <button key={task.id} onClick={()=>setSelectedTask({ caseId: activeCase.caseId, task })} className="w-full text-left py-3 px-2 hover:bg-gray-50">
                        <div className="grid grid-cols-12 items-center gap-2">
                          <div className="col-span-4 flex items-center gap-2">
                            <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${task.status==='Done' ? sStyle.dot : 'border-gray-300'}`}></span>
                            <span className="font-semibold">{task.name}</span>
                          </div>
                          <div className="col-span-2">{fmtDur(task.estimateMins)}</div>
                          <div className="col-span-2">{fmtDur(task.spentMins)}</div>
                          <div className="col-span-2 flex items-center gap-2">
                            <img src={task.assignee.avatar || '/images/img_image.svg'} alt="avatar" className="w-6 h-6 rounded-full" />
                            <span className="text-sm">{task.assignee.name}</span>
                          </div>
                          <div className="col-span-1">
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${pStyle.bg} ${pStyle.text} ${pStyle.border?`border ${pStyle.border}`:''}`}>
                              <span>{pStyle.arrow}</span>
                              <span>{task.priority}</span>
                            </span>
                          </div>
                          <div className="col-span-1 text-right">
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${sStyle.bg} ${sStyle.text}`}>
                              <span className={`w-2 h-2 rounded-full ${sStyle.dot}`}></span>
                              <span>{task.status}</span>
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </section>
        </div>
      </main>

      {/* Add Case Modal */}
      {showAddCase && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={addCase} className="bg-white w-full max-w-lg rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Add Case</h3>
              <button type="button" onClick={()=>setShowAddCase(false)} className="text-text-secondary hover:opacity-70">✕</button>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="text-text-secondary">Case ID</span>
                <input value={formCaseId} onChange={e=>setFormCaseId(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="PN001245" required />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Case Title</span>
                <input value={formTitle} onChange={e=>setFormTitle(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="Case 7" required />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="text-text-secondary">Assignee(s)</span>
                <input value={formAssignees} onChange={e=>setFormAssignees(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="Comma separated" />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Estimate (minutes)</span>
                <input type="number" min={0} value={formEstimate} onChange={e=>setFormEstimate(Number(e.target.value))} className="mt-1 w-full border rounded p-2" />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Priority</span>
                <select value={formPriority} onChange={e=>setFormPriority(e.target.value as Priority)} className="mt-1 w-full border rounded p-2">
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={()=>setShowAddCase(false)} className="px-3 py-2 rounded border hover:bg-gray-50">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold shadow-[0px_6px_12px_#3f8cff43]">Save Case</button>
            </div>
          </form>
        </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-xl rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{selectedTask.task.name}</h3>
              <button type="button" onClick={()=>setSelectedTask(null)} className="text-text-secondary hover:opacity-70">✕</button>
            </div>
            <div className="mt-3 text-sm text-text-secondary">
              <div><strong>Case:</strong> {selectedTask.caseId}</div>
              <div className="mt-1"><strong>Assignee:</strong> {selectedTask.task.assignee.name}</div>
              <div className="mt-1"><strong>Estimate:</strong> {fmtDur(selectedTask.task.estimateMins)}</div>
              <div className="mt-1"><strong>Spent:</strong> {fmtDur(selectedTask.task.spentMins)}</div>
              <div className="mt-1"><strong>Description:</strong> {selectedTask.task.description || '—'}</div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <label className="text-sm">
                <span className="text-text-secondary">Status</span>
                <select value={selectedTask.task.status} onChange={(e)=>{ const v = e.target.value as Status; updateTaskStatus(selectedTask.task.id, v); setSelectedTask(s=> s ? { ...s, task: { ...s.task, status: v } } : s); }} className="ml-2 border rounded p-2">
                  <option>Todo</option>
                  <option>In Progress</option>
                  <option>Done</option>
                </select>
              </label>
            </div>
            <div className="mt-5 text-right">
              <button onClick={()=>setSelectedTask(null)} className="px-3 py-2 rounded border hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Cases;
