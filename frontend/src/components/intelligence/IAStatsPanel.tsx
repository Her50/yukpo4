import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip } from '@/components/ui/tooltip';
import { useUser } from '@/hooks/useUser';
import { Brain, Zap, TrendingUp, Activity, Sparkles, Bot, ChevronDown, ChevronUp } from 'lucide-react';

interface IAStatsProps {
  confidence?: number;
  tokensUsed?: number; // Tokens OpenAI réels
  tokensFactured?: number; // Tokens facturés par l'application
  isProcessing?: boolean;
  inputLength?: number;
  miniMode?: boolean;
  tokensCostXaf?: number; // Coût facturé en XAF
}

const IAStatsPanel: React.FC<IAStatsProps> = ({ 
  confidence = 0, 
  tokensUsed = 0, // Tokens OpenAI réels
  tokensFactured = 0, // Tokens facturés par l'application
  isProcessing = false,
  inputLength = 0,
  miniMode = false,
  tokensCostXaf
}) => {
  const { user } = useUser();
  const [animatedConfidence, setAnimatedConfidence] = useState(0);
  const [animatedTokens, setAnimatedTokens] = useState(0);
  const [complexity, setComplexity] = useState('simple');
  const [isExpanded, setIsExpanded] = useState(false);

  // Animation pour la confiance
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedConfidence(confidence);
    }, 100);
    return () => clearTimeout(timer);
  }, [confidence]);

  // Animation pour les tokens
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedTokens(tokensUsed);
    }, 200);
    return () => clearTimeout(timer);
  }, [tokensUsed]);

  // Calcul de la complexité basé sur la longueur de l'input
  useEffect(() => {
    if (inputLength < 50) {
      setComplexity('simple');
    } else if (inputLength < 200) {
      setComplexity('modérée');
    } else {
      setComplexity('complexe');
    }
  }, [inputLength]);

  const getComplexityColor = () => {
    switch (complexity) {
      case 'simple': return 'text-green-500';
      case 'modérée': return 'text-yellow-500';
      case 'complexe': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getConfidenceColor = () => {
    if (animatedConfidence >= 80) return 'from-green-400 to-green-600';
    if (animatedConfidence >= 50) return 'from-yellow-400 to-yellow-600';
    return 'from-red-400 to-red-600';
  };

  // Calcul du coût en XAF
  let cout: number | string = '';
  if (typeof tokensCostXaf === 'number') {
    cout = tokensCostXaf;
  } else if (tokensCostXaf === 0) {
    cout = 0;
  } else {
    cout = '';
  }

  // Version miniaturisée
  if (miniMode) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="inline-block"
      >
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-md border border-gray-200/50 dark:border-gray-700/50 p-1 min-w-[220px] max-w-[320px] h-[38px] flex items-center">
          <motion.div 
            className="p-2 cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-2 text-xs whitespace-nowrap overflow-hidden text-ellipsis w-full" style={{minWidth: 0}}>
              <div className="relative flex-shrink-0">
                <Brain className="w-4 h-4 text-primary" />
                {isProcessing && (
                  <motion.div
                    className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  />
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-gray-500">Confiance:</span>
                <span className="font-medium">{animatedConfidence}%</span>
              </div>
              <div className="text-gray-400 flex-shrink-0">•</div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-gray-500">Tokens:</span>
                <span className="font-medium">{tokensUsed}</span>
                {tokensFactured > 0 && tokensFactured < tokensUsed && (
                  <span className="text-green-600 text-[10px]">(-{tokensUsed - tokensFactured})</span>
                )}
                <Zap className="w-3 h-3 text-yellow-500" />
              </div>
              <div className="text-gray-400 flex-shrink-0">•</div>
              <div className="flex items-center gap-1 flex-shrink-0 max-w-[110px] overflow-hidden text-ellipsis whitespace-nowrap">
                <span className="text-gray-500">Coût:</span>
                <span className="font-medium">
                  {cout !== '' ? (<>{cout} <span className="text-red-600">XAF</span></>) : <span className="text-gray-400">—</span>}
                </span>
              </div>
            </div>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </motion.div>
          </motion.div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-2 pb-2 pt-0 space-y-1.5 border-t border-gray-200 dark:border-gray-700">
                  <div className="mt-1.5">
                    <div className="text-xs text-gray-500 mb-0.5">Confiance</div>
                    <div className="relative h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <motion.div
                        className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getConfidenceColor()}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${animatedConfidence}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Complexité:</span>
                    <span className={`text-xs font-medium ${getComplexityColor()}`}>
                      {complexity}
                    </span>
                  </div>

                  {/* Solde utilisateur */}
                  {user?.credits !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Solde:</span>
                      <span className="text-xs font-medium text-primary">
                        {user.credits.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  // Version complète (existante)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          Statistiques IA
        </h3>
        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-green-500">
            <Bot className="w-4 h-4 animate-pulse" />
            <span>Traitement en cours...</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Niveau de confiance */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Niveau de confiance</span>
            <span className="text-sm font-semibold">{animatedConfidence}%</span>
          </div>
          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getConfidenceColor()}`}
              initial={{ width: 0 }}
              animate={{ width: `${animatedConfidence}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Tokens utilisés */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <Zap className="w-4 h-4" />
              Tokens utilisés
            </span>
            <span className="text-sm font-semibold">{animatedTokens}</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-gray-500">
              {user?.credits !== undefined ? `Solde: ${user.credits.toLocaleString()}` : 'Chargement...'}
            </span>
          </div>
        </div>

        {/* Complexité de la requête */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              Complexité
            </span>
            <span className={`text-sm font-semibold ${getComplexityColor()}`}>
              {complexity}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            Basé sur {inputLength} caractères
          </div>
        </div>
      </div>

      {/* Indicateur de performance */}
      <motion.div 
        className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Performance optimale</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <motion.div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i <= Math.ceil(animatedConfidence / 20) 
                    ? 'bg-green-500' 
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1 }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default IAStatsPanel;