import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { supabase } from '../../lib/supabaseClient';

// Types
type Priority = 'Low' | 'Medium' | 'High';
type Status = 'Todo' | 'In Progress' | 'In Review' | 'Done';

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
  title: string; // student/case title
  status?: 'Pending' | 'In Progress' | 'Completed';
  branch?: string;
  type?: string;
  employee?: string;
  assignees: string[];
  createdAt?: string;
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
  'In Review': { text: 'text-purple-700', bg: 'bg-purple-100', dot: 'bg-purple-500' },
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
        .select('id, case_number, title, assignees, employee, status, branch, type, created_at')
        .order('created_at', { ascending: false });
      if (!error) {
        const mapped: CaseItem[] = (data ?? []).map((row: any) => ({
          caseId: row.case_number || String(row.id),
          title: row.title || 'Untitled',
          status: row.status || 'In Progress',
          branch: row.branch || undefined,
          type: row.type || undefined,
          employee: row.employee || undefined,
          assignees: Array.isArray(row.assignees) ? row.assignees : (row.employee ? [row.employee] : []),
          createdAt: row.created_at,
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

  // Filters
  const [filterBranch, setFilterBranch] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterType, setFilterType] = useState<string>('All');
  const [search, setSearch] = useState<string>('');

  // Case Details modal
  const [showCaseDetails, setShowCaseDetails] = useState(false);
  const [detailsCase, setDetailsCase] = useState<CaseItem | null>(null);

  // Add Case modal state
  const [showAddCase, setShowAddCase] = useState(false);
  const [formCaseId, setFormCaseId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formAssignees, setFormAssignees] = useState('');
  const [formEstimate, setFormEstimate] = useState(0);
  const [formPriority, setFormPriority] = useState<Priority>('Medium');

  // Task Details modal
  const [selectedTask, setSelectedTask] = useState<{ caseId: string; task: Task } | null>(null);

  // Derived filters
  const branches = useMemo(() => ['All', ...Array.from(new Set(cases.map(c => c.branch).filter(Boolean))) as string[]], [cases]);
  const types = useMemo(() => ['All', ...Array.from(new Set(cases.map(c => c.type).filter(Boolean))) as string[]], [cases]);
  const statuses = ['All','Pending','In Progress','Completed'];
  const filteredCases = useMemo(() => {
    const term = search.trim().toLowerCase();
    return cases.filter(c => {
      if (filterBranch !== 'All' && c.branch !== filterBranch) return false;
      if (filterType !== 'All' && c.type !== filterType) return false;
      if (filterStatus !== 'All' && (c.status || '') !== filterStatus) return false;
      if (term && !(`${c.caseId}`.toLowerCase().includes(term) || (c.title||'').toLowerCase().includes(term))) return false;
      return true;
    });
  }, [cases, filterBranch, filterType, filterStatus, search]);

  const activeCase = useMemo(() => cases.find(c => c.caseId === activeCaseId) || cases[0], [cases, activeCaseId]);
  const tasks = tab === 'Active' ? activeCase?.active || [] : activeCase?.backlog || [];

  const BOARD_COLUMNS: Status[] = ['Todo', 'In Progress', 'In Review', 'Done'];
  const displayStatus = (s: Status) => (s === 'Todo' ? 'To Do' : s);

  const updateTaskStatus = (taskId: string, next: Status) => {
    setCases(prev => prev.map(c => {
      if (c.caseId !== activeCaseId) return c;
      const mapper = (arr: Task[]) => arr.map(t => t.id === taskId ? { ...t, status: next } : t);
      return { ...c, active: mapper(c.active), backlog: mapper(c.backlog) };
    }));
  };

  const moveTask = (payload: { id: string; from: 'active'|'backlog' }, to: { area: 'active'|'backlog'; status?: Status }) => {
    setCases(prev => prev.map(c => {
      if (!activeCase || c.caseId !== activeCase.caseId) return c;
      let active = [...c.active];
      let backlog = [...c.backlog];
      let task: Task | undefined;
      if (payload.from === 'active') {
        task = active.find(t => t.id === payload.id);
        active = active.filter(t => t.id !== payload.id);
      } else {
        task = backlog.find(t => t.id === payload.id);
        backlog = backlog.filter(t => t.id !== payload.id);
      }
      if (!task) return c;
      if (to.area === 'active') {
        const updated = { ...task, status: to.status ?? task.status } as Task;
        active = [updated, ...active];
      } else {
        const updated = { ...task, status: 'Todo' as Status } as Task;
        backlog = [updated, ...backlog];
      }
      return { ...c, active, backlog };
    }));
  };

  const handleDragStart = (t: Task, from: 'active'|'backlog') => (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: t.id, from }));
  };
  const handleDropToStatus = (status: Status) => (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const payload = JSON.parse(e.dataTransfer.getData('text/plain')) as { id: string; from: 'active'|'backlog' };
      moveTask(payload, { area: 'active', status });
    } catch {}
  };
  const handleDropToBacklog = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const payload = JSON.parse(e.dataTransfer.getData('text/plain')) as { id: string; from: 'active'|'backlog' };
      moveTask(payload, { area: 'backlog' });
    } catch {}
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
                  <span className="text-sm text-text-secondary">{filteredCases.length} total</span>
                </div>

                {/* Filters */}
                <div className="mb-3 grid grid-cols-1 gap-2">
                  <input value={search} onChange={e=>setSearch(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="Search by ID or Title" />
                  <div className="grid grid-cols-3 gap-2">
                    <select value={filterBranch} onChange={e=>setFilterBranch(e.target.value)} className="border rounded p-2 text-sm">
                      {branches.map(b => <option key={b}>{b}</option>)}
                    </select>
                    <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="border rounded p-2 text-sm">
                      {statuses.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <select value={filterType} onChange={e=>setFilterType(e.target.value)} className="border rounded p-2 text-sm">
                      {types.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="text-right">
                    <button type="button" onClick={()=>{ setFilterBranch('All'); setFilterStatus('All'); setFilterType('All'); setSearch(''); }} className="text-xs text-text-secondary hover:underline">Clear filters</button>
                  </div>
                </div>

                <div className="-mx-2 px-2 overflow-y-auto" style={{ maxHeight: '520px' }}>
                  {filteredCases.map((c, idx) => {
                    const active = c.caseId === activeCaseId;
                    return (
                      <div key={c.caseId} className={`mb-2 rounded-lg border ${active ? 'border-[#ffa332] bg-orange-50/30' : 'border-gray-200'} p-3`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs text-text-muted">{c.caseId}</div>
                            <div className="font-semibold">{c.title}</div>
                          </div>
                          <button onClick={()=>{ setActiveCaseId(c.caseId); setDetailsCase(c); setShowCaseDetails(true); }} className={`text-xs font-semibold ${active ? 'text-[#ffa332]' : 'text-blue-600'} hover:underline`}>
                            View details &gt;
                          </button>
                        </div>
                        {!active && (
                          <div className="mt-1 text-xs text-text-secondary">{(c.assignees||[]).join(', ') || c.employee || 'Unassigned'}</div>
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
                  {/* View toggles + board controls */}
                  <div className="flex items-center gap-2">
                    {view==='board' && (
                      <>
                        <button title="Filters" className="px-2 py-1 rounded hover:bg-gray-100">⚲</button>
                        <button title="Sort" className="px-2 py-1 rounded hover:bg-gray-100">⇅</button>
                      </>
                    )}
                    <button onClick={()=>setView('list')} className={`px-2 py-1 rounded ${view==='list'?'bg-gray-100':''}`} aria-label="List view">≣</button>
                    <button onClick={()=>setView('grid')} className={`px-2 py-1 rounded ${view==='grid'?'bg-gray-100':''}`} aria-label="Grid view">▦</button>
                    <button onClick={()=>setView('board')} className={`px-2 py-1 rounded ${view==='board'?'bg-gray-100':''}`} aria-label="Board view">▤</button>
                  </div>
                </div>

                {view !== 'board' ? (
                  <>
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
                  </>
                ) : (
                  <>
                    {/* Board View */}
                    <div className="mt-3">
                      <h4 className="text-sm font-semibold text-text-secondary">Active Tasks</h4>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                        {BOARD_COLUMNS.map(col => {
                          const colTasks = (activeCase?.active || []).filter(t => t.status === col);
                          return (
                            <div key={col} onDragOver={(e)=>e.preventDefault()} onDrop={handleDropToStatus(col)} className="rounded-lg border border-dashed border-gray-300 p-2 bg-gray-50/50 min-h-[180px]">
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-semibold">{displayStatus(col)}</div>
                                <span className="text-xs text-text-secondary">{colTasks.length}</span>
                              </div>
                              <div className="space-y-2">
                                {colTasks.map(task => {
                                  const pStyle = PRIORITY_STYLES[task.priority];
                                  return (
                                    <div key={task.id} draggable onDragStart={handleDragStart(task, 'active')} className="bg-white rounded-md border p-2 shadow-sm hover:shadow transition">
                                      <div className="flex items-center justify-between text-xs text-text-secondary">
                                        <span className="font-mono">{task.id}</span>
                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${pStyle.bg} ${pStyle.text} ${pStyle.border?`border ${pStyle.border}`:''}`}>
                                          <span>{pStyle.arrow}</span>
                                          <span>{task.priority}</span>
                                        </span>
                                      </div>
                                      <div className="mt-1 font-semibold text-sm">{task.name}</div>
                                      <div className="mt-2 flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                          <img src={task.assignee.avatar || '/images/img_image.svg'} alt="avatar" className="w-5 h-5 rounded-full" />
                                          <span className="text-text-secondary">{task.assignee.name}</span>
                                        </div>
                                        <span className="text-text-secondary">{fmtDur(task.estimateMins)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                                {colTasks.length===0 && (
                                  <div className="text-xs text-text-secondary text-center py-4">Drop here</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Backlog */}
                      <div className="mt-6">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-text-secondary">Backlog</h4>
                          <span className="text-xs text-text-secondary">{(activeCase?.backlog||[]).length} tasks</span>
                        </div>
                        <div onDragOver={(e)=>e.preventDefault()} onDrop={handleDropToBacklog} className="mt-2 rounded-lg border border-dashed border-gray-300 p-2 bg-gray-50/50 min-h-[120px]">
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                            {(activeCase?.backlog || []).map(task => {
                              const pStyle = PRIORITY_STYLES[task.priority];
                              return (
                                <div key={task.id} draggable onDragStart={handleDragStart(task, 'backlog')} className="bg-white rounded-md border p-2 shadow-sm hover:shadow transition">
                                  <div className="flex items-center justify-between text-xs text-text-secondary">
                                    <span className="font-mono">{task.id}</span>
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${pStyle.bg} ${pStyle.text} ${pStyle.border?`border ${pStyle.border}`:''}`}>
                                      <span>{pStyle.arrow}</span>
                                      <span>{task.priority}</span>
                                    </span>
                                  </div>
                                  <div className="mt-1 font-semibold text-sm">{task.name}</div>
                                  <div className="mt-2 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <img src={task.assignee.avatar || '/images/img_image.svg'} alt="avatar" className="w-5 h-5 rounded-full" />
                                      <span className="text-text-secondary">{task.assignee.name}</span>
                                    </div>
                                    <span className="text-text-secondary">{fmtDur(task.estimateMins)}</span>
                                  </div>
                                </div>
                              );
                            })}
                            {(activeCase?.backlog||[]).length===0 && (
                              <div className="text-xs text-text-secondary text-center py-4 col-span-full">No backlog tasks</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
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

      {/* Case Details Modal */}
      {showCaseDetails && detailsCase && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-xl rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Case Details</h3>
              <button type="button" onClick={()=>setShowCaseDetails(false)} className="text-text-secondary hover:opacity-70">✕</button>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-text-secondary">Case ID</div>
                <div className="font-semibold">{detailsCase.caseId}</div>
              </div>
              <div>
                <div className="text-text-secondary">Title</div>
                <div className="font-semibold">{detailsCase.title}</div>
              </div>
              <div>
                <div className="text-text-secondary">Branch</div>
                <div className="font-semibold">{detailsCase.branch || '—'}</div>
              </div>
              <div>
                <div className="text-text-secondary">Type</div>
                <div className="font-semibold">{detailsCase.type || '—'}</div>
              </div>
              <div>
                <div className="text-text-secondary">Assigned To</div>
                <div className="font-semibold">{(detailsCase.assignees||[]).join(', ') || detailsCase.employee || 'Unassigned'}</div>
              </div>
              <div>
                <div className="text-text-secondary">Status</div>
                <div className="font-semibold">{detailsCase.status || 'In Progress'}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-text-secondary">Created At</div>
                <div className="font-semibold">{detailsCase.createdAt ? new Date(detailsCase.createdAt).toLocaleString() : '—'}</div>
              </div>
            </div>
            <div className="mt-5 text-right">
              <button type="button" onClick={()=>setShowCaseDetails(false)} className="px-3 py-2 rounded border hover:bg-gray-50">Close</button>
            </div>
          </div>
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
                  <option>In Review</option>
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
