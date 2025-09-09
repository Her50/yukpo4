import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export interface Chat {
  id: string;
  prestataireId: number;
  serviceId: number;
  nom: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isOnline: boolean;
}

export interface ChatMessage {
  id: string;
  from: 'client' | 'prestataire';
  content: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'error';
  type: 'text' | 'audio' | 'image' | 'video' | 'document';
  isEdited?: boolean;
  originalContent?: string;
  editTimestamp?: Date;
  audioUrl?: string;
  audioBlob?: Blob;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}

export const useChatManager = () => {
  const navigate = useNavigate();
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [showChatList, setShowChatList] = useState(false);

  // Ouvrir un chat spécifique
  const openChat = useCallback((chat: Chat) => {
    setActiveChat(chat);
    setShowChatList(false);
    
    // Naviguer vers la page ResultatBesoin avec les paramètres du chat
    navigate('/resultat-besoin', {
      state: {
        openChat: true,
        serviceId: chat.serviceId,
        prestataireId: chat.prestataireId,
        chatId: chat.id
      }
    });
  }, [navigate]);

  // Fermer le chat actif
  const closeChat = useCallback(() => {
    setActiveChat(null);
  }, []);

  // Ouvrir la liste des chats
  const openChatList = useCallback(() => {
    setShowChatList(true);
  }, []);

  // Fermer la liste des chats
  const closeChatList = useCallback(() => {
    setShowChatList(false);
  }, []);

  // Modifier un message
  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    try {
      const response = await fetch('/api/chat/edit-message', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          messageId,
          newContent
        })
      });

      if (response.ok) {
        return true;
      } else {
        console.error('Erreur modification message');
        return false;
      }
    } catch (error) {
      console.error('Erreur modification message:', error);
      return false;
    }
  }, []);

  // Supprimer un message
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      const response = await fetch('/api/chat/delete-message', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ messageId })
      });

      if (response.ok) {
        return true;
      } else {
        console.error('Erreur suppression message');
        return false;
      }
    } catch (error) {
      console.error('Erreur suppression message:', error);
      return false;
    }
  }, []);

  return {
    activeChat,
    showChatList,
    openChat,
    closeChat,
    openChatList,
    closeChatList,
    editMessage,
    deleteMessage
  };
}; 