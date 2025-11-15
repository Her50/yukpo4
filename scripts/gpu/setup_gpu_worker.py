#!/usr/bin/env python3
"""
Automate the provisioning of the Yukpo Remotion GPU worker on the Hetzner VM.

This script:
  1. Charge la configuration (JSON) décrivant l'hôte GPU et les variables renderer.
  2. Vérifie que `ssh` et `scp` sont disponibles localement.
  3. Installe Docker + NVIDIA Container Toolkit côté VM.
  4. Crée les volumes /srv/yukpo/{jobs,cache,video-renderer}.
  5. Déploie le fichier d'environnement + l'unité systemd `yukpo-renderer.service`.
  6. Redémarre le service et exécute une vérification de santé.

Pré-requis :
  - Lancer depuis WSL ou toute machine ayant accès SSH à la VM.
  - `gpu_worker_config.json` rempli (host, env, secrets).
  - L'utilisateur doit disposer des droits sudo sur la VM (root recommandé).
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from textwrap import dedent
from typing import Dict, List, Tuple


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = REPO_ROOT / "gpu_worker_config.json"
SYSTEMD_UNIT_PATH = "/etc/systemd/system/yukpo-renderer.service"
ENV_FILE_PATH = "/etc/yukpo-renderer.env"
SERVICE_NAME = "yukpo-renderer"


class SetupError(RuntimeError):
    """Erreur contrôlée levée lors d'un échec d'étape."""


@dataclass
class GPUWorkerConfig:
    host: str
    ssh_user: str = "root"
    ssh_port: int = 22
    renderer_port: int = 8088
    docker_image: str = "yukpo/video-renderer-gpu:latest"
    use_s3_upload: bool = False
    volumes: Dict[str, str] = field(
        default_factory=lambda: {
            "jobs": "/srv/yukpo/jobs",
            "cache": "/srv/yukpo/cache",
            "project_root": "/srv/yukpo/video-renderer",
        }
    )
    video_renderer_env: Dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict) -> "GPUWorkerConfig":
        if "host" not in data:
            raise SetupError("Le champ obligatoire 'host' est absent du fichier de configuration.")
        cfg = cls(
            host=data["host"],
            ssh_user=data.get("ssh_user", "root"),
            ssh_port=int(data.get("ssh_port", 22)),
            renderer_port=int(data.get("renderer_port", 8088)),
            docker_image=data.get("docker_image", "yukpo/video-renderer-gpu:latest"),
            use_s3_upload=bool(data.get("use_s3_upload", False)),
            volumes=data.get("volumes") or {},
            video_renderer_env=data.get("video_renderer_env") or {},
        )
        cfg._apply_defaults()
        return cfg

    def _apply_defaults(self) -> None:
        """Injecte les valeurs par défaut manquantes dans la configuration."""
        defaults = {
            "jobs": "/srv/yukpo/jobs",
            "cache": "/srv/yukpo/cache",
            "project_root": "/srv/yukpo/video-renderer",
        }
        for key, value in defaults.items():
            self.volumes.setdefault(key, value)

        env_defaults = {
            "RENDER_SERVER": f"http://{self.host}:{self.renderer_port}",
            "VIDEO_RENDERER_ENABLE_GPU": "true",
            "VIDEO_RENDERER_TIMEOUT_SECS": "900",
            "VIDEO_RENDERER_MAX_RETRIES": "2",
            "VIDEO_RENDERER_SHARED_VOLUME": self.volumes["jobs"],
            "VIDEO_RENDERER_PROJECT_ROOT": self.volumes["project_root"],
            "VIDEO_RENDERER_BROWSER_DOWNLOAD_DIR": f"{self.volumes['cache']}/chromium",
            "VIDEO_RENDERER_NODE_BIN": "/usr/local/bin/node",
            "VIDEO_RENDERER_CHROMIUM_EXECUTABLE": "/usr/bin/chromium",
        }
        for key, value in env_defaults.items():
            self.video_renderer_env.setdefault(key, value)

        # Harmonise le flag S3 entre le booléen principal et l'environnement docker.
        s3_flag = "true" if self.use_s3_upload else "false"
        self.video_renderer_env.setdefault("RENDERER_S3_UPLOAD", s3_flag)
        if not self.use_s3_upload:
            for optional_key in ("S3_BUCKET", "S3_REGION", "S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY"):
                self.video_renderer_env.setdefault(optional_key, "")


def run_local(cmd: List[str], *, check: bool = True) -> None:
    """Exécute une commande locale tout en journalisant la sortie."""
    print(f"[local] {' '.join(cmd)}")
    subprocess.run(cmd, check=check)


def run_remote(ssh_target: List[str], remote_cmd: str) -> None:
    """Envoie une commande sur l'hôte distant via SSH."""
    full_cmd = ssh_target + ["bash", "-lc", remote_cmd]
    print(f"[remote] {remote_cmd}")
    subprocess.run(full_cmd, check=True)


def upload_via_ssh(ssh_target: List[str], remote_path: str, content: str, sudo: bool = True) -> None:
    """Upload d'un contenu via un heredoc en SSH (sans scp)."""
    heredoc = f"cat <<'EOF' | {'sudo ' if sudo else ''}tee {remote_path} >/dev/null\n{content}\nEOF"
    run_remote(ssh_target, heredoc)


def ensure_cli_tools() -> None:
    for tool in ("ssh",):
        if shutil.which(tool) is None:
            raise SetupError(f"L'outil requis '{tool}' est introuvable dans le PATH.")


def build_ssh_target(cfg: GPUWorkerConfig, ssh_args: List[str]) -> List[str]:
    base = ["ssh", "-p", str(cfg.ssh_port), "-o", "StrictHostKeyChecking=no"]
    if ssh_args:
        base.extend(ssh_args)
    base.append(f"{cfg.ssh_user}@{cfg.host}")
    return base


