/**
 * @fileoverview Cases Page
 * 
 * Comprehensive case management page for the GSL CRM system.
 * Handles consultancy cases with task tracking, Kanban board, and student information.
 * 
 * **Key Features:**
 * - Case creation with student linking
 * - Task management (Active/Backlog)
 * - Multiple views (List, Grid, Kanban Board)
 * - Drag-and-drop task status updates
 * - Drag-and-drop case stage updates
 * - Student information form integration
 * - University application tracking
 * - Real-time updates via Supabase
 * - Role-based permissions (CRUD access control)
 * - Advanced filtering (branch, status, type, search)
 * 
 * **Case Stages:**
 * Initial Stage, Offer Applied, Offer Received, Fee Paid, Interview,
 * CAS Applied, CAS Received, Visa Applied, Visa Received, Enrollment,
 * Not Enrolled, Backout, Visa Rejected
 * 
 * **Task Management:**
 * - Active tasks with status tracking (Todo, In Progress, In Review, Done)
 * - Backlog for future tasks
 * - Priority levels (Low, Medium, High)
 * - Time estimation and tracking
 * - Assignee management
 * 
 * @module pages/Cases
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import TeacherSearchDropdown from '../../components/TeacherSearchDropdown';
import { getUserBranch, getBranchFilter } from '../../utils/branchAccess';
import BranchFilter from '../../components/BranchFilter';


// Types
const CASE_STAGES = [
  'Initial Stage',
  'Offer Applied',
  'Offer Received',
  'Fee Paid',
  'Interview',
  'CAS Applied',
  'CAS Received',
  'Visa Applied',
  'Visa Received',
  'Enrollment',
  'Not Enrolled',
  'Backout',
  'Visa Rejected',
] as const;

type CaseStage = typeof CASE_STAGES[number];

type Priority = 'Low' | 'Medium' | 'High';
type TaskStatus = 'Todo' | 'In Progress' | 'In Review' | 'Done';

type Task = {
  id: string;
  name: string;
  estimateMins: number;
  spentMins: number;
  assignee: { id?: string; name: string; avatar?: string };
  priority: Priority;
  status: TaskStatus;
  description?: string;
};

type CaseItem = {
  caseId: string; // e.g., PN001245
  title: string; // student/case title
  status?: CaseStage;
  branch?: string;
  type?: string;
  employee?: string;
  assignees: string[];
  createdAt?: string;
  updatedAt?: string;
  universityName?: string;
  courseName?: string;
  active: Task[];
  backlog: Task[];
};

// Utils
const mins = (d: number = 0, h: number = 0, m: number = 0) => d * 24 * 60 + h * 60 + m;
const fmtDur = (totalMins: number) => {
  const d = Math.floor(totalMins / (24 * 60));
  const h = Math.floor((totalMins % (24 * 60)) / 60);
  const m = totalMins % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || parts.length === 0) parts.push(`${m}m`);
  return parts.join(' ');
};

const PRIORITY_STYLES: Record<Priority, { text: string; bg: string; arrow: '↑' | '↓'; border?: string }> = {
  High: { text: 'text-red-700', bg: 'bg-red-100', arrow: '↑', border: 'border-red-200' },
  Medium: { text: 'text-yellow-800', bg: 'bg-yellow-100', arrow: '↑', border: 'border-yellow-200' },
  Low: { text: 'text-emerald-700', bg: 'bg-emerald-100', arrow: '↓', border: 'border-emerald-200' },
};

const TASK_STATUS_STYLES: Record<TaskStatus, { text: string; bg: string; dot: string }> = {
  'Done': { text: 'text-emerald-700', bg: 'bg-emerald-100', dot: 'bg-emerald-500' },
  'In Progress': { text: 'text-blue-700', bg: 'bg-blue-100', dot: 'bg-blue-500' },
  'In Review': { text: 'text-purple-700', bg: 'bg-purple-100', dot: 'bg-purple-500' },
  'Todo': { text: 'text-gray-700', bg: 'bg-gray-100', dot: 'bg-gray-400' },
};

const normalizeCaseStage = (raw?: string | null): CaseStage => {
  const val = (raw || '').toString().trim().toLowerCase();
  const match = CASE_STAGES.find(s => s.toLowerCase() === val);
  return match || 'Initial Stage';
};

const CASE_STAGE_COLORS: Record<CaseStage, string> = {
  'Initial Stage': 'bg-amber-100 text-amber-700',
  'Offer Applied': 'bg-cyan-100 text-cyan-700',
  'Offer Received': 'bg-sky-100 text-sky-700',
  'Fee Paid': 'bg-lime-100 text-lime-700',
  'Interview': 'bg-purple-100 text-purple-700',
  'CAS Applied': 'bg-blue-100 text-blue-700',
  'CAS Received': 'bg-indigo-100 text-indigo-700',
  'Visa Applied': 'bg-emerald-100 text-emerald-700',
  'Visa Received': 'bg-green-100 text-green-700',
  'Enrollment': 'bg-teal-100 text-teal-700',
  'Not Enrolled': 'bg-gray-100 text-gray-700',
  'Backout': 'bg-orange-100 text-orange-700',
  'Visa Rejected': 'bg-red-100 text-red-700',
};

const Cases: React.FC = () => {
  // Realtime cases from Supabase (dashboard_cases)
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string>('');
  const navigate = useNavigate();

  const [caseAccess, setCaseAccess] = useState<'NONE' | 'VIEW' | 'CRUD'>('NONE'); // legacy fallback
  const [isSuper, setIsSuper] = useState(false);
  const [permFlags, setPermFlags] = useState<{ add: boolean; edit: boolean; del: boolean }>({ add: false, edit: false, del: false });
  const canAdd = isSuper || permFlags.add || caseAccess === 'CRUD';
  const canEdit = isSuper || permFlags.edit || caseAccess === 'CRUD';
  const canDelete = isSuper || permFlags.del || caseAccess === 'CRUD';
  const canCrud = canAdd;


  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const email = auth.user?.email;
        if (!email) return;
        const { data: u } = await supabase.from('dashboard_users').select('role, permissions').eq('email', email).maybeSingle();
        const roleStr = (u?.role || (auth.user as any)?.app_metadata?.role || (auth.user as any)?.user_metadata?.role || '').toString().toLowerCase();
        if (roleStr.includes('super')) { setIsSuper(true); setPermFlags({ add: true, edit: true, del: true }); setCaseAccess('CRUD'); return; }
        const { data: up } = await supabase.from('user_permissions').select('module, access, can_add, can_edit, can_delete').eq('user_email', email).eq('module', 'cases');
        if (up && up.length) {
          const row: any = up[0];
          setPermFlags({ add: !!row.can_add, edit: !!row.can_edit, del: !!row.can_delete });
          if (row.access) setCaseAccess((row.access as any) === 'CRUD' ? 'CRUD' : (row.access as any) === 'VIEW' ? 'VIEW' : 'NONE');
        } else {
          const perms = Array.isArray(u?.permissions) ? (u?.permissions as any as string[]) : [];
          setCaseAccess(perms.includes('cases') ? 'CRUD' : 'NONE');
        }
      } catch { }
    })();
  }, []);


  useEffect(() => {
    const load = async () => {
      // Get branch filter
      const branchFilter = await getBranchFilter(supabase, selectedBranch);

      let query = supabase
        .from('dashboard_cases')
        .select('id, case_number, title, assignees, employee, status, stage, branch, type, created_at, university_id');

      // Apply branch filter if specified
      if (branchFilter) {
        query = query.eq('branch', branchFilter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (!error) {
        // Fetch course information for each case
        const caseIds = (data ?? []).map((row: any) => row.case_number || String(row.id));
        const { data: applications } = await supabase
          .from('case_university_applications')
          .select('case_id, course_applied')
          .in('case_id', caseIds);

        const courseMap = new Map<string, string>();
        (applications || []).forEach((app: any) => {
          if (!courseMap.has(app.case_id)) {
            courseMap.set(app.case_id, app.course_applied);
          }
        });

        // Fetch university names
        const universityIds = (data ?? []).map((row: any) => row.university_id).filter(Boolean);
        const { data: universities } = await supabase
          .from('universities')
          .select('id, name')
          .in('id', universityIds);

        const universityMap = new Map<number, string>();
        (universities || []).forEach((uni: any) => {
          universityMap.set(uni.id, uni.name);
        });

        const mapped: CaseItem[] = (data ?? []).map((row: any) => ({
          caseId: row.case_number || String(row.id),
          title: row.title || 'Untitled',
          status: normalizeCaseStage(row.stage || row.status),
          branch: row.branch || undefined,
          type: row.type || undefined,
          employee: row.employee || undefined,
          assignees: Array.isArray(row.assignees) ? row.assignees : (row.employee ? [row.employee] : []),
          createdAt: row.created_at,
          updatedAt: undefined, // Column doesn't exist in dashboard_cases
          universityName: row.university_id ? universityMap.get(row.university_id) : undefined,
          courseName: courseMap.get(row.case_number || String(row.id)) || undefined,
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
  }, [activeCaseId, selectedBranch]);

  // UI state
  const [tab, setTab] = useState<'Active' | 'Backlog'>('Active');
  const [view, setView] = useState<'list' | 'grid' | 'board'>('list');
  const [contentMode, setContentMode] = useState<'cases' | 'tasks'>('cases');
  const [isAllCasesCollapsed, setIsAllCasesCollapsed] = useState(false);

  const [boardDropCol, setBoardDropCol] = useState<CaseStage | null>(null);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2200);
  };
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);

  // Drag-over visual state (drop a case onto Tasks section)
  const [isCaseDragOver, setIsCaseDragOver] = useState(false);

  // Filters - MOVED BEFORE useEffect
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<CaseStage | 'All'>('All');
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
    basic_name: '', basic_dob: '', basic_address: '', basic_date: '', basic_email: '', basic_nationality: '', basic_phone: '', basic_passport_number: '',
    ug_olevels: false, ug_olevels_year: '', ug_olevels_grades: '', ug_alevels: false, ug_alevels_year: '', ug_alevels_grades: '', ug_matric: false, ug_matric_year: '', ug_matric_grades: '', ug_hssc: false, ug_hssc_year: '', ug_hssc_grades: '', ug_other: '',
    pg_bachelors: false, pg_bachelors_university: '', pg_bachelors_course: '', pg_bachelors_year: '', pg_bachelors_grades: '', pg_masters: false, pg_masters_university: '', pg_masters_course: '', pg_masters_year: '', pg_masters_grades: '',
    eng_ielts: false, eng_toefl: false, eng_pte: false, eng_duolingo: false, eng_other: '', eng_score: '',
    work_exp: '',
    coi_uk: false, coi_usa: false, coi_canada: false, coi_malaysia: false, coi_germany: false, coi_australia: false, coi_others: '',
    add_course_or_uni: '', add_travel_history: '', add_visa_refusal: '', add_asylum_family: '',
    office_date: '', office_application_started: '', office_university_applied: '', office_counsellor_name: '', office_counsellor_sign: '', office_next_follow_up_date: ''
  });
  // Student selection for case linking
  const [studentsForDropdown, setStudentsForDropdown] = useState<Array<{ id: string; full_name: string; cnic?: string; phone?: string; batch_no?: string; program_title?: string }>>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('dashboard_students')
        .select('id, full_name, cnic, phone, batch_no, program_title, status, archived')
        .eq('status', 'Active').eq('archived', false)
        .order('full_name');
      setStudentsForDropdown((data as any) || []);
    })();
  }, []);

  const onSelectStudent = (id: string) => {
    setSelectedStudentId(id);
    const st = studentsForDropdown.find(x => x.id === id);
    if (st) {
      setSf((prev: any) => ({ ...prev, basic_name: st.full_name, basic_phone: st.phone || '' }));
      setFormTitle(st.full_name);
    }
  };


  // Add Task modal state
  const [showAddTask, setShowAddTask] = useState(false);
  const [tfName, setTfName] = useState('');
  const [tfEstimate, setTfEstimate] = useState(60);
  const [tfPriority, setTfPriority] = useState<Priority>('Medium');
  const [tfStatus, setTfStatus] = useState<TaskStatus>('Todo');
  const [tfArea, setTfArea] = useState<'Active' | 'Backlog'>('Active');
  const [tfAssigneeId, setTfAssigneeId] = useState('');
  const [tfAssignee, setTfAssignee] = useState('');
  const [tfAvatar, setTfAvatar] = useState('');
  const [tfDesc, setTfDesc] = useState('');

  // Task Details modal
  const [selectedTask, setSelectedTask] = useState<{ caseId: string; task: Task } | null>(null);

  // Derived filters (branch filtering now done at database level)
  const branches = useMemo(() => ['All', ...Array.from(new Set(cases.map(c => c.branch).filter(Boolean))) as string[]], [cases]);
  const types = useMemo(() => ['All', ...Array.from(new Set(cases.map(c => c.type).filter(Boolean))) as string[]], [cases]);
  const statuses: (CaseStage | 'All')[] = ['All', ...CASE_STAGES];
  const filteredCases = useMemo(() => {
    const term = search.trim().toLowerCase();
    return cases.filter(c => {
      // Branch filtering is now done at database level via RLS and selectedBranch
      if (filterType !== 'All' && c.type !== filterType) return false;
      if (filterStatus !== 'All' && (c.status || '') !== filterStatus) return false;
      if (term && !(`${c.caseId}`.toLowerCase().includes(term) || (c.title || '').toLowerCase().includes(term))) return false;
      return true;
    });
  }, [cases, filterType, filterStatus, search]);

  const activeCase = useMemo(() => cases.find(c => c.caseId === activeCaseId) || cases[0], [cases, activeCaseId]);
  const tasks = tab === 'Active' ? activeCase?.active || [] : activeCase?.backlog || [];

  const BOARD_COLUMNS: TaskStatus[] = ['Todo', 'In Progress', 'In Review', 'Done'];
  const displayStatus = (s: TaskStatus) => (s === 'Todo' ? 'To Do' : s);

  // Load tasks for active case from Supabase and keep in sync
  const loadTasksForCase = async (caseId: string) => {
    const { data, error } = await supabase
      .from('dashboard_tasks')
      .select('id, case_number, name, estimate_mins, spent_mins, assignee_name, assignee_avatar, assignee_id, priority, status, is_backlog, description, created_at')
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
        assignee: { id: row.assignee_id || undefined, name: row.assignee_name || 'Unassigned', avatar: row.assignee_avatar || undefined },
        priority: (row.priority || 'Medium') as Priority,
        status: (row.status || 'Todo') as TaskStatus,
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

  const updateTaskStatus = async (taskId: string, next: TaskStatus) => {
    if (!canEdit) { showToast('Not permitted', 'error'); return; }

    // Optimistic UI
    setCases(prev => prev.map(c => {
      if (c.caseId !== activeCaseId) return c;
      const mapper = (arr: Task[]) => arr.map(t => t.id === taskId ? { ...t, status: next } : t);
      return { ...c, active: mapper(c.active), backlog: mapper(c.backlog) };
    }));
    // Persist
    await supabase.from('dashboard_tasks').update({ status: next }).eq('id', taskId).eq('case_number', activeCaseId || '');
  };

  const moveTask = async (payload: { id: string; from: 'active' | 'backlog' }, to: { area: 'active' | 'backlog'; status?: TaskStatus }) => {
    if (!canEdit) { showToast('Not permitted', 'error'); return; }

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
        const updated = { ...task, status: 'Todo' as TaskStatus } as Task;
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

  // Drag-and-drop: change case stage on board
  const handleCaseCardDragStart = (caseId: string) => (e: React.DragEvent) => {
    try {
      e.stopPropagation();
      e.dataTransfer.setData('text/case', caseId);
      e.dataTransfer.setData('text/plain', caseId);
      e.dataTransfer.effectAllowed = 'move';
    } catch { }
  };
  const handleDropCaseToStatus = (next: CaseStage) => async (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const rawId = e.dataTransfer.getData('text/case') || e.dataTransfer.getData('text/plain');
      const id = rawId && String(rawId);
      if (!canEdit) { showToast('Not permitted', 'error'); return; }

      if (!id) return;
      let prevStatus: CaseStage | undefined;
      // Optimistic UI update and capture previous
      setCases(prev => prev.map(c => {
        if (c.caseId === id) {
          prevStatus = (c.status || 'Initial Stage') as CaseStage;
          return { ...c, status: next };
        }
        return c;
      }));
      const { error } = await supabase.from('dashboard_cases').update({ stage: next, status: next }).eq('case_number', id);
      if (error) {
        // revert
        setCases(prev => prev.map(c => c.caseId === id ? { ...c, status: prevStatus } : c));
        showToast('Failed to update stage', 'error');
      } else {
        setJustDroppedId(id);
        setTimeout(() => setJustDroppedId(null), 500);
        showToast(`Moved case ${id} to ${next}`);
      }
    } catch (err) {
      console.error('Drop error:', err);
      showToast('Failed to update stage', 'error');
    }
  };


  const handleDragStart = (t: Task, from: 'active' | 'backlog') => (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: t.id, from }));
  };
  const handleDropToStatus = (status: TaskStatus) => (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const payload = JSON.parse(e.dataTransfer.getData('text/plain')) as { id: string; from: 'active' | 'backlog' };
      moveTask(payload, { area: 'active', status });
    } catch { }
  };
  const handleDropToBacklog = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const payload = JSON.parse(e.dataTransfer.getData('text/plain')) as { id: string; from: 'active' | 'backlog' };
      moveTask(payload, { area: 'backlog' });
    } catch { }
  };

  const addCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdd) { showToast('Not permitted', 'error'); return; }

    const title = formTitle.trim() || sf.basic_name || 'New Case';
    if (!title) return;
    const assignees = formAssignees.split(',').map(s => s.trim()).filter(Boolean);
    const sel = selectedStudentId ? studentsForDropdown.find(x => x.id === selectedStudentId) : null;
    const payload: any = {
      title,
      assignees,
      status: 'Initial Stage',
      stage: 'Initial Stage',
      student_id: selectedStudentId || null,
      student_info: { ...sf, student: sel ? { id: sel.id, full_name: sel.full_name, cnic: sel.cnic, batch_no: sel.batch_no, phone: sel.phone, program_title: sel.program_title } : undefined }
    };
    const { data, error } = await supabase
      .from('dashboard_cases')
      .insert([payload])
      .select('case_number')
      .single();
    if (!error && data) {
      setActiveCaseId(data.case_number);
      setShowAddCase(false);
      setFormCaseId(''); setFormTitle(''); setFormAssignees(''); setFormEstimate(0); setFormPriority('Medium'); setSelectedStudentId('');
      setSf({
        basic_name: '', basic_dob: '', basic_address: '', basic_date: '', basic_email: '', basic_nationality: '', basic_phone: '', basic_passport_number: '',
        ug_olevels: false, ug_olevels_year: '', ug_olevels_grades: '', ug_alevels: false, ug_alevels_year: '', ug_alevels_grades: '', ug_matric: false, ug_matric_year: '', ug_matric_grades: '', ug_hssc: false, ug_hssc_year: '', ug_hssc_grades: '', ug_other: '',
        pg_bachelors: false, pg_bachelors_university: '', pg_bachelors_course: '', pg_bachelors_year: '', pg_bachelors_grades: '', pg_masters: false, pg_masters_university: '', pg_masters_course: '', pg_masters_year: '', pg_masters_grades: '',
        eng_ielts: false, eng_toefl: false, eng_pte: false, eng_duolingo: false, eng_other: '', eng_score: '',
        work_exp: '',
        coi_uk: false, coi_usa: false, coi_canada: false, coi_malaysia: false, coi_germany: false, coi_australia: false, coi_others: '',
        add_course_or_uni: '', add_travel_history: '', add_visa_refusal: '', add_asylum_family: '',
        office_date: '', office_application_started: '', office_university_applied: '', office_counsellor_name: '', office_counsellor_sign: '', office_next_follow_up_date: ''
      });
    }
  };

  const newTaskId = () => `TS${Date.now().toString().slice(-8)}`;

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCaseId) return;
    const id = newTaskId();
    if (!canAdd) { showToast('Not permitted', 'error'); return; }

    const name = tfName.trim() || 'Untitled Task';
    const estimate_mins = Math.max(0, Number(tfEstimate) || 0);
    const spent_mins = 0;
    const assignee_name = tfAssignee.trim() || 'Unassigned';
    const assignee_avatar = tfAvatar.trim() || undefined;
    const assignee_id = tfAssigneeId || null;
    const priority = tfPriority;
    const status = tfArea === 'Backlog' ? 'Todo' : tfStatus;
    const description = tfDesc.trim() || undefined;
    const is_backlog = tfArea === 'Backlog';

    // Optimistic UI
    const task: Task = {
      id,
      name,
      estimateMins: estimate_mins,
      spentMins: spent_mins,
      assignee: { id: assignee_id || undefined, name: assignee_name, avatar: assignee_avatar },
      priority,
      status,
      description,
    };
    setCases(prev => prev.map(c => {
      if (c.caseId !== activeCaseId) return c;
      if (!is_backlog) return { ...c, active: [task, ...c.active] };
      return { ...c, backlog: [task, ...c.backlog] };
    }));

    // Persist
    await supabase.from('dashboard_tasks').insert([{
      id,
      case_number: activeCaseId,
      name,
      estimate_mins,
      spent_mins,
      assignee_name,
      assignee_avatar,
      assignee_id,
      priority,
      status,
      is_backlog,
      description,
    }]);

    setShowAddTask(false);
    setTfName('');
    setTfEstimate(60);
    setTfPriority('Medium');
    setTfStatus('Todo');
    setTfArea('Active');
    setTfAssigneeId('');
    setTfAssignee('');
    setTfAvatar('');
    setTfDesc('');
  };

  return (
    <>
      <Helmet>
        <title>On Going Cases | GSL Pakistan CRM</title>
        <meta name="description" content="Manage and track ongoing cases, tasks, and assignees." />
      </Helmet>

      {/* Toast placeholder for build test */}
      {false && <div />}

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
                <button onClick={() => canAdd ? setShowAddCase(true) : null} disabled={!canAdd} className={`px-4 py-2 rounded-full font-bold text-white bg-[#ffa332] shadow-[0px_6px_12px_#3f8cff43] hover:opacity-95 ${!canAdd ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  + Add Case
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Cases Sidebar - Collapsible */}
              {!isAllCasesCollapsed && (
                <aside className="lg:col-span-4 xl:col-span-3 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold">All Cases</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text-secondary">{filteredCases.length} total</span>
                      <button
                        onClick={() => setIsAllCasesCollapsed(true)}
                        className="text-text-secondary hover:text-text-primary p-1"
                        title="Collapse sidebar"
                      >
                        ◀
                      </button>
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="mb-3 grid grid-cols-1 gap-2">
                    <input value={search} onChange={e => setSearch(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="Search by ID or Title" />
                    <BranchFilter
                      value={selectedBranch}
                      onChange={setSelectedBranch}
                      showAllOption={true}
                      className="w-full"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as CaseStage | 'All')} className="border rounded p-2 text-sm">
                        {statuses.map(s => <option key={s}>{s}</option>)}
                      </select>
                      <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border rounded p-2 text-sm">
                        {types.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="text-right">
                      <button type="button" onClick={() => { setSelectedBranch('all'); setFilterStatus('All'); setFilterType('All'); setSearch(''); }} className="text-xs text-text-secondary hover:underline">Clear filters</button>
                    </div>
                  </div>

                  <div className="-mx-2 px-2 overflow-y-auto" style={{ maxHeight: '520px' }}>
                    {filteredCases.map((c, idx) => {
                      const active = c.caseId === activeCaseId;
                      return (
                        <div
                          key={c.caseId}
                          draggable
                          onClick={() => { setActiveCaseId(c.caseId); setContentMode('tasks'); }}
                          onDragStart={(e) => { e.dataTransfer.setData('text/case', c.caseId); e.dataTransfer.effectAllowed = 'move'; }}
                          className={`mb-2 rounded-lg border ${active ? 'border-[#ffa332] bg-orange-50/30' : 'border-gray-200'} p-3 cursor-pointer`}
                          title="Click to view tasks • Drag onto a Kanban column to change status"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs text-text-muted">{c.caseId}</div>
                              <div className="font-semibold">{c.title}</div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setActiveCaseId(c.caseId); navigate(`/cases/${c.caseId}`); }} className={`text-xs font-semibold ${active ? 'text-[#ffa332]' : 'text-blue-600'} hover:underline`}>
                              View details &gt;
                            </button>
                          </div>
                          {!active && (
                            <div className="mt-1 text-xs text-text-secondary">{(c.assignees || []).join(', ') || c.employee || 'Unassigned'}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </aside>
              )}

              {/* Collapsed Sidebar Toggle Button */}
              {isAllCasesCollapsed && (
                <div className="lg:col-span-1 flex items-start">
                  <button
                    onClick={() => setIsAllCasesCollapsed(false)}
                    className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-3 hover:bg-gray-50"
                    title="Expand sidebar"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-xl">▶</span>
                      <span className="text-xs font-semibold writing-mode-vertical transform rotate-180">All Cases</span>
                    </div>
                  </button>
                </div>
              )}

              {/* Tasks Section */}
              <section
                className={`${isAllCasesCollapsed ? 'lg:col-span-11 xl:col-span-11' : 'lg:col-span-8 xl:col-span-9'} rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-4 ${isCaseDragOver ? 'border-2 border-dashed border-[#ffa332] bg-orange-50/20' : 'bg-white'}`}
                onDragOver={(e) => { if (e.dataTransfer.types.includes('text/case')) { e.preventDefault(); } }}
                onDragEnter={(e) => { if (e.dataTransfer.types.includes('text/case')) setIsCaseDragOver(true); }}
                onDragLeave={(e) => { setIsCaseDragOver(false); }}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/case'); if (id) { setActiveCaseId(id); } setIsCaseDragOver(false); }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold">{contentMode === 'cases' ? 'Cases' : `Tasks for ${activeCaseId}`}</h3>
                    {contentMode === 'tasks' && (
                      <button onClick={() => setContentMode('cases')} className="text-xs text-blue-600 hover:underline">Show all cases</button>
                    )}
                  </div>
                  {/* View toggles + board controls */}
                  <div className="flex items-center gap-2">
                    {view === 'board' && (
                      <>
                        <button title="Filters" className="px-2 py-1 rounded hover:bg-gray-100">⚲</button>
                        <button title="Sort" className="px-2 py-1 rounded hover:bg-gray-100">⇅</button>
                      </>
                    )}
                    <button onClick={() => setView('list')} className={`px-2 py-1 rounded ${view === 'list' ? 'bg-gray-100' : ''}`} aria-label="List view">≣</button>
                    <button onClick={() => setView('grid')} className={`px-2 py-1 rounded ${view === 'grid' ? 'bg-gray-100' : ''}`} aria-label="Grid view">▦</button>
                    <button onClick={() => setView('board')} className={`px-2 py-1 rounded ${view === 'board' ? 'bg-gray-100' : ''}`} aria-label="Board view">▤</button>
                  </div>
                </div>
                {contentMode === 'tasks' && (
                  <>
                    <div className="mt-3 flex items-center gap-2">
                      <button onClick={() => setTab('Active')} className={`px-3 py-1.5 rounded text-sm font-semibold ${tab === 'Active' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>Active</button>
                      <button onClick={() => setTab('Backlog')} className={`px-3 py-1.5 rounded text-sm font-semibold ${tab === 'Backlog' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>Backlog</button>
                    </div>

                    {view === 'list' ? (
                      <>
                        <div className="mt-3 grid grid-cols-12 text-xs text-text-secondary px-2">
                          <div className="col-span-5">Task</div>
                          <div className="col-span-3">Assignee</div>
                          <div className="col-span-2">Estimate</div>
                          <div className="col-span-2 text-right">Status</div>
                        </div>
                        <div className="mt-1 divide-y overflow-y-auto" style={{ maxHeight: '520px' }}>
                          {(tasks || []).length === 0 && <div className="py-8 text-center text-text-secondary">No tasks</div>}
                          {(tasks || []).map(t => (
                            <div key={t.id} className="w-full text-left py-3 px-2">
                              <div className="grid grid-cols-12 items-center gap-2">
                                <div className="col-span-5 font-semibold truncate">{t.name}</div>
                                <div className="col-span-3 text-sm">{t.assignee.name}</div>
                                <div className="col-span-2 text-sm">{fmtDur(t.estimateMins)}</div>
                                <div className="col-span-2 text-right">
                                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${TASK_STATUS_STYLES[t.status].bg} ${TASK_STATUS_STYLES[t.status].text}`}>
                                    <span>{displayStatus(t.status)}</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : view === 'grid' ? (
                      <>
                        <div className="mt-3">
                          {(tasks || []).length === 0 ? (
                            <div className="py-8 text-center text-text-secondary">No tasks</div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" style={{ maxHeight: '520px', overflowY: 'auto' }}>
                              {(tasks || []).map(t => (
                                <div key={t.id} className="text-left bg-white rounded-lg border p-3 shadow-sm">
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs text-text-secondary">{t.assignee.name}</div>
                                    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${TASK_STATUS_STYLES[t.status].bg} ${TASK_STATUS_STYLES[t.status].text}`}>
                                      <span>{displayStatus(t.status)}</span>
                                    </span>
                                  </div>
                                  <div className="mt-1 font-semibold truncate">{t.name}</div>
                                  <div className="mt-2 text-xs text-text-secondary">Est: {fmtDur(t.estimateMins)}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mt-3">
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                            {BOARD_COLUMNS.map(col => {
                              const colTasks = (tab === 'Active' ? (activeCase?.active || []) : (activeCase?.backlog || [])).filter(t => t.status === col);
                              return (
                                <div key={col} onDragOver={(e) => e.preventDefault()} onDrop={handleDropToStatus(col)} className="rounded-lg border p-2 min-h-[180px] border-dashed border-gray-300 bg-gray-50/50">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="font-semibold">{displayStatus(col)}</div>
                                    <span className="text-xs text-text-secondary">{colTasks.length}</span>
                                  </div>
                                  <div className="space-y-2">
                                    {colTasks.map(t => (
                                      <div key={t.id} className="w-full text-left bg-white rounded-md border p-2 shadow-sm">
                                        <div className="flex items-center justify-between text-xs text-text-secondary">
                                          <span className="truncate">{t.assignee.name}</span>
                                          <span>{fmtDur(t.estimateMins)}</span>
                                        </div>
                                        <div className="mt-1 font-semibold text-sm truncate">{t.name}</div>
                                      </div>
                                    ))}
                                    {colTasks.length === 0 && (
                                      <div className="text-xs text-text-secondary text-center py-4">No tasks</div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}


                {contentMode === 'cases' && (view === 'list' ? (
                  <>
                    {/* Cases list header */}
                    <div className="mt-3 grid grid-cols-12 text-xs text-text-secondary px-2">
                      <div className="col-span-1">Case ID</div>
                      <div className="col-span-2">Title</div>
                      <div className="col-span-1">Branch</div>
                      <div className="col-span-1">Type</div>
                      <div className="col-span-2">University</div>
                      <div className="col-span-2">Course</div>
                      <div className="col-span-1">Date Added</div>
                      <div className="col-span-1">Assignees</div>
                      <div className="col-span-1 text-right">Stage</div>
                    </div>

                    {/* Cases list */}
                    <div className="mt-1 divide-y overflow-y-auto" style={{ maxHeight: '520px' }}>
                      {filteredCases.length === 0 && (
                        <div className="py-8 text-center text-text-secondary">No cases found.</div>
                      )}
                      {filteredCases.map(c => {
                        const stage = (c.status || 'Initial Stage') as CaseStage;
                        const sStyle = CASE_STAGE_COLORS[stage];
                        return (
                          <button key={c.caseId} onClick={() => navigate(`/cases/${c.caseId}`)} className="w-full text-left py-3 px-2 hover:bg-gray-50">
                            <div className="grid grid-cols-12 items-center gap-2">
                              <div className="col-span-1 font-mono text-xs text-text-secondary">{c.caseId}</div>
                              <div className="col-span-2 font-semibold truncate">{c.title}</div>
                              <div className="col-span-1 text-sm truncate">{c.branch || '—'}</div>
                              <div className="col-span-1 text-sm truncate">{c.type || '—'}</div>
                              <div className="col-span-2 text-sm truncate">{c.universityName || '—'}</div>
                              <div className="col-span-2 text-sm truncate">{c.courseName || '—'}</div>
                              <div className="col-span-1 text-xs text-text-secondary">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</div>
                              <div className="col-span-1 truncate text-sm">{(c.assignees || []).join(', ') || c.employee || 'Unassigned'}</div>
                              <div className="col-span-1 text-right">
                                <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${sStyle}`}>
                                  <span>{stage}</span>
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
                    {/* Grid of case cards */}
                    <div className="mt-3">
                      {filteredCases.length === 0 ? (
                        <div className="py-8 text-center text-text-secondary">No cases found.</div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" style={{ maxHeight: '520px', overflowY: 'auto' }}>
                          {filteredCases.map(c => (
                            <button key={c.caseId} onClick={() => navigate(`/cases/${c.caseId}`)} className="text-left bg-white rounded-lg border p-3 shadow-sm hover:shadow transition">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-text-secondary">
                                  <span className="font-mono">{c.caseId}</span>
                                </div>
                                {(() => {
                                  const stage = (c.status || 'Initial Stage') as CaseStage;
                                  return (
                                    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${CASE_STAGE_COLORS[stage]}`}>
                                      <span>{stage}</span>
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="mt-1 font-semibold">{c.title}</div>
                              <div className="mt-2 flex items-center justify-between text-xs text-text-secondary">
                                <span>{c.branch || '\u2014'} • {c.type || '\u2014'}</span>
                                <span>{(c.assignees || []).length || (c.employee ? 1 : 0)} assignee(s)</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Cases Kanban Board by status */}
                    <div className="mt-3">
                      <div className="mt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-2">
                          {CASE_STAGES.map((col) => {
                            const colCases = filteredCases.filter(c => (c.status || 'Initial Stage') === col);
                            return (
                              <div
                                key={col}
                                onDragOver={(e) => e.preventDefault()}
                                onDragEnter={(e) => { if (Array.from(e.dataTransfer.types || []).includes('text/case')) setBoardDropCol(col); }}
                                onDragLeave={(e) => {
                                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                    setBoardDropCol(null);
                                  }
                                }}
                                onDrop={(e) => { handleDropCaseToStatus(col)(e); setBoardDropCol(null); }}
                                className={`rounded-lg border p-2 min-h-[180px] ${boardDropCol === col ? 'border-[#ffa332] ring-2 ring-[#ffa332] bg-orange-50/40 animate-pulse' : 'border-dashed border-gray-300 bg-gray-50/50'}`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="font-semibold">{col}</div>
                                  <span className="text-xs text-text-secondary">{colCases.length}</span>
                                </div>
                                <div className="space-y-2">
                                  {colCases.map(c => (
                                    <div
                                      key={c.caseId}
                                      role="button"
                                      tabIndex={0}
                                      draggable
                                      onDragStart={handleCaseCardDragStart(c.caseId)}
                                      onClick={() => navigate(`/cases/${c.caseId}`)}
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/cases/${c.caseId}`); }}
                                      className={`w-full cursor-pointer text-left bg-white rounded-md border p-2 shadow-sm hover:shadow transition ${justDroppedId === c.caseId ? 'ring-2 ring-[#ffa332] animate-pulse' : ''}`}
                                    >
                                      <div className="flex items-center justify-between text-xs text-text-secondary">
                                        <span className="font-mono">{c.caseId}</span>
                                        <span className="truncate">{(c.assignees || []).join(', ') || c.employee || 'Unassigned'}</span>
                                      </div>
                                      <div className="mt-1 font-semibold text-sm">{c.title}</div>
                                      <div className="mt-2 flex items-center justify-between text-xs">
                                        <span className="text-text-secondary">{c.branch || '\u2014'} • {c.type || '\u2014'}</span>
                                        <span className="text-text-secondary">{(c.createdAt && new Date(c.createdAt).toLocaleDateString()) || ''}</span>
                                      </div>
                                    </div>
                                  ))}
                                  {colCases.length === 0 && (
                                    <div className="text-xs text-text-secondary text-center py-4">No cases</div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                ))}
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
              <button type="button" onClick={() => setShowAddCase(false)} className="text-text-secondary hover:opacity-70">✕</button>
            </div>

            {/* Case Meta */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <label><span className="text-text-secondary">Case ID</span><input value={formCaseId} onChange={e => setFormCaseId(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="Auto-generated" disabled /></label>
              <label className="sm:col-span-2"><span className="text-text-secondary">Case Title</span><input value={formTitle} onChange={e => setFormTitle(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="Case Title (optional)" /></label>
            </div>

            {/* Student Link */}
            <div className="mt-4">
              <h4 className="font-semibold">Student</h4>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <label className="sm:col-span-2"><span className="text-text-secondary">Select Student</span>
                  <select value={selectedStudentId} onChange={(e) => onSelectStudent(e.target.value)} className="mt-1 w-full border rounded p-2">
                    <option value="">— Select —</option>
                    {studentsForDropdown.map(st => (<option key={st.id} value={st.id}>{st.full_name} ({st.id})</option>))}
                  </select>
                </label>
                {selectedStudentId && (
                  <div className="text-xs text-text-secondary mt-2 sm:mt-6">
                    {(() => {
                      const st = studentsForDropdown.find(x => x.id === selectedStudentId); return st ? (
                        <div className="space-y-1">
                          <div>CNIC: {st.cnic || ''}</div>
                          <div>Batch: {st.batch_no || ''}</div>
                          <div>Contact: {st.phone || ''}</div>
                          <div>Service: {st.program_title || ''}</div>
                        </div>
                      ) : null
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Basic Info */}
            <div className="mt-5">
              <h4 className="font-semibold">Basic Info</h4>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <label><span className="text-text-secondary">Name</span><input value={sf.basic_name} onChange={e => setSf({ ...sf, basic_name: e.target.value })} className="mt-1 w-full border rounded p-2" required /></label>
                <label><span className="text-text-secondary">Date of Birth</span><input type="date" value={sf.basic_dob} onChange={e => setSf({ ...sf, basic_dob: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
                <label><span className="text-text-secondary">Date</span><input type="date" value={sf.basic_date} onChange={e => setSf({ ...sf, basic_date: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
                <label className="sm:col-span-2 lg:col-span-3"><span className="text-text-secondary">Address</span><input value={sf.basic_address} onChange={e => setSf({ ...sf, basic_address: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
                <label><span className="text-text-secondary">Email</span><input type="email" value={sf.basic_email} onChange={e => setSf({ ...sf, basic_email: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
                <label><span className="text-text-secondary">Nationality</span><input value={sf.basic_nationality} onChange={e => setSf({ ...sf, basic_nationality: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
                <label><span className="text-text-secondary">Phone No</span><input value={sf.basic_phone} onChange={e => setSf({ ...sf, basic_phone: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
                <label className="sm:col-span-2 lg:col-span-1"><span className="text-text-secondary">Passport Number</span><input value={sf.basic_passport_number} onChange={e => setSf({ ...sf, basic_passport_number: e.target.value })} className="mt-1 w-full border rounded p-2" placeholder="Passport number" /></label>
              </div>
            </div>

            {/* Undergrad */}
            <div className="mt-6">
              <h4 className="font-semibold">For Undergrad</h4>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.ug_olevels} onChange={e => setSf({ ...sf, ug_olevels: e.target.checked })} />O-Levels</label>
                <input placeholder="Year" value={sf.ug_olevels_year} onChange={e => setSf({ ...sf, ug_olevels_year: e.target.value })} className="border rounded p-2" />
                <input placeholder="Grades" value={sf.ug_olevels_grades} onChange={e => setSf({ ...sf, ug_olevels_grades: e.target.value })} className="border rounded p-2 lg:col-span-2" />
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.ug_alevels} onChange={e => setSf({ ...sf, ug_alevels: e.target.checked })} />A-Levels</label>
                <input placeholder="Year" value={sf.ug_alevels_year} onChange={e => setSf({ ...sf, ug_alevels_year: e.target.value })} className="border rounded p-2" />
                <input placeholder="Grades" value={sf.ug_alevels_grades} onChange={e => setSf({ ...sf, ug_alevels_grades: e.target.value })} className="border rounded p-2 lg:col-span-2" />
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.ug_matric} onChange={e => setSf({ ...sf, ug_matric: e.target.checked })} />Matric</label>
                <input placeholder="Year" value={sf.ug_matric_year} onChange={e => setSf({ ...sf, ug_matric_year: e.target.value })} className="border rounded p-2" />
                <input placeholder="Grades" value={sf.ug_matric_grades} onChange={e => setSf({ ...sf, ug_matric_grades: e.target.value })} className="border rounded p-2 lg:col-span-2" />
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.ug_hssc} onChange={e => setSf({ ...sf, ug_hssc: e.target.checked })} />HSSC</label>
                <input placeholder="Year" value={sf.ug_hssc_year} onChange={e => setSf({ ...sf, ug_hssc_year: e.target.value })} className="border rounded p-2" />
                <input placeholder="Grades" value={sf.ug_hssc_grades} onChange={e => setSf({ ...sf, ug_hssc_grades: e.target.value })} className="border rounded p-2 lg:col-span-2" />
                <input placeholder="Other Education" value={sf.ug_other} onChange={e => setSf({ ...sf, ug_other: e.target.value })} className="border rounded p-2 sm:col-span-2 lg:col-span-4" />
              </div>
            </div>

            {/* Postgrad */}
            <div className="mt-6">
              <h4 className="font-semibold">For Postgrad</h4>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.pg_bachelors} onChange={e => setSf({ ...sf, pg_bachelors: e.target.checked })} />Bachelors</label>
                <input placeholder="University Name" value={sf.pg_bachelors_university} onChange={e => setSf({ ...sf, pg_bachelors_university: e.target.value })} className="border rounded p-2 lg:col-span-3" />
                <input placeholder="Course Name" value={sf.pg_bachelors_course} onChange={e => setSf({ ...sf, pg_bachelors_course: e.target.value })} className="border rounded p-2 lg:col-span-2" />
                <input placeholder="Year" value={sf.pg_bachelors_year} onChange={e => setSf({ ...sf, pg_bachelors_year: e.target.value })} className="border rounded p-2" />
                <input placeholder="Grades" value={sf.pg_bachelors_grades} onChange={e => setSf({ ...sf, pg_bachelors_grades: e.target.value })} className="border rounded p-2" />

                <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={sf.pg_masters} onChange={e => setSf({ ...sf, pg_masters: e.target.checked })} />Masters</label>
                <input placeholder="University Name" value={sf.pg_masters_university} onChange={e => setSf({ ...sf, pg_masters_university: e.target.value })} className="border rounded p-2 lg:col-span-3" />
                <input placeholder="Course Name" value={sf.pg_masters_course} onChange={e => setSf({ ...sf, pg_masters_course: e.target.value })} className="border rounded p-2 lg:col-span-2" />
                <input placeholder="Year" value={sf.pg_masters_year} onChange={e => setSf({ ...sf, pg_masters_year: e.target.value })} className="border rounded p-2" />
                <input placeholder="Grades" value={sf.pg_masters_grades} onChange={e => setSf({ ...sf, pg_masters_grades: e.target.value })} className="border rounded p-2" />
              </div>
            </div>

            {/* English Proficiency */}
            <div className="mt-6">
              <h4 className="font-semibold">English Proficiency Test</h4>
              <div className="mt-2 grid grid-cols-2 lg:grid-cols-6 gap-3 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.eng_ielts} onChange={e => setSf({ ...sf, eng_ielts: e.target.checked })} />IELTS</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.eng_toefl} onChange={e => setSf({ ...sf, eng_toefl: e.target.checked })} />TOEFL</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.eng_pte} onChange={e => setSf({ ...sf, eng_pte: e.target.checked })} />PTE</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.eng_duolingo} onChange={e => setSf({ ...sf, eng_duolingo: e.target.checked })} />Duolingo</label>
                <input placeholder="Other" value={sf.eng_other} onChange={e => setSf({ ...sf, eng_other: e.target.value })} className="border rounded p-2" />
                <input placeholder="Score" value={sf.eng_score} onChange={e => setSf({ ...sf, eng_score: e.target.value })} className="border rounded p-2" />
              </div>
            </div>

            {/* Work Experience */}
            <div className="mt-6">
              <h4 className="font-semibold">Work Experience</h4>
              <textarea value={sf.work_exp} onChange={e => setSf({ ...sf, work_exp: e.target.value })} className="mt-2 w-full border rounded p-2 text-sm" rows={3} placeholder="Describe work experience"></textarea>
            </div>

            {/* Country of Interest */}
            <div className="mt-6">
              <h4 className="font-semibold">Country of Interest</h4>
              <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.coi_uk} onChange={e => setSf({ ...sf, coi_uk: e.target.checked })} />United Kingdom</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.coi_usa} onChange={e => setSf({ ...sf, coi_usa: e.target.checked })} />United States of America</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.coi_canada} onChange={e => setSf({ ...sf, coi_canada: e.target.checked })} />Canada</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.coi_malaysia} onChange={e => setSf({ ...sf, coi_malaysia: e.target.checked })} />Malaysia</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.coi_germany} onChange={e => setSf({ ...sf, coi_germany: e.target.checked })} />Germany</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={sf.coi_australia} onChange={e => setSf({ ...sf, coi_australia: e.target.checked })} />Australia</label>
                <input placeholder="Others" value={sf.coi_others} onChange={e => setSf({ ...sf, coi_others: e.target.value })} className="border rounded p-2" />
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-6">
              <h4 className="font-semibold">Additional Info</h4>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <label className="sm:col-span-2"><span className="text-text-secondary">Course of interest / University</span><input value={sf.add_course_or_uni} onChange={e => setSf({ ...sf, add_course_or_uni: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
                <label className="sm:col-span-2"><span className="text-text-secondary">Any travel history</span><input value={sf.add_travel_history} onChange={e => setSf({ ...sf, add_travel_history: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
                <label><span className="text-text-secondary">Visa refusal (if any)</span><input value={sf.add_visa_refusal} onChange={e => setSf({ ...sf, add_visa_refusal: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
                <label><span className="text-text-secondary">Any asylum taken by family</span><input value={sf.add_asylum_family} onChange={e => setSf({ ...sf, add_asylum_family: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
              </div>
            </div>

            {/* Assignees & Controls */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label className="sm:col-span-2"><span className="text-text-secondary">Assignee(s)</span><input value={formAssignees} onChange={e => setFormAssignees(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="Comma separated" /></label>
              <label><span className="text-text-secondary">Estimate (minutes)</span><input type="number" min={0} value={formEstimate} onChange={e => setFormEstimate(Number(e.target.value))} className="mt-1 w-full border rounded p-2" /></label>
              <label><span className="text-text-secondary">Priority</span><select value={formPriority} onChange={e => setFormPriority(e.target.value as Priority)} className="mt-1 w-full border rounded p-2"><option>Low</option><option>Medium</option><option>High</option></select></label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowAddCase(false)} className="px-3 py-2 rounded border hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={!canCrud} className={`px-4 py-2 rounded bg-[#ffa332] text-white font-bold shadow-[0px_6px_12px_#3f8cff43] ${!canCrud ? 'opacity-50 cursor-not-allowed' : ''}`}>Save Case</button>
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
              <button type="button" onClick={() => setShowAddTask(false)} className="text-text-secondary hover:opacity-70">✕</button>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm sm:col-span-2">
                <span className="text-text-secondary">Task Name</span>
                <input value={tfName} onChange={e => setTfName(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="Task name" required />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Area</span>
                <select value={tfArea} onChange={e => setTfArea(e.target.value as 'Active' | 'Backlog')} className="mt-1 w-full border rounded p-2">
                  <option>Active</option>
                  <option>Backlog</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Status</span>
                <select value={tfStatus} onChange={e => setTfStatus(e.target.value as TaskStatus)} className="mt-1 w-full border rounded p-2" disabled={tfArea === 'Backlog'}>
                  <option>Todo</option>
                  <option>In Progress</option>
                  <option>In Review</option>
                  <option>Done</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Estimate (minutes)</span>
                <input type="number" min={0} value={tfEstimate} onChange={e => setTfEstimate(Number(e.target.value))} className="mt-1 w-full border rounded p-2" />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Priority</span>
                <select value={tfPriority} onChange={e => setTfPriority(e.target.value as Priority)} className="mt-1 w-full border rounded p-2">
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>
              <div className="text-sm">
                <span className="text-text-secondary">Assignee (teacher)</span>
                <div className="mt-1">
                  <TeacherSearchDropdown
                    value={tfAssigneeId}
                    onChange={(id, name, avatar) => { setTfAssigneeId(id); setTfAssignee(name); setTfAvatar(avatar || ''); }}
                    placeholder="Search teacher by name or email"
                  />
                </div>
              </div>
              <label className="text-sm sm:col-span-2">
                <span className="text-text-secondary">Description</span>
                <textarea value={tfDesc} onChange={e => setTfDesc(e.target.value)} className="mt-1 w-full border rounded p-2" rows={3} placeholder="Optional"></textarea>
              </label>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowAddTask(false)} className="px-3 py-2 rounded border hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={!canCrud} className={`px-4 py-2 rounded bg-[#ffa332] text-white font-bold shadow-[0px_6px_12px_#3f8cff43] ${!canCrud ? 'opacity-50 cursor-not-allowed' : ''}`}>Save Task</button>
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
              <button type="button" onClick={() => setShowCaseDetails(false)} className="text-text-secondary hover:opacity-70">✕</button>
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
                <div className="font-semibold">{(detailsCase.assignees || []).join(', ') || detailsCase.employee || 'Unassigned'}</div>
              </div>
              <div>
                <div className="text-text-secondary">Stage</div>
                <div className="font-semibold">{detailsCase.status || 'Initial Stage'}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-text-secondary">Created At</div>
                <div className="font-semibold">{detailsCase.createdAt ? new Date(detailsCase.createdAt).toLocaleString() : '—'}</div>
              </div>
            </div>
            <div className="mt-5 text-right">
              <button type="button" onClick={() => setShowCaseDetails(false)} className="px-3 py-2 rounded border hover:bg-gray-50">Close</button>
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
              <button type="button" onClick={() => setSelectedTask(null)} className="text-text-secondary hover:opacity-70">✕</button>


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
                <select value={selectedTask.task.status} onChange={(e) => { const v = e.target.value as TaskStatus; updateTaskStatus(selectedTask.task.id, v); setSelectedTask(s => s ? { ...s, task: { ...s.task, status: v } } : s); }} className="ml-2 border rounded p-2">
                  <option>Todo</option>
                  <option>In Progress</option>
                  <option>In Review</option>
                  <option>Done</option>
                </select>
              </label>
            </div>
            <div className="mt-5 text-right">
              <button onClick={() => setSelectedTask(null)} className="px-3 py-2 rounded border hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}


    </>
  );
};

export default Cases;


