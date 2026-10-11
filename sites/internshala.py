from playwright.sync_api import sync_playwright
import time
import random
from bs4 import BeautifulSoup
import hashlib
from datetime import datetime
import re
from loguru import logger
from filters import calculate_match_score, parse_summer_dates
from playwright_stealth import Stealth
from scraper_utils import human_delay, get_playwright_stealth_args
from tenacity import retry, wait_exponential, stop_after_attempt

URLS = [
    "https://internshala.com/internships/artificial-intelligence-ai,data-science,deep-learning,machine-learning,natural-language-processing-nlp-internship/"
]

def parse_stipend(stipend_str: str):
    stipend_str = stipend_str.replace(",", "").replace("₹", "").strip()
    match = re.search(r'(\d+)', stipend_str)
    if match:
        return float(match.group(1))
    return 0

@retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(3))
def scrape_internshala():
    all_internships = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=get_playwright_stealth_args()
        )
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport={'width': 1920, 'height': 1080}
        )
        page = context.new_page()
        Stealth().apply_stealth_sync(page)
        
        for base_url in URLS:
            page_num = 1
            while True:
                url = f"{base_url}page-{page_num}/" if page_num > 1 else base_url
                logger.info(f"Scraping Internshala: {url} ...")
                
                try:
                    # Internshala can block simple bots, fake user agent or simple timeout wait is good
                    page.goto(url, timeout=45000)
                    human_delay(2.5, 4.5)
                    
                    html = page.content()
                    soup = BeautifulSoup(html, "lxml")
                    
                    listings = soup.find_all("div", class_="individual_internship")
                    
                    if not listings:
                        break # no more pages or empty page
                        
                    for listing in listings:
                        try:
                            title_elem = listing.find("h3", class_="job-internship-name")
                            if not title_elem:
                                continue
                            role_title = title_elem.text.strip()
                            
                            company_elem = listing.find("p", class_="company-name")
                            if not company_elem:
                                company_elem = listing.find("div", class_="company_name")
                            company_name = company_elem.text.strip() if company_elem else "Unknown"
                            
                            loc_elem = listing.find("div", id="location_names")
                            if not loc_elem:
                                container = listing.find(class_="loc_container")
                                loc_elem = container.find("a") if container else None
                            location = loc_elem.text.strip() if loc_elem else "India"
                            
                            # NLP Date Check for Summer
                            item_bodies = listing.find_all("div", class_="item_body")
                            starts_text = item_bodies[0].text.strip() if len(item_bodies) > 0 else ""
                            
                            if not parse_summer_dates(starts_text):
                                continue # Fails summer constraint
                                
                            location_type = "Remote" if "Work From Home" in location or "Remote" in location else "India"
                            
                            duration = ""
                            duration_elem = listing.find("div", string=re.compile("Duration", re.IGNORECASE))
                            if duration_elem and duration_elem.find_next_sibling("div"):
                                duration = duration_elem.find_next_sibling("div").text.strip()
                            elif listing.find("div", class_="item_body"):
                                # Fallback, try to just grab item body text context
                                texts = [i.text.strip() for i in listing.find_all("div", class_="item_body")]
                                if len(texts) >= 2:
                                    duration = texts[1]
                                    
                            stipend = ""
                            stipend_elem = listing.find("span", class_="stipend")
                            if stipend_elem:
                                stipend = stipend_elem.text.strip()
                                
                            stipend_numeric = parse_stipend(stipend)
                            
                            apply_link_elem = title_elem.find("a") if title_elem else None
                            if not apply_link_elem:
                                apply_link_elem = listing.find("a", class_="view_detail_button")
                            apply_link = "https://internshala.com" + apply_link_elem["href"] if apply_link_elem else ""
                            
                            source_platform = "Internshala"
                            org_type = "Company"
                            role_type = "Applied"
                            if "research" in role_title.lower():
                                role_type = "Research"
                            match_score = calculate_match_score(role_title, [], org_type, stipend_numeric)
                            
                            id_hash = hashlib.md5(f"{company_name}-{role_title}-{source_platform}".encode()).hexdigest()
                            today = datetime.now().strftime("%Y-%m-%d")
                            
                            record = {
                                "id": id_hash,
                                "company_name": company_name,
                                "role_title": role_title,
                                "location": location,
                                "location_type": location_type,
                                "duration": duration,
                                "stipend": stipend,
                                "stipend_numeric": stipend_numeric,
                                "stipend_currency": "INR",
                                "required_skills": "", 
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
                            logger.exception(f"Error parsing listing on {url}: {e}")
                            
                    # To not overload the server
                    human_delay(1.5, 3.5)
                    
                    # Next page check
                    # If this page didn't have 40 listings (Internshala default), it might be the last page
                    if len(listings) < 40:
                        break
                        
                    page_num += 1
                    
                except Exception as e:
                    logger.error(f"Failed to load INTERNSHALA {url}: {e}")
                    raise e
                    
        browser.close()
        
    return all_internships
