import os
import time
from datetime import datetime, timezone
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from bson.objectid import ObjectId

# === ENVIRONMENT SETUP ===
# Load environment variables (.env file se MONGODB_URI load hogi)
load_dotenv()

# Aap apna connection string backend/.env file mein aise rakhein:
# MONGODB_URI="mongodb+srv://alihaniya259_db_user:<YOUR_PASSWORD>@chatbot-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority"
MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = "chatbot_db"
COLLECTION_NAME = "conversations"

# Global database variables
client = None
db = None
chat_collection = None

# === 1. CONNECT FUNCTION ===
def connect_to_mongodb(retries=3, delay=2):
    """
    MongoDB se connect karne ka function.
    Agar connection fail ho jaye to retry karta hai (bonus feature).
    """
    global client, db, chat_collection

    if not MONGODB_URI:
        print("❌ Error: MONGODB_URI environment variable mein nahi mila.")
        print("💡 Tip: .env file banayein aur usme MONGODB_URI set karein.")
        return False

    for attempt in range(1, retries + 1):
        try:
            print(f"🔄 MongoDB Atlas se connect ho raha hai... (Attempt {attempt}/{retries})")
            
            # Connect to client with timeout protection
            client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
            
            # Connection test (ping the database to verify if password/IP is correct)
            client.admin.command('ping')
            
            db = client[DB_NAME]
            chat_collection = db[COLLECTION_NAME]
            
            print("✅ MongoDB Atlas se successfully connect ho gaya!")
            return True
            
        except ConnectionFailure as e:
            print(f"⚠️ Connection Fail ho gaya (Database server offline ya IP not allowed): {e}")
        except OperationFailure as e:
            print(f"⚠️ Authentication Fail (Username ya Password galat hai): {e}")
        except Exception as e:
            print(f"❌ Unexpected Error: {e}")
            
        # Retry mechanism logic
        if attempt < retries:
            print(f"⏳ {delay} seconds baad dobara try kar rahe hain...")
            time.sleep(delay)
        else:
            print("❌ MongoDB connection fully fail ho gaya. Kripya apna MONGODB_URI aur Network Access check karein.")
            return False

# === 2. SAVE_CHAT FUNCTION ===
def save_chat(user_id, user_message, bot_response, session_id=None):
    """
    User aur bot ki conversation database mein save karne ka function.
    """
    if chat_collection is None:
        return {"status": "error", "message": "Database connected nahi hai. Pehle connect karein."}

    try:
        # Document structure prepare karte hain
        chat_document = {
            "user_id": str(user_id),
            "user_message": str(user_message),
            "bot_response": str(bot_response),
            "timestamp": datetime.now(timezone.utc),  # Auto timestamp (UTC best practice)
            "session_id": str(session_id) if session_id else None
        }
        
        # Insert document into collection
        result = chat_collection.insert_one(chat_document)
        print(f"✅ Chat save ho gayi! Document ID: {result.inserted_id}")
        
        return {"status": "success", "inserted_id": str(result.inserted_id)}
    
    except Exception as e:
        print(f"❌ Error in save_chat: {e}")
        return {"status": "error", "message": str(e)}

# === 3. GET_CHAT_HISTORY FUNCTION ===
def get_chat_history(user_id, limit=10):
    """
    Kisi specific user ki last N chats fetch karne ka function.
    Newest messages pehle aayenge (timestamp descending order).
    """
    if chat_collection is None:
        print("❌ Database connected nahi hai.")
        return []

    try:
        # Find chats based on user_id, sort by timestamp (descending -1), set limit
        cursor = chat_collection.find({"user_id": str(user_id)}).sort("timestamp", -1).limit(limit)
        
        history = []
        for chat in cursor:
            # ObjectId ko string mein convert kar rahe hain taake API (FastAPI/JSON) me masla na ho
            chat["_id"] = str(chat["_id"])
            history.append(chat)
            
        print(f"✅ User '{user_id}' ke {len(history)} messages fetch ho gaye.")
        return history

    except Exception as e:
        print(f"❌ Error in get_chat_history: {e}")
        return []

# === 3.5 GET USER SESSIONS FUNCTION ===
def get_user_sessions(user_id):
    """
    Returns unique sessions for a user, sorted by most recently updated.
    """
    if chat_collection is None:
        return []
        
    try:
        pipeline = [
            {"$match": {"user_id": str(user_id)}},
            {"$sort": {"timestamp": 1}},
            {"$group": {
                "_id": "$session_id",
                "title": {"$first": "$user_message"},
                "updated_at": {"$last": "$timestamp"}
            }},
            {"$sort": {"updated_at": -1}}
        ]
        sessions = list(chat_collection.aggregate(pipeline))
        result = []
        for s in sessions:
            if s["_id"]:
                result.append({
                    "session_id": str(s["_id"]),
                    "title": str(s["title"]),
                    "updated_at": s["updated_at"].isoformat() if s["updated_at"] else None
                })
        return result
    except Exception as e:
        print(f"❌ Error in get_user_sessions: {e}")
        return []

