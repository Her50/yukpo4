import { Calendar, Clock, CurrencyDollar, Envelope, MapPin, Phone, User } from 'phosphor-react-native';
import React, { useEffect, useState } from 'react';
import ReactNative from 'react-native';
import { theme } from '../theme/theme';
import GPSSelector from './GPSSelector';

const { StyleSheet, Text, TextInput: RNTextInput, TouchableOpacity, View, ScrollView, Alert } = ReactNative;
const TextInput = RNTextInput as any;

interface DynamicFieldProps {
    field: {
        type: string;
        label: string;
        name: string;
        required?: boolean;
        options?: string[];
        placeholder?: string;
        validation?: {
            min?: number;
            max?: number;
            pattern?: string;
            message?: string;
        };
        defaultValue?: any;
        description?: string;
        // Nouvelles propriétés pour correspondre au frontend
        labelFrancais?: string;
        obligatoire?: boolean;
        tooltip?: string;
        typeDonnee?: string;
        origineChamps?: string;
    };
    value: any;
    onChange: (value: any) => void;
    error?: string;
    disabled?: boolean;
    compact?: boolean;
    // Nouvelles propriétés pour correspondre au frontend
    isInContactBlock?: boolean;
    isInInfoGeneraleBlock?: boolean;
    readonly?: boolean;
}

