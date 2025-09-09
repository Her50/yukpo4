import React, { useState } from 'react';
import { Button } from '@/components/ui/buttons';
import { MessageCircle, X } from 'lucide-react';
import { useChatManager } from '@/hooks/useChatManager';

export const ChatDemo: React.FC = () => {
  const {
    showChatList,
    openChatList,
    closeChatList,
    openChat,
    editMessage,
    deleteMessage
  } = useChatManager();

  // Chats de démonstration
  const demoChats = [
    {
      id: '1',
      prestataireId: 1,
      serviceId: 1,
      nom: 'Jean Dupont',
      lastMessage: 'Bonjour, comment puis-je vous aider ?',
      lastMessageTime: new Date(),
      unreadCount: 2,
      isOnline: true
    },
    {
      id: '2',
      prestataireId: 2,
      serviceId: 2,
      nom: 'Marie Martin',
      lastMessage: 'Votre demande a été traitée',
      lastMessageTime: new Date(Date.now() - 3600000), // 1 heure ago
      unreadCount: 0,
      isOnline: false
    }
  ];

  const handleChatSelect = (chat: any) => {
    console.log('Chat sélectionné:', chat);
    // Simuler l'ouverture du chat
    openChat(chat);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Bouton de chat */}
      <Button
        onClick={openChatList}
        className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
        title="Ouvrir le chat"
      >
        <MessageCircle className="w-6 h-6" />
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          2
        </div>
      </Button>

      {/* Liste des chats */}
      {showChatList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md h-96 flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <h2 className="text-lg font-semibold">💬 Mes chats</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeChatList}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Liste des chats */}
            <div className="flex-1 overflow-y-auto">
              <div className="divide-y">
                {demoChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleChatSelect(chat)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                          {chat.nom.charAt(0).toUpperCase()}
                        </div>
                        {chat.isOnline && (
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium truncate">{chat.nom}</h3>
                          <span className="text-xs text-gray-500">
                            {chat.lastMessageTime.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{chat.lastMessage}</p>
                        <p className="text-xs text-blue-600">Service #{chat.serviceId}</p>
                      </div>
                      
                      {chat.unreadCount > 0 && (
                        <div className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {chat.unreadCount}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                Cliquez sur un chat pour ouvrir la conversation
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatDemo; 