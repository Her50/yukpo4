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
    
    # Lire le fichier Excel
    try:
        excel_file = pd.ExcelFile(input_file)
        print(f"\nFeuilles disponibles: {excel_file.sheet_names}")
        
        # Lire la première ligne comme en-tête pour comprendre la structure
        df_header = pd.read_excel(input_file, sheet_name=0, nrows=1, header=None)
        header_row = df_header.values[0]
        print(f"\nPremiere ligne (en-tete):")
        print(header_row)
        
        # Lire le fichier complet sans en-tête pour avoir plus de contrôle
        df = pd.read_excel(input_file, sheet_name=0, header=0)
        
        # Supprimer la première ligne si c'est un en-tête (vérifier si elle contient "Region", "District", etc.)
        if df.iloc[0, 0] == 'Region' or df.iloc[0, 0] == 'Region':
            df = df.iloc[1:].reset_index(drop=True)
            print("\nPremiere ligne (en-tete) supprimee des donnees")
        
        # Renommer les colonnes d'identifiants avec les noms de la première ligne
        # Les 4 premières colonnes sont probablement: Region, District, Aire de Santé, et une autre
        if len(df.columns) >= 4:
            # Utiliser les valeurs de la première ligne pour renommer
            first_data_row = df.iloc[0] if len(df) > 0 else None
            if first_data_row is not None:
                # Les colonnes d'identifiants sont les premières
                id_col_names = ['Region', 'District', 'Aire_de_Sante', 'FOSA']
                for i, col_name in enumerate(id_col_names):
                    if i < len(df.columns):
                        df.rename(columns={df.columns[i]: col_name}, inplace=True)
        
        print(f"\nDimensions du fichier: {df.shape}")
        print(f"\nPremieres lignes du fichier:")
        print(df.head(10))
        print(f"\nColonnes du fichier:")
        print(df.columns.tolist())
        
        # Identifier les colonnes d'années et les colonnes "Unnamed" associées
        # Structure observée: Unnamed: 0, Unnamed: 1, Unnamed: 2, Unnamed: 3, 2018, Unnamed: 5, 2019, ...
        # Il semble y avoir 2 colonnes par année: une pour Accouchements et une pour Cesarienne
        
        year_columns = []
        id_columns = []
        year_data_pairs = {}  # {année: [col_accouchements, col_cesarienne]}
        
        i = 0
        while i < len(df.columns):
            col = df.columns[i]
            
            # Vérifier si la colonne est une année
            is_year = False
            year_val = None
            
            if isinstance(col, (int, float)) and 2018 <= col <= 2025:
                is_year = True
                year_val = int(col)
            elif str(col).isdigit() and 2018 <= int(str(col)) <= 2025:
                is_year = True
                year_val = int(str(col))
            
            if is_year:
                # Colonne année trouvée
                year_columns.append(col)
                # La colonne suivante (Unnamed) devrait être la deuxième variable
                if i + 1 < len(df.columns) and 'Unnamed' in str(df.columns[i + 1]):
                    year_data_pairs[year_val] = [col, df.columns[i + 1]]
                    i += 2  # Passer les deux colonnes
                else:
                    year_data_pairs[year_val] = [col]
                    i += 1
            else:
                # Colonne d'identifiant
                if 'Unnamed' not in str(col) or i < 4:  # Garder les premières colonnes comme identifiants
                    id_columns.append(col)
                i += 1
        
        print(f"\nColonnes identifiees comme annees: {year_columns}")
        print(f"Paires annee-donnees: {year_data_pairs}")
        print(f"Colonnes identifiees comme identifiants: {id_columns[:10]}...")  # Limiter l'affichage
        
        if not year_columns:
            print("\nATTENTION: Aucune colonne d'annee detectee automatiquement.")
            print("Veuillez verifier la structure du fichier.")
            return df
        
        # Créer une liste pour stocker les données transformées
        result_rows = []
        
        # Pour chaque ligne du dataframe original
        for idx, row in df.iterrows():
            # Ignorer les lignes qui sont des en-têtes (vérifier si la première colonne contient "Region", "District", etc.)
            first_col_val = str(row[id_columns[0]]) if id_columns and id_columns[0] in df.columns else None
            if first_col_val in ['Region', 'District', 'Aire de Santé', 'Aire de Sante', 'FOSA']:
                print(f"\nLigne {idx} ignoree (en-tete): {first_col_val}")
                continue
            
            # Extraire les identifiants
            row_id = {col: row[col] for col in id_columns if col in df.columns}
            
            # Pour chaque année
            for year in sorted(year_data_pairs.keys()):
                cols = year_data_pairs[year]
                
                # Créer une ligne pour chaque variable de l'année
                if len(cols) == 2:
                    # Deux colonnes: probablement Accouchements et Cesarienne
                    # La colonne année contient les Accouchements, la colonne Unnamed contient les Césariennes
                    val_acc = row[cols[0]]
                    val_ces = row[cols[1]]
                    
                    # Ne créer des lignes que si au moins une valeur existe
                    if pd.notna(val_acc) or pd.notna(val_ces):
                        if pd.notna(val_acc):
                            row_data = row_id.copy()
                            row_data['annee'] = year
                            row_data['type_donnee'] = 'Accouchements'
                            # Convertir en nombre si possible
                            try:
                                row_data['valeur'] = float(val_acc) if pd.notna(val_acc) else None
                            except:
                                row_data['valeur'] = val_acc
                            result_rows.append(row_data)
                        
                        if pd.notna(val_ces):
                            row_data2 = row_id.copy()
                            row_data2['annee'] = year
                            row_data2['type_donnee'] = 'Cesarienne'
                            # Convertir en nombre si possible
                            try:
                                row_data2['valeur'] = float(val_ces) if pd.notna(val_ces) else None
                            except:
                                row_data2['valeur'] = val_ces
                            result_rows.append(row_data2)
                else:
                    # Une seule colonne
                    val = row[cols[0]]
                    if pd.notna(val):
                        row_data = row_id.copy()
                        row_data['annee'] = year
                        try:
                            row_data['valeur'] = float(val) if pd.notna(val) else None
                        except:
                            row_data['valeur'] = val
                        result_rows.append(row_data)
        
        # Créer le dataframe longitudinal
        df_long = pd.DataFrame(result_rows)
        
        # Convertir l'année en entier
        df_long['annee'] = df_long['annee'].astype(int)
        
        print(f"\nTransformation reussie!")
        print(f"Nouvelles dimensions: {df_long.shape}")
        print(f"\nApercu du resultat:")
        print(df_long.head(20))
        print(f"\nColonnes du resultat:")
        print(df_long.columns.tolist())
        
        # Renommer les colonnes d'identifiants dans le résultat
        if 'Unnamed: 0' in df_long.columns:
            df_long.rename(columns={'Unnamed: 0': 'Region'}, inplace=True)
        if 'Unnamed: 1' in df_long.columns:
            df_long.rename(columns={'Unnamed: 1': 'District'}, inplace=True)
        if 'Unnamed: 2' in df_long.columns:
            df_long.rename(columns={'Unnamed: 2': 'Aire_de_Sante'}, inplace=True)
        if 'Unnamed: 3' in df_long.columns:
            df_long.rename(columns={'Unnamed: 3': 'FOSA'}, inplace=True)
        
        # Sauvegarder le résultat
        if output_file is None:
            base_name = input_file.replace('.xls', '').replace('.xlsx', '')
            output_file = f"{base_name}_longitudinal.xlsx"
        
        df_long.to_excel(output_file, index=False)
        print(f"\nFichier sauvegarde: {output_file}")
        
        return df_long
        
    except Exception as e:
        print(f"Erreur lors de la lecture: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    # Chemin du fichier
    input_file = "DONNEES_DES_ACCOUCHEMENTS_ET_CESARIENNE_DE_2018_A_2025_PAR_FOSA.xls"
    
    # Vérifier si le fichier existe
    if not os.path.exists(input_file):
        print(f"ERREUR: Fichier non trouve: {input_file}")
        print(f"Repertoire actuel: {os.getcwd()}")
        sys.exit(1)
    
    # Transformer le fichier
    result = transform_to_longitudinal(input_file)
    
    if result is not None:
        print("\nTransformation terminee avec succes!")

