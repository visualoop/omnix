# Phase 8 — LAN Multi-Device

## Goals
- One machine as server node, others as clients
- Real-time data sync across LAN
- Role-based access per device
- No internet required for LAN operations

## Architecture

```
┌──────────────────┐     LAN (HTTP + WebSocket)     ┌──────────────┐
│  Server Node     │◄──────────────────────────────►│ Client Node  │
│  (Primary PC)    │                                │ (Cashier PC) │
│                  │◄──────────────────────────────►│              │
│  - SQLite (main) │                                │ - SQLite     │
│  - HTTP server   │     ┌──────────────┐          │   (local     │
│  - WebSocket hub │◄───►│ Client Node  │          │    cache)    │
│  - Auth server   │     │ (Manager PC) │          │              │
└──────────────────┘     └──────────────┘          └──────────────┘
```

## Tasks

### 8.1 Embedded HTTP Server (Rust)
- Lightweight HTTP server inside Tauri (using `axum` or `warp`)
- Runs on configurable port (default: 7890)
- Only accessible on local network (bind to LAN IP, not 0.0.0.0)
- Serves REST API for client nodes
- WebSocket endpoint for real-time sync

### 8.2 Device Discovery
- Server broadcasts on LAN via mDNS/DNS-SD
- Clients auto-discover server on same network
- Manual IP entry as fallback
- Server displays connection URL + QR code for easy client setup

### 8.3 Client Node Behavior
- Client installs same Omnix application
- On first run: "Join existing business" option
- Connects to server, authenticates, receives license validation
- Maintains local SQLite cache for offline resilience
- Syncs back when connection restored

### 8.4 Sync Protocol
- Server is source of truth
- Changes pushed via WebSocket (real-time)
- Client operations:
  - **Reads:** from local cache (fast)
  - **Writes:** sent to server → server writes → broadcasts to all clients
- Conflict resolution: server timestamp wins
- Offline writes: queued locally, synced when reconnected

### 8.5 Device Management (Admin)
- Admin approves/rejects new device connections
- Set device role (which modules accessible)
- View connected devices and their status
- Revoke device access
- Device count enforced by license

### 8.6 What Syncs
- Products and stock levels
- Sales transactions
- Customer records
- User accounts (server manages auth)
- Settings

### 8.7 What Stays Local
- Session data
- UI preferences
- Cached images
- Pending offline queue

## Done When
- Server node starts HTTP/WebSocket server on LAN
- Client node discovers and connects to server
- New device requires admin approval
- Real-time sync: sale on client appears on server instantly
- Offline resilience: client works with stale data, syncs on reconnect
- Device limit enforced (license maxDevices)
- Admin can view/revoke connected devices
