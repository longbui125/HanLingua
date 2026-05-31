"""
Transcript engine — delegates to the HuggingFace Whisper API service.

When WHISPER_API_URL is set, sends audio to the remote Whisper service.
Falls back to local Whisper model if WHISPER_API_URL is not set and
torch/transformers are installed.
"""

import os
import re
from pathlib import Path

WHISPER_API_URL = os.environ.get("WHISPER_API_URL", "").rstrip("/")
WHISPER_API_KEY = os.environ.get("WHISPER_API_KEY", "")


def _transcribe_remote(file_path: str) -> list[str]:
    """Send audio file to the HuggingFace Whisper API service."""
    import requests

    url = f"{WHISPER_API_URL}/transcribe"
    params = {}
    if WHISPER_API_KEY:
        params["api_key"] = WHISPER_API_KEY

    with open(file_path, "rb") as f:
        response = requests.post(
            url,
            params=params,
            files={"file": (Path(file_path).name or "audio.mp3", f)},
            timeout=300,  # Whisper can take a while on long audio
        )

    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        try:
            detail = response.json().get("detail")
        except Exception:
            detail = response.text[:500]
        raise RuntimeError(f"Whisper API error ({response.status_code}): {detail}") from exc

    data = response.json()
    transcript = data.get("transcript") or []
    if isinstance(transcript, str):
        transcript = [transcript]
    return [item.strip() for item in transcript if item and item.strip()]


def _transcribe_local(file_path: str) -> list[str]:
    """Run Whisper locally (requires torch + transformers)."""
    import torch
    from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline

    model_id = "ylacombe/whisper-large-v3-turbo"
    device = "cuda" if torch.cuda.is_available() else "cpu"
    torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32

    print(f"Loading Whisper Model on {device.upper()}...")

    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        model_id, torch_dtype=torch_dtype, low_cpu_mem_usage=True, use_safetensors=True
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

    result = pipe(file_path, return_timestamps=True, generate_kwargs={"language": "korean"})
    text = result["text"].strip()
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return [s.strip() for s in sentences if s.strip()]


def generate_transcript_json(file_path: str) -> list[str]:
    """
    Generate Korean transcript from an audio file.
    Uses remote Whisper API if configured, otherwise falls back to local model.
    """
    if WHISPER_API_URL:
        return _transcribe_remote(file_path)
    return _transcribe_local(file_path)
