import { Lock, Mail, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useEntitlements } from "@/hooks/useEntitlements";

/**
 * Placeholder shown in place of a feature the current plan doesn't include.
 * Used by FeatureRoute so a direct URL to a gated module renders this instead
 * of the real page.
 */
export function LockedFeature({
  title = "Feature not available",
  featureLabel,
}: {
  title?: string;
  featureLabel?: string;
}) {
  const { entitlements } = useEntitlements();
  const support = entitlements?.support;

  return (
    <div>
      <PageHeader title={title} description="Upgrade required" />
      <div className="mx-auto mt-10 max-w-md rounded-xl border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          {featureLabel ? (
            <>
              <span className="font-medium text-foreground">
                {featureLabel}
              </span>{" "}
              isn’t included in your current plan
              {entitlements?.planName ? ` (${entitlements.planName})` : ""}.
            </>
          ) : (
            <>This feature isn’t included in your current plan.</>
          )}{" "}
          Contact your administrator to upgrade.
        </p>

        {(support?.email || support?.whatsapp) && (
          <div className="mt-6 flex flex-col gap-2">
            {support?.email && (
              <Button asChild variant="outline" className="justify-start">
                <a href={`mailto:${support.email}`}>
                  <Mail className="mr-2 h-4 w-4" />
                  {support.email}
                </a>
              </Button>
            )}
            {support?.whatsapp && (
              <Button asChild variant="outline" className="justify-start">
                <a
                  href={`https://wa.me/${support.whatsapp.replace(/[^\d]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {support.whatsapp}
                </a>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
