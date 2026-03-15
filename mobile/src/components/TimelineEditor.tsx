// ✅ NOUVEAU: Composant d'édition manuelle de timeline

import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeInput } from './SafeNativeDesign';
import { SafeIcon } from './SafeIcon';
import { TimelineScene, VideoTimeline } from './TimelinePreview';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface TimelineEditorProps {
    timeline: VideoTimeline;
    onSave: (timeline: VideoTimeline) => void;
    onCancel: () => void;
}

export const TimelineEditor: React.FC<TimelineEditorProps> = ({
    timeline,
    onSave,
    onCancel,
}) => {
    const [editedTimeline, setEditedTimeline] = useState<VideoTimeline>(timeline);
    const [editingSceneIndex, setEditingSceneIndex] = useState<number | null>(null);

    const updateScene = (index: number, updates: Partial<TimelineScene>) => {
        const newScenes = [...editedTimeline.scenes];
        newScenes[index] = { ...newScenes[index], ...updates };

        // Recalculer les temps de début
        let currentTime = 0.0;
        for (let i = 0; i < newScenes.length; i++) {
            newScenes[i].start_time = currentTime;
            currentTime += newScenes[i].duration;
        }

        setEditedTimeline({
            ...editedTimeline,
            scenes: newScenes,
            total_duration: currentTime,
        });
    };

    const deleteScene = (index: number) => {
        if (editedTimeline.scenes.length <= 1) {
            Alert.alert('Erreur', 'Vous devez garder au moins une scène');
            return;
        }

        Alert.alert(
            'Supprimer la scène',
            'Êtes-vous sûr de vouloir supprimer cette scène ?',
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: () => {
                        const newScenes = editedTimeline.scenes.filter((_, i) => i !== index);
                        let currentTime = 0.0;
                        for (let i = 0; i < newScenes.length; i++) {
                            newScenes[i].scene_index = i;
                            newScenes[i].start_time = currentTime;
                            currentTime += newScenes[i].duration;
                        }
                        setEditedTimeline({
                            ...editedTimeline,
                            scenes: newScenes,
                            total_duration: currentTime,
                        });
                    },
                },
            ]
        );
    };

    const addScene = () => {
        const lastScene = editedTimeline.scenes[editedTimeline.scenes.length - 1];
        const newScene: TimelineScene = {
            scene_index: editedTimeline.scenes.length,
            start_time: lastScene ? lastScene.start_time + lastScene.duration : 0.0,
            duration: 3.0,
            text: '',
            text_position: 'center',
            transition: 'fade',
            effects: [],
        };

        setEditedTimeline({
            ...editedTimeline,
            scenes: [...editedTimeline.scenes, newScene],
            total_duration: editedTimeline.total_duration + newScene.duration,
        });
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Éditer la timeline</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
                        <Text style={styles.cancelButtonText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => onSave(editedTimeline)}
                        style={styles.saveButton}
                    >
                        <Text style={styles.saveButtonText}>Enregistrer</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.scenesList}>
                {editedTimeline.scenes.map((scene, index) => (
                    <View key={scene.scene_index} style={styles.sceneEditor}>
                        <View style={styles.sceneEditorHeader}>
                            <View style={styles.sceneEditorHeaderLeft}>
                                <View style={styles.sceneNumber}>
                                    <Text style={styles.sceneNumberText}>{index + 1}</Text>
                                </View>
                                <View>
                                    <Text style={styles.sceneTimeLabel}>
                                        {formatTime(scene.start_time)} - {formatTime(scene.start_time + scene.duration)}
                                    </Text>
                                    <Text style={styles.sceneDurationLabel}>
                                        Durée: {scene.duration.toFixed(1)}s
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={() => deleteScene(index)}
                                style={styles.deleteButton}
                            >
                                <SafeIcon name="trash-2" size={16} color="#EF4444" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.sceneFields}>
                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabel}>Texte de la scène</Text>
                                <NativeInput
                                    value={scene.text || ''}
                                    onChangeText={(text) => updateScene(index, { text })}
                                    placeholder="Texte à afficher..."
                                    multiline
                                    minLines={2}
                                />
                            </View>

                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabel}>Durée (secondes)</Text>
                                <NativeInput
                                    value={scene.duration.toString()}
                                    onChangeText={(value) => {
                                        const duration = parseFloat(value) || 2.0;
                                        updateScene(index, { duration: Math.max(1.0, Math.min(10.0, duration)) });
                                    }}
                                    keyboardType="numeric"
                                    placeholder="3.0"
                                />
                            </View>

                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabel}>Position du texte</Text>
                                <View style={styles.optionsRow}>
                                    {['top', 'center', 'bottom'].map((pos) => (
                                        <TouchableOpacity
                                            key={pos}
                                            style={[
                                                styles.optionButton,
                                                scene.text_position === pos && styles.optionButtonSelected,
                                            ]}
                                            onPress={() => updateScene(index, { text_position: pos })}
                                        >
                                            <Text
                                                style={[
                                                    styles.optionButtonText,
                                                    scene.text_position === pos && styles.optionButtonTextSelected,
                                                ]}
                                            >
                                                {pos === 'top' ? 'Haut' : pos === 'center' ? 'Centre' : 'Bas'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.fieldRow}>
                                <Text style={styles.fieldLabel}>Transition</Text>
                                <View style={styles.optionsRow}>
                                    {['fade', 'slide', 'zoom', 'none'].map((trans) => (
                                        <TouchableOpacity
                                            key={trans}
                                            style={[
                                                styles.optionButton,
                                                scene.transition === trans && styles.optionButtonSelected,
                                            ]}
                                            onPress={() => updateScene(index, { transition: trans })}
                                        >
                                            <Text
                                                style={[
                                                    styles.optionButtonText,
                                                    scene.transition === trans && styles.optionButtonTextSelected,
                                                ]}
                                            >
                                                {trans === 'fade' ? 'Fondu' : trans === 'slide' ? 'Glissement' : trans === 'zoom' ? 'Zoom' : 'Aucune'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>
                    </View>
                ))}

                <TouchableOpacity onPress={addScene} style={styles.addSceneButton}>
                    <SafeIcon name="plus" size={20} color={modernColors.primary} />
                    <Text style={styles.addSceneButtonText}>Ajouter une scène</Text>
                </TouchableOpacity>
            </ScrollView>

            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    Durée totale: {formatTime(editedTimeline.total_duration)} ({editedTimeline.scenes.length} scène{editedTimeline.scenes.length > 1 ? 's' : ''})
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    cancelButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    saveButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: modernColors.primary,
    },
    saveButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    scenesList: {
        flex: 1,
        padding: 16,
    },
    sceneEditor: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    sceneEditorHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sceneEditorHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    sceneNumber: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sceneNumberText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    sceneTimeLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    sceneDurationLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    deleteButton: {
        padding: 8,
    },
    sceneFields: {
        gap: 16,
    },
    fieldRow: {
        gap: 8,
    },
    fieldLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    optionsRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    optionButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.background,
    },
    optionButtonSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    optionButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
    },
    optionButtonTextSelected: {
        color: '#FFFFFF',
    },
    addSceneButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.primary,
        borderStyle: 'dashed',
        backgroundColor: modernColors.primary + '10',
        marginBottom: 16,
    },
    addSceneButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    footerText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'center',
    },
});

