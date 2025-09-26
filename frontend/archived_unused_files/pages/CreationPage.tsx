import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import RequireAccess from '@/components/auth/RequireAccess';
import { useSemanticRedirect } from '@/hooks/useSemanticRedirect';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import autoFillFields from '@/utils/autoFillFields';

function CreationPage() {
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [prix, setPrix] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [categorie, setCategorie] = useState('');
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});

  const suggestions = useSemanticRedirect(description);
  const plan = 'free';
  const ia_response = '✨ Description générée automatiquement par Yukpomnang.';

  useEffect(() => {
    const filled = autoFillFields(description);
    if (filled.categorie) setCategorie(filled.categorie);
    setExtraFields((prev) => ({ ...prev, ...filled.extraFields }));
  }, [description]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      titre,
      description,
      prix,
      image_path: file?.name,
      categorie,
      ...extraFields,
    };
    console.log('🔧 Payload à envoyer:', payload);
    // TODO: POST vers /services
  };

  return (
    <ResponsiveContainer>
      <div className="pb-24">
        <h1 className="text-3xl font-bold mb-8">⚙️ Créer un nouveau service</h1>

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-xl space-y-6 border">
          <div>
            <label className="font-medium text-sm mb-1 block" htmlFor="titre">Titre du service</label>
            <Input
              id="titre"
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="font-medium text-sm mb-1 block" htmlFor="description">Description</label>
            <Textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez votre service ici..."
            />
          </div>

          <div>
            <label className="font-medium text-sm mb-1 block" htmlFor="categorie">Catégorie</label>
            <select
              id="categorie"
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className="w-full p-3 border rounded"
            >
              <option value="">-- Choisir une catégorie --</option>
              <option value="livre">📚 Livre scolaire</option>
              <option value="immobilier">🏠 Bien immobilier</option>
              <option value="transport">🚌 Transport</option>
              <option value="autre">🛠️ Autre service</option>
            </select>
          </div>

          {/* Champs conditionnels */}
          {categorie === 'livre' && (
            <>
              <label className="block text-sm font-medium mt-4" htmlFor="classe">Classe</label>
              <Input
                id="classe"
                type="text"
                value={extraFields.classe || ''}
                onChange={(e) => setExtraFields({ ...extraFields, classe: e.target.value })}
                placeholder="Ex: Terminale C"
              />
              <label className="block text-sm font-medium mt-2" htmlFor="matiere">Matière</label>
              <Input
                id="matiere"
                type="text"
                value={extraFields.matiere || ''}
                onChange={(e) => setExtraFields({ ...extraFields, matiere: e.target.value })}
                placeholder="Ex: Mathématiques"
              />
            </>
          )}

          {categorie === 'immobilier' && (
            <>
              <label className="block text-sm font-medium mt-4" htmlFor="surface">Surface (m²)</label>
              <Input
                id="surface"
                type="text"
                value={extraFields.surface || ''}
                onChange={(e) => setExtraFields({ ...extraFields, surface: e.target.value })}
                placeholder="Ex: 120"
              />
              <label className="block text-sm font-medium mt-2" htmlFor="pieces">Nombre de pièces</label>
              <Input
                id="pieces"
                type="text"
                value={extraFields.pieces || ''}
                onChange={(e) => setExtraFields({ ...extraFields, pieces: e.target.value })}
                placeholder="Ex: 4 pièces"
              />
              <label className="block text-sm font-medium mt-2" htmlFor="lieu">Lieu</label>
              <Input
                id="lieu"
                type="text"
                value={extraFields.lieu || ''}
                onChange={(e) => setExtraFields({ ...extraFields, lieu: e.target.value })}
                placeholder="Ex: Bastos, Yaoundé"
              />
            </>
          )}

          {categorie === 'transport' && (
            <>
              <label className="block text-sm font-medium mt-4" htmlFor="vehicule">Type de véhicule</label>
              <Input
                id="vehicule"
                type="text"
                value={extraFields.type_vehicule || ''}
                onChange={(e) => setExtraFields({ ...extraFields, type_vehicule: e.target.value })}
                placeholder="Ex: Taxi, Bus"
              />
              <label className="block text-sm font-medium mt-2" htmlFor="places">Nombre de places</label>
              <Input
                id="places"
                type="text"
                value={extraFields.places || ''}
                onChange={(e) => setExtraFields({ ...extraFields, places: e.target.value })}
                placeholder="Ex: 7"
              />
              <label className="block text-sm font-medium mt-2" htmlFor="trajet">Trajet</label>
              <Input
                id="trajet"
                type="text"
                value={extraFields.trajet || ''}
                onChange={(e) => setExtraFields({ ...extraFields, trajet: e.target.value })}
                placeholder="Ex: Bonabéri - Akwa"
              />
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="font-medium text-sm mb-1 block" htmlFor="prix">Prix (optionnel)</label>
              <Input
                id="prix"
                type="number"
                min="0"
                step="0.01"
                value={prix}
                onChange={(e) => setPrix(e.target.value)}
                placeholder="Ex: 45000"
              />
            </div>
            <div>
              <label className="font-medium text-sm mb-1 block" htmlFor="image">Image</label>
              <Input
                id="image"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <Button type="submit" className="w-full mt-6">
            🛠️ Enregistrer le service
          </Button>
        </form>

        {/* Réponse IA */}
        <Card className="mt-12 border-orange-100 animate-fade-in">
          <CardContent className="py-6">
            <h2 className="text-xl font-bold mb-2">🧠 Réponse Yukpomnang</h2>
            <p className="text-gray-700">{ia_response}</p>

            {plan === 'free' && (
              <div className="mt-4 text-sm text-red-600">
                <RequireAccess plan="enterprise">
                  <p className="font-semibold">
                    ⚠️ Fonctions Premium désactivées : passez au plan Entreprise pour tout débloquer.
                  </p>
                </RequireAccess>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveContainer>
  );
}

export default CreationPage;
