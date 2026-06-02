"""
DuckDuckGo Web Search Fallback — v2 (Fixed)
==============================================
When the vector DB has no relevant documents, we fall back to
DuckDuckGo Search — completely free, no API key required.

v2 Changes:
  ✓ Filter garbage URLs (google.com/?zx=, google.com/?hl=, etc.)
  ✓ Sanitize overly long/verbose LLM-generated queries
  ✓ Retry with simplified keyword-only query if 0 results
  ✓ Extract key actionable points from snippets
  ✓ Better GCP-specific query construction
"""
import re
import logging
from duckduckgo_search import DDGS

logger = logging.getLogger("cloudops.websearch")


# ─── Garbage URL Patterns ────────────────────────────────────────

GARBAGE_URL_PATTERNS = [
    r'google\.com/\?zx=',
    r'google\.com/\?hl=',
    r'google\.com/search',
    r'google\.com/sorry',
    r'accounts\.google\.com',
    r'support\.google\.com/accounts',
    r'policies\.google\.com',
    r'translate\.google\.com',
    r'maps\.google\.com',
    r'play\.google\.com',
    r'youtube\.com/watch',
    r'facebook\.com',
    r'twitter\.com',
    r'linkedin\.com/pulse',
    r'reddit\.com',
    r'pinterest\.com',
    r'instagram\.com',
]

# Domains we trust for GCP content
TRUSTED_DOMAINS = [
    'cloud.google.com',
    'cloud.google.com/docs',
    'cloud.google.com/compute',
    'cloud.google.com/storage',
    'cloud.google.com/vpc',
    'cloud.google.com/iam',
    'cloud.google.com/bigquery',
    'cloud.google.com/billing',
    'cloud.google.com/architecture',
    'cloud.google.com/support',
    'cloud.google.com/blog',
    'stackoverflow.com',
    'serverfault.com',
    'medium.com',
    'dev.to',
    'github.com',
    'googlecloudcommunity.com',
    'cloudplatformonline.com',
]


def _is_garbage_url(url: str) -> bool:
    """Check if a URL is a garbage/redirect/non-content page."""
    if not url:
        return True
    for pattern in GARBAGE_URL_PATTERNS:
        if re.search(pattern, url, re.IGNORECASE):
            return True
    # Also filter if it's just a bare domain with no path
    if re.match(r'^https?://[^/]+/?$', url):
        return True
    return False


def _sanitize_query(query: str) -> str:
    """
    Clean up an LLM-generated or raw query for web search.
    - Remove brackets, parentheses, special chars
    - Truncate to reasonable length
    - Strip excessive whitespace
    """
    # Remove common LLM noise: brackets, parentheses with content like (e.g., ...)
    cleaned = re.sub(r'\(e\.g\.,?\s*[^)]*\)', '', query)
    cleaned = re.sub(r'\[([^\]]*)\]', r'\1', cleaned)  # [compute] → compute
    cleaned = re.sub(r'\(([^)]*)\)', r'\1', cleaned)    # (foo) → foo
    # Remove special chars
    cleaned = re.sub(r'[{}"\'`]', '', cleaned)
    # Collapse whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    # Truncate to ~120 chars (DuckDuckGo works best with shorter queries)
    if len(cleaned) > 120:
        # Try to cut at a word boundary
        cleaned = cleaned[:120].rsplit(' ', 1)[0]
    return cleaned


def _extract_keywords(text: str) -> str:
    """
    Extract core keywords from a verbose query for retry.
    Used when the full query returns 0 results.
    """
    # Remove common filler words
    stop_words = {
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
        'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
        'would', 'could', 'should', 'may', 'might', 'can', 'shall',
        'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
        'as', 'into', 'through', 'during', 'before', 'after', 'above',
        'below', 'between', 'under', 'again', 'further', 'then', 'once',
        'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
        'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
        'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
        'very', 'just', 'because', 'but', 'and', 'or', 'if', 'while',
        'about', 'specific', 'common', 'reasons', 'including', 'also',
        'that', 'this', 'these', 'those', 'what', 'which', 'who', 'whom',
        'its', 'it', 'i', 'my', 'me', 'we', 'our', 'you', 'your',
        'he', 'she', 'they', 'them', 'his', 'her', 'their',
    }

    words = re.findall(r'[a-zA-Z0-9\-\.]+', text.lower())
    keywords = [w for w in words if w not in stop_words and len(w) > 2]

    # Take the most important keywords (first ~8)
    return ' '.join(keywords[:8])


