import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

import { useIdleLogout } from './hooks/useIdleLogout';

// Import page components
import DashboardPage from './pages/Dashboard';
import LoginPage from './pages/Login';
import CasesPage from './pages/Cases';
import CaseTaskDetailPage from './pages/Cases/Detail';
import CalendarPage from './pages/Calendar';
import FinancesPage from './pages/Finances';

import MessengerPage from './pages/Messenger';
import InfoPage from './pages/Info';
import ReportsPage from './pages/Reports';
import SuperAdminPage from './pages/SuperAdmin';
import ConsultantPage from './pages/Consultant';
import StudentsPage from './pages/Students';
import ServicesPage from './pages/Services';
import UsersPage from './pages/Users';
import TeachersPanel from './pages/Teachers/Panel';
import ProfilePage from './pages/Profile';
import LeavesPage from './pages/Leaves';


// Simple ProtectedRoute using Supabase session + idle logout
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { supabase } = await import('./lib/supabaseClient');
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        if (data.session) {
          setAllowed(true);
        } else {
          setAllowed(false);
          navigate('/login', { replace: true });
        }
        // subscribe to changes
        supabase.auth.onAuthStateChange((_evt, session) => {
          if (!mounted) return;
          if (!session) {
            setAllowed(false);
            navigate('/login', { replace: true });
          } else {
            setAllowed(true);
          }
        });
      } catch {
        setAllowed(false);
        navigate('/login', { replace: true });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  // Auto-logout on inactivity after 5 minutes when allowed
  useIdleLogout({
    enabled: !!allowed,
    timeoutMs: 5 * 60 * 1000,
    onTimeout: () => navigate('/login', { replace: true }),
  });

  if (allowed === null) return null; // or a loader
  return children;
};

// Wrapper that renders Super Admin or regular Dashboard based on user role
const RoleBasedDashboard: React.FC = () => {
  const [role, setRole] = useState<'super' | 'consultant' | 'default' | null>(null);

  useEffect(() => {
    let mounted = true;

    const extractRoles = (user: any): string[] => {
      const am = user?.app_metadata ?? {};
      const um = user?.user_metadata ?? {};
      const list: any[] = [
        ...(typeof am.role === 'string' ? [am.role] : []),
        ...(Array.isArray(am.roles) ? am.roles : []),
        ...(typeof um.role === 'string' ? [um.role] : []),
        ...(Array.isArray(um.roles) ? um.roles : []),
      ];
      return list.filter((r) => typeof r === 'string').map((r: string) => r.toLowerCase());
    };

    const resolveRole = (user: any): 'super' | 'consultant' | 'default' => {
      const roles = extractRoles(user);
      if (roles.some(r => r.includes('super'))) return 'super';
      if (roles.some(r => r.includes('consult'))) return 'consultant';
      return 'default';
    };

    (async () => {
      try {
        const { supabase } = await import('./lib/supabaseClient');
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setRole(resolveRole(data.session?.user));
        supabase.auth.onAuthStateChange((_evt, session) => {
          if (!mounted) return;
          setRole(resolveRole(session?.user));
        });
      } catch {
        if (!mounted) return;
        setRole('default');
      }
    })();

    return () => { mounted = false; };
  }, []);

  if (role === null) return null; // small loader placeholder
  return role === 'super' ? <SuperAdminPage /> : role === 'consultant' ? <ConsultantPage /> : <DashboardPage />;
};


const AppRoutes = () => {
  return (
    <Router>
      <Routes>
        <Route path="/dashboard" element={<ProtectedRoute><RoleBasedDashboard /></ProtectedRoute>} />
        <Route path="/cases" element={<ProtectedRoute><CasesPage /></ProtectedRoute>} />
        <Route path="/cases/:caseNumber" element={<ProtectedRoute><CaseTaskDetailPage /></ProtectedRoute>} />
        <Route path="/cases/:caseNumber/tasks/:taskId" element={<ProtectedRoute><CaseTaskDetailPage /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />

        <Route path="/students" element={<ProtectedRoute><StudentsPage /></ProtectedRoute>} />
        <Route path="/services" element={<ProtectedRoute><ServicesPage /></ProtectedRoute>} />
        <Route path="/teachers" element={<ProtectedRoute><TeachersPanel /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
        <Route path="/finances" element={<ProtectedRoute><FinancesPage /></ProtectedRoute>} />

        <Route path="/messenger" element={<ProtectedRoute><MessengerPage /></ProtectedRoute>} />
        <Route path="/info" element={<ProtectedRoute><InfoPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
        <Route path="/leaves" element={<ProtectedRoute><LeavesPage /></ProtectedRoute>} />

        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<LoginPage />} />
      </Routes>
    </Router>
  );
};

export default AppRoutes;