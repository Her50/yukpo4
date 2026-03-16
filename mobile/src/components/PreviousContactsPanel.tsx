import { Clock, Envelope, MapPin, Phone, User } from 'phosphor-react-native';
import React from 'react';
import ReactNative from 'react-native';
import { Card } from 'react-native-paper';
import { theme } from '../theme/theme';
import { useLanguageSafe } from '../contexts/LanguageContext';

const { StyleSheet, Text, View, TouchableOpacity, ScrollView } = ReactNative;

interface ContactInfo {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    lastUsed: string;
    serviceType?: string;
}

interface PreviousContactsPanelProps {
    contacts: ContactInfo[];
    onContactSelect: (contact: ContactInfo) => void;
    loading?: boolean;
    compact?: boolean;
}

const PreviousContactsPanel: React.FC<PreviousContactsPanelProps> = ({
    contacts,
    onContactSelect,
    loading = false,
    compact = false
}) => {
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const renderContact = (contact: ContactInfo) => (
        <TouchableOpacity
            key={contact.id}
            style={styles.contactItem}
            onPress={() => onContactSelect(contact)}
        >
            <View style={styles.contactHeader}>
                <View style={styles.contactIcon}>
                    <User size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    {contact.serviceType && (
                        <Text style={styles.contactServiceType}>{contact.serviceType}</Text>
                    )}
                </View>
                <View style={styles.contactDate}>
                    <Clock size={14} color={theme.colors.textSecondary} />
                    <Text style={styles.contactDateText}>
                        {formatDate(contact.lastUsed)}
                    </Text>
                </View>
            </View>

            <View style={styles.contactDetails}>
                {contact.email && (
                    <View style={styles.contactDetail}>
                        <Envelope size={14} color={theme.colors.textSecondary} />
                        <Text style={styles.contactDetailText}>{contact.email}</Text>
                    </View>
                )}

                {contact.phone && (
                    <View style={styles.contactDetail}>
                        <Phone size={14} color={theme.colors.textSecondary} />
                        <Text style={styles.contactDetailText}>{contact.phone}</Text>
                    </View>
                )}

                {contact.address && (
                    <View style={styles.contactDetail}>
                        <MapPin size={14} color={theme.colors.textSecondary} />
                        <Text style={styles.contactDetailText} numberOfLines={1}>
                            {contact.address}
                        </Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    if (compact) {
        return (
            <View style={styles.compactContainer}>
                <User size={16} color={theme.colors.primary} />
                <Text style={styles.compactText}>
                    {contacts.length} contact(s) précédent(s)
                </Text>
            </View>
        );
    }

    return (
        <Card style={styles.container}>
            <Card.Content>
                <View style={styles.header}>
                    <User size={24} color={theme.colors.primary} />
                    <Text style={styles.title}>{t('previousContactsPanel.contactsPrecedents')}</Text>
                </View>

                <Text style={styles.description}>
                    Sélectionnez un contact précédent pour remplir automatiquement les informations
                </Text>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>{t('previousContactsPanel.chargementDesContacts')}</Text>
                    </View>
                ) : contacts.length > 0 ? (
                    <ScrollView style={styles.contactsList} showsVerticalScrollIndicator={false}>
                        {contacts.map(renderContact)}
                    </ScrollView>
                ) : (
                    <View style={styles.emptyState}>
                        <User size={48} color="#E0E0E0" />
                        <Text style={styles.emptyText}>{t('previousContactsPanel.aucunContactPrecedent')}</Text>
                        <Text style={styles.emptySubtext}>
                            Vos contacts seront sauvegardés ici pour une utilisation future
                        </Text>
                    </View>
                )}
            </Card.Content>
        </Card>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
        backgroundColor: 'white',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginLeft: 8,
    },
    description: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginBottom: 16,
        fontStyle: 'italic',
    },
    contactsList: {
        maxHeight: 300,
    },
    contactItem: {
        padding: 12,
        marginBottom: 8,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: theme.colors.primary,
    },
    contactHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    contactIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: `${theme.colors.primary}15`,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    contactInfo: {
        flex: 1,
    },
    contactName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    contactServiceType: {
        fontSize: 12,
        color: theme.colors.primary,
        marginTop: 2,
    },
    contactDate: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    contactDateText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginLeft: 4,
    },
    contactDetails: {
        gap: 4,
    },
    contactDetail: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    contactDetailText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginLeft: 6,
        flex: 1,
    },
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    loadingText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        fontStyle: 'italic',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    emptyText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        marginTop: 12,
        marginBottom: 4,
    },
    emptySubtext: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
    },
    compactContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
    },
    compactText: {
        fontSize: 12,
        color: theme.colors.text,
        marginLeft: 4,
    },
});

export default PreviousContactsPanel;


