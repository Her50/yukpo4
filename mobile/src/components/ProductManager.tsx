import { DollarSign, Package, Plus } from 'lucide-react-native';
import React, { useState } from 'react';
import ReactNative from 'react-native';
import { Button, Card, IconButton, TextInput } from 'react-native-paper';
import { theme } from '../theme/theme';

const { StyleSheet, Text, TouchableOpacity, View, ScrollView, Alert } = ReactNative;

interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    unit: string;
}

interface ProductManagerProps {
    products?: Product[];
    onProductsChange: (products: Product[]) => void;
    compact?: boolean;
}

const ProductManager: React.FC<ProductManagerProps> = ({ products = [], onProductsChange, compact = false }) => {
    const [showAddForm, setShowAddForm] = useState(false);
    const [newProduct, setNewProduct] = useState({
        name: '',
        description: '',
        price: 0,
        unit: '€'
    });

    const addProduct = () => {
        if (!newProduct.name.trim()) {
            Alert.alert('Erreur', 'Le nom du produit est requis');
            return;
        }

        const product: Product = {
            id: Date.now().toString(),
            ...newProduct
        };

        onProductsChange([...products, product]);
        setNewProduct({ name: '', description: '', price: 0, unit: '€' });
        setShowAddForm(false);
    };

    const removeProduct = (id: string) => {
        onProductsChange(products.filter(p => p.id !== id));
    };

    const updateProduct = (id: string, field: keyof Product, value: any) => {
        onProductsChange(products.map(p =>
            p.id === id ? { ...p, [field]: value } : p
        ));
    };

    const renderProduct = (product: Product) => (
        <Card key={product.id} style={styles.productCard}>
            <Card.Content>
                <View style={styles.productHeader}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <IconButton
                        icon="close"
                        size={16}
                        onPress={() => removeProduct(product.id)}
                        iconColor={theme.colors.error}
                    />
                </View>

                {product.description && (
                    <Text style={styles.productDescription}>{product.description}</Text>
                )}

                <View style={styles.productPrice}>
                    <DollarSign size={16} color={theme.colors.primary} />
                    <Text style={styles.priceText}>
                        {product.price ?? 0} {product.unit ?? '€'}
                    </Text>
                </View>
            </Card.Content>
        </Card>
    );

    if (compact) {
        return (
            <TouchableOpacity style={styles.compactContainer}>
                <Package size={20} color={theme.colors.primary} />
                <Text style={styles.compactText}>{(products || []).length} produits</Text>
            </TouchableOpacity>
        );
    }

    return (
        <Card style={styles.container}>
            <Card.Content>
                <View style={styles.header}>
                    <Text style={styles.title}>Gestion des produits</Text>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => setShowAddForm(!showAddForm)}
                    >
                        <Plus size={16} color={theme.colors.primary} />
                        <Text style={styles.addButtonText}>Ajouter</Text>
                    </TouchableOpacity>
                </View>

                {/* Add Product Form */}
                {showAddForm && (
                    <Card style={styles.addForm}>
                        <Card.Content>
                            <Text style={styles.formTitle}>Nouveau produit</Text>

                            <TextInput
                                label="Nom du produit"
                                value={newProduct.name}
                                onChangeText={(text) => setNewProduct({ ...newProduct, name: text })}
                                mode="outlined"
                                style={styles.input}
                            />

                            <TextInput
                                label="Description (optionnel)"
                                value={newProduct.description}
                                onChangeText={(text) => setNewProduct({ ...newProduct, description: text })}
                                mode="outlined"
                                multiline
                                numberOfLines={2}
                                style={styles.input}
                            />

                            <View style={styles.priceRow}>
                                <TextInput
                                    label="Prix"
                                    value={newProduct.price.toString()}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, price: parseFloat(text) || 0 })}
                                    mode="outlined"
                                    keyboardType="numeric"
                                    style={[styles.input, styles.priceInput]}
                                />

                                <TextInput
                                    label="Unité"
                                    value={newProduct.unit}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, unit: text })}
                                    mode="outlined"
                                    style={[styles.input, styles.unitInput]}
                                />
                            </View>

                            <View style={styles.formActions}>
                                <Button
                                    mode="outlined"
                                    onPress={() => setShowAddForm(false)}
                                    style={styles.cancelButton}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    mode="contained"
                                    onPress={addProduct}
                                    style={styles.saveButton}
                                >
                                    Ajouter
                                </Button>
                            </View>
                        </Card.Content>
                    </Card>
                )}

                {/* Products List */}
                <ScrollView style={styles.productsList}>
                    {(products || []).map(renderProduct)}

                    {(!products || products.length === 0) && (
                        <View style={styles.emptyState}>
                            <Package size={48} color="#E0E0E0" />
                            <Text style={styles.emptyText}>Aucun produit ajouté</Text>
                            <Text style={styles.emptySubtext}>
                                Ajoutez des produits pour définir vos offres
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </Card.Content>
        </Card>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.colors.primary,
        backgroundColor: 'white',
    },
    addButtonText: {
        fontSize: 14,
        color: theme.colors.primary,
        marginLeft: 4,
        fontWeight: '500',
    },
    addForm: {
        marginBottom: 16,
        backgroundColor: '#f8f9fa',
    },
    formTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 16,
    },
    input: {
        backgroundColor: 'white',
        marginBottom: 12,
    },
    priceRow: {
        flexDirection: 'row',
        gap: 12,
    },
    priceInput: {
        flex: 2,
    },
    unitInput: {
        flex: 1,
    },
    formActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    cancelButton: {
        flex: 1,
        marginRight: 8,
    },
    saveButton: {
        flex: 1,
        marginLeft: 8,
    },
    productsList: {
        maxHeight: 300,
    },
    productCard: {
        marginBottom: 8,
        backgroundColor: 'white',
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
        color: theme.colors.text,
        flex: 1,
    },
    productDescription: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginBottom: 8,
    },
    productPrice: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    priceText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.primary,
        marginLeft: 4,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    emptyText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        marginTop: 12,
        marginBottom: 4,
    },
    emptySubtext: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
    },
    compactContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
    },
    compactText: {
        fontSize: 12,
        color: theme.colors.text,
        marginLeft: 4,
    },
});

export default ProductManager;