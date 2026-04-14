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
import sys

# Ensure backend directory is in path to import mongo_chat_history
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import mongo_chat_history

load_dotenv()

app = FastAPI()

# Enable CORS for the frontend Vite server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174","https://chatbot-w9g8.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = "super-secret-key-for-local-chatbot"
SYSTEM_PROMPT = """You are a helpful, friendly AI assistant.
Keep your responses well-formatted and clear for reading.
When asked to help with code, provide clean, working examples using markdown."""

try:
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
except Exception as e:
    print("WARNING: Gemini API key error. Check your .env setup.")
    client = None

# Connect to MongoDB on startup
@app.on_event("startup")
def startup_db_client():
    mongo_chat_history.connect_to_mongodb()

@app.on_event("shutdown")
def shutdown_db_client():
    mongo_chat_history.close_connection()

# --- Models ---
class LoginRequest(BaseModel):
    username: str
    password: str

class GoogleTokenRequest(BaseModel):
    token: str

class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None

# --- Helpers ---
def verify_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return sub
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

@app.get("/api/sessions")
def get_sessions(user_id: str = Depends(verify_token)):
    return {"sessions": mongo_chat_history.get_user_sessions(user_id)}

@app.get("/api/history/{session_id}")
def get_history(session_id: str, user_id: str = Depends(verify_token)):
    docs = mongo_chat_history.get_chat_history_by_session(user_id, session_id)
    formatted_history = []
    for doc in docs:
        if doc.get("user_message"):
            formatted_history.append({"role": "user", "parts": doc["user_message"]})
        if doc.get("bot_response"):
            formatted_history.append({"role": "model", "parts": doc["bot_response"]})
    return {"history": formatted_history}

@app.post("/api/clear")
def clear_history(user_id: str = Depends(verify_token)):
    mongo_chat_history.delete_chat_history(user_id)
    return {"status": "cleared"}

@app.post("/api/chat")
def chat(request: ChatRequest, user_id: str = Depends(verify_token)):
    if not client:
        raise HTTPException(status_code=500, detail="Gemini API is not configured properly.")
    
    docs = []
    if request.session_id:
        all_docs = mongo_chat_history.get_chat_history_by_session(user_id, request.session_id)
        docs = all_docs[-20:] # limit history context to last 20 messages for Gemini
    
    contents = []
    for doc in docs:
        if doc.get("user_message", "").strip():
            contents.append(
                types.Content(
                    role="user",
                    parts=[types.Part(text=doc["user_message"])]
                )
            )
        if doc.get("bot_response", "").strip():
            contents.append(
                types.Content(
                    role="model",
                    parts=[types.Part(text=doc["bot_response"])]
                )
            )
            
    # Append current user message
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part(text=request.message)]
        )
    )
            
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
            contents=contents
        )
        reply = response.text
        
        # Save to MongoDB
        mongo_chat_history.save_chat(user_id, request.message, reply, request.session_id)
        
        return {"reply": reply}
    except Exception as e:
        print(f"Gemini API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
