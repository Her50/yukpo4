-- ✅ 2026-04-01: E-Commerce Platform Registry & Partner Integrations
-- Permet à n'importe quelle boutique/plateforme e-commerce d'intégrer ses produits dans Yukpo
-- Supporte: WooCommerce, Shopify, PrestaShop, Magento, OpenCart, Jumia, CSV, REST générique, etc.

-- ═══════════════════════════════════════════════════════════════
-- 1. REGISTRE DES TYPES DE PLATEFORMES SUPPORTÉES
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ecommerce_platforms (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(50) NOT NULL UNIQUE,           -- ex: 'woocommerce', 'shopify', 'jumia'
    name VARCHAR(100) NOT NULL,                 -- ex: 'WooCommerce', 'Shopify'
    store_category VARCHAR(50) NOT NULL,        -- 'supermarche' | 'mode' | 'electronique' | 'pharmacie' | 'beaute' | 'sport' | 'maison' | 'alimentation' | 'librairie' | 'autre'
    logo_url TEXT,
    auth_type VARCHAR(30) NOT NULL DEFAULT 'api_key', -- 'api_key' | 'bearer_token' | 'basic_auth' | 'oauth2' | 'none'
    -- Configuration par défaut pour l'accès aux produits
    default_products_endpoint TEXT,            -- ex: '/wp-json/wc/v3/products'
    default_items_path TEXT DEFAULT 'items',   -- chemin JSON vers la liste de produits
    -- Mapping de champs par défaut (JSONB)
    default_field_mapping JSONB DEFAULT '{
        "nom": "name",
        "prix": "price",
        "stock": "stock_quantity",
        "categorie": "categories[0].name",
        "marque": "brands[0].name",
        "description": "description",
        "image_url": "images[0].src",
        "code_barre": "sku",
        "en_promotion": "on_sale",
        "prix_promo": "sale_price"
    }'::jsonb,
    -- Paramètres de pagination par défaut
    pagination_param VARCHAR(30) DEFAULT 'page',
    per_page_param VARCHAR(30) DEFAULT 'per_page',
    max_per_page INTEGER DEFAULT 100,
    -- Sync automatique supportée
    supports_webhook BOOLEAN DEFAULT FALSE,    -- La plateforme peut envoyer des webhooks
    supports_pagination BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Données initiales : plateformes supportées
