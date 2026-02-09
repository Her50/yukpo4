use serde_json::Value;

fn normalize_country(input: &str) -> String {
    input
        .trim()
        .to_lowercase()
        .replace('’', "'")
        .replace(['à', 'â', 'ä'], "a")
        .replace('ç', "c")
        .replace(['é', 'è', 'ê', 'ë'], "e")
        .replace(['î', 'ï'], "i")
        .replace(['ô', 'ö'], "o")
        .replace(['ù', 'û', 'ü'], "u")
        .replace('ÿ', "y")
        .replace('œ', "oe")
        .replace(['–', '—'], "-")
}

fn parse_country_from_string(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    let candidates: Vec<&str> = trimmed
        .split([',', ';', '|'])
        .map(|part| part.trim())
        .filter(|part| !part.is_empty())
        .collect();

    candidates
        .last()
        .map(|last| last.to_string())
        .filter(|country| !country.is_empty())
}

pub fn infer_currency(country: &str) -> Option<&'static str> {
    let normalized = normalize_country(country);
    match normalized.as_str() {
        "cameroun" | "cameroon" | "cam" => Some("XAF"),
        "tchad" | "chad" => Some("XAF"),
        "gabon" => Some("XAF"),
        "guinee equatoriale" | "guinée equatoriale" | "equatorial guinea" => Some("XAF"),
        "republique centrafricaine" | "république centrafricaine" | "central african republic" => {
            Some("XAF")
        }
        "republique du congo" | "république du congo" | "congo" | "congo-brazzaville" => {
            Some("XAF")
        }

        "benin" | "bénin" => Some("XOF"),
        "burkina faso" => Some("XOF"),
        "cote d'ivoire" | "côte d'ivoire" => Some("XOF"),
        "guinee-bissau" | "guinée-bissau" => Some("XOF"),
        "mali" => Some("XOF"),
        "niger" => Some("XOF"),
        "senegal" | "sénégal" => Some("XOF"),
        "togo" => Some("XOF"),

        "guinee" | "guinée" => Some("GNF"),
        "guinee conakry" | "guinée conakry" => Some("GNF"),
        "liberia" => Some("LRD"),
        "sierra leone" => Some("SLL"),
        "gambie" | "gambia" => Some("GMD"),
        "cap-vert" | "cape verde" => Some("CVE"),
        "mauritanie" | "mauritania" => Some("MRU"),

        "ghana" => Some("GHS"),
        "nigeria" | "nigéria" => Some("NGN"),

        "rd congo"
        | "rdc"
        | "republique democratique du congo"
        | "république démocratique du congo"
        | "democratic republic of the congo" => Some("CDF"),
        "rwanda" => Some("RWF"),
        "burundi" => Some("BIF"),
        "ethiopie" | "ethiopia" => Some("ETB"),
        "eritree" | "érythrée" | "eritrea" => Some("ERN"),
        "kenya" => Some("KES"),
        "ouganda" | "uganda" => Some("UGX"),
        "tanzanie" | "tanzania" => Some("TZS"),
        "somalie" | "somalia" => Some("SOS"),
        "soudan" => Some("SDG"),
        "soudan du sud" | "south sudan" => Some("SSP"),
        "djibouti" => Some("DJF"),

        "afrique du sud" | "south africa" => Some("ZAR"),
        "namibie" | "namibia" => Some("NAD"),
        "botswana" => Some("BWP"),
        "eswatini" | "swaziland" => Some("SZL"),
        "lesotho" => Some("LSL"),
        "zimbabwe" => Some("ZWL"),
        "zambie" | "zambia" => Some("ZMW"),
        "malawi" => Some("MWK"),
        "mozambique" => Some("MZN"),
        "angola" => Some("AOA"),
        "madagascar" => Some("MGA"),
        "maurice" | "mauritius" => Some("MUR"),
        "seychelles" => Some("SCR"),
        "comores" | "comoros" => Some("KMF"),
        "sao tome"
        | "são tomé"
        | "sao tomé"
        | "sao tome and principe"
        | "sao tome et principe"
        | "são tomé et príncipe" => Some("STN"),

        "maroc" | "morocco" => Some("MAD"),
        "algerie" | "algérie" | "algeria" => Some("DZD"),
        "tunisie" | "tunisia" => Some("TND"),
        "egypte" | "egypt" => Some("EGP"),
        "libye" | "libya" => Some("LYD"),

        "france" => Some("EUR"),
        "belgique" | "belgium" => Some("EUR"),
        "suisse" | "switzerland" => Some("CHF"),
        "canada" => Some("CAD"),
        "etats-unis" | "états-unis" | "usa" | "united states" => Some("USD"),
        "royaume-uni" | "uk" | "united kingdom" => Some("GBP"),

        _ => None,
    }
}

