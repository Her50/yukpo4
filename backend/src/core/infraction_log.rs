use lazy_static::lazy_static;
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone)]
pub struct Infraction {
    pub ip: String,
    pub endpoint: String,
    pub timestamp: i64,
}

lazy_static! {
    static ref LOGS: Mutex<Vec<Infraction>> = Mutex::new(Vec::new());
    static ref COUNTS: Mutex<HashMap<String, u32>> = Mutex::new(HashMap::new());
}

/// ?? Enregistre une infraction d?acc?s suspect?
pub fn log_infraction(ip: &str, endpoint: &str) {
    let now = chrono::Utc::now().timestamp();
    let entry = Infraction {
        ip: ip.to_string(),
        endpoint: endpoint.to_string(),
        timestamp: now,
    };
    LOGS.lock().unwrap().push(entry);

    let mut map = COUNTS.lock().unwrap();
    let count = map.entry(ip.to_string()).or_insert(0);
    *count += 1;
}

/// ? D?termine la dur?e de blocage en fonction du nombre d?infractions
pub fn should_block(ip: &str) -> Option<u64> {
    let map = COUNTS.lock().unwrap();
    if let Some(count) = map.get(ip) {
        if *count >= 5 {
            Some(3600 * 24) // 24h
        } else if *count >= 3 {
            Some(3600) // 1h
        } else if *count >= 1 {
            Some(300) // 5 minutes
        } else {
            None
        }
    } else {
        None
    }
}
