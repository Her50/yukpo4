# -*- coding: utf-8 -*-
import os

# Lire le fichier lib.rs
with open("backend/src/lib.rs", "r", encoding="utf-8") as f:
    content = f.read()

# Ajouter les imports CORS après use crate::state::AppState;
cors_imports = """
use crate::middlewares::cors::{create_cors_layer, create_public_cors_layer};
use crate::config::cloud_architecture::CloudArchitecture;
"""

# Trouver la position d'insertion
insert_pos = content.find("use crate::state::AppState;")
if insert_pos != -1:
    insert_pos += len("use crate::state::AppState;")
    new_content = content[:insert_pos] + cors_imports + content[insert_pos:]
    
    # Écrire le fichier modifié
    with open("backend/src/lib.rs", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Imports CORS ajoutés avec succès")
else:
    print("Position d'insertion non trouvée")
