# Phase 9 — Admin Dashboard

## Goals
- Full system configuration UI
- User and device management
- Business analytics and reports
- Accessible both in-app and via LAN browser

## Architecture

The admin dashboard is:
1. **Embedded in the desktop app** — accessible at sidebar → Admin
2. **Served via LAN HTTP** — any browser on the network can access `http://server-ip:7890/admin`

The LAN-served version uses the same React components, served as static files from the embedded HTTP server.

## Tasks

### 9.1 Admin Sections

**Business Settings**
- Business profile (name, address, logo, contact)
- Receipt configuration (header, footer, template)
- Tax settings (VAT rate, tax ID)
- Printer setup (select printer, test print)

**User Management**
- Create/edit/deactivate users
- Assign roles (Owner, Manager, Cashier, Viewer)
- Reset passwords/PINs
- View user activity log

**Device Management**
- View all registered devices
- Approve/reject pending devices
- Set device permissions (which modules accessible)
- Remote wipe device authorization
- View sync status per device

**Inventory Settings**
- Categories management
- Price lists management
- Units of measure
- Reorder level defaults
- Expiry alert windows

**Payments Configuration**
- Paystack API keys
- Payment methods toggle (enable/disable)
- Till number for manual M-Pesa

**Backup & Data**
- Manual backup trigger (exports encrypted SQLite)
- Backup schedule (daily auto-backup to specified folder)
- Data export (full CSV export for migration)
- Audit log viewer

**License**
- View current license details
- Device count usage
- Activation status
- Update license key

### 9.2 Admin-Only Access Control
- Only Owner and Manager roles can access admin
- Owner-only: user management, license, device management
- Manager: inventory settings, backup, reports

### 9.3 LAN Browser Access
- Served at `/admin` on the LAN HTTP server
- Login required (same credentials as desktop app)
- Responsive design (works on tablet/phone browser)
- Read-heavy: reports and monitoring from any device
- Write access: only for authorized roles

## Done When
- All admin sections accessible and functional
- Role-based access enforced
- LAN browser access works from another device
- Backup creates valid encrypted export
- Audit log captures all sensitive actions
- Device management reflects real connected devices
