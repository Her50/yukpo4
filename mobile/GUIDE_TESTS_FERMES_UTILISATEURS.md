# 👥 Guide : Tests fermés - Comment les utilisateurs accèdent

## 🎯 Comment fonctionnent les tests fermés

### 📱 Pour les utilisateurs (testeurs)

1. **Vous leur envoyez un lien** (généré par Google Play)
2. **Ils cliquent sur le lien** (sur leur téléphone Android ou ordinateur)
3. **Ils s'inscrivent** pour devenir testeur
4. **Ils téléchargent l'app** depuis Google Play Store (comme une app normale)
5. **Ils reçoivent les mises à jour** automatiquement

---

## 🔗 Étape 1 : Obtenir le lien de test

### Après avoir publié une version en tests fermés :

1. **Allez dans "Tests" → "Tests fermés"**
   - **🔗 Lien direct :** https://play.google.com/console/u/0/developers/apps/[APP_ID]/testing/closed

2. **Trouvez la section "Testeurs"** ou **"Testers"**

3. **Vous verrez un lien de test** qui ressemble à :
   ```
   https://play.google.com/apps/internaltest/[CODE_UNIQUE]
   ```

4. **Copiez ce lien** - c'est celui que vous partagerez

---

## 👥 Étape 2 : Ajouter des testeurs

Vous avez **2 méthodes** pour ajouter des testeurs :

### Méthode A : Liste d'emails (Limite : 100 testeurs)

1. **Dans "Tests fermés" → "Testeurs"**
2. Cliquez sur **"Ajouter des testeurs"** ou **"Add testers"**
3. Sélectionnez **"Liste d'emails"** ou **"Email list"**
4. **Entrez les emails** (un par ligne ou séparés par des virgules)
5. Cliquez sur **"Ajouter"** ou **"Add"**

**Limite :** Maximum **100 emails** par liste

**Avantage :** Contrôle précis de qui peut tester

---

### Méthode B : Groupe Google (Illimité) ⭐ RECOMMANDÉ