def render_env_file(env: Dict[str, str]) -> str:
    lines = [f'{key}="{value}"' for key, value in sorted(env.items())]
    return "\n".join(lines) + "\n"


def render_systemd_unit(cfg: GPUWorkerConfig, include_pull: bool) -> str:
    jobs = cfg.volumes["jobs"]
    cache = cfg.volumes["cache"]
    project = cfg.volumes["project_root"]
    pull_line = (
        f"ExecStartPre=/usr/bin/docker pull {cfg.docker_image}"
        if include_pull
        else "# ExecStartPre skipped (image pull désactivé)"
    )
    unit = f"""
    [Unit]
    Description=Yukpo Remotion GPU Renderer
    After=docker.service
    Requires=docker.service

    [Service]
    Type=simple
    Restart=always
    RestartSec=5
    EnvironmentFile={ENV_FILE_PATH}
    ExecStartPre=-/usr/bin/docker rm -f {SERVICE_NAME}
    {pull_line}
    ExecStart=/usr/bin/docker run --gpus all --rm \\
      --name {SERVICE_NAME} \\
      -p {cfg.renderer_port}:8088 \\
      -v {jobs}:{jobs} \\
      -v {cache}:{cache} \\
      -v {project}:{project} \\
      --env-file {ENV_FILE_PATH} \\
      {cfg.docker_image}
    ExecStop=/usr/bin/docker stop {SERVICE_NAME}

    [Install]
    WantedBy=multi-user.target
    """
    return dedent(unit).strip() + "\n"


def run_remote_script(ssh_target: List[str], script_lines: List[str]) -> None:
    script = "set -euo pipefail\n" + "\n".join(script_lines)
    run_remote(ssh_target, script)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Provisionner le worker Remotion GPU sur Hetzner.")
    parser.add_argument(
        "-c",
        "--config",
        type=Path,
        default=DEFAULT_CONFIG,
        help=f"Chemin vers le fichier de configuration JSON (défaut: {DEFAULT_CONFIG})",
    )
    parser.add_argument(
        "--skip-image-pull",
        action="store_true",
        help="Ne pas lancer 'docker pull' dans l'unité systemd (utile si image déjà taggée localement).",
    )
    parser.add_argument(
        "--ssh-arg",
        action="append",
        default=[],
        help="Arguments supplémentaires passés à ssh (peut être utilisé plusieurs fois).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    ensure_cli_tools()

    if not args.config.exists():
        raise SetupError(f"Fichier de configuration introuvable: {args.config}")

    cfg = GPUWorkerConfig.from_dict(json.loads(args.config.read_text()))
    ssh_target = build_ssh_target(cfg, args.ssh_arg)

    print("=== Étape 1: Installation des dépendances système ===")
    dependency_script = [
        "sudo apt-get update -y",
        "sudo apt-get install -y docker.io docker-compose-plugin curl jq nvidia-driver-535 nvidia-container-toolkit",
        "sudo systemctl enable --now docker",
        "if command -v nvidia-ctk >/dev/null 2>&1; then sudo nvidia-ctk runtime configure --runtime=docker || true; fi",
        "sudo systemctl restart docker",
    ]
    run_remote_script(ssh_target, dependency_script)

    print("\n=== Étape 2: Préparation des volumes ===")
    volume_script = [
        f"sudo mkdir -p {cfg.volumes['jobs']} {cfg.volumes['cache']} {cfg.volumes['project_root']}",
        f"sudo chown -R {cfg.ssh_user}:{cfg.ssh_user} {cfg.volumes['cache']} {cfg.volumes['project_root']}",
        f"sudo chmod 775 {cfg.volumes['jobs']} {cfg.volumes['cache']} {cfg.volumes['project_root']}",
    ]
    run_remote_script(ssh_target, volume_script)

    print("\n=== Étape 3: Déploiement du fichier d'environnement ===")
    env_content = render_env_file(cfg.video_renderer_env)
    upload_via_ssh(ssh_target, ENV_FILE_PATH, env_content, sudo=True)

    print("\n=== Étape 4: Déploiement de l'unité systemd ===")
    unit_content = render_systemd_unit(cfg, include_pull=not args.skip_image_pull)
    upload_via_ssh(ssh_target, SYSTEMD_UNIT_PATH, unit_content, sudo=True)
    run_remote_script(ssh_target, ["sudo systemctl daemon-reload", f"sudo systemctl enable --now {SERVICE_NAME}"])

    print("\n=== Étape 5: Redémarrage & vérifications ===")
    status_script = [
        f"sudo systemctl restart {SERVICE_NAME}",
        f"sudo systemctl status {SERVICE_NAME} --no-pager | tail -n 20",
        f"sudo docker ps --filter name={SERVICE_NAME}",
        f"curl -fsS http://127.0.0.1:{cfg.renderer_port}/health || (sleep 3 && curl -fsS http://127.0.0.1:{cfg.renderer_port}/health)",
    ]
    run_remote_script(ssh_target, status_script)

    print(
        dedent(
            f"""
            ✅ Worker GPU déployé.
              - Endpoint santé : http://{cfg.host}:{cfg.renderer_port}/health
              - Service systemd : {SERVICE_NAME}
              - Env file : {ENV_FILE_PATH}

            Pensez à:
              • Configurer VIDEO_RENDERER_RPC_URL côté backend (Render)
              • Lancer scripts/run_video_pipeline_qa.sh pour valider un job sample
              • Mettre en place la supervision Prometheus/Grafana (phase2-task7)
            """
        ).strip()
    )

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SetupError as exc:
        print(f"❌ Setup interrompu: {exc}", file=sys.stderr)
        raise SystemExit(1)

