# Selector Tracker

Every HTML selector and URL the old code depends on, platform by platform, and what is left to fix.
Websites change their page structure often, so when a scraper suddenly returns 0 listings, start here.

**Status:** ✅ updated and tested on laptop · 🟡 updated, waiting for laptop test · 🔴 old selectors, not checked yet · ⚪ not a real listing scraper

**Test one platform** (nothing is saved, the reasons go to `test_output/<source>.csv`):
```
python scraper.py --source <name> --dry-run
```

## Summary

| # | Platform | `--source` | File | How it reads the site | Status |
|---|---|---|---|---|---|
| 1 | Internshala | `internshala` | `sites/internshala.py` | Playwright + HTML | ✅ |
| 2 | Unstop | `unstop` | `sites/unstop.py` | Playwright + HTML | 🔴 |
| 3 | Naukri | `naukri` | `sites/naukri.py` | Playwright + HTML | 🔴 |
| 4 | LinkedIn (guest search) | `linkedin` | `sites/linkedin.py` | Playwright + HTML | 🔴 |
| 5 | Shine | `shine` | `sites/misc_india.py` | Playwright + HTML | 🔴 |
| 6 | Foundit | `foundit` | `sites/misc_india.py` | Playwright + HTML | 🔴 |
| 7 | Apna | `apna` | `sites/misc_india.py` | Playwright + HTML | 🔴 |
| 8 | Cutshort | `cutshort` | `sites/misc_india.py` | Playwright + HTML | 🔴 |
| 9 | We Work Remotely (search page) | `international` | `sites/international.py` | Playwright + HTML | 🔴 |
| 10 | Remotive (RSS) | `remotive` | `sites/rss_feeds.py` | RSS feed, no selectors | 🔴 feed URL check only |
| 11 | We Work Remotely (RSS) | `weworkremotely` | `sites/rss_feeds.py` | RSS feed, no selectors | 🔴 feed URL check only |
| 12 | DuckDuckGo search | `search` | `sites/search_engine.py` | `ddgs` package, no selectors | 🔴 package check only |
| 13 | Universities (DuckDuckGo) | `universities` | `sites/universities.py` | `ddgs` package, no selectors | 🔴 package check only |
| 14 | Big tech career pages | `bigtech` | `sites/bigtech.py` | Adds a "go check this page" link | ⚪ |
| 15 | Government portals | `government` | `sites/government.py` | Keyword check on the page, adds a link | ⚪ |
| 16 | Niche boards / aggregators | `niche`, `aggregators` | `sites/niche.py` | Adds a "go check this page" link | ⚪ |

---

## 1. Internshala ✅

URL: `https://internshala.com/internships/artificial-intelligence-ai,data-science,deep-learning,machine-learning,natural-language-processing-nlp-internship/` (pages: `page-2/`, `page-3/` …)
Checked on the live site: 12 Oct 2026.

| Field | Old selector | New selector | Status |
|---|---|---|---|
| Card | `div.individual_internship` | `div.individual_internship[internshipid]` | ✅ found 50 per page |
| Title | `h3.job-internship-name` | `h2.job-internship-name a.job-title-href` | ❌ old one gone, fixed |
| Company | `p.company-name` | `p.company-name` | same |
| Location | `div#location_names` / `.loc_container a` | `.row-1-item.locations` (home icon `i.ic-16-home` = work from home) | ❌ old one gone, fixed |
| Start date | `div.item_body` (1st) | not on the card any more; detail page `#start-date-first` | ❌ fixed |
| Duration | `div.item_body` (2nd) | `.row-1-item` that contains `i.ic-16-calendar` | ❌ old one gone, fixed |
| Stipend | `span.stipend` | `span.stipend` | same |
| Link | `a` inside title / `a.view_detail_button` | card attribute `data-href` | ❌ fixed |
| Skills | not read | `.job_skills .job_skill` | new |
| Posted | not read | `.color-labels span` ("2 days ago") | new |
| Part time | not read | `.gray-labels span` | new |
| Last page | "fewer than 40 cards" | `input#isLastPage` value `1` | ❌ page 1 has 50, later pages 40; fixed |
| Employer activity (detail page) | not read | `.activity_container .activity` (hiring since / posted / hired) | new, used by `genuine.py` |
| Openings (detail page) | not read | `.section_heading` "Number of openings" → next element | new |

