/**
 * @fileoverview Teacher Search Dropdown Component
 * 
 * Searchable dropdown for selecting a teacher from dashboard_users.
 * Features debounced search and real-time filtering.
 * 
 * @module components/TeacherSearchDropdown
 */

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Props for TeacherSearchDropdown component
 */
export interface TeacherSearchDropdownProps {
  /** Selected teacher ID */
  value: string;
  /** Callback when teacher is selected */
  onChange: (teacherId: string, teacherName: string, teacherAvatar?: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Teacher option data structure
 */
interface TeacherOption {
  /** Teacher ID */
  id: string;
  /** Teacher's full name */
  full_name: string;
  /** Teacher's email */
  email: string;
  /** Optional avatar URL */
  avatar_url?: string | null;
}

/**
 * TeacherSearchDropdown Component
 * 
 * Searchable dropdown for selecting a teacher.
 * 
 * **Features:**
 * - Debounced search (300ms delay)
 * - Filters users by role='teacher'
 * - Search by name or email
 * - Click-outside to close
 * - Loading state during fetch
 * 
 * @component
 * @example
 * ```tsx
 * <TeacherSearchDropdown
 *   value={selectedTeacherId}
 *   onChange={(id, name, avatar) => {
 *     setSelectedTeacherId(id);
 *     setSelectedTeacherName(name);
 *   }}
 *   placeholder="Search for a teacher..."
 * />
 * ```
 */
const TeacherSearchDropdown: React.FC<TeacherSearchDropdownProps> = ({
  value,
  onChange,
  placeholder = 'Search teacher...',
  className = '',
}) => {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<TeacherOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [debounced, setDebounced] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Debounce search term
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  // Fetch teachers when debounced term changes or dropdown opens first time
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const term = debounced;
        let query = supabase
          .from('dashboard_users')
          .select('id, full_name, email, avatar_url, role')
          .ilike('role', '%teacher%')
          .order('full_name')
          .limit(20);
        if (term) {
          query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
        }
        const { data, error } = await query;
        if (!cancelled && !error && data) {
          setOptions(
            (data as any[]).map((r) => ({
              id: r.id,
              full_name: r.full_name || r.email || 'Unnamed',
              email: r.email || '',
              avatar_url: (r as any).avatar_url ?? null,
            })),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (open) {
      run();
    }
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => o.id === value);

  const handleSelect = (opt: TeacherOption) => {
    onChange(opt.id, opt.full_name, opt.avatar_url || undefined);
    setSearch(opt.full_name || opt.email);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full border rounded p-2 text-sm"
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto bg-white border rounded shadow">
          {loading && <div className="px-3 py-2 text-xs text-text-secondary">Loading teachers...</div>}
          {!loading && options.length === 0 && (
            <div className="px-3 py-2 text-xs text-text-secondary">No teachers found</div>
          )}
          {!loading &&
            options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt)}
                className="w-full flex items-start gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="font-medium text-[13px]">{opt.full_name}</div>
                  <div className="text-[11px] text-text-secondary">{opt.email}</div>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

export default TeacherSearchDropdown;

