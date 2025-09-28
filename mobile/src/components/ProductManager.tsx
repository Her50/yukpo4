import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Card, TextInput, Title } from 'react-native-paper';
import { theme } from '../theme/theme';

interface Product {
    id: string;
    name: string;
    price: string;
    currency: string;
    images: string[];
    videos: string[];
}

interface ProductManagerProps {
    visible: boolean;
    onClose: () => void;
    onSave: (products: Product[]) => void;
    initialProducts?: Product[];
}

const CURRENCIES = [
    { code: 'XAF', name: 'Franc CFA (XAF)', symbol: 'FCFA' },
    { code: 'USD', name: 'Dollar US (USD)', symbol: '$' },
    { code: 'EUR', name: 'Euro (EUR)', symbol: '€' },
    { code: 'GBP', name: 'Livre Sterling (GBP)', symbol: '£' },
    { code: 'CAD', name: 'Dollar Canadien (CAD)', symbol: 'C$' },
    { code: 'JPY', name: 'Yen Japonais (JPY)', symbol: '¥' },
    { code: 'CNY', name: 'Yuan Chinois (CNY)', symbol: '¥' },
    { code: 'INR', name: 'Roupie Indienne (INR)', symbol: '₹' },
    { code: 'BRL', name: 'Real Brésilien (BRL)', symbol: 'R$' },
    { code: 'AUD', name: 'Dollar Australien (AUD)', symbol: 'A$' },
];

const ProductManager: React.FC<ProductManagerProps> = ({
    visible,
    onClose,
    onSave,
    initialProducts = []
}) => {
    const [products, setProducts] = useState<Product[]>(initialProducts);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [showProductForm, setShowProductForm] = useState(false);
    const [showCurrencyModal, setShowCurrencyModal] = useState(false);

    const handleAddProduct = () => {
        const newProduct: Product = {
            id: Date.now().toString(),
            name: '',
            price: '',
            currency: 'XAF',
            images: [],
            videos: []
        };
        setEditingProduct(newProduct);
        setShowProductForm(true);
    };

    const handleEditProduct = (product: Product) => {
        setEditingProduct(product);
        setShowProductForm(true);
    };

    const handleDeleteProduct = (productId: string) => {
        Alert.alert(
            'Supprimer le produit',
            'Êtes-vous sûr de vouloir supprimer ce produit ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: () => {
                        setProducts(prev => prev.filter(p => p.id !== productId));
                    }
                }
            ]
        );
    };

    const handleSaveProduct = (product: Product) => {
        if (!product.name.trim() || !product.price.trim()) {
            Alert.alert('Erreur', 'Veuillez remplir le nom et le prix du produit');
            return;
        }

        const existingIndex = products.findIndex(p => p.id === product.id);
        if (existingIndex >= 0) {
            setProducts(prev => prev.map((p, index) =>
                index === existingIndex ? product : p
            ));
        } else {
            setProducts(prev => [...prev, product]);
        }

        setShowProductForm(false);
        setEditingProduct(null);
    };

    const handleSaveAll = () => {
        onSave(products);
        onClose();
    };

    const formatPrice = (price: string, currency: string) => {
        const currencyInfo = CURRENCIES.find(c => c.code === currency);
        const symbol = currencyInfo?.symbol || currency;
        return `${price} ${symbol}`;
    };

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
                    <Title style={styles.title}>Gestion des Produits</Title>
                </View>

                <ScrollView style={styles.content}>
                    {products.length === 0 ? (
                        <Card style={styles.emptyCard}>
                            <Card.Content style={styles.emptyContent}>
                                <Ionicons name="cube-outline" size={48} color={theme.colors.textSecondary} />
                                <Text style={styles.emptyTitle}>Aucun produit</Text>
                                <Text style={styles.emptyDescription}>
                                    Ajoutez des produits pour votre service
                                </Text>
                            </Card.Content>
                        </Card>
                    ) : (
                        products.map((product) => (
                            <Card key={product.id} style={styles.productCard}>
                                <Card.Content>
                                    <View style={styles.productHeader}>
                                        <View style={styles.productInfo}>
                                            <Text style={styles.productName}>{product.name}</Text>
                                            <Text style={styles.productPrice}>
                                                {formatPrice(product.price, product.currency)}
                                            </Text>
                                        </View>
                                        <View style={styles.productActions}>
                                            <TouchableOpacity
                                                onPress={() => handleEditProduct(product)}
                                                style={styles.actionButton}
                                            >
                                                <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleDeleteProduct(product.id)}
                                                style={styles.actionButton}
                                            >
                                                <Ionicons name="trash-outline" size={20} color="#F44336" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {(product.images.length > 0 || product.videos.length > 0) && (
                                        <View style={styles.mediaInfo}>
                                            <Text style={styles.mediaText}>
                                                📷 {product.images.length} image(s) • 🎥 {product.videos.length} vidéo(s)
                                            </Text>
                                        </View>
                                    )}
                                </Card.Content>
                            </Card>
                        ))
                    )}

                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={handleAddProduct}
                    >
                        <Ionicons name="add" size={24} color="white" />
                        <Text style={styles.addButtonText}>Ajouter un produit</Text>
                    </TouchableOpacity>
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
                        onPress={handleSaveAll}
                        style={styles.saveButton}
                    >
                        Enregistrer ({products.length})
                    </Button>
                </View>
            </View>

            {/* Formulaire de produit */}
            {showProductForm && editingProduct && (
                <ProductForm
                    product={editingProduct}
                    onSave={handleSaveProduct}
                    onCancel={() => {
                        setShowProductForm(false);
                        setEditingProduct(null);
                    }}
                />
            )}
        </Modal>
    );
};

