import toast from 'react-hot-toast';

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

// Référence stable (singleton module) — utiliser cette fonction dans les
// dépendances de useCallback/useEffect ne déclenchera JAMAIS de re-render.
// Avant : `useToast` retournait un nouvel objet à chaque appel, ce qui
// provoquait des boucles infinies de useEffect partout dans l'app.
const toastFn = ({ title, description, variant }: ToastOptions) => {
  const msg = description ? `${title ? title + ' — ' : ''}${description}` : (title || '');
  if (variant === 'destructive') {
    toast.error(msg);
  } else {
    toast.success(msg);
  }
};

const TOAST_API = Object.freeze({ toast: toastFn });

export function useToast() {
  return TOAST_API;
}
