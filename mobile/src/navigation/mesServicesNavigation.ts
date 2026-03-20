/**
 * Ouvre **MesServicesScreen** (hub produits moderne : cartes, stats, menu latéral, bulk, promos…).
 *
 * Ne pas utiliser `navigate('Services')` depuis la pile racine : une route stack séparée `Services`
 * charge **ServicesScreen** (ancien tableau « Mon activité »), d’où la confusion avec l’onglet
 * barre du bas nommé aussi `Services` mais branché sur MesServicesScreen.
 */
export function navigateToMesServicesHub(navigation: { navigate: (...args: any[]) => void }): void {
  (navigation as any).navigate('MesServices');
}
