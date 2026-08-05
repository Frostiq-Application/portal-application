import { useNavigate } from "react-router-dom";
import { ArrowRight, Lock, LogOut, Mail, MessageCircle, Sparkles } from "@/components/ui/icons";
import { useAppDispatch } from "@/app/hooks";
import { logout } from "@/features/auth/authSlice";
import { useAuth } from "@/hooks/useAuth";
import { useMySubscriptionQuery } from "@/features/api/billingApi";
import {
  SUBSCRIPTION_STATUS_HELP,
  SUBSCRIPTION_STATUS_LABEL,
} from "@/lib/billing";
import { formatDate } from "@/lib/utils";
import type { Entitlements } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Shown to brand/shop admins whose account is active but whose subscription
 * can't be used — no plan yet, or `locked`/`cancelled`.
 *
 * This screen used to be a dead end: only a platform admin could record a
 * payment, so the copy said "get in touch". Self-serve billing changes that
 * completely — the **owner** can fix this in about ninety seconds, so the
 * screen's whole job is now to hand them the button.
 *
 * Shop admins and staff still can't buy anything (billing is the owner's
 * decision), so they get the honest version: ask the owner.
 */
export function NoSubscriptionGate({
  support,
}: {
  support?: Entitlements["support"];
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isOwner = role === "account_super_admin";
  const { data } = useMySubscriptionQuery(undefined, { skip: !isOwner });

  const sub = data?.subscription;
  /** Non-null only while the account can still take the free trial. */
  const trial = !sub ? (data?.trialOffer ?? null) : null;
  const doLogout = () => {
    dispatch(logout());
    navigate("/login", { replace: true });
  };

  const headline = !sub
    ? isOwner
      ? trial
        ? `Try ${trial.planName} free for ${trial.days} days`
        : data?.freePlanAvailable
          ? "Get your storefront online"
          : "Choose a plan to get started"
      : "This brand doesn't have a plan yet"
    : sub.status === "locked"
      ? "Your storefront is offline"
      : "Your subscription has ended";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-primary/10">
          {sub ? (
            <Lock className="size-6 text-primary" />
          ) : (
            <Sparkles className="size-6 text-primary" />
          )}
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">{headline}</h1>

        {sub && (
          <Badge className="mt-3">{SUBSCRIPTION_STATUS_LABEL[sub.status]}</Badge>
        )}

        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          {sub ? (
            <>
              {SUBSCRIPTION_STATUS_HELP[sub.status]}
              {sub.deleteReadyAt && (
                <>
                  {" "}
                  Your data is kept until {formatDate(sub.deleteReadyAt)}.
                  Subscribe again before then and everything comes straight
                  back.
                </>
              )}
            </>
          ) : isOwner ? (
            trial ? (
              <>
                No card, nothing charged automatically. Your storefront goes
                live immediately and takes real orders from day one, after{" "}
                {trial.days} days you choose a plan to carry on.
              </>
            ) : data?.freePlanAvailable ? (
              <>
                Free to start, no card required and nothing expires. Your
                storefront goes live immediately and takes real orders from day
                one.
              </>
            ) : (
              <>
                Pick a plan and your storefront is back online the moment payment
                clears.
              </>
            )
          ) : (
            <>
              The account owner needs to choose a plan before the portal unlocks.
              Ask them to open Subscription in their sidebar.
            </>
          )}
        </p>

        <div className="mt-7 flex flex-col items-center gap-3">
          {isOwner ? (
            <Button
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => navigate("/my-subscription")}
            >
              {sub
                ? "Reactivate my subscription"
                : trial
                  ? `Start my ${trial.days}-day free trial`
                  : data?.freePlanAvailable
                    ? "Start free"
                    : "View plans"}
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            (support?.email || support?.whatsapp) && (
              <div className="flex flex-wrap justify-center gap-2">
                {support?.email && (
                  <Button variant="outline" asChild>
                    <a href={`mailto:${support.email}`}>
                      <Mail className="size-4" />
                      {support.email}
                    </a>
                  </Button>
                )}
                {support?.whatsapp && (
                  <Button variant="outline" asChild>
                    <a
                      href={`https://wa.me/${support.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="size-4" />
                      WhatsApp
                    </a>
                  </Button>
                )}
              </div>
            )
          )}

          <Button variant="ghost" size="sm" onClick={doLogout}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
