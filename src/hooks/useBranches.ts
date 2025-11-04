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
    let cancelled = false;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('id, branch_name, branch_code')
          .order('branch_name', { ascending: true });
        if (!cancelled && !error && data) { setBranches(data as Branch[]); return; }
        if (error) throw error;
      } catch {
        try {
          const { data } = await supabase
            .from('branches')
            .select('id, name, code')
            .order('name', { ascending: true });
          if (!cancelled && data) {
            const mapped = (data as any[]).map(r => ({ id: r.id, branch_name: r.name, branch_code: r.code }));
            setBranches(mapped);
          }
        } catch {}
      }
    };
    load();
    const chan = supabase
      .channel('rt:branches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, () => { load(); })
      .subscribe();
    return () => { cancelled = true; try { supabase.removeChannel(chan); } catch {} };
  }, []);
  return branches;
}

