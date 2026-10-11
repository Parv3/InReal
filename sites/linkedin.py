"""
LinkedIn Jobs Scraper (Public Page — No Login Required)
────────────────────────────────────────────────────────
Scrapes LinkedIn's GUEST jobs search pages using Playwright.
LinkedIn shows job listings on their public /jobs/search/ pages
without requiring login. Browser runs visible (headless=False) so
the user can close any sign-in/cookie popups.

Verified selectors (Feb 2026):
  - Card:     div.base-card  (or .base-search-card)
  - Title:    h3.base-search-card__title
  - Company:  h4.base-search-card__subtitle  or  a.hidden-nested-link
  - Location: span.job-search-card__location
  - Link:     a.base-card__full-link
"""

import hashlib
import random
from datetime import datetime
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth
from loguru import logger

from filters import calculate_match_score
from scraper_utils import human_delay, get_playwright_stealth_args

# ── Every major location × every major AI/ML keyword ─────────────────────────
# LinkedIn's f_JT=I = Internship job type, f_E=1 = Entry level
SEARCH_CONFIGS = [
    # ── WORLDWIDE BROAD ───────────────────────────────────────────────────────
    ("machine learning internship",               "Worldwide",      "Global · ML"),
    ("artificial intelligence internship",        "Worldwide",      "Global · AI"),
    ("deep learning internship",                  "Worldwide",      "Global · DL"),
    ("data science internship",                   "Worldwide",      "Global · DS"),
    ("computer vision internship",                "Worldwide",      "Global · CV"),
    ("natural language processing internship",    "Worldwide",      "Global · NLP"),
    ("AI research intern",                        "Worldwide",      "Global · Research"),
    ("generative AI internship",                  "Worldwide",      "Global · GenAI"),
    ("large language model internship",           "Worldwide",      "Global · LLM"),
    ("reinforcement learning internship",         "Worldwide",      "Global · RL"),
    ("robotics AI internship",                    "Worldwide",      "Global · Robotics"),
    ("machine learning engineer intern",          "Worldwide",      "Global · MLE"),

    # ── INDIA ─────────────────────────────────────────────────────────────────
    ("AI ML internship",                          "India",          "India · AI/ML"),
    ("machine learning internship",               "India",          "India · ML"),
    ("data science internship",                   "India",          "India · DS"),
    ("artificial intelligence internship",        "India",          "India · AI"),
    ("deep learning internship",                  "India",          "India · DL"),
    ("computer vision internship",                "India",          "India · CV"),
    ("NLP internship",                            "India",          "India · NLP"),
    ("AI research intern",                        "India",          "India · Research"),
    ("machine learning internship",               "Bangalore, India",   "Bangalore · ML"),
    ("machine learning internship",               "Hyderabad, India",   "Hyderabad · ML"),
    ("machine learning internship",               "Mumbai, India",      "Mumbai · ML"),
    ("machine learning internship",               "Delhi, India",       "Delhi · ML"),
    ("machine learning internship",               "Pune, India",        "Pune · ML"),
    ("AI internship",                             "Chennai, India",     "Chennai · AI"),
    ("research intern AI",                        "India",          "India · Uni Research"),

    # ── UNITED STATES ─────────────────────────────────────────────────────────
    ("machine learning intern",                   "United States",  "USA · ML"),
    ("AI research intern",                        "United States",  "USA · Research"),
    ("deep learning intern",                      "San Francisco Bay Area", "SF Bay · DL"),
    ("machine learning intern",                   "New York, United States", "NYC · ML"),
    ("AI intern",                                 "Seattle, Washington, United States", "Seattle · AI"),
    ("machine learning intern",                   "Boston, Massachusetts, United States", "Boston · ML"),

    # ── EUROPE ────────────────────────────────────────────────────────────────
    ("machine learning internship",               "Europe",         "Europe · ML"),
    ("AI research intern",                        "Europe",         "Europe · Research"),
    ("machine learning intern",                   "United Kingdom", "UK · ML"),
    ("AI ML internship",                          "Germany",        "Germany · AI/ML"),
    ("machine learning internship",               "France",         "France · ML"),
    ("AI research intern",                        "Netherlands",    "Netherlands · AI"),
    ("machine learning intern",                   "Switzerland",    "Switzerland · ML"),
    ("AI internship",                             "Sweden",         "Sweden · AI"),
    ("machine learning internship",               "Denmark",        "Denmark · ML"),
    ("AI research intern",                        "Finland",        "Finland · AI"),  # Aalto area
    ("machine learning intern",                   "Netherlands",    "Netherlands · ML"),
    ("AI intern",                                 "Spain",          "Spain · AI"),
    ("machine learning intern",                   "Italy",          "Italy · ML"),
    ("AI research intern",                        "Belgium",        "Belgium · AI"),
    ("deep learning intern",                      "Austria",        "Austria · DL"),

    # ── ASIA-PACIFIC ──────────────────────────────────────────────────────────
    ("machine learning intern",                   "Singapore",      "Singapore · ML"),
    ("AI internship",                             "Singapore",      "Singapore · AI"),
    ("machine learning intern",                   "Japan",          "Japan · ML"),
    ("AI research intern",                        "South Korea",    "Korea · AI"),
    ("machine learning internship",               "China",          "China · ML"),
    ("AI intern",                                 "Hong Kong",      "HK · AI"),
    ("machine learning internship",               "Australia",      "Australia · ML"),
    ("AI research intern",                        "Australia",      "Australia · Research"),
    ("machine learning intern",                   "New Zealand",    "NZ · ML"),

    # ── CANADA ────────────────────────────────────────────────────────────────
    ("machine learning intern",                   "Canada",         "Canada · ML"),
    ("AI research intern",                        "Toronto, Canada","Toronto · AI"),
    ("machine learning internship",               "Montreal, Canada","Montreal · ML"),  # Mila area
    ("deep learning intern",                      "Vancouver, Canada","Vancouver · DL"),

    # ── MIDDLE EAST & AFRICA ──────────────────────────────────────────────────
    ("machine learning internship",               "United Arab Emirates", "UAE · ML"),
    ("AI internship",                             "Saudi Arabia",   "Saudi · AI"),
    ("machine learning intern",                   "South Africa",   "SA · ML"),
    ("AI research intern",                        "Israel",         "Israel · AI"),

    # ── LATIN AMERICA ─────────────────────────────────────────────────────────
    ("machine learning internship",               "Brazil",         "Brazil · ML"),
    ("AI internship",                             "Mexico",         "Mexico · AI"),

    # ── REMOTE (ANYWHERE) ─────────────────────────────────────────────────────
    ("machine learning intern",                   "Remote",         "Remote · ML"),
    ("AI research intern",                        "Remote",         "Remote · Research"),
    ("deep learning intern",                      "Remote",         "Remote · DL"),
    ("data science intern",                       "Remote",         "Remote · DS"),
]


