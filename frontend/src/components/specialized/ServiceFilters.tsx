// ✅ NOUVEAU Phase 5.2: Composant de filtres pour la gestion des services spécialisés (Web)
// Différent de SearchFilters.tsx qui est pour la recherche publique
// Filtres: type, statut, date de création

import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Button } from '../ui/buttons/Button';

export interface ServiceFilters {
    type?: string; // "pharmacie", "hopital", etc. ou "all"
    status?: 'all' | 'active' | 'inactive';
    dateRange?: 'all' | 'today' | 'week' | 'month' | 'year';
    [key: string]: any;
}

interface Props {
    visible: boolean;
    onClose: () => void;
    onApply: (filters: ServiceFilters) => void;
    initialFilters?: ServiceFilters;
}

const ServiceFilters: React.FC<Props> = ({
    visible,
    onClose,
    onApply,
    initialFilters,
}) => {
    const [filters, setFilters] = useState<ServiceFilters>(
        initialFilters || {
            type: 'all',
            status: 'all',
            dateRange: 'all',
        }
    );

    useEffect(() => {
        if (initialFilters) {
            setFilters(initialFilters);
        }
    }, [initialFilters]);

    const serviceTypes = [
        { value: 'all', label: 'Tous les types', icon: '📋' },
        { value: 'pharmacie', label: 'Pharmacie', icon: '💊' },
        { value: 'hopital', label: 'Hôpital', icon: '🏥' },
        { value: 'laboratoire', label: 'Laboratoire', icon: '🔬' },
        { value: 'banque_sang', label: 'Banque de Sang', icon: '🩸' },
        { value: 'agence_voyage', label: 'Agence de Voyage', icon: '🚌' },
        { value: 'covoiturage', label: 'Covoiturage', icon: '🚗' },
        { value: 'taxi', label: 'Taxi', icon: '🚕' },
    ];

    const statusOptions = [
        { value: 'all', label: 'Tous', icon: '📊' },
        { value: 'active', label: 'Actifs', icon: '✅' },
        { value: 'inactive', label: 'Inactifs', icon: '❌' },
    ];

    const dateRanges = [
        { value: 'all', label: 'Toutes les dates', icon: '📅' },
        { value: 'today', label: "Aujourd'hui", icon: '🕐' },
        { value: 'week', label: 'Cette semaine', icon: '📆' },
        { value: 'month', label: 'Ce mois', icon: '🗓️' },
        { value: 'year', label: 'Cette année', icon: '📅' },
    ];

    const handleApply = () => {
        onApply(filters);
        onClose();
    };

    const handleReset = () => {
        const resetFilters: ServiceFilters = {
            type: 'all',
            status: 'all',
            dateRange: 'all',
        };
        setFilters(resetFilters);
        onApply(resetFilters);
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black bg-opacity-50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-t-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-xl font-bold text-gray-900">Filtres</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Filtre par type */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">
                            Type de service
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {serviceTypes.map((type) => (
                                <button
                                    key={type.value}
                                    onClick={() => setFilters({ ...filters, type: type.value })}
                                    className={`flex flex-col items-center p-3 rounded-lg border-2 transition-colors ${filters.type === type.value
                                            ? 'border-indigo-600 bg-indigo-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <span className="text-2xl mb-1">{type.icon}</span>
                                    <span
                                        className={`text-xs font-medium ${filters.type === type.value
                                                ? 'text-indigo-600'
                                                : 'text-gray-700'
                                            }`}
                                    >
                                        {type.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Filtre par statut */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Statut</h3>
                        <div className="flex gap-2">
                            {statusOptions.map((status) => (
                                <button
                                    key={status.value}
                                    onClick={() => setFilters({ ...filters, status: status.value as any })}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-colors ${filters.status === status.value
                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                        }`}
                                >
                                    <span>{status.icon}</span>
                                    <span className="text-sm font-medium">{status.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Filtre par date */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">
                            Date de création
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {dateRanges.map((range) => (
                                <button
                                    key={range.value}
                                    onClick={() => setFilters({ ...filters, dateRange: range.value as any })}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${filters.dateRange === range.value
                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                        }`}
                                >
                                    <span>{range.icon}</span>
                                    <span className="text-sm font-medium">{range.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-6 border-t bg-gray-50">
                    <Button
                        onClick={handleReset}
                        variant="outline"
                        className="flex-1"
                    >
                        Réinitialiser
                    </Button>
                    <Button
                        onClick={handleApply}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                    >
                        Appliquer
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ServiceFilters;



