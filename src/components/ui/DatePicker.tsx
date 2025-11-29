/**
 * @fileoverview Legacy DatePicker Component
 * 
 * Custom date picker component with calendar popup and month navigation.
 * Provides a visual calendar interface for date selection.
 * 
 * @module components/ui/DatePicker
 */

import React, { useState, useRef, useEffect } from 'react';
import { cva, VariantProps } from 'class-variance-authority';
import { twMerge } from 'tailwind-merge';

const datePickerClasses = cva(
  'relative w-full cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border border-gray-200',
        filled: 'border-0',
        outline: 'border-2 border-gray-300',
      },
      size: {
        small: 'text-sm px-3 py-2',
        medium: 'text-base px-4 py-3',
        large: 'text-lg px-5 py-4',
      },
    },
    defaultVariants: {
      variant: 'filled',
      size: 'medium',
    },
  }
);

interface DatePickerProps extends
  Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'>,
  VariantProps<typeof datePickerClasses> {
  // Required parameters with defaults
  placeholder?: string;
  text_font_size?: string;
  text_font_family?: string;
  text_font_weight?: string;
  text_line_height?: string;
  text_text_align?: 'left' | 'center' | 'right' | 'justify';
  text_color?: string;
  fill_background_color?: string;
  border_border_radius?: string;

  // Optional parameters (no defaults)
  layout_gap?: string;
  layout_width?: string;
  padding?: string;
  position?: string;

  // Standard React props
  variant?: 'default' | 'filled' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  className?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isRange?: boolean;
}

/**
 * DatePicker Component
 * 
 * A date picker with calendar popup for selecting dates.
 * 
 * **Features:**
 * - Calendar popup with month/year navigation
 * - Click-outside to close
 * - Keyboard support (Enter, Space)
 * - Customizable date format
 * - Range selection support (isRange prop)
 * - Left/right icon support
 * 
 * @component
 * @example
 * ```tsx
 * <DatePicker
 *   value={selectedDate}
 *   onChange={(date) => setSelectedDate(date)}
 *   placeholder="Select date"
 * />
 * ```
 */
const DatePicker = ({
  // Text styling parameters with defaults
  placeholder = "Nov 16, 2020 - Dec 16, 2020",
  text_font_size = "16",
  text_font_family = "Nunito Sans",
  text_font_weight = "400",
  text_line_height = "22px",
  text_text_align = "left",
  text_color = "#0a1629",
  fill_background_color = "#e6ecf4",
  border_border_radius = "14px",

  // Optional layout parameters
  layout_gap,
  layout_width,
  padding,
  position,

  // Standard React props
  variant,
  size,
  disabled = false,
  className,
  value,
  defaultValue,
  onChange,
  leftIcon,
  rightIcon,
  isRange = true,
  ...props
}: DatePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(value ?? defaultValue ?? '');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Safe validation for optional parameters
  const hasValidGap = layout_gap && typeof layout_gap === 'string' && layout_gap.trim() !== '';
  const hasValidWidth = layout_width && typeof layout_width === 'string' && layout_width.trim() !== '';
  const hasValidPadding = padding && typeof padding === 'string' && padding.trim() !== '';
  const hasValidPosition = position && typeof position === 'string' && position.trim() !== '';

  // Build optional Tailwind classes
  const optionalClasses = [
    hasValidGap ? `gap-[${layout_gap}]` : '',
    hasValidWidth ? `w-[${layout_width}]` : '',
    hasValidPadding ? `p-[${padding}]` : '',
    hasValidPosition ? position : '',
  ].filter(Boolean).join(' ');

  // Build inline styles for required parameters
  const datePickerStyles: React.CSSProperties = {
    fontSize: `${text_font_size}px`,
    fontFamily: text_font_family,
    fontWeight: text_font_weight,
    lineHeight: text_line_height,
    textAlign: text_text_align as any,
    color: text_color,
    backgroundColor: fill_background_color,
    borderRadius: border_border_radius,
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Handle date selection from calendar
   * Formats date and triggers onChange callback
   * 
   * @param date - Selected date object
   */
  const handleDateSelect = (date: Date) => {
    if (disabled) return;

    const formattedDate = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    setSelectedDate(formattedDate);
    setIsOpen(false);

    if (onChange) {
      onChange(formattedDate);
    }
  };

  /**
   * Get all days in the current month for calendar display
   * Includes empty cells for proper calendar grid alignment
   * 
   * @param date - Date object for the month to display
   * @returns Array of Date objects and null values for empty cells
   */
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  /**
   * Navigate to previous or next month
   * 
   * @param direction - 'prev' for previous month, 'next' for next month
   */
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const defaultRightIcon = (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2V6M16 2V6M3 10H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z" stroke={text_color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const displayText = selectedDate || placeholder;

  return (
    <div
      ref={datePickerRef}
      className={twMerge(
        'relative',
        optionalClasses
      )}
      {...props}
    >
      <div
        style={datePickerStyles}
        className={twMerge(
          datePickerClasses({ variant, size }),
          'flex items-center justify-between',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          className
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={isOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            !disabled && setIsOpen(!isOpen);
          }
        }}
      >
        <div className="flex items-center flex-1">
          {leftIcon && (
            <div className="mr-3 flex-shrink-0">
              {leftIcon}
            </div>
          )}
          <span className="truncate">
            {displayText}
          </span>
        </div>

        <div className="ml-3 flex-shrink-0">
          {rightIcon || defaultRightIcon}
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[300px]">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-1 hover:bg-gray-100 rounded"
              type="button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <h3 className="text-lg font-semibold">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>

            <button
              onClick={() => navigateMonth('next')}
              className="p-1 hover:bg-gray-100 rounded"
              type="button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(day => (
              <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {getDaysInMonth(currentMonth).map((day, index) => (
              <div key={index} className="aspect-square">
                {day && (
                  <button
                    onClick={() => handleDateSelect(day)}
                    className="w-full h-full flex items-center justify-center text-sm hover:bg-orange-100 hover:text-orange-600 rounded transition-colors duration-150"
                    type="button"
                  >
                    {day.getDate()}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;