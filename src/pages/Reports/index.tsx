/**
 * @fileoverview Reports Page
 * 
 * Role-based reporting dashboard for the GSL CRM.
 * Provides customized analytics and insights based on user role.
 * 
 * **Role-Based Views:**
 * - **Teacher View:** Student performance, attendance, mock test results
 * - **Counselor View:** Case progress, student communications, task completion
 * - **Admin View:** Branch analytics, revenue, employee performance
 * - **Super Admin View:** Organization-wide metrics, multi-branch comparison
 * 
 * **Features:**
 * - Role detection from Supabase auth and dashboard_users
 * - Dynamic component rendering based on role
 * - Real-time data from Supabase
 * 
 * @module pages/Reports
 */

import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { supabase } from '../../lib/supabaseClient';
import TeacherView from './TeacherView';
import AdminView from './AdminView';
import SuperAdminView from './SuperAdminView';
import CounselorView from './CounselorView';

const Reports: React.FC = () => {
  const [role, setRole] = useState<'teacher' | 'admin' | 'super' | 'counselor' | 'other' | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: sess } = await supabase.auth.getUser();
      const user = sess.user as any;
      const em = user?.email || '';
      const { data: u } = await supabase.from('dashboard_users').select('role,email').eq('email', em).maybeSingle();
      if (!mounted) return;
      const roleStr = (u?.role || user?.app_metadata?.role || user?.user_metadata?.role || '').toString().toLowerCase();
      const ro = roleStr.includes('super') ? 'super' : roleStr.includes('admin') ? 'admin' : roleStr.includes('teach') ? 'teacher' : roleStr.includes('counsel') || roleStr.includes('staff') ? 'counselor' : 'other';
      setRole(ro as any);
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <>
      <Helmet>
        <title>Reports | GSL Pakistan CRM</title>
        <meta name="description" content="Role-based reporting for Teachers, Admins, Super Admins, and Counselors." />
      </Helmet>

      <main className="w-full min-h-screen bg-background-main flex">
        <div className="w-[14%] min-w-[200px] hidden lg:block">
          <Sidebar />
        </div>

        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          <section className="mt-8 lg:mt-12">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-4xl text-text-primary mb-3" style={{ fontFamily: 'Nunito Sans' }}>
              Reports
            </h1>
            {!role && <p className="text-text-secondary">Loading...</p>}
            {role === 'teacher' && <TeacherView />}
            {role === 'counselor' && <CounselorView />}
            {role === 'admin' && <AdminView />}
            {role === 'super' && <SuperAdminView />}
            {role === 'other' && (
              <div className="bg-white rounded-xl p-6 shadow">You have access to Reports. Please contact an administrator to assign a role for tailored reporting.</div>
            )}
          </section>
        </div>
      </main>
    </>
  );
};

export default Reports;
