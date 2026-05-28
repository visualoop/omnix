//! Consent state persistence.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(thiserror::Error, Debug)]
pub enum ConsentError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsentState {
    pub telemetry_enabled: bool,
    pub consented_at: Option<String>,
    pub version: u32,
}

impl Default for ConsentState {
    fn default() -> Self {
        Self {
            telemetry_enabled: false, // Default OFF until user explicitly consents
            consented_at: None,
            version: 1,
        }
    }
}

impl ConsentState {
    fn consent_path() -> Result<PathBuf, ConsentError> {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| ConsentError::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Could not find config directory",
            )))?;

        let omnix_dir = config_dir.join("omnix");
        fs::create_dir_all(&omnix_dir)?;

        Ok(omnix_dir.join("consent.json"))
    }

    pub fn load() -> Result<Self, ConsentError> {
        let path = Self::consent_path()?;

        if !path.exists() {
            return Ok(Self::default());
        }

        let content = fs::read_to_string(path)?;
        let state: ConsentState = serde_json::from_str(&content)?;

        Ok(state)
    }

    pub fn save(&self) -> Result<(), ConsentError> {
        let path = Self::consent_path()?;
        let content = serde_json::to_string_pretty(self)?;
        fs::write(path, content)?;

        Ok(())
    }

    pub fn is_enabled(&self) -> bool {
        self.telemetry_enabled
    }

    pub fn set_enabled(&mut self, enabled: bool) {
        self.telemetry_enabled = enabled;
        if enabled && self.consented_at.is_none() {
            self.consented_at = Some(chrono::Utc::now().to_rfc3339());
        }
    }
}
