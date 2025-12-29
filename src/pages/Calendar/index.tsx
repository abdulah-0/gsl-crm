/**
 * @fileoverview Calendar Page
 * 
 * Event calendar for the GSL CRM system.
 * Allows users to create, view, and manage events with categories.
 * 
 * **Key Features:**
 * - Month view with Monday-first week layout
 * - Event categories (Birthday, Meeting, Work, Personal, Other)
 * - Add/Edit/Delete events
 * - Color-coded event display
 * - LocalStorage persistence
 * - Duration tracking
 * - Notes support
 * 
 * @module pages/Calendar
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { supabase } from '../../lib/supabaseClient';

// Types
type Category = 'Birthday' | 'Meeting' | 'Work' | 'Personal' | 'Other';
type CalEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (24h)
  durationMins: number;
  category: Category;
  notes?: string;
};

// Utils
const fmtYmd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Monday-first month grid (always 6 rows x 7 cols = 42 cells)
function buildMonthGrid(year: number, monthIdx: number) {
  const first = new Date(year, monthIdx, 1);
  const last = new Date(year, monthIdx + 1, 0);
  const firstDowSun0 = first.getDay(); // 0..6 (Sun..Sat)
  // Convert to Mon=0..Sun=6
  const firstDowMon0 = (firstDowSun0 + 6) % 7;
  const start = new Date(year, monthIdx, 1 - firstDowMon0);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return { days, first, last };
}

const CAT_STYLES: Record<Category, { bg: string; text: string; chip: string }> = {
  Birthday: { bg: 'bg-purple-100', text: 'text-purple-700', chip: 'bg-purple-600' },
  Work: { bg: 'bg-yellow-100', text: 'text-yellow-900', chip: 'bg-yellow-500' },
  Meeting: { bg: 'bg-blue-100', text: 'text-blue-700', chip: 'bg-blue-600' },
  Personal: { bg: 'bg-emerald-100', text: 'text-emerald-700', chip: 'bg-emerald-600' },
  Other: { bg: 'bg-gray-100', text: 'text-gray-700', chip: 'bg-gray-500' },
};

const CATEGORIES: Category[] = ['Birthday', 'Meeting', 'Work', 'Personal', 'Other'];

const Calendar: React.FC = () => {
  // Today and displayed month
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  // Events (database + localStorage fallback)
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');

  // Load events from database on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const email = auth.user?.email;
        if (!email) return;

        setCurrentUserEmail(email);

        // Fetch events from database
        const { data: dbEvents } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('user_email', email)
          .order('date', { ascending: true });

        if (dbEvents && dbEvents.length > 0) {
          // Map database events to CalEvent format
          const mappedEvents: CalEvent[] = dbEvents.map((ev: any) => ({
            id: ev.id,
            title: ev.title,
            date: ev.date,
            time: ev.time,
            durationMins: ev.duration_mins || 60,
            category: (ev.category || 'Work') as Category,
            notes: ev.notes,
          }));
          setEvents(mappedEvents);
        } else {
          // Fallback to localStorage if no database events
          try {
            const raw = localStorage.getItem('crm_calendar_events');
            if (raw) {
              setEvents(JSON.parse(raw));
            } else {
              // Default demo events
              setEvents([
                { id: 'demo-1', title: "Anna's Birthday", date: fmtYmd(today), time: '10:00', durationMins: 180, category: 'Birthday' },
                { id: 'demo-2', title: 'Team Standup', date: fmtYmd(new Date(today.getFullYear(), today.getMonth(), Math.max(1, today.getDate() - 1))), time: '09:30', durationMins: 30, category: 'Work' },
                { id: 'demo-3', title: 'Client Presentation', date: fmtYmd(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2)), time: '14:00', durationMins: 60, category: 'Meeting' },
              ]);
            }
          } catch { }
        }
      } catch (error) {
        console.error('Error loading calendar events:', error);
      }
    })();
  }, []);

  // Save to localStorage for backward compatibility
  useEffect(() => {
    try { localStorage.setItem('crm_calendar_events', JSON.stringify(events)); } catch { }
  }, [events]);

  // Add/Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CalEvent | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(fmtYmd(today));
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [category, setCategory] = useState<Category>('Work');
  const [notes, setNotes] = useState('');

  const isEditing = !!editing;

  const openCreate = (d?: string) => {
    setEditing(null);
    setTitle(''); setDate(d || fmtYmd(today)); setTime('09:00'); setDuration(60); setCategory('Work'); setNotes('');
    setShowModal(true);
  };
  const openEdit = (ev: CalEvent) => {
    setEditing(ev);
    setTitle(ev.title); setDate(ev.date); setTime(ev.time); setDuration(ev.durationMins); setCategory(ev.category); setNotes(ev.notes || '');
    setShowModal(true);
  };

  const saveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const id = isEditing ? editing!.id : `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const next: CalEvent = { id, title: title.trim(), date, time, durationMins: Math.max(0, Number(duration) || 0), category, notes: notes.trim() || undefined };

    // Save to database if user is logged in
    if (currentUserEmail) {
      try {
        await supabase.from('calendar_events').upsert([{
          id,
          user_email: currentUserEmail,
          title: title.trim(),
          date,
          time,
          duration_mins: Math.max(0, Number(duration) || 0),
          category,
          notes: notes.trim() || undefined,
          task_id: null,
          case_number: null,
        }], { onConflict: 'id' });
      } catch (error) {
        console.error('Error saving event to database:', error);
      }
    }

    // Update local state
    setEvents(prev => {
      const rest = prev.filter(x => x.id !== id);
      return [next, ...rest].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    });
    setShowModal(false);
  };
  const deleteEvent = async () => {
    if (!editing) return;

    // Delete from database if user is logged in
    if (currentUserEmail) {
      try {
        await supabase.from('calendar_events').delete().eq('id', editing.id).eq('user_email', currentUserEmail);
      } catch (error) {
        console.error('Error deleting event from database:', error);
      }
    }

    // Update local state
    setEvents(prev => prev.filter(x => x.id !== editing.id));
    setShowModal(false);
  };

  // Derived month grid
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const { days, first, last } = useMemo(() => buildMonthGrid(y, m), [y, m]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const arr = map.get(ev.date) || [];
      arr.push(ev);
      map.set(ev.date, arr);
    }
    for (const [k, arr] of map) arr.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  }, [events]);

  return (
    <>
      <Helmet>
        <title>Calendar | GSL Pakistan CRM</title>
        <meta name="description" content="Plan and track events and tasks on the calendar." />
      </Helmet>

      <main className="w-full min-h-screen bg-background-main flex">
        <div className="w-[14%] min-w-[200px] hidden lg:block">
          <Sidebar />
        </div>

        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          {/* Header row: Title + Add Event */}
          <section className="mt-8 lg:mt-12">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-4xl text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Calendar</h1>
              <button onClick={() => openCreate()} className="px-4 py-2 rounded-full font-bold text-white bg-[#ffa332] shadow-[0px_6px_12px_#3f8cff43] hover:opacity-95">
                + Add Event
              </button>
            </div>

            {/* Calendar chrome */}
            <div className="mt-6 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-5">
              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button aria-label="Prev" onClick={() => setCursor(new Date(y, m - 1, 1))} className="p-2 rounded hover:bg-gray-50">◀</button>
                <div className="text-lg font-bold" style={{ fontFamily: 'Nunito Sans' }}>{monthLabel}</div>
                <button aria-label="Next" onClick={() => setCursor(new Date(y, m + 1, 1))} className="p-2 rounded hover:bg-gray-50">▶</button>
              </div>

              {/* Weekday headers */}
              <div className="mt-4 grid grid-cols-7 text-center text-sm text-text-secondary">
                {weekDays.map(d => (<div key={d} className="py-2 font-semibold">{d}</div>))}
              </div>

              {/* Month grid */}
              <div className="grid grid-cols-7 grid-rows-6 gap-px bg-gray-200 rounded overflow-hidden">
                {days.map((d, idx) => {
                  const inMonth = d.getMonth() === m;
                  const key = fmtYmd(d);
                  const list = eventsByDay.get(key) || [];
                  return (
                    <div key={idx} className={`bg-white min-h-[110px] sm:min-h-[120px] p-2 flex flex-col ${inMonth ? '' : 'opacity-50 bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className={`text-xs font-bold ${fmtYmd(d) === fmtYmd(today) ? 'text-[#ffa332]' : 'text-text-secondary'}`}>{d.getDate()}</div>
                        {inMonth && (
                          <button onClick={() => openCreate(fmtYmd(d))} className="text-xs text-blue-500 hover:underline">Add</button>
                        )}
                      </div>
                      <div className="flex-1 overflow-auto space-y-1">
                        {list.map(ev => {
                          const styles = CAT_STYLES[ev.category];
                          const arrow = (ev.category === 'Work' || ev.category === 'Meeting') ? '↑' : '↓';
                          const hours = Math.max(0, Math.round(ev.durationMins / 60));
                          const mins = ev.durationMins % 60;
                          const dur = hours ? `${hours}h${mins ? ` ${mins}m` : ''}` : `${mins}m`;
                          return (
                            <button key={ev.id} onClick={() => openEdit(ev)} className={`w-full text-left ${styles.bg} ${styles.text} rounded px-2 py-1 text-xs hover:opacity-90`}>
                              <div className="flex items-center gap-1">
                                <span className={`inline-block w-2 h-2 rounded-full ${styles.chip}`}></span>
                                <span className="font-semibold truncate flex-1">{ev.title}</span>
                                <span className="opacity-70 ml-1">{arrow}</span>
                              </div>
                              <div className="opacity-70 mt-0.5">{ev.time} · {dur}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Add/Edit Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={saveEvent} className="bg-white w-full max-w-lg rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{isEditing ? 'Edit Event' : 'Add Event'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-text-secondary hover:opacity-70">✕</button>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="text-text-secondary">Event Title</span>
                <input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="e.g. Anna's Birthday" required />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Date</span>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-full border rounded p-2" required />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Time</span>
                <input type="time" value={time} onChange={e => setTime(e.target.value)} className="mt-1 w-full border rounded p-2" required />
              </label>
              <label className="text-sm">
                <span className="text-text-secondary">Duration (minutes)</span>
                <input type="number" min={0} value={duration} onChange={e => setDuration(Number(e.target.value))} className="mt-1 w-full border rounded p-2" required />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="text-text-secondary">Category</span>
                <select value={category} onChange={e => setCategory(e.target.value as Category)} className="mt-1 w-full border rounded p-2">
                  {CATEGORIES.map(c => (<option key={c}>{c}</option>))}
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="text-text-secondary">Notes</span>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 w-full border rounded p-2" placeholder="Optional" />
              </label>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              {isEditing && <button type="button" onClick={deleteEvent} className="px-3 py-2 rounded border border-red-200 text-red-600 hover:bg-red-50">Delete</button>}
              <button type="button" onClick={() => setShowModal(false)} className="px-3 py-2 rounded border hover:bg-gray-50">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold shadow-[0px_6px_12px_#3f8cff43]">Save Event</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default Calendar;
