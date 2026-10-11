"""
Unstop Internship Scraper
─────────────────────────
Scrapes AI/ML internship listings from unstop.com using Playwright.
Browser runs visible (headless=False) so the user can solve CAPTCHAs.

Verified selectors (Feb 2026):
  - Card:     a.item
  - Title:    h3 inside card
  - Company:  p (first p sibling after h3)
  - Location: span.job_location
  - Stipend:  .cash_widget strong
  - Link:     href of a.item
"""

import random
import hashlib
from datetime import datetime
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth
from loguru import logger
import re

from filters import calculate_match_score
from scraper_utils import human_delay, get_playwright_stealth_args, action_required, action_resolved
from tenacity import retry, wait_exponential, stop_after_attempt

URLS = [
    "https://unstop.com/internships?domain=tech&specialization=ai-ml",
    "https://unstop.com/internships?query=artificial+intelligence",
    "https://unstop.com/internships?query=machine+learning",
    "https://unstop.com/internships?query=deep+learning",
    "https://unstop.com/internships?query=data+science",
    "https://unstop.com/internships?query=computer+vision",
    "https://unstop.com/internships?query=nlp",
]


def _parse_stipend(text: str) -> float:
    """Convert '10 K/Month' → 10000, '25,000' → 25000, etc."""
    if not text:
        return 0.0
    text = text.replace(",", "").upper()
    m = re.search(r"(\d+(?:\.\d+)?)\s*K", text)
    if m:
        return float(m.group(1)) * 1000
    m = re.search(r"(\d+)", text)
    if m:
        return float(m.group(1))
    return 0.0


@retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(3))
def scrape_unstop():
    """Scrapes AI/ML internship listings from Unstop."""
    all_internships = []
    seen = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,  # Fully automated, no UI shown
            args=get_playwright_stealth_args(),
        )
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1440, "height": 900},
        )
        page = context.new_page()
        Stealth().apply_stealth_sync(page)

        for url in URLS:
            try:
                logger.info(f"Scraping Unstop: {url} ...")
                page.goto(url, timeout=45000)

                # Wait for cards — give user time to solve CAPTCHA if shown
                action_required("Unstop", "Browser is open. If a CAPTCHA appears, please solve it within 45 seconds.", "captcha")
                try:
                    page.wait_for_selector("a.item", timeout=45000)
                except Exception:
                    logger.warning(f"Unstop: Timeout or no 'a.item' cards on {url}")
                finally:
                    action_resolved("Unstop")

                # Scroll to load lazy content
                for _ in range(4):
                    page.mouse.wheel(0, random.randint(600, 1400))
                    human_delay(1.2, 2.5)

                html = page.content()
                soup = BeautifulSoup(html, "lxml")

                cards = soup.find_all("a", class_="item")
                logger.info(f"Unstop: Found {len(cards)} cards on {url}")

                for card in cards:
                    try:
                        href = card.get("href", "")
                        if not href:
                            continue
                        apply_link = (
                            "https://unstop.com" + href
                            if href.startswith("/")
                            else href
                        )

                        # Deduplicate
                        uid = hashlib.md5(apply_link.encode()).hexdigest()
                        if uid in seen:
                            continue
                        seen.add(uid)

                        # Check if closed
                        card_text = card.get_text(separator=" ", strip=True).lower()
                        if "no longer accepting" in card_text or "expired" in card_text or "closed" in card_text:
                            continue

                        # Title
                        h3 = card.find("h3")
                        if not h3:
                            continue
                        role_title = h3.get_text(strip=True)

                        # Company (first <p> after h3, or any p in card)
                        company_elem = h3.find_next_sibling("p") or card.find("p")
                        company_name = (
                            company_elem.get_text(strip=True)
                            if company_elem
                            else "Unknown"
                        )

                        # Location
                        loc_elem = card.find("span", class_="job_location")
                        location = (
                            loc_elem.get_text(strip=True) if loc_elem else "India"
                        )
                        location_type = (
                            "Remote"
                            if any(
                                x in location.lower()
                                for x in ["remote", "work from home", "wfh"]
                            )
                            else "India"
                        )

                        # Stipend  (e.g. "10 K/Month")
                        stip_elem = card.select_one(".cash_widget strong")
                        stipend = stip_elem.get_text(strip=True) if stip_elem else ""
                        stipend_numeric = _parse_stipend(stipend)

                        org_type = "Company"
                        role_type = (
                            "Research"
                            if "research" in role_title.lower()
                            else "Applied"
                        )
                        match_score = calculate_match_score(
                            role_title, [], org_type, stipend_numeric
                        )

                        record = {
                            "id": uid,
                            "company_name": company_name,
                            "role_title": role_title,
                            "location": location,
                            "location_type": location_type,
                            "duration": "",
                            "stipend": stipend,
                            "stipend_numeric": stipend_numeric,
                            "stipend_currency": "INR",
                            "required_skills": "",
                            "application_deadline": "",
                            "apply_link": apply_link,
                            "source_platform": "Unstop",
                            "date_scraped": datetime.now().strftime("%Y-%m-%d"),
                            "org_type": org_type,
                            "role_type": role_type,
                            "match_score": match_score,
                        }
                        all_internships.append(record)

                    except Exception as e:
                        logger.error(f"Unstop: Error parsing card: {e}")

            except Exception as e:
                logger.error(f"Unstop: Failed to load {url}: {e}")
                raise e

            human_delay(2.5, 5.0)

        browser.close()

    logger.info(f"Unstop: Scraped {len(all_internships)} unique internships.")
    return all_internships