def get_chat_history_by_session(user_id, session_id):
    """
    Gets chat history for a specific session only.
    Oldest first.
    """
    if chat_collection is None:
        return []

    try:
        cursor = chat_collection.find({
            "user_id": str(user_id),
            "session_id": str(session_id)
        }).sort("timestamp", 1)  # chronological
        
        history = []
        for chat in cursor:
            chat["_id"] = str(chat["_id"])
            history.append(chat)
        return history
    except Exception as e:
        print(f"❌ Error in get_chat_history_by_session: {e}")
        return []

# === 4. DELETE_CHAT_HISTORY FUNCTION ===
def delete_chat_history(user_id):
    """
    Kisi specific user ki poori chat history delete karne ka function.
    """
    if chat_collection is None:
        return {"status": "error", "message": "Database connected nahi hai."}

    try:
        # delete_many function se sari matching chats udd jayengi
        result = chat_collection.delete_many({"user_id": str(user_id)})
        print(f"🗑️ User '{user_id}' ke {result.deleted_count} messages delete ho gaye.")
        
        return {
            "status": "success", 
            "message": f"{result.deleted_count} messages deleted successfully.",
            "deleted_count": result.deleted_count
        }

    except Exception as e:
        print(f"❌ Error in delete_chat_history: {e}")
        return {"status": "error", "message": str(e)}

# === 5. UPDATE_CHAT FUNCTION ===
def update_chat(message_id, new_bot_response=None, new_user_message=None):
    """
    Kisi specific message ko uski ID ki madad se update karne ka function.
    """
    if chat_collection is None:
        return {"status": "error", "message": "Database connected nahi hai."}

    try:
        update_fields = {}
        if new_bot_response is not None:
            update_fields["bot_response"] = new_bot_response
        if new_user_message is not None:
            update_fields["user_message"] = new_user_message
            
        # Jab file update ho toh hum ek aur auto-field update kar denge
        update_fields["updated_at"] = datetime.now(timezone.utc)

        if not update_fields:
            return {"status": "error", "message": "Koi update data nahi diya gaya."}

        # Update specific document using ObjectId (message_id ko string se _id mein cast karna zaroori hai)
        result = chat_collection.update_one(
            {"_id": ObjectId(message_id)},
            {"$set": update_fields}
        )

        if result.modified_count > 0:
            print(f"✏️ Message ID {message_id} successfully update ho gaya.")
            return {"status": "success", "message": "Message successfully updated."}
        else:
            print(f"⚠️ Koi message update nahi hua. (Shayad ID galat hai ya data already same tha)")
            return {"status": "warning", "message": "Message not found or no changes made."}

    except Exception as e:
        print(f"❌ Error in update_chat: {e}")
        return {"status": "error", "message": str(e)}

# === 6. CLOSE CONNECTION FUNCTION ===
def close_connection():
    """
    Script ya API restart/end hone par connection safely close karne ke liye (Bonus Feature)
    """
    global client
    if client:
        client.close()
        print("🔌 MongoDB Atlas ka connection close ho gaya hai.")


# ==========================================
# 🎯 TEST CASES / EXAMPLE USAGE
# ==========================================
if __name__ == "__main__":
    # Test user variable
    test_user = "alihaniya_user_1"

    print("--- SCRIPT STARTED ---\n")

    # Step 1: Connect
    is_connected = connect_to_mongodb()

    if is_connected:
        print("\n--- TEST 1: SAVE CHAT ---")
        save_result = save_chat(
            user_id=test_user,
            user_message="Hello! Mujhe Python seekhni hai.",
            bot_response="Zaroor! Main aapko Python sikhane mein madad karunga. Kahan se shuru karein?",
            session_id="session_fastapi_01"
        )

        if save_result["status"] == "success":
            msg_id = save_result["inserted_id"]
            
            print("\n--- TEST 2: GET HISTORY ---")
            # History reverse time order order mein aayegi (Newest first)
            history = get_chat_history(user_id=test_user, limit=5)
            for chat in history:
                print(f"[{chat['timestamp']}] You: {chat['user_message']} | Bot: {chat['bot_response']}")
                
            print("\n--- TEST 3: UPDATE CHAT ---")
            # Let's say user galti se update karta hai, ya bot ki response refine karni ho
            update_chat(
                message_id=msg_id, 
                new_bot_response="Zaroor! Main aapko Python basics se sikhana shuru karunga. Strings and lists theek rahega?"
            )
            
            print("\n--- TEST 4: CHECK UPDATED HISTORY ---")
            updated_history = get_chat_history(user_id=test_user, limit=1)
            if updated_history:
                print(f"Updated Bot Response: {updated_history[0]['bot_response']}")

            print("\n--- TEST 5: DELETE HISTORY (Commented out by default) ---")
            # Agar test clean karna ho to neechay wali line uncomment kar lena:
            # delete_chat_history(user_id=test_user)
            
    print("\n--- SCRIPT ENDING ---")
    close_connection()
