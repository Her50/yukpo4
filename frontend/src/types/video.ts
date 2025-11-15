export interface ProgressStep {
    key: string;
    label: string;
    status: 'completed' | 'pending' | 'running' | string;
    detail?: string | null;
}

export interface VideoCostEstimation {
    estimated_tokens: number;
    base_cost_usd: number;
    margin_multiplier: number;
    total_cost_usd: number;
    total_cost_fcfa: number;
    total_cost_local: number;
    local_currency: string;
    required_fcfa: number;
    current_balance_fcfa?: number | null;
    affordable: boolean;
    breakdown: {
        tokens_cost_usd: number;
        audio_mastering_usd: number;
        broll_generation_usd: number;
    };
}

export interface GeneratedVideoResponse {
    success: boolean;
    media_id: number;
    service_id: number;
    product_index: number;
    video_url: string;
    path: string;
    duration_seconds: number;
    used_media_ids: number[];
    script_outline: string[];
    style: string;
    headline?: string | null;
    call_to_action?: string | null;
    published_to_chat?: boolean;
    published_to_product_card?: boolean;
    background_music_used?: string | null;
    voiceover_generated: boolean;
    additional_outputs: Array<{
        format: string;
        path: string;
        video_url: string;
        media_id: number;
    }>;
    subtitles_generated: boolean;
    subtitle_url?: string | null;
    distribution_targets: string[];
    quality_score: number;
    immersive_timeline?: unknown;
    immersive_analytics?: ImmersiveAnalytics | null;
    orchestration_warnings?: string[];
    progress_steps?: ProgressStep[];
    cost_estimation?: VideoCostEstimation | null;
    job_id?: string | null;
}

export interface VideoGenerationPayload {
    style?: string | null;
    duration_seconds?: number | null;
    headline?: string | null;
    call_to_action?: string | null;
    story_template_id?: string | null;
    include_price?: boolean;
    include_promotion?: boolean;
    include_contact?: boolean;
    selected_media_ids?: number[] | null;
    related_product_indices?: number[] | null;
    use_product_gallery?: boolean;
    use_service_mediatech?: boolean;
    include_publicite_assets?: boolean;
    publish_to_chat?: boolean;
    publish_to_product_card?: boolean;
    storyboard?: string[] | null;
    music_mode?: string | null;
    music_volume?: number | null;
    voiceover_script?: string | null;
    voiceover_lang?: string | null;
    voiceover_voice?: string | null;
    generate_square_variant?: boolean;
    generate_landscape_variant?: boolean;
    auto_storyboard?: boolean;
    subtitle_mode?: string | null;
    subtitle_lang?: string | null;
    music_track_id?: number | null;
    voice_profile_id?: number | null;
    distribute_channels?: string[] | null;
    use_ai_templates?: boolean;
    generate_subtitles?: boolean;
    style_effects?: string[] | null;
    style_transitions?: string[] | null;
    style_color_palette?: string | null;
    style_overlay_tips?: string[] | null;
    style_music_hint?: string | null;
}

export interface VideoJobProgressStep {
    key: string;
    label: string;
    status: string;
    detail?: string | null;
}

export interface StartVideoJobResponse {
    job_id: string;
    status: string;
}

export interface VideoJobStatus {
    job_id: string;
    user_id: number;
    service_id?: number | null;
    product_index?: number | null;
    status: string;
    progress_steps: VideoJobProgressStep[];
    result_media_id?: number | null;
    error_message?: string | null;
    result_payload?: GeneratedVideoResponse | null;
    created_at: string;
    updated_at: string;
}

export interface StudioSession {
    id: string;
    user_id: number;
    service_id?: number | null;
    status: string;
    brief: Record<string, unknown>;
    ai_recommendations: unknown;
    recommended_templates: string[];
    timeline_settings: Record<string, unknown>;
    distribution_plan: unknown;
    preview_status: string;
    preview_public_url?: string | null;
    preview_job_id?: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface StudioTimelineClip {
    id: number;
    session_id: string;
    position: number;
    lane?: string | null;
    duration_seconds: number;
    payload: Record<string, unknown>;
    created_at: string;
}

export interface StudioDynamicAsset {
    id: number;
    session_id: string;
    asset_type: string;
    storage_key?: string | null;
    public_url?: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
}

export interface StudioSessionAggregate {
    session: StudioSession;
    timeline: StudioTimelineClip[];
    assets: StudioDynamicAsset[];
}

export interface StudioPreviewResponse {
    session_id: string;
    status: string;
    preview_url?: string | null;
    warnings: string[];
    duration_seconds: number;
    template?: string | null;
    clip_count: number;
}

export interface StudioPreviewEvent {
    id: number;
    session_id: string;
    template?: string | null;
    clip_count: number;
    duration_seconds: number;
    status: string;
    preview_url?: string | null;
    warnings: unknown;
    job_id?: string | null;
    created_at: string;
}

export interface PreviewTemplateMetrics {
    template?: string | null;
    count: number;
    avgDurationSeconds: number;
    lastPreviewAt?: string | null;
}

export interface StudioPreviewMetrics {
    totalPreviews: number;
    lastPreviewAt?: string | null;
    templates: PreviewTemplateMetrics[];
}

export interface StudioPublishResponse {
    session_id: string;
    status: string;
    published_at: string;
}

export interface StoryTemplateSpec {
    id: string;
    label: string;
    description: string;
    recommendedCategories: string[];
    tones: string[];
    ctas: string[];
    defaultDurationSeconds: number;
    suggestedScenes: number;
}

export interface ImmersiveAnalytics {
    total_scenes: number;
    broll_clips_used: number;
    broll_sources: Record<string, number>;
    broll_formats?: Record<string, number>;
    template_breakdown: Record<string, number>;
    estimated_frames: number;
    selected_template?: string;
}



