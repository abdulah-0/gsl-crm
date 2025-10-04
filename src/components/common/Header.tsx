import React, { useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import SearchView from '../ui/SearchView';
import Dropdown from '../ui/Dropdown';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

interface HeaderProps {
  className?: string;
  onSearch?: (value: string) => void;
  onProfileSelect?: (value: string) => void;
  onNotificationClick?: () => void;
}

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: sess } = await supabase.auth.getUser();
      const em = sess.user?.email || '';
      if (!mounted) return;
      setEmail(em);
      // Try dashboard_users for full name and avatar
      const { data: u } = await supabase.from('dashboard_users').select('full_name,email,avatar_url').eq('email', em).maybeSingle();
      setDisplayName(u?.full_name || em || 'User');
      setAvatarUrl(u?.avatar_url || '');
      // subscribe to name/avatar changes
      const chan = supabase
        .channel('rt:header_user')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dashboard_users' }, (payload) => {
          const row: any = payload.new;
          if (row?.email === em) {
            setDisplayName(row.full_name || em);
            setAvatarUrl(row.avatar_url || '');
          }
        })
        .subscribe();
      return () => { mounted = false; supabase.removeChannel(chan); };
    })();
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

  const handleNotificationClick = () => {
    if (onNotificationClick) {
      onNotificationClick();
    }
  };

  return (
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
        <button
          onClick={handleNotificationClick}
          className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-lg shadow-[0px_6px_58px_#c3cbd61a] flex items-center justify-center transition-all duration-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          aria-label="Notifications"
        >
          <img
            src="/images/img_notifications.svg"
            alt="Notifications"
            className="w-5 h-5 sm:w-6 sm:h-6"
          />
        </button>

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
  );
};

export default Header;