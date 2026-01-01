/**
 * @fileoverview Finances Page
 * 
 * Comprehensive financial management system for the GSL CRM.
 * Handles vouchers, cash flow, revenue tracking, and student payment management.
 * 
 * **Key Features:**
 * - Voucher generation (Cash In/Out, Online, Bank, Transfer)
 * - Student payment tracking with pending students search
 * - Voucher categories (Admission, Installment, Consultancy, Test Fee, Miscellaneous)
 * - PDF generation and storage for vouchers
 * - Excel/CSV export functionality
 * - Real-time updates via Supabase
 * - Role-based permissions (View/CRUD access)
 * - Branch management
 * - Quick Cash Out generator
 * - Bill upload support
 * - Financial charts and analytics
 * 
 * **Voucher Types:**
 * - Cash Receipt, Cash Payment, Online Payment, Bank Deposit, Transfer
 * 
 * **Permissions:**
 * - Super Admin: Full access
 * - Granular permissions: can_add, can_edit, can_delete per user
 * 
 * @module pages/Finances
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { supabase } from '../../lib/supabaseClient';
import { useBranches } from '../../hooks/useBranches';
import { getUserBranch, getBranchFilter } from '../../utils/branchAccess';
import BranchFilter from '../../components/BranchFilter';

import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';


type VoucherStatus = 'Approved' | 'Pending' | 'Rejected';

type VoucherType = 'Cash Receipt' | 'Cash Payment' | 'Online Payment' | 'Bank Deposit' | 'Transfer';


export type VoucherCategory =
  | 'Admission / Enrollment Voucher'
  | 'Installment Voucher'
  | 'Consultancy Payment Voucher'
  | 'Test Fee Voucher'
  | 'Miscellaneous Voucher';

export type VoucherRow = {
  id: string;
  type: 'Cash In' | 'Cash Out' | 'Online' | 'Bank' | 'Transfer';
  amount: number; // positive for in/online/bank, negative for out
  branch: string;
  date: string; // ISO or pretty
  status: VoucherStatus;
  description?: string;
  uploaded_bill?: string; // storage path
  pdf_url?: string;       // stored PDF path in vouchers bucket
};

type DBVoucher = {
  id: string;
  code: string;
  vtype: 'cash_in' | 'cash_out' | 'online' | 'bank' | 'transfer';
  amount: number;
  branch: string;
  occurred_at: string;
  status: VoucherStatus;
  description?: string | null;
  uploaded_bill?: string | null;
  pdf_url?: string | null;
  student_id?: string | null;
  voucher_type?: string | null;
  service_type?: string | null;
  discount?: number | null;
  amount_paid?: number | null;
  amount_unpaid?: number | null;
  due_date?: string | null;
  branch_id?: string | null;
};

export type PendingStudent = {
  student_id: string;
  registration_no: string;
  full_name: string;
  batch_no: string | null;
  program_title: string | null;
  phone: string | null;
  total_fee: number;
  amount_paid: number;
  remaining_amount: number;
  total_discount: number;
  next_due_date: string | null;
};

function mapDbToRow(v: DBVoucher): VoucherRow {
  const typeMap: Record<DBVoucher['vtype'], VoucherRow['type']> = {
    cash_in: 'Cash In', cash_out: 'Cash Out', online: 'Online', bank: 'Bank', transfer: 'Transfer'
  };
  return {
    id: v.code || v.id,
    type: typeMap[v.vtype],
    amount: Number(v.amount),
    branch: v.branch,
    date: v.occurred_at,
    status: v.status,
    description: v.description ?? undefined,
    uploaded_bill: (v as any).uploaded_bill ?? undefined,
    pdf_url: (v as any).pdf_url ?? undefined,
  };
}



const BRANCHES = ['Main Branch', 'North Branch', 'South Branch', 'East Branch', 'West Branch'];
const CASH_OUT_CATEGORIES = ['Salaries', 'Bills', 'Rent', 'Utilities', 'Maintenance', 'Marketing', 'Travel', 'Other'];


const initialVouchers: VoucherRow[] = [
  { id: 'VCH-2024-001', type: 'Cash In', amount: 2450, branch: 'Main Branch', date: '2024-01-15', status: 'Approved' },
  { id: 'VCH-2024-002', type: 'Online', amount: 1250, branch: 'North Branch', date: '2024-01-14', status: 'Pending' },
  { id: 'VCH-2024-003', type: 'Cash Out', amount: -890, branch: 'South Branch', date: '2024-01-13', status: 'Approved' },
];

function voucherTypeToRowType(v: VoucherType): VoucherRow['type'] {
  switch (v) {
    case 'Cash Receipt': return 'Cash In';
    case 'Cash Payment': return 'Cash Out';
    case 'Online Payment': return 'Online';
    case 'Bank Deposit': return 'Bank';
    case 'Transfer': return 'Transfer';
  }
}

function voucherTypeToDbType(v: VoucherType): DBVoucher['vtype'] {
  switch (v) {
    case 'Cash Receipt': return 'cash_in';
    case 'Cash Payment': return 'cash_out';
    case 'Online Payment': return 'online';
    case 'Bank Deposit': return 'bank';
    case 'Transfer': return 'transfer';
  }
}

async function exportExcel(filename: string, rows: VoucherRow[]) {
  try {
    const XLSX: any = await import('xlsx');
    const data = rows.map(r => ({
      Voucher: r.id,
      Type: r.type,
      Amount: r.amount,
      Branch: r.branch,
      Date: new Date(r.date).toLocaleDateString(),
      Status: r.status,
      Description: r.description ?? ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vouchers');
    XLSX.writeFile(wb, filename);
  } catch (e) {
    alert('Excel export requires the xlsx package. Reply yes and I will install it.');
  }
}

async function exportPDF(filename: string, rows: VoucherRow[]) {
  try {
    const doc = new jsPDF();
    const head = [['Voucher ID', 'Type', 'Amount', 'Branch', 'Date', 'Status', 'Description']];
    const body = rows.map(r => [r.id, r.type, r.amount, r.branch, new Date(r.date).toLocaleDateString(), r.status, r.description ?? '']);

    if (typeof (autoTable as any) === 'function') {
      (autoTable as any)(doc, { head, body, styles: { fontSize: 9 } });
    } else if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable({ head, body });
    }

    // Fallback: ensure download triggers reliably on iOS/Safari
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('PDF export error', e);
    alert('Failed to generate PDF. Please check console for details.');
  }
}

function downloadCSV(filename: string, rows: VoucherRow[]) {
  const header = ['Voucher ID', 'Type', 'Amount', 'Branch', 'Date', 'Status', 'Description'];
  const lines = rows.map(r => [r.id, r.type, r.amount, r.branch, r.date, r.status, r.description ?? '']);
  const csv = [header, ...lines]
    .map(arr => arr.map(x => `"${String(x).replace(/\"/g, '\"\"')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Generate a single Voucher PDF for print
function generateVoucherPDF(row: VoucherRow) {
  try {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('GSL Pakistan - Voucher', 14, 18);

    const lines = [
      ['Voucher ID', row.id],
      ['Type', row.type],
      ['Amount', `Rs ${Math.abs(row.amount).toLocaleString()} ${row.amount >= 0 ? '(In)' : '(Out)'}`],

      ['Branch', row.branch],
      ['Date', new Date(row.date).toLocaleString()],
      ['Status', row.status],
      ['Description', row.description || '-'],
    ];

    (autoTable as any)(doc, {
      head: [['Field', 'Value']],
      body: lines,
      startY: 26,
      styles: { fontSize: 11 },
      headStyles: { fillColor: [255, 163, 50] },
    });

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `voucher-${row.id}.pdf`; a.click();
    URL.revokeObjectURL(url);

  } catch (e) {
    console.error('PDF single voucher error', e);
    alert('Failed to generate voucher PDF.');
  }
}

// Generate voucher PDF and upload to Supabase Storage, returning storage path
export async function generateVoucherPDFToStorage(
  row: VoucherRow,
  opts?: { pending?: PendingStudent | null; category?: VoucherCategory | '' }
): Promise<string | null> {
  try {
    const isEnrollmentVoucher = opts?.category === 'Admission / Enrollment Voucher';
    const hasPending = !!opts?.pending;
    const doc = new jsPDF();

    if (isEnrollmentVoucher && hasPending) {
      const p = opts!.pending!;
      const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB') : '-');

      const rawProgram = (p.program_title || '').toString();
      let admissionType: string = 'Course';
      if (/consultancy/i.test(rawProgram)) admissionType = 'Consultancy';
      else if (/test/i.test(rawProgram)) admissionType = 'Test';

      const totalFee = Number(p.total_fee ?? 0);
      const amountPaid = Number(p.amount_paid ?? 0);
      const remaining = Number(p.remaining_amount ?? Math.max(0, totalFee - amountPaid));
      const paymentStatus = remaining <= 0 ? 'Fully Paid' : amountPaid > 0 ? 'Partially Paid' : 'Pending';

      const commonLines: [string, string][] = [
        ['Voucher No', row.id],
        ['Name', p.full_name],
        ['Admission Type', admissionType],
        ['Course / Consultancy / Test Name', rawProgram || '-'],
        ['Branch', row.branch],
        ['Total Fee', `Rs ${totalFee.toLocaleString()}`],
        ['Amount Received', `Rs ${amountPaid.toLocaleString()}`],
        ['Payment Date', fmtDate(row.date)],
        ['Mode of Payment', row.type === 'Cash In' ? 'Cash' : row.type],
        ['Payment Status', paymentStatus],
        ['Due Amount', `Rs ${remaining.toLocaleString()}`],
        ['Due Date for Remaining Amount', fmtDate(p.next_due_date)],
        ['Authorized Sign & Stamp', ''],
      ];

      // --- Student Copy ---
      doc.setFontSize(14);
      doc.text('ENROLLMENT VOUCHER – Student Copy', 105, 18, { align: 'center' });
      doc.setFontSize(11);
      doc.text('Gateway Study Links (SMC-PVT) LTD', 105, 24, { align: 'center' });
      doc.text(
        'Website: www.thegateway.pk  |  Email: accounts@thegateway.pk  |  Phone: +9251-8731234',
        105,
        29,
        { align: 'center' }
      );

      (autoTable as any)(doc, {
        head: [['Field', 'Value']],
        body: commonLines,
        startY: 36,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [255, 163, 50] },
      });

      const firstTable = (doc as any).lastAutoTable;
      const dividerY = firstTable ? firstTable.finalY + 6 : 120;
      doc.setDrawColor(200);
      doc.line(14, dividerY, 196, dividerY);

      // --- Office Copy ---
      const officeStartY = dividerY + 10;
      doc.setFontSize(14);
      doc.text('ENROLLMENT VOUCHER – Office Copy', 105, officeStartY, { align: 'center' });
      doc.setFontSize(11);
      doc.text('Gateway Study Links (SMC-PVT) LTD', 105, officeStartY + 6, { align: 'center' });
      doc.text(
        'Website: www.thegateway.pk  |  Email: accounts@thegateway.pk  |  Phone: +9251-8731234',
        105,
        officeStartY + 11,
        { align: 'center' }
      );

      (autoTable as any)(doc, {
        head: [['Field', 'Value']],
        body: commonLines,
        startY: officeStartY + 18,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [255, 163, 50] },
      });
    } else {
      // Fallback: generic voucher layout
      doc.setFontSize(16);
      doc.text('GSL Pakistan - Voucher', 14, 18);

      const lines: [string, string][] = [
        ['Voucher ID', row.id],
        ['Voucher Type', row.type],
        ['Category', (opts?.category as string) || '-'],
        ['Amount', `Rs ${Math.abs(row.amount).toLocaleString()} ${row.amount >= 0 ? '(In)' : '(Out)'}`],
        ['Branch', row.branch],
        ['Date', new Date(row.date).toLocaleString()],
        ['Status', row.status],
      ];

      if (opts?.pending) {
        const p = opts.pending;
        lines.push(
          ['Student Name', p.full_name],
          ['Registration No', p.registration_no],
          ['Batch No', p.batch_no || '-'],
          ['Course / Service', p.program_title || '-'],
          ['Total Fee', `Rs ${Number(p.total_fee || 0).toLocaleString()}`],
          ['Amount Paid', `Rs ${Number(p.amount_paid || 0).toLocaleString()}`],
          ['Remaining Balance', `Rs ${Number(p.remaining_amount || 0).toLocaleString()}`],
          ['Discount Applied', `Rs ${Number(p.total_discount || 0).toLocaleString()}`],
          ['Next Due Date', p.next_due_date ? new Date(p.next_due_date).toLocaleDateString() : '-']
        );
      }

      if (row.description) {
        lines.push(['Description', row.description]);
      }

      (autoTable as any)(doc, {
        head: [['Field', 'Value']],
        body: lines,
        startY: 26,
        styles: { fontSize: 11 },
        headStyles: { fillColor: [255, 163, 50] },
      });
    }

    const blob = doc.output('blob');
    const path = `vouchers/${row.id}-${Date.now()}.pdf`;

    const upload = await supabase.storage
      .from('vouchers')
      .upload(path, blob, {
        upsert: true,
        cacheControl: '3600',
        contentType: 'application/pdf',
      });

    if (upload.error) {
      console.error('Voucher PDF upload error', upload.error);
      alert('Failed to upload voucher PDF.');
      return null;
    }

    return path;
  } catch (e) {
    console.error('Voucher PDF generate/upload error', e);
    alert('Failed to generate voucher PDF.');
    return null;
  }
}


async function openBill(path: string) {
  try {
    const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, 60);
    if (error || !data?.signedUrl) { alert('Unable to open bill'); return; }
    window.open(data.signedUrl, '_blank');
  } catch (e) {
    console.error('openBill error', e);
    alert('Unable to open bill');
  }
}



const Finances: React.FC = () => {


  // Row actions state
  const [viewVoucher, setViewVoucher] = useState<VoucherRow | null>(null);

  const [viewPdfUrl, setViewPdfUrl] = useState<string | null>(null);
  const [viewPdfLoading, setViewPdfLoading] = useState(false);
  const [viewPdfError, setViewPdfError] = useState<string | null>(null);

  const [editVoucher, setEditVoucher] = useState<VoucherRow | null>(null);
  const [editStatus, setEditStatus] = useState<VoucherStatus>('Pending');

  const [voucherCategory, setVoucherCategory] = useState<VoucherCategory | ''>('');

  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingResults, setPendingResults] = useState<PendingStudent[]>([]);
  const [pendingSelected, setPendingSelected] = useState<PendingStudent | null>(null);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const [editDescription, setEditDescription] = useState<string>('');


  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [voucherType, setVoucherType] = useState<VoucherType | ''>('');
  const [amount, setAmount] = useState<string>('');
  const [branch, setBranch] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [status] = useState<VoucherStatus>('Pending');

  // Universal branches
  const branches = useBranches();
  const branchNames = useMemo(() => branches.map(b => b.branch_name), [branches]);

  const [showAddBranch, setShowAddBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');

  type AccountRow = { student_id: string; name: string; total: number; paid: number; remaining: number; next_due: string | null };
  const [accounts, setAccounts] = useState<AccountRow[]>([]);

  const isValid = useMemo(() => {
    const amt = Number(amount);
    const hasStudent = !!pendingSelected;
    const categoryOk = !hasStudent || voucherCategory !== '';
    return (
      voucherType !== '' &&
      categoryOk &&
      !Number.isNaN(amt) && amt > 0 &&
      branch && description.trim().length > 0
    );
  }, [voucherType, voucherCategory, amount, branch, description, pendingSelected]);

  // Derive branches from data for filters/charts
  const branchList = useMemo(() => {
    const s = new Set<string>();
    vouchers.forEach(v => { if (v.branch) s.add(v.branch); });
    return Array.from(s);
  }, [vouchers]);
  // Quick Cash Out generator state
  const [qCategory, setQCategory] = useState<string>('Salaries');
  const [qAmount, setQAmount] = useState<string>('');
  const [qBranch, setQBranch] = useState<string>('');
  const [qDescription, setQDescription] = useState<string>('Salaries');
  const [qBillFile, setQBillFile] = useState<File | null>(null);
  const [qBillError, setQBillError] = useState<string>('');


  const [finAccess, setFinAccess] = useState<'NONE' | 'VIEW' | 'CRUD'>('NONE'); // legacy fallback
  const [isSuper, setIsSuper] = useState(false);
  const [permFlags, setPermFlags] = useState<{ add: boolean; edit: boolean; del: boolean }>({ add: false, edit: false, del: false });
  const canAdd = isSuper || permFlags.add || finAccess === 'CRUD';
  const canEdit = isSuper || permFlags.edit || finAccess === 'CRUD';
  const canDelete = isSuper || permFlags.del || finAccess === 'CRUD';

  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const email = auth.user?.email;
        if (!email) return;
        const { data: u } = await supabase.from('dashboard_users').select('role, permissions').eq('email', email).maybeSingle();
        const roleStr = (u?.role || (auth.user as any)?.app_metadata?.role || (auth.user as any)?.user_metadata?.role || '').toString().toLowerCase();
        const isSuperRole = roleStr.includes('super');
        setIsSuper(isSuperRole);
        if (isSuperRole) { setFinAccess('CRUD'); setPermFlags({ add: true, edit: true, del: true }); return; }
        const { data: up } = await supabase.from('user_permissions').select('module, access, can_add, can_edit, can_delete').eq('user_email', email).eq('module', 'accounts');
        if (up && up.length) {
          const r: any = up[0];
          setPermFlags({ add: !!r.can_add || r.access === 'CRUD', edit: !!r.can_edit || r.access === 'CRUD', del: !!r.can_delete || r.access === 'CRUD' });
          setFinAccess((r.access as any) === 'CRUD' ? 'CRUD' : 'VIEW');
        } else {
          const perms = Array.isArray(u?.permissions) ? (u?.permissions as any as string[]) : [];
          setFinAccess(perms.includes('accounts') ? 'CRUD' : 'NONE');
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  // Filter states - MUST BE BEFORE useEffect that uses selectedBranch
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 5;




  // Accounts (payment breakdown by student) - with realtime updates
  useEffect(() => {
    let cancelled = false;

    const loadAccounts = async () => {
      try {
        const { data: invs, error } = await supabase
          .from('invoices')
          .select('student_id,total_amount,amount_paid,remaining_amount,due_date')
          .limit(2000);
        if (error) { console.error('Load accounts error', error); if (!cancelled) setAccounts([]); return; }
        const rows = (invs as any[]) || [];
        const ids = Array.from(new Set(rows.map(r => r.student_id).filter(Boolean)));
        let nameMap: Record<string, string> = {};
        if (ids.length) {
          const { data: studs } = await supabase.from('dashboard_students').select('id, full_name').in('id', ids);
          (studs as any[] || []).forEach(s => { nameMap[s.id] = s.full_name; });
        }
        const grouped: Record<string, AccountRow> = {};
        rows.forEach(r => {
          const sid = r.student_id as string;
          if (!sid) return;
          if (!grouped[sid]) grouped[sid] = { student_id: sid, name: nameMap[sid] || sid, total: 0, paid: 0, remaining: 0, next_due: null };
          grouped[sid].total += Number(r.total_amount || 0);
          grouped[sid].paid += Number(r.amount_paid || 0);
          grouped[sid].remaining += Number(r.remaining_amount || 0);
          if (r.due_date && (!grouped[sid].next_due || new Date(r.due_date) < new Date(grouped[sid].next_due!))) grouped[sid].next_due = r.due_date;
        });
        if (!cancelled) setAccounts(Object.values(grouped).sort((a, b) => b.remaining - a.remaining).slice(0, 10));
      } catch (e) {
        console.error('Accounts load error', e);
      }
    };

    loadAccounts();

    // Realtime subscription for invoices
    const channel = supabase
      .channel('public:invoices')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        // Reload accounts data when invoices change
        loadAccounts();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [selectedBranch]); // Added selectedBranch dependency

  // Pending students search (debounced)
  useEffect(() => {
    let cancelled = false;

    const term = pendingSearch.trim();
    if (!term) {
      setPendingResults([]);
      setPendingLoading(false);
      setPendingError(null);
      return;
    }

    const handle = setTimeout(async () => {
      try {
        setPendingLoading(true);
        setPendingError(null);
        const { data, error } = await supabase
          .from('pending_students')
          .select('*')
          .or(
            `full_name.ilike.%${term}%,registration_no.ilike.%${term}%,batch_no.ilike.%${term}%,phone.ilike.%${term}%`
          )
          .limit(20);
        if (cancelled) return;
        if (error) {
          console.error('pending_students search error', error);
          setPendingError('Failed to load pending students');
          setPendingResults([]);
          return;
        }
        setPendingResults((data as any as PendingStudent[]) || []);
      } catch (e) {
        if (cancelled) return;
        console.error('pending_students search error', e);
        setPendingError('Failed to load pending students');
        setPendingResults([]);
      } finally {
        if (!cancelled) setPendingLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [pendingSearch]);

  const handleSelectPendingStudent = (s: PendingStudent) => {
    setPendingSelected(s);
    if (!voucherCategory) {
      setVoucherCategory('Installment Voucher');
    }
    if (!description) {
      setDescription(`Fee voucher for ${s.full_name} (${s.registration_no})`);
    }
    if (!amount && s.remaining_amount != null) {
      setAmount(String(s.remaining_amount));
    }
  };



  const qValid = useMemo(() => {
    const amt = Number(qAmount);
    return qCategory && !Number.isNaN(amt) && amt > 0 && qBranch;
  }, [qCategory, qAmount, qBranch]);



  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !canAdd) return;

    const rowType = voucherTypeToRowType(voucherType as VoucherType);
    const dbType = voucherTypeToDbType(voucherType as VoucherType);
    const amt = Number(amount);
    const signedAmt = rowType === 'Cash Out' ? -Math.abs(amt) : Math.abs(amt);
    const code = `VCH-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
    const occurred_at = new Date().toISOString();

    const branchRow = branches.find(b => b.branch_name === branch);
    const branchId = branchRow?.id ?? null;

    const optimisticRow: VoucherRow = {
      id: code,
      type: rowType,
      amount: signedAmt,
      branch,
      date: occurred_at,
      status,
      description,
      pdf_url: undefined,
    };

    // Optimistic UI update (will be reconciled by realtime)
    setVouchers(prev => ([optimisticRow, ...prev]));

    const payload: any = {
      code,
      vtype: dbType,
      amount: signedAmt,
      branch,
      occurred_at,
      status,
      description,
      branch_id: branchId,
    };

    if (pendingSelected) {
      payload.student_id = pendingSelected.student_id;
      payload.voucher_type = voucherCategory || 'Installment Voucher';
      payload.service_type = pendingSelected.program_title || null;
      payload.discount = pendingSelected.total_discount ?? null;
      payload.amount_paid = pendingSelected.amount_paid ?? null;
      payload.amount_unpaid = pendingSelected.remaining_amount ?? null;
      payload.due_date = pendingSelected.next_due_date ?? null;
    } else if (voucherCategory) {
      payload.voucher_type = voucherCategory;
    }

    const { error } = await supabase.from('vouchers').insert([payload]);
    if (error) {
      // rollback optimistic add if failed
      setVouchers(prev => prev.filter(v => v.id !== code));
      alert(`Failed to create voucher: ${error.message}`);
      return;
    }

    const pdfPath = await generateVoucherPDFToStorage(optimisticRow, {
      pending: pendingSelected,
      category: voucherCategory,
    });

    if (pdfPath) {
      await supabase.from('vouchers').update({ pdf_url: pdfPath }).eq('code', code);
      setVouchers(prev => prev.map(v => (v.id === code ? { ...v, pdf_url: pdfPath } : v)));
    }

    // reset all form fields
    setAmount('');
    setDescription('');
    setPendingSelected(null);
    setPendingSearch('');
    setPendingResults([]);
    setVoucherCategory('');
  };

  // Row action handlers
  const closeViewModal = () => {
    setViewVoucher(null);
    setViewPdfUrl(null);
    setViewPdfError(null);
    setViewPdfLoading(false);
  };

  const onView = async (r: VoucherRow) => {
    setViewVoucher(r);
    setViewPdfUrl(null);
    setViewPdfError(null);

    if (!r.pdf_url) {
      return;
    }

    try {
      setViewPdfLoading(true);
      const { data, error } = await supabase.storage.from('vouchers').createSignedUrl(r.pdf_url, 60 * 5);
      if (error || !data?.signedUrl) {
        console.error('Voucher PDF signed URL error', error);
        setViewPdfError('Unable to open voucher PDF');
        return;
      }
      setViewPdfUrl(data.signedUrl);
    } catch (e) {
      console.error('Voucher PDF open error', e);
      setViewPdfError('Unable to open voucher PDF');
    } finally {
      setViewPdfLoading(false);
    }
  };

  const onEdit = (r: VoucherRow) => { setEditVoucher(r); setEditStatus(r.status); setEditDescription(r.description ?? ''); };
  const onDelete = async (r: VoucherRow) => {
    if (!canDelete) { alert('Not permitted'); return; }
    if (!confirm(`Delete voucher ${r.id}?`)) return;
    // Try by code first
    let { data, error } = await supabase.from('vouchers').delete().eq('code', r.id).select('id,code');
    if (error) { alert(`Failed to delete: ${error.message}`); return; }
    if (!data || data.length === 0) {
      // Fallback: try by id (for legacy rows without code)
      const resp = await supabase.from('vouchers').delete().eq('id', r.id).select('id,code');
      if (resp.error) { alert(`Failed to delete: ${resp.error.message}`); return; }
      data = resp.data as any[];
    }
    if (!data || data.length === 0) { alert('Voucher not found.'); return; }
    // Optimistically remove from UI
    setVouchers(prev => prev.filter(v => v.id !== r.id));
  };
  const onSaveEdit = async () => {
    if (!editVoucher) return;
    if (!canEdit) { alert('Not permitted'); return; }
    const payload = { status: editStatus, description: editDescription } as const;

    // Try update by code first
    let { data, error } = await supabase.from('vouchers')
      .update(payload)
      .eq('code', editVoucher.id)
      .select('id,code,status,description');

    if (!error && (!data || data.length === 0)) {
      // Fallback by id for legacy rows
      const resp = await supabase.from('vouchers')
        .update(payload)
        .eq('id', editVoucher.id)
        .select('id,code,status,description');
      error = resp.error as any;
      data = resp.data as any[];
    }

    if (error) { alert(`Failed to update: ${error.message}`); return; }
    if (!data || data.length === 0) { alert('Voucher not found.'); return; }

    // Optimistic UI update
    setVouchers(prev => prev.map(v => v.id === editVoucher.id ? { ...v, status: editStatus, description: editDescription } : v));
    setEditVoucher(null);
  };

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    // Branch filtering is now done at database level via RLS and selectedBranch
    return vouchers.filter(v => (
      v.id.toLowerCase().includes(term) ||
      v.type.toLowerCase().includes(term) ||
      v.branch.toLowerCase().includes(term) ||
      (v.description?.toLowerCase().includes(term) ?? false)
    ));
  }, [vouchers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Quick Cash Out submission
  const handleGenerateCashOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qValid || !canAdd) return;

    const rowType: VoucherRow['type'] = 'Cash Out';
    const dbType: DBVoucher['vtype'] = 'cash_out';
    const amt = Number(qAmount);
    const signedAmt = -Math.abs(amt);
    const code = `VCH-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
    const occurred_at = new Date().toISOString();

    const desc = qDescription?.trim() ? qDescription : qCategory;

    const branchRow = branches.find(b => b.branch_name === qBranch);
    const branchId = branchRow?.id ?? null;

    const optimisticRow: VoucherRow = {
      id: code,
      type: rowType,
      amount: signedAmt,
      branch: qBranch,
      date: occurred_at,
      status,
      description: desc,
      pdf_url: undefined,
    };

    setVouchers(prev => ([optimisticRow, ...prev]));

    const payload: any = {
      code,
      vtype: dbType,
      amount: signedAmt,
      branch: qBranch,
      occurred_at,
      status,
      description: desc,
      branch_id: branchId,
    };

    const { error } = await supabase.from('vouchers').insert([payload]);
    if (error) {
      setVouchers(prev => prev.filter(v => v.id !== code));
      alert(`Failed to create voucher: ${error.message}`);
      return;
    }

    // Optional bill upload
    if (qBillFile) {
      const file = qBillFile;
      const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!allowed.includes(file.type)) {
        setQBillError('Only PDF, JPG, or PNG allowed');
      } else if (file.size > 5 * 1024 * 1024) {
        setQBillError('Max file size is 5MB');
      } else {
        setQBillError('');
        const path = `cashout/${code}/bill_${Date.now()}_${file.name}`;
        const upload = await supabase.storage.from('attachments').upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type });
        if (upload.error) {
          console.error('Upload error', upload.error);
          alert('Failed to upload bill');
        } else {
          const upd = await supabase.from('vouchers').update({ uploaded_bill: path }).eq('code', code);
          if (upd.error) {
            console.error('Set bill path error', upd.error);
          }
          setVouchers(prev => prev.map(v => v.id === code ? { ...v, uploaded_bill: path } : v));
        }
      }
    }

    const pdfPath = await generateVoucherPDFToStorage(optimisticRow);
    if (pdfPath) {
      await supabase.from('vouchers').update({ pdf_url: pdfPath }).eq('code', code);
      setVouchers(prev => prev.map(v => (v.id === code ? { ...v, pdf_url: pdfPath } : v)));
    }

    setQAmount('');
    setQBranch('');
    setQDescription(qCategory);
    setQBillFile(null);
    setQBillError('');
  };

  const branchChartData = useMemo(() => {
    const branchesList = branchList.length ? branchList : branchNames;
    const map = new Map<string, number>();
    branchesList.forEach(b => map.set(b, 0));
    vouchers.forEach(v => {
      if (v.status === 'Approved' && v.amount > 0) {
        map.set(v.branch, (map.get(v.branch) || 0) + v.amount);
      }
    });
    return branchesList.map(b => ({ branch: b, revenue: map.get(b) || 0 }));
  }, [vouchers, branchList, branchNames]);

  const methodChartData = useMemo(() => {
    const approved = vouchers.filter(v => v.status === 'Approved');
    const bank = approved.filter(v => v.type === 'Bank' && v.amount > 0).reduce((s, v) => s + v.amount, 0);
    const cash = approved.filter(v => v.type === 'Cash In' && v.amount > 0).reduce((s, v) => s + v.amount, 0);
    const online = approved.filter(v => v.type === 'Online' && v.amount > 0).reduce((s, v) => s + v.amount, 0);
    const total = bank + cash + online || 1; // avoid NaN
    return [
      { name: 'Cash', value: cash, pct: Math.round((cash / total) * 100) },
      { name: 'Online', value: online, pct: Math.round((online / total) * 100) },
      { name: 'Bank', value: bank, pct: Math.round((bank / total) * 100) },
    ];
  }, [vouchers]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Get branch filter
      const branchFilter = await getBranchFilter(supabase, selectedBranch);

      let query = supabase
        .from('vouchers')
        .select('*');

      // Apply branch filter if specified
      if (branchFilter) {
        query = query.eq('branch', branchFilter);
      }

      const { data, error } = await query
        .order('occurred_at', { ascending: false })
        .limit(5000); // Increased limit to ensure all data is loaded for charts

      if (!cancelled && data) setVouchers(data.map(mapDbToRow));
      if (error) console.error('Load vouchers error', error);
    };
    load();

    const channel = supabase
      .channel('public:vouchers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vouchers' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newRow = mapDbToRow(payload.new as DBVoucher);
          setVouchers(prev => [newRow, ...prev.filter(p => p.id !== newRow.id)]);
        } else if (payload.eventType === 'UPDATE') {
          const newRow = mapDbToRow(payload.new as DBVoucher);
          setVouchers(prev => prev.map(p => p.id === newRow.id ? newRow : p));
        } else if (payload.eventType === 'DELETE') {
          const oldAny = payload.old as any;
          const id = oldAny.code || oldAny.id;
          setVouchers(prev => prev.filter(p => p.id !== id));
        }
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    const prevMonth = (curMonth + 11) % 12;
    const prevYear = curMonth === 0 ? curYear - 1 : curYear;

    const sum = { cur: { cashIn: 0, cashOut: 0, online: 0, bank: 0 }, prev: { cashIn: 0, cashOut: 0, online: 0, bank: 0 } };
    const add = (bucket: any, r: VoucherRow) => {
      if (r.type === 'Cash In') bucket.cashIn += Math.max(0, r.amount);
      if (r.type === 'Cash Out') bucket.cashOut += Math.abs(Math.min(0, r.amount));
      if (r.type === 'Online') bucket.online += Math.max(0, r.amount);
      if (r.type === 'Bank') bucket.bank += Math.max(0, r.amount);
    };

    for (const r of vouchers) {
      if (r.status !== 'Approved') continue; // treat Approved as Paid for stats
      const d = new Date(r.date);
      if (d.getFullYear() === curYear && d.getMonth() === curMonth) add(sum.cur, r);
      else if (d.getFullYear() === prevYear && d.getMonth() === prevMonth) add(sum.prev, r);
    }

    const pct = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return ((cur - prev) / prev) * 100;
    };

    return {
      cashIn: { value: sum.cur.cashIn, pct: pct(sum.cur.cashIn, sum.prev.cashIn) },


      cashOut: { value: sum.cur.cashOut, pct: pct(sum.cur.cashOut, sum.prev.cashOut) },
      online: { value: sum.cur.online, pct: pct(sum.cur.online, sum.prev.online) },
      bank: { value: sum.cur.bank, pct: pct(sum.cur.bank, sum.prev.bank) },
    };
  }, [vouchers]);



  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuper) { alert('Only Super Admin can add branches'); return; }
    const name = newBranchName.trim();
    const code = newBranchCode.trim();
    if (!name || !code) return;
    const { error } = await supabase.from('branches').insert([{ branch_name: name, branch_code: code }]);
    if (error) { alert(`Failed to add branch: ${error.message}`); return; }
    setShowAddBranch(false);
    setNewBranchName('');
    setNewBranchCode('');
  };

  return (

    <>
      <Helmet>
        <title>Finances | GSL Pakistan CRM</title>
        <meta name="description" content="Track cash flow, expenses, revenue, and financial reports." />
      </Helmet>

      <main className="w-full min-h-screen bg-background-main flex">
        <div className="w-[14%] min-w-[200px] hidden lg:block">


          <Sidebar />
        </div>

        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          <section className="mt-8 lg:mt-12">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-4xl text-text-primary mb-3" style={{ fontFamily: 'Nunito Sans' }}>
              Quick Stats and Overview
            </h1>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {/* Cash In */}
              <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary font-semibold" style={{ fontFamily: 'Nunito Sans' }}>Cash In</span>
                  <img src="/images/img_icn_general_upload.svg" alt="cash in" className="w-6 h-6" />
                </div>
                <div className="mt-2 text-3xl font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Rs {stats.cashIn.value.toLocaleString()}</div>
                <div className={`mt-1 text-sm font-semibold ${stats.cashIn.pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{`${stats.cashIn.pct >= 0 ? '+' : ''}${stats.cashIn.pct.toFixed(1)}% from last month`}</div>
              </div>
              {/* Cash Out */}
              <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary font-semibold" style={{ fontFamily: 'Nunito Sans' }}>Cash Out</span>
                  <img src="/images/img_icn_general_attach.svg" alt="cash out" className="w-6 h-6" />
                </div>
                <div className="mt-2 text-3xl font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Rs {stats.cashOut.value.toLocaleString()}</div>
                <div className={`mt-1 text-sm font-semibold ${stats.cashOut.pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{`${stats.cashOut.pct >= 0 ? '+' : ''}${stats.cashOut.pct.toFixed(1)}% from last month`}</div>
              </div>
              {/* Online Payments */}
              <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary font-semibold" style={{ fontFamily: 'Nunito Sans' }}>Online Payments</span>
                  <img src="/images/img_icn_general_time_filled.svg" alt="online" className="w-6 h-6" />
                </div>
                <div className="mt-2 text-3xl font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Rs {stats.online.value.toLocaleString()}</div>
                <div className="mt-1 text-sm font-semibold text-orange-500">{`${stats.online.pct >= 0 ? '+' : ''}${stats.online.pct.toFixed(1)}% from last month`}</div>
              </div>
              {/* Bank Deposits */}
              <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary font-semibold" style={{ fontFamily: 'Nunito Sans' }}>Bank Deposits</span>
                  <img src="/images/img_notifications.svg" alt="bank" className="w-6 h-6" />
                </div>
                <div className="mt-2 text-3xl font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Rs {stats.bank.value.toLocaleString()}</div>
                <div className="mt-1 text-sm font-semibold text-purple-600">{`${stats.bank.pct >= 0 ? '+' : ''}${stats.bank.pct.toFixed(1)}% from last month`}</div>
              </div>
            </div>
          </section>
          {/* Generate Voucher + Shortcuts */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Form (span 2) */}
            <form onSubmit={handleGenerate} className="lg:col-span-2 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-5">
              <h2 className="text-lg font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Generate Voucher</h2>

              {/* Pending students search */}
              <div className="mt-4">
                <label className="text-sm font-semibold text-text-secondary">Pending Students</label>
                <input
                  type="text"
                  value={pendingSearch}
                  onChange={(e) => setPendingSearch(e.target.value)}
                  placeholder="Search by name, registration no, batch, phone"
                  className="mt-1 w-full border rounded-lg p-2"
                />
                {pendingError && (
                  <p className="mt-1 text-xs text-red-600">{pendingError}</p>
                )}
                {pendingLoading && !pendingError && (
                  <p className="mt-1 text-xs text-text-secondary">Loading pending students...</p>
                )}
                {!pendingLoading && !pendingError && pendingResults.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-auto border rounded-lg bg-white shadow-sm text-sm">
                    {pendingResults.map(s => (
                      <button
                        key={s.student_id}
                        type="button"
                        onClick={() => handleSelectPendingStudent(s)}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${pendingSelected?.student_id === s.student_id ? 'bg-orange-50' : ''}`}
                      >
                        <div className="font-semibold">{s.full_name}</div>
                        <div className="text-xs text-text-secondary">
                          {s.registration_no}  b7 {s.batch_no || 'No batch'}  b7 {s.phone || 'No phone'}
                        </div>
                        <div className="text-xs text-green-700">
                          Remaining: Rs {s.remaining_amount.toLocaleString()}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {pendingSelected && (
                  <div className="mt-2 text-xs border rounded-lg p-2 bg-gray-50">
                    <div className="font-semibold">{pendingSelected.full_name}</div>
                    <div className="text-text-secondary">
                      Reg: {pendingSelected.registration_no}  b7 Batch: {pendingSelected.batch_no || '-'}
                    </div>
                    <div className="text-green-700">
                      Remaining Amount: Rs {pendingSelected.remaining_amount.toLocaleString()}
                    </div>
                    {pendingSelected.next_due_date && (
                      <div className="text-text-secondary">
                        Due Date: {new Date(pendingSelected.next_due_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-text-secondary">Voucher Type</label>
                  <select value={voucherType as string} onChange={(e) => setVoucherType(e.target.value as VoucherType)} className="mt-1 w-full border rounded-lg p-2">
                    <option value="">Select...</option>
                    <option>Cash Receipt</option>
                    <option>Cash Payment</option>
                    <option>Online Payment</option>
                    <option>Bank Deposit</option>
                    <option>Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-text-secondary">Voucher Category</label>
                  <select
                    value={voucherCategory as string}
                    onChange={(e) => setVoucherCategory(e.target.value as VoucherCategory | '')}
                    className="mt-1 w-full border rounded-lg p-2"
                  >
                    <option value="">Select...</option>
                    <option>Admission / Enrollment Voucher</option>
                    <option>Installment Voucher</option>
                    <option>Consultancy Payment Voucher</option>
                    <option>Test Fee Voucher</option>
                    <option>Miscellaneous Voucher</option>
                  </select>
                  {pendingSelected && (
                    <p className="mt-1 text-xs text-text-secondary">
                      Remaining Amount: Rs {pendingSelected.remaining_amount.toLocaleString()}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold text-text-secondary">Amount (Rs)</label>
                  <input type="number" min={0} placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full border rounded-lg p-2" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-text-secondary">Branch</label>
                  <select value={branch} onChange={(e) => setBranch(e.target.value)} className="mt-1 w-full border rounded-lg p-2">
                    <option value="">Select Branch...</option>
                    {branchNames.map(b => (<option key={b} value={b}>{b}</option>))}
                  </select>
                  {isSuper && (<button type="button" onClick={() => setShowAddBranch(true)} className="mt-1 text-xs text-[#ffa332] underline">Add Branch</button>)}
                </div>
                <div>
                  <label className="text-sm font-semibold text-text-secondary">Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full border rounded-lg p-2" placeholder="Short note about this voucher" />
                </div>
              </div>
              <div className="mt-4">
                <button disabled={!isValid || !canAdd} className={`px-4 py-2 rounded-lg font-bold ${(isValid && canAdd) ? 'bg-[#ffa332] text-white shadow-[0px_6px_12px_#3f8cff43]' : 'bg-gray-200 text-gray-400'}`}>Generate Voucher</button>
              </div>
            </form>

            {/* Right: Cash Out Voucher Generator */}
            <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-5">
              <h2 className="text-lg font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Cash Out Voucher Generator</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {CASH_OUT_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => { setQCategory(cat); setQDescription(cat); }}
                    className={`px-3 py-1 rounded-full border text-sm ${qCategory === cat ? 'bg-orange-50 border-[#ffa332] text-[#ffa332]' : 'hover:bg-gray-50'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <form onSubmit={handleGenerateCashOut} className="mt-4 grid grid-cols-1 gap-3">
                <div>
                  <label className="text-sm font-semibold text-text-secondary">Amount (Rs)</label>
                  <input type="number" min={0} placeholder="0" value={qAmount} onChange={(e) => setQAmount(e.target.value)} className="mt-1 w-full border rounded-lg p-2" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-text-secondary">Branch</label>
                  <select value={qBranch} onChange={(e) => setQBranch(e.target.value)} className="mt-1 w-full border rounded-lg p-2">
                    <option value="">Select Branch...</option>
                    {branchNames.map(b => (<option key={b} value={b}>{b}</option>))}
                  </select>
                  {isSuper && (<button type="button" onClick={() => setShowAddBranch(true)} className="mt-1 text-xs text-[#ffa332] underline">Add Branch</button>)}
                </div>
                <div>
                  <label className="text-sm font-semibold text-text-secondary">Description</label>
                  <textarea value={qDescription} onChange={(e) => setQDescription(e.target.value)} rows={3} className="mt-1 w-full border rounded-lg p-2" placeholder={`e.g. ${qCategory} for May`} />
                </div>
                <div>
                  <label className="text-sm font-semibold text-text-secondary">Upload Bill (optional)</label>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      if (!f) { setQBillFile(null); setQBillError(''); return; }
                      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(f.type)) { setQBillError('Only PDF, JPG, or PNG allowed'); setQBillFile(null); return; }
                      if (f.size > 5 * 1024 * 1024) { setQBillError('Max file size is 5MB'); setQBillFile(null); return; }
                      setQBillError('');
                      setQBillFile(f);
                    }}
                    className="mt-1 w-full border rounded-lg p-2"
                  />
                  {qBillFile && <div className="text-xs text-text-secondary mt-1">{qBillFile.name}</div>}
                  {qBillError && <div className="text-xs text-red-600 mt-1">{qBillError}</div>}
                </div>

                <div className="mt-1">
                  <button disabled={!qValid || !!qBillError || !canAdd} className={`px-4 py-2 rounded-lg font-bold ${(qValid && !qBillError && canAdd) ? 'bg-[#ffa332] text-white shadow-[0px_6px_12px_#3f8cff43]' : 'bg-gray-200 text-gray-400'}`}>Generate Cash Out</button>
                </div>
              </form>
            </div>
          </div>
          {/* Recent Vouchers */}
          <div className="mt-10 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <h2 className="text-lg font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Recent Vouchers</h2>
              <div className="flex flex-col md:flex-row gap-3 md:items-center">
                <BranchFilter
                  value={selectedBranch}
                  onChange={(value) => { setSelectedBranch(value); setPage(1); }}
                  showAllOption={true}
                />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search..." className="border rounded-lg p-2" />
                <div className="flex gap-2">
                  <button onClick={() => downloadCSV('vouchers.csv', filtered)} className="px-3 py-2 border rounded-lg hover:bg-gray-50">CSV</button>
                  <button onClick={() => exportExcel('vouchers.xlsx', filtered)} className="px-3 py-2 border rounded-lg hover:bg-gray-50">Excel</button>
                  <button onClick={() => exportPDF('vouchers.pdf', filtered)} className="px-3 py-2 border rounded-lg hover:bg-gray-50">PDF</button>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="text-sm text-text-secondary">
                    <th className="py-2 pr-4">Voucher ID</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Branch</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>

                  {pageRows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="py-2 pr-4 font-semibold">#{r.id}</td>
                      <td className="py-2 pr-4">{r.type}</td>
                      <td className={`py-2 pr-4 font-semibold ${r.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{r.amount >= 0 ? '+' : '-'}{`Rs ${Math.abs(r.amount).toLocaleString()}`}</td>
                      <td className="py-2 pr-4">{r.branch}</td>
                      <td className="py-2 pr-4">{new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}</td>
                      <td className="py-2 pr-4">
                        <span className={`${r.status === 'Approved' ? 'bg-green-100 text-green-700' : r.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'} px-2 py-1 rounded-full text-xs font-bold`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex gap-2 text-sm">
                          {r.uploaded_bill && (
                            <button type="button" onClick={() => openBill(r.uploaded_bill!)} className="text-green-700 hover:underline">Bill</button>
                          )}
                          <button type="button" onClick={() => onView(r)} className="text-blue-600 hover:underline">View</button>
                          {canEdit && (<button type="button" onClick={() => onEdit(r)} className="text-orange-600 hover:underline">Edit</button>)}
                          {canDelete && (<button type="button" onClick={() => onDelete(r)} className="text-red-600 hover:underline">Delete</button>)}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-text-secondary py-6">No vouchers to display</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-text-secondary">Page {page} of {totalPages}</div>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className={`px-3 py-1 rounded border ${page <= 1 ? 'text-gray-300' : 'hover:bg-gray-50'}`}>Prev</button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className={`px-3 py-1 rounded border ${page >= totalPages ? 'text-gray-300' : 'hover:bg-gray-50'}`}>Next</button>
              </div>
            </div>
          </div>

          {/* Charts */}
          {/* Accounts Section */}
          <div className="mt-10 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-5">
            <h2 className="text-lg font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Accounts (Top Outstanding)</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="text-sm text-text-secondary">
                    <th className="py-2 pr-4">Student</th>
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2 pr-4">Paid</th>
                    <th className="py-2 pr-4">Remaining</th>
                    <th className="py-2 pr-4">Next Due</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(a => (
                    <tr key={a.student_id} className="border-t">
                      <td className="py-2 pr-4 font-semibold">{a.name}</td>
                      <td className="py-2 pr-4">Rs {a.total.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-green-700">Rs {a.paid.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-red-600">Rs {a.remaining.toLocaleString()}</td>
                      <td className="py-2 pr-4">{a.next_due ? new Date(a.next_due).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                  {accounts.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-text-secondary py-6">No account data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Branch Performance (Bar) */}
            <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-5">
              <h2 className="text-lg font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Branch Performance</h2>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="branch" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#3f8cff" />
                  </BarChart>


                </ResponsiveContainer>
              </div>
            </div>

            {/* Payment Methods (Pie) */}
            <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-5">
              <h2 className="text-lg font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Payment Methods Distribution</h2>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip formatter={(v: any, n: any) => [`Rs ${Number(v).toLocaleString()}`, n as string]} />
                    <Legend />
                    <Pie data={methodChartData} dataKey="value" nameKey="name" outerRadius={90} label={(e) => `${e.name} ${e.pct}%`}>


                      {methodChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={["#22c55e", "#fb923c", "#8b5cf6"][index]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>



          {/* View Modal */}
          {viewVoucher && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-5 w-full max-w-3xl shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Voucher #{viewVoucher.id}</h3>
                  <button
                    type="button"
                    onClick={closeViewModal}
                    className="text-text-secondary hover:opacity-70"
                  >
                    ✕
                  </button>
                </div>

                {/* Basic info */}
                <div className="mt-3 text-sm space-y-1">
                  <div><span className="text-text-secondary">Type:</span> {viewVoucher.type}</div>
                  <div>
                    <span className="text-text-secondary">Amount:</span>{' '}
                    Rs {Math.abs(viewVoucher.amount).toLocaleString()} {viewVoucher.amount >= 0 ? '(In)' : '(Out)'}
                  </div>
                  <div><span className="text-text-secondary">Branch:</span> {viewVoucher.branch}</div>
                  <div><span className="text-text-secondary">Date:</span> {new Date(viewVoucher.date).toLocaleString()}</div>
                  <div><span className="text-text-secondary">Status:</span> {viewVoucher.status}</div>
                  {viewVoucher.description && (
                    <div><span className="text-text-secondary">Description:</span> {viewVoucher.description}</div>
                  )}
                  {viewVoucher.uploaded_bill && (
                    <div>
                      <span className="text-text-secondary">Bill:</span>{' '}
                      <button
                        type="button"
                        onClick={() => openBill(viewVoucher.uploaded_bill!)}
                        className="text-green-700 underline"
                      >
                        Open
                      </button>
                    </div>
                  )}
                </div>

                {/* PDF viewer */}
                {viewVoucher.pdf_url ? (
                  <div className="mt-4">
                    {viewPdfLoading && (
                      <p className="text-sm text-text-secondary">Loading voucher PDF...</p>
                    )}
                    {viewPdfError && (
                      <p className="text-sm text-red-600">{viewPdfError}</p>
                    )}
                    {viewPdfUrl && !viewPdfLoading && !viewPdfError && (
                      <>
                        <div className="mt-2 border rounded-lg overflow-hidden h-96">
                          <iframe
                            src={viewPdfUrl}
                            title={`Voucher ${viewVoucher.id} PDF`}
                            className="w-full h-full"
                          />
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => window.open(viewPdfUrl!, '_blank')}
                            className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
                          >
                            Open in new tab
                          </button>
                          <a
                            href={viewPdfUrl!}
                            download={`voucher-${viewVoucher.id}.pdf`}
                            className="px-3 py-2 rounded bg-[#ffa332] text-white text-sm shadow-[0px_6px_12px_#3f8cff43] hover:opacity-90"
                          >
                            Download PDF
                          </a>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-text-secondary">
                    <p>No stored PDF found for this voucher yet.</p>
                    <button
                      type="button"
                      onClick={() => generateVoucherPDF(viewVoucher!)}
                      className="mt-2 px-3 py-2 rounded bg-[#ffa332] text-white text-sm shadow-[0px_6px_12px_#3f8cff43] hover:opacity-90"
                    >
                      Download PDF
                    </button>
                  </div>
                )}

                <div className="mt-4 text-right">
                  <button
                    type="button"
                    onClick={closeViewModal}
                    className="px-3 py-2 border rounded hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Modal */}
          {editVoucher && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-5 w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Edit Voucher #{editVoucher.id}</h3>


                  <button type="button" onClick={() => setEditVoucher(null)} className="text-text-secondary hover:opacity-70">✕</button>
                </div>
                <div className="mt-3 space-y-3">
                  <label className="block text-sm">
                    <span className="text-text-secondary">Status</span>
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as VoucherStatus)} className="mt-1 w-full border rounded p-2">
                      <option>Pending</option>
                      <option>Approved</option>
                      <option>Rejected</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-text-secondary">Description</span>
                    <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="mt-1 w-full border rounded p-2" rows={3} />
                  </label>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setEditVoucher(null)} className="px-3 py-2 border rounded hover:bg-gray-50">Cancel</button>
                  <button type="button" onClick={onSaveEdit} className="px-3 py-2 rounded bg-[#ffa332] text-white shadow-[0px_6px_12px_#3f8cff43] hover:opacity-90">Save</button>
                </div>
              </div>
            </div>
          )}

          {/* Add Branch Modal (Super Admin only) */}
          {showAddBranch && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-5 w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Add New Branch</h3>
                  <button type="button" onClick={() => setShowAddBranch(false)} className="text-text-secondary hover:opacity-70">✕</button>
                </div>
                <form onSubmit={handleAddBranch} className="mt-4 space-y-3">
                  <label className="block text-sm">
                    <span className="text-text-secondary">Branch Name</span>
                    <input value={newBranchName} onChange={e => setNewBranchName(e.target.value)} className="mt-1 w-full border rounded p-2" required />
                  </label>
                  <label className="block text-sm">
                    <span className="text-text-secondary">Branch Code</span>
                    <input value={newBranchCode} onChange={e => setNewBranchCode(e.target.value)} className="mt-1 w-full border rounded p-2" required />
                  </label>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowAddBranch(false)} className="px-3 py-2 border rounded hover:bg-gray-50">Cancel</button>
                    <button type="submit" className="px-3 py-2 rounded bg-[#ffa332] text-white">Add Branch</button>
                  </div>
                </form>
              </div>
            </div>
          )}


        </div>
      </main>
    </>
  );
};

export default Finances;

