import {
  CakeSlice,
  MessageCircle,
  Receipt,
  Settings2,
  ShoppingBag,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    icon: CakeSlice,
    title: "Requests come in",
    body: "Customers submit made-to-order cake briefs from the storefront — flavour, design, reference photos, and delivery details.",
  },
  {
    icon: Receipt,
    title: "Review & quote",
    body: "Open a request, add a quoted price, and move it through the pipeline: Under review → Quotation sent → Accepted.",
  },
  {
    icon: MessageCircle,
    title: "Talk to the customer",
    body: "Reach out over WhatsApp or a phone call right from the request to confirm details.",
  },
  {
    icon: ShoppingBag,
    title: "Convert to an order",
    body: "Once accepted, turn a request into a regular order in one tap — it joins your normal order queue.",
  },
];

export function CustomCakeIntro({
  open,
  onClose,
  onManageOptions,
}: {
  open: boolean;
  onClose: () => void;
  onManageOptions: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CakeSlice className="h-6 w-6" />
          </div>
          <DialogTitle>Welcome to Custom Cakes</DialogTitle>
          <DialogDescription>
            A quote-request workflow for made-to-order cakes — here's how it
            works.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-4 py-2">
          {STEPS.map((s) => (
            <li key={s.title} className="flex gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1" onClick={onManageOptions}>
            <Settings2 className="mr-2 h-4 w-4" />
            Set up form options
          </Button>
          <Button className="flex-1" onClick={onClose}>
            Get started
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
