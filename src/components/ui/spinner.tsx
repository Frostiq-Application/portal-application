import { Loader2Icon, type IconProps } from "@/components/ui/icons";

import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: IconProps) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
