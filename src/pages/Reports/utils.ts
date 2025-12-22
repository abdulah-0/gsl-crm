import { supabase } from '../../lib/supabaseClient';
import * as XLSX from 'xlsx';

export type CurrentUserInfo = { email: string; name: string; role: string };

export async function getCurrentUserInfo(): Promise<CurrentUserInfo> {
  const { data: sess } = await supabase.auth.getUser();
  const email = sess.user?.email || '';
  const { data: u } = await supabase.from('dashboard_users').select('full_name, role, email').eq('email', email).maybeSingle();
  const role = (u?.role || '').toString();
  return { email, name: (u?.full_name || email || 'User') as string, role };
}

export async function ensureAttachmentsBucket() {
  try {
    // Try to create; ignore if exists
    // @ts-ignore - createBucket options depend on supabase-js version
    await supabase.storage.createBucket('report_attachments', { public: true });
  } catch (_) { /* exists or permissions */ }
}

export type UploadedFile = { path: string; url: string; name: string };

export async function uploadAttachments(files: File[], reportId: string, authorEmail: string): Promise<UploadedFile[]> {
  const out: UploadedFile[] = [];
  if (!files?.length) return out;
  await ensureAttachmentsBucket();
  const folder = `${authorEmail}/${reportId}`;
  for (const f of files) {
    const path = `${folder}/${Date.now()}_${f.name}`;
    const { error } = await supabase.storage.from('report_attachments').upload(path, f, { upsert: false });
    if (!error) {
      const { data } = supabase.storage.from('report_attachments').getPublicUrl(path);
      out.push({ path, url: data.publicUrl, name: f.name });
    }
  }
  return out;
}

export function exportToXLSX(filename: string, rows: any[], sheetName = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

