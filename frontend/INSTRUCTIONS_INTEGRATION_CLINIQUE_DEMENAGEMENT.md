# Instructions d'intégration Frontend - Clinique/Hôpital & Déménagement

## Modifications à apporter dans `ProductManager.tsx`

### 1. Mettre à jour l'interface Product

Ajouter ces champs dans l'interface Product (après les champs pharmacie) :

```typescript
// Hôpital/Clinique
typeEtablissement?: string;
banqueSang?: boolean;
prestationsMedicales?: string[];
planningHebdomadaire?: { [key: string]: { debut: string; fin: string; permanent: boolean } };
rdvEnLigne?: boolean;

// Déménagement
typeDemenagement?: string;
volumeEstime?: string;
typeVehicule?: string;
distanceKm?: string;
nbDemenageurs?: string;
assuranceMarchandise?: boolean;
serviceManutention?: boolean;
montageDemontage?: boolean;
emballageCartons?: boolean;
gardeMeuble?: boolean;
debarras?: boolean;
dateDemenagementDisponible?: string;
```

### 2. Ajouter 'demenagement' au ProductType

```typescript
| 'demenagement'
```

### 3. Mettre à jour PRODUCT_TYPES

Ajouter après 'pharmacie' :

```typescript
{ value: 'demenagement', label: 'Déménagement et Transport', icon: Package, color: '#F97316', description: 'Services de déménagement local, national et international' },
```

### 4. Mettre à jour les templates Excel

```typescript
hopital_clinique: `Nom,Prix,Devise,Description,Type,Banque de sang,Prestations médicales,Planning,Urgences 24h/24,RDV en ligne
Hôpital Général,0,EUR,Établissement public avec service d'urgences et banque de sang,Hôpital,Oui,Chirurgie|Consultation générale|Radiologie|Laboratoire,Lun-Ven 08:00-18:00,Oui,Non
Clinique Saint-Joseph,0,EUR,Clinique privée spécialisée avec RDV en ligne,Clinique,Non,Gynécologie|Ophtalmologie|Pédiatrie,Lun-Sam 09:00-19:00,Non,Oui`,

demenagement: `Nom,Prix,Devise,Description,Type,Volume m³,Type véhicule,Distance km,Nb déménageurs,Assurance,Manutention,Montage/Démontage,Emballage,Garde-meuble,Débarras
Déménagement Express,500,EUR,Déménagement local rapide avec équipe professionnelle,Local,20,Camion 20m³,50,3,Oui,Oui,Oui,Non,Non,Non
Trans-Europe Déménagement,1500,EUR,Déménagement international avec assurance tous risques,International,40,Camion 40m³,1500,5,Oui,Oui,Oui,Oui,Oui,Non`,
```

### 5. Ajouter les formulaires

#### Formulaire Clinique/Hôpital (remplacer l'existant)

