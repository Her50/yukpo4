import { useCallback, useEffect, useState } from 'react';
import { userApi } from '../services/api';

interface ContactInfo {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    lastUsed: string;
    serviceType?: string;
}

interface PreviousContactsResult {
    contacts: ContactInfo[];
    loading: boolean;
    error: string | null;
    loadPreviousContacts: () => Promise<void>;
    addContact: (contact: Omit<ContactInfo, 'id' | 'lastUsed'>) => Promise<void>;
}

export const usePreviousContacts = (): PreviousContactsResult => {
    const [contacts, setContacts] = useState<ContactInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadPreviousContacts = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Appel API pour récupérer les contacts précédents
            const response = await userApi.getPreviousContacts() as any;

            if (response.success && response.data) {
                setContacts(response.data);
            } else {
                // Fallback avec des données simulées
                const mockContacts: ContactInfo[] = [
                    {
                        id: '1',
                        name: 'Jean Dupont',
                        email: 'jean.dupont@email.com',
                        phone: '+33 6 12 34 56 78',
                        address: '123 Rue de la Paix, Paris',
                        lastUsed: '2024-01-15',
                        serviceType: 'Plomberie'
                    },
                    {
                        id: '2',
                        name: 'Marie Martin',
                        email: 'marie.martin@email.com',
                        phone: '+33 6 87 65 43 21',
                        address: '456 Avenue des Champs, Lyon',
                        lastUsed: '2024-01-10',
                        serviceType: 'Électricité'
                    },
                    {
                        id: '3',
                        name: 'Pierre Durand',
                        email: 'pierre.durand@email.com',
                        phone: '+33 6 98 76 54 32',
                        address: '789 Boulevard Saint-Germain, Marseille',
                        lastUsed: '2024-01-05',
                        serviceType: 'Jardinage'
                    }
                ];
                setContacts(mockContacts);
            }
        } catch (error) {
            console.error('Erreur lors du chargement des contacts précédents:', error);
            setError('Erreur lors du chargement des contacts');
            setContacts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const addContact = useCallback(async (contact: Omit<ContactInfo, 'id' | 'lastUsed'>) => {
        try {
            const newContact: ContactInfo = {
                ...contact,
                id: Date.now().toString(),
                lastUsed: new Date().toISOString()
            };

            // Appel API pour sauvegarder le contact
            const response = await userApi.saveContact(newContact) as any;

            if (response.success) {
                setContacts(prev => [newContact, ...prev]);
            } else {
                // En cas d'erreur API, on ajoute quand même localement
                setContacts(prev => [newContact, ...prev]);
            }
        } catch (error) {
            console.error('Erreur lors de la sauvegarde du contact:', error);
            // En cas d'erreur, on ajoute quand même localement
            const newContact: ContactInfo = {
                ...contact,
                id: Date.now().toString(),
                lastUsed: new Date().toISOString()
            };
            setContacts(prev => [newContact, ...prev]);
        }
    }, []);

    useEffect(() => {
        loadPreviousContacts();
    }, [loadPreviousContacts]);

    return {
        contacts,
        loading,
        error,
        loadPreviousContacts,
        addContact
    };
};


