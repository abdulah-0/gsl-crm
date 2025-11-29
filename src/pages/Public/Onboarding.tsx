/**
 * @fileoverview Public Employee Onboarding Page
 * 
 * Public-facing onboarding form for new employee candidates.
 * Accessed via secure token link sent by HR/Admin.
 * 
 * **Key Features:**
 * - 3-step onboarding process
 * - Secure token-based access
 * - Personal information collection
 * - Document upload (Photo, CNIC, Resume, Certificates)
 * - Draft saving capability
 * - Final submission to HR for approval
 * 
 * **Steps:**
 * 1. Personal Info: Name, CNIC, contact, address, emergency contact, bank details
 * 2. Attachments: Photo, CNIC scan, resume, certificates
 * 3. Review & Submit: Final review before submission
 * 
 * **Storage:**
 * - Files uploaded to Supabase Storage bucket: `employee-files`
 * - Organized by secure token
 * 
 * **Workflow:**
 * - HR creates onboarding record with secure token
 * - Candidate receives link with token
 * - Candidate fills form and submits
 * - HR approves and creates employee record
 * 
 * @module pages/Public/Onboarding
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

interface OnbRec {
  id: number;
  secure_token: string | null;
  status: string | null;
  candidate_email: string;
  full_name?: string | null;
  father_name?: string | null;
  cnic_no?: string | null;
  personal_contact?: string | null;
  current_address?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  date_of_birth?: string | null;
  blood_group?: string | null;
  qualification?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_no?: string | null;
  emergency_relationship?: string | null;
  bank_name?: string | null;
  account_title?: string | null;
  account_number?: string | null;
  attachments?: any;
}

const PublicOnboarding: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [row, setRow] = useState<OnbRec | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const token = useMemo(() => params.get('token') || '', [params]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token) { setLoading(false); return; }
      const { data } = await supabase
        .from('employee_onboardings')
        .select('*')
        .eq('secure_token', token)
        .maybeSingle();
      if (!mounted) return;
      if (!data) {
        setLoading(false);
        alert('Invalid or expired link');
        navigate('/login', { replace: true });
        return;
      }
      setRow(data as any);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [token, navigate]);

  const updateField = (k: keyof OnbRec, v: any) => {
    if (!row) return;
    setRow({ ...row, [k]: v });
  };

  const uploadFile = async (field: string, file: File) => {
    if (!row?.secure_token) return;
    const bucket = 'employee-files';
    const path = `${row.secure_token}/${Date.now()}-${file.name}`;
    const { error, data } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
    if (error) { alert('Upload failed: ' + error.message); return; }
    const { data: pub } = await supabase.storage.from(bucket).getPublicUrl(path);
    const url = pub?.publicUrl || '';
    const next = { ...(row.attachments || {}), [field]: url };
    setRow({ ...row, attachments: next });
  };

  const saveDraft = async () => {
    if (!row) return;
    const payload: any = {
      full_name: row.full_name,
      father_name: row.father_name,
      cnic_no: row.cnic_no,
      personal_contact: row.personal_contact,
      current_address: row.current_address,
      gender: row.gender,
      marital_status: row.marital_status,
      date_of_birth: row.date_of_birth,
      blood_group: row.blood_group,
      qualification: row.qualification,
      emergency_contact_name: row.emergency_contact_name,
      emergency_contact_no: row.emergency_contact_no,
      emergency_relationship: row.emergency_relationship,
      bank_name: row.bank_name,
      account_title: row.account_title,
      account_number: row.account_number,
      attachments: row.attachments || null,
    };
    const { error } = await supabase.from('employee_onboardings').update(payload).eq('id', row.id);
    if (error) alert(error.message); else alert('Saved');
  };

  const submit = async () => {
    if (!row) return;
    const payload: any = { ...row };
    payload.status = 'Submitted';
    payload.submitted_at = new Date().toISOString();
    const { error } = await supabase.from('employee_onboardings').update(payload).eq('id', row.id);
    if (error) alert(error.message); else alert('Submitted. HR will verify and approve.');
  };

  if (loading) return null;
  if (!row) return <div className="p-6">Invalid link</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-4">
        <div className="bg-white border rounded-lg shadow-sm p-4">
          <div className="text-xl font-semibold mb-2">Employee Onboarding</div>
          <div className="text-sm text-gray-600 mb-4">for {row.candidate_email}</div>

          <div className="flex gap-2 text-sm mb-4">
            <button onClick={() => setStep(1)} className={`px-3 py-1 rounded ${step === 1 ? 'bg-[#ffa332] text-white' : 'border'}`}>Personal Info</button>
            <button onClick={() => setStep(2)} className={`px-3 py-1 rounded ${step === 2 ? 'bg-[#ffa332] text-white' : 'border'}`}>Attachments</button>
            <button onClick={() => setStep(3)} className={`px-3 py-1 rounded ${step === 3 ? 'bg-[#ffa332] text-white' : 'border'}`}>Review & Submit</button>
          </div>

          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Full Name</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={row.full_name || ''} onChange={e => updateField('full_name', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold">Father/Husband Name</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={row.father_name || ''} onChange={e => updateField('father_name', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold">CNIC No</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={row.cnic_no || ''} onChange={e => updateField('cnic_no', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold">Personal Contact</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={row.personal_contact || ''} onChange={e => updateField('personal_contact', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-semibold">Current Address</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={row.current_address || ''} onChange={e => updateField('current_address', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold">Gender</label>
                <select className="mt-1 w-full border rounded px-2 py-1" value={row.gender || ''} onChange={e => updateField('gender', e.target.value)}>
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold">Marital Status</label>
                <select className="mt-1 w-full border rounded px-2 py-1" value={row.marital_status || ''} onChange={e => updateField('marital_status', e.target.value)}>
                  <option value="">Select</option>
                  <option>Single</option>
                  <option>Married</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold">Date of Birth</label>
                <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={row.date_of_birth || ''} onChange={e => updateField('date_of_birth', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold">Blood Group</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={row.blood_group || ''} onChange={e => updateField('blood_group', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold">Qualification</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={row.qualification || ''} onChange={e => updateField('qualification', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold">Emergency Contact Name</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={row.emergency_contact_name || ''} onChange={e => updateField('emergency_contact_name', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold">Emergency Contact No</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={row.emergency_contact_no || ''} onChange={e => updateField('emergency_contact_no', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold">Relationship</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={row.emergency_relationship || ''} onChange={e => updateField('emergency_relationship', e.target.value)} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold">Photo</label>
                <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile('photo', f); }} />
              </div>
              <div>
                <label className="text-sm font-semibold">CNIC</label>
                <input type="file" onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile('cnic', f); }} />
              </div>
              <div>
                <label className="text-sm font-semibold">Resume</label>
                <input type="file" onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile('resume', f); }} />
              </div>
              <div>
                <label className="text-sm font-semibold">Certificates</label>
                <input type="file" multiple onChange={async e => {
                  const files = Array.from(e.target.files || []);
                  for (const f of files) await uploadFile(`cert_${f.name}`, f);
                }} />
              </div>
              <div className="text-xs text-gray-500">Uploaded: {JSON.stringify(row.attachments || {})}</div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="text-sm">Please review your information. You can go back to make changes.</div>
              <pre className="text-xs bg-gray-50 border rounded p-2 overflow-auto">{JSON.stringify(row, null, 2)}</pre>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button onClick={saveDraft} className="px-3 py-2 rounded border">Save Draft</button>
            <button onClick={submit} className="px-3 py-2 rounded bg-[#ffa332] text-white font-semibold">Submit</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicOnboarding;

