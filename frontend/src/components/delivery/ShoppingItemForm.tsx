import { Button } from '@/components/ui/buttons/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useShopping } from '@/context/ShoppingContext';
import { fetchPopularProducts, PopularProductSuggestion } from '@/services/productSuggestions';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface FormState {
    productName: string;
    quantity: number;
    unit: string;
    estimatedPriceCents?: number;
}

const defaultState: FormState = {
    productName: '',
    quantity: 1,
    unit: 'unité',
    estimatedPriceCents: undefined,
};

export const ShoppingItemForm = () => {
    const { addItem, refreshEstimate } = useShopping();
    const [form, setForm] = useState<FormState>(defaultState);
    const [suggestions, setSuggestions] = useState<PopularProductSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);
    const debounceRef = useRef<number | null>(null);
    const blurTimeoutRef = useRef<number | null>(null);

    const handleChange = (key: keyof FormState, value: string) => {
        setForm(prev => ({
            ...prev,
            [key]:
                key === 'quantity'
                    ? Math.max(1, Number(value) || 1)
                    : key === 'estimatedPriceCents'
                        ? value ? Math.max(0, Math.round(Number(value) * 100)) : undefined
                        : value,
        }));
    };

    const formatSuggestionLabel = useCallback((suggestion: PopularProductSuggestion) => {
        if (suggestion.product_vector?.length) {
            return suggestion.product_vector.filter(Boolean).join(' • ');
        }
        return 'Produit populaire';
    }, []);

    const formatPrice = useCallback((prix?: number | null) => {
        if (typeof prix !== 'number' || Number.isNaN(prix)) {
            return null;
        }
        return prix.toLocaleString('fr-FR', {
            style: 'currency',
            currency: 'XAF',
            maximumFractionDigits: 0,
        });
    }, []);

    const fetchSuggestions = useCallback(
        async (query?: string) => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            const controller = new AbortController();
            abortControllerRef.current = controller;

            setLoadingSuggestions(true);
            setSuggestionError(null);

            try {
                const products = await fetchPopularProducts(query, controller.signal, 8);
                setSuggestions(products);
            } catch (error) {
                if ((error as Error).name === 'AbortError') {
                    return;
                }
                console.error('[ShoppingItemForm] Unable to load product suggestions', error);
                setSuggestionError(
                    (error as Error).message ?? 'Impossible de charger les suggestions produit',
                );
                setSuggestions([]);
            } finally {
                setLoadingSuggestions(false);
            }
        },
        [],
    );

    const handleFocus = useCallback(() => {
        setShowSuggestions(true);
        if (!form.productName.trim()) {
            void fetchSuggestions();
        }
    }, [fetchSuggestions, form.productName]);

    const handleBlur = useCallback(() => {
        blurTimeoutRef.current = window.setTimeout(() => setShowSuggestions(false), 100);
    }, []);

    const handleSelectSuggestion = useCallback(
        (suggestion: PopularProductSuggestion) => {
            if (blurTimeoutRef.current) {
                window.clearTimeout(blurTimeoutRef.current);
            }
            const label = formatSuggestionLabel(suggestion);

            setForm(prev => ({
                ...prev,
                productName: label,
                estimatedPriceCents:
                    typeof suggestion.prix_moyen === 'number' && !Number.isNaN(suggestion.prix_moyen)
                        ? Math.max(0, Math.round(suggestion.prix_moyen * 100))
                        : prev.estimatedPriceCents,
            }));
            setShowSuggestions(false);
        },
        [formatSuggestionLabel],
    );

    useEffect(() => {
        if (!showSuggestions) {
            return;
        }

        if (debounceRef.current) {
            window.clearTimeout(debounceRef.current);
        }

        debounceRef.current = window.setTimeout(() => {
            const query = form.productName.trim();
            if (query.length >= 2) {
                void fetchSuggestions(query);
            } else {
                void fetchSuggestions();
            }
        }, 250);

        return () => {
            if (debounceRef.current) {
                window.clearTimeout(debounceRef.current);
            }
        };
    }, [fetchSuggestions, form.productName, showSuggestions]);

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            if (blurTimeoutRef.current) {
                window.clearTimeout(blurTimeoutRef.current);
            }
            if (debounceRef.current) {
                window.clearTimeout(debounceRef.current);
            }
        };
    }, []);

    const shouldRenderSuggestions = useMemo(
        () =>
            showSuggestions &&
            (loadingSuggestions || suggestionError || suggestions.length > 0),
        [loadingSuggestions, showSuggestions, suggestionError, suggestions.length],
    );

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!form.productName.trim()) {
            return;
        }

        addItem({
            productName: form.productName.trim(),
            quantity: form.quantity,
            unit: form.unit,
            estimatedPriceCents: form.estimatedPriceCents,
        });
        setForm(defaultState);
        await refreshEstimate();
    };

    return (
        <form className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm" onSubmit={handleSubmit}>
            <div className="grid gap-2">
                <Label htmlFor="productName">Produit ou description</Label>
                <div className="relative">
                    <Input
                        id="productName"
                        placeholder="Ex : Tomates fraîches 1kg"
                        value={form.productName}
                        required
                        autoComplete="off"
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onChange={event => handleChange('productName', event.target.value)}
                    />

                    {shouldRenderSuggestions ? (
                        <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-lg border border-slate-200 bg-white shadow-xl">
                            {loadingSuggestions ? (
                                <div className="px-4 py-3 text-sm text-slate-500">
                                    Recherche des produits populaires…
                                </div>
                            ) : suggestionError ? (
                                <div className="px-4 py-3 text-sm text-amber-600">
                                    {suggestionError}
                                </div>
                            ) : suggestions.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-slate-500">
                                    Aucun produit correspondant pour le moment.
                                </div>
                            ) : (
                                <ul className="max-h-64 overflow-y-auto py-1">
                                    {suggestions.map(suggestion => {
                                        const label = formatSuggestionLabel(suggestion);
                                        const priceLabel = formatPrice(suggestion.prix_moyen);
                                        return (
                                            <li key={`${label}-${suggestion.usage_count}`}>
                                                <button
                                                    type="button"
                                                    className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                                                    onMouseDown={event => {
                                                        event.preventDefault();
                                                        handleSelectSuggestion(suggestion);
                                                    }}
                                                >
                                                    <span className="text-sm font-medium text-slate-900">
                                                        {label}
                                                    </span>
                                                    <span className="flex items-center gap-2 text-xs text-slate-500">
                                                        <span>{suggestion.usage_count} commandes Yukpo</span>
                                                        {suggestion.is_trending ? (
                                                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-600">
                                                                Tendance
                                                            </span>
                                                        ) : null}
                                                        {priceLabel ? (
                                                            <span className="font-semibold text-slate-700">
                                                                {priceLabel}
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                    <Label htmlFor="quantity">Quantité</Label>
                    <Input
                        id="quantity"
                        type="number"
                        min={1}
                        value={form.quantity}
                        onChange={event => handleChange('quantity', event.target.value)}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="unit">Unité</Label>
                    <Input
                        id="unit"
                        placeholder="unité, sachet, kg…"
                        value={form.unit}
                        onChange={event => handleChange('unit', event.target.value)}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="estimatedPrice">Prix estimé (optionnel)</Label>
                    <Input
                        id="estimatedPrice"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="3 500"
                        value={form.estimatedPriceCents ? (form.estimatedPriceCents / 100).toString() : ''}
                        onChange={event => handleChange('estimatedPriceCents', event.target.value)}
                    />
                </div>
            </div>

            <div className="flex justify-end">
                <Button type="submit">Ajouter au panier</Button>
            </div>
        </form>
    );
};

export default ShoppingItemForm;


