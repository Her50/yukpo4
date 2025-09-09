export { default as i18n } from './i18n';

// ✅ Utiliser `*` si pas de `export default`
export * from './serviceWorkerRegistration';
export * from './LayoutRoutes';

export { default as App } from './App';

// 🚫 Ne pas exporter index.tsx et main.tsx ici s’ils sont les points d’entrée
// export { default as index } from './index';
// export { default as main } from './main';
