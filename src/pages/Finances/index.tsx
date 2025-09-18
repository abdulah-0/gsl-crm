import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';

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
};

const BRANCHES = ['Main Branch', 'North Branch', 'South Branch', 'East Branch', 'West Branch'];

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

function downloadCSV(filename: string, rows: VoucherRow[]) {
  const header = ['Voucher ID','Type','Amount','Branch','Date','Status','Description'];
  const lines = rows.map(r => [r.id, r.type, r.amount, r.branch, r.date, r.status, r.description ?? '']);
  const csv = [header, ...lines].map(arr => arr.map(x => `"${String(x).replaceAll('"','""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}


const Finances: React.FC = () => {

  const [vouchers, setVouchers] = useState<VoucherRow[]>(initialVouchers);
  const [voucherType, setVoucherType] = useState<VoucherType | ''>('');
  const [amount, setAmount] = useState<string>('');
  const [branch, setBranch] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [status, setStatus] = useState<VoucherStatus>('Pending');

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

  const handleShortcut = (type: VoucherType) => {
    setVoucherType(type);
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    const newIndex = vouchers.length + 1;
    const id = `VCH-${new Date().getFullYear()}-${String(newIndex).padStart(3,'0')}`;
    const rowType = voucherTypeToRowType(voucherType as VoucherType);
    const amt = Number(amount);
    const signedAmt = rowType === 'Cash Out' ? -Math.abs(amt) : Math.abs(amt);

    const newVoucher: VoucherRow = {
      id,
      type: rowType,
      amount: signedAmt,
      branch,
      date: new Date().toISOString().slice(0,10),
      status,
      description,
    };
    setVouchers([newVoucher, ...vouchers]);
    // reset minimal
    setAmount('');
    setDescription('');
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

  const branchChartData = useMemo(() => {
    const map = new Map<string, number>();
    BRANCHES.forEach(b => map.set(b, 0));
    vouchers.forEach(v => {
      if (v.amount > 0) {
        map.set(v.branch, (map.get(v.branch) || 0) + v.amount);
      }
    });
    return BRANCHES.map(b => ({ branch: b, revenue: map.get(b) || 0 }));
  }, [vouchers]);

  const methodChartData = useMemo(() => {
    const bank = vouchers.filter(v => v.type === 'Bank' && v.amount > 0).reduce((s,v)=>s+v.amount,0);
    const cash = vouchers.filter(v => v.type === 'Cash In' && v.amount > 0).reduce((s,v)=>s+v.amount,0);
    const online = vouchers.filter(v => v.type === 'Online' && v.amount > 0).reduce((s,v)=>s+v.amount,0);
    const total = bank + cash + online || 1; // avoid NaN
    return [
      { name: 'Cash', value: cash, pct: Math.round((cash/total)*100) },
      { name: 'Online', value: online, pct: Math.round((online/total)*100) },
      { name: 'Bank', value: bank, pct: Math.round((bank/total)*100) },
    ];
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
                <div className="mt-2 text-3xl font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Rs 100,000</div>
                <div className="mt-1 text-sm font-semibold text-green-600">+6% from last month</div>
              </div>
              {/* Cash Out */}
              <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary font-semibold" style={{ fontFamily: 'Nunito Sans' }}>Cash Out</span>
                  <img src="/images/img_icn_general_attach.svg" alt="cash out" className="w-6 h-6" />
                </div>
                <div className="mt-2 text-3xl font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Rs 50,000</div>
                <div className="mt-1 text-sm font-semibold text-red-600">-12% from last month</div>
              </div>
              {/* Online Payments */}
              <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary font-semibold" style={{ fontFamily: 'Nunito Sans' }}>Online Payments</span>
                  <img src="/images/img_icn_general_time_filled.svg" alt="online" className="w-6 h-6" />
                </div>
                <div className="mt-2 text-3xl font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Rs 156,910</div>
                <div className="mt-1 text-sm font-semibold text-orange-500">+75% from last month</div>
              </div>
              {/* Bank Deposits */}
              <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary font-semibold" style={{ fontFamily: 'Nunito Sans' }}>Bank Deposits</span>
                  <img src="/images/img_notifications.svg" alt="bank" className="w-6 h-6" />
                </div>
                <div className="mt-2 text-3xl font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Rs 50,000</div>
                <div className="mt-1 text-sm font-semibold text-purple-600">+10.2% from last month</div>
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
                      {BRANCHES.map(b=> (<option key={b} value={b}>{b}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-text-secondary">Description</label>
                    <textarea value={description} onChange={(e)=>setDescription(e.target.value)} rows={3} className="mt-1 w-full border rounded-lg p-2" placeholder="Short note about this voucher"/>
                  </div>
                </div>
                <div className="mt-4">
                  <button disabled={!isValid} className={`px-4 py-2 rounded-lg font-bold ${isValid ? 'bg-[#ffa332] text-white shadow-[0px_6px_12px_#3f8cff43]' : 'bg-gray-200 text-gray-400'}`}>Generate Voucher</button>
                </div>
              </form>

              {/* Right: Shortcuts */}
              <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-5">
                <h2 className="text-lg font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Generate Vouchers Shortcuts</h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button onClick={()=>handleShortcut('Cash Receipt')} className="p-3 rounded-lg border hover:bg-orange-50 text-left">
                    <div className="font-semibold">Cash Voucher</div>
                    <div className="text-xs text-text-secondary">Cash Receipt</div>
                  </button>
                  <button onClick={()=>handleShortcut('Online Payment')} className="p-3 rounded-lg border hover:bg-orange-50 text-left">
                    <div className="font-semibold">Online Payment</div>
                    <div className="text-xs text-text-secondary">Gateway/Wallet</div>
                  </button>
                  <button onClick={()=>handleShortcut('Bank Deposit')} className="p-3 rounded-lg border hover:bg-orange-50 text-left">
                    <div className="font-semibold">Bank Deposit</div>
                    <div className="text-xs text-text-secondary">Deposit Slip</div>
                  </button>
                  <button onClick={()=>handleShortcut('Transfer')} className="p-3 rounded-lg border hover:bg-orange-50 text-left">
                    <div className="font-semibold">Transfer</div>
                    <div className="text-xs text-text-secondary">Between accounts</div>
                  </button>
                </div>
              </div>
            </div>
            {/* Recent Vouchers */}
            <div className="mt-10 bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <h2 className="text-lg font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Recent Vouchers</h2>
                <div className="flex flex-col md:flex-row gap-3 md:items-center">
                  <select value={branchFilter} onChange={(e)=>{ setBranchFilter(e.target.value); setPage(1); }} className="border rounded-lg p-2">
                    <option>All Branches</option>
                    {BRANCHES.map(b => (<option key={b}>{b}</option>))}
                  </select>
                  <input value={search} onChange={(e)=>{ setSearch(e.target.value); setPage(1); }} placeholder="Search..." className="border rounded-lg p-2" />
                  <div className="flex gap-2">
                    <button onClick={()=>downloadCSV('vouchers.csv', filtered)} className="px-3 py-2 border rounded-lg hover:bg-gray-50">CSV</button>
                    <button onClick={()=>downloadCSV('vouchers.xlsx', filtered)} className="px-3 py-2 border rounded-lg hover:bg-gray-50">Excel</button>
                    <button onClick={()=>downloadCSV('vouchers.pdf', filtered)} className="px-3 py-2 border rounded-lg hover:bg-gray-50">PDF</button>
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
                            <button className="text-blue-600 hover:underline">View</button>
                            <button className="text-orange-600 hover:underline">Edit</button>
                            <button className="text-red-600 hover:underline">Delete</button>
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
                        {methodChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={["#22c55e","#fb923c","#8b5cf6"][index]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>


        </div>
      </main>
    </>
  );
};

export default Finances;

