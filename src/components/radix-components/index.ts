/**
 * @fileoverview Barrel export file for all Radix UI components.
 * 
 * This file provides a centralized export point for all Radix-based components,
 * making imports cleaner and more maintainable throughout the application.
 * 
 * @module components/radix-components
 * 
 * @example
 * ```tsx
 * // Import multiple components from one location
 * import { Button, Dialog, Select, Checkbox } from '@/components/radix-components';
 * ```
 */

// Button component exports
export { Button, buttonVariants } from './Button';
export type { ButtonProps } from './Button';

// Dialog component exports
export {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogClose,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
} from './Dialog';

// Select component exports
export {
    Select,
    SelectGroup,
    SelectValue,
    SelectTrigger,
    SelectContent,
    SelectLabel,
    SelectItem,
    SelectSeparator,
    SelectScrollUpButton,
    SelectScrollDownButton,
} from './Select';

// Checkbox component exports
export { Checkbox } from './Checkbox';

// Label component exports
export { Label } from './Label';
