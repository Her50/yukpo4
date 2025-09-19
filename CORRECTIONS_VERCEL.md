# CORRECTIONS NÉCESSAIRES POUR VERCEL

## Problème identifié
Le frontend utilise des URLs relatives (ex: /auth/login) au lieu de l'API_BASE_URL configuré.
En production sur Vercel, ces URLs pointent vers le domaine Vercel au lieu du backend Render.

## Solutions implémentées

### 1. Configuration Vercel (vercel.json)
Créé un fichier de redirection pour proxy les appels API vers Render.

### 2. Variables d'environnement
- Créé .env.production avec VITE_API_BASE_URL=https://yukpomnang.onrender.com
- Créé .env.example pour documentation

### 3. Corrections de code nécessaires

#### LoginPage.tsx - CORRIGÉ
- Remplacé: fetch('/auth/login', {
- Par: fetch(${API_BASE_URL}/auth/login, {

#### RegisterPage.tsx - CORRIGÉ  
- Remplacé: fetch("/auth/register", {
- Par: fetch(${API_BASE_URL}/auth/register, {

#### Fichiers à corriger manuellement:
1. HomePage.tsx - ligne ~91: fetch('/api/search/direct' -> fetch(${API_BASE_URL}/api/search/direct
2. RechercheBesoin.tsx - ligne ~71: fetch('/api/search/direct' -> fetch(${API_BASE_URL}/api/search/direct
3. ChatbotAI.tsx - ligne ~11: fetch("/api/ask" -> fetch(${API_BASE_URL}/api/ask
4. ContactEnterprisePage.tsx - ligne ~19: fetch('/api/contact/entreprise' -> fetch(${API_BASE_URL}/api/contact/entreprise
5. FormulaireYukpoIntelligent.tsx - ligne ~227: fetch('/api/users/balance' -> fetch(${API_BASE_URL}/api/users/balance

## Instructions pour Vercel
1. Déployer avec les fichiers vercel.json et .env.production
2. Configurer VITE_API_BASE_URL dans les variables d'environnement Vercel
3. Vérifier que les redirections fonctionnent

## Test
Après déploiement, vérifier dans la console du navigateur que les appels API pointent vers yukpomnang.onrender.com
