// Page pour créer une demande de retour après achat d'un ticket aller
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiPost } from '../../services/apiService';

const BusReturnRequestFormPage: React.FC = () => {
    const navigate = useNavigate();
    const { paymentId } = useParams<{ paymentId: string }>();
    const [returnDate, setReturnDate] = useState('');
    const [returnTime, setReturnTime] = useState('');
    const [flexibilityDays, setFlexibilityDays] = useState(1);
    const [numberOfSeats, setNumberOfSeats] = useState(1);
    const [passengerNames, setPassengerNames] = useState<string[]>(['']);
    const [loading, setLoading] = useState(false);

    const addPassenger = () => {
        setPassengerNames([...passengerNames, '']);
    };

    const updatePassengerName = (index: number, name: string) => {
        const updated = [...passengerNames];
        updated[index] = name;
        setPassengerNames(updated);
    };

    const removePassenger = (index: number) => {
        if (passengerNames.length > 1) {
            setPassengerNames(passengerNames.filter((_, i) => i !== index));
        }
    };

    const formatDateForBackend = (dateStr: string) => {
        // Convertir YYYY-MM-DD en DD/MM/YYYY
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!paymentId) {
            alert('Informations de ticket aller manquantes');
            return;
        }

        if (passengerNames.length === 0 || passengerNames.every((name) => !name.trim())) {
            alert('Veuillez renseigner au moins un nom de passager');
            return;
        }

        try {
            setLoading(true);

            const payload = {
                outbound_payment_id: paymentId,
                preferred_return_date: formatDateForBackend(returnDate),
                preferred_return_time: returnTime.trim() || null,
                date_flexibility_days: flexibilityDays,
                passenger_names: passengerNames.filter((name) => name.trim()),
                number_of_seats: numberOfSeats,
                already_paid: false,
            };

            const response = await apiPost('/api/bus-tickets/return-request', payload);
            const data = await response.json();

            if (data.success) {
                alert(
                    'Demande créée avec succès. Vous serez notifié quand un bus correspondant sera disponible.'
                );
                navigate('/bus-tickets/return-requests');
            } else {
                alert(data.error || 'Impossible de créer la demande');
            }
        } catch (error: any) {
            console.error('[BusReturnRequestFormPage] Erreur:', error);
            alert('Impossible de créer la demande');
        } finally {
            setLoading(false);
        }
    };

    if (!paymentId) {
        return (
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-2xl mx-auto px-4">
                    <Card>
                        <CardContent className="text-center py-12">
                            <p className="text-red-600">Informations de ticket manquantes</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-2xl mx-auto px-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">Créer une demande de retour</h1>

                <form onSubmit={handleSubmit}>
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Informations du retour</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Date de retour souhaitée *</Label>
                                <Input
                                    type="date"
                                    value={returnDate}
                                    onChange={(e) => setReturnDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    required
                                />
                            </div>

                            <div>
                                <Label>Heure de retour (optionnel)</Label>
                                <Input
                                    type="time"
                                    value={returnTime}
                                    onChange={(e) => setReturnTime(e.target.value)}
                                    placeholder="HH:MM"
                                />
                                <p className="text-sm text-gray-500 mt-1">
                                    Laissez vide si vous êtes flexible sur l'heure
                                </p>
                            </div>

                            <div>
                                <Label>Flexibilité sur la date</Label>
                                <div className="flex gap-2 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setFlexibilityDays(0)}
                                        className={`flex-1 px-4 py-2 rounded-lg border ${flexibilityDays === 0
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white border-gray-300'
                                            }`}
                                    >
                                        Exact
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFlexibilityDays(1)}
                                        className={`flex-1 px-4 py-2 rounded-lg border ${flexibilityDays === 1
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white border-gray-300'
                                            }`}
                                    >
                                        ± 1 jour
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFlexibilityDays(2)}
                                        className={`flex-1 px-4 py-2 rounded-lg border ${flexibilityDays === 2
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white border-gray-300'
                                            }`}
                                    >
                                        ± 2 jours
                                    </button>
                                </div>
                            </div>

                            <div>
                                <Label>Nombre de places *</Label>
                                <div className="flex items-center gap-4 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => numberOfSeats > 1 && setNumberOfSeats(numberOfSeats - 1)}
                                        disabled={numberOfSeats === 1}
                                        className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center disabled:opacity-50"
                                    >
                                        −
                                    </button>
                                    <span className="text-xl font-semibold w-10 text-center">
                                        {numberOfSeats}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setNumberOfSeats(numberOfSeats + 1)}
                                        className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <Label>Noms des passagers *</Label>
                                    <button
                                        type="button"
                                        onClick={addPassenger}
                                        className="text-blue-600 hover:text-blue-700"
                                    >
                                        + Ajouter
                                    </button>
                                </div>
                                {passengerNames.map((name, index) => (
                                    <div key={index} className="flex gap-2 mb-2">
                                        <Input
                                            value={name}
                                            onChange={(e) => updatePassengerName(index, e.target.value)}
                                            placeholder={`Passager ${index + 1}`}
                                            className="flex-1"
                                        />
                                        {passengerNames.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removePassenger(index)}
                                                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                                            >
                                                🗑️
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex gap-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => navigate(-1)}
                            className="flex-1"
                        >
                            Annuler
                        </Button>
                        <Button type="submit" disabled={loading} className="flex-1">
                            {loading ? 'Création en cours...' : 'Créer la demande'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BusReturnRequestFormPage;

