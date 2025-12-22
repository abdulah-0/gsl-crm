/**
 * @fileoverview Universities Page
 * 
 * University database management for the GSL CRM system.
 * Manages partner universities for student placements and consultancy.
 * 
 * **Key Features:**
 * - University database with detailed information
 * - Excel import functionality
 * - Manual university addition
 * - Pagination (25 per page)
 * - Advanced filtering (country, affiliation type)
 * - Search functionality
 * - Contact information management
 * 
 * **Import Format:**
 * Supports Excel files with columns: Name, Country, City, Website, Email, Phone, AffiliationType, Notes
 * 
 * @module pages/Universities
 */

import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import * as XLSX from 'xlsx';

interface UniversityRow {
  id: number;
  name: string;
  country: string | null;
  city: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  affiliation_type: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
}

const PAGE_SIZE = 25;

const UniversitiesPage: React.FC = () => {
  const [items, setItems] = useState<UniversityRow[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [countryF, setCountryF] = useState('All');
  const [affiliationF, setAffiliationF] = useState('All');

  // Manual add form
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [affiliationType, setAffiliationType] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      setCurrentUserEmail(auth.user?.email || '');
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from('universities')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (countryF !== 'All') query = query.eq('country', countryF);
      if (affiliationF !== 'All') query = query.eq('affiliation_type', affiliationF);
      const { data, error } = await query;
      if (error) throw error;
      setItems((data as any as UniversityRow[]) || []);
    } catch (err) {
      console.error('load universities error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, countryF, affiliationF]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(u => {
      const bucket = `${u.name || ''} ${u.country || ''} ${u.city || ''} ${u.website || ''} ${u.email || ''}`.toLowerCase();
      return bucket.includes(q);
    });
  }, [items, search]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const nm = name.trim();
    if (!nm) { alert('University Name is required'); return; }
    setSaving(true);
    try {
      const payload: any = {
        name: nm,
        country: country || null,
        city: city || null,
        website: website || null,
        email: email || null,
        phone: phone || null,
        affiliation_type: affiliationType || null,
        notes: notes || null,
        created_by: currentUserEmail || null,
      };
      const { error } = await supabase.from('universities').insert([payload]);
      if (error) throw error;
      setName(''); setCountry(''); setCity(''); setWebsite(''); setEmail(''); setPhone(''); setAffiliationType(''); setNotes('');
      setPage(1);
      await load();
      alert('University added successfully');
    } catch (err: any) {
      alert(err?.message || 'Failed to add university');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const payloads = rows.map((r, idx) => ({
        name: String(r.Name || r.University || r.UniversityName || '').trim() || `Unnamed ${idx + 1}`,
        country: r.Country || null,
        city: r.City || null,
        website: r.Website || null,
        email: r.Email || null,
        phone: r.Phone || null,
        affiliation_type: r.AffiliationType || r.Affiliation || null,
        notes: r.Notes || null,
        created_by: currentUserEmail || null,
      })).filter(r => r.name);
      if (!payloads.length) { alert('No valid rows found in file'); return; }
      const { error } = await supabase.from('universities').insert(payloads);
      if (error) throw error;
      setPage(1);
      await load();
      alert(`Imported ${payloads.length} universities successfully`);
    } catch (err: any) {
      console.error('import universities error', err);
      alert(err?.message || 'Failed to import universities from file');
    } finally {
      e.target.value = '';
    }
  };

  const countries = useMemo(() => ['All', ...Array.from(new Set(items.map(i => i.country).filter(Boolean))) as string[]], [items]);
  const affiliations = useMemo(() => ['All', ...Array.from(new Set(items.map(i => i.affiliation_type).filter(Boolean))) as string[]], [items]);

  return (
    <main className="w-full min-h-screen bg-background-main flex">
      <Helmet><title>Universities | GSL Pakistan CRM</title></Helmet>
      <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
      <div className="flex-1 flex flex-col">
        <Header />
        <section className="px-4 sm:px-6 lg:px-8 mt-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Universities</h1>
            <div className="flex items-center gap-3">
              <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="text-sm" />
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, country, city, email, website"
              className="w-full sm:w-72 border rounded p-2 text-sm"
            />
            <select value={countryF} onChange={e => setCountryF(e.target.value)} className="border rounded p-2 text-sm">
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={affiliationF} onChange={e => setAffiliationF(e.target.value)} className="border rounded p-2 text-sm">
              {affiliations.map(a => <option key={a} value={a}>{a || 'Unspecified'}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="mt-4 bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a] overflow-x-auto text-sm">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-2 px-2">University Name</th>
                  <th className="py-2 px-2">Country</th>
                  <th className="py-2 px-2">City</th>
                  <th className="py-2 px-2">Website</th>
                  <th className="py-2 px-2">Contact Email</th>
                  <th className="py-2 px-2">Contact Phone</th>
                  <th className="py-2 px-2">Affiliation Type</th>
                  <th className="py-2 px-2">Added By</th>
                  <th className="py-2 px-2">Added On</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="py-4 text-center text-gray-500">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="py-4 text-center text-gray-500">No universities found</td></tr>
                ) : (
                  filtered.map(u => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 px-2 font-semibold">{u.name}</td>
                      <td className="py-2 px-2">{u.country || '-'}</td>
                      <td className="py-2 px-2">{u.city || '-'}</td>
                      <td className="py-2 px-2">
                        {u.website ? <a href={u.website} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">{u.website}</a> : '-'}
                      </td>
                      <td className="py-2 px-2">{u.email || '-'}</td>
                      <td className="py-2 px-2">{u.phone || '-'}</td>
                      <td className="py-2 px-2">{u.affiliation_type || '-'}</td>
                      <td className="py-2 px-2">{u.created_by || '-'}</td>
                      <td className="py-2 px-2">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >Prev</button>
            <span>Page {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 border rounded"
            >Next</button>
          </div>

          {/* Manual Add Form */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form onSubmit={onSave} className="bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a] text-sm lg:col-span-2">
              <h3 className="font-bold text-lg mb-3">Add University Manually</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm">University Name*
                  <input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full border rounded p-2" required />
                </label>
                <label className="text-sm">Country
                  <input value={country} onChange={e => setCountry(e.target.value)} className="mt-1 w-full border rounded p-2" />
                </label>
                <label className="text-sm">City
                  <input value={city} onChange={e => setCity(e.target.value)} className="mt-1 w-full border rounded p-2" />
                </label>
                <label className="text-sm">Website URL
                  <input value={website} onChange={e => setWebsite(e.target.value)} className="mt-1 w-full border rounded p-2" />
                </label>
                <label className="text-sm">Contact Email
                  <input value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full border rounded p-2" />
                </label>
                <label className="text-sm">Contact Phone
                  <input value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 w-full border rounded p-2" />
                </label>
                <label className="text-sm">Affiliation Type
                  <input value={affiliationType} onChange={e => setAffiliationType(e.target.value)} className="mt-1 w-full border rounded p-2" />
                </label>
                <label className="text-sm sm:col-span-2">Notes
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} className="mt-1 w-full border rounded p-2" rows={3} />
                </label>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="mt-4 px-4 py-2 bg-[#ffa332] text-white rounded font-semibold disabled:opacity-60"
              >{saving ? 'Saving...' : 'Save University'}</button>
            </form>

            <div className="bg-white rounded-xl p-4 shadow-[0px_6px_58px_#c3cbd61a] text-xs text-gray-600">
              <h3 className="font-bold text-base mb-2">Excel Import Format</h3>
              <p>Upload a .xlsx file with a header row. Recognised columns:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>Name</strong> / University / UniversityName</li>
                <li>Country</li>
                <li>City</li>
                <li>Website</li>
                <li>Email</li>
                <li>Phone</li>
                <li>AffiliationType / Affiliation</li>
                <li>Notes</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default UniversitiesPage;

