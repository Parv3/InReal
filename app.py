from flask import Flask, render_template, jsonify, request, session
import pandas as pd
from pathlib import Path
import threading
import json
import time
import sys
import os
import tempfile

from scraper import run_scrapers
from output_handler import moderation_counts, pending_moderation, save_verdict, read_all_rows
from moderation.env import load_env
from moderation.link_check import resolve as resolve_link
import auth_db

load_env()
app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "inreal-secure-supersecret-session-key-2026")

# ---- Who may change data ----
# Visitors coming through a public tunnel (Cloudflare) or a host like Render can only READ.
# Writes (scrape, clear, n8n moderation calls) are allowed from this laptop itself, or with the
# secret INREAL_ADMIN_TOKEN in the X-InReal-Token header.
# cloudflared connects from 127.0.0.1 too, but it always adds these headers, so a tunnelled
# request is never mistaken for a local one.
PROXY_HEADERS = ("Cf-Connecting-Ip", "Cf-Ray", "X-Forwarded-For", "X-Forwarded-Host", "Forwarded", "X-Real-Ip")
LOOPBACK = {"127.0.0.1", "::1", "::ffff:127.0.0.1"}
PROTECTED = {"/api/scrape", "/api/clear", "/api/alerts/dismiss"}


def is_local_request() -> bool:
    return request.remote_addr in LOOPBACK and not any(request.headers.get(h) for h in PROXY_HEADERS)


def has_admin_token() -> bool:
    import hmac
    token = os.environ.get("INREAL_ADMIN_TOKEN", "")
    sent = request.headers.get("X-InReal-Token", "")
    return bool(token) and hmac.compare_digest(sent, token)


@app.before_request
def guard_writes():
    path = request.path.rstrip("/")
    needs_admin = path.startswith("/api/moderation/") and path != "/api/moderation/status"
    needs_admin |= path in PROTECTED and request.method == "POST"
    if needs_admin and not (is_local_request() or has_admin_token()):
        return jsonify({"status": "error", "message": "This is a read-only public view. Run scrapes from the laptop."}), 403


@app.route("/api/whoami")
def whoami():
    return jsonify({"can_edit": is_local_request() or has_admin_token()})


# ---- User Authentication Endpoints (SQLite-backed) ----

@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    email = data.get("email", "")
    password = data.get("password", "")
    experience = data.get("experience", "0")

    ok, message = auth_db.register_user(username, email, password, experience)
    if not ok:
        return jsonify({"status": "error", "message": message}), 400
    
    # Automatically log the user in upon successful registration
    user, _ = auth_db.authenticate_user(username, password)
    if user:
        session["user_id"] = user["id"]
        session["username"] = user["username"]
        session["email"] = user["email"]
        session["experience"] = user.get("experience", experience)

    return jsonify({
        "status": "success",
        "message": "Account created successfully! Welcome to InReal.",
        "user": user
    })


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json(silent=True) or {}
    identifier = data.get("username_or_email", "") or data.get("username", "") or data.get("email", "")
    password = data.get("password", "")

    user, error = auth_db.authenticate_user(identifier, password)
    if not user:
        return jsonify({"status": "error", "message": error or "Invalid username/password."}), 401

    session["user_id"] = user["id"]
    session["username"] = user["username"]
    session["email"] = user["email"]
    session["experience"] = user.get("experience", "0")

    return jsonify({
        "status": "success",
        "message": f"Welcome back, {user['username']}!",
        "user": user
    })


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    session.clear()
    return jsonify({"status": "success", "message": "Logged out successfully."})


@app.route("/api/auth/me")
def auth_me():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"logged_in": False, "user": None})

    user = auth_db.get_user_by_id(user_id)
    if not user:
        session.clear()
        return jsonify({"logged_in": False, "user": None})

    return jsonify({
        "logged_in": True,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "experience": user.get("experience", "0")
        }
    })

DATA_FILE = Path(__file__).parent / "internships.csv"
PATTERN_INDEX = Path(__file__).parent / "moderation" / "pattern_index.json"

# Global state for scraping
scraper_t = None

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/map")
def blueprint_map():
    return render_template("map.html")

@app.route("/api/internships")
def get_internships():
    if not DATA_FILE.exists():
        return jsonify([])
        
    try:
        # Read under the writers' lock: on Windows an open reader makes the writer's file replace fail
        from output_handler import read_all_rows
        rows = read_all_rows()
        for r in rows:
            for k in ("match_score", "stipend_numeric"):
                try:
                    if r.get(k) not in (None, ""):
                        v = float(r[k])
                        r[k] = int(v) if v.is_integer() else v
                except ValueError:
                    pass
        return jsonify(rows)
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return jsonify([])

@app.route("/api/scrape", methods=["POST"])
def trigger_scrape():
    global scraper_t
    
    if scraper_t and scraper_t.is_alive():
        return jsonify({"status": "running", "message": "Scraping is already in progress!"})
        
    config = request.json if request.is_json else None
        
    def scrape_job(cfg):
        run_scrapers(dry_run=False, config=cfg)
        
    scraper_t = threading.Thread(target=scrape_job, args=(config,))
    scraper_t.start()
    
    return jsonify({"status": "started", "message": "Scraper started successfully. This might take a while."})

