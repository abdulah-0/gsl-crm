/**
 * @fileoverview Toast Notification Component
 * 
 * Displays popup notifications for real-time events like task assignments.
 * Auto-dismisses after 5 seconds.
 */

import React, { useEffect, useState } from 'react';

export interface ToastNotification {
    id: string;
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
}

interface ToastContainerProps {
    notifications: ToastNotification[];
    onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ notifications, onDismiss }) => {
    useEffect(() => {
        notifications.forEach((notif) => {
            const timer = setTimeout(() => {
                onDismiss(notif.id);
            }, 5000); // Auto-dismiss after 5 seconds

            return () => clearTimeout(timer);
        });
    }, [notifications, onDismiss]);

    const getTypeStyles = (type?: string) => {
        switch (type) {
            case 'success':
                return 'bg-green-50 border-green-200 text-green-800';
            case 'warning':
                return 'bg-yellow-50 border-yellow-200 text-yellow-800';
            case 'error':
                return 'bg-red-50 border-red-200 text-red-800';
            default:
                return 'bg-blue-50 border-blue-200 text-blue-800';
        }
    };

    const getIcon = (type?: string) => {
        switch (type) {
            case 'success':
                return '✓';
            case 'warning':
                return '⚠';
            case 'error':
                return '✕';
            default:
                return 'ℹ';
        }
    };

    return (
        <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
            {notifications.map((notif) => (
                <div
                    key={notif.id}
                    className={`${getTypeStyles(notif.type)} border rounded-lg shadow-lg p-4 animate-slide-in-right`}
                >
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white flex items-center justify-center font-bold">
                            {getIcon(notif.type)}
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-sm mb-1">{notif.title}</h4>
                            <p className="text-xs opacity-90">{notif.message}</p>
                        </div>
                        <button
                            onClick={() => onDismiss(notif.id)}
                            className="flex-shrink-0 text-lg leading-none opacity-50 hover:opacity-100"
                        >
                            ×
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ToastContainer;
