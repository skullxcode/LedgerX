import { useState, useEffect } from 'react';

export const useDismissedNotifications = () => {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    const loadDismissed = () => {
      try {
        const ids = JSON.parse(localStorage.getItem('ledgerx_dismissed_notifications') || '[]');
        setDismissedIds(ids);
      } catch (e) {
        setDismissedIds([]);
      }
    };

    // Initial load
    loadDismissed();

    // Listen to custom event for updates from within the same tab
    const handleUpdate = () => loadDismissed();
    window.addEventListener('ledgerx_notifications_dismissed', handleUpdate);

    return () => {
      window.removeEventListener('ledgerx_notifications_dismissed', handleUpdate);
    };
  }, []);

  return dismissedIds;
};
