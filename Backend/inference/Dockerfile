# ==============================================================================
# NutriTrack AI — Python Vision Transformer (ViT) Inference Dockerfile
# Python 3.11-slim container with pre-warmed weights for zero cold-start delay
# ==============================================================================

FROM python:3.11-slim

WORKDIR /app

# Install curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Add non-root system user
RUN useradd -m -u 1001 appuser

# Install CPU-optimized PyTorch and Hugging Face dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Pre-download and cache model weights during build to prevent runtime download delays
ENV HF_HOME=/app/model_cache \
    HF_MODEL_NAME=DrishtiSharma/finetuned-ViT-Indian-Food-Classification-v3 \
    DOCKER_CONTAINER=true \
    PORT=5001 \
    HF_INFERENCE_PORT=5001 \
    HF_INFERENCE_HOST=0.0.0.0

# Copy application script
COPY hf_inference_service.py .

# Cache weights as appuser
RUN mkdir -p /app/model_cache && chown -R appuser:appuser /app
USER appuser

# Pre-fetch weights in build layer so startup is immediate
RUN python -c "from transformers import AutoImageProcessor, AutoModelForImageClassification; \
    AutoImageProcessor.from_pretrained('DrishtiSharma/finetuned-ViT-Indian-Food-Classification-v3'); \
    AutoModelForImageClassification.from_pretrained('DrishtiSharma/finetuned-ViT-Indian-Food-Classification-v3')"

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:5001/health || exit 1

ENTRYPOINT ["python", "-u", "hf_inference_service.py"]
