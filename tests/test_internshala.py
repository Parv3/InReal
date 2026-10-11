"""Offline tests: parse trimmed copies of the live Internshala pages (no network).

Run from the scraper folder:  python -m pytest tests -q
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from genuine import check_listing, money_asked  # noqa: E402
from scraper import evaluate  # noqa: E402
from sites.internshala import parse_detail_page, parse_list_page, parse_stipend  # noqa: E402

FIX = Path(__file__).parent / "fixtures"


def load(name):
    return (FIX / name).read_text(encoding="utf-8")


def test_list_page_selectors():
    records, is_last = parse_list_page(load("internshala_list.html"))
    assert is_last is False
    assert [r["role_title"] for r in records] == ["AI Web Development", "Python Development", "Machine Learning"]

    wfh, hybrid, ml = records
    assert wfh["company_name"] == "InAmigos Foundation"
    assert wfh["location_type"] == "Remote" and wfh["stipend"] == "Unpaid" and wfh["duration"] == "2 Weeks"

    assert hybrid["location"] == "Nagercoil (Hybrid)" and hybrid["location_type"] == "India"
    assert hybrid["stipend_numeric"] == 5000 and hybrid["part_time"] is True
    assert hybrid["posted"] == "Few hours ago"

    assert ml["required_skills"].startswith("Python, Data Analytics, Machine Learning")
    assert ml["apply_link"] == "https://internshala.com/internship/detail/work-from-home-machine-learning-internship-at-qubixo1791697172"
    assert len({r["id"] for r in records}) == 3


def test_detail_page_selectors():
    d = parse_detail_page(load("internshala_detail.html"))
    assert d["employer_since"] == "November 2025"
    assert d["employer_posted"] == 327 and d["employer_hired"] == 191
    assert d["openings"] == 4
    assert d["start_date"] == "Immediately"
    assert "machine learning models" in d["description"]
    assert "Learn Machine Learning" not in d["description"]  # Internshala's own course ads stay out


def test_stipend_parsing():
    assert parse_stipend("₹ 10,000 /month") == (10000, "INR")
    assert parse_stipend("$ 500 - 1,000 /month") == (500, "USD")
    assert parse_stipend("₹ 2,000 - 3,000 /week") == (8660, "INR")
    assert parse_stipend("Competitive stipend") == (0, "INR")


def test_filters_and_genuine_end_to_end():
    records, _ = parse_list_page(load("internshala_list.html"))
    records[2].update(parse_detail_page(load("internshala_detail.html")))
    out = {item["role_title"]: (kept, reason) for item, kept, reason in evaluate("internshala", records)}
    assert out["AI Web Development"] == (False, "Not an AI/ML role")
    assert out["Python Development"] == (False, "Not an AI/ML role")  # title and skills never mention AI/ML
    assert out["Machine Learning"] == (True, "")


def test_money_patterns():
    assert money_asked("Pay a refundable security deposit of Rs 2,000 to confirm your seat")
    assert money_asked("A registration fee of ₹499 is required")
    assert money_asked("Pay ₹999 to book your internship slot")
    # employer paying, or saying there is no fee: must not drop
    assert money_asked("Stipend Structure: Fixed pay: ₹ 6,000 - 8,000 /month Incentive pay: ₹ 1,000") is None
    assert money_asked("We pay ₹ 15,000 per month to selected interns") is None
    assert money_asked("There is no registration fee for this internship") is None


def test_mass_programme_is_dropped():
    item = {"role_title": "AI & Machine Learning", "description": "", "stipend": "₹ 5,000 /month",
            "stipend_numeric": 5000, "duration": "2 Weeks",
            "employer_since": "June 2021", "employer_posted": 1883, "employer_hired": 416373}
    reason, _ = check_listing(item)
    assert reason.startswith("Mass programme")


def test_soft_flags_keep_listing():
    item = {"role_title": "Machine Learning", "description": "", "stipend": "Competitive stipend",
            "stipend_numeric": 0, "duration": "3 Months",
            "employer_since": "January 2014", "employer_posted": 446, "employer_hired": 16}
    reason, flags = check_listing(item)
    assert reason is None
    assert any("Posts a lot" in f for f in flags)
    assert "Stipend amount not stated" in flags


def test_ai_ml_relevance_uses_title_or_two_real_ml_skills():
    from filters import internship_rejection_reason as why
    # real ML roles
    assert why("Machine Learning", [], "internshala") is None
    assert why("AI Robotics/ML Research Engineer", [], "internshala") is None
    assert why("Founding AI Engineer", [], "internshala") is None
    assert why("AI Research Intern", [], "internshala") is None
    assert why("Robotics Data Engineer", ["OpenCV", "Python", "Machine Learning"], "internshala") is None
    # roles that only carry a fluffy "AI" tag or title word (seen on the live site, Oct 2026)
    assert why("Digital Marketing", ["SEO", "Artificial intelligence"], "internshala") == "Not an AI/ML role"
    assert why("AI Video Editor", ["Generative AI Tools", "Video Editing"], "internshala") == "Not an AI/ML role"
    assert why("AI Web Development", ["HTML", "CSS"], "internshala") == "Not an AI/ML role"
    assert why("Marketing Research – AI/US Market", ["Market Analysis"], "internshala") == "Not an AI/ML role"
    assert why("Python Development", ["Python", "Machine Learning", "Flask"], "internshala") == "Not an AI/ML role"
    # one skill tag must not count twice ("Natural Language Processing (NLP)")
    assert why("Data Analytics", ["Natural Language Processing (NLP)", "Excel"], "internshala") == "Not an AI/ML role"
    # "Leadership" as a skill no longer knocks out a real listing
    assert why("Machine Learning", ["Leadership"], "internshala") is None
