import { Button } from '@/components/ui/buttons/Button';
import { Input } from '@/components/ui/input';
import { useDeliveryContext } from '@/context/DeliveryContext';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

type ChatAuthor = 'client' | 'courier' | 'recipient' | 'system';

interface ChatMessage {
    id: string;
    author: ChatAuthor;
    content: string;
    timestamp: string;
    status: 'pending' | 'sent' | 'delivered' | 'error';
}

interface DeliveryChatPanelProps {
    deliveryId: string;
    courierName?: string | null;
    recipientName?: string | null;
}

export const DeliveryChatPanel: React.FC<DeliveryChatPanelProps> = ({
    deliveryId,
    courierName,
    recipientName,
}) => {
    const {
        ensureChatChannel,
        getChatMessages,
        isChatTyping,
        isChatConnected,
        sendChatMessage,
        notifyChatTyping,
    } = useDeliveryContext();
    const [input, setInput] = useState('');
    const [localError, setLocalError] = useState<string | null>(null);

    useEffect(() => {
        ensureChatChannel(deliveryId);
    }, [deliveryId, ensureChatChannel]);

    const messages = useMemo(
        () =>
            getChatMessages(deliveryId).map(message => ({
                id: message.id,
                author: message.author as ChatAuthor,
                content: message.content,
                timestamp: message.timestamp,
                status: message.status,
            })),
        [deliveryId, getChatMessages],
    );

    const typing = isChatTyping(deliveryId);
    const connected = isChatConnected(deliveryId);

    useEffect(() => {
        if (localError) {
            toast.error(localError);
            setLocalError(null);
        }
    }, [localError]);

    const handleSendMessage = useCallback(async () => {
        if (!input.trim()) return;
        const content = input.trim();
        setInput('');
        const { success } = await sendChatMessage(deliveryId, content);
        if (!success) {
            setLocalError("Impossible d'envoyer le message");
        }
    }, [deliveryId, input, sendChatMessage]);

    const handleTyping = useCallback(
        (value: string) => {
            setInput(value);
            notifyChatTyping(deliveryId);
        },
        [deliveryId, notifyChatTyping],
    );

    const headerSubtitle = useMemo(() => {
        if (typing) {
            return 'Le coursier est en train d’écrire…';
        }
        if (!connected) {
            return 'Connexion en cours au chat temps réel…';
        }
        return 'Canal sécurisé client ↔ coursier ↔ destinataire';
    }, [connected, typing]);

    const participants = useMemo(() => {
        const items = [];
        if (courierName) {
            items.push(`Coursier : ${courierName}`);
        }
        if (recipientName) {
            items.push(`Destinataire : ${recipientName}`);
        }
        return items.join(' • ');
    }, [courierName, recipientName]);

    return (
        <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Chat livraison</p>
                <p className="text-xs text-slate-500">{headerSubtitle}</p>
                {participants ? (
                    <p className="mt-1 text-xs text-slate-400">{participants}</p>
                ) : null}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages.length === 0 ? (
                    <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        Aucun échange pour l’instant. Démarrez la conversation pour coordonner la
                        livraison en temps réel.
                    </div>
                ) : (
                    messages.map(message => (
                        <ChatBubble key={message.id} message={message} />
                    ))
                )}
            </div>

            <div className="border-t border-slate-100 px-4 py-3">
                <div className="flex items-center gap-3">
                    <Input
                        placeholder="Envoyer un message au coursier…"
                        value={input}
                        onChange={event => handleTyping(event.target.value)}
                        onKeyDown={event => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                handleSendMessage();
                            }
                        }}
                    />
                    <Button onClick={handleSendMessage} disabled={!input.trim()}>
                        Envoyer
                    </Button>
                </div>
            </div>
        </div>
    );
};

const ChatBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const isClient = message.author === 'client';
    const alignment = isClient ? 'items-end text-right' : 'items-start text-left';
    const bubbleClasses = isClient
        ? 'bg-indigo-600 text-white'
        : message.author === 'system'
            ? 'bg-slate-200 text-slate-700'
            : 'bg-slate-100 text-slate-800';

    return (
        <div className={`flex flex-col ${alignment} gap-1`}>
            <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${bubbleClasses}`}
            >
                {message.content}
            </div>
            <span className="text-xs text-slate-400">
                {new Date(message.timestamp).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                })}{' '}
                ·{' '}
                {message.status === 'pending'
                    ? 'En cours…'
                    : message.status === 'error'
                        ? 'Erreur d’envoi'
                        : 'Livré'}
            </span>
        </div>
    );
};

export default DeliveryChatPanel;

