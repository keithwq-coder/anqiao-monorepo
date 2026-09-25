# Module: Lead Scoring Algorithm - MEDDIC Implementation

**Version**: v1.0.0  
**Target Model**: GLM-5.1 (Zhipu AI)  
**Author**: AI Assistant  
**Last Updated**: 2026-07-25  

---

## 1. Purpose and Scope

**Purpose**: Calculate lead opportunity score using simplified MEDDIC model  
**Input**: List of raw signals from data collection module  
**Output**: Opportunity score (0-100), grade (S/A/B/C/D), win probability (0-1)  

**Constraints**:
- Must handle None/null inputs gracefully
- Must return deterministic results for same inputs
- Maximum execution time: 50ms per lead
- No external API calls allowed (use cached data only)
- Python 3.11+ type hints required

---

## 2. Constants and Configuration

```python
from enum import Enum
from typing import List, Dict, Optional, NamedTuple
from datetime import datetime

class LeadGrade(Enum):
    """Lead grading classification."""
    S = "S"  # Critical (>=90 points)
    A = "A"  # High (>=75 points)
    B = "B"  # Medium (>=60 points)
    C = "C"  # Low (>=40 points)
    D = "D"  # Minimal (<40 points)

class SignalType(Enum):
    """Signal source types with trust levels."""
    TENDER = "tender"              # Government tenders (most trusted)
    RECRUITMENT = "recruitment"    # Job postings
    NEWS = "news"                  # News sentiment analysis
    INTERNAL_CRM = "internal_crm"  # Internal customer data
    
    def get_trust_level(self) -> float:
        """Return confidence weight for this signal type."""
        return {
            SignalType.TENDER: 1.0,      # Highest trust
            SignalType.RECRUITMENT: 0.9,
            SignalType.INTERNAL_CRM: 0.8,
            SignalType.NEWS: 0.7,        # Lowest trust (need verification)
        }.get(self, 0.5)  # Default fallback

class MEDDICDimensions(Enum):
    """MEDDIC evaluation dimensions."""
    METRICS = "metrics_score"           # Need: Demand clarity
    ECONOMIC_BUYER = "economic_buyer_score"  # Budget availability
    DECISION_CRITERIA = "decision_criteria_score"  # Decision process clarity
    DECISION_PROCESS = "decision_process_score"    # Time urgency
    IDENTIFY_PAIN = "identify_pain_score"         # Pain intensity
    CHAMPION = "champion_score"           # Internal advocate presence

# Validation bounds
MAX_SCORE_DIMENSIONS = 6
MAX_SCORE_PER_DIMENSION = 5
MIN_SCORE = 0
MAX_TOTAL_RAW_SCORE = MAX_SCORE_DIMENSIONS * MAX_SCORE_PER_DIMENSION  # 30 points max
SCORE_NORMALIZATION_FACTOR = 100.0 / MAX_TOTAL_RAW_SCORE  # Convert to percentage
```

---

## 3. Core Algorithms

### 3.1 Score Normalization

```python
def normalize_score(raw_score: int) -> float:
    """
    Convert raw MEDDIC score (0-30) to normalized percentage (0-100).
    
    Parameters:
        raw_score: Integer between 0 and 30 (inclusive)
        
    Returns:
        Float between 0.0 and 100.0 representing percentage
        
    Raises:
        ValueError: If raw_score outside valid range [0, 30]
        
    Examples:
        >>> normalize_score(0)
        0.0
        >>> normalize_score(15)
        50.0
        >>> normalize_score(30)
        100.0
    """
    if raw_score < MIN_SCORE or raw_score > MAX_TOTAL_RAW_SCORE:
        raise ValueError(f"Raw score must be between {MIN_SCORE} and {MAX_TOTAL_RAW_SCORE}, got {raw_score}")
    
    normalized = round(raw_score * SCORE_NORMALIZATION_FACTOR, 2)
    return min(100.0, max(0.0, normalized))
```

### 3.2 Grade Assignment

