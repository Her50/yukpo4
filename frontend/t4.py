# smart_ui_fix_applier.py

import os
import re
from pathlib import Path

REPORT_PATH = "ui_scan_report.md"
ROOT_DIR = "./src"
OUTPUT_LOG = "ui_fixes_applied.md"

responsive_prefixes = ["sm:", "md:", "lg:", "xl:", "2xl:"]
fix_count = 0
log_lines = []

def generate_responsive_variants(classes: str):
    unique_classes = list(set(classes.split()))
    responsive_classes = []
    for cls in unique_classes:
        for prefix in responsive_prefixes:
            responsive_classes.append(f"{prefix}{cls}")
    return " ".join(responsive_classes)

def fix_classes_in_file(file_path, issues):
    global fix_count
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    original = content
    for cls in issues:
        # Skip already responsive classes
        if any(cls.startswith(p) for p in responsive_prefixes):
            continue
        # Inject responsive variants next to original class
        pattern = re.escape(cls)
        responsive = generate_responsive_variants(cls)
        content = re.sub(pattern, f"{cls} {responsive}", content)

    if content != original:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        fix_count += 1
        log_lines.append(f"✅ Corrigé : {file_path}\n→ Classes adaptées : {len(issues)}\n")

def fix_image_paths(file_path):
    global fix_count
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    original = content

    # Fix <img src="/logo.png" /> or similar
    content = re.sub(r'src="\/([\w\-\.]+)"', r'src={require("./assets/\1")}', content)

    if content != original:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        fix_count += 1
        log_lines.append(f"🖼️ Chemin image corrigé dans : {file_path}\n")

def parse_report_and_fix():
    current_file = None
    issues = []

    with open(REPORT_PATH, "r", encoding="utf-8") as report:
        for line in report:
            line = line.strip()
            if line.startswith("### "):
                if current_file and issues:
                    fix_classes_in_file(current_file, issues)
                    issues = []
                current_file = line.replace("### ", "").strip()
            elif line.startswith("- ⚠️ Classe non responsive :"):
                cls = line.split(":")[-1].strip()
                issues.append(cls)
            elif line.startswith("- ❗ Image avec chemin absolu détectée."):
                if current_file:
                    fix_image_paths(current_file)

        # Final flush
        if current_file and issues:
            fix_classes_in_file(current_file, issues)

    with open(OUTPUT_LOG, "w", encoding="utf-8") as log:
        log.write(f"# ✅ Rapport de corrections UI appliquées\n\n")
        log.write(f"🛠 Total de fichiers corrigés : {fix_count}\n\n")
        log.write("\n".join(log_lines))

    print(f"\n✅ Fichier {OUTPUT_LOG} généré.")
    print(f"🛠 Total de fichiers corrigés : {fix_count}")

if __name__ == "__main__":
    print("🔍 Correction intelligente des classes Tailwind et chemins images…")
    parse_report_and_fix()
