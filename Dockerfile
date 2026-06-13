FROM python:3.11-slim

# Install FFmpeg and Deno for yt-dlp YouTube audio processing
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl ffmpeg unzip && \
    curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh && \
    ln -s /usr/local/bin/deno /usr/bin/deno && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies (backend only, no torch/transformers)
COPY requirements-backend.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY data/ ./data/

# Copy .env if it exists (for local Docker runs)
COPY .env* ./

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "backend"]
