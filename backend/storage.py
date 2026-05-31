import os
from urllib.parse import quote, urlparse

import requests


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_STORAGE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "hanlingua-assets")


def is_supabase_storage_enabled():
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and SUPABASE_STORAGE_BUCKET)


def _headers(content_type=None):
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
    }
    if content_type:
        headers["Content-Type"] = content_type
        headers["x-upsert"] = "true"
    return headers


def upload_public_file(path, content, content_type):
    safe_path = "/".join(quote(part) for part in path.strip("/").split("/"))
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_STORAGE_BUCKET}/{safe_path}"
    response = requests.post(url, headers=_headers(content_type), data=content, timeout=120)
    response.raise_for_status()
    return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_STORAGE_BUCKET}/{safe_path}"


def delete_public_file(path_or_url):
    path = storage_path_from_url(path_or_url)
    if not path:
        return
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_STORAGE_BUCKET}"
    response = requests.delete(url, headers={**_headers(), "Content-Type": "application/json"}, json={"prefixes": [path]}, timeout=30)
    response.raise_for_status()


def storage_path_from_url(path_or_url):
    if not path_or_url:
        return ""
    if not path_or_url.startswith("http"):
        return path_or_url.strip("/")
    parsed = urlparse(path_or_url)
    marker = f"/storage/v1/object/public/{SUPABASE_STORAGE_BUCKET}/"
    if marker not in parsed.path:
        return ""
    return parsed.path.split(marker, 1)[1]
