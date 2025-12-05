#!/usr/bin/env python3
"""
Script pour générer des migrations SQL de templates
Usage: python generate_templates_migration.py <industry> <count> <output_file>
"""

import sys

INDUSTRIES = {
    'ecommerce': {
        'subcategories': ['product', 'promotion', 'testimonial', 'review', 'category'],
        'formats': ['9:16', '16:9', '1:1'],
        'styles': ['premium', 'dynamic', 'informative', 'trustworthy', 'exciting']
    },
    'services': {
        'subcategories': ['presentation', 'testimonial', 'offer', 'case-study', 'team'],
        'formats': ['16:9', '9:16', '1:1'],
        'styles': ['professional', 'trustworthy', 'warm', 'informative', 'engaging']
    },
    'creators': {
        'subcategories': ['vlog', 'tutorial', 'behind-scenes', 'qna', 'challenge'],
        'formats': ['9:16', '16:9', '1:1'],
        'styles': ['authentic', 'educational', 'fun', 'personal', 'creative']
    },
    'business': {
        'subcategories': ['corporate', 'presentation', 'recruitment', 'event', 'announcement'],
        'formats': ['16:9', '9:16'],
        'styles': ['professional', 'corporate', 'formal', 'trustworthy', 'innovative']
    },
    'social_media': {
        'subcategories': ['tiktok', 'reels', 'stories', 'shorts', 'post'],
        'formats': ['9:16', '1:1', '4:5'],
        'styles': ['energetic', 'trendy', 'authentic', 'fun', 'viral']
    }
}

def generate_template_name(industry, subcategory, index):
    return f'{industry}-{subcategory}-{index:03d}'

def generate_sql(industry, count, output_file):
    config = INDUSTRIES[industry]
    subcategories = config['subcategories']
    formats = config['formats']
    styles = config['styles']
    
    templates_per_subcat = count // len(subcategories)
    remaining = count % len(subcategories)
    
    sql_lines = [
        f"-- ✅ Migration pour enrichir templates {industry} ({count} templates)",
        "-- Date: 2025-01-27",
        f"-- Objectif: Ajouter {count} templates {industry} pour atteindre 1000+ templates",
        "",
        "INSERT INTO video_templates (name, industry, subcategory, description, timeline, effects, transitions, style, duration, format, tags, is_premium, popularity_score, usage_count) VALUES"
    ]
    
    values = []
    template_index = 0
    
    for subcat_idx, subcategory in enumerate(subcategories):
        count_for_subcat = templates_per_subcat + (1 if subcat_idx < remaining else 0)
        
        for i in range(count_for_subcat):
            template_name = generate_template_name(industry, subcategory, template_index)
            format_type = formats[template_index % len(formats)]
            style_type = styles[template_index % len(styles)]
            scenes = 4 + (template_index % 5)
            duration = 20.0 + (template_index % 20) * 1.0
            is_premium = template_index % 5 == 0
            popularity = 10.0 - (template_index * 0.1)
            
            value = f"('{template_name}', '{industry}', '{subcategory}', 'Template {industry} {subcategory} {template_index}', '{{\"scenes\": {scenes}, \"total_duration\": {duration}}}', '[]', '[]', '{{\"style\": \"{style_type}\"}}', {duration}, '{format_type}', ARRAY['{industry}', '{subcategory}'], {str(is_premium).lower()}, {popularity:.2f}, 0)"
            values.append(value)
            template_index += 1
    
    # Joindre les valeurs avec des virgules
    sql_lines.append(",\n".join(values))
    sql_lines.append("\nON CONFLICT (name) DO NOTHING;")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_lines))
    
    print(f"✅ Migration générée: {output_file} ({count} templates)")

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print("Usage: python generate_templates_migration.py <industry> <count> <output_file>")
        sys.exit(1)
    
    industry = sys.argv[1]
    count = int(sys.argv[2])
    output_file = sys.argv[3]
    
    if industry not in INDUSTRIES:
        print(f"❌ Industrie inconnue: {industry}")
        print(f"Industries disponibles: {', '.join(INDUSTRIES.keys())}")
        sys.exit(1)
    
    generate_sql(industry, count, output_file)

