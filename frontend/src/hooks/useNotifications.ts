import { useEffect } from 'react';
import { notify } from '@/lib/notifications';

export function useNotifications(userId: number) {
  useEffect(() => {
    const fetchNotifications = async () => {
      const res = await fetch(`/api/notifications/${userId}`);
      const data = await res.json();
      for (const notif of data) {
        if (!notif.read) {
          notify(notif.title, notif.message);
        }
      }
    };

    const interval = setInterval(fetchNotifications, 30000);
    fetchNotifications();
    return () => clearInterval(interval);
  }, [userId]);
}