pub fn infer_country_code(country: &str) -> Option<&'static str> {
    let normalized = normalize_country(country);
    match normalized.as_str() {
        "cameroun" | "cameroon" | "cam" => Some("CM"),
        "tchad" | "chad" => Some("TD"),
        "gabon" => Some("GA"),
        "guinee equatoriale" | "guinée equatoriale" | "equatorial guinea" => Some("GQ"),
        "republique centrafricaine" | "république centrafricaine" | "central african republic" => {
            Some("CF")
        }
        "republique du congo" | "république du congo" | "congo" | "congo-brazzaville" => {
            Some("CG")
        }

        "benin" | "bénin" => Some("BJ"),
        "burkina faso" => Some("BF"),
        "cote d'ivoire" | "côte d'ivoire" => Some("CI"),
        "guinee-bissau" | "guinée-bissau" => Some("GW"),
        "mali" => Some("ML"),
        "niger" => Some("NE"),
        "senegal" | "sénégal" => Some("SN"),
        "togo" => Some("TG"),

        "guinee" | "guinée" => Some("GN"),
        "guinee conakry" | "guinée conakry" => Some("GN"),
        "liberia" => Some("LR"),
        "sierra leone" => Some("SL"),
        "gambie" | "gambia" => Some("GM"),
        "cap-vert" | "cape verde" => Some("CV"),
        "mauritanie" | "mauritania" => Some("MR"),

        "ghana" => Some("GH"),
        "nigeria" | "nigéria" => Some("NG"),

        "rd congo"
        | "rdc"
        | "republique democratique du congo"
        | "république démocratique du congo"
        | "democratic republic of the congo" => Some("CD"),
        "rwanda" => Some("RW"),
        "burundi" => Some("BI"),
        "ethiopie" | "ethiopia" => Some("ET"),
        "eritree" | "érythrée" | "eritrea" => Some("ER"),
        "kenya" => Some("KE"),
        "ouganda" | "uganda" => Some("UG"),
        "tanzanie" | "tanzania" => Some("TZ"),
        "somalie" | "somalia" => Some("SO"),
        "soudan" => Some("SD"),
        "soudan du sud" | "south sudan" => Some("SS"),
        "djibouti" => Some("DJ"),

        "afrique du sud" | "south africa" => Some("ZA"),
        "namibie" | "namibia" => Some("NA"),
        "botswana" => Some("BW"),
        "eswatini" | "swaziland" => Some("SZ"),
        "lesotho" => Some("LS"),
        "zimbabwe" => Some("ZW"),
        "zambie" | "zambia" => Some("ZM"),
        "malawi" => Some("MW"),
        "mozambique" => Some("MZ"),
        "angola" => Some("AO"),
        "madagascar" => Some("MG"),
        "maurice" | "mauritius" => Some("MU"),
        "seychelles" => Some("SC"),
        "comores" | "comoros" => Some("KM"),
        "sao tome"
        | "são tomé"
        | "sao tomé"
        | "sao tome and principe"
        | "sao tome et principe"
        | "são tomé et príncipe" => Some("ST"),

        "maroc" | "morocco" => Some("MA"),
        "algerie" | "algérie" | "algeria" => Some("DZ"),
        "tunisie" | "tunisia" => Some("TN"),
        "egypte" | "egypt" => Some("EG"),
        "libye" | "libya" => Some("LY"),

        "france" => Some("FR"),
        "belgique" | "belgium" => Some("BE"),
        "suisse" | "switzerland" => Some("CH"),
        "canada" => Some("CA"),
        "etats-unis" | "états-unis" | "usa" | "united states" => Some("US"),
        "royaume-uni" | "uk" | "united kingdom" => Some("GB"),
        "espagne" | "spain" => Some("ES"),
        "italie" | "italy" => Some("IT"),
        "portugal" => Some("PT"),

        _ => None,
    }
}

