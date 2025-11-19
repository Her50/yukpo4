// ✅ Phase 9 - Amélioration : Composant pour uploader des médias de preuve (pickup/delivery)
import { Button } from '@/components/ui/buttons/Button';
import { useToast } from '@/components/ui/use-toast';
import { deleteProofMedia, listProofMedia, type DeliveryProofMedia } from '@/services/deliveryApi';
import { Image, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface ProofMediaUploadProps {
    deliveryId: string;
    proofType: 'pickup' | 'delivery';
    isCourier: boolean;
    onMediaUpdated?: () => void;
}

const ProofMediaUpload: React.FC<ProofMediaUploadProps> = ({
    deliveryId,
    proofType,
    isCourier,
    onMediaUpdated,
}) => {
    const { toast } = useToast();
    const [media, setMedia] = useState<DeliveryProofMedia[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        loadMedia();
    }, [deliveryId, proofType]);

    const loadMedia = async () => {
        setLoading(true);
        try {
            const response = await listProofMedia(deliveryId);
            const filtered = response.media.filter(m => m.proof_type === proofType);
            setMedia(filtered);
        } catch (error: any) {
            console.error('Erreur chargement médias:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Vérifier le type de fichier
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (!isImage && !isVideo) {
            toast({
                title: 'Erreur',
                description: 'Veuillez sélectionner une image ou une vidéo',
            });
            return;
        }

        setUploading(true);
        try {
            // ✅ Phase 9 - Amélioration : Uploader le fichier via multipart/form-data
            const formData = new FormData();
            formData.append('file', file);
            formData.append('delivery_id', deliveryId);
            formData.append('proof_type', proofType);

            const token = localStorage.getItem('token');
            const response = await fetch('/api/media/upload-proof', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Impossible d\'uploader le média');
            }

            const result = await response.json();
            const media = result.media;

            toast({
                title: '✅ Média ajouté',
                description: `${isImage ? 'Image' : 'Vidéo'} de ${proofType === 'pickup' ? 'récupération' : 'livraison'} ajoutée avec succès`,
            });

            loadMedia();
            onMediaUpdated?.();
        } catch (error: any) {
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible d\'ajouter le média',
            });
        } finally {
            setUploading(false);
            // Réinitialiser l'input
            event.target.value = '';
        }
    };

    const handleDelete = async (mediaId: number) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce média ?')) {
            return;
        }

        try {
            await deleteProofMedia(deliveryId, mediaId);
            toast({
                title: '✅ Média supprimé',
                description: 'Le média a été supprimé avec succès',
            });
            loadMedia();
            onMediaUpdated?.();
        } catch (error: any) {
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de supprimer le média',
            });
        }
    };

    const pickupMedia = media.filter(m => m.proof_type === 'pickup');
    const deliveryMedia = media.filter(m => m.proof_type === 'delivery');
    const currentMedia = proofType === 'pickup' ? pickupMedia : deliveryMedia;

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900">
                    {proofType === 'pickup' ? '📸 Preuve de récupération' : '📦 Preuve de livraison'}
                </h3>
                {isCourier && (
                    <div className="flex gap-2">
                        <label className="cursor-pointer">
                            <input
                                type="file"
                                accept="image/*,video/*"
                                onChange={handleFileSelect}
                                disabled={uploading}
                                className="hidden"
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={uploading}
                                className="flex items-center gap-2"
                            >
                                {uploading ? (
                                    <>⏳ Upload...</>
                                ) : (
                                    <>
                                        <Image className="w-4 h-4" />
                                        Ajouter
                                    </>
                                )}
                            </Button>
                        </label>
                    </div>
                )}
            </div>

            {loading ? (
                <p className="text-sm text-slate-500">Chargement...</p>
            ) : currentMedia.length === 0 ? (
                <p className="text-sm text-slate-500">
                    {isCourier
                        ? `Aucune ${proofType === 'pickup' ? 'preuve de récupération' : 'preuve de livraison'} pour le moment`
                        : `Aucune ${proofType === 'pickup' ? 'preuve de récupération' : 'preuve de livraison'} disponible`}
                </p>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {currentMedia.map((item) => (
                        <div key={item.id} className="relative group">
                            {item.media_type === 'image' ? (
                                <img
                                    src={item.media_url.startsWith('http')
                                        ? item.media_url
                                        : `${window.location.origin}${item.media_url.startsWith('/') ? '' : '/'}${item.media_url}`}
                                    alt={`Preuve ${proofType}`}
                                    className="w-full h-32 object-cover rounded-lg border border-slate-200"
                                    onError={(e) => {
                                        console.error('Erreur chargement image:', item.media_url);
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                            ) : (
                                <video
                                    src={item.media_url.startsWith('http')
                                        ? item.media_url
                                        : `${window.location.origin}${item.media_url.startsWith('/') ? '' : '/'}${item.media_url}`}
                                    className="w-full h-32 object-cover rounded-lg border border-slate-200"
                                    controls
                                    onError={(e) => {
                                        console.error('Erreur chargement vidéo:', item.media_url);
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                            )}
                            {isCourier && (
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 rounded-b-lg">
                                {new Date(item.uploaded_at).toLocaleString('fr-FR')}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Comparaison pickup vs delivery si les deux existent */}
            {pickupMedia.length > 0 && deliveryMedia.length > 0 && proofType === 'delivery' && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                    <h4 className="text-xs font-semibold text-slate-700 mb-2">
                        🔍 Comparaison état initial vs final
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-xs text-slate-600 mb-1">État initial (récupération)</p>
                            {pickupMedia[0].media_type === 'image' ? (
                                <img
                                    src={pickupMedia[0].media_url.startsWith('http')
                                        ? pickupMedia[0].media_url
                                        : `${window.location.origin}${pickupMedia[0].media_url.startsWith('/') ? '' : '/'}${pickupMedia[0].media_url}`}
                                    alt="État initial"
                                    className="w-full h-24 object-cover rounded border border-slate-200"
                                />
                            ) : (
                                <video
                                    src={pickupMedia[0].media_url.startsWith('http')
                                        ? pickupMedia[0].media_url
                                        : `${window.location.origin}${pickupMedia[0].media_url.startsWith('/') ? '' : '/'}${pickupMedia[0].media_url}`}
                                    className="w-full h-24 object-cover rounded border border-slate-200"
                                    controls
                                />
                            )}
                        </div>
                        <div>
                            <p className="text-xs text-slate-600 mb-1">État final (livraison)</p>
                            {deliveryMedia[0].media_type === 'image' ? (
                                <img
                                    src={deliveryMedia[0].media_url.startsWith('http')
                                        ? deliveryMedia[0].media_url
                                        : `${window.location.origin}${deliveryMedia[0].media_url.startsWith('/') ? '' : '/'}${deliveryMedia[0].media_url}`}
                                    alt="État final"
                                    className="w-full h-24 object-cover rounded border border-slate-200"
                                />
                            ) : (
                                <video
                                    src={deliveryMedia[0].media_url.startsWith('http')
                                        ? deliveryMedia[0].media_url
                                        : `${window.location.origin}${deliveryMedia[0].media_url.startsWith('/') ? '' : '/'}${deliveryMedia[0].media_url}`}
                                    className="w-full h-24 object-cover rounded border border-slate-200"
                                    controls
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProofMediaUpload;

