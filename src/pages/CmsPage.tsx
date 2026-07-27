import { useState } from "react";
import { Images, Megaphone, Palette, Sparkles } from "@/components/ui/icons";
import { useAuth } from "@/hooks/useAuth";
import { isAccountAdmin } from "@/lib/roles";
import {
  useListAnnouncementsQuery,
  useListBannersQuery,
} from "@/features/api/cmsApi";
import { PageHeader } from "@/components/layout/PageHeader";
import { SegmentedStrip, type SegmentedItem } from "@/components/SegmentedStrip";
import { BannersTab } from "@/components/cms/BannersTab";
import { AnnouncementsTab } from "@/components/cms/AnnouncementsTab";
import { BrandTab } from "@/components/cms/BrandTab";
import { FeaturedTab } from "@/components/cms/FeaturedTab";

type CmsTab = "banners" | "announcements" | "featured" | "brand";

export function CmsPage() {
  const { role } = useAuth();
  const showBrand = isAccountAdmin(role);
  const [tab, setTab] = useState<CmsTab>("banners");

  // Light-weight counts for the tab pills (RTK dedupes with each tab's query).
  const { data: banners } = useListBannersQuery();
  const { data: announcements } = useListAnnouncementsQuery();

  const items: SegmentedItem<CmsTab>[] = [
    {
      value: "banners",
      label: "Banners",
      icon: Images,
      accent: "#3b82f6",
      count: banners?.length,
    },
    {
      value: "announcements",
      label: "Announcements",
      icon: Megaphone,
      accent: "#f59e0b",
      count: announcements?.length,
    },
    {
      value: "featured",
      label: "Featured",
      icon: Sparkles,
      accent: "#8b5cf6",
    },
    ...(showBrand
      ? [
          {
            value: "brand" as const,
            label: "Brand",
            icon: Palette,
            accent: "#10b981",
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Storefront CMS"
        description="Banners, announcements, featured products & brand content"
      />

      <SegmentedStrip
        value={tab}
        items={items}
        onChange={setTab}
        className="mb-6"
      />

      {tab === "banners" && <BannersTab />}
      {tab === "announcements" && <AnnouncementsTab />}
      {tab === "featured" && <FeaturedTab />}
      {tab === "brand" && showBrand && <BrandTab />}
    </>
  );
}
