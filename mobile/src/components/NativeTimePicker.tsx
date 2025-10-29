import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface NativeTimePickerProps {
    label: string;
    value: string; // Format "HH:MM"
    onChange: (time: string) => void;
    required?: boolean;
    placeholder?: string;
}

const NativeTimePicker: React.FC<NativeTimePickerProps> = ({
    label,
    value,
    onChange,
    required = false,
    placeholder = "Sélectionner l'heure"
}) => {
    const [showPicker, setShowPicker] = useState(false);
    const [tempTime, setTempTime] = useState<Date>(() => {
        if (value) {
            const [hours, minutes] = value.split(':').map(Number);
            const date = new Date();
            date.setHours(hours, minutes, 0, 0);
            return date;
        }
        return new Date();
    });

    const handleTimeChange = (_event: any, selectedTime?: Date) => {
        if (Platform.OS === 'android') {
            setShowPicker(false);
        }

        if (selectedTime) {
            setTempTime(selectedTime);
            const hours = selectedTime.getHours().toString().padStart(2, '0');
            const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
            onChange(`${hours}:${minutes}`);
        }
    };

    const formatDisplayTime = (timeString: string) => {
        if (!timeString) return placeholder;
        return timeString; // Déjà au format HH:MM
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>
                {label} {required && <Text style={styles.required}>*</Text>}
            </Text>

            <TouchableOpacity
                style={[styles.picker, !value && styles.placeholderStyle]}
                onPress={() => setShowPicker(true)}
            >
                <SafeIcon name="clock" size={18} color={value ? modernColors.text : modernColors.textSecondary} />
                <Text style={[styles.pickerText, !value && styles.placeholderText]}>
                    {formatDisplayTime(value)}
                </Text>
                <SafeIcon name="chevron-down" size={16} color={modernColors.textSecondary} />
            </TouchableOpacity>

            {showPicker && (
                <DateTimePicker
                    value={tempTime}
                    mode="time"
                    is24Hour={true}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleTimeChange}
                />
            )}

            {Platform.OS === 'ios' && showPicker && (
                <View style={styles.iosButtonsContainer}>
                    <TouchableOpacity
                        style={[styles.iosButton, styles.cancelButton]}
                        onPress={() => setShowPicker(false)}
                    >
                        <Text style={styles.cancelButtonText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.iosButton, styles.confirmButton]}
                        onPress={() => {
                            const hours = tempTime.getHours().toString().padStart(2, '0');
                            const minutes = tempTime.getMinutes().toString().padStart(2, '0');
                            onChange(`${hours}:${minutes}`);
                            setShowPicker(false);
                        }}
                    >
                        <Text style={styles.confirmButtonText}>Confirmer</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 8,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 6,
    },
    required: {
        color: modernColors.error,
    },
    picker: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 10,
    },
    placeholderStyle: {
        borderStyle: 'dashed',
    },
    pickerText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
    },
    placeholderText: {
        color: modernColors.textSecondary,
    },
    iosButtonsContainer: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 10,
    },
    iosButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    confirmButton: {
        backgroundColor: modernColors.primary,
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    confirmButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default NativeTimePicker;







