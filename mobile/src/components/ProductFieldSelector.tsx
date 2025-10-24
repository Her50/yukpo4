import React from 'react';
import EnhancedModalitySelector from './EnhancedModalitySelector';
import MultiSelectModalitySelector from './MultiSelectModalitySelector';

interface ProductFieldSelectorProps {
    label: string;
    fieldName: string;
    productType: string;
    value: string | string[];
    onSelect: (value: any) => void;
    required?: boolean;
    multiSelect?: boolean;
    maxSelections?: number;
    placeholder?: string;
}

/**
 * Composant intelligent pour gérer automatiquement les sélecteurs de modalités
 * Détecte automatiquement si le champ doit être multi-select ou non
 * Remplace les anciennes listes fixes (pickerButtons) par des modalités extensibles
 */
const ProductFieldSelector: React.FC<ProductFieldSelectorProps> = ({
    label,
    fieldName,
    productType,
    value,
    onSelect,
    required = false,
    multiSelect = false,
    maxSelections = 20,
    placeholder
}) => {
    // ✅ Liste des champs qui doivent être en multi-select par défaut
    const MULTI_SELECT_FIELD_PATTERNS = [
        'couleur', 'couleurs', 'color', 'colors',
        'taille', 'tailles', 'size', 'sizes',
        'option', 'options',
        'caracteristique', 'caracteristiques', 'features',
        'service_inclus', 'services_inclus',
        'modalite', 'modalites',
        'langue', 'langues', 'language', 'languages',
        'certification', 'certifications',
        'garantie', 'garanties', 'warranty', 'warranties',
        'style', 'styles',
        'materiau', 'materiaux', 'material', 'materials'
    ];

    // ✅ Détection automatique si le champ doit être multi-select
    const shouldBeMultiSelect = () => {
        // Si explicitement défini, respecter la valeur
        if (multiSelect) return true;

        // Sinon, détecter selon le nom du champ
        const normalizedFieldName = fieldName.toLowerCase().trim();
        return MULTI_SELECT_FIELD_PATTERNS.some(pattern =>
            normalizedFieldName.includes(pattern)
        );
    };

    // ✅ Normaliser la valeur selon le type de sélection
    const normalizeValue = (val: string | string[], isMulti: boolean) => {
        if (isMulti) {
            // Pour multi-select, toujours retourner un array
            if (Array.isArray(val)) return val;
            if (val && typeof val === 'string') return [val];
            return [];
        } else {
            // Pour single-select, toujours retourner une string
            if (Array.isArray(val)) return val[0] || '';
            return val || '';
        }
    };

    const isMulti = shouldBeMultiSelect();
    const normalizedValue = normalizeValue(value, isMulti);

    console.log(`[ProductFieldSelector] Champ "${fieldName}": isMulti=${isMulti}, value=`, normalizedValue);

    if (isMulti) {
        return (
            <MultiSelectModalitySelector
                label={label}
                values={normalizedValue as string[]}
                productType={productType}
                fieldName={fieldName}
                onSelect={(values) => {
                    console.log(`[ProductFieldSelector] Multi-select "${fieldName}" changé:`, values);
                    onSelect(values);
                }}
                required={required}
                placeholder={placeholder || `Sélectionner ${label.toLowerCase()}...`}
                maxSelections={maxSelections}
            />
        );
    }

    return (
        <EnhancedModalitySelector
            label={label}
            value={normalizedValue as string}
            productType={productType}
            fieldName={fieldName}
            onSelect={(val) => {
                console.log(`[ProductFieldSelector] Single-select "${fieldName}" changé:`, val);
                onSelect(val);
            }}
            required={required}
            placeholder={placeholder || `Sélectionner ${label.toLowerCase()}...`}
        />
    );
};

export default ProductFieldSelector;

