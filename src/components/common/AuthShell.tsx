import { Link } from "react-router-dom";
import { FrostiqueMark } from "@/components/common/FrostiqueMark";

/**
 * The split-screen frame the signed-out screens share — tinted form panel on
 * one side, photo on the other. Matches `SetPasswordPage` so the code and
 * password steps of one flow don't look like two different products.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col-reverse lg:flex-row-reverse">
      <div className="relative flex flex-col gap-4 overflow-hidden bg-gradient-to-br from-secondary/50 via-background to-accent/50 p-6 md:p-10 lg:w-1/2">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 left-1/4 size-80 rounded-full bg-accent/40 blur-3xl"
        />
        <div className="relative flex justify-center gap-2 md:justify-start">
          <Link to="/login" className="flex items-center gap-2 font-medium">
            <FrostiqueMark className="size-6" />
            Frostique Portal
          </Link>
        </div>
        <div className="relative flex flex-1 items-center justify-center py-6">
          <div className="w-full max-w-xs">{children}</div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block lg:w-1/2">
        <img
          src="/placeholder.avif"
          alt="A tiered cake on a stand, decorated with berries and icing"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.85]"
        />
      </div>
    </div>
  );
}
