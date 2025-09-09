import React, { useState } from 'react';
import { 
  getCurrentWebSocketConfig, 
  PHASE_MESSAGES, 
  getNextPhaseInstructions,
  CURRENT_PHASE 
} from '@/config/websocket-progressive';

export const WebSocketStatusPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const config = getCurrentWebSocketConfig();
  const phaseInfo = PHASE_MESSAGES[CURRENT_PHASE as keyof typeof PHASE_MESSAGES];
  const nextPhaseInfo = getNextPhaseInstructions();

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-lg"
          title="Statut WebSocket"
        >
          🔌
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-white border border-gray-300 rounded-lg shadow-xl p-4 max-w-md">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-gray-800">{phaseInfo.title}</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-3">
        <p className="text-sm text-gray-600">{phaseInfo.description}</p>
        
        <div className="space-y-2">
          <h4 className="font-medium text-gray-700">Composants :</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
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
        
        <div className="space-y-2">
          <h4 className="font-medium text-gray-700">Actions en cours :</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            {phaseInfo.actions.map((action, index) => (
              <li key={index} className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                {action}
              </li>
            ))}
          </ul>
        </div>
        
        {nextPhaseInfo.nextPhase !== 'complete' && (
          <div className="space-y-2 p-3 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-800">Prochaine étape :</h4>
            <p className="text-sm text-blue-700">
              Passer à la <strong>{nextPhaseInfo.nextPhase}</strong>
            </p>
            <ul className="text-xs text-blue-600 space-y-1">
              {nextPhaseInfo.instructions.map((instruction, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                  {instruction}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="text-xs text-gray-500 text-center">
          Phase actuelle : <strong>{CURRENT_PHASE}</strong>
        </div>
      </div>
    </div>
  );
};

export default WebSocketStatusPanel; 