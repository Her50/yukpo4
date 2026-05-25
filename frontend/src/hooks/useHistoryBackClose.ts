// Hook pour qu'un bottom-sheet/modal se ferme via le bouton "Retour" du
// navigateur (ou geste back Android) au lieu de quitter complètement la PWA.
//
// Pattern :
//   1. Quand le sheet s'ouvre, on push une entrée d'historique fictive
//   2. Si l'utilisateur fait "back" → popstate → on appelle onClose()
//   3. Si le sheet est fermé via X / clic outside → on consomme l'entrée
//      avec history.back() silencieux pour ne pas laisser de fantôme

import { useEffect, useRef } from 'react';

export function useHistoryBackClose(isOpen: boolean, onClose: () => void): void {
  // Mémorise une clé unique pour chaque ouverture, pour pouvoir détecter si
  // c'est NOTRE entrée qui est consommée par le popstate.
  const keyRef = useRef<string>('');

  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === 'undefined') return;

    const key = `__yukpo_sheet_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    keyRef.current = key;

    // Push une entrée fictive dans l'historique. L'URL ne change pas, seulement
    // l'état. Cela donne au bouton "Retour" du navigateur quelque chose à
    // consommer avant de quitter la page.
    try {
      window.history.pushState({ sheetKey: key }, '');
    } catch {
      // pushState peut échouer dans des contextes très limités (iframe sandbox,
      // etc.). On n'empêche pas l'utilisation du sheet, on perd juste la
      // capture du back button.
      return;
    }

    const onPop = () => {
      onClose();
    };
    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);
      // Si on arrive ici parce que le sheet a été fermé via X / clic outside
      // (et non via back), il faut consommer l'entrée fantôme qu'on a pushée,
      // sinon l'utilisateur aurait à cliquer "back" deux fois pour vraiment
      // remonter dans son historique.
      try {
        if (window.history.state?.sheetKey === keyRef.current) {
          // history.back() déclenche popstate mais notre listener est déjà
          // détaché, donc safe.
          window.history.back();
        }
      } catch {
        /* */
      }
    };
  }, [isOpen, onClose]);
}
