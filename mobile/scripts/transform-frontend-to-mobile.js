#!/usr/bin/env node

/**
 * Script de transformation Frontend → Mobile
 * 
 * ⚠️ IMPORTANT : Ce script NE MODIFIE JAMAIS le frontend
 * Il lit seulement les fichiers frontend pour générer les versions mobiles
 */

const fs = require('fs');
const path = require('path');

// Configuration des chemins
const FRONTEND_PATH = path.join(__dirname, '../../frontend/src');
const MOBILE_PATH = path.join(__dirname, '../src');

console.log('🔄 Script de transformation Frontend → Mobile');
console.log('📖 Lecture du frontend :', FRONTEND_PATH);
console.log('📱 Génération mobile :', MOBILE_PATH);

/**
 * Mapper les composants React Web → React Native
 */
const componentMappings = {
  // Navigation
  'useNavigate': 'useNavigation',
  'navigate(': 'navigation.navigate(',
  
  // Styles
  'className=': 'style=',
  'hover:bg-gray-100': 'backgroundColor: theme.colors.surface',
  'text-white': 'color: "white"',
  'bg-blue-600': 'backgroundColor: theme.colors.primary',
  
  // Composants
  'div': 'View',
  'button': 'TouchableOpacity',
  'input': 'TextInput',
  'img': 'Image',
  'span': 'Text',
  'p': 'Text',
  'h1': 'Text',
  'h2': 'Text',
  'h3': 'Text',
  
  // Imports React Native
  'import React from "react"': 'import React from "react"',
  'from "react-router-dom"': 'from "@react-navigation/native"',
  'from "framer-motion"': '// Animation React Native',
  'from "react-toastify"': 'import { Alert } from "react-native"',
};

/**
 * Mapper les routes frontend → mobile
 */
const routeMappings = {
  '/': 'Home',
  '/login': 'Login',
  '/register': 'Register',
  '/dashboard': 'Dashboard',
  '/dashboard-prestataire': 'DashboardPrestataire',
  '/services-interagis': 'ServicesInteragis',
  '/mon-solde': 'SoldeDetail',
  '/recharge-tokens': 'RechargeTokens',
  '/formulaire-yukpo-intelligent': 'FormulaireYukpoIntelligent',
  '/recherche-besoin': 'RechercheBesoin',
  '/resultat-besoin': 'ResultatBesoin',
  '/mon-compte': 'Settings',
};

/**
 * Transformer un fichier React Web en React Native
 */
