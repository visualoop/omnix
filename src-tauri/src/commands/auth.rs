use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};

/// Hash a password with Argon2id. Returns the PHC string format.
#[tauri::command]
pub fn hash_password(password: String) -> Result<String, String> {
    if password.is_empty() {
        return Err("Password cannot be empty".to_string());
    }
    if password.len() < 4 {
        return Err("Password too short (min 4 characters)".to_string());
    }
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| format!("Hash failed: {}", e))
}

/// Verify a password against a stored Argon2 PHC hash.
#[tauri::command]
pub fn verify_password(password: String, hash: String) -> Result<bool, String> {
    if password.is_empty() || hash.is_empty() {
        return Ok(false);
    }
    let parsed_hash = PasswordHash::new(&hash)
        .map_err(|e| format!("Invalid hash format: {}", e))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashes_and_verifies() {
        let hash = hash_password("hunter2".to_string()).unwrap();
        assert!(hash.starts_with("$argon2"));
        assert!(verify_password("hunter2".to_string(), hash.clone()).unwrap());
        assert!(!verify_password("wrong".to_string(), hash).unwrap());
    }

    #[test]
    fn rejects_empty_password() {
        assert!(hash_password("".to_string()).is_err());
        assert!(hash_password("abc".to_string()).is_err());
    }

    #[test]
    fn empty_inputs_to_verify_return_false() {
        assert_eq!(verify_password("".to_string(), "".to_string()).unwrap(), false);
    }

    #[test]
    fn rejects_invalid_hash_format() {
        assert!(verify_password("password".to_string(), "not-a-hash".to_string()).is_err());
    }
}
