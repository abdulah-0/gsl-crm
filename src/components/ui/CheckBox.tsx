/**
 * @fileoverview Legacy CheckBox Component
 * 
 * This is the existing CheckBox component used throughout the application.
 * It provides a customizable checkbox with label support and various styling options.
 * 
 * **Note:** A new Radix-based Checkbox component is available at `@/components/radix-components/Checkbox`
 * with improved accessibility. This component remains for backward compatibility.
 * 
 * @module components/ui/CheckBox
 */

import React, { useState } from 'react';
import { cva, VariantProps } from 'class-variance-authority';
import { twMerge } from 'tailwind-merge';

/**
 * Checkbox container variant styles
 */
const checkboxClasses = cva(
  'flex items-center cursor-pointer transition-all duration-200',
  {
    variants: {
      variant: {
        default: '',
        primary: 'text-orange-600',
        secondary: 'text-gray-600',
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

/**
 * Checkbox input element variant styles
 */
const checkboxInputClasses = cva(
  'rounded border-2 transition-all duration-200 focus:ring-2 focus:ring-offset-2 focus:ring-orange-500',
  {
    variants: {
      size: {
        small: 'w-4 h-4',
        medium: 'w-5 h-5',
        large: 'w-6 h-6',
      },
    },
    defaultVariants: {
      size: 'medium',
    },
  }
);

/**
 * Props for the CheckBox component
 */
interface CheckBoxProps extends
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
  VariantProps<typeof checkboxClasses> {
  /** Label text (default: "Remember me") */
  text?: string;
  /** Font size in pixels */
  text_font_size?: string;
  /** Font family */
  text_font_family?: string;
  /** Font weight */
  text_font_weight?: string;
  /** Line height */
  text_line_height?: string;
  /** Text alignment */
  text_text_align?: 'left' | 'center' | 'right' | 'justify';
  /** Text color */
  text_color?: string;

  /** Gap between checkbox and label */
  layout_gap?: string;
  /** Width of the container */
  layout_width?: string;
  /** CSS position property */
  position?: string;

  /** Visual variant */
  variant?: 'default' | 'primary' | 'secondary';
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Whether checkbox is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Controlled checked state */
  checked?: boolean;
  /** Default checked state for uncontrolled */
  defaultChecked?: boolean;
  /** Change event handler */
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** HTML id attribute */
  id?: string;
}

/**
 * CheckBox Component
 * 
 * A customizable checkbox component with label support.
 * Can be used in controlled or uncontrolled mode.
 * 
 * **Features:**
 * - Controlled and uncontrolled modes
 * - Customizable label text and styling
 * - Three variants: default, primary, secondary
 * - Three sizes: small, medium, large
 * - Disabled state support
 * - Auto-generated unique IDs
 * 
 * **Note:** For new features, consider using the Radix-based Checkbox component
 * at `@/components/radix-components/Checkbox` which provides better accessibility.
 * 
 * @component
 * @example
 * ```tsx
 * // Uncontrolled checkbox
 * <CheckBox text="Accept terms" defaultChecked={false} />
 * 
 * // Controlled checkbox
 * <CheckBox 
 *   text="Subscribe to newsletter"
 *   checked={isSubscribed}
 *   onChange={(e) => setIsSubscribed(e.target.checked)}
 * />
 * 
 * // Custom styling
 * <CheckBox
 *   text="Remember me"
 *   variant="primary"
 *   size="large"
 *   text_color="#000000"
 * />
 * ```
 */
const CheckBox = ({
  // Text styling parameters with defaults
  text = "Remember me",
  text_font_size = "16",
  text_font_family = "Nunito Sans",
  text_font_weight = "400",
  text_line_height = "22px",
  text_text_align = "left",
  text_color = "#7d8592",

  // Optional layout parameters
  layout_gap,
  layout_width,
  position,

  // Standard React props
  variant,
  size,
  disabled = false,
  className,
  checked,
  defaultChecked = false,
  onChange,
  id,
  ...props
}: CheckBoxProps) => {
  // Internal state for uncontrolled mode
  const [isChecked, setIsChecked] = useState(checked ?? defaultChecked);

  // Safe validation for optional parameters
  const hasValidGap = layout_gap && typeof layout_gap === 'string' && layout_gap.trim() !== '';
  const hasValidWidth = layout_width && typeof layout_width === 'string' && layout_width.trim() !== '';
  const hasValidPosition = position && typeof position === 'string' && position.trim() !== '';

  // Build optional Tailwind classes
  const optionalClasses = [
    hasValidGap ? `gap-[${layout_gap}]` : 'gap-2',
    hasValidWidth ? `w-[${layout_width}]` : '',
    hasValidPosition ? position : '',
  ].filter(Boolean).join(' ');

  // Build inline styles for text
  const textStyles: React.CSSProperties = {
    fontSize: `${text_font_size}px`,
    fontFamily: text_font_family,
    fontWeight: text_font_weight,
    lineHeight: text_line_height,
    textAlign: text_text_align as any,
    color: text_color,
  };

  /**
   * Handle checkbox change event
   * Updates internal state and calls onChange callback
   * 
   * @param event - Change event from checkbox input
   */
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;

    const newChecked = event.target.checked;
    setIsChecked(newChecked);

    if (onChange) {
      onChange(event);
    }
  };

  // Generate unique ID if not provided
  const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <label
      htmlFor={checkboxId}
      className={twMerge(
        checkboxClasses({ variant, size }),
        optionalClasses,
        disabled ? 'opacity-50 cursor-not-allowed' : '',
        className
      )}
    >
      <input
        type="checkbox"
        id={checkboxId}
        checked={checked !== undefined ? checked : isChecked}
        onChange={handleChange}
        disabled={disabled}
        className={twMerge(
          checkboxInputClasses({ size }),
          'mr-2 text-orange-600 border-gray-300 focus:border-orange-500',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        )}
        {...props}
      />

      {text && (
        <span
          style={textStyles}
          className={twMerge(
            'select-none',
            disabled ? 'cursor-not-allowed' : 'cursor-pointer'
          )}
        >
          {text}
        </span>
      )}
    </label>
  );
};

export default CheckBox;