// ✅ NOUVEAU: Page web de création de réservation

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiPost } from '../../services/api';

const ReservationPage: React.FC = () => {
    const { serviceId, serviceType } = useParams<{ serviceId: string; serviceType: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [requestedDate, setRequestedDate] = useState('');
    const [notes, setNotes] = useState('');
    const [nombrePlaces, setNombrePlaces] = useState(1);
    const [pickupAddress, setPickupAddress] = useState('');
    const [dropoffAddress, setDropoffAddress] = useState('');
    const [destination, setDestination] = useState('');
    const [numberOfTickets, setNumberOfTickets] = useState(1);
    const [patientName, setPatientName] = useState('');
    const [reason, setReason] = useState('');

    const handleCreateReservation = async () => {
        if (!user || !serviceId || !serviceType) {
            alert('Données manquantes');
            return;
        }

        setLoading(true);

        try {
            let details: any = {};

            if (serviceType === 'covoiturage') {
                details = { nombre_places: nombrePlaces };
            } else if (serviceType === 'taxi') {
                details = { pickup_address: pickupAddress, dropoff_address: dropoffAddress || null };
            } else if (serviceType === 'agence_voyage') {
                details = { destination, number_of_tickets: numberOfTickets };
            } else {
                details = { patient_name: patientName || null, reason: reason || null };
            }

            const response = await apiPost('/api/specialized-services/reservations', {
                service_id: parseInt(serviceId),
                service_type: serviceType,
                reservation_type: serviceType === 'covoiturage' ? 'place' : serviceType === 'taxi' ? 'course' : serviceType === 'agence_voyage' ? 'ticket' : 'rdv',
                requested_date: requestedDate || null,
                details,
            });

            if (response.success) {
                alert('Réservation créée avec succès');
                navigate('/mes-reservations');
            } else {
                alert(response.error || 'Erreur lors de la création');
            }
        } catch (error: any) {
            console.error('[ReservationPage] Erreur:', error);
            alert('Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <h1 className="text-3xl font-bold mb-6">Créer une réservation</h1>

            <div className="bg-white rounded-lg shadow p-6 space-y-6">
                {(serviceType === 'hopital' || serviceType === 'laboratoire') && (
                    <>
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Date et heure souhaitées *
                            </label>
                            <input
                                type="datetime-local"
                                value={requestedDate}
                                onChange={(e) => setRequestedDate(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Nom du patient (optionnel)
                            </label>
                            <input
                                type="text"
                                value={patientName}
                                onChange={(e) => setPatientName(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Raison du rendez-vous (optionnel)
                            </label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg"
                                rows={3}
                            />
                        </div>
                    </>
                )}

                {serviceType === 'covoiturage' && (
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Nombre de places *
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={nombrePlaces}
                            onChange={(e) => setNombrePlaces(parseInt(e.target.value) || 1)}
                            className="w-full px-4 py-2 border rounded-lg"
                            required
                        />
                    </div>
                )}

                {serviceType === 'taxi' && (
                    <>
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Adresse de prise en charge *
                            </label>
                            <input
                                type="text"
                                value={pickupAddress}
                                onChange={(e) => setPickupAddress(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Adresse de destination (optionnel)
                            </label>
                            <input
                                type="text"
                                value={dropoffAddress}
                                onChange={(e) => setDropoffAddress(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg"
                            />
                        </div>
                    </>
                )}

                {serviceType === 'agence_voyage' && (
                    <>
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Destination *
                            </label>
                            <input
                                type="text"
                                value={destination}
                                onChange={(e) => setDestination(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Nombre de tickets
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={numberOfTickets}
                                onChange={(e) => setNumberOfTickets(parseInt(e.target.value) || 1)}
                                className="w-full px-4 py-2 border rounded-lg"
                            />
                        </div>
                    </>
                )}

                <div>
                    <label className="block text-sm font-medium mb-2">
                        Notes (optionnel)
                    </label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg"
                        rows={4}
                    />
                </div>

                <button
                    onClick={handleCreateReservation}
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? 'Création...' : 'Créer la réservation'}
                </button>
            </div>
        </div>
    );
};

export default ReservationPage;

