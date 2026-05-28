//! Event types and sanitization logic.
//!
//! Sanitization rules (per Plan 05 §2.3):
//! - Strip any string field longer than 256 chars
//! - Strip any field with > 5 numeric values
//! - Replace email/phone/national-ID regex matches with `<redacted>`
//! - Strip any field whose key matches PII denylist

use serde::{Deserialize, Serialize};
use serde_json::Value;
use chrono::{DateTime, Utc};
use regex::Regex;
use once_cell::sync::Lazy;

use crate::telemetry::Severity;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryEvent {
    pub event_type: String,
    pub severity: Severity,
    pub payload: Value,
    pub enqueued_at: DateTime<Utc>,
}

/// PII denylist — any key matching these patterns gets stripped.
static PII_KEYS: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(name|phone|email|kra|nhif|sha|password|token|key|secret|customer|patient|prescription|product|receipt|invoice|transaction_)").unwrap()
});

/// Email pattern
static EMAIL_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b").unwrap()
});

/// Phone pattern (KE format: +254... or 07...)
static PHONE_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(\+254|0)[17]\d{8}").unwrap()
});

/// National ID pattern (KE: 8 digits)
static NATIONAL_ID_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b\d{8}\b").unwrap()
});

/// Sanitize a JSON payload before queueing.
pub fn sanitize_payload(mut value: Value) -> Value {
    sanitize_value(&mut value);
    value
}

fn sanitize_value(value: &mut Value) {
    match value {
        Value::Object(map) => {
            let keys_to_remove: Vec<String> = map
                .keys()
                .filter(|k| PII_KEYS.is_match(k))
                .cloned()
                .collect();

            for key in keys_to_remove {
                map.remove(&key);
            }

            for (_, v) in map.iter_mut() {
                sanitize_value(v);
            }
        }
        Value::String(s) => {
            // Strip if too long
            if s.len() > 256 {
                *value = Value::String("<redacted:too_long>".to_string());
                return;
            }

            // Redact PII patterns
            if EMAIL_PATTERN.is_match(s) || PHONE_PATTERN.is_match(s) || NATIONAL_ID_PATTERN.is_match(s) {
                *value = Value::String("<redacted>".to_string());
            }
        }
        Value::Array(arr) => {
            // If array has > 5 numeric values, likely an ID list — strip it
            if arr.len() > 5 && arr.iter().all(|v| v.is_number()) {
                *value = Value::String("<redacted:id_list>".to_string());
                return;
            }

            for v in arr.iter_mut() {
                sanitize_value(v);
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_sanitize_pii_keys() {
        let input = json!({
            "type": "sale",
            "customer_name": "John Doe",
            "product_name": "Panadol",
            "amount": 120,
            "count": 5
        });

        let sanitized = sanitize_payload(input);
        assert!(sanitized.get("customer_name").is_none());
        assert!(sanitized.get("product_name").is_none());
        assert_eq!(sanitized.get("amount").unwrap(), &json!(120));
        assert_eq!(sanitized.get("count").unwrap(), &json!(5));
    }

    #[test]
    fn test_sanitize_email() {
        let input = json!({
            "message": "User john@example.com logged in"
        });

        let sanitized = sanitize_payload(input);
        assert_eq!(sanitized.get("message").unwrap(), "<redacted>");
    }

    #[test]
    fn test_sanitize_phone() {
        let input = json!({
            "contact": "+254712345678"
        });

        let sanitized = sanitize_payload(input);
        assert_eq!(sanitized.get("contact").unwrap(), "<redacted>");
    }

    #[test]
    fn test_sanitize_long_string() {
        let long_str = "a".repeat(300);
        let input = json!({
            "data": long_str
        });

        let sanitized = sanitize_payload(input);
        assert_eq!(sanitized.get("data").unwrap(), "<redacted:too_long>");
    }

    #[test]
    fn test_sanitize_id_list() {
        let input = json!({
            "ids": [1, 2, 3, 4, 5, 6, 7, 8]
        });

        let sanitized = sanitize_payload(input);
        assert_eq!(sanitized.get("ids").unwrap(), "<redacted:id_list>");
    }

    #[test]
    fn test_sanitize_nested() {
        let input = json!({
            "user": {
                "name": "Alice",
                "role": "admin",
                "email": "alice@example.com"
            },
            "count": 10
        });

        let sanitized = sanitize_payload(input);
        let user = sanitized.get("user").unwrap();
        assert!(user.get("name").is_none());
        assert_eq!(user.get("role").unwrap(), "admin");
        assert!(user.get("email").is_none());
        assert_eq!(sanitized.get("count").unwrap(), &json!(10));
    }
}
