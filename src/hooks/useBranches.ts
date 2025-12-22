/**
 * @fileoverview Branches Hook
 * 
 * Custom React hook for fetching and managing branch data from Supabase.
 * Provides real-time updates when branch data changes in the database.
 * 
 * @module hooks/useBranches
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Branch data structure
 * Represents a branch/location in the CRM system
 */
export type Branch = {
  /** Unique identifier for the branch */
  id: string;
  /** Display name of the branch */
  branch_name: string;
  /** Short code/abbreviation for the branch */
  branch_code: string;
};

/**
 * useBranches Hook
 * 
 * Fetches and manages the list of branches from the Supabase database.
 * Automatically subscribes to real-time updates and refetches data when changes occur.
 * 
 * Features:
 * - Loads branches on mount, sorted alphabetically by name
 * - Subscribes to real-time database changes (INSERT, UPDATE, DELETE)
 * - Implements fallback logic for different database schema versions
 * - Handles cleanup on unmount to prevent memory leaks
 * - Cancels pending updates if component unmounts
 * 
 * Database schema support:
 * - Primary: branches table with columns (id, branch_name, branch_code)
 * - Fallback: branches table with columns (id, name, code)
 * 
 * @returns {Branch[]} Array of branch objects sorted by name
 * 
 * @example
 * ```tsx
 * function BranchSelector() {
 *   const branches = useBranches();
 *   
 *   return (
 *     <select>
 *       {branches.map(branch => (
 *         <option key={branch.id} value={branch.id}>
 *           {branch.branch_name} ({branch.branch_code})
 *         </option>
 *       ))}
 *     </select>
 *   );
 * }
 * ```
 */
export function useBranches() {
  // State to store the list of branches
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    // Flag to prevent state updates after component unmount
    let cancelled = false;
    /**
     * Load branches from the database
     * Tries primary schema first, falls back to alternative schema if needed
     */
    const load = async () => {
      try {
        // Try primary schema: branch_name, branch_code
        const { data, error } = await supabase
          .from('branches')
          .select('id, branch_name, branch_code')
          .order('branch_name', { ascending: true });

        if (!cancelled && !error && data) {
          setBranches(data as Branch[]);
          return;
        }
        if (error) throw error;
      } catch {
        // Fallback to alternative schema: name, code
        try {
          const { data } = await supabase
            .from('branches')
            .select('id, name, code')
            .order('name', { ascending: true });

          if (!cancelled && data) {
            // Map alternative schema to standard Branch type
            const mapped = (data as any[]).map(r => ({
              id: r.id,
              branch_name: r.name,
              branch_code: r.code
            }));
            setBranches(mapped);
          }
        } catch {
          // Silently handle errors - branches will remain empty
        }
      }
    };

    // Initial load
    load();

    /**
     * Subscribe to real-time changes in the branches table
     * Automatically reloads data when any change occurs (INSERT, UPDATE, DELETE)
     */
    const chan = supabase
      .channel('rt:branches')
      .on('postgres_changes', {
        event: '*',  // Listen to all events
        schema: 'public',
        table: 'branches'
      }, () => {
        load(); // Reload branches when changes occur
      })
      .subscribe();

    // Cleanup: cancel pending updates and unsubscribe from real-time channel
    return () => {
      cancelled = true;
      try { supabase.removeChannel(chan); } catch { }
    };
  }, []);

  return branches;
}

