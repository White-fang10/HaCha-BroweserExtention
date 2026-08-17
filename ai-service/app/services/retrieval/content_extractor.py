"""
Content Extractor - Phase 9
Extract main article content from HTML using trafilatura or fallback.
"""
import re
from typing import Optional
from datetime import datetime
from app.schemas.evidence import ExtractedContent


class ContentExtractor:
    """Extract main content from HTML pages."""

    def __init__(
        self,
        min_text_length: int = 200,
        max_text_length: int = 50000,
    ):
        self.min_text_length = min_text_length
        self.max_text_length = max_text_length
        self._trafilatura = None
        self._init_trafilatura()

    def _init_trafilatura(self) -> None:
        """Try to import trafilatura for better extraction."""
        try:
            import trafilatura
            self._trafilatura = trafilatura
        except ImportError:
            pass

    def extract(self, content: ExtractedContent) -> Optional[ExtractedContent]:
        """Extract main content from HTML."""
        html = content.text

        # Try trafilatura first (best quality)
        if self._trafilatura:
            extracted = self._extract_with_trafilatura(html, content.url)
            if extracted and len(extracted) >= self.min_text_length:
                return self._create_extracted_content(content, extracted)

        # Fallback to basic extraction
        extracted = self._extract_basic(html)
        if extracted and len(extracted) >= self.min_text_length:
            return self._create_extracted_content(content, extracted)

        # If extraction fails or too short, return original (might be plain text)
        if len(html) >= self.min_text_length:
            return content

        return None

    def _extract_with_trafilatura(self, html: str, url: str) -> Optional[str]:
        """Extract using trafilatura."""
        try:
            # Extract with metadata
            result = self._trafilatura.extract(
                html,
                url=url,
                include_comments=False,
                include_tables=True,
                include_formatting=False,
                favor_precision=True,
                target_language=None,
            )
            return result
        except Exception:
            return None

    def _extract_basic(self, html: str) -> Optional[str]:
        """Basic HTML extraction fallback."""
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')

            # Remove unwanted elements
            for elem in soup(['script', 'style', 'nav', 'header', 'footer',
                               'aside', 'iframe', 'noscript', 'svg', 'canvas',
                               'form', 'button', 'input', 'select', 'option']):
                elem.decompose()

            # Remove common ad/cookie classes
            for elem in soup.find_all(class_=re.compile(
                r'(ad|ads|advert|banner|cookie|popup|modal|overlay|'
                r'share|social|follow|subscribe|newsletter|comment)',
                re.IGNORECASE
            )):
                elem.decompose()

            # Try to find main content
            main_candidates = [
                soup.find('main'),
                soup.find('article'),
                soup.find('div', role='main'),
                soup.find('div', class_=re.compile(r'(content|article|post|entry)', re.IGNORECASE)),
            ]

            for candidate in main_candidates:
                if candidate:
                    text = candidate.get_text(separator='\n', strip=True)
                    if len(text) >= self.min_text_length:
                        return self._clean_text(text)

            # Fallback: get all text from body
            body = soup.find('body')
            if body:
                text = body.get_text(separator='\n', strip=True)
                return self._clean_text(text)

            # Last resort: all text
            text = soup.get_text(separator='\n', strip=True)
            return self._clean_text(text)

        except Exception:
            return None

    def _clean_text(self, text: str) -> str:
        """Clean extracted text."""
        # Normalize whitespace
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r'[ \t]{2,}', ' ', text)
        text = text.strip()

        # Truncate if too long
        if len(text) > self.max_text_length:
            text = text[:self.max_text_length] + "..."

        return text

    def _create_extracted_content(self, original: ExtractedContent, text: str) -> ExtractedContent:
        """Create new ExtractedContent with extracted text."""
        return ExtractedContent(
            url=original.url,
            title=original.title,
            author=original.author,
            publisher=original.publisher,
            published_at=original.published_at,
            text=text,
            word_count=len(text.split()),
            extracted_at=datetime.utcnow(),
        )