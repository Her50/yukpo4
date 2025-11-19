import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { apiGet, apiPost } from '@/lib/api';
import { Check, DollarSign, X, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface NegotiatedPriceModalProps {
    isOpen: boolean;
    onClose: () => void;
    conversationId: number;
    serviceId: number;
    productIndex?: number;
    originalPrice: number; // Prix en FCFA
    merchantUserId: number;
    clientUserId: number;
    onPriceNegotiated?: () => void;
}

interface NegotiatedPriceOffer {
    id: number;
    conversation_id: number;
    service_id: number;
    product_index?: number;
    merchant_user_id: number;
    client_user_id: number;
    original_price_cents: number;
    negotiated_price_cents: number;
    status: string;
    expires_at?: string;
    created_at: string;
}

const NegotiatedPriceModal: React.FC<NegotiatedPriceModalProps> = ({
    isOpen,
    onClose,
    conversationId,
    serviceId,
    productIndex,
    originalPrice,
    merchantUserId,
    clientUserId,
    onPriceNegotiated,
}) => {
    const { toast } = useToast();
    const [negotiatedPrice, setNegotiatedPrice] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [pendingOffer, setPendingOffer] = useState<NegotiatedPriceOffer | null>(null);
    const [loadingOffer, setLoadingOffer] = useState(false);
    const [isMerchant, setIsMerchant] = useState(false);

    // Vérifier si l'utilisateur est le prestataire
    useEffect(() => {
        // TODO: Récupérer l'ID de l'utilisateur connecté depuis le contexte/auth
        // Pour l'instant, on suppose que c'est le merchant si on passe merchantUserId
        // Dans la vraie implémentation, comparer avec l'utilisateur connecté
        setIsMerchant(true); // À adapter selon votre système d'auth
    }, []);

    // Charger l'offre en attente
    useEffect(() => {
        if (isOpen && !isMerchant) {
            loadPendingOffer();
        }
    }, [isOpen, isMerchant]);

    const loadPendingOffer = async () => {
        setLoadingOffer(true);
        try {
            const response = await apiGet(
                `/api/negotiated-prices/pending?conversation_id=${conversationId}&service_id=${serviceId}${productIndex !== undefined ? `&product_index=${productIndex}` : ''}`
            );
            if (response.ok) {
                const data = await response.json();
                setPendingOffer(data || null);
            }
        } catch (error) {
            console.error('Erreur chargement offre:', error);
        } finally {
            setLoadingOffer(false);
        }
    };

    const handleCreateOffer = async () => {
        const price = parseFloat(negotiatedPrice);
        if (isNaN(price) || price <= 0) {
            toast({
                title: 'Erreur',
                description: 'Veuillez entrer un prix valide',
                variant: 'destructive',
            });
            return;
        }

        if (price >= originalPrice) {
            toast({
                title: 'Erreur',
                description: 'Le prix négocié doit être inférieur au prix original',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);
        try {
            const response = await apiPost('/api/negotiated-prices', {
                conversation_id: conversationId,
                service_id: serviceId,
                product_index: productIndex,
                original_price_cents: Math.round(originalPrice * 100),
                negotiated_price_cents: Math.round(price * 100),
                expires_in_hours: 24, // Offre valable 24h
            });

            if (response.ok) {
                toast({
                    title: 'Succès',
                    description: 'Offre de prix négocié créée avec succès',
                });
                setNegotiatedPrice('');
                onPriceNegotiated?.();
                onClose();
            } else {
                const error = await response.json();
                toast({
                    title: 'Erreur',
                    description: error.message || 'Erreur lors de la création de l\'offre',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Erreur création offre:', error);
            toast({
                title: 'Erreur',
                description: 'Erreur lors de la création de l\'offre',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptOffer = async () => {
        if (!pendingOffer) return;

        setLoading(true);
        try {
            const response = await apiPost(`/api/negotiated-prices/${pendingOffer.id}/accept`, {});

            if (response.ok) {
                toast({
                    title: 'Succès',
                    description: 'Offre acceptée avec succès',
                });
                setPendingOffer(null);
                onPriceNegotiated?.();
                onClose();
            } else {
                const error = await response.json();
                toast({
                    title: 'Erreur',
                    description: error.message || 'Erreur lors de l\'acceptation de l\'offre',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Erreur acceptation offre:', error);
            toast({
                title: 'Erreur',
                description: 'Erreur lors de l\'acceptation de l\'offre',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleRejectOffer = async () => {
        if (!pendingOffer) return;

        setLoading(true);
        try {
            const response = await apiPost(`/api/negotiated-prices/${pendingOffer.id}/reject`, {});

            if (response.ok) {
                toast({
                    title: 'Offre rejetée',
                    description: 'L\'offre a été rejetée',
                });
                setPendingOffer(null);
                onClose();
            } else {
                const error = await response.json();
                toast({
                    title: 'Erreur',
                    description: error.message || 'Erreur lors du rejet de l\'offre',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Erreur rejet offre:', error);
            toast({
                title: 'Erreur',
                description: 'Erreur lors du rejet de l\'offre',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        {isMerchant ? 'Proposer un prix négocié' : 'Offre de prix négocié'}
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Prix original */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">Prix original</p>
                        <p className="text-lg font-semibold">{originalPrice.toLocaleString('fr-FR')} FCFA</p>
                    </div>

                    {/* Interface prestataire : Créer une offre */}
                    {isMerchant && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Prix négocié (FCFA)
                                </label>
                                <Input
                                    type="number"
                                    value={negotiatedPrice}
                                    onChange={(e) => setNegotiatedPrice(e.target.value)}
                                    placeholder="Ex: 15000"
                                    min="0"
                                    max={originalPrice}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Le prix doit être inférieur au prix original
                                </p>
                            </div>
                            <Button
                                onClick={handleCreateOffer}
                                disabled={loading || !negotiatedPrice}
                                className="w-full"
                            >
                                {loading ? 'Création...' : 'Créer l\'offre'}
                            </Button>
                        </div>
                    )}

                    {/* Interface client : Voir et accepter/rejeter l'offre */}
                    {!isMerchant && (
                        <div className="space-y-4">
                            {loadingOffer ? (
                                <p className="text-center text-gray-500">Chargement...</p>
                            ) : pendingOffer ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <p className="text-sm text-gray-600 mb-2">Prix négocié proposé</p>
                                        <p className="text-2xl font-bold text-blue-600">
                                            {(pendingOffer.negotiated_price_cents / 100).toLocaleString('fr-FR')} FCFA
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Économie : {((pendingOffer.original_price_cents - pendingOffer.negotiated_price_cents) / 100).toLocaleString('fr-FR')} FCFA
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleAcceptOffer}
                                            disabled={loading}
                                            className="flex-1 bg-green-600 hover:bg-green-700"
                                        >
                                            <Check className="w-4 h-4 mr-2" />
                                            Accepter
                                        </Button>
                                        <Button
                                            onClick={handleRejectOffer}
                                            disabled={loading}
                                            variant="outline"
                                            className="flex-1"
                                        >
                                            <XCircle className="w-4 h-4 mr-2" />
                                            Rejeter
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-center text-gray-500">
                                    Aucune offre de prix négocié en attente
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default NegotiatedPriceModal;

