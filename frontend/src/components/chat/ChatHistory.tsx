import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageCircle, Clock, User, Search, X } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/components/ui/use-toast';

interface ChatHistoryItem {
  id: string;
  serviceId: string;
  serviceTitle: string;
  prestataireName: string;
  prestataireAvatar?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isActive: boolean;
}

interface ChatHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onChatSelect: (serviceId: string) => void;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({
  isOpen,
  onClose,
  onChatSelect
}) => {
  const [chats, setChats] = useState<ChatHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useUser();
  const { toast } = useToast();

  // Charger l'historique des chats
  useEffect(() => {
    if (isOpen && user?.id) {
      loadChatHistory();
    }
  }, [isOpen, user?.id]);

  const loadChatHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/chat/history', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setChats(data.chats || []);
      } else {
        // Simulation pour le développement
        const mockChats: ChatHistoryItem[] = [
          {
            id: '1',
            serviceId: 'service-1',
            serviceTitle: 'Réparation iPhone',
            prestataireName: 'Jean Tech',
            lastMessage: 'Merci pour votre confiance !',
            lastMessageTime: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
            unreadCount: 2,
            isActive: true
          },
          {
            id: '2',
            serviceId: 'service-2',
            serviceTitle: 'Cours de guitare',
            prestataireName: 'Marie Music',
            lastMessage: 'À bientôt pour la prochaine leçon',
            lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2h ago
            unreadCount: 0,
            isActive: false
          }
        ];
        setChats(mockChats);
      }
    } catch (error) {
      console.error('Erreur chargement historique chats:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger l'historique des chats",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.serviceTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.prestataireName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}min`;
    if (hours < 24) return `${hours}h`;
    return `${days}j`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Historique des conversations
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden">
          {/* Barre de recherche */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une conversation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Liste des chats */}
          <div className="space-y-2 overflow-y-auto max-h-96">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Chargement...</p>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Aucune conversation trouvée</p>
              </div>
            ) : (
              filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => {
                    onChatSelect(chat.serviceId);
                    onClose();
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-gray-50 ${
                    chat.isActive ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={chat.prestataireAvatar} />
                      <AvatarFallback className="bg-blue-500 text-white">
                        {chat.prestataireName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-gray-900 truncate">
                          {chat.prestataireName}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(chat.lastMessageTime)}
                          </span>
                          {chat.unreadCount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {chat.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 mb-1 truncate">
                        {chat.serviceTitle}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {chat.lastMessage}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChatHistory;
