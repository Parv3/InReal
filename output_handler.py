import json
import csv
import pandas as pd
from datetime import datetime
from pathlib import Path

# Paths relative to this file
DATA_DIR = Path(__file__).parent
LOG_FILE = DATA_DIR / "internships_log.json"
CSV_FILE = DATA_DIR / "internships.csv"

CSV_HEADERS = [
    "id", "company_name", "role_title", "location", "location_type",
    "duration", "stipend", "stipend_numeric", "stipend_currency",
    "required_skills", "application_deadline", "apply_link",
    "source_platform", "date_scraped", "is_new", 
    "org_type", "role_type", "match_score"
]

def load_log():
    if LOG_FILE.exists():
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "last_run": None,
        "total_scraped": 0,
        "seen_ids": [],
        "run_history": []
    }

def save_log(log_data):
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(log_data, f, indent=2)

def is_duplicate(internship_id: str, log_data: dict = None) -> bool:
    if log_data is None:
        log_data = load_log()
    return internship_id in log_data.get("seen_ids", [])

def append_to_csv(internships: list) -> int:
    """
    Saves a list of internship dicts to CSV. 
    Also updates the json log.
    Returns: Number of new records added.
    """
    if not internships:
        return 0
        
    log_data = load_log()
    seen_ids = set(log_data.setdefault("seen_ids", []))
    
    new_records = []
    
    for item in internships:
        if item["id"] not in seen_ids:
            item["is_new"] = True
            new_records.append(item)
            seen_ids.add(item["id"])
        
    if not new_records:
        return 0
        
    log_data["seen_ids"] = list(seen_ids)
    log_data["total_scraped"] = len(seen_ids)
    today_str = datetime.now().strftime("%Y-%m-%d")
    log_data["last_run"] = today_str
    
    file_exists = CSV_FILE.exists()
    
    with open(CSV_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        if not file_exists:
            writer.writeheader()
        for rec in new_records:
            filtered_rec = {k: rec.get(k, "") for k in CSV_HEADERS}
            writer.writerow(filtered_rec)
            
    # Read and sort by date_scraped descending
    try:
        df = pd.read_csv(CSV_FILE)
        if "date_scraped" in df.columns:
            df["date_scraped"] = pd.to_datetime(df["date_scraped"], errors='coerce')
            df = df.sort_values(by="date_scraped", ascending=False)
            df["date_scraped"] = df["date_scraped"].dt.strftime("%Y-%m-%d")
            df.to_csv(CSV_FILE, index=False)
    except Exception as e:
        print(f"Warning: Could not sort CSV: {e}")
            
    save_log(log_data)
    return len(new_records)
    
def update_run_history(new_listings_count: int, sources_failed: list):
    log_data = load_log()
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    # Check if we already have an entry for today
    history = log_data.get("run_history", [])
    today_entry = next((item for item in history if item["date"] == today_str), None)
    
    if today_entry:
        today_entry["new_listings"] += new_listings_count
        # Merge sources_failed without duplicates
        today_entry["sources_failed"] = list(set(today_entry.get("sources_failed", []) + sources_failed))
    else:
        history.append({
            "date": today_str,
            "new_listings": new_listings_count,
            "sources_failed": sources_failed
        })
        
    log_data["run_history"] = history
    log_data["last_run"] = today_str
    save_log(log_data)
