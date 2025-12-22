/**
 * @fileoverview Public Employee Onboarding Form
 * 
 * Public-facing onboarding form accessible without authentication.
 * Can be accessed via QR code for new employee candidates.
 * 
 * **Key Features:**
 * - No authentication required
 * - All fields from employee onboarding requirements
 * - File upload for CNIC/NIC
 * - Direct submission to employee_onboardings table
 * - Form validation
 * 
 * @module pages/Public/PublicOnboardingForm
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Helmet } from 'react-helmet';

const PublicOnboardingForm: React.FC = () => {
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        candidate_email: '',
        full_name: '',
        cnic_no: '',
        father_name: '',
        personal_contact: '',
        current_address: '',
        gender: '',
        marital_status: '',
        date_of_birth: '',
        nationality: 'Pakistani',
        blood_group: '',
        qualification: '',
        bank_name: '',
        account_title: '',
        account_number: '',
    });

    const [cnicFile, setCnicFile] = useState<File | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setCnicFile(file);
    };

    const uploadCnicFile = async (): Promise<string | null> => {
        if (!cnicFile) return null;

        const bucket = 'employee-files';
        const timestamp = Date.now();
        const path = `public-onboarding/${timestamp}-${cnicFile.name}`;

        const { error, data } = await supabase.storage.from(bucket).upload(path, cnicFile, { upsert: false });
        if (error) {
            console.error('CNIC upload failed:', error);
            return null;
        }

        const { data: pub } = await supabase.storage.from(bucket).getPublicUrl(path);
        return pub?.publicUrl || null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!formData.candidate_email || !formData.full_name || !formData.cnic_no ||
            !formData.father_name || !formData.personal_contact || !formData.current_address ||
            !formData.date_of_birth) {
            alert('Please fill all required fields marked with *');
            return;
        }

        // Email validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.candidate_email)) {
            alert('Please enter a valid email address');
            return;
        }

        // CNIC validation (13 digits)
        if (!/^\d{13}$/.test(formData.cnic_no.replace(/-/g, ''))) {
            alert('CNIC must be 13 digits');
            return;
        }

        setSubmitting(true);

        try {
            // Upload CNIC file if provided
            let cnicUrl = null;
            if (cnicFile) {
                cnicUrl = await uploadCnicFile();
            }

            // Prepare payload
            const payload = {
                ...formData,
                status: 'Submitted',
                submitted_at: new Date().toISOString(),
                attachments: cnicUrl ? { cnic: cnicUrl } : null,
            };

            // Insert into employee_onboardings
            const { error } = await supabase
                .from('employee_onboardings')
                .insert([payload]);

            if (error) throw error;

            setSubmitted(true);
            alert('Thank you! Your onboarding form has been submitted successfully. HR will review and contact you soon.');

            // Reset form
            setFormData({
                candidate_email: '',
                full_name: '',
                cnic_no: '',
                father_name: '',
                personal_contact: '',
                current_address: '',
                gender: '',
                marital_status: '',
                date_of_birth: '',
                nationality: 'Pakistani',
                blood_group: '',
                qualification: '',
                bank_name: '',
                account_title: '',
                account_number: '',
            });
            setCnicFile(null);
        } catch (err: any) {
            console.error('Submission error:', err);
            alert(err?.message || 'Failed to submit form. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
                    <div className="text-6xl mb-4">✅</div>
                    <h2 className="text-2xl font-bold mb-2">Submission Successful!</h2>
                    <p className="text-gray-600 mb-6">
                        Thank you for submitting your onboarding form. Our HR team will review your application and contact you soon.
                    </p>
                    <button
                        onClick={() => setSubmitted(false)}
                        className="px-6 py-2 bg-[#ffa332] text-white rounded-lg font-semibold hover:bg-orange-600"
                    >
                        Submit Another Application
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>Employee Onboarding Form | GSL Pakistan</title>
            </Helmet>
            <div className="min-h-screen bg-gray-50 py-8 px-4">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
                        <div className="mb-6">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Employee Onboarding Form</h1>
                            <p className="text-gray-600">Please fill out all required fields marked with *</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Employee Details Section */}
                            <div className="border-b pb-6">
                                <h2 className="text-xl font-semibold mb-4">Employee Details</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold mb-1">
                                            Employee Email *
                                        </label>
                                        <input
                                            type="email"
                                            name="candidate_email"
                                            required
                                            value={formData.candidate_email}
                                            onChange={handleChange}
                                            className="w-full border rounded-lg px-3 py-2"
                                            placeholder="your.email@example.com"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold mb-1">
                                            Full Name / Candidate Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="full_name"
                                            required
                                            value={formData.full_name}
                                            onChange={handleChange}
                                            className="w-full border rounded-lg px-3 py-2"
                                            placeholder="Enter full name"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-1">
                                            CNIC No *
                                        </label>
                                        <input
                                            type="text"
                                            name="cnic_no"
                                            required
                                            value={formData.cnic_no}
                                            onChange={handleChange}
                                            className="w-full border rounded-lg px-3 py-2"
                                            placeholder="1234567890123"
                                            maxLength={13}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-1">
                                            Father / Husband Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="father_name"
                                            required
                                            value={formData.father_name}
                                            onChange={handleChange}
                                            className="w-full border rounded-lg px-3 py-2"
                                            placeholder="Enter father/husband name"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-1">
                                            Contact No *
                                        </label>
                                        <input
                                            type="tel"
                                            name="personal_contact"
                                            required
                                            value={formData.personal_contact}
                                            onChange={handleChange}
                                            className="w-full border rounded-lg px-3 py-2"
                                            placeholder="+92 300 1234567"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold mb-1">
                                            Current Address *
                                        </label>
                                        <textarea
                                            name="current_address"
                                            required
                                            value={formData.current_address}
                                            onChange={handleChange}
                                            className="w-full border rounded-lg px-3 py-2"
                                            rows={2}
                                            placeholder="Enter complete address"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-1">
                                            Gender *
                                        </label>
                                        <div className="flex gap-4 mt-2">
                                            <label className="flex items-center">
                                                <input
                                                    type="radio"
                                                    name="gender"
                                                    value="Male"
                                                    checked={formData.gender === 'Male'}
                                                    onChange={handleChange}
                                                    className="mr-2"
                                                />
                                                Male
                                            </label>
                                            <label className="flex items-center">
                                                <input
                                                    type="radio"
                                                    name="gender"
                                                    value="Female"
                                                    checked={formData.gender === 'Female'}
                                                    onChange={handleChange}
                                                    className="mr-2"
                                                />
                                                Female
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-1">
                                            Marital Status *
                                        </label>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            {['Single', 'Married', 'Divorced', 'Widow'].map(status => (
                                                <label key={status} className="flex items-center">
                                                    <input
                                                        type="radio"
                                                        name="marital_status"
                                                        value={status}
                                                        checked={formData.marital_status === status}
                                                        onChange={handleChange}
                                                        className="mr-2"
                                                    />
                                                    {status}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-1">
                                            Date of Birth *
                                        </label>
                                        <input
                                            type="date"
                                            name="date_of_birth"
                                            required
                                            value={formData.date_of_birth}
                                            onChange={handleChange}
                                            className="w-full border rounded-lg px-3 py-2"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-1">
                                            Nationality
                                        </label>
                                        <input
                                            type="text"
                                            name="nationality"
                                            value={formData.nationality}
                                            onChange={handleChange}
                                            className="w-full border rounded-lg px-3 py-2"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-1">
                                            Blood Group
                                        </label>
                                        <select
                                            name="blood_group"
                                            value={formData.blood_group}
                                            onChange={handleChange}
                                            className="w-full border rounded-lg px-3 py-2"
                                        >
                                            <option value="">Select</option>
                                            <option>A+</option>
                                            <option>A-</option>
                                            <option>B+</option>
                                            <option>B-</option>
                                            <option>AB+</option>
                                            <option>AB-</option>
                                            <option>O+</option>
                                            <option>O-</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-1">
                                            Qualification
                                        </label>
                                        <select
                                            name="qualification"
                                            value={formData.qualification}
                                            onChange={handleChange}
                                            className="w-full border rounded-lg px-3 py-2"
                                        >
                                            <option value="">Select</option>
                                            <option>Matric</option>
                                            <option>Intermediate</option>
                                            <option>Bachelor's</option>
                                            <option>Master's</option>
                                            <option>PhD</option>
                                        </select>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold mb-1">
                                            NIC / CNIC (Upload)
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/*,.pdf"
                                            onChange={handleFileChange}
                                            className="w-full border rounded-lg px-3 py-2"
                                        />
                                        {cnicFile && (
                                            <p className="text-sm text-green-600 mt-1">
                                                ✓ {cnicFile.name}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Bank Details Section */}
                            <div>
                                <h2 className="text-xl font-semibold mb-4">Bank Details (Optional)</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold mb-1">
                                            Bank
                                        </label>
                                        <select
                                            name="bank_name"
                                            value={formData.bank_name}
                                            onChange={handleChange}
                                            className="w-full border rounded-lg px-3 py-2"
                                        >
                                            <option value="">Select Bank</option>
                                            <option>HBL</option>
                                            <option>UBL</option>
                                            <option>MCB</option>
                                            <option>Allied Bank</option>
                                            <option>Meezan Bank</option>
                                            <option>Bank Alfalah</option>
                                            <option>Standard Chartered</option>
                                            <option>Other</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-1">
                                            Account Title
                                        </label>
                                        <input
                                            type="text"
                                            name="account_title"
                                            value={formData.account_title}
                                            onChange={handleChange}
                                            className="w-full border rounded-lg px-3 py-2"
                                            placeholder="Account holder name"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold mb-1">
                                            Account Number
                                        </label>
                                        <input
                                            type="text"
                                            name="account_number"
                                            value={formData.account_number}
                                            onChange={handleChange}
                                            className="w-full border rounded-lg px-3 py-2"
                                            placeholder="Enter account number"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => navigate('/')}
                                    className="px-6 py-2 border rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2 bg-[#ffa332] text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50"
                                >
                                    {submitting ? 'Submitting...' : 'Submit'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
};

export default PublicOnboardingForm;
