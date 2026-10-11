import argparse
from loguru import logger
from output_handler import append_to_csv, update_run_history
from filters import is_valid_internship, is_valid_stipend

# Import scrapers
from sites.internshala import scrape_internshala
from sites.unstop import scrape_unstop
from sites.naukri import scrape_naukri
from sites.government import scrape_government
from sites.misc_india import scrape_shine, scrape_foundit, scrape_apna, scrape_cutshort
from sites.international import scrape_international
from sites.rss_feeds import scrape_linkedin as scrape_remotive, scrape_indeed as scrape_weworkremotely
from sites.linkedin import scrape_linkedin  # NEW: direct LinkedIn Jobs page scraper
from sites.bigtech import scrape_bigtech
from sites.niche import scrape_niche_boards, scrape_aggregators
from sites.universities import scrape_universities
from sites.search_engine import scrape_search_engine

logger.add("scraper_errors.log", rotation="1 MB", level="ERROR")
# Human-readable logs for the UI
logger.add("scraper_run.log", rotation="5 MB", level="INFO", format="{time:YYYY-MM-DD HH:mm:ss} | {message}")

def process_and_save(source_name: str, raw_listings: list):
    valid_listings = []
    
    for item in raw_listings:
        # Check title and skills
        skills = item.get("required_skills", "")
        skill_list = [s.strip() for s in skills.split(",") if s.strip()]
        
        if not is_valid_internship(item["role_title"], skill_list, source_name):
            continue
            
        # Check stipend
        is_india = item.get("stipend_currency") == "INR" or item.get("location_type") == "India"
        if not is_valid_stipend(item["stipend"], item["stipend_numeric"], is_india):
            continue
            
        valid_listings.append(item)
    
    if not valid_listings:
        logger.info(f"[{source_name}] Searched through {len(raw_listings)} listings, but none matched our criteria.")
        return 0
        
    added = append_to_csv(valid_listings)
    logger.info(f"[{source_name}] Analyzed {len(raw_listings)} listings, found {len(valid_listings)} matches, and saved {added} brand new ones!")
    return added

def run_scrapers(dry_run=False, config=None):
    total_added = 0
    failed_sources = []
    
    # Default to everything if no config passed
    if config is None:
        config = {
            "regions": ["india", "worldwide", "usa", "europe", "remote"],
            "topics": ["ml", "ai", "nlp", "cv", "ds", "research", "llm/genai"],
            "paid_only": False,
            "sources": ["linkedin", "internshala", "unstop", "naukri", "bigtech", "remotive", "universities", "government"]
        }
    
    logger.info(f"🚀 Starting selective scraper with config: {config}")
    
    # Clear old popup alerts from a previous run
    from pathlib import Path
    alert_file = Path(__file__).parent / "scraper_alerts.json"
    if alert_file.exists():
        try:
            alert_file.unlink()
        except OSError:
            pass
    
    req_regions = set([r.lower() for r in config.get("regions", [])])
    req_sources = set([s.lower() for s in config.get("sources", [])])
    
    scrapers_to_run = {}
    
    # Map scrapers to explicit UI checkboxes
    if "internshala" in req_sources: 
        scrapers_to_run["internshala"] = scrape_internshala
        
    if "naukri" in req_sources: 
        scrapers_to_run.update({
            "naukri": scrape_naukri, "shine": scrape_shine, 
            "foundit": scrape_foundit, "apna": scrape_apna, "cutshort": scrape_cutshort
        })
        
    if "unstop" in req_sources: 
        scrapers_to_run["unstop"] = scrape_unstop
        
    if "linkedin" in req_sources: 
        scrapers_to_run["linkedin"] = scrape_linkedin
        
    if "bigtech" in req_sources: 
        scrapers_to_run["bigtech"] = scrape_bigtech
        
    if "remotive" in req_sources: 
        scrapers_to_run.update({
            "remotive": scrape_remotive, 
            "weworkremotely": scrape_weworkremotely, 
            "international": scrape_international, 
            "niche": scrape_niche_boards, 
            "aggregators": scrape_aggregators, 
            "search": scrape_search_engine
        })
        
    if "government" in req_sources: 
        scrapers_to_run["government"] = scrape_government
        
    if "universities" in req_sources:
        scrapers_to_run["universities"] = scrape_universities

    if not scrapers_to_run:
        logger.warning("No scrapers matched the provided configuration filters!")
        return 0

    for source_name, scraper_func in scrapers_to_run.items():
        try:
            logger.info(f"🚀 Starting to check {source_name} for new opportunities...")
            if source_name in ["linkedin", "search"]:
                listings = scraper_func(config=config)
            else:
                listings = scraper_func()
            if not dry_run:
                added = process_and_save(source_name, listings)
                total_added += added
            else:
                logger.info(f"[{source_name}] DRY-RUN: Found {len(listings)} raw listings.")
        except Exception as e:
            logger.error(f"Failed {source_name}: {str(e)}")
            failed_sources.append(source_name)
            
    if not dry_run:
        update_run_history(total_added, failed_sources)
        
    logger.info("========================================")
    logger.info("✅ All scraping tasks completed!")
    logger.info(f"Sources checked: {len(scrapers) - len(failed_sources)} successful, {len(failed_sources)} failed.")
    if not dry_run:
        logger.info(f"🎉 Total new internships added today: {total_added}")
    logger.info("========================================")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Automated AI/ML Internship Scraper")
    parser.add_argument("--dry-run", action="store_true", help="Run scrapers without saving to CSV")
    parser.add_argument("--source", type=str, help="Run a specific source only")
    args = parser.parse_args()
    
    run_scrapers(dry_run=args.dry_run, specific_source=args.source)