INSERT INTO ecommerce_platforms (slug, name, store_category, auth_type, default_products_endpoint, default_items_path, default_field_mapping, supports_webhook, supports_pagination, logo_url) VALUES
-- Supermarchés / Alimentation
('woocommerce',    'WooCommerce',          'autre',         'basic_auth',   '/wp-json/wc/v3/products',      'items',    '{"nom":"name","prix":"price","stock":"stock_quantity","categorie":"categories[0].name","description":"description","image_url":"images[0].src","code_barre":"sku","en_promotion":"on_sale","prix_promo":"sale_price","marque":"brands[0].name"}'::jsonb,        TRUE,  TRUE, NULL),
('shopify',        'Shopify',              'autre',         'bearer_token', '/admin/api/2024-01/products.json', 'products', '{"nom":"title","prix":"variants[0].price","stock":"variants[0].inventory_quantity","categorie":"product_type","description":"body_html","image_url":"images[0].src","code_barre":"variants[0].barcode","en_promotion":"false","prix_promo":"variants[0].compare_at_price"}'::jsonb, TRUE,  TRUE, NULL),
('prestashop',     'PrestaShop',           'autre',         'api_key',      '/api/products',                'products', '{"nom":"name","prix":"price","stock":"quantity","categorie":"category_name","description":"description","image_url":"image_url","code_barre":"reference","en_promotion":"on_sale","prix_promo":"price_tax_included"}'::jsonb,                                 FALSE, TRUE, NULL),
('magento',        'Magento 2',            'autre',         'bearer_token', '/rest/V1/products',            'items',    '{"nom":"name","prix":"price","stock":"extension_attributes.stock_item.qty","categorie":"custom_attributes.category_ids","description":"custom_attributes.description","image_url":"media_gallery_entries[0].file","code_barre":"sku"}'::jsonb,                FALSE, TRUE, NULL),
('opencart',       'OpenCart',             'autre',         'api_key',      '/index.php?route=api/product', 'products', '{"nom":"name","prix":"price","stock":"quantity","categorie":"categories[0]","description":"description","image_url":"image","code_barre":"model"}'::jsonb,                                                                                                    FALSE, TRUE, NULL),
-- Marketplaces africaines
('jumia',          'Jumia',                'autre',         'api_key',      '/v1/catalog/products',         'data',     '{"nom":"title","prix":"selling_price","stock":"available_quantity","categorie":"category","description":"description","image_url":"main_image","code_barre":"sku","en_promotion":"has_discount","prix_promo":"discounted_price"}'::jsonb,                   FALSE, TRUE, NULL),
('cdiscount',      'Cdiscount Afrique',    'autre',         'basic_auth',   '/api/products',                'Products', '{"nom":"ProductTitle","prix":"Price","stock":"Quantity","categorie":"MainRubric","description":"LongLabel","image_url":"MainImage","code_barre":"Ean","en_promotion":"OnSaleFlag","prix_promo":"SalePrice"}'::jsonb,                                         FALSE, TRUE, NULL),
-- Supermarché custom
('supermarche_custom', 'Supermarché (API custom)', 'supermarche', 'api_key', NULL,                         'products', '{"nom":"nom","prix":"prix","stock":"stock","categorie":"categorie","description":"description","image_url":"image_url","code_barre":"code_barre","en_promotion":"en_promotion","prix_promo":"prix_promo","marque":"marque","unite":"unite"}'::jsonb,          FALSE, TRUE, NULL),
-- Mode & Beauté
('mode_custom',    'Boutique Mode (API)',  'mode',          'api_key',      NULL,                           'products', '{"nom":"nom","prix":"prix","stock":"stock","categorie":"categorie","description":"description","image_url":"image_url","taille":"taille","couleur":"couleur","marque":"marque"}'::jsonb,                                                                     FALSE, TRUE, NULL),
-- Import CSV universel
('csv_import',     'Import CSV/Excel',     'autre',         'none',         NULL,                           NULL,       '{"nom":"nom","prix":"prix","stock":"stock","categorie":"categorie","description":"description","image_url":"image_url","code_barre":"code_barre","en_promotion":"en_promotion","prix_promo":"prix_promo"}'::jsonb,                                            FALSE, FALSE, NULL),
-- API REST générique (JSON quelconque)
('generic_rest',   'API REST Générique',   'autre',         'api_key',      NULL,                           'data',     '{}'::jsonb,                                                                                                                                                                                                                                                FALSE, TRUE, NULL)
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 2. INTÉGRATIONS PAR PARTENAIRE
--    Chaque partenaire peut connecter sa/ses boutique(s) à Yukpo
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS partner_platform_integrations (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    platform_slug VARCHAR(50) NOT NULL REFERENCES ecommerce_platforms(slug),
    -- Infos connexion (chiffrées côté appli)
    api_url TEXT NOT NULL,                      -- URL de base de l'API
    auth_type VARCHAR(30) NOT NULL DEFAULT 'api_key',
    api_key TEXT,                               -- Clé API (chiffrée)
    api_secret TEXT,                            -- Secret API (chiffrée)
    bearer_token TEXT,                          -- Token Bearer (chiffrée)
    basic_auth_user TEXT,                       -- Username basic auth
    basic_auth_pass TEXT,                       -- Password basic auth (chiffrée)
    extra_headers JSONB DEFAULT '{}',           -- Headers HTTP supplémentaires
    -- Configuration des champs
    items_path TEXT,                            -- Chemin JSON vers la liste de produits
    field_mapping JSONB DEFAULT '{}',           -- Mapping champs source → Yukpo
    -- Filtres produits
    category_filter TEXT,                       -- Filtrer par catégorie
    active_only BOOLEAN DEFAULT TRUE,           -- Ne sync que produits actifs
    -- Planification sync
    sync_schedule VARCHAR(20) DEFAULT 'manual', -- 'manual' | 'hourly' | 'daily' | 'weekly'
    sync_hour INTEGER DEFAULT 3,                -- Heure de sync (pour daily/weekly), 0-23
    sync_day_of_week INTEGER DEFAULT 1,         -- Jour de la semaine (pour weekly), 0=Dim
    -- Statut
    status VARCHAR(20) DEFAULT 'active'         -- 'active' | 'paused' | 'error' | 'pending_test'
        CHECK (status IN ('active', 'paused', 'error', 'pending_test')),
    last_sync_at TIMESTAMPTZ,
    last_sync_status VARCHAR(20),               -- 'success' | 'partial' | 'error'
    last_sync_products_count INTEGER DEFAULT 0,
    last_sync_error TEXT,
    -- Webhook (pour plateformes qui le supportent)
    webhook_url TEXT,                           -- URL Yukpo à appeler par la plateforme
    webhook_secret TEXT,                        -- Secret pour valider les webhooks entrants
    -- Métadonnées
    store_name TEXT,                            -- Nom affiché de la boutique
    store_logo_url TEXT,
    overwrite_on_sync BOOLEAN DEFAULT TRUE,     -- Écraser produits existants lors de la sync
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_id, api_url)
);

