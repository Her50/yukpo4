// generateStories.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pagesDir = path.join(__dirname, "src", "pages");
const storiesDir = path.join(__dirname, "src", "stories");

if (!fs.existsSync(storiesDir)) fs.mkdirSync(storiesDir, { recursive: true });

// Catégories automatiques selon nom
const categorize = (name) => {
  const n = name.toLowerCase();
  if (n.includes("admin") || n.includes("dashboard")) return "Pages/Admin";
  if (n.includes("matching") || n.includes("biens") || n.includes("ticket") || n.includes("livre")) return "Pages/Produits";
  if (n.includes("ia") || n.includes("reco") || n.includes("predict")) return "Pages/IA";
  if (n.includes("contact") || n.includes("upgrade") || n.includes("paiement")) return "Pages/Formulaires";
  return "Pages/Générales";
};

fs.readdirSync(pagesDir).forEach((file) => {
  const name = path.basename(file, path.extname(file));
  const category = categorize(name);
  const storyPath = path.join(storiesDir, `${name}.stories.tsx`);

  if (fs.existsSync(storyPath)) return;

  const content = `
// src/stories/${name}.stories.tsx
import React from "react";
import ${name} from "@/pages/${name}";

export default {
  title: "${category}/${name}",
  component: ${name},
};

export const Default = () => <${name} />;
  `.trim();

  fs.writeFileSync(storyPath, content);
  console.log(`✅ Story créée : ${storyPath}`);
});
