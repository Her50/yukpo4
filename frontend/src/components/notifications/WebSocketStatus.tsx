import React from 'react';
import { isWebSocketEnabled, WEBSOCKET_CONFIG } from '@/config/websocket';

interface WebSocketStatusProps {
  showDetails?: boolean;
}

export const WebSocketStatus: React.FC<WebSocketStatusProps> = ({ showDetails = false }) => {
  const isEnabled = isWebSocketEnabled();

  if (isEnabled) {
    return (
      <div className="border border-green-200 bg-green-50 p-4 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-600 rounded-full"></div>
          <h3 className="text-green-800 font-semibold">WebSockets activés</h3>
        </div>
        <p className="text-green-700 mt-1">
          Les fonctionnalités en temps réel sont disponibles
        </p>
      </div>
    );
  }

  return (
    <div className="border border-orange-200 bg-orange-50 p-4 rounded-lg">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-orange-600 rounded-full"></div>
        <h3 className="text-orange-800 font-semibold">WebSockets temporairement désactivés</h3>
      </div>
      <p className="text-orange-700 mt-1">
        {WEBSOCKET_CONFIG.messages.disabled}
        {showDetails && (
          <div className="mt-2 text-sm">
            <p>• Chat en temps réel non disponible</p>
            <p>• Notifications push non disponibles</p>
            <p>• Statut en ligne des prestataires non disponible</p>
            <p className="mt-2 text-xs">
              Les WebSockets seront réactivés une fois le serveur backend prêt
            </p>
          </div>
        )}
      </p>
    </div>
  );
};

export default WebSocketStatus; 