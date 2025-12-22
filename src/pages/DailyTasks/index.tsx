/**
 * @fileoverview Daily Tasks Page
 * 
 * Task management system for the GSL CRM.
 * Enables admins to assign tasks and employees to track their progress.
 * 
 * **Key Features:**
 * - Task assignment (Admin/HR only)
 * - Priority levels: Low, Medium, High
 * - Status tracking: Pending, In Progress, Completed
 * - Due date management
 * - Related student/case linking
 * - Real-time updates via Supabase
 * - Filter by status and assignee
 * 
 * **Access Control:**
 * - Super Admin/Admin/HR: Can assign tasks to any employee
 * - Employees: Can view and update status of assigned tasks
 * 
 * **Features:**
 * - "Mine only" filter for personal tasks
 * - Branch-scoped task assignment
 * 
 * @module pages/DailyTasks
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { supabase } from '../../lib/supabaseClient';

// Types
type Task = {
  id: number;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority: 'Low' | 'Medium' | 'High';
  assigned_to: string; // email
  assigned_by?: string | null; // email
  status: 'Pending' | 'In Progress' | 'Completed';
  remarks?: string | null;
  student_id?: string | null;
  case_id?: string | null;
  branch?: string | null;
  created_at?: string;
};

const DailyTasksPage: React.FC = () => {
  const [role, setRole] = useState<'super' | 'admin' | 'hr' | 'employee' | 'loading'>('loading');
  const [me, setMe] = useState<{ email: string; branch: string | null } | null>(null);

  // Admin assignment form
  const [tTitle, setTTitle] = useState('');
  const [tDesc, setTDesc] = useState('');
  const [tDue, setTDue] = useState('');
  const [tPriority, setTPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [tAssignee, setTAssignee] = useState('');
  const [tStudentId, setTStudentId] = useState('');
  const [tCaseId, setTCaseId] = useState('');
  const [saving, setSaving] = useState(false);

  // Lists
  const [employees, setEmployees] = useState<{ full_name: string; email: string; branch?: string | null }[]>([]);
  const [items, setItems] = useState<Task[]>([]);
  const [statusF, setStatusF] = useState<'All' | 'Pending' | 'In Progress' | 'Completed'>('All');
  const [mineOnly, setMineOnly] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getUser();
      const email = sess.user?.email || '';
      const { data: u } = await supabase.from('dashboard_users').select('role, branch, email').eq('email', email).maybeSingle();
      const r = (u?.role || (sess.user as any)?.app_metadata?.role || (sess.user as any)?.user_metadata?.role || '').toString().toLowerCase();
      const branch = (u?.branch as any) || null;
      setMe({ email, branch });
      if (r.includes('super')) setRole('super');
      else if (r.includes('admin')) setRole('admin');
      else if (r.includes('hr')) setRole('hr');
      else setRole('employee');

      // load employees for assignment
      let empQ = supabase.from('dashboard_users').select('full_name,email,branch,status').eq('status', 'Active');
      if (!(r.includes('super'))) empQ = empQ.eq('branch', branch);
      const { data: emps } = await empQ.order('full_name');
      setEmployees(((emps || []) as any).map((e: any) => ({ full_name: e.full_name, email: e.email, branch: e.branch })));

      await loadTasks(email, branch, r.includes('super'));
    })();
  }, []);

  const loadTasks = async (email: string, branch: string | null, isSuper: boolean) => {
    let q = supabase.from('daily_tasks').select('*').order('created_at', { ascending: false }).limit(500);
    if (!isSuper) q = q.or(`assigned_to.eq.${email},assigned_by.eq.${email}`);
    if (!isSuper && branch) q = q.eq('branch', branch);
    if (statusF !== 'All') q = q.eq('status', statusF);
    if (mineOnly && email) q = q.eq('assigned_to', email);
    const { data } = await q;
    setItems((data as any) || []);
  };

  useEffect(() => { if (me && role !== 'loading') loadTasks(me.email, me.branch, role === 'super'); }, [statusF, mineOnly]);

  useEffect(() => {
    const chan = supabase
      .channel('rt:daily_tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_tasks' }, () => {
        if (me) loadTasks(me.email, me.branch, role === 'super');
      })
      .subscribe();
    return () => { try { supabase.removeChannel(chan); } catch { } };
  }, [me, role]);

  const canAssign = role === 'super' || role === 'admin' || role === 'hr';

  const saveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAssign || !me) return;
    if (!tTitle || !tAssignee) { alert('Title and Assignee are required'); return; }
    setSaving(true);
    try {
      await supabase.from('daily_tasks').insert([{
        title: tTitle.trim(), description: tDesc || null, due_date: tDue || null,
        priority: tPriority, assigned_to: tAssignee,
        assigned_by: me.email, status: 'Pending',
        student_id: tStudentId || null, case_id: tCaseId || null,
        branch: role === 'super' ? null : me.branch
      }]);
      setTTitle(''); setTDesc(''); setTDue(''); setTPriority('Medium'); setTAssignee(''); setTStudentId(''); setTCaseId('');
      await loadTasks(me.email, me.branch, role === 'super');
    } finally { setSaving(false); }
  };

  const updateStatus = async (task: Task, status: Task['status']) => {
    await supabase.from('daily_tasks').update({ status }).eq('id', task.id);
  };

  const filtered = useMemo(() => items, [items]);

  return (
    <>
      <Helmet>
        <title>Daily Tasks | GSL Pakistan CRM</title>
      </Helmet>
      <main className="w-full min-h-screen bg-background-main flex">
        <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          <section className="mt-8 lg:mt-12">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Daily Task</h1>
              <div className="flex items-center gap-2 text-sm">
                <label className="flex items-center gap-2"><span>Status</span>
                  <select value={statusF} onChange={e => setStatusF(e.target.value as any)} className="border rounded p-2">
                    <option>All</option>
                    <option>Pending</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                  </select>
                </label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={mineOnly} onChange={e => setMineOnly(e.target.checked)} /> Mine only</label>
              </div>
            </div>

            {canAssign && (
              <form onSubmit={saveTask} className="mt-4 bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a] grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <label><span className="text-text-secondary">Title</span><input value={tTitle} onChange={e => setTTitle(e.target.value)} className="mt-1 w-full border rounded p-2" required /></label>
                <label><span className="text-text-secondary">Assignee</span>
                  <select value={tAssignee} onChange={e => setTAssignee(e.target.value)} className="mt-1 w-full border rounded p-2" required>
                    <option value="">Select employee</option>
                    {employees.map(e => <option key={e.email} value={e.email}>{e.full_name} ({e.email})</option>)}
                  </select>
                </label>
                <label><span className="text-text-secondary">Description</span><input value={tDesc} onChange={e => setTDesc(e.target.value)} className="mt-1 w-full border rounded p-2" /></label>
                <label><span className="text-text-secondary">Due Date</span><input type="date" value={tDue} onChange={e => setTDue(e.target.value)} className="mt-1 w-full border rounded p-2" /></label>
                <label><span className="text-text-secondary">Priority</span>
                  <select value={tPriority} onChange={e => setTPriority(e.target.value as any)} className="mt-1 w-full border rounded p-2">
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </label>
                <label><span className="text-text-secondary">Related Student ID (optional)</span><input value={tStudentId} onChange={e => setTStudentId(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="STxxxxxxxx" /></label>
                <label><span className="text-text-secondary">Related Case ID (optional)</span><input value={tCaseId} onChange={e => setTCaseId(e.target.value)} className="mt-1 w-full border rounded p-2" /></label>
                <div className="md:col-span-2 text-right"><button type="submit" disabled={saving} className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold">Assign Task</button></div>
              </form>
            )}

            {/* Tasks table */}
            <div className="mt-6 bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2">Title</th>
                    <th className="text-left p-2">Assignee</th>
                    <th className="text-left p-2">Due</th>
                    <th className="text-left p-2">Priority</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-right p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id} className="border-t">
                      <td className="p-2">
                        <div className="font-semibold">{t.title}</div>
                        <div className="text-xs text-text-secondary">{t.description}</div>
                      </td>
                      <td className="p-2">{t.assigned_to}</td>
                      <td className="p-2">{t.due_date ? new Date(t.due_date).toLocaleDateString() : '-'}</td>
                      <td className="p-2">{t.priority}</td>
                      <td className="p-2">{t.status}</td>
                      <td className="p-2 text-right">
                        {(me && t.assigned_to === me.email) ? (
                          <div className="inline-flex items-center gap-2">
                            <select value={t.status} onChange={e => updateStatus(t, e.target.value as any)} className="border rounded p-1 text-xs">
                              <option>Pending</option>
                              <option>In Progress</option>
                              <option>Completed</option>
                            </select>
                          </div>
                        ) : (
                          <span className="text-text-secondary text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (<tr><td colSpan={6} className="p-3 text-text-secondary">No tasks</td></tr>)}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export default DailyTasksPage;

