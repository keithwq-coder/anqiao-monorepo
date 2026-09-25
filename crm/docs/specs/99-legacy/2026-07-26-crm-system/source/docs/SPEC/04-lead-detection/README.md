# AI Lead Detection Module - Specification Overview

**Version**: v1.1.0  
**Module Owner**: AI Assistant  
**Last Updated**: 2026-07-26  

---

## 📋 Module Summary

This module defines the lead detection pipeline used to convert raw market signals into ranked sales opportunities. It is intentionally constrained for zcode（GLM-5.1）: each file must remain self-contained, deterministic, and free from undocumented external dependencies.

### What It Does

1. Collects raw signals from supported source types
2. Analyzes signal quality by extracting keywords and validating dates
3. Calculates opportunity scores using a simplified MEDDIC framework
4. Ranks leads by grade and estimates win probability
5. Identifies gaps in sales readiness through missing factor analysis

### Design Rules

- One file, one responsibility
- No pseudo-code in implementation files
- Every algorithm must specify inputs, outputs, and edge cases explicitly
- SQL should be migration-safe and syntactically valid for PostgreSQL
- Output should remain compact, deterministic, and directly consumable by the model
- Avoid narrative filler, reader guidance, and non-essential descriptive text

---

## 🗂️ Directory Structure

```
04-lead-detection/
├── README.md                        ← This file (navigation hub)
├── algorithms/
│   └── 01-meddic-scoring.py         Complete MEDDIC scoring specification
├── schema/
│   └── 01-lead-signals.sql          PostgreSQL schema for signals and opportunities
├── subagents/
│   └── 00-subagents-overview.md     Subagent responsibilities and contracts
└── error-handling/
    └── 01-error-handling.md         Exception hierarchy and retry rules
```

---

## 🔑 Core Components Overview

### Component 1: MEDDIC Scoring Algorithm

**Purpose**: Convert raw business signals into quantified opportunity scores.

**Required behaviors**:
- Deterministic output for identical inputs
- Graceful handling of None and invalid fields
- Explicit boundary handling for all score thresholds
- Clear grade assignment and probability calculation rules

**Output Format**:
```python
{
    'opportunity_score': float,
    'grade': 'S' | 'A' | 'B' | 'C' | 'D',
    'meddic_breakdown': {
        'metrics_score': int,
        'economic_buyer_score': int,
        'decision_criteria_score': int,
        'decision_process_score': int,
        'identify_pain_score': int,
        'champion_score': int,
    },
    'win_probability': float,
}
```

---

### Component 2: Database Schema

**Purpose**: Store collected signals and calculated opportunity scores in PostgreSQL.

**Required behaviors**:
- Use PostgreSQL-compatible types only
- Declare any non-core extension dependencies explicitly
- Avoid migration constructs that depend on volatile expressions in index predicates
- Keep constraints aligned with algorithm output

---

### Component 3: Subagent Architecture

**Purpose**: Define three processing agents that work in pipeline fashion.

- Data Collection Agent: gathers raw signals
- Signal Analysis Agent: normalizes and validates inputs
- Opportunity Ranking Agent: computes scores and recommendations

Each agent should define its own input/output schema in the same file and should not depend on unresolved external type names.

---

### Component 4: Error Handling System

**Purpose**: Provide robust, traceable error management across all components.

**Required behaviors**:
- Stable exception naming and error codes
- Explicit retryability metadata
- Structured logging payloads
- Clear graceful degradation rules

---

## 🎯 How to Use These Specifications

### For AI Coding Assistants (zcode / GLM-5.1)

1. Read this module README first.
2. Open only one implementation file at a time.
3. Verify imports, function signatures, and edge-case handling before generating code.
4. Keep outputs deterministic and self-contained.

### Validation Checklist

- [ ] All examples are syntactically consistent
- [ ] No unresolved identifiers remain
- [ ] No conflicting statements about self-containment
- [ ] SQL and Python examples are executable or clearly labeled as illustrative
- [ ] Score thresholds and grade mapping agree across documents

---

## 🏷️ Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.0.0 | 2026-07-25 | AI Assistant | Initial specification release |
| v1.1.0 | 2026-07-26 | AI Assistant | Tightened self-contained guidance and consistency rules |

---

This specification is designed for **GLM-5.1 (Zhipu AI)** with explicit edge case coverage and production-oriented constraints.
