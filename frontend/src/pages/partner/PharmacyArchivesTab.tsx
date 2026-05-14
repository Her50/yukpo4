// Tab "Archives" du dashboard pharmacien : scan d'ordonnance reçue + archivage
// + recherche par nom patient.
//
// Workflow :
//   1. Le pharmacien scanne l'ordonnance reçue (caméra ou import)
//   2. L'IA (POST /api/pharmacies/ai/extract-ordonnance) extrait :
//        - liste des médicaments
//        - patient_name, doctor_name, hospital, city (metadata)
//   3. Pré-remplissage du formulaire d'archivage (éditable)
//   4. Submit → POST /api/pharmacies/me/prescriptions/archive
//   5. Plus tard : recherche par nom patient pour retrouver l'archive

import { Calendar, Camera, ChevronDown, ChevronUp, FileText, Loader2, MapPin, Phone, Save, Search, Stethoscope, Trash2, User, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPost } from '@/services/apiService';
import { apiDelete } from '@/services/apiService';

interface ExtractedMedication {
  name: string;
  dosage?: string;
  quantity?: number;
  posologie?: string;
}

interface ExtractedMetadata {
  patient_name?: string;
  doctor_name?: string;
  hospital?: string;
  city?: string;
  prescription_date?: string;
}

interface ArchiveListItem {
  id: number;
  pharmacy_id: number;
  pharmacy_name: string;
  patient_name: string;
  patient_phone?: string;
  patient_notes?: string;
  prescription_date?: string;
  scanned_at: string;
  extracted_medications?: any;
}

interface MyPharmacy {
  id: number;
  nom: string;
}

