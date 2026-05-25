'use client';

import React, { useState } from 'react';
import { Bell, Check, X, Trash2, ArrowRight } from 'lucide-react';
import { useQuery as useConvexQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useMagic } from '@/context/MagicContext';
import Link from 'next/link';

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const ago = now - timestamp;
  const seconds = Math.floor(ago / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function NotificationBell() {
  const { user } = useMagic();
  const [open, setOpen] = useState(false);
  const markNotifRead = useMutation(api.notifications.markNotificationRead);
  const markAllRead = useMutation(api.notifications.markAllNotificationsRead);
  const deleteNotif = useMutation(api.notifications.markNotificationRead); // We'll use delete instead

  const unreadNotifications = useConvexQuery(
    api.notifications.getUserNotifications,
    user?.issuer ? { userId: user.issuer, unreadOnly: true } : 'skip'
  );

  if (!user?.issuer) return null;

  const unreadCount = unreadNotifications?.length || 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg shadow-lg z-40 overflow-hidden">
            <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead({ userId: user.issuer })}
                  className="text-xs text-blue-500 hover:text-blue-600"
                >
                  Mark all read
                </button>
              )}
            </div>

            {unreadNotifications && unreadNotifications.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                {unreadNotifications.map((notif: any) => (
                  <Link
                    key={notif._id}
                    href={notif.matchId ? `/markets/${notif.matchId}` : '#'}
                  >
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer group">
                      <div className="flex items-start gap-3">
                        {/* Icon based on type */}
                        <div className="mt-1">
                          {notif.type === 'match_invitation' && (
                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                          )}
                          {notif.type === 'invite_accepted' && (
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                          )}
                          {notif.type === 'match_result' && (
                            <div className="w-2 h-2 rounded-full bg-orange-500" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 dark:text-white line-clamp-2">
                            {notif.message}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {formatTimeAgo(notif.timestamp)}
                          </p>
                        </div>

                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            markNotifRead({ notificationId: notif._id });
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Mark as read"
                        >
                          <Check className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                        </button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                All caught up! No new notifications.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
