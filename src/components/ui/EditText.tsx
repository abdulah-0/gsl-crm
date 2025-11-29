/**
 * @fileoverview Legacy EditText Component
 * 
 * Custom text input component with label, error message, and icon support.
 * Provides a flexible input field with extensive styling options.
 * 
 * @module components/ui/EditText
 */

import React, { useState } from 'react';
import { cva, VariantProps } from 'class-variance-authority';
import { twMerge } from 'tailwind-merge';

const editTextClasses = cva(
  'w-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: 'border',
        filled: 'border-0',
        outline: 'border-2',
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

interface EditTextProps extends
  Omit<React.ComponentProps<'input'>, 'size'>,
  VariantProps<typeof editTextClasses> {
  // Required parameters with defaults
  placeholder?: string;
  text_font_size?: string;
  text_font_family?: string;
  text_font_weight?: string;
  text_line_height?: string;
  text_text_align?: 'left' | 'center' | 'right' | 'justify';
  text_color?: string;
  fill_background_color?: string;
  border_border?: string;
  border_border_radius?: string;
  effect_box_shadow?: string;

  // Optional parameters (no defaults)
  layout_width?: string;
  padding?: string;
  margin?: string;
  position?: string;
  layout_gap?: string;

  // Standard React props
  variant?: 'default' | 'filled' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  className?: string;
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * EditText Component
 * 
 * A customizable text input component with label, error message, and icon support.
 * 
 * **Features:**
 * - Optional label above input
 * - Error message display below input
 * - Left and right icon support
 * - Focus state tracking
 * - Three variants and sizes
 * - Customizable border and styling
 * 
 * @component
 * @example
 * ```tsx
 * <EditText
 *   label="Email"
 *   placeholder="Enter your email"
 *   value={email}
 *   onChange={(e) => setEmail(e.target.value)}
 *   error={emailError}
 * />
 * ```
 */
const EditText = ({
  // Text styling parameters with defaults
  placeholder = "youremail@gmail.com",
  text_font_size = "14",
  text_font_family = "Nunito Sans",
  text_font_weight = "400",
  text_line_height = "20px",
  text_text_align = "left",
  text_color = "#7d8592",
  fill_background_color = "#ffffff",
  border_border = "1 solid #d8e0ef",
  border_border_radius = "24px",
  effect_box_shadow = "0px 1px 2px #b7c8e038",

  // Optional layout parameters
  layout_width,
  padding,
  margin,
  position,
  layout_gap,

  // Standard React props
  variant,
  size,
  disabled = false,
  className,
  label,
  error,
  leftIcon,
  rightIcon,
  ...props
}: EditTextProps) => {
  const [isFocused, setIsFocused] = useState(false);

  // Safe validation for optional parameters
  const hasValidWidth = layout_width && typeof layout_width === 'string' && layout_width.trim() !== '';
  const hasValidPadding = padding && typeof padding === 'string' && padding.trim() !== '';
  const hasValidMargin = margin && typeof margin === 'string' && margin.trim() !== '';
  const hasValidPosition = position && typeof position === 'string' && position.trim() !== '';
  const hasValidGap = layout_gap && typeof layout_gap === 'string' && layout_gap.trim() !== '';

  // Build optional Tailwind classes
  const optionalClasses = [
    hasValidWidth ? `w-[${layout_width}]` : '',
    hasValidPadding ? `p-[${padding}]` : '',
    hasValidMargin ? `m-[${margin}]` : '',
    hasValidPosition ? position : '',
    hasValidGap ? `gap-[${layout_gap}]` : '',
  ].filter(Boolean).join(' ');

  /**
   * Parse border string into CSS properties
   * Format: "width style color" (e.g., "1 solid #d8e0ef")
   * 
   * @param borderStr - Border string to parse
   * @returns Object with width, style, and color properties
   */
  const parseBorder = (borderStr: string) => {
    const parts = borderStr.split(' ');
    return {
      width: parts[0] || '1px',
      style: parts[1] || 'solid',
      color: parts[2] || '#d8e0ef'
    };
  };

  const borderInfo = parseBorder(border_border);

  // Build inline styles for required parameters
  const inputStyles: React.CSSProperties = {
    fontSize: `${text_font_size}px`,
    fontFamily: text_font_family,
    fontWeight: text_font_weight,
    lineHeight: text_line_height,
    textAlign: text_text_align as any,
    color: text_color,
    backgroundColor: fill_background_color,
    border: `${borderInfo.width} ${borderInfo.style} ${borderInfo.color}`,
    borderRadius: border_border_radius,
    boxShadow: effect_box_shadow,
  };

  const containerClasses = twMerge(
    'relative',
    optionalClasses
  );

  const inputClasses = twMerge(
    editTextClasses({ variant, size }),
    leftIcon ? 'pl-12' : '',
    rightIcon ? 'pr-12' : '',
    error ? 'border-red-500 focus:ring-red-500' : '',
    className
  );

  return (
    <div className={containerClasses}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            {leftIcon}
          </div>
        )}

        <input
          placeholder={placeholder}
          disabled={disabled}
          style={inputStyles}
          className={inputClasses}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {rightIcon && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            {rightIcon}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
};

export default EditText;