/**
 * @fileoverview Dashboard Page
 * 
 * Main dashboard page for the GSL CRM system.
 * Provides a personalized overview of user's tasks, calendar events, and leave requests.
 * 
 * **Key Features:**
 * - Welcome message with user's name
 * - My Tasks: User-specific tasks with priority and status
 * - My Calendar: Upcoming calendar events
 * - My Leaves: Leave requests with status
 * - Activity Stream: Recent activities
 * - Real-time data synchronization via Supabase subscriptions
 * 
 * @module pages/Dashboard
 */

import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';

interface Task {
  id: string;
  title: string;
  case_number?: string;
  priority: 'high' | 'medium' | 'low';
  status: string;
  deadline_date?: string;
  deadline_time?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  category?: string;
}

interface Leave {
  id: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  days: number;
}

interface ActivityItem {
  id: string;
  action: string;
  created_at: string;
}

const Dashboard = () => {
  const [meName, setMeName] = useState<string>('User');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [myCalendarEvents, setMyCalendarEvents] = useState<CalendarEvent[]>([]);
  const [myLeaves, setMyLeaves] = useState<Leave[]>([]);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const navigate = useNavigate();

  // Get current user info
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: sess } = await supabase.auth.getUser();
      const em = sess.user?.email || '';
      if (!mounted) return;
      setCurrentUserEmail(em);

      const { data: u } = await supabase.from('dashboard_users').select('full_name,email').eq('email', em).maybeSingle();
      if (!mounted) return;
      setMeName(u?.full_name || em || 'User');

      const ch = supabase
        .channel('rt:dashboard_users:me')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dashboard_users' }, (payload) => {
          const row: any = payload.new;
          if (row?.email === em) setMeName(row.full_name || em || 'User');
        })
        .subscribe();
      return () => { mounted = false; supabase.removeChannel(ch); };
    })();
  }, []);

  // Load user-specific data
  useEffect(() => {
    if (!currentUserEmail) return;

    const loadUserData = async () => {
      // Get current user ID from dashboard_users
      const { data: userData } = await supabase
        .from('dashboard_users')
        .select('id')
        .eq('email', currentUserEmail)
        .single();

      const userId = userData?.id;

      // Load my daily tasks (from daily_tasks table)
      const { data: dailyTasksData, error: dailyTasksError } = await supabase
        .from('daily_tasks')
        .select('id, title, description, due_date, priority, status')
        .eq('assigned_to', currentUserEmail)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!dailyTasksError && dailyTasksData) {
        setMyTasks(dailyTasksData.map((t: any) => ({
          id: String(t.id),
          title: t.title,
          case_number: t.description || '',
          priority: (t.priority?.toLowerCase() as any) ?? 'medium',
          status: t.status || 'Pending',
          deadline_date: t.due_date,
          deadline_time: undefined,
        })));
      } else {
        console.log('Daily tasks error:', dailyTasksError);
        setMyTasks([]);
      }

      // Load my calendar events (combine calendar_events, case tasks, and daily tasks)
      const today = new Date().toISOString().split('T')[0];

      // Get calendar events
      const { data: calendarEvents } = await supabase
        .from('calendar_events')
        .select('id, title, date, time, category')
        .eq('user_email', currentUserEmail)
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(10);

      // Get case tasks with deadlines
      const { data: caseTasks } = await supabase
        .from('dashboard_tasks')
        .select('id, name, deadline_date, deadline_time, case_number')
        .eq('assignee_id', userId)
        .not('deadline_date', 'is', null)
        .gte('deadline_date', today)
        .order('deadline_date', { ascending: true })
        .limit(10);

      // Get daily tasks with due dates
      const { data: dailyTasksDue } = await supabase
        .from('daily_tasks')
        .select('id, title, due_date')
        .eq('assigned_to', currentUserEmail)
        .not('due_date', 'is', null)
        .gte('due_date', today)
        .order('due_date', { ascending: true })
        .limit(10);

      // Combine all calendar items
      const allCalendarItems = [
        ...(calendarEvents || []).map((e: any) => ({
          id: `cal-${e.id}`,
          title: e.title,
          date: e.date,
          time: e.time,
          category: e.category || 'Event',
        })),
        ...(caseTasks || []).map((t: any) => ({
          id: `task-${t.id}`,
          title: `${t.name}`,
          date: t.deadline_date,
          time: t.deadline_time,
          category: `Case ${t.case_number}`,
        })),
        ...(dailyTasksDue || []).map((t: any) => ({
          id: `daily-${t.id}`,
          title: t.title,
          date: t.due_date,
          time: null,
          category: 'Daily Task',
        }))
      ];

      // Sort by date and time, take top 5
      allCalendarItems.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return (a.time || '').localeCompare(b.time || '');
      });

      setMyCalendarEvents(allCalendarItems.slice(0, 5));

      // Load my leaves
      const { data: leaves, error: leavesError } = await supabase
        .from('leaves')
        .select('id, leave_type, start_date, end_date, status, created_at')
        .eq('employee_email', currentUserEmail)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!leavesError && leaves) {
        setMyLeaves(leaves.map((l: any) => {
          // Calculate days between start and end date
          const start = new Date(l.start_date);
          const end = new Date(l.end_date);
          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

          return {
            id: String(l.id),
            leave_type: l.leave_type || 'CL',
            from_date: l.start_date,
            to_date: l.end_date,
            status: l.status || 'Pending',
            days: days || 1,
          };
        }));
      } else {
        console.log('Leaves error:', leavesError);
        setMyLeaves([]);
      }

      // Load activities
      const { data: acts, error: actsError } = await supabase
        .from('activity_log')
        .select('id, action, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!actsError && acts) {
        setActivityItems(acts.map((a: any) => ({
          id: String(a.id),
          action: a.action,
          created_at: a.created_at,
        })));
      } else {
        console.log('Activity log error:', actsError);
        setActivityItems([]);
      }
    };

    loadUserData();

    // Real-time subscriptions
    const tasksChannel = supabase
      .channel('my_tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dashboard_tasks' }, () => loadUserData())
      .subscribe();

    const eventsChannel = supabase
      .channel('my_events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events', filter: `user_email=eq.${currentUserEmail}` }, () => loadUserData())
      .subscribe();

    const leavesChannel = supabase
      .channel('my_leaves')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves', filter: `user_email=eq.${currentUserEmail}` }, () => loadUserData())
      .subscribe();

    const actChannel = supabase
      .channel('public:activity_log')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => loadUserData())
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(leavesChannel);
      supabase.removeChannel(actChannel);
    };
  }, [currentUserEmail]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <>
      <Helmet>
        <title>GSL Pakistan CRM Dashboard - My Tasks, Calendar & Leaves</title>
        <meta name="description" content="Personal dashboard showing your tasks, calendar events, and leave requests." />
      </Helmet>

      <main className="w-full min-h-screen bg-background-main flex">
        {/* Sidebar */}
        <div className="w-[14%] min-w-[200px] hidden lg:block">
          <Sidebar />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          {/* Dashboard Content */}
          <div className="flex-1 mt-8 lg:mt-12">
            {/* Welcome Section */}
            <div className="mb-8">
              <p className="text-base font-normal leading-base text-text-secondary mb-1" style={{ fontFamily: 'Nunito Sans' }}>
                Welcome back, {meName}!
              </p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-4xl text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>
                Dashboard
              </h1>
            </div>

            {/* Main Grid - Tasks, Calendar, Leaves */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* My Tasks */}
              <div className="bg-background-card rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>
                    My Daily Tasks
                  </h2>
                  <button onClick={() => navigate('/dailytask')} className="text-sm font-semibold text-text-accent hover:opacity-80">
                    View all →
                  </button>
                </div>
                <div className="space-y-3">
                  {myTasks.length === 0 ? (
                    <p className="text-sm text-text-secondary">No tasks assigned</p>
                  ) : (
                    myTasks.map((task) => (
                      <div key={task.id} className="border-b pb-3 last:border-0">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="text-sm font-semibold text-text-primary flex-1">{task.title}</h3>
                          <span className={`px-2 py-0.5 text-xs rounded ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary">{task.case_number || 'No case'}</p>
                        {task.deadline_date && (
                          <p className="text-xs text-text-muted mt-1">Due: {formatDate(task.deadline_date)}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* My Calendar */}
              <div className="bg-background-card rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>
                    My Calendar
                  </h2>
                  <button onClick={() => navigate('/calendar')} className="text-sm font-semibold text-text-accent hover:opacity-80">
                    View all →
                  </button>
                </div>
                <div className="space-y-3">
                  {myCalendarEvents.length === 0 ? (
                    <p className="text-sm text-text-secondary">No upcoming events</p>
                  ) : (
                    myCalendarEvents.map((event) => (
                      <div key={event.id} className="border-b pb-3 last:border-0">
                        <h3 className="text-sm font-semibold text-text-primary mb-1">{event.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                          <span>{formatDate(event.date)}</span>
                          {event.time && <span>• {event.time}</span>}
                        </div>
                        {event.category && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700">
                            {event.category}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* My Leaves */}
              <div className="bg-background-card rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>
                    My Leaves
                  </h2>
                  <button onClick={() => navigate('/leaves')} className="text-sm font-semibold text-text-accent hover:opacity-80">
                    View all →
                  </button>
                </div>
                <div className="space-y-3">
                  {myLeaves.length === 0 ? (
                    <p className="text-sm text-text-secondary">No leave requests</p>
                  ) : (
                    myLeaves.map((leave) => (
                      <div key={leave.id} className="border-b pb-3 last:border-0">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="text-sm font-semibold text-text-primary">{leave.leave_type}</h3>
                          <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(leave.status)}`}>
                            {leave.status}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary">
                          {formatDate(leave.from_date)} - {formatDate(leave.to_date)}
                        </p>
                        <p className="text-xs text-text-muted mt-1">{leave.days} day{leave.days !== 1 ? 's' : ''}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Activity Stream */}
            <div className="bg-background-card rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-6">
              <h2 className="text-xl font-bold text-text-primary mb-4" style={{ fontFamily: 'Nunito Sans' }}>
                Recent Activity
              </h2>
              <div className="space-y-3">
                {activityItems.length === 0 ? (
                  <p className="text-sm text-text-secondary">No recent activities</p>
                ) : (
                  activityItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                      <div className="w-2 h-2 rounded-full bg-[#ffa332] mt-2 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text-primary">{item.action}</p>
                        <p className="text-xs text-text-secondary">{new Date(item.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default Dashboard;