import React, { useState, useEffect } from 'react';
import { MessageSquare, X, Bell, Clock, User, Star, Plus, Search } from 'lucide-react';
import { Button } from './buttons/Button';
import { useToast } from './use-toast';

interface ChatMessage {
  id: string;
  service_id: number;
  service_title: string;
  prestataire_name: string;
  last_message: string;
  timestamp: string;
  unread_count: number;
  is_online: boolean;
  avatar_url?: string;
}

interface GlobalChatAccessProps {
  className?: string;
}

export const GlobalChatAccess: React.FC<GlobalChatAccessProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredChats, setFilteredChats] = useState<ChatMessage[]>([]);
  const { toast } = useToast();

  // Charger l'historique des chats depuis le localStorage ou l'API
  useEffect(() => {
    loadChatHistory();
  }, []);

  // Filtrer les chats selon la recherche
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredChats(chatHistory);
    } else {
      const filtered = chatHistory.filter(chat => 
        chat.prestataire_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.service_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.last_message.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredChats(filtered);
    }
  }, [searchQuery, chatHistory]);

  const loadChatHistory = async () => {
    setIsLoading(true);
    try {
      // Essayer de charger depuis l'API
      const token = localStorage.getItem('token');
      if (token) {
        const response = await fetch('/api/chat/history', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setChatHistory(data);
          setFilteredChats(data);
        } else {
          // Fallback: charger depuis le localStorage
          loadFromLocalStorage();
        }
      } else {
        loadFromLocalStorage();
      }
    } catch (error) {
      console.error('Erreur chargement historique chat:', error);
      loadFromLocalStorage();
    } finally {
      setIsLoading(false);
    }
  };

  const loadFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem('chat_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        setChatHistory(parsed);
        setFilteredChats(parsed);
      }
    } catch (error) {
      console.error('Erreur lecture localStorage:', error);
    }
  };

  const openChat = (chat: ChatMessage) => {
    setSelectedChat(chat);
    
    // Marquer comme lu
    setChatHistory(prev => 
      prev.map(c => 
        c.id === chat.id ? { ...c, unread_count: 0 } : c
      )
    );
    setFilteredChats(prev => 
      prev.map(c => 
        c.id === chat.id ? { ...c, unread_count: 0 } : c
      )
    );

    // Ici on pourrait ouvrir le chat dans une nouvelle fenêtre ou modal
    toast({
      title: "Ouverture du chat",
      description: `Ouverture du chat avec ${chat.prestataire_name}`,
      type: "default"
    });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `Il y a ${diffHours}h`;
    } else {
      return 'À l\'instant';
    }
  };

  const totalUnread = chatHistory.reduce((sum, chat) => sum + chat.unread_count, 0);

  const startNewChat = () => {
    // Rediriger vers la page des besoins pour démarrer un nouveau chat
    window.location.href = '/besoins';
  };

  return (
    <>
      {/* Bouton flottant d'accès au chat */}
      <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 border-0"
          size="lg"
        >
          <MessageSquare className="w-7 h-7" />
          {totalUnread > 0 && (
            <div className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
              {totalUnread > 99 ? '99+' : totalUnread}
            </div>
          )}
        </Button>
      </div>

      {/* Panneau d'historique des chats */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-end z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md h-[80vh] flex flex-col shadow-2xl border border-gray-100">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Mes conversations</h3>
                  <p className="text-sm text-gray-600">
                    {chatHistory.length} conversation{chatHistory.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full w-10 h-10 p-0"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Barre de recherche */}
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher une conversation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all duration-200"
                />
              </div>
            </div>

            {/* Contenu */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">Chargement...</p>
                  </div>
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageSquare className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                    <h4 className="text-xl font-semibold text-gray-600 mb-2">
                      {searchQuery ? 'Aucun résultat' : 'Aucun chat'}
                    </h4>
                    <p className="text-gray-500 mb-6">
                      {searchQuery 
                        ? 'Aucune conversation ne correspond à votre recherche.'
                        : 'Commencez une conversation avec un prestataire pour voir l\'historique ici.'
                      }
                    </p>
                    {!searchQuery && (
                      <Button
                        onClick={startNewChat}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Nouveau chat
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {filteredChats.map((chat) => (
                    <div
                      key={chat.id}
                      className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-all duration-200 cursor-pointer border border-gray-100 hover:border-gray-200 hover:shadow-md"
                      onClick={() => openChat(chat)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                            {chat.avatar_url ? (
                              <img 
                                src={chat.avatar_url} 
                                alt={chat.prestataire_name}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              chat.prestataire_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {chat.prestataire_name}
                            </p>
                            <p className="text-xs text-gray-600">
                              {chat.service_title}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {/* Indicateur de statut en ligne */}
                          <div className={`w-3 h-3 rounded-full ${
                            chat.is_online ? 'bg-green-500' : 'bg-gray-400'
                          }`} />
                          
                          {/* Nombre de messages non lus */}
                          {chat.unread_count > 0 && (
                            <div className="w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                              {chat.unread_count > 9 ? '9+' : chat.unread_count}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-700 mb-3 line-clamp-2 leading-relaxed">
                        {chat.last_message}
                      </p>
                      
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(chat.timestamp)}
                        </span>
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 text-xs px-3 py-1 rounded-lg"
                          onClick={(e) => {
                            e.stopPropagation();
                            openChat(chat);
                          }}
                        >
                          Ouvrir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer avec actions rapides */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={loadChatHistory}
                  className="flex-1 text-sm border-gray-300 hover:border-blue-500 hover:text-blue-600 rounded-xl py-3"
                  size="sm"
                >
                  🔄 Actualiser
                </Button>
                
                <Button
                  onClick={startNewChat}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm rounded-xl py-3 font-medium"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau chat
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}; 