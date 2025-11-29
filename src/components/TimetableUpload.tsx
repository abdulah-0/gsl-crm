/**
 * @fileoverview Timetable Upload Component
 * 
 * Component for uploading timetable files to Supabase Storage.
 * Handles file validation, upload, and database record creation.
 * 
 * @module components/TimetableUpload
 */

import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Props for TimetableUpload component
 */
type TimetableUploadProps = {
    /** Callback function called after successful upload */
    onUploadSuccess: () => void;
};

/**
 * TimetableUpload Component
 * 
 * Handles timetable file uploads with validation and storage.
 * 
 * **Features:**
 * - File type validation (PDF, PNG, JPG)
 * - File size validation (max 10MB)
 * - Upload to Supabase Storage
 * - Automatic deactivation of previous timetables
 * - Database record creation
 * - Loading states during upload
 * 
 * @component
 * @example
 * ```tsx
 * <TimetableUpload
 *   onUploadSuccess={() => {
 *     console.log('Upload successful');
 *     refreshTimetableList();
 *   }}
 * />
 * ```
 */
const TimetableUpload: React.FC<TimetableUploadProps> = ({ onUploadSuccess }) => {
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type
            const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
            if (!validTypes.includes(file.type)) {
                alert('Please select a PDF, PNG, or JPG file');
                return;
            }
            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                alert('File size must be less than 10MB');
                return;
            }
            setSelectedFile(file);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            alert('Please select a file first');
            return;
        }

        setUploading(true);
        try {
            const { data: auth } = await supabase.auth.getUser();
            const email = auth.user?.email;

            // Upload file to Supabase Storage
            const fileName = `timetable_${Date.now()}_${selectedFile.name}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('timetables')
                .upload(fileName, selectedFile);

            if (uploadError) {
                console.error('Upload error:', uploadError);
                alert('Failed to upload file');
                return;
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('timetables')
                .getPublicUrl(fileName);

            // Deactivate previous timetables
            await supabase
                .from('teacher_timetable')
                .update({ is_active: false })
                .eq('is_active', true);

            // Insert new timetable record
            const { error: insertError } = await supabase
                .from('teacher_timetable')
                .insert([{
                    file_url: urlData.publicUrl,
                    file_name: selectedFile.name,
                    file_type: selectedFile.type,
                    uploaded_by: email || null,
                    is_active: true,
                }]);

            if (insertError) {
                console.error('Insert error:', insertError);
                alert('Failed to save timetable record');
                return;
            }

            alert('Timetable uploaded successfully!');
            setSelectedFile(null);
            onUploadSuccess();
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload timetable');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="border rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3">Upload Timetable</h4>
            <div className="space-y-3">
                <div>
                    <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={handleFileSelect}
                        className="text-sm"
                    />
                    {selectedFile && (
                        <div className="mt-2 text-xs text-text-secondary">
                            Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                        </div>
                    )}
                </div>
                <button
                    onClick={handleUpload}
                    disabled={!selectedFile || uploading}
                    className={`px-4 py-2 rounded bg-[#ffa332] text-white font-bold ${!selectedFile || uploading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                >
                    {uploading ? 'Uploading...' : 'Upload Timetable'}
                </button>
                <p className="text-xs text-text-secondary">
                    Accepted formats: PDF, PNG, JPG (Max 10MB)
                </p>
            </div>
        </div>
    );
};

export default TimetableUpload;
