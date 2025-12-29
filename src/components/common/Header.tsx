/**
 * @fileoverview Header Component
 * 
 * Main header component for the GSL CRM application.
 * Displays search bar, notifications, and user profile dropdown.
 * Includes real-time notification updates via Supabase subscriptions.
 * 
 * @module components/common/Header
 */

import React, { useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import SearchView from '../ui/SearchView';
import Dropdown from '../ui/Dropdown';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import ToastContainer, { ToastNotification } from '../ToastContainer';

/**
 * Props for Header component
 */
interface HeaderProps {
  /** Additional CSS classes */
  className?: string;
  /** Callback when search is performed */
  onSearch?: (value: string) => void;
  /** Callback when profile option is selected */
  onProfileSelect?: (value: string) => void;
  /** Callback when notification icon is clicked */
  onNotificationClick?: () => void;
}

/**
 * Header Component
 * 
 * Application header with search, notifications, and user profile.
 * 
 * **Features:**
 * - Global search functionality
 * - Real-time notification system
 * - Role-based notification filtering
 * - User profile dropdown (Profile, Settings, Logout)
 * - Auto-mark notifications as read
 * - Real-time user data updates via Supabase
 * - Avatar display with fallback
 * 
 * **Notification System:**
 * - Fetches notifications on mount
 * - Filters by recipient email or role
 * - Real-time updates via postgres_changes subscription
 * - Unread count badge
 * - Dropdown panel with notification list
 * 
 * @component
 */
const Header = ({
  className,
  onSearch,
  onProfileSelect,
  onNotificationClick
}: HeaderProps) => {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState<string>('Loading...');
  const [email, setEmail] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [notifCount, setNotifCount] = useState<number>(0);
  const [notifs, setNotifs] = useState<Array<{ id: number; title: string; body?: string; created_at?: string }>>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [toastNotifications, setToastNotifications] = useState<ToastNotification[]>([]);

  useEffect(() => {
    let mounted = true;
    let chan: any = null;
    (async () => {
      const { data: sess } = await supabase.auth.getUser();
      const em = sess.user?.email || '';
      if (!mounted) return;
      setEmail(em);
      // Try dashboard_users for full name and avatar
      const { data: u } = await supabase.from('dashboard_users').select('full_name,email,avatar_url,role').eq('email', em).maybeSingle();
      setDisplayName(u?.full_name || em || 'User');
      setAvatarUrl(u?.avatar_url || '');
      const roleLower = (u?.role || '').toString().toLowerCase();
      const wantedRoles = roleLower.includes('super') ? ['super', 'admin', 'finance'] : (roleLower ? [roleLower] : []);

      // Load initial notifications (email-targeted or role-targeted)
      let notificationsReady = true;
      try {
        const { data: ns, error: nErr } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        if (nErr) throw nErr;
        const filtered = (ns || []).filter((n: any) => {
          const rr = (n.recipient_role || n.role || '').toString().toLowerCase();
          const byRole = wantedRoles.some((w: string) => rr.includes(w));
          const targetEmail = n.recipient_email || n.email;
          return targetEmail === em || byRole;
        });
        const list = filtered.map((n: any) => ({ id: n.id, title: n.title, body: n.body, created_at: n.created_at }));
        setNotifs(list as any);
        setNotifCount(filtered.filter((n: any) => (("read_at" in n) ? !n.read_at : true) && ((n.recipient_email || n.email) === em)).length);
      } catch (_) {
        notificationsReady = false; // Table/columns may vary in this environment; skip realtime for it
        setNotifs([]);
        setNotifCount(0);
      }

      // subscribe to name/avatar changes and new notifications
      chan = supabase
        .channel('rt:header_user')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dashboard_users' }, (payload) => {
          const row: any = payload.new;
          if (row?.email === em) {
            setDisplayName(row.full_name || em);
            setAvatarUrl(row.avatar_url || '');
          }
        });
      if (notificationsReady) {
        chan = chan.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload: any) => {
          const row: any = payload.new;
          const rr = (row?.recipient_role || row?.role || '').toString().toLowerCase();
          const byRole = wantedRoles.some((w: string) => rr.includes(w));
          const targetEmail = row?.recipient_email || row?.email;
          if (targetEmail === em || byRole) {
            setNotifs(prev => [{ id: row.id, title: row.title, body: row.body, created_at: row.created_at }, ...prev].slice(0, 10));
            if (targetEmail === em) {
              setNotifCount(c => c + 1);
              // Show toast notification
              const toastId = `toast-${row.id}-${Date.now()}`;
              setToastNotifications(prev => [...prev, {
                id: toastId,
                title: row.title || 'New Notification',
                message: row.body || '',
                type: 'info'
              }]);
            }
          }
        });
      }
      chan = chan.subscribe();
    })();
    return () => { mounted = false; try { if (chan) supabase.removeChannel(chan); } catch { } };
  }, []);

  const profileOptions = [
    { value: 'profile', label: 'View Profile' },
    { value: 'settings', label: 'Settings' },
    { value: 'logout', label: 'Logout' },
  ];

  const handleSearch = (value: string) => {
    if (onSearch) {
      onSearch(value);
    }
  };

  const handleProfileChange = async (value: string) => {
    if (onProfileSelect) {
      onProfileSelect(value);
      return;
    }
    if (value === 'profile') {
      navigate('/profile');
    } else if (value === 'settings') {
      navigate('/profile?tab=settings');
    } else if (value === 'logout') {
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    }
  };

  const handleNotificationClick = async () => {
    setShowNotif(!showNotif);
    if (!showNotif && notifCount > 0) {
      // Mark all as read
      try { await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_email', email).is('read_at', null); setNotifCount(0); } catch { }
    }
    if (onNotificationClick) {
      onNotificationClick();
    }
  };

  const handleDismissToast = (id: string) => {
    setToastNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <>
      <header
        className={twMerge(
          'w-full flex items-center justify-between flex-wrap gap-4',
          'mt-5',
          className
        )}
      >
        {/* Search Section */}
        <div className="flex-1 min-w-0">
          <SearchView
            placeholder="Search"
            text_font_size="16"
            text_font_family="Nunito Sans"
            text_font_weight="400"
            text_line_height="22px"
            text_text_align="left"
            text_color="#7d8592"
            fill_background_color="#ffffff"
            border_border_radius="14px"
            effect_box_shadow="0px 6px 58px #c3cbd61a"
            layout_gap="10px"
            padding="10px 16px 10px 50px"
            onSearch={handleSearch}
            leftIcon={
              <img
                src="/images/img_search.svg"
                alt="Search"
                className="w-6 h-6"
              />
            }
          />
        </div>

        {/* Right Section - Notifications & Profile */}
        <div className="w-full sm:w-auto flex items-center gap-4 flex-wrap justify-end">
          {/* Notification Button */}
          <div className="relative">
            <button
              onClick={handleNotificationClick}
              className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-lg shadow-[0px_6px_58px_#c3cbd61a] flex items-center justify-center transition-all duration-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-500 relative"
              aria-label="Notifications"
            >
              <img
                src="/images/img_notifications.svg"
                alt="Notifications"
                className="w-5 h-5 sm:w-6 sm:h-6"
              />
              {notifCount > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] rounded-full px-1">{notifCount}</span>}
            </button>
            {showNotif && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50">
                <div className="p-2 text-sm font-bold border-b">Notifications</div>
                <div className="max-h-80 overflow-auto">
                  {notifs.map(n => (
                    <div key={n.id} className="px-3 py-2 border-b">
                      <div className="text-sm font-semibold">{n.title}</div>
                      {n.body && <div className="text-xs text-text-secondary">{n.body}</div>}
                      {n.created_at && <div className="text-[10px] text-text-secondary mt-1">{new Date(n.created_at).toLocaleString()}</div>}
                    </div>
                  ))}
                  {notifs.length === 0 && <div className="px-3 py-2 text-xs text-text-secondary">No notifications</div>}
                </div>
              </div>
            )}
          </div>

          {/* Profile Dropdown */}
          <div className="min-w-[180px] max-w-full">
            <Dropdown
              placeholder={displayName}
              text_font_size="16"
              text_font_family="Nunito Sans"
              text_font_weight="700"
              text_line_height="22px"
              text_text_align="left"
              text_color="#0a1629"
              fill_background_color="#ffffff"
              border_border_radius="14px"
              effect_box_shadow="0px 6px 58px #c3cbd61a"
              layout_gap="10px"
              padding="10px 40px 10px 56px"
              options={profileOptions}
              onChange={handleProfileChange}
              leftIcon={
                <img
                  src={avatarUrl || '/images/img_elm_header_photo.png'}
                  alt="Profile"
                  className="w-[30px] h-6 rounded-full object-cover"
                />
              }
              rightIcon={
                <img
                  src="/images/img_icn_general_arrow_dark_right.svg"
                  alt="Arrow"
                  className="w-6 h-6"
                />
              }
            />
          </div>
        </div>
      </header>

      {/* Toast Notifications */}
      <ToastContainer notifications={toastNotifications} onDismiss={handleDismissToast} />
    </>
  );
};

export default Header;