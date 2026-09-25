# Error Handling Specification - Lead Detection System

**Version**: v1.1.0  
**Target Model**: GLM-5.1 (Zhipu AI)  
**Author**: AI Assistant  
**Last Updated**: 2026-07-26  

> This specification is optimized for direct consumption by the target model: deterministic, explicit, and compact.

---

## Exception Hierarchy

```python
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable

logger = logging.getLogger(__name__)

class ErrorCategory(Enum):
    COLLECTION = "collection"
    ANALYSIS = "analysis"
    RANKING = "ranking"
    STORAGE = "storage"
    CONFIGURATION = "config"
    NETWORK = "network"

class ErrorSeverity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

@dataclass
class ErrorDetails:
    category: ErrorCategory
    severity: ErrorSeverity
    message: str
    context: dict[str, Any] = field(default_factory=dict)
    recovered: bool = False
    retryable: bool = True

    def to_log_entry(self) -> dict[str, Any]:
        return {
            "category": self.category.value,
            "severity": self.severity.value,
            "message": self.message,
            "context": self.context,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "recovered": self.recovered,
            "retryable": self.retryable,
        }

class LeadDetectionException(Exception):
    def __init__(self, message: str, details: ErrorDetails | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or ErrorDetails(
            category=ErrorCategory.ANALYSIS,
            severity=ErrorSeverity.MEDIUM,
            message=message,
        )

    def get_error_code(self) -> str:
        return f"LD_{self.details.category.value}_{type(self).__name__}"

    def should_alert(self) -> bool:
        return self.details.severity in {ErrorSeverity.CRITICAL, ErrorSeverity.HIGH}

    def log_and_raise(self) -> None:
        log_func = getattr(logger, self._log_level())
        log_func(self.message, extra={"error_details": self.details.to_log_entry()})
        raise self

    def _log_level(self) -> str:
        return {
            ErrorSeverity.CRITICAL: "critical",
            ErrorSeverity.HIGH: "error",
            ErrorSeverity.MEDIUM: "warning",
            ErrorSeverity.LOW: "info",
        }.get(self.details.severity, "warning")

class CollectionError(LeadDetectionException):
    pass

class SourceConnectionError(CollectionError):
    def __init__(self, source_name: str, cause: str):
        super().__init__(
            message=f"Cannot connect to {source_name}: {cause}",
            details=ErrorDetails(
                category=ErrorCategory.COLLECTION,
                severity=ErrorSeverity.HIGH,
                message=f"Source connection failed: {source_name} ({cause})",
                context={"source_name": source_name, "cause": cause},
                retryable=True,
            ),
        )

class RateLimitExceeded(CollectionError):
    def __init__(self, source_name: str, retry_after_seconds: int):
        super().__init__(
            message=f"Rate limit exceeded for {source_name}, retry after {retry_after_seconds}s",
            details=ErrorDetails(
                category=ErrorCategory.COLLECTION,
                severity=ErrorSeverity.MEDIUM,
                message=f"Rate limit on {source_name}",
                context={"source_name": source_name, "retry_after_seconds": retry_after_seconds},
                retryable=True,
            ),
        )

class ParseError(CollectionError):
    def __init__(self, source_name: str, parsing_issue: str):
        super().__init__(
            message=f"Parse error on {source_name}: {parsing_issue}",
            details=ErrorDetails(
                category=ErrorCategory.COLLECTION,
                severity=ErrorSeverity.MEDIUM,
                message=f"Parsing failed: {source_name}",
                context={"source_name": source_name, "issue": parsing_issue},
                retryable=False,
            ),
        )

class AnalysisError(LeadDetectionException):
    pass

class ValidationError(AnalysisError):
    def __init__(self, signal_id: str, missing_fields: list[str]):
        super().__init__(
            message=f"Validation failed for signal {signal_id}: {', '.join(missing_fields)}",
            details=ErrorDetails(
                category=ErrorCategory.ANALYSIS,
                severity=ErrorSeverity.LOW,
                message="Signal validation failure",
                context={"signal_id": signal_id, "missing_fields": missing_fields, "action": "skip_signal"},
                retryable=False,
            ),
        )

class DateParsingError(AnalysisError):
    def __init__(self, original_string: str, attempted_formats: list[str]):
        super().__init__(
            message=f"Date parsing failed for '{original_string}' using formats: {attempted_formats}",
            details=ErrorDetails(
                category=ErrorCategory.ANALYSIS,
                severity=ErrorSeverity.LOW,
                message="Date parsing failure",
                context={
                    "original_string": original_string,
                    "formats_attempted": attempted_formats,
                    "fallback_action": "use_current_timestamp",
                },
                retryable=False,
            ),
        )

class RankingError(LeadDetectionException):
    pass

class MEDDICCalculationError(RankingError):
    def __init__(self, meddic_input: dict[str, Any], reason: str):
        super().__init__(
            message=f"MEDDIC calculation failed: {reason}",
            details=ErrorDetails(
                category=ErrorCategory.RANKING,
                severity=ErrorSeverity.MEDIUM,
                message="MEDDIC scoring error",
                context={
                    "input_summary": {k: type(v).__name__ for k, v in meddic_input.items()},
                    "reason": reason,
                    "fallback_action": "return_default_d_grade",
                },
                retryable=False,
            ),
        )

class GradeThresholdError(RankingError):
    def __init__(self, score: float, current_thresholds: dict[str, float]):
        super().__init__(
            message=f"Invalid grade threshold at score {score}: {current_thresholds}",
            details=ErrorDetails(
                category=ErrorCategory.RANKING,
                severity=ErrorSeverity.HIGH,
                message="Grade threshold inconsistency detected",
                context={"score": score, "thresholds": current_thresholds, "fallback_action": "use_default_grades"},
                retryable=False,
            ),
        )

class StorageError(LeadDetectionException):
    pass

class DatabaseConnectionError(StorageError):
    def __init__(self, db_url: str, connection_cause: str):
        super().__init__(
            message=f"Cannot connect to database {db_url}: {connection_cause}",
            details=ErrorDetails(
                category=ErrorCategory.STORAGE,
                severity=ErrorSeverity.CRITICAL,
                message="Database connection failed",
                context={"db_url": db_url, "cause": connection_cause, "fallback_action": "enable_queue_mode"},
                retryable=True,
            ),
        )

class QueryExecutionError(StorageError):
    def __init__(self, query_type: str, table_name: str, error_message: str):
        super().__init__(
            message=f"Query execution failed on {table_name}: {error_message}",
            details=ErrorDetails(
                category=ErrorCategory.STORAGE,
                severity=ErrorSeverity.HIGH,
                message="Query execution error",
                context={"query_type": query_type, "table_name": table_name, "error": error_message, "fallback_action": "retry_with_backoff"},
                retryable=True,
            ),
        )

class ConfigurationError(LeadDetectionException):
    pass

class MissingConfigError(ConfigurationError):
    def __init__(self, config_key: str):
        super().__init__(
            message=f"Missing required configuration: {config_key}",
            details=ErrorDetails(
                category=ErrorCategory.CONFIGURATION,
                severity=ErrorSeverity.HIGH,
                message="Configuration key not found",
                context={"config_key": config_key, "fallback_action": "abort_initialization"},
                retryable=False,
            ),
        )

class InvalidConfigValueError(ConfigurationError):
    def __init__(self, config_key: str, value: Any, expected_range: str):
        super().__init__(
            message=f"Invalid config value for {config_key}: {value} (expected {expected_range})",
            details=ErrorDetails(
                category=ErrorCategory.CONFIGURATION,
                severity=ErrorSeverity.HIGH,
                message="Configuration value out of range",
                context={"config_key": config_key, "invalid_value": str(value), "expected_range": expected_range, "fallback_action": "use_default_value"},
                retryable=False,
            ),
        )

class NetworkError(LeadDetectionException):
    pass

class RequestTimeoutError(NetworkError):
    def __init__(self, endpoint: str, timeout_seconds: float):
        super().__init__(
            message=f"Request to {endpoint} timed out after {timeout_seconds}s",
            details=ErrorDetails(
                category=ErrorCategory.NETWORK,
                severity=ErrorSeverity.MEDIUM,
                message="Request timeout",
                context={"endpoint": endpoint, "timeout": timeout_seconds, "fallback_action": "return_cached_data_or_skip"},
                retryable=True,
            ),
        )

class SSLCertificateError(NetworkError):
    def __init__(self, url: str, certificate_error: str):
        super().__init__(
            message=f"SSL certificate verification failed for {url}: {certificate_error}",
            details=ErrorDetails(
                category=ErrorCategory.NETWORK,
                severity=ErrorSeverity.HIGH,
                message="SSL certificate invalid",
                context={"url": url, "error_detail": certificate_error, "fallback_action": "disable_ssl_verification_warning_only"},
                retryable=False,
            ),
        )
```

