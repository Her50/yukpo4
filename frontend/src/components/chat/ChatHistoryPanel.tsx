// 📁 frontend/src/components/chat/ChatHistoryPanel.tsx

import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Message {
  id: string;
  sender: string;
  receiver: string;
  content: string;
  timestamp: string;
}

interface Props {
  clientId: string;
  prestataireId: string;
}

const ChatHistoryPanel: React.FC<Props> = ({ clientId, prestataireId }) => {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    axios
      .get(`/api/chat/history/${clientId}/${prestataireId}`)
      .then((res) => setMessages(res.data))
      .catch((err) => console.error('Erreur historique chat', err));
  }, [clientId, prestataireId]);

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto p-4 bg-white rounded shadow">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`text-sm ${msg.sender === prestataireId ? 'text-right' : 'text-left'}`}
        >
          <span className="inline-block bg-gray-200 px-3 py-1 rounded-md">
            {msg.content}
          </span>
          <div className="text-xs text-gray-500">{new Date(msg.timestamp).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
};

export default ChatHistoryPanel;
