import { Camera, FileText, Image, Music, Plus, Video } from 'phosphor-react-native';
import React, { useState } from 'react';
import ReactNative from 'react-native';
import { Button, Card, IconButton } from 'react-native-paper';
import { theme } from '../theme/theme';

const { StyleSheet, Text, TouchableOpacity, View, ScrollView, Alert } = ReactNative;

interface MediaManagerProps {
    mediaFiles: {
        images: string[];
        audios: string[];
        videos: string[];
        documents: string[];
        excel: string[];
        logo: string[];
        banner: string[];
    };
    onMediaChange: (mediaFiles: any) => void;
    compact?: boolean;
}

const MediaManager: React.FC<MediaManagerProps> = ({ mediaFiles, onMediaChange, compact = false }) => {
    const [activeTab, setActiveTab] = useState<'general' | 'branding'>('general');

    const addMedia = (type: string) => {
        // TODO: Implémenter la sélection de fichiers réelle
        Alert.alert('Ajouter média', `Fonctionnalité d'ajout de ${type} à implémenter`);
    };

    const removeMedia = (type: string, index: number) => {
        const newMedia = { ...mediaFiles };
        newMedia[type as keyof typeof mediaFiles] = newMedia[type as keyof typeof mediaFiles].filter((_, i) => i !== index);
        onMediaChange(newMedia);
    };

    const renderMediaItem = (item: string, type: string, index: number) => {
        const getIcon = () => {
            switch (type) {
                case 'images': return <Image size={24} color={theme.colors.primary} />;
                case 'videos': return <Video size={24} color={theme.colors.primary} />;
                case 'audios': return <Music size={24} color={theme.colors.primary} />;
                case 'documents': return <FileText size={24} color={theme.colors.primary} />;
                default: return <FileText size={24} color={theme.colors.primary} />;
            }
        };

        return (
            <View key={index} style={styles.mediaItem}>
                {getIcon()}
                <Text style={styles.mediaName} numberOfLines={1}>
                    {type === 'images' ? `Image ${index + 1}` :
                        type === 'videos' ? `Vidéo ${index + 1}` :
                            type === 'audios' ? `Audio ${index + 1}` :
                                `Document ${index + 1}`}
                </Text>
                <IconButton
                    icon="close"
                    size={16}
                    onPress={() => removeMedia(type, index)}
                    iconColor={theme.colors.error}
                />
            </View>
        );
    };

    const tabs = [
        { key: 'images', label: 'Images', icon: <Image size={16} /> },
        { key: 'videos', label: 'Vidéos', icon: <Video size={16} /> },
        { key: 'audios', label: 'Audios', icon: <Music size={16} /> },
        { key: 'documents', label: 'Documents', icon: <FileText size={16} /> },
    ];

    if (compact) {
        const totalMedia = Object.values(mediaFiles).flat().length;
        return (
            <TouchableOpacity style={styles.compactContainer}>
                <Camera size={20} color={theme.colors.primary} />
                <Text style={styles.compactText}>{totalMedia} médias</Text>
            </TouchableOpacity>
        );
    }

    return (
        <Card style={styles.container}>
            <Card.Content>
                <Text style={styles.title}>Gestion des médias</Text>

                {/* Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
                    {tabs.map(tab => (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
                            onPress={() => setActiveTab(tab.key)}
                        >
                            {tab.icon}
                            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Media List */}
                <View style={styles.mediaList}>
                    {mediaFiles[activeTab as keyof typeof mediaFiles]?.map((item, index) =>
                        renderMediaItem(item, activeTab, index)
                    )}

                    {(!mediaFiles[activeTab as keyof typeof mediaFiles] ||
                        mediaFiles[activeTab as keyof typeof mediaFiles].length === 0) && (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>Aucun {activeTab} ajouté</Text>
                            </View>
                        )}
                </View>

                {/* Add Button */}
                <Button
                    mode="outlined"
                    onPress={() => addMedia(activeTab)}
                    style={styles.addButton}
                    icon={() => <Plus size={16} color={theme.colors.primary} />}
                >
                    Ajouter {activeTab}
                </Button>
            </Card.Content>
        </Card>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 16,
    },
    tabsContainer: {
        marginBottom: 16,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: 'white',
    },
    activeTab: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    tabText: {
        fontSize: 14,
        color: theme.colors.text,
        marginLeft: 4,
    },
    activeTabText: {
        color: 'white',
        fontWeight: '600',
    },
    mediaList: {
        minHeight: 100,
        marginBottom: 16,
    },
    mediaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        marginBottom: 8,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
    },
    mediaName: {
        flex: 1,
        fontSize: 14,
        color: theme.colors.text,
        marginLeft: 8,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    emptyText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        fontStyle: 'italic',
    },
    addButton: {
        borderColor: theme.colors.primary,
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

export default MediaManager;


