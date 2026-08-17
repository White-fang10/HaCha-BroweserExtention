"""
Evidence Extractor - Phase 9
Extract relevant evidence passages from full article text.
"""
import re
import hashlib
from typing import Optional
from app.schemas.evidence import ExtractedContent, EvidenceItem, EvidenceDirection, SourceType


class EvidenceExtractor:
    """Extract evidence passages relevant to a claim."""

    def __init__(
        self,
        min_chunk_words: int = 50,
        max_chunk_words: int = 500,
        context_sentences: int = 1,
        relevance_threshold: float = 0.3,
    ):
        self.min_chunk_words = min_chunk_words
        self.max_chunk_words = max_chunk_words
        self.context_sentences = context_sentences
        self.relevance_threshold = relevance_threshold

    def extract(
        self,
        claim: str,
        content: ExtractedContent,
        source_type: SourceType,
        claim_keywords: Optional[list[str]] = None
    ) -> list[EvidenceItem]:
        """Extract evidence chunks from article content."""
        if not content.text or len(content.text.split()) < self.min_chunk_words:
            return []

        # Get claim keywords for relevance scoring
        keywords = claim_keywords or self._extract_claim_keywords(claim)

        # Split into chunks
        chunks = self._chunk_text(content.text)

        evidence_items = []
        for i, chunk in enumerate(chunks):
            # Calculate relevance
            relevance = self._calculate_relevance(chunk, keywords, claim)

            if relevance >= self.relevance_threshold:
                # Determine direction (simplified - would use NLI in production)
                direction = self._estimate_direction(chunk, claim)

                # Create content hash for deduplication
                content_hash = hashlib.sha256(chunk.encode()).hexdigest()[:16]

                evidence_items.append(EvidenceItem(
                    direction=direction,
                    excerpt=chunk,
                    source_url=content.url,
                    source_title=content.title,
                    publisher=content.publisher,
                    published_at=content.published_at,
                    relevance_score=relevance,
                    authority_score=0.5,  # Will be overridden by ranker
                    recency_score=0.5,    # Will be overridden by ranker
                    source_type=source_type,
                    chunk_index=i,
                    content_hash=f"sha256:{content_hash}",
                ))

        # Sort by relevance
        evidence_items.sort(key=lambda e: e.relevance_score, reverse=True)

        return evidence_items

    def _extract_claim_keywords(self, claim: str) -> list[str]:
        """Extract meaningful keywords from claim."""
        # Remove stop words
        stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
            'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
            'these', 'those', 'it', 'its', 'they', 'them', 'their', 'we', 'us',
            'our', 'you', 'your', 'i', 'me', 'my', 'he', 'him', 'his', 'she',
            'her', 'hers', 'not', 'no', 'yes', 'so', 'then', 'than', 'very'
        }

        words = re.findall(r'\b\w+\b', claim.lower())
        keywords = [w for w in words if w not in stop_words and len(w) > 2]

        # Prioritize capitalized words (proper nouns) and numbers
        claim_words = claim.split()
        for w in claim_words:
            clean = w.strip('.,!?":;()[]{}')
            if clean and (clean[0].isupper() or clean.replace(',', '').replace('.', '').isdigit()):
                if clean.lower() not in keywords:
                    keywords.insert(0, clean.lower())

        return keywords[:20]

    def _chunk_text(self, text: str) -> list[str]:
        """Split text into overlapping chunks."""
        # Split into sentences
        sentences = re.split(r'(?<=[.!?])\s+', text)

        chunks = []
        current_chunk = []
        current_word_count = 0

        for sentence in sentences:
            words = sentence.split()
            word_count = len(words)

            # If single sentence is too long, split it
            if word_count > self.max_chunk_words:
                # Split long sentence by commas
                parts = re.split(r'(?<=,)\s+', sentence)
                for part in parts:
                    p_words = part.split()
                    if current_word_count + len(p_words) <= self.max_chunk_words:
                        current_chunk.append(part)
                        current_word_count += len(p_words)
                    else:
                        if current_chunk:
                            chunks.append(' '.join(current_chunk))
                        current_chunk = [part]
                        current_word_count = len(p_words)
                continue

            if current_word_count + word_count <= self.max_chunk_words:
                current_chunk.append(sentence)
                current_word_count += word_count
            else:
                if current_word_count >= self.min_chunk_words:
                    chunks.append(' '.join(current_chunk))

                # Start new chunk with overlap
                overlap = current_chunk[-self.context_sentences:] if len(current_chunk) > self.context_sentences else current_chunk
                current_chunk = overlap + [sentence]
                current_word_count = sum(len(s.split()) for s in current_chunk)

        # Add final chunk
        if current_chunk and current_word_count >= self.min_chunk_words:
            chunks.append(' '.join(current_chunk))

        return chunks

    def _calculate_relevance(self, chunk: str, keywords: list[str], claim: str) -> float:
        """Calculate relevance score for a chunk."""
        chunk_lower = chunk.lower()
        chunk_words = set(chunk_lower.split())

        if not keywords:
            return 0.0

        # Keyword overlap
        matched = sum(1 for kw in keywords if kw in chunk_lower)
        keyword_score = matched / len(keywords)

        # Exact phrase bonus
        phrase_bonus = 0.0
        for i in range(len(keywords) - 1):
            bigram = f"{keywords[i]} {keywords[i+1]}"
            if bigram in chunk_lower:
                phrase_bonus += 0.1

        # Number/date overlap (high signal)
        claim_numbers = re.findall(r'\b\d+(?:,\d{3})*(?:\.\d+)?%?\b', claim)
        chunk_numbers = re.findall(r'\b\d+(?:,\d{3})*(?:\.\d+)?%?\b', chunk)
        number_overlap = len(set(claim_numbers) & set(chunk_numbers))
        number_bonus = min(number_overlap * 0.15, 0.3)

        # Entity overlap
        claim_entities = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', claim)
        chunk_entities = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', chunk)
        entity_overlap = len(set(claim_entities) & set(chunk_entities))
        entity_bonus = min(entity_overlap * 0.1, 0.2)

        score = keyword_score + phrase_bonus + number_bonus + entity_bonus
        return min(score, 1.0)

    def _estimate_direction(self, chunk: str, claim: str) -> EvidenceDirection:
        """Estimate evidence direction (simplified heuristic)."""
        chunk_lower = chunk.lower()
        claim_lower = claim.lower()

        # Check for contradiction signals
        contradiction_signals = [
            r'\b(?:not|no|never|false|incorrect|wrong|debunk|refute|contradict|disprove)\b',
            r'\b(?:unfounded|baseless|misleading|fake|hoax|myth)\b',
            r'\b(?:deny|denies|denied|reject|rejects|rejected)\b',
        ]

        support_signals = [
            r'\b(?:confirm|confirms|confirmed|support|supports|supported|prove|proves|proven)\b',
            r'\b(?:evidence|show|shows|shown|indicate|indicates|indicated|demonstrate)\b',
            r'\b(?:study|research|find|finds|found|discover|discovers|discovered)\b',
        ]

        contradiction_count = sum(1 for sig in contradiction_signals if re.search(sig, chunk_lower))
        support_count = sum(1 for sig in support_signals if re.search(sig, chunk_lower))

        # Check if claim has negation
        claim_has_negation = bool(re.search(r'\b(?:not|no|never|false|fake|hoax|myth)\b', claim_lower))

        if claim_has_negation:
            # Negated claim: "X is false" - support signals mean chunk says X is false
            if support_count > contradiction_count:
                return EvidenceDirection.SUPPORTS
            elif contradiction_count > support_count:
                return EvidenceDirection.CONTRADICTS
        else:
            # Normal claim: "X is true" - support signals mean chunk says X is true
            if support_count > contradiction_count:
                return EvidenceDirection.SUPPORTS
            elif contradiction_count > support_count:
                return EvidenceDirection.CONTRADICTS

        # Check keyword overlap direction
        claim_keywords = set(re.findall(r'\b\w+\b', claim_lower))
        chunk_keywords = set(re.findall(r'\b\w+\b', chunk_lower))
        overlap = len(claim_keywords & chunk_keywords)

        if overlap > 3:
            return EvidenceDirection.CONTEXTUAL

        return EvidenceDirection.UNCLEAR