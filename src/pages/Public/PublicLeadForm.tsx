/**
 * @fileoverview Public Lead Form
 * 
 * A publicly accessible form for collecting lead information.
 * This form does not require authentication and can be accessed by anyone with the link.
 * Submitted leads appear in the CRM's All Leads tab with status='new'.
 * 
 * @module pages/Public/PublicLeadForm
 */

import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';

/**
 * PublicLeadForm Component
 * 
 * A form for external users to submit their information as leads.
 * No authentication required - accessible via public URL.
 * 
 * Features:
 * - Clean, professional design suitable for external users
 * - Required fields validation
 * - Success/error messaging
 * - Automatic status and date assignment
 * 
 * @component
 */
const PublicLeadForm: React.FC = () => {
    const [formData, setFormData] = useState({
        full_name: '',
        father_name: '',
        cnic: '',
        id_type: 'cnic' as 'cnic' | 'passport',
        phone: '',
        email: '',
        country: '',
        city: '',
        address: '',
        dob: '',
        service_name: '',
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const validateForm = (): boolean => {
        // Required fields
        if (!formData.full_name.trim()) {
            setErrorMessage('Full name is required');
            return false;
        }
        if (!formData.father_name.trim()) {
            setErrorMessage("Father's name is required");
            return false;
        }
        if (!formData.cnic.trim()) {
            setErrorMessage(`${formData.id_type === 'passport' ? 'Passport' : 'CNIC'} is required`);
            return false;
        }
        if (formData.id_type === 'passport') {
            if (formData.cnic.length < 6) {
                setErrorMessage('Passport number must be at least 6 characters');
                return false;
            }
        } else {
            if (!/^\d{13}$/.test(formData.cnic.replace(/-/g, ''))) {
                setErrorMessage('CNIC must be 13 digits');
                return false;
            }
        }
        if (!formData.phone.trim()) {
            setErrorMessage('Phone number is required');
            return false;
        }
        if (!/^\d{10,15}$/.test(formData.phone.replace(/[\s\-\+]/g, ''))) {
            setErrorMessage('Phone number must be 10-15 digits');
            return false;
        }
        if (!formData.email.trim()) {
            setErrorMessage('Email is required');
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            setErrorMessage('Please enter a valid email address');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');

        if (!validateForm()) {
            setSubmitStatus('error');
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus('idle');

        try {
            const leadData = {
                full_name: formData.full_name.trim(),
                father_name: formData.father_name.trim(),
                cnic: formData.cnic.trim(),
                id_type: formData.id_type,
                phone: formData.phone.trim(),
                email: formData.email.trim().toLowerCase(),
                country: formData.country.trim() || null,
                city: formData.city.trim() || null,
                address: formData.address.trim() || null,
                dob: formData.dob || null,
                service_name: formData.service_name.trim() || null,
                source: 'google_form',
                status: 'new',
                lead_date: new Date().toISOString().split('T')[0],
            };

            const { error } = await supabase.from('leads').insert([leadData]);

            if (error) {
                console.error('Error submitting lead:', error);
                setErrorMessage('Failed to submit form. Please try again.');
                setSubmitStatus('error');
            } else {
                setSubmitStatus('success');
                // Reset form
                setFormData({
                    full_name: '',
                    father_name: '',
                    cnic: '',
                    id_type: 'cnic',
                    phone: '',
                    email: '',
                    country: '',
                    city: '',
                    address: '',
                    dob: '',
                    service_name: '',
                });
            }
        } catch (err) {
            console.error('Unexpected error:', err);
            setErrorMessage('An unexpected error occurred. Please try again.');
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Helmet>
                <title>Submit Lead - GSL CRM</title>
                <meta name="description" content="Submit your information to get started with our services" />
            </Helmet>

            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-lg shadow-xl p-8">
                        {/* Header */}
                        <div className="text-center mb-8">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Get Started With Us</h1>
                            <p className="text-gray-600">Fill out the form below and we'll get in touch with you soon</p>
                        </div>

                        {/* Success Message */}
                        {submitStatus === 'success' && (
                            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <p className="text-green-800 font-medium">Thank you! Your information has been submitted successfully.</p>
                                </div>
                            </div>
                        )}

                        {/* Error Message */}
                        {submitStatus === 'error' && errorMessage && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    <p className="text-red-800">{errorMessage}</p>
                                </div>
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Full Name */}
                            <div>
                                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
                                    Full Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="full_name"
                                    name="full_name"
                                    value={formData.full_name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Enter your full name"
                                    required
                                />
                            </div>

                            {/* Father's Name */}
                            <div>
                                <label htmlFor="father_name" className="block text-sm font-medium text-gray-700 mb-1">
                                    Father's Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="father_name"
                                    name="father_name"
                                    value={formData.father_name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Enter your father's name"
                                    required
                                />
                            </div>

                            {/* ID Type */}
                            <div>
                                <label htmlFor="id_type" className="block text-sm font-medium text-gray-700 mb-1">
                                    ID Type <span className="text-red-500">*</span>
                                </label>
                                <select
                                    id="id_type"
                                    name="id_type"
                                    value={formData.id_type}
                                    onChange={(e) => setFormData(prev => ({ ...prev, id_type: e.target.value as 'cnic' | 'passport' }))}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                >
                                    <option value="cnic">CNIC</option>
                                    <option value="passport">Passport</option>
                                </select>
                            </div>

                            {/* CNIC/Passport */}
                            <div>
                                <label htmlFor="cnic" className="block text-sm font-medium text-gray-700 mb-1">
                                    {formData.id_type === 'passport' ? 'Passport Number' : 'CNIC'} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="cnic"
                                    name="cnic"
                                    value={formData.cnic}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder={formData.id_type === 'passport' ? 'Passport number' : 'XXXXXXXXXXXXX (13 digits)'}
                                    required
                                />
                            </div>

                            {/* Phone */}
                            <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                                    Phone Number <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    id="phone"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="03XXXXXXXXX"
                                    required
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                    Email Address <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="your.email@example.com"
                                    required
                                />
                            </div>

                            {/* Country */}
                            <div>
                                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                                    Country
                                </label>
                                <input
                                    type="text"
                                    id="country"
                                    name="country"
                                    value={formData.country}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Enter your country"
                                />
                            </div>

                            {/* City */}
                            <div>
                                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                                    City
                                </label>
                                <input
                                    type="text"
                                    id="city"
                                    name="city"
                                    value={formData.city}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Enter your city"
                                />
                            </div>

                            {/* Address */}
                            <div>
                                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                                    Address
                                </label>
                                <textarea
                                    id="address"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Enter your address"
                                />
                            </div>

                            {/* Date of Birth */}
                            <div>
                                <label htmlFor="dob" className="block text-sm font-medium text-gray-700 mb-1">
                                    Date of Birth
                                </label>
                                <input
                                    type="date"
                                    id="dob"
                                    name="dob"
                                    value={formData.dob}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            {/* Service Name */}
                            <div>
                                <label htmlFor="service_name" className="block text-sm font-medium text-gray-700 mb-1">
                                    Service Interested In
                                </label>
                                <input
                                    type="text"
                                    id="service_name"
                                    name="service_name"
                                    value={formData.service_name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g., Study Abroad, Visa Consultancy"
                                />
                            </div>

                            {/* Submit Button */}
                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${isSubmitting
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                                        }`}
                                >
                                    {isSubmitting ? 'Submitting...' : 'Submit'}
                                </button>
                            </div>
                        </form>

                        {/* Footer Note */}
                        <div className="mt-6 text-center text-sm text-gray-500">
                            <p>Your information will be kept confidential and used only for contacting you about our services.</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default PublicLeadForm;
