const fs = require('fs');
const path = require('path');

const usage = () => {
    console.log('Usage: node scripts/move_to_legacy.js <relative-path> [<relative-path> ...]');
    console.log('Example: node scripts/move_to_legacy.js src/components/auth src/screens/delivery');
};

const args = process.argv.slice(2);

if (args.length === 0) {
    usage();
    process.exit(1);
}

const legacyRoot = path.resolve(__dirname, '..', 'src', 'legacy');

if (!fs.existsSync(legacyRoot)) {
    fs.mkdirSync(legacyRoot, { recursive: true });
    console.log(`Created legacy root at ${legacyRoot}`);
}

const moveEntry = (relativePath) => {
    const absFrom = path.resolve(__dirname, '..', relativePath);
    if (!fs.existsSync(absFrom)) {
        console.warn(`⚠️  Source does not exist: ${relativePath}`);
        return;
    }
    const legacyPath = path.resolve(legacyRoot, path.relative(path.resolve(__dirname, '..', 'src'), absFrom));
    fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
    fs.renameSync(absFrom, legacyPath);
    console.log(`✅ Moved ${relativePath} -> ${path.relative(path.resolve(__dirname, '..'), legacyPath)}`);
};

for (const entry of args) {
    moveEntry(entry);
}

