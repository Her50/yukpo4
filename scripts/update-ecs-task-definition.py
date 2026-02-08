#!/usr/bin/env python3
"""
Script Python pour mettre a jour la task definition ECS avec ENABLE_AUTO_MIGRATIONS + S3
Usage: python scripts/update-ecs-task-definition.py
"""

import json
import subprocess
import sys

REGION = "us-east-1"
PROJECT_NAME = "yukpomnang"
ENVIRONMENT = "production"
TASK_FAMILY = f"{PROJECT_NAME}-backend"
CLUSTER_NAME = f"{PROJECT_NAME}-cluster"
SERVICE_NAME = f"{PROJECT_NAME}-backend-service"

def run_aws_command(cmd):
    """Execute une commande AWS CLI et retourne le resultat"""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Commande AWS echouee: {' '.join(cmd)}")
        print(f"        Erreur: {e.stderr}")
        sys.exit(1)

def main():
    print("[INFO] Recuperation de l'account ID...")
    account_id = run_aws_command([
        "aws", "sts", "get-caller-identity",
        "--region", REGION,
        "--query", "Account",
        "--output", "text"
    ])
    print(f"[OK] Account ID: {account_id}")

    print(f"[INFO] Export de la task definition '{TASK_FAMILY}'...")
    task_def_json = run_aws_command([
        "aws", "ecs", "describe-task-definition",
        "--task-definition", TASK_FAMILY,
        "--region", REGION,
        "--query", "taskDefinition",
        "--output", "json"
    ])

    task_def = json.loads(task_def_json)
    current_revision = task_def.get("revision", "?")
    print(f"[OK] Task definition recuperee (revision: {current_revision})")

    # Ajouter les secrets manquants
    secrets = task_def["containerDefinitions"][0]["secrets"]
    existing_names = {s["name"] for s in secrets}

    secrets_to_add = [
        ("ENABLE_AUTO_MIGRATIONS", f"arn:aws:ssm:{REGION}:{account_id}:parameter/{PROJECT_NAME}/{ENVIRONMENT}/ENABLE_AUTO_MIGRATIONS"),
        ("S3_BUCKET", f"arn:aws:ssm:{REGION}:{account_id}:parameter/{PROJECT_NAME}/{ENVIRONMENT}/S3_BUCKET"),
        ("S3_REGION", f"arn:aws:ssm:{REGION}:{account_id}:parameter/{PROJECT_NAME}/{ENVIRONMENT}/S3_REGION"),
        ("UPLOAD_BASE_URL", f"arn:aws:ssm:{REGION}:{account_id}:parameter/{PROJECT_NAME}/{ENVIRONMENT}/UPLOAD_BASE_URL"),
    ]

    added_count = 0
    for name, arn in secrets_to_add:
        if name not in existing_names:
            secrets.append({"name": name, "valueFrom": arn})
            print(f"[ADD] Ajout de {name}")
            added_count += 1
        else:
            print(f"[SKIP] {name} existe deja")

    if added_count == 0:
        print("[INFO] Aucun secret a ajouter. La task definition est deja a jour.")
        return

    # Supprimer les champs non necessaires pour register-task-definition
    fields_to_remove = [
        "taskDefinitionArn", "revision", "status", "requiresAttributes",
        "compatibilities", "registeredAt", "registeredBy"
    ]
    for field in fields_to_remove:
        task_def.pop(field, None)

    # Sauvegarder temporairement
    temp_file = "task-def-new.json"
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(task_def, f, indent=2)

    print(f"[INFO] Nouvelle task definition sauvegardee dans {temp_file}")
    print("[INFO] Enregistrement de la nouvelle task definition...")

    # Enregistrer
    register_output = run_aws_command([
        "aws", "ecs", "register-task-definition",
        "--cli-input-json", f"file://{temp_file}",
        "--region", REGION,
        "--output", "json"
    ])

    register_result = json.loads(register_output)
    new_revision = register_result["taskDefinition"]["revision"]
    print(f"[OK] Nouvelle task definition enregistree (revision: {new_revision})")

    # Mettre a jour le service
    print("[INFO] Mise a jour du service ECS...")
    run_aws_command([
        "aws", "ecs", "update-service",
        "--cluster", CLUSTER_NAME,
        "--service", SERVICE_NAME,
        "--task-definition", f"{TASK_FAMILY}:{new_revision}",
        "--region", REGION,
        "--force-new-deployment"
    ])

    print(f"[OK] Service ECS mis a jour avec succes!")
    print(f"[SUCCESS] Termine! Nouvelle revision: {TASK_FAMILY}:{new_revision}")
    print("\nVariables ajoutees:")
    for name, _ in secrets_to_add:
        if name not in existing_names:
            print(f"  - {name}")

    # Nettoyer
    import os
    try:
        os.remove(temp_file)
    except:
        pass

if __name__ == "__main__":
    main()








