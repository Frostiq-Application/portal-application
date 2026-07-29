/**
 * The app's icon set: Icons8 **Line Awesome**, rendered as inline SVG.
 *
 * Every icon is imported individually from `@iconify-icons/la`, so the bundle
 * carries only what's used and nothing is fetched at runtime. Paths are drawn
 * with `currentColor`, so icons inherit text colour and theme exactly as the
 * previous set did.
 *
 * Components take the same props as before — `className` for Tailwind sizing
 * (`size-4`, `h-5 w-5`) plus an optional numeric `size`. Stroke-width props
 * are accepted and ignored: Line Awesome glyphs are filled paths, not strokes.
 *
 * Generated from a name map; add a new icon by importing it here and exporting
 * it below.
 */
import { Icon, type IconProps as IconifyProps } from "@iconify/react";
import type { IconifyIcon } from "@iconify/types";
import type { ComponentType } from "react";

import alertTriangleIcon from "@iconify-icons/la/exclamation-triangle";
import archiveIcon from "@iconify-icons/la/archive";
import archiveRestoreIcon from "@iconify-icons/la/box-open";
import arrowDownIcon from "@iconify-icons/la/arrow-down";
import arrowLeftIcon from "@iconify-icons/la/arrow-left";
import arrowRightIcon from "@iconify-icons/la/arrow-right";
import arrowUpIcon from "@iconify-icons/la/arrow-up";
import badgeCheckIcon from "@iconify-icons/la/check-circle";
import badgePercentIcon from "@iconify-icons/la/percentage";
import banIcon from "@iconify-icons/la/ban";
import barChart3Icon from "@iconify-icons/la/chart-bar";
import bellIcon from "@iconify-icons/la/bell";
import boxesIcon from "@iconify-icons/la/boxes";
import building2Icon from "@iconify-icons/la/building";
import cakeIcon from "@iconify-icons/la/birthday-cake";
import cakeSliceIcon from "@iconify-icons/la/birthday-cake";
import calendarClockIcon from "@iconify-icons/la/calendar-check";
import calendarOffIcon from "@iconify-icons/la/calendar-times";
import calendarRangeIcon from "@iconify-icons/la/calendar-week";
import checkIcon from "@iconify-icons/la/check";
import checkCircle2Icon from "@iconify-icons/la/check-circle";
import chefHatIcon from "@iconify-icons/la/utensils";
import chevronDownIcon from "@iconify-icons/la/chevron-down";
import chevronLeftIcon from "@iconify-icons/la/chevron-left";
import chevronRightIcon from "@iconify-icons/la/chevron-right";
import chevronUpIcon from "@iconify-icons/la/chevron-up";
import chevronsUpDownIcon from "@iconify-icons/la/arrows-alt-v";
import circleIcon from "@iconify-icons/la/circle";
import circleAlertIcon from "@iconify-icons/la/exclamation-circle";
import clockIcon from "@iconify-icons/la/clock";
import constructionIcon from "@iconify-icons/la/hard-hat";
import contactIcon from "@iconify-icons/la/address-book";
import copyIcon from "@iconify-icons/la/copy";
import creditCardIcon from "@iconify-icons/la/credit-card";
import crownIcon from "@iconify-icons/la/crown";
import downloadIcon from "@iconify-icons/la/download";
import externalLinkIcon from "@iconify-icons/la/external-link-alt";
import eyeIcon from "@iconify-icons/la/eye";
import eyeOffIcon from "@iconify-icons/la/eye-slash";
import facebookIcon from "@iconify-icons/la/facebook";
import fileTextIcon from "@iconify-icons/la/file-alt";
import giftIcon from "@iconify-icons/la/gift";
import globeIcon from "@iconify-icons/la/globe";
import handshakeIcon from "@iconify-icons/la/handshake";
import hashIcon from "@iconify-icons/la/hashtag";
import heartIcon from "@iconify-icons/la/heart";
import heartCrackIcon from "@iconify-icons/la/heart-broken";
import historyIcon from "@iconify-icons/la/history";
import imageIcon from "@iconify-icons/la/image";
import imageIconIcon from "@iconify-icons/la/image";
import imageOffIcon from "@iconify-icons/la/file-image";
import imagePlusIcon from "@iconify-icons/la/images";
import imagesIcon from "@iconify-icons/la/images";
import inboxIcon from "@iconify-icons/la/inbox";
import indianRupeeIcon from "@iconify-icons/la/rupee-sign";
import infinityIcon from "@iconify-icons/la/infinity";
import infoIcon from "@iconify-icons/la/info-circle";
import instagramIcon from "@iconify-icons/la/instagram";
import keyRoundIcon from "@iconify-icons/la/key";
import layersIcon from "@iconify-icons/la/layer-group";
import layoutDashboardIcon from "@iconify-icons/la/tachometer-alt";
import layoutGridIcon from "@iconify-icons/la/th-large";
import lifeBuoyIcon from "@iconify-icons/la/life-ring";
import loader2Icon from "@iconify-icons/la/spinner";
import loader2IconIcon from "@iconify-icons/la/spinner";
import lockIcon from "@iconify-icons/la/lock";
import logOutIcon from "@iconify-icons/la/sign-out-alt";
import mailIcon from "@iconify-icons/la/envelope";
import mapPinIcon from "@iconify-icons/la/map-marker-alt";
import megaphoneIcon from "@iconify-icons/la/bullhorn";
import menuIcon from "@iconify-icons/la/bars";
import messageCircleIcon from "@iconify-icons/la/comment";
import minusIcon from "@iconify-icons/la/minus";
import moonIcon from "@iconify-icons/la/moon";
import moreHorizontalIcon from "@iconify-icons/la/ellipsis-h";
import navigationIcon from "@iconify-icons/la/location-arrow";
import packageIcon from "@iconify-icons/la/box";
import packageCheckIcon from "@iconify-icons/la/shipping-fast";
import packagePlusIcon from "@iconify-icons/la/dolly";
import paletteIcon from "@iconify-icons/la/palette";
import panelLeftIcon from "@iconify-icons/la/columns";
import partyPopperIcon from "@iconify-icons/la/glass-cheers";
import pauseCircleIcon from "@iconify-icons/la/pause-circle";
import pencilIcon from "@iconify-icons/la/pencil-alt";
import phoneIcon from "@iconify-icons/la/phone";
import playCircleIcon from "@iconify-icons/la/play-circle";
import plusIcon from "@iconify-icons/la/plus";
import quoteIcon from "@iconify-icons/la/quote-left";
import receiptIcon from "@iconify-icons/la/receipt";
import receiptIndianRupeeIcon from "@iconify-icons/la/file-invoice";
import refreshCwIcon from "@iconify-icons/la/sync";
import rocketIcon from "@iconify-icons/la/rocket";
import rotateCcwIcon from "@iconify-icons/la/undo";
import scrollTextIcon from "@iconify-icons/la/scroll";
import searchIcon from "@iconify-icons/la/search";
import sendIcon from "@iconify-icons/la/paper-plane";
import settings2Icon from "@iconify-icons/la/sliders-h";
import shieldAlertIcon from "@iconify-icons/la/shield-alt";
import shieldCheckIcon from "@iconify-icons/la/user-shield";
import shoppingBagIcon from "@iconify-icons/la/shopping-bag";
import shoppingCartIcon from "@iconify-icons/la/shopping-cart";
import sparklesIcon from "@iconify-icons/la/magic";
import starIcon from "@iconify-icons/la/star";
import starFilledIcon from "@iconify-icons/la/star-solid";
import gripVerticalIcon from "@iconify-icons/la/grip-vertical-solid";
import stickyNoteIcon from "@iconify-icons/la/sticky-note";
import storeIcon from "@iconify-icons/la/store";
import sunIcon from "@iconify-icons/la/sun";
import tagIcon from "@iconify-icons/la/tag";
import tagsIcon from "@iconify-icons/la/tags";
import ticketIcon from "@iconify-icons/la/ticket-alt";
import timerIcon from "@iconify-icons/la/stopwatch";
import trash2Icon from "@iconify-icons/la/trash-alt";
import trendingUpIcon from "@iconify-icons/la/chart-line";
import triangleAlertIcon from "@iconify-icons/la/exclamation-triangle";
import truckIcon from "@iconify-icons/la/truck";
import userIcon from "@iconify-icons/la/user";
import userCogIcon from "@iconify-icons/la/user-cog";
import userPlusIcon from "@iconify-icons/la/user-plus";
import userRoundIcon from "@iconify-icons/la/user-circle";
import usersIcon from "@iconify-icons/la/users";
import walletIcon from "@iconify-icons/la/wallet";
import wifiIcon from "@iconify-icons/la/wifi";
import wifiOffIcon from "@iconify-icons/la/unlink";
import xIcon from "@iconify-icons/la/times";
import zapIcon from "@iconify-icons/la/bolt";