---

## Retry Policy Configuration

```python
from dataclasses import dataclass, field
from typing import Any, Callable

@dataclass
class RetryPolicy:
    max_retries: int
    base_delay_seconds: float
    max_delay_seconds: float = 300.0
    exponential_base: float = 2.0
    jitter: bool = True
    retryable_exceptions: list[type] = field(default_factory=list)

    def calculate_delay(self, attempt: int) -> float:
        import random
        raw_delay = self.base_delay_seconds * (self.exponential_base ** attempt)
        capped_delay = min(raw_delay, self.max_delay_seconds)
        return capped_delay * random.uniform(0.5, 1.5) if self.jitter else capped_delay

    def is_retryable(self, exception: Exception) -> bool:
        return hasattr(exception, "details") and bool(getattr(exception.details, "retryable", False))

DEFAULT_RETRY_POLICIES = {
    "web_scraping": RetryPolicy(
        max_retries=3,
        base_delay_seconds=5.0,
        retryable_exceptions=[ConnectionError, RequestTimeoutError],
    ),
    "database_query": RetryPolicy(
        max_retries=5,
        base_delay_seconds=2.0,
        max_delay_seconds=60.0,
        retryable_exceptions=[DatabaseConnectionError, QueryExecutionError],
    ),
    "api_request": RetryPolicy(
        max_retries=4,
        base_delay_seconds=10.0,
        max_delay_seconds=120.0,
        jitter=True,
        retryable_exceptions=[RateLimitExceeded, RequestTimeoutError],
    ),
}

def implement_retry_logic(operation_name: str, func: Callable[..., Any], args: tuple[Any, ...] | None = None, kwargs: dict[str, Any] | None = None) -> Any:
    policy = DEFAULT_RETRY_POLICIES.get(operation_name)
    if not policy:
        raise ValueError(f"No retry policy defined for: {operation_name}")

    try:
        from tenacity import retry, stop_after_attempt, wait_exponential_jitter, retry_if_exception_type
    except ImportError as exc:
        raise RuntimeError("tenacity is required for retry logic") from exc

    retryable_types = tuple(policy.retryable_exceptions)

    @retry(
        stop=stop_after_attempt(policy.max_retries),
        wait=wait_exponential_jitter(initial=policy.base_delay_seconds, max=policy.max_delay_seconds),
        retry=retry_if_exception_type(retryable_types),
        before_sleep=lambda retry_state: logger.warning(
            f"Retry attempt {retry_state.attempt_number} for {operation_name}: waiting {retry_state.next_action.sleep:.2f}s"
        ),
    )
    def wrapped_operation() -> Any:
        return func(*(args or ()), **(kwargs or {}))

    try:
        return wrapped_operation()
    except Exception as exc:
        logger.error(f"All retries exhausted for {operation_name}: {exc}")
        raise
```

