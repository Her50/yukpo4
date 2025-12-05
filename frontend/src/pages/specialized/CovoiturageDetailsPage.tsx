// ✅ Phase 5: Détails d'un covoiturage avec bouton de réservation (Frontend)
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar, Car, Check, Clock, DollarSign, Minus, Plus, User, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/apiService';

interface CovoiturageDetails {
    id: number;
    service_id: number;
    user_id: number;
    depart: string;
    destination: string;
    gps_depart?: string;
    gps_destination?: string;
    date_depart: string;
    heure_depart?: string;
    nombre_places: number;
    places_disponibles: number;
    prix_par_place: number;
    devise: string;
    statut: string;
    type_vehicule?: string;
    marque_modele?: string;
    prestataire?: {
        nom_complet?: string;
        avatar_url?: string;
        user_id: number;
    };
}

const CovoiturageDetailsPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();

    const [covoiturage, setCovoiturage] = useState<CovoiturageDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);
    const [numberOfPlaces, setNumberOfPlaces] = useState(1);
    const [passengerNames, setPassengerNames] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (id) {
            loadCovoiturageDetails();
        }
    }, [id]);

    const loadCovoiturageDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/covoiturages/${id}`);
            const data = await response.json();

            if (data.success && data.data) {
                setCovoiturage(data.data);
            } else {
                alert('Impossible de charger les détails du trajet');
                navigate('/covoiturages/search');
            }
        } catch (error: any) {
            console.error('[CovoiturageDetailsPage] Erreur:', error);
            alert(error.message || 'Impossible de charger les détails');
            navigate('/covoiturages/search');
        } finally {
            setLoading(false);
        }
    };

    const handleBook = async () => {
        if (!user) {
            alert('Veuillez vous connecter pour réserver une place');
            navigate('/login');
            return;
        }

        if (!covoiturage) return;

        if (numberOfPlaces > covoiturage.places_disponibles) {
            alert(`Seulement ${covoiturage.places_disponibles} place(s) disponible(s)`);
            return;
        }

        if (covoiturage.statut !== 'ouvert') {
            alert('Ce trajet n\'est plus disponible');
            return;
        }

        try {
            setBooking(true);
            const response = await apiPost(`/api/covoiturages/${id}/book`, {
                number_of_places: numberOfPlaces,
                passenger_names: passengerNames ? passengerNames.split(',').map(n => n.trim()) : undefined,
                notes: notes || undefined,
            });
            const data = await response.json();

            if (data.success) {
                const totalPrice = numberOfPlaces * covoiturage.prix_par_place;
                alert(
                    `${numberOfPlaces} place(s) réservée(s) pour ${totalPrice.toLocaleString('fr-FR')} ${covoiturage.devise}`
                );
                // Rediriger vers mes réservations après réservation réussie
                navigate('/mes-reservations');
            } else {
                alert(data.error || 'Impossible de créer la réservation');
            }
        } catch (error: any) {
            console.error('[CovoiturageDetailsPage] Erreur réservation:', error);
            alert(error.message || 'Impossible de créer la réservation');
        } finally {
            setBooking(false);
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

    if (!covoiturage) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-600">Trajet non trouvé</p>
            </div>
        );
    }

    const totalPrice = numberOfPlaces * covoiturage.prix_par_place;

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <Button
                    variant="ghost"
                    onClick={() => {
                        // Navigation intelligente selon contexte
                        if (document.referrer?.includes('/covoiturages/search')) {
                            navigate('/covoiturages/search');
                        } else if (document.referrer?.includes('/covoiturages/list')) {
                            navigate('/covoiturages/list');
                        } else {
                            navigate(-1);
                        }
                    }}
                    className="mb-6"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Retour
                </Button>

                <Card className="mb-6">
                    <CardHeader>
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-4 h-4 rounded-full bg-blue-600"></div>
                                    <CardTitle className="text-2xl">{covoiturage.depart}</CardTitle>
                                </div>
                                <div className="w-0.5 h-8 bg-gray-300 ml-2"></div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full bg-red-600"></div>
                                    <CardTitle className="text-2xl">{covoiturage.destination}</CardTitle>
                                </div>
                            </div>
                            <Badge
                                variant={covoiturage.statut === 'ouvert' ? 'default' : 'secondary'}
                                className={`text-lg px-4 py-2 ${covoiturage.statut === 'ouvert' ? 'bg-green-100 text-green-800 border-green-300' : ''}`}
                            >
                                {covoiturage.statut}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center text-gray-700">
                            <Calendar className="w-5 h-5 mr-3 text-gray-400" />
                            <span>
                                {new Date(covoiturage.date_depart).toLocaleDateString('fr-FR', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                })}
                            </span>
                        </div>

                        {covoiturage.heure_depart && (
                            <div className="flex items-center text-gray-700">
                                <Clock className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{covoiturage.heure_depart.substring(0, 5)}</span>
                            </div>
                        )}

                        <div className="flex items-center text-gray-700">
                            <Users className="w-5 h-5 mr-3 text-gray-400" />
                            <span>
                                {covoiturage.places_disponibles} / {covoiturage.nombre_places} places disponibles
                            </span>
                        </div>

                        <div className="flex items-center text-gray-700">
                            <DollarSign className="w-5 h-5 mr-3 text-gray-400" />
                            <span>
                                {covoiturage.prix_par_place.toLocaleString('fr-FR')} {covoiturage.devise} / place
                            </span>
                        </div>

                        {covoiturage.type_vehicule && (
                            <div className="flex items-center text-gray-700">
                                <Car className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{covoiturage.type_vehicule}</span>
                            </div>
                        )}

                        {covoiturage.marque_modele && (
                            <div className="flex items-center text-gray-700">
                                <Car className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{covoiturage.marque_modele}</span>
                            </div>
                        )}

                        {covoiturage.prestataire && (
                            <div className="pt-4 border-t">
                                <div className="flex items-center text-gray-700">
                                    <User className="w-5 h-5 mr-3 text-gray-400" />
                                    <div>
                                        <p className="font-semibold">Conducteur</p>
                                        <p className="text-sm text-gray-600">
                                            {covoiturage.prestataire.nom_complet || 'Non renseigné'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {covoiturage.statut === 'ouvert' && covoiturage.places_disponibles > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Réserver une place</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Nombre de places</Label>
                                <div className="flex items-center gap-4 mt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setNumberOfPlaces(Math.max(1, numberOfPlaces - 1))}
                                        disabled={numberOfPlaces <= 1}
                                    >
                                        <Minus className="w-4 h-4" />
                                    </Button>
                                    <span className="flex-1 text-center text-2xl font-bold">
                                        {numberOfPlaces}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setNumberOfPlaces(Math.min(covoiturage.places_disponibles, numberOfPlaces + 1))}
                                        disabled={numberOfPlaces >= covoiturage.places_disponibles}
                                    >
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="passengerNames">
                                    Noms des passagers (optionnel, séparés par virgule)
                                </Label>
                                <Input
                                    id="passengerNames"
                                    value={passengerNames}
                                    onChange={(e) => setPassengerNames(e.target.value)}
                                    placeholder="Ex: Jean Dupont, Marie Martin"
                                />
                            </div>

                            <div>
                                <Label htmlFor="notes">Notes (optionnel)</Label>
                                <textarea
                                    id="notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Informations complémentaires..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={3}
                                />
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t">
                                <span className="text-lg font-semibold">Total:</span>
                                <span className="text-2xl font-bold text-blue-600">
                                    {totalPrice.toLocaleString('fr-FR')} {covoiturage.devise}
                                </span>
                            </div>

                            <Button
                                onClick={handleBook}
                                disabled={booking || numberOfPlaces > covoiturage.places_disponibles}
                                className="w-full"
                            >
                                <Check className="w-4 h-4 mr-2" />
                                {booking
                                    ? 'Réservation en cours...'
                                    : `Réserver ${numberOfPlaces} place${numberOfPlaces > 1 ? 's' : ''}`}
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default CovoiturageDetailsPage;

