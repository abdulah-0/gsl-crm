/**
 * @fileoverview Info Portal Page
 * 
 * Internal information portal for the GSL CRM.
 * Enables admins to post announcements, notices, and media for staff viewing.
 * 
 * **Key Features:**
 * - Post types: Image/Poster, Video, Text/Notice
 * - Pin important posts
 * - File upload to Supabase Storage
 * - Real-time updates via Supabase
 * - Filtering by post type
 * - Search by title/description
 * 
 * **Access Control:**
 * - Super Admin/Admin: Create, edit, delete, pin posts
 * - Other roles: View-only feed
 * 
 * **Storage:**
 * - Media files stored in Supabase Storage bucket: `info`
 * 
 * @module pages/Info
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';


// Types
type PostType = 'image' | 'video' | 'text';
interface InfoPost {
  id: string;
  title: string;
  description?: string | null;
  type: PostType;
  file_url?: string | null;
  text_content?: string | null;
  pinned?: boolean | null;
  created_at?: string | null;
  created_by?: string | null; // email
}

const InfoPage: React.FC = () => {
  const [role, setRole] = useState<'super' | 'admin' | 'other' | null>(null);
  const isEditor = role === 'super' || role === 'admin';

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<PostType>('image');
  const [textContent, setTextContent] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Data
  const [posts, setPosts] = useState<InfoPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<'all' | PostType>('all');
  const [search, setSearch] = useState('');

  // Role resolution
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const email = data.user?.email || '';
        if (!email) { if (mounted) setRole('other'); return; }
        const { data: u } = await supabase.from('dashboard_users').select('role').eq('email', email).maybeSingle();
        const r = (u?.role || (data.user as any)?.app_metadata?.role || (data.user as any)?.user_metadata?.role || '').toString().toLowerCase();
        if (r.includes('super')) setRole('super');
        else if (r.includes('admin')) setRole('admin');
        else setRole('other');
      } catch {
        if (mounted) setRole('other');
      }
    })();
    return () => { mounted = false; };
  }, []);

  const loadPosts = async () => {
    setLoading(true);
    try {
      let query = supabase.from('info_posts').select('*');
      const { data, error } = await query.order('pinned', { ascending: false }).order('created_at', { ascending: false });
      if (error) throw error;
      setPosts((data as any) || []);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
    const channel = supabase
      .channel('realtime:info_posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'info_posts' }, loadPosts)
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch { } };
  }, []);

  const filtered = useMemo(() => {
    let out = posts;
    if (filterType !== 'all') out = out.filter(p => p.type === filterType);
    if (search.trim()) {
      const s = search.toLowerCase();
      out = out.filter(p => (p.title || '').toLowerCase().includes(s) || (p.description || '').toLowerCase().includes(s));
    }
    return out;
  }, [posts, filterType, search]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setType('image');
    setTextContent('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleEdit = (post: InfoPost) => {
    setEditingId(post.id);
    setTitle(post.title);
    setDescription(post.description || '');
    setType(post.type);
    setTextContent(post.text_content || '');
    setFormOpen(true);
  };

  const handleDelete = async (post: InfoPost) => {
    if (!isEditor) return;
    if (!confirm('Delete this post?')) return;
    const { error } = await supabase.from('info_posts').delete().eq('id', post.id);
    if (!error) await loadPosts();
  };

  const togglePin = async (post: InfoPost) => {
    if (!isEditor) return;
    const { error } = await supabase.from('info_posts').update({ pinned: !post.pinned }).eq('id', post.id);
    if (!error) await loadPosts();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditor) return;
    if (!title.trim()) { alert('Title is required'); return; }
    if (type === 'text' && !textContent.trim()) { alert('Please enter some text'); return; }
    setSubmitting(true);
    try {
      let file_url: string | null = null;
      if ((type === 'image' || type === 'video') && fileRef.current?.files?.[0]) {
        const f = fileRef.current.files[0];
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id || 'anon';
        const path = `${uid}/${Date.now()}_${f.name}`;
        const { error: upErr } = await supabase.storage.from('info').upload(path, f, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('info').getPublicUrl(path);
        file_url = pub.publicUrl;
      }

      const payload: Partial<InfoPost> = {
        title: title.trim(),
        description: description.trim() || null,
        type,
        file_url: (type !== 'text') ? (file_url || (editingId ? posts.find(p => p.id === editingId)?.file_url || null : null)) : null,
        text_content: type === 'text' ? textContent : null,
      };

      const { data: sess } = await supabase.auth.getUser();
      const created_by = sess.user?.email || null;

      if (editingId) {
        const { error } = await supabase.from('info_posts').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('info_posts').insert({ ...payload, created_by });
        if (error) throw error;
      }
      resetForm();
      setFormOpen(false);
      await loadPosts();
    } catch (err: any) {
      // eslint-disable-next-line no-alert
      alert(err?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Info - GSL Pakistan CRM</title>
      </Helmet>
      <main className="w-full min-h-screen bg-background-main flex">
        {/* App Sidebar (global) */}
        <div className="w-[14%] min-w-[200px] hidden lg:block">
          <Sidebar />
        </div>
        {/* Page content */}
        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          <section className="mt-8 lg:mt-12">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-4xl text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>Info</h1>
              {isEditor && (
                <button onClick={() => { setFormOpen(v => !v); if (!formOpen) resetForm(); }} className="px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">
                  {formOpen ? 'Close' : 'Create New Post'}
                </button>
              )}
            </div>

            {/* Editor form */}
            {isEditor && formOpen && (
              <form onSubmit={onSubmit} className="mt-4 border rounded-lg p-4 space-y-3 bg-white shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold">Title</label>
                    <input className="mt-1 w-full border rounded px-2 py-1" value={title} onChange={e => setTitle(e.target.value)} required />
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Type</label>
                    <select className="mt-1 w-full border rounded px-2 py-1" value={type} onChange={e => setType(e.target.value as PostType)}>
                      <option value="image">Image / Poster</option>
                      <option value="video">Video</option>
                      <option value="text">Text / Notice</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold">Description (optional)</label>
                  <textarea className="mt-1 w-full border rounded px-2 py-1" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
                </div>

                {type !== 'text' ? (
                  <div>
                    <label className="text-sm font-semibold">Upload file ({type === 'image' ? 'image/poster' : 'video'})</label>
                    <input ref={fileRef} type="file" accept={type === 'image' ? 'image/*' : 'video/*'} className="mt-1 w-full" />
                    <p className="text-xs text-text-secondary mt-1">Uploads go to Supabase Storage bucket: info</p>
                  </div>
                ) : (
                  <div>
                    <label className="text-sm font-semibold">Notice Content</label>
                    <textarea className="mt-1 w-full border rounded px-2 py-1" rows={8} value={textContent} onChange={e => setTextContent(e.target.value)} placeholder="Write announcement with basic formatting..." />
                  </div>
                )}

                {/* Preview */}
                <div className="border rounded p-3 bg-gray-50">
                  <div className="text-sm font-semibold mb-2">Preview</div>
                  <div className="space-y-1">
                    <div className="font-bold">{title || 'Title'}</div>
                    {description && <div className="text-sm text-text-secondary">{description}</div>}
                    {type === 'text' ? (
                      <div className="whitespace-pre-wrap text-sm">{textContent || '...'}</div>
                    ) : (
                      <div className="text-sm text-text-secondary">{fileRef.current?.files?.[0]?.name || 'No file selected'}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button type="button" onClick={() => { resetForm(); setFormOpen(false); }} className="px-3 py-2 rounded border">Cancel</button>
                  <button disabled={submitting} className="px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">{editingId ? 'Update' : 'Publish'}</button>
                </div>
              </form>
            )}

            {/* Filters/Search */}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <select className="border rounded px-2 py-1" value={filterType} onChange={e => setFilterType(e.target.value as any)}>
                <option value="all">All</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
                <option value="text">Text</option>
              </select>
              <input className="border rounded px-2 py-1" placeholder="Search by title/description" value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {/* Editor list view */}
            {isEditor ? (
              <div className="mt-4">
                <div className="text-sm text-text-secondary">{loading ? 'Loading...' : `${filtered.length} posts`}</div>
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-text-secondary">
                        <th className="p-2">Pinned</th>
                        <th className="p-2">Title</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Upload Date</th>
                        <th className="p-2">Uploaded By</th>
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filtered.map(p => (
                        <tr key={p.id}>
                          <td className="p-2"><button className={`text-xs px-2 py-1 rounded ${p.pinned ? 'bg-amber-100 text-amber-800' : 'bg-gray-100'}`} onClick={() => togglePin(p)}>{p.pinned ? 'Pinned' : 'Pin'}</button></td>
                          <td className="p-2 font-semibold">{p.title}</td>
                          <td className="p-2 capitalize">{p.type}</td>
                          <td className="p-2">{p.created_at ? new Date(p.created_at).toLocaleString() : ''}</td>
                          <td className="p-2">{p.created_by || ''}</td>
                          <td className="p-2 text-right space-x-2">
                            <button className="text-blue-600 hover:underline" onClick={() => window.open(`/info#${p.id}`, '_self')}>View</button>
                            <button className="text-amber-600 hover:underline" onClick={() => handleEdit(p)}>Edit</button>
                            <button className="text-red-600 hover:underline" onClick={() => handleDelete(p)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={6} className="p-4 text-center text-text-secondary">No posts</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              // Viewer feed
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(p => (
                  <article key={p.id} id={p.id} className="bg-white rounded-lg border shadow-sm p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{p.title}</h3>
                      {p.pinned && <span className="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800">Pinned</span>}
                    </div>
                    {p.description && <p className="mt-1 text-sm text-text-secondary">{p.description}</p>}
                    <div className="mt-2">
                      {p.type === 'image' && p.file_url && (
                        <img src={p.file_url} alt={p.title} className="w-full h-48 object-cover rounded" />
                      )}
                      {p.type === 'video' && p.file_url && (
                        <video controls className="w-full rounded">
                          <source src={p.file_url} />
                        </video>
                      )}
                      {p.type === 'text' && (
                        <div className="whitespace-pre-wrap text-sm">{p.text_content}</div>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-text-secondary flex items-center justify-between">
                      <span>{p.created_at ? new Date(p.created_at).toLocaleString() : ''}</span>
                      <span>{p.created_by || ''}</span>
                    </div>
                  </article>
                ))}
                {filtered.length === 0 && (
                  <div className="col-span-full text-center text-text-secondary">No posts</div>
                )}
              </div>
            )}

          </section>
        </div>
      </main>
    </>
  );
};

export default InfoPage;

