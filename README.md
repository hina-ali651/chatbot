# Chatbot (Frontend + Backend)

Clean, professional structure for a full-stack app:

- `frontend/`: React + Vite UI
- `backend/`: FastAPI API server

## Requirements

- Node.js (LTS recommended)
- Python 3.10+ (3.11 recommended)

## Run backend (FastAPI)

From repo root:

```bash
cd backend
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Run frontend (Vite)

In another terminal from repo root:

```bash
cd frontend
npm install
npm run dev
```

Frontend dev server proxies `/api/*` to `http://127.0.0.1:8000`.

## Notes

- Never commit `.env` files (keys/secrets). Use `backend/.env.example` for sharing required variable names.
