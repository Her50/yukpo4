// Script pour créer les index MongoDB pour optimiser /api/services/{id}/stats et /api/services/{id}/reviews
// Usage: mongosh "mongodb://..." --file create_mongo_indexes.js

// Index pour optimiser get_interactions (requête par service_id et event_type)
db.history.createIndex(
    { "service_id": 1, "event_type": 1 },
    { name: "idx_history_service_event", background: true }
);

// Index pour optimiser get_reviews (requête par service_id et data.interaction_type)
db.history.createIndex(
    { "service_id": 1, "data.interaction_type": 1 },
    { name: "idx_history_service_interaction", background: true }
);

print("✅ Index MongoDB créés avec succès:");
print("  - idx_history_service_event (service_id, event_type)");
print("  - idx_history_service_interaction (service_id, data.interaction_type)");

