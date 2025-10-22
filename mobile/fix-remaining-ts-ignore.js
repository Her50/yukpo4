/**
 * Script pour corriger les @ts-ignore restants de manière ciblée
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Correction des @ts-ignore restants...');

// Fichiers avec corrections spécifiques
const specificFixes = [
  {
    file: 'src/screens/HomeScreen.tsx',
    replacements: [
      {
        from: /\/\/ @ts-ignore\s*\n\s*import\s+\{([^}]+)\}\s+from\s+'lucide-react-native';/g,
        to: "import { $1 } from 'lucide-react-native';"
      }
    ]
  },
  {
    file: 'src/screens/TestDashboardScreen.tsx',
    replacements: [
      {
        from: /\/\/ @ts-ignore\s*\n\s*import\s+\{([^}]+)\}\s+from\s+'lucide-react-native';/g,
        to: "import { $1 } from 'lucide-react-native';"
      }
    ]
  },
  {
    file: 'src/screens/SoldeDetailScreen.tsx',
    replacements: [
      {
        from: /\/\/ @ts-ignore\s*\n\s*import\s+\{([^}]+)\}\s+from\s+'lucide-react-native';/g,
        to: "import { $1 } from 'lucide-react-native';"
      }
    ]
  },
  {
    file: 'src/screens/PubliciteDashboardScreen.tsx',
    replacements: [
      {
        from: /\/\/ @ts-ignore\s*\n\s*import\s+\{([^}]+)\}\s+from\s+'lucide-react-native';/g,
        to: "import { $1 } from 'lucide-react-native';"
      }
    ]
  },
  {
    file: 'src/screens/CreatePubliciteScreen.tsx',
    replacements: [
      {
        from: /\/\/ @ts-ignore\s*\n\s*import\s+\{([^}]+)\}\s+from\s+'lucide-react-native';/g,
        to: "import { $1 } from 'lucide-react-native';"
      },
      {
        from: /\/\/ @ts-ignore - DocumentPicker result type/g,
        to: "// Type annotation pour DocumentPicker"
      }
    ]
  },
  {
    file: 'src/screens/ContactScreen.tsx',
    replacements: [
      {
        from: /\/\/ @ts-ignore\s*\n\s*import\s+\{([^}]+)\}\s+from\s+'lucide-react-native';/g,
        to: "import { $1 } from 'lucide-react-native';"
      }
    ]
  },
  {
    file: 'src/components/MesServicesScreen.tsx',
    replacements: [
      {
        from: /\/\/ @ts-ignore\s*\n\s*import\s+\{([^}]+)\}\s+from\s+'lucide-react-native';/g,
        to: "import { $1 } from 'lucide-react-native';"
      }
    ]
  }
];

function processFile(filePath, replacements) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ Fichier non trouvé: ${filePath}`);
      return 0;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let changesCount = 0;

    replacements.forEach(({ from, to }) => {
      const matches = content.match(from);
      if (matches) {
        content = content.replace(from, to);
        changesCount += matches.length;
      }
    });

    if (changesCount > 0) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ ${filePath} - ${changesCount} corrections appliquées`);
    }

    return changesCount;
  } catch (error) {
    console.error(`❌ Erreur traitement ${filePath}:`, error.message);
    return 0;
  }
}

let totalChanges = 0;

console.log('\n🎯 Traitement des fichiers spécifiques...');
specificFixes.forEach(({ file, replacements }) => {
  console.log(`\n📁 ${file}:`);
  const changes = processFile(file, replacements);
  totalChanges += changes;
});

console.log(`\n📊 Total des corrections: ${totalChanges}`);
console.log('🎯 Correction terminée.');
