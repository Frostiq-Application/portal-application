import { useState } from "react";
import { Check, Loader2, Mail, User as UserIcon } from "@/components/ui/icons";
import { toast } from "sonner";
import { InviteSentPanel } from "@/components/common/InviteSentPanel";
import { useCreateUserMutation, type CreateUserBody } from "@/features/api/usersApi";
import { useListCustomRolesQuery } from "@/features/api/rolesApi";
import { useListAccountsQuery } from "@/features/api/accountsApi";
import { unreachablePermissions } from "@/config/nav";
import { permissionLabel } from "@/config/permissions";
import { useListShopsQuery } from "@/features/api/shopsApi";
import { useAuth } from "@/hooks/useAuth";
import {
  FLOOR_ROLES,
  isAccountAdmin,
  isFloorRole,
  isPlatformAdmin,
  roleLabel,
} from "@/lib/roles";
import { apiError } from "@/lib/apiError";
import type { Role } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const NO_CUSTOM_ROLE = "none";

export function InviteUserDialog() {
  const { role } = useAuth();
  const platform = isPlatformAdmin(role);
  // Branch owners (shop_admin) staff their own floor; Shop Owners can also
  // appoint branch owners.
  const invitesStaff = role === "shop_admin";
  const [open, setOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  // Captured at submit so the confirmation keeps showing the right address
  // regardless of what happens to the form fields behind it.
  const [invitedEmail, setInvitedEmail] = useState("");

  // Platform → fellow super admins; shop admin → staff; shop owner → branch owner.
  const defaultRole: Role = platform
    ? "platform_super_admin"
    : invitesStaff
      ? "staff"
      : "shop_admin";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [userRole, setUserRole] = useState<Role>(defaultRole);
  const [accountId, setAccountId] = useState("");
  const [shopIds, setShopIds] = useState<string[]>([]);
  // Radix rejects an empty-string item value, so "none" stands in for
  // "base role only" and is stripped before it reaches the request body.
  const [customRoleId, setCustomRoleId] = useState(NO_CUSTOM_ROLE);

  const [createUser, { isLoading }] = useCreateUserMutation();
  const { data: accounts } = useListAccountsQuery(
    platform ? { page: 1, limit: 100, status: "active" } : undefined,
    { skip: !platform },
  );
  const accountScoped = userRole !== "platform_super_admin";
  // Every branch-scoped role needs the branch picker — a chef or rider with no
  // branch is a login that can see nothing, and the server rejects it anyway.
  const needsBranch = userRole === "shop_admin" || isFloorRole(userRole);
  const { data: shops } = useListShopsQuery(
    needsBranch
      ? { page: 1, limit: 100, ...(platform && accountId ? { accountId } : {}) }
      : undefined,
    { skip: !needsBranch },
  );
  // Only fetched while the dialog is open, and only for the roles the server
  // lets near /roles at all — a branch owner would just take a 403.
  const canUseCustomRoles = platform || isAccountAdmin(role);
  const { data: customRoles } = useListCustomRolesQuery(undefined, {
    skip: !open || !canUseCustomRoles,
  });
  const assignableRoles = (customRoles ?? []).filter((r) => r.isActive);
  const pickedRole = assignableRoles.find((r) => r.id === customRoleId);
  // Permissions the base role's surface can't reach anyway — see
  // `unreachablePermissions`. Worth saying out loud: a "social media handler"
  // built on Branch Staff would silently get none of CMS, Coupons or Catalog.
  const deadPermissions = pickedRole
    ? unreachablePermissions(userRole, pickedRole.permissions)
    : [];

  /**
   * Who this viewer may invite.
   *
   * Owners and branch admins both staff a floor, so both get the floor roles;
   * only an owner can additionally mint a branch admin. Platform admins invite
   * fellow platform admins and nothing else.
   */
  const roleOptions: Role[] = platform
    ? ["platform_super_admin"]
    : invitesStaff
      ? FLOOR_ROLES
      : ["shop_admin", ...FLOOR_ROLES];
  const singleRole = roleOptions.length === 1;

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setUserRole(defaultRole);
    setAccountId("");
    setShopIds([]);
    setCustomRoleId(NO_CUSTOM_ROLE);
    setInviteToken(null);
    setInvitedEmail("");
  };

  const submit = async () => {
    if (name.trim().length < 2 || !email.trim()) {
      return toast.error("Name and email are required");
    }
    if (needsBranch && shopIds.length === 0) {
      return toast.error("Select a branch");
    }
    const body: CreateUserBody = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      role: userRole,
      ...(platform && accountScoped && accountId ? { accountId } : {}),
      ...(needsBranch && shopIds.length ? { shopIds } : {}),
      ...(customRoleId !== NO_CUSTOM_ROLE ? { customRoleId } : {}),
    };
    try {
      const res = await createUser(body).unwrap();
      setInvitedEmail(body.email);
      setInviteToken(res.inviteToken);
      toast.success(`Invite sent to ${body.email}`);
    } catch (err) {
      toast.error(apiError(err, "Failed to invite user"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>Invite user</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {!inviteToken ? (
          <>
            <DialogHeader>
              <DialogTitle>{invitesStaff ? "Invite staff" : "Invite User"}</DialogTitle>
              <DialogDescription>
                {invitesStaff
                  ? "Your branch team: staff, chefs and delivery managers. They’ll receive a link to set their password."
                  : "They’ll receive a link to set their password."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label>Name</Label>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Phone</Label>
                <PhoneInput
                  defaultCountry="IN"
                  placeholder="Enter phone number"
                  value={phone}
                  onChange={(v) => setPhone(v ?? "")}
                />
              </div>
              {!singleRole && (
                <div className="flex flex-col gap-1.5">
                  <Label>Role</Label>
                  <Select value={userRole} onValueChange={(v) => setUserRole(v as Role)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((r) => (
                        <SelectItem key={r} value={r}>
                          {roleLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Custom roles are what make a "social media handler" possible:
                  the base role decides which tabs they're filed under and what
                  the server scopes them to, the custom role decides which pages
                  they can actually open. */}
              {assignableRoles.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label>Custom role</Label>
                  <Select value={customRoleId} onValueChange={setCustomRoleId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CUSTOM_ROLE}>
                        No custom role
                      </SelectItem>
                      {assignableRoles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                          {r.isTemplate ? " (template)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {pickedRole
                      ? pickedRole.mode === "restrict"
                        ? `Limited to exactly the ${pickedRole.permissions.length} permission${pickedRole.permissions.length === 1 ? "" : "s"} on this role — nothing else.`
                        : `Adds ${pickedRole.permissions.length} permission${pickedRole.permissions.length === 1 ? "" : "s"} on top of ${roleLabel(userRole)}.`
                      : `They'll get the standard ${roleLabel(userRole)} access. Manage roles on the Roles page.`}
                  </p>
                  {deadPermissions.length > 0 && (
                    <p className="rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      {roleLabel(userRole)} can&rsquo;t reach{" "}
                      {deadPermissions.map(permissionLabel).join(", ")} whatever
                      the role grants &mdash; those pages are closed to that
                      role. Pick a base role that has them, such as{" "}
                      {roleLabel("shop_admin")}.
                    </p>
                  )}
                </div>
              )}

              {platform && accountScoped && (
                <div className="flex flex-col gap-1.5">
                  <Label>Shop</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger><SelectValue placeholder="Select shop" /></SelectTrigger>
                    <SelectContent>
                      {(accounts?.data ?? []).map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {needsBranch && (
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Assign branch <span className="text-destructive">*</span>
                  </Label>
                  {(shops?.data ?? []).length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {(shops?.data ?? []).map((s) => {
                          const selected = shopIds[0] === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => setShopIds([s.id])}
                              className={
                                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 " +
                                (selected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-input bg-background text-foreground hover:border-primary/50 hover:bg-accent")
                              }
                            >
                              {selected && <Check className="h-3.5 w-3.5" />}
                              {s.branchName}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Select the branch this shop admin will manage.
                      </p>
                    </>
                  ) : (
                    <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                      No branches available.
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={submit}
                disabled={isLoading || (needsBranch && shopIds.length === 0)}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Invite
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>User invited</DialogTitle>
              <DialogDescription>
                They&rsquo;ll choose their own password before signing in.
              </DialogDescription>
            </DialogHeader>
            <InviteSentPanel email={invitedEmail} token={inviteToken} />
            <DialogFooter>
              <Button onClick={() => { setOpen(false); reset(); }}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