export interface IconProps extends Omit<IconifyProps, "icon"> {
  /** Pixel size. Prefer Tailwind classes; this is for the odd inline case. */
  size?: number | string;
  /** Accepted and ignored: Line Awesome glyphs are filled paths, not strokes. */
  strokeWidth?: number | string;
}

/** An icon component, for props that take an icon rather than render one. */
export type IconComponent = ComponentType<IconProps>;

function make(data: IconifyIcon, displayName: string): IconComponent {
  const Component = ({
    size,
    strokeWidth: _strokeWidth,
    ...props
  }: IconProps) => (
    <Icon
      icon={data}
      aria-hidden
      {...(size == null ? {} : { width: size, height: size })}
      {...props}
    />
  );
  Component.displayName = displayName;
  return Component;
}

export const AlertTriangle = make(alertTriangleIcon, "AlertTriangle");
export const Archive = make(archiveIcon, "Archive");
export const ArchiveRestore = make(archiveRestoreIcon, "ArchiveRestore");
export const ArrowDown = make(arrowDownIcon, "ArrowDown");
export const ArrowLeft = make(arrowLeftIcon, "ArrowLeft");
export const ArrowRight = make(arrowRightIcon, "ArrowRight");
export const ArrowUp = make(arrowUpIcon, "ArrowUp");
export const BadgeCheck = make(badgeCheckIcon, "BadgeCheck");
export const BadgePercent = make(badgePercentIcon, "BadgePercent");
export const Ban = make(banIcon, "Ban");
export const BarChart3 = make(barChart3Icon, "BarChart3");
export const Bell = make(bellIcon, "Bell");
export const Boxes = make(boxesIcon, "Boxes");
export const Building2 = make(building2Icon, "Building2");
export const Cake = make(cakeIcon, "Cake");
export const CakeSlice = make(cakeSliceIcon, "CakeSlice");
export const CalendarClock = make(calendarClockIcon, "CalendarClock");
export const CalendarOff = make(calendarOffIcon, "CalendarOff");
export const CalendarRange = make(calendarRangeIcon, "CalendarRange");
export const Check = make(checkIcon, "Check");
export const CheckCircle2 = make(checkCircle2Icon, "CheckCircle2");
export const ChefHat = make(chefHatIcon, "ChefHat");
export const ChevronDown = make(chevronDownIcon, "ChevronDown");
export const ChevronLeft = make(chevronLeftIcon, "ChevronLeft");
export const ChevronRight = make(chevronRightIcon, "ChevronRight");
export const ChevronUp = make(chevronUpIcon, "ChevronUp");
export const ChevronsUpDown = make(chevronsUpDownIcon, "ChevronsUpDown");
export const Circle = make(circleIcon, "Circle");
export const CircleAlert = make(circleAlertIcon, "CircleAlert");
export const Clock = make(clockIcon, "Clock");
export const Construction = make(constructionIcon, "Construction");
export const Contact = make(contactIcon, "Contact");
export const Copy = make(copyIcon, "Copy");
export const CreditCard = make(creditCardIcon, "CreditCard");
export const Crown = make(crownIcon, "Crown");
export const Download = make(downloadIcon, "Download");
export const ExternalLink = make(externalLinkIcon, "ExternalLink");
export const Eye = make(eyeIcon, "Eye");
export const EyeOff = make(eyeOffIcon, "EyeOff");
export const Facebook = make(facebookIcon, "Facebook");
export const FileText = make(fileTextIcon, "FileText");
export const Gift = make(giftIcon, "Gift");
export const Globe = make(globeIcon, "Globe");
export const Handshake = make(handshakeIcon, "Handshake");
export const Hash = make(hashIcon, "Hash");
/** Audit trail / "what happened when" — the Activity Log. */
export const FileClock = make(historyIcon, "FileClock");
export const Heart = make(heartIcon, "Heart");
export const HeartCrack = make(heartCrackIcon, "HeartCrack");
export const Image = make(imageIcon, "Image");
export const ImageIcon = make(imageIconIcon, "ImageIcon");
export const ImageOff = make(imageOffIcon, "ImageOff");
export const ImagePlus = make(imagePlusIcon, "ImagePlus");
export const Images = make(imagesIcon, "Images");
export const Inbox = make(inboxIcon, "Inbox");
export const IndianRupee = make(indianRupeeIcon, "IndianRupee");
// Named `InfinityIcon`, not `Infinity`: the latter shadows the global inside
// this module, and every consumer already aliased it to this name anyway.
export const InfinityIcon = make(infinityIcon, "Infinity");
export const Info = make(infoIcon, "Info");
export const Instagram = make(instagramIcon, "Instagram");
export const KeyRound = make(keyRoundIcon, "KeyRound");
export const Layers = make(layersIcon, "Layers");
export const LayoutDashboard = make(layoutDashboardIcon, "LayoutDashboard");
export const LayoutGrid = make(layoutGridIcon, "LayoutGrid");
export const LifeBuoy = make(lifeBuoyIcon, "LifeBuoy");
export const Loader2 = make(loader2Icon, "Loader2");
export const Loader2Icon = make(loader2IconIcon, "Loader2Icon");
export const Lock = make(lockIcon, "Lock");
export const LogOut = make(logOutIcon, "LogOut");
export const Mail = make(mailIcon, "Mail");
export const MapPin = make(mapPinIcon, "MapPin");
export const Megaphone = make(megaphoneIcon, "Megaphone");
export const Menu = make(menuIcon, "Menu");
export const MessageCircle = make(messageCircleIcon, "MessageCircle");
export const Minus = make(minusIcon, "Minus");
export const Moon = make(moonIcon, "Moon");
export const MoreHorizontal = make(moreHorizontalIcon, "MoreHorizontal");
export const Navigation = make(navigationIcon, "Navigation");
export const Package = make(packageIcon, "Package");
export const PackageCheck = make(packageCheckIcon, "PackageCheck");
export const PackagePlus = make(packagePlusIcon, "PackagePlus");
export const Palette = make(paletteIcon, "Palette");
export const PanelLeft = make(panelLeftIcon, "PanelLeft");
export const PartyPopper = make(partyPopperIcon, "PartyPopper");
export const PauseCircle = make(pauseCircleIcon, "PauseCircle");
export const Pencil = make(pencilIcon, "Pencil");
export const Phone = make(phoneIcon, "Phone");
export const PlayCircle = make(playCircleIcon, "PlayCircle");
export const Plus = make(plusIcon, "Plus");
export const Quote = make(quoteIcon, "Quote");
export const Receipt = make(receiptIcon, "Receipt");
export const ReceiptIndianRupee = make(
  receiptIndianRupeeIcon,
  "ReceiptIndianRupee",
);
export const RefreshCw = make(refreshCwIcon, "RefreshCw");
export const Rocket = make(rocketIcon, "Rocket");
export const RotateCcw = make(rotateCcwIcon, "RotateCcw");
export const ScrollText = make(scrollTextIcon, "ScrollText");
export const Search = make(searchIcon, "Search");
export const Send = make(sendIcon, "Send");
export const Settings2 = make(settings2Icon, "Settings2");
export const ShieldAlert = make(shieldAlertIcon, "ShieldAlert");
export const ShieldCheck = make(shieldCheckIcon, "ShieldCheck");
export const ShoppingBag = make(shoppingBagIcon, "ShoppingBag");
export const ShoppingCart = make(shoppingCartIcon, "ShoppingCart");
export const Sparkles = make(sparklesIcon, "Sparkles");
export const Star = make(starIcon, "Star");
export const StarFilled = make(starFilledIcon, "StarFilled");
export const GripVertical = make(gripVerticalIcon, "GripVertical");
export const StickyNote = make(stickyNoteIcon, "StickyNote");
export const Store = make(storeIcon, "Store");
export const Sun = make(sunIcon, "Sun");
export const Tag = make(tagIcon, "Tag");
export const Tags = make(tagsIcon, "Tags");
export const Ticket = make(ticketIcon, "Ticket");
export const Timer = make(timerIcon, "Timer");
export const Trash2 = make(trash2Icon, "Trash2");
export const TrendingUp = make(trendingUpIcon, "TrendingUp");
export const TriangleAlert = make(triangleAlertIcon, "TriangleAlert");
export const Truck = make(truckIcon, "Truck");
export const User = make(userIcon, "User");
export const UserCog = make(userCogIcon, "UserCog");
export const UserPlus = make(userPlusIcon, "UserPlus");
export const UserRound = make(userRoundIcon, "UserRound");
export const Users = make(usersIcon, "Users");
export const Wallet = make(walletIcon, "Wallet");
export const Wifi = make(wifiIcon, "Wifi");
export const WifiOff = make(wifiOffIcon, "WifiOff");
export const X = make(xIcon, "X");
export const Zap = make(zapIcon, "Zap");
