/// Coordinator-owned adapters must mount exactly this allowlist. No wildcard command endpoint and
/// no generic SQL endpoint belongs in the typed router.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RouteSpec {
    pub method: &'static str,
    pub path: &'static str,
    pub mutation: bool,
    pub max_body_bytes: usize,
}

pub const TYPED_ROUTE_ALLOWLIST: &[RouteSpec] = &[
    RouteSpec {
        method: "POST",
        path: "/api/v1/auth/branch-local-login",
        mutation: false,
        max_body_bytes: 4 * 1024,
    },
    RouteSpec {
        method: "POST",
        path: "/api/v1/commands/sales/complete",
        mutation: true,
        max_body_bytes: 256 * 1024,
    },
    RouteSpec {
        method: "POST",
        path: "/api/v1/commands/inventory/branch-item",
        mutation: true,
        max_body_bytes: 16 * 1024,
    },
    RouteSpec {
        method: "POST",
        path: "/api/v1/commands/customers/branch-customer",
        mutation: true,
        max_body_bytes: 16 * 1024,
    },
    RouteSpec {
        method: "POST",
        path: "/api/v1/commands/purchasing/purchase-order",
        mutation: true,
        max_body_bytes: 256 * 1024,
    },
    RouteSpec {
        method: "POST",
        path: "/api/v1/commands/inventory/stock-movement",
        mutation: true,
        max_body_bytes: 16 * 1024,
    },
    RouteSpec {
        method: "POST",
        path: "/api/v1/commands/inventory/reorder-level",
        mutation: true,
        max_body_bytes: 8 * 1024,
    },
    RouteSpec {
        method: "POST",
        path: "/api/v1/reads/android/inventory",
        mutation: false,
        max_body_bytes: 8 * 1024,
    },
    RouteSpec {
        method: "POST",
        path: "/api/v1/reads/android/open-purchases",
        mutation: false,
        max_body_bytes: 8 * 1024,
    },
    RouteSpec {
        method: "POST",
        path: "/api/v1/reads/till/recent-sales",
        mutation: false,
        max_body_bytes: 8 * 1024,
    },
    RouteSpec {
        method: "POST",
        path: "/api/v1/reads/till/current-shift",
        mutation: false,
        max_body_bytes: 8 * 1024,
    },
    RouteSpec {
        method: "POST",
        path: "/api/v1/reads/inventory/reorder-alerts",
        mutation: false,
        max_body_bytes: 8 * 1024,
    },
];
