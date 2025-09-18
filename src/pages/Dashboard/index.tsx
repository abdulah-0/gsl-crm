import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import DatePicker from '../../components/ui/DatePicker';
import Button from '../../components/ui/Button';

interface Task {
  id: string;
  title: string;
  time: string;
  duration: string;
  priority: 'high' | 'medium' | 'low';
  color: string;
}

interface CaseData {
  id: string;
  caseNumber: string;
  title: string;
  createdDate: string;
  priority: 'high' | 'medium' | 'low';
  allTasks: number;
  activeTasks: number;
  assignees: string[];
  icon: string;
}

interface ActivityItem {
  id: string;
  user: {
    name: string;
    role: string;
    avatar: string;
  };
  action: string;
  time: string;
  type: 'upload' | 'attach';
}

const Dashboard = () => {
  const [selectedDateRange, setSelectedDateRange] = useState('Nov 16, 2020 - Dec 16, 2020');

  const tasks: Task[] = [
    {
      id: '1',
      title: 'Presentation of the new department',
      time: 'Today | 5:00 PM',
      duration: '4h',
      priority: 'medium',
      color: '#ffa332'
    },
    {
      id: '2',
      title: 'Anna\'s Birthday',
      time: 'Today | 6:00 PM',
      duration: '4h',
      priority: 'low',
      color: '#de92eb'
    },
    {
      id: '3',
      title: 'Ray\'s Birthday',
      time: 'Tomorrow | 2:00 PM',
      duration: '4h',
      priority: 'low',
      color: '#de92eb'
    }
  ];

  const cases: CaseData[] = [
    {
      id: '1',
      caseNumber: 'PN0001265',
      title: 'University Of Dundee',
      createdDate: 'Created Sep 12, 2020',
      priority: 'medium',
      allTasks: 34,
      activeTasks: 13,
      assignees: ['/images/img_elm_general_photo.png', '/images/img_elm_general_photo_24x24.png', '/images/img_elm_general_photo_1.png'],
      icon: '/images/img_image.svg'
    },
    {
      id: '2',
      caseNumber: 'PN0001221',
      title: 'University Of Dundee',
      createdDate: 'Created Sep 10, 2020',
      priority: 'medium',
      allTasks: 50,
      activeTasks: 24,
      assignees: ['/images/img_elm_general_photo.png', '/images/img_elm_general_photo_2.png', '/images/img_elm_general_photo_3.png'],
      icon: '/images/img_image_white_a700_01.svg'
    },
    {
      id: '3',
      caseNumber: 'PN0001290',
      title: 'University Of Dundee',
      createdDate: 'Created May 28, 2020',
      priority: 'low',
      allTasks: 23,
      activeTasks: 20,
      assignees: ['/images/img_elm_general_photo.png', '/images/img_elm_general_photo_24x24.png', '/images/img_elm_general_photo_4.png'],
      icon: '/images/img_image_white_a700_01_48x48.svg'
    }
  ];

  const activityItems: ActivityItem[] = [
    {
      id: '1',
      user: {
        name: 'Oscar Holloway',
        role: 'UI/UX Designer',
        avatar: '/images/img_elm_general_photo_50x50.png'
      },
      action: 'Updated the status of Mind Map task to In Progress',
      time: '2 hours ago',
      type: 'upload'
    },
    {
      id: '2',
      user: {
        name: 'Oscar Holloway',
        role: 'UI/UX Designer',
        avatar: '/images/img_elm_general_photo_50x50.png'
      },
      action: 'Attached files to the task',
      time: '3 hours ago',
      type: 'attach'
    },
    {
      id: '3',
      user: {
        name: 'Emily Tyler',
        role: 'Copywriter',
        avatar: '/images/img_elm_general_photo_5.png'
      },
      action: 'Updated the status of Mind Map task to In Progress',
      time: '5 hours ago',
      type: 'upload'
    }
  ];

  const handleSearch = (value: string) => {
    // Handle search functionality
  };

  const handleProfileSelect = (value: string) => {
    // Handle profile selection
  };

  const handleNotificationClick = () => {
    // Handle notification click
  };

  const handleDateChange = (value: string) => {
    setSelectedDateRange(value);
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return '/images/img_icn_general_priority_high.svg';
      case 'medium':
        return '/images/img_icn_general_priority_medium.svg';
      case 'low':
        return '/images/img_icn_general_priority_low.svg';
      default:
        return '/images/img_icn_general_priority_medium.svg';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#ff4757';
      case 'medium':
        return '#ffbd21';
      case 'low':
        return '#0ac846';
      default:
        return '#ffbd21';
    }
  };

  return (
    <>
      <Helmet>
        <title>GSL Pakistan CRM Dashboard - Manage Cases, Tasks & Team Activities</title>
        <meta name="description" content="Comprehensive CRM dashboard for GSL Pakistan featuring University of Dundee case management, task tracking, team activities, and business analytics. Monitor ongoing cases, upcoming events, and team productivity in real-time." />
        <meta property="og:title" content="GSL Pakistan CRM Dashboard - Manage Cases, Tasks & Team Activities" />
        <meta property="og:description" content="Comprehensive CRM dashboard for GSL Pakistan featuring University of Dundee case management, task tracking, team activities, and business analytics. Monitor ongoing cases, upcoming events, and team productivity in real-time." />
      </Helmet>

      <main className="w-full min-h-screen bg-background-main flex">
        {/* Sidebar */}
        <div className="w-[14%] min-w-[200px] hidden lg:block">
          <Sidebar />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <Header
            onSearch={handleSearch}
            onProfileSelect={handleProfileSelect}
            onNotificationClick={handleNotificationClick}
          />

          {/* Dashboard Content */}
          <div className="flex-1 mt-8 lg:mt-12">
            {/* Welcome Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 lg:mb-12">
              <div className="mb-4 lg:mb-0">
                <p className="text-base font-normal leading-base text-text-secondary mb-1" style={{ fontFamily: 'Nunito Sans' }}>
                  Welcome back, Evan!
                </p>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-4xl text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>
                  Dashboard
                </h1>
              </div>

              <div className="flex flex-col items-end gap-7">
                {/* Date Picker */}
                <div className="w-full sm:w-auto">
                  <DatePicker
                    placeholder={selectedDateRange}
                    text_font_size="16"
                    text_font_family="Nunito Sans"
                    text_font_weight="400"
                    text_line_height="22px"
                    text_color="#0a1629"
                    fill_background_color="#e6ecf4"
                    border_border_radius="14px"
                    layout_gap="14px"
                    padding="10px 14px 10px 52px"
                    onChange={handleDateChange}
                    leftIcon={
                      <img 
                        src="/images/img_icn_general_calendar.svg" 
                        alt="Calendar" 
                        className="w-6 h-6"
                      />
                    }
                  />
                </div>

                {/* Tasks Section */}
                <div className="w-full sm:w-auto bg-background-card rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-5 lg:p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold leading-2xl text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>
                      Tasks
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-text-accent cursor-pointer hover:opacity-80" style={{ fontFamily: 'Nunito Sans' }}>
                        View all
                      </span>
                      <img src="/images/img_arrow_right.svg" alt="Arrow" className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="space-y-6">
                    {tasks.map((task) => (
                      <div key={task.id} className="flex items-start gap-4">
                        <div 
                          className="w-1 h-26 rounded-xs flex-shrink-0"
                          style={{ backgroundColor: task.color }}
                        />
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="text-base font-bold leading-lg text-text-primary flex-1 pr-4" style={{ fontFamily: 'Nunito Sans' }}>
                              {task.title}
                            </h3>
                            <img 
                              src={getPriorityIcon(task.priority)} 
                              alt="Priority" 
                              className="w-6 h-6 flex-shrink-0"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-normal leading-sm text-text-muted" style={{ fontFamily: 'Nunito Sans' }}>
                              {task.time}
                            </span>
                            <Button
                              text={task.duration}
                              text_font_size="12"
                              text_font_family="Nunito Sans"
                              text_font_weight="700"
                              text_line_height="17px"
                              text_color="#7d8592"
                              fill_background_color="#f4f9fd"
                              border_border_radius="8px"
                              padding="6px 32px 6px 32px"
                              className="flex items-center gap-2"
                            >
                              <img src="/images/img_icn_general_time_filled.svg" alt="Time" className="w-6 h-6" />
                              {task.duration}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* On Going Cases Section */}
              <div className="xl:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold leading-2xl text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>
                    On Going Cases
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-text-accent cursor-pointer hover:opacity-80" style={{ fontFamily: 'Nunito Sans' }}>
                      View all
                    </span>
                    <img src="/images/img_arrow_right.svg" alt="Arrow" className="w-6 h-6" />
                  </div>
                </div>

                <div className="space-y-5">
                  {cases.map((caseItem) => (
                    <div key={caseItem.id} className="bg-background-card rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                        {/* Case Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-[18px] mb-5">
                            <img 
                              src={caseItem.icon} 
                              alt="Case" 
                              className="w-12 h-12 flex-shrink-0"
                            />
                            <div>
                              <p className="text-sm font-normal leading-sm text-text-muted mb-1" style={{ fontFamily: 'Nunito Sans' }}>
                                {caseItem.caseNumber}
                              </p>
                              <h3 className="text-lg font-bold leading-xl text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>
                                {caseItem.title}
                              </h3>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <img src="/images/img_icn_sidebar_calendar_inactive.svg" alt="Calendar" className="w-6 h-6" />
                              <span className="text-sm font-semibold leading-sm text-text-secondary" style={{ fontFamily: 'Nunito Sans' }}>
                                {caseItem.createdDate}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 px-9 py-0">
                              <img 
                                src={getPriorityIcon(caseItem.priority)} 
                                alt="Priority" 
                                className="w-6 h-6"
                              />
                              <span 
                                className="text-sm font-bold leading-sm capitalize"
                                style={{ 
                                  fontFamily: 'Nunito Sans',
                                  color: getPriorityColor(caseItem.priority)
                                }}
                              >
                                {caseItem.priority}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="w-full lg:w-px h-px lg:h-[148px] bg-border-light" />

                        {/* Case Data */}
                        <div className="lg:w-[44%]">
                          <h4 className="text-base font-bold leading-base text-text-primary mb-3" style={{ fontFamily: 'Nunito Sans' }}>
                            Case Data
                          </h4>
                          
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-normal leading-sm text-text-muted" style={{ fontFamily: 'Nunito Sans' }}>
                                All tasks
                              </span>
                              <span className="text-sm font-normal leading-sm text-text-muted" style={{ fontFamily: 'Nunito Sans' }}>
                                Active tasks
                              </span>
                              <span className="text-sm font-normal leading-sm text-text-muted" style={{ fontFamily: 'Nunito Sans' }}>
                                Assignees
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-base font-bold leading-base text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>
                                {caseItem.allTasks}
                              </span>
                              <span className="text-base font-bold leading-base text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>
                                {caseItem.activeTasks}
                              </span>
                              <div className="flex items-center -space-x-1">
                                {caseItem.assignees.slice(0, 3).map((avatar, index) => (
                                  <img 
                                    key={index}
                                    src={avatar} 
                                    alt={`Assignee ${index + 1}`} 
                                    className="w-6 h-6 rounded-full border-2 border-white"
                                  />
                                ))}
                                {caseItem.assignees.length > 3 && (
                                  <div className="w-6 h-6 rounded-full bg-primary-background border-2 border-white flex items-center justify-center">
                                    <span className="text-xs font-semibold text-white" style={{ fontFamily: 'Nunito Sans' }}>
                                      +{caseItem.assignees.length - 3}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity Stream Section */}
              <div className="xl:col-span-1">
                <div className="bg-background-card rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-5">
                  <h2 className="text-xl font-bold leading-2xl text-text-primary mb-5" style={{ fontFamily: 'Nunito Sans' }}>
                    Activity Stream
                  </h2>

                  <div className="space-y-[18px]">
                    {activityItems.map((item, index) => (
                      <div key={item.id}>
                        {/* User Info */}
                        <div className="flex items-center gap-[18px] mb-4">
                          <img 
                            src={item.user.avatar} 
                            alt={item.user.name} 
                            className="w-[50px] h-[50px] rounded-xl object-cover"
                          />
                          <div>
                            <h4 className="text-base font-bold leading-base text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>
                              {item.user.name}
                            </h4>
                            <p className="text-sm font-normal leading-sm text-text-muted" style={{ fontFamily: 'Nunito Sans' }}>
                              {item.user.role}
                            </p>
                          </div>
                        </div>

                        {/* Activity */}
                        <div className="bg-secondary-light rounded-lg p-[14px] flex items-start gap-4">
                          <img 
                            src={item.type === 'upload' ? '/images/img_icn_general_upload.svg' : '/images/img_icn_general_attach.svg'} 
                            alt={item.type} 
                            className="w-6 h-6 flex-shrink-0 mt-1"
                          />
                          <p className="text-base font-normal leading-lg text-text-primary flex-1" style={{ fontFamily: 'Nunito Sans' }}>
                            {item.action}
                          </p>
                        </div>

                        {index < activityItems.length - 1 && (
                          <div className="h-4" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* View More */}
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <span className="text-base font-semibold text-text-accent cursor-pointer hover:opacity-80" style={{ fontFamily: 'Nunito Sans' }}>
                      View more
                    </span>
                    <img src="/images/img_arrow_down.svg" alt="Arrow Down" className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default Dashboard;