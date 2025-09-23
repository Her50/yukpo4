import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MessageCircle, Search, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface Chat {
    id: string;
    serviceId: string;
    serviceTitle: string;
    prestataireName: string;
    prestataireAvatar?: string;
    lastMessage: string;
    lastMessageTime: Date;
    unreadCount: number;
    isActive: boolean;
    status: 'online' | 'offline' | 'away';
}

interface IntegratedChatManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onChatSelect: (chatId: string) => void;
}

const IntegratedChatManager: React.FC<IntegratedChatManagerProps> = ({
    isOpen,
    onClose,
    onChatSelect
}) => {
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
    const [chats, setChats] = useState<Chat[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadChats();
        }
    }, [isOpen]);

    const loadChats = async () => {
        setLoading(true);
        try {
            // Charger les chats depuis l'API
            const response = await fetch('/api/chats/history', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                setChats(data.chats || []);
            } else {
                // Si pas de chats, laisser la liste vide
                setChats([]);
            }
        } catch (error) {
            console.error('Erreur chargement chats:', error);
            setChats([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredChats = chats.filter(chat => {
        const matchesSearch = chat.serviceTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
            chat.prestataireName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all' || chat.status === filterStatus;
        const matchesTab = activeTab === 'active' ? chat.isActive : !chat.isActive;

        return matchesSearch && matchesStatus && matchesTab;
    });

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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'online': return 'bg-green-500';
            case 'away': return 'bg-yellow-500';
            case 'offline': return 'bg-gray-400';
            default: return 'bg-gray-400';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden">
                <CardHeader className="border-b">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <MessageCircle className="h-5 w-5" />
                            Conversations
                        </CardTitle>
                        <Button variant="outline" onClick={onClose}>
                            ✕
                        </Button>
                    </div>

                    {/* Onglets */}
                    <div className="flex gap-2 mt-4">
                        <Button
                            variant={activeTab === 'active' ? 'default' : 'outline'}
                            onClick={() => setActiveTab('active')}
                            className="flex items-center gap-2"
                        >
                            <Users className="h-4 w-4" />
                            Chats actifs
                        </Button>
                        <Button
                            variant={activeTab === 'history' ? 'default' : 'outline'}
                            onClick={() => setActiveTab('history')}
                            className="flex items-center gap-2"
                        >
                            <Clock className="h-4 w-4" />
                            Historique
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {/* Barre de recherche et filtres */}
                    <div className="p-4 border-b bg-gray-50">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Rechercher une conversation..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value as any)}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">Tous les statuts</option>
                                <option value="online">En ligne</option>
                                <option value="away">Absent</option>
                                <option value="offline">Hors ligne</option>
                            </select>
                        </div>
                    </div>

                    {/* Liste des chats */}
                    <div className="max-h-96 overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                <p className="text-gray-600 mt-2">Chargement des conversations...</p>
                            </div>
                        ) : filteredChats.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p>Aucune conversation trouvée</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {filteredChats.map((chat) => (
                                    <div
                                        key={chat.id}
                                        onClick={() => onChatSelect(chat.id)}
                                        className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <Avatar className="w-12 h-12">
                                                    <AvatarImage src={chat.prestataireAvatar} />
                                                    <AvatarFallback className="bg-blue-500 text-white">
                                                        {chat.prestataireName.charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(chat.status)}`}></div>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <h3 className="font-semibold text-gray-900 truncate">
                                                        {chat.serviceTitle}
                                                    </h3>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-500">
                                                            {formatTime(chat.lastMessageTime)}
                                                        </span>
                                                        {chat.unreadCount > 0 && (
                                                            <Badge className="bg-blue-500 text-white text-xs">
                                                                {chat.unreadCount}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm text-gray-600 truncate">
                                                        <span className="font-medium">{chat.prestataireName}:</span> {chat.lastMessage}
                                                    </p>
                                                    {chat.isActive && (
                                                        <Badge className="bg-green-100 text-green-800 text-xs">
                                                            Actif
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default IntegratedChatManager;
