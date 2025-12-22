/**
 * @fileoverview Multi-Select University Component
 * 
 * Dropdown component for selecting multiple universities.
 * Provides search functionality and displays selected universities as tags.
 * 
 * @module components/MultiSelectUniversity
 */

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * University option data structure
 */
export interface UniversityOption {
    /** University ID */
    id: number;
    /** University name */
    name: string;
}

/**
 * Props for MultiSelectUniversity component
 */
interface MultiSelectUniversityProps {
    /** Array of selected university IDs */
    selectedIds: number[];
    /** Callback when selection changes */
    onChange: (ids: number[]) => void;
    /** Placeholder text */
    placeholder?: string;
    /** Additional CSS classes */
    className?: string;
}

/**
 * MultiSelectUniversity Component
 * 
 * Multi-select dropdown for universities with search functionality.
 * 
 * **Features:**
 * - Fetches universities from Supabase
 * - Search/filter universities by name
 * - Display selected universities as removable tags
 * - Click-outside to close dropdown
 * - Loading state during data fetch
 * 
 * @component
 * @example
 * ```tsx
 * <MultiSelectUniversity
 *   selectedIds={selectedUniversityIds}
 *   onChange={(ids) => setSelectedUniversityIds(ids)}
 *   placeholder="Select universities..."
 * />
 * ```
 */
const MultiSelectUniversity: React.FC<MultiSelectUniversityProps> = ({
    selectedIds,
    onChange,
    placeholder = 'Select universities...',
    className = '',
}) => {
    const [search, setSearch] = useState('');
    const [options, setOptions] = useState<UniversityOption[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Fetch universities on mount
    useEffect(() => {
        const fetchUniversities = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('universities')
                    .select('id, name')
                    .order('name', { ascending: true })
                    .limit(1000);

                if (!error && data) {
                    setOptions(data as UniversityOption[]);
                }
            } catch (err) {
                console.error('Error fetching universities', err);
            } finally {
                setLoading(false);
            }
        };
        fetchUniversities();
    }, []);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleUniversity = (id: number) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter(i => i !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    const filteredOptions = options.filter(opt =>
        opt.name.toLowerCase().includes(search.toLowerCase())
    );

    const selectedUniversities = options.filter(opt => selectedIds.includes(opt.id));

    // Handle case where selected IDs might not be in the loaded options (if limit reached or deleted)
    // For now, we only show what we have.

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <div
                className="border rounded p-2 min-h-[38px] flex flex-wrap gap-1 cursor-text bg-white"
                onClick={() => setOpen(true)}
            >
                {selectedUniversities.map(u => (
                    <span key={u.id} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded flex items-center gap-1">
                        {u.name}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleUniversity(u.id); }}
                            className="hover:text-blue-900 font-bold"
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={selectedUniversities.length === 0 ? placeholder : ''}
                    className="flex-1 min-w-[60px] outline-none text-sm"
                    onFocus={() => setOpen(true)}
                />
            </div>

            {open && (
                <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white border rounded shadow-lg">
                    {loading && <div className="p-2 text-xs text-gray-500">Loading...</div>}
                    {!loading && filteredOptions.length === 0 && (
                        <div className="p-2 text-xs text-gray-500">No universities found</div>
                    )}
                    {!loading && filteredOptions.map(opt => {
                        const isSelected = selectedIds.includes(opt.id);
                        return (
                            <div
                                key={opt.id}
                                onClick={() => toggleUniversity(opt.id)}
                                className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 flex items-center justify-between ${isSelected ? 'bg-blue-50' : ''}`}
                            >
                                <div>
                                    <div className="font-medium">{opt.name}</div>
                                </div>
                                {isSelected && <span className="text-blue-600">✓</span>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MultiSelectUniversity;
