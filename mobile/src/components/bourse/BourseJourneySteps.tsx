/**
 * Indicateur de parcours (liste scolaire / bourse) — UX moderne, étapes lisibles.
 */

import React, { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SafeIcon from '../SafeIcon';
import { modernColors } from '../../theme/modernTheme';

export interface JourneyStepDef {
    key: string;
    label: string;
    icon: string;
}

interface Props {
    steps: JourneyStepDef[];
    currentIndex: number;
}

const BourseJourneySteps: React.FC<Props> = ({ steps, currentIndex }) => {
    return (
        <View style={styles.wrap} accessibilityRole="summary">
            <View style={styles.row}>
                {steps.map((s, i) => {
                    const done = i < currentIndex;
                    const current = i === currentIndex;
                    return (
                        <React.Fragment key={s.key}>
                            <View style={styles.stepBlock}>
                                <View
                                    style={[
                                        styles.circle,
                                        done && styles.circleDone,
                                        current && !done && styles.circleCurrent,
                                    ]}
                                >
                                    {done ? (
                                        <SafeIcon name="check" size={14} color="#fff" type="lucide" />
                                    ) : (
                                        <SafeIcon
                                            name={s.icon as any}
                                            size={14}
                                            color={current ? '#fff' : '#94a3b8'}
                                            type="lucide"
                                        />
                                    )}
                                </View>
                                <Text
                                    numberOfLines={2}
                                    style={[styles.label, (done || current) && styles.labelActive]}
                                >
                                    {s.label}
                                </Text>
                            </View>
                            {i < steps.length - 1 ? (
                                <View style={[styles.dash, i < currentIndex && styles.dashDone]} />
                            ) : null}
                        </Fragment>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        marginBottom: 12,
        paddingVertical: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    stepBlock: {
        width: 76,
        alignItems: 'center',
    },
    circle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#e2e8f0',
    },
    circleCurrent: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    circleDone: {
        backgroundColor: '#059669',
        borderColor: '#059669',
    },
    dash: {
        width: 12,
        height: 3,
        backgroundColor: '#e2e8f0',
        marginTop: 15,
        borderRadius: 2,
    },
    dashDone: {
        backgroundColor: '#86efac',
    },
    label: {
        marginTop: 6,
        fontSize: 10,
        fontWeight: '600',
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 13,
    },
    labelActive: {
        color: '#0f172a',
    },
});

export default BourseJourneySteps;
