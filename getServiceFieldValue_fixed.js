// CORRECTION APPLIQUÉE - Fonction getServiceFieldValue améliorée
const getServiceFieldValue = (field: any): string => {
  if (!field) return 'Non spécifié';
  
  // Cas 1: String simple (anciens services)
  if (typeof field === 'string') return field;
  
  // Cas 2: Objet complexe (nouveaux services) - CORRECTION IMPORTANTE
  if (field && typeof field === 'object') {
    if (field.valeur !== undefined) {
      const value = field.valeur;
      if (typeof value === 'string') return value;
      if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
      if (typeof value === 'number') return value.toString();
      if (Array.isArray(value)) return value.join(', ');
      return String(value);
    }
    
    // Essayer d'autres propriétés communes
    const possibleKeys = ['value', 'content', 'text', 'data', 'info', 'val'];
    for (const key of possibleKeys) {
      if (field[key] !== undefined) {
        const value = field[key];
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return value.toString();
        return String(value);
      }
    }
  }
  
  // Cas 3: Autres types
  if (typeof field === 'boolean') return field ? 'Oui' : 'Non';
  if (typeof field === 'number') return field.toString();
  
  return 'Non spécifié';
};
