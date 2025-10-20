import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CategoryFilter, getCategoryFilters, getCategoryStyle, getCategoryTerminology } from '@/config/categoryConfig';
import { Filter, RotateCcw } from 'lucide-react';
import React, { useState } from 'react';

interface CategoryFiltersProps {
    category: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApply: (filters: Record<string, any>) => void;
    initialFilters?: Record<string, any>;
}

export const CategoryFilters: React.FC<CategoryFiltersProps> = ({
    category,
    open,
    onOpenChange,
    onApply,
    initialFilters = {},
}) => {
    const categoryFilters = getCategoryFilters(category);
    const categoryStyle = getCategoryStyle(category);
    const terminology = getCategoryTerminology(category);

    const [filters, setFilters] = useState<Record<string, any>>(initialFilters);

    const handleApply = () => {
        onApply(filters);
        onOpenChange(false);
    };

    const handleReset = () => {
        setFilters({});
    };

    const renderFilter = (filter: CategoryFilter) => {
        switch (filter.type) {
            case 'range':
                return (
                    <div key={filter.id} className="space-y-3">
                        <Label className="text-sm font-semibold text-gray-900">{filter.label}</Label>
                        <div className="flex items-center gap-4">
                            <div className="flex-1 space-y-2">
                                <Label className="text-xs text-gray-500">Min</Label>
                                <Input
                                    type="number"
                                    value={filters[`${filter.id}_min`] || ''}
                                    onChange={(e) => setFilters({
                                        ...filters,
                                        [`${filter.id}_min`]: e.target.value ? parseFloat(e.target.value) : null,
                                    })}
                                    placeholder={filter.min?.toString()}
                                    className="h-9"
                                />
                                {filter.unit && <span className="text-xs text-gray-500">{filter.unit}</span>}
                            </div>
                            <span className="text-gray-400 font-semibold mt-7">—</span>
                            <div className="flex-1 space-y-2">
                                <Label className="text-xs text-gray-500">Max</Label>
                                <Input
                                    type="number"
                                    value={filters[`${filter.id}_max`] || ''}
                                    onChange={(e) => setFilters({
                                        ...filters,
                                        [`${filter.id}_max`]: e.target.value ? parseFloat(e.target.value) : null,
                                    })}
                                    placeholder={filter.max?.toString()}
                                    className="h-9"
                                />
                                {filter.unit && <span className="text-xs text-gray-500">{filter.unit}</span>}
                            </div>
                        </div>
                    </div>
                );

            case 'select':
                return (
                    <div key={filter.id} className="space-y-3">
                        <Label className="text-sm font-semibold text-gray-900">{filter.label}</Label>
                        <div className="flex flex-wrap gap-2">
                            {filter.options?.map((option) => {
                                const isSelected = filters[filter.id] === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => setFilters({
                                            ...filters,
                                            [filter.id]: isSelected ? null : option.value,
                                        })}
                                        className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${isSelected
                                                ? `border-[${categoryStyle.primaryColor}] text-white`
                                                : 'border-gray-200 text-gray-700 hover:border-gray-300'
                                            }`}
                                        style={
                                            isSelected
                                                ? { backgroundColor: categoryStyle.primaryColor, borderColor: categoryStyle.primaryColor }
                                                : {}
                                        }
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );

            case 'multiselect':
                return (
                    <div key={filter.id} className="space-y-3">
                        <Label className="text-sm font-semibold text-gray-900">{filter.label}</Label>
                        <div className="flex flex-wrap gap-2">
                            {filter.options?.map((option) => {
                                const isSelected = Array.isArray(filters[filter.id]) && filters[filter.id].includes(option.value);
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => {
                                            const currentValues = filters[filter.id] || [];
                                            const newValues = isSelected
                                                ? currentValues.filter((v: string) => v !== option.value)
                                                : [...currentValues, option.value];
                                            setFilters({
                                                ...filters,
                                                [filter.id]: newValues.length > 0 ? newValues : null,
                                            });
                                        }}
                                        className={`px-3 py-1.5 rounded-lg border-1.5 text-sm font-medium transition-all ${isSelected
                                                ? 'border-gray-300 text-gray-800'
                                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                            }`}
                                        style={isSelected ? { backgroundColor: categoryStyle.badgeColor, borderColor: categoryStyle.primaryColor } : {}}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );

            case 'toggle':
                return (
                    <div key={filter.id} className="flex items-center justify-between py-2">
                        <Label className="text-sm font-semibold text-gray-900">{filter.label}</Label>
                        <Switch
                            checked={filters[filter.id] || false}
                            onCheckedChange={(value) => setFilters({
                                ...filters,
                                [filter.id]: value || null,
                            })}
                            style={{ ['--switch-bg' as any]: categoryStyle.primaryColor }}
                        />
                    </div>
                );

            case 'date':
                return (
                    <div key={filter.id} className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-900">{filter.label}</Label>
                        <Input
                            type="date"
                            value={filters[filter.id] || ''}
                            onChange={(e) => setFilters({
                                ...filters,
                                [filter.id]: e.target.value || null,
                            })}
                            className="h-9"
                        />
                    </div>
                );

            case 'time':
                return (
                    <div key={filter.id} className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-900">{filter.label}</Label>
                        <Input
                            type="time"
                            value={filters[filter.id] || ''}
                            onChange={(e) => setFilters({
                                ...filters,
                                [filter.id]: e.target.value || null,
                            })}
                            className="h-9"
                        />
                    </div>
                );

            default:
                return null;
        }
    };

    // Compter le nombre de filtres actifs
    const activeFiltersCount = Object.keys(filters).filter((key) => {
        const value = filters[key];
        return value !== null && value !== undefined && value !== '';
    }).length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <Filter className="w-5 h-5" style={{ color: categoryStyle.primaryColor }} />
                        <span>Filtrer les {terminology.productsLabel.toLowerCase()}</span>
                        {activeFiltersCount > 0 && (
                            <Badge style={{ backgroundColor: categoryStyle.primaryColor }} className="ml-2">
                                {activeFiltersCount}
                            </Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {categoryFilters.map((filter) => renderFilter(filter))}
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={handleReset}
                        className="flex items-center gap-2"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Réinitialiser
                    </Button>
                    <Button
                        onClick={handleApply}
                        className="flex items-center gap-2"
                        style={{ backgroundColor: categoryStyle.primaryColor }}
                    >
                        Appliquer les filtres
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

