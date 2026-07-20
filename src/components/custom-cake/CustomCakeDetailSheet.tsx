import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  MessageCircle,
  Phone,
  Receipt,
  ShoppingBag,
  StickyNote,
} from "lucide-react";
import {
  useConvertCustomCakeMutation,
  useGetCustomCakeEventsQuery,
  useQuoteCustomCakeMutation,
  useSetCustomCakeNotesMutation,
  useUpdateCustomCakeStatusMutation,
  type CustomCakeRequest,
  type CustomCakeStatus,
  CUSTOM_CAKE_STATUS_ACCENT,
  CUSTOM_CAKE_STATUS_LABELS,
} from "@/features/api/customCakeApi";
import { apiError } from "@/lib/apiError";
import { formatDate } from "@/lib/utils";
import { waLink, telLink } from "@/lib/contact";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImagePreviewDialog } from "@/components/custom-cake/ImagePreviewDialog";

const ADVANCEABLE: CustomCakeStatus[] = [
  "submitted",
  "under_review",
  "quotation_sent",
  "accepted",
  "preparing",
  "ready",
  "delivered",
  "rejected",
  "cancelled",
];

export function CustomCakeDetailSheet({
  request,
  onOpenChange,
}: {
  request: CustomCakeRequest | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = !!request;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {request && <SheetBody request={request} />}
      </SheetContent>
    </Sheet>
  );
}