**Laptop test, 12 Oct 2026, 00:43:** 393 listings scraped from 10 pages, 146 of 147 detail pages read, 0 failures.
With the tighter AI/ML rule (below) the same data gives **81 kept**. 264 were not AI/ML, 21 unpaid, 21 under ₹5,000, 4 had excluded title words and 2 were mass programmes (Reducate.ai: 21,755 people "hired" from 1,189 posts).

What the first run taught us: about half of the 147 kept listings were not AI/ML at all (Digital Marketing, Graphic Design, HR, Video Editor) and got in only because Internshala tags them with the skill "Artificial intelligence". Now a listing needs AI/ML in the title, or at least two real ML skill tags (Machine Learning, Deep Learning, NLP, PyTorch, OpenCV …).

No listing on Internshala mentioned a fee. That fits Internshala's rule against charging candidates, but it also means the fee check has not been proven on real data yet.

## 2. Unstop 🔴

URLs: `https://unstop.com/internships?domain=tech&specialization=ai-ml` and `?query=artificial+intelligence`, `machine+learning`, `deep+learning`, `data+science`, `computer+vision`, `nlp`

| Field | Old selector | New selector | Status |
|---|---|---|---|
| Wait for | `a.item` | | 🔴 |
| Card | `a.item` | | 🔴 |
| Link | card `href` (+ `https://unstop.com`) | | 🔴 |
| Title | `h3` | | 🔴 |
| Company | `p` after the `h3` | | 🔴 |
| Location | `span.job_location` | | 🔴 |
| Stipend | `.cash_widget strong` (format "10 K/Month") | | 🔴 |
| Closed / expired | text check on the card | | 🔴 |

Check: Unstop builds the page with JavaScript, so the cards may appear late; `a.item` is a very generic class name.

## 3. Naukri 🔴

URL: `https://www.naukri.com/ai-ml-internship-jobs-in-india`

| Field | Old selector | New selector | Status |
|---|---|---|---|
| Wait for / card | `.srp-jobtuple-wrapper` | | 🔴 |
| Title + link | `a.title` | | 🔴 |
| Company | `a.comp-name` | | 🔴 |
| Location | `span.locWdth` | | 🔴 |
| Experience | `span.expwdth` (skips 5+ yrs) | | 🔴 |
| Stipend | `span` next to `span.ni-job-tuple-icon-srp-rupee` | | 🔴 |
| Skills | `ul.tags-gt li` | | 🔴 |

Check: Naukri often blocks headless browsers. Code issue: `stipend_numeric` is always `0.0`, so the ₹5,000 rule never runs on Naukri.

## 4. LinkedIn (guest search) 🔴

URL: `https://www.linkedin.com/jobs/search/?keywords={kw}&location={loc}&f_JT=I&f_E=1` (about 70 keyword/location pairs)

| Field | Old selector | New selector | Status |
|---|---|---|---|
| Cookie / popups | `button[action-type='ACCEPT']`, `button.modal__dismiss`, `button[aria-label='Dismiss']` | | 🔴 |
| Card | `div` with class containing `base-card`; fallback `li` in `jobs-search__results-list` | | 🔴 |
| Title | `h3.base-search-card__title` (fallback any `h3`) | | 🔴 |
| Company | `h4.base-search-card__subtitle` / `a.hidden-nested-link` | | 🔴 |
| Location | `span.job-search-card__location` | | 🔴 |
| Link | `a.base-card__full-link` | | 🔴 |
| Stipend | not on the card ("Check Listing") | | — |

Check: LinkedIn may show a sign-in wall to guests after a few pages; 70 searches in one run is a lot.

## 5. Shine 🔴

URL: `https://www.shine.com/job-search/ai-machine-learning-internship-jobs`

| Field | Old selector | New selector | Status |
|---|---|---|---|
| Card | `div` class matching `jobCardNova_bigCard` | | 🔴 |
| Title | `h3` | | 🔴 |
| Company | `span` class matching `jobCardNova_bigCardTopTitleName` | | 🔴 |
| Location | `div` class matching `jobCardNova_bigCardCenterListLoc` | | 🔴 |
| Link | first `a` in the card | | 🔴 |
| Stipend | not read | | 🔴 |

## 6. Foundit 🔴

URL: `https://www.foundit.in/srp/results?query=ai+ml+internship`