BASE_URL = "https://www.linkedin.com/jobs/search/?keywords={kw}&location={loc}&f_JT=I&f_E=1"


def _close_popups(page):
    """Dismiss LinkedIn's sign-in modal and cookie banners if they appear."""
    try:
        # Cookie accept
        page.locator("button[action-type='ACCEPT']").click(timeout=3000)
    except Exception:
        pass
    try:
        # Sign-in modal close
        page.locator("button.modal__dismiss").click(timeout=3000)
    except Exception:
        pass
    try:
        page.locator("button[aria-label='Dismiss']").click(timeout=3000)
    except Exception:
        pass


def scrape_linkedin(config=None):
    """
    Scrapes LinkedIn public job search pages for AI/ML internships.
    Runs fully headless. Filters internal query list based on given config.
    """
    if config is None:
        config = {
            "regions": ["india", "worldwide", "usa", "europe", "remote"],
            "topics": ["ml", "ai", "nlp", "cv", "ds", "research", "llm/genai"]
        }
    
    default_regions = ["india", "worldwide", "usa", "europe", "remote"]
    default_topics = ["ml", "ai", "nlp", "cv", "ds", "research", "llm/genai"]

    req_regions = [r.lower() for r in config.get("regions", default_regions)]
    req_topics = [t.lower() for t in config.get("topics", default_topics)]
    
    if not req_regions:
        logger.warning("LinkedIn: No regions specified, using defaults")
        req_regions = [r.lower() for r in default_regions]

    all_internships = []
    seen = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,  # Fully automated
            args=get_playwright_stealth_args(),
        )
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1440, "height": 900},
            locale="en-US",
        )
        page = context.new_page()
        Stealth().apply_stealth_sync(page)

        for kw, loc, label in SEARCH_CONFIGS:
            try:
                # Filter by config parameters
                kw_lower = kw.lower()
                loc_lower = loc.lower()
                
                # Check region map
                is_india = "india" in loc_lower
                is_remote = "remote" in loc_lower or "anywhere" in loc_lower
                is_worldwide = "worldwide" in loc_lower
                is_europe = "europe" in loc_lower or "kingdom" in loc_lower or "germany" in loc_lower or "france" in loc_lower or "netherlands" in loc_lower or "switzerland" in loc_lower or "sweden" in loc_lower or "denmark" in loc_lower or "finland" in loc_lower or "spain" in loc_lower or "italy" in loc_lower or "belgium" in loc_lower or "austria" in loc_lower
                is_usa = "united states" in loc_lower or "bay area" in loc_lower or "seattle" in loc_lower or "boston" in loc_lower or "york" in loc_lower
                
                # Default map to worldwide if none of above
                region_match = False
                if "india" in req_regions and is_india: region_match = True
                if "usa" in req_regions and is_usa: region_match = True
                if "europe" in req_regions and is_europe: region_match = True
                if "remote" in req_regions and is_remote: region_match = True
                if "worldwide" in req_regions and (is_worldwide or (not is_india and not is_usa and not is_europe and not is_remote)): region_match = True
                
                if not region_match:
                    continue
                    
                # Topic match
                topic_match = False
                if "ai" in req_topics and ("artificial intelligence" in kw_lower or "ai " in kw_lower or " ai" in kw_lower or kw_lower.startswith("ai") or "robotics" in kw_lower): topic_match = True
                if "ml" in req_topics and ("machine learning" in kw_lower or "reinforcement" in kw_lower or "rl " in kw_lower): topic_match = True
                if "dl" in req_topics and "deep learning" in kw_lower: topic_match = True
                if "ds" in req_topics and "data science" in kw_lower: topic_match = True
                if "cv" in req_topics and "computer vision" in kw_lower: topic_match = True
                if "nlp" in req_topics and "natural language" in kw_lower: topic_match = True
                if "research" in req_topics and "research" in kw_lower: topic_match = True
                if "llm/genai" in req_topics and ("generative" in kw_lower or "large language" in kw_lower): topic_match = True
                
                # Allow fallback if no specific topic arrays given
                if req_topics and not topic_match:
                    # If user chose specific topics and this config query matches none of them, skip.
                    continue
                    
                import urllib.parse
                url = BASE_URL.format(
                    kw=urllib.parse.quote_plus(kw),
                    loc=urllib.parse.quote_plus(loc),
                )
                logger.info(f"LinkedIn: Scraping [{label}] — {url}")
                page.goto(url, timeout=45000)

                # Automatically close popups without waiting for the user
                _close_popups(page)

                # Scroll to load more job cards
                for _ in range(5):
                    page.mouse.wheel(0, random.randint(700, 1400))
                    human_delay(1.0, 2.0)

                html = page.content()
                soup = BeautifulSoup(html, "lxml")

                # LinkedIn guest page uses these card selectors
                cards = soup.find_all("div", class_=lambda c: c and "base-card" in c)
                if not cards:
                    # Fallback: look for job cards with data attributes
                    cards = soup.find_all("li", class_=lambda c: c and "jobs-search__results-list" in (c or ""))
                logger.info(f"LinkedIn [{label}]: Found {len(cards)} cards")

                for card in cards:
                    try:
                        # Title
                        title_elem = (
                            card.find("h3", class_=lambda c: c and "base-search-card__title" in c)
                            or card.find("h3")
                        )
                        if not title_elem:
                            continue
                        role_title = title_elem.get_text(strip=True)

                        # Company
                        comp_elem = (
                            card.find("h4", class_=lambda c: c and "base-search-card__subtitle" in c)
                            or card.find("a", class_=lambda c: c and "hidden-nested-link" in (c or ""))
                            or card.find("h4")
                        )
                        company_name = (
                            comp_elem.get_text(strip=True) if comp_elem else "Unknown"
                        )

                        # Location
                        loc_elem = card.find(
                            "span",
                            class_=lambda c: c and "job-search-card__location" in c,
                        )
                        location = (
                            loc_elem.get_text(strip=True) if loc_elem else loc
                        )
                        loc_lower = location.lower()
                        if "remote" in loc_lower:
                            location_type = "Remote"
                        elif any(
                            x in loc_lower
                            for x in ["india", "bangalore", "mumbai", "delhi", "hyderabad", "pune", "chennai"]
                        ):
                            location_type = "India"
                        else:
                            location_type = "International"

                        # Apply link
                        link_elem = card.find(
                            "a",
                            class_=lambda c: c and "base-card__full-link" in (c or ""),
                        ) or card.find("a", href=True)
                        apply_link = link_elem["href"] if link_elem else ""
                        if apply_link and "?" in apply_link:
                            apply_link = apply_link.split("?")[0]  # clean tracking params

                        # Deduplicate
                        uid = hashlib.md5(
                            f"{company_name}-{role_title}-LinkedIn".encode()
                        ).hexdigest()
                        if uid in seen:
                            continue
                        seen.add(uid)

                        org_type = "Company"
                        role_type = (
                            "Research"
                            if "research" in role_title.lower()
                            else "Applied"
                        )
                        match_score = calculate_match_score(
                            role_title, [], org_type, 0.0
                        )
                        currency = "INR" if location_type == "India" else "USD"
                        stip_numeric = 5000.0 if location_type == "India" else 1500.0

                        record = {
                            "id": uid,
                            "company_name": company_name,
                            "role_title": role_title,
                            "location": location,
                            "location_type": location_type,
                            "duration": "",
                            "stipend": "Check Listing",
                            "stipend_numeric": stip_numeric,
                            "stipend_currency": currency,
                            "required_skills": "",
                            "application_deadline": "",
                            "apply_link": apply_link,
                            "source_platform": f"LinkedIn ({label})",
                            "date_scraped": datetime.now().strftime("%Y-%m-%d"),
                            "org_type": org_type,
                            "role_type": role_type,
                            "match_score": match_score,
                        }
                        all_internships.append(record)

                    except Exception as e:
                        logger.error(f"LinkedIn: Error parsing card: {e}")

            except Exception as e:
                logger.error(f"LinkedIn: Failed to load [{label}]: {e}")
                # Continue rather than raise, to preserve already scraped data
                continue

            human_delay(4.0, 8.0)  # Respectful delay between searches

        browser.close()

    logger.info(f"LinkedIn: Scraped {len(all_internships)} unique internships.")
    return all_internships
