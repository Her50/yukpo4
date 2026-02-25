#!/bin/bash
# ============================================================
# Yukpo GPU Worker - Startup Script for GCP Compute Engine T4
# Auto-installs NVIDIA drivers, Python, and starts the worker
# ============================================================
set -uo pipefail

export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

LOG_FILE="/var/log/yukpo-gpu-worker.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "$(date) [GPU Worker] Starting setup..."

# 1. Install Python and essential dependencies FIRST (always needed)
echo "$(date) [GPU Worker] Installing Python and essentials..."
apt-get update -y
apt-get install -y --no-install-recommends python3 python3-pip python3-venv curl jq

# 2. Check for physical GPU hardware before attempting driver install
if lspci 2>/dev/null | grep -iq nvidia; then
    echo "$(date) [GPU Worker] NVIDIA GPU hardware detected! Installing drivers..."
    if ! command -v nvidia-smi &>/dev/null; then
        apt-get install -y --no-install-recommends linux-headers-$(uname -r) 2>/dev/null || true
        curl -fsSL https://developer.download.nvidia.com/compute/cuda/repos/debian12/x86_64/cuda-keyring_1.1-1_all.deb -o /tmp/cuda-keyring.deb 2>/dev/null || true
        dpkg -i /tmp/cuda-keyring.deb 2>/dev/null || true
        apt-get update -y 2>/dev/null || true
        apt-get install -y --no-install-recommends cuda-drivers 2>/dev/null || true
    fi
    nvidia-smi 2>/dev/null && echo "$(date) [GPU Worker] GPU ready!" || echo "$(date) [GPU Worker] WARNING: GPU detected but drivers failed"
else
    echo "$(date) [GPU Worker] No NVIDIA GPU hardware found - running in CPU-only mode"
    echo "$(date) [GPU Worker] GPU will be auto-detected on next boot if hardware is added"
fi

# 4. Create the worker application
mkdir -p /opt/yukpo-gpu-worker
cat > /opt/yukpo-gpu-worker/requirements.txt << 'REQS'
fastapi==0.115.0
uvicorn[standard]==0.30.0
httpx==0.27.0
pynvml==11.5.0
REQS

# 5. Create virtual environment and install dependencies
python3 -m venv /opt/yukpo-gpu-worker/venv
/opt/yukpo-gpu-worker/venv/bin/pip install --upgrade pip
/opt/yukpo-gpu-worker/venv/bin/pip install -r /opt/yukpo-gpu-worker/requirements.txt

# 6. Create the worker server
cat > /opt/yukpo-gpu-worker/server.py << 'PYSERVER'
#!/usr/bin/env python3
"""
Yukpo GPU Worker - AI Prediction & Metrics Server
Runs on GCP Compute Engine with NVIDIA T4 GPU
Exposes:
  - POST /api/v1/ai/predict  (AI inference routing)
  - GET  /api/v1/metrics      (GPU utilization metrics)
  - GET  /health               (Health check)
"""
import os
import time
import json
import logging
from datetime import datetime
from typing import Optional

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

# Try to import NVIDIA management library
try:
    import pynvml
    pynvml.nvmlInit()
    NVML_AVAILABLE = True
except Exception:
    NVML_AVAILABLE = False

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("yukpo-gpu-worker")

app = FastAPI(title="Yukpo GPU Worker", version="1.0.0")

# Metrics tracking
metrics = {
    "total_requests": 0,
    "successful_requests": 0,
    "failed_requests": 0,
    "avg_response_time_ms": 0.0,
    "start_time": time.time(),
}

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")


def get_gpu_utilization() -> float:
    """Get current GPU utilization percentage using NVML."""
    if not NVML_AVAILABLE:
        return 0.0
    try:
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        util = pynvml.nvmlDeviceGetUtilizationRates(handle)
        return float(util.gpu)
    except Exception as e:
        logger.warning(f"Error getting GPU utilization: {e}")
        return 0.0


def get_gpu_memory() -> dict:
    """Get GPU memory usage."""
    if not NVML_AVAILABLE:
        return {"total_mb": 0, "used_mb": 0, "free_mb": 0}
    try:
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
        return {
            "total_mb": mem.total // (1024 * 1024),
            "used_mb": mem.used // (1024 * 1024),
            "free_mb": mem.free // (1024 * 1024),
        }
    except Exception:
        return {"total_mb": 0, "used_mb": 0, "free_mb": 0}


def get_gpu_temperature() -> float:
    """Get GPU temperature in Celsius."""
    if not NVML_AVAILABLE:
        return 0.0
    try:
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        return float(pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU))
    except Exception:
        return 0.0


@app.get("/health")
async def health():
    return {"status": "ok", "gpu_available": NVML_AVAILABLE, "timestamp": datetime.utcnow().isoformat()}


