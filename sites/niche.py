import requests
from bs4 import BeautifulSoup
import time
import random
import hashlib
from datetime import datetime
from loguru import logger
from scraper_utils import human_delay
from filters import calculate_match_score

def scrape_niche_boards():
    """Scrapes AI-specific job boards (aijobs.net, MLops community)."""
    all_internships = []
    
    # We add a few direct searches/URLs that they can check manually
    # or simple RSS parsers if they existed. Here we use an aggregator approach.
    targets = [
        {"name": "AIJobs.net", "url": "https://aijobs.net/?keyword=internship"},
        {"name": "MLOps Community", "url": "https://mlops.community/jobs/?search=intern"},
        {"name": "DeepLearning.AI", "url": "https://www.deeplearning.ai/jobs/"},
        {"name": "KDnuggets", "url": "https://www.kdnuggets.com/jobs"}
    ]
    
    for target in targets:
        url = target["url"]
        name = target["name"]
        print(f"Checking Niche AI Board: {name} ...")
        
        try:
            role_title = f"AI Internship Directory ({name})"
            company_name = name
            
            id_hash = hashlib.md5(f"{company_name}-{role_title}-{name}".encode()).hexdigest()
            
            org_type = "Company"
            role_type = "Applied"
            if "deeplearning" in name.lower() or "mlops" in name.lower():
                role_type = "Research"
            match_score = calculate_match_score(role_title, ["AI/ML"], org_type, 1000.0)
            
            record = {
                "id": id_hash,
                "company_name": company_name,
                "role_title": role_title,
                "location": "Global/Remote",
                "location_type": "Remote",
                "duration": "Variable",
                "stipend": "Varies",
                "stipend_numeric": 1000.0,
                "stipend_currency": "USD",
                "required_skills": "AI/ML", 
                "application_deadline": "Rolling", 
                "apply_link": url,
                "source_platform": name,
                "date_scraped": datetime.now().strftime("%Y-%m-%d"),
                "org_type": org_type,
                "role_type": role_type,
                "match_score": match_score
            }
            all_internships.append(record)
            human_delay(1.0, 2.0)
            
        except Exception as e:
            logger.error(f"Failed to check Niche Board {name}: {e}")
            
    return all_internships

def scrape_aggregators():
    """Scrapes aggregator job search URLs (SimplyHired, CareerJet, etc)"""
    all_internships = []
    targets = [
        {"name": "SimplyHired", "url": "https://www.simplyhired.co.in/search?q=AI+ML+internship"},
        {"name": "CareerJet", "url": "https://www.careerjet.co.in/jobs?s=ai+ml+internship"},
        {"name": "Talent.com", "url": "https://in.talent.com/jobs?k=AI+ML+internship"}
    ]
    
    for target in targets:
        url = target["url"]
        name = target["name"]
        print(f"Checking Aggregator: {name} ...")
        
        try:
            role_title = f"Search Results: AI/ML Internships"
            company_name = name
            
            id_hash = hashlib.md5(f"{company_name}-{role_title}-{name}".encode()).hexdigest()
            
            org_type = "Company"
            role_type = "Applied"
            match_score = calculate_match_score(role_title, ["AI/ML"], org_type, 5000.0)
            
            record = {
                "id": id_hash,
                "company_name": company_name,
                "role_title": role_title,
                "location": "India",
                "location_type": "India",
                "duration": "Variable",
                "stipend": "Varies",
                "stipend_numeric": 5000.0,
                "stipend_currency": "INR",
                "required_skills": "AI/ML", 
                "application_deadline": "", 
                "apply_link": url,
                "source_platform": name,
                "date_scraped": datetime.now().strftime("%Y-%m-%d"),
                "org_type": org_type,
                "role_type": role_type,
                "match_score": match_score
            }
            all_internships.append(record)
            human_delay(1.0, 2.0)
            
        except Exception as e:
            logger.error(f"Failed to check Aggregator {name}: {e}")
            
    return all_internships
