"""
HanLingua Whisper API — Deployed on HuggingFace Spaces (Docker SDK + GPU).

This is a lightweight FastAPI service that loads Whisper large-v3-turbo
and exposes a POST /transcribe endpoint for the main HanLingua backend.
"""

import os
import re
import subprocess
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


def convert_to_wav(input_path: str) -> str:
    output_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    output_path = output_file.name
    output_file.close()
    command = [
        "ffmpeg",
        "-y",
        "-i", input_path,
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-f", "wav",
        output_path,
    ]
    try:
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=240)
    except FileNotFoundError as exc:
        if os.path.exists(output_path):
            os.unlink(output_path)
        raise HTTPException(status_code=500, detail="FFmpeg is not installed in the Whisper Space.") from exc
    except subprocess.TimeoutExpired as exc:
        if os.path.exists(output_path):
            os.unlink(output_path)
        raise HTTPException(status_code=400, detail="Audio/video conversion timed out. Try a shorter file.") from exc

    if result.returncode != 0 or not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        if os.path.exists(output_path):
            os.unlink(output_path)
        stderr_tail = "\n".join((result.stderr or result.stdout or "").strip().splitlines()[-3:])
        raise HTTPException(
            status_code=400,
            detail=f"Could not extract audio from this file. Check that it contains an audio track. {stderr_tail}",
        )
    return output_path


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
    allowed_extensions = {".mp3", ".m4a", ".wav", ".ogg", ".flac", ".aac", ".webm", ".mp4", ".mov", ".mkv", ".avi", ".m4v"}
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

    wav_path = None
    try:
        wav_path = convert_to_wav(tmp_path)
        result = pipe(
            wav_path,
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
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}")
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        if wav_path and os.path.exists(wav_path):
            os.unlink(wav_path)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=7860)
