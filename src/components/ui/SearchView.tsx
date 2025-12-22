/**
 * @fileoverview Legacy SearchView Component
 * 
 * Custom search input component with icon support and extensive styling options.
 * Provides a search input with customizable left/right icons.
 * 
 * @module components/ui/SearchView
 */

import React, { useState } from 'react';
import { cva, VariantProps } from 'class-variance-authority';
import { twMerge } from 'tailwind-merge';

const searchViewClasses = cva(
  'relative flex items-center transition-all duration-200 focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border border-gray-200',
        filled: 'border-0',
        outline: 'border-2 border-gray-300',
      },
      size: {
        small: 'text-sm',
        medium: 'text-base',
        large: 'text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'medium',
    },
  }
);

interface SearchViewProps extends
  Omit<React.ComponentPropsWithoutRef<'input'>, 'size'>,
  VariantProps<typeof searchViewClasses> {
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
  effect_box_shadow?: string;

  // Optional parameters (no defaults)
  layout_gap?: string;
  layout_width?: string;
  padding?: string;
  position?: string;

  // Standard React props
  variant?: 'default' | 'filled' | 'outline';
  size?: 'small' | 'medium' | 'large';
  className?: string;
  onSearch?: (value: string) => void;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * SearchView Component
 * 
 * A search input component with icon support and customizable styling.
 * 
 * **Features:**
 * - Search icon (default on left)
 * - Custom left/right icons
 * - Real-time search callback
 * - Three variants and sizes
 * - Customizable styling
 * 
 * @component
 * @example
 * ```tsx
 * <SearchView
 *   placeholder="Search users..."
 *   onSearch={(value) => console.log(value)}
 * />
 * ```
 */
const SearchView = ({
  // Text styling parameters with defaults
  placeholder = "Search",
  text_font_size = "16",
  text_font_family = "Nunito Sans",
  text_font_weight = "400",
  text_line_height = "22px",
  text_text_align = "left",
  text_color = "#7d8592",
  fill_background_color = "#ffffff",
  border_border_radius = "14px",
  effect_box_shadow = "0px 6px 58px #c3cbd61a",

  // Optional layout parameters
  layout_gap,
  layout_width,
  padding,
  position,

  // Standard React props
  variant,
  size,
  className,
  onSearch,
  leftIcon,
  rightIcon,
  onChange,
  ...props
}: SearchViewProps) => {
  const [searchValue, setSearchValue] = useState('');

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
  const containerStyles: React.CSSProperties = {
    backgroundColor: fill_background_color,
    borderRadius: border_border_radius,
    boxShadow: effect_box_shadow,
  };

  const inputStyles: React.CSSProperties = {
    fontSize: `${text_font_size}px`,
    fontFamily: text_font_family,
    fontWeight: text_font_weight,
    lineHeight: text_line_height,
    textAlign: text_text_align as any,
    color: text_color,
    backgroundColor: 'transparent',
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchValue(value);

    if (onChange) {
      onChange(event);
    }

    if (onSearch) {
      onSearch(value);
    }
  };

  const defaultLeftIcon = (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 21L16.514 16.506L21 21ZM19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke={text_color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <div
      style={containerStyles}
      className={twMerge(
        searchViewClasses({ variant, size }),
        optionalClasses,
        className
      )}
    >
      {(leftIcon || !rightIcon) && (
        <div className="absolute left-3 flex items-center pointer-events-none">
          {leftIcon || defaultLeftIcon}
        </div>
      )}

      <input
        type="text"
        placeholder={placeholder}
        value={searchValue}
        onChange={handleInputChange}
        style={inputStyles}
        className={twMerge(
          'w-full bg-transparent border-0 outline-none',
          leftIcon || !rightIcon ? 'pl-12' : 'pl-4',
          rightIcon ? 'pr-12' : 'pr-4',
          'py-3'
        )}
        {...props}
      />

      {rightIcon && (
        <div className="absolute right-3 flex items-center pointer-events-none">
          {rightIcon}
        </div>
      )}
    </div>
  );
};

export default SearchView;