"""Offline tests for Unstop: trimmed copies of the live API and list page (no network)."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from genuine import check_listing  # noqa: E402
from scraper import evaluate  # noqa: E402
from sites.unstop import parse_api_page, parse_api_record, parse_list_html  # noqa: E402

FIX = Path(__file__).parent / "fixtures"


def api():
    return json.loads((FIX / "unstop_api.json").read_text(encoding="utf-8"))


def test_api_fields():
    records, last_page = parse_api_page(api())
    assert last_page == 1
    ml, cv, smm = records

    assert ml["role_title"] == "AI & ML Intern"
    assert ml["company_name"] == "Slonix Solution Private Limited"
    assert ml["location"] == "Bangalore (Hybrid)" and ml["location_type"] == "India"
    assert ml["stipend"] == "₹ 15,000 - 20,000 /month" and ml["stipend_numeric"] == 15000
    assert ml["required_skills"].endswith("Machine Learning Concepts")
    assert ml["apply_link"] == "https://unstop.com/internships/data-science-internship-slonix-solution-private-limited-1764096"
    assert ml["application_deadline"] == "2026-10-15"
    assert "machine learning models" in ml["description"] and "<li>" not in ml["description"]

    assert cv["stipend"] == "" and cv["stipend_numeric"] == 0  # paid, amount hidden (show_salary 0)
    assert smm["stipend"] == "Unpaid" and smm["location"] == "Work from home" and smm["location_type"] == "Remote"


def test_closed_records_are_skipped():
    rec = api()["data"]["data"][0]
    assert parse_api_record({**rec, "status": "EXPIRED"}) is None
    assert parse_api_record({**rec, "regnRequirements": {"reg_status": "FINISHED"}}) is None


def test_filters_end_to_end():
    records, _ = parse_api_page(api())
    out = {item["role_title"]: (kept, reason) for item, kept, reason in evaluate("unstop", records)}
    assert out["AI & ML Intern"] == (True, "")
    assert out["Computer Vision AI Internship"] == (True, "")
    assert out["Social Media Marketing Internship"] == (False, "Not an AI/ML role")
    cv = next(r for r in records if r["role_title"] == "Computer Vision AI Internship")
    assert "Stipend amount not stated" in cv["trust_flags"]


def test_html_fallback_selectors():
    cards = parse_list_html((FIX / "unstop_list.html").read_text(encoding="utf-8"))
    assert [c["role_title"] for c in cards] == ["Social Media Marketing Internship", "Python Internship"]
    assert cards[1]["company_name"] == "Learntricks Edutech"
    assert cards[1]["location_type"] == "Remote"
    assert cards[1]["stipend"] == "12 K - 15 K/Month" and cards[1]["stipend_numeric"] == 12000
    assert cards[0]["stipend"] == ""


def test_commission_pay_is_flagged_not_dropped():
    item = {"role_title": "Campus Growth Ambassador", "stipend": "₹ 1,000 /month", "stipend_numeric": 1000,
            "description": "Performance-based earnings: ₹1,000 – ₹5,000/month. Earnings depend on your performance. "
                           "No registration fee. No joining fee."}
    reason, flags = check_listing(item)
    assert reason is None
    assert "Pay depends on commission or performance" in flags
