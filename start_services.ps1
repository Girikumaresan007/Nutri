# NutriTrack Services Starter
# Starts both the Python Vision Inference Sidecar (:5001) and the Spring Boot Backend (:8081)

Write-Host "Starting Python Vision Inference Service (Genuine Hugging Face ViT) on port 5001..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'Backend\inference'; py -3.11 hf_inference_service.py"

Start-Sleep -Seconds 2

Write-Host "Starting Spring Boot Backend on port 8081..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'Backend\backend'; .\mvnw.cmd spring-boot:run"

Write-Host "`nServices launching! Once started:" -ForegroundColor Green
Write-Host "  - Inference Health: http://127.0.0.1:5001/health"
Write-Host "  - Backend API:      http://localhost:8081/api/v1"
Write-Host "  - Verification:     cd 'Backend\inference'; node verify_stage10_broad_recognition.cjs"
