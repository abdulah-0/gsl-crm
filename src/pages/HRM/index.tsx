/**
 * @fileoverview HRM (Human Resource Management) Page
 * 
 * Comprehensive HR management system for the GSL CRM.
 * Manages employee lifecycle, leaves, time tracking, payroll, and assets.
 * 
 * **Key Features:**
 * - **Employees Tab:** Employee directory with branch filtering
 * - **Onboarding Tab:** Candidate onboarding workflow with secure tokens
 * - **Leaves Tab:** Leave management with multi-stage approval (Manager → HR → CEO)
 * - **Time Records Tab:** Employee attendance and overtime tracking
 * - **Payroll Tab:** Automated payroll generation with salary breakdowns
 * - **Assets Tab:** Company asset issuance and tracking
 * 
 * **Leave Management:**
 * - Leave types: CL (Casual Leave), SL (Sick Leave), AL (Annual Leave)
 * - Multi-stage approval workflow
 * - Leave balance tracking per employee
 * - Real-time updates via Supabase
 * 
 * **Payroll System:**
 * - Automated batch generation
 * - Salary components: Basic, Allowances, Deductions
 * - PDF payslip generation
 * - Monthly batch processing
 * 
 * **Access Control:**
 * - Super Admin: Full access to all modules
 * - Admin: CRUD operations within branch
 * - HR: Leave and payroll management
 * - Other roles: View-only access
 * 
 * @module pages/HRM
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';


// Simple role type
type Role = 'super' | 'admin' | 'other';

// Dashboard user shape (extend later as schema evolves)
interface EmpRow {
  id?: string;
  email: string;
  full_name?: string | null;
  role?: string | null;
  department?: string | null;
  designation?: string | null;
  joining_date?: string | null; // ISO date
  status?: string | null; // Active/Inactive, etc
  branch?: string | null;
}

const HRMPage: React.FC = () => {
  const [myRoleText, setMyRoleText] = useState<string>('');

  const [role, setRole] = useState<Role>('other');
  const [myBranch, setMyBranch] = useState<string | null>(null);
  const isAdmin = role === 'super' || role === 'admin';
  const isSuper = role === 'super';
  const isHR = React.useMemo(() => (myRoleText?.includes('hr') || role === 'admin' || role === 'super'), [myRoleText, role]);


  // Sub-tabs
  const [tab, setTab] = useState<'onboarding' | 'employees' | 'leaves' | 'timerecord' | 'payroll' | 'assets'>('employees');

  // Employees state
  const [rows, setRows] = useState<EmpRow[]>([]);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  // Excel upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  // HRM -> Leaves management state
  interface LeaveRow {
    id: number;
    employee_email: string;
    type: string | null;
    leave_type?: string | null;
    start_date: string | null;
    end_date: string | null;
    status: string | null;
    reason?: string | null;
    branch?: string | null;
    created_at?: string | null;
  }
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [lEmail, setLEmail] = useState('');
  const [lType, setLType] = useState('');
  const [lStatus, setLStatus] = useState<string>('Pending');
  const [lFrom, setLFrom] = useState('');
  const [lTo, setLTo] = useState('');

  // HRM -> Leaves: Add Leave modal state
  const [addLeaveOpen, setAddLeaveOpen] = useState(false);
  const [addForEmail, setAddForEmail] = useState('');
  const [addType, setAddType] = useState<'CL' | 'SL' | 'AL'>('CL');
  const [addStart, setAddStart] = useState('');
  const [addEnd, setAddEnd] = useState('');
  const [addReason, setAddReason] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);
  // Autocomplete for selecting employee in branch scope
  const [showAddSuggest, setShowAddSuggest] = useState(false);
  const addSuggestRef = React.useRef<HTMLDivElement | null>(null);
  const addSuggestions = useMemo(() => {
    const q = addForEmail.trim().toLowerCase();
    if (!q) return [] as EmpRow[];
    return rows
      .filter(r => ((r.full_name || r.email || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q)))
      .slice(0, 8);
  }, [rows, addForEmail]);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!addSuggestRef.current) return;
      if (!addSuggestRef.current.contains(e.target as Node)) setShowAddSuggest(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  interface LeaveBalance {
    employee_email: string;
    cl_entitlement?: number | null;
    sl_entitlement?: number | null;
    al_entitlement?: number | null;
    cl_availed?: number | null;
    sl_availed?: number | null;
    al_availed?: number | null;
    branch?: string | null;
  }
  const [lb, setLb] = useState<LeaveBalance | null>(null);


  // Load leave balances for selected employee (if any)
  useEffect(() => {
    const run = async () => {
      const em = lEmail.trim();
      if (!(tab === 'leaves' && em)) { setLb(null); return; }
      let qb: any = supabase
        .from('employee_leave_balances')
        .select('employee_email, cl_entitlement, sl_entitlement, al_entitlement, cl_availed, sl_availed, al_availed, branch')
        .eq('employee_email', em)
        .maybeSingle();
      if (role !== 'super') qb = qb.eq('branch', myBranch);
      const { data } = await qb;
      setLb((data as any) || null);
    };
    run();
  }, [tab, lEmail, role, myBranch]);

  // HRM -> Time Record state
  interface TimeRecordRow {
    id: number;
    employee_email: string;
    work_date: string;
    check_in: string | null;
    check_out: string | null;
    hours: number | null;
    overtime: number | null;
    branch?: string | null;
  }
  const [trs, setTrs] = useState<TimeRecordRow[]>([]);
  const [tEmail, setTEmail] = useState('');
  const [tFrom, setTFrom] = useState('');
  const [tTo, setTTo] = useState('');

  // Onboarding state
  interface OnbRow {
    id: number;
    secure_token: string | null;
    status: string | null;
    candidate_email: string;
    branch?: string | null;
    created_by?: string | null;
    created_at?: string | null;
    full_name?: string | null;
    designation?: string | null;
    reporting_manager_email?: string | null;
    work_email?: string | null;
    attachments?: any;
  }
  const [onbs, setOnbs] = useState<OnbRow[]>([]);
  const [newOnbEmail, setNewOnbEmail] = useState('');
  const loadOnboardings = async () => {
    let q = supabase
      .from('employee_onboardings')
      .select('id, secure_token, status, candidate_email, branch, created_by, created_at, full_name, designation, reporting_manager_email, work_email, attachments')
      .order('created_at', { ascending: false })
      .limit(500);
    if (role !== 'super') q = q.eq('branch', myBranch);
    const { data } = await q as any;
    setOnbs(data || []);
  };
  useEffect(() => { if (tab === 'onboarding' && (role === 'super' || myBranch !== null)) loadOnboardings(); }, [tab, role, myBranch]);
  const randToken = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const createOnboarding = async () => {
    if (!isAdmin) return;
    const emailTrim = newOnbEmail.trim();
    if (!emailTrim) return alert('Enter candidate email');
    const { data: au } = await supabase.auth.getUser();
    const me = au?.user?.email || '';
    const token = randToken();
    const payload: any = { candidate_email: emailTrim, created_by: me, secure_token: token, status: 'Initiated', branch: role === 'super' ? null : myBranch };
    const { error } = await supabase.from('employee_onboardings').insert(payload);
    if (error) return alert(error.message);
    await supabase.from('activity_log').insert([{ entity: 'employee_onboarding', entity_id: String(token), action: `Onboarding initiated`, detail: { candidate_email: emailTrim, token, initiated_by: me, branch: payload.branch } }]);
    setNewOnbEmail('');
    await loadOnboardings();
    alert('Onboarding link generated: ' + window.location.origin + '/onboard?token=' + token);
  };
  const approveOnboarding = async (row: OnbRow) => {
    if (!isAdmin) return;
    const { data: au } = await supabase.auth.getUser();
    const me = au?.user?.email || '';
    const master: any = {
      email: row.candidate_email,
      full_name: row.full_name,
      designation: row.designation,
      reporting_manager_email: row.reporting_manager_email,
      work_email: row.work_email,
      branch: role === 'super' ? null : myBranch,
      attachments: row.attachments || null,
      updated_by: me,
    };
    const { error: mErr } = await supabase.from('employees_master').upsert(master, { onConflict: 'email' } as any);
    if (mErr) return alert(mErr.message);
    await supabase.from('employee_leave_balances').upsert({ employee_email: row.candidate_email, branch: role === 'super' ? null : myBranch }, { onConflict: 'employee_email' } as any);
    const { error: uErr } = await supabase.from('employee_onboardings').update({ status: 'Approved', approved_by: me, approved_at: new Date().toISOString() }).eq('id', row.id);
    if (uErr) return alert(uErr.message);
    await supabase.from('activity_log').insert([{ entity: 'employee_onboarding', entity_id: String(row.id), action: `Onboarding approved`, detail: { candidate_email: row.candidate_email, approved_by: me } }]);
    await loadOnboardings();
  };

  // Assets state
  interface AssetRow {
    id: number;
    asset_id?: string | null;
    employee_email: string;
    asset_category?: string | null;
    asset_name?: string | null;
    brand_model?: string | null;
    serial_imei?: string | null;
    quantity?: number | null;
    issued_date?: string | null;
    issued_by?: string | null;
    condition_at_issuance?: string | null;
    return_status?: string | null;
    actual_return_date?: string | null;
    condition_on_return?: string | null;
    remarks?: string | null;
    approved_by?: string | null;
    acknowledgement?: boolean | null;
    branch?: string | null;
  }
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [editAsset, setEditAsset] = useState<AssetRow | null>(null);
  const loadAssets = async () => {
    let q = supabase
      .from('employee_assets')
      .select('id, asset_id, employee_email, asset_category, asset_name, brand_model, serial_imei, quantity, issued_date, issued_by, condition_at_issuance, return_status, actual_return_date, condition_on_return, remarks, approved_by, acknowledgement, branch')
      .order('issued_date', { ascending: false })
      .limit(500);
    if (role !== 'super') q = q.eq('branch', myBranch);
    const { data } = await q as any;
    setAssets(data || []);
  };
  useEffect(() => { if (tab === 'assets' && (role === 'super' || myBranch !== null)) loadAssets(); }, [tab, role, myBranch]);
  const openAddAsset = () => {
    setEditAsset({ id: 0 as any, employee_email: '', asset_category: '', asset_name: '', brand_model: '', serial_imei: '', quantity: 1, issued_date: new Date().toISOString().slice(0, 10), issued_by: '', condition_at_issuance: '', return_status: 'Issued', remarks: '', acknowledgement: false, branch: myBranch || null });
    setShowAssetModal(true);
  };
  const saveAsset = async () => {
    if (!isAdmin || !editAsset) { setShowAssetModal(false); return; }
    const payload: any = { ...editAsset };
    payload.branch = role === 'super' ? (editAsset.branch || null) : (myBranch || null);
    if (editAsset.id && editAsset.id !== 0) {
      const { error } = await supabase.from('employee_assets').update(payload).eq('id', editAsset.id);
      if (error) return alert(error.message);
      await supabase.from('activity_log').insert([{ entity: 'employee_asset', entity_id: String(editAsset.id), action: 'Updated asset', detail: { employee_email: editAsset.employee_email, asset_name: editAsset.asset_name, serial_imei: editAsset.serial_imei } }]);
    } else {
      delete payload.id;
      const { data: ins, error } = await supabase.from('employee_assets').insert(payload).select('id').single();
      if (error) return alert(error.message);
      await supabase.from('activity_log').insert([{ entity: 'employee_asset', entity_id: String((ins as any)?.id || 'new'), action: 'Issued asset', detail: { employee_email: editAsset.employee_email, asset_name: editAsset.asset_name, serial_imei: editAsset.serial_imei } }]);
    }
    setShowAssetModal(false); setEditAsset(null); await loadAssets();
  };
  const deleteAsset = async (id: number) => {
    if (!isAdmin) return;
    if (!confirm('Delete this asset?')) return;
    const { error } = await supabase.from('employee_assets').delete().eq('id', id);
    if (error) alert(error.message); else { await supabase.from('activity_log').insert([{ entity: 'employee_asset', entity_id: String(id), action: 'Deleted asset', detail: { id } }]); loadAssets(); }
  };

  const loadTimeRecords = async () => {
    let q = supabase
      .from('time_records')
      .select('id, employee_email, work_date, check_in, check_out, hours, overtime, branch')
      .order('work_date', { ascending: false })
      .limit(500);
    if (role !== 'super') q = q.eq('branch', myBranch);
    if (tEmail) q = q.ilike('employee_email', `%${tEmail}%`);
    if (tFrom) q = q.gte('work_date', tFrom);
    if (tTo) q = q.lte('work_date', tTo);
    const { data } = await q;
    setTrs((data as any) || []);
  };
  useEffect(() => { if (tab === 'timerecord' && (role === 'super' || myBranch !== null)) loadTimeRecords(); }, [tab, role, myBranch, tEmail, tFrom, tTo]);

  // Add/Edit modal
  const [showTRModal, setShowTRModal] = useState(false);
  const [editTR, setEditTR] = useState<TimeRecordRow | null>(null);
  const openAddTR = () => { setEditTR({ id: 0, employee_email: '', work_date: new Date().toISOString().slice(0, 10), check_in: null, check_out: null, hours: null, overtime: null, branch: myBranch || null }); setShowTRModal(true); };
  const openEditTR = (r: TimeRecordRow) => { setEditTR(r); setShowTRModal(true); };
  const saveTR = async () => {
    if (!isAdmin || !editTR) { setShowTRModal(false); return; }
    const payload: any = {
      employee_email: editTR.employee_email,
      work_date: editTR.work_date,
      check_in: editTR.check_in || null,
      check_out: editTR.check_out || null,
      hours: editTR.hours,
      overtime: editTR.overtime,
      branch: role === 'super' ? (editTR.branch || null) : (myBranch || null),
    };
    if (editTR.id && editTR.id !== 0) {
      const { error } = await supabase.from('time_records').update(payload).eq('id', editTR.id);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from('time_records').insert(payload);
      if (error) return alert(error.message);
    }
    setShowTRModal(false); setEditTR(null); await loadTimeRecords();
  };
  const deleteTR = async (id: number) => {
    if (!isAdmin) return;
    if (!confirm('Delete this record?')) return;
    const { error } = await supabase.from('time_records').delete().eq('id', id);
    if (error) alert(error.message); else loadTimeRecords();
  };
  // Payroll state
  interface PayrollBatch { id: number; year: number; month: number; branch?: string | null; created_at?: string | null; }
  interface PayrollItem { id: number; batch_id: number; employee_email: string; payable_amount: number | null; details?: any; }
  const [payrollBatches, setPayrollBatches] = useState<PayrollBatch[]>([]);
  const [batchItems, setBatchItems] = useState<PayrollItem[]>([]);
  const [pyMonth, setPyMonth] = useState<number>(new Date().getMonth() + 1);
  const [pyYear, setPyYear] = useState<number>(new Date().getFullYear());
  const [activeBatchId, setActiveBatchId] = useState<number | null>(null);

  const loadBatches = async () => {
    let q = supabase.from('payroll_batches').select('id, year, month, branch, created_at').order('created_at', { ascending: false });
    if (role !== 'super') q = q.eq('branch', myBranch);
    const { data } = await q as any;
    setPayrollBatches(data || []);
  };
  const loadBatchItems = async (batchId: number) => {
    const { data } = await supabase.from('payroll_items').select('id, batch_id, employee_email, payable_amount, details').eq('batch_id', batchId).order('employee_email', { ascending: true });
    setBatchItems((data as any) || []);
  };
  useEffect(() => { if (tab === 'payroll' && (role === 'super' || myBranch !== null)) loadBatches(); }, [tab, role, myBranch]);

  // Payroll Master Data state
  interface PayrollMasterData {
    employee_email: string;
    std_basic: number;
    std_allowance: number;
    medical_10pct: number;
    house_rent_20pct: number;
    std_transportation_10pct: number;
    std_at_work: number;
    std_others: number;
    arrears: number;
    bonus: number;
    income_tax: number;
    life_insurance: number;
    health_insurance: number;
    employee_loan: number;
    fin_pn: number;
    advance_salary: number;
    esb: number;
    other_deduction: number;
  }
  const [showPayrollMasterModal, setShowPayrollMasterModal] = useState(false);
  const [editPayrollMaster, setEditPayrollMaster] = useState<PayrollMasterData | null>(null);
  const [payrollMasterList, setPayrollMasterList] = useState<PayrollMasterData[]>([]);

  const loadPayrollMasterData = async () => {
    let q = supabase.from('employees_master_payroll').select('*');
    if (role !== 'super') q = q.eq('branch', myBranch);
    const { data } = await q as any;
    setPayrollMasterList(data || []);
  };

  const openEditPayrollMaster = async (email: string) => {
    const { data } = await supabase.from('employees_master_payroll').select('*').eq('employee_email', email).maybeSingle();
    if (data) {
      setEditPayrollMaster(data as any);
    } else {
      // Create default entry
      setEditPayrollMaster({
        employee_email: email,
        std_basic: 0, std_allowance: 0, medical_10pct: 0, house_rent_20pct: 0,
        std_transportation_10pct: 0, std_at_work: 0, std_others: 0, arrears: 0, bonus: 0,
        income_tax: 0, life_insurance: 0, health_insurance: 0, employee_loan: 0,
        fin_pn: 0, advance_salary: 0, esb: 0, other_deduction: 0
      });
    }
    setShowPayrollMasterModal(true);
  };

  const savePayrollMaster = async () => {
    if (!isAdmin || !editPayrollMaster) return;
    const { error } = await supabase.from('employees_master_payroll').upsert(editPayrollMaster, { onConflict: 'employee_email' } as any);
    if (error) { alert(error.message); return; }
    setShowPayrollMasterModal(false);
    setEditPayrollMaster(null);
    await loadPayrollMasterData();
    alert('Payroll master data saved successfully');
  };

  const generatePayroll = async () => {
    if (!isAdmin) return;
    // 1) Create batch
    const batchPayload: any = { year: pyYear, month: pyMonth, branch: role === 'super' ? null : myBranch };
    const { data: batch, error: bErr } = await supabase.from('payroll_batches').insert(batchPayload).select().single();
    if (bErr) return alert(bErr.message);
    // 2) gather employees in scope
    let eQ = supabase.from('dashboard_users').select('email, full_name, branch');
    if (role !== 'super') eQ = eQ.eq('branch', myBranch);
    const { data: emps, error: eErr } = await eQ as any;
    if (eErr) { alert(eErr.message); return; }

    // 3) Load enhanced payroll master data for employees
    let mQ = supabase.from('employees_master_payroll').select('*');
    if (role !== 'super') mQ = mQ.eq('branch', myBranch);
    const { data: masters } = await mQ as any;
    const mByEmail: Record<string, any> = {};
    for (const m of (masters || [])) mByEmail[m.email || m.employee_email] = m;

    // 4) For each employee, compute payroll using enhanced master fields
    for (const emp of (emps || [])) {
      const m = mByEmail[emp.email] || {};
      const n = (v: any) => Number(v || 0);

      // Allowances
      const std_basic = n(m.std_basic);
      const std_allowance = n(m.std_allowance);
      const medical_10pct = n(m.medical_10pct);
      const house_rent_20pct = n(m.house_rent_20pct);
      const std_transportation_10pct = n(m.std_transportation_10pct);
      const std_at_work = n(m.std_at_work);
      const std_others = n(m.std_others);
      const arrears = n(m.arrears);
      const bonus = n(m.bonus);

      const total_gross = std_basic + std_allowance + medical_10pct + house_rent_20pct +
        std_transportation_10pct + std_at_work + std_others + arrears + bonus;

      // Deductions
      const income_tax = n(m.income_tax);
      const life_insurance = n(m.life_insurance);
      const health_insurance = n(m.health_insurance);
      const employee_loan = n(m.employee_loan);
      const fin_pn = n(m.fin_pn);
      const advance_salary = n(m.advance_salary);
      const esb = n(m.esb);
      const other_deduction = n(m.other_deduction);

      const total_deduction = income_tax + life_insurance + health_insurance + employee_loan +
        fin_pn + advance_salary + esb + other_deduction;

      const net_salary = Math.round(total_gross - total_deduction);

      const details = {
        month: pyMonth,
        year: pyYear,
        employee_name: emp.full_name || emp.email,
        allowances: {
          std_basic, std_allowance, medical_10pct, house_rent_20pct,
          std_transportation_10pct, std_at_work, std_others, arrears, bonus
        },
        deductions: {
          income_tax, life_insurance, health_insurance, employee_loan,
          fin_pn, advance_salary, esb, other_deduction
        },
        total_gross,
        total_deduction,
        net_salary
      };

      await supabase.from('payroll_items').insert({
        batch_id: (batch as any).id,
        employee_email: emp.email,
        payable_amount: net_salary,
        details
      });
    }
    alert(`Payroll generated for ${(emps || []).length} employees`);
    await loadBatches();
  };

  const printPayslip = async (item: PayrollItem) => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const details = item.details || {};
      const allowances = details.allowances || {};
      const deductions = details.deductions || {};

      // Company header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Gateway Study Links (SMC-PVT) LTD', 148, 15, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Website: www.thegateway.pk  |  Email: accounts@thegateway.pk  |  Phone: +9251-8731234', 148, 21, { align: 'center' });

      // Main title
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthIndex = (details.month ?? 1) - 1;
      const monthName = monthNames[monthIndex] || 'Unknown';
      const year = details.year || new Date().getFullYear();
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Payslip for ${monthName} ${year}`, 148, 28, { align: 'center' });

      // Employee info
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Employee: ${details.employee_name || item.employee_email}`, 14, 36);
      doc.text(`Email: ${item.employee_email}`, 14, 42);

      // Payroll table with all components
      const fmt = (v: number | null | undefined) => (v ?? 0).toFixed(2);

      const tableData = [
        // Header row
        [
          { content: 'STD Gross', styles: { halign: 'center', fillColor: [255, 255, 255] } },
          { content: 'Allowance', colSpan: 9, styles: { halign: 'center', fillColor: [255, 255, 255] } },
          { content: 'Deduction', colSpan: 8, styles: { halign: 'center', fillColor: [255, 255, 200] } },
          { content: '', styles: { fillColor: [255, 255, 255] } },
          { content: '', styles: { fillColor: [255, 255, 255] } }
        ],
        // Column headers
        [
          'STD BASIC 60%',
          'STD Allowance',
          'Medical 10%',
          'House Rent 20%',
          'STD Transportation 10%',
          'STD At Work',
          'STD Others',
          'Arrears',
          'Bonus',
          'Total Gross',
          { content: 'Income Tax', styles: { fillColor: [255, 255, 200] } },
          { content: 'Life Insurance', styles: { fillColor: [255, 255, 200] } },
          { content: 'Health Insurance', styles: { fillColor: [255, 255, 200] } },
          { content: 'Employee Loan', styles: { fillColor: [255, 255, 200] } },
          { content: 'FIN & PN', styles: { fillColor: [255, 255, 200] } },
          { content: 'Advance Salary', styles: { fillColor: [255, 255, 200] } },
          { content: 'ESB', styles: { fillColor: [255, 255, 200] } },
          { content: 'Other Deduction', styles: { fillColor: [255, 255, 200] } },
          { content: 'Total Deduction', styles: { fillColor: [255, 255, 200] } },
          'Net Salary'
        ],
        // Data row
        [
          fmt(allowances.std_basic),
          fmt(allowances.std_allowance),
          fmt(allowances.medical_10pct),
          fmt(allowances.house_rent_20pct),
          fmt(allowances.std_transportation_10pct),
          fmt(allowances.std_at_work),
          fmt(allowances.std_others),
          fmt(allowances.arrears),
          fmt(allowances.bonus),
          { content: fmt(details.total_gross), styles: { fontStyle: 'bold' } },
          { content: fmt(deductions.income_tax), styles: { fillColor: [255, 255, 200] } },
          { content: fmt(deductions.life_insurance), styles: { fillColor: [255, 255, 200] } },
          { content: fmt(deductions.health_insurance), styles: { fillColor: [255, 255, 200] } },
          { content: fmt(deductions.employee_loan), styles: { fillColor: [255, 255, 200] } },
          { content: fmt(deductions.fin_pn), styles: { fillColor: [255, 255, 200] } },
          { content: fmt(deductions.advance_salary), styles: { fillColor: [255, 255, 200] } },
          { content: fmt(deductions.esb), styles: { fillColor: [255, 255, 200] } },
          { content: fmt(deductions.other_deduction), styles: { fillColor: [255, 255, 200] } },
          { content: fmt(details.total_deduction), styles: { fillColor: [255, 255, 200], fontStyle: 'bold' } },
          { content: fmt(details.net_salary ?? item.payable_amount), styles: { fontStyle: 'bold', fillColor: [200, 255, 200] } }
        ]
      ];

      (autoTable as any)(doc, {
        head: [],
        body: tableData,
        startY: 48,
        styles: {
          fontSize: 7,
          cellPadding: 2,
          halign: 'center',
          valign: 'middle'
        },
        headStyles: { fillColor: [255, 163, 50] },
        columnStyles: {
          9: { fontStyle: 'bold' },
          18: { fontStyle: 'bold', fillColor: [255, 255, 200] },
          19: { fontStyle: 'bold', fillColor: [200, 255, 200] }
        },
        theme: 'grid'
      });

      const footerY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(8);
      doc.text('This is a system-generated document and does not require any signature or company stamp', 148, footerY, { align: 'center' });

      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
    } catch (e) {
      console.error('Payslip PDF generation error', e);
      alert('Failed to generate payslip PDF.');
    }
  };


  const exportEmployeePDF = async (email: string) => {
    try {
      const { data: m } = await supabase
        .from('employees_master')
        .select('employee_code, full_name, email, branch, designation, reporting_manager_email, date_of_joining, basic_salary, payment_mode, personal_contact, current_address')
        .eq('email', email)
        .maybeSingle();
      const { data: a } = await supabase
        .from('employee_assets')
        .select('asset_id, asset_category, asset_name, serial_imei, issued_date, return_status')
        .eq('employee_email', email)
        .order('issued_date', { ascending: false });
      const { data: b } = await supabase
        .from('employee_leave_balances')
        .select('cl_entitlement, cl_availed, sl_entitlement, sl_availed, al_entitlement, al_availed')
        .eq('employee_email', email)
        .maybeSingle();

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Employee Profile', 14, 18);

      const head = [['Field', 'Value']];
      const body = [
        ['Employee Code', (m as any)?.employee_code || '-'],
        ['Name', (m as any)?.full_name || '-'],
        ['Email', email],
        ['Branch', (m as any)?.branch || '-'],
        ['Designation', (m as any)?.designation || '-'],
        ['Manager', (m as any)?.reporting_manager_email || '-'],
        ['Date of Joining', (m as any)?.date_of_joining || '-'],
        ['Basic Salary', String((m as any)?.basic_salary ?? 0)],
        ['Payment Mode', (m as any)?.payment_mode || '-'],
      ];
      (autoTable as any)(doc, { head, body, startY: 26, styles: { fontSize: 10 }, headStyles: { fillColor: [255, 163, 50] } });
      // @ts-ignore
      let y = (doc as any).lastAutoTable?.finalY || 26;

      if (b) {
        const head2 = [['Leave Type', 'Entitled', 'Availed', 'Balance']];
        const body2 = [
          ['CL', b.cl_entitlement || 0, b.cl_availed || 0, (b.cl_entitlement || 0) - (b.cl_availed || 0)],
          ['SL', b.sl_entitlement || 0, b.sl_availed || 0, (b.sl_entitlement || 0) - (b.sl_availed || 0)],
          ['AL', b.al_entitlement || 0, b.al_availed || 0, (b.al_entitlement || 0) - (b.al_availed || 0)],
        ];
        (autoTable as any)(doc, { head: head2, body: body2, startY: y + 6, styles: { fontSize: 9 }, headStyles: { fillColor: [255, 163, 50] } });
        // @ts-ignore
        y = (doc as any).lastAutoTable?.finalY || (y + 6);
      }

      if (Array.isArray(a) && a.length) {
        const head3 = [['Asset ID', 'Category', 'Name', 'Serial/IMEI', 'Issued', 'Status']];
        const body3 = (a as any[]).map(x => [x.asset_id || '-', x.asset_category || '-', x.asset_name || '-', x.serial_imei || '-', x.issued_date || '-', x.return_status || '-']);
        (autoTable as any)(doc, { head: head3, body: body3, startY: y + 6, styles: { fontSize: 8 }, headStyles: { fillColor: [255, 163, 50] } });
      }

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const aEl = document.createElement('a');
      aEl.href = url; aEl.download = `employee-${email}.pdf`; aEl.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Employee PDF export error', e);
      alert('Failed to generate employee PDF.');
    }
  };


  const loadLeaves = async () => {
    // Build base query
    let q: any = supabase
      .from('leaves')
      .select('id, employee_email, type, leave_type, start_date, end_date, status, reason, branch, created_at, manager_approved_by, hr_approved_by, ceo_approved_by')
      .order('created_at', { ascending: false });
    if (role !== 'super') q = q.eq('branch', myBranch);

    // Enhanced search: support name or email
    const term = (lEmail || '').trim();
    if (term) {
      if (term.includes('@')) {
        q = q.ilike('employee_email', `%${term}%`);
      } else {
        // Lookup matching emails by name/email first
        let uQ: any = supabase.from('dashboard_users').select('email');
        if (role !== 'super') uQ = uQ.eq('branch', myBranch);
        uQ = uQ.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
        const { data: us } = await uQ;
        const emails = (us || []).map((u: any) => u.email);
        if (!emails.length) { setLeaves([]); return; }
        q = q.in('employee_email', emails);
      }
    }

    if (lType) {
      const legacyType = lType === 'CL' ? 'Sick' : lType === 'SL' ? 'Remote' : 'Vacation';
      q = q.or(`leave_type.eq.${lType},type.eq.${legacyType}`);
    }
    if (lStatus) {
      // Support both legacy lowercase statuses (pending/approved/rejected) and newer capitalised ones (Pending/Approved/Rejected)
      const variants = [lStatus, lStatus.toLowerCase(), lStatus.toUpperCase()];
      q = q.in('status', variants);
    }
    if (lFrom) q = q.gte('start_date', lFrom);
    if (lTo) q = q.lte('end_date', lTo);
    const { data } = await q;
    setLeaves((data as any) || []);
  };
  // Load on filters/tab/role/branch change
  useEffect(() => { if (tab === 'leaves' && (role === 'super' || myBranch !== null)) loadLeaves(); }, [tab, role, myBranch, lEmail, lType, lStatus, lFrom, lTo]);
  // Realtime subscription to reflect inserts/updates/deletes
  useEffect(() => {
    if (tab !== 'leaves') return;
    const ch = supabase
      .channel('realtime:hrm-leaves')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, () => { loadLeaves(); })
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch { } };
  }, [tab, role, myBranch, lEmail, lType, lStatus, lFrom, lTo]);

  const approveAsManager = async (id: number) => {
    const { data: au } = await supabase.auth.getUser();
    const me = au?.user?.email || '';
    // fetch leave and employee manager
    const { data: lv } = await supabase.from('leaves').select('employee_email, manager_approved_by').eq('id', id).maybeSingle();
    if (!lv) return alert('Leave not found');
    if ((lv as any).manager_approved_by) return alert('Already approved at manager stage');
    const { data: em } = await supabase.from('employees_master').select('reporting_manager_email').eq('email', (lv as any).employee_email).maybeSingle();
    const mgr = (em as any)?.reporting_manager_email || '';
    if (!mgr || mgr.toLowerCase() !== me.toLowerCase()) return alert('You are not the reporting manager for this employee');
    const { error } = await supabase.from('leaves').update({ manager_approved_by: me, manager_approved_at: new Date().toISOString(), status: 'Pending' }).eq('id', id);
    if (error) alert(error.message); else {
      await supabase.from('activity_log').insert([{ entity: 'leave', entity_id: String(id), action: 'Manager approved', detail: { leave_id: id, approved_by: me } }]);
      loadLeaves();
    }
  };

  const approveAsHR = async (id: number) => {
    if (!isHR) return alert('Not allowed');
    const { data: au } = await supabase.auth.getUser();
    const me = au?.user?.email || '';
    const { data: lv } = await supabase.from('leaves').select('manager_approved_by, hr_approved_by').eq('id', id).maybeSingle();
    if (!(lv as any)?.manager_approved_by) return alert('Manager approval pending');
    if ((lv as any)?.hr_approved_by) return alert('Already approved at HR stage');
    const { error } = await supabase.from('leaves').update({ hr_approved_by: me, hr_approved_at: new Date().toISOString(), status: 'Pending' }).eq('id', id);
    if (error) alert(error.message); else {
      await supabase.from('activity_log').insert([{ entity: 'leave', entity_id: String(id), action: 'HR approved', detail: { leave_id: id, approved_by: me } }]);
      loadLeaves();
    }
  };

  // HRM -> Leaves: Add new leave (supports both schemas: employee_id and employee_email)
  const onAddLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) { alert('Only Admin/Super Admin can add leaves'); return; }
    const target = addForEmail.trim();
    if (!target) { alert('Please select an employee'); return; }
    if (!addStart || !addEnd) { alert('Please select start and end dates'); return; }
    setAddSubmitting(true);
    try {
      const { data: au } = await supabase.auth.getUser();
      const me = au?.user?.email || '';

      // 1) Ensure we have an employees.id for this email (legacy schema requires employee_id)
      // Avoid touching public.users due to RLS; create a lightweight employees row if none found
      let employeeId: number | null = null;
      try {
        // Best-effort: try to find an existing employees row via a heuristic is not possible (no email column)
        // So we directly create a new employees row (user_id left null; allowed by schema)
        const { data: eIns, error: eErr } = await supabase
          .from('employees')
          .insert({ joined_on: new Date().toISOString().slice(0, 10) })
          .select('id')
          .single();
        if (!eErr && eIns?.id) employeeId = Number(eIns.id);
      } catch { }

      // Common fields
      const statusInit = 'Pending';
      const reasonVal = addReason || null;
      const emp = rows.find(r => (r.email || '') === target);
      const branchVal = role !== 'super' ? (myBranch || null) : (emp?.branch || null);
      const typeLegacy = addType === 'CL' ? 'Sick' : addType === 'SL' ? 'Remote' : 'Vacation';

      // Attempt insert function with graceful fallbacks for missing columns/status case-sensitivity
      const tryInsert = async (base: any) => {
        // Try with full payload (include created_by, type/leave_type, branch when present)
        const withMeta = { ...base, created_by: me, leave_type: addType, type: typeLegacy, branch: branchVal };
        let res = await supabase.from('leaves').insert(withMeta as any, { returning: 'minimal' } as any);
        let error = res.error as any;
        if (error && (error.code === '42703' || String(error.message || '').toLowerCase().includes('column'))) {
          // Drop unknown columns and retry (created_by/type/leave_type/branch)
          const minimal = { ...base };
          let res2 = await supabase.from('leaves').insert(minimal as any, { returning: 'minimal' } as any);
          error = res2.error as any;
          if (error && (String(error.message || '').toLowerCase().includes('status') && String(error.message || '').toLowerCase().includes('check'))) {
            // Some schemas require lowercase status
            const lower = { ...minimal, status: String(minimal.status || '').toLowerCase() };
            const res3 = await supabase.from('leaves').insert(lower as any, { returning: 'minimal' } as any);
            error = res3.error as any;
          }
        } else if (error && (String(error.message || '').toLowerCase().includes('status') && String(error.message || '').toLowerCase().includes('check'))) {
          // Retry with lowercase status
          const lower = { ...base, status: String(base.status || '').toLowerCase(), created_by: me, leave_type: addType, type: typeLegacy, branch: branchVal };
          const res3 = await supabase.from('leaves').insert(lower as any, { returning: 'minimal' } as any);
          error = res3.error as any;
        }
        return error;
      };

      // 2) Prefer employee_id variant when available
      let err1: any = null;
      if (employeeId) {
        const payloadId = { employee_id: employeeId, start_date: addStart, end_date: addEnd, status: statusInit, reason: reasonVal };
        err1 = await tryInsert(payloadId);
      }

      // 3) Fallback to employee_email variant (newer schema)
      let err2: any = null;
      if (!employeeId || err1) {
        const payloadEmail = { employee_email: target, start_date: addStart, end_date: addEnd, status: statusInit, reason: reasonVal };
        err2 = await tryInsert(payloadEmail);
      }

      const finalErr = employeeId ? err1 && err2 : err2;
      if (finalErr) throw finalErr;

      setAddLeaveOpen(false);
      setAddForEmail(''); setAddType('CL'); setAddStart(''); setAddEnd(''); setAddReason('');
      await loadLeaves();
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('HRM Add Leave failed', { message: err?.message, code: err?.code, details: err?.details });
      // Specific guidance when schema requires employee_id but mapping is missing
      if (String(err?.message || '').toLowerCase().includes('employee_id') && String(err?.message || '').toLowerCase().includes('not-null')) {
        alert('This database requires employee_id. Please ensure the person exists in Employees and is linked to a user. Then try again.');
      } else {
        alert(err?.message || 'Failed to add leave');
      }
    } finally {
      setAddSubmitting(false);
    }
  };

  const approveLeave = async (id: number) => {
    if (!isAdmin) { alert('Only Admin/Super Admin can approve leaves'); return; }
    const { data: au } = await supabase.auth.getUser();
    const me = au?.user?.email || '';
    const attempt = async (statusValue: string) => supabase.from('leaves').update({ status: statusValue }).eq('id', id);
    let { error } = await attempt('Approved');
    // Legacy schema may only allow lowercase statuses via CHECK constraint
    if (error && (error as any).code === '23514') {
      const res2 = await attempt('approved');
      error = res2.error;
    }
    if (error) alert(error.message); else {
      await supabase.from('activity_log').insert([{ entity: 'leave', entity_id: String(id), action: 'Approved', detail: { leave_id: id, approved_by: me } }]);
      loadLeaves();
    }
  };

  const approveAsCEO = async (id: number) => {
    if (!isSuper) return alert('Not allowed');
    const { data: au } = await supabase.auth.getUser();
    const me = au?.user?.email || '';
    const { data: lv } = await supabase.from('leaves').select('hr_approved_by, ceo_approved_by').eq('id', id).maybeSingle();
    if (!(lv as any)?.hr_approved_by) return alert('HR approval pending');
    if ((lv as any)?.ceo_approved_by) return alert('Already approved at CEO stage');
    const { error } = await supabase.from('leaves').update({ ceo_approved_by: me, ceo_approved_at: new Date().toISOString(), status: 'Approved' }).eq('id', id);
    if (error) alert(error.message); else {
      await supabase.from('activity_log').insert([{ entity: 'leave', entity_id: String(id), action: 'CEO approved', detail: { leave_id: id, approved_by: me } }]);
      loadLeaves();
    }
  };

  const rejectLeave = async (id: number) => {
    if (!isAdmin) { alert('Only Admin/Super Admin can reject leaves'); return; }
    const { data: au } = await supabase.auth.getUser();
    const me = au?.user?.email || '';
    const attempt = async (statusValue: string) => supabase.from('leaves').update({ status: statusValue }).eq('id', id);
    let { error } = await attempt('Rejected');
    // Legacy schema may only allow lowercase statuses via CHECK constraint
    if (error && (error as any).code === '23514') {
      const res2 = await attempt('rejected');
      error = res2.error;
    }
    if (error) alert(error.message); else {
      await supabase.from('activity_log').insert([{ entity: 'leave', entity_id: String(id), action: 'Rejected', detail: { leave_id: id, rejected_by: me } }]);
      loadLeaves();
    }
  };



  // Load role
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const email = data.user?.email || '';
        const { data: u } = await supabase.from('dashboard_users').select('role, branch').eq('email', email).maybeSingle();
        const r = (u?.role || (data.user as any)?.app_metadata?.role || (data.user as any)?.user_metadata?.role || '').toString().toLowerCase();
        mounted && setMyRoleText(r);
        if (r.includes('super')) mounted && setRole('super');
        else if (r.includes('admin')) mounted && setRole('admin');
        else mounted && setRole('other');
        mounted && setMyBranch(u?.branch || null);
      } catch {
        mounted && setRole('other');
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load employees list
  const loadEmployees = async () => {
    let query = supabase
      .from('dashboard_users')
      .select('email, full_name, role, department, designation, joining_date, status, branch')
      .order('full_name', { ascending: true });
    if (role !== 'super') {
      query = query.eq('branch', myBranch);
    }
    const { data } = await query;
    setRows((data as any) || []);
  };
  useEffect(() => { if (role === 'super' || myBranch !== null) loadEmployees(); }, [role, myBranch]);

  const filtered = useMemo(() => {


    const s = search.toLowerCase();
    return rows.filter(r =>
      (!s || (r.full_name || '').toLowerCase().includes(s) || (r.email || '').toLowerCase().includes(s)) &&
      (!filterRole || (r.role || '').toLowerCase() === filterRole.toLowerCase()) &&
      (!filterStatus || (r.status || '').toLowerCase() === filterStatus.toLowerCase())
    );
  }, [rows, search, filterRole, filterStatus]);

  // CRUD placeholders (extend later)
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editRow, setEditRow] = useState<EmpRow | null>(null);

  const openAdd = () => { setEditRow({ email: '', full_name: '', role: 'Employee', status: 'Active', branch: myBranch || '' }); setShowEmpModal(true); };
  const openEdit = (r: EmpRow) => { setEditRow(r); setShowEmpModal(true); };
  const onSave = async () => {
    if (!isAdmin || !editRow) { setShowEmpModal(false); return; }
    const branchVal = role === 'super' ? (editRow.branch || null) : (myBranch || null);

    // Generate UUID for new employees (dashboard_users.id is required)
    const employeeId = editRow.id || crypto.randomUUID();

    const payload = {
      id: employeeId,
      email: editRow.email,
      full_name: editRow.full_name,
      role: editRow.role,
      department: editRow.department,
      designation: editRow.designation,
      joining_date: editRow.joining_date,
      status: editRow.status,
      branch: branchVal,
    } as any;
    // Upsert basic employee profile (does not create auth account)
    const { data: au } = await supabase.auth.getUser();
    const me = au?.user?.email || '';
    const { error } = await supabase.from('dashboard_users').upsert(payload, { onConflict: 'email' } as any);
    if (error) { alert(error.message); return; }

    // Try to upsert minimal employees_master profile (optional - graceful failure)
    const { error: mErr } = await supabase.from('employees_master').upsert({
      email: editRow.email,
      full_name: editRow.full_name,
      designation: editRow.designation,
      branch: branchVal
    } as any, { onConflict: 'email' } as any);

    if (mErr) {
      console.warn('employees_master insert failed (non-critical):', mErr.message);
      // Continue anyway - dashboard_users is the primary record
    }

    await supabase.from('activity_log').insert([{ entity: 'employee', entity_id: editRow.email, action: 'Saved employee profile', detail: { email: editRow.email, full_name: editRow.full_name, updated_by: me } }]);
    setShowEmpModal(false); setEditRow(null); await loadEmployees();
  };
  const onDelete = async (email: string) => {
    if (!isAdmin) return;
    if (!window.confirm('Remove this employee record?')) return;
    const { error } = await supabase.from('dashboard_users').delete().eq('email', email);
    if (!error) await loadEmployees(); else alert(error.message);
  };

  // Excel upload handler for bulk employee import
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

          // Map Excel columns to employee fields
          const employees = data.map((row: any) => ({
            id: crypto.randomUUID(), // Generate UUID for dashboard_users.id
            email: row['Email'] || row['email'] || '',
            full_name: row['Full Name'] || row['full_name'] || '',
            department: row['Department'] || row['department'] || null,
            designation: row['Designation'] || row['designation'] || null,
            joining_date: row['Joining Date'] || row['joining_date'] || null,
            status: row['Status'] || row['status'] || 'Active',
            role: row['Role'] || row['role'] || 'Employee',
            branch: row['Branch'] || row['branch'] || (role === 'super' ? null : myBranch),
          }));

          // Validate required fields
          const invalid = employees.filter(e => !e.email || !e.full_name);
          if (invalid.length > 0) {
            alert(`${invalid.length} rows have missing required fields (Email, Full Name)`);
            setUploading(false);
            return;
          }

          // Get current user for activity log
          const { data: au } = await supabase.auth.getUser();
          const me = au?.user?.email || '';

          // Bulk insert into dashboard_users
          const { error: usersError } = await supabase
            .from('dashboard_users')
            .upsert(employees, { onConflict: 'email' });

          if (usersError) throw usersError;

          // Try to insert into employees_master for extended profile (optional - graceful failure)
          const masterRecords = employees.map(emp => ({
            email: emp.email,
            full_name: emp.full_name,
            designation: emp.designation,
            branch: emp.branch,
            date_of_joining: emp.joining_date || null,
          }));

          const { error: masterError } = await supabase
            .from('employees_master')
            .upsert(masterRecords, { onConflict: 'email' });

          if (masterError) {
            console.warn('employees_master bulk insert failed (non-critical):', masterError.message);
            // Continue anyway - dashboard_users is the primary record
          }

          // Initialize leave balances with default entitlements
          const leaveBalances = employees.map(emp => ({
            employee_email: emp.email,
            branch: emp.branch,
            cl_entitlement: 12,
            sl_entitlement: 12,
            al_entitlement: 12,
            cl_availed: 0,
            sl_availed: 0,
            al_availed: 0,
          }));

          const { error: balanceError } = await supabase
            .from('employee_leave_balances')
            .upsert(leaveBalances, { onConflict: 'employee_email' });

          if (balanceError) {
            console.warn('employee_leave_balances insert warning:', balanceError);
          }

          // Log activity
          await supabase.from('activity_log').insert([{
            entity: 'employee',
            entity_id: 'bulk_upload',
            action: 'Bulk employee import',
            detail: { count: employees.length, uploaded_by: me }
          }]);

          alert(`Successfully imported ${employees.length} employees`);
          setShowUploadModal(false);
          await loadEmployees();
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
    <>
      <Helmet>
        <title>HRM - GSL Pakistan CRM</title>
      </Helmet>
      <main className="w-full min-h-screen bg-background-main flex">
        <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          <section className="mt-8 lg:mt-12">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-4xl text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>HRM</h1>
            </div>

            {/* Sub-tabs */}
            <div className="mt-4 inline-flex bg-white border rounded-lg p-1">
              <button onClick={() => setTab('onboarding')} className={`px-3 py-1 rounded-md text-sm font-semibold ${tab === 'onboarding' ? 'bg-[#ffa332] text-white' : 'text-text-secondary'}`}>Onboarding</button>
              <button onClick={() => setTab('employees')} className={`ml-1 px-3 py-1 rounded-md text-sm font-semibold ${tab === 'employees' ? 'bg-[#ffa332] text-white' : 'text-text-secondary'}`}>Employees</button>
              <button onClick={() => setTab('leaves')} className={`ml-1 px-3 py-1 rounded-md text-sm font-semibold ${tab === 'leaves' ? 'bg-[#ffa332] text-white' : 'text-text-secondary'}`}>Leaves</button>
              <button onClick={() => setTab('timerecord')} className={`ml-1 px-3 py-1 rounded-md text-sm font-semibold ${tab === 'timerecord' ? 'bg-[#ffa332] text-white' : 'text-text-secondary'}`}>Time Record</button>
              <button onClick={() => setTab('payroll')} className={`ml-1 px-3 py-1 rounded-md text-sm font-semibold ${tab === 'payroll' ? 'bg-[#ffa332] text-white' : 'text-text-secondary'}`}>Payroll</button>
              <button onClick={() => setTab('assets')} className={`ml-1 px-3 py-1 rounded-md text-sm font-semibold ${tab === 'assets' ? 'bg-[#ffa332] text-white' : 'text-text-secondary'}`}>Assets</button>
            </div>

            {/* Employees tab */}
            {tab === 'employees' && (
              <div className="mt-6 space-y-3">
                <div className="bg-white border rounded-lg shadow-sm p-3 flex flex-wrap items-center gap-2">
                  <input className="border rounded px-3 py-2 w-full md:w-80" placeholder="Search name or email" value={search} onChange={e => setSearch(e.target.value)} />
                  <select className="border rounded px-2 py-2" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                    <option value="">All Roles</option>
                    <option value="super admin">Super Admin</option>
                    <option value="admin">Admin</option>
                    <option value="teacher">Teacher</option>
                    <option value="counselor">Counselor</option>
                    <option value="employee">Employee</option>
                  </select>
                  <select className="border rounded px-2 py-2" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  {isAdmin && (
                    <>
                      <button onClick={openAdd} className="ml-auto px-3 py-2 rounded bg-[#ffa332] text-white font-semibold text-sm">+ Add Employee</button>
                      <button onClick={() => setShowUploadModal(true)} className="px-3 py-2 rounded bg-green-600 text-white font-semibold text-sm">📊 Upload Excel</button>
                    </>
                  )}
                  {!isAdmin && myBranch && (
                    <div className="ml-auto text-sm text-text-secondary">Branch: <span className="font-semibold text-text-primary">{myBranch}</span></div>
                  )}
                </div>

                <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-text-secondary">
                        <th className="p-2">Name</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Role</th>
                        <th className="p-2">Department</th>
                        <th className="p-2">Designation</th>
                        <th className="p-2">Joining Date</th>
                        <th className="p-2">Status</th>
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filtered.map(r => (
                        <tr key={r.email}>
                          <td className="p-2 font-semibold text-text-primary">{r.full_name || '-'}</td>
                          <td className="p-2">{r.email}</td>
                          <td className="p-2">{r.role || '-'}</td>
                          <td className="p-2">{r.department || '-'}</td>
                          <td className="p-2">{r.designation || '-'}</td>
                          <td className="p-2">{r.joining_date || '-'}</td>
                          <td className="p-2">{r.status || '-'}</td>
                          <td className="p-2 text-right">
                            {isAdmin ? (
                              <>
                                <button onClick={() => openEdit(r)} className="text-blue-600 hover:underline mr-3">Edit</button>
                                <button onClick={() => exportEmployeePDF(r.email)} className="text-[#ffa332] hover:underline mr-3">Export PDF</button>
                                <button onClick={() => onDelete(r.email)} className="text-red-600 hover:underline">Remove</button>
                              </>
                            ) : (
                              <span className="text-text-secondary">View only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={8} className="p-4 text-center text-text-secondary">No employees</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}


            {/* Onboarding tab */}
            {tab === 'onboarding' && (
              <div className="mt-6 space-y-3">
                {/* QR Code Section */}
                {isAdmin && (
                  <div className="bg-white border rounded-lg shadow-sm p-4">
                    <h3 className="text-lg font-semibold mb-2">Public Onboarding Form</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Share this QR code or link for candidates to fill the onboarding form
                    </p>
                    <div className="flex flex-wrap gap-6 items-start">
                      <div className="flex flex-col items-center">
                        <div className="border-2 border-gray-300 rounded-lg p-3 bg-white">
                          <QRCodeCanvas
                            value={`${window.location.origin}/public-onboarding`}
                            size={180}
                            level="H"
                          />
                        </div>
                        <button
                          onClick={() => {
                            const canvas = document.querySelector('canvas');
                            if (canvas) {
                              const url = canvas.toDataURL('image/png');
                              const link = document.createElement('a');
                              link.download = 'onboarding-qr-code.png';
                              link.href = url;
                              link.click();
                            }
                          }}
                          className="mt-3 px-4 py-2 bg-[#ffa332] text-white rounded-lg font-semibold text-sm hover:bg-orange-600"
                        >
                          📥 Download QR Code
                        </button>
                      </div>
                      <div className="flex-1 min-w-[250px]">
                        <div className="text-sm font-semibold mb-2">Public Form URL:</div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={`${window.location.origin}/public-onboarding`}
                            readOnly
                            className="flex-1 border rounded px-3 py-2 text-sm bg-gray-50"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/public-onboarding`);
                              alert('Link copied to clipboard!');
                            }}
                            className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
                          >
                            📋 Copy
                          </button>
                        </div>
                        <a
                          href="/public-onboarding"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block mt-2 text-sm text-blue-600 hover:underline"
                        >
                          Open Form →
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                {!isAdmin && myBranch && (
                  <div className="bg-white border rounded-lg shadow-sm p-3">
                    <div className="text-sm text-text-secondary">Branch: <span className="font-semibold text-text-primary">{myBranch}</span></div>
                  </div>
                )}
                <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-text-secondary">
                        <th className="p-2">Candidate</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Created</th>
                        <th className="p-2">Link</th>
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {onbs.map(o => (
                        <tr key={o.id}>
                          <td className="p-2 font-semibold text-text-primary">{o.full_name || o.candidate_email}</td>
                          <td className="p-2">{o.status || '-'}</td>
                          <td className="p-2">{o.created_at ? new Date(o.created_at).toLocaleString() : '-'}</td>
                          <td className="p-2">
                            {o.secure_token ? (
                              <a className="text-blue-600 hover:underline" href={`/onboard?token=${o.secure_token}`} target="_blank" rel="noreferrer">Open</a>
                            ) : '-'}
                          </td>
                          <td className="p-2 text-right">

                            {lb && (
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                                <div className="font-semibold mb-1">Leave Entitlements</div>
                                <div className="flex flex-wrap gap-6">
                                  <div>
                                    CL: {lb.cl_entitlement || 0}/{lb.cl_availed || 0} (Bal {(lb.cl_entitlement || 0) - (lb.cl_availed || 0)})
                                  </div>
                                  <div>
                                    SL: {lb.sl_entitlement || 0}/{lb.sl_availed || 0} (Bal {(lb.sl_entitlement || 0) - (lb.sl_availed || 0)})
                                  </div>
                                  <div>
                                    AL: {lb.al_entitlement || 0}/{lb.al_availed || 0} (Bal {(lb.al_entitlement || 0) - (lb.al_availed || 0)})
                                  </div>
                                </div>
                              </div>
                            )}

                            {isAdmin ? (
                              <button disabled={o.status === 'Approved'} onClick={() => approveOnboarding(o)} className="text-green-600 hover:underline disabled:text-gray-400">Approve</button>
                            ) : (
                              <span className="text-text-secondary">View only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {onbs.length === 0 && (
                        <tr><td colSpan={5} className="p-4 text-center text-text-secondary">No onboarding records</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Leaves tab: branch-scoped approvals with filters */}
            {tab === 'leaves' && (
              <div className="mt-6 space-y-3">
                <div className="bg-white border rounded-lg shadow-sm p-3 flex flex-wrap items-center gap-2">
                  <input className="border rounded px-3 py-2 w-full md:w-64" placeholder="Search by name or email" value={lEmail} onChange={e => setLEmail(e.target.value)} />
                  <select className="border rounded px-2 py-2" value={lType} onChange={e => setLType(e.target.value)}>
                    <option value="">All Types</option>
                    <option value="CL">Casual Leave (CL)</option>
                    <option value="SL">Sick Leave (SL)</option>
                    <option value="AL">Annual Leave (AL)</option>
                  </select>
                  <select className="border rounded px-2 py-2" value={lStatus} onChange={e => setLStatus(e.target.value)}>
                    <option value="">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                  <input type="date" className="border rounded px-2 py-2" value={lFrom} onChange={e => setLFrom(e.target.value)} />
                  <span className="text-text-secondary">to</span>
                  <input type="date" className="border rounded px-2 py-2" value={lTo} onChange={e => setLTo(e.target.value)} />
                  <button onClick={loadLeaves} className="ml-auto px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">Apply</button>
                  {isAdmin && (
                    <button onClick={() => setAddLeaveOpen(true)} className="ml-2 px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">+ Add Leave</button>
                  )}
                </div>

                <div className="mt-2 inline-flex bg-white border rounded-lg p-1">
                  <button
                    onClick={() => setLStatus('Pending')}
                    className={`px-3 py-1 rounded-md text-sm font-semibold ${lStatus === 'Pending' ? 'bg-[#ffa332] text-white' : 'text-text-secondary'}`}
                  >
                    Pending
                  </button>
                  <button
                    onClick={() => setLStatus('Approved')}
                    className={`ml-1 px-3 py-1 rounded-md text-sm font-semibold ${lStatus === 'Approved' ? 'bg-[#ffa332] text-white' : 'text-text-secondary'}`}
                  >
                    Approved
                  </button>
                  <button
                    onClick={() => setLStatus('Rejected')}
                    className={`ml-1 px-3 py-1 rounded-md text-sm font-semibold ${lStatus === 'Rejected' ? 'bg-[#ffa332] text-white' : 'text-text-secondary'}`}
                  >
                    Rejected
                  </button>
                </div>


                {lb && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                    <div className="font-semibold mb-1">Leave Entitlements</div>
                    <div className="flex flex-wrap gap-6">
                      <div>
                        CL: {lb.cl_entitlement || 0}/{lb.cl_availed || 0} (Bal {(lb.cl_entitlement || 0) - (lb.cl_availed || 0)})
                      </div>
                      <div>
                        SL: {lb.sl_entitlement || 0}/{lb.sl_availed || 0} (Bal {(lb.sl_entitlement || 0) - (lb.sl_availed || 0)})
                      </div>
                      <div>
                        AL: {lb.al_entitlement || 0}/{lb.al_availed || 0} (Bal {(lb.al_entitlement || 0) - (lb.al_availed || 0)})
                      </div>
                    </div>
                  </div>
                )}


                <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-text-secondary">
                        <th className="p-2">Employee</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Start</th>
                        <th className="p-2">End</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Reason</th>
                        {role === 'super' && <th className="p-2">Branch</th>}
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {leaves.map(l => (
                        <tr key={l.id}>
                          <td className="p-2 font-semibold text-text-primary">{l.employee_email}</td>
                          <td className="p-2">{l.leave_type || l.type || '-'}</td>
                          <td className="p-2">{l.start_date || '-'}</td>
                          <td className="p-2">{l.end_date || '-'}</td>
                          <td className="p-2">
                            {l.status ? (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${l.status === 'Approved'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : l.status === 'Rejected'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-700'
                                  }`}
                              >
                                {l.status}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-2">{l.reason || '-'}</td>
                          {role === 'super' && <td className="p-2">{l.branch || '-'}</td>}
                          <td className="p-2 text-right">
                            {isAdmin && (l.status || '').toLowerCase() === 'pending' ? (
                              <div className="inline-flex items-center gap-3">
                                <button onClick={() => approveLeave(l.id)} className="text-green-700 hover:underline">Approve</button>
                                <button onClick={() => rejectLeave(l.id)} className="text-red-600 hover:underline">Reject</button>
                              </div>
                            ) : (
                              <span className="text-xs text-text-secondary">No actions</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {leaves.length === 0 && (
                        <tr><td colSpan={role === 'super' ? 8 : 7} className="p-4 text-center text-text-secondary">No leaves</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Time Record tab: CRUD + filters */}
            {tab === 'timerecord' && (
              <div className="mt-6 space-y-3">
                <div className="bg-white border rounded-lg shadow-sm p-3 flex flex-wrap items-center gap-2">
                  <input className="border rounded px-3 py-2 w-full md:w-64" placeholder="Filter by employee email" value={tEmail} onChange={e => setTEmail(e.target.value)} />
                  <input type="date" className="border rounded px-2 py-2" value={tFrom} onChange={e => setTFrom(e.target.value)} />
                  <span className="text-text-secondary">to</span>
                  <input type="date" className="border rounded px-2 py-2" value={tTo} onChange={e => setTTo(e.target.value)} />
                  <button onClick={loadTimeRecords} className="px-3 py-2 rounded border">Apply</button>
                  {isAdmin && <button onClick={openAddTR} className="ml-auto px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">+ Add Record</button>}
                </div>

                <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-text-secondary">
                        <th className="p-2">Date</th>
                        <th className="p-2">Employee</th>
                        <th className="p-2">Check-in</th>
                        <th className="p-2">Check-out</th>
                        <th className="p-2">Hours</th>
                        <th className="p-2">Overtime</th>
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {trs.map(r => (
                        <tr key={r.id}>
                          <td className="p-2">{r.work_date}</td>
                          <td className="p-2 font-semibold text-text-primary">{r.employee_email}</td>
                          <td className="p-2">{r.check_in ? new Date(r.check_in).toLocaleTimeString() : '-'}</td>
                          <td className="p-2">{r.check_out ? new Date(r.check_out).toLocaleTimeString() : '-'}</td>
                          <td className="p-2">{r.hours ?? '-'}</td>
                          <td className="p-2">{r.overtime ?? '-'}</td>
                          <td className="p-2 text-right">
                            {isAdmin ? (
                              <>
                                <button onClick={() => openEditTR(r)} className="text-blue-600 hover:underline mr-3">Edit</button>
                                <button onClick={() => deleteTR(r.id)} className="text-red-600 hover:underline">Delete</button>
                              </>
                            ) : (
                              <span className="text-text-secondary">View only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {trs.length === 0 && (
                        <tr><td colSpan={7} className="p-4 text-center text-text-secondary">No records</td></tr>
                      )}


                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payroll tab: batches, generate, and items */}

            {/* Assets tab */}
            {tab === 'assets' && (
              <div className="mt-6 space-y-3">
                <div className="bg-white border rounded-lg shadow-sm p-3 flex flex-wrap items-center gap-2">
                  {isAdmin && <button onClick={openAddAsset} className="ml-auto px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">+ Issue/Record Asset</button>}
                  {!isAdmin && myBranch && (
                    <div className="ml-auto text-sm text-text-secondary">Branch: <span className="font-semibold text-text-primary">{myBranch}</span></div>
                  )}
                </div>
                <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-text-secondary">
                        <th className="p-2">Asset ID</th>
                        <th className="p-2">Employee</th>
                        <th className="p-2">Category</th>
                        <th className="p-2">Name</th>
                        <th className="p-2">Serial/IMEI</th>
                        <th className="p-2">Issued</th>
                        <th className="p-2">Status</th>
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {assets.map(a => (
                        <tr key={a.id}>
                          <td className="p-2 font-semibold text-text-primary">{a.asset_id || '-'}</td>
                          <td className="p-2">{a.employee_email}</td>
                          <td className="p-2">{a.asset_category || '-'}</td>
                          <td className="p-2">{a.asset_name || '-'}</td>
                          <td className="p-2">{a.serial_imei || '-'}</td>
                          <td className="p-2">{a.issued_date || '-'}</td>
                          <td className="p-2">{a.return_status || '-'}</td>
                          <td className="p-2 text-right">
                            {isAdmin ? (
                              <>
                                <button onClick={() => { setEditAsset(a); setShowAssetModal(true); }} className="text-blue-600 hover:underline mr-3">Edit</button>
                                <button onClick={() => deleteAsset(a.id)} className="text-red-600 hover:underline">Delete</button>
                              </>
                            ) : (
                              <span className="text-text-secondary">View only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {assets.length === 0 && (
                        <tr><td colSpan={8} className="p-4 text-center text-text-secondary">No assets</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'payroll' && (
              <div className="mt-6 space-y-3">
                <div className="bg-white border rounded-lg shadow-sm p-3 flex flex-wrap items-center gap-2">
                  <select className="border rounded px-2 py-2" value={pyMonth} onChange={e => setPyMonth(Number(e.target.value))}>
                    {Array.from({ length: 12 }).map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                  </select>
                  <input type="number" className="border rounded px-2 py-2 w-28" value={pyYear} onChange={e => setPyYear(Number(e.target.value))} />
                  {isAdmin && <button onClick={() => { loadEmployees(); loadPayrollMasterData(); setShowPayrollMasterModal(true); }} className="px-3 py-2 rounded bg-blue-600 text-white font-semibold">Manage Salary Components</button>}
                  {isAdmin && <button onClick={generatePayroll} className="ml-auto px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">Generate Payroll</button>}
                </div>

                <div className="bg-white border rounded-lg shadow-sm">
                  <div className="p-3 text-lg font-semibold">Batches</div>
                  <div className="divide-y">
                    {payrollBatches.map(b => (
                      <div key={b.id} className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold">{b.year}-{String(b.month).padStart(2, '0')}</div>
                          {b.branch && <div className="text-sm text-text-secondary">Branch: {b.branch}</div>}
                          <button onClick={() => { setActiveBatchId(b.id); loadBatchItems(b.id); }} className="ml-auto text-blue-600 hover:underline">View</button>
                        </div>
                        {activeBatchId === b.id && (
                          <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr className="text-left text-text-secondary">
                                  <th className="p-2">Employee</th>
                                  <th className="p-2">Amount</th>
                                  <th className="p-2 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {batchItems.map(it => (
                                  <tr key={it.id}>
                                    <td className="p-2 font-semibold text-text-primary">{it.employee_email}</td>
                                    <td className="p-2">{it.payable_amount ?? 0}</td>
                                    <td className="p-2 text-right">
                                      <button onClick={() => printPayslip(it)} className="text-[#ffa332] hover:underline">Print Payslip</button>
                                    </td>
                                  </tr>
                                ))}
                                {batchItems.length === 0 && (
                                  <tr><td colSpan={3} className="p-4 text-center text-text-secondary">No items</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                    {payrollBatches.length === 0 && (
                      <div className="p-4 text-center text-text-secondary">No payroll batches</div>
                    )}
                  </div>
                </div>
              </div>
            )}


          </section>
        </div>
      </main>

      {/* Add/Edit Employee Modal */}
      {showEmpModal && editRow && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <form onSubmit={(e) => { e.preventDefault(); onSave(); }} className="bg-white rounded-lg border shadow-lg p-4 w-[92%] max-w-xl space-y-3">
            <div className="text-lg font-semibold">{editRow?.email ? 'Edit Employee' : 'Add Employee'}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Full name</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editRow.full_name || ''} onChange={e => setEditRow({ ...editRow, full_name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Email</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editRow.email} onChange={e => setEditRow({ ...editRow, email: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Branch</label>
                {role === 'super' ? (
                  <input className="mt-1 w-full border rounded px-2 py-1" value={editRow.branch || ''} onChange={e => setEditRow({ ...editRow, branch: e.target.value })} />
                ) : (
                  <input className="mt-1 w-full border rounded px-2 py-1 bg-gray-50" value={myBranch || ''} disabled />
                )}
              </div>
              <div>
                <label className="text-sm font-semibold">Role</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editRow.role || ''} onChange={e => setEditRow({ ...editRow, role: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Department</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editRow.department || ''} onChange={e => setEditRow({ ...editRow, department: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Designation</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editRow.designation || ''} onChange={e => setEditRow({ ...editRow, designation: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Joining Date</label>
                <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={editRow.joining_date || ''} onChange={e => setEditRow({ ...editRow, joining_date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Status</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editRow.status || ''} onChange={e => setEditRow({ ...editRow, status: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 pt-2">
              {editRow.email && (
                <button type="button" onClick={() => exportEmployeePDF(editRow.email)} className="text-[#ffa332] hover:underline">Export Profile to PDF</button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={() => { setShowEmpModal(false); setEditRow(null); }} className="px-3 py-2 rounded border">Cancel</button>
                {isAdmin && <button className="px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">Save</button>}
              </div>
            </div>
          </form>
        </div>
      )}
      {/* Add Leave Modal */}
      {addLeaveOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <form onSubmit={onAddLeaveSubmit} className="bg-white rounded-lg border shadow-lg p-4 w-[92%] max-w-xl space-y-3">
            <div className="text-lg font-semibold">Add Leave</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2 relative" ref={addSuggestRef as any}>
                <label className="text-sm font-semibold">For (name or email)</label>
                <input
                  className="mt-1 w-full border rounded px-2 py-1"
                  placeholder="Search name or email"
                  value={addForEmail}
                  onChange={e => { setAddForEmail(e.target.value); setShowAddSuggest(true); }}
                  onFocus={() => setShowAddSuggest(true)}
                />
                {showAddSuggest && addForEmail.trim() && (
                  addSuggestions.length > 0 ? (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border rounded shadow max-h-60 overflow-auto">
                      {addSuggestions.map(emp => (
                        <div key={emp.email}
                          className="px-2 py-1 hover:bg-gray-50 cursor-pointer text-sm"
                          onClick={() => { setAddForEmail(emp.email); setShowAddSuggest(false); }}>
                          <span className="font-medium">{emp.full_name || emp.email}</span>
                          {emp.full_name && <span className="text-text-secondary"> — {emp.email}</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border rounded shadow px-2 py-2 text-sm text-text-secondary">
                      No matches
                    </div>
                  )
                )}
              </div>
              <div>
                <label className="text-sm font-semibold">Type</label>
                <select className="mt-1 w-full border rounded px-2 py-1" value={addType} onChange={e => setAddType(e.target.value as any)}>
                  <option value="CL">CL</option>
                  <option value="SL">SL</option>
                  <option value="AL">AL</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold">Start date</label>
                <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={addStart} onChange={e => setAddStart(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold">End date</label>
                <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={addEnd} onChange={e => setAddEnd(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-semibold">Reason</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={addReason} onChange={e => setAddReason(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setAddLeaveOpen(false)} className="px-3 py-2 rounded border">Cancel</button>
              {isAdmin && <button disabled={addSubmitting} className="px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">{addSubmitting ? 'Saving...' : 'Save'}</button>}
            </div>
          </form>
        </div>
      )}

      {/* Add/Edit Time Record Modal */}
      {showTRModal && editTR && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <form onSubmit={(e) => { e.preventDefault(); saveTR(); }} className="bg-white rounded-lg border shadow-lg p-4 w-[92%] max-w-xl space-y-3">
            <div className="text-lg font-semibold">{editTR.id ? 'Edit Time Record' : 'Add Time Record'}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Employee Email</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editTR.employee_email} onChange={e => setEditTR({ ...editTR, employee_email: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-semibold">Date</label>
                <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={editTR.work_date} onChange={e => setEditTR({ ...editTR, work_date: e.target.value })} required />
              </div>
              {role === 'super' && (
                <div>
                  <label className="text-sm font-semibold">Branch</label>
                  <input className="mt-1 w-full border rounded px-2 py-1" value={editTR.branch || ''} onChange={e => setEditTR({ ...editTR, branch: e.target.value })} />
                </div>
              )}
              <div>
                <label className="text-sm font-semibold">Check-in</label>
                <input type="datetime-local" className="mt-1 w-full border rounded px-2 py-1" value={editTR.check_in || ''} onChange={e => setEditTR({ ...editTR, check_in: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Check-out</label>
                <input type="datetime-local" className="mt-1 w-full border rounded px-2 py-1" value={editTR.check_out || ''} onChange={e => setEditTR({ ...editTR, check_out: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Hours</label>
                <input type="number" step="0.1" className="mt-1 w-full border rounded px-2 py-1" value={editTR.hours ?? ''} onChange={e => setEditTR({ ...editTR, hours: e.target.value === '' ? null : Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Overtime</label>
                <input type="number" step="0.1" className="mt-1 w-full border rounded px-2 py-1" value={editTR.overtime ?? ''} onChange={e => setEditTR({ ...editTR, overtime: e.target.value === '' ? null : Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowTRModal(false); setEditTR(null); }} className="px-3 py-2 rounded border">Cancel</button>
              {isAdmin && <button className="px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">Save</button>}
            </div>
          </form>
        </div>
      )}
      {/* Add/Edit Asset Modal */}

      {/* Payroll Master Data Modal */}
      {showPayrollMasterModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg border shadow-lg p-4 w-[95%] max-w-6xl my-4 max-h-[90vh] overflow-y-auto">
            <div className="text-lg font-semibold mb-3">Manage Employee Salary Components</div>

            {!editPayrollMaster ? (
              <>
                <div className="mb-3 text-sm text-gray-600">Select an employee to edit their salary components:</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-text-secondary">
                        <th className="p-2 border">Employee Email</th>
                        <th className="p-2 border">Total Gross</th>
                        <th className="p-2 border">Total Deduction</th>
                        <th className="p-2 border">Net Salary</th>
                        <th className="p-2 border text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.map(emp => {
                        const master = payrollMasterList.find(m => m.employee_email === emp.email);
                        const n = (v: any) => Number(v || 0);
                        const gross = master ? n(master.std_basic) + n(master.std_allowance) + n(master.medical_10pct) + n(master.house_rent_20pct) + n(master.std_transportation_10pct) + n(master.std_at_work) + n(master.std_others) + n(master.arrears) + n(master.bonus) : 0;
                        const deduction = master ? n(master.income_tax) + n(master.life_insurance) + n(master.health_insurance) + n(master.employee_loan) + n(master.fin_pn) + n(master.advance_salary) + n(master.esb) + n(master.other_deduction) : 0;
                        const net = gross - deduction;
                        return (
                          <tr key={emp.email}>
                            <td className="p-2 border font-semibold">{emp.email}</td>
                            <td className="p-2 border">{gross.toFixed(2)}</td>
                            <td className="p-2 border">{deduction.toFixed(2)}</td>
                            <td className="p-2 border font-semibold">{net.toFixed(2)}</td>
                            <td className="p-2 border text-right">
                              <button onClick={() => openEditPayrollMaster(emp.email)} className="text-blue-600 hover:underline">Edit</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-2 pt-3 mt-3 border-t">
                  <button type="button" onClick={() => { setShowPayrollMasterModal(false); setEditPayrollMaster(null); }} className="px-3 py-2 rounded border">Close</button>
                </div>
              </>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); savePayrollMaster(); }} className="space-y-4">
                <div className="text-base font-semibold bg-gray-50 p-2 rounded">Employee: {editPayrollMaster.employee_email}</div>

                {/* Total Salary Auto-Calculate Section */}
                <div className="border-2 border-blue-500 rounded p-4 bg-blue-50">
                  <div className="font-semibold mb-2 text-blue-700">Quick Salary Setup</div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="text-sm font-semibold">Total Monthly Salary</label>
                      <input
                        type="number"
                        step="0.01"
                        className="mt-1 w-full border-2 border-blue-300 rounded px-3 py-2 text-lg font-semibold"
                        placeholder="Enter total salary to auto-calculate"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const totalSalary = Number((e.target as HTMLInputElement).value) || 0;
                            if (totalSalary > 0) {
                              setEditPayrollMaster({
                                ...editPayrollMaster,
                                std_basic: Math.round(totalSalary * 0.60 * 100) / 100,
                                medical_10pct: Math.round(totalSalary * 0.10 * 100) / 100,
                                house_rent_20pct: Math.round(totalSalary * 0.20 * 100) / 100,
                                std_transportation_10pct: Math.round(totalSalary * 0.10 * 100) / 100,
                              });
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        const input = (e.target as HTMLButtonElement).parentElement?.querySelector('input');
                        const totalSalary = Number(input?.value) || 0;
                        if (totalSalary > 0) {
                          setEditPayrollMaster({
                            ...editPayrollMaster,
                            std_basic: Math.round(totalSalary * 0.60 * 100) / 100,
                            medical_10pct: Math.round(totalSalary * 0.10 * 100) / 100,
                            house_rent_20pct: Math.round(totalSalary * 0.20 * 100) / 100,
                            std_transportation_10pct: Math.round(totalSalary * 0.10 * 100) / 100,
                          });
                          if (input) input.value = '';
                        } else {
                          alert('Please enter a valid salary amount');
                        }
                      }}
                      className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700"
                    >
                      Auto-Calculate
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    Auto-calculation: Basic 60%, Medical 10%, House Rent 20%, Transportation 10%. You can manually adjust any field after.
                  </div>
                </div>

                {/* Allowances Section */}
                <div className="border rounded p-3">
                  <div className="font-semibold mb-2 text-green-700">Allowances</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm font-semibold">STD BASIC 60%</label>
                      <input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1" value={editPayrollMaster.std_basic} onChange={e => setEditPayrollMaster({ ...editPayrollMaster, std_basic: Number(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold">STD Allowance</label>
                      <input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1" value={editPayrollMaster.std_allowance} onChange={e => setEditPayrollMaster({ ...editPayrollMaster, std_allowance: Number(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold">Medical 10%</label>
                      <input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1" value={editPayrollMaster.medical_10pct} onChange={e => setEditPayrollMaster({ ...editPayrollMaster, medical_10pct: Number(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold">House Rent 20%</label>
                      <input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1" value={editPayrollMaster.house_rent_20pct} onChange={e => setEditPayrollMaster({ ...editPayrollMaster, house_rent_20pct: Number(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold">STD Transportation 10%</label>
                      <input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1" value={editPayrollMaster.std_transportation_10pct} onChange={e => setEditPayrollMaster({ ...editPayrollMaster, std_transportation_10pct: Number(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold">STD At Work</label>
                      <input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1" value={editPayrollMaster.std_at_work} onChange={e => setEditPayrollMaster({ ...editPayrollMaster, std_at_work: Number(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold">STD Others</label>
                      <input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1" value={editPayrollMaster.std_others} onChange={e => setEditPayrollMaster({ ...editPayrollMaster, std_others: Number(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold">Arrears</label>
                      <input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1" value={editPayrollMaster.arrears} onChange={e => setEditPayrollMaster({ ...editPayrollMaster, arrears: Number(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold">Bonus</label>
                      <input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1" value={editPayrollMaster.bonus} onChange={e => setEditPayrollMaster({ ...editPayrollMaster, bonus: Number(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="mt-2 text-right font-semibold text-green-700">
                    Total Gross: {(Number(editPayrollMaster.std_basic) + Number(editPayrollMaster.std_allowance) + Number(editPayrollMaster.medical_10pct) + Number(editPayrollMaster.house_rent_20pct) + Number(editPayrollMaster.std_transportation_10pct) + Number(editPayrollMaster.std_at_work) + Number(editPayrollMaster.std_others) + Number(editPayrollMaster.arrears) + Number(editPayrollMaster.bonus)).toFixed(2)}
                  </div>
                </div>

                {/* Deductions Section */}
                <div className="border rounded p-3 bg-yellow-50">
                  <div className="font-semibold mb-2 text-red-700">Deductions</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm font-semibold">Income Tax</label>
                      <input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1" value={editPayrollMaster.income_tax} onChange={e => setEditPayrollMaster({ ...editPayrollMaster, income_tax: Number(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold">Life Insurance</label>
                      <input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1" value={editPayrollMaster.life_insurance} onChange={e => setEditPayrollMaster({ ...editPayrollMaster, life_insurance: Number(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold">Health Insurance</label>
                      <input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1" value={editPayrollMaster.health_insurance} onChange={e => setEditPayrollMaster({ ...editPayrollMaster, health_insurance: Number(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold">Employee Loan</label>
                      <input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1" value={editPayrollMaster.employee_loan} onChange={e => setEditPayrollMaster({ ...editPayrollMaster, employee_loan: Number(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold">FIN & PN</label>
                      <input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1" value={editPayrollMaster.fin_pn} onChange={e => setEditPayrollMaster({ ...editPayrollMaster, fin_pn: Number(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold">Advance Salary</label>
                      <input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1" value={editPayrollMaster.advance_salary} onChange={e => setEditPayrollMaster({ ...editPayrollMaster, advance_salary: Number(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold">ESB</label>
                      <input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1" value={editPayrollMaster.esb} onChange={e => setEditPayrollMaster({ ...editPayrollMaster, esb: Number(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold">Other Deduction</label>
                      <input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1" value={editPayrollMaster.other_deduction} onChange={e => setEditPayrollMaster({ ...editPayrollMaster, other_deduction: Number(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="mt-2 text-right font-semibold text-red-700">
                    Total Deduction: {(Number(editPayrollMaster.income_tax) + Number(editPayrollMaster.life_insurance) + Number(editPayrollMaster.health_insurance) + Number(editPayrollMaster.employee_loan) + Number(editPayrollMaster.fin_pn) + Number(editPayrollMaster.advance_salary) + Number(editPayrollMaster.esb) + Number(editPayrollMaster.other_deduction)).toFixed(2)}
                  </div>
                </div>

                {/* Net Salary Display */}
                <div className="bg-green-100 border-2 border-green-600 rounded p-3 text-center">
                  <div className="text-sm text-gray-600">Net Salary</div>
                  <div className="text-2xl font-bold text-green-700">
                    {((Number(editPayrollMaster.std_basic) + Number(editPayrollMaster.std_allowance) + Number(editPayrollMaster.medical_10pct) + Number(editPayrollMaster.house_rent_20pct) + Number(editPayrollMaster.std_transportation_10pct) + Number(editPayrollMaster.std_at_work) + Number(editPayrollMaster.std_others) + Number(editPayrollMaster.arrears) + Number(editPayrollMaster.bonus)) - (Number(editPayrollMaster.income_tax) + Number(editPayrollMaster.life_insurance) + Number(editPayrollMaster.health_insurance) + Number(editPayrollMaster.employee_loan) + Number(editPayrollMaster.fin_pn) + Number(editPayrollMaster.advance_salary) + Number(editPayrollMaster.esb) + Number(editPayrollMaster.other_deduction))).toFixed(2)}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setEditPayrollMaster(null)} className="px-3 py-2 rounded border">Back to List</button>
                  <button type="submit" className="px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">Save</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showAssetModal && editAsset && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <form onSubmit={(e) => { e.preventDefault(); saveAsset(); }} className="bg-white rounded-lg border shadow-lg p-4 w-[92%] max-w-2xl space-y-3">
            <div className="text-lg font-semibold">{editAsset.id ? 'Edit Asset' : 'Record Asset'}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Employee Email</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editAsset.employee_email} onChange={e => setEditAsset({ ...editAsset, employee_email: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-semibold">Asset ID</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editAsset.asset_id || ''} onChange={e => setEditAsset({ ...editAsset, asset_id: e.target.value })} />
              </div>
              {role === 'super' && (
                <div>
                  <label className="text-sm font-semibold">Branch</label>
                  <input className="mt-1 w-full border rounded px-2 py-1" value={editAsset.branch || ''} onChange={e => setEditAsset({ ...editAsset, branch: e.target.value })} />
                </div>
              )}
              <div>
                <label className="text-sm font-semibold">Category</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editAsset.asset_category || ''} onChange={e => setEditAsset({ ...editAsset, asset_category: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Name</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editAsset.asset_name || ''} onChange={e => setEditAsset({ ...editAsset, asset_name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Brand/Model</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editAsset.brand_model || ''} onChange={e => setEditAsset({ ...editAsset, brand_model: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Serial/IMEI</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editAsset.serial_imei || ''} onChange={e => setEditAsset({ ...editAsset, serial_imei: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Quantity</label>
                <input type="number" className="mt-1 w-full border rounded px-2 py-1" value={editAsset.quantity ?? 1} onChange={e => setEditAsset({ ...editAsset, quantity: Number(e.target.value) || 1 })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Issued Date</label>
                <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={editAsset.issued_date || ''} onChange={e => setEditAsset({ ...editAsset, issued_date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Issued By</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editAsset.issued_by || ''} onChange={e => setEditAsset({ ...editAsset, issued_by: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Condition at Issuance</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editAsset.condition_at_issuance || ''} onChange={e => setEditAsset({ ...editAsset, condition_at_issuance: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Return Status</label>
                <select className="mt-1 w-full border rounded px-2 py-1" value={editAsset.return_status || 'Issued'} onChange={e => setEditAsset({ ...editAsset, return_status: e.target.value })}>
                  <option>Issued</option>
                  <option>Returned</option>
                  <option>Lost</option>
                  <option>Damaged</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold">Actual Return Date</label>
                <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={editAsset.actual_return_date || ''} onChange={e => setEditAsset({ ...editAsset, actual_return_date: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-semibold">Remarks</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={editAsset.remarks || ''} onChange={e => setEditAsset({ ...editAsset, remarks: e.target.value })} />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <input id="ack" type="checkbox" className="h-4 w-4" checked={!!editAsset.acknowledgement} onChange={e => setEditAsset({ ...editAsset, acknowledgement: e.target.checked })} />
                <label htmlFor="ack" className="text-sm">Acknowledgement received</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowAssetModal(false); setEditAsset(null); }} className="px-3 py-2 rounded border">Cancel</button>
              {isAdmin && <button className="px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">Save</button>}
            </div>
          </form>
        </div>
      )}


      {/* Employee Add/Edit Modal */}
      {showEmpModal && editRow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowEmpModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">{editRow.id ? 'Edit Employee' : 'Add Employee'}</h2>
            <form onSubmit={(e) => { e.preventDefault(); onSave(); }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold">Email *</label>
                  <input
                    type="email"
                    required
                    className="mt-1 w-full border rounded px-3 py-2"
                    value={editRow.email}
                    onChange={e => setEditRow({ ...editRow, email: e.target.value })}
                    disabled={!!editRow.id}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="mt-1 w-full border rounded px-3 py-2"
                    value={editRow.full_name || ''}
                    onChange={e => setEditRow({ ...editRow, full_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold">Role</label>
                  <select
                    className="mt-1 w-full border rounded px-3 py-2"
                    value={editRow.role || 'Employee'}
                    onChange={e => setEditRow({ ...editRow, role: e.target.value })}
                  >
                    <option value="Employee">Employee</option>
                    <option value="Teacher">Teacher</option>
                    <option value="Counselor">Counselor</option>
                    <option value="Admin">Admin</option>
                    {isSuper && <option value="Super Admin">Super Admin</option>}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold">Department</label>
                  <input
                    type="text"
                    className="mt-1 w-full border rounded px-3 py-2"
                    value={editRow.department || ''}
                    onChange={e => setEditRow({ ...editRow, department: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold">Designation</label>
                  <input
                    type="text"
                    className="mt-1 w-full border rounded px-3 py-2"
                    value={editRow.designation || ''}
                    onChange={e => setEditRow({ ...editRow, designation: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold">Joining Date</label>
                  <input
                    type="date"
                    className="mt-1 w-full border rounded px-3 py-2"
                    value={editRow.joining_date || ''}
                    onChange={e => setEditRow({ ...editRow, joining_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold">Status</label>
                  <select
                    className="mt-1 w-full border rounded px-3 py-2"
                    value={editRow.status || 'Active'}
                    onChange={e => setEditRow({ ...editRow, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                {isSuper && (
                  <div>
                    <label className="text-sm font-semibold">Branch</label>
                    <input
                      type="text"
                      className="mt-1 w-full border rounded px-3 py-2"
                      value={editRow.branch || ''}
                      onChange={e => setEditRow({ ...editRow, branch: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => { setShowEmpModal(false); setEditRow(null); }} className="px-4 py-2 rounded border hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-[#ffa332] text-white font-semibold hover:bg-orange-600">Save Employee</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => !uploading && setShowUploadModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Upload Excel File</h2>
            <p className="text-sm text-text-secondary mb-4">
              Upload an Excel file (.xlsx, .xls) with the following columns:
            </p>
            <div className="text-xs bg-gray-50 p-3 rounded mb-4 space-y-1">
              <div><strong>Required:</strong> Email, Full Name</div>
              <div><strong>Optional:</strong> Department, Designation, Joining Date, Status, Role, Branch</div>
              <div className="mt-2 text-text-secondary">
                <strong>Defaults:</strong> Role=Employee, Status=Active, Branch={myBranch || 'Current Branch'}
              </div>
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

    </>
  );
};

export default HRMPage;

