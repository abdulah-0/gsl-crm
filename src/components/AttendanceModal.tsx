/**
 * @fileoverview Attendance Modal Component
 * 
 * Modal component for recording daily student attendance.
 * Allows teachers to mark students as Present or Absent for a specific date.
 * 
 * @module components/AttendanceModal
 */

import React, { useState } from 'react';

/**
 * Student data structure for attendance tracking
 */
type Student = {
    /** Unique student identifier */
    id: string;
    /** Student's full name */
    full_name: string;
};

/**
 * Props for AttendanceModal component
 */
type AttendanceModalProps = {
    /** Whether the modal is open */
    isOpen: boolean;
    /** Callback to close the modal */
    onClose: () => void;
    /** Callback to submit attendance data */
    onSubmit: (data: { date: string; attendance: { studentId: string; status: 'Present' | 'Absent' }[] }) => Promise<void>;
    /** List of students to mark attendance for */
    students: Student[];
    /** ID of the teacher recording attendance */
    teacherId: string;
};

/**
 * AttendanceModal Component
 * 
 * Modal for recording daily student attendance.
 * 
 * **Features:**
 * - Date selection for attendance record
 * - Individual student status toggle (Present/Absent)
 * - Bulk actions (Mark All Present/Absent)
 * - Form validation and submission
 * - Loading states during submission
 * 
 * @component
 * @example
 * ```tsx
 * <AttendanceModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   onSubmit={handleAttendanceSubmit}
 *   students={studentList}
 *   teacherId={teacher.id}
 * />
 * ```
 */
const AttendanceModal: React.FC<AttendanceModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    students,
    teacherId,
}) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendance, setAttendance] = useState<Record<string, 'Present' | 'Absent'>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleToggle = (studentId: string) => {
        setAttendance(prev => ({
            ...prev,
            [studentId]: prev[studentId] === 'Present' ? 'Absent' : 'Present',
        }));
    };

    const handleMarkAll = (status: 'Present' | 'Absent') => {
        const newAttendance: Record<string, 'Present' | 'Absent'> = {};
        students.forEach(student => {
            newAttendance[student.id] = status;
        });
        setAttendance(newAttendance);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const attendanceData = students.map(student => ({
                studentId: student.id,
                status: attendance[student.id] || 'Absent',
            }));
            await onSubmit({ date, attendance: attendanceData });
            // Reset form
            setAttendance({});
            setDate(new Date().toISOString().split('T')[0]);
            onClose();
        } catch (error) {
            console.error('Error submitting attendance:', error);
            alert('Failed to submit attendance');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <form
                onSubmit={handleSubmit}
                className="bg-white w-full max-w-2xl max-h-[90vh] rounded-xl p-6 shadow-xl overflow-auto"
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Add Daily Attendance</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-text-secondary hover:opacity-70"
                    >
                        ✕
                    </button>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                        Date <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full border rounded p-2"
                        required
                    />
                </div>

                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-text-secondary">
                            Students ({students.length})
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => handleMarkAll('Present')}
                                className="text-xs px-3 py-1 rounded border hover:bg-green-50"
                            >
                                Mark All Present
                            </button>
                            <button
                                type="button"
                                onClick={() => handleMarkAll('Absent')}
                                className="text-xs px-3 py-1 rounded border hover:bg-red-50"
                            >
                                Mark All Absent
                            </button>
                        </div>
                    </div>

                    <div className="border rounded max-h-96 overflow-auto">
                        {students.length === 0 ? (
                            <div className="p-4 text-center text-text-secondary">
                                No students assigned to this teacher
                            </div>
                        ) : (
                            <div className="divide-y">
                                {students.map((student) => {
                                    const status = attendance[student.id] || 'Absent';
                                    return (
                                        <div
                                            key={student.id}
                                            className="p-3 flex items-center justify-between hover:bg-gray-50"
                                        >
                                            <span className="text-sm font-medium">{student.full_name}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleToggle(student.id)}
                                                className={`px-4 py-1.5 rounded text-sm font-semibold ${status === 'Present'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-red-100 text-red-700'
                                                    }`}
                                            >
                                                {status}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded border hover:bg-gray-50"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || students.length === 0}
                        className={`px-4 py-2 rounded bg-[#ffa332] text-white font-bold shadow-[0px_6px_12px_#3f8cff43] ${isSubmitting || students.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                    >
                        {isSubmitting ? 'Saving...' : 'Save Attendance'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AttendanceModal;
