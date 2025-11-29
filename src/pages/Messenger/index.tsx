/**
 * @fileoverview Messenger Page
 * 
 * Internal messaging system for the GSL CRM.
 * Enables real-time communication between staff members.
 * 
 * **Key Features:**
 * - Real-time messaging via Supabase
 * - Branch-based contact filtering (non-super admins)
 * - Contact list with active users only
 * - Message history
 * - Auto-scroll to latest messages
 * - Keyboard shortcuts (Enter to send)
 * 
 * **Access Control:**
 * - Super Admin: Can message all active users
 * - Other roles: Can only message users in same branch
 * - Dormant/Inactive users excluded from contacts
 * 
 * @module pages/Messenger
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { supabase } from '../../lib/supabaseClient';

const Messenger: React.FC = () => {
  const [me, setMe] = useState<{ email: string; branch: string | null; role: 'super' | 'admin' | 'other' } | null>(null);
  const [contacts, setContacts] = useState<Array<{ full_name: string; email: string }>>([]);
  const [sel, setSel] = useState<string>('');
  const [msgs, setMsgs] = useState<Array<{ id: number; sender_email: string; recipient_email: string; body: string; created_at: string }>>([]);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getUser();
      const email = sess.user?.email || '';
      const { data: u } = await supabase.from('dashboard_users').select('role,branch,email,status').eq('email', email).maybeSingle();
      if (u?.status === 'Dormant' || u?.status === 'Inactive') return;
      const roleStr = (u?.role || (sess.user as any)?.app_metadata?.role || (sess.user as any)?.user_metadata?.role || '').toString().toLowerCase();
      const role = roleStr.includes('super') ? 'super' : (roleStr.includes('admin') ? 'admin' : 'other');
      const branch = (u?.branch as any) || null;
      setMe({ email, branch, role });

      // contacts: same branch unless super
      let q = supabase.from('dashboard_users').select('full_name,email,branch,status').eq('status', 'Active').neq('email', email);
      if (role !== 'super' && branch) q = q.eq('branch', branch);
      const { data: list } = await q.order('full_name');
      setContacts(((list || []) as any).map((r: any) => ({ full_name: r.full_name, email: r.email })));
    })();
  }, []);

  const loadMsgs = async (peer: string) => {
    if (!me) return;
    const { data } = await supabase.from('messages')
      .select('id,sender_email,recipient_email,body,created_at')
      .or(`and(sender_email.eq.${me.email},recipient_email.eq.${peer}),and(sender_email.eq.${peer},recipient_email.eq.${me.email})`)
      .order('created_at', { ascending: true })
      .limit(500);
    setMsgs((data as any) || []);
    setTimeout(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, 0);
  };

  useEffect(() => {
    if (!sel) return;
    loadMsgs(sel);
    const ch = supabase
      .channel('rt:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row: any = payload.new;
        if (!me) return;
        if ((row.sender_email === me.email && row.recipient_email === sel) || (row.sender_email === sel && row.recipient_email === me.email)) {
          setMsgs(prev => [...prev, { id: row.id, sender_email: row.sender_email, recipient_email: row.recipient_email, body: row.body, created_at: row.created_at }]);
          setTimeout(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, 0);
        }
      })
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch { } };
  }, [sel, me]);

  const send = async () => {
    if (!me || !sel || !text.trim()) return;
    await supabase.from('messages').insert([{ sender_email: me.email, recipient_email: sel, body: text.trim() }]);
    setText('');
  };

  const contactName = useMemo(() => contacts.find(c => c.email === sel)?.full_name || sel, [contacts, sel]);

  return (
    <>
      <Helmet>
        <title>Messenger | GSL Pakistan CRM</title>
      </Helmet>
      <main className="w-full min-h-screen bg-background-main flex">
        <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          <section className="mt-8 lg:mt-12 grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Contacts */}
            <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-3 lg:col-span-1">
              <div className="text-sm font-bold mb-2">Contacts {me?.role !== 'super' && me?.branch ? `(Branch: ${me.branch})` : ''}</div>
              <div className="max-h-[70vh] overflow-auto divide-y">
                {contacts.map(c => (
                  <button key={c.email} onClick={() => setSel(c.email)} className={`w-full text-left px-2 py-2 ${sel === c.email ? 'bg-orange-50' : ''}`}>
                    <div className="font-semibold text-sm">{c.full_name}</div>
                    <div className="text-xs text-text-secondary">{c.email}</div>
                  </button>
                ))}
                {contacts.length === 0 && <div className="text-xs text-text-secondary">No contacts</div>}
              </div>
            </div>

            {/* Chat */}
            <div className="bg-white rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-3 lg:col-span-3 flex flex-col">
              <div className="text-sm font-bold mb-2 border-b pb-2">{sel ? `Chat with ${contactName}` : 'Select a contact'}</div>
              <div ref={listRef} className="flex-1 overflow-auto space-y-2">
                {msgs.map(m => (
                  <div key={m.id} className={`max-w-[70%] rounded px-3 py-2 text-sm ${m.sender_email === me?.email ? 'bg-orange-100 ml-auto' : 'bg-gray-100'}`}>
                    <div>{m.body}</div>
                    <div className="text-[10px] text-text-secondary mt-1">{new Date(m.created_at).toLocaleString()}</div>
                  </div>
                ))}
                {sel && msgs.length === 0 && <div className="text-xs text-text-secondary">Say hello...</div>}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }} placeholder="Type a message" className="border rounded p-2 flex-1 text-sm" />
                <button onClick={send} className="px-4 py-2 rounded bg-[#ffa332] text-white font-bold text-sm">Send</button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export default Messenger;

