import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Card, Title } from 'react-native-paper';
import { useTranslation } from '../hooks/useTranslation';
import { theme } from '../theme/theme';

interface LanguageSelectorProps {
    visible: boolean;
    onClose: () => void;
    onLanguageChange?: (languageCode: string) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
    visible,
    onClose,
    onLanguageChange
}) => {
    const { currentLanguage, setLanguage, getSupportedLanguages, getLanguageConfig } = useTranslation();
    const [selectedLanguage, setSelectedLanguage] = useState<string>(currentLanguage);

    const handleLanguageSelect = (languageCode: string) => {
        setSelectedLanguage(languageCode);
    };

    const handleSave = async () => {
        try {
            await setLanguage(selectedLanguage);
            onLanguageChange?.(selectedLanguage);
            onClose();
        } catch (error) {
            Alert.alert(
                'Erreur',
                'Impossible de changer la langue. Veuillez réessayer.',
                [{ text: 'OK' }]
            );
        }
    };

    const supportedLanguages = getSupportedLanguages();

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Title style={styles.title}>Choisir la langue</Title>
                </View>

                <ScrollView style={styles.content}>
                    <Card style={styles.infoCard}>
                        <Card.Content>
                            <View style={styles.infoHeader}>
                                <Ionicons name="language" size={24} color={theme.colors.primary} />
                                <Text style={styles.infoTitle}>Langue de l'application</Text>
                            </View>
                            <Text style={styles.infoDescription}>
                                Sélectionnez votre langue préférée. L'application sera traduite automatiquement.
                            </Text>
                        </Card.Content>
                    </Card>

                    <View style={styles.languageList}>
                        {supportedLanguages.map((language) => (
                            <TouchableOpacity
                                key={language.code}
                                style={[
                                    styles.languageItem,
                                    selectedLanguage === language.code && styles.languageItemSelected
                                ]}
                                onPress={() => handleLanguageSelect(language.code)}
                            >
                                <View style={styles.languageInfo}>
                                    <Text style={styles.languageFlag}>{language.flag}</Text>
                                    <View style={styles.languageDetails}>
                                        <Text style={styles.languageName}>{language.name}</Text>
                                        <Text style={styles.languageNativeName}>{language.nativeName}</Text>
                                    </View>
                                </View>
                                {selectedLanguage === language.code && (
                                    <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <Button
                        mode="outlined"
                        onPress={onClose}
                        style={styles.cancelButton}
                    >
                        Annuler
                    </Button>
                    <Button
                        mode="contained"
                        onPress={handleSave}
                        style={styles.saveButton}
                        disabled={selectedLanguage === currentLanguage}
                    >
                        Appliquer
                    </Button>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    closeButton: {
        padding: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginLeft: 8,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    infoCard: {
        marginBottom: 16,
        elevation: 2,
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginLeft: 8,
    },
    infoDescription: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        lineHeight: 20,
    },
    languageList: {
        gap: 8,
    },
    languageItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 12,
        backgroundColor: 'white',
        borderRadius: 8,
        elevation: 1,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    languageItemSelected: {
        backgroundColor: '#e8f5e8',
        borderColor: theme.colors.primary,
    },
    languageInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    languageFlag: {
        fontSize: 24,
        marginRight: 12,
    },
    languageDetails: {
        flex: 1,
    },
    languageName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 2,
    },
    languageNativeName: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    footer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        gap: 12,
    },
    cancelButton: {
        flex: 1,
    },
    saveButton: {
        flex: 1,
        backgroundColor: theme.colors.primary,
    },
});

export default LanguageSelector;















