import React from 'react';
import { isDebugEnabled } from '@/config/debug';

interface WebSocketStatusDebugProps {
  wsConnected: boolean;
  userStatus: any;
  notificationsConnected: boolean;
}

export const WebSocketStatusDebug: React.FC<WebSocketStatusDebugProps> = ({
  wsConnected,
  userStatus,
  notificationsConnected
}) => {
  // Activer uniquement si le debug est configuré
  if (process.env.NODE_ENV !== 'development' || !isDebugEnabled('SHOW_WEBSOCKET_DEBUG')) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg text-xs font-mono z-50">
      <div className="mb-2 font-bold">🔧 Debug WebSocket</div>
      <div>wsConnected: {wsConnected ? '✅' : '❌'}</div>
      <div>userStatus: {userStatus ? JSON.stringify(userStatus) : 'null'}</div>
      <div>notificationsConnected: {notificationsConnected ? '✅' : '❌'}</div>
      <div className="mt-2 text-yellow-300">
        {wsConnected && !userStatus && '⚠️ wsConnected=true mais userStatus=null'}
        {wsConnected && userStatus?.status !== 'online' && '⚠️ Statut non-online'}
      </div>
    </div>
  );
}; 