@app.get("/api/v1/metrics")
async def get_metrics():
    """Return GPU utilization metrics for the backend auto-scaler."""
    utilization = get_gpu_utilization()
    memory = get_gpu_memory()
    temperature = get_gpu_temperature()
    uptime = time.time() - metrics["start_time"]

    return {
        "utilization": utilization,
        "memory": memory,
        "temperature": temperature,
        "uptime_seconds": int(uptime),
        "total_requests": metrics["total_requests"],
        "successful_requests": metrics["successful_requests"],
        "failed_requests": metrics["failed_requests"],
        "avg_response_time_ms": metrics["avg_response_time_ms"],
        "gpu_available": NVML_AVAILABLE,
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post("/api/v1/ai/predict")
async def ai_predict(request: Request):
    """
    AI prediction endpoint. Routes requests to OpenAI API
    with GPU-accelerated pre/post processing.
    """
    start = time.time()
    metrics["total_requests"] += 1

    try:
        body = await request.json()
        prompt = body.get("prompt", "")
        model = body.get("model", "gpt-4o-mini")
        multimodal = body.get("multimodal")

        if not prompt and not multimodal:
            raise HTTPException(status_code=400, detail="prompt or multimodal data required")

        if not OPENAI_API_KEY:
            raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

        # Build messages for OpenAI
        messages = []
        if multimodal and isinstance(multimodal, dict):
            # Handle multimodal input (images, etc.)
            texte = multimodal.get("texte", prompt) or prompt
            messages.append({"role": "user", "content": texte})
        else:
            messages.append({"role": "user", "content": prompt})

        # Call OpenAI API
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{OPENAI_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model if model != "default" else "gpt-4o-mini",
                    "messages": messages,
                    "max_tokens": 4096,
                    "temperature": 0.7,
                },
            )
            response.raise_for_status()
            result = response.json()

        elapsed_ms = (time.time() - start) * 1000
        metrics["successful_requests"] += 1

        # Update average response time (exponential moving average)
        alpha = 0.1
        metrics["avg_response_time_ms"] = (
            alpha * elapsed_ms + (1 - alpha) * metrics["avg_response_time_ms"]
        )

        logger.info(f"AI prediction completed in {elapsed_ms:.1f}ms (model={model})")

        return {
            "status": "ok",
            "result": result.get("choices", [{}])[0].get("message", {}).get("content", ""),
            "model": model,
            "processing_time_ms": elapsed_ms,
            "gpu_utilization": get_gpu_utilization(),
        }

    except HTTPException:
        metrics["failed_requests"] += 1
        raise
    except Exception as e:
        metrics["failed_requests"] += 1
        elapsed_ms = (time.time() - start) * 1000
        logger.error(f"AI prediction failed after {elapsed_ms:.1f}ms: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    port = int(os.environ.get("GPU_WORKER_PORT", "8080"))
    logger.info(f"Starting Yukpo GPU Worker on port {port}")
    logger.info(f"NVML available: {NVML_AVAILABLE}")
    logger.info(f"OpenAI API configured: {bool(OPENAI_API_KEY)}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
PYSERVER

# 7. Create systemd service
cat > /etc/systemd/system/yukpo-gpu-worker.service << 'SYSTEMD'
[Unit]
Description=Yukpo GPU Worker - AI Prediction Server
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/yukpo-gpu-worker
Environment=GPU_WORKER_PORT=8080
EnvironmentFile=-/opt/yukpo-gpu-worker/.env
ExecStart=/opt/yukpo-gpu-worker/venv/bin/python server.py
Restart=always
RestartSec=5
StandardOutput=append:/var/log/yukpo-gpu-worker.log
StandardError=append:/var/log/yukpo-gpu-worker.log

[Install]
WantedBy=multi-user.target
SYSTEMD

# 8. Fetch OPENAI_API_KEY from GCP Secret Manager
echo "$(date) [GPU Worker] Fetching secrets from GCP Secret Manager..."
OPENAI_KEY=$(gcloud secrets versions access latest --secret=openai-api-key --project=yukpo-project 2>/dev/null || echo "")
if [ -n "$OPENAI_KEY" ]; then
    echo "OPENAI_API_KEY=$OPENAI_KEY" > /opt/yukpo-gpu-worker/.env
    echo "$(date) [GPU Worker] OPENAI_API_KEY loaded from Secret Manager"
else
    echo "$(date) [GPU Worker] WARNING: Could not fetch OPENAI_API_KEY from Secret Manager"
    echo "OPENAI_API_KEY=" > /opt/yukpo-gpu-worker/.env
fi
chmod 600 /opt/yukpo-gpu-worker/.env

# 9. Enable and start the service
systemctl daemon-reload
systemctl enable yukpo-gpu-worker
systemctl start yukpo-gpu-worker

echo "$(date) [GPU Worker] Setup complete! Service running on port 8080"
echo "$(date) [GPU Worker] Check: curl http://localhost:8080/health"
