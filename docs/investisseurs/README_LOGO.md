# Logo Yukpo pour Document de Financement

## Instructions

Pour que le logo apparaisse dans le document HTML `DEMANDE_FINANCEMENT_BANQUE.html`, vous devez :

1. **Copier le logo** depuis `frontend/src/assets/logo.png` vers `docs/investisseurs/logo_yukpo.png`

   Ou depuis PowerShell :
   ```powershell
   Copy-Item "..\..\frontend\src\assets\logo.png" -Destination "logo_yukpo.png"
   ```

2. **Alternative** : Si le logo n'est pas disponible, le document affichera uniquement le texte "YUKPO" avec le branding coloré (Yuk en jaune/orange, po en rouge).

## Branding Yukpo

Le document utilise maintenant le branding officiel :
- **Yuk** : Couleur #F59E0B (jaune/orange)
- **po** : Couleur #DC2626 (rouge)

Le nom complet "Yukpomnang" est mentionné entre parenthèses pour clarifier, mais "Yukpo" est utilisé partout pour l'harmonisation avec l'application.

## Fichiers concernés

- `DEMANDE_FINANCEMENT_BANQUE.html` : Document principal avec branding appliqué
- `logo_yukpo.png` : Logo à placer dans ce dossier (optionnel)



