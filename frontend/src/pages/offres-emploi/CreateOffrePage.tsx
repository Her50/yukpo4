// ✅ Formulaire de création d'offre d'emploi (Frontend)
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Briefcase } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiPost } from '../../services/apiService';

const CreateOffrePage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        titre_poste: '',
        description: '',
        type_contrat: 'CDI',
        duree_contrat: '',
        lieu_travail: '',
        adresse: '',
        gps: '',
        remote: false,
        remote_partiel: false,
        salaire_min: '',
        salaire_max: '',
        salaire_negociable: false,
        niveau_etude: '',
        experience_min: '',
        competences_requises: [] as string[],
        secteur: '',
        domaine: '',
        tags: [] as string[],
        date_limite_candidature: '',
        date_debut_poste: '',
    });

    const [competenceInput, setCompetenceInput] = useState('');
    const [tagInput, setTagInput] = useState('');

    const typesContrat = ['CDI', 'CDD', 'Stage', 'Freelance', 'Temps partiel', 'Alternance'];
    const secteurs = [
        'Informatique', 'Commerce', 'Santé', 'Éducation', 'Finance',
        'Marketing', 'Ressources Humaines', 'Ingénierie', 'Design', 'Autre'
    ];

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
        if (competenceInput.trim() && !formData.competences_requises.includes(competenceInput.trim())) {
            setFormData({
                ...formData,
                competences_requises: [...formData.competences_requises, competenceInput.trim()],
            });
            setCompetenceInput('');
        }
    };

    const handleRemoveCompetence = (comp: string) => {
        setFormData({
            ...formData,
            competences_requises: formData.competences_requises.filter(c => c !== comp),
        });
    };

    const handleAddTag = () => {
        if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
            setFormData({
                ...formData,
                tags: [...formData.tags, tagInput.trim()],
            });
            setTagInput('');
        }
    };

    const handleRemoveTag = (tag: string) => {
        setFormData({
            ...formData,
            tags: formData.tags.filter(t => t !== tag),
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

        if (!formData.titre_poste || !formData.description || !formData.secteur || !formData.lieu_travail) {
            alert('Veuillez remplir tous les champs obligatoires');
            return;
        }

        try {
            setLoading(true);
            const payload: any = {
                titre_poste: formData.titre_poste,
                description: formData.description,
                type_contrat: formData.type_contrat,
                lieu_travail: formData.lieu_travail,
                secteur: formData.secteur,
                remote: formData.remote,
                remote_partiel: formData.remote_partiel,
                salaire_negociable: formData.salaire_negociable,
            };

            if (formData.duree_contrat) payload.duree_contrat = parseInt(formData.duree_contrat);
            if (formData.adresse) payload.adresse = formData.adresse;
            if (formData.gps) payload.gps = formData.gps;
            if (formData.salaire_min) payload.salaire_min = parseFloat(formData.salaire_min);
            if (formData.salaire_max) payload.salaire_max = parseFloat(formData.salaire_max);
            if (formData.niveau_etude) payload.niveau_etude = formData.niveau_etude;
            if (formData.experience_min) payload.experience_min = parseInt(formData.experience_min);
            if (formData.competences_requises.length > 0) payload.competences_requises = formData.competences_requises;
            if (formData.domaine) payload.domaine = formData.domaine;
            if (formData.tags.length > 0) payload.tags = formData.tags;
            if (formData.date_limite_candidature) payload.date_limite_candidature = formData.date_limite_candidature;
            if (formData.date_debut_poste) payload.date_debut_poste = formData.date_debut_poste;

            const response = await apiPost('/api/offres-emploi', payload);
            const data = await response.json();

            if (data.success) {
                alert('Offre créée avec succès !');
                navigate('/offres-emploi/mes-offres');
            } else {
                alert(data.message || 'Erreur lors de la création de l\'offre');
            }
        } catch (error) {
            console.error('[CreateOffrePage] Erreur:', error);
            alert('Erreur lors de la création de l\'offre');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Briefcase className="w-8 h-8" />
                    Publier une offre d'emploi
                </h1>

                <Card>
                    <CardHeader>
                        <CardTitle>Informations de l'offre</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Titre du poste */}
                            <div>
                                <Label htmlFor="titre_poste">Titre du poste *</Label>
                                <Input
                                    id="titre_poste"
                                    value={formData.titre_poste}
                                    onChange={(e) => setFormData({ ...formData, titre_poste: e.target.value })}
                                    required
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <Label htmlFor="description">Description *</Label>
                                <textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    rows={6}
                                    required
                                />
                            </div>

                            {/* Secteur */}
                            <div>
                                <Label htmlFor="secteur">Secteur d'activité *</Label>
                                <select
                                    id="secteur"
                                    value={formData.secteur}
                                    onChange={(e) => setFormData({ ...formData, secteur: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                >
                                    <option value="">Sélectionner un secteur</option>
                                    {secteurs.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Type de contrat */}
                            <div>
                                <Label htmlFor="type_contrat">Type de contrat *</Label>
                                <select
                                    id="type_contrat"
                                    value={formData.type_contrat}
                                    onChange={(e) => setFormData({ ...formData, type_contrat: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {typesContrat.map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Durée contrat (si CDD) */}
                            {formData.type_contrat === 'CDD' && (
                                <div>
                                    <Label htmlFor="duree_contrat">Durée (en mois)</Label>
                                    <Input
                                        id="duree_contrat"
                                        type="number"
                                        value={formData.duree_contrat}
                                        onChange={(e) => setFormData({ ...formData, duree_contrat: e.target.value })}
                                    />
                                </div>
                            )}

                            {/* Localisation */}
                            <div>
                                <Label htmlFor="lieu_travail">Lieu de travail *</Label>
                                <Input
                                    id="lieu_travail"
                                    value={formData.lieu_travail}
                                    onChange={(e) => setFormData({ ...formData, lieu_travail: e.target.value })}
                                    placeholder="Ex: Douala, Yaoundé"
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="adresse">Adresse complète</Label>
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

                            {/* Remote */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="remote"
                                    checked={formData.remote}
                                    onChange={(e) => setFormData({ ...formData, remote: e.target.checked })}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <Label htmlFor="remote" className="cursor-pointer">
                                    Télétravail possible
                                </Label>
                            </div>

                            {formData.remote && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="remote_partiel"
                                        checked={formData.remote_partiel}
                                        onChange={(e) => setFormData({ ...formData, remote_partiel: e.target.checked })}
                                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                    />
                                    <Label htmlFor="remote_partiel" className="cursor-pointer">
                                        Télétravail partiel
                                    </Label>
                                </div>
                            )}

                            {/* Salaire */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="salaire_min">Salaire minimum (XAF)</Label>
                                    <Input
                                        id="salaire_min"
                                        type="number"
                                        value={formData.salaire_min}
                                        onChange={(e) => setFormData({ ...formData, salaire_min: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="salaire_max">Salaire maximum (XAF)</Label>
                                    <Input
                                        id="salaire_max"
                                        type="number"
                                        value={formData.salaire_max}
                                        onChange={(e) => setFormData({ ...formData, salaire_max: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="salaire_negociable"
                                    checked={formData.salaire_negociable}
                                    onChange={(e) => setFormData({ ...formData, salaire_negociable: e.target.checked })}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <Label htmlFor="salaire_negociable" className="cursor-pointer">
                                    Salaire négociable
                                </Label>
                            </div>

                            {/* Niveau d'étude */}
                            <div>
                                <Label htmlFor="niveau_etude">Niveau d'étude requis</Label>
                                <Input
                                    id="niveau_etude"
                                    value={formData.niveau_etude}
                                    onChange={(e) => setFormData({ ...formData, niveau_etude: e.target.value })}
                                    placeholder="Ex: Bac+3, Master, etc."
                                />
                            </div>

                            {/* Expérience */}
                            <div>
                                <Label htmlFor="experience_min">Expérience minimale (années)</Label>
                                <Input
                                    id="experience_min"
                                    type="number"
                                    value={formData.experience_min}
                                    onChange={(e) => setFormData({ ...formData, experience_min: e.target.value })}
                                />
                            </div>

                            {/* Compétences */}
                            <div>
                                <Label>Compétences requises</Label>
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
                                    {formData.competences_requises.map((comp, idx) => (
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

                            {/* Tags */}
                            <div>
                                <Label>Tags</Label>
                                <div className="flex gap-2 mb-2">
                                    <Input
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                                        placeholder="Ajouter un tag"
                                    />
                                    <Button type="button" onClick={handleAddTag}>Ajouter</Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {formData.tags.map((tag, idx) => (
                                        <span
                                            key={idx}
                                            className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
                                        >
                                            {tag}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveTag(tag)}
                                                className="text-gray-600 hover:text-gray-800"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="date_limite_candidature">Date limite de candidature</Label>
                                    <Input
                                        id="date_limite_candidature"
                                        type="date"
                                        value={formData.date_limite_candidature}
                                        onChange={(e) => setFormData({ ...formData, date_limite_candidature: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="date_debut_poste">Date de début</Label>
                                    <Input
                                        id="date_debut_poste"
                                        type="date"
                                        value={formData.date_debut_poste}
                                        onChange={(e) => setFormData({ ...formData, date_debut_poste: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Boutons */}
                            <div className="flex gap-4">
                                <Button
                                    type="submit"
                                    className="flex-1"
                                    disabled={loading}
                                >
                                    {loading ? 'Création...' : 'Publier l\'offre'}
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

export default CreateOffrePage;

