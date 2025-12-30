/**
 * @fileoverview Inactivity Timeout Hook
 * 
 * Custom React hook that monitors user activity and automatically logs out
 * the user after a specified period of inactivity.
 * 
 * @module hooks/useInactivityTimeout
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

/**
 * Hook to handle automatic logout after inactivity
 * 
 * @param timeoutMinutes - Number of minutes of inactivity before logout (default: 5)
 */
export const useInactivityTimeout = (timeoutMinutes: number = 5) => {
    const navigate = useNavigate();
    const timeoutId = useRef<NodeJS.Timeout | null>(null);
    const timeoutDuration = timeoutMinutes * 60 * 1000; // Convert to milliseconds

    const logout = async () => {
        try {
            await supabase.auth.signOut();
            navigate('/login', { replace: true });
        } catch (error) {
            console.error('Logout error:', error);
            // Force navigation even if signOut fails
            navigate('/login', { replace: true });
        }
    };

    const resetTimer = () => {
        // Clear existing timeout
        if (timeoutId.current) {
            clearTimeout(timeoutId.current);
        }

        // Set new timeout
        timeoutId.current = setTimeout(() => {
            logout();
        }, timeoutDuration);
    };

    useEffect(() => {
        // Events that indicate user activity
        const events = [
            'mousedown',
            'mousemove',
            'keypress',
            'scroll',
            'touchstart',
            'click',
        ];

        // Reset timer on any user activity
        const handleActivity = () => {
            resetTimer();
        };

        // Add event listeners
        events.forEach((event) => {
            document.addEventListener(event, handleActivity);
        });

        // Initialize timer
        resetTimer();

        // Cleanup
        return () => {
            if (timeoutId.current) {
                clearTimeout(timeoutId.current);
            }
            events.forEach((event) => {
                document.removeEventListener(event, handleActivity);
            });
        };
    }, [timeoutDuration]);
};
