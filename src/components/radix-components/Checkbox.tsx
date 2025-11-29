/**
 * @fileoverview Radix-based Checkbox component with full accessibility support.
 * 
 * This component provides a fully accessible checkbox implementation using Radix UI.
 * It supports checked, unchecked, and indeterminate states with proper ARIA attributes.
 * 
 * @module components/radix-components/Checkbox
 */

import React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { cn } from '../../lib/utils';

/**
 * Checkbox Component
 * 
 * A fully accessible checkbox with support for checked, unchecked, and indeterminate states.
 * Built on Radix UI primitives for maximum accessibility and keyboard navigation.
 * 
 * @component
 * @example
 * ```tsx
 * // Basic checkbox
 * <Checkbox id="terms" />
 * 
 * // Checkbox with label
 * <div className="flex items-center space-x-2">
 *   <Checkbox id="terms" />
 *   <label htmlFor="terms">Accept terms and conditions</label>
 * </div>
 * 
 * // Controlled checkbox
 * <Checkbox
 *   checked={isChecked}
 *   onCheckedChange={setIsChecked}
 * />
 * 
 * // Indeterminate state
 * <Checkbox checked="indeterminate" />
 * ```
 */
const Checkbox = React.forwardRef<
    React.ElementRef<typeof CheckboxPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
    <CheckboxPrimitive.Root
        ref={ref}
        className={cn(
            'peer h-4 w-4 shrink-0 rounded-sm border border-gray-300 ring-offset-white',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 data-[state=checked]:text-white',
            'data-[state=indeterminate]:bg-orange-500 data-[state=indeterminate]:border-orange-500 data-[state=indeterminate]:text-white',
            className
        )}
        {...props}
    >
        <CheckboxPrimitive.Indicator
            className={cn('flex items-center justify-center text-current')}
        >
            {/* Check icon for checked state */}
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
            >
                <polyline points="20 6 9 17 4 12" />
            </svg>
        </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
