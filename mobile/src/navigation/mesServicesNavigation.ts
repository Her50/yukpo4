/**
 * Ouvre **MesServicesScreen** (hub produits moderne : cartes, stats, menu latéral, bulk, promos…).
 *
 * Ne pas utiliser `navigate('Services')` depuis la pile racine : une route stack séparée `Services`
 * charge **ServicesScreen** (ancien tableau « Mon activité »), d’où la confusion avec l’onglet
 * barre du bas nommé aussi `Services` mais branché sur MesServicesScreen.
 */
export function navigateToMesServicesHub(navigation: { navigate: (...args: any[]) => void }): void {
  const nav = navigation as any;
  const parent = nav?.getParent?.();
  const grandParent = parent?.getParent?.();

  const navigators = [nav, parent, grandParent].filter(Boolean);
  // Cibler explicitement le hub PRODUITS moderne:
  // - onglet "Services" de MainTabs -> MesServicesScreen
  // - fallback stack "MesServices" (même écran)
  const targets: Array<{ route: string; params?: Record<string, any> }> = [
    { route: 'MainTabs', params: { screen: 'Services' } },
    { route: 'Main', params: { screen: 'Services' } },
    { route: 'MesServices' },
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

  console.warn('[mesServicesNavigation] Unable to navigate to Mes Services hub');
}

/**
 * Ouvre l'onglet "+" de création vidéo depuis n'importe quel niveau de navigation.
 */
export function navigateToVideoCreationTab(
  navigation: { navigate: (...args: any[]) => void },
  params?: Record<string, any>
): void {
  const nav = navigation as any;
  const parent = nav?.getParent?.();
  const grandParent = parent?.getParent?.();

  const navigators = [nav, parent, grandParent].filter(Boolean);
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
