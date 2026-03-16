// ✅ NOUVEAU Phase 2: Éditeur de courbes de Bézier pour animations

import React, { useState } from 'react';
import {
    Dimensions,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { modernColors } from '../theme/modernTheme';
import { BezierCurve, Keyframe } from '../types/AdvancedTimeline';
import { NativeButton } from './SafeNativeDesign';
import { SafeIcon } from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_SIZE = SCREEN_WIDTH - 80;
const CANVAS_PADDING = 40;

interface CurveEditorProps {
    visible: boolean;
    keyframe: Keyframe | null;
    onClose: () => void;
    onSave: (curve: BezierCurve) => void;
}

export const CurveEditor: React.FC<CurveEditorProps> = ({
    visible,
    keyframe,
    onClose,
    onSave,
}) => {
        const { t } = useLanguageSafe();
const [curve, setCurve] = useState<BezierCurve>({
        x1: 0.25,
        y1: 0.75,
        x2: 0.75,
        y2: 0.25,
    });

    if (!keyframe) return null;

    const handleSave = () => {
        onSave(curve);
        onClose();
    };

    // Convertir coordonnées normalisées (0-1) en pixels
    const toPixel = (normalized: number, dimension: 'x' | 'y'): number => {
        const size = CANVAS_SIZE - CANVAS_PADDING * 2;
        return CANVAS_PADDING + normalized * size;
    };

    // Convertir pixels en coordonnées normalisées
    const toNormalized = (pixel: number, dimension: 'x' | 'y'): number => {
        const size = CANVAS_SIZE - CANVAS_PADDING * 2;
        return Math.max(0, Math.min(1, (pixel - CANVAS_PADDING) / size));
    };

    // Path pour la courbe de Bézier
    const bezierPath = `
        M ${toPixel(0, 'x')} ${toPixel(1, 'y')}
        C ${toPixel(curve.x1, 'x')} ${toPixel(curve.y1, 'y')},
          ${toPixel(curve.x2, 'x')} ${toPixel(curve.y2, 'y')},
          ${toPixel(1, 'x')} ${toPixel(0, 'y')}
    `;

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
                        <Text style={styles.title}>{t('curveEditor.editeurDeCourbeDeBezier')}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Canvas */}
                    <View style={styles.canvasContainer}>
                        <Svg width={CANVAS_SIZE} height={CANVAS_SIZE} style={styles.canvas}>
                            {/* Grille */}
                            {[0.25, 0.5, 0.75].map((val) => (
                                <React.Fragment key={val}>
                                    <Line
                                        x1={toPixel(0, 'x')}
                                        y1={toPixel(val, 'y')}
                                        x2={toPixel(1, 'x')}
                                        y2={toPixel(val, 'y')}
                                        stroke={modernColors.border}
                                        strokeWidth={1}
                                        strokeDasharray="4 4"
                                    />
                                    <Line
                                        x1={toPixel(val, 'x')}
                                        y1={toPixel(0, 'y')}
                                        x2={toPixel(val, 'x')}
                                        y2={toPixel(1, 'y')}
                                        stroke={modernColors.border}
                                        strokeWidth={1}
                                        strokeDasharray="4 4"
                                    />
                                </React.Fragment>
                            ))}

                            {/* Lignes de contrôle */}
                            <Line
                                x1={toPixel(0, 'x')}
                                y1={toPixel(1, 'y')}
                                x2={toPixel(curve.x1, 'x')}
                                y2={toPixel(curve.y1, 'y')}
                                stroke={modernColors.textSecondary}
                                strokeWidth={2}
                                opacity={0.5}
                            />
                            <Line
                                x1={toPixel(1, 'x')}
                                y1={toPixel(0, 'y')}
                                x2={toPixel(curve.x2, 'x')}
                                y2={toPixel(curve.y2, 'y')}
                                stroke={modernColors.textSecondary}
                                strokeWidth={2}
                                opacity={0.5}
                            />

                            {/* Courbe de Bézier */}
                            <Path
                                d={bezierPath}
                                stroke={modernColors.primary}
                                strokeWidth={3}
                                fill="none"
                            />

                            {/* Points de contrôle */}
                            <Circle
                                cx={toPixel(curve.x1, 'x')}
                                cy={toPixel(curve.y1, 'y')}
                                r={8}
                                fill={modernColors.primary}
                                stroke={modernColors.surface}
                                strokeWidth={2}
                            />
                            <Circle
                                cx={toPixel(curve.x2, 'x')}
                                cy={toPixel(curve.y2, 'y')}
                                r={8}
                                fill={modernColors.secondary}
                                stroke={modernColors.surface}
                                strokeWidth={2}
                            />

                            {/* Points de début et fin */}
                            <Circle
                                cx={toPixel(0, 'x')}
                                cy={toPixel(1, 'y')}
                                r={6}
                                fill={modernColors.success}
                            />
                            <Circle
                                cx={toPixel(1, 'x')}
                                cy={toPixel(0, 'y')}
                                r={6}
                                fill={modernColors.success}
                            />
                        </Svg>
                    </View>

                    {/* Contrôles numériques */}
                    <View style={styles.controls}>
                        <View style={styles.controlRow}>
                            <Text style={styles.controlLabel}>{t('curveEditor.point1X1Y1')}/Text>
                            <View style={styles.inputGroup}>
                                <TextInput
                                    style={styles.input}
                                    value={curve.x1.toFixed(2)}
                                    onChangeText={(text) => {
                                        const val = parseFloat(text);
                                        if (!isNaN(val)) {
                                            setCurve({ ...curve, x1: Math.max(0, Math.min(1, val)) });
                                        }
                                    }}
                                    keyboardType="numeric"
                                />
                                <TextInput
                                    style={styles.input}
                                    value={curve.y1.toFixed(2)}
                                    onChangeText={(text) => {
                                        const val = parseFloat(text);
                                        if (!isNaN(val)) {
                                            setCurve({ ...curve, y1: Math.max(0, Math.min(1, val)) });
                                        }
                                    }}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>
                        <View style={styles.controlRow}>
                            <Text style={styles.controlLabel}>{t('curveEditor.point2X2Y2')}/Text>
                            <View style={styles.inputGroup}>
                                <TextInput
                                    style={styles.input}
                                    value={curve.x2.toFixed(2)}
                                    onChangeText={(text) => {
                                        const val = parseFloat(text);
                                        if (!isNaN(val)) {
                                            setCurve({ ...curve, x2: Math.max(0, Math.min(1, val)) });
                                        }
                                    }}
                                    keyboardType="numeric"
                                />
                                <TextInput
                                    style={styles.input}
                                    value={curve.y2.toFixed(2)}
                                    onChangeText={(text) => {
                                        const val = parseFloat(text);
                                        if (!isNaN(val)) {
                                            setCurve({ ...curve, y2: Math.max(0, Math.min(1, val)) });
                                        }
                                    }}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>
                    </View>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <NativeButton
                            title={t('curveEditor.annuler')}
                            onPress={onClose}
                            variant="outline"
                            style={styles.cancelButton}
                        />
                        <NativeButton
                            title={t('curveEditor.enregistrer')}
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
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        backgroundColor: modernColors.surface,
        borderRadius: 20,
        width: SCREEN_WIDTH - 40,
        maxHeight: '90%',
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    closeButton: {
        padding: 4,
    },
    canvasContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 20,
        backgroundColor: modernColors.background,
        borderRadius: 12,
        padding: 20,
    },
    canvas: {
        backgroundColor: modernColors.surface,
    },
    controls: {
        marginVertical: 20,
    },
    controlRow: {
        marginBottom: 16,
    },
    controlLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    inputGroup: {
        flexDirection: 'row',
        gap: 8,
    },
    input: {
        flex: 1,
        backgroundColor: modernColors.background,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 14,
        color: modernColors.text,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    cancelButton: {
        flex: 1,
    },
    saveButton: {
        flex: 1,
    },
});

