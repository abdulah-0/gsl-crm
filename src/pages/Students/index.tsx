/**
 * @fileoverview Students Page
 * 
 * Comprehensive student management page for the GSL CRM system.
 * Handles three types of enrollments: Courses, Consultancy, and Test preparation.
 * 
 * **Key Features:**
 * - Multi-type enrollment (Course/Consultancy/Test)
 * - Student registration with validation
 * - Academic and experience tracking
 * - Photo upload to Supabase Storage
 * - Invoice generation post-enrollment
 * - Lead-to-student conversion
 * - Mock test management
 * - Real-time student list updates
 * - Role-based permissions (CRUD access control)
 * - Excel-style filtering and search
 * 
 * **Enrollment Types:**
 * 1. **Course** - Standard course enrollment with academics/experience
 * 2. **Consultancy** - University consultancy with detailed application tracking
 * 3. **Test** - Test preparation enrollment (IELTS/PTE/TOEFL)
 * 
 * **Permissions:**
 * - Super admins: Full CRUD access
 * - Other users: Granular permissions via user_permissions table
 * - Checks: can_add, can_edit, can_delete flags
 * 
 * @module pages/Students
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';
import { generateVoucherPDFToStorage, type VoucherRow, type PendingStudent, type VoucherCategory } from '../Finances';


// Types
type EnrollmentType = 'course' | 'consultancy' | 'test';

type Student = {
  id: string; // STxxxxxxxx
  program_title: string;
  batch_no: string;
  full_name: string;
  father_name: string;
  phone: string;
  email: string;
  cnic: string;
  dob: string;
  city: string;
  reference?: string;
  status: 'Active' | 'Completed' | 'Withdrawn';
  photo_url?: string;
  archived?: boolean;
  created_at?: string;
  enrollment_type?: EnrollmentType;
};

type Academic = { id?: number; student_id: string; serial: number; degree_name: string; grade: string; year: string; institute: string };
type Experience = { id?: number; student_id: string; serial: number; org: string; designation: string; period: string };

type TestEnrollmentForm = {
  first_name: string;
  last_name: string;
  father_name: string;
  cnic: string;
  email: string;
  mobile: string;
  address: string;
  date_of_birth: string;
  test_type: 'IELTS' | 'PTE' | 'TOEFL' | '';
};


const formatEnrollmentType = (t?: EnrollmentType) => {
  if (t === 'consultancy') return 'Consultancy';
  if (t === 'test') return 'Test';
  return 'Courses';
};

const defaultStudent: Omit<Student, 'id'> = {
  program_title: '',
  batch_no: '',
  full_name: '',
  father_name: '',
  phone: '',
  email: '',
  cnic: '',
  dob: '',
  city: '',
  reference: '',
  status: 'Active',
  photo_url: '',
  archived: false,
  enrollment_type: 'course',
};

const defaultConsultancyForm: any = {
  basic_name: '', basic_father_name: '', basic_cnic: '', basic_dob: '', basic_address: '', basic_date: '', basic_email: '', basic_nationality: '', basic_phone: '',
  ug_olevels: false, ug_olevels_year: '', ug_olevels_grades: '', ug_alevels: false, ug_alevels_year: '', ug_alevels_grades: '', ug_matric: false, ug_matric_year: '', ug_matric_grades: '', ug_hssc: false, ug_hssc_year: '', ug_hssc_grades: '', ug_other: '',
  pg_bachelors: false, pg_bachelors_university: '', pg_bachelors_course: '', pg_bachelors_year: '', pg_bachelors_grades: '', pg_masters: false, pg_masters_university: '', pg_masters_course: '', pg_masters_year: '', pg_masters_grades: '',
  eng_ielts: false, eng_toefl: false, eng_pte: false, eng_duolingo: false, eng_other: '', eng_score: '',
  work_exp: '',
  coi_uk: false, coi_usa: false, coi_canada: false, coi_malaysia: false, coi_germany: false, coi_australia: false, coi_others: '',
  add_course_or_uni: '', add_travel_history: '', add_visa_refusal: '', add_asylum_family: '',
  office_date: '', office_application_started: '', office_university_applied: '', office_counsellor_name: '', office_next_follow_up_date: '',
};

const defaultTestForm: TestEnrollmentForm = {
  first_name: '',
  last_name: '',
  father_name: '',
  cnic: '',
  email: '',
  mobile: '',
  address: '',
  date_of_birth: '',
  test_type: '',
};

const StudentsPage: React.FC = () => {
  const [tab, setTab] = useState<'add' | 'list'>('list');
  const navigate = useNavigate();
  const location = useLocation();

  // Add form state
  const [s, setS] = useState(defaultStudent);
  const [academics, setAcademics] = useState<Academic[]>([{ student_id: '', serial: 1, degree_name: '', grade: '', year: '', institute: '' }]);
  const [experiences, setExperiences] = useState<Experience[]>([{ student_id: '', serial: 1, org: '', designation: '', period: '' }]);
  const [agreeAll, setAgreeAll] = useState(false);
  const [declTextAgree, setDeclTextAgree] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [enrollmentType, setEnrollmentType] = useState<EnrollmentType>('course');
  const [consultSf, setConsultSf] = useState<any>(defaultConsultancyForm);
  const [testForm, setTestForm] = useState<TestEnrollmentForm>(defaultTestForm);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [sourceLeadId, setSourceLeadId] = useState<number | null>(null);

  const [stuAccess, setStuAccess] = useState<'NONE' | 'VIEW' | 'CRUD'>('NONE');
  const canCrud = stuAccess === 'CRUD';
  const [isSuper, setIsSuper] = useState(false);
  const [permFlags, setPermFlags] = useState<{ add: boolean; edit: boolean; del: boolean }>({ add: false, edit: false, del: false });
  const canAdd = isSuper || permFlags.add || canCrud;
  const canEdit = isSuper || permFlags.edit || canCrud;
  const canDelete = isSuper || permFlags.del || canCrud;


  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const email = auth.user?.email;
        if (!email) return;
        const { data: u } = await supabase.from('dashboard_users').select('role, permissions, branch, full_name').eq('email', email).maybeSingle();
        const roleStr = (u?.role || (auth.user as any)?.app_metadata?.role || (auth.user as any)?.user_metadata?.role || '').toString().toLowerCase();
        setIsSuper(roleStr.includes('super'));
        setCurrentBranch((u as any)?.branch || null);
        setCurrentUserName((u as any)?.full_name || email || '');
        if ((u as any)?.full_name) {
          setConsultSf((prev: any) => ({ ...prev, office_counsellor_name: prev.office_counsellor_name || (u as any).full_name }));
        }
        if (roleStr.includes('super')) { setStuAccess('CRUD'); setPermFlags({ add: true, edit: true, del: true }); return; }
        const { data: up } = await supabase.from('user_permissions').select('module, access, can_add, can_edit, can_delete').eq('user_email', email).eq('module', 'students');
        if (up && up.length) {
          const r: any = up[0];
          setPermFlags({ add: !!r.can_add || r.access === 'CRUD', edit: !!r.can_edit || r.access === 'CRUD', del: !!r.can_delete || r.access === 'CRUD' });
          setStuAccess((r.access as any) === 'CRUD' ? 'CRUD' : 'VIEW');
        } else {
          const perms = Array.isArray(u?.permissions) ? (u?.permissions as any as string[]) : [];
          setStuAccess(perms.includes('students') ? 'CRUD' : 'NONE');
        }
      } catch { }
    })();
  }, []);
  useEffect(() => { if (tab === 'add' && !canAdd) setTab('list'); }, [tab, canAdd]);

  // Auto-fill Consultancy Date field with today's date when applicable
  useEffect(() => {
    if (enrollmentType === 'consultancy') {
      const today = new Date().toISOString().slice(0, 10);
      setConsultSf((prev: any) => ({
        ...prev,
        basic_date: prev.basic_date || today,
      }));
    }
  }, [enrollmentType]);

  // Invoice modal state (post-creation)
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [lastCreatedStudent, setLastCreatedStudent] = useState<{ id: string; full_name: string; batch_no: string; program_title?: string } | null>(null);
  const [invReg, setInvReg] = useState<string>('1000');
  const [invSvc, setInvSvc] = useState<string>('');
  const [invDisc, setInvDisc] = useState<string>('0');
  const [invDiscType, setInvDiscType] = useState<'flat' | 'percent'>('flat');
  const [paymentOption, setPaymentOption] = useState<'full' | 'partial'>('full');
  const [amountPaidNow, setAmountPaidNow] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');


  // Services for enrollment
  const [services, setServices] = useState<Array<{ id: string; name: string; type?: string; price?: number; duration_weeks?: number }>>([]);

  // List state
  const [items, setItems] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [fProgram, setFProgram] = useState('All');
  const [fBatch, setFBatch] = useState('All');
  const [fCity, setFCity] = useState('All');
  const [editItem, setEditItem] = useState<Student | null>(null);
  const [mockTests, setMockTests] = useState<any[]>([]);
  const [mockTestsModalOpen, setMockTestsModalOpen] = useState(false);
  const [selectedStudentForTests, setSelectedStudentForTests] = useState<Student | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('dashboard_services').select('id, name, type, price, duration_weeks').order('name');
      setServices((data as any) || []);
      // prefill from query ?service=NAME
      const sp = new URLSearchParams(location.search);
      const svc = sp.get('service');
      if (svc) setS(prev => ({ ...prev, program_title: svc }));
    })();
  }, [location.search]);
  // Prefill from Lead -> Student conversion via query params
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    if (sp.get('from_lead') === '1') {
      setTab('add');
      const leadId = sp.get('lead_id');
      const fullName = sp.get('full_name');
      const fatherName = sp.get('father_name');
      const cnic = sp.get('cnic');
      const email = sp.get('email');
      const phone = sp.get('phone');
      const city = sp.get('city');
      const dob = sp.get('dob');
      const service = sp.get('service');
      const enrollType = sp.get('enrollment_type') as EnrollmentType;

      // Set enrollment type based on parameter
      if (enrollType === 'consultancy') {
        setEnrollmentType('consultancy');
        setConsultSf((prev: any) => ({
          ...prev,
          basic_name: fullName || '',
          basic_father_name: fatherName || '',
          basic_cnic: cnic || '',
          basic_email: email || '',
          basic_phone: phone || '',
          basic_address: city || '',
          basic_dob: dob || '',
        }));
      } else if (enrollType === 'test') {
        setEnrollmentType('test');
        const [first, ...rest] = (fullName || '').split(' ');
        setTestForm(prev => ({
          ...prev,
          first_name: first || '',
          last_name: rest.join(' ') || '',
          father_name: fatherName || '',
          cnic: cnic || '',
          email: email || '',
          mobile: phone || '',
          address: city || '',
          date_of_birth: dob || '',
        }));
      } else {
        // Default to course
        setEnrollmentType('course');
        setS(prev => ({
          ...prev,
          full_name: fullName || '',
          father_name: fatherName || '',
          cnic: cnic || '',
          email: email || '',
          phone: phone || '',
          city: city || '',
          dob: dob || '',
          program_title: service || '',
        }));
      }
    }
  }, [location.search, canAdd]);
  // Prefill service fee into invoice from selected service price when opening the modal
  useEffect(() => {
    if (invoiceOpen && lastCreatedStudent) {
      const svc = services.find(sv => sv.name === (lastCreatedStudent.program_title || ''));
      if (svc?.price != null) setInvSvc(String(svc.price));
    }
  }, [invoiceOpen, lastCreatedStudent, services]);


  const resetForm = () => {
    setS(defaultStudent);
    setAcademics([{ student_id: '', serial: 1, degree_name: '', grade: '', year: '', institute: '' }]);
    setExperiences([{ student_id: '', serial: 1, org: '', designation: '', period: '' }]);
    setAgreeAll(false);
    setDeclTextAgree(false);
    setPhotoFile(null);
    setEnrollmentType('course');
    setConsultSf(defaultConsultancyForm);
    setTestForm(defaultTestForm);
  };

  const validateCourseForm = (): string | null => {
    if (!s.program_title) return 'Program Title is required';

    if (!s.full_name || s.full_name !== s.full_name.toUpperCase()) return 'Full Name must be in CAPITAL letters';
    if (!s.father_name) return 'Father/Guardian Name is required';
    if (!/^\+?[0-9]{10,15}$/.test(s.phone)) return 'Invalid phone number format';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) return 'Invalid email format';
    if (!/^[0-9]{13}$/.test(s.cnic)) return 'CNIC must be 13 digits';
    // Date of Birth and City are optional for course enrollment
    if (!agreeAll) return 'You must agree to Terms & Conditions';
    if (!declTextAgree) return 'You must accept the Declaration';
    return null;
  };

  const validateConsultancyForm = (): string | null => {
    const name = (consultSf.basic_name || '').trim();
    const father = (consultSf.basic_father_name || '').trim();
    const cnic = (consultSf.basic_cnic || '').trim();
    const phone = (consultSf.basic_phone || '').trim();
    const email = (consultSf.basic_email || '').trim();
    const date = (consultSf.basic_date || '').trim();

    if (!name) return 'Student Name is required for Consultancy enrollment';
    if (!father) return 'Father Name is required for Consultancy enrollment';
    if (!cnic) return 'CNIC is required for Consultancy enrollment';
    if (!/^\d{13}$/.test(cnic)) return 'CNIC must be 13 digits for Consultancy enrollment';
    if (!phone) return 'Phone is required for Consultancy enrollment';
    if (!/^\+?[0-9]{10,15}$/.test(phone)) return 'Invalid phone number format for Consultancy enrollment';
    if (!email) return 'Email is required for Consultancy enrollment';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format for Consultancy enrollment';

    // Address, nationality, and other fields are optional.
    // If a date is provided, keep the sanity check that it cannot be earlier than today.
    if (date) {
      const today = new Date().toISOString().slice(0, 10);
      if (date < today) return 'Date cannot be earlier than today';
    }

    return null;
  };

  const validateTestForm = (): string | null => {
    if (!testForm.first_name) return 'First Name is required for Test enrollment';
    if (!testForm.last_name) return 'Last Name is required for Test enrollment';
    if (!testForm.father_name) return 'Father Name is required for Test enrollment';
    if (!testForm.cnic) return 'CNIC is required for Test enrollment';
    if (!/^\d{13}$/.test(testForm.cnic)) return 'CNIC must be 13 digits for Test enrollment';
    if (!testForm.mobile) return 'Mobile is required for Test enrollment';
    if (!testForm.email) return 'Email is required for Test enrollment';
    if (!testForm.test_type) return 'Test Type is required';
    return null;
  };

  const onAddAcademic = () => setAcademics(prev => [...prev, { student_id: '', serial: prev.length + 1, degree_name: '', grade: '', year: '', institute: '' }]);
  const onAddExperience = () => setExperiences(prev => [...prev, { student_id: '', serial: prev.length + 1, org: '', designation: '', period: '' }]);
  const onRemoveAcademic = (i: number) => setAcademics(prev => prev.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, serial: idx + 1 })));
  const onRemoveExperience = (i: number) => setExperiences(prev => prev.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, serial: idx + 1 })));

  const fileUrl = (path: string) => supabase.storage.from('attachments').getPublicUrl(path).data.publicUrl;

  const openMockTestsModal = async (student: Student) => {
    setSelectedStudentForTests(student);
    try {
      const { data } = await supabase
        .from('student_mock_tests')
        .select('*')
        .eq('student_id', student.id)
        .order('test_date', { ascending: false });

      setMockTests(data || []);
      setMockTestsModalOpen(true);
    } catch (error) {
      console.error('Error loading mock tests:', error);
      alert('Failed to load mock tests');
    }
  };

  const submitStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdd) { alert('You are not permitted to add Students.'); return; }
    if (enrollmentType === 'consultancy') {
      await submitConsultancy();
    } else if (enrollmentType === 'test') {
      await submitTest();
    } else {
      await submitCourse();
    }
  };

  const submitCourse = async () => {
    const err = validateCourseForm();
    if (err) { alert(err); return; }
    setSaving(true);
    try {
      const { data: created, error: eCreate } = await supabase
        .from('dashboard_students')
        .insert([{
          program_title: s.program_title,
          full_name: s.full_name,
          father_name: s.father_name,
          phone: s.phone,
          email: s.email,
          cnic: s.cnic,
          dob: s.dob,
          city: s.city,
          reference: s.reference || null,
          status: s.status,
          archived: false,
          enrollment_type: 'course',
        }])
        .select('id, batch_no, full_name, program_title')
        .single();
      if (eCreate) throw eCreate;
      const newId = created?.id as string;

      // If this enrollment came from a Lead, mark the lead as Confirmed and link it
      if (sourceLeadId && newId) {
        await supabase
          .from('leads')
          .update({ status: 'confirmed', converted_to_student_id: newId })
          .eq('id', sourceLeadId);
        setSourceLeadId(null);
      }

      if (photoFile && newId) {
        const path = `students/${newId}/photo_${Date.now()}_${photoFile.name}`;
        await supabase.storage.from('attachments').upload(path, photoFile);
        const photo_url = fileUrl(path);
        await supabase.from('dashboard_students').update({ photo_url }).eq('id', newId);
      }

      if (academics.length && newId) {
        const acadRows = academics.map(a => ({ student_id: newId, serial: a.serial, degree_name: a.degree_name, grade: a.grade, year: a.year, institute: a.institute }));
        await supabase.from('dashboard_student_academics').insert(acadRows);
      }
      if (experiences.length && newId) {
        const expRows = experiences.map(w => ({ student_id: newId, serial: w.serial, org: w.org, designation: w.designation, period: w.period }));
        await supabase.from('dashboard_student_experiences').insert(expRows);
      }

      const { data: srow } = await supabase.from('dashboard_students').select('id, full_name, batch_no, program_title').eq('id', newId).maybeSingle();
      setLastCreatedStudent(srow as any);
      setInvoiceOpen(true);
      await loadList();
      resetForm();
      alert('Student added successfully. You can now generate the invoice.');
    } catch (err: any) {
      alert(`Failed to save student: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const submitConsultancy = async () => {
    const err = validateConsultancyForm();
    if (err) { alert(err); return; }
    setSaving(true);
    try {
      const fullNameRaw = (consultSf.basic_name || '').trim();
      const fullName = fullNameRaw ? fullNameRaw.toUpperCase() : '';
      const father = (consultSf.basic_father_name || '').trim();
      const cnic = (consultSf.basic_cnic || '').trim();
      const phone = (consultSf.basic_phone || '').trim();
      const email = (consultSf.basic_email || '').trim();
      const dob = (consultSf.basic_dob || '').trim();

      const { data: created, error: eCreate } = await supabase
        .from('dashboard_students')
        .insert([{
          program_title: 'Consultancy',
          full_name: fullName || fullNameRaw || 'CONSULTANCY STUDENT',
          father_name: father,
          phone,
          email,
          cnic,
          dob,
          city: (consultSf.basic_address || '').toString(),
          reference: null,
          status: 'Active',
          archived: false,
          enrollment_type: 'consultancy',
        }])
        .select('id, batch_no, full_name, program_title')
        .single();
      if (eCreate) throw eCreate;
      const newId = created?.id as string;

      const title = fullName ? `Consultancy - ${fullName}` : 'Consultancy Case';
      const payload: any = {
        title,
        status: 'In Progress',
        branch: currentBranch || null,
        employee: currentUserName || null,
        assignees: currentUserName ? [currentUserName] : [],
        student_id: newId,
        student_info: {
          ...consultSf,
          student: {
            id: newId,
            full_name: created?.full_name || fullName || fullNameRaw,
            phone,
            email,
          },
        },
      };
      await supabase.from('dashboard_cases').insert([payload]);

      const { data: srow } = await supabase.from('dashboard_students').select('id, full_name, batch_no, program_title').eq('id', newId).maybeSingle();
      setLastCreatedStudent(srow as any);
      setInvoiceOpen(true);
      await loadList();
      resetForm();
      alert('Consultancy enrollment added successfully. You can now generate the invoice.');
    } catch (err: any) {
      alert(`Failed to save consultancy enrollment: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const submitTest = async () => {
    const err = validateTestForm();
    if (err) { alert(err); return; }
    setSaving(true);
    try {
      const first = testForm.first_name.trim();
      const last = testForm.last_name.trim();
      const fullName = `${first} ${last}`.trim().toUpperCase();
      const father = testForm.father_name.trim();
      const cnic = testForm.cnic.trim();
      const phone = testForm.mobile.trim();
      const email = (testForm.email || '').trim();
      const dob = (testForm.date_of_birth || '').trim();

      const { data: created, error: eCreate } = await supabase
        .from('dashboard_students')
        .insert([{
          program_title: `Test: ${testForm.test_type}`,
          full_name: fullName || `${first} ${last}`.trim(),
          father_name: father,
          phone,
          email,
          cnic,
          dob,
          city: (testForm.address || '').toString(),
          reference: null,
          status: 'Active',
          archived: false,
          enrollment_type: 'test',
        }])
        .select('id, batch_no, full_name, program_title')
        .single();
      if (eCreate) throw eCreate;
      const newId = created?.id as string;

      await supabase.from('test_enrollments').insert([{
        student_id: newId,
        first_name: first,
        last_name: last,
        email: email || null,
        mobile: phone,
        address: testForm.address || null,
        date_of_birth: dob || null,
        test_type: testForm.test_type || undefined,
        branch: currentBranch || null,
      }]);

      const { data: srow } = await supabase.from('dashboard_students').select('id, full_name, batch_no, program_title').eq('id', newId).maybeSingle();
      setLastCreatedStudent(srow as any);
      setInvoiceOpen(true);
      await loadList();
      resetForm();
      alert('Test enrollment added successfully. You can now generate the invoice.');
    } catch (err: any) {
      alert(`Failed to save test enrollment: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };
  // Invoice helpers
  const computeTotal = useCallback(() => {
    const reg = Number(invReg) || 0;
    const svc = Number(invSvc) || 0;
    const disc = Number(invDisc) || 0;
    const pre = reg + svc;
    return invDiscType === 'percent' ? Math.max(0, pre - (pre * disc / 100)) : Math.max(0, pre - disc);
  }, [invReg, invSvc, invDisc, invDiscType]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lastCreatedStudent) return;

    const reg = Number(invReg) || 0;
    const svc = Number(invSvc) || 0;
    const disc = Number(invDisc) || 0;
    const pre = reg + svc;
    const total = invDiscType === 'percent' ? pre - (pre * disc / 100) : pre - disc;
    const totalSafe = Math.max(0, Math.round(total * 100) / 100);
    const amtPaid =
      paymentOption === 'full'
        ? totalSafe
        : Math.max(0, Math.min(totalSafe, Number(amountPaidNow) || 0));
    const remaining = Math.max(0, totalSafe - amtPaid);
    const payment_status: 'Paid' | 'Partially Paid' | 'Unpaid' =
      amtPaid >= totalSafe ? 'Paid' : amtPaid > 0 ? 'Partially Paid' : 'Unpaid';

    const invoicePayload = {
      student_id: lastCreatedStudent.id,
      registration_fee: reg,
      service_fee: svc,
      discount: disc,
      discount_type: invDiscType,
      total_amount: totalSafe,
      amount_paid: amtPaid,
      remaining_amount: remaining,
      payment_status,
      due_date: paymentOption === 'partial' && remaining > 0 && dueDate ? dueDate : null,
      status: payment_status === 'Paid' ? 'Paid' : 'Pending',
      service_items: [{ name: lastCreatedStudent.program_title || 'Service', amount: svc }],
    } as any;

    const { error: invErr } = await supabase.from('invoices').insert([invoicePayload]);
    if (invErr) {
      alert(`Failed to create invoice: ${invErr.message}`);
      return;
    }

    // Also record a Cash In voucher for the amount paid now so it reflects in Finances/SuperAdmin dashboards
    if (amtPaid > 0) {
      try {
        const voucherCode = `GSL-${new Date().getFullYear()}-${String(
          Math.floor(Math.random() * 10000)
        ).padStart(4, '0')}`;
        const occurred_at = new Date().toISOString();
        const branchName = currentBranch || 'Main Branch';
        const description = `Enrollment payment for ${lastCreatedStudent.full_name} (${lastCreatedStudent.id})`;

        const voucherPayload: any = {
          code: voucherCode,
          vtype: 'cash_in',
          amount: amtPaid,
          branch: branchName,
          occurred_at,
          status: 'Approved',
          description,
          student_id: lastCreatedStudent.id,
          voucher_type: 'Admission / Enrollment Voucher',
          service_type: lastCreatedStudent.program_title || null,
          discount: disc,
          amount_paid: amtPaid,
          amount_unpaid: remaining,
          due_date:
            paymentOption === 'partial' && remaining > 0 && dueDate ? dueDate : null,
        };

        const { error: vErr } = await supabase.from('vouchers').insert([voucherPayload]);
        if (vErr) {
          console.warn('Failed to create cash-in voucher for invoice payment:', vErr.message);
        } else {
          const voucherRow: VoucherRow = {
            id: voucherCode,
            type: 'Cash In',
            amount: amtPaid,
            branch: branchName,
            date: occurred_at,
            status: 'Approved',
            description,
          };

          const baseProgramTitle = lastCreatedStudent.program_title || '';
          const programWithType =
            enrollmentType === 'course'
              ? `Course - ${baseProgramTitle}`
              : enrollmentType === 'consultancy'
                ? `Consultancy - ${baseProgramTitle}`
                : enrollmentType === 'test'
                  ? `Test - ${baseProgramTitle}`
                  : baseProgramTitle;

          const pendingForPdf: PendingStudent = {
            student_id: lastCreatedStudent.id,
            registration_no: lastCreatedStudent.id,
            full_name: lastCreatedStudent.full_name,
            batch_no: lastCreatedStudent.batch_no || '',
            program_title: programWithType || null,
            phone: null,
            total_fee: totalSafe,
            amount_paid: amtPaid,
            remaining_amount: remaining,
            total_discount: disc,
            next_due_date:
              paymentOption === 'partial' && remaining > 0 && dueDate ? dueDate : null,
          };

          const pdfPath = await generateVoucherPDFToStorage(voucherRow, {
            pending: pendingForPdf,
            category: 'Admission / Enrollment Voucher' as VoucherCategory,
          });

          if (pdfPath) {
            await supabase
              .from('vouchers')
              .update({ pdf_url: pdfPath })
              .eq('code', voucherCode);
          }
        }
      } catch (e) {
        console.warn('Voucher creation error for invoice payment', e);
      }
    }

    alert('Invoice created successfully.');
    setInvoiceOpen(false);
  };


  // List loading (no pagination; fetch all filtered students)
  const loadList = useCallback(async () => {
    let query = supabase.from('dashboard_students').select('*').eq('archived', false);
    if (search) {
      // search by name, cnic, program, batch
      query = query.or(`full_name.ilike.%${search}%,cnic.ilike.%${search}%,program_title.ilike.%${search}%,batch_no.ilike.%${search}%`);
    }
    if (fProgram !== 'All') query = query.eq('program_title', fProgram);
    if (fBatch !== 'All') query = query.eq('batch_no', fBatch);
    if (fCity !== 'All') query = query.eq('city', fCity);
    const { data } = await query.order('created_at', { ascending: false });
    setItems((data as any as Student[]) || []);
  }, [search, fProgram, fBatch, fCity]);

  useEffect(() => { loadList(); }, [loadList]);

  // Realtime updates: reload list when students are inserted/updated/deleted
  useEffect(() => {
    const channel = supabase
      .channel('students-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dashboard_students' }, () => {
        loadList();
      })
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch { } };
  }, [loadList]);

  // Distincts for filters
  const programs = useMemo(() => Array.from(new Set(items.map(i => i.program_title))).filter(Boolean), [items]);
  const batches = useMemo(() => Array.from(new Set(items.map(i => i.batch_no))).filter(Boolean), [items]);
  const cities = useMemo(() => Array.from(new Set(items.map(i => i.city))).filter(Boolean), [items]);

  // Counts per status (based on current filters)
  const countActive = useMemo(() => items.filter(i => i.status === 'Active').length, [items]);
  const countCompleted = useMemo(() => items.filter(i => i.status === 'Completed').length, [items]);
  const countWithdrawn = useMemo(() => items.filter(i => i.status === 'Withdrawn').length, [items]);

  const archiveStudent = async (id: string) => {
    if (!canDelete) { alert('You are not permitted to archive Students.'); return; }
    if (!confirm('Archive this student?')) return;
    await supabase.from('dashboard_students').update({ archived: true }).eq('id', id);
    await loadList();
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) { alert('You are not permitted to edit Students.'); return; }
    if (!editItem) return;
    const { id, full_name, father_name, phone, email, cnic, dob, city, reference, status, program_title, batch_no } = editItem;
    await supabase.from('dashboard_students').update({ full_name, father_name, phone, email, cnic, dob, city, reference, status, program_title, batch_no }).eq('id', id);
    setEditItem(null);
    await loadList();
  };

  return (
    <main className="w-full min-h-screen bg-background-main flex">
      <Helmet><title>Students | GSL Pakistan CRM</title></Helmet>
      <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
      <div className="flex-1 flex flex-col">
        <Header />

        <section className="px-4 sm:px-6 lg:px-8 mt-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Students</h1>
            <div className="bg-white rounded-full p-1 shadow flex">
              <button disabled={!canAdd} onClick={() => { if (canAdd) setTab('add'); }} className={`px-4 py-2 rounded-full text-sm font-semibold ${tab === 'add' && canAdd ? 'bg-[#ffa332] text-white' : 'text-text-secondary'} ${!canAdd ? 'opacity-60 cursor-not-allowed' : ''}`}>Add New Student</button>
              <button onClick={() => setTab('list')} className={`px-4 py-2 rounded-full text-sm font-semibold ${tab === 'list' ? 'bg-[#ffa332] text-white' : 'text-text-secondary'}`}>All Students</button>
            </div>
          </div>

          {tab === 'add' && (
            <form onSubmit={submitStudent} className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a]">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h3 className="font-bold text-lg">Enrollment Details</h3>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="enrollmentType"
                        value="course"
                        checked={enrollmentType === 'course'}
                        onChange={() => setEnrollmentType('course')}
                      />
                      <span>Courses</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="enrollmentType"
                        value="consultancy"
                        checked={enrollmentType === 'consultancy'}
                        onChange={() => setEnrollmentType('consultancy')}
                      />
                      <span>Consultancy</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="enrollmentType"
                        value="test"
                        checked={enrollmentType === 'test'}
                        onChange={() => setEnrollmentType('test')}
                      />
                      <span>Test</span>
                    </label>
                  </div>
                </div>

                {/* Course Enrollment Form */}
                {enrollmentType === 'course' && (
                  <>
                    <h3 className="mt-6 font-bold text-lg">Program Information</h3>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="text-sm"><span className="text-text-secondary">Service</span>
                        <select value={s.program_title} onChange={e => setS({ ...s, program_title: e.target.value })} className="mt-1 w-full border rounded p-2" required>
                          <option value="">Select Service</option>
                          {services.map(sv => (<option key={sv.id} value={sv.name}>{sv.name}</option>))}
                        </select>
                      </label>
                      <label className="text-sm"><span className="text-text-secondary">Batch No. (auto)</span><input value={s.batch_no || 'Auto on save'} readOnly className="mt-1 w-full border rounded p-2 bg-gray-50 text-gray-500" /></label>
                    </div>

                    <h3 className="mt-6 font-bold text-lg">Personal Details</h3>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="text-sm sm:col-span-2"><span className="text-text-secondary">Full Name (CAPITAL)</span><input value={s.full_name} onChange={e => setS({ ...s, full_name: e.target.value.toUpperCase() })} className="mt-1 w-full border rounded p-2" required /></label>
                      <label className="text-sm sm:col-span-2"><span className="text-text-secondary">Father/Guardian Name</span><input value={s.father_name} onChange={e => setS({ ...s, father_name: e.target.value })} className="mt-1 w-full border rounded p-2" required /></label>
                      <label className="text-sm"><span className="text-text-secondary">Phone</span><input value={s.phone} onChange={e => setS({ ...s, phone: e.target.value })} className="mt-1 w-full border rounded p-2" required /></label>
                      <label className="text-sm"><span className="text-text-secondary">Email</span><input type="email" value={s.email} onChange={e => setS({ ...s, email: e.target.value })} className="mt-1 w-full border rounded p-2" required /></label>
                      <label className="text-sm"><span className="text-text-secondary">CNIC No.</span><input value={s.cnic} onChange={e => setS({ ...s, cnic: e.target.value.replace(/[^0-9]/g, '') })} className="mt-1 w-full border rounded p-2" placeholder="13 digits" required /></label>
                      <label className="text-sm"><span className="text-text-secondary">Date of Birth</span><input type="date" value={s.dob} onChange={e => setS({ ...s, dob: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
                      <label className="text-sm"><span className="text-text-secondary">City</span><input value={s.city} onChange={e => setS({ ...s, city: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
                      <label className="text-sm"><span className="text-text-secondary">Reference (optional)</span><input value={s.reference} onChange={e => setS({ ...s, reference: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
                    </div>

                    <h3 className="mt-6 font-bold text-lg">Academic Background</h3>
                    <div className="mt-3 space-y-3">
                      {academics.map((a, i) => (
                        <div key={i} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
                          <div>
                            <div className="text-xs text-text-secondary">S. No</div>
                            <input readOnly value={i + 1} className="w-full border rounded p-2" />
                          </div>
                          <label className="text-sm"><span className="text-text-secondary">Degree Name</span><input value={a.degree_name} onChange={e => {
                            const v = e.target.value; setAcademics(p => p.map((r, idx) => idx === i ? { ...r, degree_name: v } : r));
                          }} className="mt-1 w-full border rounded p-2" /></label>
                          <label className="text-sm"><span className="text-text-secondary">Grade</span><input value={a.grade} onChange={e => {
                            const v = e.target.value; setAcademics(p => p.map((r, idx) => idx === i ? { ...r, grade: v } : r));
                          }} className="mt-1 w-full border rounded p-2" /></label>
                          <label className="text-sm"><span className="text-text-secondary">Year</span><input value={a.year} onChange={e => {
                            const v = e.target.value; setAcademics(p => p.map((r, idx) => idx === i ? { ...r, year: v } : r));
                          }} className="mt-1 w-full border rounded p-2" /></label>
                          <label className="text-sm"><span className="text-text-secondary">Institute/University</span><input value={a.institute} onChange={e => {
                            const v = e.target.value; setAcademics(p => p.map((r, idx) => idx === i ? { ...r, institute: v } : r));
                          }} className="mt-1 w-full border rounded p-2" /></label>
                          {i > 0 && <button type="button" onClick={() => onRemoveAcademic(i)} className="text-xs text-red-600">Remove</button>}
                        </div>
                      ))}
                      <button type="button" onClick={onAddAcademic} className="px-3 py-2 rounded bg-gray-100 text-sm font-semibold">+ Add Row</button>
                    </div>

                    <h3 className="mt-6 font-bold text-lg">Professional Detail / Work Experience</h3>
                    <div className="mt-3 space-y-3">
                      {experiences.map((w, i) => (
                        <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                          <div>
                            <div className="text-xs text-text-secondary">S. No</div>
                            <input readOnly value={i + 1} className="w-full border rounded p-2" />
                          </div>
                          <label className="text-sm"><span className="text-text-secondary">Name of Organization</span><input value={w.org} onChange={e => { const v = e.target.value; setExperiences(p => p.map((r, idx) => idx === i ? { ...r, org: v } : r)); }} className="mt-1 w-full border rounded p-2" /></label>
                          <label className="text-sm"><span className="text-text-secondary">Designation</span><input value={w.designation} onChange={e => { const v = e.target.value; setExperiences(p => p.map((r, idx) => idx === i ? { ...r, designation: v } : r)); }} className="mt-1 w-full border rounded p-2" /></label>
                          <label className="text-sm"><span className="text-text-secondary">Period</span><input value={w.period} onChange={e => { const v = e.target.value; setExperiences(p => p.map((r, idx) => idx === i ? { ...r, period: v } : r)); }} className="mt-1 w-full border rounded p-2" /></label>
                          {i > 0 && <button type="button" onClick={() => onRemoveExperience(i)} className="text-xs text-red-600">Remove</button>}
                        </div>
                      ))}
                      <button type="button" onClick={onAddExperience} className="px-3 py-2 rounded bg-gray-100 text-sm font-semibold">+ Add Row</button>
                    </div>

                    <h3 className="mt-6 font-bold text-lg">Terms & Conditions</h3>
                    <div className="mt-2 space-y-2 text-sm">
                      {[
                        'Institute reserves the right to change the date or schedule.',
                        'Permission for recording/exposure in front of the camera.',
                        'Attendance must be 90%.',
                        'Course fee payable before classes commence.',
                        'Tuition fee is non-refundable.',
                        'Institute reserves the right to terminate me if I violate the discipline of the institute/class or involved in any illegal activity in the premises.',
                      ].map((t, i) => (
                        <label key={i} className="flex items-start gap-2"><input type="checkbox" checked={agreeAll} onChange={(e) => setAgreeAll(e.target.checked)} className="mt-1" /><span>{t}</span></label>
                      ))}
                    </div>

                    <h3 className="mt-6 font-bold text-lg">Declaration</h3>
                    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={declTextAgree} onChange={(e) => setDeclTextAgree(e.target.checked)} className="mt-1" /><span>I declare that I have read and agree with the above rules and regulations. I affirm that the above information is correct to the best of my knowledge. If I violate rules, the institute reserves the right to expel me.</span></label>

                    <div className="mt-6 text-right">
                      <button type="submit" disabled={saving || !canCrud} className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold disabled:opacity-60">{saving ? 'Saving...' : 'Submit'}</button>
                    </div>
                  </>
                )}

                {/* Consultancy Enrollment Form */}
                {enrollmentType === 'consultancy' && (
                  <div className="mt-6">
                    <h3 className="font-bold text-lg">Consultancy - Student Information</h3>

                    {/* Basic Info */}
                    <div className="mt-4">
                      <h4 className="font-semibold">Basic Info</h4>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        <label><span className="text-text-secondary">Full Name</span><input value={consultSf.basic_name} onChange={e => setConsultSf((prev: any) => ({ ...prev, basic_name: e.target.value }))} className="mt-1 w-full border rounded p-2" required /></label>
                        <label><span className="text-text-secondary">Father Name</span><input value={consultSf.basic_father_name} onChange={e => setConsultSf((prev: any) => ({ ...prev, basic_father_name: e.target.value }))} className="mt-1 w-full border rounded p-2" required /></label>
                        <label><span className="text-text-secondary">CNIC</span><input value={consultSf.basic_cnic} onChange={e => setConsultSf((prev: any) => ({ ...prev, basic_cnic: e.target.value.replace(/[^0-9]/g, '') }))} className="mt-1 w-full border rounded p-2" placeholder="13 digits" required /></label>
                        <label><span className="text-text-secondary">Date of Birth</span><input type="date" value={consultSf.basic_dob} onChange={e => setConsultSf((prev: any) => ({ ...prev, basic_dob: e.target.value }))} className="mt-1 w-full border rounded p-2" /></label>
                        <label><span className="text-text-secondary">Date</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={consultSf.basic_date} onChange={e => setConsultSf((prev: any) => ({ ...prev, basic_date: e.target.value }))} className="mt-1 w-full border rounded p-2" /></label>
                        <label className="sm:col-span-2 lg:col-span-3"><span className="text-text-secondary">Address</span><input value={consultSf.basic_address} onChange={e => setConsultSf((prev: any) => ({ ...prev, basic_address: e.target.value }))} className="mt-1 w-full border rounded p-2" /></label>
                        <label><span className="text-text-secondary">Email</span><input type="email" value={consultSf.basic_email} onChange={e => setConsultSf((prev: any) => ({ ...prev, basic_email: e.target.value }))} className="mt-1 w-full border rounded p-2" required /></label>
                        <label><span className="text-text-secondary">Nationality</span><input value={consultSf.basic_nationality} onChange={e => setConsultSf((prev: any) => ({ ...prev, basic_nationality: e.target.value }))} className="mt-1 w-full border rounded p-2" /></label>
                        <label><span className="text-text-secondary">Phone No</span><input value={consultSf.basic_phone} onChange={e => setConsultSf((prev: any) => ({ ...prev, basic_phone: e.target.value }))} className="mt-1 w-full border rounded p-2" required /></label>
                      </div>
                    </div>

                    {/* Undergrad */}
                    <div className="mt-6">
                      <h4 className="font-semibold">For Undergrad</h4>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                        <label className="flex items-center gap-2"><input type="checkbox" checked={consultSf.ug_olevels} onChange={e => setConsultSf((prev: any) => ({ ...prev, ug_olevels: e.target.checked }))} />O-Levels</label>
                        <input placeholder="Year" value={consultSf.ug_olevels_year} onChange={e => setConsultSf((prev: any) => ({ ...prev, ug_olevels_year: e.target.value }))} className="border rounded p-2" />
                        <input placeholder="Grades" value={consultSf.ug_olevels_grades} onChange={e => setConsultSf((prev: any) => ({ ...prev, ug_olevels_grades: e.target.value }))} className="border rounded p-2 lg:col-span-2" />
                        <label className="flex items-center gap-2"><input type="checkbox" checked={consultSf.ug_alevels} onChange={e => setConsultSf((prev: any) => ({ ...prev, ug_alevels: e.target.checked }))} />A-Levels</label>
                        <input placeholder="Year" value={consultSf.ug_alevels_year} onChange={e => setConsultSf((prev: any) => ({ ...prev, ug_alevels_year: e.target.value }))} className="border rounded p-2" />
                        <input placeholder="Grades" value={consultSf.ug_alevels_grades} onChange={e => setConsultSf((prev: any) => ({ ...prev, ug_olevels_grades: e.target.value }))} className="border rounded p-2 lg:col-span-2" />
                        <label className="flex items-center gap-2"><input type="checkbox" checked={consultSf.ug_matric} onChange={e => setConsultSf((prev: any) => ({ ...prev, ug_matric: e.target.checked }))} />Matric</label>
                        <input placeholder="Year" value={consultSf.ug_matric_year} onChange={e => setConsultSf((prev: any) => ({ ...prev, ug_matric_year: e.target.value }))} className="border rounded p-2" />
                        <input placeholder="Grades" value={consultSf.ug_matric_grades} onChange={e => setConsultSf((prev: any) => ({ ...prev, ug_matric_grades: e.target.value }))} className="border rounded p-2 lg:col-span-2" />
                        <label className="flex items-center gap-2"><input type="checkbox" checked={consultSf.ug_hssc} onChange={e => setConsultSf((prev: any) => ({ ...prev, ug_hssc: e.target.checked }))} />HSSC</label>
                        <input placeholder="Year" value={consultSf.ug_hssc_year} onChange={e => setConsultSf((prev: any) => ({ ...prev, ug_hssc_year: e.target.value }))} className="border rounded p-2" />
                        <input placeholder="Grades" value={consultSf.ug_hssc_grades} onChange={e => setConsultSf((prev: any) => ({ ...prev, ug_hssc_grades: e.target.value }))} className="border rounded p-2 lg:col-span-2" />
                        <input placeholder="Other Education" value={consultSf.ug_other} onChange={e => setConsultSf((prev: any) => ({ ...prev, ug_other: e.target.value }))} className="border rounded p-2 sm:col-span-2 lg:col-span-4" />
                      </div>
                    </div>

                    {/* Postgrad */}
                    <div className="mt-6">
                      <h4 className="font-semibold">For Postgrad</h4>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                        <label className="flex items-center gap-2"><input type="checkbox" checked={consultSf.pg_bachelors} onChange={e => setConsultSf((prev: any) => ({ ...prev, pg_bachelors: e.target.checked }))} />Bachelors</label>
                        <input placeholder="University Name" value={consultSf.pg_bachelors_university} onChange={e => setConsultSf((prev: any) => ({ ...prev, pg_bachelors_university: e.target.value }))} className="border rounded p-2 lg:col-span-3" />
                        <input placeholder="Course Name" value={consultSf.pg_bachelors_course} onChange={e => setConsultSf((prev: any) => ({ ...prev, pg_bachelors_course: e.target.value }))} className="border rounded p-2 lg:col-span-2" />
                        <input placeholder="Year" value={consultSf.pg_bachelors_year} onChange={e => setConsultSf((prev: any) => ({ ...prev, pg_bachelors_year: e.target.value }))} className="border rounded p-2" />
                        <input placeholder="Grades" value={consultSf.pg_bachelors_grades} onChange={e => setConsultSf((prev: any) => ({ ...prev, pg_bachelors_grades: e.target.value }))} className="border rounded p-2" />

                        <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={consultSf.pg_masters} onChange={e => setConsultSf((prev: any) => ({ ...prev, pg_masters: e.target.checked }))} />Masters</label>
                        <input placeholder="University Name" value={consultSf.pg_masters_university} onChange={e => setConsultSf((prev: any) => ({ ...prev, pg_masters_university: e.target.value }))} className="border rounded p-2 lg:col-span-3" />
                        <input placeholder="Course Name" value={consultSf.pg_masters_course} onChange={e => setConsultSf((prev: any) => ({ ...prev, pg_masters_course: e.target.value }))} className="border rounded p-2 lg:col-span-2" />
                        <input placeholder="Year" value={consultSf.pg_masters_year} onChange={e => setConsultSf((prev: any) => ({ ...prev, pg_masters_year: e.target.value }))} className="border rounded p-2" />
                        <input placeholder="Grades" value={consultSf.pg_masters_grades} onChange={e => setConsultSf((prev: any) => ({ ...prev, pg_masters_grades: e.target.value }))} className="border rounded p-2" />
                      </div>
                    </div>

                    {/* English Proficiency */}
                    <div className="mt-6">
                      <h4 className="font-semibold">English Proficiency Test</h4>
                      <div className="mt-2 grid grid-cols-2 lg:grid-cols-6 gap-3 text-sm">
                        <label className="flex items-center gap-2"><input type="checkbox" checked={consultSf.eng_ielts} onChange={e => setConsultSf((prev: any) => ({ ...prev, eng_ielts: e.target.checked }))} />IELTS</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={consultSf.eng_toefl} onChange={e => setConsultSf((prev: any) => ({ ...prev, eng_toefl: e.target.checked }))} />TOEFL</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={consultSf.eng_pte} onChange={e => setConsultSf((prev: any) => ({ ...prev, eng_pte: e.target.checked }))} />PTE</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={consultSf.eng_duolingo} onChange={e => setConsultSf((prev: any) => ({ ...prev, eng_duolingo: e.target.checked }))} />Duolingo</label>
                        <input placeholder="Other" value={consultSf.eng_other} onChange={e => setConsultSf((prev: any) => ({ ...prev, eng_other: e.target.value }))} className="border rounded p-2" />
                        <input placeholder="Score" value={consultSf.eng_score} onChange={e => setConsultSf((prev: any) => ({ ...prev, eng_score: e.target.value }))} className="border rounded p-2" />
                      </div>
                    </div>

                    {/* Work Experience */}
                    <div className="mt-6">
                      <h4 className="font-semibold">Work Experience</h4>
                      <textarea value={consultSf.work_exp} onChange={e => setConsultSf((prev: any) => ({ ...prev, work_exp: e.target.value }))} className="mt-2 w-full border rounded p-2 text-sm" rows={3} placeholder="Describe work experience"></textarea>
                    </div>

                    {/* Country of Interest */}
                    <div className="mt-6">
                      <h4 className="font-semibold">Country of Interest</h4>
                      <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                        <label className="flex items-center gap-2"><input type="checkbox" checked={consultSf.coi_uk} onChange={e => setConsultSf((prev: any) => ({ ...prev, coi_uk: e.target.checked }))} />United Kingdom</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={consultSf.coi_usa} onChange={e => setConsultSf((prev: any) => ({ ...prev, coi_usa: e.target.checked }))} />United States of America</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={consultSf.coi_canada} onChange={e => setConsultSf((prev: any) => ({ ...prev, coi_canada: e.target.checked }))} />Canada</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={consultSf.coi_malaysia} onChange={e => setConsultSf((prev: any) => ({ ...prev, coi_malaysia: e.target.checked }))} />Malaysia</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={consultSf.coi_germany} onChange={e => setConsultSf((prev: any) => ({ ...prev, coi_germany: e.target.checked }))} />Germany</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={consultSf.coi_australia} onChange={e => setConsultSf((prev: any) => ({ ...prev, coi_australia: e.target.checked }))} />Australia</label>
                        <input placeholder="Others" value={consultSf.coi_others} onChange={e => setConsultSf((prev: any) => ({ ...prev, coi_others: e.target.value }))} className="border rounded p-2" />
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div className="mt-6">
                      <h4 className="font-semibold">Additional Info</h4>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <label className="sm:col-span-2"><span className="text-text-secondary">Course of interest / University</span><input value={consultSf.add_course_or_uni} onChange={e => setConsultSf((prev: any) => ({ ...prev, add_course_or_uni: e.target.value }))} className="mt-1 w-full border rounded p-2" /></label>
                        <label className="sm:col-span-2"><span className="text-text-secondary">Any travel history</span><input value={consultSf.add_travel_history} onChange={e => setConsultSf((prev: any) => ({ ...prev, add_travel_history: e.target.value }))} className="mt-1 w-full border rounded p-2" /></label>
                        <label><span className="text-text-secondary">Visa refusal (if any)</span><input value={consultSf.add_visa_refusal} onChange={e => setConsultSf((prev: any) => ({ ...prev, add_visa_refusal: e.target.value }))} className="mt-1 w-full border rounded p-2" /></label>
                        <label><span className="text-text-secondary">Any asylum taken by family</span><input value={consultSf.add_asylum_family} onChange={e => setConsultSf((prev: any) => ({ ...prev, add_asylum_family: e.target.value }))} className="mt-1 w-full border rounded p-2" /></label>
                      </div>
                    </div>

                    {/* For Office Use Only */}
                    <div className="mt-6">
                      <h4 className="font-semibold">For Office Use Only</h4>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        <label><span className="text-text-secondary">Date</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={consultSf.office_date} onChange={e => setConsultSf((prev: any) => ({ ...prev, office_date: e.target.value }))} className="mt-1 w-full border rounded p-2" /></label>
                        <label><span className="text-text-secondary">Application Started</span><input value={consultSf.office_application_started} onChange={e => setConsultSf((prev: any) => ({ ...prev, office_application_started: e.target.value }))} className="mt-1 w-full border rounded p-2" /></label>
                        <label><span className="text-text-secondary">University Applied</span><input value={consultSf.office_university_applied} onChange={e => setConsultSf((prev: any) => ({ ...prev, office_university_applied: e.target.value }))} className="mt-1 w-full border rounded p-2" /></label>
                        <label><span className="text-text-secondary">Counsellor Name</span><input value={consultSf.office_counsellor_name} onChange={e => setConsultSf((prev: any) => ({ ...prev, office_counsellor_name: e.target.value }))} className="mt-1 w-full border rounded p-2" /></label>
                        <label><span className="text-text-secondary">Next Follow Up Date</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={consultSf.office_next_follow_up_date} onChange={e => setConsultSf((prev: any) => ({ ...prev, office_next_follow_up_date: e.target.value }))} className="mt-1 w-full border rounded p-2" /></label>
                      </div>
                    </div>

                    <div className="mt-6 text-right">
                      <button type="submit" disabled={saving || !canCrud} className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold disabled:opacity-60">{saving ? 'Saving...' : 'Submit Consultancy'}</button>
                    </div>
                  </div>
                )}

                {/* Test Enrollment Form */}
                {enrollmentType === 'test' && (
                  <div className="mt-6">
                    <h3 className="font-bold text-lg">Test Enrollment</h3>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <label><span className="text-text-secondary">First Name</span><input value={testForm.first_name} onChange={e => setTestForm(prev => ({ ...prev, first_name: e.target.value }))} className="mt-1 w-full border rounded p-2" required /></label>
                      <label><span className="text-text-secondary">Last Name</span><input value={testForm.last_name} onChange={e => setTestForm(prev => ({ ...prev, last_name: e.target.value }))} className="mt-1 w-full border rounded p-2" required /></label>
                      <label><span className="text-text-secondary">Father Name</span><input value={testForm.father_name} onChange={e => setTestForm(prev => ({ ...prev, father_name: e.target.value }))} className="mt-1 w-full border rounded p-2" required /></label>
                      <label><span className="text-text-secondary">CNIC</span><input value={testForm.cnic} onChange={e => setTestForm(prev => ({ ...prev, cnic: e.target.value.replace(/[^0-9]/g, '') }))} className="mt-1 w-full border rounded p-2" placeholder="13 digits" required /></label>
                      <label><span className="text-text-secondary">Email</span><input type="email" value={testForm.email} onChange={e => setTestForm(prev => ({ ...prev, email: e.target.value }))} className="mt-1 w-full border rounded p-2" required /></label>
                      <label><span className="text-text-secondary">Mobile</span><input value={testForm.mobile} onChange={e => setTestForm(prev => ({ ...prev, mobile: e.target.value }))} className="mt-1 w-full border rounded p-2" required /></label>
                      <label className="sm:col-span-2"><span className="text-text-secondary">Address</span><input value={testForm.address} onChange={e => setTestForm(prev => ({ ...prev, address: e.target.value }))} className="mt-1 w-full border rounded p-2" /></label>
                      <label><span className="text-text-secondary">Date of Birth</span><input type="date" value={testForm.date_of_birth} onChange={e => setTestForm(prev => ({ ...prev, date_of_birth: e.target.value }))} className="mt-1 w-full border rounded p-2" /></label>
                      <label><span className="text-text-secondary">Test Type</span>
                        <select value={testForm.test_type} onChange={e => setTestForm(prev => ({ ...prev, test_type: e.target.value as TestEnrollmentForm['test_type'] }))} className="mt-1 w-full border rounded p-2" required>
                          <option value="">Select</option>
                          <option value="IELTS">IELTS</option>
                          <option value="PTE">PTE</option>
                          <option value="TOEFL">TOEFL</option>
                        </select>
                      </label>
                    </div>

                    <div className="mt-6 text-right">
                      <button type="submit" disabled={saving || !canCrud} className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold disabled:opacity-60">{saving ? 'Saving...' : 'Submit Test Enrollment'}</button>
                    </div>
                  </div>
                )}

              </div>

              <aside className="bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a]">
                <h3 className="font-bold text-lg">Student Photo</h3>
                <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} className="mt-2 text-sm" />
                {photoFile && <div className="mt-2 text-xs text-text-secondary">{photoFile.name}</div>}

                <div className="mt-6">
                  <h3 className="font-bold text-lg">Status</h3>
                  <select value={s.status} onChange={e => setS({ ...s, status: e.target.value as Student['status'] })} className="mt-2 w-full border rounded p-2 text-sm">
                    <option>Active</option>
                    <option>Completed</option>
                    <option>Withdrawn</option>
                  </select>
                </div>
              </aside>
            </form>
          )}

          {tab === 'list' && (
            <div className="mt-6">
              <div className="flex flex-wrap items-center gap-2">
                <input placeholder="Search name, CNIC, program, batch" value={search} onChange={e => { setSearch(e.target.value); }} className="w-full sm:w-64 border rounded p-2 text-sm" />
                <select value={fProgram} onChange={e => { setFProgram(e.target.value); }} className="border rounded p-2 text-sm"><option>All</option>{programs.map(p => <option key={p}>{p}</option>)}</select>
                <select value={fBatch} onChange={e => { setFBatch(e.target.value); }} className="border rounded p-2 text-sm"><option>All</option>{batches.map(b => <option key={b}>{b}</option>)}</select>
                <select value={fCity} onChange={e => { setFCity(e.target.value); }} className="border rounded p-2 text-sm"><option>All</option>{cities.map(c => <option key={c}>{c}</option>)}</select>
              </div>

              <div className="mt-4 space-y-8">
                {/* Currently Enrolled */}
                <div>
                  <div className="text-lg font-bold mb-2">Currently Enrolled ({countActive})</div>
                  <div className="overflow-auto bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-2">Student ID</th>
                          <th className="text-left p-2">Full Name</th>
                          <th className="text-left p-2">Program Title</th>
                          <th className="text-left p-2">Batch No.</th>
                          <th className="text-left p-2">Phone</th>
                          <th className="text-left p-2">Email</th>
                          <th className="text-left p-2">City</th>
                          <th className="text-left p-2">Enrollment</th>
                          <th className="text-right p-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.filter(st => st.status === 'Active').map(st => (
                          <tr key={st.id} className="border-t">
                            <td className="p-2">{st.id}</td>
                            <td className="p-2">
                              <button
                                onClick={() => openMockTestsModal(st)}
                                className="text-blue-600 hover:underline font-medium"
                              >
                                {st.full_name}
                              </button>
                            </td>
                            <td className="p-2">{st.program_title}</td>
                            <td className="p-2">{st.batch_no}</td>
                            <td className="p-2">{st.phone}</td>
                            <td className="p-2">{st.email}</td>
                            <td className="p-2">{st.city}</td>
                            <td className="p-2">{formatEnrollmentType(st.enrollment_type)}</td>
                            <td className="p-2 text-right">
                              {canEdit && (<button onClick={() => setEditItem(st)} className="text-blue-600 hover:underline mr-3">Edit</button>)}
                              {canDelete && (<button onClick={() => archiveStudent(st.id)} className="text-red-600 hover:underline">Archive</button>)}
                            </td>
                          </tr>
                        ))}
                        {items.filter(st => st.status === 'Active').length === 0 && (
                          <tr><td className="p-3 text-text-secondary" colSpan={9}>No students in this section</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Completed */}
                <div>
                  <div className="text-lg font-bold mb-2">Completed ({countCompleted})</div>
                  <div className="overflow-auto bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-2">Student ID</th>
                          <th className="text-left p-2">Full Name</th>
                          <th className="text-left p-2">Program Title</th>
                          <th className="text-left p-2">Batch No.</th>
                          <th className="text-left p-2">Phone</th>
                          <th className="text-left p-2">Email</th>
                          <th className="text-left p-2">City</th>
                          <th className="text-left p-2">Enrollment</th>
                          <th className="text-right p-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.filter(st => st.status === 'Completed').map(st => (
                          <tr key={st.id} className="border-t">
                            <td className="p-2">{st.id}</td>
                            <td className="p-2">
                              <button
                                onClick={() => openMockTestsModal(st)}
                                className="text-blue-600 hover:underline font-medium"
                              >
                                {st.full_name}
                              </button>
                            </td>
                            <td className="p-2">{st.program_title}</td>
                            <td className="p-2">{st.batch_no}</td>
                            <td className="p-2">{st.phone}</td>
                            <td className="p-2">{st.email}</td>
                            <td className="p-2">{st.city}</td>
                            <td className="p-2">{formatEnrollmentType(st.enrollment_type)}</td>
                            <td className="p-2 text-right">
                              {canEdit && (<button onClick={() => setEditItem(st)} className="text-blue-600 hover:underline mr-3">Edit</button>)}
                              {canDelete && (<button onClick={() => archiveStudent(st.id)} className="text-red-600 hover:underline">Archive</button>)}
                            </td>
                          </tr>
                        ))}
                        {items.filter(st => st.status === 'Completed').length === 0 && (
                          <tr><td className="p-3 text-text-secondary" colSpan={9}>No students in this section</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Withdrawn */}
                <div>
                  <div className="text-lg font-bold mb-2">Withdrawn ({countWithdrawn})</div>
                  <div className="overflow-auto bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-2">Student ID</th>
                          <th className="text-left p-2">Full Name</th>
                          <th className="text-left p-2">Program Title</th>
                          <th className="text-left p-2">Batch No.</th>
                          <th className="text-left p-2">Phone</th>
                          <th className="text-left p-2">Email</th>
                          <th className="text-left p-2">City</th>
                          <th className="text-left p-2">Enrollment</th>
                          <th className="text-right p-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.filter(st => st.status === 'Withdrawn').map(st => (
                          <tr key={st.id} className="border-t">
                            <td className="p-2">{st.id}</td>
                            <td className="p-2">
                              <button
                                onClick={() => openMockTestsModal(st)}
                                className="text-blue-600 hover:underline font-medium"
                              >
                                {st.full_name}
                              </button>
                            </td>
                            <td className="p-2">{st.program_title}</td>
                            <td className="p-2">{st.batch_no}</td>
                            <td className="p-2">{st.phone}</td>
                            <td className="p-2">{st.email}</td>
                            <td className="p-2">{st.city}</td>
                            <td className="p-2">{formatEnrollmentType(st.enrollment_type)}</td>
                            <td className="p-2 text-right">
                              {canEdit && (<button onClick={() => setEditItem(st)} className="text-blue-600 hover:underline mr-3">Edit</button>)}
                              {canDelete && (<button onClick={() => archiveStudent(st.id)} className="text-red-600 hover:underline">Archive</button>)}
                            </td>
                          </tr>
                        ))}
                        {items.filter(st => st.status === 'Withdrawn').length === 0 && (
                          <tr><td className="p-3 text-text-secondary" colSpan={9}>No students in this section</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {editItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <form onSubmit={saveEdit} className="bg-white w-full max-w-xl rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Edit Student</h3>
              <button type="button" onClick={() => setEditItem(null)} className="text-text-secondary">✕</button>
            </div>
            <div className="mt-1 text-xs text-text-secondary">Enrollment Type: <span className="font-semibold">{formatEnrollmentType(editItem.enrollment_type)}</span></div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label><span className="text-text-secondary">Full Name</span><input value={editItem.full_name} onChange={e => setEditItem({ ...editItem, full_name: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
              <label><span className="text-text-secondary">Father/Guardian Name</span><input value={editItem.father_name} onChange={e => setEditItem({ ...editItem, father_name: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
              <label><span className="text-text-secondary">Phone</span><input value={editItem.phone} onChange={e => setEditItem({ ...editItem, phone: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
              <label><span className="text-text-secondary">Email</span><input value={editItem.email} onChange={e => setEditItem({ ...editItem, email: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
              <label><span className="text-text-secondary">CNIC</span><input value={editItem.cnic} onChange={e => setEditItem({ ...editItem, cnic: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
              <label><span className="text-text-secondary">DOB</span><input type="date" value={editItem.dob} onChange={e => setEditItem({ ...editItem, dob: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
              <label><span className="text-text-secondary">City</span><input value={editItem.city} onChange={e => setEditItem({ ...editItem, city: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
              <label><span className="text-text-secondary">Reference</span><input value={editItem.reference || ''} onChange={e => setEditItem({ ...editItem, reference: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
              <label><span className="text-text-secondary">Program Title</span><input value={editItem.program_title} onChange={e => setEditItem({ ...editItem, program_title: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
              <label><span className="text-text-secondary">Batch No.</span><input value={editItem.batch_no} onChange={e => setEditItem({ ...editItem, batch_no: e.target.value })} className="mt-1 w-full border rounded p-2" /></label>
              <label><span className="text-text-secondary">Status</span><select value={editItem.status} onChange={e => setEditItem({ ...editItem!, status: e.target.value as Student['status'] })} className="mt-1 w-full border rounded p-2"><option>Active</option><option>Completed</option><option>Withdrawn</option></select></label>
            </div>

            {/* Mock Tests Section */}
            <div className="mt-4 border-t pt-4">
              <h4 className="text-sm font-bold mb-2">Mock Test Scores</h4>
              {(() => {
                // Load mock tests when modal opens
                React.useEffect(() => {
                  if (editItem) {
                    (async () => {
                      const { data } = await supabase
                        .from('student_mock_tests')
                        .select('*')
                        .eq('student_id', editItem.id)
                        .order('test_date', { ascending: false });
                      setMockTests(data || []);
                    })();
                  }
                }, [editItem?.id]);

                return null;
              })()}

              {mockTests.length === 0 ? (
                <div className="text-xs text-text-secondary">No mock test scores recorded yet</div>
              ) : (
                <div className="max-h-48 overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-2">Test Name</th>
                        <th className="text-left p-2">Score</th>
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockTests.map((test, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{test.test_name}</td>
                          <td className="p-2 font-semibold">{test.score}</td>
                          <td className="p-2">{new Date(test.test_date).toLocaleDateString()}</td>
                          <td className="p-2">{test.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-5 text-right"><button type="submit" className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold">Save</button></div>
          </form>
        </div>
      )}
      {invoiceOpen && lastCreatedStudent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <form onSubmit={handleCreateInvoice} className="bg-white w-full max-w-lg rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Generate Invoice for {lastCreatedStudent.full_name}</h3>
              <button type="button" onClick={() => setInvoiceOpen(false)} className="text-text-secondary">✕</button>
            </div>
            <div className="mt-3 text-sm space-y-3">
              <div className="text-text-secondary">Student ID: {lastCreatedStudent.id} • Batch: {lastCreatedStudent.batch_no}</div>
              <label className="block"><span className="text-text-secondary">Registration Fee (Rs)</span><input type="number" min={0} value={invReg} onChange={e => setInvReg(e.target.value)} className="mt-1 w-full border rounded p-2" /></label>
              <label className="block"><span className="text-text-secondary">Service Fee (Rs)</span><input type="number" min={0} value={invSvc} onChange={e => setInvSvc(e.target.value)} className="mt-1 w-full border rounded p-2" /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="text-text-secondary">Discount</span><input type="number" min={0} value={invDisc} onChange={e => setInvDisc(e.target.value)} className="mt-1 w-full border rounded p-2" /></label>
                <label className="block"><span className="text-text-secondary">Discount Type</span>
                  <select value={invDiscType} onChange={e => setInvDiscType(e.target.value as 'flat' | 'percent')} className="mt-1 w-full border rounded p-2">
                    <option value="flat">Flat</option>
                    <option value="percent">%</option>
                  </select>
                </label>
              </div>
              <div className="font-semibold">Total Payable: Rs {computeTotal().toLocaleString()}</div>

              <div className="mt-3">
                <div className="text-sm font-semibold mb-1">Payment Option</div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="payopt" value="full" checked={paymentOption === 'full'} onChange={() => setPaymentOption('full')} />
                    <span>Full Payment</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="payopt" value="partial" checked={paymentOption === 'partial'} onChange={() => setPaymentOption('partial')} />
                    <span>Partial Payment</span>
                  </label>
                </div>
              </div>

              {paymentOption === 'partial' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="block"><span className="text-text-secondary">Amount Paid Now (Rs)</span><input type="number" min={0} value={amountPaidNow} onChange={e => setAmountPaidNow(e.target.value)} className="mt-1 w-full border rounded p-2" /></label>
                  <label className="block"><span className="text-text-secondary">Due Date</span><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="mt-1 w-full border rounded p-2" /></label>
                  <div className="sm:col-span-2 text-sm text-text-secondary">Remaining Balance: Rs {Math.max(0, computeTotal() - (Number(amountPaidNow) || 0)).toLocaleString()}</div>
                </div>
              )}
            </div>
            <div className="mt-4 text-right">
              <button type="submit" className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold">Save Invoice</button>
            </div>
          </form>
        </div>
      )}

      {/* Mock Tests Modal */}
      {mockTestsModalOpen && selectedStudentForTests && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-3xl rounded-xl p-6 shadow-xl max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold">Mock Test Scores</h3>
                <div className="text-sm text-text-secondary mt-1">
                  {selectedStudentForTests.full_name} ({selectedStudentForTests.id})
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMockTestsModalOpen(false);
                  setSelectedStudentForTests(null);
                  setMockTests([]);
                }}
                className="text-text-secondary hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            {mockTests.length === 0 ? (
              <div className="text-center py-8 text-text-secondary">
                <p>No mock test scores recorded yet</p>
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-semibold">Test Name</th>
                      <th className="text-left p-3 font-semibold">Score</th>
                      <th className="text-left p-3 font-semibold">Date</th>
                      <th className="text-left p-3 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockTests.map((test, idx) => (
                      <tr key={idx} className="border-t hover:bg-gray-50">
                        <td className="p-3">{test.test_name}</td>
                        <td className="p-3">
                          <span className="font-semibold text-blue-600">{test.score}</span>
                        </td>
                        <td className="p-3">{new Date(test.test_date).toLocaleDateString()}</td>
                        <td className="p-3 text-text-secondary">{test.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 text-xs text-text-secondary">
              Total Tests: {mockTests.length}
            </div>
          </div>
        </div>
      )}

    </main>
  );
};

export default StudentsPage;
