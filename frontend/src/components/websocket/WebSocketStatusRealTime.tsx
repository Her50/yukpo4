import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/buttons/Button';
import { Wifi, WifiOff, RefreshCw, Settings, CheckCircle, XCircle } from 'lucide-react';
import { WEBSOCKET_CONFIG, isWebSocketEnabled } from '@/config/websocket';
import { getCurrentWebSocketConfig, isWebSocketComponentEnabled } from '@/config/websocket-progressive';

interface WebSocketStatusRealTimeProps {
  className?: string;
}

export const WebSocketStatusRealTime: React.FC<WebSocketStatusRealTimeProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastPing, setLastPing] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const config = getCurrentWebSocketConfig();
  const isEnabled = isWebSocketEnabled();

  // Simuler la connexion WebSocket
  useEffect(() => {
    if (!isEnabled) {
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');
    
    // Simuler une connexion réussie après 2 secondes
    const timer = setTimeout(() => {
      setConnectionStatus('connected');
      setLastPing(new Date());
      setErrorMessage(null);
    }, 2000);

    return () => clearTimeout(timer);
  }, [isEnabled]);

  const handleReconnect = () => {
    setConnectionStatus('connecting');
    setErrorMessage(null);
    
    // Simuler une reconnexion
    setTimeout(() => {
      setConnectionStatus('connected');
      setLastPing(new Date());
    }, 1500);
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'connecting':
        return <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <WifiOff className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connecté';
      case 'connecting':
        return 'Connexion...';
      case 'error':
        return 'Erreur';
      default:
        return 'Déconnecté';
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-600';
      case 'connecting':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  if (!isOpen) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-lg transition-colors"
          title="Statut WebSocket en temps réel"
        >
          {getStatusIcon()}
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 bg-white border border-gray-300 rounded-lg shadow-xl p-4 max-w-sm ${className}`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          {getStatusIcon()}
          Statut WebSocket
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-3">
        {/* Statut de connexion */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Connexion :</span>
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>

        {/* Dernier ping */}
        {lastPing && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Dernier ping :</span>
            <span className="text-sm text-gray-800">
              {lastPing.toLocaleTimeString('fr-FR')}
            </span>
          </div>
        )}

        {/* Composants WebSocket */}
        <div className="space-y-2">
          <h4 className="font-medium text-gray-700 text-sm">Composants :</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={`p-2 rounded ${config.components.status ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              <strong>Statut:</strong> {config.components.status ? '✅' : '❌'}
            </div>
            <div className={`p-2 rounded ${config.components.notifications ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              <strong>Notifications:</strong> {config.components.notifications ? '✅' : '❌'}
            </div>
            <div className={`p-2 rounded ${config.components.chat ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              <strong>Chat:</strong> {config.components.chat ? '✅' : '❌'}
            </div>
            <div className={`p-2 rounded ${config.components.access ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              <strong>Accès:</strong> {config.components.access ? '✅' : '❌'}
            </div>
          </div>
        </div>

        {/* Message d'erreur */}
        {errorMessage && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleReconnect}
            disabled={connectionStatus === 'connecting'}
            size="sm"
            className="flex-1"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Reconnexion
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/config/websocket', '_blank')}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {/* Configuration */}
        <div className="text-xs text-gray-500 text-center">
          <p>URL: {WEBSOCKET_CONFIG.urls.status(1).replace('ws://', '')}</p>
          <p>Phase: {config.description}</p>
        </div>
      </div>
    </div>
  );
};

export default WebSocketStatusRealTime; 