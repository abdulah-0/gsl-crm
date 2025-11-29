/**
 * @fileoverview University Application Form Component
 * 
 * Modal form for submitting university applications.
 * Captures course details, application date, and comments.
 * 
 * @module components/UniversityApplicationForm
 */

import React, { useState } from 'react';

/**
 * Props for UniversityApplicationForm component
 */
type UniversityApplicationFormProps = {
    /** Whether the modal is open */
    isOpen: boolean;
    /** Callback to close the modal */
    onClose: () => void;
    /** Callback to submit application data */
    onSubmit: (data: { courseApplied: string; applicationDate: string; comment: string }) => void;
    /** Name of the university being applied to */
    universityName: string;
};

/**
 * UniversityApplicationForm Component
 * 
 * Modal form for submitting university applications.
 * 
 * **Features:**
 * - Course name input
 * - Application date selection
 * - Optional comments/notes
 * - Form validation
 * - Loading states during submission
 * - Auto-reset on successful submission
 * 
 * @component
 * @example
 * ```tsx
 * <UniversityApplicationForm
 *   isOpen={showForm}
 *   onClose={() => setShowForm(false)}
 *   onSubmit={(data) => handleApplicationSubmit(data)}
 *   universityName="Harvard University"
 * />
 * ```
 */
const UniversityApplicationForm: React.FC<UniversityApplicationFormProps> = ({
    isOpen,
    onClose,
    onSubmit,
    universityName,
}) => {
    const [courseApplied, setCourseApplied] = useState('');
    const [applicationDate, setApplicationDate] = useState(
        new Date().toISOString().split('T')[0]
    );
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!courseApplied.trim()) {
            alert('Please enter the course to apply for');
            return;
        }
        setIsSubmitting(true);
        try {
            await onSubmit({ courseApplied, applicationDate, comment });
            // Reset form
            setCourseApplied('');
            setApplicationDate(new Date().toISOString().split('T')[0]);
            setComment('');
            onClose();
        } catch (error) {
            console.error('Error submitting application:', error);
            alert('Failed to submit application');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <form
                onSubmit={handleSubmit}
                className="bg-white w-full max-w-lg rounded-xl p-6 shadow-xl"
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">University Application</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-text-secondary hover:opacity-70"
                    >
                        ✕
                    </button>
                </div>

                <div className="mb-4">
                    <p className="text-sm text-text-secondary mb-4">
                        <strong>University:</strong> {universityName}
                    </p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                            Course to Apply For <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={courseApplied}
                            onChange={(e) => setCourseApplied(e.target.value)}
                            className="w-full border rounded p-2"
                            placeholder="e.g., BS Computer Science"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                            Application Date <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={applicationDate}
                            onChange={(e) => setApplicationDate(e.target.value)}
                            className="w-full border rounded p-2"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                            Comment / Notes
                        </label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="w-full border rounded p-2"
                            rows={3}
                            placeholder="Optional notes about this application..."
                        />
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
                        disabled={isSubmitting}
                        className={`px-4 py-2 rounded bg-[#ffa332] text-white font-bold shadow-[0px_6px_12px_#3f8cff43] ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                    >
                        {isSubmitting ? 'Saving...' : 'Save Application'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default UniversityApplicationForm;
