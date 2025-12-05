import { Badge } from '@/components/ui/badge';
import axios from 'axios';
import { Clock, History, RotateCcw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { buildUrl } from '../config/api.config';
import { Button } from './ui/buttons/Button';
import { Card, CardContent } from './ui/card';

interface PubliciteVersion {
    id: number;
    version_number: number;
    change_type: string;
    change_description: string | null;
    created_at: string;
    changed_by: number | null;
}

interface PubliciteVersionHistoryProps {
    campaignId: number;
    onVersionSelect?: (versionNumber: number) => void;
}

const PubliciteVersionHistory: React.FC<PubliciteVersionHistoryProps> = ({
    campaignId,
    onVersionSelect,
}) => {
    const [versions, setVersions] = useState<PubliciteVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
    const [restoring, setRestoring] = useState(false);

    useEffect(() => {
        fetchVersions();
    }, [campaignId]);

    const fetchVersions = async () => {
        try {
            setLoading(true);
            const response = await axios.get<{ versions: PubliciteVersion[] }>(
                buildUrl(`/api/publicites/${campaignId}/versions`)
            );
            setVersions(response.data.versions);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Erreur lors du chargement de l\'historique');
            console.error('Erreur versions:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (versionNumber: number) => {
        if (!confirm(`Voulez-vous vraiment restaurer la version ${versionNumber} ?`)) {
            return;
        }

        try {
            setRestoring(true);
            await axios.post(
                buildUrl(`/api/publicites/${campaignId}/versions/${versionNumber}/restore`)
            );
            alert('Version restaurée avec succès !');
            fetchVersions();
            if (onVersionSelect) {
                onVersionSelect(versionNumber);
            }
        } catch (err: any) {
            alert(err.response?.data?.error || 'Erreur lors de la restauration');
            console.error('Erreur restauration:', err);
        } finally {
            setRestoring(false);
        }
    };

    const getChangeTypeLabel = (type: string) => {
        switch (type) {
            case 'created':
                return 'Création';
            case 'updated':
                return 'Modification';
            case 'paused':
                return 'Mise en pause';
            case 'resumed':
                return 'Reprise';
            case 'deleted':
                return 'Suppression';
            default:
                return type;
        }
    };

    const getChangeTypeColor = (type: string) => {
        switch (type) {
            case 'created':
                return 'bg-green-100 text-green-800 border-green-300';
            case 'updated':
                return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'paused':
                return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'resumed':
                return 'bg-green-100 text-green-800 border-green-300';
            case 'deleted':
                return 'bg-red-100 text-red-800 border-red-300';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Chargement de l'historique...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">❌ {error}</p>
            </div>
        );
    }

    if (versions.length === 0) {
        return (
            <div className="text-center p-8 text-gray-500">
                <History className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-semibold">Aucun historique disponible</p>
                <p className="text-sm mt-2">Les modifications seront enregistrées automatiquement.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="text-xl font-bold">Historique des Modifications</h3>
                <Badge variant="outline" className="ml-auto">
                    {versions.length} version{versions.length > 1 ? 's' : ''}
                </Badge>
            </div>

            <div className="space-y-3">
                {versions.map((version) => (
                    <Card
                        key={version.id}
                        className={`border-l-4 ${selectedVersion === version.version_number
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-300'
                            }`}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Badge className={getChangeTypeColor(version.change_type)}>
                                            {getChangeTypeLabel(version.change_type)}
                                        </Badge>
                                        <span className="text-sm font-semibold text-gray-600">
                                            Version {version.version_number}
                                        </span>
                                    </div>
                                    {version.change_description && (
                                        <p className="text-sm text-gray-600 mb-2">
                                            {version.change_description}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <Clock className="w-3 h-3" />
                                        <span>
                                            {new Date(version.created_at).toLocaleString('fr-FR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRestore(version.version_number)}
                                        disabled={restoring || version.version_number === versions[0]?.version_number}
                                    >
                                        <RotateCcw className="w-4 h-4 mr-1" />
                                        Restaurer
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {versions.length > 1 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                        💡 <strong>Astuce :</strong> Vous pouvez restaurer n'importe quelle version précédente.
                        La version actuelle est la version {versions[0]?.version_number}.
                    </p>
                </div>
            )}
        </div>
    );
};

export default PubliciteVersionHistory;

