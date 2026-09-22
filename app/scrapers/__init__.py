from app.scrapers.d4builds import D4BuildsScraper
from app.scrapers.d4guides import D4GuidesScraper
from app.scrapers.infinitybuilds import InfinityBuildsScraper
from app.scrapers.kamilabs import KamiLabsScraper
from app.scrapers.maxroll import MaxrollScraper
from app.scrapers.talion import TalionScraper

# Registry of every site scraper the comparator queries.
# Add a new site by writing a Scraper subclass and listing it here.
#
# mobalytics.gg is deliberately NOT included: the whole domain sits behind
# a Cloudflare bot-management challenge (HTTP 403, "Cf-Mitigated: challenge"
# on every path tried, including subdomains) - a real anti-automation
# measure, not just "no API found" like the others. Bypassing that would
# mean browser-fingerprint evasion, which this project isn't doing.
ALL_SCRAPERS = [
    KamiLabsScraper(),
    MaxrollScraper(),
    InfinityBuildsScraper(),
    D4BuildsScraper(),
    D4GuidesScraper(),
    TalionScraper(),
]