```tsx
{selectedType === 'hopital_clinique' && (
  <div className="space-y-4">
    {/* Type d'établissement */}
    <div>
      <Label>Type d'établissement médical</Label>
      <div className="flex gap-2 mt-2">
        {['Hôpital', 'Clinique', 'Centre de santé', 'Dispensaire'].map((type) => (
          <Button
            key={type}
            type="button"
            variant={newProduct.typeEtablissement === type ? 'default' : 'outline'}
            onClick={() => setNewProduct({ ...newProduct, typeEtablissement: type })}
          >
            {type}
          </Button>
        ))}
      </div>
    </div>

    {/* Banque de sang */}
    <div className="flex items-center space-x-2">
      <input
        type="checkbox"
        id="banqueSang"
        checked={newProduct.banqueSang || false}
        onChange={(e) => setNewProduct({ ...newProduct, banqueSang: e.target.checked })}
        className="rounded"
      />
      <Label htmlFor="banqueSang">🩸 Banque de sang disponible</Label>
    </div>

    {/* Prestations médicales */}
    <div>
      <Label>Prestations médicales disponibles</Label>
      <p className="text-sm text-gray-500 mb-2">Cochez toutes les prestations offertes</p>
      <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded p-3">
        {[
          'Consultation générale', 'Consultation spécialisée', 'Chirurgie',
          'Maternité / Accouchement', 'Pédiatrie', 'Cardiologie',
          'Radiologie', 'Échographie', 'Scanner', 'IRM',
          'Laboratoire', 'Analyses médicales', 'Pharmacie',
          'Urgences 24h/24', 'Hospitalisation', 'Soins intensifs',
          'Dialyse', 'Dentaire', 'Ophtalmologie', 'ORL',
          'Kinésithérapie', 'Radiothérapie', 'Chimiothérapie'
        ].map((prestation) => (
          <div key={prestation} className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={prestation}
              checked={(newProduct.prestationsMedicales || []).includes(prestation)}
              onChange={(e) => {
                const current = newProduct.prestationsMedicales || [];
                if (e.target.checked) {
                  setNewProduct({ ...newProduct, prestationsMedicales: [...current, prestation] });
                } else {
                  setNewProduct({ 
                    ...newProduct, 
                    prestationsMedicales: current.filter(p => p !== prestation) 
                  });
                }
              }}
              className="rounded"
            />
            <label htmlFor={prestation} className="text-sm cursor-pointer">{prestation}</label>
          </div>
        ))}
      </div>
    </div>

    {/* Planning hebdomadaire */}
    <div>
      <Label>Horaires de disponibilité</Label>
      <p className="text-sm text-gray-500 mb-2">Précisez les horaires pour chaque jour</p>
      {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((jour) => (
        <div key={jour} className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded">
          <span className="w-24 font-medium text-sm">{jour}</span>
          <Input
            type="time"
            placeholder="08:00"
            value={newProduct.planningHebdomadaire?.[jour]?.debut || ''}
            onChange={(e) => setNewProduct({
              ...newProduct,
              planningHebdomadaire: {
                ...newProduct.planningHebdomadaire,
                [jour]: {
                  ...newProduct.planningHebdomadaire?.[jour],
                  debut: e.target.value
                }
              }
            })}
            className="flex-1"
          />
          <span className="text-sm">à</span>
          <Input
            type="time"
            placeholder="18:00"
            value={newProduct.planningHebdomadaire?.[jour]?.fin || ''}
            onChange={(e) => setNewProduct({
              ...newProduct,
              planningHebdomadaire: {
                ...newProduct.planningHebdomadaire,
                [jour]: {
                  ...newProduct.planningHebdomadaire?.[jour],
                  fin: e.target.value
                }
              }
            })}
            className="flex-1"
          />
          <div className="flex items-center space-x-1">
            <input
              type="checkbox"
              id={`${jour}-permanent`}
              checked={newProduct.planningHebdomadaire?.[jour]?.permanent || false}
              onChange={(e) => setNewProduct({
                ...newProduct,
                planningHebdomadaire: {
                  ...newProduct.planningHebdomadaire,
                  [jour]: {
                    ...newProduct.planningHebdomadaire?.[jour],
                    permanent: e.target.checked
                  }
                }
              })}
              className="rounded"
            />
            <Label htmlFor={`${jour}-permanent`} className="text-xs">24h</Label>
          </div>
        </div>
      ))}
    </div>

    {/* RDV en ligne */}
    <div className="flex items-center space-x-2">
      <input
        type="checkbox"
        id="rdvEnLigne"
        checked={newProduct.rdvEnLigne || false}
        onChange={(e) => setNewProduct({ ...newProduct, rdvEnLigne: e.target.checked })}
        className="rounded"
      />
      <Label htmlFor="rdvEnLigne">📅 Prise de rendez-vous en ligne disponible</Label>
    </div>

    <div className="bg-blue-50 border-l-4 border-blue-500 p-3">
      <p className="text-sm text-blue-700">
        💡 Renseignez précisément vos prestations et horaires pour aider les patients à trouver le bon service médical
      </p>
    </div>
  </div>
)}
```

#### Formulaire Déménagement (nouveau)

