import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { AccountDeviceModel } from "@/mobile/models/account-device";
import { connectionLabel } from "@/mobile/models/account-device";

export interface AccountDeviceCardProps {
  readonly model: AccountDeviceModel;
  readonly locale: string;
}

function availabilityLabel(state: AccountDeviceModel["security"]["secureStorage"]): string {
  if (state.state === "available") return "Protected";
  if (state.state === "permission-required") return "Permission needed";
  return "Unavailable";
}

function meshLabel(state: AccountDeviceModel["mesh"]["state"]): string {
  if (state === "connected") return "Connected";
  if (state === "degraded") return "Limited";
  if (state === "starting") return "Connecting";
  if (state === "offline") return "Offline";
  return "Not enabled";
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

export function AccountDeviceCard({ model, locale }: AccountDeviceCardProps) {
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
          <dt className="text-muted-foreground">Private Mesh</dt>
          <dd>{meshLabel(model.mesh.state)}</dd>
          <dt className="text-muted-foreground">Mesh hub</dt>
          <dd>{model.mesh.hubName ?? "Not connected"}</dd>
          <dt className="text-muted-foreground">Last mesh handshake</dt>
          <dd className="font-mono text-xs">{formatTimestamp(model.mesh.lastHandshakeAt, locale)}</dd>
          <dt className="text-muted-foreground">Last successful sync</dt>
          <dd className="font-mono text-xs">{formatTimestamp(model.sync.lastSuccessfulAt, locale)}</dd>
        </dl>

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
