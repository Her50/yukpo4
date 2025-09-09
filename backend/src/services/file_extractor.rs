use base64::{engine::general_purpose, Engine as _};
use calamine::{open_workbook_from_rs, Reader, Xlsx, DataType};
use docx_rs::{read_docx, DocumentChild, ParagraphChild, RunChild};
use std::io::Cursor;
use crate::core::types::AppResult;
use serde_json::{json, Value};
// use std::collections::HashMap;

pub fn extract_text_from_base64(
    base64_content: &str,
    file_name: &str,
) -> Result<String, anyhow::Error> {
    let decoded_data = general_purpose::STANDARD.decode(base64_content)?;

    let extension = file_name.split('.').last().unwrap_or_default();

    match extension {
        "pdf" => extract_text_from_pdf(&decoded_data),
        "xlsx" => extract_text_from_excel(&decoded_data),
        "docx" => extract_text_from_docx(&decoded_data),
        _ => Ok(String::from_utf8_lossy(&decoded_data).to_string()),
    }
}

fn extract_text_from_pdf(data: &[u8]) -> Result<String, anyhow::Error> {
    let text = pdf_extract::extract_text_from_mem(data)?;
    Ok(text)
}

fn extract_text_from_excel(data: &[u8]) -> Result<String, anyhow::Error> {
    let mut workbook: Xlsx<_> = open_workbook_from_rs(Cursor::new(data))?;
    let mut text = String::new();

    for sheet_name in workbook.sheet_names() {
        if let Ok(range) = workbook.worksheet_range(&sheet_name) {
            for row in range.rows() {
                for cell in row {
                    if let Some(s) = cell.get_string() {
                        text.push_str(s);
                    } else if let Some(f) = cell.get_float() {
                        text.push_str(&f.to_string());
                    } else if let Some(i) = cell.get_int() {
                        text.push_str(&i.to_string());
                    } else if let Some(b) = cell.get_bool() {
                        text.push_str(&b.to_string());
                    }
                    text.push(' ');
                }
                text.push_str("\n");
            }
        }
    }
    Ok(text)
}

fn extract_text_from_docx(data: &[u8]) -> Result<String, anyhow::Error> {
    let docx = read_docx(data)?;
    let mut text = String::new();

    for child in docx.document.children {
        if let DocumentChild::Paragraph(p) = child {
            for p_child in p.children {
                if let ParagraphChild::Run(run) = p_child {
                    for r_child in run.children {
                        if let RunChild::Text(t) = r_child {
                            text.push_str(&t.text);
                        }
                    }
                }
            }
            text.push('\n');
        }
    }

    Ok(text)
}

/// ?? Extracteur universel de fichiers pour Yukpo
pub struct UniversalFileExtractor;

impl UniversalFileExtractor {
    pub fn new() -> Self {
        Self
    }

    /// ?? Extraction universelle de contenu depuis n'importe quel type de fichier
    pub async fn extract_universal_content(
        &self,
        file_data: &[u8],
        file_name: &str,
        mime_type: &str,
    ) -> AppResult<Value> {
        let mut extracted_data = json!({
            "file_info": {
                "name": file_name,
                "mime_type": mime_type,
                "size_bytes": file_data.len(),
                "extraction_method": "universal"
            },
            "content": {
                "text": "",
                "tables": [],
                "images": [],
                "structured_data": {},
                "products_list": [],
                "metadata": {}
            },
            "analysis": {
                "content_type": "unknown",
                "confidence": 0.0,
                "suggestions": []
            }
        });

        // 1. D?tection du type de contenu
        let content_type = self.detect_content_type(file_data, mime_type, file_name);
        extracted_data["analysis"]["content_type"] = json!(content_type);

        // 2. Extraction selon le type
        match content_type.as_str() {
            "excel" => {
                self.extract_excel_content(file_data, &mut extracted_data).await?;
            }
            "csv" => {
                self.extract_csv_content(file_data, &mut extracted_data).await?;
            }
            "pdf" => {
                self.extract_pdf_content(file_data, &mut extracted_data).await?;
            }
            "word" => {
                self.extract_word_content(file_data, &mut extracted_data).await?;
            }
            "image" => {
                self.extract_image_content(file_data, &mut extracted_data).await?;
            }
            "json" => {
                self.extract_json_content(file_data, &mut extracted_data).await?;
            }
            _ => {
                self.extract_generic_content(file_data, &mut extracted_data).await?;
            }
        }

        // 3. Analyse intelligente du contenu extrait
        self.analyze_extracted_content(&mut extracted_data).await?;

        Ok(extracted_data)
    }