const DynamicField: React.FC<DynamicFieldProps> = ({
    field,
    value,
    onChange,
    error,
    disabled = false,
    compact = false
}) => {
    const [localValue, setLocalValue] = useState(value || field.defaultValue || '');
    const [showGPSModal, setShowGPSModal] = useState(false);

    useEffect(() => {
        setLocalValue(value || field.defaultValue || '');
    }, [value, field.defaultValue]);

    const handleChange = (newValue: any) => {
        setLocalValue(newValue);
        onChange(newValue);
    };

    const validateField = (val: any): string | null => {
        if (field.required && (!val || val === '')) {
            return `${field.label} est requis`;
        }

        if (field.validation) {
            const { min, max, pattern, message } = field.validation;

            if (min !== undefined && val < min) {
                return message || `La valeur doit être au moins ${min}`;
            }

            if (max !== undefined && val > max) {
                return message || `La valeur doit être au maximum ${max}`;
            }

            if (pattern && typeof val === 'string' && !new RegExp(pattern).test(val)) {
                return message || `Format invalide pour ${field.label}`;
            }
        }

        return null;
    };

    const fieldError = error || validateField(localValue);

    const getFieldIcon = () => {
        switch (field.type) {
            case 'gps':
                return <MapPin size={20} color={theme.colors.primary} />;
            case 'date':
                return <Calendar size={20} color={theme.colors.primary} />;
            case 'time':
                return <Clock size={20} color={theme.colors.primary} />;
            case 'price':
                return <CurrencyDollar size={20} color={theme.colors.primary} />;
            case 'email':
                return <Envelope size={20} color={theme.colors.primary} />;
            case 'phone':
                return <Phone size={20} color={theme.colors.primary} />;
            case 'name':
                return <User size={20} color={theme.colors.primary} />;
            default:
                return null;
        }
    };

    const renderField = () => {
        switch (field.type) {
            case 'text':
            case 'name':
            case 'email':
            case 'phone':
                return (
                    <TextInput
                        label={field.label}
                        value={localValue}
                        onChangeText={handleChange}
                        mode="outlined"
                        placeholder={field.placeholder}
                        disabled={disabled}
                        error={!!fieldError}
                        keyboardType={
                            field.type === 'email' ? 'email-address' :
                                field.type === 'phone' ? 'phone-pad' :
                                    'default'
                        }
                        style={styles.textInput}
                    />
                );

            case 'textarea':
                return (
                    <TextInput
                        label={field.label}
                        value={localValue}
                        onChangeText={handleChange}
                        mode="outlined"
                        multiline
                        numberOfLines={4}
                        placeholder={field.placeholder}
                        disabled={disabled}
                        error={!!fieldError}
                        style={styles.textArea}
                    />
                );

            case 'number':
            case 'price':
                return (
                    <TextInput
                        label={field.label}
                        value={localValue?.toString() || ''}
                        onChangeText={(text) => {
                            const numValue = field.type === 'price' ?
                                parseFloat(text) || 0 :
                                parseInt(text) || 0;
                            handleChange(numValue);
                        }}
                        mode="outlined"
                        placeholder={field.placeholder}
                        disabled={disabled}
                        error={!!fieldError}
                        keyboardType="numeric"
                        style={styles.textInput}
                    />
                );

            case 'select':
                return (
                    <View style={styles.selectContainer}>
                        <Text style={styles.selectLabel}>{field.label}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {field.options?.map((option, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.selectOption,
                                        localValue === option && styles.selectOptionSelected
                                    ]}
                                    onPress={() => handleChange(option)}
                                    disabled={disabled}
                                >
                                    <Text style={[
                                        styles.selectOptionText,
                                        localValue === option && styles.selectOptionTextSelected
                                    ]}>
                                        {option}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                );

            case 'radio':
                return (
                    <View style={styles.radioContainer}>
                        <Text style={styles.radioLabel}>{field.label}</Text>
                        {field.options?.map((option, index) => (
                            <View key={index} style={styles.radioOption}>
                                <TouchableOpacity
                                    style={styles.radioButton}
                                    onPress={() => handleChange(option)}
                                    disabled={disabled}
                                >
                                    <View style={[
                                        styles.radioButtonOuter,
                                        localValue === option && styles.radioButtonOuterSelected
                                    ]}>
                                        {localValue === option && <View style={styles.radioButtonInner} />}
                                    </View>
                                </TouchableOpacity>
                                <Text style={styles.radioOptionText}>{option}</Text>
                            </View>
                        ))}
                    </View>
                );

            case 'checkbox':
                return (
                    <View style={styles.checkboxContainer}>
                        <Text style={styles.checkboxLabel}>{field.label}</Text>
                        {field.options?.map((option, index) => {
                            const isChecked = Array.isArray(localValue) ?
                                localValue.includes(option) : false;

                            return (
                                <View key={index} style={styles.checkboxOption}>
                                    <TouchableOpacity
                                        style={styles.checkboxButton}
                                        onPress={() => {
                                            const currentValues = Array.isArray(localValue) ? localValue : [];
                                            const newValues = isChecked
                                                ? currentValues.filter(v => v !== option)
                                                : [...currentValues, option];
                                            handleChange(newValues);
                                        }}
                                        disabled={disabled}
                                    >
                                        <View style={[
                                            styles.checkboxOuter,
                                            isChecked && styles.checkboxOuterSelected
                                        ]}>
                                            {isChecked && <Text style={styles.checkboxCheck}>✓</Text>}
                                        </View>
                                    </TouchableOpacity>
                                    <Text style={styles.checkboxOptionText}>{option}</Text>
                                </View>
                            );
                        })}
                    </View>
                );

            case 'boolean':
                return (
                    <View style={styles.booleanContainer}>
                        <Text style={styles.booleanLabel}>{field.label}</Text>
                        <View style={styles.booleanRow}>
                            <Text style={styles.booleanText}>
                                {localValue ? 'Oui' : 'Non'}
                            </Text>
                            <TouchableOpacity
                                style={[
                                    styles.switchContainer,
                                    localValue && styles.switchContainerActive
                                ]}
                                onPress={() => handleChange(!localValue)}
                                disabled={disabled}
                            >
                                <View style={[
                                    styles.switchThumb,
                                    localValue && styles.switchThumbActive
                                ]} />
                            </TouchableOpacity>
                        </View>
                    </View>
                );

            case 'gps':
                return (
                    <View style={styles.gpsContainer}>
                        <Text style={styles.gpsLabel}>{field.label}</Text>
                        <TouchableOpacity
                            style={[styles.gpsButton, fieldError && styles.gpsButtonError]}
                            onPress={() => setShowGPSModal(true)}
                            disabled={disabled}
                        >
                            <MapPin size={20} color={theme.colors.primary} />
                            <Text style={styles.gpsButtonText}>
                                {localValue ? 'Modifier la localisation' : 'Sélectionner une localisation'}
                            </Text>
                        </TouchableOpacity>
                        {localValue && (
                            <Text style={styles.gpsValue}>
                                {typeof localValue === 'string' ? localValue :
                                    `${localValue.latitude != null && Number.isFinite(localValue.latitude) ? localValue.latitude.toFixed(4) : '0.0000'}, ${localValue.longitude != null && Number.isFinite(localValue.longitude) ? localValue.longitude.toFixed(4) : '0.0000'}`}
                            </Text>
                        )}
                    </View>
                );

            case 'date':
                return (
                    <View style={styles.dateContainer}>
                        <Text style={styles.dateLabel}>{field.label}</Text>
                        <TouchableOpacity
                            style={[styles.dateButton, fieldError && styles.dateButtonError]}
                            onPress={() => {
                                // Ici on pourrait ouvrir un DatePicker
                                Alert.alert('Date Picker', 'Sélection de date à implémenter');
                            }}
                            disabled={disabled}
                        >
                            <Calendar size={20} color={theme.colors.primary} />
                            <Text style={styles.dateButtonText}>
                                {localValue || 'Sélectionner une date'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                );

            case 'time':
                return (
                    <View style={styles.timeContainer}>
                        <Text style={styles.timeLabel}>{field.label}</Text>
                        <TouchableOpacity
                            style={[styles.timeButton, fieldError && styles.timeButtonError]}
                            onPress={() => {
                                // Ici on pourrait ouvrir un TimePicker
                                Alert.alert('Time Picker', 'Sélection d\'heure à implémenter');
                            }}
                            disabled={disabled}
                        >
                            <Clock size={20} color={theme.colors.primary} />
                            <Text style={styles.timeButtonText}>
                                {localValue || 'Sélectionner une heure'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                );

            default:
                return (
                    <TextInput
                        label={field.label}
                        value={localValue?.toString() || ''}
                        onChangeText={handleChange}
                        mode="outlined"
                        placeholder={field.placeholder}
                        disabled={disabled}
                        error={!!fieldError}
                        style={styles.textInput}
                    />
                );
        }
    };

    return (
        <View style={[styles.container, compact && styles.compactContainer]}>
            {!compact && (
                <View style={styles.header}>
                    {getFieldIcon()}
                    <Text style={styles.label}>
                        {field.label}
                        {field.required && <Text style={styles.required}> *</Text>}
                    </Text>
                </View>
            )}

            {field.description && !compact && (
                <Text style={styles.description}>{field.description}</Text>
            )}

            {renderField()}

            {fieldError && (
                <Text style={styles.errorText}>{fieldError}</Text>
            )}

            {/* Modal GPS */}
            {field.type === 'gps' && (
                <GPSSelector
                    visible={showGPSModal}
                    onClose={() => setShowGPSModal(false)}
                    onSelect={(location) => {
                        handleChange(location);
                        setShowGPSModal(false);
                    }}
                    currentLocation={typeof localValue === 'object' ? localValue : null}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    compactContainer: {
        marginBottom: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginLeft: 8,
    },
    required: {
        color: theme.colors.error,
    },
    description: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginBottom: 8,
        fontStyle: 'italic',
    },
    textInput: {
        backgroundColor: 'white',
    },
    textArea: {
        backgroundColor: 'white',
        minHeight: 100,
    },
    selectContainer: {
        marginBottom: 8,
    },
    selectLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 8,
    },
    selectOption: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: 'white',
    },
    selectOptionSelected: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    selectOptionText: {
        fontSize: 14,
        color: theme.colors.text,
    },
    selectOptionTextSelected: {
        color: 'white',
        fontWeight: '600',
    },
    radioContainer: {
        marginBottom: 8,
    },
    radioLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 8,
    },
    radioOption: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    radioOptionText: {
        fontSize: 14,
        color: theme.colors.text,
        marginLeft: 8,
    },
    checkboxContainer: {
        marginBottom: 8,
    },
    checkboxLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 8,
    },
    checkboxOption: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    checkboxOptionText: {
        fontSize: 14,
        color: theme.colors.text,
        marginLeft: 8,
    },
    booleanContainer: {
        marginBottom: 8,
    },
    booleanLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 8,
    },
    booleanRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    booleanText: {
        fontSize: 14,
        color: theme.colors.text,
    },
    gpsContainer: {
        marginBottom: 8,
    },
    gpsLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 8,
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: 'white',
    },
    gpsButtonError: {
        borderColor: theme.colors.error,
    },
    gpsButtonText: {
        fontSize: 14,
        color: theme.colors.text,
        marginLeft: 8,
    },
    gpsValue: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginTop: 4,
        fontStyle: 'italic',
    },
    dateContainer: {
        marginBottom: 8,
    },
    dateLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 8,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: 'white',
    },
    dateButtonError: {
        borderColor: theme.colors.error,
    },
    dateButtonText: {
        fontSize: 14,
        color: theme.colors.text,
        marginLeft: 8,
    },
    timeContainer: {
        marginBottom: 8,
    },
    timeLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 8,
    },
    timeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: 'white',
    },
    timeButtonError: {
        borderColor: theme.colors.error,
    },
    timeButtonText: {
        fontSize: 14,
        color: theme.colors.text,
        marginLeft: 8,
    },
    errorText: {
        fontSize: 12,
        color: theme.colors.error,
        marginTop: 4,
    },
    // Styles pour les nouveaux composants natifs
    radioButton: {
        marginRight: 8,
    },
    radioButtonOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioButtonOuterSelected: {
        borderColor: theme.colors.primary,
    },
    radioButtonInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: theme.colors.primary,
    },
    checkboxButton: {
        marginRight: 8,
    },
    checkboxOuter: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxOuterSelected: {
        borderColor: theme.colors.primary,
        backgroundColor: theme.colors.primary,
    },
    checkboxCheck: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    switchContainer: {
        width: 50,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#ccc',
        justifyContent: 'center',
        padding: 2,
    },
    switchContainerActive: {
        backgroundColor: theme.colors.primary,
    },
    switchThumb: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    switchThumbActive: {
        transform: [{ translateX: 20 }],
    },
});

export default DynamicField;
