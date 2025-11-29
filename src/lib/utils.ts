import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes with proper precedence.
 * 
 * This function combines multiple class names and resolves conflicts between
 * Tailwind utility classes, ensuring the last class takes precedence.
 * 
 * @param inputs - Variable number of class values (strings, arrays, objects, etc.)
 * @returns Merged class string with conflicts resolved
 * 
 * @example
 * ```tsx
 * cn('px-4 py-2', 'px-6') // Returns: 'py-2 px-6'
 * cn('text-red-500', condition && 'text-blue-500') // Conditional classes
 * ```
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Format a date to a readable string format.
 * 
 * @param date - Date object or string to format
 * @param format - Format type ('short', 'long', 'time')
 * @returns Formatted date string
 * 
 * @example
 * ```tsx
 * formatDate(new Date(), 'short') // Returns: '11/28/2025'
 * formatDate(new Date(), 'long') // Returns: 'November 28, 2025'
 * ```
 */
export function formatDate(date: Date | string, format: 'short' | 'long' | 'time' = 'short'): string {
    const d = typeof date === 'string' ? new Date(date) : date;

    if (format === 'short') {
        return d.toLocaleDateString();
    } else if (format === 'long') {
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } else {
        return d.toLocaleTimeString();
    }
}

/**
 * Debounce function to limit the rate at which a function can fire.
 * 
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 * 
 * @example
 * ```tsx
 * const debouncedSearch = debounce((query) => search(query), 300);
 * ```
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            timeout = null;
            func(...args);
        };

        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
