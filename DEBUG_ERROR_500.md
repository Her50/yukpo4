# 🐛 Debug Erreur 500 - Création de Service

## Erreur reçue
```json
{
  "timestamp": "2025-10-29T13:17:06.706Z",
  "status": "ERROR",
  "phase": "Service Creation",
  "errorMessage": "Erreur création service: Erreur 500",
  "userInfo": {
    "userId": "17",
    "hasToken": true
  }
}
```

## Points de vérification possibles

### 1. Problèmes de structure des données

L'erreur 500 côté backend peut être causée par:

#### a) **Validation du schéma JSON échoue** (`backend/src/services/creer_service.rs:178-192`)
- Les champs obligatoires sont-ils présents? (`titre_service`, `description`, `category`)
- Les types de données sont-ils corrects?
- Y a-t-il des champs `_type` ou `_options` qui ne devraient pas être là?

#### b) **Erreur SQL lors de l'insertion** (`backend/src/services/creer_service.rs:318-320`)
- Le champ `gps` est-il au bon format?
- Le JSON `data_obj` est-il valide pour PostgreSQL?
- Les contraintes de base de données sont-elles respectées?

#### c) **Problème de normalisation** 
- Les produits sont-ils bien structurés?
- Y a-t-il des valeurs `undefined` ou `null` qui causent des problèmes?

### 2. Comment débugger

#### Étape 1: Vérifier les logs du backend Rust
Sur le serveur où tourne le backend, regarder les logs:
```bash
# Sur le serveur backend
journalctl -u yukpomnang-backend -f --since "5 minutes ago"
# ou
tail -f /var/log/yukpomnang/backend.log
```

Chercher les lignes:
- `[DEBUG][HANDLE_CREER_SERVICE]`
- `[creer_service]`
- `Erreur SQL lors de l'insertion`
- `Échec insertion service`

#### Étape 2: Vérifier la structure du payload mobile
Côté mobile, le payload devrait ressembler à:
```javascript
{
  "user_id": 17,  // number, pas string
  "data": {
    "titre_service": "...",
    "description": "...",
    "category": "...",
    "gps_fixe": "lat,lng",  // optionnel mais recommandé
    "produits": {
      "type_donnee": "listeproduit",
      "valeur": [ /* array de produits */ ],
      "origine_champs": "formulaire"
    },
    // ... autres champs
  }
}
```

#### Étape 3: Tests de validation

**Test 1: Service minimal sans produits**
Essayez de créer un service avec seulement les champs obligatoires:
- `titre_service`
- `description`
- `category`
- `whatsapp` ou `telephone`

**Test 2: Service avec 1 produit simple**
Ajouter un seul produit simple:
```javascript
{
  "nom": "Produit test",
  "prix": "1000",
  "devise": "XAF"
}
```

**Test 3: Vérifier la taille du payload**
Si le payload est > 100MB, cela peut causer des erreurs.

### 3. Corrections possibles

#### Si c'est un problème de GPS:
```javascript
// Assurez-vous que le GPS est au format "latitude,longitude"
finalServiceData.gps_fixe = {
  type_donnee: 'string',
  valeur: `${latitude},${longitude}`,  // Correct: "lat,lng"
  origine_champs: 'formulaire'
};
```

#### Si c'est un problème de produits avec valeurs undefined:
C'est déjà corrigé dans le code (lignes 1328-1336), mais vérifiez que tous les produits ont:
- `nom` (string, non vide)
- `prix` (string ou number)
- `devise` (string)

#### Si c'est un problème d'user_id:
Vérifiez que `user.id` est converti en number:
```javascript
const userId = parseInt(user?.id || '0', 10);
```

### 4. Solution temporaire de contournement

Si l'erreur persiste, essayez de créer un service via le frontend web au lieu de mobile pour voir si le problème est spécifique au mobile.

### 5. Demander les logs backend

Pour identifier la cause exacte, il faut les logs du serveur backend. Demandez à l'administrateur du serveur de regarder les logs autour de l'heure de l'erreur (13:17:06 UTC le 29 octobre 2025).

Les logs devraient contenir:
```
[DEBUG][HANDLE_CREER_SERVICE] Payload reçu: {...}
[creer_service] Erreur SQL lors de l'insertion: <détails de l'erreur>
```

## Actions immédiates

1. ✅ **Correction du bug toLowerCase**: Déjà fait
2. 🔄 **Redémarrer l'app mobile**: En cours
3. ⏳ **Tester la création d'un service simple** (sans produits d'abord)
4. 📋 **Copier les logs d'erreur détaillés** (déjà copiés dans le presse-papiers)
5. 🔍 **Vérifier les logs backend** pour identifier la cause exacte

## Note importante

Le fait que vous receviez une "Erreur 500" sans plus de détails suggère que l'erreur se produit au niveau du backend avant même que les détails puissent être renvoyés. C'est probablement:
- Une erreur de validation du schéma JSON
- Une erreur SQL (contrainte violée)
- Un problème de parsing des données

