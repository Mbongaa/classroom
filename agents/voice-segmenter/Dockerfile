# Dockerfile for Voice Segmenter Agent (Render Deployment)

FROM python:3.10-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies for audio processing
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 10001 appuser

# Set working directory
WORKDIR /home/appuser/agent

# Copy requirements first (for Docker layer caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent source files
COPY agent.py .
COPY audio_processor.py .
COPY translator.py .
COPY config.py .

# Copy service account credentials
# IMPORTANT: This will be in the Docker image - ensure .gitignore protects it
COPY bayaan-meets-36b41e23f9cc.json .

# Set ownership
RUN chown -R appuser:appuser /home/appuser

# Switch to non-root user
USER appuser

# Expose port (optional - agent doesn't need HTTP, but good for health checks)
EXPOSE 8080

# Start agent in production mode
CMD ["python", "agent.py", "start"]
