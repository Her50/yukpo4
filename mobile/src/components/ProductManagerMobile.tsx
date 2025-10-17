import React, { useState } from 'react';
import {
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
// @ts-ignore
import { LinearGradient } from 'expo-linear-gradient';
// @ts-ignore
import * as ImagePicker from 'expo-image-picker';
// @ts-ignore
import * as DocumentPicker from 'expo-document-picker';
// @ts-ignore
import * as FileSystem from 'expo-file-system';
// @ts-ignore
import SafeIcon from './SafeIcon';
// @ts-ignore
import { NativeButton, NativeInput } from './NativeDesign';
// @ts-ignore
import { modernColors } from '../theme/modernTheme';

interface Product {
    id: string;
    nom: string;
    prix: string;
    devise: string;
    description?: string;
    image?: string; // Base64 ou URI de l'image/étiquette du produit
}

interface ProductManagerMobileProps {
    products: Product[];
    onProductsChange: (products: Product[]) => void;
    readonly?: boolean;
}

const ProductManagerMobile: React.FC<ProductManagerMobileProps> = ({
    products,
    onProductsChange,
    readonly = false
}) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [newProduct, setNewProduct] = useState<Omit<Product, 'id'>>({
        nom: '',
        prix: '',
        devise: 'XAF',
        description: '',
        image: undefined
    });

    const devises = ['XAF', 'EUR', 'USD', 'GBP'];

    // Fonction pour sélectionner une image
    const handlePickImage = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            
            if (permissionResult.granted === false) {
                Alert.alert('Permission refusée', 'Vous devez autoriser l\'accès à la galerie');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
                base64: true
            });

            if (!result.canceled && result.assets[0]) {
                const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
                setNewProduct({ ...newProduct, image: base64Image });
            }
        } catch (error) {
            console.error('Erreur sélection image:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
        }
    };

    // Fonction pour importer des produits depuis Excel
    const handleImportExcel = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'text/csv'
                ],
                copyToCacheDirectory: true
            });

            if (result.type === 'cancel' || !result.uri) {
                return;
            }

            // Lire le fichier
            const fileContent = await FileSystem.readAsStringAsync(result.uri);
            
            // Parser le CSV (format simple: nom,prix,devise,description)
            const lines = fileContent.split('\n').filter(line => line.trim());
            
            if (lines.length === 0) {
                Alert.alert('Erreur', 'Le fichier est vide');
                return;
            }

            // Ignorer la première ligne (en-têtes)
            const dataLines = lines.slice(1);
            const newProducts: Product[] = [];

            dataLines.forEach(line => {
                const columns = line.split(',').map(col => col.trim());
                
                if (columns.length >= 2 && columns[0] && columns[1]) {
                    newProducts.push({
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                        nom: columns[0],
                        prix: columns[1],
                        devise: columns[2] || 'XAF',
                        description: columns[3] || ''
                    });
                }
            });

            if (newProducts.length > 0) {
                onProductsChange([...products, ...newProducts]);
                Alert.alert(
                    'Import réussi',
                    `${newProducts.length} produit(s) ont été importés avec succès`
                );
            } else {
                Alert.alert('Erreur', 'Aucun produit valide trouvé dans le fichier');
            }

        } catch (error) {
            console.error('Erreur import Excel:', error);
            Alert.alert('Erreur', 'Impossible d\'importer le fichier');
        }
    };

    const handleAddProduct = () => {
        if (!newProduct.nom.trim() || !newProduct.prix.trim()) {
            Alert.alert('Erreur', 'Veuillez remplir le nom et le prix du produit');
            return;
        }

        const product: Product = {
            id: Date.now().toString(),
            ...newProduct
        };

        if (editingProductId) {
            onProductsChange(products.map(p => p.id === editingProductId ? product : p));
        } else {
            onProductsChange([...products, product]);
        }

        setNewProduct({ nom: '', prix: '', devise: 'XAF', description: '' });
        setEditingProductId(null);
        setShowAddModal(false);
    };

    const handleEditProduct = (product: Product) => {
        setNewProduct({
            nom: product.nom,
            prix: product.prix,
            devise: product.devise,
            description: product.description || ''
        });
        setEditingProductId(product.id);
        setShowAddModal(true);
    };

    const handleDeleteProduct = (id: string) => {
        Alert.alert(
            'Supprimer le produit',
            'Êtes-vous sûr de vouloir supprimer ce produit ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: () => onProductsChange(products.filter(p => p.id !== id))
                }
            ]
        );
    };

    const handleCancel = () => {
        setNewProduct({ nom: '', prix: '', devise: 'XAF', description: '', image: undefined });
        setEditingProductId(null);
        setShowAddModal(false);
    };

    return (
        <View style={styles.container}>
            {/* Liste des produits */}
            {products.length > 0 ? (
                <ScrollView style={styles.productsList} showsVerticalScrollIndicator={false}>
                    {products.map((product) => (
                        <View key={product.id} style={styles.productCard}>
                            <View style={styles.productContent}>
                                {product.image && (
                                    <Image 
                                        source={{ uri: product.image }} 
                                        style={styles.productImage}
                                        resizeMode="cover"
                                    />
                                )}
                                <View style={styles.productInfo}>
                                    <View style={styles.productHeader}>
                                        <Text style={styles.productName}>{product.nom}</Text>
                                        {!readonly && (
                                            <View style={styles.productActions}>
                                                <TouchableOpacity
                                                    style={styles.actionButton}
                                                    onPress={() => handleEditProduct(product)}
                                                >
                                                    <SafeIcon name="edit-2" size={16} color={modernColors.primary} />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.actionButton}
                                                    onPress={() => handleDeleteProduct(product.id)}
                                                >
                                                    <SafeIcon name="trash-2" size={16} color={modernColors.error} />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.productPrice}>
                                        {product.prix} {product.devise}
                                    </Text>
                                    {product.description && (
                                        <Text style={styles.productDescription} numberOfLines={2}>
                                            {product.description}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            ) : (
                <View style={styles.emptyState}>
                    <SafeIcon name="package" size={48} color={modernColors.textSecondary} />
                    <Text style={styles.emptyText}>Aucun produit ajouté</Text>
                    <Text style={styles.emptyHint}>
                        Ajoutez des produits ou services pour enrichir votre offre
                    </Text>
                </View>
            )}

            {/* Boutons d'ajout et d'import */}
            {!readonly && (
                <>
                    <View style={styles.buttonsContainer}>
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={() => setShowAddModal(true)}
                        >
                            <LinearGradient
                                colors={modernColors.primaryGradient}
                                style={styles.addButtonGradient}
                            >
                                <SafeIcon name="plus" size={20} color="#FFFFFF" />
                                <Text style={styles.addButtonText}>Ajouter un produit</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.importButton}
                            onPress={handleImportExcel}
                        >
                            <SafeIcon name="file-text" size={20} color={modernColors.primary} />
                            <Text style={styles.importButtonText}>Importer Excel/CSV</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.hintBox}>
                        <Text style={styles.hintText}>
                            💡 <Text style={styles.hintBold}>Format CSV :</Text> nom,prix,devise,description
                        </Text>
                        <Text style={styles.hintSubText}>
                            Exemple : "Menu du jour,5000,XAF,Plat complet avec boisson"
                        </Text>
                    </View>
                </>
            )}

            {/* Modal d'ajout/modification */}
            <Modal
                visible={showAddModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={handleCancel}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={handleCancel}
                        >
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>
                            {editingProductId ? 'Modifier le produit' : 'Nouveau produit'}
                        </Text>
                        <View style={styles.modalSpacer} />
                    </View>

                    <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>
                                Nom du produit <Text style={styles.required}>*</Text>
                            </Text>
                            <NativeInput
                                placeholder="Ex: Menu du jour"
                                value={newProduct.nom}
                                onChangeText={(text) => setNewProduct({ ...newProduct, nom: text })}
                                style={styles.fieldInput}
                            />
                        </View>

                        <View style={styles.fieldRow}>
                            <View style={[styles.fieldContainer, { flex: 1 }]}>
                                <Text style={styles.fieldLabel}>
                                    Prix <Text style={styles.required}>*</Text>
                                </Text>
                                <NativeInput
                                    placeholder="0"
                                    value={newProduct.prix}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, prix: text })}
                                    style={styles.fieldInput}
                                />
                            </View>

                            <View style={[styles.fieldContainer, { width: 100 }]}>
                                <Text style={styles.fieldLabel}>Devise</Text>
                                <View style={styles.pickerContainer}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {devises.map((devise) => (
                                            <TouchableOpacity
                                                key={devise}
                                                style={[
                                                    styles.deviseButton,
                                                    newProduct.devise === devise && styles.deviseButtonActive
                                                ]}
                                                onPress={() => setNewProduct({ ...newProduct, devise })}
                                            >
                                                <Text style={[
                                                    styles.deviseButtonText,
                                                    newProduct.devise === devise && styles.deviseButtonTextActive
                                                ]}>
                                                    {devise}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Image/Étiquette du produit (optionnel)</Text>
                            <TouchableOpacity
                                style={styles.imagePickerButton}
                                onPress={handlePickImage}
                            >
                                {newProduct.image ? (
                                    <View style={styles.imagePreviewContainer}>
                                        <Image 
                                            source={{ uri: newProduct.image }} 
                                            style={styles.imagePreview}
                                            resizeMode="cover"
                                        />
                                        <View style={styles.imageOverlay}>
                                            <SafeIcon name="camera" size={24} color="#FFFFFF" />
                                            <Text style={styles.imageOverlayText}>Changer l'image</Text>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={styles.imagePlaceholder}>
                                        <SafeIcon name="camera" size={32} color={modernColors.textSecondary} />
                                        <Text style={styles.imagePlaceholderText}>Ajouter une image</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Description (optionnel)</Text>
                            <NativeInput
                                placeholder="Décrivez ce produit..."
                                value={newProduct.description}
                                onChangeText={(text) => setNewProduct({ ...newProduct, description: text })}
                                multiline
                                style={[styles.fieldInput, styles.textareaInput]}
                            />
                        </View>
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        <NativeButton
                            title="Annuler"
                            onPress={handleCancel}
                            variant="secondary"
                            style={{ flex: 1 }}
                        />
                        <NativeButton
                            title={editingProductId ? 'Modifier' : 'Ajouter'}
                            onPress={handleAddProduct}
                            variant="primary"
                            style={{ flex: 1 }}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    productsList: {
        maxHeight: 300,
    },
    productCard: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    productHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    productName: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        flex: 1,
    },
    productActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        padding: 8,
        backgroundColor: modernColors.background,
        borderRadius: 8,
    },
    productPrice: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
        marginBottom: 4,
    },
    productDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
        lineHeight: 16,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginTop: 12,
    },
    emptyHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 4,
    },
    addButton: {
        marginTop: 12,
    },
    addButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        gap: 8,
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    buttonsContainer: {
        marginTop: 12,
        gap: 8,
    },
    importButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        gap: 8,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    importButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    productContent: {
        flexDirection: 'row',
        gap: 12,
    },
    productImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: modernColors.background,
    },
    productInfo: {
        flex: 1,
    },
    imagePickerButton: {
        borderWidth: 2,
        borderColor: modernColors.border,
        borderRadius: 12,
        borderStyle: 'dashed',
        overflow: 'hidden',
    },
    imagePreviewContainer: {
        position: 'relative',
        width: '100%',
        height: 200,
    },
    imagePreview: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    imageOverlayText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    imagePlaceholder: {
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: modernColors.background,
        gap: 8,
    },
    imagePlaceholderText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    modalCloseButton: {
        padding: 8,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    modalSpacer: {
        width: 40,
    },
    modalContent: {
        flex: 1,
        padding: 20,
    },
    fieldContainer: {
        marginBottom: 16,
    },
    fieldRow: {
        flexDirection: 'row',
        gap: 12,
    },
    fieldLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    required: {
        color: modernColors.error,
    },
    fieldInput: {
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: modernColors.text,
    },
    textareaInput: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    pickerContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    deviseButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    deviseButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    deviseButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    deviseButtonTextActive: {
        color: '#FFFFFF',
    },
    hintBox: {
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        padding: 12,
        marginTop: 8,
        borderLeftWidth: 4,
        borderLeftColor: modernColors.primary,
    },
    hintText: {
        fontSize: 12,
        color: modernColors.text,
        lineHeight: 16,
    },
    hintBold: {
        fontWeight: '600',
        color: modernColors.primary,
    },
    hintSubText: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 4,
        fontStyle: 'italic',
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
});

export default ProductManagerMobile;




