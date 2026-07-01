import { UpdateChecker } from "@/components/update-checker";
import { APP_NAME } from "@/lib/brand";

/**
 * /settings/updates — dedicated home for the auto-updater UI.
 *
 * Previously bolted onto the bottom of the Business Profile page, which
 * made it undiscoverable. Now it lives in the Application tab where
 * anyone looking for "update the app" will actually find it.
 */
export function SettingsUpdatesPage() {
  return (
    <div className="space-y-5 max-w-2xl">
      <UpdateChecker />
      <div className="text-xs text-muted-foreground leading-relaxed">
        <p>
          <span className="font-medium text-foreground">How updates work.</span>{" "}
          {APP_NAME} checks for updates in the background every few hours. Non-major updates
          download quietly and install the next time you close the app — you don&rsquo;t need
          to do anything. Use the button above only when you want to check immediately.
        </p>
        <p className="mt-3">
          Updates are signed with an offline key — the app refuses to install anything that
          isn&rsquo;t signed by us. If you see a &ldquo;signature invalid&rdquo; error, don&rsquo;t
          install anything manually — write to <code>support@omnix.co.ke</code>.
        </p>
      </div>
    </div>
  );
}
