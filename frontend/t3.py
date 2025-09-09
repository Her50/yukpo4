import os

TARGET_IMPORT = 'import { Button } from "@/components/ui/button";'
REPLACEMENT_IMPORT = 'import { Button } from "@/components/ui/buttons";'

def replace_imports_in_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    changed = False
    new_lines = []
    for line in lines:
        if TARGET_IMPORT in line:
            new_lines.append(REPLACEMENT_IMPORT + "\n")
            changed = True
        else:
            new_lines.append(line)

    if changed:
        with open(file_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
        print(f"✅ Modifié : {file_path}")

def scan_tsx_files(base_dir):
    for root, _, files in os.walk(base_dir):
        for file in files:
            if file.endswith(".tsx"):
                replace_imports_in_file(os.path.join(root, file))

if __name__ == "__main__":
    source_dir = os.path.join(os.getcwd(), "src")
    if os.path.isdir(source_dir):
        scan_tsx_files(source_dir)
    else:
        print("❌ Dossier src/ introuvable. Veuillez lancer le script depuis le dossier frontend.")
