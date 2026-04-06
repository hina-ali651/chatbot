import os
import json
import jwt
import datetime
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types
from dotenv import load_dotenv
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

load_dotenv()

app = FastAPI()

# Enable CORS for the frontend Vite server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = "super-secret-key-for-local-chatbot"
HISTORY_FILE = "chat_history.json"
SYSTEM_PROMPT = """You are a helpful, friendly AI assistant.
Keep your responses well-formatted and clear for reading.
When asked to help with code, provide clean, working examples using markdown."""

try:
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
except Exception as e:
    print("WARNING: Gemini API key error. Check your .env setup.")
    client = None

# --- Models ---
class LoginRequest(BaseModel):
    username: str
    password: str

class GoogleTokenRequest(BaseModel):
    token: str

class ChatRequest(BaseModel):
    message: str

# --- Helpers ---
def load_history():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    return []

def save_history(history):
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)

def verify_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ")[1]
    try:
        jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# --- Routes ---
@app.post("/api/login")
def login(request: LoginRequest):
    # Hardcoded user for simplicity
    if request.username == "admin" and request.password == "admin":
        token = jwt.encode({
            "sub": "admin",
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, SECRET_KEY, algorithm="HS256")
        return {"token": token}
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.post("/api/auth/google")
def google_auth(request: GoogleTokenRequest):
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="Google Client ID not configured")
    try:
        # Verify the token with Google
        idinfo = id_token.verify_oauth2_token(
            request.token, google_requests.Request(), client_id
        )
        
        # Issue local JWT
        token = jwt.encode({
            "sub": idinfo.get("email", "google_user"),
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, SECRET_KEY, algorithm="HS256")
        
        return {"token": token}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")

@app.get("/api/history", dependencies=[Depends(verify_token)])
def get_history():
    return {"history": load_history()}

@app.post("/api/clear", dependencies=[Depends(verify_token)])
def clear_history():
    save_history([])
    return {"status": "cleared"}

@app.post("/api/chat", dependencies=[Depends(verify_token)])
def chat(request: ChatRequest):
    if not client:
        raise HTTPException(status_code=500, detail="Gemini API is not configured properly.")
    
    history = load_history()
    # Ensure role mapping is correct. Gemini expects 'user' or 'model'.
    
    # Map any old history formatting to Gemini's expected format
    formatted_history = []
    for msg in history:
        # Standardize old format (if any) to new format
        role = msg.get("role", "user")
        if role == "assistant":
            role = "model"
            
        parts = msg.get("parts") or msg.get("content") or ""
        formatted_history.append({"role": role, "parts": parts})
    
    # Save formatted history back to be sure it's valid for future
    history = formatted_history
    history.append({"role": "user", "parts": request.message})
    
    # Build Gemini content list
    contents = []
    for msg in history:
        # Avoid passing any empty parts which causes errors
        if msg["parts"].strip():
            contents.append(
                types.Content(
                    role=msg["role"],
                    parts=[types.Part(text=msg["parts"])]
                )
            )
            
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
            contents=contents
        )
        reply = response.text
        history.append({"role": "model", "parts": reply})
        save_history(history)
        return {"reply": reply}
    except Exception as e:
        # Fallback if history is too corrupted/large
        print(f"Gemini API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)