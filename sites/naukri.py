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
from scraper_utils import human_delay, get_playwright_stealth_args, action_required, action_resolved
from tenacity import retry, wait_exponential, stop_after_attempt

@retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(3))
def scrape_naukri():
    """Scrapes AI/ML internship listings from Naukri (India)."""
    all_internships = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,  # Fully automated
            args=get_playwright_stealth_args()
        )
        # Using a more robust context for Naukri to bypass basic blockers
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport={'width': 1440, 'height': 900}
        )
        page = context.new_page()
        Stealth().apply_stealth_sync(page)
        
        url = "https://www.naukri.com/ai-ml-internship-jobs-in-india"
        
        try:
            logger.info(f"Scraping Naukri: {url} ...")
            page.goto(url, timeout=45000)
            
            # Wait for job list
            try:
                page.wait_for_selector(".srp-jobtuple-wrapper", timeout=15000)
            except Exception:
                logger.warning("Naukri: Timeout waiting for job tuples. Maybe captcha or no results.")
                
            for _ in range(4):
                page.mouse.wheel(0, random.randint(500, 1000))
                human_delay(1.5, 3.0)
                
            html = page.content()
            soup = BeautifulSoup(html, "lxml")
            
            listings = soup.find_all("div", class_=re.compile("srp-jobtuple-wrapper"))
            
            for listing in listings:
                try:
                    title_elem = listing.find("a", class_="title")
                    if not title_elem:
                        continue
                    role_title = title_elem.text.strip()
                    apply_link = title_elem["href"] if "href" in title_elem.attrs else ""
                    
                    comp_elem = listing.find("a", class_="comp-name")
                    company_name = comp_elem.text.strip() if comp_elem else "Unknown"
                    
                    loc_elem = listing.find("span", class_="locWdth")
                    location = loc_elem.text.strip() if loc_elem else "India"
                    location_type = "Remote" if "Remote" in location or "Work From Home" in location else "India"
                    
                    exp_elem = listing.find("span", class_="expwdth")
                    if exp_elem:
                        # Only skip if explicitly senior-level experience (5+ years)
                        exp_text = exp_elem.text.lower()
                        if re.search(r'[5-9]\d*\s*yr|10\+?\s*yr', exp_text):
                            continue
                        
                    stipend_elem = listing.find("span", class_="ni-job-tuple-icon-srp-rupee")
                    stipend = stipend_elem.find_next_sibling("span").text.strip() if stipend_elem and stipend_elem.find_next_sibling("span") else ""
                    if stipend and ("Not disclosed" in stipend or "Unpaid" in stipend):
                        stipend = ""
                        
                    stipend_numeric = 0.0
                    
                    skills_ul = listing.find("ul", class_="tags-gt")
                    skills = []
                    if skills_ul:
                        for li in skills_ul.find_all("li"):
                            skills.append(li.text.strip())
                            
                    source_platform = "Naukri"
                    org_type = "Company"
                    role_type = "Research" if "research" in role_title.lower() else "Applied"
                    match_score = calculate_match_score(role_title, skills, org_type, stipend_numeric)
                    
                    id_hash = hashlib.md5(f"{company_name}-{role_title}-{source_platform}".encode()).hexdigest()
                    
                    record = {
                        "id": id_hash,
                        "company_name": company_name,
                        "role_title": role_title,
                        "location": location,
                        "location_type": location_type,
                        "duration": "",
                        "stipend": stipend,
                        "stipend_numeric": stipend_numeric,
                        "stipend_currency": "INR",
                        "required_skills": ", ".join(skills), 
                        "application_deadline": "", 
                        "apply_link": apply_link,
                        "source_platform": source_platform,
                        "date_scraped": datetime.now().strftime("%Y-%m-%d"),
                        "org_type": org_type,
                        "role_type": role_type,
                        "match_score": match_score
                    }
                    
                    all_internships.append(record)
                    
                except Exception as e:
                    logger.error(f"Error parsing Naukri listing: {e}")
                    
        except Exception as e:
            logger.error(f"Failed to load Naukri {url}: {e}")
            raise e
            
        browser.close()
        
    return all_internships