function SheetBody({ request }: { request: CustomCakeRequest }) {
  const accent = CUSTOM_CAKE_STATUS_ACCENT[request.status];
  const [price, setPrice] = useState(request.quotedPrice ?? "");
  const [quoteNote, setQuoteNote] = useState("");
  const [notes, setNotes] = useState(request.adminNotes ?? "");
  const [nextStatus, setNextStatus] = useState<CustomCakeStatus>(request.status);
  const [reason, setReason] = useState("");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  useEffect(() => {
    setPrice(request.quotedPrice ?? "");
    setQuoteNote("");
    setNotes(request.adminNotes ?? "");
    setNextStatus(request.status);
    setReason("");
    setPreviewIndex(null);
  }, [request.id, request.quotedPrice, request.adminNotes, request.status]);

  const { data: events } = useGetCustomCakeEventsQuery(request.id);
  const [quote, quoteState] = useQuoteCustomCakeMutation();
  const [setNotesMut, notesState] = useSetCustomCakeNotesMutation();
  const [updateStatus, statusState] = useUpdateCustomCakeStatusMutation();
  const [convert, convertState] = useConvertCustomCakeMutation();

  const needsReason = nextStatus === "rejected" || nextStatus === "cancelled";

  const onQuote = async () => {
    const n = Number(price);
    if (!Number.isFinite(n) || n < 0) return toast.error("Enter a valid price");
    try {
      await quote({
        id: request.id,
        quotedPrice: n,
        note: quoteNote.trim() || undefined,
      }).unwrap();
      setQuoteNote("");
      toast.success("Quote sent to the customer");
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const onSaveNotes = async () => {
    try {
      await setNotesMut({ id: request.id, adminNotes: notes }).unwrap();
      toast.success("Notes saved");
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const onUpdateStatus = async () => {
    if (needsReason && reason.trim().length < 3) {
      return toast.error("Add a short reason for the customer");
    }
    try {
      await updateStatus({
        id: request.id,
        status: nextStatus,
        reason: needsReason ? reason.trim() : undefined,
      }).unwrap();
      toast.success("Status updated");
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const onConvert = async () => {
    try {
      const res = await convert({ id: request.id }).unwrap();
      toast.success(`Order ${res.orderNumber} created`);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="space-y-6">
      <SheetHeader className="space-y-1">
        <SheetTitle className="flex items-center gap-2">
          {request.contactName}
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: `${accent}22`, color: accent }}
          >
            {CUSTOM_CAKE_STATUS_LABELS[request.status]}
          </span>
        </SheetTitle>
        <p className="text-xs text-muted-foreground">{request.requestNumber}</p>
      </SheetHeader>

      {/* Contact */}
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <a href={waLink(request.contactPhone, waMessage(request))} target="_blank" rel="noreferrer">
            <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
          </a>
        </Button>
        <Button asChild variant="outline" size="sm" className="flex-1">
          <a href={telLink(request.contactPhone)}>
            <Phone className="mr-2 h-4 w-4" /> Call
          </a>
        </Button>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
      {/* Reference images */}
      {request.referenceImageUrls.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {request.referenceImageUrls.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setPreviewIndex(i)}
              className="shrink-0 overflow-hidden rounded-lg transition-opacity hover:opacity-80"
            >
              <img
                src={url}
                alt={`Reference ${i + 1}`}
                className="h-24 w-24 object-cover"
              />
            </button>
          ))}
        </div>
      )}
      <ImagePreviewDialog
        urls={request.referenceImageUrls}
        index={previewIndex}
        onIndexChange={setPreviewIndex}
        onOpenChange={(o) => !o && setPreviewIndex(null)}
      />

      {/* Request details */}
      <div className="space-y-3">
        <Field label="Occasion" value={request.occasion} />
        <Field label="Theme" value={request.theme} />
        <DetailGrid request={request} />
        {request.decorations.length > 0 && (
          <Field label="Decorations" value={request.decorations.join(", ")} />
        )}
        <Field label="Topper" value={request.topper} />
        <Field label="Message on cake" value={request.cakeMessage} />
        <Separator />
        <Field
          label="Delivery"
          value={`${request.deliveryType}${
            request.neededDate ? ` · ${formatDate(request.neededDate)}` : ""
          }${request.neededTime ? ` · ${request.neededTime}` : ""}`}
        />
        <Field label="Address" value={request.deliveryAddress} />
        <Field label="Notes" value={request.notes} />
        <Field label="Special instructions" value={request.specialInstructions} />
        <Field label="Allergy info" value={request.allergyInfo} />
        <Field label="Contact" value={`${request.contactPhone}${request.contactEmail ? ` · ${request.contactEmail}` : ""}`} />
      </div>

      <Separator />

      {/* Quote */}
      <section className="space-y-2">
        <Label className="flex items-center gap-2">
          <Receipt className="h-4 w-4" /> Quote
        </Label>

        {request.status === "quotation_sent" && request.quotedPrice && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Waiting for the customer to respond to ₹{request.quotedPrice}.
          </div>
        )}
        {request.status === "accepted" && request.quotedPrice && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Customer accepted ₹{request.quotedPrice} — convert it to an order
            below.
          </div>
        )}
        {(request.status === "cancelled" || request.status === "rejected") &&
          request.quotedPrice && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {request.resolutionReason ?? "Request closed."} Sending a revised
              quote reopens it for the customer.
            </div>
          )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              ₹
            </span>
            <Input
              className="pl-7"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
            />
          </div>
          <Button onClick={onQuote} disabled={quoteState.isLoading}>
            {request.quotedPrice ? "Send revised quote" : "Send quote"}
          </Button>
        </div>
        <Textarea
          value={quoteNote}
          onChange={(e) => setQuoteNote(e.target.value)}
          placeholder="Message to the customer (optional) — shown with the quote"
          rows={2}
        />
      </section>

      {/* Status */}
      <section className="space-y-2">
        <Label>Status</Label>
        <div className="flex gap-2">
          <Select
            value={nextStatus}
            onValueChange={(v) => setNextStatus(v as CustomCakeStatus)}
          >
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADVANCEABLE.map((s) => (
                <SelectItem key={s} value={s}>
                  {CUSTOM_CAKE_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={onUpdateStatus}
            disabled={statusState.isLoading || nextStatus === request.status}
          >
            Update
          </Button>
        </div>
        {needsReason && (
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason shown to the customer"
            rows={2}
          />
        )}
      </section>

      {/* Convert to order */}
      <section>
        {request.convertedOrderId ? (
          <p className="text-sm text-muted-foreground">
            ✓ Converted to an order.
          </p>
        ) : (
          <Button
            variant="secondary"
            className="w-full"
            onClick={onConvert}
            disabled={convertState.isLoading || !request.customerId}
          >
            <ShoppingBag className="mr-2 h-4 w-4" />
            Convert to order
          </Button>
        )}
        {!request.customerId && !request.convertedOrderId && (
          <p className="mt-1 text-xs text-muted-foreground">
            Guest request — a registered customer is required to convert.
          </p>
        )}
      </section>

      <Separator />

      {/* Internal notes */}
      <section className="space-y-2">
        <Label className="flex items-center gap-2">
          <StickyNote className="h-4 w-4" /> Internal notes
        </Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Only visible to your team"
          rows={3}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={onSaveNotes}
          disabled={notesState.isLoading}
        >
          Save notes
        </Button>
      </section>
        </TabsContent>

        <TabsContent value="history">
      {/* Timeline — customer actions (no admin author) vs. the team's */}
      {!events || events.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No history yet.
        </p>
      ) : (
        <section className="space-y-2">
          <ol className="space-y-2">
            {events.map((e) => {
              const fromCustomer = e.changedBy === null;
              return (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: CUSTOM_CAKE_STATUS_ACCENT[e.status],
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {CUSTOM_CAKE_STATUS_LABELS[e.status]}
                      <span
                        className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          fromCustomer
                            ? "bg-blue-100 text-blue-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {fromCustomer ? "Customer" : "Team"}
                      </span>
                    </p>
                    {e.note && (
                      <p className="text-xs text-muted-foreground">{e.note}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDate(e.changedAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function DetailGrid({ request }: { request: CustomCakeRequest }) {
  const rows: [string, string | null][] = [
    ["Cake type", request.cakeType],
    ["Weight", request.weight],
    ["Shape", request.shape],
    ["Sponge", request.sponge],
    ["Cream", request.cream],
    ["Filling", request.filling],
    ["Flavour", request.flavour],
    ["Colour", request.colour],
  ];
  return (
    <>
      {rows.map(([label, value]) => (
        <Field key={label} label={label} value={value} />
      ))}
    </>
  );
}

/** Pre-filled WhatsApp message the shop sends the customer about this request. */
function waMessage(r: CustomCakeRequest): string {
  return `Hi ${r.contactName}, regarding your custom cake request ${r.requestNumber}${
    r.quotedPrice ? ` — quoted price ₹${r.quotedPrice}` : ""
  }.`;
}
