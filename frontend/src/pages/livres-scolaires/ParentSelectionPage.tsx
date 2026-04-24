import {
  ArrowLeft, BookOpen, Camera, CheckSquare, ChevronRight,
  Layers, Minus, Plus, ShoppingCart,
  Trash2, User
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../../hooks/use-toast';
import {
  CLASSES_PAR_SYSTEME_NIVEAU, NIVEAUX_PAR_SYSTEME,
  Enfant, PanierItem, Systeme, TypeItem,
  useParentShop
} from '../../hooks/useParentShop';
import { apiGet } from '../../services/apiService';

const TYPE_LABELS: Record<TypeItem, string> = {
  livre: 'Livres',
  cahier: 'Cahiers',
  fourniture: 'Fournitures',
  autre: 'Autres',
};

const TYPE_COLORS: Record<TypeItem, string> = {
  livre: 'text-blue-700 bg-blue-50 border-blue-200',
  cahier: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  fourniture: 'text-purple-700 bg-purple-50 border-purple-200',
  autre: 'text-gray-700 bg-gray-50 border-gray-200',
};

interface ProgrammeItem {
  id?: number;
  titre: string;
  auteur?: string;
  matiere?: string;
  editeur?: string;
  isbn?: string;
  type: TypeItem;
  prix_neuf?: number;
  prix_occasion?: number;
}

/* ─── Formulaire ajout/édition enfant inline ─── */
function AddEnfantForm({
  onAdd,
}: {
  onAdd: (prenom: string, systeme: Systeme, niveau: string, classe: string) => void;
}) {
  const [systeme, setSysteme] = useState<Systeme>('francophone');
  const [niveau, setNiveau] = useState('Collège / Lycée');
  const [classe, setClasse] = useState('');

  const niveaux = NIVEAUX_PAR_SYSTEME[systeme];
  const classes = CLASSES_PAR_SYSTEME_NIVEAU[systeme][niveau] ?? [];

  const handleSystemeChange = (s: Systeme) => {
    setSysteme(s);
    const def = NIVEAUX_PAR_SYSTEME[s][2] ?? NIVEAUX_PAR_SYSTEME[s][1] ?? NIVEAUX_PAR_SYSTEME[s][0];
    setNiveau(def);
    setClasse('');
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
      <p className="text-sm font-semibold text-amber-800 mb-3">Nouvelle classe</p>

      {/* Système */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {(['francophone', 'anglophone'] as Systeme[]).map(s => (
          <button
            key={s}
            onClick={() => handleSystemeChange(s)}
            className={`py-2 rounded-xl text-xs font-semibold border ${
              systeme === s ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {s === 'francophone' ? '🇫🇷 Francophone' : '🇬🇧 Anglophone'}
          </button>
        ))}
      </div>

      {/* Niveau */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {niveaux.map(n => (
          <button
            key={n}
            onClick={() => { setNiveau(n); setClasse(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              niveau === n ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Classe */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {classes.map(c => (
          <button
            key={c}
            onClick={() => setClasse(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
              classe === c ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <button
        disabled={!classe}
        onClick={() => {
          if (classe) {
            onAdd(classe, systeme, niveau, classe);
            setClasse('');
          }
        }}
        className="w-full bg-amber-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-2.5 rounded-xl text-sm"
      >
        Voir les manuels
      </button>
    </div>
  );
}

/* ─── Item ligne (manuel) ─── */
function ManuelRow({
  item,
  enfantId,
  isSelected,
  onToggle,
}: {
  item: ProgrammeItem;
  enfantId: string;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-colors text-left ${
        isSelected
          ? 'bg-amber-50 border-amber-300'
          : 'bg-white border-gray-100'
      }`}
    >
      <div className={`w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center shrink-0 ${
        isSelected ? 'bg-amber-500 border-amber-500' : 'border-gray-300'
      }`}>
        {isSelected && <span className="text-white text-xs font-bold">✓</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-tight ${isSelected ? 'text-amber-900' : 'text-gray-800'}`}>
          {item.titre}
        </p>
        {item.auteur && <p className="text-xs text-gray-500 mt-0.5">{item.auteur}</p>}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {item.matiere && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.matiere}</span>
          )}
          {item.editeur && (
            <span className="text-xs text-gray-400">{item.editeur}</span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        {item.prix_neuf && (
          <p className="text-xs text-green-700 font-semibold">Neuf: {item.prix_neuf.toLocaleString()} F</p>
        )}
        {item.prix_occasion && (
          <p className="text-xs text-orange-600 font-semibold">Occ: {item.prix_occasion.toLocaleString()} F</p>
        )}
      </div>
    </button>
  );
}

/* ─── Page principale ─── */
const ParentSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const {
    enfants, addEnfant, removeEnfant,
    toggleItem, isInPanier, getItemsForEnfant, countByEnfant,
    clearPanierForEnfant, totalItems,
  } = useParentShop();

  const initEnfantId = searchParams.get('enfantId');
  const [activeEnfantId, setActiveEnfantId] = useState<string>(
    initEnfantId || enfants[0]?.id || ''
  );
  const [showAddForm, setShowAddForm] = useState(enfants.length === 0);
  const [programme, setProgramme] = useState<ProgrammeItem[]>([]);
  const [loadingProg, setLoadingProg] = useState(false);
  const [activeType, setActiveType] = useState<TypeItem | 'tous'>('tous');

  const activeEnfant = enfants.find(e => e.id === activeEnfantId);

  const loadProgramme = useCallback(async (classe: string) => {
    setLoadingProg(true);
    setProgramme([]);
    try {
      const params = new URLSearchParams({ classe });
      const res = await fetch(`/api/bourse-livre/v2/programmes?${params}`);
      const data = await res.json();
      const items: ProgrammeItem[] = (data?.programmes || []).map((m: any) => ({
        id: m.id,
        titre: m.titre_livre || m.titre || 'Manuel',
        auteur: m.auteur_livre || m.auteur,
        matiere: m.matiere,
        editeur: m.editeur_livre || m.editeur,
        isbn: m.isbn_livre || m.isbn,
        type: 'livre' as TypeItem,
        prix_neuf: m.prix_officiel ? parseFloat(m.prix_officiel) : undefined,
      }));
      setProgramme(items);
    } catch {
      // Pas de programme en base → liste vide
    } finally {
      setLoadingProg(false);
    }
  }, []);

  useEffect(() => {
    if (activeEnfant) loadProgramme(activeEnfant.classe);
  }, [activeEnfant?.classe]);

  useEffect(() => {
    if (!activeEnfantId && enfants.length > 0) setActiveEnfantId(enfants[0].id);
  }, [enfants]);

  const displayedItems = activeType === 'tous'
    ? programme
    : programme.filter(p => p.type === activeType);

  const selectedCount = activeEnfant ? countByEnfant(activeEnfant.id) : 0;
  const selectedItems = activeEnfant ? getItemsForEnfant(activeEnfant.id) : [];

  const selectAll = () => {
    if (!activeEnfant) return;
    displayedItems.forEach(item => {
      if (!isInPanier(activeEnfant.id, item.titre)) {
        toggleItem({
          enfantId: activeEnfant.id,
          titre: item.titre,
          auteur: item.auteur,
          matiere: item.matiere,
          type: item.type,
          editeur: item.editeur,
          isbn: item.isbn,
          prixNeuf: item.prix_neuf,
          prixOccasion: item.prix_occasion,
          choix: 'indifferent',
        });
      }
    });
  };

  const deselectAll = () => {
    if (!activeEnfant) return;
    clearPanierForEnfant(activeEnfant.id);
  };

  const allSelected = displayedItems.length > 0 && displayedItems.every(item =>
    activeEnfant ? isInPanier(activeEnfant.id, item.titre) : false
  );

  const typeGroups = (['livre', 'cahier', 'fourniture', 'autre'] as TypeItem[]).filter(
    t => programme.some(p => p.type === t)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-amber-600 px-4 pt-10 pb-4 text-white">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/livres-scolaires')} className="p-2 rounded-full bg-white/20">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg leading-tight">Achats scolaires</h1>
            <p className="text-amber-100 text-xs">Sélectionnez les manuels à acheter</p>
          </div>
          {totalItems > 0 && (
            <button
              onClick={() => navigate('/recap')}
              className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full"
            >
              <ShoppingCart className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-bold">{totalItems}</span>
            </button>
          )}
        </div>

        {/* Tabs enfants */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {enfants.map(enfant => {
            const count = countByEnfant(enfant.id);
            const isActive = enfant.id === activeEnfantId;
            return (
              <button
                key={enfant.id}
                onClick={() => { setActiveEnfantId(enfant.id); setShowAddForm(false); }}
                className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                  isActive
                    ? 'bg-white text-amber-700 border-white'
                    : 'bg-white/20 text-white border-white/30'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-amber-200/50 flex items-center justify-center text-xs font-bold">
                  {enfant.classe[0]}
                </span>
                {enfant.classe}
                {count > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-amber-500 text-white' : 'bg-white/30 text-white'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          <button
            onClick={() => setShowAddForm(v => !v)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/20 text-white border border-white/30 text-sm font-semibold"
          >
            <Plus className="w-4 h-4" /> Classe
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-32">
        {/* Formulaire ajout enfant */}
        {showAddForm && (
          <div className="mb-4">
            <AddEnfantForm
              onAdd={(prenom, systeme, niveau, classe) => {
                const e = addEnfant({ prenom, systeme, niveau, classe });
                setActiveEnfantId(e.id);
                setShowAddForm(false);
              }}
            />
          </div>
        )}

        {!activeEnfant && !showAddForm && (
          <div className="flex flex-col items-center py-16 text-center">
            <User className="w-12 h-12 text-gray-200 mb-3" />
            <p className="text-gray-500 text-sm">Sélectionnez une classe pour voir les manuels</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 bg-amber-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
            >
              + Choisir une classe
            </button>
          </div>
        )}

        {activeEnfant && (
          <>
            {/* Info classe + actions */}
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <span className="text-amber-700 font-bold">{activeEnfant.classe[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{activeEnfant.classe}</p>
                <p className="text-xs text-gray-500">
                  {activeEnfant.niveau}
                  {activeEnfant.etablissementNom && <> · {activeEnfant.etablissementNom}</>}
                </p>
              </div>
              <button
                onClick={() => navigate(`/scan-programme?enfantId=${activeEnfant.id}`)}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-semibold text-indigo-700"
              >
                <Camera className="w-3.5 h-3.5" /> Scanner
              </button>
              <button
                onClick={() => removeEnfant(activeEnfant.id)}
                className="p-2 rounded-xl bg-red-50"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>

            {/* Filtres par type */}
            {typeGroups.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-3">
                <button
                  onClick={() => setActiveType('tous')}
                  className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold border ${
                    activeType === 'tous'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  Tous ({programme.length})
                </button>
                {typeGroups.map(t => (
                  <button
                    key={t}
                    onClick={() => setActiveType(t)}
                    className={`shrink-0 flex items-center gap-1 px-4 py-2 rounded-full text-xs font-semibold border ${
                      activeType === t
                        ? 'bg-amber-500 text-white border-amber-500'
                        : `bg-white border-gray-200 ${TYPE_COLORS[t].split(' ')[0]}`
                    }`}
                  >
                    {TYPE_LABELS[t]} ({programme.filter(p => p.type === t).length})
                  </button>
                ))}
              </div>
            )}

            {/* Header liste + tout sélectionner */}
            {programme.length > 0 && (
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 font-medium">
                  {displayedItems.length} manuel{displayedItems.length > 1 ? 'x' : ''} · {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
                </p>
                <button
                  onClick={allSelected ? deselectAll : selectAll}
                  className="flex items-center gap-1 text-xs font-semibold text-amber-600"
                >
                  {allSelected ? <Minus className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
                  {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              </div>
            )}

            {/* Liste des manuels */}
            {loadingProg ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : displayedItems.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center bg-white rounded-2xl border border-gray-100">
                <Layers className="w-10 h-10 text-gray-200 mb-2" />
                <p className="text-gray-500 text-sm font-medium">Aucun programme trouvé</p>
                <p className="text-gray-400 text-xs mt-1 mb-4">
                  Scannez la liste de classe pour l'importer
                </p>
                <button
                  onClick={() => navigate(`/scan-programme?enfantId=${activeEnfant.id}`)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-semibold"
                >
                  <Camera className="w-4 h-4" /> Scanner la liste de classe
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {displayedItems.map((item, i) => (
                  <ManuelRow
                    key={item.id ?? i}
                    item={item}
                    enfantId={activeEnfant.id}
                    isSelected={isInPanier(activeEnfant.id, item.titre)}
                    onToggle={() =>
                      toggleItem({
                        enfantId: activeEnfant.id,
                        titre: item.titre,
                        auteur: item.auteur,
                        matiere: item.matiere,
                        type: item.type,
                        editeur: item.editeur,
                        isbn: item.isbn,
                        prixNeuf: item.prix_neuf,
                        prixOccasion: item.prix_occasion,
                        choix: 'indifferent',
                      })
                    }
                  />
                ))}
              </div>
            )}

            {/* Section sélection manuelle si programme vide */}
            {programme.length === 0 && !loadingProg && (
              <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Ajouter manuellement</p>
                <ManuelAddManual enfantId={activeEnfant.id} onAdd={(item) => toggleItem({ ...item, enfantId: activeEnfant.id })} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom bar sticky */}
      {totalItems > 0 && (
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-2 z-40">
          <div className="bg-amber-600 rounded-2xl px-5 py-4 shadow-2xl flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">
                {totalItems} article{totalItems > 1 ? 's' : ''} sélectionné{totalItems > 1 ? 's' : ''}
              </p>
              <p className="text-amber-200 text-xs">
                {enfants.filter(e => countByEnfant(e.id) > 0).map(e => `${e.classe} (${countByEnfant(e.id)})`).join(' · ')}
              </p>
            </div>
            <button
              onClick={() => navigate('/recap')}
              className="flex items-center gap-2 bg-white text-amber-700 font-bold px-4 py-2.5 rounded-xl text-sm shrink-0"
            >
              Récapitulatif <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Ajout manuel d'un article ─── */
function ManuelAddManual({
  enfantId,
  onAdd,
}: {
  enfantId: string;
  onAdd: (item: Omit<PanierItem, 'id' | 'enfantId'>) => void;
}) {
  const [titre, setTitre] = useState('');
  const [matiere, setMatiere] = useState('');
  const [type, setType] = useState<TypeItem>('livre');

  return (
    <div className="space-y-2">
      <input
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400"
        placeholder="Titre du manuel"
        value={titre}
        onChange={e => setTitre(e.target.value)}
      />
      <div className="flex gap-2">
        <input
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400"
          placeholder="Matière (optionnel)"
          value={matiere}
          onChange={e => setMatiere(e.target.value)}
        />
        <select
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400"
          value={type}
          onChange={e => setType(e.target.value as TypeItem)}
        >
          {(['livre', 'cahier', 'fourniture', 'autre'] as TypeItem[]).map(t => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>
      <button
        disabled={!titre.trim()}
        onClick={() => {
          if (!titre.trim()) return;
          onAdd({ titre: titre.trim(), matiere: matiere || undefined, type, choix: 'indifferent' });
          setTitre('');
          setMatiere('');
        }}
        className="w-full bg-amber-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-2.5 rounded-xl text-sm"
      >
        + Ajouter
      </button>
    </div>
  );
}

export default ParentSelectionPage;
