import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Logs the user out after a period of inactivity (no keyboard/mouse/touch/scroll/visibility activity).
 *
 * Usage: useIdleLogout({ enabled: isAuthenticated, timeoutMs: 5*60*1000, onTimeout: () => navigate('/login', { replace: true }) })
 */
export function useIdleLogout({
  enabled,
  timeoutMs = 5 * 60 * 1000,
  onTimeout,
}: {
  enabled: boolean;
  timeoutMs?: number;
  onTimeout?: () => void;
}) {
  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let unsub: { data: { subscription: { unsubscribe: () => void } } } | null = null;
    let disposed = false;

    const startTimer = () => {
      if (disposed) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          await supabase.auth.signOut();
        } finally {
          if (onTimeout) onTimeout();
          else window.location.assign('/login');
        }
      }, timeoutMs);
    };

    const resetTimer = () => {
      if (disposed) return;
      if (document.visibilityState === 'hidden') return; // ignore background tabs
      startTimer();
    };

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'visibilitychange',
    ];

    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true } as any));

    (async () => {
      // only arm if there is a session
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      startTimer();
      unsub = supabase.auth.onAuthStateChange((_evt, session) => {
        if (!session) {
          if (timer) clearTimeout(timer);
        } else {
          startTimer();
        }
      }) as any;
    })();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer as any));
      try { unsub?.data?.subscription?.unsubscribe?.(); } catch {}
    };
  }, [enabled, timeoutMs, onTimeout]);
}

