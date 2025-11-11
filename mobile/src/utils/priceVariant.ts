export interface PriceVariantModality {
    valeur?: string;
    price?: number;
    prix?: number;
    devise?: string;
    currency?: string;
    stock?: number;
    quantite?: number;
    qty?: number;
    image?: any;
    media?: any;
    [key: string]: any;
}

export interface NormalizedPriceVariant {
    type_donnee: 'price_variant';
    variable: string;
    modalites: Array<{
        valeur: string;
        prix?: number;
        devise?: string;
        stock?: number;
        [key: string]: any;
    }>;
    filtrable?: boolean;
    origine_champs?: string | string[];
    [key: string]: any;
}

const pickModalitesArray = (candidate: any): PriceVariantModality[] | null => {
    if (!candidate) return null;
    if (Array.isArray(candidate.modalites)) return candidate.modalites;
    if (Array.isArray(candidate.valeur)) return candidate.valeur;
    if (Array.isArray(candidate.valeurs)) return candidate.valeurs;
    if (Array.isArray(candidate.options)) return candidate.options;
    if (Array.isArray(candidate.items)) return candidate.items;
    if (candidate.valeur && Array.isArray(candidate.valeur.modalites)) {
        return candidate.valeur.modalites;
    }
    return null;
};

const normalizeModalites = (modalites: PriceVariantModality[] | null | undefined) => {
    if (!Array.isArray(modalites) || modalites.length === 0) {
        return [];
    }

    return modalites
        .map((raw) => {
            if (raw == null || typeof raw === 'boolean') {
                return null;
            }

            if (typeof raw === 'string') {
                return {
                    valeur: raw,
                };
            }

            if (typeof raw === 'number') {
                return {
                    valeur: String(raw),
                };
            }

            if (typeof raw === 'object') {
                const valeur =
                    typeof raw.valeur === 'string'
                        ? raw.valeur
                        : typeof raw.value === 'string'
                            ? raw.value
                            : typeof raw.modalite === 'string'
                                ? raw.modalite
                                : raw.label && typeof raw.label === 'string'
                                    ? raw.label
                                    : raw.name && typeof raw.name === 'string'
                                        ? raw.name
                                        : '';

                const prixValue =
                    typeof raw.prix === 'number'
                        ? raw.prix
                        : typeof raw.price === 'number'
                            ? raw.price
                            : undefined;

                const deviseValue =
                    typeof raw.devise === 'string'
                        ? raw.devise
                        : typeof raw.currency === 'string'
                            ? raw.currency
                            : undefined;

                const stockValue =
                    typeof raw.stock === 'number'
                        ? raw.stock
                        : typeof raw.quantite === 'number'
                            ? raw.quantite
                            : typeof raw.qty === 'number'
                                ? raw.qty
                                : undefined;

                const rest: Record<string, any> = { ...raw };
                return {
                    valeur,
                    prix: prixValue,
                    devise: deviseValue,
                    stock: stockValue,
                    ...rest,
                };
            }

            return null;
        })
        .filter((item) => item !== null) as Array<{
            valeur: string;
            prix?: number;
            devise?: string;
            stock?: number;
            [key: string]: any;
        }>;
};

const pickPriceVariantCandidate = (source: any): any | null => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        return null;
    }

    if (source.type_donnee === 'price_variant' || source.typeDonnee === 'price_variant') {
        return source;
    }

    if (source.price_variant) return source.price_variant;
    if (source.variabilite_prix) return source.variabilite_prix;
    if (source.variation_prix) return source.variation_prix;

    if (source.valeur && typeof source.valeur === 'object') {
        const nested = pickPriceVariantCandidate(source.valeur);
        if (nested) return nested;
    }

    return null;
};

export const extractPriceVariant = (
    source: any,
    fallbackOrigine?: string | string[],
): NormalizedPriceVariant | null => {
    if (!source || Array.isArray(source)) {
        return null;
    }

    const candidate = pickPriceVariantCandidate(source);
    if (!candidate) {
        return null;
    }

    const modalites = normalizeModalites(pickModalitesArray(candidate));
    if (!modalites.length) {
        return null;
    }

    const variable =
        candidate.variable ||
        candidate.dimension ||
        candidate.name ||
        candidate.label ||
        candidate.nom ||
        'variante';

    return {
        type_donnee: 'price_variant',
        variable,
        modalites,
        filtrable: candidate.filtrable !== false,
        origine_champs: candidate.origine_champs || source.origine_champs || fallbackOrigine,
        ...candidate,
        modalites,
        variable,
        type_donnee: 'price_variant',
    };
};

export const applyPriceVariantToProduits = (
    produitsNode: any,
    priceVariant: NormalizedPriceVariant | null | undefined,
) => {
    if (!produitsNode || typeof produitsNode !== 'object' || Array.isArray(produitsNode)) {
        return produitsNode;
    }

    if (!priceVariant) {
        const clone = { ...produitsNode };
        delete clone.variation_prix;
        delete clone.variabilite_prix;
        delete clone.price_variant;
        return clone;
    }

    return {
        ...produitsNode,
        variation_prix: priceVariant,
        variabilite_prix: priceVariant,
        price_variant: priceVariant,
    };
};


