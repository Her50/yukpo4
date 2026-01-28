import { defineConfig } from 'vitest/config';

// ✅ Vitest config local au package mobile
// Évite de charger le vite.config.ts à la racine du monorepo (qui peut dépendre de Vite).
export default defineConfig({
  test: {
    environment: 'node',
    // Le dossier legacy contient des prototypes RN qui ne sont pas compatibles avec le pipeline Vite/Vitest (Flow "import typeof").
    exclude: ['src/legacy/**', '**/node_modules/**'],
    passWithNoTests: true,
  },
});


