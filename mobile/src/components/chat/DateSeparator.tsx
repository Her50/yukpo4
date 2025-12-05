import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';

interface DateSeparatorProps {
    date: Date | string;
}

const DateSeparator: React.FC<DateSeparatorProps> = ({ date }) => {
    const formatDate = (dateInput: Date | string): string => {
        try {
            const dateObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
            if (isNaN(dateObj.getTime())) {
                return '';
            }

            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            // Réinitialiser les heures pour comparer uniquement les dates
            const compareDate = new Date(dateObj);
            compareDate.setHours(0, 0, 0, 0);
            const compareToday = new Date(today);
            compareToday.setHours(0, 0, 0, 0);
            const compareYesterday = new Date(yesterday);
            compareYesterday.setHours(0, 0, 0, 0);

            if (compareDate.getTime() === compareToday.getTime()) {
                return "Aujourd'hui";
            } else if (compareDate.getTime() === compareYesterday.getTime()) {
                return 'Hier';
            } else {
                // Vérifier si c'est dans la même semaine
                const daysDiff = Math.floor(
                    (compareToday.getTime() - compareDate.getTime()) / (1000 * 60 * 60 * 24)
                );
                if (daysDiff < 7) {
                    // Jour de la semaine
                    const dayNames = [
                        'Dimanche',
                        'Lundi',
                        'Mardi',
                        'Mercredi',
                        'Jeudi',
                        'Vendredi',
                        'Samedi',
                    ];
                    return dayNames[dateObj.getDay()];
                } else {
                    // Date complète
                    return dateObj.toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: dateObj.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
                    });
                }
            }
        } catch (error) {
            return '';
        }
    };

    const formattedDate = formatDate(date);
    if (!formattedDate) return null;

    return (
        <View style={styles.container}>
            <View style={styles.line} />
            <View style={styles.dateContainer}>
                <Text style={styles.dateText}>{formattedDate}</Text>
            </View>
            <View style={styles.line} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16,
        paddingHorizontal: 16,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: modernColors.border,
    },
    dateContainer: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    dateText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        textTransform: 'capitalize',
    },
});

export default DateSeparator;

