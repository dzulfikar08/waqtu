/** Shapes returned by `/v1/circles` in services/api. User ids never appear: people are handles. */

export type Gender = "ikhwan" | "akhwat";
export type CircleLanguage = "id" | "en";
export type ReportReason = "spam" | "harassment" | "inappropriate" | "other";
export type MemberState = "active" | "paused";

export interface CirclesConfig {
  /** Server switch (DEV-12 flips it). When true the app shows the premium gate instead of circles. */
  requiresPremium: boolean;
  circleSize: { min: number; max: number };
  maxTextLength: number;
  maxAudioBytes: number;
  maxAudioSeconds: number;
  audioMimeTypes: string[];
  reactions: string[];
  reportReasons: ReportReason[];
  isAdmin: boolean;
}

export interface CircleProfile {
  handle: string;
  gender: Gender;
  language: CircleLanguage;
  tzOffsetHours: number;
  summaryOptIn: boolean;
  suspended: boolean;
}

export interface ProfileInput {
  handle: string;
  /** Required the first time; the server refuses to change it afterwards. */
  gender?: Gender;
  language: CircleLanguage;
  tzOffsetHours: number;
  summaryOptIn?: boolean;
}

export interface Circle {
  id: string;
  kind: "public" | "private";
  name: string | null;
  memberCount: number;
  ready: boolean;
  full: boolean;
  myStatus: MemberState;
  joinedAt: number;
  latestPostAt: number | null;
  inviteCode: string | null;
}

export interface JoinResult {
  circle: Circle;
  created: boolean;
  alreadyMember: boolean;
}

export interface WeeklySummary {
  weekEnd: string;
  countedDays: number;
  fardhOnTime: number;
  fardhJamaah: number;
  pages: number;
}

export interface PostMedia {
  id: string;
  mime: string;
  bytes: number;
  durationSeconds: number;
}

export interface Post {
  id: string;
  kind: "text" | "voice" | "summary";
  handle: string;
  mine: boolean;
  text: string | null;
  createdAt: number;
  halaqahDayId: string | null;
  media: PostMedia | null;
  summary: WeeklySummary | null;
  reactions: Record<string, number>;
  myReaction: string | null;
}

export interface Feed {
  posts: Post[];
  nextBefore: string | null;
}

export interface Block {
  id: string;
  handle: string;
  createdAt: number;
}

export interface NewPost {
  text?: string;
  mediaId?: string;
  halaqahDayId?: string;
}

export interface Report {
  target: "post" | "user";
  reason: ReportReason;
  note?: string;
}

/** A post with pending reports in `GET /v1/admin/circles/queue` (admins only, so user ids appear). */
export interface QueuePost {
  id: string;
  circleId: string;
  authorUserId: string;
  authorHandle: string;
  kind: Post["kind"];
  text: string | null;
  hidden: boolean;
  pendingReports: number;
  reasons: ReportReason[];
  createdAt: number;
}

/** A person with pending user reports in the admin queue. */
export interface QueueUser {
  userId: string;
  handle: string;
  suspended: boolean;
  pendingReports: number;
  reasons: ReportReason[];
}

export interface ModerationQueue {
  posts: QueuePost[];
  users: QueueUser[];
}

/** `hide` keeps the reports pending; `restore` unhides and dismisses them; `remove` is final. */
export type PostAction = "hide" | "restore" | "remove";
export type UserAction = "suspend" | "unsuspend" | "dismiss";
