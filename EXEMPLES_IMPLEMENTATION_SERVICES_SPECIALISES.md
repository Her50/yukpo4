# Exemples d'Implémentation - Services Spécialisés

Ce document fournit des exemples de code concrets pour implémenter les améliorations prioritaires identifiées dans l'analyse.

## 📋 Table des Matières
1. [Backend - API Unifiée](#backend---api-unifiée)
2. [Backend - Recherche Avancée](#backend---recherche-avancée)
3. [Frontend - Hub Unifié](#frontend---hub-unifié)
4. [Frontend - Création Assistée](#frontend---création-assistée)
5. [Frontend - Recherche Intelligente](#frontend---recherche-intelligente)

---

## 🔧 Backend - API Unifiée

### 1. Nouveau Contrôleur Unifié

**Fichier** : `backend/src/controllers/specialized_services_unified_controller.rs`

```rust
use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use std::sync::Arc;

use crate::core::types::{AppError, AppResult};
use crate::middlewares::jwt::AuthenticatedUser;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ListServicesQuery {
    pub type_filter: Option<String>, // "pharmacie", "hopital", etc.
    pub status: Option<String>,     // "active", "inactive", "all"
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct UnifiedSpecializedService {
    pub id: i32,
    pub service_id: i32,
    pub type_: String,
    pub nom: String,
    pub is_active: bool,
    pub is_available_now: Option<bool>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub metadata: serde_json::Value, // Données spécifiques au type
}

#[derive(Debug, Serialize)]
pub struct UnifiedServicesResponse {
    pub services: Vec<UnifiedSpecializedService>,
    pub statistics: ServicesStatistics,
    pub pagination: PaginationInfo,
}

#[derive(Debug, Serialize)]
pub struct ServicesStatistics {
    pub total: i64,
    pub active: i64,
    pub inactive: i64,
    pub by_type: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct PaginationInfo {
    pub page: i64,
    pub limit: i64,
    pub total: i64,
    pub total_pages: i64,
}

/// ✅ NOUVEAU : Endpoint unifié pour lister tous les services spécialisés d'un utilisateur
pub async fn list_user_specialized_services(
    State(state): State<Arc<AppState>>,
    Extension(AuthenticatedUser { id: user_id, .. }): Extension<AuthenticatedUser>,
    Query(query): Query<ListServicesQuery>,
) -> AppResult<impl IntoResponse> {
    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(20).min(100); // Max 100 par page
    let offset = (page - 1) * limit;

    // Construire la requête SQL dynamique
    let mut services: Vec<UnifiedSpecializedService> = Vec::new();

    // 1. Pharmacies
    if query.type_filter.is_none() || query.type_filter.as_deref() == Some("pharmacie") {
        let sql = r#"
            SELECT 
                p.id,
                p.service_id,
                'pharmacie' as type_,
                p.nom,
                s.is_active,
                p.is_on_duty_now as is_available_now,
                p.created_at,
                p.updated_at,
                jsonb_build_object(
                    'adresse', p.adresse,
                    'quartier', p.quartier,
                    'telephone', p.telephone,
                    'whatsapp', p.whatsapp,
                    'is_on_duty_now', p.is_on_duty_now,
                    'permanent_24h', p.permanent_24h
                ) as metadata
            FROM pharmacies p
            INNER JOIN services s ON s.id = p.service_id
            WHERE s.user_id = $1
            AND ($2::text IS NULL OR $2 = 'all' OR ($2 = 'active' AND s.is_active) OR ($2 = 'inactive' AND NOT s.is_active))
            ORDER BY p.updated_at DESC
            LIMIT $3 OFFSET $4
        "#;
        
        let rows = sqlx::query(sql)
            .bind(user_id)
            .bind(query.status.as_deref())
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.pg)
            .await?;

        for row in rows {
            services.push(UnifiedSpecializedService {
                id: row.get("id"),
                service_id: row.get("service_id"),
                type_: "pharmacie".to_string(),
                nom: row.get("nom"),
                is_active: row.get("is_active"),
                is_available_now: row.get("is_available_now"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                metadata: row.get("metadata"),
            });
        }
    }

    // 2. Hôpitaux
    if query.type_filter.is_none() || query.type_filter.as_deref() == Some("hopital") {
        let sql = r#"
            SELECT 
                h.id,
                h.service_id,
                'hopital' as type_,
                h.nom,
                s.is_active,
                h.is_available_now,
                h.created_at,
                h.updated_at,
                jsonb_build_object(
                    'type_etablissement', h.type_etablissement,
                    'adresse', h.adresse,
                    'urgences_disponible', h.urgences_disponible,
                    'rdv_en_ligne', h.rdv_en_ligne
                ) as metadata
            FROM hopitaux_cliniques h
            INNER JOIN services s ON s.id = h.service_id
            WHERE s.user_id = $1
            AND ($2::text IS NULL OR $2 = 'all' OR ($2 = 'active' AND s.is_active) OR ($2 = 'inactive' AND NOT s.is_active))
            ORDER BY h.updated_at DESC
            LIMIT $3 OFFSET $4
        "#;
        
        let rows = sqlx::query(sql)
            .bind(user_id)
            .bind(query.status.as_deref())
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.pg)
            .await?;

        for row in rows {
            services.push(UnifiedSpecializedService {
                id: row.get("id"),
                service_id: row.get("service_id"),
                type_: "hopital".to_string(),
                nom: row.get("nom"),
                is_active: row.get("is_active"),
                is_available_now: row.get("is_available_now"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                metadata: row.get("metadata"),
            });
        }
    }

    // Répéter pour laboratoires, agences, covoiturages, taxis, banques_sang...

    // Calculer les statistiques
    let stats = calculate_statistics(&state.pg, user_id).await?;

    // Calculer pagination
    let total = stats.total;
    let total_pages = (total as f64 / limit as f64).ceil() as i64;

    Ok((
        StatusCode::OK,
        Json(UnifiedServicesResponse {
            services,
            statistics: stats,
            pagination: PaginationInfo {
                page,
                limit,
                total,
                total_pages,
            },
        }),
    ))
}

async fn calculate_statistics(
    pool: &PgPool,
    user_id: i32,
) -> Result<ServicesStatistics, sqlx::Error> {
    // Requête optimisée pour statistiques
    let sql = r#"
        WITH all_services AS (
            SELECT s.id, s.is_active, s.specialized_type
            FROM services s
            WHERE s.user_id = $1 AND s.specialized_type IS NOT NULL
        )
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE is_active) as active,
            COUNT(*) FILTER (WHERE NOT is_active) as inactive,
            jsonb_object_agg(
                COALESCE(specialized_type, 'unknown'),
                COUNT(*)
            ) as by_type
        FROM all_services
    "#;

    let row = sqlx::query(sql)
        .bind(user_id)
        .fetch_one(pool)
        .await?;

    Ok(ServicesStatistics {
        total: row.get("total"),
        active: row.get("active"),
        inactive: row.get("inactive"),
        by_type: row.get("by_type"),
    })
}
```

### 2. Ajouter la Route

**Fichier** : `backend/src/routes/specialized_services_routes.rs`

```rust
// Ajouter dans specialized_services_routes()
.route(
    "/api/specialized-services/user",
    get(specialized_services_unified_controller::list_user_specialized_services)
)
```

---

## 🔍 Backend - Recherche Avancée

### 1. Nouveau Modèle de Requête

**Fichier** : `backend/src/models/specialized_search.rs`

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct SpecializedSearchRequest {
    pub specialized_type: String,
    pub query: String,
    pub gps: Option<String>,
    pub radius_km: Option<i32>,
    pub filters: Option<SearchFilters>,
    pub moment: Option<SearchMoment>,
    pub sort: Option<String>, // "distance", "relevance", "rating"
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct SearchFilters {
    pub is_on_duty: Option<bool>,
    pub services: Option<Vec<String>>,
    pub permanent_24h: Option<bool>,
    pub min_rating: Option<f64>,
    pub max_price: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct SearchMoment {
    #[serde(rename = "type")]
    pub type_: String, // "now", "later", "specific"
    pub datetime: Option<String>, // ISO 8601
}

#[derive(Debug, Serialize)]
pub struct SpecializedSearchResponse {
    pub results: Vec<SpecializedSearchResult>,
    pub total: i64,
    pub filters_applied: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct SpecializedSearchResult {
    pub id: i32,
    pub service_id: i32,
    pub type_: String,
    pub nom: String,
    pub distance_km: Option<f64>,
    pub relevance_score: f64,
    pub is_available_now: bool,
    pub metadata: serde_json::Value,
}
```

### 2. Service de Recherche Avancée

**Fichier** : `backend/src/services/specialized_search_service.rs`

```rust
use crate::models::specialized_search::*;
use sqlx::PgPool;
use std::sync::Arc;

pub struct SpecializedSearchService {
    pool: Arc<PgPool>,
}

impl SpecializedSearchService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    pub async fn search(
        &self,
        request: SpecializedSearchRequest,
    ) -> Result<SpecializedSearchResponse, sqlx::Error> {
        let limit = request.limit.unwrap_or(20).min(100);
        let offset = request.offset.unwrap_or(0);
        let radius = request.radius_km.unwrap_or(50);

        // Construire la requête SQL selon le type
        let results = match request.specialized_type.as_str() {
            "pharmacie" => self.search_pharmacies(&request, radius, limit, offset).await?,
            "hopital_clinique" => self.search_hospitals(&request, radius, limit, offset).await?,
            // ... autres types
            _ => vec![],
        };

        Ok(SpecializedSearchResponse {
            total: results.len() as i64,
            results,
            filters_applied: serde_json::json!({
                "specialized_type": request.specialized_type,
                "radius_km": radius,
                "filters": request.filters,
            }),
        })
    }

    async fn search_pharmacies(
        &self,
        request: &SpecializedSearchRequest,
        radius: i32,
        limit: i32,
        offset: i32,
    ) -> Result<Vec<SpecializedSearchResult>, sqlx::Error> {
        let mut sql = String::from(
            r#"
            SELECT 
                p.id,
                p.service_id,
                p.nom,
                p.is_on_duty_now as is_available_now,
                distance_km,
                relevance_score,
                jsonb_build_object(
                    'adresse', p.adresse,
                    'quartier', p.quartier,
                    'telephone', p.telephone,
                    'whatsapp', p.whatsapp,
                    'services', p.services,
                    'permanent_24h', p.permanent_24h
                ) as metadata
            FROM search_pharmacies_with_moment($1, $2, $3, FALSE) p
            WHERE 1=1
        "#,
        );

        // Ajouter filtres dynamiques
        let mut bind_index = 4;
        let mut bind_values: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send + Sync>> = vec![];

        if let Some(ref filters) = request.filters {
            if let Some(is_on_duty) = filters.is_on_duty {
                sql.push_str(&format!(" AND p.is_on_duty_now = ${}", bind_index));
                bind_index += 1;
                // bind_values.push(Box::new(is_on_duty));
            }

            if let Some(ref services) = filters.services {
                if !services.is_empty() {
                    sql.push_str(&format!(" AND p.services && ${}", bind_index));
                    bind_index += 1;
                    // bind_values.push(Box::new(services));
                }
            }

            if let Some(permanent_24h) = filters.permanent_24h {
                sql.push_str(&format!(" AND p.permanent_24h = ${}", bind_index));
                bind_index += 1;
                // bind_values.push(Box::new(permanent_24h));
            }
        }

        // Tri
        match request.sort.as_deref() {
            Some("distance") => sql.push_str(" ORDER BY distance_km ASC"),
            Some("rating") => sql.push_str(" ORDER BY relevance_score DESC"),
            _ => sql.push_str(" ORDER BY relevance_score DESC, distance_km ASC"),
        }

        sql.push_str(&format!(" LIMIT ${} OFFSET ${}", bind_index, bind_index + 1));

        // Exécuter la requête
        let rows = sqlx::query(&sql)
            .bind(&request.query)
            .bind(request.gps.as_deref())
            .bind(radius)
            // .bind(...) // Ajouter autres bindings
            .bind(limit)
            .bind(offset)
            .fetch_all(&*self.pool)
            .await?;

        let mut results = Vec::new();
        for row in rows {
            results.push(SpecializedSearchResult {
                id: row.get("id"),
                service_id: row.get("service_id"),
                type_: "pharmacie".to_string(),
                nom: row.get("nom"),
                distance_km: row.get("distance_km"),
                relevance_score: row.get("relevance_score"),
                is_available_now: row.get("is_available_now"),
                metadata: row.get("metadata"),
            });
        }

        Ok(results)
    }
}
```

---

## 📱 Frontend - Hub Unifié

### 1. Nouveau Composant Hub

**Fichier** : `mobile/src/screens/SpecializedServicesHubScreen.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeButton, NativeCard } from '../components/NativeDesign';
import SafeIcon from '../components/SafeIcon';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';

interface ServiceType {
  id: string;
  name: string;
  icon: string;
  color: string;
  count: number;
  route: string;
}

interface ServicesStatistics {
  total: number;
  active: number;
  inactive: number;
  by_type: Record<string, number>;
}

const SpecializedServicesHubScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statistics, setStatistics] = useState<ServicesStatistics | null>(null);
  const [services, setServices] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await apiGet('/api/specialized-services/user');
      
      if (response.success) {
        setServices(response.data.services || []);
        setStatistics(response.data.statistics);
      }
    } catch (error) {
      console.error('Erreur chargement services:', error);
    } finally {
      setLoading(false);
    }
  };

  const serviceTypes: ServiceType[] = [
    {
      id: 'pharmacie',
      name: 'Pharmacie',
      icon: 'Pill',
      color: '#10B981',
      count: statistics?.by_type?.pharmacie || 0,
      route: 'PharmacieForm',
    },
    {
      id: 'hopital',
      name: 'Hôpital',
      icon: 'Hospital',
      color: '#EF4444',
      count: statistics?.by_type?.hopital_clinique || 0,
      route: 'HopitalForm',
    },
    // ... autres types
  ];

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={modernColors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header avec statistiques */}
      <View style={styles.header}>
        <Text style={styles.title}>Services Spécialisés</Text>
        {statistics && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{statistics.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: modernColors.success }]}>
                {statistics.active}
              </Text>
              <Text style={styles.statLabel}>Actifs</Text>
            </View>
          </View>
        )}
      </View>

      {/* Barre de recherche globale */}
      <View style={styles.searchContainer}>
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => {
            // Naviguer vers recherche spécialisée
            (navigation as any).navigate('SpecializedSearch', {
              specializedType: 'all',
              serviceName: 'Tous les services',
            });
          }}
        >
          <SafeIcon name="search" size={20} color={modernColors.textSecondary} />
          <Text style={styles.searchPlaceholder}>
            Rechercher un service spécialisé...
          </Text>
        </TouchableOpacity>
      </View>

      {/* Accès rapide par type */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Accès Rapide</Text>
        <View style={styles.quickAccessGrid}>
          {serviceTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[styles.quickAccessCard, { borderLeftColor: type.color }]}
              onPress={() => {
                (navigation as any).navigate(type.route, { mode: 'create' });
              }}
            >
              <View style={[styles.iconContainer, { backgroundColor: type.color + '15' }]}>
                <SafeIcon name={type.icon} size={24} color={type.color} type="lucide" />
              </View>
              <Text style={styles.quickAccessName}>{type.name}</Text>
              {type.count > 0 && (
                <Text style={styles.quickAccessCount}>{type.count} service(s)</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Liste des services récents */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mes Services</Text>
          <TouchableOpacity
            onPress={() => {
              (navigation as any).navigate('GestionServicesSpecialises');
            }}
          >
            <Text style={styles.seeAllText}>Voir tous</Text>
          </TouchableOpacity>
        </View>
        
        {services.slice(0, 5).map((service) => (
          <NativeCard key={service.id} style={styles.serviceCard}>
            <View style={styles.serviceCardContent}>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>{service.nom}</Text>
                <Text style={styles.serviceType}>{service.type_}</Text>
              </View>
              <View style={styles.serviceActions}>
                <TouchableOpacity
                  onPress={() => {
                    // Naviguer vers édition
                    const routeMap: Record<string, string> = {
                      pharmacie: 'PharmacieForm',
                      hopital: 'HopitalForm',
                      // ...
                    };
                    (navigation as any).navigate(routeMap[service.type_] || 'GestionServicesSpecialises', {
                      serviceId: service.service_id,
                      mode: 'edit',
                    });
                  }}
                >
                  <SafeIcon name="edit" size={20} color={modernColors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </NativeCard>
        ))}
      </View>

      {/* Suggestions intelligentes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💡 Suggestions</Text>
        <NativeCard style={styles.suggestionCard}>
          <Text style={styles.suggestionText}>
            📍 Pharmacie de garde près de vous
          </Text>
          <NativeButton
            title="Rechercher"
            variant="outline"
            onPress={() => {
              (navigation as any).navigate('SpecializedSearch', {
                specializedType: 'pharmacie',
                serviceName: 'Pharmacie',
                prefillQuery: 'pharmacie de garde',
              });
            }}
          />
        </NativeCard>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: modernColors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: modernColors.textSecondary,
    marginTop: 4,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 16,
    color: modernColors.textSecondary,
  },
  section: {
    padding: 16,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  seeAllText: {
    fontSize: 14,
    color: modernColors.primary,
    fontWeight: '600',
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAccessCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickAccessName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  quickAccessCount: {
    fontSize: 12,
    color: modernColors.textSecondary,
  },
  serviceCard: {
    marginBottom: 12,
  },
  serviceCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  serviceType: {
    fontSize: 12,
    color: modernColors.textSecondary,
    textTransform: 'capitalize',
  },
  serviceActions: {
    flexDirection: 'row',
    gap: 12,
  },
  suggestionCard: {
    padding: 16,
  },
  suggestionText: {
    fontSize: 16,
    color: '#111827',
    marginBottom: 12,
  },
});

export default SpecializedServicesHubScreen;
```

---

## 🎨 Frontend - Création Assistée

### 1. Wizard en 3 Étapes

**Fichier** : `mobile/src/components/SpecializedServiceWizard.tsx`

```typescript
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { NativeButton } from './NativeDesign';
import SafeIcon from './SafeIcon';

interface WizardStep {
  id: string;
  title: string;
  component: React.ReactNode;
}

interface Props {
  serviceType: string;
  onComplete: (data: any) => void;
  onCancel: () => void;
}

const SpecializedServiceWizard: React.FC<Props> = ({
  serviceType,
  onComplete,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<any>({});

  const steps: WizardStep[] = [
    {
      id: 'type',
      title: 'Type & Nom',
      component: <TypeAndNameStep formData={formData} setFormData={setFormData} />,
    },
    {
      id: 'config',
      title: 'Configuration',
      component: <ConfigurationStep serviceType={serviceType} formData={formData} setFormData={setFormData} />,
    },
    {
      id: 'review',
      title: 'Vérification',
      component: <ReviewStep formData={formData} serviceType={serviceType} />,
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete(formData);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      onCancel();
    }
  };

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        {steps.map((step, index) => (
          <View key={step.id} style={styles.progressStep}>
            <View
              style={[
                styles.progressCircle,
                index <= currentStep && styles.progressCircleActive,
              ]}
            >
              {index < currentStep ? (
                <SafeIcon name="check" size={16} color="#fff" />
              ) : (
                <Text style={styles.progressNumber}>{index + 1}</Text>
              )}
            </View>
            <Text
              style={[
                styles.progressLabel,
                index === currentStep && styles.progressLabelActive,
              ]}
            >
              {step.title}
            </Text>
          </View>
        ))}
      </View>

      {/* Step Content */}
      <ScrollView style={styles.content}>
        {steps[currentStep].component}
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <NativeButton
          title={currentStep === 0 ? 'Annuler' : 'Retour'}
          variant="outline"
          onPress={handleBack}
        />
        <NativeButton
          title={currentStep === steps.length - 1 ? 'Créer' : 'Suivant'}
          variant="primary"
          onPress={handleNext}
        />
      </View>
    </View>
  );
};

// Composants pour chaque étape
const TypeAndNameStep: React.FC<any> = ({ formData, setFormData }) => {
  // Implémentation...
  return <View>{/* ... */}</View>;
};

const ConfigurationStep: React.FC<any> = ({ serviceType, formData, setFormData }) => {
  // Implémentation avec champs dynamiques selon serviceType
  return <View>{/* ... */}</View>;
};

const ReviewStep: React.FC<any> = ({ formData, serviceType }) => {
  // Afficher résumé avant création
  return <View>{/* ... */}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  progressStep: {
    alignItems: 'center',
    flex: 1,
  },
  progressCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressCircleActive: {
    backgroundColor: modernColors.primary,
  },
  progressNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  progressLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  progressLabelActive: {
    color: modernColors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
});

export default SpecializedServiceWizard;
```

---

## 🔍 Frontend - Recherche Intelligente

### 1. Autocomplétion avec Suggestions

**Fichier** : `mobile/src/components/SpecializedSearchAutocomplete.tsx`

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { debounce } from 'lodash';
import { apiPost } from '../services/api';
import SafeIcon from './SafeIcon';
import { modernColors } from '../theme/modernTheme';

interface Suggestion {
  text: string;
  type: 'query' | 'service' | 'location';
  icon?: string;
}

interface Props {
  specializedType: string;
  onSelect: (query: string) => void;
  placeholder?: string;
}

const SpecializedSearchAutocomplete: React.FC<Props> = ({
  specializedType,
  onSelect,
  placeholder,
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Debounce pour éviter trop de requêtes
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        // Appel API pour suggestions
        const response = await apiPost('/api/search/suggestions', {
          query: searchQuery,
          specialized_type: specializedType,
        });

        if (response.success) {
          setSuggestions(response.data.suggestions || []);
        }
      } catch (error) {
        console.error('Erreur suggestions:', error);
      } finally {
        setLoading(false);
      }
    }, 300),
    [specializedType]
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  const handleSelect = (suggestion: Suggestion) => {
    setQuery(suggestion.text);
    setShowSuggestions(false);
    onSelect(suggestion.text);
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <SafeIcon name="search" size={20} color={modernColors.textSecondary} />
        <TextInput
          style={styles.input}
          placeholder={placeholder || 'Rechercher...'}
          placeholderTextColor={modernColors.textSecondary}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
        />
        {loading && (
          <ActivityIndicator size="small" color={modernColors.primary} />
        )}
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            keyExtractor={(item, index) => `${item.type}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => handleSelect(item)}
              >
                <SafeIcon
                  name={item.icon || 'search'}
                  size={16}
                  color={modernColors.textSecondary}
                />
                <Text style={styles.suggestionText}>{item.text}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: modernColors.text,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxHeight: 300,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionText: {
    flex: 1,
    fontSize: 16,
    color: modernColors.text,
  },
});

export default SpecializedSearchAutocomplete;
```

---

**Date de création** : 2025-01-XX  
**Version** : 1.0  
**Auteur** : Exemples d'implémentation services spécialisés Yukpomnang

