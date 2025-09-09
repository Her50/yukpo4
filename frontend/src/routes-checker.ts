#!/usr/bin/env ts-node

/**
 * 📦 CLI TypeScript : routes-checker.ts
 * Vérifie que toutes les routes définies dans App.tsx sont :
 * - bien présentes dans AppRoutesRegistry.ts
 * - que leurs composants React existent bien dans /pages
 */

import * as fs from "fs";
import * as path from "path";

const APP_TSX_PATH = "src/App.tsx";
const ROUTES_REGISTRY_PATH = "src/routes/AppRoutesRegistry.ts";
const PAGES_DIR = "src/pages";

const readFile = (filePath: string): string => {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    console.warn(`⚠️ Fichier introuvable : ${filePath}`);
    return "";
  }
};

const extractUsedRoutes = (content: string): string[] => {
  return [...content.matchAll(/ROUTES\.([A-Z0-9_]+)/g)].map((m) => m[1]);
};

const extractDefinedRoutes = (content: string): string[] => {
  return [...content.matchAll(/([A-Z0-9_]+):\s*["'`]/g)].map((m) => m[1]);
};

const extractReactImports = (content: string): { name: string; file: string }[] => {
  return [...content.matchAll(/import\s+([A-Za-z0-9_]+)\s+from\s+['"](.+?)['"]/g)].map(
    ([_, name, file]) => ({ name, file })
  );
};

function checkRoutes() {
  const appContent = readFile(APP_TSX_PATH);
  const registryContent = readFile(ROUTES_REGISTRY_PATH);

  const usedRoutes = new Set(extractUsedRoutes(appContent));
  const definedRoutes = new Set(extractDefinedRoutes(registryContent));
  const missingRoutes = [...usedRoutes].filter((r) => !definedRoutes.has(r));

  const imports = extractReactImports(appContent);
  const missingFiles = imports.filter(({ file }) => {
    const tsxPath = path.resolve("src", file + ".tsx");
    const indexPath = path.resolve("src", file, "index.tsx");
    return !fs.existsSync(tsxPath) && !fs.existsSync(indexPath);
  });

  console.log("\n🔍 Vérification des routes utilisées dans App.tsx :");
  console.log("➡️  Routes utilisées :", [...usedRoutes]);
  console.log("✅  Routes définies :", [...definedRoutes]);

  if (missingRoutes.length > 0) {
    console.warn("\n❌ Routes manquantes dans AppRoutesRegistry:");
    missingRoutes.forEach((r) => console.warn(`  - ROUTES.${r}`));
  } else {
    console.log("✔️  Toutes les routes utilisées sont bien déclarées dans AppRoutesRegistry.ts");
  }

  if (missingFiles.length > 0) {
    console.warn("\n📦 Composants React manquants :");
    missingFiles.forEach(({ name, file }) => {
      console.warn(`  - ${name} → src/${file}.tsx`);
    });
  } else {
    console.log("✔️  Tous les composants React importés existent.");
  }

  console.log("\n✅ Analyse terminée.\n");
}

checkRoutes();
