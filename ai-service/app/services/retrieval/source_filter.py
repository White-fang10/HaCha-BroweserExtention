"""
Source Filtering - Phase 9
Filter and score search results for safety and quality.
"""
import re
from urllib.parse import urlparse
from typing import Optional
from app.schemas.evidence import SearchResult, SourceType


class SourceFilter:
    """Filter and classify search results."""

    # Tracking parameters to strip
    TRACKING_PARAMS = {
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'msclkid', 'ref', 'source', 'campaign',
        '_ga', '_gl', 'mc_cid', 'mc_eid', 'sr_share'
    }

    # Private IP ranges for SSRF protection
    PRIVATE_IPV4_RANGES = [
        (0x0A000000, 0x0AFFFFFF),      # 10.0.0.0/8
        (0x7F000000, 0x7FFFFFFF),      # 127.0.0.0/8
        (0xAC100000, 0xAC1FFFFF),      # 172.16.0.0/12
        (0xC0A80000, 0xC0A8FFFF),      # 192.168.0.0/16
        (0xA9FE0000, 0xA9FEFFFF),      # 169.254.0.0/16 (link-local)
    ]

    # Cloud metadata endpoints
    CLOUD_METADATA_IPS = {
        '169.254.169.254',  # AWS, GCE, Azure, DigitalOcean
        '100.100.100.200',  # Alibaba Cloud
    }

    # Known fact-check organizations
    FACT_CHECK_DOMAINS = {
        'snopes.com', 'factcheck.org', 'politifact.com', 'checkyourfact.com',
        'fullfact.org', 'factcheck.afp.com', 'reuters.com/fact-check',
        'apnews.com/fact-check', 'bbc.com/reality-check', 'theconversation.com/factcheck',
        'boomlive.in', 'altnews.in', 'factly.in', 'indiaspend.org',
        'healthfeedback.org', 'climatefeedback.org', 'scicheck.org',
    }

    # Government domains (US + common patterns)
    GOV_TLDS = {'.gov', '.gov.uk', '.gov.au', '.gov.ca', '.gov.in', '.gc.ca', '.gov.br'}
    GOV_DOMAINS = {'whitehouse.gov', 'cdc.gov', 'nih.gov', 'who.int', 'un.org', 'europa.eu'}

    # Academic domains
    ACADEMIC_TLDS = {'.edu', '.ac.uk', '.ac.in', '.edu.au'}
    ACADEMIC_DOMAINS = {'arxiv.org', 'pubmed.ncbi.nlm.nih.gov', 'scholar.google.com', 'doi.org'}

    # Major news domains
    MAJOR_NEWS_DOMAINS = {
        'reuters.com', 'apnews.com', 'bbc.com', 'nytimes.com', 'washingtonpost.com',
        'theguardian.com', 'wsj.com', 'ft.com', 'economist.com', 'bloomberg.com',
        'cnn.com', 'nbcnews.com', 'abcnews.go.com', 'cbsnews.com', 'pbs.org',
        'npr.org', 'propublica.org', 'politico.com', 'thehill.com', 'axios.com',
        'aljazeera.com', 'france24.com', 'dw.com', 'nhk.or.jp', 'cbc.ca',
        'abc.net.au', 'smh.com.au', 'theaustralian.com.au', 'globaltimes.cn',
        'timesofindia.indiatimes.com', 'thehindu.com', 'indianexpress.com',
        'ndtv.com', 'news18.com', 'business-standard.com', 'livemint.com',
    }

    # Social media / forum domains (low authority)
    SOCIAL_DOMAINS = {
        'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'tiktok.com',
        'reddit.com', 'linkedin.com', 'youtube.com', 'quora.com', 'medium.com',
        'substack.com', 'blogspot.com', 'wordpress.com', 'tumblr.com',
    }

    def __init__(
        self,
        max_results_per_domain: int = 3,
        allowed_schemes: Optional[set[str]] = None,
        blocked_domains: Optional[set[str]] = None
    ):
        self.max_results_per_domain = max_results_per_domain
        self.allowed_schemes = allowed_schemes or {'https', 'http'}
        self.blocked_domains = blocked_domains or set()

    def filter_results(self, results: list[SearchResult]) -> list[SearchResult]:
        """Filter and deduplicate search results."""
        # 1. Normalize URLs
        normalized = []
        for result in results:
            normalized_url = self._normalize_url(str(result.url))
            if normalized_url:
                result.url = normalized_url
                normalized.append(result)

        # 2. Safety filtering
        safe = [r for r in normalized if self._is_safe_url(r.url)]

        # 3. Deduplicate by normalized URL
        deduped = self._deduplicate(safe)

        # 4. Apply per-domain limit
        limited = self._limit_per_domain(deduped)

        # 5. Classify sources
        for result in limited:
            result.publisher = result.publisher or self._extract_publisher_from_url(str(result.url))

        return limited

    def _normalize_url(self, url: str) -> Optional[str]:
        """Normalize URL for deduplication and safety."""
        try:
            parsed = urlparse(url)

            # Validate scheme
            if parsed.scheme.lower() not in self.allowed_schemes:
                return None

            # Validate hostname
            if not parsed.hostname:
                return None

            # Check blocked domains
            hostname = parsed.hostname.lower()
            if hostname in self.blocked_domains:
                return None

            # Reconstruct URL with normalized components
            # Remove tracking parameters
            query_params = []
            if parsed.query:
                for param in parsed.query.split('&'):
                    key = param.split('=')[0].lower()
                    if key not in self.TRACKING_PARAMS:
                        query_params.append(param)

            normalized_query = '&'.join(query_params) if query_params else ''

            # Remove fragment
            normalized = parsed._replace(
                scheme=parsed.scheme.lower(),
                netloc=hostname,
                query=normalized_query,
                fragment=''
            ).geturl()

            return normalized

        except Exception:
            return None

    def _is_safe_url(self, url: str) -> bool:
        """Check if URL is safe to fetch (SSRF protection)."""
        try:
            parsed = urlparse(url)
            hostname = parsed.hostname

            if not hostname:
                return False

            # Block private IPs
            if self._is_private_ip(hostname):
                return False

            # Block cloud metadata endpoints
            if hostname in self.CLOUD_METADATA_IPS:
                return False

            # Block localhost variants
            if hostname.lower() in {'localhost', 'localhost.localdomain'}:
                return False

            # Block file:// and other dangerous schemes
            if parsed.scheme.lower() not in self.allowed_schemes:
                return False

            return True

        except Exception:
            return False

    def _is_private_ip(self, hostname: str) -> bool:
        """Check if hostname resolves to private IP (basic check)."""
        # Check if it's an IP address
        ip_pattern = re.compile(r'^(\d{1,3}\.){3}\d{1,3}$')
        if not ip_pattern.match(hostname):
            return False

        try:
            parts = list(map(int, hostname.split('.')))
            if len(parts) != 4:
                return False
            ip_int = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]

            for start, end in self.PRIVATE_IPV4_RANGES:
                if start <= ip_int <= end:
                    return True

            # Check cloud metadata
            if hostname in self.CLOUD_METADATA_IPS:
                return True

        except Exception:
            pass

        return False

    def _deduplicate(self, results: list[SearchResult]) -> list[SearchResult]:
        """Remove duplicate URLs."""
        seen = set()
        deduped = []
        for result in results:
            url = str(result.url).lower()
            if url not in seen:
                seen.add(url)
                deduped.append(result)
        return deduped

    def _limit_per_domain(self, results: list[SearchResult]) -> list[SearchResult]:
        """Limit results per domain for diversity."""
        domain_counts = {}
        limited = []
        for result in results:
            domain = urlparse(str(result.url)).netloc.lower()
            count = domain_counts.get(domain, 0)
            if count < self.max_results_per_domain:
                domain_counts[domain] = count + 1
                limited.append(result)
        return limited

    def _extract_publisher_from_url(self, url: str) -> str:
        """Extract publisher name from URL."""
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            # Remove www.
            domain = domain.replace('www.', '')
            # Take first part
            return domain.split('.')[0].title()
        except Exception:
            return "Unknown"

    def classify_source(self, result: SearchResult) -> SourceType:
        """Classify source type based on domain and metadata."""
        domain = urlparse(str(result.url)).netloc.lower()
        domain = domain.replace('www.', '')

        # Check fact-check organizations
        if any(fc_domain in domain for fc_domain in self.FACT_CHECK_DOMAINS):
            return SourceType.FACT_CHECK_ORG

        # Check government
        if any(domain.endswith(tld) for tld in self.GOV_TLDS) or domain in self.GOV_DOMAINS:
            return SourceType.GOVERNMENT

        # Check academic
        if any(domain.endswith(tld) for tld in self.ACADEMIC_TLDS) or domain in self.ACADEMIC_DOMAINS:
            return SourceType.ACADEMIC

        # Check major news
        if domain in self.MAJOR_NEWS_DOMAINS:
            return SourceType.MAJOR_NEWS

        # Check social/forum
        if domain in self.SOCIAL_DOMAINS:
            return SourceType.FORUM_SOCIAL

        # Check if it might be primary official (government-like but not in list)
        if any(kw in domain for kw in ['official', 'gov', 'ministry', 'department', 'agency']):
            return SourceType.PRIMARY_OFFICIAL

        return SourceType.UNKNOWN


