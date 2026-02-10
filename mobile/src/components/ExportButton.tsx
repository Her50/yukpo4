import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { config } from '../config/environment';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface ExportButtonProps {
    data: any;
    format: 'csv' | 'pdf' | 'excel';
    filename?: string;
    onExport?: (filePath: string) => void;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
    data,
    format,
    filename,
    onExport,
}) => {
    const [exporting, setExporting] = useState(false);

    const convertToCSV = (data: any): string => {
        if (!Array.isArray(data) || data.length === 0) {
            return '';
        }

        // Headers
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];

        // Data rows
        data.forEach((row) => {
            const values = headers.map(header => {
                const value = row[header];
                // Escape commas and quotes
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value ?? '';
            });
            csvRows.push(values.join(','));
        });

        return csvRows.join('\n');
    };

    const handleExport = async () => {
        try {
            setExporting(true);

            let content = '';
            let fileExtension = '';
            let mimeType = '';

            switch (format) {
                case 'csv':
                    content = convertToCSV(data);
                    fileExtension = 'csv';
                    mimeType = 'text/csv';
                    break;
                case 'pdf':
                    // TODO: Implémenter génération PDF
                    Alert.alert('Info', 'Export PDF à implémenter');
                    setExporting(false);
                    return;
                case 'excel':
                    // ✅ AMÉLIORÉ: Génération Excel via backend
                    try {
                        const response = await fetch(`${config.API_BASE_URL}/api/publicites/export/excel`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ data }),
                        });

                        if (!response.ok) {
                            throw new Error('Erreur génération Excel');
                        }

                        const blob = await response.blob();
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                            const base64 = reader.result as string;
                            const base64Data = base64.split(',')[1] || base64;

                            const fileName = filename || `export_${Date.now()}.xlsx`;
                            const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

                            await FileSystem.writeAsStringAsync(fileUri, base64Data, {
                                encoding: FileSystem.EncodingType.Base64,
                            });

                            if (await Sharing.isAvailableAsync()) {
                                await Sharing.shareAsync(fileUri, {
                                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                    dialogTitle: 'Exporter en Excel',
                                });
                            } else {
                                await Share.share({
                                    message: 'Export Excel généré',
                                    title: fileName,
                                });
                            }

                            onExport?.(fileUri);
                            Alert.alert('Succès', `Fichier Excel exporté: ${fileName}`);
                            setExporting(false);
                        };
                        reader.readAsDataURL(blob);
                        return;
                    } catch (error: any) {
                        console.error('[ExportButton] Erreur export Excel:', error);
                        // Fallback: CSV avec extension .xlsx
                        content = convertToCSV(data);
                        fileExtension = 'xlsx';
                        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                    }
                    break;
            }

            if (!content) {
                Alert.alert('Erreur', 'Aucune donnée à exporter');
                setExporting(false);
                return;
            }

            // Créer le fichier
            const fileName = filename || `export_${Date.now()}.${fileExtension}`;
            const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

            await FileSystem.writeAsStringAsync(fileUri, content, {
                encoding: FileSystem.EncodingType.UTF8,
            });

            // Partager le fichier
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    mimeType,
                    dialogTitle: `Exporter en ${format.toUpperCase()}`,
                });
            } else {
                // Fallback: utiliser Share API
                await Share.share({
                    message: content,
                    title: fileName,
                });
            }

            onExport?.(fileUri);
            Alert.alert('Succès', `Fichier exporté: ${fileName}`);
        } catch (error: any) {
            console.error('[ExportButton] Erreur export:', error);
            Alert.alert('Erreur', 'Impossible d\'exporter le fichier');
        } finally {
            setExporting(false);
        }
    };

    const getFormatIcon = () => {
        switch (format) {
            case 'csv':
                return 'file-text';
            case 'pdf':
                return 'file';
            case 'excel':
                return 'table';
            default:
                return 'download';
        }
    };

    const getFormatLabel = () => {
        switch (format) {
            case 'csv':
                return 'CSV';
            case 'pdf':
                return 'PDF';
            case 'excel':
                return 'Excel';
            default:
                return format.toUpperCase();
        }
    };

    return (
        <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExport}
            disabled={exporting || !data || (Array.isArray(data) && data.length === 0)}
        >
            {exporting ? (
                <ActivityIndicator size="small" color="#fff" />
            ) : (
                <>
                    <SafeIcon name={getFormatIcon()} size={16} color="#fff" />
                    <Text style={styles.exportButtonText}>
                        Exporter en {getFormatLabel()}
                    </Text>
                </>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    exportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
    },
    exportButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
});

