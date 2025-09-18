import React from 'react';
import { twMerge } from 'tailwind-merge';
import SearchView from '../ui/SearchView';
import Dropdown from '../ui/Dropdown';

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
  const profileOptions = [
    { value: 'evan', label: 'Evan Yates' },
    { value: 'profile', label: 'View Profile' },
    { value: 'settings', label: 'Settings' },
    { value: 'logout', label: 'Logout' },
  ];

  const handleSearch = (value: string) => {
    if (onSearch) {
      onSearch(value);
    }
  };

  const handleProfileChange = (value: string) => {
    if (onProfileSelect) {
      onProfileSelect(value);
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
        'w-full flex items-center justify-between',
        'ml-[250px] mt-5', // Offset for sidebar
        className
      )}
    >
      {/* Search Section */}
      <div className="w-[36%]">
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
      <div className="w-[22%] flex items-center gap-6">
        {/* Notification Button */}
        <button
          onClick={handleNotificationClick}
          className="w-12 h-12 bg-white rounded-lg shadow-[0px_6px_58px_#c3cbd61a] flex items-center justify-center transition-all duration-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          aria-label="Notifications"
        >
          <img 
            src="/images/img_notifications.svg" 
            alt="Notifications" 
            className="w-6 h-6"
          />
        </button>

        {/* Profile Dropdown */}
        <div className="flex-1">
          <Dropdown
            placeholder="Evan Yates"
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
                src="/images/img_elm_header_photo.png" 
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