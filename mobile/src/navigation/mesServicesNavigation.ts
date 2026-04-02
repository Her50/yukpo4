/**
 * Ouvre l'écran catalogue produits actif via l'onglet **Services**.
 *
 * Ne pas utiliser `navigate('Services')` depuis la pile racine : une route stack séparée `Services`
 * charge **ServicesScreen** (ancien tableau « Mon activité »), d’où la confusion avec l’onglet
 * barre du bas nommé aussi `Services`.
 */
export function navigateToMesServicesHub(navigation: { navigate: (...args: any[]) => void }): void {
  const nav = navigation as any;
  const navigators: any[] = [];
  let cursor = nav;
  // Monter toute la chaîne des navigateurs disponibles (stack -> tabs -> root)
  while (cursor && !navigators.includes(cursor)) {
    navigators.push(cursor);
    cursor = cursor?.getParent?.();
  }
  // Cibler explicitement l'écran PRODUITS:
  // - onglet "Services" de MainTabs (branché sur MesProduitsScreen)
  // - fallback direct route MesProduits
  const targets: Array<{ route: string; params?: Record<string, any> }> = [
    { route: 'MainTabs', params: { screen: 'Services' } },
    { route: 'Main', params: { screen: 'Services' } },
    { route: 'MesProduits' },
  ];

  for (const currentNav of navigators) {
    for (const target of targets) {
      try {
        currentNav.navigate(target.route, target.params);
        return;
      } catch {
        // continue trying other route names / navigator levels
      }
    }
  }

  console.warn('[mesServicesNavigation] Unable to navigate to product management screen');
}

/**
 * Ouvre l'onglet "+" de création vidéo depuis n'importe quel niveau de navigation.
 */
export function navigateToVideoCreationTab(
  navigation: { navigate: (...args: any[]) => void },
  params?: Record<string, any>
): void {
  const nav = navigation as any;
  const navigators: any[] = [];
  let cursor = nav;
  while (cursor && !navigators.includes(cursor)) {
    navigators.push(cursor);
    cursor = cursor?.getParent?.();
  }
  const targets: Array<{ route: string; params?: Record<string, any> }> = [
    { route: 'MainTabs', params: { screen: 'VideoCreationIntro', params } },
    { route: 'Main', params: { screen: 'VideoCreationIntro', params } },
    { route: 'VideoCreationIntro', params },
  ];

  for (const currentNav of navigators) {
    for (const target of targets) {
      try {
        currentNav.navigate(target.route, target.params);
        return;
      } catch {
        // continue trying other route names / navigator levels
      }
    }
  }

  console.warn('[mesServicesNavigation] Unable to navigate to Video creation tab');
}
