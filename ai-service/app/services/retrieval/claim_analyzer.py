"""
Claim Analysis - Phase 9
Extract structured information from claims for better query generation.
"""
import re
from datetime import datetime
from typing import Optional
from app.schemas.evidence import ClaimAnalysis


class ClaimAnalyzer:
    """Analyze claims to extract structured information."""

    # Patterns for extraction
    PERCENTAGE_PATTERN = re.compile(r'\b\d+(?:\.\d+)?\s*%')
    NUMBER_PATTERN = re.compile(r'\b\d+(?:,\d{3})*(?:\.\d+)?\b')
    DATE_PATTERN = re.compile(
        r'\b(?:19|20)\d{2}\b|'  # Years 1900-2099
        r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b|'
        r'\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b|'
        r'\b(?:yesterday|today|tomorrow|last\s+\w+|this\s+\w+|next\s+\w+)\b',
        re.IGNORECASE
    )
    URL_PATTERN = re.compile(r'https?://\S+')

    def __init__(self):
        # Common entity patterns
        self.org_patterns = [
            r'\b(?:WHO|CDC|FDA|NIH|UN|EU|NATO|IMF|World Bank|WTO)\b',
            r'\b(?:University|Institute|College)\s+of\s+\w+',
            r'\b\w+\s+(?:University|Institute|Hospital|Clinic|Foundation|Corporation|Inc|Ltd|LLC)\b',
        ]
        self.location_patterns = [
            r'\b(?:in|from|at|to|near|around)\s+(?:India|China|USA|US|UK|Europe|Africa|Asia|Australia|Japan|Germany|France|Brazil|Russia|Canada|Mexico)\b',
        ]
        self.person_patterns = [
            r'\b(?:Dr|Prof|Professor|Mr|Ms|Mrs)\.\s+\w+(?:\s+\w+)?',
        ]

    def analyze(self, claim: str) -> ClaimAnalysis:
        """Analyze a claim and extract structured information."""
        claim_clean = self._clean_claim(claim)

        return ClaimAnalysis(
            entities=self._extract_entities(claim_clean),
            numbers=self._extract_numbers(claim_clean),
            dates=self._extract_dates(claim_clean),
            locations=self._extract_locations(claim_clean),
            organizations=self._extract_organizations(claim_clean),
            people=self._extract_people(claim_clean),
            main_predicate=self._extract_main_predicate(claim_clean),
            claim_subject=self._extract_subject(claim_clean),
            claim_object=self._extract_object(claim_clean),
            temporal_expressions=self._extract_temporal(claim_clean),
            claim_type=self._classify_claim_type(claim_clean),
        )

    def _clean_claim(self, claim: str) -> str:
        """Clean claim text for analysis."""
        # Remove URLs
        claim = self.URL_PATTERN.sub('', claim)
        # Normalize whitespace
        claim = re.sub(r'\s+', ' ', claim)
        return claim.strip()

    def _extract_entities(self, claim: str) -> list[str]:
        """Extract general entities (organizations, locations, people)."""
        entities = set()

        # Extract organizations
        for pattern in self.org_patterns:
            matches = re.findall(pattern, claim, re.IGNORECASE)
            entities.update(m.lower() for m in matches)

        # Extract locations
        for pattern in self.location_patterns:
            matches = re.findall(pattern, claim, re.IGNORECASE)
            for m in matches:
                # Extract just the location part
                loc = re.search(r'(?:in|from|at|to|near|around)\s+(\w+)', m, re.IGNORECASE)
                if loc:
                    entities.add(loc.group(1).lower())

        # Extract people
        for pattern in self.person_patterns:
            matches = re.findall(pattern, claim, re.IGNORECASE)
            entities.update(m.lower() for m in matches)

        return list(entities)

    def _extract_numbers(self, claim: str) -> list[str]:
        """Extract numbers and percentages."""
        numbers = []

        # Percentages first (more specific)
        percentages = self.PERCENTAGE_PATTERN.findall(claim)
        numbers.extend(percentages)

        # Other numbers
        other_numbers = self.NUMBER_PATTERN.findall(claim)
        # Filter out years (4 digits starting with 19 or 20)
        for num in other_numbers:
            clean = num.replace(',', '')
            if not (clean.isdigit() and len(clean) == 4 and clean.startswith(('19', '20'))):
                numbers.append(clean)

        return list(set(numbers))

    def _extract_dates(self, claim: str) -> list[str]:
        """Extract dates and temporal references."""
        dates = []
        matches = self.DATE_PATTERN.findall(claim)
        for match in matches:
            dates.append(match.strip())
        return list(set(dates))

    def _extract_locations(self, claim: str) -> list[str]:
        """Extract location entities."""
        locations = []
        for pattern in self.location_patterns:
            matches = re.findall(pattern, claim, re.IGNORECASE)
            for m in matches:
                loc = re.search(r'(?:in|from|at|to|near|around)\s+(\w+)', m, re.IGNORECASE)
                if loc:
                    locations.append(loc.group(1))
        return list(set(locations))

    def _extract_organizations(self, claim: str) -> list[str]:
        """Extract organization entities."""
        orgs = []
        for pattern in self.org_patterns:
            matches = re.findall(pattern, claim, re.IGNORECASE)
            orgs.extend(matches)
        return list(set(orgs))

    def _extract_people(self, claim: str) -> list[str]:
        """Extract person entities."""
        people = []
        for pattern in self.person_patterns:
            matches = re.findall(pattern, claim, re.IGNORECASE)
            people.extend(matches)
        return list(set(people))

    def _extract_main_predicate(self, claim: str) -> Optional[str]:
        """Extract the main verb/predicate of the claim."""
        # Common claim verbs
        predicates = [
            r'\b(?:causes?|caused|cause)\b',
            r'\b(?:prevents?|prevented|prevent)\b',
            r'\b(?:cures?|cured|cure)\b',
            r'\b(?:treats?|treated|treat)\b',
            r'\b(?:proves?|proved|proven|prove)\b',
            r'\b(?:shows?|showed|shown|show)\b',
            r'\b(?:found|find|finds)\b',
            r'\b(?:reported|reports?|report)\b',
            r'\b(?:claimed|claims?|claim)\b',
            r'\b(?:said|say|says)\b',
            r'\b(?:announced|announces?|announce)\b',
            r'\b(?:confirmed|confirms?|confirm)\b',
            r'\b(?:denied|denies?|deny)\b',
            r'\b(?:increased?|increase|decreased?|decrease)\b',
            r'\b(?:wins?|won|win)\b',
            r'\b(?:lost|lose|loses)\b',
        ]

        for pred in predicates:
            match = re.search(pred, claim, re.IGNORECASE)
            if match:
                return match.group(0).lower()

        # Fallback: first verb-like word
        verb_match = re.search(r'\b(?:is|are|was|were|has|have|had|will|would|could|should|may|might)\s+\w+', claim, re.IGNORECASE)
        if verb_match:
            return verb_match.group(0).lower()

        return None

    def _extract_subject(self, claim: str) -> Optional[str]:
        """Extract the subject of the claim."""
        # Simple heuristic: text before main predicate
        predicate = self._extract_main_predicate(claim)
        if predicate:
            idx = claim.lower().find(predicate)
            if idx > 0:
                subject = claim[:idx].strip()
                # Remove leading articles
                subject = re.sub(r'^(?:the|a|an)\s+', '', subject, flags=re.IGNORECASE)
                if subject:
                    return subject

        # Fallback: first noun phrase
        noun_match = re.search(r'^(?:the|a|an)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)', claim)
        if noun_match:
            return noun_match.group(1)

        return None

    def _extract_object(self, claim: str) -> Optional[str]:
        """Extract the object of the claim."""
        predicate = self._extract_main_predicate(claim)
        if predicate:
            idx = claim.lower().find(predicate)
            if idx >= 0:
                obj = claim[idx + len(predicate):].strip()
                obj = re.sub(r'^(?:that|about|of)\s+', '', obj, flags=re.IGNORECASE)
                if obj:
                    return obj

        return None

    def _extract_temporal(self, claim: str) -> list[str]:
        """Extract temporal expressions."""
        temporal = []
        temporal_patterns = [
            r'\b(?:by|before|after|since|until)\s+\d{4}\b',
            r'\b(?:in|during)\s+(?:19|20)\d{2}\b',
            r'\b(?:last|this|next)\s+(?:week|month|year|quarter)\b',
            r'\b(?:yesterday|today|tomorrow)\b',
            r'\b(?:recently|currently|now)\b',
        ]
        for pattern in temporal_patterns:
            matches = re.findall(pattern, claim, re.IGNORECASE)
            temporal.extend(matches)
        return list(set(temporal))

    def _classify_claim_type(self, claim: str) -> Optional[str]:
        """Classify the type of claim for retrieval strategy."""
        claim_lower = claim.lower()

        # Health/medical
        if any(kw in claim_lower for kw in [
            'cancer', 'vaccine', 'virus', 'disease', 'health', 'medical', 'treatment',
            'cure', 'prevent', 'symptom', 'diagnosis', 'hospital', 'doctor', 'patient',
            'covid', 'coronavirus', 'pandemic', 'epidemic', 'immunity', 'antibody',
            'diabetes', 'heart', 'blood', 'drug', 'medicine', 'therapy', 'clinical'
        ]):
            return "HEALTH"

        # Scientific
        if any(kw in claim_lower for kw in [
            'study', 'research', 'scientist', 'experiment', 'peer review', 'journal',
            'publication', 'nature', 'science', 'discovered', 'hypothesis', 'theory',
            'systematic review', 'meta-analysis', 'clinical trial'
        ]):
            return "SCIENTIFIC"

        # Statistical
        if any(kw in claim_lower for kw in [
            'percent', '%', 'statistic', 'data', 'survey', 'poll', 'census',
            'average', 'mean', 'median', 'correlation', 'significant', 'p-value'
        ]):
            return "STATISTICAL"

        # Financial
        if any(kw in claim_lower for kw in [
            'stock', 'market', 'share', 'investment', 'revenue', 'profit', 'loss',
            'billion', 'million', 'trillion', 'bank', 'economy', 'gdp', 'inflation',
            'interest rate', 'currency', 'dollar', 'euro', 'crypto', 'bitcoin'
        ]):
            return "FINANCIAL"

        # Political
        if any(kw in claim_lower for kw in [
            'election', 'vote', 'candidate', 'president', 'prime minister', 'parliament',
            'congress', 'senate', 'bill', 'law', 'legislation', 'policy', 'government',
            'minister', 'official', 'party', 'campaign'
        ]):
            return "POLITICAL"

        # Legal
        if any(kw in claim_lower for kw in [
            'court', 'judge', 'lawyer', 'lawsuit', 'legal', 'ruling', 'verdict',
            'settlement', 'plaintiff', 'defendant', 'appeal', 'supreme court',
            'constitution', 'amendment', 'rights'
        ]):
            return "LEGAL"

        # Technology
        if any(kw in claim_lower for kw in [
            'ai', 'artificial intelligence', 'machine learning', 'algorithm',
            'software', 'app', 'platform', 'startup', 'tech', 'technology',
            'digital', 'cyber', 'data', 'privacy', 'encryption', 'blockchain'
        ]):
            return "TECHNOLOGY"

        # Current event indicators
        if any(kw in claim_lower for kw in [
            'today', 'yesterday', 'this week', 'breaking', 'just in', 'latest',
            'update', 'developing', 'live'
        ]):
            return "CURRENT_EVENT"

        # Historical
        if any(kw in claim_lower for kw in [
            'history', 'historical', 'ancient', 'century', 'war', 'battle',
            'empire', 'civilization', 'archaeology', 'fossil', 'artifact'
        ]):
            return "HISTORICAL"

        return "GENERAL"