---

## Graceful Degradation Strategy

| Component | Failure Mode | Degradation Action | Recovery Method |
|-----------|-------------|-------------------|-----------------|
| Collection Agent | ≥50% sources fail | Return partial results with warning flag | Continue with remaining sources |
| Analysis Agent | >80% signals rejected | Flag for manual review | Skip automated processing |
| Ranking Agent | MEDDIC computation error | Use last cached scores | Alert human operator |
| Database | Write fails | Queue locally to disk | Retry on connection restore |
| External APIs | Rate limit hit | Pause collection for 1 hour | Resume with exponential backoff |

---

## Testing Requirements for GLM-5.1

### Required Test Coverage

- Unit tests for each exception class
- Retry policy tests for delay calculation and retryability
- Integration tests for fallback behavior
- Edge case tests for nested failures and exhausted retries

### Sample Test Template

```python
import pytest
from unittest.mock import Mock, patch

class TestValidationError:
    def test_init_validates_required_fields(self):
        exc = ValidationError("test_signal_id", ["field1", "field2"])
        assert exc.message == "Validation failed for signal test_signal_id: field1, field2"
        assert exc.details.category == ErrorCategory.ANALYSIS
        assert exc.details.retryable is False
        assert exc.details.context["action"] == "skip_signal"

    def test_should_not_alert_on_low_severity(self):
        exc = ValidationError("test", ["missing"])
        assert exc.should_alert() is False

    def test_get_error_code_format(self):
        exc = ValidationError("sig_123", ["field_x"])
        assert exc.get_error_code().startswith("LD_analysis_ValidationError")

    @patch("logging.Logger.warning")
    def test_log_and_raises_correct_level(self, mock_warning):
        exc = ValidationError("sig_456", ["field_y"])
        with pytest.raises(ValidationError):
            exc.log_and_raise()
        mock_warning.assert_called_once()
```
```

---

## Implementation Checklist for GLM-5.1

- [ ] Define clear error hierarchy
- [ ] Implement `ErrorDetails` with structured metadata
- [ ] Add docstrings where implementation code is generated from this spec
- [ ] Define retry policies for each error type
- [ ] Create corresponding unit tests
- [ ] Document graceful degradation action
- [ ] Verify no silent failures
