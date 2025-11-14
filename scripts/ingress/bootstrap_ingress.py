#!/usr/bin/env python3
"""
Bootstrap LiveKit ingress end-to-end:
 1. Ensure /opt/livekit/livekit.yaml on the Hetzner VM contains the redis block.
 2. Restart the livekit systemd service.
 3. Run ./scripts/ingress/create_ingress.sh and print the RTMP stream key.

Usage:
    python3 scripts/ingress/bootstrap_ingress.py

Environment (optional):
    LIVEKIT_SSH_HOST   (default: root@46.224.14.85)
    LIVEKIT_CONFIG_PATH (default: /opt/livekit/livekit.yaml)
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Dict

import yaml


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_HOST = "root@46.224.14.85"
DEFAULT_CONFIG_PATH = "/opt/livekit/livekit.yaml"
REDIS_ADDRESS = "127.0.0.1:6379"


def run(
    cmd: list[str],
    *,
    check: bool = True,
    capture_output: bool = False,
    env: Dict[str, str] | None = None,
) -> subprocess.CompletedProcess:
    print("+", " ".join(cmd))
    return subprocess.run(cmd, check=check, capture_output=capture_output, text=True, env=env)


def ensure_redis_block(host: str, remote_path: str) -> bool:
    with tempfile.TemporaryDirectory() as tmpdir:
        local_path = Path(tmpdir) / "livekit.yaml"
        run(["scp", f"{host}:{remote_path}", str(local_path)])
        content = local_path.read_text()
        try:
            config = yaml.safe_load(content) or {}
        except yaml.YAMLError as exc:
            raise RuntimeError(f"Unable to parse remote YAML: {exc}") from exc

        redis_cfg = config.get("redis") or {}
        if redis_cfg.get("address") == REDIS_ADDRESS:
            return False

        config["redis"] = {"address": REDIS_ADDRESS}

        dumped = yaml.safe_dump(config, sort_keys=False)
        local_path.write_text(dumped)
        run(["scp", str(local_path), f"{host}:{remote_path}"])
    return True


def restart_livekit(host: str) -> None:
    run(["ssh", host, "systemctl", "restart", "livekit"])
    run(["ssh", host, "systemctl", "status", "livekit", "--no-pager"])


def load_env_file(env_file: Path) -> Dict[str, str]:
    if not env_file.exists():
        raise FileNotFoundError(f"{env_file} is missing. Please create it with LiveKit credentials.")
    env_vars: Dict[str, str] = {}
    for raw_line in env_file.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        env_vars[key.strip()] = value.strip()
    return env_vars


def main() -> int:
    os.chdir(ROOT)
    host = os.getenv("LIVEKIT_SSH_HOST", DEFAULT_HOST)
    config_path = os.getenv("LIVEKIT_CONFIG_PATH", DEFAULT_CONFIG_PATH)

    try:
        redis_added = ensure_redis_block(host, config_path)
    except subprocess.CalledProcessError as exc:
        print(f"Failed to copy remote LiveKit config ({exc})", file=sys.stderr)
        return 1

    if redis_added:
        print("Redis block added to livekit.yaml, restarting livekit service...")
        restart_livekit(host)
    else:
        print("Redis block already present. Ensuring livekit service is running...")
        run(["ssh", host, "systemctl", "status", "livekit", "--no-pager"])

    env_file = ROOT / ".env.livekit"
    try:
        env_vars = load_env_file(env_file)
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    venv_python = ROOT / ".venv" / "bin" / "python"
    if not venv_python.exists():
        print("Python venv not found (.venv/bin/python). Please create it before running this script.", file=sys.stderr)
        return 1

    proc_env = os.environ.copy()
    proc_env.update(env_vars)
    proc_env["PATH"] = f"{ROOT}/.venv/bin:{proc_env.get('PATH', '')}"

    try:
        run(["./scripts/ingress/create_ingress.sh"], env=proc_env)
    except subprocess.CalledProcessError as exc:
        print(f"Failed to create ingress ({exc})", file=sys.stderr)
        return exc.returncode

    response_file = ROOT / "scripts" / "ingress" / "create_ingress_response.json"
    try:
        data = json.loads(response_file.read_text())
    except json.JSONDecodeError as exc:
        print(f"Could not parse {response_file}: {exc}", file=sys.stderr)
        return 1

    stream_key = data.get("ingress_info", {}).get("endpoint", {}).get("rtmp", {}).get("stream_key")
    if not stream_key:
        print(json.dumps(data, indent=2))
        print("No stream key found in response.", file=sys.stderr)
        return 1

    print("\nIngress created successfully.")
    print(f"RTMP stream key: {stream_key}")
    print("\nUse the following ffmpeg command to test:")
    print(
        f'ffmpeg -re -f lavfi -i testsrc=size=1280x720:rate=30 '
        f'-f lavfi -i sine=frequency=1000 '
        f'-c:v libx264 -preset veryfast -b:v 2500k '
        f'-c:a aac -b:a 128k -ar 48000 '
        f'-f flv "rtmp://{env_vars["LIVEKIT_HOST"]}:1935/live/{stream_key}"'
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

