// Dedicated SQLx query modules. HTTP/Tauri handlers call these functions and never embed SQL.
pub mod command_api;
pub mod network;
pub mod read_only_web;
pub mod sync;
