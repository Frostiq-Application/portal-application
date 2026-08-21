import { useState } from "react";
import { Building2, Mail, Pencil, Phone, ShieldCheck, Store, User as UserIcon } from "@/components/ui/icons";
import { useMeQuery } from "@/features/api/authApi";
import { EditMyBrandDialog } from "@/components/accounts/EditMyBrandDialog";
import { Button } from "@/components/ui/button";
import { useMyAccountQuery } from "@/features/api/accountsApi";
import { useMySubscriptionQuery } from "@/features/api/billingApi";
import { useAuth } from "@/hooks/useAuth";
import { roleLabel } from "@/lib/roles";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { AccountStatusBadge } from "@/components/StatusBadge";
import { RecentUpdatesCard } from "@/components/versions/RecentUpdatesCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { OnboardingSource } from "@/types";

const ONBOARDING_SOURCE_LABEL: Record<OnboardingSource, string> = {
  self_registration: "Self-registered",
  admin_created: "Created by platform admin",
};

function Field({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex items-center gap-2 text-sm">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
        {value ?? <span className="text-muted-foreground">-</span>}
      </span>
    </div>
  );
}

export function ProfilePage() {
  const { user: sessionUser } = useAuth();
  const { data: me, isLoading: meLoading } = useMeQuery();
  const user = me ?? sessionUser ?? undefined;

  // Only account super admins own an onboarding (Account) record.
  const isAccountAdmin = user?.role === "account_super_admin";
  const {
    data: account,
    isLoading: accountLoading,
    isError: accountError,
  } = useMyAccountQuery(undefined, { skip: !isAccountAdmin });

  // The subscription dashboard already carries the plan name, so there's no
  // reason to fetch the whole catalogue just to resolve one id.
  const { data: subscription } = useMySubscriptionQuery(undefined, {
    skip: !isAccountAdmin,
  });
  const planName = subscription?.subscription?.planName;

  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your account details and onboarding information"
        actions={
          isAccountAdmin && account ? (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit profile
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---- My details ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserIcon className="h-4 w-4" />
              My details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            {meLoading && !user ? (
              <>
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </>
            ) : (
              <>
                <Field label="Name" value={user?.name} icon={UserIcon} />
                <Field label="Email" value={user?.email} icon={Mail} />
                <Field label="Role" value={roleLabel(user?.role)} icon={ShieldCheck} />
                <Field
                  label="Branches assigned"
                  value={user?.shopIds.length ?? 0}
                  icon={Store}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* ---- Brand / onboarding (account admins only) ---- */}
        {isAccountAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" />
                My brand
              </CardTitle>
            </CardHeader>
            <CardContent>
              {accountLoading ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : accountError || !account ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  We couldn&apos;t load your brand details.
                </p>
              ) : (
                <div className="space-y-5">
                  {/* banner + logo header */}
                  <div className="relative overflow-hidden rounded-lg border bg-muted">
                    <div className="h-24 w-full bg-gradient-to-br from-primary/15 to-primary/5">
                      {account.bannerUrl && (
                        <img
                          src={account.bannerUrl}
                          alt=""
                          className="h-24 w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-3 p-3">
                      {account.logoUrl ? (
                        <img
                          src={account.logoUrl}
                          alt=""
                          className="-mt-8 h-14 w-14 shrink-0 rounded-full border-2 border-background object-cover"
                        />
                      ) : (
                        <span className="-mt-8 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-background bg-primary/10 text-sm font-semibold uppercase text-primary">
                          {account.name.slice(0, 2)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {account.name}
                          </span>
                          <AccountStatusBadge status={account.status} />
                        </div>
                        <code className="text-xs text-muted-foreground">
                          /{account.appSlug}
                        </code>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Owner" value={account.ownerName} icon={UserIcon} />
                    <Field label="Owner email" value={account.ownerEmail} icon={Mail} />
                    <Field label="Owner phone" value={account.ownerPhone} icon={Phone} />
                    <Field label="Plan" value={planName || "-"} />
                    <Field
                      label="Onboarded via"
                      value={ONBOARDING_SOURCE_LABEL[account.onboardingSource]}
                    />
                    <Field label="Onboarded on" value={formatDate(account.createdAt)} />
                    {account.themeColor && (
                      <Field
                        label="Theme colour"
                        value={
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-4 w-4 rounded-full border"
                              style={{ backgroundColor: account.themeColor }}
                            />
                            {account.themeColor}
                          </span>
                        }
                      />
                    )}
                    {account.status === "rejected" && account.rejectionReason && (
                      <Field label="Rejection reason" value={account.rejectionReason} />
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {/* Which version this bakery is on, and the releases behind it. Sits
            with their own account details rather than in a menu nobody opens. */}
        <RecentUpdatesCard />
      </div>

      <EditMyBrandDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        account={account ?? null}
      />
    </>
  );
}
