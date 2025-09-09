// frontend/scripts/sync_access_registry.mjs
import fs from "fs";
import path from "path";
const registryPath = path.resolve("src/lib/access_registry.json");

export function saveAccessRegistry(updatedData) {
  fs.writeFileSync(registryPath, JSON.stringify(updatedData, null, 2), "utf-8");
  console.log("✅ access_registry.json mis à jour.");
}

