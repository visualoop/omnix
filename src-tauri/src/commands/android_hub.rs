use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::net::IpAddr;
use std::time::Duration;

const MAX_HUB_RESPONSE_BYTES: u64 = 512 * 1024;
const HUB_STORAGE_ACCOUNT: &str = "android-installation";
const HUB_STORAGE_NAME: &str = "branch-hub";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AndroidHubRequest {
    pub base_url: String,
    pub method: String,
    pub path: String,
    pub bearer_token: Option<String>,
    pub body: Option<Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AndroidHubResponse {
    pub status: u16,
    pub body: Value,
}

fn private_address(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(ip) => ip.is_private() || ip.is_loopback() || ip.is_link_local(),
        IpAddr::V6(ip) => ip.is_loopback() || ip.is_unique_local() || ip.is_unicast_link_local(),
    }
}

fn allowed_route(method: &str, path: &str) -> bool {
    match (method, path) {
        ("GET", "/api/health") => true,
        ("POST", "/api/auth/pair") => true,
        ("POST", "/api/v1/auth/branch-local-login") => true,
        ("POST", "/api/v1/commands/sales/complete") => true,
        ("POST", "/api/v1/commands/inventory/branch-item") => true,
        ("POST", "/api/v1/commands/customers/branch-customer") => true,
        ("POST", "/api/v1/commands/purchasing/purchase-order") => true,
        ("POST", "/api/v1/commands/inventory/stock-movement") => true,
        ("POST", "/api/v1/commands/inventory/reorder-level") => true,
        ("POST", "/api/v1/reads/android/inventory") => true,
        ("POST", "/api/v1/reads/android/open-purchases") => true,
        ("POST", "/api/v1/reads/till/recent-sales") => true,
        ("POST", "/api/v1/reads/till/current-shift") => true,
        ("POST", "/api/v1/reads/inventory/reorder-alerts") => true,
        _ => false,
    }
}

async fn checked_url(input: &AndroidHubRequest) -> Result<reqwest::Url, String> {
    let method = input.method.to_ascii_uppercase();
    if !allowed_route(&method, &input.path) {
        return Err("The requested branch-hub operation is not allowlisted".to_string());
    }
    let mut base = reqwest::Url::parse(input.base_url.trim())
        .map_err(|_| "Enter a valid branch-hub address".to_string())?;
    if !matches!(base.scheme(), "http" | "https")
        || base.host_str().is_none()
        || !base.username().is_empty()
        || base.password().is_some()
        || base.query().is_some()
        || base.fragment().is_some()
        || !matches!(base.path(), "" | "/")
    {
        return Err("Enter only the branch-hub host and port".to_string());
    }

    let host = base.host_str().unwrap().to_string();
    let port = base
        .port_or_known_default()
        .ok_or_else(|| "The branch-hub port is missing".to_string())?;
    let addresses: Vec<IpAddr> = tokio::net::lookup_host((host.as_str(), port))
        .await
        .map_err(|_| "The branch-hub host could not be found on this network".to_string())?
        .map(|address| address.ip())
        .collect();
    if addresses.is_empty() || addresses.iter().any(|address| !private_address(*address)) {
        return Err("Branch hubs must use a private LAN or Private Mesh address".to_string());
    }

    base.set_path(&input.path);
    Ok(base)
}

