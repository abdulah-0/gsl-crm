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
  const [role, setRole] = useState<'teacher'|'admin'|'super'|'counselor'|'other'|null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: sess } = await supabase.auth.getUser();
      const em = sess.user?.email || '';
      const { data: u } = await supabase.from('dashboard_users').select('role,email').eq('email', em).maybeSingle();
      if (!mounted) return;
      const r = (u?.role || '').toString().toLowerCase();
      const ro = r.includes('super') ? 'super' : r.includes('admin') ? 'admin' : r.includes('teach') ? 'teacher' : r.includes('counsel') || r.includes('staff') ? 'counselor' : 'other';
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
            {role==='teacher' && <TeacherView />}
            {role==='counselor' && <CounselorView />}
            {role==='admin' && <AdminView />}
            {role==='super' && <SuperAdminView />}
            {role==='other' && (
              <div className="bg-white rounded-xl p-6 shadow">You have access to Reports. Please contact an administrator to assign a role for tailored reporting.</div>
            )}
          </section>
        </div>
      </main>
    </>
  );
};

export default Reports;
