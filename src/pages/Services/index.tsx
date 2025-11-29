/**
 * @fileoverview Services Page
 * 
 * Products and services management for the GSL CRM system.
 * Allows managing courses, test prep services, and other offerings.
 * 
 * **Key Features:**
 * - Service CRUD operations
 * - Service categorization by type
 * - Pricing and duration management
 * - Student enrollment to services
 * - Advanced filtering (type, price, duration)
 * - Search functionality
 * - Real-time updates
 * 
 * @module pages/Services
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

// Types
interface ServiceItem {
  id: string; // SVxxxxxxxx
  name: string;
  type?: string; // Test Prep, Course, etc.
  description?: string;
  price?: number; // in Rs
  duration_weeks?: number;
  created_at?: string;
}

interface StudentTiny { id: string; full_name: string; phone?: string; email?: string; }

const ServicesPage: React.FC = () => {
  const navigate = useNavigate();

  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState('');
  const [fType, setFType] = useState('All');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [maxWeeks, setMaxWeeks] = useState<string>('');

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ServiceItem | null>(null);

  const [form, setForm] = useState<ServiceItem>({ id: '', name: '', type: '', description: '', price: undefined, duration_weeks: undefined });

  const [showEnroll, setShowEnroll] = useState<null | ServiceItem>(null);
  const [students, setStudents] = useState<StudentTiny[]>([]);
  const [stuQ, setStuQ] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [batch, setBatch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('dashboard_services').select('*').order('created_at', { ascending: false });
    setItems((data as any as ServiceItem[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const types = useMemo(() => Array.from(new Set(items.map(i => i.type).filter(Boolean))) as string[], [items]);

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (q && !(`${i.name} ${i.description || ''}`.toLowerCase().includes(q.toLowerCase()))) return false;
      if (fType !== 'All' && i.type !== fType) return false;
      if (maxPrice && typeof i.price === 'number' && i.price > Number(maxPrice)) return false;
      if (maxWeeks && typeof i.duration_weeks === 'number' && i.duration_weeks > Number(maxWeeks)) return false;
      return true;
    });
  }, [items, q, fType, maxPrice, maxWeeks]);

  const openAdd = () => { setEditing(null); setForm({ id: '', name: '', type: '', description: '', price: undefined, duration_weeks: undefined }); setShowForm(true); };
  const openEdit = (i: ServiceItem) => { setEditing(i); setForm({ ...i }); setShowForm(true); };

  const saveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { alert('Name is required'); return; }
    if (!editing) {
      const id = `SV${Date.now().toString().slice(-8)}`;
      await supabase.from('dashboard_services').insert([{ id, name: form.name, type: form.type || null, description: form.description || null, price: form.price ?? null, duration_weeks: form.duration_weeks ?? null }]);
    } else {
      await supabase.from('dashboard_services').update({ name: form.name, type: form.type || null, description: form.description || null, price: form.price ?? null, duration_weeks: form.duration_weeks ?? null }).eq('id', editing.id);
    }
    setShowForm(false);
    await load();
  };

  const delService = async (id: string) => {
    if (!confirm('Delete this service?')) return;
    await supabase.from('dashboard_services').delete().eq('id', id);
    await load();
  };

  const openEnroll = async (svc: ServiceItem) => {
    setShowEnroll(svc);
    const { data } = await supabase.from('dashboard_students').select('id, full_name, phone, email').eq('archived', false).order('created_at', { ascending: false }).limit(50);
    setStudents((data as any as StudentTiny[]) || []);
    setSelectedStudent(''); setBatch(''); setStuQ('');
  };

  const doEnroll = async () => {
    if (!showEnroll) return;
    if (!selectedStudent) { alert('Select a student'); return; }
    if (!batch) { alert('Enter batch'); return; }
    await supabase.from('dashboard_students').update({ program_title: showEnroll.name, batch_no: batch, status: 'Active' }).eq('id', selectedStudent);
    setShowEnroll(null);
    alert('Student enrolled successfully');
  };

  const filteredStudents = useMemo(() => students.filter(s => !stuQ || `${s.full_name} ${s.id} ${s.email || ''}`.toLowerCase().includes(stuQ.toLowerCase())), [students, stuQ]);

  return (
    <main className="w-full min-h-screen bg-background-main flex">
      <Helmet><title>Products & Services | GSL Pakistan CRM</title></Helmet>
      <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
      <div className="flex-1 flex flex-col">
        <Header />

        <section className="px-4 sm:px-6 lg:px-8 mt-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Products & Services</h1>
            <button onClick={openAdd} className="px-4 py-2 rounded-full font-bold text-white bg-[#ffa332] hover:opacity-95">+ Add Service</button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <input placeholder="Search services" value={q} onChange={e => setQ(e.target.value)} className="w-full sm:w-64 border rounded p-2" />
            <select value={fType} onChange={e => setFType(e.target.value)} className="border rounded p-2"><option>All</option>{types.map(t => <option key={t}>{t}</option>)}</select>
            <input placeholder="Max Price (Rs)" value={maxPrice} onChange={e => setMaxPrice(e.target.value.replace(/[^0-9]/g, ''))} className="w-40 border rounded p-2" />
            <input placeholder="Max Duration (weeks)" value={maxWeeks} onChange={e => setMaxWeeks(e.target.value.replace(/[^0-9]/g, ''))} className="w-52 border rounded p-2" />
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading && <div className="text-sm text-text-secondary">Loading...</div>}
            {!loading && filtered.map(svc => (
              <div key={svc.id} className="bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a] flex flex-col">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">{svc.name}</h3>
                    <span className="text-xs text-text-secondary">{svc.type || 'General'}</span>
                  </div>
                  <div className="mt-1 text-sm text-text-secondary whitespace-pre-wrap">{svc.description || '—'}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div><div className="text-text-secondary">Price</div><div className="font-semibold">Rs {svc.price?.toLocaleString() || '—'}</div></div>
                    <div><div className="text-text-secondary">Duration</div><div className="font-semibold">{svc.duration_weeks ? `${svc.duration_weeks} weeks` : '—'}</div></div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <button onClick={() => openEdit(svc)} className="text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => delService(svc.id)} className="text-red-600 hover:underline">Delete</button>
                  </div>
                  <button onClick={() => openEnroll(svc)} className="px-3 py-2 rounded bg-[#ffa332] text-white text-sm font-semibold">Enroll Students</button>
                </div>
              </div>
            ))}
            {!loading && filtered.length === 0 && <div className="text-sm text-text-secondary">No services found</div>}
          </div>
        </section>
      </div>

      {/* Add/Edit Service Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <form onSubmit={saveService} className="bg-white w-full max-w-lg rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">{editing ? 'Edit Service' : 'Add Service'}</h3><button type="button" onClick={() => setShowForm(false)} className="text-text-secondary">✕</button></div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label><span className="text-text-secondary">Name</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border rounded p-2" required /></label>
              <label><span className="text-text-secondary">Type</span><input value={form.type || ''} onChange={e => setForm({ ...form, type: e.target.value })} className="mt-1 w-full border rounded p-2" placeholder="e.g., Test Prep" /></label>
              <label className="sm:col-span-2"><span className="text-text-secondary">Description</span><textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 w-full border rounded p-2" rows={3} /></label>
              <label><span className="text-text-secondary">Price (Rs)</span><input value={form.price ?? ''} onChange={e => setForm({ ...form, price: e.target.value ? Number(e.target.value.replace(/[^0-9]/g, '')) : undefined })} className="mt-1 w-full border rounded p-2" /></label>
              <label><span className="text-text-secondary">Duration (weeks)</span><input value={form.duration_weeks ?? ''} onChange={e => setForm({ ...form, duration_weeks: e.target.value ? Number(e.target.value.replace(/[^0-9]/g, '')) : undefined })} className="mt-1 w-full border rounded p-2" /></label>
            </div>
            <div className="mt-5 text-right"><button type="submit" className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold">Save</button></div>
          </form>
        </div>
      )}

      {/* Enroll Modal */}
      {showEnroll && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-2xl rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">Enroll Students to {showEnroll.name}</h3><button type="button" onClick={() => setShowEnroll(null)} className="text-text-secondary">✕</button></div>
            <div className="mt-4">
              <div className="text-sm">
                <div className="flex items-center justify-between">
                  <input placeholder="Search students" value={stuQ} onChange={e => setStuQ(e.target.value)} className="w-full sm:w-64 border rounded p-2" />
                  <button onClick={() => navigate(`/students?service=${encodeURIComponent(showEnroll.name)}`)} className="ml-3 text-blue-600 hover:underline">Create new student</button>
                </div>
                <div className="mt-3 max-h-64 overflow-auto divide-y border rounded">
                  {filteredStudents.map(st => (
                    <label key={st.id} className="flex items-center gap-3 p-2">
                      <input type="radio" name="enroll-stu" value={st.id} checked={selectedStudent === st.id} onChange={() => setSelectedStudent(st.id)} />
                      <div>
                        <div className="font-semibold">{st.full_name}</div>
                        <div className="text-xs text-text-secondary">{st.id} • {st.email || st.phone || ''}</div>
                      </div>
                    </label>
                  ))}
                  {filteredStudents.length === 0 && <div className="p-3 text-xs text-text-secondary">No students found</div>}
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                  <div className="text-sm text-text-secondary">Batch No.</div>
                  <input value={batch} onChange={e => setBatch(e.target.value)} className="sm:col-span-2 border rounded p-2 text-sm" placeholder="e.g., 2025-01" />
                </div>
                <div className="mt-4 text-right">
                  <button onClick={doEnroll} className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold">Enroll</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default ServicesPage;

