#!/usr/bin/env node
// Script pour patcher metro-cache-key pour exporter default
const fs = require('fs');
const path = require('path');

console.log('🔧 Patching metro-cache-key default export...');

const indexPath = path.join(__dirname, 'node_modules/metro-cache-key/src/index.js');

if (fs.existsSync(indexPath)) {
    const newContent = `"use strict";

const crypto = require("crypto");
const fs = require("fs");

function getCacheKey(files) {
  return files
    .reduce(
      (hash, file) => hash.update("\\0", "utf8").update(fs.readFileSync(file)),
      crypto.createHash("md5")
    )
    .digest("hex");
}

// Export par défaut ET nommé pour compatibilité avec require().default
module.exports = getCacheKey;
module.exports.default = getCacheKey;
module.exports.getCacheKey = getCacheKey;
`;

    fs.writeFileSync(indexPath, newContent);
    console.log('✅ metro-cache-key patched successfully with default export\n');
} else {
    console.log('⚠️  metro-cache-key not found, skipping...\n');
}

