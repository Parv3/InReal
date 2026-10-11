import schedule
import time
import subprocess
from datetime import datetime
from loguru import logger
import sys
import os
from pathlib import Path

# Setup logging for the scheduler specifically
logger.add("scheduler.log", rotation="5 MB", level="INFO")

def run_scraper_job():
    """Executes the main scraper script."""
    logger.info("Starting scheduled scraper job...")
    try:
        # We run the scraper script as a subprocess to keep memory clean
        script_path = str(Path(__file__).parent / "scraper.py")
        
        # If running from a venv, we should use sys.executable
        process = subprocess.Popen(
            [sys.executable, script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        stdout, stderr = process.communicate()
        
        if process.returncode == 0:
            logger.info("Scraper completed successfully.")
            logger.debug(f"Scraper Output: {stdout}")
        else:
            logger.error(f"Scraper failed with exit code {process.returncode}")
            logger.error(f"Scraper Error: {stderr}")
            
    except Exception as e:
        logger.error(f"Exception while running scraper job: {e}")

def main():
    print("==================================================")
    print("🤖 AI/ML Internship Scraper - Scheduler Process   ")
    print("==================================================")
    print("This process will stay alive and run the scraper at 8:00 AM daily.")
    print("Press Ctrl+C to stop the scheduler.")
    
    # Schedule the job every day at 08:00 AM
    schedule.every().day.at("08:00").do(run_scraper_job)
    
    logger.info("Scheduler started. Waiting for 08:00 AM daily trigger.")
    
    try:
        while True:
            schedule.run_pending()
            time.sleep(60) # check every minute
    except KeyboardInterrupt:
        print("\nScheduler stopped by user.")
        logger.info("Scheduler stopped.")

if __name__ == "__main__":
    main()
