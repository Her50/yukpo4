import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface BloodDonationRequest {
    id: string;
    banque_sang_nom: string;
    groupe_sanguin_requis: string;
    quantite_requise: number;
    is_urgent: boolean;
    status: string;
    created_at: string;
    matches_count: number;
    accepted_matches_count: number;
}

interface UserBloodGroup {
    id: number;
    groupe_sanguin: string;
    is_available_for_donation: boolean;
    last_donation_date: string | null;
    next_donation_available_date: string | null;
}

const MyBloodDonationsPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState<BloodDonationRequest[]>([]);
    const [bloodGroup, setBloodGroup] = useState<UserBloodGroup | null>(null);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

    useEffect(() => {
        loadData();
    }, [filter]);

    const loadData = async () => {
        try {
            setLoading(true);
            await Promise.all([loadMyRequests(), loadBloodGroup()]);
        } catch (error: any) {
            console.error('[MyBloodDonationsPage] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMyRequests = async () => {
        try {
            const response = await apiGet('/api/blood-donation/requests?status=active');
            const data = await response.json();
            let allRequests = data.data?.requests || [];

            if (filter === 'active') {
                allRequests = allRequests.filter((r: BloodDonationRequest) => r.status === 'active');
            } else if (filter === 'completed') {
                allRequests = allRequests.filter((r: BloodDonationRequest) => r.status === 'completed');
            }

            setRequests(allRequests);
        } catch (error: any) {
            console.error('[MyBloodDonationsPage] Erreur:', error);
        }
    };

    const loadBloodGroup = async () => {
        try {
            const response = await apiGet('/api/blood-donation/donor/blood-groups');
            const data = await response.json();
            const groups = data.data?.data || [];
            if (groups.length > 0) {
                setBloodGroup(groups[0] as UserBloodGroup);
            }
        } catch (error: any) {
            console.error('[MyBloodDonationsPage] Erreur:', error);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    const canDonateAgain = () => {
        if (!bloodGroup || !bloodGroup.next_donation_available_date) return true;
        const nextDate = new Date(bloodGroup.next_donation_available_date);
        return nextDate <= new Date();
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-6xl mx-auto px-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">Mes dons de sang</h1>

                {bloodGroup && (
                    <Card className="mb-6">
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center border-4 border-red-500">
                                    <span className="text-red-600 font-bold text-xl">{bloodGroup.groupe_sanguin}</span>
                                </div>
                                <div>
                                    <CardTitle>Mon groupe sanguin</CardTitle>
                                    <p className="text-sm text-gray-600">
                                        {canDonateAgain() ? '✅ Disponible pour donner' : '⏳ Prochain don disponible'}
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {bloodGroup.last_donation_date && (
                                <div className="mb-2">
                                    <span className="text-sm text-gray-600">Dernier don: </span>
                                    <span className="font-semibold">{formatDate(bloodGroup.last_donation_date)}</span>
                                </div>
                            )}
                            {bloodGroup.next_donation_available_date && !canDonateAgain() && (
                                <div>
                                    <span className="text-sm text-gray-600">Prochain don possible: </span>
                                    <span className="font-semibold">{formatDate(bloodGroup.next_donation_available_date)}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                <Card className="mb-6">
                    <CardContent className="py-4">
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                                <p className="text-3xl font-bold">{requests.length}</p>
                                <p className="text-sm text-gray-600">Demandes créées</p>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-green-600">
                                    {requests.reduce((sum, r) => sum + r.accepted_matches_count, 0)}
                                </p>
                                <p className="text-sm text-gray-600">Matches acceptés</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
                    <TabsList>
                        <TabsTrigger value="all">Toutes</TabsTrigger>
                        <TabsTrigger value="active">Actives</TabsTrigger>
                        <TabsTrigger value="completed">Complétées</TabsTrigger>
                    </TabsList>

                    <TabsContent value={filter} className="mt-6">
                        {requests.length === 0 ? (
                            <Card>
                                <CardContent className="text-center py-12">
                                    <p className="text-gray-500 mb-4">Aucune demande de don</p>
                                    <Button onClick={() => navigate('/blood-donation/request')}>
                                        Créer une demande
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {requests.map((request) => (
                                    <Card
                                        key={request.id}
                                        className="cursor-pointer hover:shadow-lg transition"
                                        onClick={() => navigate(`/blood-donation/matches/${request.id}`)}
                                    >
                                        <CardHeader>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center border-2 border-red-500">
                                                        <span className="text-red-600 font-bold">{request.groupe_sanguin_requis}</span>
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-base">{request.banque_sang_nom}</CardTitle>
                                                        <p className="text-sm text-gray-500">{formatDate(request.created_at)}</p>
                                                    </div>
                                                </div>
                                                {request.is_urgent && (
                                                    <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">
                                                        URGENT
                                                    </span>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex gap-4 text-sm">
                                                <div>
                                                    <span className="text-gray-600">Matches: </span>
                                                    <span className="font-semibold">{request.matches_count}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-600">Acceptés: </span>
                                                    <span className="font-semibold text-green-600">{request.accepted_matches_count}</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default MyBloodDonationsPage;

