// ✅ Page de validation Live/Video d'un livre scolaire lors d'un troc (Frontend)

import { Camera, Upload, Video, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { useToast } from '../../hooks/use-toast';
import { apiGet, apiPost } from '../../services/apiService';
import { Loader2 } from 'lucide-react';

const TrocLiveValidationPage: React.FC = () => {
    const { trocId } = useParams<{ trocId: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [step, setStep] = useState<'info' | 'upload' | 'review' | 'uploading'>('info');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoPreview, setVideoPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [trocData, setTrocData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (trocId) {
            loadTrocData();
        }
    }, [trocId]);

    const loadTrocData = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/troc-livres/${trocId}`);
            const data = await response.json();

            if (data.success && data.data) {
                setTrocData(data.data);
            }
        } catch (error: any) {
            console.error('[TrocLiveValidationPage] Erreur:', error);
            toast({
                title: 'Erreur',
                description: 'Impossible de charger les données du troc',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Vérifier le type de fichier
        if (!file.type.startsWith('video/')) {
            toast({
                title: 'Erreur',
                description: 'Veuillez sélectionner un fichier vidéo',
                variant: 'destructive',
            });
            return;
        }

        // Vérifier la taille (max 100MB)
        if (file.size > 100 * 1024 * 1024) {
            toast({
                title: 'Erreur',
                description: 'Le fichier vidéo est trop volumineux (max 100MB)',
                variant: 'destructive',
            });
            return;
        }

        setVideoFile(file);

        // Créer une prévisualisation
        const reader = new FileReader();
        reader.onload = (e) => {
            setVideoPreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);

        setStep('review');
    };

    const handleStartRecording = () => {
        // Sur le web, on ne peut pas enregistrer directement depuis le navigateur
        // On propose plutôt d'uploader une vidéo préalablement enregistrée
        setStep('upload');
    };

    const handleUploadVideo = async () => {
        if (!videoFile || !trocData) {
            return;
        }

        try {
            setUploading(true);
            setStep('uploading');

            // ✅ TODO: Uploader la vidéo vers le serveur (Cloud Storage GCP / Cloud CDN GCP)
            // ⚠️ AWS/Cloudflare (ancien): Uploader la vidéo vers le serveur (S3/Cloudflare)
            // const formData = new FormData();
            // formData.append('video', videoFile);
            // formData.append('troc_id', trocId || '');
            // formData.append('livre_id', trocData.livre_offert_id?.toString() || '');

            // const uploadResponse = await apiPost(
            //     `/api/troc-livres/${trocId}/upload-validation-video`,
            //     formData,
            //     {
            //         headers: { 'Content-Type': 'multipart/form-data' },
            //     }
            // );

            // Simuler un délai d'upload
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Mettre à jour le statut de validation vidéo
            const response = await apiPost(`/api/troc-livres/${trocId}/validate-video`, {
                video_url: videoPreview || '', // En production, utiliser l'URL du serveur
            });
            const data = await response.json();

            if (data.success) {
                toast({
                    title: 'Succès',
                    description: 'Vidéo de validation enregistrée avec succès !',
                });
                setTimeout(() => {
                    navigate(`/trocs/${trocId}`);
                }, 1500);
            } else {
                throw new Error(data.error || 'Erreur lors de l\'upload');
            }
        } catch (error: any) {
            console.error('[TrocLiveValidationPage] Erreur upload:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible d\'uploader la vidéo',
                variant: 'destructive',
            });
            setStep('review');
        } finally {
            setUploading(false);
        }
    };

    const handleRetake = () => {
        setVideoFile(null);
        setVideoPreview(null);
        setStep('upload');
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                        <p className="text-gray-600">Chargement...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'uploading') {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                        <p className="text-gray-600">Upload en cours...</p>
                        <p className="text-sm text-gray-500 mt-2">
                            Veuillez patienter, la vidéo est en cours d'envoi
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'review' && videoFile && videoPreview) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Video className="h-6 w-6" />
                            Vidéo sélectionnée
                        </CardTitle>
                        <CardDescription>
                            Votre vidéo de validation est prête à être envoyée
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                            <video
                                src={videoPreview}
                                controls
                                className="w-full h-full"
                            />
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm text-gray-600">
                                <strong>Fichier:</strong> {videoFile.name}
                            </p>
                            <p className="text-sm text-gray-600">
                                <strong>Taille:</strong> {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                            <p className="text-sm text-gray-600">
                                <strong>Type:</strong> {videoFile.type}
                            </p>
                        </div>

                        <div className="flex gap-4">
                            <Button
                                variant="outline"
                                onClick={handleRetake}
                                className="flex-1"
                            >
                                <X className="h-4 w-4 mr-2" />
                                Choisir une autre vidéo
                            </Button>
                            <Button
                                onClick={handleUploadVideo}
                                className="flex-1"
                                disabled={uploading}
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Upload en cours...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="h-4 w-4 mr-2" />
                                        Envoyer la vidéo
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (step === 'upload') {
        return (
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Camera className="h-6 w-6" />
                            Uploader une vidéo
                        </CardTitle>
                        <CardDescription>
                            Sélectionnez une vidéo de validation préalablement enregistrée
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                            <input
                                type="file"
                                accept="video/*"
                                onChange={handleFileSelect}
                                className="hidden"
                                id="video-upload"
                            />
                            <label
                                htmlFor="video-upload"
                                className="cursor-pointer flex flex-col items-center gap-4"
                            >
                                <Video className="h-16 w-16 text-gray-400" />
                                <div>
                                    <p className="text-lg font-semibold text-gray-700">
                                        Cliquez pour sélectionner une vidéo
                                    </p>
                                    <p className="text-sm text-gray-500 mt-2">
                                        Formats acceptés: MP4, MOV, AVI (max 100MB)
                                    </p>
                                </div>
                                <Button variant="outline" type="button">
                                    Choisir un fichier
                                </Button>
                            </label>
                        </div>

                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p className="text-sm text-yellow-800">
                                <strong>💡 Astuce:</strong> Pour un meilleur résultat, utilisez l'application mobile
                                qui permet d'enregistrer directement depuis la caméra.
                            </p>
                        </div>

                        <Button
                            variant="outline"
                            onClick={() => setStep('info')}
                            className="w-full"
                        >
                            Retour
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Écran d'information initial
    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Camera className="h-6 w-6" />
                        Validation vidéo du livre
                    </CardTitle>
                    <CardDescription>
                        Enregistrez une vidéo pour valider l'état du livre
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {trocData && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">Livre à valider:</p>
                            <p className="text-lg font-semibold">
                                {trocData.livre_offert?.titre || 'Livre'}
                            </p>
                        </div>
                    )}

                    <div>
                        <h3 className="text-lg font-semibold mb-3">📋 Instructions</h3>
                        <p className="text-gray-600 mb-4">
                            Pour valider l'état du livre, vous devez enregistrer une vidéo montrant :
                        </p>
                        <ul className="space-y-2 text-gray-700">
                            <li className="flex items-start gap-2">
                                <span>✓</span>
                                <span>La couverture du livre (recto et verso)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span>✓</span>
                                <span>Les pages importantes (première et dernière page)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span>✓</span>
                                <span>Les dommages éventuels (coins abîmés, pages déchirées, etc.)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span>✓</span>
                                <span>Le dos du livre (reliure)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span>✓</span>
                                <span>L'état général du livre</span>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Important</h3>
                        <ul className="text-sm text-yellow-800 space-y-1">
                            <li>• La vidéo doit durer entre 30 et 60 secondes</li>
                            <li>• Assurez-vous d'avoir un bon éclairage</li>
                            <li>• Montrez clairement tous les détails</li>
                            <li>• Formats acceptés: MP4, MOV, AVI (max 100MB)</li>
                        </ul>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                            <strong>💡 Note:</strong> Pour une meilleure expérience, utilisez l'application mobile
                            qui permet d'enregistrer directement depuis la caméra avec des instructions guidées.
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <Button
                            variant="outline"
                            onClick={() => navigate(-1)}
                            className="flex-1"
                        >
                            <X className="h-4 w-4 mr-2" />
                            Annuler
                        </Button>
                        <Button
                            onClick={handleStartRecording}
                            className="flex-1"
                        >
                            <Video className="h-4 w-4 mr-2" />
                            Uploader une vidéo
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default TrocLiveValidationPage;

