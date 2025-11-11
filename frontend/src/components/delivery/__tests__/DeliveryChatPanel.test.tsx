import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryChatPanel } from '../DeliveryChatPanel';

const toastError = vi.fn();

vi.mock('react-hot-toast', () => ({
    toast: {
        error: (...args: unknown[]) => toastError(...args),
    },
}));

const ensureChatChannel = vi.fn();
const getChatMessages = vi.fn();
const isChatTyping = vi.fn();
const isChatConnected = vi.fn();
const sendChatMessage = vi.fn();
const notifyChatTyping = vi.fn();

vi.mock('@/context/DeliveryContext', () => ({
    useDeliveryContext: () => ({
        ensureChatChannel,
        getChatMessages,
        isChatTyping,
        isChatConnected,
        sendChatMessage,
        notifyChatTyping,
    }),
}));

afterEach(() => {
    vi.clearAllMocks();
    toastError.mockClear();
});

beforeEach(() => {
    ensureChatChannel.mockImplementation(() => { });
    getChatMessages.mockReturnValue([]);
    isChatTyping.mockReturnValue(false);
    isChatConnected.mockReturnValue(true);
    sendChatMessage.mockResolvedValue({ success: true, messageId: 'uuid-1' });
    notifyChatTyping.mockImplementation(() => { });
});

describe('DeliveryChatPanel', () => {
    it('affiche les informations de participants et l’état connecté', () => {
        render(
            <DeliveryChatPanel
                deliveryId="delivery-1"
                courierName="Coursier Pro"
                recipientName="Destinataire Premium"
            />,
        );

        expect(ensureChatChannel).toHaveBeenCalledWith('delivery-1');
        expect(screen.getByText('Chat livraison')).toBeInTheDocument();
        expect(
            screen.getByText('Canal sécurisé client ↔ coursier ↔ destinataire'),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Coursier : Coursier Pro • Destinataire : Destinataire Premium'),
        ).toBeInTheDocument();
    });

    it("affiche l'indicateur de frappe", () => {
        isChatTyping.mockReturnValue(true);
        render(<DeliveryChatPanel deliveryId="delivery-typing" />);

        expect(screen.getByText('Le coursier est en train d’écrire…')).toBeInTheDocument();
    });

    it('envoie un message via le DeliveryContext', async () => {
        render(<DeliveryChatPanel deliveryId="delivery-send" courierName="Coursier" />);

        const input = screen.getByPlaceholderText('Envoyer un message au coursier…');
        fireEvent.change(input, { target: { value: 'Bonjour le coursier' } });
        fireEvent.click(screen.getByText('Envoyer'));

        await act(async () => { });

        expect(sendChatMessage).toHaveBeenCalledWith('delivery-send', 'Bonjour le coursier');
    });

    it("affiche une alerte si l'envoi échoue", async () => {
        sendChatMessage.mockResolvedValueOnce({ success: false, messageId: 'uuid-2' });
        render(<DeliveryChatPanel deliveryId="delivery-error" />);

        const input = screen.getByPlaceholderText('Envoyer un message au coursier…');
        fireEvent.change(input, { target: { value: 'Test échec' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await act(async () => { });

        expect(toastError).toHaveBeenCalledWith("Impossible d'envoyer le message");
    });

    it('affiche les messages provenant du contexte', () => {
        const now = new Date().toISOString();
        getChatMessages.mockReturnValue([
            { id: '1', author: 'courier', content: 'Je suis en route', timestamp: now, status: 'delivered' },
        ]);

        render(<DeliveryChatPanel deliveryId="delivery-incoming" recipientName="Destinataire" />);

        expect(screen.getByText('Je suis en route')).toBeInTheDocument();
        expect(screen.getByText(/Livré$/)).toBeInTheDocument();
    });
});

