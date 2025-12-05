import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiPost } from '../../services/apiService';

interface DonorMatch {
    match_id: string;
    donor_user_id: number;
    donor_name: string | null;
    donor_telephone: string | null;
    donor_whatsapp: string | null;
    groupe_sanguin: string;
    distance_km: number | null;
    relevance_score: number;
    match_status: string;
    notified_at: string | null;
}

const BloodDonationMatchesPage: React.FC = () => {
    const navigate = useNavigate();
    const { requestId } = useParams<{ requestId: string }>();
    const [loading, setLoading] = useState(true);
    const [matches, setMatches] = useState<DonorMatch[]>([]);
    const [requestInfo, setRequestInfo] = useState<any>(null);
    const [notifying, setNotifying] = useState(false);

    useEffect(() => {
        if (requestId) {
            loadData();
        }
    }, [requestId]);

    const loadData = async () => {
        if (!requestId) return;
        try {
            setLoading(true);
            await Promise.all([loadRequestInfo(), loadMatches()]);
        } catch (error: any) {
            console.error('[BloodDonationMatchesPage] Erreur:', error);
            alert('Impossible de charger les matches');
        } finally {
            setLoading(false);
        }
    };

    const loadRequestInfo = async () => {
        try {
            const response = await apiGet(`/api/blood-donation/requests/${requestId}`);
            const data = await response.json();
            if (data.success && data.data) {
                setRequestInfo(data.data);
            }
        } catch (error: any) {
            console.error('[BloodDonationMatchesPage] Erreur info:', error);
        }
    };

    const loadMatches = async () => {
        try {
            const response = await apiGet(`/api/blood-donation/requests/${requestId}/matches`);
            const data = await response.json();
            if (data.success && data.data) {
                setMatches(data.data.matches || []);
            }
        } catch (error: any) {
            console.error('[BloodDonationMatchesPage] Erreur matches:', error);
        }
    };

    const handleNotifyDonors = async () => {
        if (!requestId) return;
        try {
            setNotifying(true);
            const response = await apiPost(`/api/blood-donation/requests/${requestId}/notify`, {
                max_donors_to_notify: 20,
            });
            const data = await response.json();
            if (data.success) {
                const notified = data.data?.notified_count || 0;
                alert(`${notified} donneur(s) ont été notifié(s)`);
                await loadMatches();
            }
        } catch (error: any) {
            console.error('[BloodDonationMatchesPage] Erreur notification:', error);
            alert('Impossible de notifier les donneurs');
        } finally {
            setNotifying(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'accepted': return 'text-green-600 bg-green-50';
            case 'declined': return 'text-red-600 bg-red-50';
            case 'notified': return 'text-orange-600 bg-orange-50';
            case 'completed': return 'text-blue-600 bg-blue-50';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Chargement...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-6xl mx-auto px-4">
                <div className="mb-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="text-blue-600 hover:text-blue-700 mb-4"
                    >
                        ← Retour
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900">Matches donneurs</h1>
                </div>

                {requestInfo && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>{requestInfo.banque_sang_nom}</CardTitle>
                            <p className="text-sm text-gray-600">
                                Groupe requis: <span className="font-semibold text-red-600">{requestInfo.groupe_sanguin_requis}</span>
                            </p>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                <div>
                                    <p className="text-sm text-gray-600">Matches</p>
                                    <p className="text-2xl font-bold">{requestInfo.matches_count || 0}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Acceptés</p>
                                    <p className="text-2xl font-bold text-green-600">{requestInfo.accepted_matches_count || 0}</p>
                                </div>
                            </div>
                            <Button
                                onClick={handleNotifyDonors}
                                disabled={notifying || matches.filter((m) => m.match_status === 'pending').length === 0}
                            >
                                {notifying ? 'Notification...' : `Notifier ${matches.filter((m) => m.match_status === 'pending').length} donneur(s)`}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {matches.map((match) => (
                        <Card key={match.match_id}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                            <span className="text-red-600 font-bold">{match.groupe_sanguin}</span>
                                        </div>
                                        <div>
                                            <CardTitle className="text-base">
                                                {match.donor_name || `Donneur #${match.donor_user_id}`}
                                            </CardTitle>
                                            {match.distance_km !== null && (
                                                <p className="text-sm text-gray-500">📍 {match.distance_km.toFixed(1)} km</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(match.match_status)}`}>
                                    {match.match_status === 'accepted' ? 'Accepté' :
                                        match.match_status === 'declined' ? 'Refusé' :
                                            match.match_status === 'notified' ? 'Notifié' :
                                                match.match_status === 'completed' ? 'Complété' : 'En attente'}
                                </div>
                                <div className="mt-4 flex gap-2">
                                    {match.donor_telephone && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => window.open(`tel:${match.donor_telephone}`)}
                                        >
                                            📞 Appeler
                                        </Button>
                                    )}
                                    {match.donor_whatsapp && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => window.open(`https://wa.me/${match.donor_whatsapp.replace(/[^0-9]/g, '')}`)}
                                        >
                                            💬 WhatsApp
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {matches.length === 0 && (
                    <Card>
                        <CardContent className="text-center py-12">
                            <p className="text-gray-500">Aucun donneur compatible trouvé</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default BloodDonationMatchesPage;

