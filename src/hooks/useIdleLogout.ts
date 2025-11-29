/**
 * @fileoverview Idle Logout Hook
 * 
 * Custom React hook that automatically logs out users after a period of inactivity.
 * Tracks user activity through mouse, keyboard, touch, scroll, and visibility events.
 * 
 * @module hooks/useIdleLogout
 */

import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Configuration options for the useIdleLogout hook
 */
interface UseIdleLogoutOptions {
  /** Whether the idle logout functionality is enabled */
  enabled: boolean;
  /** Timeout duration in milliseconds before logout (default: 5 minutes) */
  timeoutMs?: number;
  /** Callback function to execute when timeout occurs */
  onTimeout?: () => void;
}

/**
 * useIdleLogout Hook
 * 
 * Automatically logs out users after a specified period of inactivity.
 * Monitors user activity through various browser events and resets the timer on any activity.
 * 
 * Activity is detected through:
 * - Mouse movement and clicks
 * - Keyboard input
 * - Touch events
 * - Scroll events
 * - Tab visibility changes
 * 
 * Features:
 * - Only active when user is authenticated (has valid session)
 * - Ignores activity in background tabs (hidden visibility state)
 * - Automatically signs out through Supabase auth
 * - Subscribes to auth state changes to start/stop timer
 * - Cleans up all event listeners on unmount
 * 
 * @param {UseIdleLogoutOptions} options - Configuration options
 * @param {boolean} options.enabled - Whether idle logout is enabled
 * @param {number} [options.timeoutMs=300000] - Timeout in milliseconds (default: 5 minutes)
 * @param {Function} [options.onTimeout] - Callback after logout (default: redirects to /login)
 * 
 * @example
 * ```tsx
 * // In a protected route
 * useIdleLogout({
 *   enabled: isAuthenticated,
 *   timeoutMs: 5 * 60 * 1000, // 5 minutes
 *   onTimeout: () => navigate('/login', { replace: true })
 * });
 * ```
 */
export function useIdleLogout({
  enabled,
  timeoutMs = 5 * 60 * 1000,
  onTimeout,
}: UseIdleLogoutOptions) {
  useEffect(() => {
    // Exit early if idle logout is disabled
    if (!enabled) return;

    // Timer reference for the idle timeout
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Subscription reference for auth state changes
    let unsub: { data: { subscription: { unsubscribe: () => void } } } | null = null;
    // Flag to prevent operations after cleanup
    let disposed = false;

    /**
     * Start or restart the idle timeout timer
     * After the timeout expires, signs out the user and executes the callback
     */
    const startTimer = () => {
      if (disposed) return;
      if (timer) clearTimeout(timer);

      timer = setTimeout(async () => {
        try {
          // Sign out through Supabase auth
          await supabase.auth.signOut();
        } finally {
          // Execute callback or redirect to login
          if (onTimeout) onTimeout();
          else window.location.assign('/login');
        }
      }, timeoutMs);
    };

    /**
     * Reset the idle timer when user activity is detected
     * Ignores activity when the tab is hidden (background)
     */
    const resetTimer = () => {
      if (disposed) return;
      // Don't reset timer for background tabs
      if (document.visibilityState === 'hidden') return;
      startTimer();
    };

    /**
     * Browser events that indicate user activity
     * Any of these events will reset the idle timer
     */
    const events = [
      'mousemove',   // Mouse movement
      'mousedown',   // Mouse clicks
      'keydown',     // Keyboard input
      'scroll',      // Page scrolling
      'touchstart',  // Touch events (mobile)
      'visibilitychange', // Tab visibility changes
    ] as const;

    // Attach event listeners for all activity events
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true } as any));

    // Initialize idle logout only if user has an active session
    (async () => {
      // Check for existing session
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;

      // Start the idle timer
      startTimer();

      // Subscribe to auth state changes
      // Stop timer when logged out, restart when logged in
      unsub = supabase.auth.onAuthStateChange((_evt, session) => {
        if (!session) {
          // Clear timer when user logs out
          if (timer) clearTimeout(timer);
        } else {
          // Restart timer when user logs in
          startTimer();
        }
      }) as any;
    })();

    // Cleanup function: remove all listeners and subscriptions
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer as any));
      try { unsub?.data?.subscription?.unsubscribe?.(); } catch { }
    };
  }, [enabled, timeoutMs, onTimeout]);
}