| Field | Old selector | New selector | Status |
|---|---|---|---|
| Card | `div` class matching `job-tuple` | | 🔴 |
| Title | `h3` | | 🔴 |
| Company | `span` class matching `company-name` | | 🔴 |
| Location | `div` class matching `details` | | 🔴 |
| Link | first `a` in the card | | 🔴 |
| Stipend | not read | | 🔴 |

## 7. Apna 🔴

URL: `https://apna.co/jobs?category=internship&q=ai+ml`

| Field | Old selector | New selector | Status |
|---|---|---|---|
| Card | `a` with `/job/` in `href` that contains `[data-testid=job-title]` | | 🔴 |
| Title | `[data-testid=job-title]` | | 🔴 |
| Company | `[data-testid=company-title]` | | 🔴 |
| Location | `[data-testid=job-location]` | | 🔴 |
| Salary | `[data-testid=job-salary]` | | 🔴 |
| Link | card `href` (+ `https://apna.co`) | | 🔴 |

## 8. Cutshort 🔴

URL: `https://cutshort.io/jobs/ai-ml?type=internship`

| Field | Old selector | New selector | Status |
|---|---|---|---|
| Card | `div` class matching `job-card` | | 🔴 |
| Title | `div` class matching `title` | | 🔴 |
| Company | `div` class matching `company` | | 🔴 |
| Location | `div` class matching `location` | | 🔴 |
| Link | first `a` in the card | | 🔴 |

Check: whether the list is visible without logging in.

## 9. We Work Remotely, search page 🔴

URL: `https://weworkremotely.com/remote-jobs/search?term=internship+machine+learning`

| Field | Old selector | New selector | Status |
|---|---|---|---|
| Card | `li.feature` | | 🔴 |
| Title | `h3.new-listing__header__title` (fallback `span.title`) | | 🔴 |
| Company | `p.new-listing__company-name` (fallback `span.company`) | | 🔴 |
| Link | `a[href]` starting with `/remote-jobs/` | | 🔴 |

Check: `li.feature` may only match featured (paid) posts, not all results.

## 10–11. RSS feeds 🔴 (no selectors)

- Remotive: `https://remotive.com/remote-jobs/feed?category=software-dev&keywords=machine+learning`, `…category=data&keywords=machine+learning`, `…category=software-dev&keywords=artificial+intelligence`
- We Work Remotely: `https://weworkremotely.com/categories/remote-programming-jobs.rss`, `…/remote-data-science-and-analytics-jobs.rss`

Check: each feed still returns items. Code issue: in `rss_feeds.py` the function `scrape_linkedin` actually reads Remotive and `scrape_indeed` actually reads We Work Remotely; rename them so nobody gets confused.

## 12–13. DuckDuckGo search and universities 🔴 (no selectors)

Uses the `ddgs` package (falls back to `duckduckgo_search`). Check: the package still returns results and is not rate-limited; `universities.py` runs 54 queries in one go.

## 14–16. Link-only sources ⚪

`bigtech.py` (Microsoft, Google, Meta, Apple, NVIDIA), `government.py` (AICTE, CDAC, DRDO), `niche.py` (AIJobs.net, MLOps Community, DeepLearning.AI, KDnuggets, SimplyHired, CareerJet, Talent.com) do not read any listing. They add one placeholder record per site saying "go check this page". These are not internships, so they should either be removed from the genuine list or turned into real scrapers.

---

## Code problems found so far (not selectors)

| Problem | Where | Status |
|---|---|---|
| `NameError: scrapers` at the end of every run | `scraper.py` | ✅ fixed |
| `--source` crashed (`specific_source` was not a parameter) | `scraper.py` | ✅ fixed |
| `--dry-run` only printed a count | `scraper.py` | ✅ now prints kept/dropped with reasons |
| Skills like "Leadership" rejected real listings (word `lead`) | `filters.py` | ✅ exclusions now check the title only |
| A single "Artificial intelligence" skill tag let marketing/HR roles in | `filters.py` | ✅ title match or 2 real ML skills |
| "Competitive stipend" was treated as unpaid | `filters.py` | ✅ fixed |
| `schedule` package missing from requirements | `requirements.txt` | ✅ added |
| `wait_for_human` is defined twice | `scraper_utils.py` | 🔴 |
| Naukri `stipend_numeric` always 0 | `sites/naukri.py` | 🔴 |
| RSS functions named after the wrong sites | `sites/rss_feeds.py` | 🔴 |
| Link-only sources mixed in with real listings | `bigtech.py`, `government.py`, `niche.py` | 🔴 decide: remove or rebuild |
