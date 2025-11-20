/**
 * OrderManagementPage - Dashboard prestataire pour gérer les commandes
 * Tableau avec filtres par statut, actions : Valider / Rejeter
 */

import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useUser } from '@/hooks/useUser';
import { apiService } from '@/services/apiService';
import {
    AlertCircle,
    Calendar,
    CheckCircle,
    Clock,
    Filter,
    RefreshCw,
    XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Order {
    id: string;
    delivery_id?: string;
    service_id: number;
    product_index: number;
    client_user_id: number;
    provider_user_id: number;
    status: 'pending' | 'validated' | 'ready' | 'rejected' | 'cancelled';
    preparation_time_minutes?: number;
    estimated_ready_at?: string;
    validated_at?: string;
    validated_by?: number;
    rejected_at?: string;
    rejection_reason?: string;
    validation_deadline?: string;
    created_at: string;
    updated_at: string;
}

const STATUS_LABELS: Record<string, string> = {
    pending: 'En attente',
    validated: 'Validée',
    ready: 'Prête',
    rejected: 'Rejetée',
    cancelled: 'Annulée',
};

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    validated: 'bg-blue-100 text-blue-800 border-blue-300',
    ready: 'bg-green-100 text-green-800 border-green-300',
    rejected: 'bg-red-100 text-red-800 border-red-300',
    cancelled: 'bg-gray-100 text-gray-800 border-gray-300',
};

const OrderManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useUser();
    const { toast } = useToast();

    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [validatingOrderId, setValidatingOrderId] = useState<string | null>(null);
    const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);

    useEffect(() => {
        if (user?.id) {
            loadOrders();
        }
    }, [user?.id, filterStatus]);

    const loadOrders = async () => {
        try {
            setLoading(true);
            const response = await apiService('/api/delivery/orders/provider/pending', {
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error('Erreur lors du chargement des commandes');
            }

            const data = await response.json();
            let ordersData = data.orders || [];

            // Filtrer par statut
            if (filterStatus !== 'all') {
                ordersData = ordersData.filter((o: Order) => o.status === filterStatus);
            }

            setOrders(ordersData);
        } catch (error: any) {
            console.error('[OrderManagementPage] Erreur:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Erreur lors du chargement des commandes',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleValidate = async (order: Order) => {
        try {
            setValidatingOrderId(order.id);
            const response = await apiService(`/api/delivery/orders/${order.id}/validate`, {
                method: 'POST',
                body: JSON.stringify({}),
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la validation');
            }

            toast({
                title: 'Succès',
                description: 'Commande validée avec succès',
            });

            loadOrders();
        } catch (error: any) {
            toast({
                title: 'Erreur',
                description: error.message || 'Erreur lors de la validation',
                variant: 'destructive',
            });
        } finally {
            setValidatingOrderId(null);
        }
    };

    const handleReject = (order: Order) => {
        setSelectedOrder(order);
        setRejectReason('');
        setShowRejectModal(true);
    };

    const confirmReject = async () => {
        if (!selectedOrder || !rejectReason.trim()) {
            toast({
                title: 'Erreur',
                description: 'Veuillez indiquer une raison de rejet',
                variant: 'destructive',
            });
            return;
        }

        try {
            setRejectingOrderId(selectedOrder.id);
            const response = await apiService(`/api/delivery/orders/${selectedOrder.id}/reject`, {
                method: 'POST',
                body: JSON.stringify({ reason: rejectReason }),
            });

            if (!response.ok) {
                throw new Error('Erreur lors du rejet');
            }

            toast({
                title: 'Succès',
                description: 'Commande rejetée',
            });

            setShowRejectModal(false);
            setSelectedOrder(null);
            setRejectReason('');
            loadOrders();
        } catch (error: any) {
            toast({
                title: 'Erreur',
                description: error.message || 'Erreur lors du rejet',
                variant: 'destructive',
            });
        } finally {
            setRejectingOrderId(null);
        }
    };

    const formatDate = (dateString?: string): string => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateString;
        }
    };

    const filteredOrders = orders.filter((order) => {
        if (filterStatus === 'all') return true;
        return order.status === filterStatus;
    });

    return (
        <AppLayout>
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestion des commandes</h1>
                        <p className="text-gray-600">Gérez vos commandes en attente</p>
                    </div>
                    <Button
                        onClick={loadOrders}
                        variant="outline"
                        disabled={loading}
                        aria-label="Actualiser la liste des commandes"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'Actualisation...' : 'Actualiser'}
                    </Button>
                </div>

                {/* Filtres */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="w-5 h-5" />
                            Filtres
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtres par statut">
                            {['all', 'pending', 'validated', 'ready', 'rejected', 'cancelled'].map((status) => (
                                <Button
                                    key={status}
                                    variant={filterStatus === status ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setFilterStatus(status)}
                                    aria-label={`Filtrer par ${STATUS_LABELS[status] || status}`}
                                    aria-pressed={filterStatus === status}
                                >
                                    {STATUS_LABELS[status] || status}
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Liste des commandes */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-4 text-gray-600">Chargement...</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <Card>
                        <CardContent className="text-center py-12">
                            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600 text-lg">Aucune commande trouvée</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {filteredOrders.map((order) => (
                            <Card key={order.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-lg font-semibold">
                                                    Commande #{order.id.slice(0, 8)}
                                                </h3>
                                                <Badge className={STATUS_COLORS[order.status]}>
                                                    {STATUS_LABELS[order.status] || order.status}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-gray-600">
                                                Service ID: {order.service_id} • Produit: {order.product_index}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Créée le {formatDate(order.created_at)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Informations */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        {order.preparation_time_minutes && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Clock className="w-4 h-4 text-gray-500" />
                                                <span>Temps préparation: {order.preparation_time_minutes} min</span>
                                            </div>
                                        )}
                                        {order.estimated_ready_at && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Calendar className="w-4 h-4 text-gray-500" />
                                                <span>Prêt le: {formatDate(order.estimated_ready_at)}</span>
                                            </div>
                                        )}
                                        {order.validation_deadline && (
                                            <div className="flex items-center gap-2 text-sm text-yellow-600">
                                                <AlertCircle className="w-4 h-4" />
                                                <span>Délai: {formatDate(order.validation_deadline)}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    {order.status === 'pending' && (
                                        <div className="flex gap-2 mt-4" role="group" aria-label="Actions sur la commande">
                                            <Button
                                                onClick={() => handleValidate(order)}
                                                className="bg-green-600 hover:bg-green-700"
                                                disabled={validatingOrderId === order.id || rejectingOrderId === order.id}
                                                aria-label="Valider la commande"
                                            >
                                                {validatingOrderId === order.id ? (
                                                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <CheckCircle className="w-4 h-4 mr-2" />
                                                )}
                                                {validatingOrderId === order.id ? 'Validation...' : 'Valider'}
                                            </Button>
                                            <Button
                                                onClick={() => handleReject(order)}
                                                variant="destructive"
                                                disabled={validatingOrderId === order.id || rejectingOrderId === order.id}
                                                aria-label="Rejeter la commande"
                                            >
                                                {rejectingOrderId === order.id ? (
                                                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <XCircle className="w-4 h-4 mr-2" />
                                                )}
                                                {rejectingOrderId === order.id ? 'Rejet...' : 'Rejeter'}
                                            </Button>
                                            <Button
                                                onClick={() => navigate(`/order/${order.id}`)}
                                                variant="outline"
                                                aria-label="Voir les détails de la commande"
                                            >
                                                Voir détails
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Modal rejet */}
                {showRejectModal && selectedOrder && (
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="reject-modal-title"
                        aria-describedby="reject-modal-description"
                    >
                        <Card className="w-full max-w-md">
                            <CardHeader>
                                <CardTitle id="reject-modal-title">Rejeter la commande</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p id="reject-modal-description" className="text-sm text-gray-600 mb-4">
                                    Veuillez indiquer la raison du rejet
                                </p>
                                <textarea
                                    className="w-full p-3 border rounded-lg mb-4 min-h-[100px]"
                                    placeholder="Raison du rejet..."
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    aria-label="Raison du rejet"
                                    aria-required="true"
                                />
                                <div className="flex gap-2" role="group" aria-label="Actions du modal de rejet">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setShowRejectModal(false);
                                            setSelectedOrder(null);
                                            setRejectReason('');
                                        }}
                                        className="flex-1"
                                        aria-label="Annuler le rejet"
                                    >
                                        Annuler
                                    </Button>
                                    <Button
                                        onClick={confirmReject}
                                        variant="destructive"
                                        className="flex-1"
                                        disabled={rejectingOrderId === selectedOrder?.id}
                                        aria-label="Confirmer le rejet"
                                    >
                                        {rejectingOrderId === selectedOrder?.id ? (
                                            <>
                                                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                                                Rejet...
                                            </>
                                        ) : (
                                            'Confirmer'
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </AppLayout>
    );
};

export default OrderManagementPage;

