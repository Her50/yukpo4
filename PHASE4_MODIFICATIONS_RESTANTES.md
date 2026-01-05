# Phase 4 : Modifications Restantes

## ✅ Complété
- PharmacieFormScreen : PartnerSelector supprimé, chargement automatique depuis /api/partners/me
- HopitalFormScreen : PartnerSelector supprimé, chargement automatique depuis /api/partners/me

## ⏳ À Faire

### Mobile - LaboratoireFormScreen
1. Supprimer `import PartnerSelector`
2. Supprimer `partner: null as Partner | null` du state
3. Ajouter useEffect pour charger depuis `/api/partners/me` si `user?.role === 'partenaire' && user?.partner_type === 'laboratoire'`
4. Remplacer `<PartnerSelector>` par `<NativeInput>` avec `editable={user?.role !== 'partenaire'}`
5. Supprimer toutes les références à `formData.partner`

### Mobile - AgenceVoyageFormScreen
1. Supprimer `import PartnerSelector`
2. Supprimer `partner: null as Partner | null` du state
3. Ajouter useEffect pour charger depuis `/api/partners/me` si `user?.role === 'partenaire' && user?.partner_type === 'agence de voyage'`
4. Remplacer `<PartnerSelector>` par `<NativeInput>` avec `editable={user?.role !== 'partenaire'}`
5. Supprimer toutes les références à `formData.partner`

### Frontend Web
1. **LoginPage.tsx** : Ajouter bouton "Devenir partenaire" qui redirige vers `/register/partner`
2. **PartnerRegisterPage.tsx** : Créer nouvelle page avec formulaire similaire à `PartnerRegisterScreen.tsx` (mobile)
3. **AppRoutesRegistry.tsx** : Ajouter route `/register/partner`
4. **Navigation** : Rediriger les partenaires vers leur écran spécialisé après login (selon `partner_type`)

## Pattern à suivre

### Chargement automatique des données partenaire
```typescript
useEffect(() => {
    const loadPartnerData = async () => {
        if (user?.role === 'partenaire' && user?.partner_type === 'TYPE_PARTENAIRE') {
            try {
                const response = await apiGet('/api/partners/me');
                if (response.success && response.data) {
                    const partner = response.data;
                    setFormData(prev => ({
                        ...prev,
                        nom: partner.name || prev.nom,
                        adresse: partner.address || partner.location_address || prev.adresse,
                        telephone: partner.contact_phone || prev.telephone,
                        email: partner.contact_email || prev.email,
                        quartier: partner.city ? {
                            raw: partner.city,
                            place_name: partner.city,
                            components: {
                                ville: partner.city,
                                pays: partner.country,
                            }
                        } : prev.quartier,
                    }));
                }
            } catch (error) {
                console.error('[FormScreen] Erreur chargement partenaire:', error);
            }
        }
    };
    loadPartnerData();
}, [user?.role, user?.partner_type]);
```

### Remplacement de PartnerSelector
```typescript
{/* ✅ SUPPRIMÉ: PartnerSelector - Les données partenaire sont chargées automatiquement */}
<NativeInput
    label="Nom de l'établissement *"
    value={formData.nom}
    onChangeText={(text) => setFormData({ ...formData, nom: text })}
    placeholder="Ex: Nom de l'établissement"
    editable={user?.role !== 'partenaire'} // Désactiver si c'est un partenaire (rempli automatiquement)
/>
```

