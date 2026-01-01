/**
 * @fileoverview Leads Management Page
 * 
 * This page provides comprehensive lead management functionality for the GSL CRM system.
 * It allows users to:
 * - Add new leads with detailed information
 * - View and filter all leads
 * - Update lead status and stage
 * - Add remarks to leads
 * - Convert leads to students
 * - Bulk import leads from Excel files
 * 
 * The page includes:
 * - Two-tab interface (Add Lead / All Leads)
 * - Form validation for required fields
 * - Real-time search and filtering
 * - Excel upload with column mapping
 * - Enrollment type selection modal
 * - Integration with Students page for conversion
 * 
 * @module pages/Leads
 */

import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

/**
 * Lead source types
 * Represents the different channels through which leads can be acquired
 */
export type LeadSource = 'facebook' | 'instagram' | 'google_form' | 'walk_in' | 'referral' | 'organic' | '';

/**
 * Lead status types
 * Represents the different stages in the lead lifecycle
 */
export type LeadStatus = 'new' | 'documentation' | 'university' | 'visa' | 'enrolled' | 'rejected' | 'confirmed';

/**
 * Lead data structure
 * Represents a lead record in the database
 */
export type Lead = {
  /** Unique identifier */
  id: number;
  /** Full name of the lead (CAPITAL) */
  full_name: string;
  /** Father or guardian name */
  father_name: string;
  /** CNIC number (13 digits) */
  cnic: string;
  /** Contact phone number */
  phone: string;
  /** Email address */
  email: string;
  /** Country (optional) */
  country: string | null;
  /** City (optional) */
  city: string | null;
  /** Full address (optional) */
  address: string | null;
  /** Date of birth (optional) */
  dob: string | null;
  /** Service/program name */
  service_name: string | null;
  /** Branch location */
  branch: string | null;
  /** Lead acquisition source */
  source: LeadSource | null;
  /** Current status in the pipeline */
  status: LeadStatus;
  /** Current stage (Entry stage, Follow up, etc.) */
  stage?: string | null;
  /** Email of assigned user */
  assigned_to_email: string | null;
  /** Associated university ID */
  university_id: number | null;
  /** Tags for categorization */
  tags: string[] | null;
  /** Date lead was created */
  lead_date: string | null;
  /** Student ID if converted */
  converted_to_student_id?: string | null;
  /** Additional remarks/notes */
  remarks?: string | null;
  /** Timestamp of creation */
  created_at?: string;
};

/**
 * Lead remark structure
 * Represents a single remark entry in the remarks history
 */
export type LeadRemark = {
  id: number;
  lead_id: number;
  remark: string;
  created_by_email: string;
  created_at: string;
};

/**
 * Lead form state structure
 * Represents the form data for adding a new lead
 */
type LeadFormState = {
  full_name: string;
  father_name: string;
  cnic: string;
  id_type: 'cnic' | 'passport';
  phone: string;
  email: string;
  country: string;
  city: string;
  address: string;
  dob: string;
  service_name: string;
  branch: string;
  date: string;
  source: LeadSource;
  status: LeadStatus;
  assigned_to_email: string;
  tags: string;
};

/**
 * Create default lead form state
 * Initializes form with empty values and current date
 * 
 * @returns Default lead form state
 */
const makeDefaultLeadForm = (): LeadFormState => ({
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
  branch: '',
  date: new Date().toISOString().slice(0, 10),
  source: '' as LeadSource,
  status: 'new' as LeadStatus,
  assigned_to_email: '',
  tags: '',
});

/**
 * LeadsPage Component
 * 
 * Main component for lead management functionality.
 * Provides interface for adding, viewing, filtering, and converting leads.
 * 
 * **Features:**
 * - Add new leads with comprehensive form validation
 * - View all leads in a searchable, filterable table
 * - Update lead status, stage, and remarks inline
 * - Convert leads to students with enrollment type selection
 * - Bulk import leads from Excel files
 * - Real-time search and status filtering
 * 
 * **State Management:**
 * - Form state for adding new leads
 * - List of all leads from database
 * - Search and filter criteria
 * - Modal states for enrollment and upload
 * - User context (email, branch)
 * 
 * @component
 */
