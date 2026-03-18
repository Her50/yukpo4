import { useEffect, useState } from 'react';

interface UserStatus {
  status: 'online' | 'offline';
  isActive: boolean;
  lastSeen: string;
}

interface OnlineStatusResult {
  isOnline: boolean;
  lastSeen: Date | null;
  loading: boolean;
}

/**
 * Hook pour gérer le statut en ligne des utilisateurs
 * Simule la logique du frontend avec WebSocket
 */
export const useOnlineStatus = (
  userId: number | string,
  wsConnected: boolean = false,
  userStatus: UserStatus | null = null,
  serviceCreatedAt: string = ''
): OnlineStatusResult => {
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setLoading(true);

      if (wsConnected && userStatus) {
        // Vérifier le statut réel depuis les données WebSocket
        const isUserOnline = userStatus.status === 'online' || userStatus.isActive;
        setIsOnline(isUserOnline);

        if (!isUserOnline && userStatus.lastSeen) {
          setLastSeen(new Date(userStatus.lastSeen));
        } else {
          setLastSeen(null);
        }

        console.log(`\uD83D\uDCE1 [useOnlineStatus] Statut WebSocket pour user ${userId}:`, {
          isOnline: isUserOnline,
          lastSeen: userStatus.lastSeen
        });
      } else {
        // Si WebSocket non connecté, simuler un statut basé sur l'activité récente
        const now = new Date();
        const serviceDate = new Date(serviceCreatedAt || now);
        const diffHours = (now.getTime() - serviceDate.getTime()) / (1000 * 60 * 60);

        // Considérer en ligne si service créé récemment (moins de 24h)
        const simulatedOnline = diffHours < 24;
        setIsOnline(simulatedOnline);

        if (!simulatedOnline) {
          setLastSeen(serviceDate);
        } else {
          setLastSeen(null);
        }

        console.log(`\uD83D\uDD04 [useOnlineStatus] Statut simulé pour user ${userId}:`, {
          isOnline: simulatedOnline,
          serviceAge: `${diffHours.toFixed(1)}h`,
          serviceDate: serviceCreatedAt
        });
      }

      setLoading(false);
    };

    updateOnlineStatus();
  }, [userId, wsConnected, userStatus, serviceCreatedAt]);

  return { isOnline, lastSeen, loading };
};

export default useOnlineStatus;



