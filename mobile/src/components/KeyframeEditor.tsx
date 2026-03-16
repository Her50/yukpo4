// ✅ NOUVEAU Phase 2: Éditeur de keyframes pour animations

import React, { useState } from 'react';
import {
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { EasingType, Keyframe } from '../types/AdvancedTimeline';
import { NativeButton } from './SafeNativeDesign';
import { SafeIcon } from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface KeyframeEditorProps {
    visible: boolean;
    keyframes: Keyframe[];
    propertyName: string;
    onClose: () => void;
    onSave: (keyframes: Keyframe[]) => void;
    onDelete?: (index: number) => void;
}

const EASING_TYPES: EasingType[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'bezier'];

export const KeyframeEditor: React.FC<KeyframeEditorProps> = ({
    visible,
    keyframes: initialKeyframes,
    propertyName,
    onClose,
    onSave,
    onDelete,
}) => {
        const { t } = useLanguageSafe();
const [keyframes, setKeyframes] = useState<Keyframe[]>(initialKeyframes);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    const handleAddKeyframe = () => {
        const newKeyframe: Keyframe = {
            time: 0,
            value: 0,
            easing: 'linear',
            interpolation: 'linear',
        };
        setKeyframes([...keyframes, newKeyframe].sort((a, b) => a.time - b.time));
        setEditingIndex(keyframes.length);
    };

    const handleUpdateKeyframe = (index: number, updates: Partial<Keyframe>) => {
        const updated = [...keyframes];
        updated[index] = { ...updated[index], ...updates };
        setKeyframes(updated.sort((a, b) => a.time - b.time));
    };

    const handleDeleteKeyframe = (index: number) => {
        if (onDelete) {
            onDelete(index);
        } else {
            const updated = keyframes.filter((_, i) => i !== index);
            setKeyframes(updated);
        }
    };

    const handleSave = () => {
        onSave(keyframes);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>
                            Éditeur de Keyframes - {propertyName}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Liste des keyframes */}
                    <ScrollView style={styles.keyframesList} showsVerticalScrollIndicator={false}>
                        {keyframes.map((keyframe, index) => (
                            <View key={index} style={styles.keyframeItem}>
                                <View style={styles.keyframeHeader}>
                                    <Text style={styles.keyframeLabel}>
                                        Keyframe {index + 1}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => handleDeleteKeyframe(index)}
                                        style={styles.deleteButton}
                                    >
                                        <SafeIcon name="trash-2" size={18} color={modernColors.error} />
                                    </TouchableOpacity>
                                </View>

                                {/* Temps */}
                                <View style={styles.inputRow}>
                                    <Text style={styles.inputLabel}>Temps (s):</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={keyframe.time.toString()}
                                        onChangeText={(text) => {
                                            const time = parseFloat(text) || 0;
                                            handleUpdateKeyframe(index, { time });
                                        }}
                                        keyboardType="numeric"
                                        placeholder="0.0"
                                    />
                                </View>

                                {/* Valeur */}
                                <View style={styles.inputRow}>
                                    <Text style={styles.inputLabel}>Valeur:</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={
                                            typeof keyframe.value === 'number'
                                                ? keyframe.value.toString()
                                                : JSON.stringify(keyframe.value)
                                        }
                                        onChangeText={(text) => {
                                            const numValue = parseFloat(text);
                                            if (!isNaN(numValue)) {
                                                handleUpdateKeyframe(index, { value: numValue });
                                            }
                                        }}
                                        keyboardType="numeric"
                                        placeholder="0"
                                    />
                                </View>

                                {/* Easing */}
                                <View style={styles.inputRow}>
                                    <Text style={styles.inputLabel}>Easing:</Text>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        style={styles.easingContainer}
                                    >
                                        {EASING_TYPES.map((easing) => (
                                            <TouchableOpacity
                                                key={easing}
                                                style={[
                                                    styles.easingButton,
                                                    keyframe.easing === easing && styles.easingButtonActive,
                                                ]}
                                                onPress={() => handleUpdateKeyframe(index, { easing })}
                                            >
                                                <Text
                                                    style={[
                                                        styles.easingText,
                                                        keyframe.easing === easing && styles.easingTextActive,
                                                    ]}
                                                >
                                                    {easing}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>
                        ))}

                        {keyframes.length === 0 && (
                            <View style={styles.emptyState}>
                                <SafeIcon name="keyframe" size={48} color={modernColors.textSecondary} />
                                <Text style={styles.emptyText}>
                                    Aucun keyframe. Ajoutez-en un pour commencer.
                                </Text>
                            </View>
                        )}
                    </ScrollView>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <NativeButton
                            title={t('keyframeEditor.ajouterKeyframe')}
                            onPress={handleAddKeyframe}
                            variant="outline"
                            style={styles.addButton}
                        />
                        <NativeButton
                            title={t('keyframeEditor.enregistrer')}
                            onPress={handleSave}
                            variant="primary"
                            style={styles.saveButton}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    closeButton: {
        padding: 4,
    },
    keyframesList: {
        flex: 1,
        padding: 16,
    },
    keyframeItem: {
        backgroundColor: modernColors.background,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    keyframeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    keyframeLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    deleteButton: {
        padding: 4,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    inputLabel: {
        fontSize: 13,
        color: modernColors.textSecondary,
        width: 100,
    },
    input: {
        flex: 1,
        backgroundColor: modernColors.surface,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 14,
        color: modernColors.text,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    easingContainer: {
        flex: 1,
        flexDirection: 'row',
    },
    easingButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: modernColors.surface,
        marginRight: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    easingButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    easingText: {
        fontSize: 12,
        color: modernColors.text,
    },
    easingTextActive: {
        color: modernColors.surface,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 12,
        textAlign: 'center',
    },
    actions: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingTop: 16,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    addButton: {
        flex: 1,
    },
    saveButton: {
        flex: 1,
    },
});

