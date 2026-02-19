"""
Script pour transformer le fichier Excel en format longitudinal
L'année devient une variable (colonne) avec les différentes années comme modalités
"""

import pandas as pd
import sys
import os

def transform_to_longitudinal(input_file, output_file=None):
    """
    Transforme un fichier Excel de format large (années en colonnes) 
    en format long (année comme variable)
    """
    
    print(f"Lecture du fichier: {input_file}")
    
    try:
        # Lire le fichier Excel
        df = pd.read_excel(input_file, sheet_name=0, header=0)
        
        print(f"\nDimensions du fichier original: {df.shape}")
        print(f"\nPremieres lignes:")
        print(df.head(5))
        print(f"\nColonnes: {df.columns.tolist()}")
        
        # Identifier les colonnes d'identifiants (les 4 premières)
        id_columns = df.columns[:4].tolist()
        print(f"\nColonnes d'identifiants: {id_columns}")
        
        # Identifier les colonnes d'années (2018-2025)
        year_columns = []
        for col in df.columns[4:]:
            if isinstance(col, (int, float)) and 2018 <= col <= 2025:
                year_columns.append(col)
            elif str(col).replace('.', '').isdigit():
                year_val = int(float(str(col)))
                if 2018 <= year_val <= 2025:
                    year_columns.append(col)
        
        print(f"Colonnes d'annees detectees: {year_columns}")
        
        # Structure: pour chaque année, il y a 2 colonnes consécutives
        # La colonne année contient les Accouchements
        # La colonne suivante (Unnamed) contient les Césariennes
        year_data_map = {}
        i = 4  # Commencer après les colonnes d'identifiants
        while i < len(df.columns):
            col = df.columns[i]
            if col in year_columns:
                # Trouver l'année
                if isinstance(col, (int, float)):
                    year = int(col)
                else:
                    year = int(float(str(col)))
                
                # La colonne suivante devrait être les Césariennes
                if i + 1 < len(df.columns):
                    ces_col = df.columns[i + 1]
                    year_data_map[year] = {'accouchements': col, 'cesarienne': ces_col}
                    i += 2
                else:
                    year_data_map[year] = {'accouchements': col}
                    i += 1
            else:
                i += 1
        
        print(f"\nMapping annee-colonnes: {year_data_map}")
        
        # Créer la liste des résultats
        result_rows = []
        
        # Parcourir chaque ligne de données
        for idx, row in df.iterrows():
            # Ignorer la ligne d'en-tête si elle existe
            first_val = str(row[id_columns[0]]).strip() if pd.notna(row[id_columns[0]]) else ""
            if first_val in ['Region', 'District', 'Aire de Santé', 'Aire de Sante', 'FOSA', 'nan']:
                print(f"Ligne {idx} ignoree (en-tete): {first_val}")
                continue
            
            # Extraire les identifiants
            identifiers = {id_col: row[id_col] for id_col in id_columns}
            
            # Pour chaque année
            for year in sorted(year_data_map.keys()):
                cols = year_data_map[year]
                
                # Accouchements
                val_acc = row[cols['accouchements']]
                if pd.notna(val_acc):
                    try:
                        val_acc = float(val_acc)
                    except:
                        pass
                    
                    row_data = identifiers.copy()
                    row_data['annee'] = year
                    row_data['type_donnee'] = 'Accouchement'  # Modalité sans 's'
                    row_data['valeur'] = val_acc
                    result_rows.append(row_data)
                
                # Césariennes (si la colonne existe)
                if 'cesarienne' in cols:
                    val_ces = row[cols['cesarienne']]
                    if pd.notna(val_ces):
                        try:
                            val_ces = float(val_ces)
                        except:
                            pass
                        
                        row_data = identifiers.copy()
                        row_data['annee'] = year
                        row_data['type_donnee'] = 'Césarienne'  # Avec accent
                        row_data['valeur'] = val_ces
                        result_rows.append(row_data)
        
        # Créer le dataframe final
        df_long = pd.DataFrame(result_rows)
        
        # Renommer les colonnes d'identifiants
        rename_map = {}
        if len(id_columns) >= 1:
            rename_map[id_columns[0]] = 'Region'
        if len(id_columns) >= 2:
            rename_map[id_columns[1]] = 'District'
        if len(id_columns) >= 3:
            rename_map[id_columns[2]] = 'Aire_de_Sante'
        if len(id_columns) >= 4:
            rename_map[id_columns[3]] = 'FOSA'
        
        df_long.rename(columns=rename_map, inplace=True)
        
        # Convertir l'année en entier
        df_long['annee'] = df_long['annee'].astype(int)
        
        # Trier par identifiants puis par année
        sort_cols = [col for col in ['Region', 'District', 'Aire_de_Sante', 'FOSA'] if col in df_long.columns]
        sort_cols.extend(['annee', 'type_donnee'])
        df_long = df_long.sort_values(by=sort_cols).reset_index(drop=True)
        
        print(f"\nTransformation reussie!")
        print(f"Nouvelles dimensions: {df_long.shape}")
        print(f"\nApercu du resultat:")
        print(df_long.head(30))
        print(f"\nColonnes finales: {df_long.columns.tolist()}")
        print(f"\nStatistiques par annee:")
        print(df_long.groupby('annee').size())
        print(f"\nStatistiques par type de donnee:")
        print(df_long.groupby('type_donnee').size())
        
        # Sauvegarder
        if output_file is None:
            base_name = os.path.splitext(input_file)[0]
            output_file = f"{base_name}_longitudinal.xlsx"
        
        df_long.to_excel(output_file, index=False)
        print(f"\nFichier sauvegarde: {output_file}")
        
        return df_long
        
    except Exception as e:
        print(f"Erreur: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    input_file = "DONNEES_DES_ACCOUCHEMENTS_ET_CESARIENNE_DE_2018_A_2025_PAR_FOSA.xls"
    
    if not os.path.exists(input_file):
        print(f"ERREUR: Fichier non trouve: {input_file}")
        print(f"Repertoire actuel: {os.getcwd()}")
        sys.exit(1)
    
    result = transform_to_longitudinal(input_file)
    
    if result is not None:
        print("\nTransformation terminee avec succes!")

