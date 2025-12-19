import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { modernColors } from '../../theme/modernTheme';
import { NativeInput } from '../NativeDesign';
import SafeIcon from '../../../components/SafeIcon';

interface CourierChecklistItemProps {
    label: string;
    quantity: number;
    unit?: string;
    checked: boolean;
    onToggle: (next: boolean) => void;
    note?: string;
    onNoteChange?: (note: string) => void;
}

const CourierChecklistItem: React.FC<CourierChecklistItemProps> = ({
    label,
    quantity,
    unit,
    checked,
    onToggle,
    note,
    onNoteChange,
}) => {
    return (
        <View style={[styles.container, checked && styles.containerChecked]}>
            <TouchableOpacity style={styles.checkbox} onPress={() => onToggle(!checked)}>
                <View style={[styles.checkboxInner, checked && styles.checkboxInnerChecked]}>
                    {checked ? <SafeIcon name='check' size={16} color='#fff' /> : null}
                </View>
            </TouchableOpacity>
            <View style={styles.content}>
                <Text style={[styles.label, checked && styles.labelChecked]}>{label}</Text>
                <Text style={styles.meta}>
                    {quantity} {unit || 'unités'}
                </Text>
                <NativeInput
                    value={note}
                    onChangeText={onNoteChange}
                    placeholder='Note ou substitut proposé'
                    multiline
                    minLines={1}
                    style={styles.noteInput}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: modernColors.borderLight,
    },
    containerChecked: {
        backgroundColor: '#f0fdf4',
    },
    checkbox: {
        paddingTop: 4,
    },
    checkboxInner: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: modernColors.surface,
    },
    checkboxInnerChecked: {
        backgroundColor: modernColors.primary,
    },
    content: {
        flex: 1,
        gap: 6,
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    labelChecked: {
        textDecorationLine: 'line-through',
        color: modernColors.textSecondary,
    },
    meta: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    noteInput: {
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 12,
    },
});

export default CourierChecklistItem;


