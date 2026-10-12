import sqlite3
from pathlib import Path
from werkzeug.security import generate_password_hash, check_password_hash

DB_PATH = Path(__file__).parent / "inreal.db"

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

def register_user(username: str, email: str, password: str):
    username = username.strip()
    email = email.strip().lower()
    if not username or not email or not password:
        return False, "Username, email, and password are required."
    
    password_hash = generate_password_hash(password)
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
                (username, email, password_hash)
            )
            conn.commit()
            return True, "User registered successfully."
    except sqlite3.IntegrityError as e:
        err_msg = str(e).lower()
        if "username" in err_msg:
            return False, "Username already exists. Please pick another."
        elif "email" in err_msg:
            return False, "Email already exists. Please log in or use another email."
        return False, "Username or email already registered."
    except Exception as e:
        return False, f"Registration failed: {str(e)}"

def authenticate_user(username_or_email: str, password: str):
    identifier = username_or_email.strip()
    if not identifier or not password:
        return None, "Please provide username/email and password."
        
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)",
                (identifier, identifier)
            )
            user = cursor.fetchone()
            if user and check_password_hash(user["password_hash"], password):
                return {
                    "id": user["id"],
                    "username": user["username"],
                    "email": user["email"]
                }, None
            return None, "Invalid credentials. Please verify username and password."
    except Exception as e:
        return None, f"Authentication error: {str(e)}"

def get_user_by_id(user_id: int):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT id, username, email FROM users WHERE id = ?", (user_id,))
            user = cursor.fetchone()
            if user:
                return dict(user)
            return None
    except Exception:
        return None

# Ensure the database table exists on module load
init_db()
