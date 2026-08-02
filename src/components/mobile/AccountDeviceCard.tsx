import { ArrowClockwise } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { AccountDeviceModel } from "@/mobile/models/account-device";
import type { AdapterAvailability } from "@/platform/adapters";
import { connectionLabel } from "@/mobile/models/account-device";

export interface AccountDeviceCardProps {
  readonly model: AccountDeviceModel;
  readonly locale: string;
  readonly meshEnrollmentReady?: boolean;
  readonly meshAvailability?: AdapterAvailability;
  readonly meshActionPending?: boolean;
  readonly onMeshAction?: () => void;
}

function availabilityLabel(state: AccountDeviceModel["security"]["secureStorage"]): string {
  if (state.state === "available") return "Protected";
  if (state.state === "permission-required") return "Permission needed";
  return "Unavailable";
}

interface PrivateMeshSurface {
  readonly label: string;
  readonly detail: string;
  readonly action: string;
  readonly canRetry: boolean;
}

function privateMeshSurface(
  state: AccountDeviceModel["mesh"]["state"],
  configured: boolean,
  availability: AdapterAvailability,
  pending: boolean,
): PrivateMeshSurface {
  if (!configured) return {
    label: "Not configured",
    detail: "Ask the branch hub administrator to approve and publish Private Mesh for this device.",
    action: "Waiting for hub approval",
    canRetry: false,
  };
  if (availability.state === "unavailable") return {
    label: "Mesh unavailable",
    detail: availability.reason,
    action: "Private Mesh unavailable",
    canRetry: false,
  };
  if (pending || state === "starting") return {
    label: "Connecting",
    detail: "Opening the private route and waiting for the hub to complete a WireGuard handshake.",
    action: "Retrying…",
    canRetry: false,
  };
  if (state === "permission-denied" || availability.state === "permission-required") return {
    label: "VPN permission denied",
    detail: "Android must allow Omnix to create the private VPN. No other app traffic enters this tunnel.",
    action: "Allow VPN and retry",
    canRetry: true,
  };
  if (state === "connected") return {
    label: "Connected",
    detail: "The hub is reachable through its private Omnix address. Other apps keep using the normal internet connection.",
    action: "Disconnect Private Mesh",
    canRetry: true,
  };
  if (state === "degraded" || state === "offline") return {
    label: "Hub unreachable",
    detail: "The private route is open, but the hub has not completed a recent handshake. Check the hub endpoint and office internet.",
    action: "Retry connection",
    canRetry: true,
  };
  return {
    label: "Not connected",
    detail: "Private Mesh is configured and ready to connect over Wi-Fi or mobile data.",
    action: "Connect Private Mesh",
    canRetry: true,
  };
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function formatTimestamp(value: string | null, locale: string): string {
  if (!value) return "Never";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

export function AccountDeviceCard({
  model,
  locale,
  meshEnrollmentReady = false,
  meshAvailability = { state: "available" },
  meshActionPending = false,
  onMeshAction,
}: AccountDeviceCardProps) {
  const meshCanStop = model.mesh.state === "connected";
  const surface = privateMeshSurface(model.mesh.state, meshEnrollmentReady || meshCanStop, meshAvailability, meshActionPending);

  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="text-[13px] font-semibold tracking-tight leading-tight">{model.device.deviceName}</h2>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {model.device.deviceId}
          </p>
        </div>
        <Badge variant="outline">Android</Badge>
      </CardHeader>
      <CardContent className="space-y-4 text-[13px]">
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2">
          <dt className="text-muted-foreground">App version</dt>
          <dd className="font-mono">{model.device.appVersion}</dd>
          <dt className="text-muted-foreground">System</dt>
          <dd>{model.device.osVersion}</dd>
          <dt className="text-muted-foreground">Secure storage</dt>
          <dd>{availabilityLabel(model.security.secureStorage)}</dd>
          <dt className="text-muted-foreground">Mesh hub</dt>
          <dd>{model.mesh.hubName ?? "Not connected"}</dd>
          <dt className="text-muted-foreground">Last mesh handshake</dt>
          <dd className="font-mono text-xs">{formatTimestamp(model.mesh.lastHandshakeAt, locale)}</dd>
          <dt className="text-muted-foreground">Last successful sync</dt>
          <dd className="font-mono text-xs">{formatTimestamp(model.sync.lastSuccessfulAt, locale)}</dd>
        </dl>

        <div className="border-t border-border pt-3" aria-labelledby="private-mesh-control-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p id="private-mesh-control-title" className="font-medium">Private Mesh</p>
              <p className="mt-1 max-w-64 text-xs leading-5 text-muted-foreground">
                {surface.detail}
              </p>
            </div>
            <Badge variant="outline">{surface.label}</Badge>
          </div>
          {onMeshAction ? (
            <Button
              type="button"
              variant={meshCanStop ? "outline" : "default"}
              className="mt-3 w-full active:scale-[0.98]"
              disabled={!surface.canRetry}
              aria-busy={meshActionPending || model.mesh.state === "starting"}
              onClick={onMeshAction}
            >
              {meshActionPending || model.mesh.state === "starting" ? (
                <ArrowClockwise className="size-4 motion-safe:animate-spin" aria-hidden="true" />
              ) : null}
              {surface.action}
            </Button>
          ) : null}
        </div>

        <div className="border-t border-border pt-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-medium">Device storage</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatBytes(model.storage.usedBytes)} of {formatBytes(model.storage.totalBytes)} used
              </p>
            </div>
            <span className="font-mono text-xs">{formatBytes(model.storage.cacheBytes)} cache</span>
          </div>
          <progress
            className="mt-2 h-1.5 w-full accent-primary"
            max={model.storage.totalBytes}
            value={model.storage.usedBytes}
            aria-label="Device storage used"
          />
        </div>

        <div className="border-t border-border pt-3" role="status" aria-live="polite">
          <p className="font-medium">{connectionLabel(model)}</p>
          {model.sync.hubName ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Branch hub: {model.sync.hubName}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