    /// ?? D?tection automatique du type de contenu
    fn detect_content_type(&self, _data: &[u8], mime_type: &str, file_name: &str) -> String {
        // Par extension de fichier
        let extension = file_name.split('.').last().unwrap_or("").to_lowercase();
        match extension.as_str() {
            "xlsx" | "xls" => return "excel".to_string(),
            "csv" => return "csv".to_string(),
            "pdf" => return "pdf".to_string(),
            "doc" | "docx" => return "word".to_string(),
            "json" => return "json".to_string(),
            "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" => return "image".to_string(),
            _ => {}
        }

        // Par MIME type
        match mime_type {
            m if m.contains("spreadsheet") || m.contains("excel") => "excel".to_string(),
            m if m.contains("csv") => "csv".to_string(),
            m if m.contains("pdf") => "pdf".to_string(),
            m if m.contains("word") || m.contains("document") => "word".to_string(),
            m if m.contains("json") => "json".to_string(),
            m if m.starts_with("image/") => "image".to_string(),
            _ => "unknown".to_string(),
        }
    }

    /// ?? Extraction Excel
    async fn extract_excel_content(&self, _data: &[u8], extracted_data: &mut Value) -> AppResult<()> {
        // TODO: Impl?menter avec calamine
        // Pour l'instant, simulation
        extracted_data["content"]["text"] = json!("Contenu Excel extrait");
        extracted_data["content"]["tables"] = json!([
            {
                "name": "Feuil1",
                "headers": ["Nom", "Prix", "Quantit?", "Cat?gorie"],
                "rows": [
                    ["Produit 1", "1000", "5", "?lectronique"],
                    ["Produit 2", "500", "10", "V?tements"]
                ]
            }
        ]);
        
        // Extraction automatique des produits
        if let Some(tables) = extracted_data["content"]["tables"].as_array() {
            for table in tables {
                if let Some(products) = self.extract_products_from_table(table) {
                    extracted_data["content"]["products_list"] = json!(products);
                    break;
                }
            }
        }

        Ok(())
    }

    /// ?? Extraction CSV
    async fn extract_csv_content(&self, data: &[u8], extracted_data: &mut Value) -> AppResult<()> {
        // TODO: Impl?menter avec csv crate
        let csv_text = String::from_utf8_lossy(data);
        extracted_data["content"]["text"] = json!(csv_text);

        // Parsing CSV simple
        let lines: Vec<&str> = csv_text.lines().collect();
        if lines.len() > 1 {
            let headers: Vec<&str> = lines[0].split(',').collect();
            let mut rows = Vec::new();
            
            for line in lines.iter().skip(1) {
                let row: Vec<&str> = line.split(',').collect();
                if row.len() == headers.len() {
                    rows.push(row);
                }
            }

            extracted_data["content"]["tables"] = json!([
                {
                    "name": "CSV Data",
                    "headers": headers,
                    "rows": rows
                }
            ]);

            // Extraction produits
            if let Some(products) = self.extract_products_from_csv_headers(&headers, &rows) {
                extracted_data["content"]["products_list"] = json!(products);
            }
        }

        Ok(())
    }

    /// ?? Extraction PDF
    async fn extract_pdf_content(&self, _data: &[u8], extracted_data: &mut Value) -> AppResult<()> {
        // TODO: Impl?menter avec lopdf ou pdf-extract
        extracted_data["content"]["text"] = json!("Contenu PDF extrait");
        Ok(())
    }