const LeadsPage: React.FC = () => {
  // UI state
  const [tab, setTab] = useState<'add' | 'list'>('list');
  const [items, setItems] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [stageF, setStageF] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>(''); // Specific date filter
  const [form, setForm] = useState<LeadFormState>(makeDefaultLeadForm());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Reference data
  const [services, setServices] = useState<Array<{ id: string; name: string }>>([]);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');

  // Form agreement states
  const [agreeAll, setAgreeAll] = useState(false);
  const [declTextAgree, setDeclTextAgree] = useState(false);

  // Enrollment modal state
  const [recentLead, setRecentLead] = useState<Lead | null>(null);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedLeadForEnroll, setSelectedLeadForEnroll] = useState<Lead | null>(null);

  // Excel upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Remarks modal state
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [selectedLeadForRemarks, setSelectedLeadForRemarks] = useState<Lead | null>(null);
  const [remarks, setRemarks] = useState<LeadRemark[]>([]);
  const [newRemark, setNewRemark] = useState('');
  const [loadingRemarks, setLoadingRemarks] = useState(false);
  const [savingRemark, setSavingRemark] = useState(false);

  const navigate = useNavigate();

  /**
   * Load all leads from the database
   * Fetches up to 200 most recent leads, ordered by creation date
   */
  const loadLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error) setItems((data as any as Lead[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const email = auth.user?.email || '';
        setCurrentUserEmail(email);
        if (email) {
          const { data: u } = await supabase
            .from('dashboard_users')
            .select('branch')
            .eq('email', email)
            .maybeSingle();
          const branch = (u as any)?.branch || '';
          setCurrentBranch(branch || null);
          setForm(prev => ({ ...prev, assigned_to_email: prev.assigned_to_email || email, branch: prev.branch || branch }));
        }
      } catch {
        // ignore
      }
      const { data: sv } = await supabase
        .from('dashboard_services')
        .select('id, name')
        .order('name');
      setServices((sv as any) || []);
    })();
  }, []);


  useEffect(() => { loadLeads(); }, []);

  /**
   * Filtered leads based on search query, stage filter, and date filter
   * Searches across name, email, phone, and city fields
   */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(l => {
      // Filter by stage if not 'All'
      if (stageF !== 'All' && l.stage !== stageF) return false;

      // Filter by specific date if selected
      if (dateFilter && l.lead_date) {
        const leadDate = new Date(l.lead_date);
        const filterDate = new Date(dateFilter);

        // Compare only the date parts (ignore time)
        leadDate.setHours(0, 0, 0, 0);
        filterDate.setHours(0, 0, 0, 0);

        if (leadDate.getTime() !== filterDate.getTime()) return false;
      }

      // If no search query, include all
      if (!q) return true;
      // Search across multiple fields
      const bucket = `${l.full_name || ''} ${l.email || ''} ${l.phone || ''} ${l.city || ''}`.toLowerCase();
      return bucket.includes(q);
    });
  }, [items, search, stageF, dateFilter]);

  /**
   * Reset form to default values while preserving user context
   * Keeps assigned_to_email and branch from current user
   */
  const resetForm = () => {
    setForm(prev => ({
      ...makeDefaultLeadForm(),
      assigned_to_email: prev.assigned_to_email,
      branch: prev.branch,
    }));
    setAgreeAll(false);
    setDeclTextAgree(false);
  };

  /**
   * Handle form submission for adding a new lead
   * 
   * Validates:
   * - Required fields (name, father name, CNIC, phone, email)
   * - CNIC format (13 digits)
   * - Phone format (10-15 digits)
   * - Email format
   * - Terms & conditions agreement
   * - Declaration agreement
   * 
   * @param e - Form submit event
   */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Trim and validate required fields
    const name = form.full_name.trim();
    const father = form.father_name.trim();
    const cnic = form.cnic.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();

    if (!name) { alert('Full Name is required'); return; }
    if (!father) { alert('Father Name is required'); return; }
    if (!cnic) { alert(`${form.id_type === 'passport' ? 'Passport' : 'CNIC'} is required`); return; }
    if (form.id_type === 'passport') {
      if (cnic.length < 6) { alert('Passport number must be at least 6 characters'); return; }
    } else {
      if (!/^\d{13}$/.test(cnic)) { alert('CNIC must be 13 digits'); return; }
    }
    if (!phone) { alert('Phone is required'); return; }
    if (!/^\+?[0-9]{10,15}$/.test(phone)) { alert('Invalid phone number format'); return; }
    if (!email) { alert('Email is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert('Invalid email format'); return; }
    if (!agreeAll) { alert('You must agree to Terms & Conditions'); return; }
    if (!declTextAgree) { alert('You must accept the Declaration'); return; }

    setSaving(true);
    try {
      // Parse tags from comma-separated string
      const tagsArr = form.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      // Build payload for database
      const payload: any = {
        full_name: name,
        father_name: father,
        cnic,
        id_type: form.id_type,
        phone,
        email,
        country: form.country || null,
        city: form.city || null,
        address: form.address || null,
        dob: form.dob || null,
        service_name: form.service_name || null,
        branch: form.branch || currentBranch || null,
        lead_date: form.date || new Date().toISOString().slice(0, 10),
        source: form.source || null,
        status: form.status,
        assigned_to_email: form.assigned_to_email || currentUserEmail || null,
        tags: tagsArr.length ? tagsArr : null,
      };

      const { data, error } = await supabase
        .from('leads')
        .insert([payload])
        .select('*')
        .single();

      if (error) throw error;

      setRecentLead(data as any as Lead);
      resetForm();
      await loadLeads();
      alert('Lead added successfully.');
    } catch (err: any) {
      alert((err as any)?.message || 'Failed to add lead');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (lead: Lead, status: LeadStatus) => {
    const { error } = await supabase.from('leads').update({ status }).eq('id', lead.id);
    if (error) { alert(error.message); return; }
    await loadLeads();
  };

  const updateStage = async (lead: Lead, stage: string) => {
    const { error } = await supabase.from('leads').update({ stage }).eq('id', lead.id);
    if (error) { alert(error.message); return; }
    await loadLeads();
  };

  /**
   * Fetch remarks history for a lead
   */
  const fetchRemarks = async (leadId: number) => {
    setLoadingRemarks(true);
    const { data, error } = await supabase
      .from('lead_remarks')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRemarks(data as LeadRemark[]);
    }
    setLoadingRemarks(false);
  };

  /**
   * Add a new remark to a lead
   */
  const addRemark = async () => {
    if (!selectedLeadForRemarks || !newRemark.trim()) return;

    setSavingRemark(true);
    const { error } = await supabase
      .from('lead_remarks')
      .insert([{
        lead_id: selectedLeadForRemarks.id,
        remark: newRemark.trim(),
        created_by_email: currentUserEmail
      }]);

    if (error) {
      alert(error.message);
    } else {
      setNewRemark('');
      await fetchRemarks(selectedLeadForRemarks.id);
    }
    setSavingRemark(false);
  };

  /**
   * Open remarks modal for a lead
   */
  const openRemarksModal = (lead: Lead) => {
    setSelectedLeadForRemarks(lead);
    setShowRemarksModal(true);
    fetchRemarks(lead.id);
  };

  const handleConvert = (lead: Lead) => {
    setSelectedLeadForEnroll(lead);
    setShowEnrollModal(true);
  };

  /**
   * Navigate to Students page with lead data for enrollment
   * Pre-fills student form with lead information
   * 
   * @param enrollmentType - Type of enrollment (course, consultancy, or test)
   */
  const proceedWithEnrollment = (enrollmentType: 'course' | 'consultancy' | 'test') => {
    if (!selectedLeadForEnroll) return;

    // Build URL parameters with lead data
    const params = new URLSearchParams();
    params.set('from_lead', '1');
    params.set('lead_id', String(selectedLeadForEnroll.id));
    params.set('enrollment_type', enrollmentType);
    if (selectedLeadForEnroll.full_name) params.set('full_name', selectedLeadForEnroll.full_name);
    if (selectedLeadForEnroll.father_name) params.set('father_name', selectedLeadForEnroll.father_name);
    if (selectedLeadForEnroll.cnic) params.set('cnic', selectedLeadForEnroll.cnic);
    if (selectedLeadForEnroll.email) params.set('email', selectedLeadForEnroll.email);
    if (selectedLeadForEnroll.phone) params.set('phone', selectedLeadForEnroll.phone);
    if (selectedLeadForEnroll.city) params.set('city', selectedLeadForEnroll.city);
    if (selectedLeadForEnroll.dob) params.set('dob', selectedLeadForEnroll.dob);
    if (selectedLeadForEnroll.service_name) params.set('service', selectedLeadForEnroll.service_name);

    setShowEnrollModal(false);
    setSelectedLeadForEnroll(null);
    navigate(`/students?${params.toString()}`);
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Dynamically import xlsx
      const XLSX = await import('xlsx');

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws) as any[];

          if (data.length === 0) {
            alert('Excel file is empty');
            setUploading(false);
            return;
          }

          // Map Excel columns to database fields
          const leads = data.map((row: any) => ({
            full_name: row['Full Name'] || row['full_name'] || '',
            father_name: row['Father Name'] || row['father_name'] || '',
            cnic: String(row['CNIC'] || row['cnic'] || '').replace(/[^0-9]/g, ''),
            phone: String(row['Phone'] || row['phone'] || ''),
            email: row['Email'] || row['email'] || '',
            city: row['City'] || row['city'] || null,
            service_name: row['Service'] || row['service'] || null,
            source: row['Source'] || row['source'] || null,
            branch: currentBranch || null,
            status: 'new' as LeadStatus,
            stage: 'Entry stage',
            assigned_to_email: currentUserEmail || null,
            lead_date: new Date().toISOString().slice(0, 10),
          }));

          // Validate required fields
          const invalid = leads.filter(l => !l.full_name || !l.father_name || !l.cnic || !l.phone || !l.email);
          if (invalid.length > 0) {
            alert(`${invalid.length} rows have missing required fields (Full Name, Father Name, CNIC, Phone, Email)`);
            setUploading(false);
            return;
          }

          // Bulk insert
          const { error } = await supabase.from('leads').insert(leads);
          if (error) throw error;

          alert(`Successfully imported ${leads.length} leads`);
          setShowUploadModal(false);
          await loadLeads();
        } catch (err: any) {
          alert(err?.message || 'Failed to process Excel file');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      alert(err?.message || 'Failed to upload file');
      setUploading(false);
    }
  };

  return (
    <main className="w-full min-h-screen bg-background-main flex">
      <Helmet><title>Leads | GSL Pakistan CRM</title></Helmet>
      <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
      <div className="flex-1 flex flex-col">
        <Header />
        <section className="px-4 sm:px-6 lg:px-8 mt-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Leads</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-green-600 text-white hover:bg-green-700"
              >
                📊 Upload Excel
              </button>
              <div className="bg-white rounded-full p-1 shadow flex">
                <button onClick={() => setTab('add')} className={`px-4 py-2 rounded-full text-sm font-semibold ${tab === 'add' ? 'bg-[#ffa332] text-white' : 'text-text-secondary'}`}>Add Lead</button>
                <button onClick={() => setTab('list')} className={`px-4 py-2 rounded-full text-sm font-semibold ${tab === 'list' ? 'bg-[#ffa332] text-white' : 'text-text-secondary'}`}>All Leads</button>
              </div>
            </div>
          </div>

          {tab === 'add' && (
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <form onSubmit={onSubmit} className="lg:col-span-2 bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a] text-sm">
                <h3 className="font-bold text-lg">Program Information</h3>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-sm"><span className="text-text-secondary">Service</span>
                    <select
                      value={form.service_name}
                      onChange={e => setForm({ ...form, service_name: e.target.value })}
                      className="mt-1 w-full border rounded p-2"
                      required
                    >
                      <option value="">Select Service</option>
                      {services.map(sv => (
                        <option key={sv.id} value={sv.name}>{sv.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm"><span className="text-text-secondary">Batch No. (auto)</span>
                    <input
                      value="Auto on enrollment"
                      readOnly
                      className="mt-1 w-full border rounded p-2 bg-gray-50 text-gray-500"
                    />
                  </label>
                </div>

                <h3 className="mt-6 font-bold text-lg">Personal Details</h3>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-sm sm:col-span-2"><span className="text-text-secondary">Full Name (CAPITAL)</span><input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value.toUpperCase() })} className="mt-1 w-full border rounded p-2" required /></label>
                  <label className="text-sm sm:col-span-2"><span className="text-text-secondary">Father/Guardian Name</span><input value={form.father_name} onChange={e => setForm({ ...form, father_name: e.target.value })} className="mt-1 w-full border rounded p-2" required /></label>
                  <label className="text-sm"><span className="text-text-secondary">Phone</span><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full border rounded p-2" required /></label>
                  <label className="text-sm"><span className="text-text-secondary">Email</span><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="mt-1 w-full border rounded p-2" required /></label>
                  <label className="text-sm"><span className="text-text-secondary">ID Type</span><select value={form.id_type || 'cnic'} onChange={e => setForm({ ...form, id_type: e.target.value as 'cnic' | 'passport' })} className="mt-1 w-full border rounded p-2"><option value="cnic">CNIC</option><option value="passport">Passport</option></select></label>
                  <label className="text-sm"><span className="text-text-secondary">{form.id_type === 'passport' ? 'Passport Number' : 'CNIC No.'}</span><input value={form.cnic} onChange={e => setForm({ ...form, cnic: e.target.value.replace(form.id_type === 'passport' ? /[^0-9A-Za-z]/g : /[^0-9]/g, '') })} className="mt-1 w-full border rounded p-2" placeholder={form.id_type === 'passport' ? 'Passport number' : '13 digits'} required /></label>
                  <label className="text-sm"><span className="text-text-secondary">Date of Birth</span><input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
                  <label className="text-sm"><span className="text-text-secondary">City</span><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
                  <label className="text-sm sm:col-span-2"><span className="text-text-secondary">Address (optional)</span><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
                </div>

                <h3 className="mt-6 font-bold text-lg">Lead Info</h3>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-sm"><span className="text-text-secondary">Source</span>
                    <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value as LeadSource })} className="mt-1 w-full border rounded p-2">
                      <option value="">Select Source</option>
                      <option value="facebook">Facebook</option>
                      <option value="instagram">Instagram</option>
                      <option value="google_form">Google Form</option>
                      <option value="walk_in">Walk-in</option>
                      <option value="referral">Referral</option>
                      <option value="organic">Organic</option>
                    </select>
                  </label>
                  <label className="text-sm"><span className="text-text-secondary">Status</span>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as LeadStatus })} className="mt-1 w-full border rounded p-2">
                      <option value="new">New</option>
                      <option value="documentation">Documentation</option>
                      <option value="university">University</option>
                      <option value="visa">Visa</option>
                      <option value="enrolled">Enrolled</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </label>
                  <label className="sm:col-span-2 text-sm"><span className="text-text-secondary">Assigned To (email)</span><input value={form.assigned_to_email} onChange={e => setForm({ ...form, assigned_to_email: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
                  <label className="sm:col-span-2 text-sm"><span className="text-text-secondary">Tags (comma separated)</span><input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
                </div>

                <h3 className="mt-6 font-bold text-lg">Terms & Conditions</h3>
                <div className="mt-2 space-y-2 text-sm">
                  {[
                    'Institute reserves the right to change the date or schedule.',
                    'Permission for recording/exposure in front of the camera.',
                    'Attendance must be 90%.',
                    'Course fee payable before classes commence.',
                    'Tuition fee is non-refundable.',
                  ].map((t, i) => (
                    <label key={i} className="flex items-start gap-2"><input type="checkbox" checked={agreeAll} onChange={(e) => setAgreeAll(e.target.checked)} className="mt-1" /><span>{t}</span></label>
                  ))}
                </div>

                <h3 className="mt-6 font-bold text-lg">Declaration</h3>
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={declTextAgree} onChange={(e) => setDeclTextAgree(e.target.checked)} className="mt-1" /><span>I declare that I have read and agree with the above rules and regulations. I affirm that the above information is correct to the best of my knowledge. If I violate rules, the institute reserves the right to expel me.</span></label>

                <div className="mt-6 text-right">
                  <button type="submit" disabled={saving} className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold disabled:opacity-60">{saving ? 'Saving...' : 'Save Lead'}</button>
                </div>
              </form>

              <aside className="bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a] flex flex-col justify-between text-sm">
                <div>
                  <h3 className="font-bold text-lg">Lead Summary</h3>
                  <p className="mt-2 text-text-secondary">Fill in the lead details on the left. Once saved, you can enroll the lead directly into Students.</p>
                  <div className="mt-3 text-xs text-text-secondary space-y-1">
                    <div><span className="font-semibold">Branch:</span> {form.branch || currentBranch || '—'}</div>
                    <div><span className="font-semibold">Date:</span> {form.date}</div>
                  </div>
                  {recentLead && (
                    <div className="mt-4 border-t pt-4">
                      <div className="text-sm font-semibold">Last Lead Saved</div>
                      <div className="mt-1 text-xs text-text-secondary">{recentLead.full_name} · {recentLead.email} · {recentLead.phone}</div>
                      <button
                        type="button"
                        onClick={() => handleConvert(recentLead)}
                        className="mt-3 inline-flex items-center px-3 py-2 rounded bg-[#ffa332] text-white font-semibold text-xs"
                      >
                        Enroll Lead in Students
                      </button>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          )}

          {tab === 'list' && (
            <div className="mt-6 bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a]">
              <div className="flex flex-wrap items-center gap-3 justify-between text-sm">
                <div className="flex items-center gap-2">
                  <input placeholder="Search by name, email, phone" value={search} onChange={e => setSearch(e.target.value)} className="border rounded p-2 w-64" />
                  <select value={stageF} onChange={e => setStageF(e.target.value)} className="border rounded p-2">
                    <option value="All">All Stages</option>
                    <option value="Entry stage">Entry stage</option>
                    <option value="Initial Stage">Initial Stage</option>
                    <option value="Follow up">Follow up</option>
                    <option value="Near to Confirm">Near to Confirm</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Case lose">Case lose</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-text-secondary">Filter by Date:</label>
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={e => setDateFilter(e.target.value)}
                      className="border rounded p-2"
                    />
                    {dateFilter && (
                      <button
                        onClick={() => setDateFilter('')}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                {loading && <div className="text-xs text-text-secondary">Loading...</div>}
              </div>
              <div className="mt-4 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-text-secondary">
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Phone</th>
                      <th className="text-left p-2">Source</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Stage</th>
                      <th className="text-left p-2">Date Added</th>
                      <th className="text-left p-2">Remarks</th>
                      <th className="text-right p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(l => (
                      <tr key={l.id} className="border-t">
                        <td className="p-2">{l.full_name || '—'}</td>
                        <td className="p-2">{l.email || '—'}</td>
                        <td className="p-2">{l.phone || '—'}</td>
                        <td className="p-2 capitalize">{l.source || '—'}</td>
                        <td className="p-2 capitalize">{l.status}</td>
                        <td className="p-2">
                          <select
                            value={l.stage || 'Entry stage'}
                            onChange={(e) => updateStage(l, e.target.value)}
                            className="border rounded p-1 text-sm w-full"
                          >
                            <option value="Entry stage">Entry stage</option>
                            <option value="Initial Stage">Initial Stage</option>
                            <option value="Follow up">Follow up</option>
                            <option value="Near to Confirm">Near to Confirm</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="Case lose">Case lose</option>
                          </select>
                        </td>
                        <td className="p-2">
                          {l.lead_date ? new Date(l.lead_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="p-2">
                          <button
                            onClick={() => openRemarksModal(l)}
                            className="px-3 py-1 text-xs border rounded hover:bg-gray-50 flex items-center gap-1"
                          >
                            💬 View/Add
                          </button>
                        </td>
                        <td className="p-2 text-right space-x-2">
                          {l.status !== 'confirmed' && (
                            <button onClick={() => updateStatus(l, 'confirmed')} className="text-green-700 hover:underline">Mark Confirmed</button>
                          )}
                          <button onClick={() => handleConvert(l)} className="text-blue-600 hover:underline">Enroll Lead in Students</button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td className="p-3 text-text-secondary" colSpan={9}>No leads found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Enrollment Type Selection Modal */}
        {showEnrollModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
              <h2 className="text-xl font-bold mb-4">Select Enrollment Type</h2>
              <p className="text-sm text-text-secondary mb-6">
                Choose the type of enrollment for {selectedLeadForEnroll?.full_name}:
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => proceedWithEnrollment('course')}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-[#ffa332] hover:bg-orange-50 transition-colors text-left"
                >
                  <div className="font-semibold">Course Enrollment</div>
                  <div className="text-xs text-text-secondary mt-1">Enroll student in a course program</div>
                </button>
                <button
                  onClick={() => proceedWithEnrollment('consultancy')}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-[#ffa332] hover:bg-orange-50 transition-colors text-left"
                >
                  <div className="font-semibold">Consultancy</div>
                  <div className="text-xs text-text-secondary mt-1">Enroll for consultancy services</div>
                </button>
                <button
                  onClick={() => proceedWithEnrollment('test')}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-[#ffa332] hover:bg-orange-50 transition-colors text-left"
                >
                  <div className="font-semibold">Test Preparation</div>
                  <div className="text-xs text-text-secondary mt-1">Enroll for test preparation program</div>
                </button>
              </div>
              <button
                onClick={() => {
                  setShowEnrollModal(false);
                  setSelectedLeadForEnroll(null);
                }}
                className="mt-6 w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Excel Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
              <h2 className="text-xl font-bold mb-4">Upload Excel File</h2>
              <p className="text-sm text-text-secondary mb-4">
                Upload an Excel file (.xlsx, .xls) with the following columns:
              </p>
              <div className="text-xs bg-gray-50 p-3 rounded mb-4 space-y-1">
                <div><strong>Required:</strong> Full Name, Father Name, CNIC, Phone, Email</div>
                <div><strong>Optional:</strong> City, Service, Source</div>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                disabled={uploading}
                className="w-full border rounded p-2 mb-4"
              />
              {uploading && (
                <div className="text-sm text-center text-text-secondary mb-4">
                  Processing file...
                </div>
              )}
              <button
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {/* Remarks History Modal */}
        {showRemarksModal && selectedLeadForRemarks && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Remarks for {selectedLeadForRemarks.full_name}</h2>
                <button
                  onClick={() => {
                    setShowRemarksModal(false);
                    setSelectedLeadForRemarks(null);
                    setRemarks([]);
                    setNewRemark('');
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Remarks History */}
              <div className="flex-1 overflow-y-auto mb-4 border rounded p-3 bg-gray-50">
                {loadingRemarks ? (
                  <div className="text-center text-text-secondary py-4">Loading remarks...</div>
                ) : remarks.length === 0 ? (
                  <div className="text-center text-text-secondary py-4">No remarks yet. Add one below!</div>
                ) : (
                  <div className="space-y-3">
                    {remarks.map((remark) => (
                      <div key={remark.id} className="bg-white rounded p-3 shadow-sm">
                        <div className="text-sm text-gray-900">{remark.remark}</div>
                        <div className="mt-2 flex items-center gap-3 text-xs text-text-secondary">
                          <span>👤 {remark.created_by_email}</span>
                          <span>•</span>
                          <span>🕒 {new Date(remark.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Remark */}
              <div className="border-t pt-4">
                <label className="block text-sm font-semibold mb-2">Add New Remark</label>
                <textarea
                  value={newRemark}
                  onChange={(e) => setNewRemark(e.target.value)}
                  placeholder="Type your remark here..."
                  className="w-full border rounded p-2 text-sm resize-none"
                  rows={3}
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowRemarksModal(false);
                      setSelectedLeadForRemarks(null);
                      setRemarks([]);
                      setNewRemark('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Close
                  </button>
                  <button
                    onClick={addRemark}
                    disabled={savingRemark || !newRemark.trim()}
                    className="px-4 py-2 bg-[#ffa332] text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingRemark ? 'Saving...' : 'Add Remark'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default LeadsPage;