pub fn extract_country(value: &Value) -> Option<String> {
    match value {
        Value::Null => None,
        Value::String(s) => parse_country_from_string(s),
        Value::Array(arr) => {
            for element in arr.iter().rev() {
                if let Some(country) = extract_country(element) {
                    if !country.trim().is_empty() {
                        return Some(country);
                    }
                }
            }
            None
        }
        Value::Object(map) => {
            if let Some(valeur) = map.get("valeur") {
                if let Some(country) = extract_country(valeur) {
                    return Some(country);
                }
            }
            if let Some(components) = map.get("components").and_then(|v| v.as_object()) {
                if let Some(pays) = components
                    .get("pays")
                    .or_else(|| components.get("country"))
                    .and_then(|v| v.as_str())
                {
                    return Some(pays.to_string());
                }
            }
            if let Some(location_vector) = map.get("location_vector") {
                if let Some(country) = extract_country(location_vector) {
                    return Some(country);
                }
            }
            if let Some(raw) = map.get("raw").and_then(|v| v.as_str()) {
                if let Some(country) = parse_country_from_string(raw) {
                    return Some(country);
                }
            }
            if let Some(place_name) = map.get("place_name").and_then(|v| v.as_str()) {
                if let Some(country) = parse_country_from_string(place_name) {
                    return Some(country);
                }
            }
            None
        }
        _ => None,
    }
}

fn ensure_modalite_currency(modalite: &mut Value, country: Option<&str>) {
    let needs_devise = modalite
        .get("devise")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().is_empty())
        .unwrap_or(true);

    if needs_devise {
        if let Some(country_name) = country {
            if let Some(currency) = infer_currency(country_name) {
                if let Some(obj) = modalite.as_object_mut() {
                    obj.insert("devise".to_string(), Value::String(currency.to_string()));
                }
            }
        }
    }
}

fn ensure_product_currency(product: &mut Value, service_country: Option<&str>) {
    let product_country = product
        .get("location_vector")
        .and_then(|v| {
            extract_country(v).or_else(|| {
                v.as_array()
                    .and_then(|arr| arr.last())
                    .and_then(|last| last.as_str().map(|s| s.to_string()))
            })
        })
        .or_else(|| product.get("lieu_produit").and_then(extract_country))
        .or_else(|| product.get("lieu").and_then(extract_country))
        .or_else(|| service_country.map(|s| s.to_string()));

    let needs_devise = product
        .get("devise")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().is_empty())
        .unwrap_or(true);

    if needs_devise {
        if let Some(country_name) = product_country.as_deref() {
            if let Some(currency) = infer_currency(country_name) {
                if let Some(obj) = product.as_object_mut() {
                    obj.insert("devise".to_string(), Value::String(currency.to_string()));
                }
            }
        }
    }

    // Inject currency into price variations if missing
    if let Some(variation) = product.get_mut("variation_prix") {
        if let Some(modalites) = variation.get_mut("modalites").and_then(|v| v.as_array_mut()) {
            for modalite in modalites {
                ensure_modalite_currency(modalite, product_country.as_deref());
            }
        }
    }
}

pub fn auto_fill_currencies(service_data: &mut Value) {
    let mut service_country = service_data.get("lieu_produit").and_then(extract_country);

    if service_country.is_none() {
        service_country = service_data.get("location_vector").and_then(extract_country);
    }

    if let Some(products_value) = service_data.get_mut("produits") {
        match products_value {
            Value::Array(products) => {
                for product in products.iter_mut() {
                    ensure_product_currency(product, service_country.as_deref());
                }
            }
            Value::Object(obj) => {
                if let Some(valeur) = obj.get_mut("valeur").and_then(|v| v.as_array_mut()) {
                    for product in valeur.iter_mut() {
                        ensure_product_currency(product, service_country.as_deref());
                    }
                } else {
                    ensure_product_currency(products_value, service_country.as_deref());
                }

                if let Value::Object(obj_inner) = products_value {
                    if obj_inner
                        .get("devise")
                        .and_then(|v| v.as_str())
                        .map(|s| s.trim().is_empty())
                        .unwrap_or(true)
                    {
                        if let Some(country_name) = service_country.as_deref() {
                            if let Some(currency) = infer_currency(country_name) {
                                obj_inner.insert(
                                    "devise".to_string(),
                                    Value::String(currency.to_string()),
                                );
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }
}
