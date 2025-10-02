import React from 'react';
import { twMerge } from 'tailwind-merge';
import { useLocation, useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';



interface SidebarProps {
  className?: string;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const Sidebar = ({
  className,
  isCollapsed = false,
  onToggle
}: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '/images/img_icn_sidebar_dashboard_active.svg',
      href: '/dashboard',
      isActive: true
    },
    {
      id: 'cases',
      label: 'On Going Cases',
      icon: '/images/img_icn_sidebar_projects_inactive.svg',
      href: '/cases',
      isActive: false
    },
    {
      id: 'students',
      label: 'Students',
      icon: '/images/img_icn_sidebar_projects_inactive.svg',
      href: '/students',
      isActive: false
    },
    {
      id: 'services',
      label: 'Products & Services',
      icon: '/images/img_icn_sidebar_projects_inactive.svg',
      href: '/services',
      isActive: false
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: '/images/img_icn_sidebar_calendar_inactive.svg',
      href: '/calendar',
      isActive: false
    },
    {
      id: 'finances',
      label: 'Finances',
      icon: '/images/img_icn_sidebar_vac.svg',
      href: '/finances',
      isActive: false
    },
    {
      id: 'employees',
      label: 'Employees',
      icon: '/images/img_icn_sidebar_emp.svg',
      href: '/employees',
      isActive: false
    },
    {
      id: 'messenger',
      label: 'Messenger',
      icon: '/images/img_icn_sidebar_mes.svg',
      href: '/messenger',
      isActive: false
    },
    {
      id: 'info-portal',
      label: 'Info Portal',
      icon: '/images/img_icn_sidebar_inf.svg',
      href: '/info-portal',
      isActive: false
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: '/images/img_icn_sidebar_projects_inactive.svg',
      href: '/reports',
      isActive: false
    }
  ];

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
        <img src={logo} alt="GSL Logo" className="h-12 object-contain" />
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