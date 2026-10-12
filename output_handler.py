import json
import csv
import threading
import time
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
    "org_type", "role_type", "match_score",
    "posted", "trust_flags",
    # text the n8n moderation pipeline reads, and what it decided
    "description", "moderation_status", "scam_risk", "moderation_reasons", "moderated_at",
]
MODERATION_FIELDS = ["moderation_status", "scam_risk", "moderation_reasons", "moderated_at"]
# If any of these change, the listing is a different post and must be moderated again
CONTENT_FIELDS = ["company_name", "role_title", "stipend", "apply_link", "description"]
MODERATION_STATUSES = {"approved", "review", "blocked", "expired"}   # "checking" is set only by a claim
DESCRIPTION_LIMIT = 3000

# The scraper thread and the n8n verdict calls both write internships.csv
_CSV_LOCK = threading.RLock()

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

def _read_rows() -> list:
    if not CSV_FILE.exists():
        return []
    with open(CSV_FILE, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _write_rows(rows: list):
    rows.sort(key=lambda r: str(r.get("date_scraped", "")), reverse=True)
    tmp = CSV_FILE.with_suffix(".csv.tmp")
    with open(tmp, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS, extrasaction="ignore")
        writer.writeheader()
        for r in rows:
            writer.writerow({k: r.get(k, "") for k in CSV_HEADERS})
    # Windows refuses to replace a file another reader has open ("WinError 5 Access is denied",
    # laptop 12 Oct 10:46: one n8n verdict was lost and stayed "checking"). Retry briefly.
    for attempt in range(20):
        try:
            tmp.replace(CSV_FILE)   # the dashboard never reads a half-written file
            return
        except PermissionError:
            if attempt == 19:
                raise
            time.sleep(0.1 * (attempt + 1))


def _record(item: dict) -> dict:
    rec = {k: item.get(k, "") for k in CSV_HEADERS if k not in MODERATION_FIELDS}
    rec["description"] = " ".join(str(item.get("description") or "").split())[:DESCRIPTION_LIMIT]
    return rec


def sync_listings(kept: list, dropped_ids: list) -> dict:
    """
    Saves one scraper run and keeps earlier rows up to date.

    The old append-only save never touched a row again, so a listing saved before a
    rule changed kept its old warnings forever (12 Oct 2026: "AI Intern" at Fireblaze
    AI School, saved at 06:52, never got the training-institute warning added at 07:15).
      - kept listing already saved   -> its fields are refreshed (trust_flags, stipend, ...)
      - kept listing not seen before -> added and marked new
      - listing this run re-checked and dropped -> removed from the dashboard
    Listings that simply did not appear in this run are left alone.
    The n8n verdict is kept unless the post's own text changed; then it is moderated again.
    """
    with _CSV_LOCK:
        log_data = load_log()
        seen_ids = set(log_data.setdefault("seen_ids", []))
        rows = _read_rows()
        by_id = {r.get("id"): r for r in rows}
        keep_as_is = {"id", "date_scraped", "is_new", *MODERATION_FIELDS}
        added = updated = 0

        for item in kept:
            rec = _record(item)
            # Full fresh pipeline: no cached moderation status or prediction memory
            for k in MODERATION_FIELDS:
                rec[k] = ""
            rec["is_new"] = True
            
            old = by_id.get(item["id"])
            if old is not None:
                # Update existing row with fresh data and reset moderation
                old.update(rec)
                updated += 1
            else:
                rows.append(rec)
                by_id[item["id"]] = rec
                seen_ids.add(item["id"])
                added += 1

        gone = set(dropped_ids) & set(by_id)
        if gone:
            rows = [r for r in rows if r.get("id") not in gone]
            seen_ids -= gone   # so it can come back if the post changes or the rules relax

        _write_rows(rows)
        log_data["seen_ids"] = sorted(seen_ids)
        log_data["total_scraped"] = len(seen_ids)
        log_data["last_run"] = datetime.now().strftime("%Y-%m-%d")
        save_log(log_data)
    return {"added": added, "updated": updated, "removed": len(gone)}


PENDING_FIELDS = ["id", "company_name", "role_title", "location", "duration", "stipend", "stipend_numeric",
                  "required_skills", "apply_link", "source_platform", "org_type", "trust_flags", "description"]


CLAIM_TIMEOUT_MIN = 15   # a "checking" claim older than this is treated as lost (n8n stopped mid-run)


def _is_pending(r: dict, now: datetime) -> bool:
    status = (r.get("moderation_status") or "").strip()
    if not status:
        return True
    if status == "checking":
        try:
            return (now - datetime.strptime(r.get("moderated_at", ""), "%Y-%m-%d %H:%M:%S")).total_seconds() > CLAIM_TIMEOUT_MIN * 60
        except ValueError:
            return True
    return False


def pending_moderation(limit: int = 5, claim: bool = False) -> list:
    """
    Listings the n8n pipeline has not judged yet.
    Selects items in round-robin fashion across different source platforms (e.g. Internshala, Unstop, Apna...)
    so when multiple sources are scraped, every source gets fair representation in the 5-item batch.
    claim=True marks them "checking".
    """
    now = datetime.now()
    with _CSV_LOCK:
        rows = _read_rows()
        all_pending = [r for r in rows if _is_pending(r, now)]
        
        # Group pending by source_platform for round-robin interleaving
        from collections import defaultdict
        by_source = defaultdict(list)
        for r in all_pending:
            src = r.get("source_platform") or "unknown"
            by_source[src].append(r)
            
        round_robin = []
        sources = list(by_source.keys())
        idx = 0
        while len(round_robin) < len(all_pending) and sources:
            src = sources[idx % len(sources)]
            if by_source[src]:
                round_robin.append(by_source[src].pop(0))
            else:
                sources.remove(src)
                continue
            idx += 1
            
        todo = round_robin[:max(1, limit)]
        if claim and todo:
            for r in todo:
                r["moderation_status"] = "checking"
                r["moderated_at"] = now.strftime("%Y-%m-%d %H:%M:%S")
            _write_rows(rows)
    return [{k: r.get(k, "") for k in PENDING_FIELDS} for r in todo]


def moderation_counts() -> dict:
    now = datetime.now()
    with _CSV_LOCK:
        rows = _read_rows()
    out = {"pending": 0, "checking": 0, "approved": 0, "review": 0, "blocked": 0, "expired": 0}
    for r in rows:
        st = (r.get("moderation_status") or "").strip()
        key = "pending" if _is_pending(r, now) else st
        out[key] = out.get(key, 0) + 1
    return out


def save_verdict(listing_id: str, status: str, scam_risk, reasons) -> bool:
    """Stores the n8n verdict on one listing. Returns False if the id is unknown."""
    if status == "retry":   # the checks could not run (API down): back to the queue
        with _CSV_LOCK:
            rows = _read_rows()
            row = next((r for r in rows if r.get("id") == listing_id), None)
            if row is None:
                return False
            for k in MODERATION_FIELDS:
                row[k] = ""
            _write_rows(rows)
        return True
    if status not in MODERATION_STATUSES:
        raise ValueError(f"status must be one of {sorted(MODERATION_STATUSES)} or 'retry'")
    risk = float(scam_risk)
    if not 0.0 <= risk <= 1.0:
        raise ValueError("scam_risk must be between 0 and 1")
    if isinstance(reasons, (list, tuple)):
        reasons = " | ".join(str(r).replace("|", "/").strip() for r in reasons if str(r).strip())
    with _CSV_LOCK:
        rows = _read_rows()
        row = next((r for r in rows if r.get("id") == listing_id), None)
        if row is None:
            return False
        row.update({"moderation_status": status, "scam_risk": f"{risk:.2f}",
                    "moderation_reasons": str(reasons or "")[:1500],
                    "moderated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")})
        _write_rows(rows)
    return True


def update_run_history(new_listings_count: int, sources_failed: list):
    with _CSV_LOCK:
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


def read_all_rows() -> list:
    """For the dashboard: read under the same lock the writers use, so a read never blocks a write."""
    with _CSV_LOCK:
        return _read_rows()

