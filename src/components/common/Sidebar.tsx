/**
 * @fileoverview Sidebar Component
 * 
 * Main navigation sidebar for the GSL CRM application.
 * Provides role-based menu access with dynamic permission checking.
 * 
 * @module components/common/Sidebar
 */

import React, { useEffect, useMemo, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { useLocation, useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { supabase } from '../../lib/supabaseClient';

/**
 * Props for Sidebar component
 */
interface SidebarProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether sidebar is collapsed */
  isCollapsed?: boolean;
  /** Callback when sidebar is toggled */
  onToggle?: () => void;
}

/**
 * Sidebar Component
 * 
 * Navigation sidebar with role-based access control.
 * 
 * **Features:**
 * - Role-based menu filtering
 * - Granular permission checking via user_permissions table
 * - Super admin and admin full access
 * - Teacher-specific default permissions
 * - Active route highlighting
 * - Logout functionality
 * - Support button
 * - Responsive design (hidden on mobile)
 * 
 * **Permission System:**
 * - Checks auth metadata role first
 * - Falls back to dashboard_users.role
 * - Supports granular permissions from user_permissions table
 * - Super admins see all tabs including Users
 * - Admins see all tabs except Users
 * - Other roles see only permitted modules
 * 
 * **Menu Items:**
 * Dashboard, Cases, Leads, Students, Services, Calendar, Accounts,
 * Universities, Teachers, Employees, Leaves, HRM, Daily Task,
 * Messenger, Info, Reports, Users (super admin only)
 * 
 * @component
 */
const Sidebar = ({
  className,
  isCollapsed = false,
  onToggle
}: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const [allowed, setAllowed] = useState<string[] | null>(null);
  const [isSuper, setIsSuper] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getUser();
        const email = sess.user?.email;
        if (!email) { setAllowed(null); setIsSuper(false); return; }
        // Check app dashboard_users
        const { data: u } = await supabase.from('dashboard_users').select('role, permissions').eq('email', email).maybeSingle();
        // Prefer auth metadata role as source of truth; fallback to dashboard_users.role
        const roleStr = (((sess.user as any)?.app_metadata?.role) || ((sess.user as any)?.user_metadata?.role) || (u?.role) || '').toString();
        const role = roleStr.toLowerCase();
        const superRole = role.includes('super');
        const adminRole = role.includes('admin');
        setIsSuper(superRole);
        const ALL = ['dashboard', 'students', 'services', 'cases', 'leads', 'calendar', 'accounts', 'universities', 'teachers', 'employees', 'leaves', 'hrm', 'dailytask', 'messenger', 'info', 'reports', 'users'];
        const perms = Array.isArray(u?.permissions) ? (u?.permissions as any as string[]) : [];
        const normalizedPerms = (perms || []).map(p => p === 'info-portal' ? 'info' : p);
        // Prefer granular permissions when present
        const { data: up } = await supabase
          .from('user_permissions')
          .select('module, access, can_add, can_edit, can_delete')
          .eq('user_email', email);
        const granularAllowed = (up || [])
          .filter((r: any) => (r.can_add || r.can_edit || r.can_delete || (r.access && ['VIEW', 'CRUD'].includes(r.access))))
          .map((r: any) => (r.module === 'info-portal' ? 'info' : (r.module as string)));
        if (superRole || adminRole) {
          // Super Admin and Admin can access all tabs (Users tab still restricted below to super only)
          setAllowed(ALL);
        } else if ((granularAllowed && granularAllowed.length > 0)) {
          setAllowed(Array.from(new Set(granularAllowed)));
        } else if (role.includes('teacher')) {
          // Teachers by default only see Teachers unless explicitly granted more (fallback)
          setAllowed((normalizedPerms && normalizedPerms.length > 0) ? normalizedPerms : ['teachers']);
        } else {
          setAllowed(normalizedPerms.length ? normalizedPerms : null);
        }
      } catch {
        setAllowed(null);
        setIsSuper(false);
      }
    })();
  }, []);

  const baseMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '/images/img_icn_sidebar_dashboard_active.svg', href: '/dashboard' },
    { id: 'cases', label: 'On Going Cases', icon: '/images/img_icn_sidebar_projects_inactive.svg', href: '/cases' },
    { id: 'leads', label: 'Leads', icon: '/images/img_icn_sidebar_projects_inactive.svg', href: '/leads' },
    { id: 'students', label: 'Students', icon: '/images/img_icn_sidebar_projects_inactive.svg', href: '/students' },
    { id: 'services', label: 'Products & Services', icon: '/images/img_icn_sidebar_projects_inactive.svg', href: '/services' },
    { id: 'calendar', label: 'Calendar', icon: '/images/img_icn_sidebar_calendar_inactive.svg', href: '/calendar' },
    { id: 'accounts', label: 'Accounts', icon: '/images/img_icn_sidebar_vac.svg', href: '/accounts' },
    { id: 'universities', label: 'Universities', icon: '/images/img_icn_sidebar_projects_inactive.svg', href: '/universities' },

    { id: 'teachers', label: 'Teachers', icon: '/images/img_icn_sidebar_emp.svg', href: '/teachers' },
    { id: 'employees', label: 'Employees', icon: '/images/img_icn_sidebar_emp.svg', href: '/employees' },
    { id: 'leaves', label: 'Leaves', icon: '/images/img_icn_sidebar_calendar_inactive.svg', href: '/leaves' },
    { id: 'hrm', label: 'HRM', icon: '/images/img_icn_sidebar_emp.svg', href: '/hrm' },
    { id: 'dailytask', label: 'Daily Task', icon: '/images/img_icn_sidebar_calendar_inactive.svg', href: '/dailytask' },
    { id: 'messenger', label: 'Messenger', icon: '/images/img_icn_sidebar_mes.svg', href: '/messenger' },
    { id: 'info', label: 'Info', icon: '/images/img_icn_sidebar_inf.svg', href: '/info' },
    { id: 'reports', label: 'Reports', icon: '/images/img_icn_sidebar_projects_inactive.svg', href: '/reports' },
    { id: 'users', label: 'Users', icon: '/images/img_icn_sidebar_projects_inactive.svg', href: '/users' },
  ];

  const menuItems = useMemo(() => {
    // Compute effective permissions
    const computed = (() => {
      if (!allowed) return baseMenuItems.filter(mi => mi.id !== 'users');
      return baseMenuItems.filter(mi => allowed.includes(mi.id));
    })();
    // Enforce Users tab only for super admins
    return computed.filter(mi => mi.id !== 'users' || isSuper);
  }, [allowed, isSuper]);

  const handleMenuClick = (_itemLabel: string, href: string) => {
    navigate(href);
  };


  const handleLogout = async () => {
    try {
      const { supabase } = await import('../../lib/supabaseClient');
      await supabase.auth.signOut();
    } catch (e) {
      // noop
    } finally {
      navigate('/login');
    }
  };

  return (
    <aside
      className={twMerge(
        'w-full max-w-[200px] h-full bg-white shadow-[0px_6px_58px_#c3cbd61a] pt-2 mt-5 ml-5',
        'flex flex-col',
        'hidden lg:flex', // Hide on mobile, show on large screens
        className
      )}
    >

      {/* Logo */}
      <div className="flex items-center justify-center mb-4 px-4">
        <img src={logo} alt="GSL Logo" className="h-16 object-contain" />
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-[18px]">
        <div className="flex flex-col gap-2">
          {menuItems.map((item) => {
            const isActive = currentPath.startsWith(item.href);
            return (
              <button
                key={item.id}
                onClick={() => handleMenuClick(item.label, item.href)}
                className={twMerge(
                  'flex items-center w-full p-2 rounded-lg transition-all duration-200',
                  'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500',
                  isActive ? 'bg-orange-50' : ''
                )}
                role="menuitem"
              >
                <img
                  src={item.icon}
                  alt={`${item.label} icon`}
                  className="w-6 h-6 flex-shrink-0"
                />
                <span
                  className={twMerge(
                    'ml-4 text-base font-semibold leading-base text-left',
                    isActive ? 'text-[#ffa332]' : 'text-text-secondary'
                  )}
                  style={{
                    fontFamily: 'Nunito Sans',
                    fontSize: '16px',
                    fontWeight: '600',
                    lineHeight: '22px'
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Illustration */}
      <div className="px-[18px] mt-[382px] mb-8">
        <img
          src="/images/img_illustration.svg"
          alt="Illustration"
          className="w-full max-w-[138px] h-[124px] object-contain mx-auto"
        />
      </div>

      {/* Bottom Actions */}
      <div className="px-[18px] pb-[66px]">
        <div className="flex flex-col gap-2">
          {/* Support Button */}
          <button
            className="flex items-center w-full p-[10px] bg-primary-background rounded-lg shadow-[0px_6px_12px_#3f8cff43] transition-all duration-200 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-orange-500"
            role="menuitem"
          >
            <img
              src="/images/img_icn_general_support_white.svg"
              alt="Support icon"
              className="w-6 h-6 ml-6"
            />
            <span
              className="ml-2 text-white font-bold leading-base"
              style={{
                fontFamily: 'Nunito Sans',
                fontSize: '16px',
                fontWeight: '700',
                lineHeight: '22px'
              }}
            >
              Support
            </span>
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center w-full p-2 rounded-lg transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
            role="menuitem"
          >
            <img
              src="/images/img_icn_sidebar_logout.svg"
              alt="Logout icon"
              className="w-6 h-6"
            />
            <span
              className="ml-4 text-text-secondary font-semibold leading-base"
              style={{
                fontFamily: 'Nunito Sans',
                fontSize: '16px',
                fontWeight: '600',
                lineHeight: '22px',
                color: '#7d8592'
              }}
            >
              Logout
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;