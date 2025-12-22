/**
 * @fileoverview Legacy Button Component
 * 
 * This is the existing Button component used throughout the application.
 * It provides a flexible button implementation with extensive customization options
 * through both props and CSS classes.
 * 
 * **Note:** A new Radix-based Button component is available at `@/components/radix-components/Button`
 * with improved accessibility. This component remains for backward compatibility.
 * 
 * @module components/ui/Button
 */

import React from 'react';
import { cva, VariantProps } from 'class-variance-authority';
import { twMerge } from 'tailwind-merge';

/**
 * Button variant styles using class-variance-authority.
 * Defines CSS classes for different button variants and sizes.
 */
const buttonClasses = cva(
  // Base styles applied to all buttons
  'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'hover:opacity-90 focus:ring-orange-500',
        secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-500',
        outline: 'border-2 bg-transparent hover:bg-opacity-10 focus:ring-orange-500',
      },
      size: {
        small: 'text-xs px-3 py-1.5',
        medium: 'text-base px-4 py-2',
        large: 'text-lg px-6 py-3',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'medium',
    },
  }
);

/**
 * Props for the Button component.
 * Extends standard HTML button attributes with custom styling options.
 */
interface ButtonProps extends
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonClasses> {

  // Text styling parameters (with defaults)
  /** Button text content (default: "4h") */
  text?: string;
  /** Font size in pixels (default: "12") */
  text_font_size?: string;
  /** Font family (default: "Nunito Sans") */
  text_font_family?: string;
  /** Font weight (default: "700") */
  text_font_weight?: string;
  /** Line height (default: "17px") */
  text_line_height?: string;
  /** Text alignment (default: "left") */
  text_text_align?: 'left' | 'center' | 'right' | 'justify';
  /** Text color (default: "#7d8592") */
  text_color?: string;

  // Background and border styling (with defaults)
  /** Background color (default: "#f4f9fd") */
  fill_background_color?: string;
  /** Border radius (default: "8px") */
  border_border_radius?: string;

  // Optional layout parameters (no defaults)
  /** Box shadow effect */
  effect_box_shadow?: string;
  /** Width of the button */
  layout_width?: string;
  /** Padding */
  padding?: string;
  /** CSS position property */
  position?: string;
  /** Gap between flex items */
  layout_gap?: string;
  /** Margin */
  margin?: string;

  // Standard React button props
  /** Button visual variant */
  variant?: 'primary' | 'secondary' | 'outline';
  /** Button size */
  size?: 'small' | 'medium' | 'large';
  /** Whether button is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Button content (overrides text prop) */
  children?: React.ReactNode;
  /** Click event handler */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Button type attribute */
  type?: 'button' | 'submit' | 'reset';
}

/**
 * Button Component
 * 
 * A flexible button component with extensive customization options.
 * Supports multiple variants, sizes, and custom styling through props.
 * 
 * **Features:**
 * - Three variants: primary, secondary, outline
 * - Three sizes: small, medium, large
 * - Customizable text styling (font, size, weight, color)
 * - Customizable background and border
 * - Optional layout properties (width, padding, margin, shadow)
 * - Disabled state support
 * - Click handler with disabled state protection
 * 
 * **Note:** For new features, consider using the Radix-based Button component
 * at `@/components/radix-components/Button` which provides better accessibility.
 * 
 * @component
 * @example
 * ```tsx
 * // Basic usage
 * <Button onClick={() => console.log('clicked')}>Click Me</Button>
 * 
 * // With variant and size
 * <Button variant="secondary" size="large">Large Button</Button>
 * 
 * // Custom styling
 * <Button 
 *   text_color="#ffffff"
 *   fill_background_color="#ff5722"
 *   border_border_radius="4px"
 * >
 *   Custom Styled
 * </Button>
 * 
 * // Disabled state
 * <Button disabled>Disabled Button</Button>
 * ```
 */
const Button = ({
  // Text styling parameters with defaults
  text = "4h",
  text_font_size = "12",
  text_font_family = "Nunito Sans",
  text_font_weight = "700",
  text_line_height = "17px",
  text_text_align = "left",
  text_color = "#7d8592",
  fill_background_color = "#f4f9fd",
  border_border_radius = "8px",

  // Optional layout parameters
  effect_box_shadow,
  layout_width,
  padding,
  position,
  layout_gap,
  margin,

  // Standard React props
  variant,
  size,
  disabled = false,
  className,
  children,
  onClick,
  type = "button",
  ...props
}: ButtonProps) => {
  /**
   * Validate optional parameters to ensure they are non-empty strings
   * This prevents invalid CSS classes from being generated
   */
  const hasValidBoxShadow = effect_box_shadow && typeof effect_box_shadow === 'string' && effect_box_shadow.trim() !== '';
  const hasValidWidth = layout_width && typeof layout_width === 'string' && layout_width.trim() !== '';
  const hasValidPadding = padding && typeof padding === 'string' && padding.trim() !== '';
  const hasValidPosition = position && typeof position === 'string' && position.trim() !== '';
  const hasValidGap = layout_gap && typeof layout_gap === 'string' && layout_gap.trim() !== '';
  const hasValidMargin = margin && typeof margin === 'string' && margin.trim() !== '';

  /**
   * Build optional Tailwind CSS classes from validated parameters
   * Uses arbitrary value syntax for custom values (e.g., w-[200px])
   */
  const optionalClasses = [
    hasValidBoxShadow ? `shadow-[${effect_box_shadow}]` : '',
    hasValidWidth ? `w-[${layout_width}]` : '',
    hasValidPadding ? `p-[${padding}]` : '',
    hasValidPosition ? position : '',
    hasValidGap ? `gap-[${layout_gap}]` : '',
    hasValidMargin ? `m-[${margin}]` : '',
  ].filter(Boolean).join(' ');

  /**
   * Build inline styles for text and background styling
   * These take precedence over CSS classes
   */
  const buttonStyles: React.CSSProperties = {
    fontSize: `${text_font_size}px`,
    fontFamily: text_font_family,
    fontWeight: text_font_weight,
    lineHeight: text_line_height,
    textAlign: text_text_align as any,
    color: text_color,
    backgroundColor: fill_background_color,
    borderRadius: border_border_radius,
  };

  /**
   * Click event handler with disabled state protection
   * Prevents onClick from firing when button is disabled
   * 
   * @param event - Mouse click event
   */
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (typeof onClick === 'function') {
      onClick(event);
    }
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={handleClick}
      style={buttonStyles}
      className={twMerge(
        buttonClasses({ variant, size }),
        optionalClasses,
        className
      )}
      aria-disabled={disabled}
      {...props}
    >
      {children || text}
    </button>
  );
};

export default Button;