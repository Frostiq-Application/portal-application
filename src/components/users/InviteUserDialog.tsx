import { useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateUserMutation, type CreateUserBody } from "@/features/api/usersApi";
import { useListAccountsQuery } from "@/features/api/accountsApi";
import { useListShopsQuery } from "@/features/api/shopsApi";
import { useAuth } from "@/hooks/useAuth";
import { isPlatformAdmin } from "@/lib/roles";
import { apiError } from "@/lib/apiError";
import type { Role } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function InviteUserDialog() {
  const { role } = useAuth();
  const platform = isPlatformAdmin(role);
  const [open, setOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [userRole, setUserRole] = useState<Role>("shop_admin");
  const [accountId, setAccountId] = useState("");
  const [shopIds, setShopIds] = useState<string[]>([]);

  const [createUser, { isLoading }] = useCreateUserMutation();
  const { data: accounts } = useListAccountsQuery(
    platform ? { page: 1, limit: 100, status: "active" } : undefined,
    { skip: !platform },
  );
  const accountScoped = userRole !== "platform_super_admin";
  const { data: shops } = useListShopsQuery(
    userRole === "shop_admin"
      ? { page: 1, limit: 100, ...(platform && accountId ? { accountId } : {}) }
      : undefined,
    { skip: userRole !== "shop_admin" },
  );

  const roleOptions: Role[] = platform
    ? ["platform_super_admin", "account_super_admin", "shop_admin"]
    : ["shop_admin"];

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setUserRole("shop_admin");
    setAccountId("");
    setShopIds([]);
    setInviteToken(null);
  };

  const submit = async () => {
    if (name.trim().length < 2 || !email.trim()) {
      return toast.error("Name and email are required");
    }
    const body: CreateUserBody = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      role: userRole,
      ...(platform && accountScoped && accountId ? { accountId } : {}),
      ...(userRole === "shop_admin" && shopIds.length ? { shopIds } : {}),
    };
    try {
      const res = await createUser(body).unwrap();
      setInviteToken(res.inviteToken);
      toast.success("User invited");
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
              <DialogTitle>Invite admin user</DialogTitle>
              <DialogDescription>
                They&rsquo;ll receive a link to set their password.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Role</Label>
                <Select value={userRole} onValueChange={(v) => setUserRole(v as Role)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              {userRole === "shop_admin" && (
                <div className="flex flex-col gap-1.5">
                  <Label>Assign branches</Label>
                  <div className="flex flex-wrap gap-2">
                    {(shops?.data ?? []).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          setShopIds((prev) =>
                            prev.includes(s.id)
                              ? prev.filter((x) => x !== s.id)
                              : [...prev, s.id],
                          )
                        }
                        className={
                          "rounded-md border px-2.5 py-1 text-xs " +
                          (shopIds.includes(s.id)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "text-muted-foreground")
                        }
                      >
                        {s.branchName}
                      </button>
                    ))}
                    {(shops?.data ?? []).length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        No branches available.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={isLoading}>
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
                Share this set-password link (valid 7 days). They&rsquo;ll
                choose their own password before signing in.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 py-2">
              <Input
                readOnly
                value={`${window.location.origin}/set-password?token=${inviteToken}`}
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `${window.location.origin}/set-password?token=${inviteToken}`,
                  );
                  toast.success("Copied");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => { setOpen(false); reset(); }}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
