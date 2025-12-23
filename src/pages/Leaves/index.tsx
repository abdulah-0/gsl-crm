/**
 * @fileoverview Leaves Self-Service Portal
 * 
 * Employee leave application portal for the GSL CRM.
 * Allows users to view their leave balance, apply for leave, and track request status.
 * 
 * **Key Features:**
 * - Leave balance display (CL, SL, AL)
 * - Leave request submission
 * - Personal leave history with status tracking
 * - Real-time updates via Supabase
 * 
 * **Leave Types:**
 * - CL: Casual Leave
 * - SL: Sick Leave
 * - AL: Annual Leave
 * 
 * **Leave Status:**
 * - Pending: Awaiting approval
 * - Approved: Approved by HR/Admin
 * - Rejected: Rejected by HR/Admin
 * 
 * **Access Control:**
 * - All authenticated users can access this page
 * - Users can only view and manage their own leaves
 * - Approval/rejection handled in HRM module
 * 
 * @module pages/Leaves
 */

import React, { useEffect, useState } from 'react';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';

// Types
type LeaveType = 'CL' | 'SL' | 'AL';
type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

interface LeaveRequest {
  id: number;
  employee_email: string;
  leave_type?: string | null;
  type?: string | null; // legacy field
  start_date: string;
  end_date: string;
  status: LeaveStatus;
  reason?: string | null;
  created_at?: string;
  manager_approved_by?: string | null;
  hr_approved_by?: string | null;
  ceo_approved_by?: string | null;
}

interface LeaveBalance {
  employee_email: string;
  cl_entitlement?: number | null;
  sl_entitlement?: number | null;
  al_entitlement?: number | null;
  cl_availed?: number | null;
  sl_availed?: number | null;
  al_availed?: number | null;
}

