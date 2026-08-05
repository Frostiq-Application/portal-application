import * as React from "react";
import { Eye, EyeOff } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Input, type InputProps } from "@/components/ui/input";

/**
 * A password field with a reveal toggle.
 *
 * Typing a long password blind, on a screen where a wrong one costs a round
 * trip and a toast, is the sort of thing people give up on — so every password
 * box in the portal gets the same eye.
 *
 * The toggle is a real button so it's reachable by keyboard, but it stays out
 * of the tab order between the field and the submit button (`tabIndex={-1}`):
 * tabbing off a password into "show password" instead of "sign in" is a worse
 * trade than reaching it with a click.
 */
const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<InputProps, "type">
>(({ className, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none"
        disabled={props.disabled}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