    /// ?? Extraction Word
    async fn extract_word_content(&self, _data: &[u8], extracted_data: &mut Value) -> AppResult<()> {
        // TODO: Impl?menter avec docx-rs
        extracted_data["content"]["text"] = json!("Contenu Word extrait");
        Ok(())
    }

    /// ??? Extraction Image
    async fn extract_image_content(&self, data: &[u8], extracted_data: &mut Value) -> AppResult<()> {
        // TODO: Impl?menter OCR avec tesseract-rs
        extracted_data["content"]["text"] = json!("Texte extrait de l'image");
        extracted_data["content"]["images"] = json!([
            {
                "type": "uploaded",
                "size": data.len(),
                "ocr_text": "Produits disponibles: Ordinateur 500000 FCFA, T?l?phone 250000 FCFA"
            }
        ]);
        Ok(())
    }

    /// ?? Extraction JSON
    async fn extract_json_content(&self, data: &[u8], extracted_data: &mut Value) -> AppResult<()> {
        if let Ok(json_value) = serde_json::from_slice::<Value>(data) {
            extracted_data["content"]["structured_data"] = json_value.clone();
            extracted_data["content"]["text"] = json!(json_value.to_string());
            
            // Extraction automatique des produits depuis JSON
            if let Some(products) = self.extract_products_from_json(&json_value) {
                extracted_data["content"]["products_list"] = json!(products);
            }
        }
        Ok(())
    }

    /// ?? Extraction g?n?rique
    async fn extract_generic_content(&self, data: &[u8], extracted_data: &mut Value) -> AppResult<()> {
        let text = String::from_utf8_lossy(data);
        extracted_data["content"]["text"] = json!(text);
        Ok(())
    }

    /// ?? Analyse intelligente du contenu extrait
    async fn analyze_extracted_content(&self, extracted_data: &mut Value) -> AppResult<()> {
        let mut confidence: f64 = 0.0;
        let mut suggestions = Vec::new();

        // Analyse du texte
        if let Some(text) = extracted_data["content"]["text"].as_str() {
            if !text.is_empty() {
                confidence += 0.3;
                suggestions.push("Texte extrait avec succ?s".to_string());
            }
        }

        // Analyse des tableaux
        if let Some(tables) = extracted_data["content"]["tables"].as_array() {
            if !tables.is_empty() {
                confidence += 0.4;
                suggestions.push(format!("{} tableaux d?tect?s", tables.len()));
            }
        }

        // Analyse des produits
        if let Some(products) = extracted_data["content"]["products_list"].as_array() {
            if !products.is_empty() {
                confidence += 0.3;
                suggestions.push(format!("{} produits d?tect?s", products.len()));
            }
        }

        extracted_data["analysis"]["confidence"] = json!(confidence.min(1.0));
        extracted_data["analysis"]["suggestions"] = json!(suggestions);

        Ok(())
    }

    /// ??? Extraction automatique des produits depuis un tableau
    fn extract_products_from_table(&self, table: &Value) -> Option<Vec<Value>> {
        if let (Some(headers), Some(rows)) = (
            table.get("headers").and_then(|h| h.as_array()),
            table.get("rows").and_then(|r| r.as_array())
        ) {
            let mut products = Vec::new();
            
            for row in rows {
                if let Some(row_array) = row.as_array() {
                    let mut product = json!({
                        "type_donnee": "produit",
                        "origine_champs": "fichier_excel"
                    });

                    for (i, header) in headers.iter().enumerate() {
                        if let Some(header_str) = header.as_str() {
                            if i < row_array.len() {
                                let value = &row_array[i];
                                match header_str.to_lowercase().as_str() {
                                    "nom" | "name" | "produit" | "product" => {
                                        product["nom"] = json!({
                                            "type_donnee": "string",
                                            "valeur": value.as_str().unwrap_or(""),
                                            "origine_champs": "fichier_excel"
                                        });
                                    }
                                    "prix" | "price" | "montant" => {
                                        product["prix"] = json!({
                                            "type_donnee": "number",
                                            "valeur": value.as_f64().unwrap_or(0.0),
                                            "origine_champs": "fichier_excel"
                                        });
                                    }
                                    "quantit?" | "quantity" | "qte" => {
                                        product["quantite"] = json!({
                                            "type_donnee": "number",
                                            "valeur": value.as_f64().unwrap_or(1.0),
                                            "origine_champs": "fichier_excel"
                                        });
                                    }
                                    "cat?gorie" | "category" | "cat" => {
                                        product["categorie"] = json!({
                                            "type_donnee": "string",
                                            "valeur": value.as_str().unwrap_or(""),
                                            "origine_champs": "fichier_excel"
                                        });
                                    }
                                    _ => {
                                        // Champ g?n?rique
                                        product[header_str] = json!({
                                            "type_donnee": "string",
                                            "valeur": value.to_string(),
                                            "origine_champs": "fichier_excel"
                                        });
                                    }
                                }
                            }
                        }
                    }
                    
                    products.push(product);
                }
            }
            
            if !products.is_empty() {
                return Some(products);
            }
        }
        
        None
    }

