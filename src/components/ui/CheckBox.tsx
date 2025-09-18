import React, { useState } from 'react';
import { cva, VariantProps } from 'class-variance-authority';
import { twMerge } from 'tailwind-merge';

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

interface CheckBoxProps extends 
  React.InputHTMLAttributes<HTMLInputElement>,
  VariantProps<typeof checkboxClasses> {
  // Required parameters with defaults
  text?: string;
  text_font_size?: string;
  text_font_family?: string;
  text_font_weight?: string;
  text_line_height?: string;
  text_text_align?: 'left' | 'center' | 'right' | 'justify';
  text_color?: string;
  
  // Optional parameters (no defaults)
  layout_gap?: string;
  layout_width?: string;
  position?: string;
  
  // Standard React props
  variant?: 'default' | 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  className?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  id?: string;
}

const CheckBox = ({
  // Required parameters with defaults
  text = "Remember me",
  text_font_size = "16",
  text_font_family = "Nunito Sans",
  text_font_weight = "400",
  text_line_height = "22px",
  text_text_align = "left",
  text_color = "#7d8592",
  
  // Optional parameters (no defaults)
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

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    const newChecked = event.target.checked;
    setIsChecked(newChecked);
    
    if (onChange) {
      onChange(event);
    }
  };

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