```tsx
{selectedType === 'demenagement' && (
  <div className="space-y-4">
    {/* Type de déménagement */}
    <div>
      <Label>Type de déménagement</Label>
      <div className="flex gap-2 mt-2">
        {['Local', 'National', 'International'].map((type) => (
          <Button
            key={type}
            type="button"
            variant={newProduct.typeDemenagement === type ? 'default' : 'outline'}
            onClick={() => setNewProduct({ ...newProduct, typeDemenagement: type })}
          >
            {type}
          </Button>
        ))}
      </div>
    </div>

    {/* Volume et véhicule */}
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label>Volume estimé (m³)</Label>
        <Input
          type="number"
          placeholder="20, 30, 40..."
          value={newProduct.volumeEstime || ''}
          onChange={(e) => setNewProduct({ ...newProduct, volumeEstime: e.target.value })}
        />
      </div>
      <div>
        <Label>Distance maximale (km)</Label>
        <Input
          type="number"
          placeholder="50, 500, 2000..."
          value={newProduct.distanceKm || ''}
          onChange={(e) => setNewProduct({ ...newProduct, distanceKm: e.target.value })}
        />
      </div>
    </div>

    {/* Type de véhicule */}
    <div>
      <Label>Type de véhicule disponible</Label>
      <div className="flex gap-2 mt-2 flex-wrap">
        {['Camionnette 10m³', 'Camion 20m³', 'Camion 30m³', 'Camion 40m³+'].map((type) => (
          <Button
            key={type}
            type="button"
            variant={newProduct.typeVehicule === type ? 'default' : 'outline'}
            onClick={() => setNewProduct({ ...newProduct, typeVehicule: type })}
            className="text-sm"
          >
            {type}
          </Button>
        ))}
      </div>
    </div>

    {/* Nombre de déménageurs */}
    <div>
      <Label>Nombre de déménageurs</Label>
      <div className="flex gap-2 mt-2">
        {['1', '2', '3', '4', '5+'].map((nb) => (
          <Button
            key={nb}
            type="button"
            variant={newProduct.nbDemenageurs === nb ? 'default' : 'outline'}
            onClick={() => setNewProduct({ ...newProduct, nbDemenageurs: nb })}
          >
            {nb}
          </Button>
        ))}
      </div>
    </div>

    {/* Services inclus */}
    <div>
      <Label>Services inclus</Label>
      <p className="text-sm text-gray-500 mb-2">Cochez tous les services que vous proposez</p>
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="assurance"
            checked={newProduct.assuranceMarchandise || false}
            onChange={(e) => setNewProduct({ ...newProduct, assuranceMarchandise: e.target.checked })}
            className="rounded"
          />
          <Label htmlFor="assurance">🛡️ Assurance marchandise</Label>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="manutention"
            checked={newProduct.serviceManutention || false}
            onChange={(e) => setNewProduct({ ...newProduct, serviceManutention: e.target.checked })}
            className="rounded"
          />
          <Label htmlFor="manutention">💪 Service de manutention</Label>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="montage"
            checked={newProduct.montageDemontage || false}
            onChange={(e) => setNewProduct({ ...newProduct, montageDemontage: e.target.checked })}
            className="rounded"
          />
          <Label htmlFor="montage">🔧 Montage / Démontage meubles</Label>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="emballage"
            checked={newProduct.emballageCartons || false}
            onChange={(e) => setNewProduct({ ...newProduct, emballageCartons: e.target.checked })}
            className="rounded"
          />
          <Label htmlFor="emballage">📦 Fourniture cartons d'emballage</Label>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="garde"
            checked={newProduct.gardeMeuble || false}
            onChange={(e) => setNewProduct({ ...newProduct, gardeMeuble: e.target.checked })}
            className="rounded"
          />
          <Label htmlFor="garde">🏠 Garde-meuble disponible</Label>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="debarras"
            checked={newProduct.debarras || false}
            onChange={(e) => setNewProduct({ ...newProduct, debarras: e.target.checked })}
            className="rounded"
          />
          <Label htmlFor="debarras">🗑️ Service de débarras</Label>
        </div>
      </div>
    </div>

    {/* Date de disponibilité */}
    <div>
      <Label>Première date de disponibilité</Label>
      <Input
        type="date"
        value={newProduct.dateDemenagementDisponible || ''}
        onChange={(e) => setNewProduct({ ...newProduct, dateDemenagementDisponible: e.target.value })}
      />
    </div>

    <div className="bg-blue-50 border-l-4 border-blue-500 p-3">
      <p className="text-sm text-blue-700">
        💡 Précisez tous vos services pour que les clients puissent comparer facilement les offres
      </p>
    </div>
  </div>
)}
```

### 6. Mettre à jour l'import Excel

Ajouter les cas pour hopital_clinique et demenagement dans la fonction `handleImportExcel` (similaire au mobile).

---

## ✅ Checklist Frontend

- [ ] Mettre à jour l'interface Product
- [ ] Ajouter 'demenagement' au ProductType
- [ ] Mettre à jour PRODUCT_TYPES
- [ ] Mettre à jour templates Excel
- [ ] Ajouter formulaire hopital_clinique
- [ ] Ajouter formulaire demenagement
- [ ] Mettre à jour import Excel
- [ ] Adapter affichage dans ResultatBesoin (similaire à ProductCard mobile)
- [ ] Tester création et affichage

**Note** : La logique est identique au mobile, seule la syntaxe React/TypeScript change (Input au lieu de NativeInput, etc.).

