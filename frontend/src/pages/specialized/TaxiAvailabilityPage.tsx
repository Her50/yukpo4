// ✅ Phase 6: Mise à jour disponibilité d'un taxi (Frontend)
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, MapPin, Navigation, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/apiService';

const TaxiAvailabilityPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();

    const [taxi, setTaxi] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isAvailableNow, setIsAvailableNow] = useState(true);
    const [gpsString, setGpsString] = useState('');

    useEffect(() => {
        if (id) {
            loadTaxiDetails();
        }
    }, [id]);

    // Récupérer position GPS actuelle si disponible
    useEffect(() => {
        if (navigator.geolocation && !gpsString) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    setGpsString(`${lat},${lng}`);
                },
                (error) => {
                    console.log('Erreur géolocalisation:', error);
                }
            );
        }
    }, []);

    const loadTaxiDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/taxis/${id}`);
            const data = await response.json();

            if (data.success && data.data) {
                const taxiData = data.data;
                setTaxi(taxiData);
                setIsAvailableNow(taxiData.is_available_now || false);
                if (taxiData.gps_actuel) {
                    setGpsString(taxiData.gps_actuel);
                }
            } else {
                alert('Impossible de charger les détails du taxi');
                navigate('/taxis/search');
            }
        } catch (error: any) {
            console.error('[TaxiAvailabilityPage] Erreur:', error);
            alert(error.message || 'Impossible de charger les détails');
            navigate('/taxis/search');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            alert('Vous devez être connecté');
            return;
        }

        try {
            setSaving(true);
            const payload: any = {};

            if (isAvailableNow !== taxi?.is_available_now) {
                payload.is_available_now = isAvailableNow;
            }

            if (gpsString && gpsString !== taxi?.gps_actuel) {
                // Valider format GPS
                const [lat, lng] = gpsString.split(',').map(parseFloat);
                if (isNaN(lat) || isNaN(lng)) {
                    alert('Format GPS invalide. Utilisez: latitude,longitude');
                    return;
                }
                payload.gps_actuel = gpsString;
            }

            if (Object.keys(payload).length === 0) {
                alert('Aucune modification à enregistrer');
                return;
            }

            const response = await apiPost(`/api/taxis/${id}/update-availability`, payload);
            const data = await response.json();

            if (data.success) {
                alert('Disponibilité mise à jour avec succès');
                navigate(`/taxis/${id}`);
            } else {
                alert(data.error || 'Impossible de mettre à jour la disponibilité');
            }
        } catch (error: any) {
            console.error('[TaxiAvailabilityPage] Erreur sauvegarde:', error);
            alert(error.message || 'Impossible de mettre à jour la disponibilité');
        } finally {
            setSaving(false);
        }
    };

    const handleUseCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    setGpsString(`${lat},${lng}`);
                },
                (error) => {
                    alert('Impossible d\'obtenir votre position GPS');
                }
            );
        } else {
            alert('La géolocalisation n\'est pas supportée par votre navigateur');
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

    if (!taxi) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-600">Taxi non trouvé</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <Button
                    variant="ghost"
                    onClick={() => navigate(-1)}
                    className="mb-6"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Retour
                </Button>

                <h1 className="text-3xl font-bold text-gray-900 mb-6">Mettre à jour disponibilité</h1>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Taxi: {taxi.zone}</CardTitle>
                        {taxi.type_vehicule && (
                            <p className="text-gray-600 mt-1">{taxi.type_vehicule}</p>
                        )}
                    </CardHeader>
                </Card>

                <form onSubmit={handleSave}>
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Disponibilité</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <Label className="text-base font-semibold mb-2 block">
                                        Disponible maintenant
                                    </Label>
                                    <p className="text-sm text-gray-600">
                                        Activez cette option si votre taxi est disponible pour des courses
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isAvailableNow}
                                        onChange={(e) => setIsAvailableNow(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Position GPS actuelle</CardTitle>
                            <p className="text-sm text-gray-600 mt-1">
                                Mettez à jour votre position GPS pour que les clients puissent vous trouver facilement
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="gps">Coordonnées GPS</Label>
                                <div className="relative mt-2">
                                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        id="gps"
                                        value={gpsString}
                                        onChange={(e) => setGpsString(e.target.value)}
                                        placeholder="Ex: 4.0511,9.7679"
                                        className="pl-10"
                                    />
                                </div>
                                <p className="text-sm text-gray-500 mt-1">
                                    Format: latitude,longitude
                                </p>
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleUseCurrentLocation}
                                className="w-full"
                            >
                                <Navigation className="w-4 h-4 mr-2" />
                                Utiliser ma position actuelle
                            </Button>
                        </CardContent>
                    </Card>

                    <Button
                        type="submit"
                        disabled={saving}
                        className="w-full"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default TaxiAvailabilityPage;

