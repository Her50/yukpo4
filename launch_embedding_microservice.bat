@echo off
echo Starting Yukpo Embedding Microservice...
cd microservice_embedding
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause 