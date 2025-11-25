import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../../components/common/Sidebar';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import TeacherSearchDropdown from '../../components/TeacherSearchDropdown';
import MultiSelectUser from '../../components/MultiSelectUser';
import MultiSelectUniversity from '../../components/MultiSelectUniversity';
import UniversityApplicationForm from '../../components/UniversityApplicationForm';
import UniversityApplicationHistory from '../../components/UniversityApplicationHistory';


// Shared types (keep in sync with index.tsx)
type Priority = 'Low' | 'Medium' | 'High';
type Status = 'Todo' | 'In Progress' | 'In Review' | 'Done';

type Task = {
  id: string;
  name: string;
  estimateMins: number;
  spentMins: number;
  assignee: { id?: string; name: string; avatar?: string };
  priority: Priority;
  status: Status;
  description?: string;
  isBacklog?: boolean;
  createdAt?: string;
};

type CaseItem = {
  caseId: string;
  title: string;
  description?: string;
  reporter?: string;
  assignees: string[];
  priority?: Priority;
  deadline?: string;
  createdAt?: string;
  studentId?: string;
  googleDriveLink?: string;
  universityIds?: number[];
  caseLeadBy?: string[];
};

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

const PRIORITY_STYLES: Record<Priority, { text: string; bg: string; border?: string }> = {
  High: { text: 'text-red-700', bg: 'bg-red-100', border: 'border-red-200' },
  Medium: { text: 'text-yellow-800', bg: 'bg-yellow-100', border: 'border-yellow-200' },
  Low: { text: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-200' },
};

const STATUS_STYLES: Record<Status, { text: string; bg: string; dot: string }> = {
  'Done': { text: 'text-emerald-700', bg: 'bg-emerald-100', dot: 'bg-emerald-500' },
  'In Progress': { text: 'text-blue-700', bg: 'bg-blue-100', dot: 'bg-blue-500' },
  'In Review': { text: 'text-purple-700', bg: 'bg-purple-100', dot: 'bg-purple-500' },
  'Todo': { text: 'text-gray-700', bg: 'bg-gray-100', dot: 'bg-gray-400' },
};


type CaseStage =
  | 'Initial Stage'
  | 'Offer Applied'
  | 'Offer Received'
  | 'Fee Paid'
  | 'Interview'
  | 'CAS Applied'
  | 'CAS Received'
  | 'Visa Applied'
  | 'Visa Received'
  | 'Enrollment'
  | 'Backout'
  | 'Visa Rejected';

const CASE_STAGES: CaseStage[] = [
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
  'Backout',
  'Visa Rejected',
];

const CASE_STAGE_COLORS: Record<CaseStage, string> = {
  'Initial Stage': 'bg-gray-100 text-gray-800',
  'Offer Applied': 'bg-blue-50 text-blue-800',
  'Offer Received': 'bg-indigo-50 text-indigo-800',
  'Fee Paid': 'bg-emerald-50 text-emerald-800',
  'Interview': 'bg-yellow-50 text-yellow-800',
  'CAS Applied': 'bg-sky-50 text-sky-800',
  'CAS Received': 'bg-sky-100 text-sky-900',
  'Visa Applied': 'bg-purple-50 text-purple-800',
  'Visa Received': 'bg-green-100 text-green-800',
  'Enrollment': 'bg-teal-50 text-teal-800',
  'Backout': 'bg-gray-200 text-gray-700',
  'Visa Rejected': 'bg-red-100 text-red-800',
};

type ApplicationHistoryItem = {
  id: string;
  detailsTimestamp: string | null;
  status: CaseStage;
  comment: string | null;
  commentBy: string | null;
  commentByName: string | null;
};


const CaseTaskDetailPage: React.FC = () => {
  const navigate = useNavigate();

  const [universities, setUniversities] = useState<{ id: number; name: string }[]>([]);
  const [savingUniversity, setSavingUniversity] = useState(false);

  const { caseNumber, taskId } = useParams();

  const [caseItem, setCaseItem] = useState<CaseItem | null>(null);
  const [studentCases, setStudentCases] = useState<CaseItem[]>([]);
  const [task, setTask] = useState<Task | null>(null);
  const [caseTasks, setCaseTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [tfName, setTfName] = useState('');
  const [tfEstimate, setTfEstimate] = useState(60);
  const [tfPriority, setTfPriority] = useState<Priority>('Medium');
  const [tfStatus, setTfStatus] = useState<Status>('Todo');
  const [tfAssigneeId, setTfAssigneeId] = useState('');
  const [tfAssignee, setTfAssignee] = useState('');
  const [tfAvatar, setTfAvatar] = useState('');
  const [tfDesc, setTfDesc] = useState('');
  const [logMins, setLogMins] = useState(0);

  const [isSuper, setIsSuper] = useState(false);
  const [caseAccess, setCaseAccess] = useState<'CRUD' | 'VIEW' | 'NONE'>('NONE');
  const [permFlags, setPermFlags] = useState<{ add: boolean; edit: boolean; del: boolean }>({ add: false, edit: false, del: false });
  const canEditCaseMeta = isSuper || permFlags.edit || caseAccess === 'CRUD';


  // Editing states
  const [editingCaseDesc, setEditingCaseDesc] = useState(false);
  const [caseDescDraft, setCaseDescDraft] = useState('');
  const [taskDescDraft, setTaskDescDraft] = useState('');
  const [editingDriveLink, setEditingDriveLink] = useState(false);
  const [driveLinkDraft, setDriveLinkDraft] = useState('');

  // Attachments
  const [caseFiles, setCaseFiles] = useState<any[]>([]);
  const [taskFiles, setTaskFiles] = useState<any[]>([]);

  // Application history
  const [appHistory, setAppHistory] = useState<ApplicationHistoryItem[]>([]);
  const [showAddHistory, setShowAddHistory] = useState(false);
  const [histStatus, setHistStatus] = useState<CaseStage>('Initial Stage');
  const [histComment, setHistComment] = useState('');
  const [savingHistory, setSavingHistory] = useState(false);

  // University Application Tracking
  const [selectedUniversities, setSelectedUniversities] = useState<{ id: string; name: string }[]>([]);
  const [applicationFormOpen, setApplicationFormOpen] = useState(false);
  const [selectedUniversityForForm, setSelectedUniversityForForm] = useState<{ id: string; name: string } | null>(null);
  const [universityApplications, setUniversityApplications] = useState<any[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);


  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const email = auth.user?.email;
        if (!email) return;
        const { data: u } = await supabase
          .from('dashboard_users')
          .select('role, permissions')
          .eq('email', email)
          .maybeSingle();
        const roleStr = (u?.role || (auth.user as any)?.app_metadata?.role || (auth.user as any)?.user_metadata?.role || '')
          .toString()
          .toLowerCase();
        if (roleStr.includes('super')) {
          setIsSuper(true);
          setPermFlags({ add: true, edit: true, del: true });
          setCaseAccess('CRUD');
          return;
        }
        const { data: up } = await supabase
          .from('user_permissions')
          .select('module, access, can_add, can_edit, can_delete')
          .eq('user_email', email)
          .eq('module', 'cases');
        if (up && up.length) {
          const row: any = up[0];
          setPermFlags({ add: !!row.can_add, edit: !!row.can_edit, del: !!row.can_delete });
          if (row.access) {
            setCaseAccess(row.access === 'CRUD' ? 'CRUD' : row.access === 'VIEW' ? 'VIEW' : 'NONE');
          }
        } else {
          const perms = Array.isArray(u?.permissions) ? (u?.permissions as any as string[]) : [];
          setCaseAccess(perms.includes('cases') ? 'CRUD' : 'NONE');
        }
      } catch {
        // ignore
      }
    })();
  }, []);


  const loadCase = useCallback(async () => {
    if (!caseNumber) return;
    const { data, error } = await supabase
      .from('dashboard_cases')
      .select('case_number, title, assignees, employee, status, branch, type, created_at, student_info, google_drive_link, university_id')
      .eq('case_number', caseNumber)
      .single();
    if (!error && data) {
      const info = (data.student_info || {}) as any;
      const c: CaseItem = {
        caseId: data.case_number,
        title: data.title || 'Untitled',
        description: info.description || '',
        reporter: data.employee || '',
        assignees: Array.isArray(data.assignees) ? data.assignees : (data.employee ? [data.employee] : []),
        priority: (data.status && String(data.status).includes('Progress')) ? 'Medium' : 'Low',
        deadline: undefined,
        createdAt: data.created_at,
        studentId: info.student_id || undefined,
        googleDriveLink: (data as any).google_drive_link || undefined,
        universityIds: info.university_ids || (data.university_id ? [data.university_id] : []),
        caseLeadBy: info.case_lead_by || [],
      };
      setCaseItem(c);
      // Load other cases by same student if possible
      if (info.student_id) {
        const { data: sc } = await supabase
          .from('dashboard_cases')
          .select('case_number, title, created_at')
          .filter('student_info->>student_id', 'eq', String(info.student_id))
          .order('created_at', { ascending: false });
        setStudentCases((sc || []).map((r: any) => ({ caseId: r.case_number, title: r.title, assignees: [] })));
      } else {
        setStudentCases([]);
      }
    }
  }, [caseNumber]);

  // Load universities for dropdown
  const loadUniversities = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('universities')
        .select('id, name')
        .order('name', { ascending: true })
        .limit(1000);
      if (error) {
        console.error('load universities for case detail error', error);
        return;
      }
      console.log('universities for case detail', data);
      setUniversities((data || []) as { id: number; name: string }[]);
    } catch (err) {
      console.error('load universities for case detail error', err);
    }
  }, []);

  useEffect(() => {
    loadUniversities();
  }, [loadUniversities]);

  const saveCaseUniversity = async (ids: number[]) => {
    if (!caseNumber || !canEditCaseMeta) return;
    setSavingUniversity(true);
    try {
      const { data: row } = await supabase.from('dashboard_cases').select('student_info').eq('case_number', caseNumber).single();
      const info = (row?.student_info || {}) as any;
      const nextInfo = { ...info, university_ids: ids };

      // Also update the legacy university_id column with the first selected university, or null
      const primaryId = ids.length > 0 ? ids[0] : null;

      await supabase
        .from('dashboard_cases')
        .update({
          university_id: primaryId,
          student_info: nextInfo
        })
        .eq('case_number', caseNumber);

      await loadCase();
      await supabase.from('activity_log').insert([
        {
          entity: 'case',
          action: 'Updated case universities',
          detail: { case_number: caseNumber, university_ids: ids },
        },
      ]);
    } catch (err) {
      console.error('save case university error', err);
      alert('Failed to update universities for this case');
    } finally {
      setSavingUniversity(false);
    }
  };

  const saveCaseLeadBy = async (ids: string[]) => {
    if (!caseNumber || !canEditCaseMeta) return;
    try {
      const { data: row } = await supabase.from('dashboard_cases').select('student_info').eq('case_number', caseNumber).single();
      const info = (row?.student_info || {}) as any;
      const nextInfo = { ...info, case_lead_by: ids };
      await supabase.from('dashboard_cases').update({ student_info: nextInfo }).eq('case_number', caseNumber);
      await loadCase();
    } catch (err) {
      console.error('save case lead by error', err);
      alert('Failed to update case lead by');
    }
  };

  // Load university applications for this case
  const loadUniversityApplications = useCallback(async () => {
    if (!caseNumber) return;
    setLoadingApplications(true);
    try {
      const { data, error } = await supabase
        .from('case_university_applications')
        .select('*')
        .eq('case_id', caseNumber)
        .order('created_at', { ascending: false });

      if (!error) {
        setUniversityApplications(data || []);
      }
    } catch (err) {
      console.error('load university applications error', err);
    } finally {
      setLoadingApplications(false);
    }
  }, [caseNumber]);

  // Load selected universities when case loads
  useEffect(() => {
    if (caseItem && caseItem.universityIds) {
      const selected = universities.filter(u =>
        caseItem.universityIds?.includes(u.id)
      ).map(u => ({ id: String(u.id), name: u.name }));
      setSelectedUniversities(selected);
    }
  }, [caseItem, universities]);

  // Load applications when case loads
  useEffect(() => {
    loadUniversityApplications();
  }, [loadUniversityApplications]);

  // Handle university click to open application form
  const handleUniversityClick = (university: { id: string; name: string }) => {
    setSelectedUniversityForForm(university);
    setApplicationFormOpen(true);
  };

  // Handle application form submission
  const handleApplicationSubmit = async (data: { courseApplied: string; applicationDate: string; comment: string }) => {
    if (!caseNumber || !selectedUniversityForForm) return;

    try {
      const { data: auth } = await supabase.auth.getUser();
      const email = auth.user?.email;

      const { error } = await supabase
        .from('case_university_applications')
        .insert([{
          case_id: caseNumber,
          university_id: selectedUniversityForForm.id,
          course_applied: data.courseApplied,
          application_date: data.applicationDate,
          comment: data.comment,
          created_by: email || null,
        }]);

      if (error) {
        console.error('save application error', error);
        alert('Failed to save application');
        return;
      }

      // Reload applications
      await loadUniversityApplications();

      // Log activity
      await supabase.from('activity_log').insert([{
        entity: 'case',
        action: 'Added university application',
        detail: {
          case_number: caseNumber,
          university_id: selectedUniversityForForm.id,
          course: data.courseApplied
        },
      }]);
    } catch (err) {
      console.error('save application error', err);
      alert('Failed to save application');
    }
  };

  const loadTask = useCallback(async () => {
    if (!caseNumber || !taskId) { setTask(null); setTaskDescDraft(''); return; }
    const { data, error } = await supabase
      .from('dashboard_tasks')
      .select('id, name, estimate_mins, spent_mins, assignee_name, assignee_avatar, assignee_id, priority, status, description, created_at, is_backlog')
      .eq('case_number', caseNumber)
      .eq('id', taskId)
      .single();
    if (!error && data) {
      const t: Task = {
        id: data.id,
        name: data.name,
        estimateMins: data.estimate_mins ?? 0,
        spentMins: data.spent_mins ?? 0,
        assignee: { id: data.assignee_id || undefined, name: data.assignee_name || 'Unassigned', avatar: data.assignee_avatar || undefined },
        priority: (data.priority || 'Medium') as Priority,
        status: (data.status || 'Todo') as Status,
        description: data.description || '',
        createdAt: data.created_at,
        isBacklog: !!data.is_backlog,
      };
      setTask(t);
      setTaskDescDraft(t.description || '');
    }
  }, [caseNumber, taskId]);
  const loadCaseTasks = useCallback(async () => {
    if (!caseNumber) { setCaseTasks([]); return; }
    const { data } = await supabase
      .from('dashboard_tasks')
      .select('id, name, estimate_mins, spent_mins, assignee_name, assignee_avatar, assignee_id, priority, status, description, created_at, is_backlog')
      .eq('case_number', caseNumber)
      .order('created_at', { ascending: false });
    const mapped: Task[] = (data || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      estimateMins: r.estimate_mins ?? 0,
      spentMins: r.spent_mins ?? 0,
      assignee: { id: r.assignee_id || undefined, name: r.assignee_name || 'Unassigned', avatar: r.assignee_avatar || undefined },
      priority: (r.priority || 'Medium') as Priority,
      status: (r.status || 'Todo') as Status,
      description: r.description || '',
      createdAt: r.created_at,
      isBacklog: !!r.is_backlog,
    }));
    setCaseTasks(mapped);
  }, [caseNumber]);

  const loadApplicationHistory = useCallback(async () => {
    if (!caseNumber) {
      setAppHistory([]);
      return;
    }
    const { data, error } = await supabase
      .from('application_history')
      .select('id, case_number, details_timestamp, comment, status, comment_by, comment_by_name, created_at')
      .eq('case_number', caseNumber)
      .order('details_timestamp', { ascending: false })
      .order('created_at', { ascending: false });
    if (!error && data) {
      const mapped: ApplicationHistoryItem[] = (data as any[]).map((r: any) => ({
        id: r.id,
        detailsTimestamp: r.details_timestamp || r.created_at,
        status: r.status as CaseStage,
        comment: r.comment ?? null,
        commentBy: r.comment_by ?? null,
        commentByName: r.comment_by_name ?? null,
      }));
      setAppHistory(mapped);
    }
  }, [caseNumber]);




  const listCaseFiles = useCallback(async () => {
    if (!caseNumber) return;
    const { data } = await supabase.storage.from('attachments').list(`cases/${caseNumber}`, { limit: 100 });
    setCaseFiles(data || []);
  }, [caseNumber]);

  const listTaskFiles = useCallback(async () => {
    if (!caseNumber || !taskId) { setTaskFiles([]); return; }
    const { data } = await supabase.storage.from('attachments').list(`cases/${caseNumber}/tasks/${taskId}`, { limit: 100 });
    setTaskFiles(data || []);
  }, [caseNumber, taskId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await Promise.all([loadCase(), loadTask(), loadCaseTasks(), listCaseFiles(), listTaskFiles()]);
      if (mounted) setLoading(false);
    })();
    // Realtime subscriptions
    const chanTasks = supabase
      .channel(`detail:tasks:${caseNumber}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dashboard_tasks', filter: `case_number=eq.${caseNumber}` }, () => { loadTask(); loadCaseTasks(); })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(chanTasks); };
  }, [caseNumber, taskId, loadCase, loadTask, loadCaseTasks, listCaseFiles, listTaskFiles]);

  // Load & subscribe to application history separately so the panel stays live
  useEffect(() => {
    if (!caseNumber) {
      setAppHistory([]);
      return;
    }
    let mounted = true;
    (async () => {
      if (mounted) {
        await loadApplicationHistory();
      }
    })();
    const chanHistory = supabase
      .channel(`detail:application_history:${caseNumber}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'application_history', filter: `case_number=eq.${caseNumber}` },
        () => {
          loadApplicationHistory();
        }
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(chanHistory);
    };
  }, [caseNumber, loadApplicationHistory]);

  const saveCaseDescription = async () => {
    if (!caseNumber) return;
    // Merge description into student_info JSON instead of non-existent column
    const { data: row } = await supabase.from('dashboard_cases').select('student_info').eq('case_number', caseNumber).single();
    const info = (row?.student_info || {}) as any;
    const nextInfo = { ...info, description: caseDescDraft };
    await supabase.from('dashboard_cases').update({ student_info: nextInfo }).eq('case_number', caseNumber);
    await loadCase();
    // Log activity using standardized columns
    await supabase.from('activity_log').insert([{ entity: 'case', action: 'Updated case description', detail: { case_number: caseNumber } }]);
    setEditingCaseDesc(false);
  };

  const saveGoogleDriveLink = async () => {
    if (!caseNumber || !canEditCaseMeta) return;
    const trimmed = driveLinkDraft.trim();
    await supabase
      .from('dashboard_cases')
      .update({ google_drive_link: trimmed || null })
      .eq('case_number', caseNumber);
    await loadCase();
    await supabase
      .from('activity_log')
      .insert([{ entity: 'case', action: 'Updated Google Drive link', detail: { case_number: caseNumber } }]);
    setEditingDriveLink(false);
  };


  const saveTaskDescription = async () => {
    if (!caseNumber || !task) return;
    await supabase.from('dashboard_tasks').update({ description: taskDescDraft }).eq('case_number', caseNumber).eq('id', task.id);
    setTask({ ...task, description: taskDescDraft });
    await supabase.from('activity_log').insert([{ type: 'task_update', entity: 'task', case_number: caseNumber, task_id: task.id, message: 'Updated task description' }]);
  };

  const addApplicationHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseNumber || !histStatus) return;
    setSavingHistory(true);
    try {
      const payload = {
        case_number: caseNumber,
        status: histStatus,
        comment: histComment.trim() || null,
      };
      const { error } = await supabase.from('application_history').insert([payload]);
      if (error) {
        console.error('Failed to add application history', error);
        alert('Could not save application update. Please try again.');
      } else {
        alert('Application update saved successfully.');
        setHistComment('');
        setHistStatus('Initial Stage');
        setShowAddHistory(false);
        await loadApplicationHistory();
      }
    } finally {
      setSavingHistory(false);
    }
  };




  const onUploadCaseFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!caseNumber || !e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    for (const f of files) {
      const path = `cases/${caseNumber}/${Date.now()}_${f.name}`;
      await supabase.storage.from('attachments').upload(path, f);
      // optional: log activity
      await supabase.from('activity_log').insert([{ type: 'file_upload', entity: 'case', case_number: caseNumber, message: `Uploaded ${f.name}` }]);
    }
    await listCaseFiles();
  };

  const onUploadTaskFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!caseNumber || !taskId || !e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    for (const f of files) {
      const path = `cases/${caseNumber}/tasks/${taskId}/${Date.now()}_${f.name}`;
      await supabase.storage.from('attachments').upload(path, f);
      await supabase.from('activity_log').insert([{ type: 'file_upload', entity: 'task', case_number: caseNumber, task_id: taskId, message: `Uploaded ${f.name}` }]);
    }
    await listTaskFiles();
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseNumber) return;
    const id = `TS${Date.now().toString().slice(-8)}`;
    const assignee_name = tfAssignee.trim() || 'Unassigned';
    const assignee_avatar = tfAvatar.trim() || undefined;
    const assignee_id = tfAssigneeId || null;
    await supabase.from('dashboard_tasks').insert([{
      id,
      case_number: caseNumber,
      name: tfName.trim() || 'Untitled Task',
      estimate_mins: Math.max(0, Number(tfEstimate) || 0),
      spent_mins: 0,
      assignee_name,
      assignee_avatar,
      assignee_id,
      priority: tfPriority,
      status: tfStatus,
      is_backlog: false,
      description: tfDesc.trim() || undefined,
    }]);
    setShowAddTask(false);
    setTfName('');
    setTfEstimate(60);
    setTfPriority('Medium');
    setTfStatus('Todo');
    setTfAssigneeId('');
    setTfAssignee('');
    setTfAvatar('');
    setTfDesc('');
  };

  const logTime = async () => {
    if (!task || !caseNumber) return;
    const next = Math.max(0, (task.spentMins || 0) + Math.max(0, Number(logMins) || 0));
    setTask({ ...task, spentMins: next });
    await supabase.from('dashboard_tasks').update({ spent_mins: next }).eq('case_number', caseNumber).eq('id', task.id);
    await supabase.from('activity_log').insert([{ type: 'time_log', entity: 'task', case_number: caseNumber, task_id: task.id, message: `Logged ${logMins}m` }]);
    setLogMins(0);
  };

  const switchStatus = async (next: Status) => {
    if (!task || !caseNumber) return;
    setTask({ ...task, status: next });
    await supabase.from('dashboard_tasks').update({ status: next }).eq('case_number', caseNumber).eq('id', task.id);
    await supabase.from('activity_log').insert([{ type: 'status_change', entity: 'task', case_number: caseNumber, task_id: task.id, message: `Status → ${next}` }]);
  };

  const fileUrl = (path: string) => supabase.storage.from('attachments').getPublicUrl(path).data.publicUrl;

  const studentCaseNav = useMemo(() => (
    <div className="mt-4">
      <div className="text-xs text-text-secondary">Student's Cases</div>
      <div className="mt-2 space-y-2">
        {studentCases.length === 0 && <div className="text-xs text-text-secondary">No other cases</div>}
        {studentCases.map(c => (
          <button key={c.caseId} onClick={() => navigate(`/cases/${c.caseId}`)} className={`w-full text-left px-2 py-1 rounded hover:bg-gray-50 ${c.caseId === caseNumber ? 'bg-orange-50/50 border border-[#ffa332]' : 'border border-transparent'}`}>
            <div className="text-sm font-semibold">{c.caseId}</div>
            <div className="text-xs text-text-secondary truncate">{c.title}</div>
          </button>
        ))}
      </div>
    </div>
  ), [studentCases, caseNumber, navigate]);

  if (!caseItem) return null;


  return (
    <main className="w-full min-h-screen bg-background-main flex">
      <Helmet>

        <div className="mt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Google Drive Link</span>
            {canEditCaseMeta && !editingDriveLink && (
              <button
                type="button"
                onClick={() => {
                  setDriveLinkDraft(caseItem?.googleDriveLink || '');
                  setEditingDriveLink(true);
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                {caseItem?.googleDriveLink ? 'Edit' : 'Add'}
              </button>
            )}
          </div>
          {!editingDriveLink ? (
            <div className="text-sm">
              {caseItem.googleDriveLink ? (
                <a
                  href={caseItem.googleDriveLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {caseItem.googleDriveLink}
                </a>
              ) : (
                <span className="text-text-secondary">
                  
                </span>
              )}
            </div>
          ) : (
            <div className="mt-1">
              <input
                type="url"
                value={driveLinkDraft}
                onChange={(e) => setDriveLinkDraft(e.target.value)}
                className="w-full border rounded p-2 text-sm"
                placeholder="https://drive.google.com/..."
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={saveGoogleDriveLink}
                  className="px-3 py-1.5 rounded bg-[#ffa332] text-white text-xs font-semibold"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingDriveLink(false)}
                  className="px-3 py-1.5 rounded border text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <title>Case Detail | GSL Pakistan CRM</title>
      </Helmet>
      <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
      <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
        <section className="mt-8 lg:mt-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/cases')} className="px-3 py-1.5 rounded-full border text-sm hover:bg-gray-50">← Back</button>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Case {caseNumber}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowAddTask(true)} className="px-4 py-2 rounded-full font-bold text-white bg-[#ffa332] hover:opacity-95">+ Add Task</button>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left panel: Case info */}
            <aside className="lg:col-span-3 bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a]">
              {loading && <div className="text-sm text-text-secondary">Loading...</div>}
              {caseItem && (
                <>
                  <div className="text-sm text-text-secondary">Case Number</div>
                  <div className="font-semibold">{caseItem.caseId}</div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-sm text-text-secondary">Case Description</div>
                    {!editingCaseDesc && (
                      <button type="button" onClick={() => { setCaseDescDraft(caseItem.description || ''); setEditingCaseDesc(true); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                    )}
                  </div>
                  {!editingCaseDesc ? (
                    <div className="text-sm">{caseItem.description || '—'}</div>
                  ) : (
                    <div className="mt-1">
                      <textarea value={caseDescDraft} onChange={e => setCaseDescDraft(e.target.value)} rows={3} className="w-full border rounded p-2 text-sm" />
                      <div className="mt-2 flex items-center gap-2">
                        <button onClick={saveCaseDescription} className="px-3 py-1.5 rounded bg-[#ffa332] text-white text-xs font-semibold">Save</button>
                        <button onClick={() => setEditingCaseDesc(false)} className="px-3 py-1.5 rounded border text-xs">Cancel</button>
                      </div>
                    </div>
                  )}
                  <div className="mt-3 text-sm text-text-secondary">Reporter</div>
                  <div className="text-sm">{caseItem.reporter || '—'}</div>
                  <div className="mt-3 text-sm text-text-secondary">Assigned Team</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {(caseItem.assignees || []).map((n, i) => (
                      <div key={i} className="inline-flex items-center gap-2 border rounded px-2 py-1">
                        <img src={'/images/img_image.svg'} className="w-6 h-6 rounded-full" />
                        <span className="text-sm">{n}</span>
                      </div>
                    ))}
                    {(!caseItem.assignees || caseItem.assignees.length === 0) && (
                      <div className="text-xs text-text-secondary">No assignees</div>
                    )}
                  </div>
                  <div className="mt-3 text-sm text-text-secondary">Priority</div>
                  <div className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${caseItem.priority ? PRIORITY_STYLES[caseItem.priority].bg : 'bg-gray-100'} ${caseItem.priority ? PRIORITY_STYLES[caseItem.priority].text : 'text-gray-700'}`}>
                    <span>{caseItem.priority || '—'}</span>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-secondary">Google Drive Link</span>
                      {canEditCaseMeta && !editingDriveLink && (
                        <button
                          type="button"
                          onClick={() => {
                            setDriveLinkDraft(caseItem.googleDriveLink || '');
                            setEditingDriveLink(true);
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {caseItem.googleDriveLink ? 'Edit' : 'Add'}
                        </button>
                      )}
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-secondary">Universities</span>
                        <button onClick={loadUniversities} className="text-xs text-blue-600 hover:underline">Refresh</button>
                      </div>
                      <MultiSelectUniversity
                        selectedIds={caseItem.universityIds || []}
                        onChange={saveCaseUniversity}
                        className="mt-1"
                      />

                      {/* Selected Universities List (Clickable) */}
                      {selectedUniversities.length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs text-text-secondary font-semibold mb-2">Selected Universities</div>
                          <div className="space-y-2">
                            {selectedUniversities.map((uni) => (
                              <button
                                key={uni.id}
                                onClick={() => handleUniversityClick(uni)}
                                className="w-full text-left px-3 py-2 border rounded hover:bg-blue-50 hover:border-blue-300 transition"
                              >
                                <div className="text-sm font-medium text-blue-700">{uni.name}</div>
                                <div className="text-xs text-text-secondary mt-0.5">Click to add application</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* University Application History */}
                      {selectedUniversities.length > 0 && (
                        <div className="mt-4">
                          <div className="text-sm font-semibold mb-2">University Application History</div>
                          {loadingApplications ? (
                            <div className="text-xs text-text-secondary">Loading...</div>
                          ) : (
                            <UniversityApplicationHistory
                              data={selectedUniversities.map(uni => ({
                                universityId: uni.id,
                                universityName: uni.name,
                                applications: universityApplications
                                  .filter(app => app.university_id === uni.id)
                                  .map(app => ({
                                    id: app.id,
                                    courseApplied: app.course_applied,
                                    applicationDate: app.application_date,
                                    comment: app.comment || '',
                                    createdAt: app.created_at,
                                  })),
                              }))}
                            />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-3">
                      <div className="text-sm text-text-secondary">Case Lead By</div>
                      <MultiSelectUser
                        selectedIds={caseItem.caseLeadBy || []}
                        onChange={saveCaseLeadBy}
                        className="mt-1"
                      />
                    </div>
                    {!editingDriveLink ? (
                      <div className="text-sm">
                        {caseItem.googleDriveLink ? (
                          <a
                            href={caseItem.googleDriveLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline break-all"
                          >
                            {caseItem.googleDriveLink}
                          </a>
                        ) : (
                          <span className="text-text-secondary">—</span>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1">
                        <input
                          type="url"
                          value={driveLinkDraft}
                          onChange={(e) => setDriveLinkDraft(e.target.value)}
                          className="w-full border rounded p-2 text-sm"
                          placeholder="https://drive.google.com/..."
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={saveGoogleDriveLink}
                            className="px-3 py-1.5 rounded bg-[#ffa332] text-white text-xs font-semibold"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingDriveLink(false)}
                            className="px-3 py-1.5 rounded border text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-text-secondary">Deadline</div>
                      <div className="font-semibold">{caseItem.deadline ? new Date(caseItem.deadline).toLocaleString() : '—'}</div>
                    </div>
                    <div>
                      <div className="text-text-secondary">Created</div>
                      <div className="font-semibold">{caseItem.createdAt ? new Date(caseItem.createdAt).toLocaleString() : '—'}</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-sm font-semibold">Case Files</div>
                    <input type="file" multiple onChange={onUploadCaseFiles} className="mt-2 text-sm" />
                    <div className="mt-2 space-y-1 max-h-40 overflow-auto">
                      {caseFiles.length === 0 && <div className="text-xs text-text-secondary">No files</div>}
                      {caseFiles.map((f: any) => (
                        <a key={f.name} href={fileUrl(`cases/${caseNumber}/${f.name}`)} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">{f.name}</a>
                      ))}
                    </div>
                  </div>

                  {studentCaseNav}
                </>
              )}
            </aside>

            {/* Center: Task details */}
            <section className="lg:col-span-6 bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a]">
              {!taskId && (
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-semibold">Tasks for this case</h3>
                    <div className="text-xs text-text-secondary">{caseTasks.length} total</div>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs text-text-secondary font-semibold uppercase tracking-wide">Active</div>
                    <div className="mt-2 divide-y border rounded">
                      {caseTasks.filter(t => !t.isBacklog).length === 0 && (
                        <div className="text-sm text-text-secondary p-3">No active tasks</div>
                      )}
                      {caseTasks.filter(t => !t.isBacklog).map(t => (
                        <button key={t.id} onClick={() => navigate(`/cases/${caseNumber}/tasks/${t.id}`)} className="w-full text-left p-3 hover:bg-gray-50 flex items-center justify-between">
                          <div>
                            <div className="text-xs text-text-secondary">{t.id}</div>
                            <div className="font-semibold">{t.name}</div>
                            <div className="text-xs text-text-secondary">Assignee: {t.assignee.name} • Estimate: {fmtDur(t.estimateMins)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded ${STATUS_STYLES[t.status].bg} ${STATUS_STYLES[t.status].text}`}>{t.status}</span>
                            <span className={`text-xs px-2 py-1 rounded ${PRIORITY_STYLES[t.priority].bg} ${PRIORITY_STYLES[t.priority].text}`}>{t.priority}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="text-xs text-text-secondary font-semibold uppercase tracking-wide">Backlog</div>
                    <div className="mt-2 divide-y border rounded">
                      {caseTasks.filter(t => !!t.isBacklog).length === 0 && (
                        <div className="text-sm text-text-secondary p-3">No backlog tasks</div>
                      )}
                      {caseTasks.filter(t => !!t.isBacklog).map(t => (
                        <button key={t.id} onClick={() => navigate(`/cases/${caseNumber}/tasks/${t.id}`)} className="w-full text-left p-3 hover:bg-gray-50 flex items-center justify-between">
                          <div>
                            <div className="text-xs text-text-secondary">{t.id}</div>
                            <div className="font-semibold">{t.name}</div>
                            <div className="text-xs text-text-secondary">Assignee: {t.assignee.name} • Estimate: {fmtDur(t.estimateMins)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded ${STATUS_STYLES[t.status].bg} ${STATUS_STYLES[t.status].text}`}>{t.status}</span>
                            <span className={`text-xs px-2 py-1 rounded ${PRIORITY_STYLES[t.priority].bg} ${PRIORITY_STYLES[t.priority].text}`}>{t.priority}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {task && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-text-secondary">Task ID</div>
                      <div className="text-lg font-bold">{task.id}</div>
                      <div className="mt-1 text-base font-semibold">{task.name}</div>
                    </div>
                    <div>
                      <select value={task.status} onChange={e => switchStatus(e.target.value as Status)} className="border rounded p-2 text-sm">
                        <option>Todo</option>
                        <option>In Progress</option>
                        <option>In Review</option>
                        <option>Done</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Description</div>
                    </div>
                    <textarea value={taskDescDraft} onChange={e => setTaskDescDraft(e.target.value)} rows={4} className="mt-1 w-full border rounded p-2 text-sm" placeholder="Add or update task description..." />
                    <div className="mt-2 text-right">
                      <button onClick={saveTaskDescription} className="px-3 py-1.5 rounded bg-[#ffa332] text-white text-xs font-semibold">Save Description</button>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="text-sm font-semibold">Attachments</div>
                    <input type="file" multiple onChange={onUploadTaskFiles} className="mt-2 text-sm" />
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-auto">
                      {taskFiles.length === 0 && <div className="text-xs text-text-secondary">No files</div>}
                      {taskFiles.map((f: any) => (
                        <a key={f.name} href={fileUrl(`cases/${caseNumber}/tasks/${task.id}/${f.name}`)} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">{f.name}</a>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="text-sm font-semibold">Recent Activity</div>
                    <ActivityList caseNumber={caseNumber!} taskId={task.id} />
                  </div>
                </>
              )}
            </section>

            {/* Right: Task info */}
            <aside className="lg:col-span-3 bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a]">
              {task ? (
                <>
                  <div className="text-sm text-text-secondary">Reporter</div>
                  <div className="text-sm">{caseItem?.reporter || '—'}</div>
                  <div className="mt-3 text-sm text-text-secondary">Assigned To</div>
                  <div className="flex items-center gap-2 mt-1">
                    <img src={task.assignee.avatar || '/images/img_image.svg'} className="w-6 h-6 rounded-full" />
                    <span className="text-sm">{task.assignee.name}</span>
                  </div>
                  <div className="mt-3 text-sm text-text-secondary">Priority</div>
                  <div className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${PRIORITY_STYLES[task.priority].bg} ${PRIORITY_STYLES[task.priority].text}`}>{task.priority}</div>

                  <div className="mt-4">
                    <div className="text-sm font-semibold">Time Tracking</div>
                    <div className="text-xs text-text-secondary">Logged: {fmtDur(task.spentMins)} / Estimate: {fmtDur(task.estimateMins)}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <input type="number" min={0} value={logMins} onChange={e => setLogMins(Number(e.target.value))} className="w-28 border rounded p-2 text-sm" placeholder="Minutes" />
                      <button onClick={logTime} className="px-3 py-2 rounded bg-[#ffa332] text-white text-sm font-semibold">Log time</button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-text-secondary">Deadline</div>
                      <div className="font-semibold">{caseItem?.deadline ? new Date(caseItem?.deadline).toLocaleString() : '—'}</div>
                    </div>
                    <div>
                      <div className="text-text-secondary">Created</div>
                      <div className="font-semibold">{caseItem?.createdAt ? new Date(caseItem?.createdAt).toLocaleString() : '—'}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs text-text-secondary uppercase tracking-wide">Application History</div>
                      <div className="text-sm text-text-secondary">
                        {appHistory.length ? `${appHistory.length} update${appHistory.length === 1 ? '' : 's'}` : 'No updates yet'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddHistory(true)}
                      className="px-3 py-1.5 rounded-full bg-[#ffa332] text-white text-xs font-semibold hover:opacity-95"
                    >
                      + Add Update
                    </button>
                  </div>
                  <div className="mt-1 space-y-3 overflow-auto">
                    {appHistory.length === 0 && (
                      <div className="text-xs text-text-secondary">
                        No application history yet. Use \"Add Update\" to log the next step.
                      </div>
                    )}
                    {appHistory.map((h) => (
                      <div
                        key={h.id}
                        className="border rounded-lg px-3 py-2 text-xs bg-gray-50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] text-text-secondary">
                            {h.detailsTimestamp
                              ? new Date(h.detailsTimestamp).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                              : '—'
                            }
                          </div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${CASE_STAGE_COLORS[h.status]}`}
                          >
                            {h.status}
                          </span>
                        </div>
                        {h.comment && (
                          <div className="mt-1 text-[13px] leading-snug">
                            {h.comment}
                          </div>
                        )}
                        <div className="mt-1 text-[11px] text-text-secondary">
                          Comment by:{' '}
                          <span className="font-medium">
                            {h.commentByName || h.commentBy || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </section>
      </div>


      {/* Add Application Update Modal */}
      {showAddHistory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={addApplicationHistory} className="bg-white w-full max-w-lg rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Add Application Update</h3>
              <button
                type="button"
                onClick={() => setShowAddHistory(false)}
                className="text-text-secondary"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="text-sm block">
                <span className="text-text-secondary">Status</span>
                <select
                  value={histStatus}
                  onChange={(e) => setHistStatus(e.target.value as CaseStage)}
                  className="mt-1 w-full border rounded p-2 text-sm"
                  required
                >
                  {CASE_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm block">
                <span className="text-text-secondary">Comment</span>
                <textarea
                  value={histComment}
                  onChange={(e) => setHistComment(e.target.value)}
                  rows={3}
                  className="mt-1 w-full border rounded p-2 text-sm"
                  placeholder="Optional details for this step..."
                />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddHistory(false)}
                className="px-3 py-1.5 rounded border text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingHistory}
                className="px-4 py-2 rounded bg-[#ffa332] text-white text-xs font-semibold disabled:opacity-60"
              >
                {savingHistory ? 'Saving...' : 'Save Update'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={addTask} className="bg-white w-full max-w-lg rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">Add Task</h3><button type="button" onClick={() => setShowAddTask(false)} className="text-text-secondary">✕</button></div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm sm:col-span-2"><span className="text-text-secondary">Task Name</span><input value={tfName} onChange={e => setTfName(e.target.value)} className="mt-1 w-full border rounded p-2" required /></label>
              <label className="text-sm"><span className="text-text-secondary">Status</span><select value={tfStatus} onChange={e => setTfStatus(e.target.value as Status)} className="mt-1 w-full border rounded p-2"><option>Todo</option><option>In Progress</option><option>In Review</option><option>Done</option></select></label>
              <label className="text-sm"><span className="text-text-secondary">Estimate (minutes)</span><input type="number" min={0} value={tfEstimate} onChange={e => setTfEstimate(Number(e.target.value))} className="mt-1 w-full border rounded p-2" /></label>
              <label className="text-sm"><span className="text-text-secondary">Priority</span><select value={tfPriority} onChange={e => setTfPriority(e.target.value as Priority)} className="mt-1 w-full border rounded p-2"><option>Low</option><option>Medium</option><option>High</option></select></label>
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
              <label className="text-sm sm:col-span-2"><span className="text-text-secondary">Description</span><textarea value={tfDesc} onChange={e => setTfDesc(e.target.value)} className="mt-1 w-full border rounded p-2" rows={3} /></label>
            </div>
            <div className="mt-5 text-right"><button type="submit" className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold">Save Task</button></div>
          </form>
        </div>
      )}

      {/* University Application Form Modal */}
      <UniversityApplicationForm
        isOpen={applicationFormOpen}
        onClose={() => {
          setApplicationFormOpen(false);
          setSelectedUniversityForForm(null);
        }}
        onSubmit={handleApplicationSubmit}
        universityName={selectedUniversityForForm?.name || ''}
      />
    </main>
  );
};

const ActivityList: React.FC<{ caseNumber: string; taskId: string }> = ({ caseNumber, taskId }) => {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('activity_log')
        .select('id, action, detail, created_at')
        .filter('detail->>case_number', 'eq', caseNumber)
        .filter('detail->>task_id', 'eq', taskId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (mounted) setItems(data || []);
    })();
    const chan = supabase
      .channel(`activity:${caseNumber}:${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, async () => {
        const { data } = await supabase
          .from('activity_log')
          .select('id, action, detail, created_at')
          .filter('detail->>case_number', 'eq', caseNumber)
          .filter('detail->>task_id', 'eq', taskId)
          .order('created_at', { ascending: false })
          .limit(20);
        setItems(data || []);
      }).subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [caseNumber, taskId]);
  if (items.length === 0) return <div className="text-xs text-text-secondary">No recent activity</div>;
  return (
    <div className="space-y-2 max-h-40 overflow-auto">
      {items.map((it: any) => (
        <div key={it.id} className="text-xs"><span className="text-text-secondary">[{new Date(it.created_at).toLocaleString()}]</span> {it.detail?.message || it.action}</div>
      ))}
    </div>
  );
};

export default CaseTaskDetailPage;

