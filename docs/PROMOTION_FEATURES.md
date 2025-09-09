# 🎉 Fonctionnalités de Promotion - Guide Utilisateur

## Vue d'ensemble

Les fonctionnalités de promotion permettent aux prestataires de services d'ajouter des offres attractives à leurs services, augmentant ainsi leurs chances d'être contactés par des clients potentiels.

## ✨ Nouvelles fonctionnalités

### 1. **Gestion des promotions dans le formulaire de service**
- **Activation/désactivation** : Case à cocher pour activer une promotion
- **Types de promotion** : Réduction, Offre spéciale, Bon plan, Offre flash
- **Valeur** : Pourcentage, montant fixe, ou description (ex: "20%", "50€", "Gratuit")
- **Description** : Détails de l'offre promotionnelle
- **Date de fin** : Limitation temporelle de la promotion
- **Conditions** : Conditions spéciales ou limitations

### 2. **Bouton de promotion rapide dans "Mes Services"**
- **Accès direct** : Bouton 🎉 sur chaque carte de service
- **Statut visuel** : Indicateur orange si promotion active
- **Actions rapides** :
  - Créer une nouvelle promotion
  - Modifier une promotion existante
  - Désactiver une promotion active

### 3. **Affichage des promotions dans les résultats de recherche**
- **Badge promotion** : Affiché sur les cartes de service
- **Indicateur visuel** : Position dynamique selon la présence du logo
- **Informations détaillées** : Type, valeur et description de la promotion

## 🚀 Installation et configuration

### 1. **Migration de la base de données**
```bash
# Exécuter le script PowerShell
.\scripts\apply_promotion_migration.ps1

# Ou manuellement avec psql
psql -h localhost -U postgres -d yukpo_db -f backend/migrations/20250830_003_add_promotion_field.sql
```

### 2. **Structure de la base de données**
```sql
-- Nouveau champ ajouté à la table services
ALTER TABLE services ADD COLUMN promotion JSONB;

-- Index pour optimiser les recherches
CREATE INDEX idx_services_promotion ON services USING GIN (promotion);
```

## 📱 Utilisation côté prestataire

### **Création d'un service avec promotion**
1. Aller dans "Mes Services" → "Créer un service"
2. Remplir les informations du service
3. Dans la section "🎉 Promotion et Offres" :
   - Cocher "Activer une promotion pour ce service"
   - Choisir le type de promotion
   - Saisir la valeur (ex: "20%", "50€")
   - Ajouter une description
   - Définir une date de fin (optionnel)
   - Ajouter des conditions (optionnel)
4. Valider la création

### **Gestion rapide des promotions**
1. Dans "Mes Services", cliquer sur le bouton 🎉 du service
2. **Si pas de promotion** : Cliquer sur "🎉 Créer une promotion"
3. **Si promotion active** :
   - Voir le statut actuel
   - Cliquer sur "✏️ Modifier la promotion"
   - Ou "❌ Désactiver la promotion"

## 🔍 Utilisation côté client

### **Recherche de services avec promotions**
- Les promotions apparaissent automatiquement sur les cartes de service
- Badge orange avec l'icône 🎉
- Informations détaillées dans la description du service
- Tri possible par type de promotion (à implémenter)

## 🎨 Interface utilisateur

### **Couleurs et icônes**
- **Promotion active** : Orange/rouge (🎉)
- **Pas de promotion** : Gris neutre
- **Indicateur visuel** : Point orange sur le bouton si promotion active

### **Positionnement dynamique**
- **Avec logo** : `top-20` (80px) pour éviter la superposition
- **Sans logo** : `top-12` (48px) pour un positionnement optimal

## 🔧 Développement technique

### **Types TypeScript**
```typescript
export interface Promotion {
  active: boolean;
  type: 'reduction' | 'offre' | 'bon_plan' | 'flash';
  valeur: string;
  description?: string;
  date_fin?: string;
  conditions?: string;
}

export interface Service {
  // ... autres champs
  promotion?: Promotion;
}
```

### **Fonctions utilitaires**
```typescript
// Vérifier si un champ média existe
const hasValidMediaField = (field: any): boolean => {
  if (!field) return false;
  if (typeof field === 'string') return field.trim() !== '' && field !== 'Non spécifié';
  if (field.valeur !== undefined) {
    const value = field.valeur;
    if (typeof value === 'string') return value.trim() !== '' && value !== 'Non spécifié';
    if (Array.isArray(value)) return value.length > 0;
  }
  return false;
};
```

## 📊 Exemples de promotions

### **Réduction de prix**
```json
{
  "active": true,
  "type": "reduction",
  "valeur": "20%",
  "description": "Réduction de 20% sur tous nos services",
  "date_fin": "2025-12-31",
  "conditions": "Valable pour toute nouvelle commande"
}
```

### **Offre spéciale**
```json
{
  "active": true,
  "type": "offre",
  "valeur": "2 pour 1",
  "description": "Achetez un service, obtenez le deuxième gratuitement",
  "date_fin": "2025-09-30",
  "conditions": "Services de même catégorie"
}
```

### **Bon plan**
```json
{
  "active": true,
  "type": "bon_plan",
  "valeur": "Gratuit",
  "description": "Première consultation gratuite",
  "date_fin": null,
  "conditions": "Nouveaux clients uniquement"
}
```

## 🚨 Limitations et considérations

### **Validation des données**
- La valeur de promotion est obligatoire si activée
- La date de fin doit être dans le futur
- Les champs description et conditions sont optionnels

### **Performance**
- Index GIN sur le champ JSONB pour les recherches
- Affichage conditionnel pour éviter les calculs inutiles
- Cache des données de promotion dans le state local

## 🔮 Évolutions futures

### **Fonctionnalités à implémenter**
- [ ] Tri des résultats par type de promotion
- [ ] Filtres avancés (promotions actives, expirées, etc.)
- [ ] Notifications de fin de promotion
- [ ] Statistiques d'efficacité des promotions
- [ ] Modèles de promotion prédéfinis
- [ ] Système de codes promo

### **Améliorations UX**
- [ ] Calendrier visuel pour la date de fin
- [ ] Prévisualisation de la promotion sur la carte
- [ ] Assistant de création de promotion
- [ ] Templates de promotion populaires

## 📞 Support et assistance

Pour toute question ou problème avec les fonctionnalités de promotion :
1. Vérifier que la migration a été appliquée
2. Contrôler les logs de la console pour les erreurs
3. Vérifier la structure des données dans la base
4. Contacter l'équipe de développement

---

**Version** : 1.0.0  
**Date** : 2025-08-30  
**Auteur** : Équipe Yukpo 