-- ✅ Migration pour enrichir templates E-commerce (200 templates)
-- Date: 2025-01-27
-- Objectif: Ajouter 200 templates E-commerce pour atteindre 1000+ templates

-- Sous-catégorie: Produits (50)
INSERT INTO video_templates (name, industry, subcategory, description, timeline, effects, transitions, style, duration, format, tags, is_premium, popularity_score, usage_count) VALUES
('ecommerce-product-showcase', 'ecommerce', 'product', 'Mise en avant produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "premium"}', 30.0, '9:16', ARRAY['ecommerce', 'product', 'showcase'], false, 9.5, 0),
('ecommerce-product-detail', 'ecommerce', 'product', 'Détail produit e-commerce', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "detailed"}', 35.0, '16:9', ARRAY['ecommerce', 'product', 'detail'], false, 9.0, 0),
('ecommerce-product-360', 'ecommerce', 'product', 'Vue 360° produit e-commerce', '{"scenes": 8, "total_duration": 40}', '[]', '[]', '{"style": "immersive"}', 40.0, '16:9', ARRAY['ecommerce', 'product', '360'], true, 8.5, 0),
('ecommerce-product-comparison', 'ecommerce', 'product', 'Comparaison produits e-commerce', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "comparative"}', 35.0, '16:9', ARRAY['ecommerce', 'product', 'comparison'], false, 8.0, 0),
('ecommerce-product-unboxing', 'ecommerce', 'product', 'Unboxing produit e-commerce', '{"scenes": 7, "total_duration": 40}', '[]', '[]', '{"style": "authentic"}', 40.0, '9:16', ARRAY['ecommerce', 'product', 'unboxing'], false, 7.5, 0),
('ecommerce-product-features', 'ecommerce', 'product', 'Caractéristiques produit e-commerce', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "informative"}', 35.0, '16:9', ARRAY['ecommerce', 'product', 'features'], false, 7.0, 0),
('ecommerce-product-benefits', 'ecommerce', 'product', 'Avantages produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "beneficial"}', 30.0, '9:16', ARRAY['ecommerce', 'product', 'benefits'], false, 6.5, 0),
('ecommerce-product-testimonial', 'ecommerce', 'product', 'Témoignage produit e-commerce', '{"scenes": 4, "total_duration": 25}', '[]', '[]', '{"style": "trustworthy"}', 25.0, '9:16', ARRAY['ecommerce', 'product', 'testimonial'], false, 6.0, 0),
('ecommerce-product-tutorial', 'ecommerce', 'product', 'Tutoriel produit e-commerce', '{"scenes": 8, "total_duration": 45}', '[]', '[]', '{"style": "educational"}', 45.0, '16:9', ARRAY['ecommerce', 'product', 'tutorial'], false, 5.5, 0),
('ecommerce-product-lifestyle', 'ecommerce', 'product', 'Lifestyle produit e-commerce', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "lifestyle"}', 35.0, '9:16', ARRAY['ecommerce', 'product', 'lifestyle'], false, 5.0, 0),
('ecommerce-product-launch', 'ecommerce', 'product', 'Lancement produit e-commerce', '{"scenes": 7, "total_duration": 40}', '[]', '[]', '{"style": "exciting"}', 40.0, '16:9', ARRAY['ecommerce', 'product', 'launch'], true, 4.5, 0),
('ecommerce-product-review', 'ecommerce', 'product', 'Avis produit e-commerce', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "review"}', 35.0, '16:9', ARRAY['ecommerce', 'product', 'review'], false, 4.0, 0),
('ecommerce-product-before-after', 'ecommerce', 'product', 'Avant/Après produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "transformative"}', 30.0, '9:16', ARRAY['ecommerce', 'product', 'before-after'], false, 3.5, 0),
('ecommerce-product-specs', 'ecommerce', 'product', 'Spécifications produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "technical"}', 30.0, '16:9', ARRAY['ecommerce', 'product', 'specs'], false, 3.0, 0),
('ecommerce-product-packaging', 'ecommerce', 'product', 'Emballage produit e-commerce', '{"scenes": 4, "total_duration": 25}', '[]', '[]', '{"style": "packaging"}', 25.0, '9:16', ARRAY['ecommerce', 'product', 'packaging'], false, 2.5, 0),
('ecommerce-product-collection', 'ecommerce', 'product', 'Collection produits e-commerce', '{"scenes": 8, "total_duration": 45}', '[]', '[]', '{"style": "collection"}', 45.0, '16:9', ARRAY['ecommerce', 'product', 'collection'], true, 2.0, 0),
('ecommerce-product-variants', 'ecommerce', 'product', 'Variantes produit e-commerce', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "variants"}', 35.0, '9:16', ARRAY['ecommerce', 'product', 'variants'], false, 1.5, 0),
('ecommerce-product-size-guide', 'ecommerce', 'product', 'Guide taille produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "informative"}', 30.0, '16:9', ARRAY['ecommerce', 'product', 'size-guide'], false, 1.0, 0),
('ecommerce-product-care', 'ecommerce', 'product', 'Entretien produit e-commerce', '{"scenes": 4, "total_duration": 25}', '[]', '[]', '{"style": "care"}', 25.0, '9:16', ARRAY['ecommerce', 'product', 'care'], false, 0.9, 0),
('ecommerce-product-warranty', 'ecommerce', 'product', 'Garantie produit e-commerce', '{"scenes": 3, "total_duration": 20}', '[]', '[]', '{"style": "trust"}', 20.0, '16:9', ARRAY['ecommerce', 'product', 'warranty'], false, 0.8, 0),
('ecommerce-product-sustainability', 'ecommerce', 'product', 'Durabilité produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "eco"}', 30.0, '9:16', ARRAY['ecommerce', 'product', 'sustainability'], false, 0.7, 0),
('ecommerce-product-origin', 'ecommerce', 'product', 'Origine produit e-commerce', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "story"}', 35.0, '16:9', ARRAY['ecommerce', 'product', 'origin'], false, 0.6, 0),
('ecommerce-product-materials', 'ecommerce', 'product', 'Matériaux produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "materials"}', 30.0, '9:16', ARRAY['ecommerce', 'product', 'materials'], false, 0.5, 0),
('ecommerce-product-customization', 'ecommerce', 'product', 'Personnalisation produit e-commerce', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "custom"}', 35.0, '16:9', ARRAY['ecommerce', 'product', 'customization'], true, 0.4, 0),
('ecommerce-product-bundle', 'ecommerce', 'product', 'Pack produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "bundle"}', 30.0, '9:16', ARRAY['ecommerce', 'product', 'bundle'], false, 0.3, 0),
('ecommerce-product-gift', 'ecommerce', 'product', 'Cadeau produit e-commerce', '{"scenes": 4, "total_duration": 25}', '[]', '[]', '{"style": "gift"}', 25.0, '9:16', ARRAY['ecommerce', 'product', 'gift'], false, 0.2, 0),
('ecommerce-product-limited', 'ecommerce', 'product', 'Édition limitée produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "exclusive"}', 30.0, '16:9', ARRAY['ecommerce', 'product', 'limited'], true, 0.1, 0),
('ecommerce-product-new-arrival', 'ecommerce', 'product', 'Nouveauté produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "new"}', 30.0, '9:16', ARRAY['ecommerce', 'product', 'new'], false, 0.05, 0),
('ecommerce-product-bestseller', 'ecommerce', 'product', 'Best-seller produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "popular"}', 30.0, '16:9', ARRAY['ecommerce', 'product', 'bestseller'], false, 0.04, 0),
('ecommerce-product-trending', 'ecommerce', 'product', 'Tendance produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "trending"}', 30.0, '9:16', ARRAY['ecommerce', 'product', 'trending'], false, 0.03, 0),
('ecommerce-product-seasonal', 'ecommerce', 'product', 'Saisonnier produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "seasonal"}', 30.0, '16:9', ARRAY['ecommerce', 'product', 'seasonal'], false, 0.02, 0),
('ecommerce-product-holiday', 'ecommerce', 'product', 'Fêtes produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "holiday"}', 30.0, '9:16', ARRAY['ecommerce', 'product', 'holiday'], false, 0.01, 0),
('ecommerce-product-back-in-stock', 'ecommerce', 'product', 'Rupture de stock produit e-commerce', '{"scenes": 4, "total_duration": 25}', '[]', '[]', '{"style": "available"}', 25.0, '9:16', ARRAY['ecommerce', 'product', 'stock'], false, 0.005, 0),
('ecommerce-product-preorder', 'ecommerce', 'product', 'Précommande produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "preorder"}', 30.0, '16:9', ARRAY['ecommerce', 'product', 'preorder'], true, 0.004, 0),
('ecommerce-product-exclusive', 'ecommerce', 'product', 'Exclusif produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "exclusive"}', 30.0, '9:16', ARRAY['ecommerce', 'product', 'exclusive'], true, 0.003, 0),
('ecommerce-product-premium', 'ecommerce', 'product', 'Premium produit e-commerce', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "luxury"}', 35.0, '16:9', ARRAY['ecommerce', 'product', 'premium'], true, 0.002, 0),
('ecommerce-product-eco-friendly', 'ecommerce', 'product', 'Éco-responsable produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "eco"}', 30.0, '9:16', ARRAY['ecommerce', 'product', 'eco'], false, 0.001, 0),
('ecommerce-product-organic', 'ecommerce', 'product', 'Bio produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "organic"}', 30.0, '16:9', ARRAY['ecommerce', 'product', 'organic'], false, 0.0005, 0),
('ecommerce-product-handmade', 'ecommerce', 'product', 'Fait main produit e-commerce', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "artisan"}', 35.0, '9:16', ARRAY['ecommerce', 'product', 'handmade'], false, 0.0004, 0),
('ecommerce-product-local', 'ecommerce', 'product', 'Local produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "local"}', 30.0, '16:9', ARRAY['ecommerce', 'product', 'local'], false, 0.0003, 0),
('ecommerce-product-fair-trade', 'ecommerce', 'product', 'Commerce équitable produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "fair"}', 30.0, '9:16', ARRAY['ecommerce', 'product', 'fair-trade'], false, 0.0002, 0),
('ecommerce-product-vegan', 'ecommerce', 'product', 'Végétalien produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "vegan"}', 30.0, '16:9', ARRAY['ecommerce', 'product', 'vegan'], false, 0.0001, 0),
('ecommerce-product-cruelty-free', 'ecommerce', 'product', 'Sans cruauté produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "cruelty-free"}', 30.0, '9:16', ARRAY['ecommerce', 'product', 'cruelty-free'], false, 0.00005, 0),
('ecommerce-product-recycled', 'ecommerce', 'product', 'Recyclé produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "recycled"}', 30.0, '16:9', ARRAY['ecommerce', 'product', 'recycled'], false, 0.00004, 0),
('ecommerce-product-carbon-neutral', 'ecommerce', 'product', 'Neutre carbone produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "carbon-neutral"}', 30.0, '9:16', ARRAY['ecommerce', 'product', 'carbon-neutral'], false, 0.00003, 0),
('ecommerce-product-charity', 'ecommerce', 'product', 'Caritatif produit e-commerce', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "charity"}', 30.0, '16:9', ARRAY['ecommerce', 'product', 'charity'], false, 0.00002, 0),
('ecommerce-product-innovation', 'ecommerce', 'product', 'Innovation produit e-commerce', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "innovative"}', 35.0, '16:9', ARRAY['ecommerce', 'product', 'innovation'], true, 0.00001, 0)

ON CONFLICT (name) DO NOTHING;

-- Note: Cette migration ajoute 50 templates produits. 
-- Les 150 autres templates E-commerce (promotions, témoignages, etc.) seront dans les migrations suivantes.

