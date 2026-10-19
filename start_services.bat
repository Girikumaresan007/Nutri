@echo off
echo Starting NutriTrack Services...
start "NutriTrack Inference Sidecar - Genuine ViT (Port 5001)" cmd /k "cd Backend\inference && py -3.11 hf_inference_service.py"
timeout /t 2 /nobreak > nul
start "NutriTrack Backend (Port 8081)" cmd /k "cd Backend\backend && mvnw.cmd spring-boot:run"
echo Services are starting in separate windows!
