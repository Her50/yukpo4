// ✅ NOUVEAU Phase 2.4: Composant pour afficher les collaborateurs et leurs curseurs

import React from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { CollaborationCursor, Collaborator } from '../types/Collaboration';
import { SafeIcon } from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface CollaborationIndicatorProps {
    collaborators: Collaborator[];
    cursors?: Map<string, CollaborationCursor>;
    isConnected: boolean;
    maxVisible?: number;
}

export const CollaborationIndicator: React.FC<CollaborationIndicatorProps> = ({
    collaborators,
    cursors,
    isConnected,
    maxVisible = 5,
}) => {
    const visibleCollaborators = collaborators.slice(0, maxVisible);
    const remainingCount = Math.max(0, collaborators.length - maxVisible);

    const renderCollaborator = ({ item }: { item: Collaborator }) => {
        const cursor = cursors?.get(item.userId);

        return (
            <View style={styles.collaboratorItem}>
                <View
                    style={[
                        styles.avatar,
                        { backgroundColor: item.color || modernColors.primary },
                    ]}
                >
                    <Text style={styles.avatarText}>
                        {item.username.charAt(0).toUpperCase()}
                    </Text>
                </View>
                <View style={styles.info}>
                    <Text style={styles.username} numberOfLines={1}>
                        {item.username}
                    </Text>
                    {item.isActive && (
                        <View style={styles.activeIndicator}>
                            <View style={styles.activeDot} />
                            <Text style={styles.activeText}>{t('collaborationIndicator.enLigne')}/Text>
                        </View>
                    )}
                </View>
                {cursor && (
                    <View style={styles.cursorIndicator}>
                        <SafeIcon name="mouse-pointer" size={16} color={item.color} />
                    </View>
                )}
            </View>
        );
    };

    if (!isConnected || collaborators.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <SafeIcon name="users" size={16} color={modernColors.textSecondary} />
                <Text style={styles.headerText}>
                    {collaborators.length} {collaborators.length > 1 ? 'collaborateurs' : 'collaborateur'}
                </Text>
            </View>

            <FlatList
                data={visibleCollaborators}
                renderItem={renderCollaborator}
                keyExtractor={(item) => item.userId}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
            />

            {remainingCount > 0 && (
                <View style={styles.moreIndicator}>
                    <Text style={styles.moreText}>+{remainingCount}</Text>
                </View>
            )}

            {!isConnected && (
                <View style={styles.disconnectedIndicator}>
                    <View style={styles.disconnectedDot} />
                    <Text style={styles.disconnectedText}>{t('collaborationIndicator.deconnecte')}</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: modernColors.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 8,
    },
    headerText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginLeft: 4,
        fontWeight: '500',
    },
    listContent: {
        gap: 8,
    },
    collaboratorItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 8,
    },
    avatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
    },
    avatarText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.surface,
    },
    info: {
        marginRight: 4,
    },
    username: {
        fontSize: 11,
        color: modernColors.text,
        fontWeight: '500',
        maxWidth: 80,
    },
    activeIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: modernColors.success,
        marginRight: 4,
    },
    activeText: {
        fontSize: 9,
        color: modernColors.textSecondary,
    },
    cursorIndicator: {
        marginLeft: 4,
    },
    moreIndicator: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: modernColors.background,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    moreText: {
        fontSize: 10,
        color: modernColors.textSecondary,
        fontWeight: '600',
    },
    disconnectedIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: modernColors.error + '20',
        borderRadius: 12,
    },
    disconnectedDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: modernColors.error,
        marginRight: 4,
    },
    disconnectedText: {
        fontSize: 10,
        color: modernColors.error,
        fontWeight: '500',
    },
});

