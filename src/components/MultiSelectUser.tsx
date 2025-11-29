/**
 * @fileoverview Multi-Select User Component
 * 
 * Dropdown component for selecting multiple users from dashboard_users table.
 * Provides search functionality and displays selected users as tags.
 * 
 * @module components/MultiSelectUser
 */

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * User option data structure
 */
export interface UserOption {
    /** User ID */
    id: string;
    /** User's full name */
    full_name: string;
    /** User's email address */
    email: string;
    /** Optional avatar URL */
    avatar_url?: string;
}

/**
 * Props for MultiSelectUser component
 */
interface MultiSelectUserProps {
    /** Array of selected user IDs */
    selectedIds: string[];
    /** Callback when selection changes */
    onChange: (ids: string[]) => void;
    /** Placeholder text */
    placeholder?: string;
    /** Additional CSS classes */
    className?: string;
}

/**
 * MultiSelectUser Component
 * 
 * Multi-select dropdown for users with search functionality.
 * 
 * **Features:**
 * - Fetches users from dashboard_users table
 * - Search by name or email
 * - Display selected users as removable tags
 * - Click-outside to close dropdown
 * - Loading state during data fetch
 * 
 * @component
 * @example
 * ```tsx
 * <MultiSelectUser
 *   selectedIds={selectedUserIds}
 *   onChange={(ids) => setSelectedUserIds(ids)}
 *   placeholder="Select users..."
 * />
 * ```
 */
const MultiSelectUser: React.FC<MultiSelectUserProps> = ({
    selectedIds,
    onChange,
    placeholder = 'Select users...',
    className = '',
}) => {
    const [search, setSearch] = useState('');
    const [options, setOptions] = useState<UserOption[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Fetch users on mount
    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            try {
                // Fetch all users, or filter by role if needed. 
                // For now, fetching all dashboard_users.
                const { data, error } = await supabase
                    .from('dashboard_users')
                    .select('id, full_name, email, avatar_url')
                    .order('full_name');

                if (!error && data) {
                    setOptions(data.map((u: any) => ({
                        id: u.id,
                        full_name: u.full_name || u.email || 'Unnamed',
                        email: u.email || '',
                        avatar_url: u.avatar_url
                    })));
                }
            } catch (err) {
                console.error('Error fetching users', err);
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
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

    const toggleUser = (id: string) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter(i => i !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    const filteredOptions = options.filter(opt =>
        opt.full_name.toLowerCase().includes(search.toLowerCase()) ||
        opt.email.toLowerCase().includes(search.toLowerCase())
    );

    const selectedUsers = options.filter(opt => selectedIds.includes(opt.id));

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <div
                className="border rounded p-2 min-h-[38px] flex flex-wrap gap-1 cursor-text bg-white"
                onClick={() => setOpen(true)}
            >
                {selectedUsers.map(u => (
                    <span key={u.id} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded flex items-center gap-1">
                        {u.full_name}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleUser(u.id); }}
                            className="hover:text-blue-900 font-bold"
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={selectedUsers.length === 0 ? placeholder : ''}
                    className="flex-1 min-w-[60px] outline-none text-sm"
                    onFocus={() => setOpen(true)}
                />
            </div>

            {open && (
                <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white border rounded shadow-lg">
                    {loading && <div className="p-2 text-xs text-gray-500">Loading...</div>}
                    {!loading && filteredOptions.length === 0 && (
                        <div className="p-2 text-xs text-gray-500">No users found</div>
                    )}
                    {!loading && filteredOptions.map(opt => {
                        const isSelected = selectedIds.includes(opt.id);
                        return (
                            <div
                                key={opt.id}
                                onClick={() => toggleUser(opt.id)}
                                className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 flex items-center justify-between ${isSelected ? 'bg-blue-50' : ''}`}
                            >
                                <div>
                                    <div className="font-medium">{opt.full_name}</div>
                                    <div className="text-xs text-gray-500">{opt.email}</div>
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

export default MultiSelectUser;