class SourceQualityScorer:
    """Score source quality for ranking."""

    def __init__(self, filter: SourceFilter):
        self.filter = filter

    def score(self, result: SearchResult, claim_analysis=None) -> dict:
        """Calculate quality scores for a source."""
        source_type = self.filter.classify_source(result)

        # Authority score based on source type
        authority_map = {
            SourceType.PRIMARY_OFFICIAL: 0.95,
            SourceType.GOVERNMENT: 0.90,
            SourceType.ACADEMIC: 0.88,
            SourceType.FACT_CHECK_ORG: 0.85,
            SourceType.MAJOR_NEWS: 0.75,
            SourceType.SPECIALIST: 0.65,
            SourceType.SECONDARY: 0.45,
            SourceType.FORUM_SOCIAL: 0.15,
            SourceType.UNKNOWN: 0.35,
        }
        authority = authority_map.get(source_type, 0.35)

        # Recency score (if published_at available)
        recency = 0.5  # default
        if result.published_at:
            from datetime import datetime, timezone
            age_days = (datetime.now(timezone.utc) - result.published_at).days
            if age_days <= 7:
                recency = 1.0
            elif age_days <= 30:
                recency = 0.9
            elif age_days <= 90:
                recency = 0.8
            elif age_days <= 365:
                recency = 0.6
            elif age_days <= 730:
                recency = 0.4
            else:
                recency = 0.2

        # Relevance score (placeholder - would use text similarity in practice)
        relevance = 0.7  # default, would be computed from snippet/title vs claim

        return {
            'relevance_score': relevance,
            'authority_score': authority,
            'recency_score': recency,
            'source_type': source_type,
        }