import feedparser
import hashlib
from datetime import datetime
from loguru import logger
from filters import calculate_match_score, is_valid_internship
from tenacity import retry, wait_exponential, stop_after_attempt

AI_KEYWORDS = [
    "machine learning", "artificial intelligence", "deep learning", "nlp",
    "data science", "computer vision", "ai", " ml ", "mlops", "generative",
    "llm", "neural", "research intern", "ai intern", "ml intern"
]

def _matches_ai_ml(text: str) -> bool:
    text_lower = text.lower()
    return any(kw in text_lower for kw in AI_KEYWORDS)


@retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(3))
def scrape_linkedin():
    """
    Scrapes Remotive.com RSS feed for AI/ML remote internships.
    (Replaces deprecated LinkedIn RSS - LinkedIn removed public RSS in 2023)
    """
    all_internships = []
    
    feeds_to_try = [
        "https://remotive.com/remote-jobs/feed?category=software-dev&keywords=machine+learning",
        "https://remotive.com/remote-jobs/feed?category=data&keywords=machine+learning",
        "https://remotive.com/remote-jobs/feed?category=software-dev&keywords=artificial+intelligence",
    ]
    
    for url in feeds_to_try:
        try:
            logger.info(f"Scraping Remotive RSS (AI/ML remote jobs): {url} ...")
            feed = feedparser.parse(url)
            
            for entry in feed.entries:
                try:
                    raw_title = entry.get("title", "")
                    description = entry.get("summary", "")
                    tags = [t.get("term", "") for t in entry.get("tags", [])]
                    
                    # Filter to internships only
                    combined = (raw_title + " " + description).lower()
                    if not ("intern" in combined or "fellowship" in combined):
                        continue
                    
                    if not _matches_ai_ml(raw_title + " " + description):
                        continue
                    
                    role_title = raw_title[:90] if len(raw_title) > 90 else raw_title
                    company_name = entry.get("author", "Unknown")
                    
                    apply_link = entry.get("link", "")
                    source_platform = "Remotive (Remote)"
                    location = "Remote"
                    location_type = "Remote"
                    
                    org_type = "Company"
                    role_type = "Research" if "research" in raw_title.lower() else "Applied"
                    match_score = calculate_match_score(raw_title, tags, org_type, 0.0)
                    
                    id_hash = hashlib.md5(f"{company_name}-{role_title}-{apply_link}".encode()).hexdigest()
                    
                    record = {
                        "id": id_hash,
                        "company_name": company_name,
                        "role_title": role_title,
                        "location": location,
                        "location_type": location_type,
                        "duration": "",
                        "stipend": "Discover on Site",
                        "stipend_numeric": 1000.0,  # Remote, international - passes filter
                        "stipend_currency": "USD",
                        "required_skills": ", ".join(tags) if tags else "AI/ML",
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
                    logger.error(f"Error parsing Remotive entry: {e}")
                    
        except Exception as e:
            logger.error(f"Failed to load Remotive RSS feed {url}: {e}")
    
    logger.info(f"Remotive: Found {len(all_internships)} AI/ML internship listings.")
    return all_internships


@retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(3))
def scrape_indeed():
    """
    Scrapes WeWorkRemotely RSS feed for AI/ML internships.
    (Replaces deprecated Indeed RSS - Indeed removed public RSS feeds for India)
    """
    all_internships = []
    
    feeds_to_try = [
        "https://weworkremotely.com/categories/remote-programming-jobs.rss",
        "https://weworkremotely.com/categories/remote-data-science-and-analytics-jobs.rss",
    ]
    
    for url in feeds_to_try:
        try:
            logger.info(f"Scraping WeWorkRemotely RSS (AI/ML remote jobs): {url} ...")
            feed = feedparser.parse(url)
            
            for entry in feed.entries:
                try:
                    raw_title = entry.get("title", "")
                    description = entry.get("summary", "")
                    
                    # Filter for AI/ML
                    if not _matches_ai_ml(raw_title + " " + description):
                        continue
                    
                    # Filter for internship roles
                    combined = (raw_title + " " + description).lower()
                    if not ("intern" in combined or "fellowship" in combined or "trainee" in combined or "entry" in combined):
                        continue
                    
                    # WWR title format: "Company: Role"
                    parts = raw_title.split(": ", 1)
                    if len(parts) == 2:
                        company_name = parts[0].strip()
                        role_title = parts[1].strip()
                    else:
                        company_name = "Unknown"
                        role_title = raw_title
                    
                    role_title = role_title[:90] if len(role_title) > 90 else role_title
                    apply_link = entry.get("link", "")
                    source_platform = "WeWorkRemotely (Remote)"
                    location = "Remote / International"
                    location_type = "Remote"
                    
                    org_type = "Company"
                    role_type = "Research" if "research" in role_title.lower() else "Applied"
                    match_score = calculate_match_score(role_title, ["AI/ML"], org_type, 0.0)
                    
                    id_hash = hashlib.md5(f"{company_name}-{role_title}-{apply_link}".encode()).hexdigest()
                    
                    record = {
                        "id": id_hash,
                        "company_name": company_name,
                        "role_title": role_title,
                        "location": location,
                        "location_type": location_type,
                        "duration": "",
                        "stipend": "Discover on Site",
                        "stipend_numeric": 1000.0,  # Remote, international - passes filter
                        "stipend_currency": "USD",
                        "required_skills": "AI/ML",
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
                    logger.error(f"Error parsing WeWorkRemotely entry: {e}")
                    
        except Exception as e:
            logger.error(f"Failed to load WeWorkRemotely RSS feed {url}: {e}")
    
    logger.info(f"WeWorkRemotely: Found {len(all_internships)} AI/ML internship listings.")
    return all_internships
