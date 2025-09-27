import React from 'react';
import { useServerStatus } from '../hooks/useServerStatus';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

const ServerStatusIndicator: React.FC = () => {
  const { isOnline, retryCount, checkServerStatus } = useServerStatus();

  const handleRetry = async () => {
    toast.loading('Vérification du serveur...', { id: 'server-check' });
    const success = await checkServerStatus();
    
    if (success) {
      toast.success('Serveur accessible !', { id: 'server-check' });
    } else {
      toast.error('Serveur toujours inaccessible', { id: 'server-check' });
    }
  };

  if (isOnline) {
    return (
      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
        <Wifi className="w-4 h-4" />
        <span className="text-sm">Serveur en ligne</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
      <WifiOff className="w-4 h-4" />
      <span className="text-sm">Serveur hors ligne</span>
      {retryCount > 0 && (
        <span className="text-xs opacity-75">({retryCount} tentatives)</span>
      )}
      <button
        onClick={handleRetry}
        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
        title="Réessayer la connexion"
      >
        <RefreshCw className="w-3 h-3" />
      </button>
    </div>
  );
};

export default ServerStatusIndicator;
