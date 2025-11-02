// Composant de recherche intelligente pour les caractéristiques de produit
// Recherche dans les VECTEURS autocomplete_combinations avec priorisation AI
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Check, Sparkles, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { debounce } from 'lodash';
import { useAICombinations } from '@/hooks/useAICombinations';

interface CombinationResult {
  combination: {
    id: number;
    product_vector: string[];
    location_vector: string[];
    full_vector: string[];
    is_ai_preferred: boolean;
    ai_confidence: number;
    usage_count: number;
    variant_dimension?: string;
    variant_value?: string;
    prix?: number;
    devise?: string;
  };
  location_score: number;
  popularity_score: number;
  final_score: number;
}

interface IntelligentCharacteristicsSearchProps {
  value: string; // Valeur actuelle du champ (ex: "Nike,Air Max,Noir,42")
  onChange: (value: string) => void;
  sessionId?: string; // ID de session IA pour charger les combinaisons en cache
  label?: string;
  userLocation?: string; // Localisation utilisateur pour scoring géographique
  readonly?: boolean;
  separateur?: string;
  onCombinationsReady?: (combinations: any[]) => void; // Callback quand combinaisons chargées
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const IntelligentCharacteristicsSearch: React.FC<IntelligentCharacteristicsSearchProps> = ({
  value,
  onChange,
  sessionId,
  label = 'Caractéristiques du produit',
  userLocation,
  readonly = false,
  separateur = ',',
  onCombinationsReady,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CombinationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Utiliser le hook pour charger les combinaisons de la session IA
  const {
    combinations: sessionCombinations,
    preferredCombination,
    preferredVector,
    loading: loadingSession,
  } = useAICombinations(sessionId);

  // Notifier le parent quand les combinaisons sont prêtes
  useEffect(() => {
    if (sessionCombinations.length > 0 && onCombinationsReady) {
      onCombinationsReady(sessionCombinations);
    }
  }, [sessionCombinations, onCombinationsReady]);

  // Recherche vectorielle dans autocomplete_combinations
  const searchCombinations = async (query: string) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/autocomplete/search-combinations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          user_location: userLocation,
          limit: 20,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setSuggestions(data.data);
          console.log('[IntelligentSearch] 🔍 Résultats:', data.data.length);
        }
      }
    } catch (error) {
      console.error('[IntelligentSearch] ❌ Erreur recherche:', error);
    } finally {
      setLoading(false);
    }
  };

  // Debounce de la recherche
  const debouncedSearch = useCallback(
    debounce((query: string) => searchCombinations(query), 300),
    [userLocation]
  );

  // Gestion de la saisie
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    onChange(newValue);
    debouncedSearch(newValue);
    setShowDropdown(true);
    setSelectedIndex(-1);
  };

  // Sélectionner une suggestion
  const selectSuggestion = (combination: CombinationResult) => {
    const vectorString = combination.combination.product_vector.join(separateur);
    onChange(vectorString);
    setSearchQuery('');
    setShowDropdown(false);
    setSuggestions([]);
    inputRef.current?.blur();
  };

  // Gestion du clavier (flèches haut/bas, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allSuggestions = [...sessionCombinations, ...suggestions];
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, allSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      selectSuggestion(allSuggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setSelectedIndex(-1);
    }
  };

  // Fermer le dropdown si clic à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Transformer sessionCombinations en CombinationResult
  const sessionResults: CombinationResult[] = sessionCombinations.map(combo => ({
    combination: combo,
    location_score: 0,
    popularity_score: combo.usage_count / 100,
    final_score: combo.is_ai_preferred ? 1.0 : combo.usage_count / 100,
  }));

  // Filtrer les combinaisons de session selon la recherche (recherche VECTORIELLE)
  const filteredSessionResults = sessionResults.filter(s => {
    if (!searchQuery || searchQuery.length < 2) return true;
    
    const queryLower = searchQuery.toLowerCase();
    const queryTerms = queryLower.split(/[\s,]+/).filter(t => t.length > 0);
    
    // Rechercher dans le vecteur produit (chaque terme doit matcher au moins un élément du vecteur)
    return queryTerms.every(term =>
      s.combination.product_vector.some(vectorElem =>
        vectorElem.toLowerCase().includes(term)
      ) ||
      s.combination.full_vector.some(vectorElem =>
        vectorElem.toLowerCase().includes(term)
      )
    );
  });

  // Combiner : combinaisons de session (cache) en PREMIER, puis recherche globale
  const allSuggestions = [
    ...filteredSessionResults,
    ...suggestions.filter(s => 
      !sessionResults.some(sc => sc.combination.id === s.combination.id)
    ),
  ].slice(0, 15); // Limiter à 15 résultats

  // 🎯 Placeholder DYNAMIQUE basé sur la combinaison AI préférée
  // TOUJOURS afficher le choix de l'IA comme exemple pour orienter l'utilisateur
  const dynamicPlaceholder = preferredVector 
    ? `${preferredVector}` // Afficher directement le vecteur recommandé
    : 'Nike,Air Max,Noir,42'; // Fallback si pas de recommandation IA

  return (
    <div className="relative w-full">
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {label}
          {sessionCombinations.length > 0 && (
            <span className="ml-2 text-xs text-blue-600 font-normal">
              <Sparkles className="w-3 h-3 inline mr-1" />
              {sessionCombinations.length} suggestion{sessionCombinations.length > 1 ? 's' : ''} IA disponible{sessionCombinations.length > 1 ? 's' : ''}
            </span>
          )}
          {preferredCombination && (
            <span className="ml-2 text-xs text-amber-600 font-normal">
              <Check className="w-3 h-3 inline mr-1" />
              IA recommande : {preferredVector}
            </span>
          )}
        </label>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        
        <Input
          ref={inputRef}
          type="text"
          value={value || searchQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setShowDropdown(true);
            if (!searchQuery && sessionCombinations.length > 0) {
              // Afficher les suggestions de session au focus
              setSuggestions([]);
            }
          }}
          placeholder={dynamicPlaceholder}
          disabled={readonly}
          className="pl-10 pr-10"
        />

        {value && !readonly && (
          <button
            onClick={() => {
              onChange('');
              setSearchQuery('');
              setSuggestions([]);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {loading && (
          <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown des suggestions */}
      {showDropdown && allSuggestions.length > 0 && !readonly && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto"
        >
          {/* En-tête si suggestions de session */}
          {sessionCombinations.length > 0 && (
            <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 text-xs font-semibold text-blue-700 flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              Suggestions IA pour votre produit
            </div>
          )}

          {allSuggestions.map((result, index) => {
            const { combination } = result;
            const isFromSession = sessionCombinations.some(s => s.combination.id === combination.id);
            const isSelected = index === selectedIndex;
            const vectorDisplay = combination.product_vector.join(separateur);

            return (
              <button
                key={combination.id}
                onClick={() => selectSuggestion(result)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                  isSelected ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Vecteur produit */}
                    <div className="font-medium text-gray-900 text-sm truncate">
                      {vectorDisplay}
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {combination.is_ai_preferred && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 text-xs font-semibold rounded-full">
                          <Sparkles className="w-3 h-3" />
                          Recommandé par l'IA
                        </span>
                      )}
                      
                      {isFromSession && !combination.is_ai_preferred && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          Suggestion IA
                        </span>
                      )}

                      {combination.usage_count > 1 && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          Populaire ({combination.usage_count})
                        </span>
                      )}

                      {combination.variant_dimension && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                          {combination.variant_dimension}: {combination.variant_value}
                        </span>
                      )}

                      {combination.prix && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                          {combination.prix} {combination.devise || 'XAF'}
                        </span>
                      )}
                    </div>

                    {/* Localisation si présente */}
                    {combination.location_vector.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        📍 {combination.location_vector.join(' › ')}
                      </div>
                    )}
                  </div>

                  {/* Indicateur de sélection */}
                  {isSelected && (
                    <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  )}
                </div>

                {/* Barre de score de pertinence */}
                {result.final_score > 0 && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(result.final_score * 100, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Pertinence: {Math.round(result.final_score * 100)}%
                    </div>
                  </div>
                )}
              </button>
            );
          })}

          {/* Message si aucune suggestion */}
          {allSuggestions.length === 0 && searchQuery.length >= 2 && !loading && (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">
              Aucune suggestion trouvée pour "{searchQuery}"
              <div className="text-xs text-gray-400 mt-1">
                Continuez à saisir ou créez une nouvelle combinaison
              </div>
            </div>
          )}
        </div>
      )}

      {/* Aide contextuelle avec info sur la préférence AI */}
      <div className="mt-2 space-y-1">
        {/* Message d'aide principal */}
        <div className="text-xs text-gray-600 flex items-start gap-2">
          <Info className="w-3 h-3 flex-shrink-0 mt-0.5 text-blue-500" />
          <span>
            L'exemple ci-dessus <strong className="text-blue-600">({dynamicPlaceholder})</strong> est la combinaison recommandée par l'IA. 
            Vous pouvez la sélectionner, la modifier, ou en choisir une autre en tapant dans le champ.
          </span>
        </div>
        
        {/* Encadré avec la recommandation IA si disponible */}
        {preferredCombination && (
          <div className="text-xs bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-lg px-3 py-2 flex items-start gap-2">
            <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
            <div>
              <div className="font-semibold text-amber-900 mb-1">
                🎯 Choix IA recommandé (basé sur votre demande)
              </div>
              <div className="text-amber-800 font-mono bg-white px-2 py-1 rounded border border-amber-200">
                {preferredVector}
              </div>
              <div className="text-amber-700 mt-1 italic">
                Confiance IA : {Math.round((preferredCombination.ai_confidence || 0) * 100)}%
                {' · '}
                {sessionCombinations.length - 1} autre{sessionCombinations.length > 2 ? 's' : ''} option{sessionCombinations.length > 2 ? 's' : ''} disponible{sessionCombinations.length > 2 ? 's' : ''}
              </div>
            </div>
          </div>
        )}
        
        {/* Instructions si pas de valeur saisie */}
        {!value && (
          <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
            💡 <strong>Comment utiliser :</strong> Cliquez dans le champ pour voir toutes les suggestions, 
            ou commencez à taper (ex: "Nike", "Adidas", "noir", "42") pour rechercher dans les vecteurs.
          </div>
        )}
      </div>

      {/* Affichage de la valeur actuelle (analysée) */}
      {value && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-xs font-semibold text-gray-700 mb-2">
            Caractéristiques sélectionnées :
          </div>
          <div className="flex flex-wrap gap-1.5">
            {value.split(separateur).filter(v => v.trim()).map((characteristic, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700"
              >
                {characteristic.trim()}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default IntelligentCharacteristicsSearch;

