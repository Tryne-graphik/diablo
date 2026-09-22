"""Single place to bump the season number when Diablo 4 moves on - every
scraper that needs to filter by season imports from here instead of
hardcoding it.
"""

CURRENT_SEASON = 15

# Used as a fallback filter for sites with no explicit per-build season
# field (see app/scrapers/talion.py) - approximate, based on when other
# sites' S15 content started appearing. Update alongside CURRENT_SEASON.
CURRENT_SEASON_START = "2026-09-14"

# Seasons selectable in the UI, newest first. Only kami-labs and d4guides
# actually have past-season data (Scraper.SUPPORTS_SEASON_FILTER) - the
# other sources are single "current season" live pages/APIs with nothing
# to select an older season from, and return no results for anything but
# CURRENT_SEASON (see app/scrapers/base.py).
AVAILABLE_SEASONS = [15, 14]