function transformFile(filePath, content) {
  console.log(`🔄 Transformation de : ${path.basename(filePath)}`);
  
  let transformedContent = content;
  
  // Appliquer les mappings de composants
  Object.entries(componentMappings).forEach(([web, native]) => {
    transformedContent = transformedContent.replace(new RegExp(web, 'g'), native);
  });
  
  // Transformer les routes
  Object.entries(routeMappings).forEach(([webRoute, mobileScreen]) => {
    transformedContent = transformedContent.replace(
      new RegExp(`'${webRoute}'`, 'g'), 
      `'${mobileScreen}'`
    );
    transformedContent = transformedContent.replace(
      new RegExp(`"${webRoute}"`, 'g'), 
      `"${mobileScreen}"`
    );
  });
  
  // Transformer les imports spécifiques
  transformedContent = transformedContent
    .replace(/import.*from ['"]@\/components\/layout\/AppLayout['"];/, '// AppLayout mobile équivalent')
    .replace(/import.*from ['"]@\/components\/intelligence\/ChatInputPanel['"];/, 'import ChatInputPanel from \'../components/ChatInputPanel\';')
    .replace(/import.*from ['"]@\/hooks\/useUser['"];/, 'import { useAuth } from \'../contexts/AuthContext\';')
    .replace(/import.*from ['"]@\/lib\/yukpoaclient['"];/, 'import { apiPost } from \'../services/api\';')
    .replace(/import.*from ['"]@\/types\/yukpoIaClient['"];/, 'import { MultiModalInput } from \'../types/yukpoIaClient\';');
  
  // Transformer les hooks
  transformedContent = transformedContent
    .replace(/const { user } = useUser\(\);/, 'const { user } = useAuth();')
    .replace(/const navigate = useNavigate\(\);/, 'const navigation = useNavigation();');
  
  // Transformer les appels de navigation
  transformedContent = transformedContent
    .replace(/navigate\((['"][^'"]*['"])/g, 'navigation.navigate($1 as never')
    .replace(/navigate\((['"][^'"]*['"]),\s*{\s*state:/g, 'navigation.navigate($1 as never, {');
  
  // Transformer les toasts
  transformedContent = transformedContent
    .replace(/toast\.error\((['"][^'"]*['"])\);/, 'Alert.alert(\'Erreur\', $1);')
    .replace(/toast\.success\((['"][^'"]*['"])\);/, 'Alert.alert(\'Succès\', $1);')
    .replace(/toast\.info\((['"][^'"]*['"])\);/, 'Alert.alert(\'Information\', $1);');
  
  // Transformer les classes CSS en styles React Native
  transformedContent = transformedContent
    .replace(/className="([^"]*)"/g, (match, className) => {
      // Convertir les classes Tailwind en styles React Native
      const styles = convertTailwindToReactNative(className);
      return `style={${styles}}`;
    });
  
  // Ajouter les imports React Native nécessaires
  const needsView = transformedContent.includes('<View') || transformedContent.includes('</View');
  const needsTouchableOpacity = transformedContent.includes('<TouchableOpacity') || transformedContent.includes('</TouchableOpacity');
  const needsTextInput = transformedContent.includes('<TextInput');
  const needsImage = transformedContent.includes('<Image');
  const needsAlert = transformedContent.includes('Alert.alert');
  
  let imports = 'import React from \'react\';\n';
  if (needsView || needsTouchableOpacity || needsTextInput || needsImage) {
    imports += 'import { View, TouchableOpacity, TextInput, Image, StyleSheet, Text } from \'react-native\';\n';
  }
  if (needsAlert) {
    imports += 'import { Alert } from \'react-native\';\n';
  }
  
  // Remplacer les imports existants
  const importRegex = /^import.*?from.*?;$/gm;
  const existingImports = transformedContent.match(importRegex) || [];
  const firstImportIndex = transformedContent.indexOf(existingImports[0] || '');
  
  if (firstImportIndex !== -1) {
    transformedContent = imports + transformedContent.substring(firstImportIndex);
  } else {
    transformedContent = imports + '\n' + transformedContent;
  }
  
  return transformedContent;
}

/**
 * Convertir les classes Tailwind en styles React Native
 */
function convertTailwindToReactNative(className) {
  const styles = [];
  const classArray = className.split(' ');
  
  classArray.forEach(cls => {
    switch (cls) {
      case 'flex': styles.push('flexDirection: \'row\''); break;
      case 'flex-col': styles.push('flexDirection: \'column\''); break;
      case 'items-center': styles.push('alignItems: \'center\''); break;
      case 'justify-center': styles.push('justifyContent: \'center\''); break;
      case 'p-4': styles.push('padding: 16'); break;
      case 'px-4': styles.push('paddingHorizontal: 16'); break;
      case 'py-4': styles.push('paddingVertical: 16'); break;
      case 'm-4': styles.push('margin: 16'); break;
      case 'mx-4': styles.push('marginHorizontal: 16'); break;
      case 'my-4': styles.push('marginVertical: 16'); break;
      case 'bg-blue-600': styles.push('backgroundColor: theme.colors.primary'); break;
      case 'text-white': styles.push('color: \'white\''); break;
      case 'text-center': styles.push('textAlign: \'center\''); break;
      case 'rounded': styles.push('borderRadius: 8'); break;
      case 'shadow': styles.push('elevation: 4'); break;
      // Ajouter plus de mappings selon les besoins
    }
  });
  
  return `{${styles.join(', ')}}`;
}

/**
 * Analyser la structure du frontend
 */
function analyzeFrontendStructure() {
  console.log('🔍 Analyse de la structure du frontend...');
  
  const pagesPath = path.join(FRONTEND_PATH, 'pages');
  const componentsPath = path.join(FRONTEND_PATH, 'components');
  
  if (fs.existsSync(pagesPath)) {
    const pages = fs.readdirSync(pagesPath);
    console.log('📄 Pages trouvées :', pages);
  }
  
  if (fs.existsSync(componentsPath)) {
    const components = fs.readdirSync(componentsPath);
    console.log('🧩 Composants trouvés :', components);
  }
}

/**
 * Fonction principale
 */
function main() {
  console.log('🚀 Démarrage de la transformation...');
  
  // Vérifier que le frontend existe
  if (!fs.existsSync(FRONTEND_PATH)) {
    console.error('❌ Dossier frontend non trouvé :', FRONTEND_PATH);
    process.exit(1);
  }
  
  // Analyser la structure
  analyzeFrontendStructure();
  
  console.log('✅ Script de transformation créé !');
  console.log('📝 Ce script peut maintenant être utilisé pour transformer les fichiers frontend en mobile');
  console.log('⚠️  Rappel : Le script NE MODIFIE JAMAIS le frontend, il lit seulement pour générer le mobile');
}

// Exécuter si appelé directement
if (require.main === module) {
  main();
}

module.exports = {
  transformFile,
  componentMappings,
  routeMappings,
  convertTailwindToReactNative
};


