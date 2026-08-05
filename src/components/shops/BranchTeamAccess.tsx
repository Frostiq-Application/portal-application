import { useState } from "react";
import { Check, Info, Plus, ShieldCheck, UserPlus, X } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Someone being created *and* given this branch in the same save. */
export interface BranchInvite {
  name: string;
  email: string;
  phone?: string;
  role: "shop_admin" | "staff";
}

export interface AssignableUser {
  id: string;
  name: string;
  email: string;
  role: string;
  /** Owners reach every branch by role, so assigning them is a no-op. */
  isOwner: boolean;
  /** Invited but hasn't set a password yet — can't sign in. */
  pending?: boolean;
}

/** Initials for the avatar chip, e.g. "Arbaj Ansari" → "AA". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** `shop_admin` → `Shop admin`. */
function roleLabel(role: string): string {
  const words = role.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Roles that can be handed out from a branch form. */
const INVITE_ROLES = [
  {
    value: "shop_admin" as const,
    label: "Branch manager",
    hint: "Runs the branch: orders, products, hours and staff.",
  },
  {
    value: "staff" as const,
    label: "Staff",
    hint: "Handles day-to-day orders. Can't change settings or pricing.",
  },
];

/**
 * Draft invites, staged locally and created when the branch is saved.
 *
 * Nothing is sent while typing on purpose: the branch may not exist yet, and
 * a half-filled row that created a real login the moment it lost focus would
 * be impossible to take back.
 */
function InviteList({
  invites,
  onChange,
}: {
  invites: BranchInvite[];
  onChange: (invites: BranchInvite[]) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"shop_admin" | "staff">("staff");

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const duplicate = invites.some((i) => i.email.toLowerCase() === trimmedEmail);
  const canAdd = trimmedName.length >= 2 && emailValid && !duplicate;

  const add = () => {
    if (!canAdd) return;
    onChange([...invites, { name: trimmedName, email: trimmedEmail, role }]);
    setName("");
    setEmail("");
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <p className="text-sm font-medium">Invite someone to this branch</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        They're created with the branch and can only see it. Send them a
        set-password link from <strong>Team</strong> whenever you're ready.
        Nothing is emailed automatically.
      </p>

      {invites.length > 0 && (
        <ul className="mt-3 space-y-2">
          {invites.map((invite) => (
            <li
              key={invite.email}
              className="flex items-center gap-3 rounded-lg border bg-muted/40 p-2.5"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials(invite.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {invite.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {roleLabel(invite.role)} · {invite.email}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label={`Remove ${invite.name}`}
                onClick={() =>
                  onChange(invites.filter((i) => i.email !== invite.email))
                }
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          aria-label="Invite name"
        />
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          aria-label="Invite email"
          // Enter is the natural way to finish a row; without this it would
          // submit the whole wizard step instead.
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
        <Select
          value={role}
          onValueChange={(v) => setRole(v as "shop_admin" | "staff")}
        >
          <SelectTrigger aria-label="Invite role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVITE_ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                <span className="font-medium">{r.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {r.hint}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" disabled={!canAdd} onClick={add}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      {duplicate && trimmedEmail && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          {trimmedEmail} is already on the list.
        </p>
      )}
    </div>
  );
}

/**
 * Optional per-branch access, picked while the branch is being created.
 *
 * This exists because branch access is far easier to reason about at the
 * moment you're describing the branch than it is later from a team screen,
 * where you're staring at a list of people and trying to remember which
 * kitchen each one works in.
 *
 * It stays optional on purpose: the owner already sees every branch, so a
 * one-branch bakery should be able to skip straight past it — hence the copy
 * leads with the benefit rather than a required-field asterisk.
 */
export function BranchTeamAccess({
  users,
  selected,
  onChange,
  invites,
  onInvitesChange,
  className,
}: {
  users: AssignableUser[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Omit to hide the invite form and offer ticking only. */
  invites?: BranchInvite[];
  onInvitesChange?: (invites: BranchInvite[]) => void;
  className?: string;
}) {
  // Owners are filtered out rather than shown disabled: a checkbox you can't
  // uncheck, next to a note saying it doesn't matter, is just clutter.
  const staff = users.filter((u) => !u.isOwner);
  const owner = users.find((u) => u.isOwner);

  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-2">
          <UserPlus className="size-3.5 text-muted-foreground" />
          Who works here?
          <Badge
            variant="secondary"
            className="border-transparent px-1.5 py-0 text-[10px] font-medium"
          >
            Optional
          </Badge>
        </Label>
        {staff.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {selected.length === 0
              ? "Nobody assigned yet"
              : `${selected.length} of ${staff.length} assigned`}
          </span>
        )}
      </div>

      {staff.length === 0 ? (
        /* Nothing to pick from yet — say what the field will do rather than
           showing an unexplained empty box. */
        <div className="rounded-xl border border-dashed bg-muted/40 p-4">
          <p className="text-sm font-medium">
            You're the only person on the account so far
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {owner ? `As the owner, ${owner.name.split(" ")[0]} sees` : "Owners see"}{" "}
            every branch automatically. Add bakers or counter staff below and
            they'll see this branch's orders and nothing else, which keeps
            their day simple and your other branches private.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {staff.map((u) => {
              const active = selected.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(u.id)}
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-xs outline-none transition-all",
                    "focus-visible:ring-2 focus-visible:ring-primary/40",
                    active
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "hover:border-foreground/25 hover:shadow-sm",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {active ? <Check className="size-4" /> : initials(u.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">
                        {u.name}
                      </span>
                      {u.pending && (
                        /* Explains why someone who was just invited still
                           can't log in — without it, a ticked card that
                           nothing happens for reads as a bug. */
                        <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          Invite pending
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {roleLabel(u.role)} · {u.email}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" />
            Assigned staff see only this branch's orders, products and
            customers, less to scroll through for them, and your other
            branches stay private. Leave it empty and only owners and admins
            will have access.
          </p>
        </>
      )}

      {onInvitesChange && (
        <InviteList invites={invites ?? []} onChange={onInvitesChange} />
      )}

      {selected.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="mt-px size-3.5 shrink-0" />
          You can change who has access at any time from the branch's page.
        </p>
      )}
    </div>
  );
}
