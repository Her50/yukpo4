#!/bin/bash
# ✅ Script de démarrage pour worker GPU
# Installe CUDA, Docker, et démarre le service GPU

set -e

echo "🚀 Démarrage installation GPU worker..."

# Mettre à jour le système
apt-get update
apt-get install -y curl wget git

# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker $USER

# Installer NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | tee /etc/apt/sources.list.d/nvidia-docker.list

apt-get update
apt-get install -y nvidia-container-toolkit
systemctl restart docker

# Vérifier GPU
nvidia-smi

# Cloner et démarrer le service GPU
mkdir -p /opt/yukpo-gpu
cd /opt/yukpo-gpu

# Créer le service GPU (à adapter selon votre implémentation)
cat > /opt/yukpo-gpu/gpu-service.py << 'EOF'
#!/usr/bin/env python3
# Service GPU simple pour traitement IA
from flask import Flask, request, jsonify
import subprocess
import json

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"}), 200

@app.route('/api/v1/metrics', methods=['GET'])
def metrics():
    # Récupérer utilisation GPU via nvidia-smi
    result = subprocess.run(['nvidia-smi', '--query-gpu=utilization.gpu', '--format=csv,noheader,nounits'], 
                          capture_output=True, text=True)
    utilization = float(result.stdout.strip()) if result.returncode == 0 else 0.0
    return jsonify({"utilization": utilization}), 200

@app.route('/api/v1/ai/predict', methods=['POST'])
def predict():
    data = request.json
    prompt = data.get('prompt', '')
    # TODO: Implémenter traitement IA avec GPU
    # Pour l'instant, retourner une réponse factice
    return jsonify({
        "response": f"GPU processed: {prompt[:50]}...",
        "model": "gpu-accelerated"
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
EOF

chmod +x /opt/yukpo-gpu/gpu-service.py

# Installer Python et dépendances
apt-get install -y python3 python3-pip
pip3 install flask

# Créer service systemd
cat > /etc/systemd/system/yukpo-gpu.service << 'EOF'
[Unit]
Description=Yukpo GPU Service
After=docker.service

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/yukpo-gpu/gpu-service.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable yukpo-gpu
systemctl start yukpo-gpu

echo "✅ GPU worker installé et démarré"


