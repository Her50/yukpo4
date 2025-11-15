import { Fragment, useMemo, useState } from 'react';

import { motion } from 'framer-motion';
import { Sparkles, Volume2, Music4, Waves, Plus, Trash2, Play } from 'lucide-react';

import type { CreateVoiceProfilePayload, VoiceProfileSummary } from '@/types/audio';

type MusicMode = 'pulse' | 'lofi' | 'ambient' | 'cinematic' | 'none';

interface StudioAudioPanelProps {
    voiceoverEnabled: boolean;
    onVoiceoverToggle: (next: boolean) => void;
    voiceoverLang: 'fr' | 'en';
    onVoiceoverLangChange: (lang: 'fr' | 'en') => void;
    selectedVoiceProfileId?: number;
    onVoiceProfileSelect: (id?: number) => void;
    voiceProfiles: VoiceProfileSummary[];
    isLoadingProfiles: boolean;
    onCreateProfile: (payload: Omit<CreateVoiceProfilePayload, 'service_id'>) => Promise<void>;
    onDeleteProfile: (id: number) => Promise<void>;
    musicMode: MusicMode;
    onMusicModeChange: (mode: MusicMode) => void;
}

const musicModePresets: { value: MusicMode; label: string; description: string }[] = [
    { value: 'pulse', label: 'Pulse', description: 'Rythme énergique, format TikTok/Shorts' },
    { value: 'lofi', label: 'Lo-Fi', description: 'Ambiance chill, storytelling intimiste' },
    { value: 'ambient', label: 'Ambient', description: 'Textures aériennes, focus produit/service' },
    { value: 'cinematic', label: 'Cinematic', description: 'Transitions héroïques, reveal dramatique' },
    { value: 'none', label: 'Silence', description: 'Aucune musique (voix + SFX uniquement)' },
];

const langOptions: Array<{ value: 'fr' | 'en'; label: string }> = [
    { value: 'fr', label: 'FR' },
    { value: 'en', label: 'EN' },
];

const AudioLayerTimeline = ({
    voiceoverEnabled,
    musicMode,
}: {
    voiceoverEnabled: boolean;
    musicMode: MusicMode;
}) => {
    const layers = useMemo(
        () => [
            {
                title: 'Voix-off',
                status: voiceoverEnabled ? 'active' : 'muted',
                accent: 'from-indigo-500/60 to-indigo-400/20',
                icon: <Volume2 className="h-4 w-4" />,
                detail: voiceoverEnabled ? 'Profil sélectionné' : 'Désactivée',
            },
            {
                title: 'Musique',
                status: musicMode !== 'none' ? 'active' : 'muted',
                accent: 'from-emerald-500/60 to-emerald-400/20',
                icon: <Music4 className="h-4 w-4" />,
                detail:
                    musicMode !== 'none'
                        ? musicModePresets.find((preset) => preset.value === musicMode)?.label
                        : 'Silence',
            },
            {
                title: 'SFX & Spatial',
                status: 'active',
                accent: 'from-cyan-500/60 to-cyan-400/20',
                icon: <Waves className="h-4 w-4" />,
                detail: 'Transitions dynamiques et SFX IA',
            },
        ],
        [musicMode, voiceoverEnabled],
    );

    return (
        <div className="mt-6 grid gap-3">
            {layers.map((layer) => (
                <div
                    key={layer.title}
                    className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-4"
                >
                    <div className="flex items-center gap-3">
                        <div
                            className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${layer.accent} text-white`}
                        >
                            {layer.icon}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-100">{layer.title}</p>
                            <p className="text-xs text-slate-400">{layer.detail}</p>
                        </div>
                    </div>
                    <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            layer.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-400/40'
                                : 'bg-slate-500/10 text-slate-300 border border-slate-500/30'
                        }`}
                    >
                        {layer.status === 'active' ? 'Actif' : 'Muet'}
                    </span>
                </div>
            ))}
        </div>
    );
};

