import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getUserBranch, getAllBranches } from '../utils/branchAccess';

interface BranchFilterProps {
    value: string;
    onChange: (branch: string) => void;
    showAllOption?: boolean;
    className?: string;
}

/**
 * Branch Filter Component
 * 
 * Displays a branch selector dropdown for Super Admins and i8 branch users.
 * Other users will not see this component as they can only access their own branch.
 * 
 * @param value - Currently selected branch value
 * @param onChange - Callback when branch selection changes
 * @param showAllOption - Whether to show "All Branches" option (default: true)
 * @param className - Additional CSS classes
 */
export const BranchFilter: React.FC<BranchFilterProps> = ({
    value,
    onChange,
    showAllOption = true,
    className = '',
}) => {
    const [canAccessAll, setCanAccessAll] = useState(false);
    const [branches, setBranches] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadBranchData = async () => {
            try {
                // Check if user can access all branches
                const { isSuperAdmin, isMainBranch } = await getUserBranch(supabase);
                const hasAccess = isSuperAdmin || isMainBranch;
                setCanAccessAll(hasAccess);

                if (hasAccess) {
                    // Load all available branches
                    const allBranches = await getAllBranches(supabase);
                    setBranches(allBranches);
                }
            } catch (error) {
                console.error('Error loading branch data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadBranchData();
    }, []);

    // Don't render if user can't access all branches
    if (!canAccessAll || loading) {
        return null;
    }

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <label className="text-sm font-medium text-gray-700">Branch:</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                {showAllOption && <option value="all">All Branches</option>}
                {branches.map((branch) => (
                    <option key={branch} value={branch}>
                        {branch}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default BranchFilter;
