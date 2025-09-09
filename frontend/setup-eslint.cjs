const { execSync } = require('child_process');
const fs = require('fs');

// Vérifier si le fichier .eslintrc.js existe
const eslintConfigPath = './.eslintrc.cjs';
const packageJsonPath = './package.json';

// Fonction pour exécuter une commande et afficher le résultat
function executeCommand(command) {
  try {
    console.log(`Exécution de la commande: ${command}`);
    const result = execSync(command, { stdio: 'inherit' });
    console.log(result.toString());
  } catch (error) {
    console.error('Erreur lors de l\'exécution de la commande:', error);
  }
}

// Vérifier si le fichier .eslintrc.js existe
if (!fs.existsSync(eslintConfigPath)) {
  console.log("Le fichier .eslintrc.js est manquant, création du fichier de configuration ESLint...");
  const eslintConfigContent = `
module.exports = {
  extends: [
    'airbnb',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['react', '@typescript-eslint'],
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  rules: {}
};
  `;
  fs.writeFileSync(eslintConfigPath, eslintConfigContent);
  console.log('.eslintrc.js a été créé avec succès !');
} else {
  console.log('.eslintrc.js existe déjà.');
}

// Vérifier le fichier package.json
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath));
  const dependencies = packageJson.devDependencies || {};
  const missingDependencies = [];

  // Liste des dépendances ESLint nécessaires
  const requiredDependencies = [
    'eslint-config-airbnb',
    'eslint-plugin-import',
    'eslint-plugin-react',
    'eslint-plugin-react-hooks',
    'eslint',
    '@typescript-eslint/eslint-plugin',
    '@typescript-eslint/parser'
  ];

  requiredDependencies.forEach(dep => {
    if (!dependencies[dep]) {
      missingDependencies.push(dep);
    }
  });

  // Installer les dépendances manquantes
  if (missingDependencies.length > 0) {
    console.log('Installation des dépendances manquantes:', missingDependencies.join(', '));
    executeCommand(`npm install --save-dev ${missingDependencies.join(' ')}`);
  } else {
    console.log('Toutes les dépendances nécessaires sont déjà installées.');
  }
} else {
  console.error("Le fichier package.json est manquant.");
}

// Nettoyage du cache npm (si nécessaire)
console.log("Nettoyage du cache npm...");
executeCommand('npm cache clean --force');

// Installer les dépendances via npm
console.log('Installation des dépendances...');
executeCommand('npm install');

// Lancer le linting pour vérifier la configuration
console.log('Lancement de ESLint...');
executeCommand('npm run lint');
