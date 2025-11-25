import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import AttendanceModal from '../../components/AttendanceModal';
import TimetableUpload from '../../components/TimetableUpload';
import TimetableViewer from '../../components/TimetableViewer';

// Types
interface Teacher { id: string; full_name: string; email: string; phone?: string; cnic?: string; status: 'Active' | 'Inactive' | string; created_at?: string; }
interface Service { id: string; name: string; }
interface Assignment { id?: number; service_id?: string | null; service_name?: string | null; batch_no?: string | null; }
interface Student { id: string; full_name: string; }

type TabType = 'assign' | 'attendance' | 'timetable';

const TeachersPage: React.FC = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('assign');

  // Lists
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignMap, setAssignMap] = useState<Record<string, Assignment[]>>({});
  const [studentAssignments, setStudentAssignments] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  // Attendance state
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [teacherStudents, setTeacherStudents] = useState<Student[]>([]);

  // Timetable state
  const [timetable, setTimetable] = useState<{ file_url: string; file_name: string; file_type: string } | null>(null);
  const [loadingTimetable, setLoadingTimetable] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getUser();
      const email = sess.user?.email;
      if (email) {
        const { data: me } = await supabase.from('dashboard_users').select('id, role, permissions').eq('email', email).maybeSingle();
        const roleStr = (me?.role || (sess.user as any)?.app_metadata?.role || (sess.user as any)?.user_metadata?.role || '').toString();
        setRole(roleStr);
        setCurrentUserId(me?.id || '');

        const rl = roleStr.toLowerCase();
        const admin = rl.includes('super') || rl.includes('admin');
        const teacher = rl.includes('teacher');
        setIsAdmin(admin);
        setIsTeacher(teacher);

        // Set default tab based on role
        if (teacher && !admin) {
          setActiveTab('attendance');
        }
      }
      await loadAll();
      await loadTimetable();
    })();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: ts }, { data: svcs }, { data: assigns }, { data: studs }] = await Promise.all([
      supabase.from('dashboard_teachers').select('*').order('created_at', { ascending: false }),
      supabase.from('dashboard_services').select('id,name').order('name'),
      supabase.from('dashboard_teacher_assignments').select('*'),
      supabase.from('dashboard_students').select('id, full_name').eq('archived', false)
    ]);
    setTeachers((ts || []) as any);
    setServices((svcs || []) as any);
    setStudents((studs || []) as any);

    const grouped: Record<string, Assignment[]> = {};
    (assigns || []).forEach((a: any) => { const t = a.teacher_id; if (!grouped[t]) grouped[t] = []; grouped[t].push(a); });
    setAssignMap(grouped);

    // TODO: Load actual student-teacher assignments from a proper table
    // For now, this is a placeholder
    setStudentAssignments({});

    setLoading(false);
  };

  const loadTimetable = async () => {
    setLoadingTimetable(true);
    try {
      const { data } = await supabase
        .from('teacher_timetable')
        .select('file_url, file_name, file_type')
        .eq('is_active', true)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setTimetable(data || null);
    } catch (error) {
      console.error('Error loading timetable:', error);
    } finally {
      setLoadingTimetable(false);
    }
  };

  // Attendance functions
  const handleOpenAttendance = async (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    // TODO: Load students assigned to this teacher
    // For now, using all students as placeholder
    setTeacherStudents(students);
    setAttendanceModalOpen(true);
  };

  const handleAttendanceSubmit = async (data: { date: string; attendance: { studentId: string; status: 'Present' | 'Absent' }[] }) => {
    if (!selectedTeacher) return;

    try {
      const records = data.attendance.map(att => ({
        teacher_id: selectedTeacher.id,
        student_id: att.studentId,
        attendance_date: data.date,
        status: att.status,
      }));

      const { error } = await supabase
        .from('teacher_attendance')
        .upsert(records, {
          onConflict: 'teacher_id,student_id,attendance_date',
        });

      if (error) {
        console.error('Error saving attendance:', error);
        alert('Failed to save attendance');
        return;
      }

      alert('Attendance saved successfully!');
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('Failed to save attendance');
    }
  };

  return (
    <main className="w-full min-h-screen bg-background-main flex">
      <Helmet><title>Teachers | GSL Pakistan CRM</title></Helmet>
      <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
      <div className="flex-1 flex flex-col">
        <Header />

        <section className="px-4 sm:px-6 lg:px-8 mt-6">
          {/* Tab Navigation */}
          <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] mb-6">
            <div className="flex border-b">
              {isAdmin && (
                <button
                  onClick={() => setActiveTab('assign')}
                  className={`px-6 py-3 font-semibold ${activeTab === 'assign'
                      ? 'border-b-2 border-[#ffa332] text-[#ffa332]'
                      : 'text-text-secondary'
                    }`}
                >
                  Assign Students
                </button>
              )}
              <button
                onClick={() => setActiveTab('attendance')}
                className={`px-6 py-3 font-semibold ${activeTab === 'attendance'
                    ? 'border-b-2 border-[#ffa332] text-[#ffa332]'
                    : 'text-text-secondary'
                  }`}
              >
                Daily Attendance
              </button>
              <button
                onClick={() => setActiveTab('timetable')}
                className={`px-6 py-3 font-semibold ${activeTab === 'timetable'
                    ? 'border-b-2 border-[#ffa332] text-[#ffa332]'
                    : 'text-text-secondary'
                  }`}
              >
                Timetable
              </button>
            </div>
          </div>

          {/* Section A: Assign Students (Admin Only) */}
          {activeTab === 'assign' && isAdmin && (
            <div className="bg-white rounded-xl p-6 shadow-[0px_6px_58px_#c3cbd61a]">
              <h2 className="text-xl font-bold mb-4">Assign Students to Teachers</h2>
              <p className="text-text-secondary mb-4">
                This section is for managing student-teacher assignments.
              </p>
              <div className="text-sm text-text-secondary">
                <p>⚠️ Student assignment functionality will be implemented here.</p>
                <p>Features: Search students, assign to teachers, view assignments, remove assignments.</p>
              </div>
            </div>
          )}

          {/* Section B: Daily Attendance */}
          {activeTab === 'attendance' && (
            <div className="bg-white rounded-xl p-6 shadow-[0px_6px_58px_#c3cbd61a]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Daily Attendance</h2>
              </div>

              {isTeacher && !isAdmin ? (
                <div>
                  <p className="text-text-secondary mb-4">
                    Mark attendance for your assigned students.
                  </p>
                  <button
                    onClick={() => {
                      // For teachers, find their own teacher record
                      const teacherRecord = teachers.find(t => t.email === role);
                      if (teacherRecord) {
                        handleOpenAttendance(teacherRecord);
                      } else {
                        alert('Teacher record not found');
                      }
                    }}
                    className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold"
                  >
                    Add Attendance
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-text-secondary mb-4">
                    Select a teacher to add attendance for their students.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teachers.filter(t => t.status === 'Active').map(teacher => (
                      <div key={teacher.id} className="border rounded-lg p-4">
                        <div className="font-semibold">{teacher.full_name}</div>
                        <div className="text-sm text-text-secondary">{teacher.email}</div>
                        <button
                          onClick={() => handleOpenAttendance(teacher)}
                          className="mt-3 px-3 py-1.5 rounded bg-blue-100 text-blue-700 text-sm font-semibold hover:bg-blue-200"
                        >
                          Add Attendance
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section C: Timetable */}
          {activeTab === 'timetable' && (
            <div className="space-y-6">
              {isAdmin && (
                <div className="bg-white rounded-xl p-6 shadow-[0px_6px_58px_#c3cbd61a]">
                  <h2 className="text-xl font-bold mb-4">Upload Timetable</h2>
                  <TimetableUpload onUploadSuccess={loadTimetable} />
                </div>
              )}

              <div className="bg-white rounded-xl p-6 shadow-[0px_6px_58px_#c3cbd61a]">
                <h2 className="text-xl font-bold mb-4">View Timetable</h2>
                {loadingTimetable ? (
                  <div className="text-text-secondary">Loading...</div>
                ) : (
                  <TimetableViewer
                    fileUrl={timetable?.file_url || null}
                    fileName={timetable?.file_name || null}
                    fileType={timetable?.file_type || null}
                  />
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Attendance Modal */}
      <AttendanceModal
        isOpen={attendanceModalOpen}
        onClose={() => {
          setAttendanceModalOpen(false);
          setSelectedTeacher(null);
        }}
        onSubmit={handleAttendanceSubmit}
        students={teacherStudents}
        teacherId={selectedTeacher?.id || ''}
      />
    </main>
  );
};

export default TeachersPage;
