import { SupabaseClient } from '@supabase/supabase-js';

/**
 * User branch information
 */
export interface UserBranchInfo {
    branch: string | null;
    isSuperAdmin: boolean;
    isMainBranch: boolean;
}

/**
 * Get the current user's branch and permissions
 * 
 * @param supabase - Supabase client instance
 * @returns User branch information including branch name, super admin status, and main branch status
 */
export async function getUserBranch(supabase: SupabaseClient): Promise<UserBranchInfo> {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user?.email) {
            return {
                branch: null,
                isSuperAdmin: false,
                isMainBranch: false,
            };
        }

        const { data } = await supabase
            .from('dashboard_users')
            .select('branch, role')
            .eq('email', user.email)
            .single();

        const branch = data?.branch || null;
        const role = data?.role || '';
        const isSuperAdmin = role.toLowerCase().includes('super');
        const isMainBranch = branch === 'i8';

        return {
            branch,
            isSuperAdmin,
            isMainBranch,
        };
    } catch (error) {
        console.error('Error getting user branch:', error);
        return {
            branch: null,
            isSuperAdmin: false,
            isMainBranch: false,
        };
    }
}

/**
 * Determine if the current user can access all branches
 * 
 * @param supabase - Supabase client instance
 * @returns True if user is Super Admin or in i8 branch (main branch)
 */
export async function canAccessAllBranches(supabase: SupabaseClient): Promise<boolean> {
    const { isSuperAdmin, isMainBranch } = await getUserBranch(supabase);
    return isSuperAdmin || isMainBranch;
}

/**
 * Get the branch filter value for queries
 * 
 * @param supabase - Supabase client instance
 * @param selectedBranch - Optional branch selected by Super Admin
 * @returns Branch to filter by, or null for all branches
 */
export async function getBranchFilter(
    supabase: SupabaseClient,
    selectedBranch?: string
): Promise<string | null> {
    const { branch, isSuperAdmin, isMainBranch } = await getUserBranch(supabase);

    // Super Admin or main branch can select any branch
    if (isSuperAdmin || isMainBranch) {
        // If a specific branch is selected, use it
        // If 'all' or empty, return null to show all branches
        if (selectedBranch && selectedBranch !== 'all' && selectedBranch !== '') {
            return selectedBranch;
        }
        return null; // Show all branches
    }

    // Other users can only see their own branch
    return branch;
}

/**
 * Get list of all available branches
 * 
 * @param supabase - Supabase client instance
 * @returns Array of branch codes
 */
export async function getAllBranches(supabase: SupabaseClient): Promise<string[]> {
    try {
        const { data } = await supabase
            .from('branches')
            .select('branch_code')
            .order('branch_code');

        return data?.map(b => b.branch_code) || [];
    } catch (error) {
        console.error('Error fetching branches:', error);
        return [];
    }
}

/**
 * Apply branch filter to a Supabase query
 * 
 * @param query - Supabase query builder
 * @param branchFilter - Branch to filter by (null = all branches)
 * @param columnName - Name of the branch column (default: 'branch')
 * @returns Modified query with branch filter applied
 */
export function applyBranchFilter<T>(
    query: any,
    branchFilter: string | null,
    columnName: string = 'branch'
): any {
    if (branchFilter) {
        return query.eq(columnName, branchFilter);
    }
    return query;
}
