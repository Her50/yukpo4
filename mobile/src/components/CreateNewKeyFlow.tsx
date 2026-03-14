// @ts-nocheck
/**
 * 🎯 FLUX DE CRÉATION DE NOUVELLE CLÉ
 * 
 * Gère intelligemment les 3 scénarios :
 * 1. Détection automatique claire (confidence >= 80%)
 * 2. Ambiguïté (proposer choix)
 * 3. Aucune détection (sélecteur manuel)
 */

import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CategoryDetectionResult, detectCategoryFromQuery } from '../utils/categoryDetector';

// Import dynamique des formulaires spécialisés
const FORM_COMPONENTS = {
  FormAutoAutomobile: () => import('./forms/FormAutoAutomobile'),
  FormAutoTelephone: () => import('./forms/FormAutoTelephone'),
  FormAutoAgriculture: () => import('./forms/FormAutoAgriculture'),
  FormAutoImmobilier: () => import('./forms/FormAutoImmobilier'),
  // ... 60 formulaires
};

interface CreateNewKeyFlowProps {
  query: string;                    // Ce que l'utilisateur a tapé
  onKeyCreated: (key: any) => void; // Callback après création
  onCancel: () => void;             // Annulation
}

export function CreateNewKeyFlow({ query, onKeyCreated, onCancel }: CreateNewKeyFlowProps) {
  const [detection, setDetection] = useState<CategoryDetectionResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [FormComponent, setFormComponent] = useState<React.ComponentType<any> | null>(null);

  // Détection automatique au montage
  useEffect(() => {
    const detected = detectCategoryFromQuery(query);
    setDetection(detected);

    console.log(`🔍 [CreateNewKey] Détection pour "${query}":`, detected);

    // Si haute confiance, sélectionner automatiquement
    if (detected.confidence >= 80 && detected.category_code !== 'UNKNOWN') {
      handleCategorySelect(detected.category_code, detected.form_component);
    }
  }, [query]);

  // Charger le composant formulaire
  const handleCategorySelect = async (categoryCode: string, formComponent: string) => {
    setSelectedCategory(categoryCode);

    try {
      const module = await FORM_COMPONENTS[formComponent as keyof typeof FORM_COMPONENTS]();
      setFormComponent(() => module.default);
    } catch (error) {
      console.error(`[CreateNewKey] Erreur chargement ${formComponent}:`, error);
    }
  };

  // CAS 1 : Détection automatique claire (confidence >= 80%)
  if (detection && detection.confidence >= 80 && !detection.alternatives && selectedCategory) {
    return (
      <Modal visible animationType="slide">
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>✨ Nouvelle clé détectée</Text>
            <Text style={styles.headerSubtitle}>
              Catégorie : {detection.category_name}
            </Text>
          </View>

          {/* Info détection */}
          <View style={styles.detectionInfo}>
            <Text style={styles.detectionText}>
              ✅ Détection automatique ({detection.confidence}% confiance)
            </Text>
            <Text style={styles.queryText}>"{query}"</Text>
          </View>

          {/* Formulaire spécialisé */}
          {FormComponent && (
            <FormComponent
              initialQuery={query}
              onSubmit={(data: any) => {
                onKeyCreated(data);
              }}
              onCancel={onCancel}
            />
          )}
        </View>
      </Modal>
    );
  }

  // CAS 2 : Ambiguïté (proposer choix entre alternatives)
  if (detection && detection.alternatives && detection.alternatives.length > 0 && !selectedCategory) {
    return (
      <Modal visible animationType="slide">
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🤔 Plusieurs catégories possibles</Text>
            <Text style={styles.headerSubtitle}>Choisissez la catégorie appropriée</Text>
          </View>

          <View style={styles.queryContainer}>
            <Text style={styles.queryLabel}>Vous cherchez :</Text>
            <Text style={styles.queryText}>"{query}"</Text>
          </View>

          {/* Liste des catégories suggérées */}
          <View style={styles.categoriesList}>
            {/* Catégorie principale */}
            <TouchableOpacity
              style={[styles.categoryCard, styles.categoryCardPrimary]}
              onPress={() => handleCategorySelect(detection.category_code, detection.form_component)}
            >
              <Text style={styles.categoryBadge}>RECOMMANDÉ</Text>
              <Text style={styles.categoryTitle}>{formatCategoryName(detection.category_name)}</Text>
              <Text style={styles.categoryConfidence}>{detection.confidence}% de confiance</Text>
              <Text style={styles.categoryExample}>
                Ex: {getCategoryExample(detection.category_code)}
              </Text>
            </TouchableOpacity>

            {/* Alternatives */}
            {detection.alternatives.map((alt, index) => (
              <TouchableOpacity
                key={index}
                style={styles.categoryCard}
                onPress={() => handleCategorySelect(alt.category_code, alt.form_component)}
              >
                <Text style={styles.categoryTitle}>{formatCategoryName(alt.category_name)}</Text>
                <Text style={styles.categoryConfidence}>{alt.confidence}% de confiance</Text>
                <Text style={styles.categoryExample}>
                  Ex: {getCategoryExample(alt.category_code)}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Option "Autre catégorie" */}
            <TouchableOpacity
              style={[styles.categoryCard, styles.categoryCardOther]}
              onPress={() => setSelectedCategory('MANUAL')}
            >
              <Text style={styles.categoryTitle}>📋 Autre catégorie</Text>
              <Text style={styles.categoryDescription}>Choisir manuellement</Text>
            </TouchableOpacity>
          </View>

          {/* Bouton annuler */}
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  // CAS 3 : Aucune détection (sélecteur manuel complet)
  if ((detection && detection.confidence < 80) || selectedCategory === 'MANUAL') {
    return <CategorySelectorManual query={query} onSelect={handleCategorySelect} onCancel={onCancel} />;
  }

  // Loading
  return (
    <View style={styles.loading}>
      <Text>Détection en cours...</Text>
    </View>
  );
}

/**
 * Sélecteur manuel de catégorie (CAS 3)
 */
function CategorySelectorManual({
  query,
  onSelect,
  onCancel
}: {
  query: string;
  onSelect: (code: string, form: string) => void;
  onCancel: () => void;
}) {
  const [searchCategory, setSearchCategory] = useState('');

  // Liste de toutes les catégories disponibles
  const CATEGORIES_LIST = [
    { code: 'AUTO', name: 'Automobile', icon: '🚗', form: 'FormAutoAutomobile' },
    { code: 'MOTO', name: 'Moto', icon: '🏍️', form: 'FormAutoMoto' },
    { code: 'TEL', name: 'Téléphone', icon: '📱', form: 'FormAutoTelephone' },
    { code: 'PC', name: 'Ordinateur', icon: '💻', form: 'FormAutoOrdinateur' },
    { code: 'ELEC', name: 'Électroménager', icon: '⚡', form: 'FormAutoElectromenager' },
    { code: 'AGRI', name: 'Agriculture', icon: '🌾', form: 'FormAutoAgriculture' },
    { code: 'IMMO', name: 'Immobilier', icon: '🏠', form: 'FormAutoImmobilier' },
    { code: 'TERR', name: 'Terrain', icon: '🏞️', form: 'FormAutoTerrain' },
    { code: 'VET', name: 'Vêtement', icon: '👕', form: 'FormAutoVetement' },
    { code: 'CHAUS', name: 'Chaussure', icon: '👟', form: 'FormAutoChaussure' },
    { code: 'EMPL', name: 'Emploi', icon: '💼', form: 'FormAutoEmploi' },
    { code: 'FORM', name: 'Formation', icon: '📚', form: 'FormAutoFormation' },
    // ... 50+ autres catégories
  ];

  const filteredCategories = CATEGORIES_LIST.filter(cat =>
    cat.name.toLowerCase().includes(searchCategory.toLowerCase())
  );

  return (
    <Modal visible animationType="slide">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📋 Choisir une catégorie</Text>
          <Text style={styles.headerSubtitle}>Pour : "{query}"</Text>
        </View>

        {/* Recherche catégorie */}
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher une catégorie..."
          value={searchCategory}
          onChangeText={setSearchCategory}
        />

        {/* Grille de catégories */}
        <ScrollView style={styles.categoriesGrid}>
          {filteredCategories.map((cat) => (
            <TouchableOpacity
              key={cat.code}
              style={styles.categoryTile}
              onPress={() => onSelect(cat.code, cat.form)}
            >
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
              <Text style={styles.categoryName}>{cat.name}</Text>
              <Text style={styles.categoryCode}>{cat.code}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

/**
 * Helpers
 */
function formatCategoryName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function getCategoryExample(code: string): string {
  const examples: Record<string, string> = {
    'AUTO': 'Toyota Corolla, Peugeot 308...',
    'TEL': 'iPhone 14, Samsung Galaxy...',
    'AGRI': 'Riz Vietnam, Maïs...',
    'IMMO': 'Villa 4 chambres, Appartement...',
    'EMPL': 'Développeur, Comptable...',
    'FORM': 'Cours Anglais, Formation Excel...',
  };
  return examples[code] || 'Exemples variés';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#6366F1',
    padding: 20,
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E0E7FF',
    marginTop: 4,
  },
  detectionInfo: {
    backgroundColor: '#DBEAFE',
    padding: 16,
    margin: 16,
    borderRadius: 8,
  },
  detectionText: {
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '600',
  },
  queryContainer: {
    padding: 16,
  },
  queryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  queryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  categoriesList: {
    padding: 16,
  },
  categoryCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  categoryCardPrimary: {
    borderColor: '#6366F1',
    backgroundColor: '#F5F3FF',
  },
  categoryCardOther: {
    borderStyle: 'dashed',
  },
  categoryBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6366F1',
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  categoryConfidence: {
    fontSize: 12,
    color: '#10B981',
    marginBottom: 8,
  },
  categoryExample: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  categoryDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  cancelButton: {
    margin: 16,
    padding: 16,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontWeight: '600',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Sélecteur manuel
  searchInput: {
    margin: 16,
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoriesGrid: {
    flex: 1,
    padding: 8,
  },
  categoryTile: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
    margin: 8,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  categoryCode: {
    fontSize: 10,
    color: '#9CA3AF',
  },
});

