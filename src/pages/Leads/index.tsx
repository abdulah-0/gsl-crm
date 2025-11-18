import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

// Types
export type LeadSource = 'facebook' | 'instagram' | 'google_form' | 'walk_in' | 'referral' | 'organic' | '';
export type LeadStatus = 'new' | 'documentation' | 'university' | 'visa' | 'enrolled' | 'rejected';

export type Lead = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: LeadSource | null;
  status: LeadStatus;
  assigned_to_email: string | null;
  university_id: number | null;
  tags: string[] | null;
  created_at?: string;
};

const defaultLeadForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  source: '' as LeadSource,
  status: 'new' as LeadStatus,
  assigned_to_email: '',
  tags: ''
};

const LeadsPage: React.FC = () => {
  const [tab, setTab] = useState<'add' | 'list'>('list');
  const [items, setItems] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState<'All' | LeadStatus>('All');
  const [form, setForm] = useState(defaultLeadForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

  useEffect(() => { loadLeads(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(l => {
      if (statusF !== 'All' && l.status !== statusF) return false;
      if (!q) return true;
      const bucket = `${l.first_name || ''} ${l.last_name || ''} ${l.email || ''} ${l.phone || ''}`.toLowerCase();
      return bucket.includes(q);
    });
  }, [items, search, statusF]);

  const resetForm = () => setForm(defaultLeadForm);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const tagsArr = form.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
      const payload: any = {
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        email: form.email || null,
        phone: form.phone || null,
        source: form.source || null,
        status: form.status,
        assigned_to_email: form.assigned_to_email || null,
        tags: tagsArr.length ? tagsArr : null
      };
      const { error } = await supabase.from('leads').insert([payload]);
      if (error) throw error;
      resetForm();
      setTab('list');
      await loadLeads();
      alert('Lead added successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed to add lead');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (lead: Lead, status: LeadStatus) => {
    const { error } = await supabase.from('leads').update({ status }).eq('id', lead.id);
    if (error) { alert(error.message); return; }
    await loadLeads();
  };

  const handleConvert = (lead: Lead) => {
    const params = new URLSearchParams();
    params.set('from_lead', '1');
    if (lead.first_name || lead.last_name) params.set('full_name', `${lead.first_name || ''} ${lead.last_name || ''}`.trim());
    if (lead.email) params.set('email', lead.email);
    if (lead.phone) params.set('phone', lead.phone);
    navigate(`/students?${params.toString()}`);
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
            <div className="bg-white rounded-full p-1 shadow flex">
              <button onClick={()=>setTab('add')} className={`px-4 py-2 rounded-full text-sm font-semibold ${tab==='add'?'bg-[#ffa332] text-white':'text-text-secondary'}`}>Add Lead</button>
              <button onClick={()=>setTab('list')} className={`px-4 py-2 rounded-full text-sm font-semibold ${tab==='list'?'bg-[#ffa332] text-white':'text-text-secondary'}`}>All Leads</button>
            </div>
          </div>

          {tab==='add' && (
            <form onSubmit={onSubmit} className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a] grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <label><span className="text-text-secondary">First Name</span><input value={form.first_name} onChange={e=>setForm({...form, first_name:e.target.value})} className="mt-1 w-full border rounded p-2" /></label>
                <label><span className="text-text-secondary">Last Name</span><input value={form.last_name} onChange={e=>setForm({...form, last_name:e.target.value})} className="mt-1 w-full border rounded p-2" /></label>
                <label><span className="text-text-secondary">Email</span><input type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} className="mt-1 w-full border rounded p-2" /></label>
                <label><span className="text-text-secondary">Phone</span><input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} className="mt-1 w-full border rounded p-2" /></label>
                <label><span className="text-text-secondary">Source</span>
                  <select value={form.source} onChange={e=>setForm({...form, source:e.target.value as LeadSource})} className="mt-1 w-full border rounded p-2">
                    <option value="">Select Source</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="google_form">Google Form</option>
                    <option value="walk_in">Walk-in</option>
                    <option value="referral">Referral</option>
                    <option value="organic">Organic</option>
                  </select>
                </label>
                <label><span className="text-text-secondary">Status</span>
                  <select value={form.status} onChange={e=>setForm({...form, status:e.target.value as LeadStatus})} className="mt-1 w-full border rounded p-2">
                    <option value="new">New</option>
                    <option value="documentation">Documentation</option>
                    <option value="university">University</option>
                    <option value="visa">Visa</option>
                    <option value="enrolled">Enrolled</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </label>
                <label className="sm:col-span-2"><span className="text-text-secondary">Assigned To (email)</span><input value={form.assigned_to_email} onChange={e=>setForm({...form, assigned_to_email:e.target.value})} className="mt-1 w-full border rounded p-2" /></label>
                <label className="sm:col-span-2"><span className="text-text-secondary">Tags (comma separated)</span><input value={form.tags} onChange={e=>setForm({...form, tags:e.target.value})} className="mt-1 w-full border rounded p-2" /></label>
              </div>
              <aside className="bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a] flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-lg">Actions</h3>
                  <p className="mt-2 text-sm text-text-secondary">Create a new lead that you can later convert into a student enrollment.</p>
                </div>
                <button type="submit" disabled={saving} className="mt-4 px-4 py-2 rounded bg-[#ffa332] text-white font-bold disabled:opacity-60">{saving?'Saving...':'Save Lead'}</button>
              </aside>
            </form>
          )}

          {tab==='list' && (
            <div className="mt-6 bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a]">
              <div className="flex flex-wrap items-center gap-3 justify-between text-sm">
                <div className="flex items-center gap-2">
                  <input placeholder="Search by name, email, phone" value={search} onChange={e=>setSearch(e.target.value)} className="border rounded p-2 w-64" />
                  <select value={statusF} onChange={e=>setStatusF(e.target.value as any)} className="border rounded p-2">
                    <option value="All">All Statuses</option>
                    <option value="new">New</option>
                    <option value="documentation">Documentation</option>
                    <option value="university">University</option>
                    <option value="visa">Visa</option>
                    <option value="enrolled">Enrolled</option>
                    <option value="rejected">Rejected</option>
                  </select>
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
                      <th className="text-right p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(l => (
                      <tr key={l.id} className="border-t">
                        <td className="p-2">{[l.first_name, l.last_name].filter(Boolean).join(' ') || '—'}</td>
                        <td className="p-2">{l.email || '—'}</td>
                        <td className="p-2">{l.phone || '—'}</td>
                        <td className="p-2 capitalize">{l.source || '—'}</td>
                        <td className="p-2 capitalize">{l.status}</td>
                        <td className="p-2 text-right space-x-2">
                          {l.status !== 'enrolled' && (
                            <button onClick={()=>updateStatus(l, 'enrolled')} className="text-green-700 hover:underline">Mark Enrolled</button>
                          )}
                          <button onClick={()=>handleConvert(l)} className="text-blue-600 hover:underline">Convert to Student</button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length===0 && (
                      <tr><td className="p-3 text-text-secondary" colSpan={6}>No leads found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default LeadsPage;

