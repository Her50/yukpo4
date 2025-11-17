
import { motion } from 'framer-motion';

import type { StudioStepKey } from '@/hooks/useCreatorStudio';
import { useCreatorStudio } from '@/hooks/useCreatorStudio';

const stepLabels: Record<StudioStepKey, string> = {
    brief: 'Brief & IA',
    assets: 'Assets dynamiques',
    audio: 'Studio audio',
    timeline: 'Timeline & templates',
    distribution: 'Diffusion & A/B',
};

interface CreatorStudioPreviewCardProps {
    serviceId?: number;
    serviceName?: string;
    productName?: string;
}

export const CreatorStudioPreviewCard = ({
    serviceId,
    serviceName,
    productName,
}: CreatorStudioPreviewCardProps) => {
    const [state, actions] = useCreatorStudio({ serviceId });
    const templateSpecs = state.templates;
    const metrics = state.previewMetrics;
    const totalPreviews = metrics?.totalPreviews ?? 0;
    const lastPreview = metrics?.lastPreviewAt
        ? new Date(metrics.lastPreviewAt)
        : undefined;
    const previewFormatter = new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short'
    });

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-3xl border border-indigo-500/20 bg-indigo-950/40 p-6 text-slate-100 backdrop-blur"
        >
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-indigo-300">
                        Studio créateur – Phase 3
                    </p>
                    <h2 className="text-2xl font-semibold text-white md:text-3xl">
                        Prévisualisation intelligente
                    </h2>
                    <p className="text-sm text-indigo-200/80">
                        {serviceName ?? 'Service'} · {productName ?? 'Produit'} · mode immersif
                    </p>
                </div>
                <div className="rounded-full border border-white/15 px-4 py-1 text-xs text-white/80">
                    {stepLabels[state.currentStep]}
                </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-200">
                        Brief IA
                    </p>
                    <textarea
                        value={state.brief}
                        onChange={(event) => actions.setBrief(event.target.value)}
                        className="mt-2 min-h-[110px] w-full rounded-2xl border border-white/5 bg-indigo-950/60 px-3 py-2 text-sm text-white focus:border-indigo-300 focus:outline-none"
                        placeholder="Décris ton service, ton CTA, les points clés..."
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={actions.generateAiSuggestions}
                            className="rounded-full border border-indigo-400/40 px-4 py-1 text-xs text-indigo-200 hover:border-indigo-200"
                        >
                            Générer recommandations
                        </button>
                        {state.aiSuggestions.slice(0, 2).map((suggestion) => (
                            <span
                                key={suggestion}
                                className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200"
                            >
                                {suggestion}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-200">
                        Templates
                    </p>
                    <div className="mt-3 grid gap-2">
                        {state.templatesLoading ? (
                            <p className="text-xs text-slate-400">Chargement des templates...</p>
                        ) : (
                            templateSpecs.map((spec) => {
                                const selected = spec.id === state.timelineDraft.template;
                                return (
                                    <button
                                        key={spec.id}
                                        type="button"
                                        onClick={() => actions.pickTemplate(spec.id)}
                                        className={`rounded-2xl border px-4 py-2 text-left text-sm transition ${selected
                                                ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-100'
                                                : 'border-white/10 bg-indigo-950/40 text-slate-200 hover:border-white/30'
                                            }`}
                                    >
                                        <span className="font-semibold">{spec.label}</span>
                                        <span className="block text-xs text-slate-400">
                                            {spec.description}
                                        </span>
                                        <span className="block text-[11px] text-slate-500">
                                            {spec.suggestedScenes} scènes · ~{spec.defaultDurationSeconds}s · CTA{' '}
                                            {spec.ctas[0] ?? 'N/A'}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-200">
                        Preview
                    </p>
                    <div className="mt-3 space-y-3">
                        <button
                            type="button"
                            onClick={actions.requestPreview}
                            className="w-full rounded-2xl bg-indigo-500/80 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                            disabled={state.previewLoading}
                        >
                            {state.previewLoading ? 'Préparation preview...' : 'Générer un aperçu 5s'}
                        </button>
                        {state.previewUrl ? (
                            <div className="space-y-2 text-xs text-slate-200">
                                <p>
                                    Preview prête ·{' '}
                                    <a
                                        href={state.previewUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-indigo-200 underline"
                                    >
                                        ouvrir
                                    </a>
                                </p>
                                <p>
                                    Timeline estimée : {state.timelineDraft.scenes} scènes ·{' '}
                                    {state.timelineDraft.estimatedDuration}s
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400">
                                Préview low-resolution générée côté GPU pour ajuster timeline avant rendu complet.
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={actions.generateStoryboard}
                            className="w-full rounded-2xl border border-indigo-300/60 bg-indigo-950/60 px-4 py-2 text-xs font-semibold text-indigo-100 hover:border-indigo-200"
                            disabled={state.storyboardLoading}
                        >
                            {state.storyboardLoading ? 'Storyboard IA…' : 'Générer un storyboard IA'}
                        </button>
                        {state.storyboard && state.storyboard.scenes.length > 0 && (
                            <div className="space-y-1 text-[11px] text-slate-200">
                                {state.storyboard.scenes.slice(0, 3).map((scene) => (
                                    <p key={scene.index}>
                                        <span className="font-semibold uppercase tracking-wide text-indigo-200">
                                            {scene.sceneType}{' '}
                                        </span>
                                        · {scene.headline || scene.body || 'Scène'}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-200">
                        Insights preview
                    </p>
                    {state.previewMetricsLoading ? (
                        <p className="mt-3 text-xs text-slate-400">Analyse en cours…</p>
                    ) : metrics ? (
                        <div className="mt-3 space-y-3 text-xs text-slate-200">
                            <p>
                                {totalPreviews} aperçu{totalPreviews > 1 ? 's' : ''} généré
                                {totalPreviews > 1 ? 's' : ''}{' '}
                                {lastPreview
                                    ? `· dernier ${previewFormatter.format(lastPreview)}`
                                    : ''}
                            </p>
                            {metrics.templates.length > 0 && (
                                <div className="space-y-1">
                                    {metrics.templates.slice(0, 3).map((templateMetrics) => (
                                        <div
                                            key={templateMetrics.template ?? 'manual'}
                                            className="flex items-center justify-between text-[11px] text-slate-300"
                                        >
                                            <span className="font-semibold text-white">
                                                {templateMetrics.template ?? 'Timeline manuelle'}
                                            </span>
                                            <span>
                                                {templateMetrics.count}x · ~
                                                {Math.round(templateMetrics.avgDurationSeconds)}s
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="mt-3 text-xs text-slate-400">
                            Lance quelques previews pour obtenir des métriques.
                        </p>
                    )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-200">
                        Historique preview
                    </p>
                    <div className="mt-3 space-y-2">
                        {state.previewEventsLoading ? (
                            <p className="text-xs text-slate-400">Chargement…</p>
                        ) : state.previewEvents.length === 0 ? (
                            <p className="text-xs text-slate-400">
                                Aucun aperçu enregistré pour cette session.
                            </p>
                        ) : (
                            state.previewEvents.slice(0, 5).map((event) => (
                                <div
                                    key={event.id}
                                    className="rounded-xl border border-white/10 bg-indigo-950/40 p-3 text-xs text-slate-200"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="font-semibold text-white">
                                            {event.template ?? 'Timeline manuelle'}
                                        </span>
                                        <span className="text-[11px] text-slate-400">
                                            {previewFormatter.format(new Date(event.created_at))}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-[11px] text-slate-400">
                                        {event.clip_count} clips · ~{event.duration_seconds}s ·{' '}
                                        {event.status}
                                    </p>
                                    {event.warnings && Array.isArray(event.warnings) && event.warnings.length > 0 && (
                                        <p className="mt-1 text-[11px] text-amber-300">
                                            {event.warnings[0]}
                                        </p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-200">
                        Distribution
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {state.distributionPlan.length === 0 ? (
                            <p className="text-xs text-slate-400">
                                Planifier automatiquement selon audience ciblée et SLA delivery.
                            </p>
                        ) : (
                            state.distributionPlan.map((channel) => (
                                <span
                                    key={channel}
                                    className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/80"
                                >
                                    {channel}
                                </span>
                            ))
                        )}
                    </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-200">
                        Étapes
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {(Object.keys(stepLabels) as StudioStepKey[]).map((step) => (
                            <button
                                key={step}
                                type="button"
                                onClick={() => actions.goToStep(step)}
                                className={`rounded-full px-3 py-1 text-xs ${state.currentStep === step
                                    ? 'bg-indigo-500/80 text-white'
                                    : 'bg-white/5 text-slate-300'
                                    }`}
                            >
                                {stepLabels[step]}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-200">
                        A/B ready
                    </p>
                    <div className="mt-3 text-xs text-slate-300">
                        <p>
                            Configure deux variantes CTA, Yukpo répartit automatiquement l’audience et mesure watch time /
                            conversions.
                        </p>
                        <p className="mt-2 text-slate-400">
                            Les métriques s’afficheront dans Analytics créateurs (plan Phase 3).
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