1. **Créez un groupe Google** (si vous n'en avez pas) :
   - **🔗 Lien :** https://groups.google.com/create
   - Nommez-le : `yukpomnang-testers` (ou similaire)
   - Type : **Public** ou **Restreint** (selon vos besoins)
   - Email du groupe : `yukpomnang-testers@googlegroups.com`

2. **Dans Google Play Console** :
   - Allez dans "Tests fermés" → "Testeurs"
   - Cliquez sur **"Ajouter des testeurs"**
   - Sélectionnez **"Groupe Google"** ou **"Google Group"**
   - Entrez l'email du groupe : `yukpomnang-testers@googlegroups.com`
   - Cliquez sur **"Ajouter"**

3. **Les utilisateurs rejoignent le groupe** :
   - Envoyez-leur le lien du groupe Google
   - Ou invitez-les directement par email
   - Une fois dans le groupe, ils peuvent accéder au test

**Avantage :** **ILLIMITÉ** - Aucune limite de testeurs !

---

## 📤 Étape 3 : Partager le lien de test

### Option 1 : Lien direct (Recommandé)

**Envoyez le lien généré par Google Play :**
```
https://play.google.com/apps/internaltest/[CODE_UNIQUE]
```

**Comment partager :**
- Email
- Message WhatsApp/Telegram
- Site web
- Réseaux sociaux
- QR Code (générez un QR code avec le lien)

**Ce qui se passe :**
1. L'utilisateur clique sur le lien (sur son téléphone Android)
2. Il est redirigé vers Google Play Store
3. Il voit un message "Devenir testeur" ou "Become a tester"
4. Il clique sur "Devenir testeur"
5. Il peut maintenant télécharger l'app

---

### Option 2 : QR Code (Pratique pour événements)

1. **Générez un QR Code** avec le lien de test
   - Utilisez : https://www.qr-code-generator.com/
   - Ou : https://qr.io/
2. **Affichez le QR Code** :
   - Sur un écran
   - Sur une affiche
   - Sur votre site web
3. **Les utilisateurs scannent** avec leur téléphone
4. **Ils sont redirigés** vers Google Play Store

---

## 📊 Limites et restrictions

### Tests fermés

| Méthode | Limite de testeurs | Avantages |
|---------|-------------------|------------|
| **Liste d'emails** | 100 testeurs max | Contrôle précis |
| **Groupe Google** | **ILLIMITÉ** ⭐ | Aucune limite |
| **Lien public** | **ILLIMITÉ** ⭐ | Facile à partager |

**💡 Recommandation :** Utilisez un **Groupe Google** pour avoir un nombre illimité de testeurs tout en gardant un contrôle.

---

## 🎯 Processus complet pour vos utilisateurs

### Ce que VOUS faites :

1. ✅ Publiez une version en tests fermés
2. ✅ Créez un groupe Google (ou utilisez liste d'emails)
3. ✅ Ajoutez le groupe dans Google Play Console
4. ✅ Copiez le lien de test
5. ✅ Partagez le lien avec vos utilisateurs

### Ce que VOS UTILISATEURS font :

1. 📱 Reçoivent le lien (email, message, etc.)
2. 🔗 Cliquent sur le lien (sur leur téléphone Android)
3. ✅ S'inscrivent comme testeur (bouton "Devenir testeur")
4. 📥 Téléchargent l'app depuis Google Play Store
5. 🎮 Utilisent l'app normalement
6. 💾 Les données sont sauvegardées en production ✅
7. 🔄 Reçoivent les mises à jour automatiquement

---

## 📝 Exemple de message à envoyer

```
Bonjour,

Nous lançons la version de test de Yukpomnang !

Pour devenir testeur et télécharger l'app :

1. Cliquez sur ce lien : [LIEN_DE_TEST]
2. Cliquez sur "Devenir testeur"
3. Téléchargez l'app depuis Google Play Store

Note : Les données sont sauvegardées en production, 
vous pouvez utiliser l'app normalement.

Merci pour votre participation !
```

---

## 🔄 Mises à jour automatiques

**Avantage important :**

- Les testeurs reçoivent les **mises à jour automatiquement**
- Comme une app normale sur Google Play
- Pas besoin de réinstaller
- Vous publiez une nouvelle version → Ils la reçoivent automatiquement

---

## 🎯 Recommandation pour votre cas

Vu que vous voulez des **tests publics avec données de production** :

### Solution optimale :

1. **Créez un Groupe Google** (illimité de testeurs)
   - Nom : `yukpomnang-testers`
   - Type : **Public** (n'importe qui peut rejoindre)

2. **Ajoutez le groupe dans Google Play Console**

3. **Partagez le lien de test** :
   - Sur votre site web
   - Sur les réseaux sociaux
   - Par email
   - Via QR Code

4. **Les utilisateurs** :
   - Rejoignent le groupe Google (optionnel si groupe public)
   - Cliquent sur le lien de test
   - S'inscrivent comme testeur
   - Téléchargent l'app
   - **Les données sont sauvegardées en production** ✅

---

## 🔗 Liens utiles

- **Tests fermés** : https://play.google.com/console/u/0/developers/apps/[APP_ID]/testing/closed
- **Créer un groupe Google** : https://groups.google.com/create
- **Générateur QR Code** : https://www.qr-code-generator.com/

---

## ✅ Checklist

- [ ] Version publiée en tests fermés
- [ ] Groupe Google créé (ou liste d'emails)
- [ ] Groupe ajouté dans Google Play Console
- [ ] Lien de test copié
- [ ] Lien partagé avec les utilisateurs
- [ ] Message d'instructions envoyé

---

## 💡 Astuce

**Pour un accès vraiment public** (comme les tests ouverts) :

Une fois que vous avez l'accès en production, vous pourrez utiliser **"Tests ouverts"** :
- N'importe qui peut s'inscrire
- Pas besoin de groupe Google
- Lien public partagé partout
- Illimité de testeurs

Mais en attendant, les **tests fermés avec groupe Google public** fonctionnent très bien !



