// ✅ Formulaire de profil candidat (Frontend)
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/apiService';

const ProfilCandidatPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(true);
    const [formData, setFormData] = useState({
        nom: '',
        prenom: '',
        date_naissance: '',
        telephone: '',
        email: '',
        adresse: '',
        ville: '',
        gps: '',
        niveau_etude: '',
        experience_annees: '',
        competences: [] as string[],
        langues: [] as { langue: string; niveau: string }[],
        permis: [] as string[],
        cv_url: '',
        lettre_motivation_url: '',
        disponibilite: 'immediate',
        salaire_souhaite_min: '',
        salaire_souhaite_max: '',
        secteur_recherche: '',
        type_contrat_souhaite: [] as string[],
        remote_souhaite: false,
    });

    const [competenceInput, setCompetenceInput] = useState('');
    const [langueInput, setLangueInput] = useState({ langue: '', niveau: 'intermediaire' });
    const [permisInput, setPermisInput] = useState('');

    const niveauxEtude = ['Bac', 'Bac+2', 'Bac+3', 'Bac+5', 'Master', 'Doctorat'];
    const niveauxLangue = ['debutant', 'intermediaire', 'avance', 'bilingue'];
    const typesContrat = ['CDI', 'CDD', 'Stage', 'Freelance', 'Temps partiel', 'Alternance'];
    const secteurs = [
        'Informatique', 'Commerce', 'Santé', 'Éducation', 'Finance',
        'Marketing', 'Ressources Humaines', 'Ingénierie', 'Design', 'Autre'
    ];

    useEffect(() => {
        if (user) {
            loadProfil();
        }
    }, [user]);

    const loadProfil = async () => {
        try {
            setLoadingData(true);
            const response = await apiGet('/api/offres-emploi/profil');
            const data = await response.json();
            if (data.success && data.data) {
                const profil = data.data;
                setFormData({
                    nom: profil.nom || '',
                    prenom: profil.prenom || '',
                    date_naissance: profil.date_naissance || '',
                    telephone: profil.telephone || '',
                    email: profil.email || user?.email || '',
                    adresse: profil.adresse || '',
                    ville: profil.ville || '',
                    gps: profil.gps || '',
                    niveau_etude: profil.niveau_etude || '',
                    experience_annees: profil.experience_annees?.toString() || '',
                    competences: profil.competences || [],
                    langues: profil.langues || [],
                    permis: profil.permis || [],
                    cv_url: profil.cv_url || '',
                    lettre_motivation_url: profil.lettre_motivation_url || '',
                    disponibilite: profil.disponibilite || 'immediate',
                    salaire_souhaite_min: profil.salaire_souhaite_min?.toString() || '',
                    salaire_souhaite_max: profil.salaire_souhaite_max?.toString() || '',
                    secteur_recherche: profil.secteur_recherche || '',
                    type_contrat_souhaite: profil.type_contrat_souhaite || [],
                    remote_souhaite: profil.remote_souhaite || false,
                });
            }
        } catch (error) {
            console.error('[ProfilCandidatPage] Erreur chargement:', error);
        } finally {
            setLoadingData(false);
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Connexion requise</h2>
                    <button
                        onClick={() => navigate('/login')}
                        className="text-indigo-600 hover:text-indigo-700"
                    >
                        Se connecter
                    </button>
                </div>
            </div>
        );
    }

    const handleAddCompetence = () => {
        if (competenceInput.trim() && !formData.competences.includes(competenceInput.trim())) {
            setFormData({
                ...formData,
                competences: [...formData.competences, competenceInput.trim()],
            });
            setCompetenceInput('');
        }
    };

    const handleRemoveCompetence = (comp: string) => {
        setFormData({
            ...formData,
            competences: formData.competences.filter(c => c !== comp),
        });
    };

    const handleAddLangue = () => {
        if (langueInput.langue.trim() && !formData.langues.some(l => l.langue === langueInput.langue.trim())) {
            setFormData({
                ...formData,
                langues: [...formData.langues, { langue: langueInput.langue.trim(), niveau: langueInput.niveau }],
            });
            setLangueInput({ langue: '', niveau: 'intermediaire' });
        }
    };

    const handleRemoveLangue = (langue: string) => {
        setFormData({
            ...formData,
            langues: formData.langues.filter(l => l.langue !== langue),
        });
    };

    const handleAddPermis = () => {
        if (permisInput.trim() && !formData.permis.includes(permisInput.trim())) {
            setFormData({
                ...formData,
                permis: [...formData.permis, permisInput.trim()],
            });
            setPermisInput('');
        }
    };

    const handleRemovePermis = (permis: string) => {
        setFormData({
            ...formData,
            permis: formData.permis.filter(p => p !== permis),
        });
    };

    const toggleTypeContrat = (type: string) => {
        setFormData({
            ...formData,
            type_contrat_souhaite: formData.type_contrat_souhaite.includes(type)
                ? formData.type_contrat_souhaite.filter(t => t !== type)
                : [...formData.type_contrat_souhaite, type],
        });
    };

    const handleUseCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    setFormData({ ...formData, gps: `${lat},${lng}` });
                },
                (error) => {
                    alert('Impossible d\'obtenir votre position');
                }
            );
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            setLoading(true);
            const payload: any = {
                nom: formData.nom,
                prenom: formData.prenom,
                email: formData.email || user?.email,
                disponibilite: formData.disponibilite,
                remote_souhaite: formData.remote_souhaite,
            };

            if (formData.date_naissance) payload.date_naissance = formData.date_naissance;
            if (formData.telephone) payload.telephone = formData.telephone;
            if (formData.adresse) payload.adresse = formData.adresse;
            if (formData.ville) payload.ville = formData.ville;
            if (formData.gps) payload.gps = formData.gps;
            if (formData.niveau_etude) payload.niveau_etude = formData.niveau_etude;
            if (formData.experience_annees) payload.experience_annees = parseInt(formData.experience_annees);
            if (formData.competences.length > 0) payload.competences = formData.competences;
            if (formData.langues.length > 0) payload.langues = formData.langues;
            if (formData.permis.length > 0) payload.permis = formData.permis;
            if (formData.cv_url) payload.cv_url = formData.cv_url;
            if (formData.lettre_motivation_url) payload.lettre_motivation_url = formData.lettre_motivation_url;
            if (formData.salaire_souhaite_min) payload.salaire_souhaite_min = parseFloat(formData.salaire_souhaite_min);
            if (formData.salaire_souhaite_max) payload.salaire_souhaite_max = parseFloat(formData.salaire_souhaite_max);
            if (formData.secteur_recherche) payload.secteur_recherche = formData.secteur_recherche;
            if (formData.type_contrat_souhaite.length > 0) payload.type_contrat_souhaite = formData.type_contrat_souhaite;

            const response = await apiPost('/api/offres-emploi/profil', payload);
            const data = await response.json();

            if (data.success) {
                alert('Profil mis à jour avec succès !');
                navigate('/offres-emploi');
            } else {
                alert(data.message || 'Erreur lors de la mise à jour du profil');
            }
        } catch (error) {
            console.error('[ProfilCandidatPage] Erreur:', error);
            alert('Erreur lors de la mise à jour du profil');
        } finally {
            setLoading(false);
        }
    };

    if (loadingData) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Chargement...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <User className="w-8 h-8" />
                    Mon Profil Candidat
                </h1>

                <Card>
                    <CardHeader>
                        <CardTitle>Informations personnelles</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Informations de base */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="nom">Nom *</Label>
                                    <Input
                                        id="nom"
                                        value={formData.nom}
                                        onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="prenom">Prénom *</Label>
                                    <Input
                                        id="prenom"
                                        value={formData.prenom}
                                        onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="email">Email *</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email || user?.email || ''}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="telephone">Téléphone</Label>
                                <Input
                                    id="telephone"
                                    value={formData.telephone}
                                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                                />
                            </div>

                            <div>
                                <Label htmlFor="date_naissance">Date de naissance</Label>
                                <Input
                                    id="date_naissance"
                                    type="date"
                                    value={formData.date_naissance}
                                    onChange={(e) => setFormData({ ...formData, date_naissance: e.target.value })}
                                />
                            </div>

                            {/* Localisation */}
                            <div>
                                <Label htmlFor="ville">Ville</Label>
                                <Input
                                    id="ville"
                                    value={formData.ville}
                                    onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                                />
                            </div>

                            <div>
                                <Label htmlFor="adresse">Adresse</Label>
                                <Input
                                    id="adresse"
                                    value={formData.adresse}
                                    onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                                />
                            </div>

                            <div>
                                <Label htmlFor="gps">Coordonnées GPS</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="gps"
                                        value={formData.gps}
                                        onChange={(e) => setFormData({ ...formData, gps: e.target.value })}
                                        placeholder="lat,lng"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleUseCurrentLocation}
                                    >
                                        Ma position
                                    </Button>
                                </div>
                            </div>

                            {/* Formation */}
                            <div>
                                <Label htmlFor="niveau_etude">Niveau d'étude</Label>
                                <select
                                    id="niveau_etude"
                                    value={formData.niveau_etude}
                                    onChange={(e) => setFormData({ ...formData, niveau_etude: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Sélectionner</option>
                                    {niveauxEtude.map((n) => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <Label htmlFor="experience_annees">Années d'expérience</Label>
                                <Input
                                    id="experience_annees"
                                    type="number"
                                    value={formData.experience_annees}
                                    onChange={(e) => setFormData({ ...formData, experience_annees: e.target.value })}
                                />
                            </div>

                            {/* Compétences */}
                            <div>
                                <Label>Compétences</Label>
                                <div className="flex gap-2 mb-2">
                                    <Input
                                        value={competenceInput}
                                        onChange={(e) => setCompetenceInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCompetence())}
                                        placeholder="Ajouter une compétence"
                                    />
                                    <Button type="button" onClick={handleAddCompetence}>Ajouter</Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {formData.competences.map((comp, idx) => (
                                        <span
                                            key={idx}
                                            className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm"
                                        >
                                            {comp}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveCompetence(comp)}
                                                className="text-indigo-600 hover:text-indigo-800"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Langues */}
                            <div>
                                <Label>Langues</Label>
                                <div className="flex gap-2 mb-2">
                                    <Input
                                        value={langueInput.langue}
                                        onChange={(e) => setLangueInput({ ...langueInput, langue: e.target.value })}
                                        placeholder="Langue"
                                        className="flex-1"
                                    />
                                    <select
                                        value={langueInput.niveau}
                                        onChange={(e) => setLangueInput({ ...langueInput, niveau: e.target.value })}
                                        className="px-3 py-2 border border-gray-300 rounded-md"
                                    >
                                        {niveauxLangue.map((n) => (
                                            <option key={n} value={n}>{n}</option>
                                        ))}
                                    </select>
                                    <Button type="button" onClick={handleAddLangue}>Ajouter</Button>
                                </div>
                                <div className="space-y-2">
                                    {formData.langues.map((langue, idx) => (
                                        <div key={idx} className="flex items-center justify-between px-3 py-2 bg-gray-100 rounded">
                                            <span>{langue.langue} ({langue.niveau})</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveLangue(langue.langue)}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Permis */}
                            <div>
                                <Label>Permis de conduire</Label>
                                <div className="flex gap-2 mb-2">
                                    <Input
                                        value={permisInput}
                                        onChange={(e) => setPermisInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPermis())}
                                        placeholder="Ex: A, B, C"
                                    />
                                    <Button type="button" onClick={handleAddPermis}>Ajouter</Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {formData.permis.map((permis, idx) => (
                                        <span
                                            key={idx}
                                            className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
                                        >
                                            {permis}
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePermis(permis)}
                                                className="text-gray-600 hover:text-gray-800"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Préférences */}
                            <div>
                                <Label htmlFor="secteur_recherche">Secteur recherché</Label>
                                <select
                                    id="secteur_recherche"
                                    value={formData.secteur_recherche}
                                    onChange={(e) => setFormData({ ...formData, secteur_recherche: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Tous les secteurs</option>
                                    {secteurs.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <Label>Type de contrat souhaité</Label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {typesContrat.map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => toggleTypeContrat(type)}
                                            className={`px-4 py-2 rounded-md text-sm font-medium transition ${formData.type_contrat_souhaite.includes(type)
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="salaire_souhaite_min">Salaire souhaité min (XAF)</Label>
                                    <Input
                                        id="salaire_souhaite_min"
                                        type="number"
                                        value={formData.salaire_souhaite_min}
                                        onChange={(e) => setFormData({ ...formData, salaire_souhaite_min: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="salaire_souhaite_max">Salaire souhaité max (XAF)</Label>
                                    <Input
                                        id="salaire_souhaite_max"
                                        type="number"
                                        value={formData.salaire_souhaite_max}
                                        onChange={(e) => setFormData({ ...formData, salaire_souhaite_max: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="disponibilite">Disponibilité</Label>
                                <select
                                    id="disponibilite"
                                    value={formData.disponibilite}
                                    onChange={(e) => setFormData({ ...formData, disponibilite: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="immediate">Immédiate</option>
                                    <option value="1_mois">Dans 1 mois</option>
                                    <option value="3_mois">Dans 3 mois</option>
                                    <option value="6_mois">Dans 6 mois</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="remote_souhaite"
                                    checked={formData.remote_souhaite}
                                    onChange={(e) => setFormData({ ...formData, remote_souhaite: e.target.checked })}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <Label htmlFor="remote_souhaite" className="cursor-pointer">
                                    Ouvert au télétravail
                                </Label>
                            </div>

                            {/* Upload CV et Lettre de motivation */}
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="cv">CV (PDF, DOC, DOCX)</Label>
                                    <div className="mt-2">
                                        <input
                                            id="cv"
                                            type="file"
                                            accept=".pdf,.doc,.docx"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    try {
                                                        setLoading(true);
                                                        const { apiUpload } = await import('../../services/apiService');
                                                        const response = await apiUpload('/api/upload', file, 'file', { type: 'cv' });
                                                        if (response.success && response.data?.url) {
                                                            setFormData({ ...formData, cv_url: response.data.url });
                                                            alert('CV téléchargé avec succès !');
                                                        }
                                                    } catch (error) {
                                                        console.error('Erreur upload CV:', error);
                                                        alert('Erreur lors du téléchargement du CV');
                                                    } finally {
                                                        setLoading(false);
                                                    }
                                                }
                                            }}
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                        />
                                        {formData.cv_url && (
                                            <a
                                                href={formData.cv_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-2 text-sm text-indigo-600 hover:text-indigo-700"
                                            >
                                                Voir le CV actuel →
                                            </a>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="lettre_motivation">Lettre de motivation (PDF, DOC, DOCX)</Label>
                                    <div className="mt-2">
                                        <input
                                            id="lettre_motivation"
                                            type="file"
                                            accept=".pdf,.doc,.docx"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    try {
                                                        setLoading(true);
                                                        const { apiUpload } = await import('../../services/apiService');
                                                        const response = await apiUpload('/api/upload', file, 'file', { type: 'lettre_motivation' });
                                                        if (response.success && response.data?.url) {
                                                            setFormData({ ...formData, lettre_motivation_url: response.data.url });
                                                            alert('Lettre de motivation téléchargée avec succès !');
                                                        }
                                                    } catch (error) {
                                                        console.error('Erreur upload lettre:', error);
                                                        alert('Erreur lors du téléchargement de la lettre de motivation');
                                                    } finally {
                                                        setLoading(false);
                                                    }
                                                }
                                            }}
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                        />
                                        {formData.lettre_motivation_url && (
                                            <a
                                                href={formData.lettre_motivation_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-2 text-sm text-indigo-600 hover:text-indigo-700"
                                            >
                                                Voir la lettre actuelle →
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Boutons */}
                            <div className="flex gap-4">
                                <Button
                                    type="submit"
                                    className="flex-1"
                                    disabled={loading}
                                >
                                    {loading ? 'Enregistrement...' : 'Enregistrer le profil'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => navigate('/offres-emploi')}
                                >
                                    Annuler
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ProfilCandidatPage;

