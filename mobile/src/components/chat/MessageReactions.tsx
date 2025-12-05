import React, { useState } from 'react';
import {
    Animated,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

interface Reaction {
    emoji: string;
    count: number;
    users: Array<{ id: number; name: string; avatar?: string }>;
}

interface MessageReactionsProps {
    messageId: string;
    reactions: Reaction[];
    currentUserId: number;
    onAddReaction: (messageId: string, emoji: string) => void;
    onRemoveReaction: (messageId: string, emoji: string) => void;
}

const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

const MessageReactions: React.FC<MessageReactionsProps> = ({
    messageId,
    reactions,
    currentUserId,
    onAddReaction,
    onRemoveReaction,
}) => {
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [showReactionDetails, setShowReactionDetails] = useState(false);
    const [selectedReaction, setSelectedReaction] = useState<Reaction | null>(null);
    const scaleAnim = new Animated.Value(1);

    const handleReactionPress = (emoji: string) => {
        const existingReaction = reactions.find(r => r.emoji === emoji);
        const userReacted = existingReaction?.users.some(u => u.id === currentUserId);

        // Animation de feedback
        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 1.3,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();

        if (userReacted) {
            onRemoveReaction(messageId, emoji);
        } else {
            onAddReaction(messageId, emoji);
        }
        setShowReactionPicker(false);
    };

    const handleReactionLongPress = (reaction: Reaction) => {
        setSelectedReaction(reaction);
        setShowReactionDetails(true);
    };

    const userHasReacted = (emoji: string) => {
        const reaction = reactions.find(r => r.emoji === emoji);
        return reaction?.users.some(u => u.id === currentUserId) || false;
    };

    if (reactions.length === 0) {
        return (
            <TouchableOpacity
                style={styles.addReactionButton}
                onPress={() => setShowReactionPicker(true)}
                onLongPress={() => setShowReactionPicker(true)}
            >
                <SafeIcon name="smile" size={14} color={modernColors.textSecondary} />
            </TouchableOpacity>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.reactionsContainer}>
                {reactions.map((reaction, index) => {
                    const isUserReaction = userHasReacted(reaction.emoji);
                    return (
                        <TouchableOpacity
                            key={`${reaction.emoji}-${index}`}
                            style={[
                                styles.reactionBubble,
                                isUserReaction && styles.reactionBubbleActive,
                            ]}
                            onPress={() => handleReactionPress(reaction.emoji)}
                            onLongPress={() => handleReactionLongPress(reaction)}
                        >
                            <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                            <Text
                                style={[
                                    styles.reactionCount,
                                    isUserReaction && styles.reactionCountActive,
                                ]}
                            >
                                {reaction.count}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
                <TouchableOpacity
                    style={styles.addReactionButton}
                    onPress={() => setShowReactionPicker(true)}
                >
                    <SafeIcon name="plus" size={14} color={modernColors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Picker de réactions rapides */}
            <Modal
                visible={showReactionPicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowReactionPicker(false)}
            >
                <TouchableOpacity
                    style={styles.pickerOverlay}
                    activeOpacity={1}
                    onPress={() => setShowReactionPicker(false)}
                >
                    <View style={styles.pickerContainer}>
                        <View style={styles.pickerContent}>
                            {QUICK_REACTIONS.map((emoji) => (
                                <TouchableOpacity
                                    key={emoji}
                                    style={styles.pickerEmojiButton}
                                    onPress={() => handleReactionPress(emoji)}
                                >
                                    <Animated.Text
                                        style={[
                                            styles.pickerEmoji,
                                            { transform: [{ scale: scaleAnim }] },
                                        ]}
                                    >
                                        {emoji}
                                    </Animated.Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Détails d'une réaction */}
            <Modal
                visible={showReactionDetails}
                transparent
                animationType="slide"
                onRequestClose={() => setShowReactionDetails(false)}
            >
                <View style={styles.detailsOverlay}>
                    <View style={styles.detailsContainer}>
                        <View style={styles.detailsHeader}>
                            <Text style={styles.detailsEmoji}>
                                {selectedReaction?.emoji}
                            </Text>
                            <Text style={styles.detailsTitle}>
                                {selectedReaction?.count} réaction{selectedReaction && selectedReaction.count > 1 ? 's' : ''}
                            </Text>
                            <TouchableOpacity
                                style={styles.detailsCloseButton}
                                onPress={() => setShowReactionDetails(false)}
                            >
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.detailsList}>
                            {selectedReaction?.users.map((user) => (
                                <View key={user.id} style={styles.detailsUserItem}>
                                    <View style={styles.detailsUserAvatar}>
                                        {user.avatar ? (
                                            <Text>Avatar</Text>
                                        ) : (
                                            <Text style={styles.detailsUserInitial}>
                                                {user.name.charAt(0).toUpperCase()}
                                            </Text>
                                        )}
                                    </View>
                                    <Text style={styles.detailsUserName}>{user.name}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 4,
    },
    reactionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        alignItems: 'center',
    },
    reactionBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
        borderWidth: 1,
        borderColor: modernColors.border,
        gap: 4,
    },
    reactionBubbleActive: {
        backgroundColor: modernColors.primary + '20',
        borderColor: modernColors.primary,
    },
    reactionEmoji: {
        fontSize: 14,
    },
    reactionCount: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    reactionCountActive: {
        color: modernColors.primary,
    },
    addReactionButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    pickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickerContainer: {
        backgroundColor: modernColors.surface,
        borderRadius: 24,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    pickerContent: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 8,
    },
    pickerEmojiButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.surfaceVariant,
    },
    pickerEmoji: {
        fontSize: 28,
    },
    detailsOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    detailsContainer: {
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '60%',
        paddingBottom: 20,
    },
    detailsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        gap: 12,
    },
    detailsEmoji: {
        fontSize: 32,
    },
    detailsTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    detailsCloseButton: {
        padding: 4,
    },
    detailsList: {
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    detailsUserItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 12,
    },
    detailsUserAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailsUserInitial: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    detailsUserName: {
        fontSize: 16,
        fontWeight: '500',
        color: modernColors.text,
    },
});

export default MessageReactions;

