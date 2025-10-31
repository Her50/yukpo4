# ⚠️ Audit des Formulaires avec Modalités Fixes

## 🔍 Problème Identifié

De nombreux formulaires utilisent encore **des listes fixes** avec `.map()` au lieu du système intelligent **ProductFieldSelector**.

---

## 📋 Liste des Formulaires à Corriger

### **1. decoration** ❌
- **Champ** : Matériau / Matière
- **Liste fixe** : ['Toile', 'Bois', 'Métal', 'Verre', 'Céramique', 'Tissu', 'Plastique', 'Rotin']
- **Action** : Remplacer par ProductFieldSelector

### **2. aliments** ❌
- **Champ 1** : Catégorie d'aliment
- **Liste fixe** : ['Fruits', 'Légumes', 'Viande', 'Poisson', 'Céréales', 'Produits laitiers', 'Épicerie']
- **Champ 2** : Conservation
- **Liste fixe** : ['Frais', 'Surgelé', 'Sec']
- **Champ 3** : Certification
- **Liste fixe** : ['Bio', 'Halal', 'Kasher', 'Standard', 'AOC']
- **Action** : Remplacer tous par ProductFieldSelector

### **3. quincaillerie** ❌
- **Champ 1** : Catégorie
- **Liste fixe** : ['Outils', 'Matériaux', 'Peinture', 'Plomberie', 'Sanitaire', 'Électricité']
- **Champ 2** : Unité
- **Liste fixe** : ['Pièce', 'Sac', 'Seau', 'Litre', 'm', 'm²', 'Lot']
- **Action** : Remplacer par ProductFieldSelector

### **4. livres_fournitures** ❌
- **Champ 1** : Type d'article
- **Liste fixe** : ['Livre scolaire', 'Livre', 'Roman', 'Cahier', 'Stylos', 'Cartable', 'Calculatrice', 'Fournitures']
- **Champ 2** : Niveau scolaire
- **Liste fixe** : ['Maternelle', 'Primaire', 'Secondaire', 'Université', 'Tous']
- **Champ 3** : État
- **Liste fixe** : ['Neuf', 'Bon état', 'Occasion']
- **Action** : Remplacer par ProductFieldSelector

### **5. pharmacie** ⚠️
- **Champ** : Jours de garde (spécial - multi-select)
- **Liste fixe** : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
- **Action** : Garder tel quel (UI spéciale pour les jours)

### **6. hopital_clinique** ❌
- **Champ 1** : Type d'établissement
- **Liste fixe** : ['Hôpital', 'Clinique', 'Centre de santé', 'Dispensaire']
- **Champ 2** : Jours disponibles (planning)
- **Liste fixe** : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
- **Champ 3** : Moment de disponibilité
- **Liste fixe** : ['Journée', 'Nuit', '24h/24']
- **Action** : Remplacer champ 1 par ProductFieldSelector, garder planning spécial

### **7. demenagement** ❌
- **Champ 1** : Type de déménagement
- **Liste fixe** : ['Local', 'National', 'International']
- **Champ 2** : Type de véhicule
- **Liste fixe** : ['Camionnette 10m³', 'Camion 20m³', 'Camion 30m³', 'Camion 40m³+']
- **Champ 3** : Nombre de déménageurs
- **Liste fixe** : ['1', '2', '3', '4', '5+']
- **Action** : Remplacer tous par ProductFieldSelector

### **8. cosmetique_parfum** ❌
- **Champ 1** : Type de produit
- **Liste fixe** : ['Parfum', 'Maquillage', 'Soin visage', 'Soin corps', 'Cheveux', 'Hygiène']
- **Champ 2** : Unité de volume
- **Liste fixe** : ['ml', 'g', 'unité']
- **Champ 3** : Type de peau
- **Liste fixe** : ['Toutes peaux', 'Peau sèche', 'Peau grasse', 'Peau mixte', 'Peau sensible', 'Femme', 'Homme', 'Enfant']
- **Champ 4** : Âge recommandé
- **Liste fixe** : ['Tous âges', '16+', '18+', '25+', '35+', '50+']
- **Action** : Remplacer tous par ProductFieldSelector

### **9. bijoux** ❌
- **Champ 1** : Type de bijou
- **Liste fixe** : ['Collier', 'Bague', 'Bracelet', 'Boucles d\'oreilles', 'Montre', 'Pierres précieuses']
- **Champ 2** : Matière principale
- **Liste fixe** : ['Or jaune', 'Or blanc', 'Or rose', 'Argent', 'Platine', 'Acier', 'Cuir', 'Autre']
- **Champ 3** : Unité de poids
- **Liste fixe** : ['g', 'carat', 'oz']
- **Action** : Remplacer tous par ProductFieldSelector

---

## 📊 Statistiques

- **Total formulaires analysés** : ~41
- **Formulaires avec listes fixes** : ~9
- **Formulaires déjà avec ProductFieldSelector** : ~32
- **Taux d'utilisation ProductFieldSelector** : ~78%

---

## ✅ Plan d'Action

1. ⏳ Corriger **decoration** (1 champ)
2. ⏳ Corriger **aliments** (3 champs)
3. ⏳ Corriger **quincaillerie** (2 champs)
4. ⏳ Corriger **livres_fournitures** (3 champs)
5. ⏳ Corriger **hopital_clinique** (1 champ principal)
6. ⏳ Corriger **demenagement** (3 champs)
7. ⏳ Corriger **cosmetique_parfum** (4 champs)
8. ⏳ Corriger **bijoux** (3 champs)

**Total** : ~20 champs à migrer vers ProductFieldSelector













