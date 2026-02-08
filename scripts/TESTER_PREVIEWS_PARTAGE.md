# 🧪 Comment Tester les Previews de Partage

## 📋 Outils de Test

### 1. Facebook Sharing Debugger
**URL :** https://developers.facebook.com/tools/debug/

**Utilisation :**
1. Coller l'URL de votre produit : `https://yukpomnang.com/product/[ID]?serviceId=[ID]`
2. Cliquer sur "Debug"
3. Vérifier la preview générée

**Ce qui doit apparaître :**
- ✅ Image du produit
- ✅ Titre du produit
- ✅ Description
- ✅ Prix (si disponible)

### 2. Twitter Card Validator
**URL :** https://cards-dev.twitter.com/validator

**Utilisation :**
1. Coller l'URL de votre produit
2. Vérifier la preview

**Ce qui doit apparaître :**
- ✅ Large image card
- ✅ Titre et description
- ✅ Image optimisée

### 3. LinkedIn Post Inspector
**URL :** https://www.linkedin.com/post-inspector/

**Utilisation :**
1. Coller l'URL de votre produit
2. Vérifier la preview

**Ce qui doit apparaître :**
- ✅ Preview professionnelle
- ✅ Image et description

### 4. Google Rich Results Test
**URL :** https://search.google.com/test/rich-results

**Utilisation :**
1. Coller l'URL de votre produit
2. Vérifier les rich snippets

**Ce qui doit apparaître :**
- ✅ Product schema détecté
- ✅ Prix et devise
- ✅ Disponibilité

### 5. Open Graph Preview (Générique)
**URL :** https://www.opengraph.xyz/

**Utilisation :**
1. Coller l'URL de votre produit
2. Vérifier tous les meta tags

## 🔍 Checklist de Vérification

### Open Graph
- [ ] `og:title` présent et correct
- [ ] `og:description` présent et correct
- [ ] `og:image` présent et accessible
- [ ] `og:url` présent et correct
- [ ] `og:type` = "product"
- [ ] `og:site_name` = "Yukpomnang"

### Twitter Cards
- [ ] `twitter:card` = "summary_large_image"
- [ ] `twitter:title` présent
- [ ] `twitter:description` présent
- [ ] `twitter:image` présent et accessible

### Schema.org
- [ ] JSON-LD présent
- [ ] Type "Product" détecté
- [ ] Prix et devise présents
- [ ] Image présente

## 🐛 Dépannage

### Image ne s'affiche pas
1. Vérifier que l'URL de l'image est accessible (pas de 404)
2. Vérifier que l'image est en HTTPS
3. Vérifier les dimensions (recommandé : 1200x630px)

### Preview ne se met pas à jour
1. Utiliser le "Scrape Again" dans Facebook Debugger
2. Attendre quelques minutes pour le cache
3. Vérifier que les meta tags sont bien dans le HTML

### Prix ne s'affiche pas
1. Vérifier que `product_price` n'est pas null
2. Vérifier le format du prix dans la base de données



