import AppLayout from '@/components/layout/AppLayout';
import { useUser } from '@/hooks/useUser';
import { Building2, Car, Clock, Droplet, Heart, Microscope, Plane, Stethoscope } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ServiceSpecialise {
    id: string;
    name: string;
    icon: React.ReactNode;
    description: string;
    route: string;
    color: string;
    bgColor: string;
}

const servicesSante: ServiceSpecialise[] = [
    {
        id: 'pharmacie',
        name: 'Pharmacie',
        icon: <Stethoscope className="w-6 h-6" />,
        description: 'Enregistrer une pharmacie de garde',
        route: '/pharmacie-form',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
    },
    {
        id: 'hopital',
        name: 'Hôpital/Clinique',
        icon: <Building2 className="w-6 h-6" />,
        description: 'Enregistrer un établissement de santé',
        route: '/hopital-form',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
    },
    {
        id: 'laboratoire',
        name: 'Laboratoire/Imagerie',
        icon: <Microscope className="w-6 h-6" />,
        description: 'Enregistrer un laboratoire ou centre d\'imagerie',
        route: '/laboratoire-form',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
    },
    {
        id: 'banque_sang',
        name: 'Banque de Sang',
        icon: <Droplet className="w-6 h-6" />,
        description: 'Enregistrer une banque de sang',
        route: '/banque-sang-form',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
    },
];

const servicesTransport: ServiceSpecialise[] = [
    {
        id: 'agence',
        name: 'Agence de Voyage',
        icon: <Plane className="w-6 h-6" />,
        description: 'Enregistrer une agence de voyage',
        route: '/agence-voyage-form',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
    },
    {
        id: 'covoiturage',
        name: 'Covoiturage',
        icon: <Car className="w-6 h-6" />,
        description: 'Proposer un trajet de covoiturage',
        route: '/covoiturage-form',
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
    },
    {
        id: 'taxi',
        name: 'Taxi de Ville',
        icon: <Car className="w-6 h-6" />,
        description: 'Enregistrer un service de taxi',
        route: '/taxi-form',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
    },
];

export default function MesServicesSpecialisesPage() {
    const navigate = useNavigate();
    const { user } = useUser();

    const handleServiceClick = (service: ServiceSpecialise) => {
        // Naviguer vers le formulaire avec serviceId si disponible
        navigate(service.route, {
            state: {
                serviceId: null, // À remplir avec le service_id de l'utilisateur
            },
        });
    };

    return (
        <AppLayout>
            <div className="min-h-screen bg-gray-50">
                <div className="bg-white border-b border-gray-200">
                    <div className="max-w-7xl mx-auto px-4 py-6">
                        <h1 className="text-3xl font-bold text-gray-900">Mes Services Spécialisés</h1>
                        <p className="text-gray-600 mt-2">
                            Gérez vos services spécialisés de santé et de transport
                        </p>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 py-8">
                    {/* Groupe Santé */}
                    <div className="mb-12">
                        <div className="flex items-center gap-3 mb-6">
                            <Heart className="w-6 h-6 text-red-600" />
                            <h2 className="text-2xl font-semibold text-gray-900">Santé</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {servicesSante.map((service) => (
                                <button
                                    key={service.id}
                                    onClick={() => handleServiceClick(service)}
                                    className={`${service.bgColor} rounded-lg p-6 text-left hover:shadow-lg transition-all border-2 border-transparent hover:border-${service.color.split('-')[1]}-300`}
                                >
                                    <div className={`${service.color} mb-4`}>{service.icon}</div>
                                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{service.name}</h3>
                                    <p className="text-gray-600 text-sm">{service.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Groupe Transport */}
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <Car className="w-6 h-6 text-blue-600" />
                            <h2 className="text-2xl font-semibold text-gray-900">Transport</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {servicesTransport.map((service) => (
                                <div key={service.id} className="relative">
                                    <button
                                        onClick={() => handleServiceClick(service)}
                                        className={`${service.bgColor} rounded-lg p-6 text-left hover:shadow-lg transition-all border-2 border-transparent hover:border-${service.color.split('-')[1]}-300 w-full`}
                                    >
                                        <div className={`${service.color} mb-4`}>{service.icon}</div>
                                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{service.name}</h3>
                                        <p className="text-gray-600 text-sm">{service.description}</p>
                                    </button>
                                    {/* ✅ NOUVEAU: Bouton spécial pour agences de voyage - Gérer les horaires */}
                                    {service.id === 'agence' && (
                                        <button
                                            onClick={() => navigate('/agency/schedules')}
                                            className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Clock className="w-4 h-4" />
                                            Gérer les horaires de départ
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

