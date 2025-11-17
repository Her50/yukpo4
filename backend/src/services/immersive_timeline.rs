use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImmersiveSticker {
    pub id: String,
    pub src: String,
    pub start_frame: u32,
    pub duration_in_frames: u32,
    #[serde(default)]
    pub position: Option<StickerPosition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StickerPosition {
    pub x: f32,
    pub y: f32,
    #[serde(default = "default_scale")]
    pub scale: f32,
}

#[derive(Debug, Clone)]
pub struct ImmersiveContext {
    pub slide_count: usize,
    pub style: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ImmersivePlan {
    pub broll_slots: Vec<usize>,
    pub cta_slide_index: usize,
}

impl ImmersivePlan {
    pub fn should_inject_broll(&self, slide_index: usize) -> bool {
        self.broll_slots.contains(&slide_index)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImmersiveSceneAssets {
    #[serde(default)]
    pub headline: Option<String>,
    #[serde(default)]
    pub subheadline: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub product_image_url: Option<String>,
    #[serde(default)]
    pub background_url: Option<String>,
    #[serde(default)]
    pub video_url: Option<String>,
    #[serde(default)]
    pub stickers: Option<Vec<ImmersiveSticker>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImmersiveSceneTransition {
    #[serde(default = "default_transition_type")]
    pub r#type: TransitionType,
    #[serde(default = "default_transition_duration")]
    pub duration_in_frames: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImmersiveSceneColorGrade {
    #[serde(default = "default_color_grade_style")]
    pub style: ColorGradeStyle,
    #[serde(default = "default_color_grade_intensity")]
    pub intensity: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImmersiveAudioCue {
    pub id: String,
    pub start_frame: u32,
    pub cue_type: AudioCueKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImmersiveScene {
    pub id: String,
    pub template: ImmersiveTemplate,
    pub duration_in_frames: u32,
    #[serde(default)]
    pub assets: ImmersiveSceneAssets,
    #[serde(default)]
    pub transition: ImmersiveSceneTransition,
    #[serde(default)]
    pub color_grade: Option<ImmersiveSceneColorGrade>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImmersiveTimeline {
    #[serde(default = "default_fps")]
    pub fps: u32,
    #[serde(default = "default_width")]
    pub width: u32,
    #[serde(default = "default_height")]
    pub height: u32,
    #[serde(default)]
    pub audio_cue_map: Option<Vec<ImmersiveAudioCue>>,
    pub scenes: Vec<ImmersiveScene>,
}

impl ImmersiveTimeline {
    pub fn total_frames(&self) -> u32 {
        self.scenes
            .iter()
            .map(|scene| scene.duration_in_frames)
            .sum()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ImmersiveTemplate {
    IntroPulse,
    ProductShowcase,
    ARHighlight,
    GlowCTA,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransitionType {
    #[serde(rename = "orbit-3d")]
    Orbit3d,
    #[serde(rename = "parallax")]
    Parallax,
    #[serde(rename = "speed-ramp")]
    SpeedRamp,
    #[serde(rename = "hard-cut")]
    HardCut,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ColorGradeStyle {
    None,
    Cinematic,
    Glow,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum AudioCueKind {
    Impact,
    Glitch,
    Riser,
    Beat,
}

impl Default for ImmersiveSceneAssets {
    fn default() -> Self {
        Self {
            headline: None,
            subheadline: None,
            body: None,
            product_image_url: None,
            background_url: None,
            video_url: None,
            stickers: None,
        }
    }
}

impl Default for ImmersiveSceneTransition {
    fn default() -> Self {
        Self {
            r#type: default_transition_type(),
            duration_in_frames: default_transition_duration(),
        }
    }
}

fn default_scale() -> f32 {
    1.0
}

fn default_transition_type() -> TransitionType {
    TransitionType::HardCut
}

fn default_transition_duration() -> u32 {
    12
}

fn default_fps() -> u32 {
    30
}

fn default_width() -> u32 {
    1080
}

fn default_height() -> u32 {
    1920
}

fn default_color_grade_style() -> ColorGradeStyle {
    ColorGradeStyle::Cinematic
}

fn default_color_grade_intensity() -> f32 {
    0.6
}

/// Applique des hints de style (effets, transitions, palette de couleurs) sur une timeline immersive.
///
/// L'objectif est de mapper des listes de chaînes génériques (venant du payload front) vers
/// des `TransitionType` et `ColorGradeStyle` concrets, sans imposer une taxonomie figée au frontend.
pub fn apply_style_hints_to_timeline(
    timeline: &mut ImmersiveTimeline,
    style_effects: Option<&[String]>,
    style_transitions: Option<&[String]>,
    style_color_palette: Option<&str>,
) {
    let mut transition_hint: Option<TransitionType> = None;
    if let Some(hints) = style_transitions {
        for hint in hints {
            let lower = hint.to_lowercase();
            if lower.contains("orbit") || lower.contains("3d") {
                transition_hint = Some(TransitionType::Orbit3d);
                break;
            }
            if lower.contains("parallax") {
                transition_hint = Some(TransitionType::Parallax);
                break;
            }
            if lower.contains("speed") || lower.contains("ramp") {
                transition_hint = Some(TransitionType::SpeedRamp);
                break;
            }
            if lower.contains("cut") || lower.contains("jump") {
                transition_hint = Some(TransitionType::HardCut);
                break;
            }
        }
    }

    let mut grade_hint: Option<ColorGradeStyle> = None;
    if let Some(palette) = style_color_palette {
        let lower = palette.to_lowercase();
        if lower.contains("neon") || lower.contains("glow") {
            grade_hint = Some(ColorGradeStyle::Glow);
        } else if lower.contains("cinematic") || lower.contains("film") {
            grade_hint = Some(ColorGradeStyle::Cinematic);
        } else {
            grade_hint = Some(ColorGradeStyle::None);
        }
    }

    // Effets texte / overlays : pour l’instant, on s’en sert pour moduler l’intensité colorimétrique.
    let mut grade_intensity: Option<f32> = None;
    if let Some(effects) = style_effects {
        for effect in effects {
            let lower = effect.to_lowercase();
            if lower.contains("subtle") || lower.contains("soft") {
                grade_intensity = Some(0.35);
                break;
            }
            if lower.contains("strong") || lower.contains("aggressive") {
                grade_intensity = Some(0.8);
                break;
            }
        }
    }

    if transition_hint.is_none() && grade_hint.is_none() && grade_intensity.is_none() {
        return;
    }

    for scene in &mut timeline.scenes {
        if let Some(tt) = transition_hint {
            scene.transition.r#type = tt;
        }

        if grade_hint.is_some() || grade_intensity.is_some() {
            let mut grade = scene
                .color_grade
                .clone()
                .unwrap_or_else(|| ImmersiveSceneColorGrade {
                    style: default_color_grade_style(),
                    intensity: default_color_grade_intensity(),
                });
            if let Some(style) = grade_hint {
                grade.style = style;
            }
            if let Some(intensity) = grade_intensity {
                grade.intensity = intensity;
            }
            scene.color_grade = Some(grade);
        }
    }
}