def web_search(query: str, max_results: int = 5, region: str = "wt-wt") -> list[dict]:
    """
    Search the web using DuckDuckGo.
    Sanitizes the query, filters garbage URLs, retries with simplified query.

    Returns list of:
        {
            "title": str,
            "text": str,     # snippet / body
            "url": str,
            "source": "web_search",
            "context_header": str,
        }
    """
    # Sanitize the query
    clean_query = _sanitize_query(query)
    if not clean_query:
        return []

    # Add GCP context if not present
    gcp_terms = ["gcp", "google cloud", "cloud platform", "cloud.google"]
    if not any(t in clean_query.lower() for t in gcp_terms):
        search_query = f"Google Cloud {clean_query}"
    else:
        search_query = clean_query

    results = _do_search(search_query, max_results, region)

    # If 0 valid results, retry with simplified keyword query
    if not results:
        keyword_query = f"GCP {_extract_keywords(query)}"
        logger.info(f"Retrying web search with simplified query: '{keyword_query}'")
        results = _do_search(keyword_query, max_results, region)

    # If still 0, try one more time with very basic terms
    if not results:
        basic_query = _extract_keywords(query)
        if basic_query:
            logger.info(f"Final retry with basic keywords: '{basic_query}'")
            results = _do_search(f"Google Cloud Platform {basic_query}", max_results, region)

    return results


def _do_search(search_query: str, max_results: int, region: str) -> list[dict]:
    """Execute a single DuckDuckGo search and filter results."""
    try:
        with DDGS() as ddgs:
            raw_results = list(ddgs.text(
                search_query,
                region=region,
                max_results=max_results + 5,  # Fetch extra to account for filtering
            ))

        formatted = []
        for r in raw_results:
            url = r.get("href", "")
            title = r.get("title", "")
            body = r.get("body", "")

            # Filter garbage URLs
            if _is_garbage_url(url):
                logger.debug(f"Filtered garbage URL: {url}")
                continue

            # Skip results with empty snippets
            if not body or len(body.strip()) < 20:
                continue

            formatted.append({
                "title": title,
                "text": body,
                "url": url,
                "source": "web_search",
                "context_header": f"Web > {title[:80]}",
            })

            if len(formatted) >= max_results:
                break

        logger.info(f"Web search for '{search_query}': {len(formatted)} results (filtered from {len(raw_results)} raw)")
        return formatted

    except Exception as e:
        logger.error(f"DuckDuckGo search failed: {e}")
        return []


def web_search_for_support(
    ticket_description: str,
    category: str,
    missing_topics: list[str] = None,
) -> list[dict]:
    """
    Targeted web search for a support ticket.
    Constructs focused queries instead of dumping raw LLM text.
    """
    results = []

    # Search for the main issue — use a clean, focused query
    # Extract key terms from description, don't use the raw verbose text
    main_keywords = _extract_keywords(ticket_description)
    main_query = f"Google Cloud {category} {main_keywords}"
    results.extend(web_search(main_query, max_results=3))

    # Search for specific missing topics — but clean them first!
    if missing_topics:
        for topic in missing_topics[:2]:  # Max 2 extra searches
            # Don't use raw LLM output as query — extract keywords
            clean_topic = _sanitize_query(topic)
            if clean_topic and len(clean_topic) > 5:
                topic_query = f"Google Cloud {category} {clean_topic}"
                results.extend(web_search(topic_query, max_results=2))

    # Deduplicate by URL
    seen_urls = set()
    unique = []
    for r in results:
        if r["url"] not in seen_urls:
            seen_urls.add(r["url"])
            unique.append(r)

    return unique[:8]  # Cap at 8 results