#[tauri::command]
pub async fn android_hub_request(request: AndroidHubRequest) -> Result<AndroidHubResponse, String> {
    let method = request.method.to_ascii_uppercase();
    let url = checked_url(&request).await?;
    if request.bearer_token.as_deref().is_some_and(|token| {
        token.len() < 32 || token.len() > 512 || token.chars().any(char::is_whitespace)
    }) {
        return Err("The branch-hub session is invalid".to_string());
    }

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(4))
        .timeout(Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "The branch-hub connection could not be prepared".to_string())?;
    let mut outgoing = match method.as_str() {
        "GET" => client.get(url),
        "POST" => client.post(url),
        _ => return Err("The branch-hub method is not allowlisted".to_string()),
    };
    if let Some(token) = &request.bearer_token {
        outgoing = outgoing.bearer_auth(token);
    }
    if let Some(body) = &request.body {
        outgoing = outgoing.json(body);
    }
    let response = outgoing
        .send()
        .await
        .map_err(|_| "The branch hub did not respond. Check Wi-Fi, the address, and that Omnix is open on the hub.".to_string())?;
    if response
        .content_length()
        .is_some_and(|length| length > MAX_HUB_RESPONSE_BYTES)
    {
        return Err("The branch hub returned too much data".to_string());
    }
    let status = response.status().as_u16();
    let bytes = response
        .bytes()
        .await
        .map_err(|_| "The branch-hub response could not be read".to_string())?;
    if bytes.len() as u64 > MAX_HUB_RESPONSE_BYTES {
        return Err("The branch hub returned too much data".to_string());
    }
    let body = if bytes.is_empty() {
        Value::Object(Default::default())
    } else {
        serde_json::from_slice(&bytes)
            .map_err(|_| "The branch hub returned an invalid response".to_string())?
    };
    Ok(AndroidHubResponse { status, body })
}

fn hub_storage_payload(value: Option<String>) -> Value {
    let mut payload = serde_json::json!({
        "key": {
            "namespace": "device",
            "accountId": HUB_STORAGE_ACCOUNT,
            "name": HUB_STORAGE_NAME
        }
    });
    if let Some(value) = value {
        payload["value"] = Value::String(value);
    }
    payload
}

#[cfg(target_os = "android")]
#[tauri::command]
pub fn android_hub_config_get<R: tauri::Runtime>(
    _app: tauri::AppHandle<R>,
    state: tauri::State<'_, crate::mobile::AndroidMobile<R>>,
) -> Result<Option<String>, String> {
    let result = crate::mobile::run_mobile(state, "secureStorageGet", hub_storage_payload(None))?;
    Ok(result
        .get("value")
        .and_then(Value::as_str)
        .map(str::to_string))
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub fn android_hub_config_get() -> Result<Option<String>, String> {
    Err("Android hub storage is available only on Android".to_string())
}

#[cfg(target_os = "android")]
#[tauri::command]
pub fn android_hub_config_set<R: tauri::Runtime>(
    _app: tauri::AppHandle<R>,
    state: tauri::State<'_, crate::mobile::AndroidMobile<R>>,
    value: String,
) -> Result<(), String> {
    if value.is_empty() || value.len() > 65_536 || serde_json::from_str::<Value>(&value).is_err() {
        return Err("Android hub configuration is invalid".to_string());
    }
    crate::mobile::run_mobile(state, "secureStorageSet", hub_storage_payload(Some(value)))?;
    Ok(())
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub fn android_hub_config_set(_value: String) -> Result<(), String> {
    Err("Android hub storage is available only on Android".to_string())
}

#[cfg(target_os = "android")]
#[tauri::command]
pub fn android_hub_config_clear<R: tauri::Runtime>(
    _app: tauri::AppHandle<R>,
    state: tauri::State<'_, crate::mobile::AndroidMobile<R>>,
) -> Result<(), String> {
    crate::mobile::run_mobile(state, "secureStorageRemove", hub_storage_payload(None))?;
    Ok(())
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub fn android_hub_config_clear() -> Result<(), String> {
    Err("Android hub storage is available only on Android".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_allowlisted_typed_routes_are_exposed() {
        assert!(allowed_route("GET", "/api/health"));
        assert!(allowed_route("POST", "/api/auth/pair"));
        assert!(allowed_route("POST", "/api/v1/reads/android/inventory"));
        assert!(!allowed_route("POST", "/api/db/query"));
        assert!(!allowed_route("POST", "/api/db/execute"));
        assert!(!allowed_route("GET", "https://example.com"));
    }

    #[test]
    fn public_addresses_are_not_hub_addresses() {
        assert!(private_address("192.168.1.20".parse().unwrap()));
        assert!(private_address("10.10.0.4".parse().unwrap()));
        // The reviewed Omnix mesh pool is RFC1918, so it remains reachable without
        // widening this transport to arbitrary internet destinations.
        assert!(private_address("10.87.42.1".parse().unwrap()));
        assert!(!private_address("8.8.8.8".parse().unwrap()));
        assert!(!private_address("1.1.1.1".parse().unwrap()));
    }
}