const LeavesPage: React.FC = () => {
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);

  // Leave application form state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyType, setApplyType] = useState<LeaveType>('CL');
  const [applyStart, setApplyStart] = useState('');
  const [applyEnd, setApplyEnd] = useState('');
  const [applyReason, setApplyReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Get current user
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const email = data.user?.email || '';
        if (mounted) setCurrentUserEmail(email);
      } catch (err) {
        console.error('Error getting user:', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load user's leaves
  const loadMyLeaves = async () => {
    if (!currentUserEmail) return;
    try {
      const { data, error } = await supabase
        .from('leaves')
        .select('id, employee_email, leave_type, type, start_date, end_date, status, reason, created_at, manager_approved_by, hr_approved_by, ceo_approved_by')
        .eq('employee_email', currentUserEmail)
        .order('created_at', { ascending: false });

      if (!error) {
        setMyLeaves((data as LeaveRequest[]) || []);
      }
    } catch (err) {
      console.error('Error loading leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load leave balance
  const loadLeaveBalance = async () => {
    if (!currentUserEmail) return;
    try {
      const { data, error } = await supabase
        .from('employee_leave_balances')
        .select('employee_email, cl_entitlement, sl_entitlement, al_entitlement, cl_availed, sl_availed, al_availed')
        .eq('employee_email', currentUserEmail)
        .maybeSingle();

      if (!error && data) {
        setLeaveBalance(data as LeaveBalance);
      }
    } catch (err) {
      console.error('Error loading leave balance:', err);
    }
  };

  useEffect(() => {
    if (currentUserEmail) {
      loadMyLeaves();
      loadLeaveBalance();
    }
  }, [currentUserEmail]);

  // Real-time subscription
  useEffect(() => {
    if (!currentUserEmail) return;

    const channel = supabase
      .channel('realtime:my-leaves')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leaves',
        filter: `employee_email=eq.${currentUserEmail}`
      }, () => {
        loadMyLeaves();
        loadLeaveBalance();
      })
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        console.error('Error removing channel:', err);
      }
    };
  }, [currentUserEmail]);

  // Submit leave application
  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyStart || !applyEnd) {
      alert('Please select start and end dates');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        employee_email: currentUserEmail,
        leave_type: applyType,
        start_date: applyStart,
        end_date: applyEnd,
        status: 'Pending',
        reason: applyReason || null,
        created_by: currentUserEmail,
      };

      const { error } = await supabase.from('leaves').insert(payload);

      if (error) throw error;

      // Reset form
      setShowApplyModal(false);
      setApplyStart('');
      setApplyEnd('');
      setApplyReason('');
      setApplyType('CL');

      // Reload data
      await loadMyLeaves();
      await loadLeaveBalance();

      alert('Leave request submitted successfully!');
    } catch (err: any) {
      console.error('Error submitting leave:', err);
      alert(err?.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate leave balance
  const getBalance = (type: 'CL' | 'SL' | 'AL') => {
    if (!leaveBalance) return { entitled: 0, availed: 0, remaining: 0 };

    const entitled = type === 'CL' ? (leaveBalance.cl_entitlement || 0) :
      type === 'SL' ? (leaveBalance.sl_entitlement || 0) :
        (leaveBalance.al_entitlement || 0);

    const availed = type === 'CL' ? (leaveBalance.cl_availed || 0) :
      type === 'SL' ? (leaveBalance.sl_availed || 0) :
        (leaveBalance.al_availed || 0);

    return {
      entitled,
      availed,
      remaining: entitled - availed
    };
  };

  // Format date
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Get leave type display name
  const getLeaveTypeName = (leave: LeaveRequest) => {
    return leave.leave_type || leave.type || 'N/A';
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const clBalance = getBalance('CL');
  const slBalance = getBalance('SL');
  const alBalance = getBalance('AL');

  return (
    <>
      <Helmet>
        <title>My Leaves - GSL Pakistan CRM</title>
      </Helmet>
      <main className="w-full min-h-screen bg-background-main flex">
        <div className="w-[14%] min-w-[200px] hidden lg:block"><Sidebar /></div>
        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          {/* Page Header */}
          <section className="mt-8 lg:mt-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-4xl text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>
                My Leaves
              </h1>
              <button
                onClick={() => setShowApplyModal(true)}
                className="px-4 py-2 rounded bg-[#ffa332] text-white font-semibold hover:bg-[#ff9520] transition-colors"
              >
                + Apply for Leave
              </button>
            </div>

            {/* Leave Balance Cards */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Casual Leave */}
              <div className="bg-white border rounded-lg shadow-sm p-4">
                <div className="text-sm text-text-secondary font-semibold">Casual Leave (CL)</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#ffa332]">{clBalance.remaining}</span>
                  <span className="text-sm text-text-secondary">/ {clBalance.entitled} days</span>
                </div>
                <div className="mt-1 text-xs text-text-secondary">
                  {clBalance.availed} days used
                </div>
              </div>

              {/* Sick Leave */}
              <div className="bg-white border rounded-lg shadow-sm p-4">
                <div className="text-sm text-text-secondary font-semibold">Sick Leave (SL)</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-blue-600">{slBalance.remaining}</span>
                  <span className="text-sm text-text-secondary">/ {slBalance.entitled} days</span>
                </div>
                <div className="mt-1 text-xs text-text-secondary">
                  {slBalance.availed} days used
                </div>
              </div>

              {/* Annual Leave */}
              <div className="bg-white border rounded-lg shadow-sm p-4">
                <div className="text-sm text-text-secondary font-semibold">Annual Leave (AL)</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-emerald-600">{alBalance.remaining}</span>
                  <span className="text-sm text-text-secondary">/ {alBalance.entitled} days</span>
                </div>
                <div className="mt-1 text-xs text-text-secondary">
                  {alBalance.availed} days used
                </div>
              </div>
            </div>

            {/* My Leave Requests */}
            <div className="mt-8 bg-white border rounded-lg shadow-sm">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-text-primary">My Leave Requests</h2>
              </div>
              <div className="p-4">
                {loading ? (
                  <div className="text-center py-8 text-text-secondary">Loading...</div>
                ) : myLeaves.length === 0 ? (
                  <div className="text-center py-8 text-text-secondary">
                    No leave requests yet. Click "Apply for Leave" to submit your first request.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr className="text-left text-text-secondary">
                          <th className="p-3">Type</th>
                          <th className="p-3">Start Date</th>
                          <th className="p-3">End Date</th>
                          <th className="p-3">Reason</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Applied On</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {myLeaves.map(leave => (
                          <tr key={leave.id} className="hover:bg-gray-50">
                            <td className="p-3">
                              <span className="font-semibold text-text-primary">
                                {getLeaveTypeName(leave)}
                              </span>
                            </td>
                            <td className="p-3">{formatDate(leave.start_date)}</td>
                            <td className="p-3">{formatDate(leave.end_date)}</td>
                            <td className="p-3 max-w-xs truncate">
                              {leave.reason || '-'}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(leave.status)}`}>
                                {leave.status}
                              </span>
                            </td>
                            <td className="p-3 text-text-secondary">
                              {leave.created_at ? formatDate(leave.created_at) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <form onSubmit={handleApplyLeave} className="bg-white rounded-lg border shadow-lg p-6 w-[92%] max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">Apply for Leave</h3>
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            {/* Leave Type */}
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1">
                Leave Type
              </label>
              <select
                className="w-full border rounded px-3 py-2"
                value={applyType}
                onChange={e => setApplyType(e.target.value as LeaveType)}
                required
              >
                <option value="CL">Casual Leave (CL)</option>
                <option value="SL">Sick Leave (SL)</option>
                <option value="AL">Annual Leave (AL)</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={applyStart}
                  onChange={e => setApplyStart(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={applyEnd}
                  onChange={e => setApplyEnd(e.target.value)}
                  min={applyStart}
                  required
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1">
                Reason (Optional)
              </label>
              <textarea
                className="w-full border rounded px-3 py-2"
                rows={3}
                value={applyReason}
                onChange={e => setApplyReason(e.target.value)}
                placeholder="Provide a reason for your leave request..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="px-4 py-2 rounded border hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded bg-[#ffa332] text-white font-semibold hover:bg-[#ff9520] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default LeavesPage;
