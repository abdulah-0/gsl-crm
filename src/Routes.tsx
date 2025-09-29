import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

// Import page components
import DashboardPage from './pages/Dashboard';
import LoginPage from './pages/Login';
import CasesPage from './pages/Cases';
import CalendarPage from './pages/Calendar';
import FinancesPage from './pages/Finances';
import EmployeesPage from './pages/Employees';
import MessengerPage from './pages/Messenger';
import InfoPortalPage from './pages/InfoPortal';
import ReportsPage from './pages/Reports';
import SuperAdminPage from './pages/SuperAdmin';
import ConsultantPage from './pages/Consultant';


// Simple ProtectedRoute using Supabase session
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
        <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />

        <Route path="/finances" element={<ProtectedRoute><FinancesPage /></ProtectedRoute>} />
        <Route path="/employees" element={<ProtectedRoute><EmployeesPage /></ProtectedRoute>} />
        <Route path="/messenger" element={<ProtectedRoute><MessengerPage /></ProtectedRoute>} />
        <Route path="/info-portal" element={<ProtectedRoute><InfoPortalPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<LoginPage />} />
      </Routes>
    </Router>
  );
};

export default AppRoutes;