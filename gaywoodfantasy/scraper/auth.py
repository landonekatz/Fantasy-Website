"""
ESPN authentication helpers.
Loads espn_s2 and SWID cookies from environment variables or a local .env file.
Never hardcode credentials here — store them in dad-league/scraper/.env
"""
import os
from pathlib import Path

# Support loading from a .env file if python-dotenv is available
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent / ".env"
    if _env_path.exists():
        load_dotenv(_env_path)
except ImportError:
    pass  # dotenv optional; env vars can be set manually


def get_cookies() -> dict:
    """
    Returns the ESPN auth cookies required for private league access.
    Reads from environment variables ESPN_S2 and ESPN_SWID.

    Set these in dad-league/scraper/.env:
        ESPN_S2=AECsRJF9...
        ESPN_SWID={BFD6F1F8-...}

    Or export them in your shell before running.
    """
    espn_s2 = os.environ.get("ESPN_S2", "").strip()
    swid    = os.environ.get("ESPN_SWID", "").strip()

    if not espn_s2 or not swid:
        raise EnvironmentError(
            "Missing ESPN credentials.\n"
            "Create dad-league/scraper/.env with:\n"
            "  ESPN_S2=<your espn_s2 cookie value>\n"
            "  ESPN_SWID=<your SWID cookie value>\n"
            "Or export them as environment variables."
        )

    return {
        "espn_s2": espn_s2,
        "SWID": swid,
    }


def get_headers() -> dict:
    return {"Accept": "application/json"}
