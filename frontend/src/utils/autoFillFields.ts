import React from 'react';
// @ts-check

/**
 * Prédiction simple basée sur mots-clés présents dans la description.
 * Retourne la catégorie probable et des champs à pré-remplir.
 */

const autoFillFields = (description: string) => {
  const lower = description.toLowerCase();
  const result = {
    categorie: '',
    extraFields: {} as Record<string, string>,
  };

  // Livre scolaire
  if (lower.includes('manuel') || lower.includes('classe de') || lower.includes('matière')) {
    result.categorie = 'livre';
    if (lower.match(/classe\s?[^\s.,;]+/)) {
      result.extraFields.classe = lower.match(/classe\s?[^\s.,;]+/)?.[0] || '';
    }
    if (lower.includes('math') || lower.includes('physique') || lower.includes('français')) {
      result.extraFields.matiere = 'Mathématiques / Physique / Français';
    }
  }

  // Immobilier
  if (lower.includes('pièce') || lower.includes('appartement') || lower.includes('m²')) {
    result.categorie = 'immobilier';
    if (lower.match(/\d+\s?m²/)) {
      result.extraFields.surface = lower.match(/\d+\s?m²/)?.[0] || '';
    }
    if (lower.match(/\d+\s?(pièces|chambres)/)) {
      result.extraFields.pieces = lower.match(/\d+\s?(pièces|chambres)/)?.[0] || '';
    }
    if (lower.includes('bastos') || lower.includes('bonamoussadi') || lower.includes('yaoundé')) {
      result.extraFields.lieu = 'Yaoundé / Bonamoussadi / Bastos';
    }
  }

  // Transport
  if (lower.includes('voiture') || lower.includes('taxi') || lower.includes('camion') || lower.includes('moto')) {
    result.categorie = 'transport';
    if (lower.includes('camion')) result.extraFields.type_vehicule = 'Camion';
    if (lower.includes('taxi')) result.extraFields.type_vehicule = 'Taxi';
    if (lower.includes('bus')) result.extraFields.type_vehicule = 'Bus';
  }

  return result;
};

export default autoFillFields;
