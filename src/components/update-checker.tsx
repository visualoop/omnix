import { useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { Download, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface UpdateInfo {
  version: string;
  body?: string;
}

export function UpdateChecker() {
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [available, setAvailable] = useState<UpdateInfo | null>(null);
  const [upToDate, setUpToDate] = useState(false);

  const checkForUpdates = async () => {
    setChecking(true);
    setUpToDate(false);
    try {
      const update = await check();
      if (update) {
        setAvailable({ version: update.version, body: update.body });
      } else {
        setUpToDate(true);
      }
    } catch (e) {
      toast.error("Update check failed: " + e);
    } finally {
      setChecking(false);
    }
  };

  const downloadAndInstall = async () => {
    setDownloading(true);
    try {
      const update = await check();
      if (!update) return;

      let downloadedSoFar = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            setTotal(event.data.contentLength || 0);
            break;
          case "Progress":
            downloadedSoFar += event.data.chunkLength;
            setDownloaded(downloadedSoFar);
            break;
          case "Finished":
            toast.success("Update installed. Restarting...");
            break;
        }
      });
      // Restart after install
      setTimeout(() => relaunch(), 500);
    } catch (e) {
      toast.error("Update failed: " + e);
      setDownloading(false);
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Software Updates</h3>
      </div>

      {available ? (
        <div className="border border-blue-500/50 bg-blue-500/5 rounded-md p-3 space-y-2">
          <div className="flex items-start gap-2">
            <Download className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Update available: v{available.version}</p>
              {available.body && (
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{available.body}</p>
              )}
            </div>
          </div>
          {downloading && total > 0 && (
            <div className="space-y-1">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${(downloaded / total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {(downloaded / 1024 / 1024).toFixed(1)} MB / {(total / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          )}
          <Button
            onClick={downloadAndInstall}
            disabled={downloading}
            size="sm"
            className="w-full"
          >
            {downloading ? "Downloading..." : "Download & Install"}
          </Button>
        </div>
      ) : upToDate ? (
        <div className="border border-green-500/50 bg-green-500/5 rounded-md p-3 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
          <p className="text-sm text-green-700">You're running the latest version</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Check for new SokoOS releases. Updates require an active maintenance subscription.
        </p>
      )}

      {!available && (
        <Button onClick={checkForUpdates} disabled={checking} variant="outline" size="sm">
          {checking ? (
            <><RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> Checking...</>
          ) : (
            <><RefreshCw className="h-3.5 w-3.5 mr-2" /> Check for Updates</>
          )}
        </Button>
      )}
    </div>
  );
}