```python
def assign_grade(normalized_score: float) -> LeadGrade:
    """
    Map normalized score to letter grade based on thresholds.
    
    Thresholds:
        >= 90  → Grade S (Critical priority)
        >= 75  → Grade A (High priority)
        >= 60  → Grade B (Medium priority)
        >= 40  → Grade C (Low priority)
        <  40  → Grade D (Minimal priority)
        
    Parameters:
        normalized_score: Float between 0.0 and 100.0
        
    Returns:
        LeadGrade enum value
        
    Edge Cases:
        - Boundary values handled with >= comparison
        - Scores exactly at threshold go to higher grade
    """
    if normalized_score < 0 or normalized_score > 100:
        raise ValueError(f"Normalized score must be between 0 and 100, got {normalized_score}")
    
    if normalized_score >= 90.0:
        return LeadGrade.S
    elif normalized_score >= 75.0:
        return LeadGrade.A
    elif normalized_score >= 60.0:
        return LeadGrade.B
    elif normalized_score >= 40.0:
        return LeadGrade.C
    else:
        return LeadGrade.D
```

### 3.3 Tender Signal Processing

```python
def extract_keywords(content: str, min_length: int = 3) -> List[str]:
    """
    Extract meaningful keywords from Chinese text.
    
    Strategy: Remove common stopwords and extract technical terms.
    
    Parameters:
        content: Source text string
        min_length: Minimum word length to include
        
    Returns:
        List of unique keywords in original order
        
    Example:
        >>> extract_keywords("需要采购防火墙、入侵检测系统")
        ['防火墙', '入侵检测系统']
    """
    if not content or not isinstance(content, str):
        return []
    
    stop_words = {"需要", "采购", "服务", "提供", "并", "等"}
    keywords = set()
    
    import re
    words = re.split(r'[,\n\t]+', content)
    
    for word in words:
        word = word.strip()
        if len(word) >= min_length and word not in stop_words and word not in keywords:
            keywords.add(word)
            
    return list(keywords)

def process_tender_signal(signal: Dict) -> tuple:
    """
    Analyze tender signal and calculate score increments.
    
    Business Rules:
    1. Budget scoring:
       - budget_max > 1,000,000 → +2 economic_buyer_score
       - budget_max > 5,000,000 → additional +1 economic_buyer_score
       
    2. Metrics scoring:
       - Detailed description (>5 keywords) → +2 metrics_score
       - Product categories mentioned ≥3 → +1 metrics_score
       
    3. Time urgency:
       - Deadline within 30 days → +2 decision_process_score
       - Deadline within 7 days → additional +1 decision_process_score
     
    Parameters:
        signal: Dictionary with tender signal fields
        
    Returns:
        Tuple of (metrics_increment, economic_buyer_increment, decision_process_increment)
        All values are integers in range [0, 3]
        
    Edge Cases Handled:
        - Missing budget fields → increment = 0
        - Empty description → no metrics increment
        - Invalid deadline format → no time bonus
        - None/Null values → safe handling
    """
    import logging
    logger = logging.getLogger(__name__)
    
    metrics_inc = 0
    economic_inc = 0
    process_inc = 0
    
    try:
        budget_max = signal.get('budget_max')
        if budget_max is None or not isinstance(budget_max, (int, float)):
            logger.warning(f"Missing budget_max in tender {signal.get('id')}")
            return 0, 0, 0
        
        if budget_max > 5_000_000:
            economic_inc = 3
        elif budget_max > 1_000_000:
            economic_inc = 2
        else:
            economic_inc = 1
        
        content_summary = signal.get('content_summary', '')
        if content_summary and isinstance(content_summary, str):
            keywords = extract_keywords(content_summary)
            
            if len(keywords) > 5:
                metrics_inc += 2
            
            product_categories = {'设备', '系统', '平台', '服务', '软件', '硬件'}
            category_count = sum(1 for kw in keywords if any(cat in kw for cat in product_categories))
            if category_count >= 3:
                metrics_inc += 1
        
        deadline_str = signal.get('deadline')
        if deadline_str:
            try:
                deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
                now = datetime.now(deadline.tzinfo)
                days_to_deadline = (deadline - now).days
                
                if 0 < days_to_deadline <= 7:
                    process_inc = 3
                elif days_to_deadline <= 30:
                    process_inc = 2
                elif days_to_deadline <= 60:
                    process_inc = 1
                    
            except (ValueError, TypeError):
                logger.warning(f"Invalid deadline format: {deadline_str}")
                
    except Exception as e:
        logger.error(f"Tender signal processing failed: {str(e)}")
        return 0, 0, 0
    
    metrics_inc = min(3, metrics_inc)
    economic_inc = min(3, economic_inc)
    process_inc = min(3, process_inc)
    
    return metrics_inc, economic_inc, process_inc
```

