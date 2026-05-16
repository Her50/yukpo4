// ✅ Page de gestion des livres scolaires de l'utilisateur (Frontend)
//
// Affiche pour chaque livre :
//   - Valeur Yukpo allouée (= valeur_calculee, calculée à la publication
//     comme prix_detecte × ratio_etat)
//   - État (etat_classification : bon/acceptable/rejete) en badge couleur
//   - Statut troc (troc_status : pending/matched/chained/delivered/...) avec
//     mention "en attente / apparié / engagé / vendu / annulé"
//   - État du crédit : "estimé" si pending, "engagé" si chained,
//     "libéré dans votre solde" si delivered

import { BookOpen, CheckCircle2, Clock, Edit, Eye, EyeOff, Loader2, Plus, Trash2, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { apiDelete, apiGet, apiPost } from '../../services/apiService';

interface LivreScolaire {
    id: number;
    titre: string;
    auteur?: string;
    classe_actuelle: string;
    classe_souhaitee: string;
    matiere: string;
    niveau?: string;
    etat_livre: string;
    // Classification 3 niveaux établie par l'IA :
    // 'bon' (>70 % état), 'acceptable' (>40 %), 'rejete' (non publié).
    etat_classification?: string | null;
    // Valeur que Yukpo alloue au livre (= prix_detecte × ratio_etat).
    // Sert de base au crédit estimé / libéré.
    valeur_calculee?: number | string | null;
    prix_detecte?: number | string | null;
    devise_detectee?: string | null;
    // Cycle troc (migration 20260510_008) :
    //   pending → matched → chained → delivered (succès)
    //                              → expired / returned (échec)
    troc_status?: string | null;
    mode_listing?: string | null; // 'troc' | 'vente' | 'don'
    images_urls?: string[];
    is_available: boolean;
    is_active: boolean;
    created_at: string;
}

function toNumber(v: number | string | null | undefined): number {
    if (v === null || v === undefined) return 0;
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return Number.isFinite(n) ? n : 0;
}

function fmtAmount(v: number, locale: string): string {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(v);
}

const MesLivresPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();
    const locale = i18n.language || 'fr';

    const [livres, setLivres] = useState<LivreScolaire[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLivres();
    }, []);

    const loadLivres = async () => {
        try {
            setLoading(true);
            const response = await apiGet('/api/bourse-livre/mes-livres');
            const data = await response.json();

            if (data.success) {
                setLivres(data.livres || data.data?.livres || []);
            } else {
                toast({
                    title: t('bourse.mesLivres.error_title', { defaultValue: 'Erreur' }),
                    description: t('bourse.mesLivres.error_load', { defaultValue: 'Impossible de charger vos livres' }),
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            console.error('[MesLivresPage] Erreur:', error);
            toast({
                title: t('bourse.mesLivres.error_title', { defaultValue: 'Erreur' }),
                description: error.message || t('bourse.mesLivres.error_load', { defaultValue: 'Impossible de charger vos livres' }),
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleAvailability = async (livre: LivreScolaire) => {
        try {
            const response = await apiPost(`/api/bourse-livre/${livre.id}/availability`, {
                is_available: !livre.is_available,
            });
            const data = await response.json();

            if (data.success) {
                await loadLivres();
                toast({ title: t('bourse.mesLivres.success', { defaultValue: 'Succès' }), description: t('bourse.mesLivres.availability_updated', { defaultValue: 'Disponibilité mise à jour' }) });
            } else {
                toast({ title: t('bourse.mesLivres.error_title', { defaultValue: 'Erreur' }), description: t('bourse.mesLivres.availability_failed', { defaultValue: 'Impossible de mettre à jour la disponibilité' }), variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: t('bourse.mesLivres.error_title', { defaultValue: 'Erreur' }), description: error.message || t('bourse.mesLivres.generic_error', { defaultValue: 'Une erreur est survenue' }), variant: 'destructive' });
        }
    };

    const handleDelete = async (livre: LivreScolaire) => {
        if (confirm(t('bourse.mesLivres.confirm_delete', { defaultValue: `Êtes-vous sûr de vouloir supprimer "${livre.titre}" ?`, titre: livre.titre }))) {
            try {
                const response = await apiDelete(`/api/bourse-livre/${livre.id}`);
                const data = await response.json();
                if (data.success) {
                    await loadLivres();
                    toast({ title: t('bourse.mesLivres.success', { defaultValue: 'Succès' }), description: t('bourse.mesLivres.deleted', { defaultValue: 'Livre supprimé' }) });
                } else {
                    toast({ title: t('bourse.mesLivres.error_title', { defaultValue: 'Erreur' }), description: t('bourse.mesLivres.delete_failed', { defaultValue: 'Impossible de supprimer le livre' }), variant: 'destructive' });
                }
            } catch (error: any) {
                toast({ title: t('bourse.mesLivres.error_title', { defaultValue: 'Erreur' }), description: error.message || t('bourse.mesLivres.delete_failed', { defaultValue: 'Impossible de supprimer le livre' }), variant: 'destructive' });
            }
        }
    };

    const getEtatColor = (etat: string): string => {
        switch (etat) {
            case 'Neuf': return 'bg-green-100 text-green-800';
            case 'Très bon': return 'bg-emerald-100 text-emerald-800';
            case 'Bon': return 'bg-yellow-100 text-yellow-800';
            case 'Acceptable': return 'bg-orange-100 text-orange-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    // Classification 3-niveaux par l'IA — couleur + label distincts d'`etat_livre`
    // (champ déclaratif user) car etat_classification est la décision Yukpo qui
    // fonde le calcul de valeur. "rejete" est filtré côté backend, mais on
    // l'affiche défensivement si jamais ça passe.
    const getClassificationBadge = (classification: string | null | undefined) => {
        switch ((classification ?? '').toLowerCase()) {
            case 'bon': return { label: t('bourse.mesLivres.classif_bon', { defaultValue: 'Bon état' }), cls: 'bg-emerald-100 text-emerald-800' };
            case 'acceptable': return { label: t('bourse.mesLivres.classif_acceptable', { defaultValue: 'État acceptable' }), cls: 'bg-orange-100 text-orange-800' };
            case 'rejete': return { label: t('bourse.mesLivres.classif_rejete', { defaultValue: 'Rejeté' }), cls: 'bg-red-100 text-red-800' };
            default: return null;
        }
    };

    // Statut troc → label + icône + couleur. Cycle :
    //  pending  : pas encore apparié — crédit estimé seulement
    //  matched  : apparié, validation possible — crédit provisionnel
    //  chained  : engagé dans chaîne — crédit verrouillé
    //  delivered: livré → vendu/troqué selon mode_listing → crédit libéré
    //  expired / returned : annulé — pas de crédit
    type StatusInfo = { label: string; icon: React.ComponentType<{ className?: string }>; cls: string; creditLabel: string; creditCls: string };
    const getTrocStatusInfo = (status: string | null | undefined, mode: string | null | undefined): StatusInfo => {
        const s = (status ?? 'pending').toLowerCase();
        switch (s) {
            case 'matched':
                return {
                    label: t('bourse.mesLivres.troc_matched', { defaultValue: 'Apparié' }),
                    icon: Clock,
                    cls: 'bg-blue-100 text-blue-800',
                    creditLabel: t('bourse.mesLivres.credit_provisional', { defaultValue: 'Crédit provisionnel' }),
                    creditCls: 'bg-blue-50 text-blue-700 border-blue-200',
                };
            case 'chained':
                return {
                    label: t('bourse.mesLivres.troc_chained', { defaultValue: 'Engagé' }),
                    icon: Clock,
                    cls: 'bg-indigo-100 text-indigo-800',
                    creditLabel: t('bourse.mesLivres.credit_engaged', { defaultValue: 'Crédit verrouillé' }),
                    creditCls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                };
            case 'delivered': {
                // Le label final dépend du mode listing : vente → "Vendu",
                // troc → "Troqué", don → "Donné". Crédit toujours libéré.
                const labelKey = mode === 'vente' ? 'troc_delivered_sold' : mode === 'don' ? 'troc_delivered_given' : 'troc_delivered_exchanged';
                const labelDefault = mode === 'vente' ? 'Vendu' : mode === 'don' ? 'Donné' : 'Troqué';
                return {
                    label: t(`bourse.mesLivres.${labelKey}`, { defaultValue: labelDefault }),
                    icon: CheckCircle2,
                    cls: 'bg-emerald-100 text-emerald-800',
                    creditLabel: t('bourse.mesLivres.credit_released', { defaultValue: 'Crédit libéré dans votre solde' }),
                    creditCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                };
            }
            case 'expired':
                return {
                    label: t('bourse.mesLivres.troc_expired', { defaultValue: 'Expiré' }),
                    icon: XCircle,
                    cls: 'bg-gray-100 text-gray-700',
                    creditLabel: t('bourse.mesLivres.credit_cancelled', { defaultValue: 'Crédit annulé' }),
                    creditCls: 'bg-gray-50 text-gray-600 border-gray-200',
                };
            case 'returned':
                return {
                    label: t('bourse.mesLivres.troc_returned', { defaultValue: 'Annulé' }),
                    icon: XCircle,
                    cls: 'bg-rose-100 text-rose-800',
                    creditLabel: t('bourse.mesLivres.credit_rolled_back', { defaultValue: 'Crédit rétrocédé' }),
                    creditCls: 'bg-rose-50 text-rose-700 border-rose-200',
                };
            case 'pending':
            default: {
                // ✅ 2026-05-16 — Différencier le label pending selon le mode :
                //   - vente : "En vente, pas encore vendu" (clair pour l'user)
                //   - troc/echange : "En attente d'un troc"
                //   - don : "Disponible (don)"
                const labelKey =
                    mode === 'vente'
                        ? 'troc_pending_sale'
                        : mode === 'don'
                            ? 'troc_pending_gift'
                            : 'troc_pending';
                const labelDefault =
                    mode === 'vente'
                        ? 'En vente, pas encore vendu'
                        : mode === 'don'
                            ? 'Disponible (don)'
                            : "En attente d'un troc";
                return {
                    label: t(`bourse.mesLivres.${labelKey}`, { defaultValue: labelDefault }),
                    icon: Clock,
                    cls: 'bg-amber-100 text-amber-800',
                    creditLabel: t('bourse.mesLivres.credit_estimated', { defaultValue: 'Crédit estimé (non encore acquis)' }),
                    creditCls: 'bg-amber-50 text-amber-700 border-amber-200',
                };
            }
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                        <p className="text-gray-600">{t('bourse.mesLivres.loading', { defaultValue: 'Chargement...' })}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl pb-20">
            <div className="flex items-center justify-between mb-6 gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold">{t('bourse.mesLivres.title', { defaultValue: 'Mes Livres' })}</h1>
                <Button
                    onClick={() => navigate('/vendre')}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-bold shrink-0"
                >
                    <Plus className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">{t('bourse.mesLivres.scan_button', { defaultValue: 'Scanner un livre' })}</span>
                    <span className="sm:hidden">{t('bourse.mesLivres.scan_short', { defaultValue: 'Scanner' })}</span>
                </Button>
            </div>

            {livres.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <BookOpen className="h-16 w-16 text-gray-400 mb-4" />
                        <h3 className="text-xl font-semibold mb-2">{t('bourse.mesLivres.empty_title', { defaultValue: 'Aucun livre publié' })}</h3>
                        <p className="text-gray-600 mb-4 text-center">
                            {t('bourse.mesLivres.empty_desc', { defaultValue: 'Scannez votre premier livre scolaire pour commencer à échanger ou vendre' })}
                        </p>
                        <Button
                            onClick={() => navigate('/vendre')}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            {t('bourse.mesLivres.scan_button', { defaultValue: 'Scanner un livre' })}
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {livres.map((livre) => {
                        const firstImage = livre.images_urls?.[0];
                        const classifBadge = getClassificationBadge(livre.etat_classification);
                        const statusInfo = getTrocStatusInfo(livre.troc_status, livre.mode_listing);
                        const StatusIcon = statusInfo.icon;
                        const valeur = toNumber(livre.valeur_calculee ?? livre.prix_detecte ?? null);
                        const devise = livre.devise_detectee || t('bourse.mesLivres.currency', { defaultValue: 'FCFA' });

                        return (
                            <Card key={livre.id} className="hover:shadow-lg transition-shadow flex flex-col">
                                {firstImage && (
                                    <div className="w-full h-40 sm:h-48 overflow-hidden rounded-t-lg">
                                        <img
                                            src={firstImage}
                                            alt={livre.titre}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}
                                <CardContent className="p-4 flex-1 flex flex-col">
                                    <h3 className="font-bold text-base sm:text-lg mb-1 line-clamp-2">{livre.titre}</h3>
                                    {livre.auteur && (
                                        <p className="text-xs sm:text-sm text-gray-600 mb-2 line-clamp-1">{livre.auteur}</p>
                                    )}
                                    {/* ✅ FIX 2026-05-16 — Affichage classe selon mode_listing.
                                        - troc  : 'classe_actuelle → classe_souhaitee' (échange contre classe sup)
                                        - vente : 'classe_actuelle' seulement (pas d'attente en retour)
                                        - don   : 'classe_actuelle' seulement
                                        Avant le fix : flèche affichée même en vente/don → user pensait
                                        que son livre serait "échangé" alors qu'il l'avait mis en vente. */}
                                    <div className="space-y-1 mb-3 text-xs sm:text-sm text-gray-600">
                                        <p>
                                            📚 {livre.classe_actuelle}
                                            {livre.mode_listing === 'troc' && livre.classe_souhaitee && (
                                                <> → <span className="font-semibold text-amber-700">{livre.classe_souhaitee}</span></>
                                            )}
                                            {livre.mode_listing === 'vente' && (
                                                <span className="ml-1 text-[10px] uppercase tracking-wide text-emerald-700 font-semibold">· vente</span>
                                            )}
                                            {livre.mode_listing === 'don' && (
                                                <span className="ml-1 text-[10px] uppercase tracking-wide text-blue-700 font-semibold">· don</span>
                                            )}
                                        </p>
                                        <p>📖 {livre.matiere}</p>
                                    </div>

                                    {/* Valeur Yukpo + classification IA */}
                                    {valeur > 0 && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                                            <p className="text-[10px] uppercase tracking-wide text-amber-700 font-semibold">
                                                {t('bourse.mesLivres.valeur_label', { defaultValue: 'Valeur Yukpo allouée' })}
                                            </p>
                                            <p className="text-lg font-bold text-amber-900 tabular-nums leading-tight">
                                                {fmtAmount(valeur, locale)} <span className="text-xs font-medium">{devise}</span>
                                            </p>
                                        </div>
                                    )}

                                    {/* Badges : état (classification IA prioritaire, fallback déclaratif) + dispo
                                        2026-05-14 : on ne montre PAS les deux pour éviter le doublon
                                        ("bon état" déclaré vs "Bon état" classification IA). La classif IA
                                        est la décision Yukpo qui détermine la valeur — c'est elle qui compte. */}
                                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                        {classifBadge ? (
                                            <Badge className={classifBadge.cls}>{classifBadge.label}</Badge>
                                        ) : (
                                            <Badge className={getEtatColor(livre.etat_livre)}>{livre.etat_livre}</Badge>
                                        )}
                                        <Badge variant={livre.is_available ? 'default' : 'secondary'}>
                                            {livre.is_available
                                                ? t('bourse.mesLivres.available', { defaultValue: 'Disponible' })
                                                : t('bourse.mesLivres.unavailable', { defaultValue: 'Indisponible' })}
                                        </Badge>
                                    </div>

                                    {/* Statut troc + état du crédit alloué */}
                                    <div className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 mb-3 ${statusInfo.creditCls}`}>
                                        <StatusIcon className={`w-4 h-4 shrink-0 mt-0.5 ${statusInfo.cls.split(' ').find(c => c.startsWith('text-')) || ''}`} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-semibold">{statusInfo.label}</p>
                                            <p className="text-[11px] leading-snug opacity-90">{statusInfo.creditLabel}</p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 mt-auto">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => navigate(`/${livre.id}/modifier`)}
                                        >
                                            <Edit className="h-4 w-4 mr-1" />
                                            {t('bourse.mesLivres.modify', { defaultValue: 'Modifier' })}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleToggleAvailability(livre)}
                                            title={livre.is_available
                                                ? t('bourse.mesLivres.hide', { defaultValue: 'Masquer' })
                                                : t('bourse.mesLivres.show', { defaultValue: 'Publier' })}
                                        >
                                            {livre.is_available ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDelete(livre)}
                                            className="text-red-600 hover:text-red-700"
                                            title={t('bourse.mesLivres.delete', { defaultValue: 'Supprimer' })}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MesLivresPage;
