import { NavLink } from "react-router-dom";
import { Rocket } from "@/components/ui/icons";
import { useLatestVersionQuery } from "@/features/api/versionsApi";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/**
 * The version the bakery is on, parked at the bottom of the sidebar.
 *
 * Two jobs in one row: it answers "which version am I running" without anyone
 * having to ask support, and it is the door to the release history — the note
 * dialog only ever shows the newest release, and only once.
 *
 * Collapsed to icons the number goes with the label; the tooltip still carries
 * it, which is the same trade every other row in the sidebar makes.
 */
export function VersionFooterLink() {
  const { data: latest } = useLatestVersionQuery();
  const unread = Boolean(latest && latest.notify && !latest.seen);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          tooltip={
            latest ? `What's new — version ${latest.version}` : "What's new"
          }
        >
          <NavLink to="/whats-new">
            <span className="relative">
              <Rocket />
              {unread && (
                <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary ring-2 ring-sidebar" />
              )}
            </span>
            <span>What&apos;s new</span>
            {latest && (
              <span className="ml-auto text-xs text-muted-foreground">
                v{latest.version}
              </span>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