// Composant formulaire de produit
interface ProductFormProps {
    product: Product;
    onSave: (product: Product) => void;
    onCancel: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ product, onSave, onCancel }) => {
    const [formData, setFormData] = useState<Product>(product);
    const [showCurrencyModal, setShowCurrencyModal] = useState(false);

    const handleSave = () => {
        onSave(formData);
    };

    const handleCurrencySelect = (currency: string) => {
        setFormData(prev => ({ ...prev, currency }));
        setShowCurrencyModal(false);
    };

    return (
        <Modal
            visible={true}
            animationType="slide"
            presentationStyle="pageSheet"
        >
            <View style={styles.formContainer}>
                <View style={styles.formHeader}>
                    <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Title style={styles.formTitle}>
                        {product.id ? 'Modifier le produit' : 'Nouveau produit'}
                    </Title>
                </View>

                <ScrollView style={styles.formContent}>
                    <Card style={styles.formCard}>
                        <Card.Content>
                            <TextInput
                                label="Nom du produit"
                                value={formData.name}
                                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                                style={styles.input}
                                mode="outlined"
                            />

                            <View style={styles.priceContainer}>
                                <TextInput
                                    label="Prix"
                                    value={formData.price}
                                    onChangeText={(text) => setFormData(prev => ({ ...prev, price: text }))}
                                    style={styles.priceInput}
                                    mode="outlined"
                                    keyboardType="numeric"
                                />

                                <TouchableOpacity
                                    style={styles.currencyButton}
                                    onPress={() => setShowCurrencyModal(true)}
                                >
                                    <Text style={styles.currencyText}>{formData.currency}</Text>
                                    <Ionicons name="chevron-down" size={16} color={theme.colors.primary} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.mediaSection}>
                                <Text style={styles.sectionTitle}>Médias</Text>
                                <Text style={styles.sectionDescription}>
                                    Images et vidéos du produit (fonctionnalité à implémenter)
                                </Text>
                            </View>
                        </Card.Content>
                    </Card>
                </ScrollView>

                <View style={styles.formFooter}>
                    <Button
                        mode="outlined"
                        onPress={onCancel}
                        style={styles.cancelButton}
                    >
                        Annuler
                    </Button>
                    <Button
                        mode="contained"
                        onPress={handleSave}
                        style={styles.saveButton}
                    >
                        Enregistrer
                    </Button>
                </View>
            </View>

            {/* Modal de sélection de devise */}
            <Modal
                visible={showCurrencyModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowCurrencyModal(false)}
            >
                <View style={styles.currencyContainer}>
                    <View style={styles.currencyHeader}>
                        <TouchableOpacity
                            onPress={() => setShowCurrencyModal(false)}
                            style={styles.closeButton}
                        >
                            <Ionicons name="close" size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                        <Title style={styles.currencyTitle}>Sélectionner une devise</Title>
                    </View>

                    <ScrollView style={styles.currencyList}>
                        {CURRENCIES.map((currency) => (
                            <TouchableOpacity
                                key={currency.code}
                                style={[
                                    styles.currencyItem,
                                    formData.currency === currency.code && styles.currencyItemSelected
                                ]}
                                onPress={() => handleCurrencySelect(currency.code)}
                            >
                                <View style={styles.currencyInfo}>
                                    <Text style={styles.currencyCode}>{currency.code}</Text>
                                    <Text style={styles.currencyName}>{currency.name}</Text>
                                </View>
                                <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                                {formData.currency === currency.code && (
                                    <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </Modal>
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
    emptyCard: {
        marginBottom: 16,
    },
    emptyContent: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginTop: 16,
        marginBottom: 8,
    },
    emptyDescription: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
    },
    productCard: {
        marginBottom: 12,
        elevation: 2,
    },
    productHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 4,
    },
    productPrice: {
        fontSize: 14,
        color: theme.colors.primary,
        fontWeight: '600',
    },
    productActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: '#f8f9fa',
    },
    mediaInfo: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#e9ecef',
    },
    mediaText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primary,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 8,
        marginTop: 16,
    },
    addButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
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
    formContainer: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    formHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    formTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginLeft: 8,
    },
    formContent: {
        flex: 1,
        padding: 16,
    },
    formCard: {
        elevation: 2,
    },
    input: {
        marginBottom: 16,
    },
    priceContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    priceInput: {
        flex: 1,
    },
    currencyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e9ecef',
        minWidth: 80,
    },
    currencyText: {
        fontSize: 14,
        color: theme.colors.text,
        marginRight: 4,
    },
    mediaSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e9ecef',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 4,
    },
    sectionDescription: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    formFooter: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        gap: 12,
    },
    currencyContainer: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    currencyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    currencyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginLeft: 8,
    },
    currencyList: {
        flex: 1,
        padding: 16,
    },
    currencyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 12,
        backgroundColor: 'white',
        borderRadius: 8,
        marginBottom: 8,
        elevation: 1,
    },
    currencyItemSelected: {
        backgroundColor: '#e8f5e8',
        borderWidth: 1,
        borderColor: theme.colors.primary,
    },
    currencyInfo: {
        flex: 1,
    },
    currencyCode: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    currencyName: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginTop: 2,
    },
    currencySymbol: {
        fontSize: 16,
        color: theme.colors.primary,
        fontWeight: '600',
        marginRight: 8,
    },
});

export default ProductManager;