    /// ??? Extraction produits depuis CSV
    fn extract_products_from_csv_headers(&self, headers: &[&str], rows: &[Vec<&str>]) -> Option<Vec<Value>> {
        let mut products = Vec::new();
        
        for row in rows {
            let mut product = json!({
                "type_donnee": "produit",
                "origine_champs": "fichier_csv"
            });

            for (i, header) in headers.iter().enumerate() {
                if i < row.len() {
                    let value = row[i];
                    match header.to_lowercase().as_str() {
                        "nom" | "name" | "produit" | "product" => {
                            product["nom"] = json!({
                                "type_donnee": "string",
                                "valeur": value,
                                "origine_champs": "fichier_csv"
                            });
                        }
                        "prix" | "price" | "montant" => {
                            product["prix"] = json!({
                                "type_donnee": "number",
                                "valeur": value.parse::<f64>().unwrap_or(0.0),
                                "origine_champs": "fichier_csv"
                            });
                        }
                        "quantit?" | "quantity" | "qte" => {
                            product["quantite"] = json!({
                                "type_donnee": "number",
                                "valeur": value.parse::<f64>().unwrap_or(1.0),
                                "origine_champs": "fichier_csv"
                            });
                        }
                        "cat?gorie" | "category" | "cat" => {
                            product["categorie"] = json!({
                                "type_donnee": "string",
                                "valeur": value,
                                "origine_champs": "fichier_csv"
                            });
                        }
                        _ => {
                            product[header] = json!({
                                "type_donnee": "string",
                                "valeur": value,
                                "origine_champs": "fichier_csv"
                            });
                        }
                    }
                }
            }
            
            products.push(product);
        }
        
        if !products.is_empty() {
            Some(products)
        } else {
            None
        }
    }

    /// ??? Extraction produits depuis JSON
    fn extract_products_from_json(&self, json_data: &Value) -> Option<Vec<Value>> {
        // Chercher des tableaux de produits dans le JSON
        if let Some(products_array) = json_data.get("produits")
            .or(json_data.get("products"))
            .or(json_data.get("listeproduit"))
            .and_then(|v| v.as_array())
        {
            let mut products = Vec::new();
            for product in products_array {
                let mut structured_product = json!({
                    "type_donnee": "produit",
                    "origine_champs": "fichier_json"
                });
                
                if let Some(product_obj) = product.as_object() {
                    for (key, value) in product_obj {
                        structured_product[key] = json!({
                            "type_donnee": self.infer_type_from_value(value),
                            "valeur": value.clone(),
                            "origine_champs": "fichier_json"
                        });
                    }
                }
                
                products.push(structured_product);
            }
            
            if !products.is_empty() {
                return Some(products);
            }
        }
        
        None
    }

    /// ?? Inf?rence du type depuis une valeur JSON
    fn infer_type_from_value(&self, value: &Value) -> &str {
        match value {
            Value::String(_) => "string",
            Value::Number(_) => "number",
            Value::Bool(_) => "boolean",
            Value::Array(_) => "array",
            Value::Object(_) => "object",
            Value::Null => "null",
        }
    }
}
