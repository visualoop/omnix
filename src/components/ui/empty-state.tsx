import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import type { Icon as LucideIcon } from "@phosphor-icons/react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  cta?: { label: string; to?: string; onClick?: () => void; icon?: LucideIcon };
  className?: string;
}

/**
 * Standard empty state with icon, title, description, and optional CTA.
 * Use for "no data yet" placeholders across the app.
 */
export function EmptyState({ icon: Icon, title, description, cta, className = "" }: EmptyStateProps) {
  const navigate = useNavigate();
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}>
      <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{description}</p>
      )}
      {cta && (
        <Button
          className="mt-5"
          onClick={() => {
            if (cta.onClick) cta.onClick();
            else if (cta.to) navigate(cta.to);
          }}
        >
          {cta.icon && <cta.icon className="h-4 w-4 mr-2" />}
          {cta.label}
        </Button>
      )}
    </div>
  );
}
