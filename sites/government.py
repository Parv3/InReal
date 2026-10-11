import requests
from bs4 import BeautifulSoup
import time
import random
import hashlib
from datetime import datetime
from loguru import logger
from scraper_utils import requests_retry_session, human_delay
from filters import calculate_match_score

def scrape_government():
    """Scrapes static government portals for AI/ML/Research internships."""
    all_internships = []
    
    portals = [
        {"name": "AICTE Internship Portal", "url": "https://internship.aicte-india.org/"},
        {"name": "CDAC Careers", "url": "https://www.cdac.in/index.aspx?id=careers_interns"},
        {"name": "DRDO Internship", "url": "https://www.drdo.gov.in/internship-scheme"}
    ]
    
    for portal in portals:
        url = portal["url"]
        name = portal["name"]
        logger.info(f"Scraping Government Portal: {name} ...")
        
        try:
            # For static scraping, we just pull the html and create a generic notification record
            # because government portals vary wildly in structure and often just post PDF links.
            # Here we do a lightweight check. If the page contains AI/ML keywords, we add it 
            # as a general lead that requires manual checking.
            
            session = requests_retry_session()
            response = session.get(url, timeout=15, verify=False) # Govt sites often have SSL issues
            
            if response.status_code == 200:
                html = response.text.lower()
                
                # Check if there are relevant postings mentioned on the page right now
                keywords = ["artificial intelligence", "machine learning", "deep learning", "ai/ml", "computer vision"]
                found_keywords = [k for k in keywords if k in html]
                
                if found_keywords or name == "AICTE Internship Portal":
                    # For AICTE, we might want to just link it as a high-priority source always
                    role_title = f"AI/ML Internship Opportunities ({name})"
                    company_name = name.split()[0]
                    
                    id_hash = hashlib.md5(f"{company_name}-{role_title}-{name}".encode()).hexdigest()
                    org_type = "Government"
                    role_type = "Research"
                    match_score = calculate_match_score(role_title, found_keywords, org_type, 0.0)
                    
                    record = {
                        "id": id_hash,
                        "company_name": company_name,
                        "role_title": role_title,
                        "location": "India",
                        "location_type": "India",
                        "duration": "Variable",
                        "stipend": "Govt Norms",
                        "stipend_numeric": 5000.0,
                        "stipend_currency": "INR",
                        "required_skills": ", ".join(found_keywords) if found_keywords else "AI/ML", 
                        "application_deadline": "Rolling", 
                        "apply_link": url,
                        "source_platform": "Govt/Research India",
                        "date_scraped": datetime.now().strftime("%Y-%m-%d"),
                        "org_type": org_type,
                        "role_type": role_type,
                        "match_score": match_score
                    }
                    all_internships.append(record)
                    
            human_delay(2.0, 5.0)
            
        except Exception as e:
            logger.error(f"Failed to scrape {name} ({url}): {e}")
            
    return all_internships
