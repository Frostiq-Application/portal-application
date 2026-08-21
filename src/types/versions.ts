/** Release notes — the platform's version log and its read receipts. */

export interface AppVersion {
  id: string;
  /** Dotted release number, e.g. "1.2.0". */
  version: string;
  title: string | null;
  /** Short labels for what moved — shown as chips on the card. */
  tags: string[];
  /** The release note itself, markdown. */
  notes: string;
  /** The uploaded .md, kept so the original can be downloaded. */
  fileUrl: string | null;
  fileName: string | null;
  releasedAt: string;
  isPublished: boolean;
  /** Whether reaching this version raises the What's new dialog. */
  notify: boolean;
  /** How many people have read the note. */
  seenCount: number;
  createdAt: string;
  updatedAt: string;
}

/** What the portal checks on load. */
export interface LatestVersion {
  id: string;
  version: string;
  title: string | null;
  tags: string[];
  notes: string;
  releasedAt: string;
  seen: boolean;
  notify: boolean;
}

/** One published release, as a portal user reads it back. */
export interface VersionHistoryItem {
  id: string;
  version: string;
  title: string | null;
  tags: string[];
  notes: string;
  releasedAt: string;
  /** Whether this user has already been shown its note. */
  seen: boolean;
}

export interface VersionView {
  userId: string;
  name: string;
  email: string;
  accountName: string | null;
  role: string;
  seenAt: string;
}

export interface VersionViews {
  seen: VersionView[];
  /** Active portal users who haven't seen it yet. */
  pending: number;
}

/** Fields the manager writes. `file` replaces the note when present. */
export interface VersionInput {
  version: string;
  title?: string;
  tags?: string[];
  notes?: string;
  releasedAt?: string;
  isPublished?: boolean;
  notify?: boolean;
  file?: File | null;
}
