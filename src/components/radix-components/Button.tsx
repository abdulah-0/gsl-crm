/**
 * @fileoverview Radix-based Button component with full accessibility support.
 * 
 * This component provides a modern, accessible button implementation using Radix UI primitives.
 * It supports multiple variants, sizes, loading states, and icons while maintaining ARIA compliance.
 * 
 * @module components/radix-components/Button
 */

import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/**
 * Button variant styles using class-variance-authority.
 * Defines all possible visual variants and sizes for the button component.
 */
const buttonVariants = cva(
    // Base styles applied to all buttons
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                primary: 'bg-orange-500 text-white hover:bg-orange-600 focus-visible:ring-orange-500',
                secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus-visible:ring-gray-500',
                outline: 'border-2 border-gray-300 bg-transparent hover:bg-gray-100 focus-visible:ring-gray-500',
                ghost: 'hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-gray-500',
                destructive: 'bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500',
                link: 'text-orange-500 underline-offset-4 hover:underline focus-visible:ring-orange-500',
            },
            size: {
                sm: 'h-9 px-3 text-sm',
                md: 'h-10 px-4 text-base',
                lg: 'h-11 px-6 text-lg',
                icon: 'h-10 w-10',
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'md',
        },
    }
);

/**
 * Props for the Button component.
 * Extends standard HTML button attributes with additional custom props.
 */
export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    /**
     * If true, renders the component as a Slot to merge props with child element.
     * Useful for creating custom button-like components.
     */
    asChild?: boolean;

    /**
     * If true, shows a loading spinner and disables the button.
     */
    loading?: boolean;

    /**
     * Icon to display before the button text.
     */
    leftIcon?: React.ReactNode;

    /**
     * Icon to display after the button text.
     */
    rightIcon?: React.ReactNode;
}

/**
 * Radix-based Button Component
 * 
 * A fully accessible button component with support for multiple variants, sizes,
 * loading states, and icons. Built on Radix UI primitives for maximum accessibility.
 * 
 * @component
 * @example
 * ```tsx
 * // Primary button
 * <Button>Click me</Button>
 * 
 * // Secondary button with icon
 * <Button variant="secondary" leftIcon={<Icon />}>
 *   Save
 * </Button>
 * 
 * // Loading state
 * <Button loading>Processing...</Button>
 * 
 * // As child (merges props with child)
 * <Button asChild>
 *   <a href="/link">Link Button</a>
 * </Button>
 * ```
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant,
            size,
            asChild = false,
            loading = false,
            leftIcon,
            rightIcon,
            children,
            disabled,
            ...props
        },
        ref
    ) => {
        // Use Slot component if asChild is true, otherwise use button element
        const Comp = asChild ? Slot : 'button';

        // Disable button when loading
        const isDisabled = disabled || loading;

        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                disabled={isDisabled}
                aria-disabled={isDisabled}
                aria-busy={loading}
                {...props}
            >
                {/* Loading spinner */}
                {loading && (
                    <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                )}

                {/* Left icon */}
                {!loading && leftIcon && <span aria-hidden="true">{leftIcon}</span>}

                {/* Button content */}
                {children}

                {/* Right icon */}
                {!loading && rightIcon && <span aria-hidden="true">{rightIcon}</span>}
            </Comp>
        );
    }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
