from playwright.sync_api import sync_playwright
import time
import random
from bs4 import BeautifulSoup
import hashlib
from datetime import datetime
from loguru import logger
from filters import calculate_match_score
import re
from playwright_stealth import Stealth
from scraper_utils import human_delay, get_playwright_stealth_args
from tenacity import retry, wait_exponential, stop_after_attempt

@retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(3))
def parse_weworkremotely():
    results = []
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(
                headless=True,
                args=get_playwright_stealth_args()
            )
            page = browser.new_page()
            Stealth().apply_stealth_sync(page)
            url = "https://weworkremotely.com/remote-jobs/search?term=internship+machine+learning"
            logger.info(f"Scraping WeWorkRemotely: {url}")
            page.goto(url, timeout=30000)
            human_delay(3.0, 5.0)
            
            html = page.content()
            soup = BeautifulSoup(html, "lxml")
            
            listings = soup.find_all("li", class_="feature")
            for listing in listings:
                try:
                    title_elem = listing.find("h3", class_="new-listing__header__title")
                    if not title_elem:
                        title_elem = listing.find("span", class_="title")
                    if not title_elem: continue
                    role_title = title_elem.text.strip()
                    
                    comp_elem = listing.find("p", class_="new-listing__company-name")
                    if not comp_elem:
                        comp_elem = listing.find("span", class_="company")
                    company_name = comp_elem.text.strip().replace("\n", "").split("  ")[0].strip() if comp_elem else "Unknown Company"
                    
                    apply_link = ""
                    link_elem = listing.find_all("a", href=True)
                    if link_elem:
                        # usually the 2nd link is the job link
                        for a in link_elem:
                            if "/remote-jobs/" in a['href']:
                                apply_link = "https://weworkremotely.com" + a['href']
                                break
                    
                    id_hash = hashlib.md5(f"{company_name}-{role_title}-WeWorkRemotely".encode()).hexdigest()
                    
                    org_type = "Company"
                    role_type = "Research" if "research" in role_title.lower() else "Applied"
                    match_score = calculate_match_score(role_title, ["AI/ML"], org_type, 0.0)
                    
                    results.append({
                        "id": id_hash,
                        "company_name": company_name,
                        "role_title": role_title,
                        "location": "Remote",
                        "location_type": "Remote",
                        "duration": "",
                        "stipend": "",
                        "stipend_numeric": 0.0,
                        "stipend_currency": "USD",
                        "required_skills": "AI/ML", 
                        "application_deadline": "", 
                        "apply_link": apply_link,
                        "source_platform": "WeWorkRemotely",
                        "date_scraped": datetime.now().strftime("%Y-%m-%d"),
                        "org_type": org_type,
                        "role_type": role_type,
                        "match_score": match_score
                    })
                except Exception as e:
                    continue
            browser.close()
        except Exception as e:
            logger.error(f"WeWorkRemotely error: {e}")
            raise e
    return results

def scrape_international():
    """Wrapper to run international generic scrapers"""
    results = []
    results.extend(parse_weworkremotely())
    return results
