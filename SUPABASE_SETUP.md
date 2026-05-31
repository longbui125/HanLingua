# Supabase Setup

## 1. Database

Create a Supabase project, then copy the PostgreSQL connection string into `.env`:

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

Install dependencies:

```bash
pip install -r requirement.txt
```

Initialize tables and seed data:

```bash
python backend/init_db.py
```

## 2. Storage

Create a public Storage bucket in Supabase, for example:

```text
hanlingua-assets
```

Add these values to `.env`:

```env
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]
SUPABASE_STORAGE_BUCKET=hanlingua-assets
```

Images will be stored under:

```text
profile_avatars/
vocabulary_images/
```

If Supabase Storage env vars are missing, the app falls back to local `/data` storage.

## 3. Run

```bash
uvicorn backend.main:app --reload
```

For deployment, set the same environment variables on Render/Railway/Fly.io.