---

## 4. Main Entry Point

```python
def calculate_opportunity_score(signals: List[Dict]) -> Dict:
    """
    Calculate lead opportunity score from raw signals.
    
    Primary Algorithm Steps:
    1. Validate input signals
    2. Sort signals by publication date (newest first)
    3. Aggregate scores by MEDDIC dimension
    4. Apply trust-level weighting per signal source
    5. Normalize final score to [0, 100] range
    6. Assign letter grade based on thresholds
    7. Calculate win probability
    
    Input Validation Rules:
        - signals must be a non-empty list
        - Each signal dict must have 'source_type' key
        - Missing optional fields → use default values (0 score)
        - Invalid field types → log warning and skip
    
    Processing Priority:
        1. Tender signals (highest trust)
        2. Recruitment signals (high trust)
        3. Internal CRM signals (medium trust)
        4. News signals (lowest trust, needs verification)
    
    Returns:
        Dictionary containing:
        {
            'opportunity_score': float (0-100),
            'grade': LeadGrade enum,
            'meddic_breakdown': dict with 6 dimension scores,
            'win_probability': float (0-1),
            'metadata': {
                'signal_count': int,
                'processed_by': str,
                'processing_timestamp': ISO datetime string
            }
        }
        
    Output Guarantees:
        - Always returns valid structure even on empty input
        - All numeric values within specified ranges
        - Grade always one of S/A/B/C/D
        - Win probability never exceeds score percentage
        
    Example Usage:
        >>> signals = [{
        ...     'source_type': 'tender',
        ...     'budget_max': 2000000,
        ...     'content_summary': '需要采购防火墙、入侵检测系统、安全审计平台',
        ...     'deadline': '2026-08-15T00:00:00'
        ... }]
        >>> result = calculate_opportunity_score(signals)
        >>> result['opportunity_score'] >= 50.0
        True
    """
    import logging
    logger = logging.getLogger(__name__)
    
    if not isinstance(signals, list):
        raise TypeError(f"Expected list, got {type(signals).__name__}")
    
    if len(signals) == 0:
        return _empty_lead_result()
    
    valid_signals = []
    for i, signal in enumerate(signals):
        if not isinstance(signal, dict):
            logger.warning(f"Signal {i} is not a dict, skipping")
            continue
            
        if 'source_type' not in signal:
            logger.warning(f"Signal {i} missing source_type, skipping")
            continue
            
        valid_signals.append(signal)
    
    if len(valid_signals) == 0:
        return _empty_lead_result()
    
    scores = {dim.value: 0 for dim in MEDDICDimensions}
    
    sorted_signals = sorted(
        valid_signals, 
        key=lambda s: s.get('publish_date', ''), 
        reverse=True
    )
    
    for signal in sorted_signals:
        source_type = signal.get('source_type')
        trust_level = SignalType(source_type).get_trust_level() if source_type else 0.5
        
        if source_type == 'tender':
            metrics_inc, economic_inc, process_inc = process_tender_signal(signal)
            scores[MEDDICDimensions.METRICS.value] += metrics_inc * trust_level
            scores[MEDDICDimensions.ECONOMIC_BUYER.value] += economic_inc * trust_level
            scores[MEDDICDimensions.DECISION_PROCESS.value] += process_inc * trust_level
            
        elif source_type == 'recruitment':
            pass
            
        elif source_type == 'news':
            pass
            
        elif source_type == 'internal_crm':
            pass
    
    final_scores = {k: min(5, max(0, int(round(v)))) for k, v in scores.items()}
    total_raw = sum(final_scores.values())
    normalized_score = normalize_score(total_raw)
    grade = assign_grade(normalized_score)
    win_prob = calculate_win_probability(final_scores, normalized_score)
    
    return {
        'opportunity_score': normalized_score,
        'grade': grade,
        'meddic_breakdown': final_scores,
        'win_probability': win_prob,
        'metadata': {
            'signal_count': len(valid_signals),
            'processed_by': 'GLM51_MEDDIC_V1',
            'processing_timestamp': datetime.utcnow().isoformat() + 'Z'
        }
    }

def _empty_lead_result() -> Dict:
    """Return default low-score result for empty/no-signal cases."""
    return {
        'opportunity_score': 0.0,
        'grade': LeadGrade.D,
        'meddic_breakdown': {dim.value: 0 for dim in MEDDICDimensions},
        'win_probability': 0.0,
        'metadata': {
            'signal_count': 0,
            'processed_by': 'GLM51_MEDDIC_V1',
            'processing_timestamp': datetime.utcnow().isoformat() + 'Z'
        }
    }

def calculate_win_probability(meddic_scores: Dict, normalized_score: float) -> float:
    """
    Calculate win probability based on MEDDIC breakdown and overall score.
    
    Formula (simplified Bayesian estimation):
        Win Prob = Base Rate × Score Factor × Confidence Multiplier
    
    Where:
        - Base Rate: Historical average win rate (default 0.15 = 15%)
        - Score Factor: Derived from normalized opportunity score
        - Confidence Multiplier: Based on MEDDIC dimension balance
    
    Parameters:
        meddic_scores: Dict with 6 MEDDIC dimension scores (0-5 each)
        normalized_score: Overall opportunity score (0-100)
        
    Returns:
        Float between 0.0 and 1.0 representing win probability
        
    Example:
        >>> meddic = {
        ...     'metrics_score': 5,
        ...     'economic_buyer_score': 4,
        ...     'decision_criteria_score': 3,
        ...     'decision_process_score': 4,
        ...     'identify_pain_score': 5,
        ...     'champion_score': 2
        ... }
        >>> calculate_win_probability(meddic, 73.33)
        0.45  # ~45% win probability
    """
    BASE_WIN_RATE = 0.15
    
    score_factor = 0.5 + (normalized_score / 100.0) * 2.5
    
    score_values = list(meddic_scores.values())
    score_std_dev = (max(score_values) - min(score_values)) / 5.0
    confidence_multiplier = max(0.8, 1.0 - score_std_dev * 0.2)
    
    win_prob = BASE_WIN_RATE * score_factor * confidence_multiplier
    
    return min(1.0, max(0.0, round(win_prob, 4)))
```

---

## 5. Integration Notes for GLM-5.1

### Implementation Requirements:
1. **Must preserve function signatures** - Do not change parameter names or return types
2. **Must include all docstrings** - Required for documentation generation
3. **Must add unit tests** - See test_meddic_scoring.py for template
4. **Must handle timezone-aware datetimes** - Use UTC internally
5. **Must log all warnings/errors** - Required for debugging and monitoring

### Common Pitfalls to Avoid:
❌ DO NOT simplify the error handling logic  
❌ DO NOT remove type annotations  
❌ DO NOT merge multiple functions together  
✅ DO add additional edge case tests  
✅ DO extend with your own helper functions  
✅ DO optimize performance if needed (keep <50ms)

### Testing Checklist:
- [ ] Empty list input → Returns D-grade with 0 score
- [ ] Single strong tender signal → Returns A/S grade
- [ ] Multiple weak signals → Aggregate score accurate
- [ ] Boundary conditions → Exact thresholds work correctly
- [ ] Invalid inputs → Graceful degradation, no crashes
- [ ] Timezone handling → UTC normalization works
- [ ] Performance → Under 50ms for typical input (<100 signals)