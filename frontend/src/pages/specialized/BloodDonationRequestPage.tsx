import { Button } from '@/components/ui/buttons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/apiService';

const GROUPES_SANGUINS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const URGENCE_LEVELS = [
    { value: 'normal', label: 'Normal', color: 'green' },
    { value: 'urgent', label: 'Urgent', color: 'orange' },
    { value: 'critique', label: 'Critique', color: 'red' },
];

interface BloodBank {
    id: number;
    nom: string;
    adresse?: string;
}

const BloodDonationRequestPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [loadingBanks, setLoadingBanks] = useState(false);
    const [bloodBanks, setBloodBanks] = useState<BloodBank[]>([]);
    const [matchingInfo, setMatchingInfo] = useState<{
        compatibleGroups: string[];
    } | null>(null);

    const [formData, setFormData] = useState({
        banque_sang_id: 0,
        service_id: 0,
        groupe_sanguin_requis: '',
        quantite_requise: '1',
        unite: 'poches',
        is_urgent: false,
        urgence_level: 'normal',
        deadline_date: '',
        patient_name: '',
        hospital_name: '',
        notes: '',
        max_distance_km: '50',
    });

    useEffect(() => {
        loadBloodBanks();
    }, []);

    useEffect(() => {
        if (formData.groupe_sanguin_requis) {
            loadCompatibilityInfo(formData.groupe_sanguin_requis);
        }
    }, [formData.groupe_sanguin_requis]);

    const loadBloodBanks = async () => {
        try {
            setLoadingBanks(true);
            const response = await apiGet('/api/banques-sang/my-banks');
            const data = await response.json();
            if (data.success && data.data) {
                setBloodBanks(data.data as BloodBank[]);
                if (data.data.length === 1) {
                    setFormData({ ...formData, banque_sang_id: (data.data[0] as BloodBank).id });
                }
            }
        } catch (error: any) {
            console.error('[BloodDonationRequestPage] Erreur:', error);
            alert('Impossible de charger vos banques de sang');
        } finally {
            setLoadingBanks(false);
        }
    };

    const loadCompatibilityInfo = async (group: string) => {
        try {
            const response = await apiGet(`/api/blood-donation/compatibility-info/${group}`);
            const data = await response.json();
            if (data.success && data.data) {
                setMatchingInfo({
                    compatibleGroups: data.data.can_receive_from || [],
                });
            }
        } catch (error: any) {
            console.error('[BloodDonationRequestPage] Erreur compatibilité:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.banque_sang_id) {
            alert('Veuillez sélectionner une banque de sang');
            return;
        }

        if (!formData.groupe_sanguin_requis) {
            alert('Veuillez sélectionner un groupe sanguin requis');
            return;
        }

        try {
            setLoading(true);

            const payload = {
                banque_sang_id: formData.banque_sang_id,
                service_id: formData.service_id || 0,
                groupe_sanguin_requis: formData.groupe_sanguin_requis,
                quantite_requise: parseInt(formData.quantite_requise),
                unite: formData.unite,
                is_urgent: formData.is_urgent,
                urgence_level: formData.urgence_level,
                deadline_date: formData.deadline_date || null,
                request_latitude: null,
                request_longitude: null,
                request_location_address: null,
                notes: formData.notes || null,
                patient_name: formData.patient_name || null,
                hospital_name: formData.hospital_name || null,
                max_distance_km: parseFloat(formData.max_distance_km) || 50.0,
            };

            const response = await apiPost('/api/blood-donation/requests', payload);
            const data = await response.json();

            if (data.success) {
                const requestId = data.data?.request_id;
                const matchesFound = data.data?.matches_found || 0;

                if (confirm(`Demande créée ! ${matchesFound} donneur(s) compatible(s) trouvé(s). Voir les matches ?`)) {
                    navigate(`/blood-donation/matches/${requestId}`);
                }
            } else {
                alert(data.error || 'Impossible de créer la demande');
            }
        } catch (error: any) {
            console.error('[BloodDonationRequestPage] Erreur:', error);
            alert(error.message || 'Impossible de créer la demande');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6">Créer une demande de don</h1>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Sélection banque */}
                        <div>
                            <Label>Banque de sang *</Label>
                            {loadingBanks ? (
                                <div className="text-sm text-gray-500 mt-2">Chargement...</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                    {bloodBanks.map((bank) => (
                                        <button
                                            key={bank.id}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, banque_sang_id: bank.id })}
                                            className={`p-4 rounded-lg border-2 text-left transition ${formData.banque_sang_id === bank.id
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className="font-semibold text-gray-900">{bank.nom}</div>
                                            {bank.adresse && <div className="text-sm text-gray-500">{bank.adresse}</div>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Groupe sanguin */}
                        <div>
                            <Label>Groupe sanguin requis *</Label>
                            <div className="grid grid-cols-4 gap-3 mt-2">
                                {GROUPES_SANGUINS.map((group) => (
                                    <button
                                        key={group}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, groupe_sanguin_requis: group })}
                                        className={`p-4 rounded-lg border-2 font-bold transition ${formData.groupe_sanguin_requis === group
                                            ? 'border-red-500 bg-red-50 text-red-600'
                                            : 'border-red-300 text-red-500 hover:border-red-400'
                                            }`}
                                    >
                                        {group}
                                    </button>
                                ))}
                            </div>

                            {matchingInfo && matchingInfo.compatibleGroups.length > 0 && (
                                <div className="mt-3 p-3 bg-green-50 rounded-lg">
                                    <div className="text-sm font-semibold text-green-800 mb-2">Groupes compatibles:</div>
                                    <div className="flex flex-wrap gap-2">
                                        {matchingInfo.compatibleGroups.map((group) => (
                                            <span key={group} className="px-2 py-1 bg-white rounded text-sm font-semibold text-green-700">
                                                {group}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Quantité */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Quantité requise *</Label>
                                <Input
                                    type="number"
                                    value={formData.quantite_requise}
                                    onChange={(e) => setFormData({ ...formData, quantite_requise: e.target.value })}
                                    min="1"
                                    required
                                />
                            </div>
                            <div>
                                <Label>Unité</Label>
                                <Input
                                    value={formData.unite}
                                    onChange={(e) => setFormData({ ...formData, unite: e.target.value })}
                                    placeholder="poches"
                                />
                            </div>
                        </div>

                        {/* Urgence */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div>
                                <Label>Demande urgente</Label>
                                <p className="text-sm text-gray-500">Les donneurs seront notifiés en priorité</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={formData.is_urgent}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        is_urgent: e.target.checked,
                                        urgence_level: e.target.checked ? 'urgent' : 'normal',
                                    })
                                }
                                className="w-5 h-5"
                            />
                        </div>

                        {formData.is_urgent && (
                            <div>
                                <Label>Niveau d'urgence</Label>
                                <div className="flex gap-3 mt-2">
                                    {URGENCE_LEVELS.map((level) => (
                                        <button
                                            key={level.value}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, urgence_level: level.value })}
                                            className={`px-4 py-2 rounded-lg border-2 transition ${formData.urgence_level === level.value
                                                ? `border-${level.color}-500 bg-${level.color}-50`
                                                : 'border-gray-200'
                                                }`}
                                        >
                                            {level.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Informations additionnelles */}
                        <div className="space-y-4">
                            <div>
                                <Label>Nom du patient (optionnel)</Label>
                                <Input
                                    value={formData.patient_name}
                                    onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Hôpital (optionnel)</Label>
                                <Input
                                    value={formData.hospital_name}
                                    onChange={(e) => setFormData({ ...formData, hospital_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Distance maximale (km)</Label>
                                <Input
                                    type="number"
                                    value={formData.max_distance_km}
                                    onChange={(e) => setFormData({ ...formData, max_distance_km: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Notes (optionnel)</Label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full mt-1 p-3 border border-gray-300 rounded-lg"
                                    rows={4}
                                />
                            </div>
                        </div>

                        <Button type="submit" disabled={loading || !formData.banque_sang_id || !formData.groupe_sanguin_requis}>
                            {loading ? 'Création en cours...' : 'Créer la demande'}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default BloodDonationRequestPage;

