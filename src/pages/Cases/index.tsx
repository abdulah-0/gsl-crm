import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

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

  // Drag-over visual state (drop a case onto Tasks section)
  const [isCaseDragOver, setIsCaseDragOver] = useState(false);

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
  // Student Information Form (flattened)
  const [sf, setSf] = useState<any>({
    basic_name:'', basic_dob:'', basic_address:'', basic_date:'', basic_email:'', basic_nationality:'', basic_phone:'', basic_student_sign:'',
    ug_olevels:false, ug_olevels_year:'', ug_olevels_grades:'', ug_alevels:false, ug_alevels_year:'', ug_alevels_grades:'', ug_matric:false, ug_matric_year:'', ug_matric_grades:'', ug_hssc:false, ug_hssc_year:'', ug_hssc_grades:'', ug_other:'',
    pg_bachelors:false, pg_bachelors_university:'', pg_bachelors_course:'', pg_bachelors_year:'', pg_bachelors_grades:'', pg_masters:false, pg_masters_university:'', pg_masters_course:'', pg_masters_year:'', pg_masters_grades:'',
    eng_ielts:false, eng_toefl:false, eng_pte:false, eng_duolingo:false, eng_other:'', eng_score:'',
    work_exp:'',
    coi_uk:false, coi_usa:false, coi_canada:false, coi_malaysia:false, coi_germany:false, coi_australia:false, coi_others:'',
    add_course_or_uni:'', add_travel_history:'', add_visa_refusal:'', add_asylum_family:'',
    office_date:'', office_application_started:'', office_university_applied:'', office_counsellor_name:'', office_counsellor_sign:'', office_next_follow_up_date:''
  });

  // Add Task modal state
  const [showAddTask, setShowAddTask] = useState(false);
  const [tfName, setTfName] = useState('');
  const [tfEstimate, setTfEstimate] = useState(60);
  const [tfPriority, setTfPriority] = useState<Priority>('Medium');
  const [tfStatus, setTfStatus] = useState<Status>('Todo');
  const [tfArea, setTfArea] = useState<'Active'|'Backlog'>('Active');
  const [tfAssignee, setTfAssignee] = useState('');
  const [tfAvatar, setTfAvatar] = useState('');
  const [tfDesc, setTfDesc] = useState('');

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

  // Load tasks for active case from Supabase and keep in sync
  const loadTasksForCase = async (caseId: string) => {
    const { data, error } = await supabase
      .from('dashboard_tasks')
      .select('id, case_number, name, estimate_mins, spent_mins, assignee_name, assignee_avatar, priority, status, is_backlog, description, created_at')
      .eq('case_number', caseId)
      .order('created_at', { ascending: false });
    if (error) return;
    const act: Task[] = [];
    const back: Task[] = [];
    (data || []).forEach((row: any) => {
      const t: Task = {
        id: row.id,
        name: row.name,
        estimateMins: row.estimate_mins ?? 0,
        spentMins: row.spent_mins ?? 0,
        assignee: { name: row.assignee_name || 'Unassigned', avatar: row.assignee_avatar || undefined },
        priority: (row.priority || 'Medium') as Priority,
        status: (row.status || 'Todo') as Status,
        description: row.description || undefined,
      };
      if (row.is_backlog) back.push(t); else act.push(t);
    });
    setCases(prev => prev.map(c => c.caseId === caseId ? { ...c, active: act, backlog: back } : c));
  };

  useEffect(() => {
    if (!activeCase?.caseId) return;
    let chan: any;
    (async () => {
      await loadTasksForCase(activeCase.caseId);
      chan = supabase
        .channel(`public:dashboard_tasks:${activeCase.caseId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dashboard_tasks', filter: `case_number=eq.${activeCase.caseId}` }, () => loadTasksForCase(activeCase.caseId))
        .subscribe();
    })();
    return () => { if (chan) supabase.removeChannel(chan); };
  }, [activeCase?.caseId]);

  const updateTaskStatus = async (taskId: string, next: Status) => {
    // Optimistic UI
    setCases(prev => prev.map(c => {
      if (c.caseId !== activeCaseId) return c;
      const mapper = (arr: Task[]) => arr.map(t => t.id === taskId ? { ...t, status: next } : t);
      return { ...c, active: mapper(c.active), backlog: mapper(c.backlog) };
    }));
    // Persist
    await supabase.from('dashboard_tasks').update({ status: next }).eq('id', taskId).eq('case_number', activeCaseId || '');
  };

  const moveTask = async (payload: { id: string; from: 'active'|'backlog' }, to: { area: 'active'|'backlog'; status?: Status }) => {
    // Optimistic UI
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
    // Persist
    if (to.area === 'active') {
      await supabase.from('dashboard_tasks').update({ is_backlog: false, status: to.status ?? undefined }).eq('id', payload.id).eq('case_number', activeCaseId || '');
    } else {
      await supabase.from('dashboard_tasks').update({ is_backlog: true, status: 'Todo' }).eq('id', payload.id).eq('case_number', activeCaseId || '');
    }
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
    const title = formTitle.trim() || sf.basic_name || 'New Case';
    if (!title) return;
    const assignees = formAssignees.split(',').map(s => s.trim()).filter(Boolean);
    const payload: any = { title, assignees, status: 'In Progress', student_info: sf };
    const { data, error } = await supabase
      .from('dashboard_cases')
      .insert([payload])
      .select('case_number')
      .single();
    if (!error && data) {
      setActiveCaseId(data.case_number);
      setShowAddCase(false);
      setFormCaseId(''); setFormTitle(''); setFormAssignees(''); setFormEstimate(0); setFormPriority('Medium');
      setSf({
        basic_name:'', basic_dob:'', basic_address:'', basic_date:'', basic_email:'', basic_nationality:'', basic_phone:'', basic_student_sign:'',
        ug_olevels:false, ug_olevels_year:'', ug_olevels_grades:'', ug_alevels:false, ug_alevels_year:'', ug_alevels_grades:'', ug_matric:false, ug_matric_year:'', ug_matric_grades:'', ug_hssc:false, ug_hssc_year:'', ug_hssc_grades:'', ug_other:'',
        pg_bachelors:false, pg_bachelors_university:'', pg_bachelors_course:'', pg_bachelors_year:'', pg_bachelors_grades:'', pg_masters:false, pg_masters_university:'', pg_masters_course:'', pg_masters_year:'', pg_masters_grades:'',
        eng_ielts:false, eng_toefl:false, eng_pte:false, eng_duolingo:false, eng_other:'', eng_score:'',
        work_exp:'',
        coi_uk:false, coi_usa:false, coi_canada:false, coi_malaysia:false, coi_germany:false, coi_australia:false, coi_others:'',
        add_course_or_uni:'', add_travel_history:'', add_visa_refusal:'', add_asylum_family:'',
        office_date:'', office_application_started:'', office_university_applied:'', office_counsellor_name:'', office_counsellor_sign:'', office_next_follow_up_date:''
      });
    }
  };

  const newTaskId = () => `TS${Date.now().toString().slice(-8)}`;

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCaseId) return;
    const id = newTaskId();
    const name = tfName.trim() || 'Untitled Task';
    const estimate_mins = Math.max(0, Number(tfEstimate) || 0);
    const spent_mins = 0;
    const assignee_name = tfAssignee.trim() || 'Unassigned';
    const assignee_avatar = tfAvatar.trim() || undefined;
    const priority = tfPriority;
    const status = tfArea === 'Backlog' ? 'Todo' : tfStatus;
    const description = tfDesc.trim() || undefined;
    const is_backlog = tfArea === 'Backlog';

    // Optimistic UI
    const task: Task = { id, name, estimateMins: estimate_mins, spentMins: spent_mins, assignee: { name: assignee_name, avatar: assignee_avatar }, priority, status, description };
    setCases(prev => prev.map(c => {
      if (c.caseId !== activeCaseId) return c;
      if (!is_backlog) return { ...c, active: [task, ...c.active] };
      return { ...c, backlog: [task, ...c.backlog] };
    }));

    // Persist
    await supabase.from('dashboard_tasks').insert([{ id, case_number: activeCaseId, name, estimate_mins, spent_mins, assignee_name, assignee_avatar, priority, status, is_backlog, description }]);

    setShowAddTask(false);
    setTfName(''); setTfEstimate(60); setTfPriority('Medium'); setTfStatus('Todo'); setTfArea('Active'); setTfAssignee(''); setTfAvatar(''); setTfDesc('');
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
              <div className="flex items-center gap-2">
                <button onClick={()=>setShowAddTask(true)} className="px-4 py-2 rounded-full font-bold text-white bg-[#ffa332] shadow-[0px_6px_12px_#3f8cff43] hover:opacity-95">
                  + Add Task
                </button>
                <button onClick={()=>setShowAddCase(true)} className="px-4 py-2 rounded-full font-bold text-white bg-[#ffa332] shadow-[0px_6px_12px_#3f8cff43] hover:opacity-95">
                  + Add Case
                </button>
              </div>
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
                      <div
                        key={c.caseId}
                        draggable
                        onDragStart={(e)=>{ e.dataTransfer.setData('text/case', c.caseId); e.dataTransfer.effectAllowed = 'move'; }}
                        className={`mb-2 rounded-lg border ${active ? 'border-[#ffa332] bg-orange-50/30' : 'border-gray-200'} p-3`}
                        title="Drag to Tasks to focus this case"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs text-text-muted">{c.caseId}</div>
                            <div className="font-semibold">{c.title}</div>
                          </div>
                          <button onClick={()=>{ setActiveCaseId(c.caseId); navigate(`/cases/${c.caseId}`); }} className={`text-xs font-semibold ${active ? 'text-[#ffa332]' : 'text-blue-600'} hover:underline`}>
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
              <section
                className={`lg:col-span-8 xl:col-span-9 rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4 ${isCaseDragOver ? 'border-2 border-dashed border-[#ffa332] bg-orange-50/20' : 'bg-white'}`}
                onDragOver={(e)=>{ if (e.dataTransfer.types.includes('text/case')) { e.preventDefault(); } }}
                onDragEnter={(e)=>{ if (e.dataTransfer.types.includes('text/case')) setIsCaseDragOver(true); }}
                onDragLeave={(e)=>{ setIsCaseDragOver(false); }}
                onDrop={(e)=>{ e.preventDefault(); const id = e.dataTransfer.getData('text/case'); if (id) { setActiveCaseId(id); } setIsCaseDragOver(false); }}
              >
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

                {view === 'list' ? (
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
                          <button key={task.id} onClick={()=>navigate(`/cases/${activeCase.caseId}/tasks/${task.id}`)} className="w-full text-left py-3 px-2 hover:bg-gray-50">
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
                ) : view === 'grid' ? (
                  <>
                    {/* Tabs */}
                    <div className="mt-3 flex items-center gap-3 border-b">
                      {['Active','Backlog'].map(t => (
                        <button key={t} onClick={()=>setTab(t as any)} className={`px-3 py-2 -mb-px border-b-2 ${tab===t? 'border-[#ffa332] text-[#ffa332] font-semibold':'border-transparent text-text-secondary'}`}>{t} Tasks</button>
                      ))}
                    </div>

                    {/* Grid of task cards */}
                    <div className="mt-3">
                      {tasks.length === 0 ? (
                        <div className="py-8 text-center text-text-secondary">No tasks in this list.</div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" style={{ maxHeight: '520px', overflowY: 'auto' }}>
                          {tasks.map(task => {
                            const pStyle = PRIORITY_STYLES[task.priority];
                            const sStyle = STATUS_STYLES[task.status];
                            return (
                              <button key={task.id} onClick={()=>navigate(`/cases/${activeCase.caseId}/tasks/${task.id}`)} className="text-left bg-white rounded-lg border p-3 shadow-sm hover:shadow transition">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                                    <span className={`w-2 h-2 rounded-full ${sStyle.dot}`}></span>
                                    <span className="font-mono">{task.id}</span>
                                  </div>
                                  <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${pStyle.bg} ${pStyle.text} ${pStyle.border?`border ${pStyle.border}`:''}`}>
                                    <span>{pStyle.arrow}</span>
                                    <span>{task.priority}</span>
                                  </span>
                                </div>
                                <div className="mt-1 font-semibold">{task.name}</div>
                                <div className="mt-2 flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <img src={task.assignee.avatar || '/images/img_image.svg'} alt="avatar" className="w-5 h-5 rounded-full" />
                                    <span className="text-text-secondary">{task.assignee.name}</span>
                                  </div>
                                  <span className="text-text-secondary">{fmtDur(task.estimateMins)}</span>
                                </div>
                                <div className={`mt-2 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${sStyle.bg} ${sStyle.text}`}>
                                  <span className={`w-2 h-2 rounded-full ${sStyle.dot}`}></span>
                                  <span>{task.status}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
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
                                    <div key={task.id} draggable onDragStart={handleDragStart(task, 'active')} onClick={()=>navigate(`/cases/${activeCase.caseId}/tasks/${task.id}`)} className="cursor-pointer bg-white rounded-md border p-2 shadow-sm hover:shadow transition">
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
                                <div key={task.id} draggable onDragStart={handleDragStart(task, 'backlog')} onClick={()=>navigate(`/cases/${activeCase.caseId}/tasks/${task.id}`)} className="cursor-pointer bg-white rounded-md border p-2 shadow-sm hover:shadow transition">
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
          <form onSubmit={addCase} className="bg-white w-full max-w-4xl rounded-xl p-5 shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Add Case</h3>
              <button type="button" onClick={()=>setShowAddCase(false)} className="text-text-secondary hover:opacity-70">✕</button>
            </div>

            {/* Case Meta */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <label><span className="text-text-secondary">Case ID</span><input value={formCaseId} onChange={e=>setFormCaseId(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="Auto-generated" disabled/></label>
              <label className="sm:col-span-2"><span className="text-text-secondary">Case Title</span><input value={formTitle} onChange={e=>setFormTitle(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="Case Title (optional)"/></label>
            </div>

            {/* Basic Info */}
            <div className="mt-5">
              <h4 className="font-semibold">Basic Info</h4>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <label><span className="text-text-secondary">Name</span><input value={sf.basic_name} onChange={e=>setSf({...sf, basic_name:e.target.value})} className="mt-1 w-full border rounded p-2" required/></label>
                <label><span className="text-text-secondary">Date of Birth</span><input type="date" value={sf.basic_dob} onChange={e=>setSf({...sf, basic_dob:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
                <label><span className="text-text-secondary">Date</span><input type="date" value={sf.basic_date} onChange={e=>setSf({...sf, basic_date:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
                <label className="sm:col-span-2 lg:col-span-3"><span className="text-text-secondary">Address</span><input value={sf.basic_address} onChange={e=>setSf({...sf, basic_address:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
                <label><span className="text-text-secondary">Email</span><input type="email" value={sf.basic_email} onChange={e=>setSf({...sf, basic_email:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
                <label><span className="text-text-secondary">Nationality</span><input value={sf.basic_nationality} onChange={e=>setSf({...sf, basic_nationality:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
                <label><span className="text-text-secondary">Phone No</span><input value={sf.basic_phone} onChange={e=>setSf({...sf, basic_phone:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
                <label className="sm:col-span-2 lg:col-span-1"><span className="text-text-secondary">Student Sign</span><input value={sf.basic_student_sign} onChange={e=>setSf({...sf, basic_student_sign:e.target.value})} className="mt-1 w-full border rounded p-2" placeholder="Signature text"/></label>
              </div>
            </div>

            {/* Undergrad */}
            <div className="mt-6">
              <h4 className="font-semibold">For Undergrad</h4>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.ug_olevels} onChange={e=>setSf({...sf, ug_olevels:e.target.checked})}/>O-Levels</label>
                <input placeholder="Year" value={sf.ug_olevels_year} onChange={e=>setSf({...sf, ug_olevels_year:e.target.value})} className="border rounded p-2"/>
                <input placeholder="Grades" value={sf.ug_olevels_grades} onChange={e=>setSf({...sf, ug_olevels_grades:e.target.value})} className="border rounded p-2 lg:col-span-2"/>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.ug_alevels} onChange={e=>setSf({...sf, ug_alevels:e.target.checked})}/>A-Levels</label>
                <input placeholder="Year" value={sf.ug_alevels_year} onChange={e=>setSf({...sf, ug_alevels_year:e.target.value})} className="border rounded p-2"/>
                <input placeholder="Grades" value={sf.ug_alevels_grades} onChange={e=>setSf({...sf, ug_alevels_grades:e.target.value})} className="border rounded p-2 lg:col-span-2"/>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.ug_matric} onChange={e=>setSf({...sf, ug_matric:e.target.checked})}/>Matric</label>
                <input placeholder="Year" value={sf.ug_matric_year} onChange={e=>setSf({...sf, ug_matric_year:e.target.value})} className="border rounded p-2"/>
                <input placeholder="Grades" value={sf.ug_matric_grades} onChange={e=>setSf({...sf, ug_matric_grades:e.target.value})} className="border rounded p-2 lg:col-span-2"/>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.ug_hssc} onChange={e=>setSf({...sf, ug_hssc:e.target.checked})}/>HSSC</label>
                <input placeholder="Year" value={sf.ug_hssc_year} onChange={e=>setSf({...sf, ug_hssc_year:e.target.value})} className="border rounded p-2"/>
                <input placeholder="Grades" value={sf.ug_hssc_grades} onChange={e=>setSf({...sf, ug_hssc_grades:e.target.value})} className="border rounded p-2 lg:col-span-2"/>
                <input placeholder="Other Education" value={sf.ug_other} onChange={e=>setSf({...sf, ug_other:e.target.value})} className="border rounded p-2 sm:col-span-2 lg:col-span-4"/>
              </div>
            </div>

            {/* Postgrad */}
            <div className="mt-6">
              <h4 className="font-semibold">For Postgrad</h4>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.pg_bachelors} onChange={e=>setSf({...sf, pg_bachelors:e.target.checked})}/>Bachelors</label>
                <input placeholder="University Name" value={sf.pg_bachelors_university} onChange={e=>setSf({...sf, pg_bachelors_university:e.target.value})} className="border rounded p-2 lg:col-span-3"/>
                <input placeholder="Course Name" value={sf.pg_bachelors_course} onChange={e=>setSf({...sf, pg_bachelors_course:e.target.value})} className="border rounded p-2 lg:col-span-2"/>
                <input placeholder="Year" value={sf.pg_bachelors_year} onChange={e=>setSf({...sf, pg_bachelors_year:e.target.value})} className="border rounded p-2"/>
                <input placeholder="Grades" value={sf.pg_bachelors_grades} onChange={e=>setSf({...sf, pg_bachelors_grades:e.target.value})} className="border rounded p-2"/>

                <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={sf.pg_masters} onChange={e=>setSf({...sf, pg_masters:e.target.checked})}/>Masters</label>
                <input placeholder="University Name" value={sf.pg_masters_university} onChange={e=>setSf({...sf, pg_masters_university:e.target.value})} className="border rounded p-2 lg:col-span-3"/>
                <input placeholder="Course Name" value={sf.pg_masters_course} onChange={e=>setSf({...sf, pg_masters_course:e.target.value})} className="border rounded p-2 lg:col-span-2"/>
                <input placeholder="Year" value={sf.pg_masters_year} onChange={e=>setSf({...sf, pg_masters_year:e.target.value})} className="border rounded p-2"/>
                <input placeholder="Grades" value={sf.pg_masters_grades} onChange={e=>setSf({...sf, pg_masters_grades:e.target.value})} className="border rounded p-2"/>
              </div>
            </div>

            {/* English Proficiency */}
            <div className="mt-6">
              <h4 className="font-semibold">English Proficiency Test</h4>
              <div className="mt-2 grid grid-cols-2 lg:grid-cols-6 gap-3 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.eng_ielts} onChange={e=>setSf({...sf, eng_ielts:e.target.checked})}/>IELTS</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.eng_toefl} onChange={e=>setSf({...sf, eng_toefl:e.target.checked})}/>TOEFL</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.eng_pte} onChange={e=>setSf({...sf, eng_pte:e.target.checked})}/>PTE</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.eng_duolingo} onChange={e=>setSf({...sf, eng_duolingo:e.target.checked})}/>Duolingo</label>
                <input placeholder="Other" value={sf.eng_other} onChange={e=>setSf({...sf, eng_other:e.target.value})} className="border rounded p-2"/>
                <input placeholder="Score" value={sf.eng_score} onChange={e=>setSf({...sf, eng_score:e.target.value})} className="border rounded p-2"/>
              </div>
            </div>

            {/* Work Experience */}
            <div className="mt-6">
              <h4 className="font-semibold">Work Experience</h4>
              <textarea value={sf.work_exp} onChange={e=>setSf({...sf, work_exp:e.target.value})} className="mt-2 w-full border rounded p-2 text-sm" rows={3} placeholder="Describe work experience"></textarea>
            </div>

            {/* Country of Interest */}
            <div className="mt-6">
              <h4 className="font-semibold">Country of Interest</h4>
              <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.coi_uk} onChange={e=>setSf({...sf, coi_uk:e.target.checked})}/>United Kingdom</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.coi_usa} onChange={e=>setSf({...sf, coi_usa:e.target.checked})}/>United States of America</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.coi_canada} onChange={e=>setSf({...sf, coi_canada:e.target.checked})}/>Canada</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.coi_malaysia} onChange={e=>setSf({...sf, coi_malaysia:e.target.checked})}/>Malaysia</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.coi_germany} onChange={e=>setSf({...sf, coi_germany:e.target.checked})}/>Germany</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.coi_australia} onChange={e=>setSf({...sf, coi_australia:e.target.checked})}/>Australia</label>
                <input placeholder="Others" value={sf.coi_others} onChange={e=>setSf({...sf, coi_others:e.target.value})} className="border rounded p-2"/>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-6">
              <h4 className="font-semibold">Additional Info</h4>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <label className="sm:col-span-2"><span className="text-text-secondary">Course of interest / University</span><input value={sf.add_course_or_uni} onChange={e=>setSf({...sf, add_course_or_uni:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
                <label className="sm:col-span-2"><span className="text-text-secondary">Any travel history</span><input value={sf.add_travel_history} onChange={e=>setSf({...sf, add_travel_history:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
                <label><span className="text-text-secondary">Visa refusal (if any)</span><input value={sf.add_visa_refusal} onChange={e=>setSf({...sf, add_visa_refusal:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
                <label><span className="text-text-secondary">Any asylum taken by family</span><input value={sf.add_asylum_family} onChange={e=>setSf({...sf, add_asylum_family:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
              </div>
            </div>

            {/* For Office Use Only */}
            <div className="mt-6">
              <h4 className="font-semibold">For Office Use Only</h4>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <label><span className="text-text-secondary">Date</span><input type="date" value={sf.office_date} onChange={e=>setSf({...sf, office_date:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
                <label><span className="text-text-secondary">Application Started</span><input value={sf.office_application_started} onChange={e=>setSf({...sf, office_application_started:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
                <label><span className="text-text-secondary">University Applied</span><input value={sf.office_university_applied} onChange={e=>setSf({...sf, office_university_applied:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
                <label><span className="text-text-secondary">Counsellor Name</span><input value={sf.office_counsellor_name} onChange={e=>setSf({...sf, office_counsellor_name:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
                <label><span className="text-text-secondary">Counsellor Sign</span><input value={sf.office_counsellor_sign} onChange={e=>setSf({...sf, office_counsellor_sign:e.target.value})} className="mt-1 w-full border rounded p-2" placeholder="Signature text"/></label>
                <label><span className="text-text-secondary">Next Follow Up Date</span><input type="date" value={sf.office_next_follow_up_date} onChange={e=>setSf({...sf, office_next_follow_up_date:e.target.value})} className="mt-1 w-full border rounded p-2"/></label>
              </div>
            </div>

            {/* Assignees & Controls */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label className="sm:col-span-2"><span className="text-text-secondary">Assignee(s)</span><input value={formAssignees} onChange={e=>setFormAssignees(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="Comma separated"/></label>
              <label><span className="text-text-secondary">Estimate (minutes)</span><input type="number" min={0} value={formEstimate} onChange={e=>setFormEstimate(Number(e.target.value))} className="mt-1 w-full border rounded p-2"/></label>
              <label><span className="text-text-secondary">Priority</span><select value={formPriority} onChange={e=>setFormPriority(e.target.value as Priority)} className="mt-1 w-full border rounded p-2"><option>Low</option><option>Medium</option><option>High</option></select></label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button type="button" onClick={()=>setShowAddCase(false)} className="px-3 py-2 rounded border hover:bg-gray-50">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold shadow-[0px_6px_12px_#3f8cff43]">Save Case</button>
            </div>
          </form>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={addTask} className="bg-white w-full max-w-lg rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Add Task</h3>
              <button type="button" onClick={()=>setShowAddTask(false)} className="text-text-secondary hover:opacity-70">✕</button>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm sm:col-span-2">
                <span className="text-text-secondary">Task Name</span>
                <input value={tfName} onChange={e=>setTfName(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="Task name" required />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Area</span>
                <select value={tfArea} onChange={e=>setTfArea(e.target.value as 'Active'|'Backlog')} className="mt-1 w-full border rounded p-2">
                  <option>Active</option>
                  <option>Backlog</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Status</span>
                <select value={tfStatus} onChange={e=>setTfStatus(e.target.value as Status)} className="mt-1 w-full border rounded p-2" disabled={tfArea==='Backlog'}>
                  <option>Todo</option>
                  <option>In Progress</option>
                  <option>In Review</option>
                  <option>Done</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Estimate (minutes)</span>
                <input type="number" min={0} value={tfEstimate} onChange={e=>setTfEstimate(Number(e.target.value))} className="mt-1 w-full border rounded p-2" />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Priority</span>
                <select value={tfPriority} onChange={e=>setTfPriority(e.target.value as Priority)} className="mt-1 w-full border rounded p-2">
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Assignee</span>
                <input value={tfAssignee} onChange={e=>setTfAssignee(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="Name (optional)" />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Avatar URL</span>
                <input value={tfAvatar} onChange={e=>setTfAvatar(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="https://... (optional)" />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="text-text-secondary">Description</span>
                <textarea value={tfDesc} onChange={e=>setTfDesc(e.target.value)} className="mt-1 w-full border rounded p-2" rows={3} placeholder="Optional"></textarea>
              </label>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={()=>setShowAddTask(false)} className="px-3 py-2 rounded border hover:bg-gray-50">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold shadow-[0px_6px_12px_#3f8cff43]">Save Task</button>
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
