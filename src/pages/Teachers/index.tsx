/**
 * @fileoverview Teachers Page
 * 
 * Teacher management page for the GSL CRM system.
 * Handles teacher-student assignments, attendance tracking, timetable management, and mock test recording.
 * 
 * **Key Features:**
 * - Student assignment to teachers (admin only)
 * - Daily attendance recording
 * - Timetable upload and viewing
 * - Mock test score recording
 * - Role-based access (admin vs teacher views)
 * - Real-time data synchronization
 * 
 * **Tabs:**
 * 1. **Assign Students** - Admin can assign/unassign students to teachers
 * 2. **Daily Attendance** - Mark student attendance
 * 3. **Timetable** - Upload/view teacher timetables
 * 4. **Mock Tests** - Record test scores for students
 * 
 * @module pages/Teachers
 */

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

type TabType = 'assign' | 'attendance' | 'timetable' | 'mocktests';

const TeachersPage: React.FC = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [canAssignStudents, setCanAssignStudents] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('assign');

  // Lists
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignMap, setAssignMap] = useState<Record<string, Assignment[]>>({});
  const [studentAssignments, setStudentAssignments] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeacherForAssign, setSelectedTeacherForAssign] = useState<string | null>(null);

  // Attendance state
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [teacherStudents, setTeacherStudents] = useState<Student[]>([]);

  // Timetable state
  const [timetable, setTimetable] = useState<{ file_url: string; file_name: string; file_type: string } | null>(null);
  const [loadingTimetable, setLoadingTimetable] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);

  // Mock Tests state
  const [mockTestStudent, setMockTestStudent] = useState<string>('');
  const [testName, setTestName] = useState('');
  const [testScore, setTestScore] = useState('');
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [testNotes, setTestNotes] = useState('');
  const [savingTest, setSavingTest] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getUser();
      const email = sess.user?.email;
      if (email) {
        const { data: me } = await supabase.from('dashboard_users').select('id, role, permissions').eq('email', email).maybeSingle();
        const roleStr = (me?.role || (sess.user as any)?.app_metadata?.role || (sess.user as any)?.user_metadata?.role || '').toString();
        setRole(roleStr);
        setCurrentUserId(me?.id || '');
        setCurrentUserEmail(email || '');

        const rl = roleStr.toLowerCase();
        const admin = rl.includes('super') || rl.includes('admin');
        const teacher = rl.includes('teacher');
        setIsAdmin(admin);
        setIsTeacher(teacher);

        // Check for teacher-assignments permission
        const { data: perms } = await supabase.from('user_permissions').select('module, access, can_add, can_edit, can_delete').eq('user_email', email);
        const hasAssignPerm = (perms || []).some((p: any) => p.module === 'teacher_assignments' && (p.access === 'CRUD' || p.can_add || p.can_edit));
        setCanAssignStudents(hasAssignPerm);

        // Set default tab based on role
        if (teacher && !admin && !hasAssignPerm) {
          setActiveTab('attendance');
        }
      }
      await loadAll();
      await loadStudentAssignments();
      await loadTimetable();
      await loadAttendanceHistory();
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

  // Load student-teacher assignments
  const loadStudentAssignments = async () => {
    try {
      const { data } = await supabase
        .from('dashboard_teacher_student')
        .select('teacher_id, student_id');

      const assignments: Record<string, string[]> = {};
      (data || []).forEach((item: any) => {
        if (!assignments[item.teacher_id]) {
          assignments[item.teacher_id] = [];
        }
        assignments[item.teacher_id].push(item.student_id);
      });
      setStudentAssignments(assignments);
    } catch (error) {
      console.error('Error loading student assignments:', error);
    }
  };

  // Assign student to teacher
  const handleAssignStudent = async (studentId: string, teacherId: string) => {
    try {
      const { error } = await supabase
        .from('dashboard_teacher_student')
        .insert([{ teacher_id: teacherId, student_id: studentId }]);

      if (error) {
        console.error('Error assigning student:', error);
        alert('Failed to assign student');
        return;
      }

      await loadStudentAssignments();
      alert('Student assigned successfully!');
    } catch (error) {
      console.error('Error assigning student:', error);
      alert('Failed to assign student');
    }
  };

  // Unassign student from teacher
  const handleUnassignStudent = async (studentId: string, teacherId: string) => {
    if (!confirm('Are you sure you want to unassign this student?')) return;

    try {
      const { error } = await supabase
        .from('dashboard_teacher_student')
        .delete()
        .eq('teacher_id', teacherId)
        .eq('student_id', studentId);

      if (error) {
        console.error('Error unassigning student:', error);
        alert('Failed to unassign student');
        return;
      }

      await loadStudentAssignments();
      alert('Student unassigned successfully!');
    } catch (error) {
      console.error('Error unassigning student:', error);
      alert('Failed to unassign student');
    }
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

    // Get only students assigned to this teacher
    const assignedStudentIds = studentAssignments[teacher.id] || [];
    const assignedStudents = students.filter(s => assignedStudentIds.includes(s.id));

    setTeacherStudents(assignedStudents);
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

      // Reload attendance history
      await loadAttendanceHistory();
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('Failed to save attendance');
    }
  };

  // Load attendance history
  const loadAttendanceHistory = async () => {
    try {
      const { data } = await supabase
        .from('teacher_attendance')
        .select('*')
        .order('attendance_date', { ascending: false })
        .limit(50);

      if (data) {
        // Manually add teacher and student names
        const enrichedData = data.map((record: any) => {
          const teacher = teachers.find(t => t.id === record.teacher_id);
          const student = students.find(s => s.id === record.student_id);
          return {
            ...record,
            teacher_name: teacher?.full_name || 'N/A',
            student_name: student?.full_name || 'N/A',
          };
        });
        setAttendanceHistory(enrichedData);
      }
    } catch (error) {
      console.error('Error loading attendance history:', error);
    }
  };

  // Save mock test score
  const saveMockTest = async () => {
    if (!mockTestStudent || !testName || !testScore) {
      alert('Please fill in all required fields');
      return;
    }

    setSavingTest(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const email = auth.user?.email;
      const teacherRecord = teachers.find(t => t.email === email);

      if (!teacherRecord) {
        alert('Teacher record not found');
        return;
      }

      const { error } = await supabase
        .from('student_mock_tests')
        .insert([{
          student_id: mockTestStudent,
          teacher_id: teacherRecord.id,
          test_name: testName,
          score: testScore,
          test_date: testDate,
          notes: testNotes,
          created_by: email,
        }]);

      if (error) {
        console.error('Error saving mock test:', error);
        alert('Failed to save test score');
        return;
      }

      alert('Test score saved successfully!');
      // Reset form
      setMockTestStudent('');
      setTestName('');
      setTestScore('');
      setTestDate(new Date().toISOString().split('T')[0]);
      setTestNotes('');
    } catch (error) {
      console.error('Error saving mock test:', error);
      alert('Failed to save test score');
    } finally {
      setSavingTest(false);
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
              {(isAdmin || canAssignStudents) && (
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
              <button
                onClick={() => setActiveTab('mocktests')}
                className={`px-6 py-3 font-semibold ${activeTab === 'mocktests'
                  ? 'border-b-2 border-[#ffa332] text-[#ffa332]'
                  : 'text-text-secondary'
                  }`}
              >
                Mock Tests
              </button>
            </div>
          </div>

          {/* Section A: Assign Students (Admin or Authorized Users) */}
          {activeTab === 'assign' && (isAdmin || canAssignStudents) && (
            <div className="space-y-6">
              {/* Teacher Selection */}
              <div className="bg-white rounded-xl p-6 shadow-[0px_6px_58px_#c3cbd61a]">
                <h2 className="text-xl font-bold mb-4">Assign Students to Teachers</h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Available Students */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Available Students</h3>
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full border rounded p-2 mb-3 text-sm"
                    />
                    {!selectedTeacherForAssign ? (
                      <div className="border rounded p-4 text-center text-text-secondary">
                        Select a teacher from the right panel to assign students
                      </div>
                    ) : (
                      <div className="border rounded max-h-96 overflow-auto">
                        {students
                          .filter(s =>
                            s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                            !(studentAssignments[selectedTeacherForAssign] || []).includes(s.id)
                          )
                          .map(student => (
                            <div
                              key={student.id}
                              className="p-3 border-b hover:bg-gray-50 flex items-center justify-between"
                            >
                              <span className="text-sm">{student.full_name}</span>
                              <button
                                onClick={() => handleAssignStudent(student.id, selectedTeacherForAssign)}
                                className="text-xs px-3 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                              >
                                Assign
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Teachers and Their Assigned Students */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Teachers & Assigned Students</h3>
                    <div className="space-y-4 max-h-96 overflow-auto">
                      {teachers.filter(t => t.status === 'Active').map(teacher => {
                        const assignedStudents = (studentAssignments[teacher.id] || [])
                          .map(sid => students.find(s => s.id === sid))
                          .filter(Boolean);
                        const isSelected = selectedTeacherForAssign === teacher.id;

                        return (
                          <div
                            key={teacher.id}
                            className={`border rounded p-4 cursor-pointer transition ${isSelected ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
                              }`}
                            onClick={() => setSelectedTeacherForAssign(teacher.id)}
                          >
                            <div className="font-semibold mb-2">{teacher.full_name}</div>
                            <div className="text-xs text-text-secondary mb-2">
                              {teacher.email}
                            </div>
                            <div className="text-xs text-text-secondary mb-2">
                              Assigned Students: {assignedStudents.length}
                            </div>
                            {assignedStudents.length > 0 && (
                              <div className="mt-3 space-y-1">
                                <div className="text-xs font-semibold">Students:</div>
                                {assignedStudents.map((student: any) => (
                                  <div key={student.id} className="flex items-center justify-between text-xs bg-white p-2 rounded">
                                    <span>{student.full_name}</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUnassignStudent(student.id, teacher.id);
                                      }}
                                      className="text-red-600 hover:text-red-800"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section B: Daily Attendance */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              {/* Add Attendance Section */}
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
                      onClick={async () => {
                        // For teachers, find their teacher record by email
                        const { data: auth } = await supabase.auth.getUser();
                        const email = auth.user?.email;
                        const teacherRecord = teachers.find(t => t.email === email);

                        if (teacherRecord) {
                          handleOpenAttendance(teacherRecord);
                        } else {
                          alert('Teacher record not found. Please contact admin.');
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
                      {teachers.filter(t => t.status === 'Active').map(teacher => {
                        const assignedCount = (studentAssignments[teacher.id] || []).length;
                        return (
                          <div key={teacher.id} className="border rounded-lg p-4">
                            <div className="font-semibold">{teacher.full_name}</div>
                            <div className="text-sm text-text-secondary">{teacher.email}</div>
                            <div className="text-xs text-text-secondary mt-2">
                              Assigned Students: {assignedCount}
                            </div>
                            <button
                              onClick={() => handleOpenAttendance(teacher)}
                              className="mt-3 px-3 py-1.5 rounded bg-blue-100 text-blue-700 text-sm font-semibold hover:bg-blue-200"
                            >
                              Add Attendance
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Attendance History */}
              <div className="bg-white rounded-xl p-6 shadow-[0px_6px_58px_#c3cbd61a]">
                <h3 className="text-lg font-bold mb-4">Attendance History</h3>
                {attendanceHistory.length === 0 ? (
                  <div className="text-sm text-text-secondary text-center py-4">
                    No attendance records yet
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-text-secondary border-b">
                          <th className="py-2 pr-4">Date</th>
                          <th className="py-2 pr-4">Teacher</th>
                          <th className="py-2 pr-4">Student</th>
                          <th className="py-2 pr-4">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceHistory.slice(0, 20).map((record: any, idx: number) => (
                          <tr key={idx} className="border-b">
                            <td className="py-2 pr-4">{new Date(record.attendance_date).toLocaleDateString()}</td>
                            <td className="py-2 pr-4">{record.teacher_name}</td>
                            <td className="py-2 pr-4">{record.student_name}</td>
                            <td className="py-2 pr-4">
                              <span className={`px-2 py-1 rounded text-xs ${record.status === 'Present'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                                }`}>
                                {record.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
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

          {/* Section D: Mock Tests */}
          {activeTab === 'mocktests' && (
            <div className="bg-white rounded-xl p-6 shadow-[0px_6px_58px_#c3cbd61a]">
              <h2 className="text-xl font-bold mb-4">Mock Tests</h2>
              <p className="text-text-secondary mb-6">
                Record mock test scores for your assigned students
              </p>

              <div className="max-w-2xl">
                <div className="grid grid-cols-1 gap-4">
                  {/* Student Selection */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Student <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={mockTestStudent}
                      onChange={(e) => setMockTestStudent(e.target.value)}
                      className="w-full border rounded p-2"
                      required
                    >
                      <option value="">Select a student</option>
                      {(() => {
                        // Get current user's email to find their teacher record
                        const currentTeacher = teachers.find(t => t.email === currentUserEmail);

                        if (!currentTeacher) {
                          return <option disabled>No teacher record found</option>;
                        }

                        const assignedStudentIds = studentAssignments[currentTeacher.id] || [];
                        const assignedStudents = students.filter(s => assignedStudentIds.includes(s.id));

                        if (assignedStudents.length === 0) {
                          return <option disabled>No students assigned</option>;
                        }

                        return assignedStudents.map(student => (
                          <option key={student.id} value={student.id}>
                            {student.full_name}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>

                  {/* Test Name */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Test Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={testName}
                      onChange={(e) => setTestName(e.target.value)}
                      placeholder="e.g., IELTS Mock Test 1, PTE Practice Test"
                      className="w-full border rounded p-2"
                      required
                    />
                  </div>

                  {/* Score/Band */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Score / Band <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={testScore}
                      onChange={(e) => setTestScore(e.target.value)}
                      placeholder="e.g., 7.5, 85/100, Band 8"
                      className="w-full border rounded p-2"
                      required
                    />
                  </div>

                  {/* Test Date */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Test Date
                    </label>
                    <input
                      type="date"
                      value={testDate}
                      onChange={(e) => setTestDate(e.target.value)}
                      className="w-full border rounded p-2"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={testNotes}
                      onChange={(e) => setTestNotes(e.target.value)}
                      placeholder="Additional comments or observations"
                      className="w-full border rounded p-2"
                      rows={3}
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={saveMockTest}
                      disabled={savingTest || !mockTestStudent || !testName || !testScore}
                      className={`px-6 py-2 rounded bg-[#ffa332] text-white font-bold ${savingTest || !mockTestStudent || !testName || !testScore
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                        }`}
                    >
                      {savingTest ? 'Saving...' : 'Save Test Score'}
                    </button>
                  </div>
                </div>
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
