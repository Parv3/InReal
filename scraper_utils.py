import time
import random
import json
from pathlib import Path
from fake_useragent import UserAgent
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
from loguru import logger
import requests

# Shared alert file — written by scrapers, served by Flask via /api/alerts
_ALERT_FILE = Path(__file__).parent / "scraper_alerts.json"

def action_required(source: str, message: str, kind: str = "captcha"):
    """
    Signal that the scraper needs human attention (CAPTCHA, popup, login).
    Writes to scraper_alerts.json; the dashboard polls this and shows a banner.
    
    kind: 'captcha' | 'popup' | 'login' | 'info'
    """
    alert = {
        "source":    source,
        "message":   message,
        "kind":      kind,
        "timestamp": time.strftime("%H:%M:%S"),
        "resolved":  False,
    }
    try:
        _ALERT_FILE.write_text(json.dumps(alert), encoding="utf-8")
    except Exception as e:
        logger.debug(f"Failed to write alert file: {e}")
    logger.warning(f"⚠️  ACTION REQUIRED [{source}]: {message}")

def action_resolved(source: str):
    """
    Clear the action banner once the scraper continues past the manual step.
    """
    try:
        if _ALERT_FILE.exists():
            data = json.loads(_ALERT_FILE.read_text(encoding="utf-8"))
            if data.get("source") == source:
                data["resolved"] = True
                _ALERT_FILE.write_text(json.dumps(data), encoding="utf-8")
    except Exception as e:
        logger.debug(f"Failed to resolve alert: {e}")
    logger.info(f"✅ [{source}] Continuing after manual step...")

def human_delay(min_sec=0.2, max_sec=0.7):
    """Fast realistic jitter to prevent blocking while cutting idle wait time."""
    delay = random.uniform(min_sec, max_sec)
    time.sleep(delay)

def get_random_headers():
    """Generates a rotating robust header fingerprint."""
    ua = UserAgent(os=['windows', 'mac'])
    headers = {
        'User-Agent': ua.random,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': random.choice(['en-US,en;q=0.5', 'en-GB,en;q=0.9', 'en-US,en;q=0.9']),
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
    }
    return headers

def block_unneeded_resources(page):
    """
    Aborts heavy images, media, and fonts to speed up page loads by 3-5x.
    Does NOT affect DOM parsing or JSON APIs.
    """
    def _route_intercept(route):
        req = route.request
        if req.resource_type in ["image", "media", "font"]:
            route.abort()
        else:
            route.continue_()
    try:
        page.route("**/*", _route_intercept)
    except Exception:
        pass

def get_playwright_stealth_args():
    """Returns heavily evasive Chrome launch arguments."""
    return [
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080',
        '--blink-settings=imagesEnabled=false'
    ]

# Retry decorator for raw requests
def requests_retry_session(retries=3):
    """Returns a requests session configured with retries and realistic headers."""
    session = requests.Session()
    session.headers.update(get_random_headers())
    return session

# Playwright page readiness utility
def wait_for_human(page, selector=None):
    """Scrolls randomly then waits, mimicking user behavior."""
    human_delay(1.0, 2.5)
    page.mouse.wheel(0, random.randint(300, 700))
    human_delay(0.5, 1.5)
    if selector:
        page.wait_for_selector(selector, timeout=15000)


def launch_browser(p, headless=True):
    """
    Starts the user's installed Google Chrome if there is one (it looks like a
    normal visit to sites with strict bot checks, e.g. Naukri), otherwise the
    Chromium that Playwright downloaded.
    """
    try:
        return p.chromium.launch(channel="chrome", headless=headless, args=get_playwright_stealth_args())
    except Exception as e:
        logger.info(f"Installed Chrome not available ({str(e).splitlines()[0]}), using Playwright's Chromium")
        return p.chromium.launch(headless=headless, args=get_playwright_stealth_args())


def save_debug(page, name):
    """Saves a screenshot and the HTML to test_output/ so we can see what the site showed."""
    out = Path(__file__).parent / "test_output"
    out.mkdir(exist_ok=True)
    try:
        page.screenshot(path=str(out / f"{name}.png"), full_page=False)
        (out / f"{name}.html").write_text(page.content(), encoding="utf-8")
        logger.warning(f"Saved what the page showed: test_output/{name}.png and .html (title: {page.title()!r})")
    except Exception as e:
        logger.warning(f"Could not save debug files: {e}")
