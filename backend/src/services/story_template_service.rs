use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoryTemplateSpec {
    pub id: String,
    pub label: String,
    pub description: String,
    pub recommended_categories: Vec<String>,
    pub tones: Vec<String>,
    pub ctas: Vec<String>,
    pub default_duration_seconds: u32,
    pub suggested_scenes: u32,
}

#[derive(Debug, Clone, Default)]
pub struct StoryTemplateService {
    templates: Vec<StoryTemplateSpec>,
}

impl StoryTemplateService {
    pub fn new() -> Self {
        Self {
            templates: vec![
                StoryTemplateSpec {
                    id: "blog".into(),
                    label: "Blog / Chronicle".into(),
                    description:
                        "Idéal pour les contenus éditoriaux, annonces de nouveautés ou récaps hebdo."
                            .into(),
                    recommended_categories: vec![
                        "coaching".into(),
                        "digital".into(),
                        "immobilier".into(),
                        "delivery".into(),
                    ],
                    tones: vec!["inspirational".into(), "thought leadership".into()],
                    ctas: vec![
                        "Découvrir".into(),
                        "Lire la suite".into(),
                        "Consulter l’étude".into(),
                    ],
                    default_duration_seconds: 30,
                    suggested_scenes: 3,
                },
                StoryTemplateSpec {
                    id: "tutorial".into(),
                    label: "Tutoriel / How-to".into(),
                    description:
                        "Guides pratiques étape par étape, parfait pour les apps et services."
                            .into(),
                    recommended_categories: vec![
                        "formation".into(),
                        "beauty".into(),
                        "food".into(),
                        "artisanat".into(),
                    ],
                    tones: vec!["educational".into(), "calm".into(), "empowering".into()],
                    ctas: vec![
                        "Essayer".into(),
                        "Prendre RDV".into(),
                        "Suivre la formation".into(),
                    ],
                    default_duration_seconds: 36,
                    suggested_scenes: 4,
                },
                StoryTemplateSpec {
                    id: "testimonial".into(),
                    label: "Témoignage client".into(),
                    description:
                        "Renforce la preuve sociale avec citation, métriques et CTA de confiance."
                            .into(),
                    recommended_categories: vec![
                        "services pro".into(),
                        "santé".into(),
                        "logistique".into(),
                        "coaching".into(),
                    ],
                    tones: vec!["trust".into(), "warm".into(), "community".into()],
                    ctas: vec![
                        "Contacter".into(),
                        "Obtenir un audit".into(),
                        "Réserver un créneau".into(),
                    ],
                    default_duration_seconds: 28,
                    suggested_scenes: 3,
                },
                StoryTemplateSpec {
                    id: "comparison".into(),
                    label: "Comparatif / Benchmark".into(),
                    description:
                        "Oppose deux options pour mettre en avant la proposition de valeur Yukpo."
                            .into(),
                    recommended_categories: vec![
                        "logistique".into(),
                        "retail".into(),
                        "services maison".into(),
                        "B2B".into(),
                    ],
                    tones: vec!["bold".into(), "efficient".into()],
                    ctas: vec![
                        "Passer à Yukpo".into(),
                        "Demander une estimation".into(),
                        "Planifier un essai".into(),
                    ],
                    default_duration_seconds: 32,
                    suggested_scenes: 4,
                },
            ],
        }
    }

    pub fn list(&self) -> &[StoryTemplateSpec] {
        &self.templates
    }

    pub fn get(&self, id: &str) -> Option<&StoryTemplateSpec> {
        self.templates.iter().find(|spec| spec.id.eq_ignore_ascii_case(id))
    }
}
