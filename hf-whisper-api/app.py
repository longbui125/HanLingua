"""
HanLingua Whisper API — Deployed on HuggingFace Spaces (Docker SDK + GPU).

This is a lightweight FastAPI service that loads Whisper large-v3-turbo
and exposes a POST /transcribe endpoint for the main HanLingua backend.
"""

import os
import re
import tempfile

import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline

# ── Model setup ─────────────────────────────────────────────────────
model_id = "ylacombe/whisper-large-v3-turbo"
device = "cuda" if torch.cuda.is_available() else "cpu"
torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32

print(f"Loading Whisper model on {device.upper()}...")

model = AutoModelForSpeechSeq2Seq.from_pretrained(
    model_id,
    torch_dtype=torch_dtype,
    low_cpu_mem_usage=True,
    use_safetensors=True,
)
model.to(device)
processor = AutoProcessor.from_pretrained(model_id)

pipe = pipeline(
    "automatic-speech-recognition",
    model=model,
    tokenizer=processor.tokenizer,
    feature_extractor=processor.feature_extractor,
    device=device,
    chunk_length_s=30,
)

print("Whisper model loaded successfully!")

# ── FastAPI app ─────────────────────────────────────────────────────
app = FastAPI(title="HanLingua Whisper API", version="1.0.0")

# Allow the HanLingua backend to call this service
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "*",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple API key protection (optional)
API_KEY = os.environ.get("WHISPER_API_KEY", "")


def verify_api_key(request_key: str | None):
    if API_KEY and request_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


@app.get("/")
def health():
    return {
        "status": "ok",
        "model": model_id,
        "device": device,
    }


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    api_key: str | None = None,
):
    """
    Accepts an audio file upload, runs Whisper transcription,
    and returns the Korean transcript split into sentences.
    """
    verify_api_key(api_key)

    # Validate file type
    allowed_extensions = {".mp3", ".m4a", ".wav", ".ogg", ".flac", ".webm", ".mp4"}
    ext = os.path.splitext(file.filename or "audio.mp3")[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format: {ext}. Supported: {allowed_extensions}",
        )

    # Save uploaded file to a temp path
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = pipe(
            tmp_path,
            return_timestamps=True,
            generate_kwargs={"language": "korean"},
        )
        text = result["text"].strip()
        sentences = re.split(r"(?<=[.!?])\s+", text)
        transcript = [s.strip() for s in sentences if s.strip()]

        return {
            "transcript": transcript,
            "full_text": text,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}")
    finally:
        os.unlink(tmp_path)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=7860)