CREATE INDEX IF NOT EXISTS idx_partner_integrations_service ON partner_platform_integrations(service_id);
CREATE INDEX IF NOT EXISTS idx_partner_integrations_platform ON partner_platform_integrations(platform_slug);
CREATE INDEX IF NOT EXISTS idx_partner_integrations_status ON partner_platform_integrations(status);
CREATE INDEX IF NOT EXISTS idx_partner_integrations_schedule ON partner_platform_integrations(sync_schedule) WHERE sync_schedule != 'manual';

-- ═══════════════════════════════════════════════════════════════
-- 3. LOGS DE SYNCHRONISATION
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS platform_sync_logs (
    id BIGSERIAL PRIMARY KEY,
    integration_id INTEGER NOT NULL REFERENCES partner_platform_integrations(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    trigger_type VARCHAR(20) DEFAULT 'manual'   -- 'manual' | 'scheduled' | 'webhook'
        CHECK (trigger_type IN ('manual', 'scheduled', 'webhook')),
    status VARCHAR(20) DEFAULT 'running'
        CHECK (status IN ('running', 'success', 'partial', 'error')),
    products_fetched INTEGER DEFAULT 0,
    products_created INTEGER DEFAULT 0,
    products_updated INTEGER DEFAULT 0,
    products_skipped INTEGER DEFAULT 0,
    products_errors INTEGER DEFAULT 0,
    error_details JSONB DEFAULT '[]',           -- Tableau d'erreurs par produit
    duration_ms INTEGER,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_integration ON platform_sync_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_service ON platform_sync_logs(service_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON platform_sync_logs(started_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 4. EXTENSION service_products : colonne platform_integration_id
--    Pour tracer l'origine d'un produit importé via intégration
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE service_products
    ADD COLUMN IF NOT EXISTS platform_integration_id INTEGER REFERENCES partner_platform_integrations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS external_product_id TEXT,           -- ID produit dans la plateforme source
    ADD COLUMN IF NOT EXISTS store_category VARCHAR(50);         -- 'supermarche' | 'mode' | 'electronique' | etc.

CREATE INDEX IF NOT EXISTS idx_service_products_integration ON service_products(platform_integration_id) WHERE platform_integration_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_products_store_category ON service_products(store_category) WHERE store_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_products_external_id ON service_products(service_id, external_product_id) WHERE external_product_id IS NOT NULL;

COMMENT ON TABLE ecommerce_platforms IS 'Registre des types de plateformes e-commerce supportées par Yukpo';
COMMENT ON TABLE partner_platform_integrations IS 'Configurations d''intégration par partenaire : connexion API externe → Yukpo';
COMMENT ON TABLE platform_sync_logs IS 'Historique des synchronisations de produits depuis plateformes externes';
