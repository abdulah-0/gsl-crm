/**
 * @fileoverview Radix-based Label component for form inputs.
 * 
 * This component provides an accessible label implementation that properly
 * associates with form controls for improved accessibility.
 * 
 * @module components/radix-components/Label
 */

import React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '../../lib/utils';

/**
 * Label Component
 * 
 * An accessible label component that properly associates with form controls.
 * Clicking the label will focus the associated input.
 * 
 * @component
 * @example
 * ```tsx
 * <div className="space-y-2">
 *   <Label htmlFor="email">Email</Label>
 *   <input id="email" type="email" />
 * </div>
 * ```
 */
const Label = React.forwardRef<
    React.ElementRef<typeof LabelPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
    <LabelPrimitive.Root
        ref={ref}
        className={cn(
            'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
            className
        )}
        {...props}
    />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