const PharmacyArchivesTab: React.FC<{ pharmacies: MyPharmacy[] }> = ({ pharmacies }) => {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);

  // Recherche
  const [searchQ, setSearchQ] = useState('');
  const [archives, setArchives] = useState<ArchiveListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Scan + nouveau archivage
  const [analyzing, setAnalyzing] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftPharmacy, setDraftPharmacy] = useState<number | null>(pharmacies[0]?.id ?? null);
  const [draftImage, setDraftImage] = useState<string | null>(null);
  const [draftMime, setDraftMime] = useState<string | null>(null);
  const [draftPatient, setDraftPatient] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [draftDoctor, setDraftDoctor] = useState('');
  const [draftHospital, setDraftHospital] = useState('');
  const [draftCity, setDraftCity] = useState('');
  const [draftDate, setDraftDate] = useState('');
  const [draftMeds, setDraftMeds] = useState<ExtractedMedication[]>([]);
  const [draftNotes, setDraftNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Recherche debounced
  const loadArchives = useCallback(async (q = '') => {
    setSearching(true);
    try {
      const url = `/api/pharmacies/me/prescriptions/search${q ? `?q=${encodeURIComponent(q)}` : ''}`;
      const res = await apiGet(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setArchives(Array.isArray(data?.archives) ? data.archives : []);
    } catch {
      setArchives([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => loadArchives(searchQ), 400);
    return () => clearTimeout(handle);
  }, [searchQ, loadArchives]);

  const resetDraft = () => {
    setDraftImage(null);
    setDraftMime(null);
    setDraftPatient('');
    setDraftPhone('');
    setDraftDoctor('');
    setDraftHospital('');
    setDraftCity('');
    setDraftDate('');
    setDraftMeds([]);
    setDraftNotes('');
  };

  const handleScan = async (file: File) => {
    setAnalyzing(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      setDraftImage(base64);
      setDraftMime(file.type || 'image/jpeg');

      const res = await apiPost('/api/pharmacies/ai/extract-ordonnance', {
        image_base64: base64,
      });
      if (res.ok) {
        const data = await res.json();
        const meta: ExtractedMetadata = data?.metadata || {};
        setDraftPatient(meta.patient_name || '');
        setDraftDoctor(meta.doctor_name || '');
        setDraftHospital(meta.hospital || '');
        setDraftCity(meta.city || '');
        setDraftDate(meta.prescription_date || '');
        setDraftMeds(Array.isArray(data?.medications) ? data.medications : []);
      }
      setDraftOpen(true);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!draftPharmacy || !draftPatient.trim()) return;
    setSaving(true);
    try {
      const res = await apiPost('/api/pharmacies/me/prescriptions/archive', {
        pharmacy_id: draftPharmacy,
        patient_name: draftPatient.trim(),
        patient_phone: draftPhone.trim() || undefined,
        patient_notes: draftNotes.trim() || undefined,
        image_base64: draftImage,
        image_mime: draftMime,
        extracted_medications: draftMeds,
        prescription_date: draftDate || undefined,
        doctor_name: draftDoctor.trim() || undefined,
        hospital: draftHospital.trim() || undefined,
        city: draftCity.trim() || undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDraftOpen(false);
      resetDraft();
      loadArchives(searchQ);
    } catch {
      /* erreur déjà loguée par apiPost */
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette archive ?')) return;
    try {
      const res = await apiDelete(`/api/pharmacies/me/prescriptions/${id}`);
      if (res.ok) loadArchives(searchQ);
    } catch { /* */ }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-800 inline-flex items-center gap-2">
        <FileText className="w-4 h-4 text-blue-600" />
        Archives d'ordonnances
      </h2>

      {/* Scan rapide */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
        <p className="text-xs text-gray-700 mb-3">
          Scannez une ordonnance reçue. L'IA extrait automatiquement le nom du
          patient, du médecin, l'hôpital et les médicaments.
        </p>
        <label
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold cursor-pointer ${
            analyzing ? 'opacity-60 pointer-events-none' : ''
          }`}
        >
          {analyzing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
          Scanner une ordonnance
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleScan(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder="Rechercher par nom du patient…"
          className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        />
      </div>

      {/* Liste archives */}
      {searching ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        </div>
      ) : archives.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm">
            {searchQ ? 'Aucune archive trouvée pour cette recherche' : 'Aucune ordonnance archivée'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {archives.map(a => {
            const meds = Array.isArray(a.extracted_medications?.medications)
              ? a.extracted_medications.medications
              : Array.isArray(a.extracted_medications)
                ? a.extracted_medications
                : [];
            const meta = a.extracted_medications?.medications ? a.extracted_medications : null;
            const isOpen = expanded === a.id;
            return (
              <div
                key={a.id}
                className="rounded-xl border border-gray-100 bg-white overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : a.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {a.patient_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {a.prescription_date && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {a.prescription_date}
                        </span>
                      )}
                      {a.patient_phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {a.patient_phone}
                        </span>
                      )}
                      {meds.length > 0 && (
                        <span className="text-gray-600">{meds.length} médicament(s)</span>
                      )}
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-2">
                    {meta && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        {meta.doctor_name && (
                          <div className="flex items-center gap-1">
                            <Stethoscope className="w-3 h-3 text-gray-400" />
                            <span className="text-gray-700">{meta.doctor_name}</span>
                          </div>
                        )}
                        {meta.hospital && (
                          <div className="text-gray-700 truncate">{meta.hospital}</div>
                        )}
                        {meta.city && (
                          <div className="inline-flex items-center gap-1 text-gray-600">
                            <MapPin className="w-3 h-3" />
                            {meta.city}
                          </div>
                        )}
                      </div>
                    )}

                    {meds.length > 0 && (
                      <div className="border-t border-dashed border-gray-100 pt-2">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Médicaments
                        </p>
                        <ul className="text-xs space-y-0.5">
                          {meds.map((m: any, i: number) => (
                            <li key={i} className="text-gray-700">
                              • {m.name}
                              {m.dosage && <span className="text-gray-500"> · {m.dosage}</span>}
                              {m.posologie && (
                                <span className="text-gray-400 italic"> — {m.posologie}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {a.patient_notes && (
                      <p className="text-xs text-gray-600 italic">{a.patient_notes}</p>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="text-xs text-red-600 hover:text-red-700 inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Supprimer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nouveau archivage (post-scan) */}
      {draftOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center p-0 sm:p-4"
          onClick={() => setDraftOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pt-3 pb-3 border-b border-gray-100">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2 sm:hidden" />
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900">Archiver l'ordonnance</h3>
                <button onClick={() => setDraftOpen(false)} className="text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Les champs ont été pré-remplis par l'IA. Vérifiez et corrigez si besoin.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {pharmacies.length > 1 && (
                <Field label="Pharmacie">
                  <select
                    value={draftPharmacy ?? ''}
                    onChange={e => setDraftPharmacy(parseInt(e.target.value, 10))}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    {pharmacies.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nom}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Nom du patient" required>
                <input
                  type="text"
                  value={draftPatient}
                  onChange={e => setDraftPatient(e.target.value)}
                  className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </Field>
              <Field label="Téléphone (optionnel)">
                <input
                  type="tel"
                  value={draftPhone}
                  onChange={e => setDraftPhone(e.target.value)}
                  className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Médecin">
                  <input
                    type="text"
                    value={draftDoctor}
                    onChange={e => setDraftDoctor(e.target.value)}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </Field>
                <Field label="Date">
                  <input
                    type="date"
                    value={draftDate}
                    onChange={e => setDraftDate(e.target.value)}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Hôpital / Clinique">
                  <input
                    type="text"
                    value={draftHospital}
                    onChange={e => setDraftHospital(e.target.value)}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </Field>
                <Field label="Ville">
                  <input
                    type="text"
                    value={draftCity}
                    onChange={e => setDraftCity(e.target.value)}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </Field>
              </div>

              {draftMeds.length > 0 && (
                <Field label={`Médicaments (${draftMeds.length})`}>
                  <ul className="text-xs space-y-1 bg-gray-50 rounded-lg p-2">
                    {draftMeds.map((m, i) => (
                      <li key={i} className="text-gray-700">
                        • {m.name}
                        {m.dosage && <span className="text-gray-500"> · {m.dosage}</span>}
                      </li>
                    ))}
                  </ul>
                </Field>
              )}

              <Field label="Notes (optionnel)">
                <textarea
                  value={draftNotes}
                  onChange={e => setDraftNotes(e.target.value)}
                  rows={2}
                  className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm resize-none"
                />
              </Field>
            </div>

            <div className="px-5 pt-3 pb-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={() => setDraftOpen(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !draftPatient.trim() || !draftPharmacy}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white disabled:bg-blue-300 inline-flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Archiver
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({
  label,
  required,
  children,
}) => (
  <label className="block">
    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </p>
    {children}
  </label>
);

export default PharmacyArchivesTab;
