import CourierSelectionModal from '@/components/delivery/CourierSelectionModal';
import DeliveryChatPanel from '@/components/delivery/DeliveryChatPanel';
import DeliveryLiveMap from '@/components/delivery/DeliveryLiveMap';
import DeliveryTimeline from '@/components/delivery/DeliveryTimeline';
import ProofMediaUpload from '@/components/delivery/ProofMediaUpload';
import ShoppingItemsList from '@/components/delivery/ShoppingItemsList';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons/Button';
import { useToast } from '@/components/ui/use-toast';
import useDeliveryTracking from '@/hooks/useDeliveryTracking';
import { useUser } from '@/hooks/useUser';
import { updateRecipientLocation } from '@/services/deliveryApi';
import formatCurrency from '@/utils/formatCurrency';
import { Navigation2, UserPlus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

const DeliveryTrackingPage: React.FC = () => {
    const { deliveryId } = useParams<{ deliveryId: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useUser();
    const { delivery, events, timeline, lastEvent, refresh, loading } = useDeliveryTracking(deliveryId ?? null);
    const [showCourierModal, setShowCourierModal] = useState(false);

    // Vérifier si l'utilisateur est le créateur de la livraison
    const isCreator = user && delivery && delivery.creator_id && String(delivery.creator_id) === String(user.id);
    const canAssignCourier = isCreator && !delivery?.courier && (delivery?.status === 'pending' || delivery?.status === 'awaiting_courier');

    // ✅ Phase 9 - Amélioration : Vérifier si l'utilisateur est le coursier
    const isCourier = user && delivery?.courier?.id && String(delivery.courier.id) === String(user.id);

    // ✅ Phase 9 - Amélioration : Déterminer si on peut ajouter des médias de pickup
    const canAddPickupMedia = isCourier && (
        delivery?.status === 'en_route_pickup' ||
        delivery?.status === 'shopping_completed' ||
        delivery?.status === 'en_route_delivery' ||
        delivery?.status === 'delivered'
    );

    // ✅ Phase 9 - Amélioration : Déterminer si on peut ajouter des médias de delivery
    const canAddDeliveryMedia = isCourier && (
        delivery?.status === 'en_route_delivery' ||
        delivery?.status === 'delivered'
    );

    useEffect(() => {
        if (deliveryId) {
            refresh({ force: true }).catch(console.error);
        }
    }, [deliveryId, refresh]);

    // ✅ Phase 9 - Amélioration 29 : Notification toast quand adresse confirmée
    useEffect(() => {
        if (lastEvent?.type === 'dropoff_address_provided') {
            toast({
                title: '📍 Adresse de livraison confirmée',
                description: 'Le client a fourni son adresse de livraison. La livraison peut maintenant être assignée à un coursier.',
            });
        }
    }, [lastEvent, toast]);

    if (!deliveryId) {
        return (
            <AppLayout>
                <div className="mx-auto max-w-3xl px-4 py-16 text-center">
                    <p className="text-sm text-slate-500">
                        Aucun identifiant de livraison fourni.
                    </p>
                    <Button className="mt-4" onClick={() => navigate('/delivery')}>
                        Retour à la livraison
                    </Button>
                </div>
            </AppLayout>
        );
    }

    if (!delivery && loading) {
        return (
            <AppLayout>
                <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-slate-500">
                    Chargement du suivi en cours…
                </div>
            </AppLayout>
        );
    }

    if (!delivery) {
        return (
            <AppLayout>
                <div className="mx-auto max-w-3xl px-4 py-16 text-center">
                    <p className="text-sm text-slate-500">
                        Impossible de trouver cette livraison.
                    </p>
                    <Button className="mt-4" onClick={() => navigate('/delivery')}>
                        Retour à la livraison
                    </Button>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="mx-auto max-w-4xl space-y-8 px-4 pb-16 pt-6">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm text-slate-500">Livraison #{delivery.id.slice(-6)}</p>
                        <h1 className="text-2xl font-semibold text-slate-900">
                            Suivi en temps réel
                        </h1>
                    </div>
                    <Button variant="ghost" onClick={() => refresh({ force: true })}>
                        Rafraîchir
                    </Button>
                </header>

                <section className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900">Résumé livraison</h2>
                            {/* ✅ Phase 9 - Amélioration 28 : Bouton pour choisir un livreur */}
                            {canAssignCourier && (
                                <Button
                                    size="sm"
                                    onClick={() => setShowCourierModal(true)}
                                    className="flex items-center gap-2"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Choisir un livreur
                                </Button>
                            )}
                        </div>
                        <p className="text-sm text-slate-600">Statut actuel : <span className="font-semibold text-slate-900">{delivery.status}</span></p>
                        <p className="text-sm text-slate-600">
                            Point de retrait : {delivery.pickup.label ?? 'Non précisé'}
                        </p>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <p className="text-sm text-slate-600">
                                    Destinataire : {delivery.dropoff.label ?? delivery.recipient?.name ?? 'Non précisé'}
                                </p>
                                {/* ✅ Phase 9 - Amélioration 30 : Badge "Adresse à confirmer" si dropoff pending */}
                                {delivery.metadata?.dropoff_pending === true && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                                        <Navigation2 className="w-3 h-3" />
                                        Adresse à confirmer
                                    </span>
                                )}
                            </div>
                            {/* ✅ Phase 9 - Amélioration 30 : Bouton "Modifier l'adresse" toujours visible */}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                    if (!deliveryId) return;

                                    // Utiliser la géolocalisation du navigateur
                                    if (navigator.geolocation) {
                                        navigator.geolocation.getCurrentPosition(
                                            async (position) => {
                                                try {
                                                    await updateRecipientLocation(deliveryId, {
                                                        latitude: position.coords.latitude,
                                                        longitude: position.coords.longitude,
                                                        address: undefined, // L'adresse sera géocodée côté backend
                                                    });
                                                    toast({
                                                        title: '✅ Adresse mise à jour',
                                                        description: 'Votre position a été mise à jour avec succès',
                                                    });
                                                    refresh({ force: true }).catch(console.error);
                                                } catch (error: any) {
                                                    toast({
                                                        title: 'Erreur',
                                                        description: error.message || 'Impossible de mettre à jour l\'adresse',
                                                    });
                                                }
                                            },
                                            (error) => {
                                                toast({
                                                    title: 'Erreur de géolocalisation',
                                                    description: 'Veuillez autoriser l\'accès à votre position ou utiliser le lien de partage',
                                                });
                                            }
                                        );
                                    } else {
                                        toast({
                                            title: 'Géolocalisation non disponible',
                                            description: 'Votre navigateur ne supporte pas la géolocalisation',
                                        });
                                    }
                                }}
                                className="text-xs"
                            >
                                <Navigation2 className="w-3 h-3 mr-1" />
                                Modifier l'adresse
                            </Button>
                        </div>
                        {delivery.courier?.name && (
                            <p className="text-sm text-slate-600">
                                Coursier : <span className="font-semibold">{delivery.courier.name}</span>
                            </p>
                        )}
                        {delivery.pricing?.finalTotal ?? delivery.pricing?.estimatedTotal ? (
                            <p className="text-sm text-slate-600">
                                Montant :{' '}
                                {formatCurrency(
                                    (delivery.pricing.finalTotal ?? delivery.pricing.estimatedTotal ?? 0),
                                    delivery.pricing.currency ?? 'XAF',
                                )}
                            </p>
                        ) : null}
                        <Link
                            to="/chat/support"
                            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                            <Navigation2 className="h-4 w-4" />
                            Contacter le support
                        </Link>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-900">Timeline</h2>
                        <div className="mt-4 max-h-80 overflow-y-auto pr-2">
                            <DeliveryTimeline checkpoints={timeline} />
                        </div>
                    </div>
                </section>

                {/* ✅ Phase 9 - Amélioration : Affichage des items de shopping avec possibilité de refus */}
                {delivery.shopping?.items && delivery.shopping.items.length > 0 && (
                    <section>
                        <ShoppingItemsList
                            items={delivery.shopping.items}
                            orderId={delivery.orderId || delivery.id}
                            currency={delivery.shopping.currency}
                            onItemUpdated={() => refresh({ force: true })}
                            canReject={
                                delivery.status === 'shopping_completed' ||
                                delivery.status === 'en_route_delivery' ||
                                delivery.status === 'delivered'
                            }
                        />
                    </section>
                )}

                {/* ✅ Phase 9 - Amélioration : Médias de preuve de récupération et livraison */}
                {isCourier && (canAddPickupMedia || canAddDeliveryMedia) && (
                    <section className="space-y-4">
                        {canAddPickupMedia && (
                            <ProofMediaUpload
                                deliveryId={delivery.id}
                                proofType="pickup"
                                isCourier={true}
                                onMediaUpdated={() => refresh({ force: true })}
                            />
                        )}
                        {canAddDeliveryMedia && (
                            <ProofMediaUpload
                                deliveryId={delivery.id}
                                proofType="delivery"
                                isCourier={true}
                                onMediaUpdated={() => refresh({ force: true })}
                            />
                        )}
                    </section>
                )}

                {/* ✅ Phase 9 - Amélioration : Affichage des médias de preuve pour le client/créateur */}
                {(isCreator || delivery?.recipient?.id) && (
                    <section className="space-y-4">
                        <ProofMediaUpload
                            deliveryId={delivery.id}
                            proofType="pickup"
                            isCourier={false}
                            onMediaUpdated={() => refresh({ force: true })}
                        />
                        <ProofMediaUpload
                            deliveryId={delivery.id}
                            proofType="delivery"
                            isCourier={false}
                            onMediaUpdated={() => refresh({ force: true })}
                        />
                    </section>
                )}

                <section className="grid gap-4 lg:grid-cols-2">
                    <DeliveryLiveMap delivery={delivery} events={events} />
                    <DeliveryChatPanel
                        deliveryId={delivery.id}
                        courierName={delivery.courier?.name}
                        recipientName={delivery.recipient?.name}
                    />
                </section>

                <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => navigate('/delivery')}>
                        Retour
                    </Button>
                    <Button variant="outline" onClick={() => refresh({ force: true })}>
                        Actualiser
                    </Button>
                </div>
            </div>

            {/* ✅ Phase 9 - Amélioration 28 : Modal de sélection de coursier */}
            {deliveryId && (
                <CourierSelectionModal
                    isOpen={showCourierModal}
                    onClose={() => setShowCourierModal(false)}
                    deliveryId={deliveryId}
                    onSuccess={() => {
                        refresh({ force: true }).catch(console.error);
                    }}
                />
            )}
        </AppLayout>
    );
};

export default DeliveryTrackingPage;


