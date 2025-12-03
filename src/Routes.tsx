/**
 * @fileoverview Application Routing Configuration
 * 
 * This module defines all application routes, authentication protection, and role-based access control.
 * It implements a comprehensive routing system with:
 * - Protected routes requiring authentication
 * - Role-based dashboard rendering (Super Admin, Consultant, Default)
 * - Automatic idle logout after 5 minutes of inactivity
 * - User status validation (Active, Dormant, Inactive)
 * - Session management with Supabase authentication
 * 
 * @module Routes
 */

import React, { useEffect, useState, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';

import { useIdleLogout } from './hooks/useIdleLogout';

// Lazy load page components for performance optimization
const DashboardPage = React.lazy(() => import('./pages/Dashboard'));
const LoginPage = React.lazy(() => import('./pages/Login'));
const CasesPage = React.lazy(() => import('./pages/Cases'));
const CaseTaskDetailPage = React.lazy(() => import('./pages/Cases/Detail'));
const CalendarPage = React.lazy(() => import('./pages/Calendar'));
const FinancesPage = React.lazy(() => import('./pages/Finances'));
const HRMPage = React.lazy(() => import('./pages/HRM'));
const MessengerPage = React.lazy(() => import('./pages/Messenger'));
const InfoPage = React.lazy(() => import('./pages/Info'));
const ReportsPage = React.lazy(() => import('./pages/Reports'));
const SuperAdminPage = React.lazy(() => import('./pages/SuperAdmin'));
const ConsultantPage = React.lazy(() => import('./pages/Consultant'));
const DailyTasksPage = React.lazy(() => import('./pages/DailyTasks'));
const StudentsPage = React.lazy(() => import('./pages/Students'));
const ServicesPage = React.lazy(() => import('./pages/Services'));
const UsersPage = React.lazy(() => import('./pages/Users'));
const TeachersPage = React.lazy(() => import('./pages/Teachers'));
const TeacherDetail = React.lazy(() => import('./pages/Teachers/Detail'));
const UniversitiesPage = React.lazy(() => import('./pages/Universities'));
const LeadsPage = React.lazy(() => import('./pages/Leads'));
const ProfilePage = React.lazy(() => import('./pages/Profile'));
const LeavesPage = React.lazy(() => import('./pages/Leaves'));
const BranchEmployeesPage = React.lazy(() => import('./pages/Employees/BranchEmployees'));
const PublicOnboarding = React.lazy(() => import('./pages/Public/Onboarding'));
const PublicLeadForm = React.lazy(() => import('./pages/Public/PublicLeadForm'));
const PublicOnboardingForm = React.lazy(() => import('./pages/Public/PublicOnboardingForm'));

/**
 * Loading Fallback Component
 */
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
  </div>
);

/**
 * ProtectedRoute Component
 * 
 * A wrapper component that protects routes from unauthorized access.
 * It verifies the user's authentication status and account status before allowing access.
 * 
 * Features:
 * - Checks for valid Supabase session
 * - Validates user status (Active, Dormant, Inactive)
 * - Redirects to login if not authenticated or if account is Dormant/Inactive
 * - Subscribes to auth state changes for real-time updates
 * - Implements automatic idle logout after 5 minutes
 * - Shows loading state during authentication check
 * 
 * @component
 * @param {Object} props - Component props
 * @param {React.ReactElement} props.children - The protected content to render if authenticated
 * @returns {JSX.Element} Protected content or loading state
 * 
 * @example
 * ```tsx
 * <ProtectedRoute>
 *   <DashboardPage />
 * </ProtectedRoute>
 * ```
 */
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    // Track component mount status to prevent state updates after unmount
    let mounted = true;
    let authSub: any = null;

    (async () => {
      try {
        // Dynamically import Supabase client
        const { supabase } = await import('./lib/supabaseClient');
        const { data } = await supabase.auth.getSession();

        if (!mounted) return;

        if (data.session) {
          // Validate user account status (Active, Dormant, Inactive)
          // Dormant and Inactive users are logged out automatically
          try {
            const em = data.session.user?.email || '';
            const { data: du } = await supabase.from('dashboard_users').select('status').eq('email', em).maybeSingle();
            const st = (du?.status || 'Active').toString();

            if (st === 'Dormant' || st === 'Inactive') {
              await supabase.auth.signOut();
              setAllowed(false);
              navigate('/login', { replace: true });
              return;
            }
          } catch {
            // Silently handle errors in status check
          }
          setAllowed(true);
        } else {
          setAllowed(false);
          navigate('/login', { replace: true });
        }
        // Subscribe to authentication state changes for real-time updates
        authSub = supabase.auth.onAuthStateChange((_evt, session) => {
          if (!mounted) return;
          if (!session) {
            setAllowed(false);
            navigate('/login', { replace: true });
          } else {
            (async () => {
              try {
                const em = session.user?.email || '';
                const { data: du } = await supabase.from('dashboard_users').select('status').eq('email', em).maybeSingle();
                const st = (du?.status || 'Active').toString();
                if (st === 'Dormant' || st === 'Inactive') {
                  await supabase.auth.signOut();
                  setAllowed(false);
                  navigate('/login', { replace: true });
                  return;
                }
              } catch { }
              setAllowed(true);
            })();
          }
        });
      } catch {
        setAllowed(false);
        navigate('/login', { replace: true });
      }
    })();
    return () => {
      mounted = false;
      try { authSub?.data?.subscription?.unsubscribe?.(); } catch { }
    };
  }, [navigate]);

  /**
   * Automatic idle logout configuration
   * Logs out user after 5 minutes (300,000ms) of inactivity
   * Only enabled when user is authenticated (allowed === true)
   */
  useIdleLogout({
    enabled: !!allowed,
    timeoutMs: 5 * 60 * 1000, // 5 minutes
    onTimeout: () => navigate('/login', { replace: true }),
  });

  // Show loading state while checking authentication
  if (allowed === null) return (<div style={{ padding: 20, fontFamily: 'system-ui, sans-serif' }}>Loading...</div>);
  return children;
};

