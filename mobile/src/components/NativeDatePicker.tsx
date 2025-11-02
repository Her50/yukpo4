import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface NativeDatePickerProps {
    label: string;
    value: string; // Format: JJ/MM/AAAA
    onChange: (dateString: string) => void;
    required?: boolean;
    placeholder?: string;
    minimumDate?: Date;
    maximumDate?: Date;
}

const NativeDatePicker: React.FC<NativeDatePickerProps> = ({
    label,
    value,
    onChange,
    required = false,
    placeholder = 'Sélectionner une date',
    minimumDate,
    maximumDate
}) => {
    const [showPicker, setShowPicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(
        value ? parseDate(value) : undefined
    );

    // Parser une date au format JJ/MM/AAAA
    function parseDate(dateString: string): Date | undefined {
        const parts = dateString.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Mois de 0 à 11
            const year = parseInt(parts[2], 10);
            return new Date(year, month, day);
        }
        return undefined;
    }

    // Formater une date en JJ/MM/AAAA
    function formatDate(date: Date): string {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowPicker(false);
        }

        if (event.type === 'set' && date) {
            setSelectedDate(date);
            const formattedDate = formatDate(date);
            onChange(formattedDate);

            if (Platform.OS === 'ios') {
                // Sur iOS, fermer après sélection
                setShowPicker(false);
            }
        } else if (event.type === 'dismissed') {
            setShowPicker(false);
        }
    };

    const handleClear = () => {
        setSelectedDate(undefined);
        onChange('');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>
                {label} {required && <Text style={styles.required}>*</Text>}
            </Text>

            <TouchableOpacity
                style={[styles.selector, !value && styles.selectorPlaceholder]}
                onPress={() => setShowPicker(true)}
            >
                <SafeIcon name="calendar" size={18} color={value ? modernColors.primary : modernColors.textSecondary} />
                <Text style={[styles.selectorText, !value && styles.placeholderText]}>
                    {value || placeholder}
                </Text>
                {value && (
                    <TouchableOpacity onPress={handleClear} style={styles.clearIconButton}>
                        <SafeIcon name="x-circle" size={18} color={modernColors.error} />
                    </TouchableOpacity>
                )}
            </TouchableOpacity>

            {showPicker && (
                <DateTimePicker
                    value={selectedDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                    minimumDate={minimumDate}
                    maximumDate={maximumDate}
                    locale="fr-FR"
                />
            )}

            {/* Aide visuelle */}
            <Text style={styles.hintText}>
                📅 Format : JJ/MM/AAAA
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 12, // ✅ Réduit de 20 à 12
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    required: {
        color: modernColors.error,
        fontSize: 16,
    },
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: modernColors.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 10,
    },
    selectorPlaceholder: {
        borderColor: modernColors.border,
    },
    selectorText: {
        fontSize: 15,
        color: modernColors.text,
        flex: 1,
    },
    placeholderText: {
        color: modernColors.textSecondary,
    },
    clearIconButton: {
        padding: 4,
    },
    hintText: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 4,
        marginLeft: 4,
    },
});

export default NativeDatePicker;










