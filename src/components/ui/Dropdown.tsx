/**
 * @fileoverview Legacy Dropdown Component
 * 
 * Custom dropdown/select component with extensive styling options.
 * Provides a clickable dropdown with customizable options and icons.
 * 
 * **Note:** A new Radix-based Select component is available at `@/components/radix-components/Select`
 * with improved accessibility and keyboard navigation.
 * 
 * @module components/ui/Dropdown
 */

import React, { useState, useRef, useEffect } from 'react';
import { cva, VariantProps } from 'class-variance-authority';
import { twMerge } from 'tailwind-merge';

const dropdownClasses = cva(
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
      variant: 'default',
      size: 'medium',
    },
  }
);

/**
 * Dropdown option data structure
 */
interface DropdownOption {
  /** Unique value for the option */
  value: string;
  /** Display label for the option */
  label: string;
  /** Whether the option is disabled */
  disabled?: boolean;
}

interface DropdownProps extends
  Omit<React.ComponentPropsWithoutRef<'div'>, 'onChange'>,
  VariantProps<typeof dropdownClasses> {
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
  disabled?: boolean;
  className?: string;
  options?: DropdownOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * Dropdown Component
 * 
 * A custom dropdown/select component with click-outside detection and keyboard support.
 * 
 * **Features:**
 * - Customizable options with labels and values
 * - Click-outside to close
 * - Keyboard navigation (Enter, Space)
 * - Left and right icon support
 * - Disabled state for individual options
 * - Three variants and sizes
 * 
 * @component
 * @example
 * ```tsx
 * <Dropdown
 *   options={[
 *     { value: '1', label: 'Option 1' },
 *     { value: '2', label: 'Option 2' }
 *   ]}
 *   value={selected}
 *   onChange={(val) => setSelected(val)}
 * />
 * ```
 */
const Dropdown = ({
  // Text styling parameters with defaults
  placeholder = "Evan Yates",
  text_font_size = "16",
  text_font_family = "Nunito Sans",
  text_font_weight = "700",
  text_line_height = "22px",
  text_text_align = "left",
  text_color = "#0a1629",
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
  disabled = false,
  className,
  options = [
    { value: 'evan', label: 'Evan Yates' },
    { value: 'john', label: 'John Doe' },
    { value: 'jane', label: 'Jane Smith' },
  ],
  value,
  defaultValue,
  onChange,
  leftIcon,
  rightIcon,
  ...props
}: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value ?? defaultValue ?? '');
  const dropdownRef = useRef<HTMLDivElement>(null);

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
  const dropdownStyles: React.CSSProperties = {
    fontSize: `${text_font_size}px`,
    fontFamily: text_font_family,
    fontWeight: text_font_weight,
    lineHeight: text_line_height,
    textAlign: text_text_align as any,
    color: text_color,
    backgroundColor: fill_background_color,
    borderRadius: border_border_radius,
    boxShadow: effect_box_shadow,
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    if (disabled) return;

    setSelectedValue(optionValue);
    setIsOpen(false);

    if (onChange) {
      onChange(optionValue);
    }
  };

  const selectedOption = options.find(option => option.value === selectedValue);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  const defaultRightIcon = (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
    >
      <path
        d="M6 9L12 15L18 9"
        stroke={text_color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div
      ref={dropdownRef}
      className={twMerge(
        'relative',
        optionalClasses
      )}
      {...props}
    >
      <div
        style={dropdownStyles}
        className={twMerge(
          dropdownClasses({ variant, size }),
          'flex items-center justify-between',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          className
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
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
        <div
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto"
          role="listbox"
        >
          {options.map((option) => (
            <div
              key={option.value}
              className={twMerge(
                'px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors duration-150',
                option.disabled ? 'opacity-50 cursor-not-allowed' : '',
                selectedValue === option.value ? 'bg-orange-50 text-orange-600' : ''
              )}
              onClick={() => !option.disabled && handleSelect(option.value)}
              role="option"
              aria-selected={selectedValue === option.value}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dropdown;