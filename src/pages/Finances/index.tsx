import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { supabase } from '../../lib/supabaseClient';

import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';


type VoucherStatus = 'Approved' | 'Pending' | 'Rejected';

type VoucherType = 'Cash Receipt' | 'Cash Payment' | 'Online Payment' | 'Bank Deposit' | 'Transfer';

type VoucherRow = {
  id: string;
  type: 'Cash In' | 'Cash Out' | 'Online' | 'Bank' | 'Transfer';
  amount: number; // positive for in/online/bank, negative for out
  branch: string;
  date: string; // ISO or pretty
  status: VoucherStatus;
  description?: string;
  uploaded_bill?: string; // storage path
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
  };
}



const BRANCHES = ['Main Branch', 'North Branch', 'South Branch', 'East Branch', 'West Branch'];
const CASH_OUT_CATEGORIES = ['Salaries','Bills','Rent','Utilities','Maintenance','Marketing','Travel','Other'];


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
    const head = [['Voucher ID','Type','Amount','Branch','Date','Status','Description']];
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
  const header = ['Voucher ID','Type','Amount','Branch','Date','Status','Description'];
  const lines = rows.map(r => [r.id, r.type, r.amount, r.branch, r.date, r.status, r.description ?? '']);
  const csv = [header, ...lines]
    .map(arr => arr.map(x => `"${String(x).replace(/\"/g,'\"\"')}"`).join(','))
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
      ['Amount', `Rs ${Math.abs(row.amount).toLocaleString()} ${row.amount>=0?'(In)':'(Out)'}`],

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
  const [editVoucher, setEditVoucher] = useState<VoucherRow | null>(null);
  const [editStatus, setEditStatus] = useState<VoucherStatus>('Pending');
  const [editDescription, setEditDescription] = useState<string>('');


  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [voucherType, setVoucherType] = useState<VoucherType | ''>('');
  const [amount, setAmount] = useState<string>('');
  const [branch, setBranch] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [status] = useState<VoucherStatus>('Pending');

  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('All Branches');
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const isValid = useMemo(() => {
    const amt = Number(amount);
    return (
      voucherType !== '' &&
      !Number.isNaN(amt) && amt > 0 &&
      branch && description.trim().length > 0
    );
  }, [voucherType, amount, branch, description]);

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


	  const [finAccess, setFinAccess] = useState<'NONE'|'VIEW'|'CRUD'>('NONE');
	  const canCrud = finAccess === 'CRUD';

	  useEffect(() => {
	    (async () => {
	      try {
	        const { data: auth } = await supabase.auth.getUser();
	        const email = auth.user?.email;
	        if (!email) return;
	        const { data: u } = await supabase.from('dashboard_users').select('role, permissions').eq('email', email).maybeSingle();
	        const roleStr = (u?.role || (auth.user as any)?.app_metadata?.role || (auth.user as any)?.user_metadata?.role || '').toString().toLowerCase();
	        if (roleStr.includes('super')) { setFinAccess('CRUD'); return; }
	        const { data: up } = await supabase.from('user_permissions').select('module, access').eq('user_email', email).eq('module', 'accounts');
	        if (up && up.length) {
	          setFinAccess((up[0].access as any) === 'CRUD' ? 'CRUD' : 'VIEW');
	        } else {
	          const perms = Array.isArray(u?.permissions) ? (u?.permissions as any as string[]) : [];
	          setFinAccess(perms.includes('accounts') ? 'CRUD' : 'NONE');
	        }
	      } catch {
	        // ignore
	      }
	    })();
	  }, []);

  const qValid = useMemo(()=>{
    const amt = Number(qAmount);
    return qCategory && !Number.isNaN(amt) && amt>0 && qBranch;
  }, [qCategory,qAmount,qBranch]);



  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const rowType = voucherTypeToRowType(voucherType as VoucherType);
    const dbType = voucherTypeToDbType(voucherType as VoucherType);
    const amt = Number(amount);
    const signedAmt = rowType === 'Cash Out' ? -Math.abs(amt) : Math.abs(amt);
    const code = `VCH-${new Date().getFullYear()}-${String(Math.floor(Math.random()*100000)).padStart(5,'0')}`;
    const occurred_at = new Date().toISOString();

    // Optimistic UI update (will be reconciled by realtime)
    setVouchers(prev => ([
      { id: code, type: rowType, amount: signedAmt, branch, date: occurred_at, status, description },
      ...prev
    ]));

    const { error } = await supabase.from('vouchers').insert([
      { code, vtype: dbType, amount: signedAmt, branch, occurred_at, status, description }
    ]);
    if (error) {
      // rollback optimistic add if failed
      setVouchers(prev => prev.filter(v => v.id !== code));
      alert(`Failed to create voucher: ${error.message}`);

      return;
    }

    // Generate printable PDF for the created voucher
    generateVoucherPDF({ id: code, type: rowType, amount: signedAmt, branch, date: occurred_at, status, description });

    // reset minimal
    setAmount('');
    setDescription('');
  };

  // Row action handlers
  const onView = (r: VoucherRow) => setViewVoucher(r);
  const onEdit = (r: VoucherRow) => { setEditVoucher(r); setEditStatus(r.status); setEditDescription(r.description ?? ''); };
  const onDelete = async (r: VoucherRow) => {
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
    return vouchers.filter(v => (
      (branchFilter === 'All Branches' || v.branch === branchFilter) &&
      (
        v.id.toLowerCase().includes(term) ||
        v.type.toLowerCase().includes(term) ||
        v.branch.toLowerCase().includes(term) ||
        (v.description?.toLowerCase().includes(term) ?? false)
      )
    ));
  }, [vouchers, branchFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page-1)*pageSize, page*pageSize);

  // Quick Cash Out submission
  const handleGenerateCashOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qValid) return;

    const rowType: VoucherRow['type'] = 'Cash Out';
    const dbType: DBVoucher['vtype'] = 'cash_out';
    const amt = Number(qAmount);
    const signedAmt = -Math.abs(amt);
    const code = `VCH-${new Date().getFullYear()}-${String(Math.floor(Math.random()*100000)).padStart(5,'0')}`;
    const occurred_at = new Date().toISOString();

    const desc = qDescription?.trim() ? qDescription : qCategory;

    setVouchers(prev => ([
      { id: code, type: rowType, amount: signedAmt, branch: qBranch, date: occurred_at, status, description: desc },
      ...prev
    ]));

    const { error } = await supabase.from('vouchers').insert([
      { code, vtype: dbType, amount: signedAmt, branch: qBranch, occurred_at, status, description: desc }
    ]);
    if (error) {
      setVouchers(prev => prev.filter(v => v.id !== code));
      alert(`Failed to create voucher: ${error.message}`);
      return;
    }

    // Optional bill upload
    if (qBillFile) {
      const file = qBillFile;
      const allowed = ['application/pdf','image/jpeg','image/png'];
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


    generateVoucherPDF({ id: code, type: rowType, amount: signedAmt, branch: qBranch, date: occurred_at, status, description: desc });

    setQAmount('');
    setQBranch('');
    setQDescription(qCategory);
    setQBillFile(null);
    setQBillError('');
  };

  const branchChartData = useMemo(() => {
    const branches = branchList.length ? branchList : BRANCHES;
    const map = new Map<string, number>();
    branches.forEach(b => map.set(b, 0));
    vouchers.forEach(v => {
      if (v.status === 'Approved' && v.amount > 0) {
        map.set(v.branch, (map.get(v.branch) || 0) + v.amount);
      }
    });
    return branches.map(b => ({ branch: b, revenue: map.get(b) || 0 }));
  }, [vouchers, branchList]);

  const methodChartData = useMemo(() => {
    const approved = vouchers.filter(v => v.status === 'Approved');
    const bank = approved.filter(v => v.type === 'Bank' && v.amount > 0).reduce((s,v)=>s+v.amount,0);
    const cash = approved.filter(v => v.type === 'Cash In' && v.amount > 0).reduce((s,v)=>s+v.amount,0);
    const online = approved.filter(v => v.type === 'Online' && v.amount > 0).reduce((s,v)=>s+v.amount,0);
    const total = bank + cash + online || 1; // avoid NaN
    return [
      { name: 'Cash', value: cash, pct: Math.round((cash/total)*100) },
      { name: 'Online', value: online, pct: Math.round((online/total)*100) },
      { name: 'Bank', value: bank, pct: Math.round((bank/total)*100) },
    ];
  }, [vouchers]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from('vouchers')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(500);
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
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-text-secondary">Voucher Type</label>
                    <select value={voucherType as string} onChange={(e)=>setVoucherType(e.target.value as VoucherType)} className="mt-1 w-full border rounded-lg p-2">
                      <option value="">Select...</option>
                      <option>Cash Receipt</option>
                      <option>Cash Payment</option>
                      <option>Online Payment</option>
                      <option>Bank Deposit</option>
                      <option>Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-text-secondary">Amount (Rs)</label>
                    <input type="number" min={0} placeholder="0" value={amount} onChange={(e)=>setAmount(e.target.value)} className="mt-1 w-full border rounded-lg p-2" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-text-secondary">Branch</label>
                    <select value={branch} onChange={(e)=>setBranch(e.target.value)} className="mt-1 w-full border rounded-lg p-2">
                      <option value="">Select Branch...</option>
                      {(branchList.length ? branchList : BRANCHES).map(b=> (<option key={b} value={b}>{b}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-text-secondary">Description</label>
                    <textarea value={description} onChange={(e)=>setDescription(e.target.value)} rows={3} className="mt-1 w-full border rounded-lg p-2" placeholder="Short note about this voucher"/>
                  </div>
                </div>
                <div className="mt-4">
                  <button disabled={!isValid || !canCrud} className={`px-4 py-2 rounded-lg font-bold ${(isValid && canCrud) ? 'bg-[#ffa332] text-white shadow-[0px_6px_12px_#3f8cff43]' : 'bg-gray-200 text-gray-400'}`}>Generate Voucher</button>
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
                      className={`px-3 py-1 rounded-full border text-sm ${qCategory===cat ? 'bg-orange-50 border-[#ffa332] text-[#ffa332]' : 'hover:bg-gray-50'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <form onSubmit={handleGenerateCashOut} className="mt-4 grid grid-cols-1 gap-3">
                  <div>
                    <label className="text-sm font-semibold text-text-secondary">Amount (Rs)</label>
                    <input type="number" min={0} placeholder="0" value={qAmount} onChange={(e)=>setQAmount(e.target.value)} className="mt-1 w-full border rounded-lg p-2" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-text-secondary">Branch</label>
                    <select value={qBranch} onChange={(e)=>setQBranch(e.target.value)} className="mt-1 w-full border rounded-lg p-2">
                      <option value="">Select Branch...</option>
                      {(branchList.length ? branchList : BRANCHES).map(b=> (<option key={b} value={b}>{b}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-text-secondary">Description</label>
                    <textarea value={qDescription} onChange={(e)=>setQDescription(e.target.value)} rows={3} className="mt-1 w-full border rounded-lg p-2" placeholder={`e.g. ${qCategory} for May`} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-text-secondary">Upload Bill (optional)</label>
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      onChange={(e)=>{
                        const f = e.target.files?.[0] || null;
                        if (!f) { setQBillFile(null); setQBillError(''); return; }
                        if (!['application/pdf','image/jpeg','image/png'].includes(f.type)) { setQBillError('Only PDF, JPG, or PNG allowed'); setQBillFile(null); return; }
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
                    <button disabled={!qValid || !!qBillError || !canCrud} className={`px-4 py-2 rounded-lg font-bold ${(qValid && !qBillError && canCrud) ? 'bg-[#ffa332] text-white shadow-[0px_6px_12px_#3f8cff43]' : 'bg-gray-200 text-gray-400'}`}>Generate Cash Out</button>
                  </div>
                </form>
              </div>
            </div>
            {/* Recent Vouchers */}
            <div className="mt-10 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <h2 className="text-lg font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Recent Vouchers</h2>
                <div className="flex flex-col md:flex-row gap-3 md:items-center">
                  <select value={branchFilter} onChange={(e)=>{ setBranchFilter(e.target.value); setPage(1); }} className="border rounded-lg p-2">
                    <option>All Branches</option>
                    {(branchList.length ? branchList : BRANCHES).map(b => (<option key={b}>{b}</option>))}
                  </select>
                  <input value={search} onChange={(e)=>{ setSearch(e.target.value); setPage(1); }} placeholder="Search..." className="border rounded-lg p-2" />
                  <div className="flex gap-2">
                    <button onClick={()=>downloadCSV('vouchers.csv', filtered)} className="px-3 py-2 border rounded-lg hover:bg-gray-50">CSV</button>
                    <button onClick={()=>exportExcel('vouchers.xlsx', filtered)} className="px-3 py-2 border rounded-lg hover:bg-gray-50">Excel</button>
                    <button onClick={()=>exportPDF('vouchers.pdf', filtered)} className="px-3 py-2 border rounded-lg hover:bg-gray-50">PDF</button>
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
                    {pageRows.map((r)=> (
                      <tr key={r.id} className="border-t">
                        <td className="py-2 pr-4 font-semibold">#{r.id}</td>
                        <td className="py-2 pr-4">{r.type}</td>
                        <td className={`py-2 pr-4 font-semibold ${r.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{r.amount >= 0 ? '+' : '-'}{`Rs ${Math.abs(r.amount).toLocaleString()}`}</td>
                        <td className="py-2 pr-4">{r.branch}</td>
                        <td className="py-2 pr-4">{new Date(r.date).toLocaleDateString(undefined,{ month:'short', day:'2-digit', year:'numeric' })}</td>
                        <td className="py-2 pr-4">
                          <span className={`${r.status==='Approved' ? 'bg-green-100 text-green-700' : r.status==='Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'} px-2 py-1 rounded-full text-xs font-bold`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex gap-2 text-sm">
                            {r.uploaded_bill && (
                              <button type="button" onClick={()=>openBill(r.uploaded_bill!)} className="text-green-700 hover:underline">Bill</button>
                            )}
                            <button type="button" onClick={()=>onView(r)} className="text-blue-600 hover:underline">View</button>
                            {canCrud && (<button type="button" onClick={()=>onEdit(r)} className="text-orange-600 hover:underline">Edit</button>)}
                            {canCrud && (<button type="button" onClick={()=>onDelete(r)} className="text-red-600 hover:underline">Delete</button>)}
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
                  <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className={`px-3 py-1 rounded border ${page<=1 ? 'text-gray-300' : 'hover:bg-gray-50'}`}>Prev</button>
                  <button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className={`px-3 py-1 rounded border ${page>=totalPages ? 'text-gray-300' : 'hover:bg-gray-50'}`}>Next</button>
                </div>
              </div>
            </div>

            {/* Charts */}
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
                      <Tooltip formatter={(v:any, n:any)=>[`Rs ${Number(v).toLocaleString()}`, n as string]} />
                      <Legend />
                      <Pie data={methodChartData} dataKey="value" nameKey="name" outerRadius={90} label={(e)=>`${e.name} ${e.pct}%`}>
                        {methodChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={["#22c55e","#fb923c","#8b5cf6"][index]} />
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
          <div className="bg-white rounded-xl p-5 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Voucher #{viewVoucher.id}</h3>
              <button type="button" onClick={()=>setViewVoucher(null)} className="text-text-secondary hover:opacity-70">✕</button>
            </div>
            <div className="mt-3 text-sm space-y-1">
              <div><span className="text-text-secondary">Type:</span> {viewVoucher.type}</div>
              <div><span className="text-text-secondary">Amount:</span> Rs {Math.abs(viewVoucher.amount).toLocaleString()} {viewVoucher.amount>=0? '(In)':'(Out)'}</div>
              <div><span className="text-text-secondary">Branch:</span> {viewVoucher.branch}</div>
              <div><span className="text-text-secondary">Date:</span> {new Date(viewVoucher.date).toLocaleString()}</div>
              <div><span className="text-text-secondary">Status:</span> {viewVoucher.status}</div>
              {viewVoucher.description && <div><span className="text-text-secondary">Description:</span> {viewVoucher.description}</div>}
              {viewVoucher.uploaded_bill && (
                <div>
                  <span className="text-text-secondary">Bill:</span> <button type="button" onClick={()=>openBill(viewVoucher.uploaded_bill!)} className="text-green-700 underline">Open</button>
                </div>
              )}
            </div>
            <div className="mt-4 text-right">
              <button type="button" onClick={()=>setViewVoucher(null)} className="px-3 py-2 border rounded hover:bg-gray-50">Close</button>
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
              <button type="button" onClick={()=>setEditVoucher(null)} className="text-text-secondary hover:opacity-70">✕</button>
            </div>
            <div className="mt-3 space-y-3">
              <label className="block text-sm">
                <span className="text-text-secondary">Status</span>
                <select value={editStatus} onChange={(e)=>setEditStatus(e.target.value as VoucherStatus)} className="mt-1 w-full border rounded p-2">
                  <option>Pending</option>
                  <option>Approved</option>
                  <option>Rejected</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-text-secondary">Description</span>
                <textarea value={editDescription} onChange={(e)=>setEditDescription(e.target.value)} className="mt-1 w-full border rounded p-2" rows={3} />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={()=>setEditVoucher(null)} className="px-3 py-2 border rounded hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={onSaveEdit} className="px-3 py-2 rounded bg-[#ffa332] text-white shadow-[0px_6px_12px_#3f8cff43] hover:opacity-90">Save</button>
            </div>
          </div>
        </div>
      )}

        </div>
      </main>
    </>
  );
};

export default Finances;

