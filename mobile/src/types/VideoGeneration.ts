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
    style?: string | null;
    headline?: string | null;
    call_to_action?: string | null;
    published_to_chat?: boolean;
    published_to_product_card?: boolean;
    background_music_used?: string | null;
    voiceover_generated: boolean;
    additional_outputs: GeneratedVideoVariant[];
    subtitles_generated?: boolean;
    subtitle_url?: string | null;
    distribution_targets?: string[];
    quality_score: number;
    immersive_timeline?: ImmersiveTimeline | null;
    immersive_analytics?: ImmersiveAnalytics | null;
    orchestration_warnings?: string[];
    progress_steps?: ProgressStep[];
    cost_estimation?: VideoCostEstimation | null;
    job_id?: string | null;
}

export interface GeneratedVideoVariant {
    format: string;
    path: string;
    video_url: string;
    media_id: number;
}

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

export interface ImmersiveAnalytics {
    total_scenes: number;
    broll_clips_used: number;
    broll_sources: Record<string, number>;
    broll_formats?: Record<string, number>;
    template_breakdown: Record<string, number>;
    estimated_frames: number;
}

export interface ImmersiveTimeline {
    fps: number;
    width: number;
    height: number;
    scenes: ImmersiveScene[];
}

export interface ImmersiveScene {
    id: string;
    template: string;
    duration_in_frames: number;
    assets: {
        headline?: string | null;
        subheadline?: string | null;
        body?: string | null;
        product_image_url?: string | null;
        background_url?: string | null;
        video_url?: string | null;
    };
}

export interface VideoCostEstimateResponse {
    success: boolean;
    data: VideoCostEstimation;
}

export interface VideoGenerationPayload {
    style?: string | null;
    duration_seconds?: number | null;
    headline?: string | null;
    call_to_action?: string | null;
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
    distribute_channels?: string[] | null;
    use_ai_templates?: boolean;
    generate_subtitles?: boolean;
    style_effects?: string[] | null;
    style_transitions?: string[] | null;
    style_color_palette?: string | null;
    style_overlay_tips?: string[] | null;
    style_music_hint?: string | null;
}

export interface AIVideoBriefVariant {
    headline?: string | null;
    call_to_action?: string | null;
    script_outline: string[];
    hook?: string | null;
    voiceover?: string | null;
    hashtags: string[];
}

export interface AIVideoStyleSuggestion {
    effects: string[];
    transitions: string[];
    color_palette?: string | null;
    overlay_tips: string[];
    music_hint?: string | null;
}

export interface AIDistributionPlan {
    summary?: string | null;
    hashtags: string[];
    schedule: AIDistributionItem[];
}

export interface AIDistributionItem {
    channel: string;
    best_time: string;
    call_to_action?: string | null;
}


