#!/usr/bin/env node

/**
 * Runtime Crash Diagnostic Script
 * Checks for common patterns that cause runtime crashes in React Native apps
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Runtime Crash Diagnostic - Yukpomnang Mobile');
console.log('==========================================\n');

const mobileDir = __dirname;
const srcDir = path.join(mobileDir, 'src');

// Common runtime crash patterns
const crashPatterns = [
  {
    name: 'AsyncStorage in render',
    pattern: /AsyncStorage\.(getItem|setItem|removeItem)/,
    files: ['**/*.tsx', '**/*.ts'],
    description: 'AsyncStorage calls in render can cause crashes'
  },
  {
    name: 'useEffect dependency issues',
    pattern: /useEffect\([^,]+,\s*\[\s*\]\)/,
    files: ['**/*.tsx', '**/*.ts'],
    description: 'Empty deps array with external dependencies'
  },
  {
    name: 'React Hooks violations',
    pattern: /(useMemo|useCallback|useEffect)\([^)]*\)\s*[\s\S]*?(useState|useEffect|useContext)/,
    files: ['**/*.tsx', '**/*.ts'],
    description: 'Hooks called inside other hooks'
  },
  {
    name: 'Missing null checks',
    pattern: /[^?]\.map\(/,
    files: ['**/*.tsx', '**/*.ts'],
    description: 'Array.map without null/undefined check'
  },
  {
    name: 'JSON.parse without try-catch',
    pattern: /JSON\.parse\([^)]*\)(?!\s*\.catch\(|\s*try)/,
    files: ['**/*.tsx', '**/*.ts'],
    description: 'JSON.parse without error handling'
  },
  {
    name: 'Unsafe navigation',
    pattern: /navigation\.(navigate|goBack|reset)\([^,)]*\)(?!\s*\?)/,
    files: ['**/*.tsx', '**/*.ts'],
    description: 'Navigation calls without null check'
  }
];

function findFiles(pattern, dir) {
  const results = [];
  
  function walk(currentPath) {
    try {
      const files = fs.readdirSync(currentPath);
      
      for (const file of files) {
        const filePath = path.join(currentPath, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          walk(filePath);
        } else if (stat.isFile() && pattern.some(p => file.match(p.replace('**/', '.*')))) {
          results.push(filePath);
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
  }
  
  walk(dir);
  return results;
}

function checkFile(filePath, pattern) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const matches = [];
    
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        matches.push({
          line: index + 1,
          content: line.trim()
        });
      }
    });
    
    return matches;
  } catch (error) {
    return [];
  }
}

console.log('Scanning for runtime crash patterns...\n');

let totalIssues = 0;

crashPatterns.forEach(({ name, pattern, files, description }) => {
  console.log(`\n🔍 Checking: ${name}`);
  console.log(`   ${description}`);
  console.log('   ' + '='.repeat(50));
  
  const targetFiles = findFiles(files, srcDir);
  let patternIssues = 0;
  
  targetFiles.forEach(filePath => {
    const matches = checkFile(filePath, pattern);
    if (matches.length > 0) {
      console.log(`   ⚠️  ${path.relative(mobileDir, filePath)}:`);
      matches.forEach(match => {
        console.log(`      Line ${match.line}: ${match.content.substring(0, 100)}...`);
      });
      patternIssues += matches.length;
    }
  });
  
  if (patternIssues === 0) {
    console.log('   ✅ No issues found');
  } else {
    console.log(`   ❌ Found ${patternIssues} potential issues`);
  }
  
  totalIssues += patternIssues;
});

console.log(`\n📊 Summary`);
console.log('===========');
console.log(`Total potential runtime crash issues: ${totalIssues}`);

if (totalIssues > 0) {
  console.log('\n⚠️  Recommendations:');
  console.log('1. Fix AsyncStorage calls - move them to useEffect or async functions');
  console.log('2. Add proper dependency arrays to useEffect');
  console.log('3. Move hooks outside of other hooks/callbacks');
  console.log('4. Add null/undefined checks before .map() calls');
  console.log('5. Wrap JSON.parse in try-catch blocks');
  console.log('6. Add null checks before navigation calls');
} else {
  console.log('\n✅ No obvious runtime crash patterns detected');
}

// Check for specific known issues
console.log('\n🔍 Checking specific known issues...');

// Check SafeStorage import casing
const safeStorageImportPattern = /import.*SafeStorage.*from.*['"]\.\.\/utils\/SafeStorage['"]/;
const safeStorageFiles = findFiles(['**/*.tsx', '**/*.ts'], srcDir);
let casingIssues = 0;

safeStorageFiles.forEach(filePath => {
  const matches = checkFile(filePath, safeStorageImportPattern);
  if (matches.length > 0) {
    console.log(`   ⚠️  SafeStorage import casing issue in ${path.relative(mobileDir, filePath)}`);
    casingIssues += matches.length;
  }
});

if (casingIssues === 0) {
  console.log('   ✅ No SafeStorage import casing issues');
} else {
  console.log(`   ❌ Found ${casingIssues} SafeStorage import casing issues`);
}

console.log('\n🏁 Diagnostic complete');