const VoiceProfileList = ({
    profiles,
    selectedVoiceProfileId,
    onVoiceProfileSelect,
    onDeleteProfile,
    disabled,
}: {
    profiles: VoiceProfileSummary[];
    selectedVoiceProfileId?: number;
    onVoiceProfileSelect: (id?: number) => void;
    onDeleteProfile: (id: number) => Promise<void>;
    disabled: boolean;
}) => {
    if (profiles.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-slate-400">
                Aucun profil enregistré. Créez-en un pour personnaliser la voix IA.
            </div>
        );
    }

    return (
        <div className="grid gap-3">
            {profiles.map((profile) => {
                const selected = profile.id === selectedVoiceProfileId;
                return (
                    <div
                        key={profile.id}
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition ${
                            selected
                                ? 'border-indigo-400/60 bg-indigo-500/10 text-indigo-100'
                                : 'border-white/10 bg-white/5 text-slate-200'
                        }`}
                    >
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => onVoiceProfileSelect(selected ? undefined : profile.id)}
                            className="flex flex-1 flex-col text-left focus:outline-none"
                        >
                            <span className="text-sm font-semibold">{profile.name}</span>
                            <span className="text-xs text-slate-400">{profile.provider}</span>
                        </button>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled
                                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 opacity-60"
                            >
                                <Play className="h-3.5 w-3.5" /> Preview
                            </button>
                            <button
                                type="button"
                                onClick={() => onDeleteProfile(profile.id)}
                                className="rounded-full border border-red-500/20 p-2 text-red-200 transition hover:bg-red-500/10"
                                aria-label="Supprimer le profil audio"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const CreateProfileModal = ({
    open,
    onClose,
    onSubmit,
    loading,
}: {
    open: boolean;
    onClose: () => void;
    onSubmit: (payload: Omit<CreateVoiceProfilePayload, 'service_id'>) => Promise<void>;
    loading: boolean;
}) => {
    const [name, setName] = useState('');
    const [provider, setProvider] = useState('custom');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            await onSubmit({
                name: name.trim(),
                provider,
                description: description.trim() || undefined,
            });
            setName('');
            setDescription('');
            setProvider('custom');
            onClose();
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl backdrop-blur-xl">
                <div className="mb-4 flex items-center gap-2 text-slate-100">
                    <Sparkles className="h-5 w-5 text-indigo-300" />
                    <h4 className="text-lg font-semibold">Nouveau profil vocal</h4>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-slate-300">Nom du profil</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-indigo-400"
                            placeholder="Voix premium salon, clone IA..."
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-300">Provider</label>
                        <select
                            value={provider}
                            onChange={(event) => setProvider(event.target.value)}
                            className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-indigo-400"
                        >
                            <option value="custom">Custom</option>
                            <option value="dolby">Dolby.io</option>
                            <option value="aup">Auphonic</option>
                            <option value="elevenlabs">ElevenLabs</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-300">Description</label>
                        <textarea
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            rows={3}
                            className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none focus:border-indigo-400"
                            placeholder="Accent, tonalité, indications IA..."
                        />
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300"
                    >
                        Annuler
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving || loading || !name.trim()}
                        className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-500/40"
                    >
                        <Sparkles className="h-4 w-4" />
                        {saving ? 'Création...' : 'Créer'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const StudioAudioPanel = ({
    voiceoverEnabled,
    onVoiceoverToggle,
    voiceoverLang,
    onVoiceoverLangChange,
    voiceProfiles,
    selectedVoiceProfileId,
    onVoiceProfileSelect,
    isLoadingProfiles,
    onCreateProfile,
    onDeleteProfile,
    musicMode,
    onMusicModeChange,
}: StudioAudioPanelProps) => {
    const [modalOpen, setModalOpen] = useState(false);

    return (
        <Fragment>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="rounded-3xl border border-white/5 bg-gradient-to-br from-slate-950/90 via-indigo-950/40 to-slate-950/70 p-6 shadow-2xl backdrop-blur-xl"
            >
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-200">
                            Studio audio
                        </p>
                        <h3 className="text-2xl font-bold text-white">Voix & Mix intelligent</h3>
                        <p className="text-sm text-slate-300">
                            Calibrage auto du mixage IA : voix premium, musique dynamique et SFX synchronisés timeline.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-200">
                        <Sparkles className="h-4 w-4 text-indigo-300" />
                        Mode IA Assisté
                    </div>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
                    <div className="space-y-6">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-2xl bg-indigo-500/20 p-3 text-indigo-200">
                                        <Volume2 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-100">Voix-off intelligente</p>
                                        <p className="text-xs text-slate-400">
                                            Choisissez un profil vocal ou créez votre clone personnalisé.
                                        </p>
                                    </div>
                                </div>
                                <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border border-white/30 bg-slate-900 accent-indigo-500"
                                        checked={voiceoverEnabled}
                                        onChange={(event) => onVoiceoverToggle(event.target.checked)}
                                    />
                                    {voiceoverEnabled ? 'Activée' : 'Désactivée'}
                                </label>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-3">
                                {langOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => onVoiceoverLangChange(option.value)}
                                        className={`rounded-full px-4 py-2 text-xs font-semibold ${
                                            option.value === voiceoverLang
                                                ? 'bg-indigo-500 text-white'
                                                : 'bg-white/10 text-slate-300'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(true)}
                                    disabled={!voiceoverEnabled}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-white/20 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-indigo-300 disabled:cursor-not-allowed disabled:text-slate-500"
                                >
                                    <Plus className="h-4 w-4" />
                                    Nouveau profil
                                </button>
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-white/30"
                                >
                                    Importer un sample
                                </button>
                            </div>

                            <div className="mt-4">
                                {isLoadingProfiles ? (
                                    <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
                                ) : (
                                    <VoiceProfileList
                                        profiles={voiceProfiles}
                                        selectedVoiceProfileId={selectedVoiceProfileId}
                                        onVoiceProfileSelect={onVoiceProfileSelect}
                                        onDeleteProfile={onDeleteProfile}
                                        disabled={!voiceoverEnabled}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                            <div className="mb-4 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold text-slate-100">Musique adaptive</p>
                                    <p className="text-xs text-slate-400">Synchronisée sur la timeline (FFmpeg + Remotion)</p>
                                </div>
                                <button
                                    type="button"
                                    className="rounded-full border border-white/10 px-4 py-1 text-xs text-slate-200 hover:border-indigo-400"
                                    onClick={() => onMusicModeChange('pulse')}
                                >
                                    Booster IA
                                </button>
                            </div>
                            <div className="grid gap-3">
                                {musicModePresets.map((preset) => {
                                    const selected = preset.value === musicMode;
                                    return (
                                        <button
                                            key={preset.value}
                                            type="button"
                                            onClick={() => onMusicModeChange(preset.value)}
                                            className={`flex flex-col rounded-2xl border px-4 py-3 text-left transition ${
                                                selected
                                                    ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-100'
                                                    : 'border-white/10 bg-white/5 text-slate-200'
                                            }`}
                                        >
                                            <span className="text-sm font-semibold">{preset.label}</span>
                                            <span className="text-xs text-slate-400">{preset.description}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
                        <p className="text-sm font-semibold text-slate-100">Timeline & mastering</p>
                        <p className="text-xs text-slate-400">
                            Visualisez les couches audio mixées par Yukpo (voice, musique, SFX, mastering premium).
                        </p>
                        <AudioLayerTimeline voiceoverEnabled={voiceoverEnabled} musicMode={musicMode} />
                    </div>
                </div>
            </motion.div>
            <CreateProfileModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={onCreateProfile}
                loading={isLoadingProfiles}
            />
        </Fragment>
    );
};

