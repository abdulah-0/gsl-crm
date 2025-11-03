import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export type Branch = {
  id: string;
  branch_name: string;
  branch_code: string;
};

export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('id, branch_name, branch_code')
          .order('branch_name', { ascending: true });
        if (!mounted) return;
        if (!error && data) setBranches(data as Branch[]);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);
  return branches;
}

