// ✅ NOUVEAU: Composant pour afficher les autres biens disponibles dans le même immeuble
// Date: 2026-01-26

import { useNavigation } from '@react-navigation/native';
import React from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { RealEstateProperty } from '../../services/immobilierService';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

interface OtherProperty {
    id: number;
    titre: string;
    type_bien: string;
    superficie_m2?: number;
    nb_chambres?: number;
    prix_vente?: number;
    prix_location_mensuel?: number;
    prix_location_journalier?: number;
    photos?: string[];
    statut: string;
}

interface OtherPropertiesCardProps {
    properties: OtherProperty[];
    currentPropertyType?: string;
}

const OtherPropertiesCard: React.FC<OtherPropertiesCardProps> = ({ 
    properties, 
    currentPropertyType 
}) => {
    const navigation = useNavigation();

    if (!properties || properties.length === 0) {
        return null;
    }

    // ✅ Grouper par type de bien
    const groupedByType = properties.reduce((acc, prop) => {
        const type = prop.type_bien || 'autre';
        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type].push(prop);
        return acc;
    }, {} as Record<string, OtherProperty[]>);

    const formatPrice = (property: OtherProperty) => {
        if (property.prix_location_journalier) {
            return `${(property.prix_location_journalier / 1000).toFixed(0)}K/jour`;
        }
        if (property.prix_location_mensuel) {
            return `${(property.prix_location_mensuel / 1000).toFixed(0)}K/mois`;
        }
        if (property.prix_vente) {
            return `${(property.prix_vente / 1000).toFixed(0)}K`;
        }
        return 'Prix sur demande';
    };

    const getTypeIcon = (type: string) => {
        const icons: Record<string, string> = {
            'chambre': 'bed',
            'studio': 'layout',
            'appartement': 'building',
            'maison': 'home',
            'meublé': 'sofa',
            'hôtel': 'building-2',
            'terrain': 'map',
            'bureau': 'briefcase',
            'local_commercial': 'store',
        };
        return icons[type] || 'home';
    };

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            'chambre': 'Chambre',
            'studio': 'Studio',
            'appartement': 'Appartement',
            'maison': 'Maison',
            'meublé': 'Meublé',
            'hôtel': 'Hôtel',
            'terrain': 'Terrain',
            'bureau': 'Bureau',
            'local_commercial': 'Local commercial',
        };
        return labels[type] || type;
    };

    const handlePropertyPress = (propertyId: number) => {
        (navigation as any).navigate('ImmobilierDetails', {
            propertyId,
        });
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <SafeIcon name="layers" size={20} color={modernColors.primary} type="lucide" />
                    <Text style={styles.title}>Autres biens disponibles</Text>
                </View>
                <Text style={styles.count}>{properties.length} bien{properties.length > 1 ? 's' : ''}</Text>
            </View>

            <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {Object.entries(groupedByType).map(([type, typeProperties]) => (
                    <View key={type} style={styles.typeGroup}>
                        <View style={styles.typeHeader}>
                            <SafeIcon 
                                name={getTypeIcon(type)} 
                                size={16} 
                                color={modernColors.primary} 
                                type="lucide" 
                            />
                            <Text style={styles.typeLabel}>
                                {getTypeLabel(type)} ({typeProperties.length})
                            </Text>
                        </View>
                        
                        {typeProperties.map((property) => (
                            <TouchableOpacity
                                key={property.id}
                                style={styles.propertyCard}
                                onPress={() => handlePropertyPress(property.id)}
                                activeOpacity={0.7}
                            >
                                {property.photos && property.photos.length > 0 ? (
                                    <Image
                                        source={{ uri: property.photos[0] }}
                                        style={styles.propertyImage}
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <View style={styles.propertyImagePlaceholder}>
                                        <SafeIcon 
                                            name={getTypeIcon(property.type_bien)} 
                                            size={24} 
                                            color="#9CA3AF" 
                                            type="lucide" 
                                        />
                                    </View>
                                )}
                                
                                <View style={styles.propertyInfo}>
                                    <Text style={styles.propertyTitle} numberOfLines={1}>
                                        {property.titre || `${getTypeLabel(property.type_bien)}`}
                                    </Text>
                                    
                                    <View style={styles.propertyDetails}>
                                        {property.superficie_m2 && (
                                            <View style={styles.detailItem}>
                                                <SafeIcon name="maximize" size={12} color="#6B7280" type="lucide" />
                                                <Text style={styles.detailText}>{property.superficie_m2} m²</Text>
                                            </View>
                                        )}
                                        {property.nb_chambres && (
                                            <View style={styles.detailItem}>
                                                <SafeIcon name="bed" size={12} color="#6B7280" type="lucide" />
                                                <Text style={styles.detailText}>{property.nb_chambres} ch.</Text>
                                            </View>
                                        )}
                                    </View>
                                    
                                    <Text style={styles.propertyPrice}>
                                        {formatPrice(property)}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        ...modernColors.shadowLight,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    count: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.primary,
    },
    scrollContent: {
        gap: 16,
    },
    typeGroup: {
        marginRight: 16,
    },
    typeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    typeLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    propertyCard: {
        width: 160,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    propertyImage: {
        width: '100%',
        height: 100,
        backgroundColor: '#F3F4F6',
    },
    propertyImagePlaceholder: {
        width: '100%',
        height: 100,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    propertyInfo: {
        padding: 12,
    },
    propertyTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    propertyDetails: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailText: {
        fontSize: 11,
        color: '#6B7280',
    },
    propertyPrice: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.primary,
    },
});

export default OtherPropertiesCard;

