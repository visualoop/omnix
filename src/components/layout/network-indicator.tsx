import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Cpu as Server,
  Users,
  WifiHigh as Wifi,
  WifiSlash as WifiOff,
} from "@phosphor-icons/react";
import { getConnectionStatus, type ConnectionStatus } from "@/services/network";

/**
 * Compact network status pill shown in the topbar.
 * Shows nothing in standalone mode. In master/client mode shows online/offline state.
 */
export function NetworkIndicator() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const navigate = useNavigate();

  const refresh = async () => {
    try {
      setStatus(await getConnectionStatus());
    } catch {}
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000); // poll every 15s
    return () => clearInterval(interval);
  }, []);

  if (!status || status.mode === "standalone") return null;

  const handleClick = () => navigate("/settings/network");

  if (status.mode === "master") {
    return (
      <button
        onClick={handleClick}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
          status.online
            ? "bg-green-500/10 text-green-700 hover:bg-green-500/20"
            : "bg-muted text-muted-foreground hover:bg-accent"
        }`}
        title={status.online ? `Master server running at ${status.master_url}` : "Master server stopped"}
      >
        <Server className="h-3 w-3" />
        <span>Master</span>
        {status.online && status.paired_count !== undefined && status.paired_count > 0 && (
          <span className="flex items-center gap-0.5">
            <Users className="h-3 w-3" />
            {status.paired_count}
          </span>
        )}
      </button>
    );
  }

  // client
  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
        status.online
          ? "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20"
          : "bg-red-500/10 text-red-700 hover:bg-red-500/20"
      }`}
      title={
        status.online
          ? `Connected to ${status.business_name || status.master_url}`
          : `Master unreachable: ${status.master_url}`
      }
    >
      {status.online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      <span>{status.online ? "Online" : "Offline"}</span>
    </button>
  );
}