/**
 * RoleBasedDashboard Component
 * 
 * Dynamically renders the appropriate dashboard based on the user's role.
 * Supports three role types:
 * - 'super': Renders SuperAdminPage for super administrators
 * - 'consultant': Renders ConsultantPage for consultant users
 * - 'default': Renders standard DashboardPage for regular users
 * 
 * Role determination logic:
 * - Checks app_metadata.role, app_metadata.roles, user_metadata.role, and user_metadata.roles
 * - Searches for 'super' keyword for super admin role
 * - Searches for 'consult' keyword for consultant role
 * - Defaults to 'default' role if no matches found
 * 
 * @component
 * @returns {JSX.Element} Role-specific dashboard component
 * 
 * @example
 * ```tsx
 * <Route path="/dashboard" element={
 *   <ProtectedRoute>
 *     <RoleBasedDashboard />
 *   </ProtectedRoute>
 * } />
 * ```
 */
const RoleBasedDashboard: React.FC = () => {
  const [role, setRole] = useState<'super' | 'consultant' | 'default' | null>(null);

  useEffect(() => {
    let mounted = true;
    let authSub: any = null;

    /**
     * Extract all roles from user metadata
     * Checks both app_metadata and user_metadata for role/roles fields
     * 
     * @param user - Supabase user object
     * @returns Array of role strings in lowercase
     */
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

    /**
     * Determine user's primary role from extracted roles
     * Priority: super > consultant > default
     * 
     * @param user - Supabase user object
     * @returns Resolved role type
     */
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
        authSub = supabase.auth.onAuthStateChange((_evt, session) => {
          if (!mounted) return;
          setRole(resolveRole(session?.user));
        });
      } catch {
        if (!mounted) return;
        setRole('default');
      }
    })();

    return () => { mounted = false; try { authSub?.data?.subscription?.unsubscribe?.(); } catch { } };
  }, []);

  // Show nothing while determining role
  if (role === null) return null;

  // Render appropriate dashboard based on resolved role
  return role === 'super' ? <SuperAdminPage /> : role === 'consultant' ? <ConsultantPage /> : <DashboardPage />;
};


/**
 * AppRoutes Component
 * 
 * Main routing configuration for the entire application.
 * Defines all routes with their corresponding page components and protection levels.
 * 
 * Route categories:
 * - Public routes: /login, /onboard
 * - Protected routes: All other routes require authentication
 * - Role-based routes: /dashboard renders different content based on user role
 * 
 * @component
 * @returns {JSX.Element} Router configuration with all application routes
 */
const AppRoutes = () => {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/dashboard" element={<ProtectedRoute><RoleBasedDashboard /></ProtectedRoute>} />
          <Route path="/cases" element={<ProtectedRoute><CasesPage /></ProtectedRoute>} />
          <Route path="/cases/:caseNumber" element={<ProtectedRoute><CaseTaskDetailPage /></ProtectedRoute>} />
          <Route path="/cases/:caseNumber/tasks/:taskId" element={<ProtectedRoute><CaseTaskDetailPage /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />

          <Route path="/leads" element={<ProtectedRoute><LeadsPage /></ProtectedRoute>} />
          <Route path="/students" element={<ProtectedRoute><StudentsPage /></ProtectedRoute>} />
          <Route path="/teachers/:id" element={<ProtectedRoute><TeacherDetail /></ProtectedRoute>} />

          <Route path="/services" element={<ProtectedRoute><ServicesPage /></ProtectedRoute>} />
          <Route path="/teachers" element={<ProtectedRoute><TeachersPage /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
          {/* Renamed Finances -> Accounts; keep legacy redirect */}
          <Route path="/finances" element={<ProtectedRoute><Navigate to="/accounts" replace /></ProtectedRoute>} />
          <Route path="/accounts" element={<ProtectedRoute><FinancesPage /></ProtectedRoute>} />

          <Route path="/hrm" element={<ProtectedRoute><HRMPage /></ProtectedRoute>} />
          <Route path="/dailytask" element={<ProtectedRoute><DailyTasksPage /></ProtectedRoute>} />

          <Route path="/messenger" element={<ProtectedRoute><MessengerPage /></ProtectedRoute>} />
          <Route path="/info" element={<ProtectedRoute><InfoPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute><BranchEmployeesPage /></ProtectedRoute>} />
          <Route path="/universities" element={<ProtectedRoute><UniversitiesPage /></ProtectedRoute>} />

          <Route path="/leaves" element={<ProtectedRoute><LeavesPage /></ProtectedRoute>} />

          <Route path="/onboard" element={<PublicOnboarding />} />
          <Route path="/public-onboarding" element={<PublicOnboardingForm />} />
          <Route path="/public/lead-form" element={<PublicLeadForm />} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<LoginPage />} />
        </Routes>
      </Suspense>
    </Router>
  );
};

export default AppRoutes;