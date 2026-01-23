import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons/Button';
import { useToast } from '@/components/ui/use-toast';
import { useUser } from '@/hooks/useUser';
import { submitCourierApplication } from '@/services/deliveryApi';
import { CheckCircle, Clock, FileText, MapPin, Truck, Upload, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface CourierApplicationFormData {
    // Informations personnelles
    fullName: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    country: string;
    dateOfBirth: string;
    idNumber: string;

    // Documents
    idDocument: File | null;
    driverLicense: File | null;
    vehicleRegistration: File | null;
    insuranceDocument: File | null;
    locationPlan: File | null; // ✅ NOUVEAU: Plan de localisation (obligatoire)

    // Transport
    vehicleType: 'bike' | 'motorcycle' | 'tricycle' | 'car' | 'pickup' | 'van' | 'truck' | 'walking';
    vehicleBrand: string;
    vehicleModel: string;
    licensePlate: string;

    // Disponibilités
    availabilityDays: string[];
    availabilityHours: { start: string; end: string };

    // Autres
    bio: string;
    experience: string;
}

const CourierRegistrationPage: React.FC = () => {
    const { user } = useUser();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [applicationStatus, setApplicationStatus] = useState<'draft' | 'submitted' | 'approved' | 'rejected' | null>(null);
    const [formData, setFormData] = useState<CourierApplicationFormData>({
        fullName: user?.name || '',
        phone: '',
        email: user?.email || '',
        address: '',
        city: '',
        country: '',
        dateOfBirth: '',
        idNumber: '',
        idDocument: null,
        driverLicense: null,
        vehicleRegistration: null,
        insuranceDocument: null,
        locationPlan: null, // ✅ NOUVEAU: Plan de localisation
        vehicleType: 'motorcycle',
        vehicleBrand: '',
        vehicleModel: '',
        licensePlate: '',
        availabilityDays: [],
        availabilityHours: { start: '08:00', end: '18:00' },
        bio: '',
        experience: '',
    });

    const [errors, setErrors] = useState<Partial<Record<keyof CourierApplicationFormData, string>>>({});

    useEffect(() => {
        checkApplicationStatus();
    }, [user]);

    const checkApplicationStatus = async () => {
        if (!user?.id) return;

        try {
            const response = await fetch('/api/courier/me', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                if (data.application) {
                    const status = data.application.status.toLowerCase();
                    if (status.includes('approved')) {
                        setApplicationStatus('approved');
                    } else if (status.includes('rejected')) {
                        setApplicationStatus('rejected');
                    } else if (status.includes('submitted')) {
                        setApplicationStatus('submitted');
                    } else if (status.includes('draft')) {
                        setApplicationStatus('draft');
                    }
                }
                if (data.is_courier && data.courier) {
                    // L'utilisateur est déjà coursier approuvé
                    setApplicationStatus('approved');
                }
            }
        } catch (error) {
            console.error('[CourierRegistrationPage] Erreur vérification statut:', error);
        }
    };

    const handleInputChange = (field: keyof CourierApplicationFormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };

    const handleFileUpload = (field: 'idDocument' | 'driverLicense' | 'vehicleRegistration' | 'insuranceDocument' | 'locationPlan', file: File | null) => {
        setFormData(prev => ({ ...prev, [field]: file }));
    };

    const toggleAvailabilityDay = (day: string) => {
        setFormData(prev => ({
            ...prev,
            availabilityDays: prev.availabilityDays.includes(day)
                ? prev.availabilityDays.filter(d => d !== day)
                : [...prev.availabilityDays, day]
        }));
    };

    const validateForm = (): boolean => {
        const newErrors: Partial<Record<keyof CourierApplicationFormData, string>> = {};

        if (!formData.fullName.trim()) newErrors.fullName = 'Le nom complet est requis';
        if (!formData.phone.trim()) newErrors.phone = 'Le numéro de téléphone est requis';
        if (!formData.address.trim()) newErrors.address = 'L\'adresse est requise';
        if (!formData.city.trim()) newErrors.city = 'La ville est requise';
        if (!formData.idNumber.trim()) newErrors.idNumber = 'Le numéro de pièce d\'identité est requis';
        if (!formData.idDocument) newErrors.idDocument = 'La pièce d\'identité est requise';
        if (formData.vehicleType !== 'walking' && !formData.driverLicense) {
            newErrors.driverLicense = 'Le permis de conduire est requis';
        }
        if (!formData.locationPlan) newErrors.locationPlan = 'Le plan de localisation est obligatoire';
        if (formData.availabilityDays.length === 0) {
            newErrors.availabilityDays = 'Sélectionnez au moins un jour de disponibilité';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (submit: boolean = false) => {
        if (!validateForm()) {
            toast({
                title: 'Erreur de validation',
                description: 'Veuillez corriger les erreurs dans le formulaire',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);
        try {
            // Convertir les fichiers en base64
            const documents: Record<string, any> = {};

            const convertFileToBase64 = (file: File): Promise<string> => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        resolve(base64);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            };

            if (formData.idDocument) {
                const base64 = await convertFileToBase64(formData.idDocument);
                documents.id_document = {
                    name: formData.idDocument.name,
                    data: base64,
                    type: formData.idDocument.type,
                };
            }
            if (formData.driverLicense) {
                const base64 = await convertFileToBase64(formData.driverLicense);
                documents.driver_license = {
                    name: formData.driverLicense.name,
                    data: base64,
                    type: formData.driverLicense.type,
                };
            }
            if (formData.vehicleRegistration) {
                const base64 = await convertFileToBase64(formData.vehicleRegistration);
                documents.vehicle_registration = {
                    name: formData.vehicleRegistration.name,
                    data: base64,
                    type: formData.vehicleRegistration.type,
                };
            }
            if (formData.insuranceDocument) {
                const base64 = await convertFileToBase64(formData.insuranceDocument);
                documents.insurance = {
                    name: formData.insuranceDocument.name,
                    data: base64,
                    type: formData.insuranceDocument.type,
                };
            }
            if (formData.locationPlan) {
                const base64 = await convertFileToBase64(formData.locationPlan);
                documents.location_plan = {
                    name: formData.locationPlan.name,
                    data: base64,
                    type: formData.locationPlan.type,
                };
            }

            const profileData = {
                personal: {
                    fullName: formData.fullName,
                    phone: formData.phone,
                    email: formData.email,
                    address: formData.address,
                    city: formData.city,
                    country: formData.country,
                    dateOfBirth: formData.dateOfBirth,
                    idNumber: formData.idNumber,
                },
                transport: {
                    vehicleType: formData.vehicleType,
                    vehicleBrand: formData.vehicleBrand,
                    vehicleModel: formData.vehicleModel,
                    licensePlate: formData.licensePlate,
                },
                availability: {
                    days: formData.availabilityDays,
                    hours: formData.availabilityHours,
                },
                bio: formData.bio,
                experience: formData.experience,
            };

            await submitCourierApplication({
                profile_data: profileData,
                documents,
                submitted: submit,
            });

            setApplicationStatus(submit ? 'submitted' : 'draft');
            toast({
                title: submit ? '✅ Candidature soumise' : '💾 Brouillon enregistré',
                description: submit
                    ? 'Votre candidature a été soumise avec succès. Elle sera examinée par notre équipe.'
                    : 'Votre candidature a été enregistrée en brouillon.',
            });

            if (submit) {
                setTimeout(() => {
                    navigate('/dashboard');
                }, 2000);
            }
        } catch (error: any) {
            console.error('[CourierRegistrationPage] Erreur soumission:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de soumettre la candidature',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const daysOfWeek = [
        { value: 'monday', label: 'Lundi' },
        { value: 'tuesday', label: 'Mardi' },
        { value: 'wednesday', label: 'Mercredi' },
        { value: 'thursday', label: 'Jeudi' },
        { value: 'friday', label: 'Vendredi' },
        { value: 'saturday', label: 'Samedi' },
        { value: 'sunday', label: 'Dimanche' },
    ];

    const vehicleTypes = [
        { value: 'bike', label: 'Vélo', icon: '🚲' },
        { value: 'motorcycle', label: 'Moto', icon: '🏍️' },
        { value: 'tricycle', label: 'Tricycle', icon: '🛺' },
        { value: 'car', label: 'Voiture', icon: '🚗' },
        { value: 'pickup', label: 'Pickup', icon: '🛻' },
        { value: 'van', label: 'Fourgonnette', icon: '🚐' },
        { value: 'truck', label: 'Camion', icon: '🚚' },
        { value: 'walking', label: 'À pied', icon: '🚶' },
    ];

    if (applicationStatus === 'approved') {
        return (
            <AppLayout>
                <div className="mx-auto max-w-2xl px-4 py-16 text-center">
                    <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Candidature approuvée !</h1>
                    <p className="text-slate-600 mb-6">
                        Félicitations ! Votre candidature de coursier a été approuvée. Vous pouvez maintenant recevoir des livraisons.
                    </p>
                    <Button onClick={() => navigate('/delivery')}>
                        Voir mes livraisons
                    </Button>
                </div>
            </AppLayout>
        );
    }

    if (applicationStatus === 'submitted') {
        return (
            <AppLayout>
                <div className="mx-auto max-w-2xl px-4 py-16 text-center">
                    <Clock className="mx-auto h-16 w-16 text-amber-500 mb-4" />
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Candidature en cours d'examen</h1>
                    <p className="text-slate-600 mb-6">
                        Votre candidature a été soumise avec succès. Notre équipe l'examinera sous peu. Vous recevrez une notification une fois la décision prise.
                    </p>
                    <Button onClick={() => navigate('/dashboard')}>
                        Retour au tableau de bord
                    </Button>
                </div>
            </AppLayout>
        );
    }

    if (applicationStatus === 'rejected') {
        return (
            <AppLayout>
                <div className="mx-auto max-w-2xl px-4 py-16 text-center">
                    <X className="mx-auto h-16 w-16 text-red-500 mb-4" />
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Candidature refusée</h1>
                    <p className="text-slate-600 mb-6">
                        Votre candidature n'a pas été approuvée. Veuillez contacter le support pour plus d'informations.
                    </p>
                    <Button onClick={() => navigate('/dashboard')}>
                        Retour au tableau de bord
                    </Button>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="mx-auto max-w-4xl px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Devenir coursier Yukpo</h1>
                    <p className="text-slate-600">
                        Complétez ce formulaire pour devenir coursier. Toutes les informations seront vérifiées avant validation.
                    </p>
                </div>

                <form className="space-y-8">
                    {/* Informations personnelles */}
                    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Informations personnelles
                        </h2>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Nom complet *
                                </label>
                                <input
                                    type="text"
                                    value={formData.fullName}
                                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                                    className={`w-full rounded-md border p-2 ${errors.fullName ? 'border-red-500' : 'border-slate-300'}`}
                                />
                                {errors.fullName && <p className="text-sm text-red-500 mt-1">{errors.fullName}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Téléphone *
                                </label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => handleInputChange('phone', e.target.value)}
                                    className={`w-full rounded-md border p-2 ${errors.phone ? 'border-red-500' : 'border-slate-300'}`}
                                />
                                {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Email *
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleInputChange('email', e.target.value)}
                                    className="w-full rounded-md border border-slate-300 p-2"
                                    disabled
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Date de naissance
                                </label>
                                <input
                                    type="date"
                                    value={formData.dateOfBirth}
                                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                                    className="w-full rounded-md border border-slate-300 p-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Numéro de pièce d'identité *
                                </label>
                                <input
                                    type="text"
                                    value={formData.idNumber}
                                    onChange={(e) => handleInputChange('idNumber', e.target.value)}
                                    className={`w-full rounded-md border p-2 ${errors.idNumber ? 'border-red-500' : 'border-slate-300'}`}
                                />
                                {errors.idNumber && <p className="text-sm text-red-500 mt-1">{errors.idNumber}</p>}
                            </div>
                        </div>
                    </section>

                    {/* Adresse */}
                    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <MapPin className="h-5 w-5" />
                            Adresse de résidence
                        </h2>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Adresse complète *
                                </label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => handleInputChange('address', e.target.value)}
                                    className={`w-full rounded-md border p-2 ${errors.address ? 'border-red-500' : 'border-slate-300'}`}
                                />
                                {errors.address && <p className="text-sm text-red-500 mt-1">{errors.address}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Ville *
                                </label>
                                <input
                                    type="text"
                                    value={formData.city}
                                    onChange={(e) => handleInputChange('city', e.target.value)}
                                    className={`w-full rounded-md border p-2 ${errors.city ? 'border-red-500' : 'border-slate-300'}`}
                                />
                                {errors.city && <p className="text-sm text-red-500 mt-1">{errors.city}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Pays
                                </label>
                                <input
                                    type="text"
                                    value={formData.country}
                                    onChange={(e) => handleInputChange('country', e.target.value)}
                                    className="w-full rounded-md border border-slate-300 p-2"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Transport */}
                    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <Truck className="h-5 w-5" />
                            Moyen de transport
                        </h2>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Type de véhicule *
                            </label>
                            <div className="overflow-x-auto -mx-6 px-6">
                                <div className="flex gap-3 min-w-max md:grid md:grid-cols-5 md:min-w-0">
                                    {vehicleTypes.map((type) => (
                                        <button
                                            key={type.value}
                                            type="button"
                                            onClick={() => handleInputChange('vehicleType', type.value)}
                                            className={`p-3 rounded-lg border-2 transition-colors flex-shrink-0 w-24 md:w-auto ${formData.vehicleType === type.value
                                                ? 'border-primary bg-primary/10'
                                                : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            <div className="text-2xl mb-1">{type.icon}</div>
                                            <div className="text-sm font-medium">{type.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {/* ✅ NOUVEAU : Formulaire conditionnel selon le type de véhicule */}
                        {formData.vehicleType !== 'walking' && (
                            <>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Marque
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.vehicleBrand}
                                            onChange={(e) => handleInputChange('vehicleBrand', e.target.value)}
                                            className="w-full rounded-md border border-slate-300 p-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Modèle
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.vehicleModel}
                                            onChange={(e) => handleInputChange('vehicleModel', e.target.value)}
                                            className="w-full rounded-md border border-slate-300 p-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Plaque d'immatriculation
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.licensePlate}
                                            onChange={(e) => handleInputChange('licensePlate', e.target.value)}
                                            className="w-full rounded-md border border-slate-300 p-2"
                                        />
                                    </div>
                                </div>
                                {/* ✅ NOUVEAU : Champs spécifiques pour tricycle, pickup, fourgonnette, camion */}
                                {(formData.vehicleType === 'tricycle' || formData.vehicleType === 'pickup' || formData.vehicleType === 'van' || formData.vehicleType === 'truck') && (
                                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <p className="text-sm text-blue-800 mb-2">
                                            <strong>Informations supplémentaires requises :</strong>
                                        </p>
                                        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                                            {formData.vehicleType === 'tricycle' && (
                                                <>
                                                    <li>Capacité de charge (kg)</li>
                                                    <li>Dimensions de la caisse</li>
                                                </>
                                            )}
                                            {(formData.vehicleType === 'pickup' || formData.vehicleType === 'van' || formData.vehicleType === 'truck') && (
                                                <>
                                                    <li>Capacité de charge maximale (kg)</li>
                                                    <li>Volume de chargement (m³)</li>
                                                    <li>Type de permis requis (B, C, CE)</li>
                                                </>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </>
                        )}
                    </section>

                    {/* Documents */}
                    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            Documents
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Pièce d'identité (CNI/Passeport) *
                                </label>
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => handleFileUpload('idDocument', e.target.files?.[0] || null)}
                                    className="w-full rounded-md border border-slate-300 p-2"
                                />
                                {errors.idDocument && <p className="text-sm text-red-500 mt-1">{errors.idDocument}</p>}
                                {formData.idDocument && (
                                    <p className="text-sm text-slate-600 mt-1">📄 {formData.idDocument.name}</p>
                                )}
                            </div>
                            {formData.vehicleType !== 'walking' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Permis de conduire *
                                        {formData.vehicleType === 'truck' && (
                                            <span className="text-xs text-amber-600 ml-1">(Permis C ou CE requis)</span>
                                        )}
                                        {(formData.vehicleType === 'pickup' || formData.vehicleType === 'van') && (
                                            <span className="text-xs text-amber-600 ml-1">(Permis B minimum)</span>
                                        )}
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={(e) => handleFileUpload('driverLicense', e.target.files?.[0] || null)}
                                        className="w-full rounded-md border border-slate-300 p-2"
                                    />
                                    {errors.driverLicense && <p className="text-sm text-red-500 mt-1">{errors.driverLicense}</p>}
                                    {formData.driverLicense && (
                                        <p className="text-sm text-slate-600 mt-1">📄 {formData.driverLicense.name}</p>
                                    )}
                                </div>
                            )}
                            {formData.vehicleType !== 'walking' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Carte grise {formData.vehicleType === 'truck' || formData.vehicleType === 'pickup' || formData.vehicleType === 'van' ? '*' : '(optionnel)'}
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={(e) => handleFileUpload('vehicleRegistration', e.target.files?.[0] || null)}
                                        className="w-full rounded-md border border-slate-300 p-2"
                                    />
                                    {formData.vehicleRegistration && (
                                        <p className="text-sm text-slate-600 mt-1">📄 {formData.vehicleRegistration.name}</p>
                                    )}
                                </div>
                            )}
                            {/* ✅ NOUVEAU : Assurance requise pour véhicules motorisés (sauf moto/vélo) */}
                            {(formData.vehicleType === 'car' || formData.vehicleType === 'pickup' || formData.vehicleType === 'van' || formData.vehicleType === 'truck') && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Assurance véhicule *
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={(e) => handleFileUpload('insuranceDocument', e.target.files?.[0] || null)}
                                        className="w-full rounded-md border border-slate-300 p-2"
                                    />
                                    {formData.insuranceDocument && (
                                        <p className="text-sm text-slate-600 mt-1">📄 {formData.insuranceDocument.name}</p>
                                    )}
                                    <p className="text-xs text-slate-500 mt-1">Carte verte ou attestation d'assurance</p>
                                </div>
                            )}
                            {/* ✅ NOUVEAU: Plan de localisation (obligatoire) */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Plan de localisation (carte/plan de votre zone d'intervention) *
                                </label>
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => handleFileUpload('locationPlan', e.target.files?.[0] || null)}
                                    className={`w-full rounded-md border p-2 ${errors.locationPlan ? 'border-red-500' : 'border-slate-300'}`}
                                />
                                {errors.locationPlan && <p className="text-sm text-red-500 mt-1">{errors.locationPlan}</p>}
                                {formData.locationPlan && (
                                    <p className="text-sm text-slate-600 mt-1">📄 {formData.locationPlan.name}</p>
                                )}
                                <p className="text-xs text-slate-500 mt-1">
                                    Indiquez votre zone d'intervention principale sur une carte (capture d'écran Google Maps, plan, etc.)
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Disponibilités */}
                    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-xl font-semibold text-slate-900 mb-4">
                            Disponibilités
                        </h2>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Jours de disponibilité *
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {daysOfWeek.map((day) => (
                                    <button
                                        key={day.value}
                                        type="button"
                                        onClick={() => toggleAvailabilityDay(day.value)}
                                        className={`p-2 rounded-md border transition-colors ${formData.availabilityDays.includes(day.value)
                                            ? 'bg-primary text-white border-primary'
                                            : 'bg-white border-slate-300 hover:border-slate-400'
                                            }`}
                                    >
                                        {day.label}
                                    </button>
                                ))}
                            </div>
                            {errors.availabilityDays && (
                                <p className="text-sm text-red-500 mt-1">{errors.availabilityDays}</p>
                            )}
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Heure de début
                                </label>
                                <input
                                    type="time"
                                    value={formData.availabilityHours.start}
                                    onChange={(e) => handleInputChange('availabilityHours', {
                                        ...formData.availabilityHours,
                                        start: e.target.value
                                    })}
                                    className="w-full rounded-md border border-slate-300 p-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Heure de fin
                                </label>
                                <input
                                    type="time"
                                    value={formData.availabilityHours.end}
                                    onChange={(e) => handleInputChange('availabilityHours', {
                                        ...formData.availabilityHours,
                                        end: e.target.value
                                    })}
                                    className="w-full rounded-md border border-slate-300 p-2"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Bio et expérience */}
                    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-xl font-semibold text-slate-900 mb-4">
                            Informations complémentaires
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Bio (optionnel)
                                </label>
                                <textarea
                                    value={formData.bio}
                                    onChange={(e) => handleInputChange('bio', e.target.value)}
                                    rows={3}
                                    className="w-full rounded-md border border-slate-300 p-2"
                                    placeholder="Parlez-nous de vous..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Expérience (optionnel)
                                </label>
                                <textarea
                                    value={formData.experience}
                                    onChange={(e) => handleInputChange('experience', e.target.value)}
                                    rows={3}
                                    className="w-full rounded-md border border-slate-300 p-2"
                                    placeholder="Décrivez votre expérience en livraison..."
                                />
                            </div>
                        </div>
                    </section>

                    {/* Actions */}
                    <div className="flex gap-4 justify-end">
                        <Button
                            variant="outline"
                            onClick={() => handleSubmit(false)}
                            disabled={loading}
                        >
                            Enregistrer en brouillon
                        </Button>
                        <Button
                            onClick={() => handleSubmit(true)}
                            disabled={loading}
                        >
                            {loading ? 'Envoi en cours...' : 'Soumettre la candidature'}
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
};

export default CourierRegistrationPage;

