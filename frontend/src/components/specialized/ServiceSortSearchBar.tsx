// ✅ NOUVEAU Phase 5.3: Composant de recherche et tri pour gestion services spécialisés (Web)
// Combine recherche en temps réel + dropdown de tri

import { ArrowDown, ArrowUp, Calendar, CheckCircle, Edit, Search, X } from 'lucide-react';
import React, { useState } from 'react';

export type SortOption = 'name' | 'date' | 'status' | 'created_at' | 'updated_at';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
    field: SortOption;
    direction: SortDirection;
}

interface Props {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    sortConfig: SortConfig;
    onSortChange: (config: SortConfig) => void;
    placeholder?: string;
}

const ServiceSortSearchBar: React.FC<Props> = ({
    searchQuery,
    onSearchChange,
    sortConfig,
    onSortChange,
    placeholder = 'Rechercher dans la liste...',
}) => {
    const [showSortDropdown, setShowSortDropdown] = useState(false);

    const sortOptions: Array<{ value: SortOption; label: string; icon: React.ReactNode }> = [
        { value: 'name', label: 'Nom', icon: <Search className="w-4 h-4" /> },
        { value: 'created_at', label: 'Date de création', icon: <Calendar className="w-4 h-4" /> },
        { value: 'updated_at', label: 'Dernière modification', icon: <Edit className="w-4 h-4" /> },
        { value: 'status', label: 'Statut', icon: <CheckCircle className="w-4 h-4" /> },
    ];

    const getSortLabel = (): string => {
        const option = sortOptions.find((o) => o.value === sortConfig.field);
        const direction = sortConfig.direction === 'asc' ? '↑' : '↓';
        return option ? `${option.label} ${direction}` : 'Trier';
    };

    const handleSortSelect = (field: SortOption) => {
        // Si même champ, inverser la direction, sinon nouveau champ en asc
        const newDirection =
            sortConfig.field === field && sortConfig.direction === 'asc' ? 'desc' : 'asc';
        onSortChange({ field, direction: newDirection });
        setShowSortDropdown(false);
    };

    return (
        <div className="flex gap-2 mb-4">
            {/* Barre de recherche */}
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                    type="text"
                    placeholder={placeholder}
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                {searchQuery.length > 0 && (
                    <button
                        onClick={() => onSearchChange('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Dropdown tri */}
            <div className="relative">
                <button
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300 transition-colors"
                >
                    <span className="text-sm font-medium text-gray-700">{getSortLabel()}</span>
                    {sortConfig.direction === 'asc' ? (
                        <ArrowUp className="w-4 h-4 text-indigo-600" />
                    ) : (
                        <ArrowDown className="w-4 h-4 text-indigo-600" />
                    )}
                </button>

                {/* Dropdown menu */}
                {showSortDropdown && (
                    <>
                        <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowSortDropdown(false)}
                        />
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                            <div className="p-2">
                                {sortOptions.map((option) => {
                                    const isSelected = sortConfig.field === option.value;
                                    const isAsc = isSelected && sortConfig.direction === 'asc';

                                    return (
                                        <button
                                            key={option.value}
                                            onClick={() => handleSortSelect(option.value)}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isSelected
                                                    ? 'bg-indigo-50 text-indigo-600'
                                                    : 'hover:bg-gray-50 text-gray-700'
                                                }`}
                                        >
                                            <div
                                                className={`${isSelected ? 'text-indigo-600' : 'text-gray-400'
                                                    }`}
                                            >
                                                {option.icon}
                                            </div>
                                            <span className="flex-1 text-left text-sm font-medium">
                                                {option.label}
                                            </span>
                                            {isSelected && (
                                                <div className="text-indigo-600">
                                                    {isAsc ? (
                                                        <ArrowUp className="w-4 h-4" />
                                                    ) : (
                                                        <ArrowDown className="w-4 h-4" />
                                                    )}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ServiceSortSearchBar;