# ---- Moderation API, called by the n8n workflow in n8n/inreal_moderation.json ----

@app.route("/api/moderation/pending")
def moderation_pending():
    try:
        limit = int(request.args.get("limit", 40))
    except ValueError:
        limit = 40
    return jsonify(pending_moderation(limit, claim=request.args.get("claim") == "1"))


@app.route("/api/moderation/status")
def moderation_status():
    return jsonify(moderation_counts())


@app.route("/api/moderation/patterns")
def moderation_patterns():
    if not PATTERN_INDEX.exists():
        return jsonify({"error": "moderation/pattern_index.json is missing. Run: python -m moderation.build_index"}), 404
    return app.response_class(PATTERN_INDEX.read_text(encoding="utf-8"), mimetype="application/json")


@app.route("/api/moderation/resolve")
def moderation_resolve():
    """Opens one listing's apply link: redirect chain, final domain, status, 'closed' wording."""
    listing_id = request.args.get("id", "")
    from output_handler import _read_rows
    row = next((r for r in _read_rows() if r.get("id") == listing_id), None)
    if row is None:
        return jsonify({"id": listing_id, "error": "unknown id"}), 404
    return jsonify({"id": listing_id, **resolve_link(row.get("apply_link", ""))})


@app.route("/api/moderation/verdict", methods=["POST"])
def moderation_verdict():
    data = request.get_json(silent=True) or {}
    try:
        ok = save_verdict(str(data.get("id", "")), str(data.get("status", "")),
                          data.get("scam_risk", 0), data.get("reasons", []))
    except (TypeError, ValueError) as e:
        return jsonify({"saved": False, "error": str(e)}), 400
    if not ok:
        return jsonify({"saved": False, "error": "unknown id"}), 404
    return jsonify({"saved": True, "id": data.get("id"), "status": data.get("status")})


@app.route("/api/scrape/status")
def scrape_status():
    global scraper_t
    import scraper as scraper_mod
    running = bool(scraper_t and scraper_t.is_alive())
    return jsonify({"status": "running" if running else "idle", "progress": scraper_mod.RUN_PROGRESS})

@app.route("/api/logs")
def get_logs():
    log_file = Path(__file__).parent / "scraper_run.log"
    if not log_file.exists():
        return jsonify({"logs": ["No logs yet. Click 'Run Scraper Now' to start!"]})
    try:
        with open(log_file, "r", encoding="utf-8") as f:
            lines = f.readlines()
            # Return last N lines
            return jsonify({"logs": [l.strip() for l in lines[-75:]]})
    except Exception as e:
        return jsonify({"logs": [f"Error reading logs: {e}"]})


@app.route("/api/alerts")
def get_alerts():
    """Returns the current action-required alert, if any (polled every 2s by frontend)."""
    alert_file = Path(__file__).parent / "scraper_alerts.json"
    if not alert_file.exists():
        return jsonify({"alert": None})
    try:
        data = json.loads(alert_file.read_text(encoding="utf-8"))
        if data.get("resolved"):
            return jsonify({"alert": None})
        # Auto-expire alerts older than 120 seconds
        ts_str = data.get("timestamp", "")
        return jsonify({"alert": data})
    except Exception:
        return jsonify({"alert": None})


@app.route("/api/alerts/dismiss", methods=["POST"])
def dismiss_alert():
    """User clicked 'Done' on the dashboard — mark alert as resolved."""
    alert_file = Path(__file__).parent / "scraper_alerts.json"
    try:
        if alert_file.exists():
            data = json.loads(alert_file.read_text(encoding="utf-8"))
            data["resolved"] = True
            
            # Atomic write to prevent race condition data loss
            fd, temp_path = tempfile.mkstemp(dir=alert_file.parent, text=True)
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                json.dump(data, f)
            os.replace(temp_path, alert_file)
    except Exception:
        pass
    return jsonify({"status": "ok"})

@app.route("/api/clear", methods=["POST"])
def clear_data():
    """Clears all historical scraped data to start fresh."""
    global scraper_t
    if scraper_t and scraper_t.is_alive():
        return jsonify({"status": "error", "message": "Cannot clear data while scraper is running!"}), 400
        
    try:
        # Delete CSV Database
        if DATA_FILE.exists():
            DATA_FILE.unlink()
            
        # Delete JSON Logs memory
        log_file = Path(__file__).parent / "internships_log.json"
        if log_file.exists():
            log_file.unlink()
            
        # Delete text log file
        txt_log = Path(__file__).parent / "scraper_run.log"
        if txt_log.exists():
            try:
                txt_log.unlink()
            except PermissionError:
                # On Windows, loguru may hold a lock on this file while running
                with open(txt_log, "w", encoding="utf-8") as f:
                    pass
            
        return jsonify({"status": "success", "message": "All past data has been securely deleted. You have a fresh slate!"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    if os.environ.get("INREAL_DEBUG") == "1":
        app.run(debug=True, host="127.0.0.1", port=port)
    else:
        try:
            from waitress import serve
            host = os.environ.get("HOST", "0.0.0.0")
            print(f"InReal running on http://{host}:{port}  (waitress, debug off)")
            serve(app, host=host, port=port, threads=4)
        except ImportError:
            app.run(host="0.0.0.0", port=port, debug=False)
