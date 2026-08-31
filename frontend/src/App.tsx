import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Navigate, Link } from "react-router-dom";
import axios from "axios";
import {
  EMPTY_FAMILY,
  RELATED_TO_PARTNER,
  RELATED_TO_SELF,
  ensureFamilyMemberIds,
  getFamilyChildren,
  memberDisplayLabel,
  memberMemoryRef,
  memoryBelongsToMember,
  migrateRefsToMemberIds,
  newFamilyMemberId,
  normalizeFamilyData,
  relatedToLabel,
  type FamilyData,
  type FamilyMemberRecord,
} from "./lib/familyData";
import { RELATIONSHIP_PRESETS, classifyKinship, defaultRelatedToForRelationship, type LaidOutNode } from "./lib/familyTree";
import { GAMIFICATION_CHAT_VIDEO_PATH, mergeGamificationFaqItems } from "./lib/gamificationCard";
import { appPath, logUserActivity } from "./lib/userActivity";
import { levelName, defaultGamificationStatus, type GamificationStatus } from "./lib/userGamification";
import { API, LOCAL_DEMO_TOKEN, apiDetail, applyAuthUserName, fetchSubscriptionStatus, isBrowserLocalHost, isLocalDemoToken, clearAuthToken, getAuthToken, setAuthToken, logoutUser, type PlanEntitlements, type SubscriptionSnapshot, type VoiceQuota } from "./lib/authApi";
import { displayUppercase, nameInVocative } from "./lib/greekText";
import {
  getMilestonesForAgeMonths,
  getPregnancyMilestonesForWeek,
  getMilestoneBullets,
} from "./lib/milestones";
import { APP_ROUTE } from "./publicRoutes";
import { MemoriesTab } from "./components/memories/MemoriesTab";
import type { MemoryFormValues } from "./components/memories/AddMemoryModal";
import { FamilyTreePanel } from "./components/FamilyTreePanel";
import { FamilyDocumentsPanel } from "./components/FamilyDocumentsPanel";
import { MilestonesPanel } from "./components/MilestonesPanel";
import { normalizeDocEntries, type DocEntry } from "./lib/familyDocuments";
import {
  currentStageIdForChild,
  currentStageIdForPregnancy,
  isLegacyMilestoneChecksMap,
  migrateMilestoneChecksMap,
  setCheckForStage,
  type MilestoneChecksMap,
} from "./lib/milestoneTimeline";
import { InAppSubscriptionSheet } from "./components/InAppSubscriptionSheet";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./appResponsive.css";
import { useTranslation } from "react-i18next";
import type { HomeFaqItem } from "./i18n/homeTypes";
import { homeDisplayLocale } from "./i18n";
import {
  compressImageDataUrl,
  persistMemoriesDurable,
  safeLocalSet,
  pickRicherMemories,
  memoriesForCloud,
  localMemoriesRicherThanCloud,
  memoriesHavePhotos,
  parseMemoriesJson,
} from "./lib/memoriesSync";
import {
  buildMilestoneMemory,
  migrateLegacyMilestoneMemories,
  milestoneMemoryKey,
} from "./lib/milestoneMemories";
import {
  detectMemorySuggestion,
  findMatchingMilestoneIndex,
  mapApiMemorySuggestion,
  type MemorySuggestion,
} from "./lib/memorySuggestions";
import {
  attachmentPayloadForApi,
  fileToChatAttachment,
  MAX_CHAT_FILE_BYTES,
  type ChatAttachment,
} from "./lib/chatAttachments";
import {
  mergeCloudUserData,
  pruneOrphanJwtMemoryKeys,
  pruneOrphanJwtFamilyKeys,
  recoverAllLocalUserData,
  bootLocalScan,
  rehomeRecoveredData,
  stableSk,
  loadFamilyForToken,
  clearBootLocalScanCache,
} from "./lib/userDataRecovery";
import { normalizeAppLang, pickTranslated, writeStoredAppLang } from "./lib/appLang";
import { displaySelectedPlanSlot } from "./lib/subscriptionPlans";
import { voiceListenQuotaForSnapshot } from "./lib/voiceQuota";
import { chatContextDepth, memoryContextCount } from "./lib/planEntitlements";
import {
  canArchiveAnotherThread,
  featureAllowed,
  featureLabel,
  featureRequiredPlanLabel,
  nextUpgradePlanLabel,
} from "./lib/planFeatures";
import { FeatureUpgradeGate } from "./components/FeatureUpgradeGate";
import { useAutoHideTabBar } from "./lib/useAutoHideTabBar";
import { buildAppNotifications, readNotificationIds } from "./lib/appNotifications";
import { AppNotificationsBell, notificationSummaryLabel } from "./components/AppNotificationsBell";
import { AccountPrivacySheet } from "./components/AccountPrivacySheet";
import { ChatMedicalDisclaimer } from "./components/ChatMedicalDisclaimer";
import { AppDialog } from "./components/AppDialog";
import { DialogPanel } from "./components/ui/DialogPanel";
import { SheetHeader } from "./components/ui/SheetHeader";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ToastStack, type ToastKind, type ToastItem } from "./components/ToastStack";
import { AppTourGuide } from "./components/AppTourGuide";
import {
  APP_TOUR_STEPS,
  hasCompletedAppTour,
  markAppTourCompleted,
} from "./lib/appTour";
import { AppTrialBanner } from "./components/AppTrialBanner";
import { LevelUpRewardSheet } from "./components/LevelUpRewardSheet";
import { AccessExpiryModal } from "./components/AccessExpiryModal";
import { ProfileGamificationCard } from "./components/ProfileGamificationCard";
import {
  dismissExpiryPopup,
  getAccessExpiryInfo,
  readExpiryPopupDismissed,
} from "./lib/accessExpiry";
import type { PendingLevelReward, RewardsSnapshot } from "./lib/levelRewards";
import { dismissRewardLevel, firstUnseenPendingReward } from "./lib/levelRewards";
import { AppTabPageShell, AppTabSection } from "./components/AppTabPageShell";
import { LANGS as HOME_LANGS } from "./home/homeContent";
import { LanguageFlagOverlay } from "./components/LanguageFlagPicker";
import { AppNavIcon, ChatMicIcon, type AppNavTabId } from "./components/AppNavIcons";
import { PRIVACY_URL, TERMS_URL } from "./auth/authStrings";
import { AUTH_LOGO_SRC } from "./auth/authLogo";

export { HM_TOKEN_KEY } from "./lib/authStorage";

function HeyMaaAvatar({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: "0 4px 12px rgba(43,58,103,0.08)",
        background: "#fff",
      }}
    >
      <img
        src={AUTH_LOGO_SRC}
        alt="HeyMaa"
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scale(1.05)",
        }}
      />
    </div>
  );
}

function UserChatAvatar({
  size,
  name,
  photo,
}: {
  size: number;
  name: string;
  photo?: string | null;
}) {
  const initial = name.trim() ? name.trim().charAt(0).toUpperCase() : "?";
  if (photo) {
    return (
      <img
        src={photo}
        alt={name || "User"}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          display: "block",
          boxShadow: "0 4px 12px rgba(43,58,103,0.08)",
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#BEB4CD",
        color: "#2B3A67",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Sans',sans-serif",
        fontSize: Math.max(11, Math.round(size * 0.4)),
        fontWeight: 700,
        flexShrink: 0,
        boxShadow: "0 4px 12px rgba(43,58,103,0.08)",
      }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

type SyncProfileResult =
  | { ok: true }
  | { ok: false; authExpired?: boolean; error?: string };

async function syncProfileToSupabase(token: string, profile: Profile): Promise<SyncProfileResult> {
  if (isLocalDemoToken(token)) return { ok: true };
  const ch: ChildEntity[] = profile.children ||
    (profile.childBirthDate ? [{name: profile.childName||"", birthDate: profile.childBirthDate||""}] : []);
  const bds = ch.map((c: ChildEntity) => c.birthDate).filter((d: string) => d.length > 0);
  const pregnant = !!(profile.dueDate && profile.pregnancyStatus !== "completed");
  try {
    const res = await fetch(`${API}/profile/sync`, {
      method: "POST",
      headers: {"Content-Type": "application/json", "x-token": token},
      body: JSON.stringify({
        name: profile.name || null,
        phone: profile.phone || null,
        country: profile.country || null,
        city: profile.city || null,
        zip: profile.postalCode || null,
        address_street: profile.address || null,
        address_zip: profile.postalCode || null,
        address_city: profile.city || null,
        address_country: profile.country || "GR",
        child_count: ch.length,
        pregnancy_active: pregnant,
        children_birthdates: bds,
        consent_marketing: !!profile.consentMarketing,
        consent_date: profile.consentDate || null,
      }),
    });
    let body: { ok?: boolean; error?: string; detail?: unknown } = {};
    try { body = await res.json(); } catch { /* non-JSON */ }
    if (res.status === 401) {
      return {
        ok: false,
        authExpired: true,
        error: apiDetail(body, "Your session has expired or is not valid. Please sign in again."),
      };
    }
    if (!res.ok) {
      return { ok: false, error: apiDetail(body, res.statusText || "Request failed") };
    }
    if (body.ok === false) {
      return { ok: false, error: body.error || "Profile sync failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error" };
  }
}


let toastSeq = 0;

interface ChildEntity { name: string; birthDate: string; }
interface Profile { name: string; childName: string; childAge: string; childBirthDate?: string; lang: string; dueDate?: string; children?: ChildEntity[]; pregnancyStatus?: "active"|"awaiting_update"|"completed"; country?: string; consentMarketing?: boolean; consentDate?: string; address?: string; city?: string; postalCode?: string; phone?: string; }
interface Message {
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
  promo?: { title: string; body: string; link?: string | null; badge?: string; cta?: string | null } | null;
  memorySuggestion?: MemorySuggestion | null;
}
interface Memory { emoji: string; text: string; date: string; img?: string; video?: string; ref?: string; createdAt?: string; description?: string; source?: "manual" | "chat" | "milestone"; isMilestone?: boolean; milestoneKey?: string; }
interface Thread { id: string; title: string; date: string; messages: Message[]; }
const LANG_FLAG_EMOJI: Record<string, string> = {
  el: "🇬🇷", en: "🇬🇧", it: "🇮🇹", de: "🇩🇪", fr: "🇫🇷", es: "🇪🇸", ro: "🇷🇴",
  bg: "🇧🇬", pl: "🇵🇱", sr: "🇷🇸", ar: "🇸🇦", tr: "🇹🇷", zh: "🇨🇳", ja: "🇯🇵",
  ru: "🇷🇺", pt: "🇵🇹", nl: "🇳🇱",
};

const LANGS = HOME_LANGS.map((l) => ({
  c: l.code,
  f: LANG_FLAG_EMOJI[l.code] || "🌐",
  n: l.name,
  d: l.rtl ? "rtl" : "ltr",
  s: l.code.toUpperCase(),
}));

const COUNTRIES = [
  {code:"GR",name:"Greece"},{code:"CY",name:"Cyprus"},
  {code:"GB",name:"United Kingdom"},{code:"US",name:"United States"},{code:"AU",name:"Australia"},{code:"CA",name:"Canada"},{code:"IE",name:"Ireland"},
  {code:"SA",name:"Saudi Arabia"},{code:"AE",name:"UAE"},{code:"EG",name:"Egypt"},{code:"JO",name:"Jordan"},{code:"LB",name:"Lebanon"},{code:"MA",name:"Morocco"},
  {code:"CN",name:"China"},{code:"TW",name:"Taiwan"},{code:"HK",name:"Hong Kong"},
  {code:"ES",name:"Spain"},{code:"MX",name:"Mexico"},{code:"AR",name:"Argentina"},
  {code:"FR",name:"France"},{code:"BE",name:"Belgium"},
  {code:"RO",name:"Romania"},{code:"MD",name:"Moldova"},
  {code:"PL",name:"Poland"},{code:"TR",name:"Turkey"},{code:"IN",name:"India"},{code:"PK",name:"Pakistan"},{code:"JP",name:"Japan"},
  {code:"RU",name:"Russia"},{code:"UA",name:"Ukraine"},
  {code:"DE",name:"Germany"},{code:"AT",name:"Austria"},{code:"CH",name:"Switzerland"},
  {code:"BR",name:"Brazil"},{code:"PT",name:"Portugal"},{code:"IT",name:"Italy"},{code:"NL",name:"Netherlands"},
  {code:"BD",name:"Bangladesh"},{code:"ID",name:"Indonesia"},
  {code:"KE",name:"Kenya"},{code:"TZ",name:"Tanzania"},{code:"UG",name:"Uganda"},{code:"PH",name:"Philippines"},
  {code:"NZ",name:"New Zealand"},{code:"ZA",name:"South Africa"},{code:"NG",name:"Nigeria"},{code:"GH",name:"Ghana"},
  {code:"OTHER",name:"Other"},
];

function ageMonthsFromBirthDate(birthDateStr?: string): number | null {
  if (!birthDateStr) return null;
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

function openNativeDatePicker(input: HTMLInputElement | null) {
  if (!input) return;
  try {
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
  } catch {
    /* Some browsers block showPicker outside a direct gesture */
  }
  input.focus({ preventScroll: true });
  input.click();
}

function formatChildAge(birthDateStr: string | undefined, lang: string): string {
  const months = ageMonthsFromBirthDate(birthDateStr);
  if (months === null) return "";
  if (months < 1) {
    const birth = new Date(birthDateStr!);
    const days = Math.max(0, Math.floor((Date.now() - birth.getTime()) / 86400000));
    return `${days} ${t("unit_days", lang)}`;
  }
  if (months < 24) return `${months} ${t("unit_months", lang)}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years} ${t("unit_years", lang)} ${rem} ${t("unit_months", lang)}` : `${years} ${t("unit_years", lang)}`;
}

function pregnancyWeekFromDueDate(dueDateStr?: string): number | null {
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr);
  if (isNaN(due.getTime())) return null;
  const daysLeft = Math.round((due.getTime() - Date.now()) / 86400000);
  const gestDays = 280 - daysLeft;
  return Math.max(1, Math.min(42, Math.floor(gestDays / 7)));
}

function getAllChildren(profile: Profile): ChildEntity[] {
  if (profile.children && profile.children.length > 0) return profile.children;
  if (profile.childName) return [{ name: profile.childName, birthDate: profile.childBirthDate || "" }];
  return [];
}

function isDueDatePassed(dueDateStr?: string): boolean {
  if (!dueDateStr) return false;
  const due = new Date(dueDateStr);
  if (isNaN(due.getTime())) return false;
  return due.getTime() < Date.now();
}

function parseAgeMonths(ageStr: string): number {
  const s = ageStr.toLowerCase();
  const m = s.match(/(\d+)\s*(μήν|month|mese|mois|monat|mes|mies|maand|miesi|lun|ay|bulan|mwez|buwan|महीन|ماه|月|ヶ月|мес|місяц|tháng)/);
  if (m) return parseInt(m[1]);
  const w = s.match(/(\d+)\s*(εβδ|week|settim|semain|woch|semana|tygod|hafta|minggu|wiki|linggo|सप्त|هفت|周|週|нед|тижн|tuần)/);
  if (w) return Math.floor(parseInt(w[1]) / 4.3);
  const y = s.match(/(\d+)\s*(έτ|χρον|year|anno|an\b|jahr|año|rok|jaar|yıl|tahun|mwak|taon|साल|سال|岁|歳|год|рік|năm)/);
  if (y) return parseInt(y[1]) * 12;
  const n = parseInt(s); if (!isNaN(n)) return n;
  return 0;
}

const MILESTONE_RANGES: [number,number][] = [
  [0,1],[1,3],[2,4],[3,5],[4,6],[6,9],[9,12],[12,18],[18,24],[24,36]
];

const MILESTONE_TRANSLATIONS: Record<string, string[][]> = {
  el: [
    ["Αντιδρά σε δυνατούς ήχους","Εστιάζει σε κοντινά πρόσωπα","Βγάζει μικρούς ήχους από το λαιμό","Φέρνει τα χέρια στο πρόσωπο","Κουνά χέρια και πόδια συμμετρικά"],
    ["Χαμογελά κοινωνικά","Ακολουθεί κινούμενα αντικείμενα με τα μάτια","Σηκώνει λίγο το κεφάλι στο στομάχι","Βγάζει ήχους ευχαρίστησης","Αναγνωρίζει τη φωνή των γονιών","Αντιδρά στην αγκαλιά"],
    ["Κρατά το κεφάλι σταθερό όρθιο","Ανοίγει και κλείνει τα χεράκια","Χτυπά κρεμαστά αντικείμενα","Αρχίζει να μπαμπαΐζει","Γελά δυνατά","Παρατηρεί τα χεράκια του"],
    ["Κυλιέται από το στομάχι στην πλάτη","Κάθεται με υποστήριξη","Απλώνεται και αρπάζει αντικείμενα","Μπαμπαΐζει με σύμφωνα","Αναγνωρίζει γνωστά πρόσωπα","Μιμείται εκφράσεις προσώπου"],
    ["Κυλιέται και προς τις δύο κατευθύνσεις","Βάζει αντικείμενα στο στόμα","Μεταφέρει αντικείμενα χέρι-χέρι","Δείχνει ετοιμότητα για στερεά τροφή","Ανταποκρίνεται στο όνομά του","Παρακολουθεί καλά κινούμενα αντικείμενα"],
    ["Κάθεται χωρίς υποστήριξη","Σέρνεται ή μετακινείται","Τραβιέται όρθιο","Λέει μαμά ή μπαμπά","Χτυπά αντικείμενα μεταξύ τους","Αναπτύσσει άγχος ξένου","Τρώει μόνο του με τα δαχτυλάκια"],
    ["Στέκεται μόνο του στιγμιαία","Κάνει τα πρώτα βήματα","Δείχνει με το δείκτη","Λέει 1-2 λέξεις","Παίζει κρυφτό","Χρησιμοποιεί ποτήρι με βοήθεια","Μιμείται πράξεις και ήχους"],
    ["Περπατά ανεξάρτητα","Λέει 3-6 λέξεις","Ακολουθεί απλές οδηγίες","Στοιβάζει 2 τουβλάκια","Χαιρετά αντίο","Δείχνει πράγματα","Πίνει από ποτήρι"],
    ["Τρέχει σταθερά","Λέει 10-20 λέξεις","Συνδυάζει 2 λέξεις","Χρησιμοποιεί κουτάλι","Δείχνει μέρη του σώματος","Παίζει δίπλα σε άλλα παιδιά","Ανεβοκατεβαίνει έπιπλα"],
    ["Μιλά με προτάσεις 2-3 λέξεων","Πηδά με τα δύο πόδια","Κλωτσά μπάλα","Γυρίζει σελίδες βιβλίου","Ονομάζει εικόνες","Παίζει φανταστικά παιχνίδια","Καταλαβαίνει δικό μου και δικό σου"],
  ],
  en: [
    ["Responds to loud sounds","Focuses on faces close up","Makes small throaty noises","Brings hands to face","Moves arms and legs symmetrically"],
    ["Smiles socially at faces","Follows moving objects with eyes","Holds head up briefly on tummy","Makes cooing sounds","Recognises parent voice","Reacts to being held"],
    ["Holds head steady when held upright","Opens and closes hands","Bats at dangling objects","Begins to babble","Laughs out loud","Notices own hands"],
    ["Rolls from tummy to back","Sits with support","Reaches for and grasps objects","Babbles with consonant sounds","Recognises familiar faces","Imitates facial expressions"],
    ["Rolls in both directions","Brings objects to mouth","Transfers objects hand to hand","Ready for solid foods","Responds to own name","Tracks moving objects well"],
    ["Sits without support","Crawls or scoots","Pulls to stand","Says mama or dada","Bangs objects together","Develops stranger anxiety","Feeds self finger foods"],
    ["Stands momentarily alone","Takes first steps","Points with index finger","Says 1-2 words","Plays peek-a-boo","Uses cup with help","Imitates actions and sounds"],
    ["Walks independently","Says 3-6 words","Follows simple instructions","Stacks 2 blocks","Waves bye-bye","Points to show things","Drinks from a cup"],
    ["Runs steadily","Says 10-20 words","Combines 2 words","Uses spoon","Points to body parts","Plays alongside other children","Climbs on/off furniture"],
    ["Speaks in 2-3 word sentences","Jumps with both feet","Kicks a ball","Turns book pages","Names pictures in a book","Plays make-believe","Understands mine and yours"],
  ],
  ar: [
    ["يستجيب للأصوات العالية","يركز على الوجوه القريبة","يصدر أصواتاً صغيرة من حلقه","يضع يديه على وجهه","يحرك ذراعيه وساقيه بشكل متماثل"],
    ["يبتسم اجتماعياً","يتابع الأشياء المتحركة بعينيه","يرفع رأسه قليلاً على بطنه","يصدر أصوات مناغاة","يتعرف على صوت والديه","يستجيب للاحتضان"],
    ["يثبت رأسه عند حمله","يفتح ويغلق يديه","يضرب الأشياء المعلقة","يبدأ في المناغاة","يضحك بصوت عالٍ","يلاحظ يديه"],
    ["يتدحرج من البطن إلى الظهر","يجلس بمساعدة","يمد يده ويمسك الأشياء","يناغي بأصوات الحروف","يتعرف على الوجوه المألوفة","يقلد تعابير الوجه"],
    ["يتدحرج في كلا الاتجاهين","يضع الأشياء في فمه","ينقل الأشياء من يد لأخرى","مستعد للطعام الصلب","يستجيب لاسمه","يتابع الأشياء المتحركة جيداً"],
    ["يجلس بدون مساعدة","يزحف أو يتحرك","يسحب نفسه للوقوف","يقول ماما أو بابا","يدق الأشياء معاً","يطور قلق الغرباء","يأكل بأصابعه"],
    ["يقف لحظياً وحده","يخطو أولى خطواته","يشير بإصبعه","يقول كلمة أو كلمتين","يلعب الغميضة","يستخدم الكوب بمساعدة","يقلد الأفعال والأصوات"],
    ["يمشي باستقلالية","يقول ثلاث إلى ست كلمات","يتبع التعليمات البسيطة","يكدس مكعبين","يلوح للوداع","يشير للأشياء","يشرب من الكوب"],
    ["يركض بثبات","يقول عشر إلى عشرين كلمة","يجمع كلمتين","يستخدم الملعقة","يشير لأجزاء جسمه","يلعب بجانب أطفال آخرين","يتسلق الأثاث"],
    ["يتحدث بجمل قصيرة","يقفز بكلتا قدميه","يركل كرة","يقلب صفحات الكتاب","يسمي الصور","يلعب الخيال","يفهم مفهوم ملكيتي وملكيتك"],
  ],
  zh: [
    ["对大声音有反应","能聚焦于近距离的脸","发出小喉音","把手放到脸上","手脚对称移动"],
    ["对着脸社交性微笑","用眼睛跟踪移动物体","趴着时短暂抬头","发出咿呀声","认出父母的声音","对被抱起有反应"],
    ["竖抱时头部稳定","张开和握紧手","拍打悬挂物体","开始咿呀学语","大声笑","注意自己的手"],
    ["从肚子翻到背部","有支撑地坐","伸手抓取物体","用辅音咿呀","认出熟悉的脸","模仿面部表情"],
    ["向两侧翻滚","把物体放进嘴里","双手传递物体","准备好吃辅食","对自己的名字有反应","很好地追踪移动物体"],
    ["独立坐","爬行或挪动","拉着站起来","说妈妈或爸爸","把物体敲在一起","产生陌生人焦虑","自己用手指吃东西"],
    ["短暂独立站立","迈出第一步","用食指指向","说一两个词","玩捉迷藏","在帮助下使用杯子","模仿动作和声音"],
    ["独立行走","说几个词","遵循简单指令","堆积木","挥手再见","指向事物","用杯子喝水"],
    ["稳定跑步","说更多词汇","组合词语","使用勺子","指向身体部位","与其他孩子一起玩","爬上爬下家具"],
    ["说短句子","双脚跳","踢球","翻书页","说出图片名称","玩角色扮演","理解我的和你的"],
  ],
  es: [
    ["Responde a sonidos fuertes","Se enfoca en caras cercanas","Hace pequeños ruidos de garganta","Lleva manos a la cara","Mueve brazos y piernas simétricamente"],
    ["Sonríe socialmente","Sigue objetos en movimiento con los ojos","Levanta la cabeza brevemente boca abajo","Hace sonidos de arrullo","Reconoce la voz de los padres","Reacciona al ser cargado"],
    ["Sostiene la cabeza estable","Abre y cierra las manos","Golpea objetos colgantes","Empieza a balbucear","Se ríe en voz alta","Observa sus propias manos"],
    ["Rueda de boca abajo a boca arriba","Se sienta con apoyo","Alcanza y agarra objetos","Balbucea con consonantes","Reconoce caras familiares","Imita expresiones faciales"],
    ["Rueda en ambas direcciones","Lleva objetos a la boca","Transfiere objetos de mano en mano","Listo para alimentos sólidos","Responde a su nombre","Sigue objetos en movimiento bien"],
    ["Se sienta sin apoyo","Gatea o se arrastra","Se jala para pararse","Dice mamá o papá","Golpea objetos juntos","Desarrolla ansiedad ante extraños","Se alimenta con los dedos"],
    ["Se para momentáneamente solo","Da los primeros pasos","Señala con el dedo índice","Dice algunas palabras","Juega a las escondidas","Usa taza con ayuda","Imita acciones y sonidos"],
    ["Camina de forma independiente","Dice varias palabras","Sigue instrucciones simples","Apila bloques","Dice adiós con la mano","Señala para mostrar cosas","Bebe de una taza"],
    ["Corre establemente","Dice muchas palabras","Combina palabras","Usa cuchara","Señala partes del cuerpo","Juega junto a otros niños","Sube y baja muebles"],
    ["Habla en oraciones cortas","Salta con ambos pies","Patea una pelota","Pasa páginas de libros","Nombra imágenes","Juega a la fantasía","Entiende mío y tuyo"],
  ],
  fr: [
    ["Réagit aux sons forts","Se concentre sur les visages proches","Fait de petits bruits de gorge","Porte les mains au visage","Bouge les bras et jambes symétriquement"],
    ["Sourit socialement","Suit des objets en mouvement des yeux","Lève brièvement la tête sur le ventre","Fait des sons de roucoulement","Reconnaît la voix des parents","Réagit au fait d'être tenu"],
    ["Tient la tête stable","Ouvre et ferme les mains","Frappe les objets suspendus","Commence à babiller","Rit aux éclats","Remarque ses propres mains"],
    ["Roule du ventre au dos","S'assoit avec soutien","Attrape et saisit des objets","Babille avec des consonnes","Reconnaît des visages familiers","Imite les expressions du visage"],
    ["Roule dans les deux sens","Porte des objets à la bouche","Transfère des objets de main en main","Prêt pour les aliments solides","Répond à son prénom","Suit bien les objets en mouvement"],
    ["S'assoit sans soutien","Rampe ou se déplace","Se tire debout","Dit maman ou papa","Frappe des objets ensemble","Développe l'anxiété des étrangers","Se nourrit avec les doigts"],
    ["Se tient debout momentanément","Fait ses premiers pas","Pointe avec l'index","Dit quelques mots","Joue à cache-cache","Utilise une tasse avec aide","Imite des actions et sons"],
    ["Marche de façon autonome","Dit plusieurs mots","Suit des instructions simples","Empile des blocs","Fait au revoir","Pointe pour montrer","Boit dans une tasse"],
    ["Court régulièrement","Dit beaucoup de mots","Combine des mots","Utilise une cuillère","Pointe les parties du corps","Joue avec d'autres enfants","Monte et descend des meubles"],
    ["Parle en phrases courtes","Saute avec les deux pieds","Botte un ballon","Tourne les pages","Nomme des images","Joue à faire semblant","Comprend le mien et le tien"],
  ],
  de: [
    ["Reagiert auf laute Geräusche","Fokussiert auf nahe Gesichter","Macht kleine Kehlgeräusche","Bringt Hände zum Gesicht","Bewegt Arme und Beine symmetrisch"],
    ["Lächelt sozial","Verfolgt bewegende Objekte mit Augen","Hebt kurz den Kopf auf dem Bauch","Macht Gurren-Geräusche","Erkennt die Stimme der Eltern","Reagiert auf Halten"],
    ["Hält Kopf stabil aufrecht","Öffnet und schließt Hände","Schlägt hängende Objekte","Fängt an zu plappern","Lacht laut","Bemerkt eigene Hände"],
    ["Rollt von Bauch auf Rücken","Sitzt mit Unterstützung","Greift nach Objekten","Plappern mit Konsonanten","Erkennt bekannte Gesichter","Imitiert Gesichtsausdrücke"],
    ["Rollt in beide Richtungen","Bringt Objekte zum Mund","Übergibt Objekte Hand zu Hand","Bereit für Beikost","Reagiert auf eigenen Namen","Verfolgt bewegende Objekte gut"],
    ["Sitzt ohne Unterstützung","Krabbelt oder robbt","Zieht sich zum Stehen","Sagt Mama oder Papa","Schlägt Objekte zusammen","Entwickelt Fremdenangst","Isst selbst mit Fingern"],
    ["Steht kurz allein","Macht erste Schritte","Zeigt mit dem Zeigefinger","Sagt einige Wörter","Spielt Kuckuck","Nutzt Tasse mit Hilfe","Imitiert Handlungen und Geräusche"],
    ["Geht selbstständig","Sagt mehrere Wörter","Befolgt einfache Anweisungen","Stapelt Blöcke","Winkt tschüss","Zeigt auf Dinge","Trinkt aus Tasse"],
    ["Läuft gleichmäßig","Sagt viele Wörter","Kombiniert Wörter","Nutzt Löffel","Zeigt Körperteile","Spielt neben anderen Kindern","Klettert auf Möbel"],
    ["Spricht in kurzen Sätzen","Springt mit beiden Beinen","Kickt einen Ball","Dreht Buchseiten","Benennt Bilder","Spielt Phantasiespiele","Versteht meins und deins"],
  ],
  pt: [
    ["Responde a sons altos","Foca em rostos próximos","Faz pequenos sons guturais","Leva mãos ao rosto","Move braços e pernas simetricamente"],
    ["Sorri socialmente","Segue objetos em movimento com os olhos","Levanta a cabeça brevemente de bruços","Faz sons de arrullo","Reconhece a voz dos pais","Reage a ser segurado"],
    ["Mantém a cabeça estável","Abre e fecha as mãos","Bate em objetos pendurados","Começa a balbuciar","Ri em voz alta","Nota as próprias mãos"],
    ["Rola de bruços para as costas","Senta com apoio","Estende-se e agarra objetos","Balbucia com consoantes","Reconhece rostos familiares","Imita expressões faciais"],
    ["Rola em ambas as direções","Leva objetos à boca","Transfere objetos de mão em mão","Pronto para sólidos","Responde ao próprio nome","Segue objetos em movimento"],
    ["Senta sem apoio","Engatinha ou se arrasta","Puxa-se para ficar de pé","Diz mamã ou papá","Bate objetos juntos","Desenvolve ansiedade com estranhos","Come com os dedos"],
    ["Fica de pé momentaneamente","Dá os primeiros passos","Aponta com o dedo indicador","Diz algumas palavras","Brinca de esconde-esconde","Usa copo com ajuda","Imita ações e sons"],
    ["Anda de forma independente","Diz várias palavras","Segue instruções simples","Empilha blocos","Acena tchau","Aponta para mostrar","Bebe de um copo"],
    ["Corre firmemente","Diz muitas palavras","Combina palavras","Usa colher","Aponta partes do corpo","Brinca ao lado de outras crianças","Sobe e desce móveis"],
    ["Fala em frases curtas","Salta com os dois pés","Chuta uma bola","Vira páginas de livros","Nomeia imagens","Brinca de faz-de-conta","Entende meu e seu"],
  ],
  it: [
    ["Risponde ai suoni forti","Si concentra sui visi vicini","Fa piccoli rumori di gola","Porta le mani al viso","Muove braccia e gambe simmetricamente"],
    ["Sorride socialmente","Segue gli oggetti in movimento con gli occhi","Solleva brevemente la testa a pancia in giù","Fa suoni di tubare","Riconosce la voce dei genitori","Reagisce all'essere tenuto"],
    ["Tiene la testa ferma","Apre e chiude le mani","Colpisce gli oggetti appesi","Inizia a balbettare","Ride forte","Nota le proprie mani"],
    ["Rotola dalla pancia alla schiena","Si siede con supporto","Si allunga e afferra oggetti","Balbetta con consonanti","Riconosce visi familiari","Imita le espressioni del viso"],
    ["Rotola in entrambe le direzioni","Porta oggetti alla bocca","Trasferisce oggetti da mano a mano","Pronto per i cibi solidi","Risponde al proprio nome","Segue bene gli oggetti in movimento"],
    ["Si siede senza supporto","Gattonа o striscia","Si tira in piedi","Dice mamma o papà","Batte oggetti insieme","Sviluppa ansia da estranei","Si nutre con le dita"],
    ["Sta in piedi momentaneamente","Fa i primi passi","Indica con il dito indice","Dice alcune parole","Gioca a nascondino","Usa il bicchiere con aiuto","Imita azioni e suoni"],
    ["Cammina in modo indipendente","Dice diverse parole","Segue istruzioni semplici","Impila blocchi","Fa ciao con la mano","Indica per mostrare","Beve da un bicchiere"],
    ["Corre stabilmente","Dice molte parole","Combina parole","Usa il cucchiaio","Indica le parti del corpo","Gioca accanto ad altri bambini","Sale e scende dai mobili"],
    ["Parla in frasi brevi","Salta con entrambi i piedi","Calcia un pallone","Gira le pagine dei libri","Nomina le immagini","Gioca a far finta","Capisce mio e tuo"],
  ],
  ru: [
    ["Реагирует на громкие звуки","Фокусируется на близких лицах","Издаёт маленькие горловые звуки","Подносит руки к лицу","Двигает руками и ногами симметрично"],
    ["Социально улыбается","Следит за движущимися объектами","Кратко поднимает голову лёжа на животе","Издаёт воркующие звуки","Узнаёт голос родителей","Реагирует на объятия"],
    ["Держит голову устойчиво","Открывает и закрывает руки","Бьёт по подвешенным предметам","Начинает лепетать","Смеётся громко","Замечает собственные руки"],
    ["Переворачивается с живота на спину","Сидит с поддержкой","Тянется и хватает предметы","Лепечет с согласными","Узнаёт знакомые лица","Имитирует выражения лица"],
    ["Переворачивается в обоих направлениях","Тянет предметы в рот","Перекладывает предметы из руки в руку","Готов к прикорму","Откликается на своё имя","Хорошо следит за движущимися объектами"],
    ["Сидит без поддержки","Ползает или передвигается","Подтягивается стоять","Говорит мама или папа","Стучит предметами","Развивается тревога перед чужими","Кормит себя пальцами"],
    ["Стоит мгновенно самостоятельно","Делает первые шаги","Указывает указательным пальцем","Говорит несколько слов","Играет в прятки","Пользуется кружкой с помощью","Имитирует действия и звуки"],
    ["Ходит самостоятельно","Говорит много слов","Выполняет простые инструкции","Складывает кубики","Машет пока","Указывает чтобы показать","Пьёт из кружки"],
    ["Бегает устойчиво","Говорит всё больше слов","Комбинирует слова","Пользуется ложкой","Указывает части тела","Играет рядом с другими детьми","Залезает на мебель"],
    ["Говорит короткими предложениями","Прыгает двумя ногами","Пинает мяч","Переворачивает страницы","Называет картинки","Играет в воображаемые игры","Понимает моё и твоё"],
  ],
  tr: [
    ["Yüksek seslere tepki verir","Yakın yüzlere odaklanır","Küçük boğaz sesleri çıkarır","Ellerini yüzüne götürür","Kollarını ve bacaklarını simetrik hareket ettirir"],
    ["Sosyal gülümseme yapar","Gözleriyle hareketli nesneleri takip eder","Karnında kısa süre başını kaldırır","Guguldama sesleri çıkarır","Ebeveynlerin sesini tanır","Tutulmaya tepki verir"],
    ["Dik tutulunca başını sabit tutar","Ellerini açıp kapatır","Asılı nesnelere vurur","Babıldamaya başlar","Yüksek sesle güler","Kendi ellerini fark eder"],
    ["Karından sırta yuvarlanır","Destekle oturur","Nesnelere uzanır ve kavrar","Ünsüzlerle babıldar","Tanıdık yüzleri tanır","Yüz ifadelerini taklit eder"],
    ["Her iki yönde yuvarlanır","Nesneleri ağzına götürür","Nesneleri elden ele aktarır","Katı gıdalara hazır","Kendi adına tepki verir","Hareketli nesneleri iyi takip eder"],
    ["Desteksiz oturur","Emekler veya kayar","Ayağa kalkmak için çeker","Mama veya baba der","Nesneleri birbirine vurur","Yabancı kaygısı gelişir","Kendi kendine parmak yiyecek yer"],
    ["Anlık tek başına durur","İlk adımlarını atar","İşaret parmağıyla gösterir","Birkaç kelime söyler","Saklambaç oynar","Yardımla bardak kullanır","Eylemleri ve sesleri taklit eder"],
    ["Bağımsız yürür","Birçok kelime söyler","Basit talimatları takip eder","Blok üst üste koyar","Hoşça kal için el sallar","Göstermek için işaret eder","Bardaktan içer"],
    ["Düzenli koşar","Çok kelime söyler","Kelimeleri birleştirir","Kaşık kullanır","Vücut parçalarını gösterir","Diğer çocukların yanında oynar","Mobilyalara çıkar"],
    ["Kısa cümleler kurar","İki ayakla zıplar","Topa vurur","Kitap sayfası çevirir","Resimleri adlandırır","Hayal oyunu oynar","Benimki ve seninki kavramını anlar"],
  ],
  hi: [
    ["तेज आवाजों पर प्रतिक्रिया देता है","पास के चेहरों पर ध्यान देता है","छोटी गले की आवाजें निकालता है","हाथ चेहरे पर लाता है","हाथ-पैर सममित रूप से हिलाता है"],
    ["सामाजिक मुस्कान देता है","आंखों से चलती वस्तुओं को देखता है","पेट के बल सिर थोड़ा उठाता है","गुनगुनाता है","माता-पिता की आवाज पहचानता है","गोद में रहने पर प्रतिक्रिया देता है"],
    ["सिर स्थिर रखता है","हाथ खोलता-बंद करता है","लटकती चीजों को मारता है","बोलने की शुरुआत करता है","जोर से हंसता है","अपने हाथ देखता है"],
    ["पेट से पीठ पर लुढ़कता है","सहारे से बैठता है","वस्तु पकड़ने की कोशिश करता है","व्यंजन ध्वनियों के साथ बोलता है","जाने-पहचाने चेहरे पहचानता है","चेहरे के भाव नकल करता है"],
    ["दोनों दिशाओं में लुढ़कता है","मुंह में वस्तु डालता है","एक हाथ से दूसरे में वस्तु देता है","ठोस आहार के लिए तैयार है","अपने नाम पर प्रतिक्रिया देता है","चलती वस्तुओं को अच्छे से देखता है"],
    ["बिना सहारे बैठता है","रेंगता है","खड़े होने के लिए खिंचाव करता है","माँ या पापा कहता है","वस्तुएं एक साथ ठोकता है","अजनबी से डरता है","उंगलियों से खाता है"],
    ["क्षण भर अकेले खड़ा होता है","पहले कदम उठाता है","उंगली से इशारा करता है","कुछ शब्द बोलता है","आँख-मिचौनी खेलता है","मदद से कप उपयोग करता है","क्रियाओं और ध्वनियों की नकल करता है"],
    ["स्वतंत्र रूप से चलता है","कई शब्द बोलता है","सरल निर्देश मानता है","ब्लॉक रखता है","अलविदा हाथ हिलाता है","चीजें दिखाने के लिए इशारा करता है","कप से पीता है"],
    ["स्थिर दौड़ता है","बहुत शब्द बोलता है","शब्द जोड़ता है","चम्मच उपयोग करता है","शरीर के अंग बताता है","अन्य बच्चों के साथ खेलता है","फर्नीचर पर चढ़ता है"],
    ["छोटे वाक्य बोलता है","दोनों पैरों से कूदता है","गेंद लात मारता है","किताब के पन्ने पलटता है","तस्वीरें नाम बताता है","कल्पना खेल खेलता है","मेरा और तुम्हारा समझता है"],
  ],
  ur: [
    ["تیز آوازوں پر ردعمل دیتا ہے","قریبی چہروں پر توجہ دیتا ہے","چھوٹی گلے کی آوازیں نکالتا ہے","ہاتھ چہرے پر لاتا ہے","بازو پاؤں یکساں حرکت کرتے ہیں"],
    ["سماجی مسکراہٹ دیتا ہے","آنکھوں سے حرکت کرتی اشیاء دیکھتا ہے","پیٹ کے بل سر اٹھاتا ہے","گنگناتا ہے","والدین کی آواز پہچانتا ہے","گود میں ہونے پر ردعمل دیتا ہے"],
    ["سر مستحکم رکھتا ہے","ہاتھ کھولتا بند کرتا ہے","لٹکتی چیزوں کو مارتا ہے","بولنا شروع کرتا ہے","زور سے ہنستا ہے","اپنے ہاتھ دیکھتا ہے"],
    ["پیٹ سے پیٹھ پر لڑھکتا ہے","سہارے سے بیٹھتا ہے","چیز پکڑتا ہے","حروف کے ساتھ بولتا ہے","جانے پہچانے چہرے پہچانتا ہے","چہرے کی نقل کرتا ہے"],
    ["دونوں طرف لڑھکتا ہے","منہ میں چیز ڈالتا ہے","ایک ہاتھ سے دوسرے میں چیز دیتا ہے","ٹھوس خوراک کے لیے تیار ہے","اپنے نام پر ردعمل دیتا ہے","حرکت کرتی چیزیں دیکھتا ہے"],
    ["بغیر سہارے بیٹھتا ہے","گھٹنوں کے بل چلتا ہے","کھڑے ہونے کی کوشش کرتا ہے","ماما یا بابا کہتا ہے","چیزیں ٹکراتا ہے","اجنبی سے خوف رکھتا ہے","انگلیوں سے کھاتا ہے"],
    ["لمحے کھڑا ہوتا ہے","پہلے قدم اٹھاتا ہے","انگلی سے اشارہ کرتا ہے","کچھ الفاظ بولتا ہے","آنکھ مچولی کھیلتا ہے","مدد سے کپ استعمال کرتا ہے","حرکات کی نقل کرتا ہے"],
    ["آزادانہ چلتا ہے","کئی الفاظ بولتا ہے","سادہ ہدایات مانتا ہے","بلاک رکھتا ہے","خداحافظ ہاتھ ہلاتا ہے","اشارہ کرتا ہے","کپ سے پیتا ہے"],
    ["مستحکم دوڑتا ہے","بہت الفاظ بولتا ہے","الفاظ ملاتا ہے","چمچ استعمال کرتا ہے","جسم کے حصے دکھاتا ہے","دوسرے بچوں کے ساتھ کھیلتا ہے","فرنیچر پر چڑھتا ہے"],
    ["مختصر جملے بولتا ہے","دونوں پاؤں سے کودتا ہے","گیند کو لات مارتا ہے","کتاب کے صفحے پلٹتا ہے","تصویریں نام بتاتا ہے","خیالی کھیل کھیلتا ہے","میرا اور تمہارا سمجھتا ہے"],
  ],
  ja: [
    ["大きな音に反応する","近くの顔に集中する","小さな喉の音を出す","手を顔に持ってくる","手足を対称的に動かす"],
    ["社会的に笑顔になる","動く物を目で追う","うつぶせで頭を少し上げる","クーイングをする","親の声を認識する","抱っこに反応する"],
    ["縦抱きで頭が安定する","手を開いたり閉じたりする","ぶら下がっているものを叩く","喃語を始める","声を出して笑う","自分の手に気づく"],
    ["うつぶせから仰向けに転がる","支えがあれば座る","物に手を伸ばしてつかむ","子音を使った喃語","見慣れた顔を認識する","表情を真似する"],
    ["両方向に転がる","物を口に持っていく","物を手から手へ移す","離乳食の準備ができる","自分の名前に反応する","動く物をよく追う"],
    ["支えなしで座る","ハイハイする","つかまり立ちをする","ママまたはパパという","物を叩き合わせる","人見知りが始まる","手づかみ食べをする"],
    ["一時的に一人で立つ","初めて歩く","人差し指で指差す","いくつかの言葉を話す","いないいないばあで遊ぶ","助けを借りてカップを使う","行動や音を真似する"],
    ["一人で歩く","たくさんの言葉を話す","簡単な指示に従う","ブロックを積む","バイバイをする","物を指差して示す","カップから飲む"],
    ["安定して走る","ますます言葉が増える","言葉を組み合わせる","スプーンを使う","体の部位を指す","他の子どもと並んで遊ぶ","家具に登り降りする"],
    ["短い文を話す","両足でジャンプする","ボールを蹴る","本のページをめくる","絵本の絵の名前を言う","ごっこ遊びをする","自分のものと相手のものを理解する"],
  ],
  nl: [
    ["Reageert op harde geluiden","Focust op dichtbij gezichten","Maakt kleine keelgeluiden","Brengt handen naar gezicht","Beweegt armen en benen symmetrisch"],
    ["Lacht sociaal","Volgt bewegende objecten met ogen","Heft hoofd kort op buik","Maakt koerende geluiden","Herkent stem van ouders","Reageert op vastgehouden worden"],
    ["Houdt hoofd stabiel rechtop","Opent en sluit handen","Slaat hangende objecten","Begint te brabbelen","Lacht hardop","Merkt eigen handen op"],
    ["Rolt van buik naar rug","Zit met ondersteuning","Reikt naar en pakt objecten","Brabbelt met medeklinkers","Herkent bekende gezichten","Imiteert gezichtsuitdrukkingen"],
    ["Rolt in beide richtingen","Brengt objecten naar mond","Draagt objecten van hand tot hand","Klaar voor vaste voeding","Reageert op eigen naam","Volgt bewegende objecten goed"],
    ["Zit zonder ondersteuning","Kruipt of beweegt","Trekt zichzelf omhoog","Zegt mama of papa","Slaat objecten samen","Ontwikkelt vreemdelingenangst","Eet zelf met vingers"],
    ["Staat kort alleen","Zet eerste stappen","Wijst met wijsvinger","Zegt enkele woorden","Speelt verstoppertje","Gebruikt beker met hulp","Imiteert acties en geluiden"],
    ["Loopt zelfstandig","Zegt meerdere woorden","Volgt eenvoudige instructies","Stapelt blokken","Zwaait doei","Wijst om dingen te tonen","Drinkt uit beker"],
    ["Rent stabiel","Zegt veel woorden","Combineert woorden","Gebruikt lepel","Wijst lichaamsonderdelen","Speelt naast andere kinderen","Klimt op meubilair"],
    ["Spreekt in korte zinnen","Springt met beide voeten","Schopt een bal","Draait boekpagina's","Noemt afbeeldingen","Speelt fantasiespelletjes","Begrijpt van mij en van jou"],
  ],
  pl: [
    ["Reaguje na głośne dźwięki","Skupia się na bliskich twarzach","Wydaje małe dźwięki gardłowe","Przynosi ręce do twarzy","Porusza ramionami i nogami symetrycznie"],
    ["Uśmiecha się społecznie","Śledzi wzrokiem poruszające się obiekty","Krótko unosi głowę na brzuchu","Wydaje gruchające dźwięki","Rozpoznaje głos rodziców","Reaguje na bycie trzymanym"],
    ["Trzyma głowę stabilnie","Otwiera i zamyka rączki","Uderza w wiszące obiekty","Zaczyna gaworzyć","Śmieje się głośno","Zauważa własne rączki"],
    ["Obraca się z brzucha na plecy","Siedzi z podparciem","Sięga i chwyta przedmioty","Gawory z spółgłoskami","Rozpoznaje znane twarze","Naśladuje mimikę"],
    ["Obraca się w obu kierunkach","Wkłada obiekty do ust","Przekłada przedmioty z ręki do ręki","Gotowy na pokarmy stałe","Reaguje na własne imię","Dobrze śledzi poruszające się obiekty"],
    ["Siedzi bez podparca","Raczkuje lub czołga się","Podciąga się do stania","Mówi mama lub tata","Uderza przedmiotami","Rozwija lęk przed obcymi","Samodzielnie je paluszkami"],
    ["Stoi chwilowo samotnie","Stawia pierwsze kroki","Wskazuje palcem wskazującym","Mówi kilka słów","Bawi się w chowanego","Używa kubka z pomocą","Naśladuje czynności i dźwięki"],
    ["Chodzi samodzielnie","Mówi wiele słów","Wykonuje proste polecenia","Układa klocki","Macha na do widzenia","Wskazuje by pokazać","Pije z kubka"],
    ["Biega równomiernie","Mówi coraz więcej słów","Łączy słowa","Używa łyżki","Wskazuje części ciała","Bawi się obok innych dzieci","Wspina się na meble"],
    ["Mówi krótkimi zdaniami","Skacze obiema nogami","Kopie piłkę","Obraca strony książki","Nazywa obrazki","Bawi się w udawanie","Rozumie moje i twoje"],
  ],
  ro: [
    ["Răspunde la sunete puternice","Se concentrează pe fețe apropiate","Face zgomote mici de gât","Aduce mâinile la față","Mișcă brațele și picioarele simetric"],
    ["Zâmbește social","Urmărește obiectele în mișcare cu ochii","Ridică scurt capul pe burtă","Face sunete de gângurit","Recunoaște vocea părinților","Reacționează la a fi ținut"],
    ["Ține capul stabil","Deschide și închide mâinile","Lovește obiectele agățate","Începe să gângurească","Râde cu voce tare","Observă propriile mâini"],
    ["Se rostogolește de pe burtă pe spate","Stă cu sprijin","Se întinde și apucă obiecte","Gângurește cu consoane","Recunoaște fețe familiare","Imită expresiile feței"],
    ["Se rostogolește în ambele direcții","Aduce obiecte la gură","Transferă obiecte din mână în mână","Pregătit pentru alimente solide","Răspunde la propriul nume","Urmărește bine obiectele în mișcare"],
    ["Stă fără sprijin","Se târăște sau se mișcă","Se ridică în picioare","Spune mama sau tata","Lovește obiectele împreună","Dezvoltă anxietate față de străini","Se hrănește cu degetele"],
    ["Stă în picioare momentan singur","Face primii pași","Arată cu degetul arătător","Spune câteva cuvinte","Se joacă de-a v-ați ascunselea","Folosește cana cu ajutor","Imită acțiuni și sunete"],
    ["Merge independent","Spune multe cuvinte","Urmează instrucțiuni simple","Stivuiește blocuri","Face cu mâna la revedere","Arată pentru a indica","Bea dintr-o cană"],
    ["Aleargă stabil","Spune tot mai multe cuvinte","Combină cuvinte","Folosește lingura","Arată părțile corpului","Se joacă lângă alți copii","Se cațără pe mobilă"],
    ["Vorbește în propoziții scurte","Sare cu ambele picioare","Lovește o minge","Întoarce paginile cărții","Numește imaginile","Se joacă de-a imaginarul","Înțelege al meu și al tău"],
  ],
  bn: [
    ["জোরে শব্দে সাড়া দেয়","কাছের মুখে মনোযোগ দেয়","ছোট গলার শব্দ করে","মুখে হাত আনে","হাত-পা সমান্তরালভাবে নাড়ায়"],
    ["সামাজিকভাবে হাসে","চলমান বস্তু চোখে অনুসরণ করে","পেটে শুয়ে মাথা তোলে","গুনগুন করে","বাবা-মায়ের কণ্ঠস্বর চেনে","কোলে নেওয়ায় সাড়া দেয়"],
    ["সোজা রাখলে মাথা স্থির রাখে","হাত খোলে-বন্ধ করে","ঝুলন্ত বস্তু মারে","বকবক শুরু করে","জোরে হাসে","নিজের হাত খেয়াল করে"],
    ["পেট থেকে পিঠে গড়িয়ে যায়","সাহায্যে বসে","বস্তু ধরতে হাত বাড়ায়","ব্যঞ্জনধ্বনি দিয়ে বকবক","পরিচিত মুখ চেনে","মুখভঙ্গি নকল করে"],
    ["দুই দিকে গড়াতে পারে","বস্তু মুখে নেয়","এক হাত থেকে অন্য হাতে","শক্ত খাবারের জন্য প্রস্তুত","নিজের নামে সাড়া দেয়","চলমান বস্তু ভালো দেখে"],
    ["সাহায্য ছাড়া বসে","হামাগুড়ি দেয়","উঠে দাঁড়ায়","মামা বা বাবা বলে","বস্তু একসাথে ঠোকে","অপরিচিতদের ভয়","আঙুলে খাবার খায়"],
    ["মুহূর্তের জন্য একা দাঁড়ায়","প্রথম পদক্ষেপ নেয়","তর্জনী দিয়ে দেখায়","কিছু শব্দ বলে","লুকোচুরি খেলে","সাহায্যে কাপ ব্যবহার","কাজ ও শব্দ নকল করে"],
    ["স্বাধীনভাবে হাঁটে","অনেক শব্দ বলে","সহজ নির্দেশ মানে","ব্লক সাজায়","বিদায়ে হাত নাড়ায়","দেখাতে ইশারা করে","কাপ থেকে পান করে"],
    ["স্থির দৌড়ায়","আরও শব্দ বলে","শব্দ মেলায়","চামচ ব্যবহার করে","শরীরের অংশ দেখায়","অন্য শিশুদের পাশে খেলে","আসবাবে ওঠে"],
    ["ছোট বাক্য বলে","দুই পায়ে লাফ দেয়","বল লাথি মারে","বইয়ের পাতা উল্টায়","ছবির নাম বলে","কল্পনার খেলা খেলে","আমার ও তোমার বোঝে"],
  ],
  id: [
    ["Bereaksi terhadap suara keras","Fokus pada wajah dekat","Membuat suara kecil di tenggorokan","Membawa tangan ke wajah","Menggerakkan lengan dan kaki simetris"],
    ["Tersenyum secara sosial","Mengikuti objek bergerak dengan mata","Mengangkat kepala sebentar tengkurap","Membuat suara mendekut","Mengenali suara orang tua","Bereaksi saat dipegang"],
    ["Menahan kepala stabil","Membuka dan menutup tangan","Memukul objek gantung","Mulai mengoceh","Tertawa keras","Memperhatikan tangannya sendiri"],
    ["Berguling dari perut ke punggung","Duduk dengan dukungan","Meraih dan menggenggam objek","Mengoceh dengan konsonan","Mengenali wajah familiar","Meniru ekspresi wajah"],
    ["Berguling dua arah","Membawa objek ke mulut","Memindahkan objek dari tangan ke tangan","Siap untuk makanan padat","Merespons namanya","Melacak objek bergerak"],
    ["Duduk tanpa dukungan","Merangkak atau bergerak","Menarik diri untuk berdiri","Mengucapkan mama atau papa","Membenturkan objek","Mengembangkan kecemasan orang asing","Makan sendiri dengan jari"],
    ["Berdiri sebentar sendiri","Mengambil langkah pertama","Menunjuk dengan jari telunjuk","Mengucapkan beberapa kata","Bermain petak umpet","Menggunakan cangkir dengan bantuan","Meniru tindakan dan suara"],
    ["Berjalan mandiri","Mengucapkan banyak kata","Mengikuti instruksi sederhana","Menumpuk balok","Melambaikan tangan selamat tinggal","Menunjuk untuk menunjukkan","Minum dari cangkir"],
    ["Berlari stabil","Mengucapkan semakin banyak kata","Menggabungkan kata","Menggunakan sendok","Menunjuk bagian tubuh","Bermain di samping anak lain","Memanjat furnitur"],
    ["Berbicara dalam kalimat pendek","Melompat dengan kedua kaki","Menendang bola","Membalik halaman buku","Menyebutkan gambar","Bermain berpura-pura","Memahami milikku dan milikmu"],
  ],
  sw: [
    ["Hujibu sauti kali","Huzingatia nyuso za karibu","Hutoa sauti ndogo za koo","Hupeleka mikono usoni","Huhamisha mikono na miguu kwa ulinganifu"],
    ["Hutabasamu kijamii","Hufuatilia vitu vinavyosogea kwa macho","Huinua kichwa kidogo akiwa tumbo chini","Hutoa sauti za kuimba","Hutambua sauti za wazazi","Hujibu anaposhikiliwa"],
    ["Hushikilia kichwa imara","Hufungua na kufunga mikono","Hupiga vitu vilivyoning'inia","Huanza kupiga kelele","Hucheka kwa sauti","Huona mikono yake mwenyewe"],
    ["Hugeuza kutoka tumbo hadi mgongoni","Hukaa na msaada","Hunyosha na kushika vitu","Hupiga kelele na konsonanti","Hutambua nyuso zinazojulikana","Huigiza sura za uso"],
    ["Hugeuza pande zote mbili","Hupeleka vitu mdomoni","Huhamisha vitu kutoka mkono mmoja hadi mwingine","Yuko tayari kwa chakula kigumu","Hujibu jina lake","Hufuatilia vitu vinavyosogea vizuri"],
    ["Hukaa bila msaada","Hutambaa au kusogea","Hujivuta kusimama","Husema mama au baba","Hugonga vitu pamoja","Huendeleza wasiwasi na wageni","Hujilisha kwa vidole"],
    ["Husimama peke yake kwa muda","Huchukua hatua za kwanza","Huonyesha kwa kidole cha shahada","Husema maneno machache","Hucheza siri siri","Hutumia kikombe kwa msaada","Huigiza vitendo na sauti"],
    ["Hutembea kwa uhuru","Husema maneno mengi","Hufuata maelekezo rahisi","Hupanga vitalu","Huaga kwa mkono","Huonyesha kwa kidole","Hunywa kutoka kikombe"],
    ["Hukimbia kwa utulivu","Husema maneno zaidi","Huchanganya maneno","Hutumia kijiko","Huonyesha sehemu za mwili","Hucheza karibu na watoto wengine","Hupanda samani"],
    ["Husema sentensi fupi","Huruka kwa miguu miwili","Hupiga teke mpira","Hugeuza kurasa za kitabu","Hutaja picha","Hucheza michezo ya kufanya kama","Huelewa yangu na yako"],
  ],
  fil: [
    ["Tumutugon sa malakas na tunog","Nagtutuon sa mga mukha malapit","Gumagawa ng maliliit na tunog sa lalamunan","Dinadala ang mga kamay sa mukha","Gumagalaw ng mga braso at binti nang simetriko"],
    ["Ngumingiti nang sosyal","Sinusundan ang mga gumagalaw na bagay sa mata","Naglalagay ng ulo nang sandali habang nakahiga","Gumagawa ng malambot na tunog","Kinikilala ang boses ng magulang","Tumutugon sa paghawak"],
    ["Pinananatiling matatag ang ulo nang nakatayo","Nagbubukas at nagsasara ng mga kamay","Tinatampal ang mga nakabitin na bagay","Nagsisimulang mag-utal","Tumatawa nang malakas","Napapansin ang sariling mga kamay"],
    ["Gumugulong mula sa tiyan hanggang sa likod","Nakaupo nang may suporta","Umaabot at humahawak ng mga bagay","Nag-uutal na may katinig","Kinikilala ang mga pamilyar na mukha","Ginagaya ang mga ekspresyon ng mukha"],
    ["Gumugulong sa magkabilang direksyon","Dinadala ang mga bagay sa bibig","Inililipat ang mga bagay mula kamay patungong kamay","Handa sa mga solid na pagkain","Tumutugon sa sariling pangalan","Sinusundan nang mabuti ang mga gumagalaw na bagay"],
    ["Nakaupo nang walang suporta","Gumagapang o kumakalaw","Humihila para tumayo","Nagsasabi ng mama o papa","Tinatampal ang mga bagay","Nagkakaroon ng takot sa estranghero","Kumakain gamit ang mga daliri"],
    ["Nakatayo nang sandali nang mag-isa","Gumagawa ng mga unang hakbang","Itinuro ng hintuturo","Nagsasabi ng ilang salita","Naglalaro ng taguan","Gumagamit ng tasa nang may tulong","Ginagaya ang mga aksyon at tunog"],
    ["Naglalakad nang malaya","Nagsasabi ng maraming salita","Sumusunod sa simpleng tagubilin","Nagtatambak ng mga bloke","Nagwawagayway ng paalam","Nagtuturo para ipakita","Umiinom mula sa tasa"],
    ["Tumatakbo nang matatag","Nagsasabi ng mas maraming salita","Pinagsasama ang mga salita","Gumagamit ng kutsara","Itinuro ang mga bahagi ng katawan","Naglalaro sa tabi ng ibang mga bata","Umaakyat sa mga kasangkapan"],
    ["Nagsasalita sa maikling pangungusap","Tumatalbog gamit ang magkabilang paa","Siniipa ang isang bola","Binibiling ang mga pahina ng aklat","Pinangalanan ang mga larawan","Naglalaro ng make-believe","Naiintindihan ang akin at iyo"],
  ],
  mr: [
    ["मोठ्या आवाजांना प्रतिसाद देतो","जवळच्या चेहऱ्यांवर लक्ष केंद्रित करतो","लहान घशाचे आवाज काढतो","चेहऱ्यावर हात आणतो","हात-पाय सममितपणे हलवतो"],
    ["सामाजिकरीत्या हसतो","डोळ्यांनी हलणाऱ्या वस्तू फॉलो करतो","पोटावर असताना थोडक्यात डोके वर करतो","गुणगुणतो","पालकांचा आवाज ओळखतो","उचलून घेतल्यावर प्रतिसाद देतो"],
    ["उभे धरल्यावर डोके स्थिर ठेवतो","हात उघडतो बंद करतो","लटकणाऱ्या वस्तू मारतो","बडबड सुरू करतो","मोठ्याने हसतो","स्वतःचे हात पाहतो"],
    ["पोटावरून पाठीवर लोळतो","आधाराने बसतो","वस्तू पकडण्यासाठी हात लांब करतो","व्यंजनांसह बडबड करतो","परिचित चेहरे ओळखतो","चेहऱ्याचे हावभाव नकलवतो"],
    ["दोन्ही दिशांनी लोळतो","वस्तू तोंडात आणतो","एका हातातून दुसऱ्यात हस्तांतरित करतो","घन अन्नासाठी तयार","स्वतःच्या नावाला प्रतिसाद","हलणाऱ्या वस्तू चांगल्याप्रकारे ट्रॅक करतो"],
    ["आधाराशिवाय बसतो","रांगतो किंवा सरकतो","उभे राहण्यासाठी ओढतो","आई किंवा बाबा म्हणतो","वस्तू एकत्र ठोकतो","अनोळखी व्यक्तींची भीती विकसित होते","बोटांनी स्वतः खातो"],
    ["क्षणभर एकट्याने उभा राहतो","पहिली पावले उचलतो","तर्जनीने निर्देश करतो","काही शब्द बोलतो","लपाछपी खेळतो","मदतीने कप वापरतो","क्रिया आणि आवाज नकलवतो"],
    ["स्वतंत्रपणे चालतो","अनेक शब्द बोलतो","साध्या सूचनांचे पालन करतो","ब्लॉक रचतो","बाय-बाय हात हलवतो","गोष्टी दाखवण्यासाठी निर्देश करतो","कपातून पितो"],
    ["स्थिरपणे धावतो","अधिक शब्द बोलतो","शब्द एकत्र करतो","चमचा वापरतो","शरीराचे भाग दाखवतो","इतर मुलांशेजारी खेळतो","फर्निचरवर चढतो"],
    ["छोट्या वाक्यात बोलतो","दोन्ही पायांनी उडी मारतो","चेंडू लाथ मारतो","पुस्तकाची पाने पलटतो","चित्रांची नावे सांगतो","खोटे-खोटे खेळतो","माझे आणि तुझे समजतो"],
  ],
  te: [
    ["గట్టి శబ్దాలకు స్పందిస్తుంది","దగ్గరి ముఖాలపై దృష్టి పెడుతుంది","చిన్న గొంతు శబ్దాలు చేస్తుంది","చేతులను ముఖానికి తీసుకొస్తుంది","చేతులు కాళ్ళు సమానంగా కదిలిస్తుంది"],
    ["సామాజికంగా నవ్వుతుంది","కదిలే వస్తువులను కళ్ళతో అనుసరిస్తుంది","పొట్టపై పడుకున్నప్పుడు తలను ఎత్తుతుంది","గుటగుట శబ్దాలు చేస్తుంది","తల్లిదండ్రుల గొంతు గుర్తిస్తుంది","ఎత్తుకున్నప్పుడు స్పందిస్తుంది"],
    ["నిలబెట్టినప్పుడు తల స్థిరంగా ఉంచుతుంది","చేతులు తెరుస్తుంది మూస్తుంది","వేలాడే వస్తువులను కొడుతుంది","మాట్లాడటం మొదలుపెడుతుంది","బిగ్గరగా నవ్వుతుంది","తన చేతులను గమనిస్తుంది"],
    ["పొట్ట నుండి వెనక్కి దొర్లుతుంది","సహాయంతో కూర్చుంటుంది","వస్తువులను చేరుకుంటుంది పట్టుకుంటుంది","హల్లులతో పలుకుతుంది","పరిచయమైన ముఖాలు గుర్తిస్తుంది","ముఖ భావాలు అనుకరిస్తుంది"],
    ["రెండు వైపులా దొర్లుతుంది","వస్తువులను నోటిలో పెడుతుంది","ఒక చేయి నుండి మరొక చేతికి బదిలీ","గట్టి ఆహారానికి సిద్ధం","తన పేరుకు స్పందిస్తుంది","కదిలే వస్తువులను బాగా అనుసరిస్తుంది"],
    ["సహాయం లేకుండా కూర్చుంటుంది","పాకుతుంది","నిలబడటానికి లాగుకుంటుంది","అమ్మ లేదా నాన్న అంటుంది","వస్తువులను కొడుతుంది","అపరిచితులపై భయం అభివృద్ధి","వేళ్ళతో తినుతుంది"],
    ["క్షణికంగా ఒంటరిగా నిలబడుతుంది","మొదటి అడుగులు వేస్తుంది","చూపుడు వేలుతో చూపిస్తుంది","కొన్ని పదాలు చెప్తుంది","దాక్కుంటూ ఆడుతుంది","సహాయంతో కప్పు ఉపయోగిస్తుంది","చర్యలు శబ్దాలు అనుకరిస్తుంది"],
    ["స్వతంత్రంగా నడుస్తుంది","చాలా పదాలు చెప్తుంది","సాధారణ సూచనలు అనుసరిస్తుంది","బ్లాకులు పేరుస్తుంది","బై-బై చేయి ఊపుతుంది","చూపించడానికి సూచిస్తుంది","కప్పు నుండి తాగుతుంది"],
    ["స్థిరంగా పరుగెత్తుతుంది","మరిన్ని పదాలు చెప్తుంది","పదాలు కలుపుతుంది","చెంచా ఉపయోగిస్తుంది","శరీర భాగాలు చూపిస్తుంది","ఇతర పిల్లల పక్కన ఆడుతుంది","ఫర్నిచర్ పై ఎక్కుతుంది"],
    ["చిన్న వాక్యాలు మాట్లాడుతుంది","రెండు కాళ్ళతో దూకుతుంది","బంతిని తన్నుతుంది","పుస్తక పేజీలు తిప్పుతుంది","చిత్రాల పేర్లు చెప్తుంది","నాటకీయ ఆట ఆడుతుంది","నాది మరియు నీది అర్థం చేసుకుంటుంది"],
  ],
};

function getMilestones(ageMonths: number, lang: string): string[] {
  const vendorized = getMilestonesForAgeMonths(ageMonths, lang);
  if (vendorized.length) return vendorized;
  const translations = MILESTONE_TRANSLATIONS[lang] || MILESTONE_TRANSLATIONS["en"];
  for (let i = 0; i < MILESTONE_RANGES.length; i++) {
    const [min, max] = MILESTONE_RANGES[i];
    if (ageMonths >= min && ageMonths < max) {
      return translations[i] || MILESTONE_TRANSLATIONS["en"][i];
    }
  }
  if (ageMonths < 0) return translations[0];
  return translations[translations.length - 1];
}


const BABY_MILESTONE_MSGS_TRANSLATIONS: Record<string, string[][]> = {
  el: [
    ["🌟 Τα πας πολύ καλά! Κάθε «πρώτη φορά» είναι μοναδική και την πρόσεξες.",
     "✨ Υπέροχη στιγμή! Το μωρό κάνει ένα ακόμη βήμα και εσύ είσαι δίπλα του."],
    ["💛 Μπράβο! Η φροντίδα σου κάνει τη διαφορά κάθε μέρα.",
     "🌸 Πόσο ωραία! Είναι υπέροχες αυτές οι στιγμές — αξίζει να τις θυμάσαι.",
     "❤️ Σημαντική στιγμή. Το μωρό εξελίσσεται όμορφα — και εσύ έχεις μεγάλη συμβολή σε αυτό."],
    ["🎯 Πολύ ωραία πρόοδος! Κάθε νέο βήμα δείχνει πόσο δυνατή είναι η σχέση σας.",
     "🏆 Άλλο ένα ορόσημο! Να θυμάσαι πόση φροντίδα και αγάπη υπάρχει πίσω από αυτό."],
  ],
  en: [
    ["🌟 You're doing great! Every 'first' is special, and you noticed this one.",
     "✨ Lovely moment! Your baby takes another step forward, with you right there."],
    ["💛 Well done! Your care makes a difference every day.",
     "🌸 How wonderful! These are special moments — worth remembering.",
     "❤️ An important moment. Your baby is developing beautifully — and you play a big part in that."],
    ["🎯 Great progress! Every new step shows how strong your bond is.",
     "🏆 Another milestone! Remember how much care and love is behind it."],
  ],
  ar: [
    ["🌟 أنتِ تقومين بعمل رائع! كل 'مرة أولى' مميزة، وقد لاحظتِ هذه.",
     "✨ لحظة جميلة! طفلك يخطو خطوة أخرى، وأنتِ بجانبه."],
    ["💛 أحسنتِ! رعايتك تصنع فرقاً كل يوم.",
     "🌸 كم هذا رائع! هذه لحظات مميزة تستحق أن تتذكريها.",
     "❤️ لحظة مهمة. طفلك يتطور بشكل جميل — وأنتِ جزء كبير من ذلك."],
    ["🎯 تقدم رائع! كل خطوة جديدة تُظهر مدى قوة ارتباطكما.",
     "🏆 إنجاز آخر! تذكري كل الرعاية والحب الذي يكمن وراءه."],
  ],
  zh: [
    ["🌟 你做得很好！每一个'第一次'都很特别，你注意到了这一刻。",
     "✨ 美好的时刻！宝宝又向前迈了一步，而你就在身边。"],
    ["💛 做得好！你的用心每天都在产生影响。",
     "🌸 多么美好！这些都是值得记住的特别时刻。",
     "❤️ 重要的时刻。宝宝正在健康成长——这离不开你的付出。"],
    ["🎯 进步很大！每一个新阶段都展示了你们之间深厚的联结。",
     "🏆 又一个里程碑！记住，这背后是满满的关爱。"],
  ],
  es: [
    ["🌟 ¡Lo estás haciendo muy bien! Cada 'primera vez' es especial, y la notaste.",
     "✨ ¡Momento precioso! Tu bebé da otro paso adelante, contigo a su lado."],
    ["💛 ¡Bien hecho! Tu cuidado marca la diferencia cada día.",
     "🌸 ¡Qué bonito! Son momentos especiales que vale la pena recordar.",
     "❤️ Un momento importante. Tu bebé se desarrolla maravillosamente — y tú tienes mucho que ver con eso."],
    ["🎯 ¡Gran progreso! Cada nuevo paso muestra lo fuerte que es vuestro vínculo.",
     "🏆 ¡Otro hito! Recuerda todo el cariño y dedicación que hay detrás."],
  ],
  fr: [
    ["🌟 Vous vous en sortez très bien ! Chaque 'première fois' est spéciale, et vous l'avez remarquée.",
     "✨ Joli moment ! Votre bébé fait un pas de plus, avec vous à ses côtés."],
    ["💛 Bravo ! Votre attention fait la différence chaque jour.",
     "🌸 Comme c'est beau ! Ce sont des moments précieux à retenir.",
     "❤️ Un moment important. Votre bébé se développe merveilleusement — et vous y contribuez beaucoup."],
    ["🎯 Belle progression ! Chaque nouvelle étape montre la force de votre lien.",
     "🏆 Une autre étape franchie ! Rappelez-vous tout l'amour qu'il y a derrière."],
  ],
  ro: [
    ["🌟 Te descurci foarte bine! Fiecare 'prima dată' este speciala, și ai observat-o.",
     "✨ Moment frumos! Bebelușul tău face un nou pas, alături de tine."],
    ["💛 Bravo! Grija ta face diferența în fiecare zi.",
     "🌸 Ce frumos! Sunt momente speciale, merită ținute minte.",
     "❤️ Un moment important. Bebelușul se dezvoltă frumos — iar tu ai un rol mare în asta."],
    ["🎯 Progres frumos! Fiecare pas nou arată cât de puternică este legătura voastră.",
     "🏆 Un alt reper! Ține minte câtă grijă și dragoste se află în spatele lui."],
  ],
  pl: [
    ["🌟 Świetnie sobie radzisz! Każde 'pierwsze razy' jest szczególne, i zauważyłaś to.",
     "✨ Piękny moment! Twoje dziecko robi kolejny krok, a ty jesteś przy nim."],
    ["💛 Brawo! Twoja troska codziennie ma znaczenie.",
     "🌸 Jak miło! To szczególne chwile, warto je zapamiętać.",
     "❤️ Ważny moment. Twoje dziecko rozwija się piękne — a ty masz w tym duży udział."],
    ["🎯 Świetny postęp! Każdy nowy krok pokazuje, jak silna jest wasza więź.",
     "🏆 Kolejny kamień milowy! Pamiętaj, ile troski i miłości za nim stoi."],
  ],
  tr: [
    ["🌟 Çok iyi gidiyorsun! Her 'ilk' özeldir, ve bunu fark ettin.",
     "✨ Güzel bir an! Bebeğin bir adım daha atıyor, sen de yanında."],
    ["💛 Aferin! İlginiz her gün fark yaratıyor.",
     "🌸 Ne güzel! Bunlar hatırlanmaya değer özel anlar.",
     "❤️ Önemli bir an. Bebeğin güzel gelişiyor — ve bunda senin büyük katkın var."],
    ["🎯 Güzel bir ilerleme! Her yeni adım bağınızın gücünü gösteriyor.",
     "🏆 Bir kilometre taşı daha! Arkasındaki tüm sevgi ve özeni hatırla."],
  ],
  hi: [
    ["🌟 आप बहुत अच्छा कर रही हैं! हर 'पहली बार' खास होती है, और आपने इसे नोटिस किया।",
     "✨ प्यारा पल! आपका शिशु एक और कदम बढ़ा रहा है, और आप उसके साथ हैं।"],
    ["💛 बहुत बढ़िया! आपकी देखभाल हर दिन फर्क लाती है।",
     "🌸 कितना सुंदर! ये खास पल हैं — याद रखने लायक।",
     "❤️ एक महत्वपूर्ण क्षण। आपका शिशु सुंदरता से विकसित हो रहा है — और इसमें आपकी बड़ी भूमिका है।"],
    ["🎯 बहुत अच्छी प्रगति! हर नया कदम आपके बंधन की ताकत दिखाता है।",
     "🏆 एक और पड़ाव! याद रखें इसके पीछे कितना प्यार और देखभाल है।"],
  ],
  ur: [
    ["🌟 آپ بہت اچھا کر رہی ہیں! ہر 'پہلی بار' خاص ہوتی ہے، اور آپ نے اسے نوٹس کیا۔",
     "✨ پیارا لمحہ! آپ کا بچہ ایک اور قدم بڑھا رہا ہے، اور آپ اس کے ساتھ ہیں۔"],
    ["💛 بہت خوب! آپ کی دیکھ بھال ہر روز فرق پیدا کرتی ہے۔",
     "🌸 کتنا پیارا! یہ خاص لمحات ہیں — یاد رکھنے کے لائق۔",
     "❤️ ایک اہم لحظہ۔ آپ کا بچہ خوبصورتی سے ترقی کر رہا ہے — اور اس میں آپ کا بڑا کردار ہے۔"],
    ["🎯 بہت اچھی پیش رفت! ہر نیا قدم آپ کے رشتے کی مضبوطی دکھاتا ہے۔",
     "🏆 ایک اور سنگ میل! یاد رکھیں اس کے پیچھے کتنی محبت اور دیکھ بھال ہے۔"],
  ],
  ja: [
    ["🌟 とても順調です！「はじめての一歩」はどれも特別で、それに気づけましたね。",
     "✨ 素敵な瞬間です！赤ちゃんがまた一歩前進し、あなたがそばにいます。"],
    ["💛 よくできました！毎日の関わりが大きな意味を持ちます。",
     "🌸 なんて素敵！記憶に残る特別な瞬間ですね。",
     "❤️ 大切な瞬間です。赤ちゃんはすくすくと成長しています — それにはあなたの存在が大きく関わっています。"],
    ["🎯 順調な成長です！新しい一歩はあなたたちの絆の強さを表しています。",
     "🏆 また一つの節目です！その裏にある愛情と努力を忘れずに。"],
  ],
  ru: [
    ["🌟 У вас всё отлично получается! Каждое 'впервые' особенное, и вы это заметили.",
     "✨ Прекрасный момент! Малыш делает ещё один шаг, а вы рядом."],
    ["💛 Молодец! Ваша забота каждый день имеет значение.",
     "🌸 Как чудесно! Это особенные моменты — стоит их запомнить.",
     "❤️ Важный момент. Малыш прекрасно развивается — и в этом большая ваша заслуга."],
    ["🎯 Отличный прогресс! Каждый новый шаг показывает, насколько крепка ваша связь.",
     "🏆 Еще одна веха! Помните, сколько любви и заботы за этим стоит."],
  ],
  de: [
    ["🌟 Du machst das großartig! Jedes 'erste Mal' ist besonders, und du hast es bemerkt.",
     "✨ Schöner Moment! Dein Baby macht einen weiteren Schritt, mit dir an seiner Seite."],
    ["💛 Gut gemacht! Deine Fürsorge macht jeden Tag einen Unterschied.",
     "🌸 Wie schön! Das sind besondere Momente — wert, sich zu merken.",
     "❤️ Ein wichtiger Moment. Dein Baby entwickelt sich wunderbar — und du hast großen Anteil daran."],
    ["🎯 Toller Fortschritt! Jeder neue Schritt zeigt, wie stark eure Verbindung ist.",
     "🏆 Ein weiterer Meilenstein! Denk daran, wie viel Liebe und Fürsorge dahintersteckt."],
  ],
  pt: [
    ["🌟 Estás a sair-te muito bem! Cada 'primeira vez' é especial, e reparaste nesta.",
     "✨ Momento adorável! O teu bebé dá mais um passo, contigo ao lado."],
    ["💛 Muito bem! O teu cuidado faz a diferença todos os dias.",
     "🌸 Que bonito! São momentos especiais — vale a pena guardar na memória.",
     "❤️ Um momento importante. O teu bebé está a desenvolver-se muito bem — e tu tens um grande papel nisso."],
    ["🎯 Ótimo progresso! Cada novo passo mostra o quão forte é a vossa ligação.",
     "🏆 Mais um marco! Lembra-te de todo o cuidado e amor que há por detrás."],
  ],
  it: [
    ["🌟 Stai andando alla grande! Ogni 'prima volta' è speciale, e l'hai notata.",
     "✨ Momento bellissimo! Il tuo bambino fa un altro passo, con te al suo fianco."],
    ["💛 Bravissima! Le tue cure fanno la differenza ogni giorno.",
     "🌸 Che bello! Sono momenti speciali — da custodire nei ricordi.",
     "❤️ Un momento importante. Il tuo bambino si sviluppa in modo meraviglioso — e tu hai un ruolo grande in questo."],
    ["🎯 Ottimi progressi! Ogni nuovo passo mostra quanto sia forte il vostro legame.",
     "🏆 Un altro traguardo! Ricorda quanta cura e amore ci sono dietro."],
  ],
  nl: [
    ["🌟 Je doet het heel goed! Elke 'eerste keer' is speciaal, en je hebt deze opgemerkt.",
     "✨ Mooi moment! Je baby zet weer een stap, met jou erbij."],
    ["💛 Goed gedaan! Jouw zorg maakt elke dag verschil.",
     "🌸 Wat fijn! Dit zijn speciale momenten — waard om te onthouden.",
     "❤️ Een belangrijk moment. Je baby ontwikkelt zich prachtig — en jij speelt daarin een grote rol."],
    ["🎯 Mooie voortgang! Elke nieuwe stap laat zien hoe sterk jullie band is.",
     "🏆 Weer een mijlpaal! Bedenk hoeveel zorg en liefde hier achter zit."],
  ],
  bn: [
    ["🌟 আপনি খুব ভালো করছেন! প্রতিটি 'প্রথমবার' বিশেষ, এবং আপনি এটি লক্ষ্য করেছেন।",
     "✨ সুন্দর মুহূর্ত! আপনার শিশু আরেকটি পদক্ষেপ নিচ্ছে, আর আপনি তার সাথে আছেন।"],
    ["💛 দারুণ! আপনার যত্ন প্রতিদিন পার্থক্য তৈরি করে।",
     "🌸 কত সুন্দর! এগুলো স্মরণীয় মুহূর্ত।",
     "❤️ একটি গুরুত্বপূর্ণ মুহূর্ত। আপনার শিশু সুন্দরভাবে বিকশিত হচ্ছে — এবং এতে আপনার বড় অবদান আছে।"],
    ["🎯 দারুণ অগ্রগতি! প্রতিটি নতুন পদক্ষেপ আপনাদের বন্ধনের শক্তি দেখায়।",
     "🏆 আরেকটি মাইলফলক! মনে রাখুন এর পেছনে কতটা ভালোবাসা ও যত্ন আছে।"],
  ],
  id: [
    ["🌟 Anda melakukannya dengan baik! Setiap 'pertama kali' itu istimewa, dan Anda menyadarinya.",
     "✨ Momen yang indah! Bayi Anda melangkah lagi, dengan Anda di sampingnya."],
    ["💛 Kerja bagus! Perhatian Anda membuat perbedaan setiap hari.",
     "🌸 Sungguh indah! Ini momen istimewa yang patut diingat.",
     "❤️ Momen penting. Bayi Anda berkembang dengan baik — dan Anda berperan besar dalam hal itu."],
    ["🎯 Kemajuan yang bagus! Setiap langkah baru menunjukkan betapa kuatnya hubungan Anda.",
     "🏆 Tonggak lainnya! Ingatlah betapa banyak kasih sayang di baliknya."],
  ],
  sw: [
    ["🌟 Unaendelea vizuri sana! Kila 'mara ya kwanza' ni maalum, na umeitambua.",
     "✨ Wakati mzuri! Mtoto wako anapiga hatua nyingine, na wewe upo karibu."],
    ["💛 Vizuri sana! Utunzaji wako unaleta tofauti kila siku.",
     "🌸 Jinsi inavyopendeza! Hii ni nyakati maalum — zinazofaa kukumbukwa.",
     "❤️ Wakati muhimu. Mtoto wako anakua vizuri — na wewe una mchango mkubwa katika hilo."],
    ["🎯 Maendeleo mazuri! Kila hatua mpya inaonyesha jinsi uhusiano wenu ulivyo na nguvu.",
     "🏆 Hatua nyingine! Kumbuka kiasi cha upendo na utunzaji nyuma yake."],
  ],
  fil: [
    ["🌟 Magaling ang ginagawa mo! Bawat 'unang pagkakataon' ay espesyal, at napansin mo ito.",
     "✨ Magandang sandali! Isa pang hakbang ng iyong sanggol, kasama ka."],
    ["💛 Magaling! Ang pagmamalasakit mo ay may pagbabago araw-araw.",
     "🌸 Ang ganda! Ito ay mga espesyal na sandali — sulit na alalahanin.",
     "❤️ Isang mahalagang sandali. Ang iyong sanggol ay umuunlad nang maganda — at malaki ang papel mo dito."],
    ["🎯 Magandang pag-unlad! Bawat bagong hakbang ay nagpapakita kung gaano katibay ang bond ninyo.",
     "🏆 Isa pang milestone! Tandaan kung gaano karaming pagmamahal at pag-aalaga ang nakapaloob dito."],
  ],
  mr: [
    ["🌟 तुम्ही खूप चांगले करत आहात! प्रत्येक 'पहिली वेळ' खास असते, आणि तुम्ही ती लक्षात घेतली.",
     "✨ सुंदर क्षण! तुमचे बाळ आणखी एक पाऊल पुढे टाकत आहे, आणि तुम्ही त्याच्यासोबत आहात."],
    ["💛 उत्तम! तुमची काळजी रोज फरक घडवते.",
     "🌸 किती छान! हे खास क्षण आहेत — लक्षात ठेवण्यासारखे.",
     "❤️ एक महत्त्वाचा क्षण. तुमचे बाळ सुंदर रीतीने वाढत आहे — आणि त्यात तुमचा मोठा वाटा आहे."],
    ["🎯 खूप चांगली प्रगती! प्रत्येक नवीन पाऊल तुमच्या नात्याची ताकद दाखवते.",
     "🏆 आणखी एक टप्पा! त्यामागे किती प्रेम आणि काळजी आहे हे लक्षात ठेवा."],
  ],
  te: [
    ["🌟 మీరు చాలా బాగా చేస్తున్నారు! ప్రతి 'మొదటిసారి' ప్రత్యేకమైనది, మరియు మీరు దీన్ని గమనించారు.",
     "✨ అందమైన క్షణం! మీ శిశువు మరో అడుగు తీసుకుంటోంది, మీరు దాని పక్కనే ఉన్నారు."],
    ["💛 బాగా చేసారు! మీ సంరక్షణ ప్రతిరోజూ తేడాను కలిగిస్తుంది.",
     "🌸 ఎంత బాగుంది! ఇవి గుర్తుంచుకోదగిన ప్రత్యేక క్షణాలు.",
     "❤️ ఒక ముఖ్యమైన క్షణం. మీ శిశువు అందంగా అభివృద్ధి చెందుతోంది — మరియు అందులో మీ పాత్ర పెద్దది."],
    ["🎯 చాలా మంచి పురోగతి! ప్రతి కొత్త అడుగు మీ బంధం యొక్క బలాన్ని చూపిస్తుంది.",
     "🏆 మరో మైలురాయి! దీని వెనుక ఎంత ప్రేమ మరియు సంరక్షణ ఉందో గుర్తుంచుకోండి."],
  ],
};

function getMilestoneMsg(idx: number, total: number, lang: string): string {
  const msgs = BABY_MILESTONE_MSGS_TRANSLATIONS[lang] || BABY_MILESTONE_MSGS_TRANSLATIONS["en"];
  const ratio = total > 1 ? idx / (total - 1) : 0;
  if (ratio <= 0.25) return msgs[0][idx % 2];
  if (ratio <= 0.65) return msgs[1][(idx - 2 + 3) % 3];
  return msgs[2][idx % 2];
}



// ── Pregnancy Milestones (by gestational week) ─────────────────
const PREGNANCY_MILESTONE_RANGES: [number,number][] = [
  [0,8],[8,12],[12,16],[16,20],[20,24],[24,28],[28,32],[32,36],[36,43]
];

const PREGNANCY_MILESTONE_TRANSLATIONS: Record<string, string[][]> = {
  el: [
    ["Ξεκινά η εμφύτευση του εμβρύου στη μήτρα","Σχηματίζεται η καρδιά του μωρού","Αρχίζουν να αναπτύσσονται τα κύρια όργανα","Το μέγεθός του είναι όσο ένας σπόρος σουσαμιού έως ένα βατόμουρο"],
    ["Σχηματίζονται τα δαχτυλάκια χεριών και ποδιών","Πραγματοποιείται το υπερηχογράφημα Αυχενικής Διαφάνειας","Το έμβρυο αποκτά πιο ανθρώπινη μορφή","Έχει πλέον το μέγεθος ενός λεμονιού"],
    ["Οι ναυτίες σταδιακά υποχωρούν","Το μωρό αναπτύσσει τα πρώτα αντανακλαστικά","Ίσως μάθεις το φύλο του μωρού σύντομα","Έχει το μέγεθος ενός αχλαδιού"],
    ["Ίσως νιώσεις τα πρώτα ανεπαίσθητα «φτερουγίσματα» του μωρού","Πραγματοποιείται το β' επίπεδο υπερηχογράφημα (ανατομικό)","Το πρόσωπό του έχει πλέον διαμορφωθεί","Έχει το μέγεθος μιας γλυκοπατάτας"],
    ["Νιώθεις τις πρώτες αισθητές κλωτσιές του μωρού","Η καρδιά του χτυπά περίπου 140-150 φορές το λεπτό","Το μωρό κουνιέται, τεντώνεται και μπορεί να παθαίνει λόξυγκα","Φτάνει στο μήκος μιας μπανάνας"],
    ["Το μωρό αναγνωρίζει τη φωνή σου και νιώθει ασφάλεια ακούγοντάς τη","Ανταποκρίνεται σε ήχους από το περιβάλλον","Έχει το μέγεθος ενός μικρού μαρουλιού","Πραγματοποιείται η καμπύλη γλυκόζης (τεστ κύησης)"],
    ["Η αίσθηση της γεύσης έχει αναπτυχθεί — γεύεται ό,τι τρως","Μπορεί να χασμουριέται μέσα στην κοιλιά","Ξεκινά το 3ο τρίμηνο της εγκυμοσύνης","Έχει το μέγεθος ενός μάνγκο"],
    ["Το δερμάτινο του μωρού γίνεται απαλό και λείο","Ανοίγει και κλείνει τα μάτια ανάλογα με τον ύπνο του","Τα οστά του δυναμώνουν συνεχώς","Έχει το μέγεθος ενός μικρού ανανά"],
    ["Το μωρό παίρνει την τελική του θέση για τη γέννα","Φτάνει περίπου 3.000-3.500 γραμμάρια","Είναι κλινικά έτοιμο για τον έξω κόσμο","Ώρα να ετοιμάσεις την τσάντα μαιευτηρίου"],
  ],
  en: [
    ["Implantation of the embryo in the uterus begins","The baby's heart begins to form","Major organs start developing","Size: about a sesame seed to a raspberry"],
    ["Tiny fingers and toes are forming","The nuchal translucency scan takes place","The embryo starts looking more human","Size: about a lemon"],
    ["Nausea gradually starts to ease","The baby develops first reflexes","You may soon find out the baby's sex","Size: about a pear"],
    ["You may feel the first faint 'flutters' of the baby","The detailed anatomy scan takes place","The baby's face is now well formed","Size: about a sweet potato"],
    ["You feel the first noticeable kicks","The baby's heart beats around 140-150 times per minute","Baby moves, stretches, and may get hiccups","Reaches the length of a banana"],
    ["The baby recognizes your voice and feels safe hearing it","Responds to sounds from outside the womb","Size: about a small lettuce","The glucose tolerance test takes place"],
    ["The sense of taste has developed — baby tastes what you eat","May yawn inside the womb","The third trimester begins","Size: about a mango"],
    ["The baby's skin becomes soft and smooth","Eyes open and close with sleep cycles","Bones continue to strengthen","Size: about a small pineapple"],
    ["The baby settles into its final position for birth","Reaches about 3,000-3,500 grams","Clinically ready for the outside world","Time to prepare your hospital bag"],
  ],
  ar: [
    ["تبدأ عملية انغراس الجنين في الرحم","يبدأ تكوّن قلب الطفل","تبدأ الأعضاء الرئيسية بالتكوّن","الحجم: من حبة سمسم إلى حبة توت العليق"],
    ["تتشكّل أصابع اليدين والقدمين الصغيرة","يتم إجراء فحص الشفافية القفوية","يبدأ الجنين بالتشكل بشكل أقرب للإنسان","الحجم: مثل حبة الليمون"],
    ["يبدأ الغثيان بالتراجع تدريجياً","يطوّر الطفل ردود الفعل المنعكسة الأولى","قد تعرفين قريباً جنس الطفل","الحجم: مثل حبة الكمثرى"],
    ["قد تشعرين بأولى الحركات الخفيفة للطفل","يتم إجراء فحص التشريح التفصيلي","ملامح وجه الطفل تكوّنت الآن بشكل جيد","الحجم: مثل البطاطا الحلوة"],
    ["تشعرين بأولى الحركات الواضحة للطفل","ينبض قلب الطفل حوالي 140-150 نبضة في الدقيقة","يتحرك الطفل ويتمطى وقد يصاب بالحازوقة","يصل إلى طول حبة الموز"],
    ["يتعرّف الطفل على صوتك ويشعر بالأمان عند سماعه","يستجيب للأصوات من خارج الرحم","الحجم: مثل خس صغير","يتم إجراء فحص تحمل الجلوكوز"],
    ["تطورت حاسة التذوق — يتذوق الطفل ما تأكلينه","قد يتثاءب داخل الرحم","يبدأ الثلث الثالث من الحمل","الحجم: مثل المانجو"],
    ["تصبح بشرة الطفل ناعمة وطرية","تُفتح وتُغلق العينان مع دورات النوم","تستمر العظام في التقوّي","الحجم: مثل أناناس صغير"],
    ["يتخذ الطفل وضعه النهائي للولادة","يصل إلى حوالي 3000-3500 جرام","جاهز سريرياً للعالم الخارجي","حان وقت تحضير حقيبة المستشفى"],
  ],
  zh: [
    ["胚胎开始植入子宫","宝宝的心脏开始形成","主要器官开始发育","大小：约一粒芝麻到一颗覆盆子"],
    ["小手指和小脚趾正在形成","进行颈部透明带扫描","胚胎逐渐呈现人形","大小：约一个柠檬"],
    ["恶心感逐渐缓解","宝宝开始发育最初的反射能力","你可能很快就能知道宝宝的性别","大小：约一个梨子"],
    ["你可能开始感受到宝宝最初轻微的胎动","进行详细的结构畸形超声检查","宝宝的面部特征已基本形成","大小：约一个红薯"],
    ["你会感受到明显的胎动","宝宝的心跳约每分钟140-150次","宝宝会活动、伸展，还可能打嗝","长度达到一根香蕉的长度"],
    ["宝宝能识别你的声音，听到时感到安心","对子宫外的声音有反应","大小：约一颗小生菜","进行糖耐量测试"],
    ["味觉已经发育——宝宝能尝到你吃的食物的味道","可能会在子宫内打哈欠","进入第三孕期","大小：约一个芒果"],
    ["宝宝的皮肤变得柔软光滑","眼睛随睡眠周期睁开和闭合","骨骼持续强化","大小：约一个小菠萝"],
    ["宝宝进入分娩前的最终胎位","体重约达3000-3500克","已具备临床分娩条件","该准备待产包了"],
  ],
  es: [
    ["Comienza la implantación del embrión en el útero","Empieza a formarse el corazón del bebé","Comienzan a desarrollarse los órganos principales","Tamaño: entre una semilla de sésamo y una frambuesa"],
    ["Se forman los deditos de manos y pies","Se realiza la ecografía de translucencia nucal","El embrión empieza a tener forma más humana","Tamaño: como un limón"],
    ["Las náuseas comienzan a disminuir","El bebé desarrolla sus primeros reflejos","Pronto podrías saber el sexo del bebé","Tamaño: como una pera"],
    ["Es posible que sientas los primeros y leves 'aleteos' del bebé","Se realiza la ecografía morfológica detallada","La carita del bebé ya está bien formada","Tamaño: como un boniato"],
    ["Sientes las primeras patadas notables del bebé","El corazón del bebé late entre 140 y 150 veces por minuto","El bebé se mueve, se estira y puede tener hipo","Alcanza el tamaño de un plátano"],
    ["El bebé reconoce tu voz y se siente seguro al oírla","Responde a sonidos del exterior","Tamaño: como una lechuga pequeña","Se realiza la prueba de tolerancia a la glucosa"],
    ["El sentido del gusto se ha desarrollado — el bebé saborea lo que comes","Puede bostezar dentro del útero","Comienza el tercer trimestre","Tamaño: como un mango"],
    ["La piel del bebé se vuelve suave y lisa","Los ojos se abren y cierran según el ciclo de sueño","Los huesos siguen fortaleciéndose","Tamaño: como una piña pequeña"],
    ["El bebé se coloca en su posición final para el parto","Alcanza unos 3.000-3.500 gramos","Está clínicamente listo para nacer","Es momento de preparar la maleta para el hospital"],
  ],
  fr: [
    ["L'implantation de l'embryon dans l'utérus commence","Le cœur du bébé commence à se former","Les principaux organes commencent à se développer","Taille : entre une graine de sésame et une framboise"],
    ["Les petits doigts et orteils se forment","L'échographie de la clarté nucale est réalisée","L'embryon prend une forme plus humaine","Taille : comme un citron"],
    ["Les nausées commencent à s'atténuer","Le bébé développe ses premiers réflexes","Vous découvrirez peut-être bientôt le sexe du bébé","Taille : comme une poire"],
    ["Vous pourriez sentir les premiers petits 'papillonnements' du bébé","L'échographie morphologique détaillée est réalisée","Le visage du bébé est maintenant bien formé","Taille : comme une patate douce"],
    ["Vous sentez les premiers coups de pied notables","Le cœur du bébé bat à environ 140-150 battements par minute","Le bébé bouge, s'étire et peut avoir le hoquet","Atteint la taille d'une banane"],
    ["Le bébé reconnaît votre voix et se sent rassuré en l'entendant","Réagit aux sons venant de l'extérieur","Taille : comme une petite laitue","Le test de tolérance au glucose est réalisé"],
    ["Le sens du goût s'est développé — le bébé goûte ce que vous mangez","Peut bâiller dans l'utérus","Le troisième trimestre commence","Taille : comme une mangue"],
    ["La peau du bébé devient douce et lisse","Les yeux s'ouvrent et se ferment selon le cycle de sommeil","Les os continuent de se renforcer","Taille : comme un petit ananas"],
    ["Le bébé se met en position finale pour la naissance","Il atteint environ 3 000-3 500 grammes","Il est cliniquement prêt pour le monde extérieur","Il est temps de préparer la valise pour la maternité"],
  ],
  ro: [
    ["Începe implantarea embrionului în uter","Începe formarea inimii bebelușului","Organele principale începe să se dezvolte","Dimensiune: de la o sămânță de susan la o zmeură"],
    ["Se formează degetele de la mâini și picioare","Se efectuează ecografia translucenței nucale","Embrionul începe să aibă o formă mai umană","Dimensiune: cât o lămâie"],
    ["Greața începe să se reducă treptat","Bebelușul dezvoltă primele reflexe","Este posibil să afli în scurt timp sexul bebelușului","Dimensiune: cât o pară"],
    ["Este posibil să simți primele 'fluturări' ușoare ale bebelușului","Se efectuează ecografia morfologică detaliată","Fața bebelușului este acum bine formată","Dimensiune: cât un cartof dulce"],
    ["Simți primele lovituri perceptibile ale bebelușului","Inima bebelușului bate cu aproximativ 140-150 bătăi pe minut","Bebelușul se mișcă, se întinde și poate avea sughițuri","Atinge mărimea unei banane"],
    ["Bebelușul îți recunoaște vocea și se simte în siguranță când o aude","Răspunde la sunetele din exterior","Dimensiune: cât o salată mică","Se efectuează testul de toleranță la glucoză"],
    ["Simțul gustului s-a dezvoltat — bebelușul gustă ce mănânci","Poate căsca în uter","Începe trimestrul al treilea","Dimensiune: cât un mango"],
    ["Pielea bebelușului devine fină și netedă","Ochii se deschid și se închid în funcție de ciclul de somn","Oasele continuă să se întărească","Dimensiune: cât un ananas mic"],
    ["Bebelușul se așază în poziția finală pentru naștere","Atinge aproximativ 3.000-3.500 grame","Este pregătit clinic pentru lumea exterioară","E timpul să pregătești geanta de maternitate"],
  ],
  pl: [
    ["Zaczyna się zagnieżdżenie zarodka w macicy","Zaczyna formować się serce dziecka","Główne narządy zaczynają się rozwijać","Wielkość: od ziarna sezamu do maliny"],
    ["Tworzą się małe paluszki rąk i stóp","Wykonywane jest USG przezierności karkowej","Zarodek zaczyna przypominać ludzką postać","Wielkość: jak cytryna"],
    ["Nudności zaczynają stopniowo ustępować","Dziecko rozwija pierwsze odruchy","Możesz wkrótce dowiedzieć się płci dziecka","Wielkość: jak gruszka"],
    ["Możesz poczuć pierwsze, delikatne 'machnięcia' dziecka","Wykonywane jest szczegółowe USG anatomiczne","Twarz dziecka jest już dobrze ukształtowana","Wielkość: jak słodki ziemniak"],
    ["Czujesz pierwsze wyraźne kopnięcia","Serce dziecka bije z częstotliwością 140-150 uderzeń na minutę","Dziecko się rusza, przeciąga i może mieć czkawkę","Osiąga długość banana"],
    ["Dziecko rozpoznaje twój głos i czuje się bezpiecznie, gdy go słyszy","Reaguje na odgłosy z zewnątrz","Wielkość: jak mała sałata","Wykonywany jest test tolerancji glukozy"],
    ["Zmysł smaku rozwinął się — dziecko czuje smak tego, co jesz","Może ziewać w macicy","Zaczyna się trzeci trymestr","Wielkość: jak mango"],
    ["Skóra dziecka staje się miękka i gładka","Oczy otwierają się i zamykają zgodnie z cyklem snu","Kości dalej się wzmacniają","Wielkość: jak mały ananas"],
    ["Dziecko ustawia się w pozycji końcowej do porodu","Osiąga ok. 3000-3500 gramów","Jest klinicznie gotowe do wejścia w świat","Czas przygotować torbę do szpitala"],
  ],
  tr: [
    ["Embriyonun rahme tutunması başlar","Bebeğin kalbi oluşmaya başlar","Ana organlar gelişmeye başlar","Boyut: bir susam tanesi ile bir ahududu arasında"],
    ["Küçük el ve ayak parmakları oluşur","Ense kalınlığı (NT) taraması yapılır","Embriyo daha insana benzer bir şekil alır","Boyut: bir limon kadar"],
    ["Bulantılar yavaş yavaş azalmaya başlar","Bebek ilk reflekslerini geliştirir","Yakında bebeğin cinsiyetini öğrenebilirsin","Boyut: bir armut kadar"],
    ["Bebeğin ilk hafif 'kıpırdanışlarını' hissedebilirsin","Detaylı anomali taraması yapılır","Bebeğin yüzü artık iyi şekillenmiştir","Boyut: bir tatlı patates kadar"],
    ["Bebeğin ilk belirgin tekmelerini hissedersin","Bebeğin kalbi dakikada 140-150 kez atar","Bebek hareket eder, gerinir ve hıçkırık tutabilir","Bir muz uzunluğuna erişir"],
    ["Bebek sesini tanır ve onu duyduğunda kendini güvende hisseder","Dış dünyadan gelen seslere tepki verir","Boyut: küçük bir marul kadar","Glukoz tolerans testi yapılır"],
    ["Tat alma duyusu gelişmiştir — bebek yediklerinin tadını alır","Rahim içinde esneyebilir","Üçüncü trimester başlar","Boyut: bir mango kadar"],
    ["Bebeğin cildi yumuşak ve düzgün olur","Gözler uyku döngüsüne göre açılıp kapanır","Kemikler güçlenmeye devam eder","Boyut: küçük bir ananas kadar"],
    ["Bebek doğum için son pozisyonuna geçer","Yaklaşık 3.000-3.500 grama ulaşır","Dış dünya için klinik olarak hazırdır","Hastane çantasını hazırlama zamanı"],
  ],
  hi: [
    ["भ्रूण का गर्भाशय में प्रत्यारोपण शुरू होता है","बच्चे का हृदय बनना शुरू होता है","मुख्य अंग विकसित होने लगते हैं","आकार: तिल के बीज से रास्पबेरी के बराबर"],
    ["हाथों और पैरों की उंगलियां बनने लगती हैं","न्यूकल ट्रांसलूसेंसी स्कैन किया जाता है","भ्रूण मानव आकार लेने लगता है","आकार: एक नींबू के बराबर"],
    ["मतली धीरे-धीरे कम होने लगती है","शिशु में पहले रिफ्लेक्स विकसित होते हैं","आपको शिशु का लिंग जल्द पता चल सकता है","आकार: एक नाशपाती के बराबर"],
    ["आप शिशु की पहली हल्की हलचल महसूस कर सकती हैं","विस्तृत एनोमली स्कैन किया जाता है","शिशु का चेहरा अब अच्छी तरह बन गया है","आकार: एक शकरकंद के बराबर"],
    ["आप शिशु की पहली स्पष्ट हलचल महसूस करती हैं","शिशु का हृदय लगभग 140-150 बार प्रति मिनट धड़कता है","शिशु हिलता है, खिंचाव करता है और हिचकी ले सकता है","एक केले के आकार तक पहुंचता है"],
    ["शिशु आपकी आवाज़ पहचानता है और इसे सुनकर सुरक्षित महसूस करता है","बाहरी आवाज़ों पर प्रतिक्रिया देता है","आकार: एक छोटे लेट्यूस के बराबर","ग्लूकोज टॉलरेंस टेस्ट किया जाता है"],
    ["स्वाद की समझ विकसित हो गई है — शिशु वही स्वाद लेता है जो आप खाती हैं","गर्भ में जम्हाई ले सकता है","तीसरा त्रैमास शुरू होता है","आकार: एक आम के बराबर"],
    ["शिशु की त्वचा मुलायम और चिकनी होती है","नींद के चक्र के अनुसार आंखें खुलती-बंद होती हैं","हड्डियां और मजबूत होती रहती हैं","आकार: एक छोटे अनानास के बराबर"],
    ["शिशु जन्म के लिए अंतिम स्थिति में आ जाता है","लगभग 3,000-3,500 ग्राम तक पहुंचता है","बाहरी दुनिया के लिए चिकित्सकीय रूप से तैयार है","हॉस्पिटल बैग तैयार करने का समय है"],
  ],
  ur: [
    ["جنین کی رحم میں پیوند کاری شروع ہوتی ہے","بچے کا دل بننا شروع ہوتا ہے","اہم اعضاء بننا شروع ہوتے ہیں","سائز: تل کے بیج سے رس بیری کے برابر"],
    ["ہاتھوں اور پاؤں کی انگلیاں بننے لگتی ہیں","نیوکل ٹرانسلیوسنسی اسکین کیا جاتا ہے","جنین انسانی شکل اختیار کرنے لگتا ہے","سائز: ایک لیموں کے برابر"],
    ["متلی آہستہ آہستہ کم ہونے لگتی ہے","بچے میں پہلی اضطراری حرکات پیدا ہوتی ہیں","آپ کو بچے کی جنس کا جلد پتہ چل سکتا ہے","سائز: ایک ناشپاتی کے برابر"],
    ["آپ بچے کی پہلی ہلکی حرکات محسوس کر سکتی ہیں","تفصیلی انومیلی اسکین کیا جاتا ہے","بچے کا چہرہ اب اچھی طرح بن گیا ہے","سائز: ایک شکرقندی کے برابر"],
    ["آپ بچے کی پہلی واضح حرکات محسوس کرتی ہیں","بچے کا دل تقریباً 140-150 بار فی منٹ دھڑکتا ہے","بچہ حرکت کرتا ہے، کھینچتا ہے اور ہچکی لے سکتا ہے","ایک کیلے کے سائز تک پہنچتا ہے"],
    ["بچہ آپ کی آواز پہچانتا ہے اور اسے سن کر محفوظ محسوس کرتا ہے","باہر کی آوازوں پر ردعمل دیتا ہے","سائز: ایک چھوٹے لیٹیوس کے برابر","گلوکوز ٹالرینس ٹیسٹ کیا جاتا ہے"],
    ["ذائقے کا احساس بن گیا ہے — بچہ وہی ذائقہ محسوس کرتا ہے جو آپ کھاتی ہیں","رحم میں جما سکتا ہے","تیسرا سہ ماہی شروع ہوتا ہے","سائز: ایک آم کے برابر"],
    ["بچے کی جلد نرم اور ہموار ہو جاتی ہے","آنکھیں نیند کے مطابق کھلتی اور بند ہوتی ہیں","ہڈیاں مزید مضبوط ہوتی رہتی ہیں","سائز: ایک چھوٹے انناس کے برابر"],
    ["بچہ پیدائش کے لیے آخری پوزیشن میں آ جاتا ہے","تقریباً 3,000-3,500 گرام تک پہنچتا ہے","باہر کی دنیا کے لیے طبی طور پر تیار ہے","ہسپتال کا بیگ تیار کرنے کا وقت ہے"],
  ],
  ja: [
    ["胚が子宮に着床し始めます","赤ちゃんの心臓が形成され始めます","主要な器官が発達し始めます","大きさ：ゴマ粒からラズベリーほど"],
    ["小さな指やつま先が形成されます","NT（後頸部浮腫）スキャンが行われます","胚が人間らしい形になっていきます","大きさ：レモンほど"],
    ["つわりが徐々に和らいでいきます","赤ちゃんに最初の反射が発達します","もうすぐ赤ちゃんの性別が分かるかもしれません","大きさ：洋ナシほど"],
    ["赤ちゃんの最初のかすかな「ひらひら」を感じるかもしれません","詳細な構造異常スキャンが行われます","赤ちゃんの顔がしっかり形成されています","大きさ：サツマイモほど"],
    ["赤ちゃんのはっきりした胎動を感じます","赤ちゃんの心拍は1分間に約140〜150回です","赤ちゃんは動いたり伸びたり、しゃっくりをすることもあります","バナナほどの大きさになります"],
    ["赤ちゃんはあなたの声を認識し、聞くと安心します","子宮外からの音に反応します","大きさ：小さなレタスほど","ブドウ糖負荷試験が行われます"],
    ["味覚が発達しています — 赤ちゃんはあなたが食べたものを味わいます","子宮内であくびをすることがあります","妊娠後期が始まります","大きさ：マンゴーほど"],
    ["赤ちゃんの肌が柔らかく滑らかになります","睡眠サイクルに合わせて目が開閉します","骨が強くなり続けます","大きさ：小さなパイナップルほど"],
    ["赤ちゃんが出産に向けて最終的な位置に収まります","約3,000〜3,500グラムに達します","外の世界に出る準備が臨床的に整っています","入院バッグを準備する時期です"],
  ],
  ru: [
    ["Начинается имплантация эмбриона в матку","Начинает формироваться сердце малыша","Начинают развиваться основные органы","Размер: от кунжутного семени до малины"],
    ["Формируются крошечные пальчики на руках и ногах","Проводится УЗИ воротникового пространства","Эмбрион приобретает более человеческую форму","Размер: как лимон"],
    ["Тошнота постепенно уменьшается","У малыша развиваются первые рефлексы","Скоро вы можете узнать пол малыша","Размер: как груша"],
    ["Вы можете почувствовать первые легкие 'трепетания' малыша","Проводится детальное УЗИ на пороки развития","Лицо малыша уже хорошо сформировано","Размер: как сладкий картофель"],
    ["Вы чувствуете первые заметные толчки малыша","Сердце малыша бьется со скоростью 140-150 ударов в минуту","Малыш двигается, потягивается и может икать","Достигает размера банана"],
    ["Малыш узнает ваш голос и чувствует себя спокойно, слыша его","Реагирует на звуки извне","Размер: как маленький салат","Проводится тест на толерантность к глюкозе"],
    ["Развилось чувство вкуса — малыш ощущает вкус того, что вы едите","Может зевать в утробе","Начинается третий триместр","Размер: как манго"],
    ["Кожа малыша становится мягкой и гладкой","Глаза открываются и закрываются в зависимости от сна","Кости продолжают укрепляться","Размер: как небольшой ананас"],
    ["Малыш занимает финальное положение перед рождением","Достигает примерно 3000-3500 грамм","Клинически готов к выходу во внешний мир","Время собирать сумку в роддом"],
  ],
  de: [
    ["Die Einnistung des Embryos in die Gebärmutter beginnt","Das Herz des Babys beginnt sich zu bilden","Die wichtigsten Organe beginnen sich zu entwickeln","Größe: zwischen einem Sesamkorn und einer Himbeere"],
    ["Kleine Finger und Zehen bilden sich","Die Nackentransparenz-Untersuchung findet statt","Der Embryo nimmt eine menschlichere Form an","Größe: wie eine Zitrone"],
    ["Die Übelkeit lässt allmählich nach","Das Baby entwickelt erste Reflexe","Bald erfährst du vielleicht das Geschlecht des Babys","Größe: wie eine Birne"],
    ["Du könntest die ersten leichten 'Flattern' des Babys spüren","Der detaillierte Organscreening-Ultraschall findet statt","Das Gesicht des Babys ist jetzt gut ausgeformt","Größe: wie eine Süßkartoffel"],
    ["Du spürst die ersten deutlichen Tritte","Das Herz des Babys schlägt etwa 140-150 Mal pro Minute","Das Baby bewegt sich, streckt sich und kann Schluckauf bekommen","Erreicht die Größe einer Banane"],
    ["Das Baby erkennt deine Stimme und fühlt sich sicher, wenn es sie hört","Reagiert auf Geräusche von außen","Größe: wie ein kleiner Kopfsalat","Der Glukosetoleranztest wird durchgeführt"],
    ["Der Geschmackssinn hat sich entwickelt — das Baby schmeckt, was du isst","Kann in der Gebärmutter gähnen","Das dritte Trimester beginnt","Größe: wie eine Mango"],
    ["Die Haut des Babys wird weich und glatt","Die Augen öffnen und schließen sich je nach Schlafzyklus","Die Knochen werden weiter gestärkt","Größe: wie eine kleine Ananas"],
    ["Das Baby nimmt seine endgültige Position für die Geburt ein","Erreicht etwa 3.000-3.500 Gramm","Ist klinisch bereit für die Außenwelt","Zeit, die Klinik-Tasche zu packen"],
  ],
  pt: [
    ["Começa a implantação do embrião no útero","O coração do bebé começa a formar-se","Os principais órgãos começam a desenvolver-se","Tamanho: entre uma semente de sésamo e uma framboesa"],
    ["Formam-se os pequenos dedos das mãos e dos pés","É realizada a ecografia da translucência nucal","O embrião começa a ter forma mais humana","Tamanho: como um limão"],
    ["As náuseas começam a diminuir gradualmente","O bebé desenvolve os primeiros reflexos","Em breve poderás saber o sexo do bebé","Tamanho: como uma pera"],
    ["Podes sentir os primeiros e leves 'movimentos' do bebé","É realizada a ecografia morfológica detalhada","A cara do bebé já está bem formada","Tamanho: como uma batata-doce"],
    ["Sentes os primeiros pontapés notáveis do bebé","O coração do bebé bate cerca de 140-150 vezes por minuto","O bebé move-se, espreguiça-se e pode ter soluços","Atinge o tamanho de uma banana"],
    ["O bebé reconhece a tua voz e sente-se seguro ao ouvi-la","Responde a sons do exterior","Tamanho: como uma alface pequena","É realizado o teste de tolerância à glicose"],
    ["O sentido do gosto desenvolveu-se — o bebé saboreia o que comes","Pode bocejar dentro do útero","Começa o terceiro trimestre","Tamanho: como uma manga"],
    ["A pele do bebé torna-se suave e lisa","Os olhos abrem e fecham conforme o ciclo de sono","Os ossos continuam a fortalecer-se","Tamanho: como um ananás pequeno"],
    ["O bebé instala-se na posição final para o nascimento","Atinge cerca de 3.000-3.500 gramas","Está clinicamente pronto para o mundo exterior","Hora de preparar a mala da maternidade"],
  ],
  it: [
    ["Inizia l'impianto dell'embrione nell'utero","Il cuore del bambino inizia a formarsi","Gli organi principali iniziano a svilupparsi","Dimensione: tra un seme di sesamo e un lampone"],
    ["Si formano le piccole dita di mani e piedi","Viene eseguita l'ecografia della translucenza nucale","L'embrione assume una forma più umana","Dimensione: come un limone"],
    ["La nausea inizia a diminuire gradualmente","Il bambino sviluppa i primi riflessi","Potresti presto scoprire il sesso del bambino","Dimensione: come una pera"],
    ["Potresti sentire i primi leggeri 'battiti d'ali' del bambino","Viene eseguita l'ecografia morfologica dettagliata","Il viso del bambino è ora ben formato","Dimensione: come una patata dolce"],
    ["Senti i primi calci notevoli del bambino","Il cuore del bambino batte a circa 140-150 battiti al minuto","Il bambino si muove, si stiracchia e può avere il singhiozzo","Raggiunge la dimensione di una banana"],
    ["Il bambino riconosce la tua voce e si sente al sicuro sentendola","Risponde ai suoni dall'esterno","Dimensione: come una lattuga piccola","Viene eseguito il test di tolleranza al glucosio"],
    ["Il senso del gusto si è sviluppato — il bambino sente il sapore di ciò che mangi","Può sbadigliare nell'utero","Inizia il terzo trimestre","Dimensione: come un mango"],
    ["La pelle del bambino diventa morbida e liscia","Gli occhi si aprono e chiudono secondo il ciclo del sonno","Le ossa continuano a rafforzarsi","Dimensione: come un piccolo ananas"],
    ["Il bambino si posiziona definitivamente per la nascita","Raggiunge circa 3.000-3.500 grammi","È clinicamente pronto per il mondo esterno","È il momento di preparare la borsa per l'ospedale"],
  ],
  nl: [
    ["De innesteling van het embryo in de baarmoeder begint","Het hartje van de baby begint te vormen","De belangrijkste organen beginnen zich te ontwikkelen","Grootte: tussen een sesamzaadje en een framboos"],
    ["Kleine vingers en tenen vormen zich","De nekplooimeting wordt uitgevoerd","Het embryo krijgt een meer menselijke vorm","Grootte: als een citroen"],
    ["Misselijkheid neemt geleidelijk af","De baby ontwikkelt de eerste reflexen","Je komt mogelijk binnenkort het geslacht van de baby te weten","Grootte: als een peer"],
    ["Je voelt misschien de eerste lichte 'fladderingen' van de baby","De gedetailleerde structurele echo wordt uitgevoerd","Het gezichtje van de baby is nu goed gevormd","Grootte: als een zoete aardappel"],
    ["Je voelt de eerste duidelijke schopjes","Het hartje van de baby klopt ongeveer 140-150 keer per minuut","De baby beweegt, rekt zich uit en kan de hik krijgen","Bereikt de grootte van een banaan"],
    ["De baby herkent jouw stem en voelt zich veilig als hij die hoort","Reageert op geluiden van buiten","Grootte: als een kleine sla","De glucosetolerantietest wordt uitgevoerd"],
    ["De smaakzin is ontwikkeld — de baby proeft wat jij eet","Kan gapen in de baarmoeder","Het derde trimester begint","Grootte: als een mango"],
    ["De huid van de baby wordt zacht en glad","Ogen gaan open en dicht volgens de slaapcyclus","Botten blijven sterker worden","Grootte: als een kleine ananas"],
    ["De baby neemt de eindpositie voor de geboorte in","Bereikt ongeveer 3.000-3.500 gram","Klinisch klaar voor de buitenwereld","Tijd om de ziekenhuistas te pakken"],
  ],
  bn: [
    ["ভ্রূণের জরায়ুতে ইমপ্লান্টেশন শুরু হয়","শিশুর হৃদয় গঠন শুরু হয়","মূল অঙ্গগুলি বিকাশ শুরু করে","আকার: তিলের বীজ থেকে রাস্পবেরির মতো"],
    ["ছোট আঙুল এবং পায়ের আঙুল তৈরি হয়","নুকাল ট্রান্সলুসেন্সি স্ক্যান করা হয়","ভ্রূণ মানুষের আকার নিতে শুরু করে","আকার: একটি লেবুর মতো"],
    ["বমি বমি ভাব ধীরে ধীরে কমতে থাকে","শিশুর মধ্যে প্রথম প্রতিক্রিয়া বিকশিত হয়","আপনি শীঘ্রই শিশুর লিঙ্গ জানতে পারেন","আকার: একটি নাশপাতির মতো"],
    ["আপনি শিশুর প্রথম হালকা নড়াচড়া অনুভব করতে পারেন","বিস্তারিত অ্যানাটমি স্ক্যান করা হয়","শিশুর মুখ এখন ভালোভাবে তৈরি হয়েছে","আকার: একটি মিষ্টি আলুর মতো"],
    ["আপনি শিশুর প্রথম স্পষ্ট লাথি অনুভব করেন","শিশুর হৃদস্পন্দন প্রতি মিনিটে প্রায় ১৪০-১৫০ বার","শিশু নড়াচড়া করে, প্রসারিত হয় এবং হেঁচকি দিতে পারে","একটি কলার আকারে পৌঁছায়"],
    ["শিশু আপনার কণ্ঠস্বর চিনতে পারে এবং শুনে নিরাপদ অনুভব করে","বাইরের শব্দে প্রতিক্রিয়া দেয়","আকার: একটি ছোট লেটুসের মতো","গ্লুকোজ টলারেন্স টেস্ট করা হয়"],
    ["স্বাদের অনুভূতি বিকশিত হয়েছে — আপনি যা খান শিশু তার স্বাদ পায়","গর্ভে হাঁপাতে পারে","তৃতীয় ত্রৈমাসিক শুরু হয়","আকার: একটি আমের মতো"],
    ["শিশুর ত্বক নরম এবং মসৃণ হয়ে যায়","ঘুমের চক্র অনুযায়ী চোখ খোলে এবং বন্ধ হয়","হাড় আরও মজবুত হতে থাকে","আকার: একটি ছোট আনারসের মতো"],
    ["শিশু জন্মের জন্য চূড়ান্ত অবস্থানে স্থির হয়","প্রায় ৩,০০০-৩,৫০০ গ্রাম পর্যন্ত পৌঁছায়","বাইরের বিশ্বের জন্য চিকিৎসাগতভাবে প্রস্তুত","হাসপাতালের ব্যাগ প্রস্তুত করার সময়"],
  ],
  id: [
    ["Implantasi embrio di rahim mulai terjadi","Jantung bayi mulai terbentuk","Organ-organ utama mulai berkembang","Ukuran: antara biji wijen hingga raspberry"],
    ["Jari-jari kecil tangan dan kaki mulai terbentuk","Pemindaian translusensi nuchal dilakukan","Embrio mulai menyerupai bentuk manusia","Ukuran: seperti lemon"],
    ["Mual secara bertahap mulai berkurang","Bayi mengembangkan refleks pertama","Anda mungkin segera mengetahui jenis kelamin bayi","Ukuran: seperti pir"],
    ["Anda mungkin merasakan 'kepakan' pertama yang lembut dari bayi","Pemindaian anatomi rinci dilakukan","Wajah bayi sekarang sudah terbentuk dengan baik","Ukuran: seperti ubi jalar"],
    ["Anda merasakan tendangan pertama yang jelas dari bayi","Jantung bayi berdetak sekitar 140-150 kali per menit","Bayi bergerak, meregang, dan mungkin cegukan","Mencapai panjang sebuah pisang"],
    ["Bayi mengenali suara Anda dan merasa aman saat mendengarnya","Merespons suara dari luar rahim","Ukuran: seperti selada kecil","Tes toleransi glukosa dilakukan"],
    ["Indra perasa telah berkembang — bayi mencicipi apa yang Anda makan","Mungkin menguap di dalam rahim","Trimester ketiga dimulai","Ukuran: seperti mangga"],
    ["Kulit bayi menjadi lembut dan halus","Mata terbuka dan tertutup sesuai siklus tidur","Tulang terus menguat","Ukuran: seperti nanas kecil"],
    ["Bayi menempatkan diri pada posisi akhir untuk persalinan","Mencapai sekitar 3.000-3.500 gram","Secara klinis siap untuk dunia luar","Saatnya menyiapkan tas rumah sakit"],
  ],
  sw: [
    ["Kupandikizwa kwa kiinitete kwenye mfuko wa uzazi kunaanza","Moyo wa mtoto unaanza kuumbika","Viungo vikuu vinaanza kukua","Ukubwa: kati ya mbegu ya ufuta na rasiberi"],
    ["Vidole vidogo vya mikono na miguu vinaumbika","Uchunguzi wa nuchal translucency unafanyika","Kiinitete kinaanza kufanana zaidi na binadamu","Ukubwa: kama limau"],
    ["Kichefuchefu kinaanza kupungua kidogo kidogo","Mtoto anakuza miitikio ya kwanza","Unaweza kujua hivi karibuni jinsia ya mtoto","Ukubwa: kama pea"],
    ["Unaweza kuhisi 'mipapatiko' ya kwanza nyepesi ya mtoto","Uchunguzi wa kina wa anatomia unafanyika","Uso wa mtoto sasa umeumbika vizuri","Ukubwa: kama kiazi kitamu"],
    ["Unahisi mateke ya kwanza yanayoonekana wazi","Moyo wa mtoto unapiga karibu mara 140-150 kwa dakika","Mtoto anasogea, anajinyoosha na anaweza kuwa na hicha","Anafikia urefu wa ndizi"],
    ["Mtoto anatambua sauti yako na anahisi salama akiisikia","Anaitikia sauti kutoka nje ya tumbo la uzazi","Ukubwa: kama lettuce ndogo","Kipimo cha uvumilivu wa glukosi kinafanyika"],
    ["Hisia ya ladha imekua — mtoto anaonja kile unachokula","Anaweza kupiga miayo tumboni","Robo ya tatu inaanza","Ukubwa: kama embe"],
    ["Ngozi ya mtoto inakuwa laini","Macho yanafunguka na kufunga kulingana na mzunguko wa usingizi","Mifupa inazidi kuwa na nguvu","Ukubwa: kama nanasi dogo"],
    ["Mtoto anajipanga katika hali yake ya mwisho kwa kujifungua","Anafikia takriban gramu 3,000-3,500","Tayari kitabibu kwa dunia ya nje","Wakati wa kutayarisha mfuko wa hospitali"],
  ],
  fil: [
    ["Nagsisimula ang implantation ng embryo sa matris","Nagsisimulang mabuo ang puso ng sanggol","Nagsisimulang umunlad ang mga pangunahing organo","Sukat: katumbas ng butil ng sesame hanggang raspberry"],
    ["Nabubuo ang maliliit na daliri sa kamay at paa","Isinasagawa ang nuchal translucency scan","Nagiging mas katulad ng tao ang anyo ng embryo","Sukat: katumbas ng limon"],
    ["Unti-unting bumababa ang pagduduwal","Nabubuo ang unang mga reflex ng sanggol","Maaaring malapit na malaman ang kasarian ng sanggol","Sukat: katumbas ng peras"],
    ["Maaari mong maramdaman ang unang banayad na 'pagpapakpak' ng sanggol","Isinasagawa ang detalyadong anatomy scan","Maayos na nabuo na ang mukha ng sanggol","Sukat: katumbas ng kamoteng kahoy"],
    ["Naramdaman mo ang unang malinaw na sipa ng sanggol","Tumitibok ang puso ng sanggol nang humigit-kumulang 140-150 bawat minuto","Gumagalaw, nag-uunat ang sanggol at maaaring magka-sinok","Umaabot sa haba ng saging"],
    ["Nakikilala ng sanggol ang iyong tinig at nakaramdam ng ligtas pagdinig nito","Tumutugon sa mga tunog mula sa labas","Sukat: katumbas ng maliit na letsugas","Isinasagawa ang glucose tolerance test"],
    ["Umunlad na ang pandama ng panlasa — natitikman ng sanggol ang iyong kinakain","Maaaring humikab sa loob ng matris","Nagsisimula ang ikatlong trimester","Sukat: katumbas ng mangga"],
    ["Nagiging malambot at makinis ang balat ng sanggol","Nagbubukas at nagsasara ang mata ayon sa siklo ng tulog","Nagpapatuloy na lumalakas ang mga buto","Sukat: katumbas ng maliit na pinya"],
    ["Naayos na ang sanggol sa huling posisyon para sa kapanganakan","Umaabot ng humigit-kumulang 3,000-3,500 grams","Klinikal na handa na para sa labas ng mundo","Panahon na upang ihanda ang bag para sa ospital"],
  ],
  mr: [
    ["भ्रूणाचे गर्भाशयात रोपण सुरू होते","बाळाचे हृदय तयार होऊ लागते","मुख्य अवयव विकसित होऊ लागतात","आकार: तिळाच्या बीपासून रासबेरीइतका"],
    ["हात आणि पायांची बोटे तयार होतात","न्यूकल ट्रान्सलुसन्सी स्कॅन केले जाते","भ्रूण अधिक मानवी आकार घेऊ लागतो","आकार: लिंबाइतका"],
    ["मळमळ हळूहळू कमी होऊ लागते","बाळामध्ये पहिले प्रतिक्षिप्त क्रिया विकसित होतात","तुम्हाला लवकरच बाळाचे लिंग कळू शकते","आकार: नाशपातीइतका"],
    ["तुम्हाला बाळाची पहिली सूक्ष्म हालचाल जाणवू शकते","सविस्तर अॅनाटॉमी स्कॅन केले जाते","बाळाचा चेहरा आता चांगला तयार झाला आहे","आकार: रताळ्याइतका"],
    ["तुम्हाला बाळाच्या पहिल्या स्पष्ट लाथा जाणवतात","बाळाचे हृदय दर मिनिटाला सुमारे १४०-१५० वेळा धडधडते","बाळ हलते, ताणते आणि उचकी देऊ शकते","केळ्याच्या लांबीपर्यंत पोहोचते"],
    ["बाळ तुमचा आवाज ओळखते आणि ऐकून सुरक्षित वाटते","गर्भाशयाबाहेरील आवाजांना प्रतिसाद देते","आकार: छोट्या लेट्यूसइतका","ग्लुकोज टॉलरन्स टेस्ट केली जाते"],
    ["चवीची संवेदना विकसित झाली आहे — तुम्ही जे खाता ते बाळ चाखते","गर्भात जांभई देऊ शकते","तिसरा त्रैमासिक सुरू होतो","आकार: आंब्याइतका"],
    ["बाळाची त्वचा मऊ आणि मुलायम होते","झोपेच्या चक्रानुसार डोळे उघडतात आणि बंद होतात","हाडे आणखी मजबूत होत राहतात","आकार: छोट्या अननसाइतका"],
    ["बाळ जन्मासाठी अंतिम स्थितीत स्थिरावते","सुमारे ३,०००-३,५०० ग्रॅम पर्यंत पोहोचते","बाहेरील जगासाठी वैद्यकीयदृष्ट्या तयार आहे","रुग्णालयाची बॅग तयार करण्याची वेळ आली आहे"],
  ],
  te: [
    ["పిండం గర్భాశయంలో అమరడం మొదలవుతుంది","శిశువు హృదయం రూపొందడం మొదలవుతుంది","ముఖ్యమైన అవయవాలు అభివృద్ధి చెందడం మొదలవుతుంది","పరిమాణం: నువ్వుల గింజ నుండి రాస్ప్‌బెర్రీ వరకు"],
    ["చేతులు, కాళ్ళ చిన్న వేళ్ళు ఏర్పడతాయి","న్యూకల్ ట్రాన్స్‌లూసెన్సీ స్కాన్ చేయబడుతుంది","పిండం మరింత మానవ ఆకారాన్ని పొందుతుంది","పరిమాణం: నిమ్మకాయ అంత"],
    ["వికారం క్రమంగా తగ్గుతుంది","శిశువులో మొదటి రిఫ్లెక్స్‌లు అభివృద్ధి చెందుతాయి","మీకు త్వరలో శిశువు లింగం తెలియవచ్చు","పరిమాణం: బేరి పండు అంత"],
    ["శిశువు మొదటి సూక్ష్మ కదలికలను మీరు అనుభవించవచ్చు","వివరణాత్మక అనాటమీ స్కాన్ చేయబడుతుంది","శిశువు ముఖం ఇప్పుడు బాగా ఏర్పడింది","పరిమాణం: చిలగడదుంప అంత"],
    ["శిశువు మొదటి స్పష్టమైన కిక్‌లను మీరు అనుభవిస్తారు","శిశువు హృదయం నిమిషానికి సుమారు 140-150 సార్లు కొట్టుకుంటుంది","శిశువు కదులుతుంది, సాగుతుంది మరియు హిచ్చులు రావచ్చు","అరటిపండు పొడవుకు చేరుకుంటుంది"],
    ["శిశువు మీ గొంతును గుర్తిస్తుంది మరియు వినగానే సురక్షితంగా భావిస్తుంది","గర్భాశయం బయటి శబ్దాలకు స్పందిస్తుంది","పరిమాణం: చిన్న లెట్యూస్ అంత","గ్లూకోజ్ టాలరెన్స్ టెస్ట్ చేయబడుతుంది"],
    ["రుచి భావం అభివృద్ధి చెందింది — మీరు తినేది శిశువు రుచి చూస్తుంది","గర్భంలో ఆవలించవచ్చు","మూడవ త్రైమాసికం మొదలవుతుంది","పరిమాణం: మామిడి అంత"],
    ["శిశువు చర్మం మృదువుగా, నునుపుగా మారుతుంది","నిద్ర చక్రానికి అనుగుణంగా కళ్ళు తెరుచుకుంటాయి, మూసుకుంటాయి","ఎముకలు మరింత బలపడుతూనే ఉంటాయి","పరిమాణం: చిన్న పైనాపిల్ అంత"],
    ["శిశువు జననానికి చివరి స్థితిలో స్థిరపడుతుంది","సుమారు 3,000-3,500 గ్రాముల వరకు చేరుకుంటుంది","బయటి ప్రపంచానికి వైద్యపరంగా సిద్ధంగా ఉంది","ఆసుపత్రి బ్యాగ్ సిద్ధం చేసుకునే సమయం"],
  ],
};

const PREGNANCY_MILESTONE_MSGS_TRANSLATIONS: Record<string, string[][]> = {
  el: [
    ["🌟 Τα πας πολύ καλά! Η HeyMaa σημειώνει με χαρά αυτό το σημαντικό στάδιο της πορείας σου.",
     "💫 Είναι υπέροχες αυτές οι στιγμές — ένα ακόμη βήμα της εγκυμοσύνης σου."],
    ["💛 Καλή πρόοδος. Κάθε εβδομάδα μετράει στην πορεία σου.",
     "🌸 Η εγκυμοσύνη σου εξελίσσεται ομαλά — αξίζει να το σημειώσεις.",
     "❤️ Σημαντική στιγμή. Η HeyMaa είναι στη διάθεσή σου για ό,τι χρειαστείς."],
    ["🎯 Πλησιάζεις προς το τέλος αυτού του σταδίου — καλή συνέχεια.",
     "🏆 Ορόσημο που αξίζει να σημειωθεί. Η HeyMaa σου εύχεται καλή συνέχεια."],
  ],
  en: [
    ["🌟 You're doing great! HeyMaa is glad to mark this important step in your journey.",
     "💫 These are wonderful moments — another step in your pregnancy."],
    ["💛 Good progress. Every week counts on this journey.",
     "🌸 Your pregnancy is progressing well — worth noting.",
     "❤️ An important moment. HeyMaa is available whenever you need."],
    ["🎯 You're approaching the end of this stage — wishing you well.",
     "🏆 A milestone worth noting. HeyMaa wishes you continued health."],
  ],
  ar: [
    ["🌷 يسرّ HeyMaa الإشارة إلى هذه الخطوة المهمة في رحلتك.",
     "🌟 خطوة أخرى في حملك — HeyMaa هنا لأي سؤال."],
    ["💛 تقدم جيد. كل أسبوع مهم في هذه الرحلة.",
     "🌸 حملك يتقدم بشكل جيد — يستحق التسجيل.",
     "❤️ لحظة مهمة. HeyMaa متاح متى احتجت."],
    ["🎯 تقتربين من نهاية هذه المرحلة — نتمنى لك كل خير.",
     "🏆 محطة تستحق التسجيل. HeyMaa يتمنى لك استمرار الصحة."],
  ],
  zh: [
    ["🌷 HeyMaa很高兴记录孕期中的这个重要阶段。",
     "🌟 孕期又一步——如有任何问题，HeyMaa随时为你解答。"],
    ["💛 进展顺利，孕期中的每一周都很重要。",
     "🌸 孕期进展良好——值得记录。",
     "❤️ 重要的时刻，HeyMaa随时为你提供帮助。"],
    ["🎯 你正接近这一阶段的尾声——祝一切顺利。",
     "🏆 值得记录的里程碑，HeyMaa祝你健康顺利。"],
  ],
  es: [
    ["🌷 HeyMaa se alegra de señalar esta etapa importante de tu proceso.",
     "🌟 Un paso más en tu embarazo — HeyMaa está aquí para cualquier consulta."],
    ["💛 Buen progreso. Cada semana cuenta en este proceso.",
     "🌸 Tu embarazo avanza bien — vale la pena registrarlo.",
     "❤️ Un momento importante. HeyMaa está disponible cuando lo necesites."],
    ["🎯 Te acercas al final de esta etapa — te deseamos lo mejor.",
     "🏆 Un hito que vale la pena registrar. HeyMaa te desea continua salud."],
  ],
  fr: [
    ["🌷 HeyMaa est heureux de souligner cette étape importante de votre parcours.",
     "🌟 Une étape de plus dans votre grossesse — HeyMaa est là pour toute question."],
    ["💛 Bonne progression. Chaque semaine compte dans ce parcours.",
     "🌸 Votre grossesse progresse bien — cela vaut la peine d'être noté.",
     "❤️ Un moment important. HeyMaa est disponible si besoin."],
    ["🎯 Vous approchez de la fin de cette étape — bonne continuation.",
     "🏆 Une étape qui mérite d'être notée. HeyMaa vous souhaite une bonne santé continue."],
  ],
  ro: [
    ["🌷 HeyMaa notează cu plăcere această etapă importantă a parcursului tău.",
     "🌟 Un alt pas în sarcina ta — HeyMaa este aici pentru orice întrebare."],
    ["💛 Progres bun. Fiecare săptămână contează în acest parcurs.",
     "🌸 Sarcina ta progresează bine — merită notat.",
     "❤️ Un moment important. HeyMaa este disponibil oricând ai nevoie."],
    ["🎯 Te apropii de finalul acestei etape — îți urăm numai bine.",
     "🏆 Un reper care merită notat. HeyMaa îți urează multă sănătate."],
  ],
  pl: [
    ["🌷 HeyMaa z radością odnotowuje ten ważny etap Twojej drogi.",
     "🌟 Kolejny krok w Twojej ciąży — HeyMaa jest tu na wypadek pytań."],
    ["💛 Dobry postęp. Każdy tydzień ma znaczenie.",
     "🌸 Twoja ciąża przebiega dobrze — warto to odnotować.",
     "❤️ Ważny moment. HeyMaa jest dostępna, kiedy potrzebujesz."],
    ["🎯 Zbliżasz się do końca tego etapu — wszystkiego dobrego.",
     "🏆 Kamień milowy warty odnotowania. HeyMaa życzy dalszego zdrowia."],
  ],
  tr: [
    ["🌷 HeyMaa, sürecindeki bu önemli aşamayı not etmekten memnuniyet duyar.",
     "🌟 Hamileliğinde bir adım daha — sorularınız için HeyMaa burada."],
    ["💛 İyi bir ilerleme. Bu süreçte her hafta önemlidir.",
     "🌸 Hamileliğin iyi ilerliyor — not etmeye değer.",
     "❤️ Önemli bir an. HeyMaa ihtiyacın olduğunda hazır."],
    ["🎯 Bu aşamanın sonuna yaklaşıyorsun — sağlıkla devam et.",
     "🏆 Not edilmeye değer bir kilometre taşı. HeyMaa sana sağlık diler."],
  ],
  hi: [
    ["🌷 HeyMaa आपकी इस यात्रा के महत्वपूर्ण चरण को दर्ज करते हुए खुशी महसूस करता है।",
     "🌟 आपकी गर्भावस्था में एक और कदम — किसी भी सवाल के लिए HeyMaa यहाँ है।"],
    ["💛 अच्छी प्रगति। इस यात्रा में हर सप्ताह महत्वपूर्ण है।",
     "🌸 आपकी गर्भावस्था अच्छी तरह आगे बढ़ रही है — इसे नोट करना उचित है।",
     "❤️ एक महत्वपूर्ण क्षण। जब भी आवश्यकता हो, HeyMaa उपलब्ध है।"],
    ["🎯 आप इस चरण के अंत के करीब हैं — शुभकामनाएं।",
     "🏆 नोट करने योग्य पड़ाव। HeyMaa आपके स्वास्थ्य की कामना करता है।"],
  ],
  ur: [
    ["🌷 HeyMaa آپ کے سفر کے اس اہم مرحلے کو نوٹ کرتے ہوئے خوشی محسوس کرتا ہے۔",
     "🌟 آپ کے حمل میں ایک اور قدم — کسی بھی سوال کے لیے HeyMaa حاضر ہے۔"],
    ["💛 اچھی پیش رفت۔ اس سفر میں ہر ہفتہ اہم ہے۔",
     "🌸 آپ کا حمل اچھی طرح آگے بڑھ رہا ہے — اسے نوٹ کرنا مناسب ہے۔",
     "❤️ ایک اہم لحظہ۔ جب بھی ضرورت ہو، HeyMaa دستیاب ہے۔"],
    ["🎯 آپ اس مرحلے کے اختتام کے قریب ہیں — نیک خواہشات۔",
     "🏆 نوٹ کرنے کے لائق سنگ میل۔ HeyMaa آپ کی صحت کی خواہش کرتا ہے۔"],
  ],
  ja: [
    ["🌷 HeyMaaはあなたの妊娠における大切な段階を記録できることを嬉しく思います。",
     "🌟 妊娠のまた一つの段階です — ご質問があればHeyMaaがいつでもお答えします。"],
    ["💛 順調な進み具合です。この過程では毎週が大切です。",
     "🌸 妊娠は順調に進んでいます — 記録しておく価値があります。",
     "❤️ 大切な瞬間です。必要なときはHeyMaaをご利用ください。"],
    ["🎯 この段階の終盤に近づいています — 順調にお過ごしください。",
     "🏆 記録しておきたい一区切りです。HeyMaaは健康をお祈りしています。"],
  ],
  ru: [
    ["🌷 HeyMaa с радостью отмечает этот важный этап вашего пути.",
     "🌟 Еще один шаг в вашей беременности — HeyMaa здесь для любых вопросов."],
    ["💛 Хороший прогресс. Каждая неделя имеет значение.",
     "🌸 Ваша беременность протекает хорошо — стоит это отметить.",
     "❤️ Важный момент. HeyMaa доступен, когда вам нужно."],
    ["🎯 Вы приближаетесь к концу этого этапа — всего наилучшего.",
     "🏆 Этап, который стоит отметить. HeyMaa желает вам крепкого здоровья."],
  ],
  de: [
    ["🌷 HeyMaa freut sich, diesen wichtigen Schritt in deinem Verlauf festzuhalten.",
     "🌟 Ein weiterer Schritt in deiner Schwangerschaft — HeyMaa steht für Fragen zur Verfügung."],
    ["💛 Guter Fortschritt. Jede Woche zählt auf diesem Weg.",
     "🌸 Deine Schwangerschaft verläuft gut — das ist erwähnenswert.",
     "❤️ Ein wichtiger Moment. HeyMaa steht bei Bedarf zur Verfügung."],
    ["🎯 Du näherst dich dem Ende dieser Phase — alles Gute weiterhin.",
     "🏆 Ein bemerkenswerter Meilenstein. HeyMaa wünscht dir weiterhin Gesundheit."],
  ],
  pt: [
    ["🌷 A HeyMaa tem o prazer de assinalar esta etapa importante do teu percurso.",
     "🌟 Mais uma etapa na tua gravidez — a HeyMaa está disponível para qualquer questão."],
    ["💛 Bom progresso. Cada semana conta neste percurso.",
     "🌸 A tua gravidez está a evoluir bem — vale a pena registar.",
     "❤️ Um momento importante. A HeyMaa está disponível sempre que precisares."],
    ["🎯 Estás a aproximar-te do fim desta etapa — tudo de bom.",
     "🏆 Uma etapa que vale a pena registar. A HeyMaa deseja-te continuação de saúde."],
  ],
  it: [
    ["🌷 HeyMaa è lieta di segnalare questa importante fase del tuo percorso.",
     "🌟 Un altro passo nella tua gravidanza — HeyMaa è disponibile per qualsiasi domanda."],
    ["💛 Buon progresso. Ogni settimana conta in questo percorso.",
     "🌸 La tua gravidanza procede bene — vale la pena annotarlo.",
     "❤️ Un momento importante. HeyMaa è disponibile quando ne hai bisogno."],
    ["🎯 Ti stai avvicinando alla fine di questa fase — buon proseguimento.",
     "🏆 Una tappa da segnalare. HeyMaa ti augura buona salute."],
  ],
  nl: [
    ["🌷 HeyMaa noteert met plezier deze belangrijke stap in jouw traject.",
     "🌟 Weer een stap in je zwangerschap — HeyMaa staat klaar voor vragen."],
    ["💛 Goede voortgang. Elke week telt in dit traject.",
     "🌸 Je zwangerschap verloopt goed — het loont om dit te noteren.",
     "❤️ Een belangrijk moment. HeyMaa is beschikbaar wanneer je het nodig hebt."],
    ["🎯 Je nadert het einde van deze fase — veel succes verder.",
     "🏆 Een mijlpaal om te noteren. HeyMaa wenst je veel gezondheid."],
  ],
  bn: [
    ["🌷 HeyMaa আপনার যাত্রার এই গুরুত্বপূর্ণ পর্যায়টি নোট করতে পেরে আনন্দিত।",
     "🌟 আপনার গর্ভাবস্থার আরেকটি পর্যায় — কোনো প্রশ্ন থাকলে HeyMaa এখানে আছে।"],
    ["💛 ভালো অগ্রগতি। এই যাত্রায় প্রতিটি সপ্তাহ গুরুত্বপূর্ণ।",
     "🌸 আপনার গর্ভাবস্থা ভালোভাবে এগিয়ে চলছে — নোট করার মতো।",
     "❤️ একটি গুরুত্বপূর্ণ মুহূর্ত। প্রয়োজনে HeyMaa উপলব্ধ।"],
    ["🎯 আপনি এই পর্যায়ের সমাপ্তির কাছাকাছি — শুভকামনা।",
     "🏆 নোট করার মতো একটি মাইলফলক। HeyMaa আপনার সুস্বাস্থ্য কামনা করে।"],
  ],
  id: [
    ["🌷 HeyMaa dengan senang hati mencatat tahap penting dalam perjalanan Anda ini.",
     "🌟 Satu langkah lagi dalam kehamilan Anda — HeyMaa siap untuk pertanyaan apa pun."],
    ["💛 Kemajuan yang baik. Setiap minggu penting dalam perjalanan ini.",
     "🌸 Kehamilan Anda berjalan dengan baik — patut dicatat.",
     "❤️ Momen penting. HeyMaa tersedia kapan pun Anda membutuhkan."],
    ["🎯 Anda mendekati akhir tahap ini — semoga semuanya lancar.",
     "🏆 Tonggak yang patut dicatat. HeyMaa mendoakan kesehatan Anda."],
  ],
  sw: [
    ["🌷 HeyMaa inafurahi kuandika hatua hii muhimu ya safari yako.",
     "🌟 Hatua nyingine katika ujauzito wako — HeyMaa ipo kwa swali lolote."],
    ["💛 Maendeleo mazuri. Kila wiki ina maana katika safari hii.",
     "🌸 Ujauzito wako unaendelea vizuri — inafaa kuandikwa.",
     "❤️ Wakati muhimu. HeyMaa inapatikana wakati wowote unapohitaji."],
    ["🎯 Unakaribia mwisho wa hatua hii — kila la heri.",
     "🏆 Hatua inayofaa kuandikwa. HeyMaa inakutakia afya njema."],
  ],
  fil: [
    ["🌷 Natutuwa ang HeyMaa na maitala ang mahalagang yugto ng iyong paglalakbay.",
     "🌟 Isa pang hakbang sa iyong pagbubuntis — narito ang HeyMaa para sa anumang tanong."],
    ["💛 Magandang pag-unlad. Mahalaga ang bawat linggo sa paglalakbay na ito.",
     "🌸 Mahusay ang pag-unlad ng iyong pagbubuntis — sulit na itala.",
     "❤️ Isang mahalagang sandali. Available ang HeyMaa kapag kailangan mo."],
    ["🎯 Malapit ka na sa katapusan ng yugtong ito — patuloy na maging mabuti.",
     "🏆 Isang yugto na sulit na itala. Nais sa iyo ng HeyMaa ng tuloy-tuloy na kalusugan."],
  ],
  mr: [
    ["🌷 तुमच्या प्रवासातील हा महत्त्वाचा टप्पा नोंदवताना HeyMaa ला आनंद होतो.",
     "🌟 तुमच्या गर्भधारणेतील आणखी एक टप्पा — कोणत्याही प्रश्नासाठी HeyMaa येथे आहे."],
    ["💛 चांगली प्रगती. या प्रवासात प्रत्येक आठवडा महत्त्वाचा आहे.",
     "🌸 तुमची गर्भधारणा चांगली प्रगती करत आहे — नोंद करण्यासारखे आहे.",
     "❤️ एक महत्त्वाचा क्षण. आवश्यकता असेल तेव्हा HeyMaa उपलब्ध आहे."],
    ["🎯 तुम्ही या टप्प्याच्या अखेरीकडे जात आहात — पुढील वाटचालीसाठी शुभेच्छा.",
     "🏆 नोंद करण्यासारखा टप्पा. HeyMaa तुमच्या उत्तम आरोग्याची इच्छा करते."],
  ],
  te: [
    ["🌷 మీ ప్రయాణంలో ఈ ముఖ్యమైన దశను గుర్తించడంలో HeyMaa సంతోషంగా ఉంది.",
     "🌟 మీ గర్భధారణలో మరో దశ — ఏ ప్రశ్నకైనా HeyMaa ఇక్కడ ఉంది."],
    ["💛 మంచి పురోగతి. ఈ ప్రయాణంలో ప్రతి వారం ముఖ్యమైనది.",
     "🌸 మీ గర్భధారణ బాగా పురోగమిస్తోంది — గుర్తించదగినది.",
     "❤️ ఒక ముఖ్యమైన క్షణం. అవసరమైనప్పుడు HeyMaa అందుబాటులో ఉంది."],
    ["🎯 మీరు ఈ దశ ముగింపుకు చేరువగా ఉన్నారు — శుభాకాంక్షలు.",
     "🏆 గుర్తించదగిన మైలురాయి. HeyMaa మీ ఆరోగ్యాన్ని కోరుకుంటుంది."],
  ],
};

function getPregnancyMilestones(week: number, lang: string): string[] {
  const vendorized = getPregnancyMilestonesForWeek(week, lang);
  if (vendorized.length) return vendorized;
  const translations = PREGNANCY_MILESTONE_TRANSLATIONS[lang] || PREGNANCY_MILESTONE_TRANSLATIONS["en"];
  for (let i = 0; i < PREGNANCY_MILESTONE_RANGES.length; i++) {
    const [min, max] = PREGNANCY_MILESTONE_RANGES[i];
    if (week >= min && week < max) {
      return translations[i] || PREGNANCY_MILESTONE_TRANSLATIONS["en"][i];
    }
  }
  if (week < 0) return translations[0];
  return translations[translations.length - 1];
}

function getPregnancyMilestoneMsg(idx: number, total: number, lang: string): string {
  const msgs = PREGNANCY_MILESTONE_MSGS_TRANSLATIONS[lang] || PREGNANCY_MILESTONE_MSGS_TRANSLATIONS["en"];
  const ratio = total > 1 ? idx / (total - 1) : 0;
  if (ratio <= 0.25) return msgs[0][idx % 2];
  if (ratio <= 0.65) return msgs[1][(idx - 2 + 3) % 3];
  return msgs[2][idx % 2];
}




const TR: Record<string,Record<string,string>> = {
  welcome:{el:"Καλώς ήρθες στη HeyMaa!",en:"Welcome to HeyMaa!",ar:"مرحباً بك في HeyMaa!",es:"¡Bienvenida a HeyMaa!",fr:"Bienvenue sur HeyMaa!",de:"Willkommen bei HeyMaa!",pt:"Bem-vinda ao HeyMaa!",it:"Benvenuta su HeyMaa!",ru:"Добро пожаловать в HeyMaa!",tr:"HeyMaa'ya Hoş Geldiniz!",hi:"HeyMaa में स्वागत है!",ur:"HeyMaa میں خوش آمدید!",zh:"欢迎使用HeyMaa！",ja:"HeyMaaへようこそ！",nl:"Welkom bij HeyMaa!",pl:"Witaj w HeyMaa!",ro:"Bun venit la HeyMaa!",bn:"HeyMaa-তে স্বাগতম!",id:"Selamat Datang di HeyMaa!",sw:"Karibu HeyMaa!",fil:"Welcome to HeyMaa!",mr:"HeyMaa मध्ये स्वागत आहे!",te:"Chào mừng đến HeyMaa!"},
  setup:{el:"Ας στήσουμε τον λογαριασμό σου σε 2 λεπτά.",en:"Let's set up your account in 2 minutes.",ar:"لنقم بإعداد حسابك في دقيقتين.",es:"Configuremos tu cuenta en 2 minutos.",fr:"Configurons votre compte en 2 minutes.",de:"Lass uns dein Konto in 2 Minuten einrichten.",pt:"Vamos configurar a tua conta em 2 minutos.",it:"Configuriamo il tuo account in 2 minuti.",ru:"Настроим ваш аккаунт за 2 минуты.",tr:"Hesabını 2 dakikada ayarlayalım.",hi:"2 मिनट में खाता सेट करते हैं।",ur:"آئیں 2 منٹ میں آپ کا اکاؤنٹ ترتیب دیتے ہیں۔",zh:"2分钟设置账户。",ja:"2分で設定しましょう。",nl:"Account instellen in 2 minuten.",pl:"Konto w 2 minuty.",ro:"Cont în 2 minute.",bn:"২ মিনিটে সেটআপ।",id:"Siapkan akun 2 menit.",sw:"Dakika 2 kuanzisha.",fil:"Let's set up your account in 2 minutes.",mr:"2 मिनिटांत.",te:"2 నిమిషాల్లో."},
  yourname:{el:"Το όνομά σου",en:"Your name",ar:"اسمك",es:"Tu nombre",fr:"Ton prénom",de:"Dein Name",pt:"O teu nome",it:"Il tuo nome",ru:"Ваше имя",tr:"Adın",hi:"आपका नाम",ur:"آپ کا نام",zh:"你的名字",ja:"お名前",nl:"Jouw naam",pl:"Twoje imię",ro:"Numele tău",bn:"আপনার নাম",id:"Nama Anda",sw:"Jina lako",fil:"Your name",mr:"तुमचे नाव",te:"మీ పేరు"},
  letsgo:{el:"Ξεκινάμε →",en:"Let's go →",ar:"هيا نبدأ ←",es:"Empezamos →",fr:"C'est parti →",de:"Los geht's →",pt:"Vamos lá →",it:"Iniziamo →",ru:"Начнём →",tr:"Başlayalım →",hi:"चलते हैं →",ur:"شروع کریں →",zh:"开始 →",ja:"はじめましょう →",nl:"Laten we gaan →",pl:"Zaczynamy →",ro:"Să începem →",bn:"শুরু করি →",id:"Ayo mulai →",sw:"Tuanze →",fil:"Let's go →",mr:"चला सुरू करूया →",te:"ప్రారంభిద్దాం →"},
  profile2:{el:"Ας ενημερώσουμε το προφίλ σου",en:"Tell us about your little one",ar:"أخبرينا عن طفلك",es:"Cuéntanos sobre tu bebé",fr:"Parlez-nous de votre bébé",de:"Erzähl uns von deinem Baby",pt:"Fala-nos do teu bebé",it:"Parlaci del tuo bambino",ru:"Расскажите о малыше",tr:"Bebeğin hakkında anlat",hi:"अपने बच्चे के बारे में बताएं",ur:"اپنے بچے کے بارے میں",zh:"告诉我们宝宝",ja:"赤ちゃんについて",nl:"Vertel over je baby",pl:"Opowiedz o dziecku",ro:"Spune-ne despre bebeluș",bn:"শিশু সম্পর্কে বলুন",id:"Ceritakan bayi Anda",sw:"Tuambie kuhusu mtoto",fil:"Tell us about your little one",mr:"Малюка розкажіть",te:"మీ బాబు గురించి"},
  childname:{el:"Όνομα παιδιού",en:"Child's name",ar:"اسم الطفل",es:"Nombre del niño",fr:"Prénom de l'enfant",de:"Name des Kindes",pt:"Nome do filho",it:"Nome del bambino",ru:"Имя ребёнка",tr:"Çocuğun adı",hi:"बच्चे का नाम",ur:"بچے کا نام",zh:"孩子的名字",ja:"お子さんの名前",nl:"Naam kind",pl:"Imię dziecka",ro:"Numele copilului",bn:"শিশুর নাম",id:"Nama anak",sw:"Jina la mtoto",fil:"Child's name",mr:"मुलाचे नाव",te:"పిల్లల పేరు"},
  childage:{el:"Ηλικία (π.χ. 4 μήνες)",en:"Age (e.g. 4 months)",ar:"العمر (مثل: 4 أشهر)",es:"Edad (ej. 4 meses)",fr:"Âge (ex. 4 mois)",de:"Alter (z.B. 4 Monate)",pt:"Idade (ex. 4 meses)",it:"Età (es. 4 mesi)",ru:"Возраст (4 месяца)",tr:"Yaş (örn. 4 ay)",hi:"उम्र (4 महीने)",ur:"عمر (4 ماہ)",zh:"年龄（4个月）",ja:"年齢（4ヶ月）",nl:"Leeftijd (4 maanden)",pl:"Wiek (4 miesiące)",ro:"Vârsta (4 luni)",bn:"বয়স (৪ মাস)",id:"Usia (4 bulan)",sw:"Umri (miezi 4)",fil:"Age (e.g. 4 months)",mr:"वय (4 महिने)",te:"వయస్సు (4 నెలలు)"},
  continue:{el:"Συνέχεια →",en:"Continue →",ar:"متابعة ←",es:"Continuar →",fr:"Continuer →",de:"Weiter →",pt:"Continuar →",it:"Continua →",ru:"Продолжить →",tr:"Devam et →",hi:"जारी रखें →",ur:"جاری رکھیں →",zh:"继续 →",ja:"続ける →",nl:"Doorgaan →",pl:"Dalej →",ro:"Continuă →",bn:"চালিয়ে যান →",id:"Lanjutkan →",sw:"Endelea →",fil:"Continue →",mr:"पुढे →",te:"కొనసాగించు →"},
  duedatelabel:{el:"Πιθανότερη ημερομηνία τοκετού",en:"Expected due date",ar:"تاريخ الولادة المتوقع",zh:"预产期",es:"Fecha probable de parto",fr:"Date d'accouchement prévue",ro:"Data probabilă a naşterii",pl:"Przewidywana data porodu",tr:"Tahmini doğum tarihi",hi:"संभावित प्रसव तिथि",ur:"متوقع تاریخ پیدائش",ja:"出産予定日",ru:"Предполагаемая дата родов",de:"Voraussichtlicher Geburtstermin",pt:"Data prevista do parto",it:"Data presunta del parto",nl:"Verwachte bevallingsdatum",bn:"প্রত্যাশিত প্রসবের তারিখ",id:"Tanggal perkiraan persalinan",sw:"Tarehe inayotarajiwa ya kujifungua",fil:"Inaasahang petsa ng panganganak",mr:"अपेक्षित प्रसूती तारीख",te:"ఆశించిన ప్రసవ తేదీ"},
  childbirthdate:{el:"Ημερομηνία γέννησης παιδιού",en:"Child's birth date",ar:"تاريخ ميلاد الطفل",zh:"孩子的出生日期",es:"Fecha de nacimiento del niño",fr:"Date de naissance de l'enfant",ro:"Data naşterii copilului",pl:"Data urodzenia dziecka",tr:"Çocuğun doğum tarihi",hi:"बच्चे की जन्म तिथि",ur:"بچے کی تاریخ پیدائش",ja:"お子さんの生年月日",ru:"Дата рождения ребёнка",de:"Geburtsdatum des Kindes",pt:"Data de nascimento do filho",it:"Data di nascita del bambino",nl:"Geboortedatum kind",bn:"শিশুর জন্ম তারিখ",id:"Tanggal lahir anak",sw:"Tarehe ya kuzaliwa ya mtoto",fil:"Petsa ng kapanganakan ng anak",mr:"मुलाची जन्म तारीख",te:"పిల్లల పుట్టిన తేదీ"},
  unit_days:{el:"ημέρες",en:"days",ar:"أيام",zh:"天",es:"días",fr:"jours",ro:"zile",pl:"dni",tr:"gün",hi:"दिन",ur:"دن",ja:"日",ru:"дней",de:"Tage",pt:"dias",it:"giorni",nl:"dagen",bn:"দিন",id:"hari",sw:"siku",fil:"araw",mr:"दिवस",te:"రోజులు"},
  unit_months:{el:"μήνες",en:"months",ar:"أشهر",zh:"个月",es:"meses",fr:"mois",ro:"luni",pl:"miesięcy",tr:"ay",hi:"महीने",ur:"ماہ",ja:"ヶ月",ru:"месяцев",de:"Monate",pt:"meses",it:"mesi",nl:"maanden",bn:"মাস",id:"bulan",sw:"miezi",fil:"buwan",mr:"महिने",te:"నెలలు"},
  unit_years:{el:"χρόνια",en:"years",ar:"سنوات",zh:"岁",es:"años",fr:"ans",ro:"ani",pl:"lat",tr:"yıl",hi:"साल",ur:"سال",ja:"歳",ru:"лет",de:"Jahre",pt:"anos",it:"anni",nl:"jaar",bn:"বছর",id:"tahun",sw:"miaka",fil:"taon",mr:"वर्षे",te:"సంవత్సరాలు"},
  pregnancycard_title:{el:"Η εγκυμοσύνη σου",en:"Your pregnancy",ar:"حملك",zh:"你的孕期",es:"Tu embarazo",fr:"Votre grossesse",ro:"Sarcina ta",pl:"Twoja ciąża",tr:"Hamileliğin",hi:"आपकी गर्भावस्था",ur:"آپ کا حمل",ja:"あなたの妊娠",ru:"Ваша беременность",de:"Deine Schwangerschaft",pt:"A tua gravidez",it:"La tua gravidanza",nl:"Jouw zwangerschap",bn:"আপনার গর্ভাবস্থা",id:"Kehamilan Anda",sw:"Ujauzito wako",fil:"Ang iyong pagbubuntis",mr:"तुमची गर्भधारणा",te:"మీ గర్భధారణ"},
  pregnancycard_body:{el:"Είσαι περίπου στην {week}η εβδομάδα. Αναμενόμενη ημερομηνία τοκετού: {date}. Ρώτησέ με ό,τι θες για την εξέλιξη της εγκυμοσύνης!",en:"You're approximately in week {week}. Expected due date: {date}. Ask me anything about your pregnancy progress!",ar:"أنت في الأسبوع {week} تقريباً. تاريخ الولادة المتوقع: {date}. اسأليني أي شيء عن تقدم حملك!",zh:"你大约在第{week}周。预产期：{date}。关于孕期进展，随时问我！",es:"Estás aproximadamente en la semana {week}. Fecha probable de parto: {date}. ¡Pregúntame lo que quieras sobre tu embarazo!",fr:"Vous êtes environ à la semaine {week}. Date d'accouchement prévue: {date}. Posez-moi toutes vos questions sur votre grossesse !",ro:"Ești aproximativ în săptămâna {week}. Data probabilă a naşterii: {date}. Întreabă-mă orice despre sarcina ta!",pl:"Jesteś w około {week}. tygodniu. Przewidywana data porodu: {date}. Pytaj mnie o wszystko dotyczące ciąży!",tr:"Yaklaşık {week}. haftadasın. Tahmini doğum tarihi: {date}. Hamilelik sürecinle ilgili her şeyi sorabilirsin!",hi:"आप लगभग {week}वें सप्ताह में हैं। संभावित प्रसव तिथि: {date}। अपनी गर्भावस्था के बारे में कुछ भी पूछें!",ur:"آپ تقریباً {week} ہفتے میں ہیں۔ متوقع تاریخ پیدائش: {date}۔ اپنے حمل کے بارے میں کچھ بھی پوچھیں!",ja:"現在およそ妊娠{week}週目です。出産予定日：{date}。妊娠の経過について何でも聞いてください！",ru:"Вы примерно на {week}-й неделе. Предполагаемая дата родов: {date}. Спрашивайте меня о течении беременности!",de:"Du bist etwa in der {week}. Woche. Voraussichtlicher Geburtstermin: {date}. Frag mich alles über deine Schwangerschaft!",pt:"Estás aproximadamente na semana {week}. Data prevista do parto: {date}. Pergunta-me o que quiseres sobre a tua gravidez!",it:"Sei circa alla settimana {week}. Data presunta del parto: {date}. Chiedimi tutto sulla tua gravidanza!",nl:"Je bent ongeveer in week {week}. Verwachte bevallingsdatum: {date}. Vraag me alles over je zwangerschap!",bn:"আপনি প্রায় {week} সপ্তাহে আছেন। প্রত্যাশিত প্রসবের তারিখ: {date}। আপনার গর্ভাবস্থা সম্পর্কে যা চান জিজ্ঞাসা করুন!",id:"Anda kira-kira di minggu ke-{week}. Tanggal perkiraan persalinan: {date}. Tanyakan apa saja tentang perkembangan kehamilan Anda!",sw:"Uko takriban wiki ya {week}. Tarehe inayotarajiwa ya kujifungua: {date}. Niulize chochote kuhusu maendeleo ya ujauzito wako!",fil:"Humigit-kumulang sa ika-{week} linggo ka. Inaasahang petsa ng panganganak: {date}. Magtanong ka kung ano man tungkol sa iyong pagbubuntis!",mr:"तुम्ही अंदाजे {week} व्या आठवड्यात आहात. अपेक्षित प्रसूती तारीख: {date}. तुमच्या गर्भधारणेबद्दल काहीही विचारा!",te:"మీరు సుమారు {week}వ వారంలో ఉన్నారు. ఆశించిన ప్రసవ తేదీ: {date}. మీ గర్భధారణ గురించి ఏదైనా అడగండి!"},
  pregnancymilestones_title:{el:"Ορόσημα εγκυμοσύνης",en:"Pregnancy milestones",ar:"إنجازات الحمل",zh:"孕期里程碑",es:"Hitos del embarazo",fr:"Étapes de la grossesse",ro:"Repere ale sarcinii",pl:"Etapy ciąży",tr:"Hamilelik aşamaları",hi:"गर्भावस्था के माइलस्टोन",ur:"حمل کے سنگ میل",ja:"妊娠のマイルストーン",ru:"Вехи беременности",de:"Schwangerschaftsmeilensteine",pt:"Marcos da gravidez",it:"Traguardi della gravidanza",nl:"Mijlpalen van de zwangerschap",bn:"গর্ভাবস্থার মাইলফলক",id:"Tonggak kehamilan",sw:"Hatua za ujauzito",fil:"Mga milestone ng pagbubuntis",mr:"गर्भधारणेचे टप्पे",te:"గర్భధారణ మైలురాళ్ళు"},
  pregnancymilestones_sub:{el:"Τικάρετε τα ορόσημα που έχουν συμβεί στην εξέλιξη της εγκυμοσύνης σας!",en:"Tick the milestones that have happened in your pregnancy progress!",ar:"ضعي علامة على الإنجازات التي حدثت في مسار حملك!",zh:"勾选孕期中已经达到的里程碑！",es:"¡Marca los hitos que ya han ocurrido en tu embarazo!",fr:"Cochez les étapes déjà atteintes dans votre grossesse !",ro:"Bifează reperele care s-au întâmplat deja în sarcina ta!",pl:"Zaznacz etapy, które już wystąpiły w Twojej ciąży!",tr:"Hamileliğinde gerçekleşen aşamaları işaretle!",hi:"अपनी गर्भावस्था में हो चुके माइलस्टोन चुनें!",ur:"اپنے حمل میں ہونے والے سنگ میل نشان لگائیں!",ja:"妊娠の経過で達成したマイルストーンをチェック！",ru:"Отметьте вехи, которые уже произошли в вашей беременности!",de:"Hake die Meilensteine ab, die in deiner Schwangerschaft bereits eingetreten sind!",pt:"Assinala os marcos que já aconteceram na tua gravidez!",it:"Spunta i traguardi già raggiunti nella tua gravidanza!",nl:"Vink de mijlpalen aan die al zijn bereikt in je zwangerschap!",bn:"আপনার গর্ভাবস্থায় ঘটে যাওয়া মাইলফলকগুলো টিক করুন!",id:"Centang tonggak yang telah terjadi dalam kehamilan Anda!",sw:"Weka alama kwa hatua zilizotokea katika ujauzito wako!",fil:"I-tick ang mga milestone na naganap na sa iyong pagbubuntis!",mr:"तुमच्या गर्भधारणेत झालेले टप्पे निवडा!",te:"మీ గర్భధారణలో జరిగిన మైలురాళ్ళను టిక్ చేయండి!"},
  week_label:{el:"Εβδομάδα",en:"Week",ar:"الأسبوع",zh:"第",es:"Semana",fr:"Semaine",ro:"Săptămâna",pl:"Tydzień",tr:"Hafta",hi:"सप्ताह",ur:"ہفتہ",ja:"妊娠週",ru:"Неделя",de:"Woche",pt:"Semana",it:"Settimana",nl:"Week",bn:"সপ্তাহ",id:"Minggu",sw:"Wiki",fil:"Linggo",mr:"आठवडा",te:"వారం"},
  askmile_preg_q:{el:"Ποια είναι τα επόμενα στάδια της εγκυμοσύνης στην {week}η εβδομάδα;",en:"What are the next stages of pregnancy at week {week}?",ar:"ما هي المراحل القادمة للحمل في الأسبوع {week}؟",zh:"第{week}周后孕期的下一阶段是什么？",es:"¿Cuáles son las próximas etapas del embarazo en la semana {week}?",fr:"Quelles sont les prochaines étapes de la grossesse à la semaine {week}?",ro:"Care sunt următoarele etape ale sarcinii în săptămâna {week}?",pl:"Jakie są kolejne etapy ciąży w {week}. tygodniu?",tr:"{week}. haftada hamileliğin sonraki aşamaları nelerdir?",hi:"{week}वें सप्ताह में गर्भावस्था के अगले चरण क्या हैं?",ur:"{week} ہفتے میں حمل کے اگلے مراحل کیا ہیں؟",ja:"{week}週目以降の妊娠の次の段階は何ですか？",ru:"Какие следующие этапы беременности на {week}-й неделе?",de:"Was sind die nächsten Schwangerschaftsphasen in Woche {week}?",pt:"Quais são as próximas etapas da gravidez na semana {week}?",it:"Quali sono le prossime fasi della gravidanza alla settimana {week}?",nl:"Wat zijn de volgende fasen van de zwangerschap in week {week}?",bn:"{week} সপ্তাহে গর্ভাবস্থার পরবর্তী পর্যায়গুলো কী?",id:"Apa tahap kehamilan selanjutnya di minggu ke-{week}?",sw:"Ni hatua gani zinazofuata za ujauzito katika wiki ya {week}?",fil:"Ano ang mga susunod na yugto ng pagbubuntis sa linggo {week}?",mr:"आठवडा {week} मध्ये गर्भधारणेचे पुढील टप्पे काय आहेत?",te:"వారం {week}లో గర్భధారణ తదుపరి దశలు ఏమిటి?"},
  pregnancy_short:{el:"Εγκυμοσύνη",en:"Pregnancy",ar:"الحمل",zh:"孕期",es:"Embarazo",fr:"Grossesse",ro:"Sarcină",pl:"Ciąża",tr:"Hamilelik",hi:"गर्भावस्था",ur:"حمل",ja:"妊娠",ru:"Беременность",de:"Schwangerschaft",pt:"Gravidez",it:"Gravidanza",nl:"Zwangerschap",bn:"গর্ভাবস্থা",id:"Kehamilan",sw:"Ujauzito",fil:"Pagbubuntis",mr:"गर्भधारणा",te:"గర్భధారణ"},
  duelabel:{el:"Τοκετός: ",en:"Due: ",ar:"الولادة: ",zh:"预产期：",es:"Parto: ",fr:"Accouchement : ",ro:"Naștere: ",pl:"Poród: ",tr:"Doğum: ",hi:"प्रसव: ",ur:"پیدائش: ",ja:"出産予定：",ru:"Роды: ",de:"Termin: ",pt:"Parto: ",it:"Parto: ",nl:"Bevalling: ",bn:"প্রসব: ",id:"Persalinan: ",sw:"Kujifungua: ",fil:"Panganganak: ",mr:"प्रसूती: ",te:"ప్రసవం: "},
  selectlanguage_login:{el:"Επιλέξτε γλώσσα",en:"Select language",ar:"اختر اللغة",zh:"选择语言",es:"Selecciona el idioma",fr:"Choisissez la langue",ro:"Selectează limba",pl:"Wybierz język",tr:"Dil seçin",hi:"भाषा चुनें",ur:"زبان منتخب کریں",ja:"言語を選択",ru:"Выберите язык",de:"Sprache wählen",pt:"Seleciona o idioma",it:"Seleziona la lingua",nl:"Selecteer taal",bn:"ভাষা নির্বাচন করুন",id:"Pilih bahasa",sw:"Chagua lugha",fil:"Pumili ng wika",mr:"भाषा निवडा",te:"భాషను ఎంచుకోండి"},
  pregnant_or_baby_q:{el:"Είσαι έγκυος ή έχεις ήδη μωρό;",en:"Are you pregnant or do you already have a baby?",ar:"هل أنت حامل أم لديك طفل بالفعل؟",zh:"您是怀孕了还是已经有宝宝了？",es:"¿Estás embarazada o ya tienes un bebé?",fr:"Êtes-vous enceinte ou avez-vous déjà un bébé ?",ro:"Ești gravidă sau ai deja un copil?",pl:"Jesteś w ciąży czy masz już dziecko?",tr:"Hamile misin yoksa zaten bir bebeğin var mı?",hi:"क्या आप गर्भवती हैं या आपके पास पहले से बच्चा है?",ur:"کیا آپ حاملہ ہیں یا آپ کے پاس پہلے سے بچہ ہے؟",ja:"妊娠中ですか、それともすでに赤ちゃんがいますか？",ru:"Вы беременны или у вас уже есть малыш?",de:"Bist du schwanger oder hast du schon ein Baby?",pt:"Estás grávida ou já tens um bebé?",it:"Sei incinta o hai già un bambino?",nl:"Ben je zwanger of heb je al een baby?",bn:"আপনি গর্ভবতী নাকি আপনার ইতিমধ্যে একটি শিশু আছে?",id:"Apakah Anda sedang hamil atau sudah memiliki bayi?",sw:"Je, una mimba au una mtoto tayari?",fil:"Buntis ka ba o may bata na ka?",mr:"तुम्ही गर्भवती आहात की तुमचे आधीच बाळ आहे?",te:"మీరు గర్భవతిగా ఉన్నారా లేదా మీకు ఇప్పటికే శిశువు ఉందా?"},
  im_pregnant:{el:"Είμαι έγκυος",en:"I'm pregnant",ar:"أنا حامل",zh:"我怀孕了",es:"Estoy embarazada",fr:"Je suis enceinte",ro:"Sunt gravidă",pl:"Jestem w ciąży",tr:"Hamileyim",hi:"मैं गर्भवती हूं",ur:"میں حاملہ ہوں",ja:"妊娠しています",ru:"Я беременна",de:"Ich bin schwanger",pt:"Estou grávida",it:"Sono incinta",nl:"Ik ben zwanger",bn:"আমি গর্ভবতী",id:"Saya sedang hamil",sw:"Nina mimba",fil:"Buntis ako",mr:"मी गर्भवती आहे",te:"నేను గర్భవతి"},
  have_baby:{el:"Έχω μωρό",en:"I have a baby",ar:"لدي طفل",zh:"我有宝宝",es:"Tengo un bebé",fr:"J'ai un bébé",ro:"Am un copil",pl:"Mam dziecko",tr:"Bebeğim var",hi:"मेरे पास बच्चा है",ur:"میرے پاس بچہ ہے",ja:"赤ちゃんがいます",ru:"У меня малыш",de:"Ich habe ein Baby",pt:"Tenho um bebé",it:"Ho un bambino",nl:"Ik heb een baby",bn:"আমার একটি শিশু আছে",id:"Saya sudah punya bayi",sw:"Nina mtoto",fil:"May bata na ako",mr:"माझे बाळ आहे",te:"నాకు శిశువు ఉంది"},
  babyinfo_q:{el:"Πες μας για το παιδί σου.",en:"Tell us about your child.",ar:"أخبرينا عن طفلك.",zh:"告诉我们关于您孩子的信息。",es:"Cuéntanos sobre tu hijo/a.",fr:"Parlez-nous de votre enfant.",ro:"Spune-ne despre copilul tău.",pl:"Opowiedz nam o swoim dziecku.",tr:"Çocuğun hakkında anlat.",hi:"अपने बच्चे के बारे में बताएं।",ur:"اپنے بچے کے بارے میں بتائیں۔",ja:"お子さんについて教えてください。",ru:"Расскажите о своём ребёнке.",de:"Erzähl uns von deinem Kind.",pt:"Fala-nos do teu filho/a.",it:"Parlaci del tuo bambino.",nl:"Vertel ons over je kind.",bn:"আপনার শিশু সম্পর্কে বলুন।",id:"Ceritakan tentang anak Anda.",sw:"Tuambie kuhusu mtoto wako.",fil:"Sabihin mo sa amin ang tungkol sa iyong anak.",mr:"तुमच्या मुलाबद्दल सांगा.",te:"మీ పిల్లల గురించి చెప్పండి."},
  subexpiredtitle:{el:"Η συνδρομή σου έχει λήξει",en:"Your subscription has expired",ar:"انتهت صلاحية اشتراكك",es:"Tu suscripción ha caducado",fr:"Votre abonnement a expiré",de:"Dein Abo ist abgelaufen",pt:"A tua subscrição expirou",it:"Il tuo abbonamento è scaduto",ru:"Ваша подписка истекла",tr:"Aboneliğinizin süresi doldu",hi:"आपकी सदस्यता समाप्त हो गई है",ur:"آپ کی سبسکرپشن ختم ہو گئی ہے",zh:"您的订阅已过期",ja:"サブスクリプションの期限が切れました",nl:"Je abonnement is verlopen",pl:"Twoja subskrypcja wygasła",ro:"Abonamentul tău a expirat",bn:"আপনার সাবস্ক্রিপশন শেষ হয়ে গেছে",id:"Langganan Anda telah berakhir",sw:"Usajili wako umeisha muda",fil:"Nag-expire na ang subscription mo",mr:"तुमची सदस्यता संपली आहे",te:"మీ సభ్యత్వం గడువు ముగిసింది"},
  subexpiredbody:{el:"Για να συνεχίσεις να χρησιμοποιείς την HeyMaa, ανανέωσε τη συνδρομή σου.",en:"To keep using HeyMaa, please renew your subscription.",ar:"لمواصلة استخدام HeyMaa، يرجى تجديد اشتراكك.",es:"Para seguir usando HeyMaa, renueva tu suscripción.",fr:"Pour continuer à utiliser HeyMaa, renouvelez votre abonnement.",de:"Um HeyMaa weiterhin zu nutzen, erneuere bitte dein Abo.",pt:"Para continuar a usar a HeyMaa, renova a tua subscrição.",it:"Per continuare a usare HeyMaa, rinnova il tuo abbonamento.",ru:"Чтобы продолжить использовать HeyMaa, продлите подписку.",tr:"HeyMaa'yı kullanmaya devam etmek için aboneliğini yenile.",hi:"HeyMaa का उपयोग जारी रखने के लिए, कृपया अपनी सदस्यता रिन्यू करें।",ur:"HeyMaa کا استعمال جاری رکھنے کے لیے، اپنی سبسکرپشن کی تجدید کریں۔",zh:"要继续使用HeyMaa，请续订您的订阅。",ja:"HeyMaaを使い続けるには、サブスクリプションを更新してください。",nl:"Om HeyMaa te blijven gebruiken, vernieuw je abonnement.",pl:"Aby dalej korzystać z HeyMaa, odnów subskrypcję.",ro:"Pentru a continua să folosești HeyMaa, reînnoiește abonamentul.",bn:"HeyMaa ব্যবহার চালিয়ে যেতে, আপনার সাবস্ক্রিপশন রিনিউ করুন।",id:"Untuk terus menggunakan HeyMaa, perpanjang langganan Anda.",sw:"Kuendelea kutumia HeyMaa, tafadhali sasisha usajili wako.",fil:"To keep using HeyMaa, please renew your subscription.",mr:"HeyMaa वापरणे सुरू ठेवण्यासाठी, तुमची सदस्यता रिन्यू करा.",te:"HeyMaa ఉపయోగించడం కొనసాగించడానికి, మీ సభ్యత్వాన్ని పునరుద్ధరించండి."},
  renewbtn:{el:"Ανανέωση συνδρομής →",en:"Renew subscription →",ar:"تجديد الاشتراك ←",es:"Renovar suscripción →",fr:"Renouveler l'abonnement →",de:"Abo erneuern →",pt:"Renovar subscrição →",it:"Rinnova abbonamento →",ru:"Продлить подписку →",tr:"Aboneliği yenile →",hi:"सदस्यता रिन्यू करें →",ur:"سبسکرپشن کی تجدید کریں →",zh:"续订订阅 →",ja:"サブスクリプションを更新 →",nl:"Abonnement vernieuwen →",pl:"Odnów subskrypcję →",ro:"Reînnoiește abonamentul →",bn:"সাবস্ক্রিপশন রিনিউ করুন →",id:"Perpanjang langganan →",sw:"Sasisha usajili →",fil:"Renew subscription →",mr:"सदस्यता रिन्यू करा →",te:"సభ్యత్వాన్ని పునరుద్ధరించండి →"},
  back:{el:"← Πίσω",en:"← Back",ar:"→ رجوع",es:"← Atrás",fr:"← Retour",de:"← Zurück",pt:"← Voltar",it:"← Indietro",ru:"← Назад",tr:"← Geri",hi:"← वापस",ur:"← پیچھے",zh:"← 返回",ja:"← 戻る",nl:"← Terug",pl:"← Wstecz",ro:"← Înapoi",bn:"← ফিরে",id:"← Kembali",sw:"← Rudi",fil:"← Back",mr:"← मागे",te:"← వెనక్కి"},
  ready:{el:"Είσαι έτοιμη!",en:"You're all set!",ar:"أنت جاهزة!",es:"¡Ya estás lista!",fr:"Vous êtes prête!",de:"Du bist bereit!",pt:"Estás pronta!",it:"Sei pronta!",ru:"Вы готовы!",tr:"Hazırsın!",hi:"आप तैयार हैं!",ur:"آپ تیار ہیں!",zh:"你准备好了！",ja:"準備完了！",nl:"Je bent er klaar voor!",pl:"Jesteś gotowa!",ro:"Ești gata!",bn:"আপনি প্রস্তুত!",id:"Kamu siap!",sw:"Uko tayari!",fil:"You're all set!",mr:"तुम्ही तयार आहात!",te:"మీరు సిద్ధంగా ఉన్నారు!"},
  readysub:{el:"Ο λογαριασμός σου στήθηκε.",en:"Your account is ready.",ar:"حسابك جاهز.",es:"Cuenta lista.",fr:"Compte prêt.",de:"Konto bereit.",pt:"Conta pronta.",it:"Account pronto.",ru:"Аккаунт готов.",tr:"Hesabın hazır.",hi:"खाता तैयार है।",ur:"اکاؤنٹ تیار ہے۔",zh:"账户已准备好。",ja:"準備完了。",nl:"Account klaar.",pl:"Konto gotowe.",ro:"Cont gata.",bn:"অ্যাকাউন্ট প্রস্তুত।",id:"Akun siap.",sw:"Akaunti iko tayari.",fil:"Your account is ready.",mr:"Акаунт готовий.",te:"ఖాతా సిద్ధంగా ఉంది."},
  country_label:{el:"Χώρα",en:"Country",ar:"البلد",zh:"国家",es:"País",fr:"Pays",ro:"Țara",pl:"Kraj",tr:"Ülke",hi:"देश",ur:"ملک",ja:"国",ru:"Страна",de:"Land",pt:"País",it:"Paese",nl:"Land",bn:"দেশ",id:"Negara",sw:"Nchi",fil:"Bansa",mr:"देश",te:"దేశం"},
  country_ph:{el:"Επίλεξε χώρα...",en:"Select your country...",ar:"اختر بلدك...",zh:"选择国家...",es:"Selecciona tu país...",fr:"Sélectionnez votre pays...",ro:"Selectează țara...",pl:"Wybierz kraj...",tr:"Ülkeni seç...",hi:"देश चुनें...",ur:"ملک منتخب کریں...",ja:"国を選択...",ru:"Выберите страну...",de:"Land wählen...",pt:"Seleciona o teu país...",it:"Seleziona il tuo paese...",nl:"Selecteer land...",bn:"দেশ নির্বাচন করুন...",id:"Pilih negara...",sw:"Chagua nchi...",fil:"Pumili ng bansa...",mr:"देश निवडा...",te:"దేశం ఎంచుకోండి..."},
  consent_gdpr:{el:"Συναινώ σε εξατομικευμένες προσφορές από την Care Direct (GDPR)",en:"I agree to receive personalised offers from Care Direct (GDPR)",ar:"أوافق على العروض المخصصة من Care Direct (GDPR)",zh:"同意接收Care Direct个性化优惠 (GDPR)",es:"Acepto recibir ofertas personalizadas de Care Direct (GDPR)",fr:"Accepter les offres personnalisées Care Direct (RGPD)",ro:"Accept oferte personalizate de la Care Direct (GDPR)",pl:"Zgadzam się na oferty spersonalizowane od Care Direct (RODO)",tr:"Care Direct kişisel teklifler onayı (GDPR)",hi:"Care Direct से व्यक्तिगत ऑफ़र पाने की सहमति (GDPR)",ur:"Care Direct سے ذاتی آفرز قبول کرتا/کرتی ہوں (GDPR)",ja:"Care Directからのパーソナライズ特典に同意 (GDPR)",ru:"Согласен/а на предложения Care Direct (GDPR)",de:"Personalisierte Angebote von Care Direct zustimmen (DSGVO)",pt:"Aceito ofertas personalizadas da Care Direct (RGPD)",it:"Acconsento alle offerte di Care Direct (GDPR)",nl:"Akkoord met aanbiedingen van Care Direct (AVG)",bn:"Care Direct থেকে অফার পেতে সম্মতি (GDPR)",id:"Setuju menerima penawaran dari Care Direct (GDPR)",sw:"Nakubali ofa kutoka Care Direct (GDPR)",fil:"Sumasang-ayon sa alok mula sa Care Direct (GDPR)",mr:"Care Direct कडून ऑफर मिळवण्यास संमती (GDPR)",te:"Care Direct నుండి ఆఫర్‌లకు అంగీకరిస్తున్నాను (GDPR)"},
  enterbtn:{el:"Μπες στην εφαρμογή →",en:"Enter the app →",ar:"← ادخل التطبيق",es:"Entrar →",fr:"Entrer →",de:"App öffnen →",pt:"Entrar →",it:"Entra →",ru:"Войти →",tr:"Gir →",hi:"प्रवेश करें →",ur:"داخل ہوں →",zh:"进入 →",ja:"入る →",nl:"Ga naar de app →",pl:"Wejdź →",ro:"Intră →",bn:"প্রবেশ করুন →",id:"Masuk →",sw:"Ingia →",fil:"Enter the app →",mr:"Увійти →",te:"ప్రవేశించు →"},
  greeting:{el:"Γεια σου,",en:"Hi,",ar:"مرحباً،",es:"Hola,",fr:"Bonjour,",de:"Hallo,",pt:"Olá,",it:"Ciao,",ru:"Привет,",tr:"Merhaba,",hi:"नमस्ते,",ur:"ہائے،",zh:"你好，",ja:"こんにちは、",nl:"Hallo,",pl:"Cześć,",ro:"Bună,",bn:"হ্যালো,",id:"Halo,",sw:"Habari,",fil:"Hi,",mr:"नमस्कार,",te:"హలో,"},
  chat:{el:"Συνομιλία",en:"Chat",ar:"المحادثة",es:"Chat",fr:"Discussion",de:"Chat",pt:"Chat",it:"Chat",ru:"Чат",tr:"Sohbet",hi:"चैट",ur:"چیٹ",zh:"聊天",ja:"チャット",nl:"Chat",pl:"Czat",ro:"Chat",bn:"চ্যাট",id:"Obrolan",sw:"Mazungumzo",fil:"Chat",mr:"संवाद",te:"చాట్"},
  family:{el:"Οικογένεια",en:"Family",ar:"العائلة",es:"Familia",fr:"Famille",de:"Familie",pt:"Família",it:"Famiglia",ru:"Семья",tr:"Aile",hi:"परिवार",ur:"خاندان",zh:"家庭",ja:"家族",nl:"Familie",pl:"Rodzina",ro:"Familie",bn:"পরিবার",id:"Keluarga",sw:"Familia",fil:"Family",mr:"कुटुंब",te:"కుటుంబం"},
  memories:{el:"Αναμνήσεις",en:"Memories",ar:"الذكريات",es:"Recuerdos",fr:"Souvenirs",de:"Erinnerungen",pt:"Memórias",it:"Ricordi",ru:"Воспоминания",tr:"Anılar",hi:"यादें",ur:"یادیں",zh:"回忆",ja:"思い出",nl:"Herinneringen",pl:"Wspomnienia",ro:"Amintiri",bn:"স্মৃতি",id:"Kenangan",sw:"Kumbukumbu",fil:"Memories",mr:"आठवणी",te:"జ్ఞాపకాలు"},
  milestones:{el:"Ορόσημα Ανάπτυξης",en:"Development Milestones",ar:"الإنجازات",es:"Hitos",fr:"Étapes",de:"Meilensteine",pt:"Marcos",it:"Tappe",ru:"Вехи",tr:"Aşamalar",hi:"माइलस्टोन",ur:"سنگ میل",zh:"里程碑",ja:"マイルストーン",nl:"Mijlpalen",pl:"Etapy",ro:"Etape",bn:"মাইলফলক",id:"Tonggak",sw:"Hatua",fil:"Development Milestones",mr:"टप्पे",te:"మైలురాళ్ళు"},
  profile_tab:{el:"Προφίλ",en:"Profile",ar:"الملف",es:"Perfil",fr:"Profil",de:"Profil",pt:"Perfil",it:"Profilo",ru:"Профиль",tr:"Profil",hi:"प्रोफ़ाइल",ur:"پروفائل",zh:"资料",ja:"プロフィール",nl:"Profiel",pl:"Profil",ro:"Profil",bn:"প্রোফাইল",id:"Profil",sw:"Wasifu",fil:"Profile",mr:"प्रोफाइल",te:"ప్రొఫైల్"},
  heymaa_tab:{el:"HeyMaa",en:"HeyMaa",ar:"HeyMaa",es:"HeyMaa",fr:"HeyMaa",de:"HeyMaa",pt:"HeyMaa",it:"HeyMaa",ru:"HeyMaa",tr:"HeyMaa",hi:"HeyMaa",ur:"HeyMaa",zh:"HeyMaa",ja:"HeyMaa",nl:"HeyMaa",pl:"HeyMaa",ro:"HeyMaa",bn:"HeyMaa",id:"HeyMaa",sw:"HeyMaa",fil:"HeyMaa",mr:"HeyMaa",te:"HeyMaa"},
  shopping:{el:"Shopping",en:"Shopping",ar:"التسوق",es:"Compras",fr:"Achats",de:"Einkaufen",pt:"Compras",it:"Shopping",ru:"Покупки",tr:"Alışveriş",hi:"शॉपिंग",ur:"شاپنگ",zh:"购物",ja:"ショッピング",nl:"Winkelen",pl:"Zakupy",ro:"Cumpărături",bn:"কেনাকাটা",id:"Belanja",sw:"Ununuzi",fil:"Shopping",mr:"खरेदी",te:"షాపింగ్"},
  offers:{el:"Προσφορές",en:"Offers",ar:"العروض",zh:"优惠",es:"Ofertas",fr:"Offres",ro:"Oferte",pl:"Oferty",tr:"Teklifler",hi:"ऑफर्स",ur:"پیشکشیں",ja:"お得情報",ru:"Предложения",de:"Angebote",pt:"Ofertas",it:"Offerte",nl:"Aanbiedingen",bn:"অফার",id:"Penawaran",sw:"Matoleo",fil:"Mga Alok",mr:"ऑफर्स",te:"ఆఫర్‌లు"},
  offers_sub:{el:"Ενημερώσεις, νέα και προσφορές από την ομάδα της HeyMaa.",en:"Updates, news and offers from the HeyMaa team.",ar:"تحديثات وأخبار وعروض من فريق HeyMaa.",zh:"来自HeyMaa团队的更新、新闻和优惠。",es:"Novedades, noticias y ofertas del equipo de HeyMaa.",fr:"Mises à jour, actualités et offres de l'équipe HeyMaa.",ro:"Actualizări, știri și oferte de la echipa HeyMaa.",pl:"Aktualizacje, wiadomości i oferty od zespołu HeyMaa.",tr:"HeyMaa ekibinden güncellemeler, haberler ve teklifler.",hi:"HeyMaa टीम से अपडेट, समाचार और ऑफर।",ur:"HeyMaa ٹیم سے اپڈیٹس، خبریں اور پیشکشیں۔",ja:"HeyMaaチームからの最新情報、ニュース、お得情報。",ru:"Обновления, новости и предложения от команды HeyMaa.",de:"Updates, Neuigkeiten und Angebote vom HeyMaa-Team.",pt:"Atualizações, novidades e ofertas da equipa HeyMaa.",it:"Aggiornamenti, novità e offerte dal team HeyMaa.",nl:"Updates, nieuws en aanbiedingen van het HeyMaa-team.",bn:"HeyMaa টিমের আপডেট, খবর এবং অফার।",id:"Pembaruan, berita, dan penawaran dari tim HeyMaa.",sw:"Habari, masasisho na matoleo kutoka timu ya HeyMaa.",fil:"Mga update, balita, at alok mula sa HeyMaa team.",mr:"HeyMaa टीमकडून अपडेट्स, बातम्या आणि ऑफर्स.",te:"HeyMaa టీమ్ నుండి అప్‌డేట్‌లు, వార్తలు మరియు ఆఫర్‌లు."},
  offers_empty:{el:"Δεν υπάρχουν νέες ενημερώσεις προς το παρόν.",en:"No new updates at the moment.",ar:"لا توجد تحديثات جديدة في الوقت الحالي.",zh:"目前没有新的更新。",es:"No hay novedades por el momento.",fr:"Aucune nouvelle mise à jour pour le moment.",ro:"Nu există actualizări noi momentan.",pl:"Brak nowych aktualizacji w tej chwili.",tr:"Şu anda yeni güncelleme yok.",hi:"फिलहाल कोई नया अपडेट नहीं है।",ur:"اس وقت کوئی نئی اپڈیٹ نہیں ہے۔",ja:"現在、新しいお知らせはありません。",ru:"Сейчас нет новых обновлений.",de:"Derzeit keine neuen Updates.",pt:"Sem novidades por agora.",it:"Nessun aggiornamento al momento.",nl:"Momenteel geen nieuwe updates.",bn:"এই মুহূর্তে নতুন কোনো আপডেট নেই।",id:"Belum ada pembaruan baru saat ini.",sw:"Hakuna masasisho mapya kwa sasa.",fil:"Walang bagong update sa ngayon.",mr:"सध्या कोणतेही नवीन अपडेट्स नाहीत.",te:"ఇప్పుడు కొత్త అప్‌డేట్‌లు లేవు."},
  loading:{el:"Φόρτωση...",en:"Loading...",ar:"جار التحميل...",zh:"加载中...",es:"Cargando...",fr:"Chargement...",ro:"Se încarcă...",pl:"Wczytywanie...",tr:"Yükleniyor...",hi:"लोड हो रहा है...",ur:"لوڈ ہو رہا ہے...",ja:"読み込み中...",ru:"Загрузка...",de:"Lädt...",pt:"A carregar...",it:"Caricamento...",nl:"Laden...",bn:"লোড হচ্ছে...",id:"Memuat...",sw:"Inapakia...",fil:"Naglo-load...",mr:"लोड होत आहे...",te:"లోడ్ అవుతోంది..."},
  learnmore:{el:"Μάθε περισσότερα",en:"Learn more",ar:"معرفة المزيد",zh:"了解更多",es:"Saber más",fr:"En savoir plus",ro:"Află mai multe",pl:"Dowiedz się więcej",tr:"Daha fazla bilgi",hi:"अधिक जानें",ur:"مزید جانیں",ja:"もっと見る",ru:"Подробнее",de:"Mehr erfahren",pt:"Saber mais",it:"Scopri di più",nl:"Meer informatie",bn:"আরও জানুন",id:"Pelajari lebih lanjut",sw:"Jifunze zaidi",fil:"Alamin pa",mr:"अधिक जाणून घ्या",te:"మరింత తెలుసుకోండి"},
  typehere:{el:"Γράψε κάτι...",en:"Type something...",ar:"اكتبي شيئاً...",es:"Escribe algo...",fr:"Écris quelque chose...",de:"Schreib etwas...",pt:"Escreve algo...",it:"Scrivi qualcosa...",ru:"Напишите что-нибудь...",tr:"Bir şey yaz...",hi:"कुछ लिखें...",ur:"کچھ لکھیں...",zh:"输入点什么...",ja:"何か入力...",nl:"Typ iets...",pl:"Napisz coś...",ro:"Scrie ceva...",bn:"কিছু লিখুন...",id:"Tulis sesuatu...",sw:"Andika kitu...",fil:"Type something...",mr:"काहीतरी लिहा...",te:"ఏదైనా టైప్ చేయండి..."},
  listening:{el:"Σε ακούω… μίλα τώρα",en:"Listening… speak now",ar:"أستمع… تحدثي الآن",es:"Escuchando… habla ahora",fr:"J'écoute… parle maintenant",de:"Ich höre zu… sprich jetzt",pt:"A ouvir… fala agora",it:"Ti ascolto… parla ora",ru:"Слушаю… говори",tr:"Dinliyorum… şimdi konuş",hi:"सुन रही हूँ… अब बोलें",ur:"سن رہی ہوں… اب بولیں",zh:"正在听…请说",ja:"聞いています…話してね",nl:"Ik luister… spreek nu",pl:"Słucham… mów teraz",ro:"Te ascult… vorbește acum",bn:"শুনছি… এখন বলুন",id:"Mendengarkan… bicara sekarang",sw:"Ninasikiliza… sema sasa",fil:"Listening… speak now",mr:"ऐकत आहे… आता बोला",te:"వింటున్నాను… ఇప్పుడు మాట్లాడండి"},
  recentmem:{el:"Αναμνήσεις",en:"Memories",ar:"الذكريات",es:"Recuerdos",fr:"Souvenirs",de:"Erinnerungen",pt:"Memórias",it:"Ricordi",ru:"Воспоминания",tr:"Anılar",hi:"यादें",ur:"یادیں",zh:"回忆",ja:"思い出",nl:"Herinneringen",pl:"Wspomnienia",ro:"Amintiri",bn:"স্মৃতি",id:"Kenangan",sw:"Kumbukumbu",fil:"Memories",mr:"आठवणी",te:"జ్ఞాపకాలు"},
  addmemory:{el:"Γράψε μια ανάμνηση...",en:"Write a memory...",ar:"أضيفي ذكرى...",es:"Escribe un recuerdo...",fr:"Ajouter un souvenir...",de:"Erinnerung hinzufügen...",pt:"Adicionar memória...",it:"Aggiungi ricordo...",ru:"Добавить воспоминание...",tr:"Anı ekle...",hi:"याद लिखें...",ur:"یاد لکھیں...",zh:"写下回忆...",ja:"思い出を書く...",nl:"Herinnering schrijven...",pl:"Napisz wspomnienie...",ro:"Scrie amintire...",bn:"স্মৃতি লিখুন...",id:"Tulis kenangan...",sw:"Andika kumbukumbu...",fil:"Write a memory...",mr:"आठवण लिहा...",te:"జ్ఞాపకం రాయండి..."},
  nomemories:{el:"Δεν υπάρχουν αναμνήσεις ακόμα.",en:"No memories yet. Add your first!",ar:"لا توجد ذكريات بعد.",es:"Aún no hay recuerdos.",fr:"Pas encore de souvenirs.",de:"Noch keine Erinnerungen.",pt:"Ainda sem memórias.",it:"Ancora nessun ricordo.",ru:"Пока нет воспоминаний.",tr:"Henüz anı yok.",hi:"अभी यादें नहीं।",ur:"ابھی یادیں نہیں۔",zh:"还没有回忆。",ja:"まだ思い出がありません。",nl:"Nog geen herinneringen.",pl:"Brak wspomnień.",ro:"Nu există amintiri.",bn:"এখনও স্মৃতি নেই।",id:"Belum ada kenangan.",sw:"Bado hakuna kumbukumbu.",fil:"No memories yet. Add your first!",mr:"अजून आठवणी नाहीत.",te:"ఇంకా జ్ఞాపకాలు లేవు."},
  selectmem:{el:"Διάλεξε μέλος για να δεις τις αναμνήσεις του.",en:"Select a member to see their memories.",ar:"اختر فرداً لعرض ذكرياته.",es:"Elige un miembro para ver sus recuerdos.",fr:"Choisis un membre pour voir ses souvenirs.",de:"Wähle ein Mitglied, um Erinnerungen zu sehen.",pt:"Escolhe um membro para ver as memórias.",it:"Scegli un membro per vedere i ricordi.",ru:"Выберите члена семьи, чтобы увидеть воспоминания.",tr:"Anılarını görmek için bir üye seç.",hi:"यादें देखने के लिए सदस्य चुनें।",ur:"یادیں دیکھنے کے لیے رکن منتخب کریں۔",zh:"选择成员查看回忆。",ja:"思い出を見るメンバーを選んでください。",nl:"Kies een lid om herinneringen te zien.",pl:"Wybierz członka, aby zobaczyć wspomnienia.",ro:"Alege un membru pentru a vedea amintirile.",bn:"স্মৃতি দেখতে সদস্য বেছে নিন।",id:"Pilih anggota untuk melihat kenangan.",sw:"Chagua mwanachama kuona kumbukumbu.",fil:"Select a member to see their memories.",mr:"आठवणी पाहण्यासाठी सदस्य निवडा.",te:"జ్ఞాపకాలు చూడటానికి సభ్యుని ఎంచుకోండి."},
  myfamily:{el:"Η Οικογένειά μου",en:"My Family",ar:"عائلتي",es:"Mi Familia",fr:"Ma Famille",de:"Meine Familie",pt:"Minha Família",it:"La Mia Famiglia",ru:"Моя Семья",tr:"Ailem",hi:"मेरा परिवार",ur:"میرا خاندان",zh:"我的家庭",ja:"私の家族",nl:"Mijn Familie",pl:"Moja Rodzina",ro:"Familia Mea",bn:"আমার পরিবার",id:"Keluargaku",sw:"Familia Yangu",fil:"My Family",mr:"माझे कुटुंब",te:"నా కుటుంబం"},
  addmember:{el:"＋ Πρόσθεσε μέλος",en:"＋ Add family member",ar:"＋ إضافة فرد",es:"＋ Agregar miembro",fr:"＋ Ajouter un membre",de:"＋ Mitglied hinzufügen",pt:"＋ Adicionar membro",it:"＋ Aggiungi membro",ru:"＋ Добавить члена",tr:"＋ Üye ekle",hi:"＋ सदस्य जोड़ें",ur:"＋ رکن شامل کریں",zh:"＋ 添加成员",ja:"＋ 家族を追加",nl:"＋ Lid toevoegen",pl:"＋ Dodaj członka",ro:"＋ Adaugă un membru",bn:"＋ সদস্য যোগ করুন",id:"＋ Tambah anggota",sw:"＋ Ongeza mwanafamilia",fil:"＋ Add family member",mr:"＋ सदस्य जोडा",te:"＋ సభ్యుని జోడించు"},
  show:{el:"Εμφάνιση",en:"Show",ar:"إظهار",es:"Mostrar",fr:"Afficher",de:"Anzeigen",pt:"Mostrar",it:"Mostra",ru:"Показать",tr:"Göster",hi:"दिखाएं",ur:"دکھائیں",zh:"显示",ja:"表示",nl:"Tonen",pl:"Pokaż",ro:"Arată",bn:"দেখান",id:"Tampilkan",sw:"Onyesha",fil:"Show",mr:"दाखवा",te:"చూపించు"},
  hide:{el:"Απόκρυψη",en:"Hide",ar:"إخفاء",es:"Ocultar",fr:"Masquer",de:"Ausblenden",pt:"Ocultar",it:"Nascondi",ru:"Скрыть",tr:"Gizle",hi:"छिपाएं",ur:"چھپائیں",zh:"隐藏",ja:"非表示",nl:"Verbergen",pl:"Ukryj",ro:"Ascunde",bn:"লুকান",id:"Sembunyikan",sw:"Ficha",fil:"Hide",mr:"लपवा",te:"దాచు"},
  addpet:{el:"＋ Πρόσθεσε κατοικίδιο",en:"＋ Add family pet",ar:"＋ إضافة حيوان أليف",es:"＋ Agregar mascota",fr:"＋ Ajouter un animal",de:"＋ Haustier hinzufügen",pt:"＋ Adicionar animal",it:"＋ Aggiungi pet",ru:"＋ Добавить питомца",tr:"＋ Evcil hayvan ekle",hi:"＋ पालतू जोड़ें",ur:"＋ پالتو شامل کریں",zh:"＋ 添加宠物",ja:"＋ ペットを追加",nl:"＋ Huisdier toevoegen",pl:"＋ Dodaj zwierzaka",ro:"＋ Adaugă animal",bn:"＋ পোষা প্রাণী যোগ করুন",id:"＋ Tambah hewan",sw:"＋ Ongeza mnyama",fil:"＋ Add family pet",mr:"＋ पाळीव प्राणी जोडा",te:"＋ పెంపుడు జంతువు జోడించు"},
  products:{el:"Προϊόντα",en:"Products",ar:"المنتجات",es:"Productos",fr:"Produits",de:"Produkte",pt:"Produtos",it:"Prodotti",ru:"Товары",tr:"Ürünler",hi:"उत्पाद",ur:"مصنوعات",zh:"产品",ja:"製品",nl:"Producten",pl:"Produkty",ro:"Produse",bn:"পণ্য",id:"Produk",sw:"Bidhaa",fil:"Products",mr:"उत्पादने",te:"ఉత్పత్తులు"},
  supermarket:{el:"Σούπερ Μάρκετ",en:"Supermarket",ar:"سوبرماركت",es:"Supermercado",fr:"Supermarché",de:"Supermarkt",pt:"Supermercado",it:"Supermercato",ru:"Супермаркет",tr:"Süpermarket",hi:"सुपरमार्केट",ur:"سپر مارکیٹ",zh:"超市",ja:"スーパー",nl:"Supermarkt",pl:"Supermarket",ro:"Supermarket",bn:"সুপারমার্কেট",id:"Supermarket",sw:"Madukani",fil:"Supermarket",mr:"सुपरमार्केट",te:"సూపర్‌మార్కెట్"},
  additem:{el:"Πρόσθεσε προϊόν...",en:"Add product...",ar:"أضيفي منتجاً...",es:"Agregar producto...",fr:"Ajouter produit...",de:"Produkt hinzufügen...",pt:"Adicionar produto...",it:"Aggiungi prodotto...",ru:"Добавить товар...",tr:"Ürün ekle...",hi:"उत्पाद जोड़ें...",ur:"مصنوع شامل کریں...",zh:"添加产品...",ja:"商品を追加...",nl:"Product toevoegen...",pl:"Dodaj produkt...",ro:"Adaugă produs...",bn:"পণ্য যোগ করুন...",id:"Tambah produk...",sw:"Ongeza bidhaa...",fil:"Add product...",mr:"उत्पादन जोडा...",te:"ఉత్పత్తి జోడించు..."},
  addtolist:{el:"Πρόσθεσε στη λίστα...",en:"Add to list...",ar:"أضيفي إلى القائمة...",es:"Agregar a lista...",fr:"Ajouter à la liste...",de:"Zur Liste hinzufügen...",pt:"Adicionar à lista...",it:"Aggiungi alla lista...",ru:"Добавить в список...",tr:"Listeye ekle...",hi:"सूची में जोड़ें...",ur:"فہرست میں شامل کریں...",zh:"添加到清单...",ja:"リストに追加...",nl:"Toevoegen aan lijst...",pl:"Dodaj do listy...",ro:"Adaugă la listă...",bn:"তালিকায় যোগ করুন...",id:"Tambah ke daftar...",sw:"Ongeza kwenye orodha...",fil:"Add to list...",mr:"यादीत जोडा...",te:"జాబితాకు జోడించు..."},
  sendlist:{el:"Αποστολή:",en:"Send via:",ar:"إرسال:",es:"Enviar:",fr:"Envoyer:",de:"Senden:",pt:"Enviar:",it:"Invia:",ru:"Отправить:",tr:"Gönder:",hi:"भेजें:",ur:"بھیجیں:",zh:"发送：",ja:"送る：",nl:"Versturen:",pl:"Wyślij:",ro:"Trimite:",bn:"পাঠান:",id:"Kirim:",sw:"Tuma:",fil:"Send via:",mr:"Надіслати:",te:"పంపు:"},
  selectlang:{el:"Επίλεξε γλώσσα",en:"Select language",ar:"اختر اللغة",es:"Seleccionar idioma",fr:"Choisir la langue",de:"Sprache wählen",pt:"Selecionar idioma",it:"Seleziona lingua",ru:"Выбрать язык",tr:"Dil seç",hi:"भाषा चुनें",ur:"زبان منتخب کریں",zh:"选择语言",ja:"言語を選択",nl:"Taal kiezen",pl:"Wybierz język",ro:"Selectați limba",bn:"ভাষা নির্বাচন",id:"Pilih bahasa",sw:"Chagua lugha",fil:"Select language",mr:"भाषा निवडा",te:"భాష ఎంచుకోండి"},
  chatgreet:{el:"Γεια σου,",en:"Hi,",ar:"مرحباً،",es:"Hola,",fr:"Bonjour,",de:"Hallo,",pt:"Olá,",it:"Ciao,",ru:"Привет,",tr:"Merhaba,",hi:"नमस्ते,",ur:"ہائے،",zh:"你好，",ja:"こんにちは、",nl:"Hallo,",pl:"Cześć,",ro:"Bună,",bn:"হ্যালো,",id:"Halo,",sw:"Habari,",fil:"Hi,",mr:"नमस्कार,",te:"హలో,"},
  chatgreet2:{el:"χαίρομαι που βρίσκεσαι εδώ. Πώς μπορώ να σε βοηθήσω;",en:"glad you're here. How can I help you today?",ar:"يسعدني وجودك. كيف أساعدك؟",es:"alegría tenerte. ¿En qué te ayudo?",fr:"content que tu sois là. Comment t'aider?",de:"schön, dass du hier bist. Wie helfe ich dir?",pt:"fico feliz. Como posso ajudar?",it:"felice che tu sia qui. Come aiutarti?",ru:"рад что ты здесь. Как помочь?",tr:"burada olduğuna sevindim. Nasıl yardım edebilirim?",hi:"खुशी है। कैसे मदद करूँ?",ur:"خوشی ہے۔ کیسے مدد کروں؟",zh:"很高兴你来了。今天我能帮什么？",ja:"来てくれて嬉しい。どう手伝えますか？",nl:"blij dat je er bent. Hoe kan ik helpen?",pl:"cieszę się. Jak pomóc?",ro:"mă bucur că ești. Cum te ajut?",bn:"আনন্দিত। কীভাবে সাহায্য করব?",id:"senang kamu ada. Bagaimana aku membantumu?",sw:"nafurahi uko. Ninakusaidiaje?",fil:"glad you're here. How can I help you today?",mr:"радий що ти тут. Як допомогти?",te:"మీరు ఇక్కడ ఉన్నందుకు సంతోషం. నేను ఎలా సహాయపడను?"},
  listen:{el:"🔊 Άκουσε",en:"🔊 Listen",ar:"🔊 استمع",es:"🔊 Escuchar",fr:"🔊 Écouter",de:"🔊 Anhören",pt:"🔊 Ouvir",it:"🔊 Ascolta",ru:"🔊 Слушать",tr:"🔊 Dinle",hi:"🔊 सुनें",ur:"🔊 سنیں",zh:"🔊 收听",ja:"🔊 聞く",nl:"🔊 Luisteren",pl:"🔊 Słuchaj",ro:"🔊 Ascultă",bn:"🔊 শুনুন",id:"🔊 Dengar",sw:"🔊 Sikiliza",fil:"🔊 Listen",mr:"🔊 ऐका",te:"🔊 వినండి"},
  playing:{el:"⏸ Παίζει...",en:"⏸ Playing...",ar:"⏸ يعزف...",es:"⏸ Reproduciendo...",fr:"⏸ Lecture...",de:"⏸ Spielt...",pt:"⏸ A reproduzir...",it:"⏸ In riproduzione...",ru:"⏸ Воспроизводится...",tr:"⏸ Oynatılıyor...",hi:"⏸ चल रहा है...",ur:"⏸ چل رہا ہے...",zh:"⏸ 播放中...",ja:"⏸ 再生中...",nl:"⏸ Afspelen...",pl:"⏸ Gra...",ro:"⏸ Se redă...",bn:"⏸ বাজছে...",id:"⏸ Memutar...",sw:"⏸ Inacheza...",fil:"⏸ Playing...",mr:"⏸ वाजत आहे...",te:"⏸ ప్లేయవుతోంది..."},
  thinking:{el:"Σκέφτομαι…",en:"Thinking…",ar:"أفكر…",es:"Pensando…",fr:"Je réfléchis…",de:"Denke nach…",pt:"A pensar…",it:"Sto pensando…",ru:"Думаю…",tr:"Düşünüyorum…",hi:"सोच रही हूँ…",ur:"سوچ رہی ہوں…",zh:"思考中…",ja:"考え中…",nl:"Even nadenken…",pl:"Myślę…",ro:"Mă gândesc…",bn:"ভাবছি…",id:"Sedang berpikir…",sw:"Nafikiri…",fil:"Thinking…",mr:"विचार करत आहे…",te:"ఆలోచిస్తున్నాను…"},
  chat_error:{el:"Κάτι πήγε στραβά. Δοκίμασε ξανά σε λίγο.",en:"Something went wrong. Please try again in a moment.",ar:"حدث خطأ. حاولي مرة أخرى بعد قليل.",es:"Algo salió mal. Inténtalo de nuevo en un momento.",fr:"Un problème est survenu. Réessaie dans un instant.",de:"Etwas ist schiefgelaufen. Bitte versuche es gleich noch einmal.",pt:"Algo correu mal. Tenta novamente daqui a pouco.",it:"Qualcosa è andato storto. Riprova tra un momento.",ru:"Что-то пошло не так. Попробуйте ещё раз чуть позже.",tr:"Bir şeyler ters gitti. Biraz sonra tekrar dene.",hi:"कुछ गलत हो गया। थोड़ी देर बाद फिर कोशिश करें।",ur:"کچھ غلط ہو گیا۔ تھوڑی دیر بعد دوبارہ کوشش کریں۔",zh:"出了点问题。请稍后再试。",ja:"問題が発生しました。しばらくしてからもう一度お試しください。",nl:"Er ging iets mis. Probeer het zo opnieuw.",pl:"Coś poszło nie tak. Spróbuj ponownie za chwilę.",ro:"Ceva nu a mers. Încearcă din nou imediat.",bn:"কিছু ভুল হয়েছে। একটু পরে আবার চেষ্টা করুন।",id:"Ada yang salah. Coba lagi sebentar.",sw:"Hitilafu imetokea. Jaribu tena baadaye kidogo.",fil:"Something went wrong. Please try again in a moment.",mr:"काहीतरी चुकले. थोड्या वेळाने पुन्हा प्रयत्न करा.",te:"ఏదో తప్పు జరిగింది. కాసేపటి తర్వాత మళ్లీ ప్రయత్నించండి."},
  voicequota:{el:"Φωνητικά μηνύματα",en:"Voice messages",ar:"الرسائل الصوتية",zh:"语音消息",es:"Mensajes de voz",fr:"Messages vocaux",ro:"Mesaje vocale",pl:"Wiadomości głosowe",tr:"Sesli mesajlar",hi:"वॉइस मैसेज",ur:"وائس میسجز",ja:"音声メッセージ",ru:"Голосовые сообщения",de:"Sprachnachrichten",pt:"Mensagens de voz",it:"Messaggi vocali",nl:"Spraakberichten",bn:"ভয়েস মেসেজ",id:"Pesan suara",sw:"Ujumbe wa sauti",fil:"Mga voice message",mr:"व्हॉइस मेसेज",te:"వాయిస్ సందేశాలు"},
  askmaa:{el:"Ρώτα τη Maa →",en:"Ask Maa →",ar:"اسأل Maa →",es:"Preguntar a Maa →",fr:"Demander à Maa →",de:"Maa fragen →",pt:"Perguntar à Maa →",it:"Chiedi a Maa →",ru:"Спросить Maa →",tr:"Maa'ya sor →",hi:"Maa से पूछें →",ur:"Maa سے پوچھیں →",zh:"问Maa →",ja:"Maaに聞く →",nl:"Vraag Maa →",pl:"Zapytaj Maa →",ro:"Întreabă Maa →",bn:"Maa-কে জিজ্ঞেস করুন →",id:"Tanya Maa →",sw:"Uliza Maa →",fil:"Ask Maa →",mr:"Maa ला विचारा →",te:"Maa ని అడగండి →"},
  tickall:{el:"Τίκαρε τα milestones που έχει πετύχει!",en:"Tick the milestones your baby has reached!",ar:"ضعي علامة على الإنجازات!",es:"¡Marca los hitos logrados!",fr:"Cochez les étapes atteintes!",de:"Meilensteine abhaken!",pt:"Assinala os marcos alcançados!",it:"Spunta i traguardi raggiunti!",ru:"Отметьте достигнутые вехи!",tr:"Ulaşılan aşamaları işaretle!",hi:"पूरे माइलस्टोन चुनें!",ur:"سنگ میل نشان لگائیں!",zh:"勾选宝宝达到的里程碑！",ja:"達成したマイルストーンをチェック！",nl:"Vink de behaalde mijlpalen aan!",pl:"Zaznacz osiągnięte etapy!",ro:"Bifează etapele atinse!",bn:"মাইলফলক টিক করুন!",id:"Centang tonggak yang dicapai!",sw:"Weka alama kwa hatua!",fil:"Tick the milestones your baby has reached!",mr:"पूर्ण झालेले टप्पे निवडा!",te:"మైలురాళ్ళను టిక్ చేయండి!"},
  ms_locked_hint:{el:"Προεπισκόπηση — τα μελλοντικά ορόσημα δεν μπορούν ακόμα να τικαριστούν.",en:"Preview — future milestones can't be ticked yet."},
  ms_period_progress:{el:"Πρόοδος περιόδου",en:"Period progress"},
  ms_current_period:{el:"Τρέχων",en:"Current"},
  ms_next_preview:{el:"Επόμενο",en:"Next"},
  ms_past_period:{el:"Ολοκληρωμένη περίοδος — μπορείς να τικάρεις ό,τι έχει γίνει.",en:"Past period — tick anything that happened."},
  askaboutmile:{el:"Θέλεις να μάθεις περισσότερα για τα επόμενα milestones;",en:"Want to know more about upcoming milestones?",ar:"تريدين معرفة المزيد عن الإنجازات القادمة؟",es:"¿Quieres saber más sobre los próximos hitos?",fr:"Vous voulez en savoir plus sur les prochaines étapes?",de:"Mehr über kommende Meilensteine erfahren?",pt:"Quer saber mais sobre os próximos marcos?",it:"Vuoi sapere di più sui prossimi traguardi?",ru:"Хочешь узнать больше о следующих вехах?",tr:"Yaklaşan dönüm noktaları hakkında daha fazla bilgi ister misin?",hi:"अगले माइलस्टोन के बारे में जानना चाहती हैं?",ur:"آنے والے سنگ میلوں کے بارے میں جاننا چاہتی ہیں؟",zh:"想了解即将到来的里程碑吗？",ja:"次のマイルストーンについて知りたいですか？",nl:"Meer weten over aankomende mijlpalen?",pl:"Chcesz wiedzieć więcej o nadchodzących etapach?",ro:"Vrei să afli mai multe despre etapele viitoare?",bn:"পরবর্তী মাইলফলক সম্পর্কে জানতে চান?",id:"Ingin tahu lebih tentang tonggak berikutnya?",sw:"Unataka kujua zaidi kuhusu hatua zinazokuja?",fil:"Want to know more about upcoming milestones?",mr:"पुढील टप्प्यांबद्दल अधिक जाणून घ्यायचे आहे?",te:"రాబోయే మైలురాళ్ళ గురించి తెలుసుకోవాలా?"},
  save:{el:"Αποθήκευση",en:"Save",ar:"حفظ",es:"Guardar",fr:"Enregistrer",de:"Speichern",pt:"Guardar",it:"Salva",ru:"Сохранить",tr:"Kaydet",hi:"सहेजें",ur:"محفوظ",zh:"保存",ja:"保存",nl:"Opslaan",pl:"Zapisz",ro:"Salvează",bn:"সংরক্ষণ",id:"Simpan",sw:"Hifadhi",fil:"Save",mr:"जतन करा",te:"సేవ్ చేయి"},
  cancel:{el:"Ακύρωση",en:"Cancel",ar:"إلغاء",es:"Cancelar",fr:"Annuler",de:"Abbrechen",pt:"Cancelar",it:"Annulla",ru:"Отмена",tr:"İptal",hi:"रद्द करें",ur:"منسوخ",zh:"取消",ja:"キャンセル",nl:"Annuleren",pl:"Anuluj",ro:"Anulează",bn:"বাতিল",id:"Batal",sw:"Ghairi",fil:"Cancel",mr:"रद्द करा",te:"రద్దు చేయి"},
  newthread:{el:"Νέα συνομιλία",en:"New conversation",ar:"محادثة جديدة",es:"Nueva conversación",fr:"Nouvelle conversation",de:"Neues Gespräch",pt:"Nova conversa",it:"Nuova conversazione",ru:"Новый разговор",tr:"Yeni konuşma",hi:"नई बातचीत",ur:"نئی بات",zh:"新对话",ja:"新しい会話",nl:"Nieuw gesprek",pl:"Nowa rozmowa",ro:"Conversație nouă",bn:"নতুন কথোপকথন",id:"Percakapan baru",sw:"Mazungumzo mapya",fil:"New conversation",mr:"नवीन संवाद",te:"కొత్త సంభాషణ"},
  archivethread:{el:"Αρχειοθέτηση",en:"Archive",ar:"أرشفة",es:"Archivar",fr:"Archiver",de:"Archivieren",pt:"Arquivar",it:"Archivia",ru:"Архивировать",tr:"Arşivle",hi:"संग्रहीत करें",ur:"آرکائیو",zh:"归档",ja:"アーカイブ",nl:"Archiveren",pl:"Archiwizuj",ro:"Arhivează",bn:"আর্কাইভ করুন",id:"Arsipkan",sw:"Hifadhi",fil:"Archive",mr:"संग्रहित करा",te:"ఆర్కైవ్ చేయి"},
  pastthreads:{el:"Παλαιές συνομιλίες",en:"Past conversations",ar:"المحادثات السابقة",es:"Conversaciones anteriores",fr:"Conversations passées",de:"Vergangene Gespräche",pt:"Conversas anteriores",it:"Conversazioni passate",ru:"Прошлые разговоры",tr:"Geçmiş konuşmalar",hi:"पुरानी बातचीत",ur:"پرانی باتیں",zh:"过去的对话",ja:"過去の会話",nl:"Eerdere gesprekken",pl:"Poprzednie rozmowy",ro:"Conversații vechi",bn:"পুরানো কথোপকথন",id:"Percakapan lama",sw:"Mazungumzo ya zamani",fil:"Past conversations",mr:"जुने संवाद",te:"పాత సంభాషణలు"},
  nameyourthread:{el:"Δώσε τίτλο στη συνομιλία",en:"Name this conversation",ar:"سمّي هذه المحادثة",es:"Nombra esta conversación",fr:"Nommez cette conversation",de:"Gespräch benennen",pt:"Nomeia esta conversa",it:"Dai un nome alla conversazione",ru:"Назовите разговор",tr:"Konuşmayı adlandır",hi:"बातचीत का नाम दें",ur:"بات کا نام دیں",zh:"为对话命名",ja:"会話に名前をつけて",nl:"Gesprek een naam geven",pl:"Nazwij rozmowę",ro:"Denumește conversația",bn:"কথোপকথনের নাম দিন",id:"Beri nama percakapan",sw:"Ipe jina mazungumzo",fil:"Name this conversation",mr:"संवादाला नाव द्या",te:"సంభాషణకు పేరు పెట్టండి"},
  membername:{el:"Όνομα",en:"Name",ar:"الاسم",es:"Nombre",fr:"Prénom",de:"Name",pt:"Nome",it:"Nome",ru:"Имя",tr:"Ad",hi:"नाम",ur:"نام",zh:"姓名",ja:"名前",nl:"Naam",pl:"Imię",ro:"Nume",bn:"নাম",id:"Nama",sw:"Jina",fil:"Name",mr:"नाव",te:"పేరు"},
  memberrole:{el:"Σχέση (π.χ. Μπαμπάς)",en:"Relationship (e.g. Dad)",ar:"الصلة (مثل: أب)",es:"Relación (ej. Papá)",fr:"Lien (ex. Papa)",de:"Beziehung (z.B. Papa)",pt:"Relação (ex. Pai)",it:"Relazione (es. Papà)",ru:"Отношение (напр. Папа)",tr:"İlişki (örn. Baba)",hi:"रिश्ता (जैसे पापा)",ur:"رشتہ (مثلاً ابو)",zh:"关系（如爸爸）",ja:"関係（例：パパ）",nl:"Relatie (bijv. Papa)",pl:"Relacja (np. Tata)",ro:"Relație (ex. Tată)",bn:"সম্পর্ক",id:"Hubungan",sw:"Uhusiano",fil:"Relationship (e.g. Dad)",mr:"नाते (उदा. बाबा)",te:"సంబంధం"},
  addchild:{el:"＋ Πρόσθεσε παιδί",en:"＋ Add child",ar:"＋ إضافة طفل",es:"＋ Agregar hijo/a",fr:"＋ Ajouter un enfant",de:"＋ Kind hinzufügen",pt:"＋ Adicionar filho/a",it:"＋ Aggiungi bambino",ru:"＋ Добавить ребёнка",tr:"＋ Çocuk ekle",hi:"＋ बच्चा जोड़ें",ur:"＋ بچہ شامل کریں",zh:"＋ 添加孩子",ja:"＋ 子どもを追加",nl:"＋ Kind toevoegen",pl:"＋ Dodaj dziecko",ro:"＋ Adaugă copil",bn:"＋ শিশু যুক্ত করুন",id:"＋ Tambah anak",sw:"＋ Ongeza mtoto",fil:"＋ Magdagdag ng anak",mr:"＋ मूल जोडा",te:"＋ పిల్లలను జోడించండి"},
  memberemail:{el:"Email (προαιρετικό)",en:"Email (optional)",ar:"البريد الإلكتروني (اختياري)",es:"Correo (opcional)",fr:"E-mail (facultatif)",de:"E-Mail (optional)",pt:"E-mail (opcional)",it:"Email (opzionale)",ru:"Email (необязательно)",tr:"E-posta (isteğe bağlı)",hi:"ईमेल (वैकल्पिक)",ur:"ای میل (اختیاری)",zh:"电子邮箱（选填）",ja:"メール（任意）",nl:"E-mail (optioneel)",pl:"E-mail (opcjonalnie)",ro:"E-mail (opțional)",bn:"ইমেল (ঐচ্ছিক)",id:"Email (opsional)",sw:"Barua pepe (si lazima)",fil:"Email (opsyonal)",mr:"ईमेल (पर्यायी)",te:"ఇమెయిల్ (ఐచ్ఛికం)"},
  memberphone:{el:"Κινητό τηλέφωνο (προαιρετικό)",en:"Phone number (optional)",ar:"رقم الهاتف (اختياري)",es:"Teléfono (opcional)",fr:"Téléphone (facultatif)",de:"Telefonnummer (optional)",pt:"Telefone (opcional)",it:"Telefono (opzionale)",ru:"Телефон (необязательно)",tr:"Telefon numarası (isteğe bağlı)",hi:"फ़ोन नंबर (वैकल्पिक)",ur:"فون نمبر (اختیاری)",zh:"电话号码（选填）",ja:"電話番号（任意）",nl:"Telefoonnummer (optioneel)",pl:"Numer telefonu (opcjonalnie)",ro:"Număr de telefon (opțional)",bn:"ফোন নম্বর (ঐচ্ছিক)",id:"Nomor telepon (opsional)",sw:"Nambari ya simu (si lazima)",fil:"Numero ng telepono (opsyonal)",mr:"फोन नंबर (पर्यायी)",te:"ఫోన్ నంబర్ (ఐచ్ఛికం)"},
  nochildyet:{el:"Δεν έχεις προσθέσει ακόμα παιδί. Πρόσθεσέ το από την καρτέλα Οικογένεια για να δεις τα ορόσημά του.",en:"You haven't added a child yet. Add one from the Family tab to see their milestones.",ar:"لم تضيفي طفلاً بعد. أضيفيه من تبويب العائلة لعرض إنجازاته التطورية.",es:"Aún no has añadido un hijo/a. Añádelo en la pestaña Familia para ver sus hitos.",fr:"Vous n'avez pas encore ajouté d'enfant. Ajoutez-le dans l'onglet Famille pour voir ses étapes.",de:"Du hast noch kein Kind hinzugefügt. Füge es im Tab Familie hinzu, um die Meilensteine zu sehen.",pt:"Ainda não adicionaste um filho/a. Adiciona-o no separador Família para ver os marcos.",it:"Non hai ancora aggiunto un bambino. Aggiungilo nella scheda Famiglia per vedere le tappe.",ru:"Вы ещё не добавили ребёнка. Добавьте его на вкладке Семья, чтобы увидеть этапы развития.",tr:"Henüz çocuk eklemediniz. Gelişim aşamalarını görmek için Aile sekmesinden ekleyin.",hi:"आपने अभी तक बच्चा नहीं जोड़ा है। मील के पत्थर देखने के लिए परिवार टैब से जोड़ें।",ur:"آپ نے ابھی تک بچہ شامل نہیں کیا۔ سنگ میل دیکھنے کے لیے فیملی ٹیب سے شامل کریں۔",zh:"您还没有添加孩子。请在家庭标签中添加以查看发育里程碑。",ja:"まだお子さんが登録されていません。家族タブから追加するとマイルストーンが表示されます。",nl:"Je hebt nog geen kind toegevoegd. Voeg het toe via het tabblad Familie om mijlpalen te zien.",pl:"Nie dodałaś jeszcze dziecka. Dodaj je w zakładce Rodzina, aby zobaczyć kamienie milowe.",ro:"Nu ai adăugat încă un copil. Adaugă-l din fila Familie pentru a vedea reperele.",bn:"আপনি এখনও কোনো শিশু যুক্ত করেননি। মাইলফলক দেখতে পরিবার ট্যাব থেকে যুক্ত করুন।",id:"Anda belum menambahkan anak. Tambahkan dari tab Keluarga untuk melihat tonggak perkembangannya.",sw:"Bado hujamuongeza mtoto. Mwongeze kwenye kichupo cha Familia kuona hatua zake za maendeleo.",fil:"Wala ka pang naidagdag na anak. Idagdag sa tab ng Pamilya para makita ang mga milestone.",mr:"तुम्ही अजून मूल जोडलेले नाही. टप्पे पाहण्यासाठी कुटुंब टॅबमधून जोडा.",te:"మీరు ఇంకా పిల్లలను జోడించలేదు. మైలురాళ్లను చూడటానికి ఫ్యామిలీ టాబ్ నుండి జోడించండి."},

  docs_title:{el:"Αρχείο Εγγράφων",en:"Document Archive",ar:"أرشيف المستندات",zh:"文件档案",es:"Archivo de Documentos",fr:"Archive de Documents",de:"Dokumentenarchiv",pt:"Arquivo de Documentos",it:"Archivio Documenti",ru:"Архив Документов",tr:"Belge Arşivi",hi:"दस्तावेज़ संग्रह",ur:"دستاویز آرکائیو",ja:"書類アーカイブ",nl:"Documentenarchief",pl:"Archiwum Dokumentów",ro:"Arhivă Documente",bn:"ডকুমেন্ট আর্কাইভ",id:"Arsip Dokumen",sw:"Kumbukumbu ya Hati",fil:"Archibo ng Dokumento",mr:"दस्तऐवज संग्रह",te:"పత్రాల సంగ్రహం"},
  docs_hint:{el:"Κράτα εδώ σημείωση για τα έγγραφα που έχεις — ποιον αφορά, τι είναι, πότε. Δεν χρειάζεται να ανεβάσεις αρχεία — απλώς κράτα μια λίστα για να ξέρεις τι έχεις.",en:"Note your documents here — who they concern, what they are, when. No need to upload files — just a list so you always know what you have.",ar:"سجّلي مستنداتك هنا — من تخص، ماذا تعني، ومتى. لا داعي لرفع ملفات — فقط قائمة سريعة.",zh:"在此记录您的文件——涉及谁、是什么、何时。无需上传文件——只需快速列表。",es:"Anota aquí tus documentos — a quién conciernen, qué son, cuándo. Sin subir archivos — solo una lista rápida.",fr:"Notez ici vos documents — qui ils concernent, ce qu'ils sont, quand. Sans téléchargement — juste une liste rapide.",de:"Notiere hier deine Dokumente — wen sie betreffen, was sie sind, wann. Kein Upload — nur eine schnelle Liste.",pt:"Regista os teus documentos aqui — a quem dizem respeito, o que são, quando. Sem uploads — só uma lista rápida.",it:"Annota qui i tuoi documenti — chi riguardano, cosa sono, quando. Senza caricare file — solo un elenco.",ru:"Записывайте свои документы здесь — кого касаются, что это, когда. Без загрузок — просто быстрый список.",tr:"Belgelerini burada not et — kimi ilgilendiriyor, ne, ne zaman. Dosya yüklemene gerek yok — sadece hızlı bir liste.",hi:"यहाँ अपने दस्तावेज़ नोट करें — किससे संबंधित, क्या है, कब। अपलोड की ज़रूरत नहीं — बस एक सूची।",ur:"یہاں اپنی دستاویزات نوٹ کریں — کس سے متعلق، کیا ہے، کب۔ اپلوڈ کی ضرورت نہیں — بس ایک فہرست۔",ja:"ここに書類をメモしましょう — 誰に関係するか、何か、いつか。アップロード不要 — 何があるかわかるリストだけ。",nl:"Noteer hier je documenten — wie ze betreffen, wat ze zijn, wanneer. Geen uploads — alleen een snelle lijst.",pl:"Notuj tu swoje dokumenty — kogo dotyczą, co to jest, kiedy. Bez przesyłania — tylko szybka lista.",ro:"Notează-ți documentele aici — pe cine privesc, ce sunt, când. Fără încărcări — doar o listă rapidă.",bn:"এখানে আপনার নথি নোট করুন — কার সংক্রান্ত, কী, কখন। আপলোড দরকার নেই — শুধু একটি তালিকা।",id:"Catat dokumenmu di sini — siapa yang terkait, apa, kapan. Tidak perlu upload — cukup daftar cepat.",sw:"Andika hati zako hapa — zinamhusu nani, ni nini, lini. Hakuna haja ya kupakia — orodha tu ya haraka.",fil:"Itala ang iyong mga dokumento dito — sino ang may kaugnayan, ano, kailan. Hindi kailangang mag-upload — listahan lang.",mr:"इथे तुमचे दस्तऐवज नोंदवा — कुणाचे, काय, केव्हा। अपलोडची गरज नाही — फक्त एक यादी.",te:"ఇక్కడ మీ పత్రాలను నమోదు చేయండి — ఎవరికి సంబంధించినది, ఏమిటి, ఎప్పుడు. అప్‌లోడ్ అవసరం లేదు — కేవలం ఒక జాబితా."},
  docs_empty:{el:"Δεν υπάρχουν καταχωρίσεις ακόμα.",en:"No entries yet.",ar:"لا توجد إدخالات بعد.",zh:"暂无条目。",es:"Aún no hay entradas.",fr:"Aucune entrée pour l'instant.",de:"Noch keine Einträge.",pt:"Ainda sem entradas.",it:"Ancora nessun inserimento.",ru:"Записей пока нет.",tr:"Henüz giriş yok.",hi:"अभी कोई एंट्री नहीं।",ur:"ابھی کوئی اندراج نہیں۔",ja:"まだエントリがありません。",nl:"Nog geen invoer.",pl:"Brak wpisów.",ro:"Nicio înregistrare încă.",bn:"এখনো কোনো এন্ট্রি নেই।",id:"Belum ada entri.",sw:"Bado hakuna maingizo.",fil:"Wala pang mga entry.",mr:"अजून कोणतीही नोंद नाही.",te:"ఇంకా ఎంట్రీలు లేవు."},
  docs_add_title_ph:{el:"Τίτλος εγγράφου...",en:"Document title...",ar:"عنوان المستند...",zh:"文件标题...",es:"Título del documento...",fr:"Titre du document...",de:"Dokumenttitel...",pt:"Título do documento...",it:"Titolo documento...",ru:"Название документа...",tr:"Belge başlığı...",hi:"दस्तावेज़ शीर्षक...",ur:"دستاویز کا عنوان...",ja:"書類タイトル...",nl:"Documenttitel...",pl:"Tytuł dokumentu...",ro:"Titlul documentului...",bn:"নথির শিরোনাম...",id:"Judul dokumen...",sw:"Kichwa cha hati...",fil:"Pamagat ng dokumento...",mr:"दस्तऐवज शीर्षक...",te:"పత్రం శీర్షిక..."},
  docs_add_date_ph:{el:"Ημερομηνία (π.χ. Ιαν 2025)",en:"Date (e.g. Jan 2025)",ar:"التاريخ",zh:"日期",es:"Fecha",fr:"Date",de:"Datum",pt:"Data",it:"Data",ru:"Дата",tr:"Tarih",hi:"तारीख",ur:"تاریخ",ja:"日付",nl:"Datum",pl:"Data",ro:"Dată",bn:"তারিখ",id:"Tanggal",sw:"Tarehe",fil:"Petsa",mr:"तारीख",te:"తేదీ"},
  docs_add_cat_ph:{el:"Κατηγορία (π.χ. Εξετάσεις αίματος)",en:"Category (e.g. Blood tests)",ar:"الفئة (مثل: فحص الدم)",zh:"类别（如：血液检查）",es:"Categoría (ej. Análisis de sangre)",fr:"Catégorie (ex. Analyses de sang)",de:"Kategorie (z.B. Blutuntersuchung)",pt:"Categoria (ex. Análises ao sangue)",it:"Categoria (es. Analisi del sangue)",ru:"Категория (напр. Анализ крови)",tr:"Kategori (örn. Kan tahlili)",hi:"श्रेणी (जैसे रक्त परीक्षण)",ur:"زمرہ (مثلاً خون کی جانچ)",ja:"カテゴリ（例：血液検査）",nl:"Categorie (bijv. Bloedonderzoek)",pl:"Kategoria (np. Badania krwi)",ro:"Categorie (ex. Analize de sânge)",bn:"বিভাগ (যেমন রক্ত পরীক্ষা)",id:"Kategori (mis. Tes darah)",sw:"Aina (mf. Vipimo vya damu)",fil:"Kategorya (hal. Pagsusuri ng dugo)",mr:"श्रेणी (उदा. रक्त तपासणी)",te:"వర్గం (ఉదా. రక్త పరీక్షలు)"},
  add_to_products:{el:"＋ Στα Προϊόντα",en:"＋ To Products",ar:"＋ للمنتجات",zh:"＋ 加入商品",es:"＋ A Productos",fr:"＋ Aux Produits",de:"＋ Zu Produkten",pt:"＋ Para Produtos",it:"＋ Ai Prodotti",ru:"＋ В Товары",tr:"＋ Ürünlere",hi:"＋ उत्पादों में",ur:"＋ مصنوعات میں",ja:"＋ 商品へ",nl:"＋ Naar Producten",pl:"＋ Do Produktów",ro:"＋ La Produse",bn:"＋ পণ্যে যোগ",id:"＋ Ke Produk",sw:"＋ Kwenye Bidhaa",fil:"＋ Sa Produkto",mr:"＋ उत्पादनात",te:"＋ ఉత్పత్తులకు"},
  add_to_super:{el:"＋ Στο Σούπερ",en:"＋ To Supermarket",ar:"＋ للسوبرماركت",zh:"＋ 加入超市",es:"＋ Al Supermercado",fr:"＋ Au Supermarché",de:"＋ Zum Supermarkt",pt:"＋ Para Supermercado",it:"＋ Al Supermercato",ru:"＋ В Супермаркет",tr:"＋ Süpermarkete",hi:"＋ सुपरमार्केट में",ur:"＋ سپر مارکیٹ میں",ja:"＋ スーパーへ",nl:"＋ Naar Supermarkt",pl:"＋ Do Supermarketu",ro:"＋ La Supermarket",bn:"＋ সুপারমার্কেটে",id:"＋ Ke Supermarket",sw:"＋ Madukani",fil:"＋ Sa Supermarket",mr:"＋ सुपरमार्केटमध्ये",te:"＋ సూపర్‌మార్కెట్‌కు"},
  lang_mismatch:{el:"Γράφεις σε άλλη γλώσσα. Η φωνητική ανάγνωση χρησιμοποιεί τη γλώσσα της σημαίας ({flag}). Άλλαξε τη σημαία πάνω δεξιά για ανάγνωση σε αυτή τη γλώσσα.",en:"You're typing in another language. Voice playback uses your selected language ({flag}). Change the flag top-right to listen in this language.",ar:"أنتِ تكتبين بلغة أخرى. تستخدم القراءة الصوتية لغتك المختارة ({flag}). غيّري العلم في الأعلى للاستماع بهذه اللغة.",zh:"您正在用另一种语言输入。语音朗读使用您所选的语言（{flag}）。更改右上角的旗帜以用此语言收听。",es:"Estás escribiendo en otro idioma. La lectura de voz usa tu idioma seleccionado ({flag}). Cambia la bandera arriba a la derecha para escuchar en este idioma.",fr:"Vous écrivez dans une autre langue. La lecture vocale utilise votre langue sélectionnée ({flag}). Changez le drapeau en haut à droite pour écouter dans cette langue.",de:"Du schreibst in einer anderen Sprache. Die Sprachausgabe verwendet deine gewählte Sprache ({flag}). Ändere die Flagge oben rechts, um in dieser Sprache zu hören.",pt:"Estás a escrever noutro idioma. A leitura por voz usa o teu idioma selecionado ({flag}). Muda a bandeira no canto superior direito para ouvir neste idioma.",it:"Stai scrivendo in un'altra lingua. La lettura vocale usa la lingua selezionata ({flag}). Cambia la bandiera in alto a destra per ascoltare in questa lingua.",ru:"Вы пишете на другом языке. Озвучивание использует выбранный вами язык ({flag}). Измените флаг вверху справа, чтобы слушать на этом языке.",tr:"Başka bir dilde yazıyorsun. Sesli okuma seçtiğin dili kullanır ({flag}). Bu dilde dinlemek için sağ üstteki bayrağı değiştir.",hi:"आप दूसरी भाषा में लिख रही हैं। आवाज़ आपकी चुनी हुई भाषा ({flag}) का उपयोग करती है। इस भाषा में सुनने के लिए ऊपर दाईं ओर का झंडा बदलें।",ur:"آپ دوسری زبان میں لکھ رہی ہیں۔ آواز آپ کی منتخب زبان ({flag}) استعمال کرتی ہے۔ اس زبان میں سننے کے لیے اوپر دائیں طرف کا جھنڈا تبدیل کریں۔",ja:"別の言語で入力しています。音声読み上げは選択中の言語（{flag}）を使用します。この言語で聞くには右上の旗を変更してください。",nl:"Je typt in een andere taal. Spraakweergave gebruikt je geselecteerde taal ({flag}). Wijzig de vlag rechtsboven om in deze taal te luisteren.",pl:"Piszesz w innym języku. Odczyt głosowy używa wybranego języka ({flag}). Zmień flagę w prawym górnym rogu, aby słuchać w tym języku.",ro:"Scrii în altă limbă. Redarea vocală folosește limba selectată ({flag}). Schimbă steagul din dreapta sus pentru a asculta în această limbă.",bn:"আপনি অন্য ভাষায় লিখছেন। ভয়েস প্লেব্যাক আপনার নির্বাচিত ভাষা ({flag}) ব্যবহার করে। এই ভাষায় শুনতে উপরে ডানদিকের পতাকা পরিবর্তন করুন।",id:"Anda mengetik dalam bahasa lain. Pemutaran suara menggunakan bahasa pilihan Anda ({flag}). Ubah bendera di kanan atas untuk mendengarkan dalam bahasa ini.",sw:"Unaandika kwa lugha nyingine. Usomaji wa sauti hutumia lugha uliyochagua ({flag}). Badilisha bendera juu kulia kusikiliza kwa lugha hii.",fil:"Nagta-type ka sa ibang wika. Ginagamit ng voice playback ang napili mong wika ({flag}). Palitan ang watawat sa kanang itaas para makinig sa wikang ito.",mr:"तुम्ही दुसऱ्या भाषेत लिहित आहात. आवाज वाचन तुमची निवडलेली भाषा ({flag}) वापरते. या भाषेत ऐकण्यासाठी वरच्या उजव्या बाजूचा ध्वज बदला.",te:"మీరు మరో భాషలో టైప్ చేస్తున్నారు. వాయిస్ ప్లేబ్యాక్ మీరు ఎంచుకున్న భాష ({flag})ని ఉపయోగిస్తుంది. ఈ భాషలో వినడానికి కుడి ఎగువన ఉన్న జెండాను మార్చండి."},
  label_name:{el:"Όνομα",en:"Name",ar:"الاسم",zh:"姓名",es:"Nombre",fr:"Prénom",de:"Name",pt:"Nome",it:"Nome",ru:"Имя",tr:"Ad",hi:"नाम",ur:"نام",ja:"名前",nl:"Naam",pl:"Imię",ro:"Nume",bn:"নাম",id:"Nama",sw:"Jina",fil:"Pangalan",mr:"नाव",te:"పేరు"},
  label_phone:{el:"Τηλέφωνο",en:"Phone",ar:"الهاتف",zh:"电话",es:"Teléfono",fr:"Téléphone",de:"Telefon",pt:"Telefone",it:"Telefono",ru:"Телефон",tr:"Telefon",hi:"फ़ोन",ur:"فون",ja:"電話",nl:"Telefoon",pl:"Telefon",ro:"Telefon",bn:"ফোন",id:"Telepon",sw:"Simu",fil:"Telepono",mr:"फोन",te:"ఫోన్"},
  label_address:{el:"Διεύθυνση",en:"Address",ar:"العنوان",zh:"地址",es:"Dirección",fr:"Adresse",de:"Adresse",pt:"Morada",it:"Indirizzo",ru:"Адрес",tr:"Adres",hi:"पता",ur:"پتہ",ja:"住所",nl:"Adres",pl:"Adres",ro:"Adresă",bn:"ঠিকানা",id:"Alamat",sw:"Anwani",fil:"Address",mr:"पत्ता",te:"చిరునామా"},
  street_ph:{el:"Οδός και αριθμός",en:"Street & number",ar:"الشارع والرقم",zh:"街道和门牌",es:"Calle y número",fr:"Rue et numéro",de:"Straße und Hausnummer",pt:"Rua e número",it:"Via e numero",ru:"Улица и номер",tr:"Sokak ve numara",hi:"सड़क और नंबर",ur:"گلی اور نمبر",ja:"番地と番地番号",nl:"Straat en nummer",pl:"Ulica i numer",ro:"Stradă și număr",bn:"রাস্তা ও নম্বর",id:"Jalan & nomor",sw:"Barabara na namba",fil:"Kalye at numero",mr:"रस्ता आणि क्रमांक",te:"వీధి & నంబర్"},
  city_ph:{el:"Πόλη",en:"City",ar:"المدينة",zh:"城市",es:"Ciudad",fr:"Ville",de:"Stadt",pt:"Cidade",it:"Città",ru:"Город",tr:"Şehir",hi:"शहर",ur:"شہر",ja:"市区町村",nl:"Stad",pl:"Miasto",ro:"Oraș",bn:"শহর",id:"Kota",sw:"Jiji",fil:"Lungsod",mr:"शहर",te:"నగరం"},
  post_ph:{el:"ΤΚ",en:"Postcode",ar:"الرمز البريدي",zh:"邮编",es:"C.P.",fr:"Code postal",de:"PLZ",pt:"Cód. postal",it:"CAP",ru:"Индекс",tr:"Posta kodu",hi:"पिन कोड",ur:"پوسٹل کوڈ",ja:"郵便番号",nl:"Postcode",pl:"Kod",ro:"Cod poștal",bn:"পোস্টাল",id:"Kode pos",sw:"Msimbo",fil:"Zip code",mr:"पिनकोड",te:"పిన్‌కోడ్"},
  saving:{el:"Αποθήκευση...",en:"Saving...",ar:"جاري الحفظ...",zh:"保存中...",es:"Guardando...",fr:"Enregistrement...",de:"Speichern...",pt:"A guardar...",it:"Salvataggio...",ru:"Сохранение...",tr:"Kaydediliyor...",hi:"सहेजा जा रहा है...",ur:"محفوظ ہو رہا ہے...",ja:"保存中...",nl:"Opslaan...",pl:"Zapisywanie...",ro:"Se salvează...",bn:"সংরক্ষণ হচ্ছে...",id:"Menyimpan...",sw:"Inahifadhi...",fil:"Sineseve...",mr:"जतन होत आहे...",te:"సేవ్ అవుతోంది..."},
  save_ok:{el:"Αποθήκευση ✓",en:"Save ✓",ar:"حفظ ✓",zh:"保存 ✓",es:"Guardar ✓",fr:"Enregistrer ✓",de:"Speichern ✓",pt:"Guardar ✓",it:"Salva ✓",ru:"Сохранить ✓",tr:"Kaydet ✓",hi:"सहेजें ✓",ur:"محفوظ ✓",ja:"保存 ✓",nl:"Opslaan ✓",pl:"Zapisz ✓",ro:"Salvează ✓",bn:"সংরক্ষণ ✓",id:"Simpan ✓",sw:"Hifadhi ✓",fil:"I-save ✓",mr:"जतन ✓",te:"సేవ్ ✓"},
  delivery_addr:{el:"Διεύθυνση Παράδοσης",en:"Delivery Address",ar:"عنوان التوصيل",zh:"配送地址",es:"Dirección de entrega",fr:"Adresse de livraison",de:"Lieferadresse",pt:"Morada de entrega",it:"Indirizzo di consegna",ru:"Адрес доставки",tr:"Teslimat adresi",hi:"डिलीवरी पता",ur:"ڈیلیوری پتہ",ja:"お届け先住所",nl:"Bezorgadres",pl:"Adres dostawy",ro:"Adresă de livrare",bn:"ডেলিভারি ঠিকানা",id:"Alamat pengiriman",sw:"Anwani ya uwasilishaji",fil:"Delivery address",mr:"डिलिव्हरी पत्ता",te:"డెలివరీ చిరునామా"},
  delivery_hint:{el:"Για να δούμε προσφορές στην περιοχή σου, χρειαζόμαστε τη διεύθυνσή σου.",en:"To show you local offers and delivery options, we need your address.",ar:"لعرض العروض المحلية نحتاج عنوانك.",zh:"为向你展示本地优惠，我们需要你的地址。",es:"Para mostrarte ofertas locales necesitamos tu dirección.",fr:"Pour afficher les offres locales, nous avons besoin de votre adresse.",de:"Für lokale Angebote brauchen wir deine Adresse.",pt:"Para mostrar ofertas locais precisamos da tua morada.",it:"Per mostrarti le offerte locali ci serve il tuo indirizzo.",ru:"Чтобы показать местные предложения, нужен ваш адрес.",tr:"Yerel teklifleri göstermek için adresine ihtiyacımız var.",hi:"स्थानीय ऑफ़र दिखाने के लिए पता चाहिए।",ur:"مقامی آفرز دکھانے کے لیے پتہ درکار ہے۔",ja:"地域のオファー表示には住所が必要です。",nl:"Voor lokale aanbiedingen hebben we je adres nodig.",pl:"Aby pokazać lokalne oferty, potrzebujemy adresu.",ro:"Pentru oferte locale avem nevoie de adresa ta.",bn:"স্থানীয় অফার দেখাতে ঠিকানা দরকার।",id:"Untuk menampilkan penawaran lokal, kami butuh alamatmu.",sw:"Kuonyesha ofa za eneo, tunahitaji anwani yako.",fil:"Para makita ang local offers, kailangan namin ang address mo.",mr:"स्थानिक ऑफर दाखवण्यासाठी पत्ता हवा.",te:"స్థానిక ఆఫర్లు చూపించడానికి చిరునామా కావాలి."},
  save_continue:{el:"Αποθήκευση και συνέχεια →",en:"Save & continue →",ar:"حفظ ومتابعة →",zh:"保存并继续 →",es:"Guardar y continuar →",fr:"Enregistrer et continuer →",de:"Speichern und weiter →",pt:"Guardar e continuar →",it:"Salva e continua →",ru:"Сохранить и продолжить →",tr:"Kaydet ve devam →",hi:"सहेजें और जारी रखें →",ur:"محفوظ کریں اور جاری رکھیں →",ja:"保存して続ける →",nl:"Opslaan en doorgaan →",pl:"Zapisz i kontynuuj →",ro:"Salvează și continuă →",bn:"সংরক্ষণ করে চালিয়ে যান →",id:"Simpan & lanjut →",sw:"Hifadhi na endelea →",fil:"I-save at magpatuloy →",mr:"जतन करा आणि पुढे →",te:"సేవ్ చేసి కొనసాగించు →"},
  skip_now:{el:"Παράλειψη προς τώρα",en:"Skip for now",ar:"تخطي الآن",zh:"暂时跳过",es:"Omitir por ahora",fr:"Passer pour l'instant",de:"Vorerst überspringen",pt:"Ignorar por agora",it:"Salta per ora",ru:"Пропустить пока",tr:"Şimdilik atla",hi:"अभी छोड़ें",ur:"ابھی چھوڑیں",ja:"今はスキップ",nl:"Nu overslaan",pl:"Pomiń na razie",ro:"Omite deocamdată",bn:"এখন এড়িয়ে যান",id:"Lewati dulu",sw:"Ruka kwa sasa",fil:"Laktawan muna",mr:"आता वगळा",te:"ఇప్పుడు దాటవేయి"},
  you_label:{el:"Εσύ",en:"You",ar:"أنتِ",zh:"你",es:"Tú",fr:"Toi",de:"Du",pt:"Tu",it:"Tu",ru:"Вы",tr:"Sen",hi:"आप",ur:"آپ",ja:"あなた",nl:"Jij",pl:"Ty",ro:"Tu",bn:"আপনি",id:"Anda",sw:"Wewe",fil:"Ikaw",mr:"तुम्ही",te:"మీరు"},
  select_member_first:{el:"Διάλεξε πρώτα μέλος οικογένειας",en:"Select a family member first",ar:"اختاري فرداً من العائلة أولاً",zh:"请先选择一位家人",es:"Elige primero un miembro de la familia",fr:"Choisissez d'abord un membre de la famille",de:"Wähle zuerst ein Familienmitglied",pt:"Escolhe primeiro um membro da família",it:"Seleziona prima un membro della famiglia",ru:"Сначала выберите члена семьи",tr:"Önce bir aile üyesi seç",hi:"पहले परिवार के सदस्य चुनें",ur:"پہلے خاندان کا رکن منتخب کریں",ja:"先に家族を選んでください",nl:"Kies eerst een gezinslid",pl:"Najpierw wybierz członka rodziny",ro:"Alege mai întâi un membru al familiei",bn:"আগে পরিবারের সদস্য বেছে নিন",id:"Pilih anggota keluarga dulu",sw:"Chagua mwanafamilia kwanza",fil:"Pumili muna ng miyembro ng pamilya",mr:"आधी कुटुंबातील सदस्य निवडा",te:"ముందుగా కుటుంబ సభ్యుడిని ఎంచుకోండి"},
  mem_deleted:{el:"Η ανάμνηση διαγράφηκε",en:"Memory deleted",ar:"تم حذف الذكرى",zh:"回忆已删除",es:"Recuerdo eliminado",fr:"Souvenir supprimé",de:"Erinnerung gelöscht",pt:"Memória eliminada",it:"Ricordo eliminato",ru:"Воспоминание удалено",tr:"Anı silindi",hi:"याद हटा दी गई",ur:"یاد حذف ہو گئی",ja:"思い出を削除しました",nl:"Herinnering verwijderd",pl:"Wspomnienie usunięte",ro:"Amintire ștearsă",bn:"স্মৃতি মুছে ফেলা হয়েছে",id:"Kenangan dihapus",sw:"Kumbukumbu imefutwa",fil:"Na-delete ang memory",mr:"आठवण हटवली",te:"జ్ఞాపకం తొలగించబడింది"},
  change_photo:{el:"Αλλαγή φωτο",en:"Change photo",ar:"تغيير الصورة",zh:"更换照片",es:"Cambiar foto",fr:"Changer la photo",de:"Foto ändern",pt:"Mudar foto",it:"Cambia foto",ru:"Сменить фото",tr:"Fotoğrafı değiştir",hi:"फ़ोटो बदलें",ur:"تصویر بدلیں",ja:"写真を変更",nl:"Foto wijzigen",pl:"Zmień zdjęcie",ro:"Schimbă foto",bn:"ছবি বদলান",id:"Ganti foto",sw:"Badilisha picha",fil:"Palitan ang larawan",mr:"फोटो बदला",te:"ఫోటో మార్చు"},
  add_photo:{el:"Προσθήκη φωτο",en:"Add photo",ar:"إضافة صورة",zh:"添加照片",es:"Añadir foto",fr:"Ajouter une photo",de:"Foto hinzufügen",pt:"Adicionar foto",it:"Aggiungi foto",ru:"Добавить фото",tr:"Fotoğraf ekle",hi:"फ़ोटो जोड़ें",ur:"تصویر شامل کریں",ja:"写真を追加",nl:"Foto toevoegen",pl:"Dodaj zdjęcie",ro:"Adaugă foto",bn:"ছবি যোগ করুন",id:"Tambah foto",sw:"Ongeza picha",fil:"Magdagdag ng larawan",mr:"फोटो जोडा",te:"ఫోటో జోడించు"},
  remove_photo:{el:"Αφαίρεση",en:"Remove",ar:"إزالة",zh:"移除",es:"Quitar",fr:"Retirer",de:"Entfernen",pt:"Remover",it:"Rimuovi",ru:"Убрать",tr:"Kaldır",hi:"हटाएँ",ur:"ہٹائیں",ja:"削除",nl:"Verwijderen",pl:"Usuń",ro:"Elimină",bn:"সরান",id:"Hapus",sw:"Ondoa",fil:"Alisin",mr:"काढा",te:"తొలగించు"},
  move_memory:{el:"Μετακίνηση σε",en:"Move to",ar:"نقل إلى",zh:"移动到",es:"Mover a",fr:"Déplacer vers",de:"Verschieben nach",pt:"Mover para",it:"Sposta a",ru:"Переместить к",tr:"Taşı",hi:"यहाँ ले जाएँ",ur:"منتقل کریں",ja:"移動先",nl:"Verplaats naar",pl:"Przenieś do",ro:"Mută la",bn:"সরান",id:"Pindah ke",sw:"Hamisha kwa",fil:"Ilipat sa",mr:"येथे हलवा",te:"తరలించు"},
  edit_memory:{el:"Επεξεργασία",en:"Edit",ar:"تعديل",zh:"编辑",es:"Editar",fr:"Modifier",de:"Bearbeiten",pt:"Editar",it:"Modifica",ru:"Изменить",tr:"Düzenle",hi:"संपादित करें",ur:"ترمیم",ja:"編集",nl:"Bewerken",pl:"Edytuj",ro:"Editează",bn:"সম্পাদনা",id:"Edit",sw:"Hariri",fil:"I-edit",mr:"संपादित करा",te:"సవరించు"},
  delete_memory:{el:"Διαγραφή",en:"Delete",ar:"حذف",zh:"删除",es:"Eliminar",fr:"Supprimer",de:"Löschen",pt:"Eliminar",it:"Elimina",ru:"Удалить",tr:"Sil",hi:"हटाएँ",ur:"حذف",ja:"削除",nl:"Verwijderen",pl:"Usuń",ro:"Șterge",bn:"মুছুন",id:"Hapus",sw:"Futa",fil:"I-delete",mr:"हटवा",te:"తొలగించు"},
  mem_moved:{el:"Η ανάμνηση μετακινήθηκε",en:"Memory moved",ar:"تم نقل الذكرى",zh:"回忆已移动",es:"Recuerdo movido",fr:"Souvenir déplacé",de:"Erinnerung verschoben",pt:"Memória movida",it:"Ricordo spostato",ru:"Воспоминание перемещено",tr:"Anı taşındı",hi:"याद स्थानांतरित",ur:"یاد منتقل ہو گئی",ja:"思い出を移動しました",nl:"Herinnering verplaatst",pl:"Wspomnienie przeniesione",ro:"Amintire mutată",bn:"স্মৃতি সরানো হয়েছে",id:"Kenangan dipindahkan",sw:"Kumbukumbu imehamishwa",fil:"Nailipat ang memory",mr:"आठवण हलवली",te:"జ్ఞాపకం తరలించబడింది"},
  archive_hint:{el:"Δώσε τίτλο στη συνομιλία ή άφησε κενό για αυτόματο τίτλο από την πρώτη ερώτηση.",en:"Name the conversation or leave blank for an automatic title from the first message.",ar:"سمّي المحادثة أو اتركيها فارغة لعنوان تلقائي.",zh:"为对话命名，或留空以用第一条消息自动命名。",es:"Pon un título o déjalo en blanco para un título automático.",fr:"Donnez un titre ou laissez vide pour un titre automatique.",de:"Gib einen Titel oder lass leer für automatischen Titel.",pt:"Dá um título ou deixa em branco para título automático.",it:"Dai un titolo o lascia vuoto per un titolo automatico.",ru:"Назовите разговор или оставьте пустым для автозаголовка.",tr:"Başlık ver veya otomatik başlık için boş bırak.",hi:"शीर्षक दें या स्वतः शीर्षक के लिए खाली छोड़ें।",ur:"عنوان دیں یا خودکار عنوان کے لیے خالی چھوڑیں۔",ja:"タイトルを入力するか、空欄で自動タイトルにします。",nl:"Geef een titel of laat leeg voor automatische titel.",pl:"Podaj tytuł lub zostaw puste dla automatycznego.",ro:"Dă un titlu sau lasă gol pentru titlu automat.",bn:"শিরোনাম দিন বা স্বয়ংক্রিয় শিরোনামের জন্য খালি রাখুন।",id:"Beri judul atau biarkan kosong untuk judul otomatis.",sw:"Toa kichwa au acha tupu kwa kichwa kiotomatiki.",fil:"Maglagay ng pamagat o iwanang blangko para sa automatic title.",mr:"शीर्षक द्या किंवा स्वयंचलितसाठी रिकामे ठेवा.",te:"శీర్షిక ఇవ్వండి లేదా ఆటోమేటిక్ కోసం ఖాళీగా ఉంచండి."},
  no_archived:{el:"Δεν υπάρχουν αρχειοθετημένες συνομιλίες.",en:"No archived conversations.",ar:"لا توجد محادثات مؤرشفة.",zh:"没有已归档的对话。",es:"No hay conversaciones archivadas.",fr:"Aucune conversation archivée.",de:"Keine archivierten Gespräche.",pt:"Sem conversas arquivadas.",it:"Nessuna conversazione archiviata.",ru:"Нет архивных разговоров.",tr:"Arşivlenmiş konuşma yok.",hi:"कोई संग्रहीत बातचीत नहीं।",ur:"کوئی محفوظ بات چیت نہیں۔",ja:"アーカイブされた会話はありません。",nl:"Geen gearchiveerde gesprekken.",pl:"Brak zarchiwizowanych rozmów.",ro:"Nicio conversație arhivată.",bn:"কোনো আর্কাইভড কথোপকথন নেই।",id:"Tidak ada percakapan terarsip.",sw:"Hakuna mazungumzo yaliyohifadhiwa.",fil:"Walang naka-archive na usapan.",mr:"संग्रहित संवाद नाहीत.",te:"ఆర్కైవ్ చేసిన సంభాషణలు లేవు."},
  mem_saved:{el:"Οι αναμνήσεις αποθηκεύτηκαν",en:"Memories saved",ar:"تم حفظ الذكريات",zh:"回忆已保存",es:"Recuerdos guardados",fr:"Souvenirs enregistrés",de:"Erinnerungen gespeichert",pt:"Memórias guardadas",it:"Ricordi salvati",ru:"Воспоминания сохранены",tr:"Anılar kaydedildi",hi:"यादें सहेजी गईं",ur:"یادیں محفوظ ہو گئیں",ja:"思い出を保存しました",nl:"Herinneringen opgeslagen",pl:"Wspomnienia zapisane",ro:"Amintiri salvate",bn:"স্মৃতি সংরক্ষিত",id:"Kenangan disimpan",sw:"Kumbukumbu zimehifadhiwa",fil:"Na-save ang mga memory",mr:"आठवणी जतन झाल्या",te:"జ్ఞాపకాలు సేవ్ అయ్యాయి"},
  mem_save_fail:{el:"Αποτυχία αποθήκευσης στο cloud",en:"Cloud save failed",ar:"فشل الحفظ السحابي",zh:"云端保存失败",es:"Error al guardar en la nube",fr:"Échec de l'enregistrement cloud",de:"Cloud-Speichern fehlgeschlagen",pt:"Falha ao guardar na cloud",it:"Salvataggio cloud non riuscito",ru:"Не удалось сохранить в облако",tr:"Bulut kaydı başarısız",hi:"क्लाउड सेव विफल",ur:"کلاؤڈ محفوظ ناکام",ja:"クラウド保存に失敗",nl:"Cloud opslaan mislukt",pl:"Zapis w chmurze nieudany",ro:"Salvare cloud eșuată",bn:"ক্লাউড সংরক্ষণ ব্যর্থ",id:"Gagal simpan cloud",sw:"Hifadhi ya wingu imeshindwa",fil:"Nabigo ang cloud save",mr:"क्लाउड जतन अयशस्वी",te:"క్లౌడ్ సేవ్ విఫలమైంది"},
  undo:{el:"Αναίρεση",en:"Undo",ar:"تراجع",zh:"撤销",es:"Deshacer",fr:"Annuler",de:"Rückgängig",pt:"Anular",it:"Annulla",ru:"Отменить",tr:"Geri al",hi:"पूर्ववत",ur:"واپس",ja:"元に戻す",nl:"Ongedaan",pl:"Cofnij",ro:"Anulează",bn:"পূর্বাবস্থা",id:"Urungkan",sw:"Tendua",fil:"I-undo",mr:"पूर्ववत",te:"అన్డు"},
  undone:{el:"Αναιρέθηκε",en:"Undone",ar:"تم التراجع",zh:"已撤销",es:"Deshecho",fr:"Annulé",de:"Rückgängig gemacht",pt:"Anulado",it:"Annullato",ru:"Отменено",tr:"Geri alındı",hi:"पूर्ववत किया",ur:"واپس کر دیا",ja:"元に戻しました",nl:"Ongedaan gemaakt",pl:"Cofnięto",ro:"Anulat",bn:"পূর্বাবস্থায়",id:"Dibatalkan",sw:"Imetenduliwa",fil:"Na-undo",mr:"पूर्ववत केले",te:"అన్డు అయింది"},
  points:{el:"πόντοι",en:"points",ar:"نقاط",zh:"积分",es:"puntos",fr:"points",de:"Punkte",pt:"pontos",it:"punti",ru:"очки",tr:"puan",hi:"अंक",ur:"پوائنٹس",ja:"ポイント",nl:"punten",pl:"punkty",ro:"puncte",bn:"পয়েন্ট",id:"poin",sw:"pointi",fil:"points",mr:"गुण",te:"పాయింట్లు"},
  profile_saved:{el:"Τα στοιχεία αποθηκεύτηκαν",en:"Profile saved",ar:"تم حفظ الملف",zh:"资料已保存",es:"Perfil guardado",fr:"Profil enregistré",de:"Profil gespeichert",pt:"Perfil guardado",it:"Profilo salvato",ru:"Профиль сохранён",tr:"Profil kaydedildi",hi:"प्रोफ़ाइल सहेजी गई",ur:"پروفائل محفوظ",ja:"プロフィールを保存しました",nl:"Profiel opgeslagen",pl:"Profil zapisany",ro:"Profil salvat",bn:"প্রোফাইল সংরক্ষিত",id:"Profil disimpan",sw:"Wasifu umehifadhiwa",fil:"Na-save ang profile",mr:"प्रोफाइल जतन",te:"ప్రొఫైల్ సేవ్ అయింది"},
  save_failed:{el:"Αποτυχία αποθήκευσης",en:"Could not save",ar:"تعذر الحفظ",zh:"无法保存",es:"No se pudo guardar",fr:"Échec de l'enregistrement",de:"Speichern fehlgeschlagen",pt:"Não foi possível guardar",it:"Salvataggio non riuscito",ru:"Не удалось сохранить",tr:"Kaydedilemedi",hi:"सहेजा नहीं जा सका",ur:"محفوظ نہیں ہو سکا",ja:"保存できませんでした",nl:"Opslaan mislukt",pl:"Nie udało się zapisać",ro:"Nu s-a putut salva",bn:"সংরক্ষণ করা যায়নি",id:"Tidak bisa menyimpan",sw:"Imeshindwa kuhifadhi",fil:"Hindi ma-save",mr:"जतन करता आले नाही",te:"సేవ్ చేయలేకపోయాం"},
  address_saved:{el:"Η διεύθυνση αποθηκεύτηκε",en:"Address saved",ar:"تم حفظ العنوان",zh:"地址已保存",es:"Dirección guardada",fr:"Adresse enregistrée",de:"Adresse gespeichert",pt:"Morada guardada",it:"Indirizzo salvato",ru:"Адрес сохранён",tr:"Adres kaydedildi",hi:"पता सहेजा गया",ur:"پتہ محفوظ",ja:"住所を保存しました",nl:"Adres opgeslagen",pl:"Adres zapisany",ro:"Adresă salvată",bn:"ঠিকানা সংরক্ষিত",id:"Alamat disimpan",sw:"Anwani imehifadhiwa",fil:"Na-save ang address",mr:"पत्ता जतन",te:"చిరునామా సేవ్ అయింది"},
  family_saved:{el:"Η οικογένεια αποθηκεύτηκε",en:"Family saved",ar:"تم حفظ العائلة",zh:"家庭已保存",es:"Familia guardada",fr:"Famille enregistrée",de:"Familie gespeichert",pt:"Família guardada",it:"Famiglia salvata",ru:"Семья сохранена",tr:"Aile kaydedildi",hi:"परिवार सहेजा गया",ur:"خاندان محفوظ",ja:"家族を保存しました",nl:"Gezin opgeslagen",pl:"Rodzina zapisana",ro:"Familie salvată",bn:"পরিবার সংরক্ষিত",id:"Keluarga disimpan",sw:"Familia imehifadhiwa",fil:"Na-save ang pamilya",mr:"कुटुंब जतन",te:"కుటుంబం సేవ్ అయింది"},
  deleted_named:{el:"Διαγράφηκε: {name}",en:"Deleted: {name}",ar:"تم الحذف: {name}",zh:"已删除：{name}",es:"Eliminado: {name}",fr:"Supprimé : {name}",de:"Gelöscht: {name}",pt:"Eliminado: {name}",it:"Eliminato: {name}",ru:"Удалено: {name}",tr:"Silindi: {name}",hi:"हटाया गया: {name}",ur:"حذف: {name}",ja:"削除しました: {name}",nl:"Verwijderd: {name}",pl:"Usunięto: {name}",ro:"Șters: {name}",bn:"মুছে ফেলা: {name}",id:"Dihapus: {name}",sw:"Imefutwa: {name}",fil:"Na-delete: {name}",mr:"हटवले: {name}",te:"తొలగించబడింది: {name}"},
  tree_updated:{el:"Η θέση στο δέντρο ενημερώθηκε",en:"Tree position updated",ar:"تم تحديث موضع الشجرة",zh:"家谱位置已更新",es:"Posición del árbol actualizada",fr:"Position dans l'arbre mise à jour",de:"Baumposition aktualisiert",pt:"Posição na árvore atualizada",it:"Posizione nell'albero aggiornata",ru:"Позиция на дереве обновлена",tr:"Ağaç konumu güncellendi",hi:"वृक्ष स्थिति अपडेट",ur:"درخت کی پوزیشن اپڈیٹ",ja:"家系図の位置を更新しました",nl:"Boompositie bijgewerkt",pl:"Pozycja na drzewie zaktualizowana",ro:"Poziția în arbore actualizată",bn:"গাছের অবস্থান আপডেট",id:"Posisi pohon diperbarui",sw:"Nafasi ya mti imesasishwa",fil:"Na-update ang tree position",mr:"वृक्षातील स्थान अपडेट",te:"ట్రీ స్థానం అప్‌డేట్ అయింది"},
  choose_plan:{el:"Επίλεξε πακέτο",en:"Choose a plan",ar:"اختاري باقة",zh:"选择套餐",es:"Elige un plan",fr:"Choisissez une offre",de:"Wähle ein Abo",pt:"Escolhe um plano",it:"Scegli un piano",ru:"Выберите тариф",tr:"Plan seç",hi:"प्लान चुनें",ur:"پلان منتخب کریں",ja:"プランを選ぶ",nl:"Kies een abonnement",pl:"Wybierz plan",ro:"Alege un plan",bn:"প্ল্যান বেছে নিন",id:"Pilih paket",sw:"Chagua mpango",fil:"Pumili ng plan",mr:"प्लॅन निवडा",te:"ప్లాన్ ఎంచుకోండి"},
  role_child:{el:"Παιδί",en:"Child",ar:"طفل",zh:"孩子",es:"Hijo/a",fr:"Enfant",de:"Kind",pt:"Filho/a",it:"Bambino/a",ru:"Ребёнок",tr:"Çocuk",hi:"बच्चा",ur:"بچہ",ja:"子ども",nl:"Kind",pl:"Dziecko",ro:"Copil",bn:"শিশু",id:"Anak",sw:"Mtoto",fil:"Anak",mr:"मूल",te:"పిల్లవాడు"},
  partner_of:{el:"Σύντροφος ({name})",en:"Partner ({name})",ar:"الشريك ({name})",zh:"伴侣（{name}）",es:"Pareja ({name})",fr:"Partenaire ({name})",de:"Partner ({name})",pt:"Parceiro/a ({name})",it:"Partner ({name})",ru:"Партнёр ({name})",tr:"Partner ({name})",hi:"साथी ({name})",ur:"ساتھی ({name})",ja:"パートナー（{name}）",nl:"Partner ({name})",pl:"Partner ({name})",ro:"Partener ({name})",bn:"সঙ্গী ({name})",id:"Pasangan ({name})",sw:"Mwenza ({name})",fil:"Partner ({name})",mr:"जोडीदार ({name})",te:"భాగస్వామి ({name})"},
  partner_spouse:{el:"Σύντροφος / Σύζυγος",en:"Partner / Spouse",ar:"شريك / زوج",zh:"伴侣 / 配偶",es:"Pareja / Cónyuge",fr:"Partenaire / Conjoint",de:"Partner / Ehepartner",pt:"Parceiro/a / Cônjuge",it:"Partner / Coniuge",ru:"Партнёр / Супруг(а)",tr:"Partner / Eş",hi:"साथी / जीवनसाथी",ur:"ساتھی / شریک حیات",ja:"パートナー / 配偶者",nl:"Partner / Echtgenoot",pl:"Partner / Małżonek",ro:"Partener / Soț",bn:"সঙ্গী / স্বামী-স্ত্রী",id:"Pasangan / Suami-istri",sw:"Mwenza / Mwenzi",fil:"Partner / Asawa",mr:"जोडीदार / पती-पत्नी",te:"భాగస్వామి / జీవిత భాగస్వామి"},
  child_of:{el:"Παιδί: {name}",en:"Child: {name}",ar:"طفل: {name}",zh:"孩子：{name}",es:"Hijo/a: {name}",fr:"Enfant : {name}",de:"Kind: {name}",pt:"Filho/a: {name}",it:"Bambino/a: {name}",ru:"Ребёнок: {name}",tr:"Çocuk: {name}",hi:"बच्चा: {name}",ur:"بچہ: {name}",ja:"子ども: {name}",nl:"Kind: {name}",pl:"Dziecko: {name}",ro:"Copil: {name}",bn:"শিশু: {name}",id:"Anak: {name}",sw:"Mtoto: {name}",fil:"Anak: {name}",mr:"मूल: {name}",te:"పిల్లవాడు: {name}"},
  you_named:{el:"Εσύ ({name})",en:"You ({name})",ar:"أنتِ ({name})",zh:"你（{name}）",es:"Tú ({name})",fr:"Toi ({name})",de:"Du ({name})",pt:"Tu ({name})",it:"Tu ({name})",ru:"Вы ({name})",tr:"Sen ({name})",hi:"आप ({name})",ur:"آپ ({name})",ja:"あなた（{name}）",nl:"Jij ({name})",pl:"Ty ({name})",ro:"Tu ({name})",bn:"আপনি ({name})",id:"Anda ({name})",sw:"Wewe ({name})",fil:"Ikaw ({name})",mr:"तुम्ही ({name})",te:"మీరు ({name})"},
  syncing_local:{el:"Αποθηκεύτηκε τοπικά — συγχρονίζεται στο cloud…",en:"Saved locally — syncing to cloud…",ar:"حُفظ محلياً — جارٍ المزامنة…",zh:"已本地保存 — 正在同步到云端…",es:"Guardado localmente — sincronizando…",fr:"Enregistré localement — synchronisation…",de:"Lokal gespeichert — Cloud-Sync…",pt:"Guardado localmente — a sincronizar…",it:"Salvato in locale — sincronizzazione…",ru:"Сохранено локально — синхронизация…",tr:"Yerelde kaydedildi — buluta senkronize…",hi:"स्थानीय रूप से सहेजा — क्लाउड सिंक…",ur:"مقامی طور پر محفوظ — کلاؤڈ سنک…",ja:"ローカル保存 — クラウド同期中…",nl:"Lokaal opgeslagen — cloud sync…",pl:"Zapisano lokalnie — synchronizacja…",ro:"Salvat local — sincronizare…",bn:"স্থানীয়ভাবে সংরক্ষিত — ক্লাউড সিঙ্ক…",id:"Disimpan lokal — sinkron cloud…",sw:"Imehifadhiwa lokal — sync wingu…",fil:"Na-save locally — sine-sync sa cloud…",mr:"स्थानिक जतन — क्लाउड सिंक…",te:"లోకల్‌గా సేవ్ — క్లౌడ్ సింక్…"},
};

function detectLang(text: string): string {
  if(/[\u0600-\u06FF]/.test(text)) return "ar";
  if(/[\u3040-\u30FF]/.test(text)) return "ja";
  if(/[\u4E00-\u9FFF]/.test(text)) return "zh";
  if(/[\u0400-\u04FF]/.test(text)) return "ru";
  if(/[\u0370-\u03FF\u1F00-\u1FFF]/.test(text)) return "el";
  return "";
}
function t(key: string, lang: string): string {
  return pickTranslated(TR[key], lang, key);
}
function getLang(code: string) {
  const normalized = normalizeAppLang(code, "en");
  return LANGS.find((l) => l.c === normalized) || LANGS.find((l) => l.c === "en") || LANGS[0];
}
function sk(token: string, suffix: string) {
  return stableSk(token, suffix);
}
// ── Password reset ─────────────────────────────────────────────

function ResetScreen({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);
  const cardStyle: React.CSSProperties = {background:"#fff",borderRadius:24,padding:"36px 32px",maxWidth:400,width:"100%",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,.15)"};
  const inp: React.CSSProperties = {width:"100%",padding:"13px 16px",borderRadius:12,border:"1.5px solid rgba(43,58,103,0.18)",fontFamily:"'DM Sans',sans-serif",fontSize:15,color:"#2B3A67",background:"#fff",outline:"none",boxSizing:"border-box" as any,marginBottom:10,textAlign:"left" as any};
  const handleReset = async () => {
    if (password.length < 6) { setError("Minimum 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true); setError("");
    try {
      await axios.post(`${API}/auth/reset-password`, { token, password });
      setDone(true);
      setTimeout(onDone, 2500);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Reset failed. Link may have expired.");
    } finally { setLoading(false); }
  };
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#2B3A67 0%,#4ABEAA 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'DM Sans',sans-serif"}}>
      <div style={cardStyle}>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:28,fontWeight:700,color:"#2B3A67",marginBottom:20}}>Hey<span style={{color:"#4ABEAA"}}>Maa</span></div>
        {done ? (
          <div><div style={{fontSize:48,marginBottom:12}}>✅</div><div style={{fontSize:16,color:"#2B3A67",fontWeight:600}}>Password updated!</div><div style={{fontSize:13,color:"rgba(43,58,103,.5)",marginTop:6}}>Redirecting to login...</div></div>
        ) : (<>
          <div style={{fontSize:17,fontWeight:600,color:"#2B3A67",marginBottom:6}}>Set new password</div>
          <div style={{fontSize:13,color:"rgba(43,58,103,.5)",marginBottom:20}}>Enter your new password below.</div>
          <input style={inp} type="password" placeholder="New password (min 6 chars)" value={password} onChange={e=>setPassword(e.target.value)} disabled={loading} autoFocus/>
          <input style={inp} type="password" placeholder="Confirm password" value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleReset()} disabled={loading}/>
          {error&&<div style={{color:"#E07B54",fontSize:13,marginBottom:8,textAlign:"left"}}>{error}</div>}
          <button type="button" className="hm-btn hm-btn--primary hm-btn--block hm-btn--lg" style={{marginTop:6}} onClick={handleReset} disabled={loading||!password||!confirm}>{loading?"Updating...":"Update password →"}</button>
        </>)}
      </div>
    </div>
  );
}

function ChangePasswordScreen({
  token,
  lang,
  onDone,
  onLogout,
}: {
  token: string
  lang: string
  onDone: (newToken: string) => void
  onLogout: () => void
}) {
  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false)
  const cardStyle: React.CSSProperties = {background:"#fff",borderRadius:24,padding:"36px 32px",maxWidth:400,width:"100%",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,.15)"}
  const inp: React.CSSProperties = {width:"100%",padding:"13px 16px",borderRadius:12,border:"1.5px solid rgba(43,58,103,0.18)",fontFamily:"'DM Sans',sans-serif",fontSize:15,color:"#2B3A67",background:"#fff",outline:"none",boxSizing:"border-box" as any,marginBottom:10,textAlign:"left" as any}
  const handleChange = async () => {
    if (password.length < 6) { setError(lang==="el"?"Τουλάχιστον 6 χαρακτήρες.":"Min 6 characters."); return; }
    if (password !== confirm) { setError(lang==="el"?"Οι κωδικοί δεν ταιριάζουν.":"Passwords do not match."); return; }
    setLoading(true); setError("")
    try {
      const res = await axios.post(`${API}/auth/change-password`, { password }, { headers: { "x-token": token } })
      const newToken = res.data.token || token
      onDone(newToken)
    } catch (e: any) {
      setError(apiDetail(e.response?.data, lang==="el"?"Αποτυχία.":"Failed."))
    } finally { setLoading(false) }
  }
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#2B3A67 0%,#4ABEAA 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'DM Sans',sans-serif"}}>
      <div style={cardStyle}>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:28,fontWeight:700,color:"#2B3A67",marginBottom:12}}>Hey<span style={{color:"#4ABEAA"}}>Maa</span></div>
        <div style={{fontSize:17,fontWeight:600,color:"#2B3A67",marginBottom:6}}>{lang==="el"?"Νέος κωδικός":"Choose a new password"}</div>
        <div style={{fontSize:13,color:"rgba(43,58,103,.5)",marginBottom:20}}>{lang==="el"?"Για λόγους ασφαλείας, όρισε δικό σου κωδικό πριν συνεχίσεις.":"For security, set your own password before continuing."}</div>
        <input style={inp} type="password" placeholder={lang==="el"?"Νέος κωδικός":"New password"} value={password} onChange={e=>setPassword(e.target.value)} disabled={loading} autoFocus/>
        <input style={inp} type="password" placeholder={lang==="el"?"Επιβεβαίωση":"Confirm password"} value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleChange()} disabled={loading}/>
        {error&&<div style={{color:"#E07B54",fontSize:13,marginBottom:8,textAlign:"left"}}>{error}</div>}
        <button type="button" className="hm-btn hm-btn--primary hm-btn--block hm-btn--lg" style={{marginTop:6}} onClick={handleChange} disabled={loading||!password||!confirm}>{loading?(lang==="el"?"Αποθήκευση...":"Saving..."):(lang==="el"?"Συνέχεια →":"Continue →")}</button>
        <button type="button" className="hm-btn hm-btn--ghost hm-btn--block" style={{marginTop:14}} onClick={() => setShowLogoutConfirm(true)}>{lang==="el"?"Αποσύνδεση":"Log out"}</button>
      </div>
      {showLogoutConfirm && (
        <ConfirmDialog
          open={showLogoutConfirm}
          title={lang === "el" ? "Αποσύνδεση" : "Log out"}
          message={
            lang === "el"
              ? "Είσαι σίγουρη/ος ότι θέλεις να αποσυνδεθείς;"
              : "Are you sure you want to log out?"
          }
          confirmLabel={lang === "el" ? "Αποσύνδεση" : "Log out"}
          cancelLabel={lang === "el" ? "Ακύρωση" : "Cancel"}
          variant="danger"
          onConfirm={() => { setShowLogoutConfirm(false); onLogout(); }}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </div>
  )
}

// ── Onboarding ────────────────────────────────────────────────
function Onboarding({ token, onDone }: { token: string; onDone: (p: Profile) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(() => {
    try { return (sessionStorage.getItem("hm_signup_name") || "").trim(); } catch { return ""; }
  });
  const [childName, setChildName] = useState(""); const [childBirthDate, setChildBirthDate] = useState(""); const [lang, setLang] = useState(() => normalizeAppLang(localStorage.getItem("hm_pre_lang") || "en", "en")); const [showLang, setShowLang] = useState(false); const [isPregnant, setIsPregnant] = useState<boolean|null>(null); const [dueDate, setDueDate] = useState(""); const [country, setCountry] = useState(""); const [consentMarketing, setConsentMarketing] = useState(false);
  const L = getLang(lang);
  useEffect(() => {
    if (isLocalDemoToken(token)) return;
    let cancelled = false;
    axios.get(`${API}/auth/me`, { headers: { "x-token": token } })
      .then((res) => {
        if (cancelled) return;
        const apiName = String(res.data?.name || "").trim();
        if (apiName) setName((prev) => prev.trim() || apiName);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]);
  const save = () => {
    const nextLang = writeStoredAppLang(lang);
    const displayName = name.trim() || (() => { try { return (sessionStorage.getItem("hm_signup_name") || "").trim(); } catch { return ""; } })();
    const p: Profile = {name:displayName||"Mama",childName:isPregnant?"":(childName||""),childAge:isPregnant?"":formatChildAge(childBirthDate||undefined,nextLang),childBirthDate:isPregnant?undefined:(childBirthDate||undefined),lang:nextLang,dueDate:isPregnant?dueDate:undefined,country:country||undefined,consentMarketing,consentDate:consentMarketing?new Date().toISOString():undefined};
    try { sessionStorage.removeItem("hm_signup_name"); } catch { /* ignore */ }
    localStorage.setItem(sk(token,"profile"),JSON.stringify(p));
    void syncProfileToSupabase(token,p);
    onDone(p);
  };
  const s: React.CSSProperties = {minHeight:"100dvh",background:"#F5F0EB",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom))",fontFamily:"'DM Sans',sans-serif",boxSizing:"border-box"};
  const inp: React.CSSProperties = {width:"100%",padding:"13px 16px",borderRadius:12,border:"1.5px solid rgba(43,58,103,0.18)",fontFamily:"'DM Sans',sans-serif",fontSize:15,color:"#2B3A67",background:"#fff",outline:"none",boxSizing:"border-box" as any,marginBottom:10};
  return (
    <div style={s}>
      {showLang && (
        <LanguageFlagOverlay
          open={showLang}
          title={`🌐 ${t("selectlang", lang)}`}
          currentLang={lang}
          onClose={() => setShowLang(false)}
          onSelect={(code) => setLang(normalizeAppLang(code))}
        />
      )}
      <div className="hm-narrow-form">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <div style={{display:"flex",gap:6,flex:1}}>{[0,1,2,3].map(i=><div key={i} style={{flex:1,height:4,borderRadius:2,background:i<step?"#4ABEAA":i===step?"#2B3A67":"rgba(43,58,103,0.15)",maxWidth:40}}/>)}</div>
          <button type="button" className="hm-btn hm-btn--secondary hm-btn--pill hm-btn--sm" style={{marginLeft:12,flexShrink:0}} onClick={()=>setShowLang(true)}>{L.f} {L.s}</button>
        </div>
        {step===0&&<><div style={{fontSize:52,marginBottom:16,textAlign:"center"}}>👋</div><h1 style={{fontFamily:"'DM Sans',sans-serif",fontSize:24,color:"#2B3A67",textAlign:"center",marginBottom:8}}>{t("welcome",lang)}</h1><p style={{fontSize:14,color:"rgba(43,58,103,.6)",textAlign:"center",marginBottom:28,lineHeight:1.65}}>{t("setup",lang)}</p><input style={inp} placeholder={t("yourname",lang)} value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&setStep(1)} autoFocus/><button type="button" className="hm-btn hm-btn--primary hm-btn--block hm-btn--lg" style={{marginTop:8}} onClick={()=>setStep(1)}>{t("letsgo",lang)}</button></>}
        {step===1&&<>
          <div style={{fontSize:52,marginBottom:16,textAlign:"center"}}>{isPregnant?"🤰":"👶"}</div>
          <h1 style={{fontFamily:"'DM Sans',sans-serif",fontSize:24,color:"#2B3A67",textAlign:"center",marginBottom:8}}>{t("profile2",lang)}</h1>
          <p style={{fontSize:14,color:"rgba(43,58,103,.6)",textAlign:"center",marginBottom:20,lineHeight:1.65}}>{isPregnant===null?t("pregnant_or_baby_q",lang):isPregnant?t("duedatelabel",lang):t("babyinfo_q",lang)}</p>
          {isPregnant===null&&<div className="hm-btn-row" style={{marginBottom:10}}>
            <button type="button" className="hm-btn hm-btn--bordered hm-btn--block" style={{marginTop:0,flex:1}} onClick={()=>setIsPregnant(true)}>🤰 {t("im_pregnant",lang)}</button>
            <button type="button" className="hm-btn hm-btn--bordered hm-btn--block" style={{marginTop:0,flex:1}} onClick={()=>setIsPregnant(false)}>👶 {t("have_baby",lang)}</button>
          </div>}
          {isPregnant===true&&<>
            <input style={inp} type="date" placeholder={t("duedatelabel",lang)} value={dueDate} onChange={e=>setDueDate(e.target.value)} onKeyDown={e=>e.key==="Enter"&&setStep(2)}/>
            <button type="button" className="hm-btn hm-btn--primary hm-btn--block hm-btn--lg" style={{marginTop:8}} onClick={()=>setStep(2)}>{t("continue",lang)}</button>
            <button type="button" className="hm-btn hm-btn--ghost hm-btn--block" style={{marginTop:10}} onClick={()=>setIsPregnant(null)}>{t("back",lang)}</button>
          </>}
          {isPregnant===false&&<>
            <input style={inp} placeholder={t("childname",lang)} value={childName} onChange={e=>setChildName(e.target.value)}/>
            <input style={inp} type="date" placeholder={t("childbirthdate",lang)} value={childBirthDate} onChange={e=>setChildBirthDate(e.target.value)} onKeyDown={e=>e.key==="Enter"&&setStep(2)}/>
            <button type="button" className="hm-btn hm-btn--primary hm-btn--block hm-btn--lg" style={{marginTop:8}} onClick={()=>setStep(2)}>{t("continue",lang)}</button>
            <button type="button" className="hm-btn hm-btn--ghost hm-btn--block" style={{marginTop:10}} onClick={()=>setIsPregnant(null)}>{t("back",lang)}</button>
          </>}
          {isPregnant===null&&<button type="button" className="hm-btn hm-btn--ghost hm-btn--block" style={{marginTop:10}} onClick={()=>setStep(0)}>{t("back",lang)}</button>}
        </>}
        {step===2&&<><div style={{fontSize:52,marginBottom:16,textAlign:"center"}}>🌍</div><h1 className="hm-onboarding-title">{t("selectlang",lang)}</h1><div className="hm-onboarding-lang-grid">{LANGS.slice(0,8).map(l=><div key={l.c} onClick={()=>setLang(normalizeAppLang(l.c))} className="hm-onboarding-lang-cell" style={{border:`2px solid ${l.c===lang?"#2B3A67":"transparent"}`,background:l.c===lang?"#fff":"#F0EBE6"}}>{l.f}<div className="hm-onboarding-lang-code">{l.s}</div></div>)}</div><button type="button" className="hm-btn hm-btn--secondary hm-btn--block" style={{marginBottom:8}} onClick={()=>setShowLang(true)}>🌐 {t("selectlang",lang)}</button><p style={{fontSize:12,fontWeight:500,color:"rgba(43,58,103,.5)",margin:"12px 0 4px",textAlign:"left"}}>{t("country_label",lang)}</p><select style={{width:"100%",padding:"13px 16px",borderRadius:12,border:"1.5px solid rgba(43,58,103,0.18)",fontFamily:"'DM Sans',sans-serif",fontSize:15,color:country?"#2B3A67":"rgba(43,58,103,.4)",background:"#fff",outline:"none",boxSizing:"border-box" as any,marginBottom:10}} value={country} onChange={e=>setCountry(e.target.value)}><option value="" disabled>{t("country_ph",lang)}</option>{COUNTRIES.map(cc=><option key={cc.code} value={cc.code}>{cc.name}</option>)}</select><button type="button" className="hm-btn hm-btn--primary hm-btn--block hm-btn--lg" style={{marginTop:8}} onClick={()=>setStep(3)}>{t("continue",lang)}</button><button type="button" className="hm-btn hm-btn--ghost hm-btn--block" style={{marginTop:10}} onClick={()=>setStep(1)}>{t("back",lang)}</button></>}
        {step===3&&<><div style={{fontSize:52,marginBottom:16,textAlign:"center"}}>🎉</div><h1 style={{fontFamily:"'DM Sans',sans-serif",fontSize:24,color:"#2B3A67",textAlign:"center",marginBottom:8}}>{t("ready",lang)}, {nameInVocative(name || "Mama", lang)}!</h1><p style={{fontSize:14,color:"rgba(43,58,103,.6)",textAlign:"center",marginBottom:28,lineHeight:1.65}}>{t("readysub",lang)}</p><label style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:16,cursor:"pointer",fontSize:13,color:"rgba(43,58,103,.7)",lineHeight:1.5}}><input type="checkbox" checked={consentMarketing} onChange={e=>setConsentMarketing(e.target.checked)} style={{marginTop:2,accentColor:"#4ABEAA",width:16,height:16,flexShrink:0}}/><span>{t("consent_gdpr",lang)}</span></label><button type="button" className="hm-btn hm-btn--accent hm-btn--block hm-btn--lg" style={{marginTop:8}} onClick={save}>{t("enterbtn",lang)}</button></>}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
function MainApp({ token, profile, onLogout, onExpired, onProfileUpdate, onTokenUpdate, trialEndsAt }: { token: string; profile: Profile; onLogout: () => void; onExpired: () => void; onProfileUpdate: (p: Profile) => void; onTokenUpdate?: (t: string) => void; trialEndsAt?: string | null }) {
  const { t: tHome } = useTranslation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (text: string, kind: ToastKind = "ok", undo?: () => void, undoLabel?: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = ++toastSeq;
    setToasts(prev => [...prev, { id, text: trimmed, kind, undo, undoLabel }]);
    window.setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), undo ? 8000 : 5000);
  };
  const lang = normalizeAppLang(profile.lang, "en"); const L = getLang(lang);
  const sessionExpiredMsg = lang === "el"
    ? "Η σύνδεσή σου έληξε ή δεν είναι έγκυρη. Συνδέσου ξανά."
    : "Your session has expired or is not valid. Please sign in again.";
  const syncProfileSafe = async (p: Profile, opts?: { silent?: boolean }): Promise<boolean> => {
    const result = await syncProfileToSupabase(token, p);
    if (!result.ok && "authExpired" in result && result.authExpired) {
      showToast(sessionExpiredMsg, "err");
      window.setTimeout(() => onLogout(), 1200);
      return false;
    }
    if (!result.ok && !opts?.silent) {
      const errMsg = "error" in result ? result.error : undefined;
      showToast(errMsg || t("save_failed", lang), "err");
    }
    return result.ok;
  };
  const syncProfileInBackground = (p: Profile) => { void syncProfileSafe(p, { silent: true }); };
  const displayName = String(profile.name || "").trim();
  const vocativeName = nameInVocative(displayName, lang);
  const displayInitial = displayName ? displayName.charAt(0).toUpperCase() : "?";
  const showUndoToast = (text: string, undo: () => void) => {
    showToast(text, "ok", undo, t("undo", lang));
  };
  const navy="#2B3A67",coral="#E07B54",teal="#4ABEAA",cream="#F5F0EB",gl="#F0EBE6",chatAssistantBg="#E6DED6",logoPurple="#BEB4CD";
  const [gamification, setGamification] = useState<GamificationStatus | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState("");
  const [showSubscriptionSheet, setShowSubscriptionSheet] = useState(false);
  const [showLevelRewardSheet, setShowLevelRewardSheet] = useState(false);
  const [showAccessExpiryModal, setShowAccessExpiryModal] = useState(false);
  const [pendingLevelReward, setPendingLevelReward] = useState<PendingLevelReward | null>(null);
  const [rewardsSnapshot, setRewardsSnapshot] = useState<RewardsSnapshot | null>(null);
  const [subSnapshot, setSubSnapshot] = useState<SubscriptionSnapshot | null>(null);
  const [planEntitlements, setPlanEntitlements] = useState<PlanEntitlements | null>(null);
  const [voiceQuota, setVoiceQuota] = useState<VoiceQuota | null>(null);
  const [openHelpFaq, setOpenHelpFaq] = useState<Record<number, boolean>>({ 0: true });
  const [helpMessage, setHelpMessage] = useState("");
  const homeLng = homeDisplayLocale(lang);
  const helpFaqItems = useMemo(() => {
    const raw = tHome("faq.items", { returnObjects: true, lng: homeLng });
    const base = Array.isArray(raw) ? (raw as HomeFaqItem[]) : [];
    return mergeGamificationFaqItems(base, homeLng === "el" ? "el" : "en");
  }, [tHome, homeLng]);
  const helpEmail = String(tHome("footer.email", { lng: homeLng }) || "info@heymaa.ai");
  const helpPhone = String(tHome("footer.phone", { lng: homeLng }) || "+30 210 928 7700");
  const helpPhoneTel = String(tHome("footer.phoneTel", { lng: homeLng }) || "+302109287700");
  const helpAddress = String(tHome("footer.address", { lng: homeLng }) || "");

  useEffect(() => {
    document.body.classList.add("hm-app-active");
    return () => document.body.classList.remove("hm-app-active");
  }, []);

  useEffect(() => {
    axios.get(`${API}/auth/me`, { headers: { "x-token": token } })
      .then(res => {
        if (res.data?.gamification) setGamification(res.data.gamification);
        if (typeof res.data?.referral_code === "string" && res.data.referral_code.trim()) {
          setReferralCode(res.data.referral_code.trim());
        }
        if (typeof res.data?.email === "string") setAccountEmail(res.data.email.trim());
        if (res.data?.rewards) {
          setRewardsSnapshot(res.data.rewards);
          const firstPending = firstUnseenPendingReward(token, res.data.rewards);
          if (firstPending) {
            setPendingLevelReward(firstPending);
            setShowLevelRewardSheet(true);
          }
        }
      })
      .catch(() => {});
  }, [token]);

  const applySubscriptionSnapshot = useCallback((data: SubscriptionSnapshot) => {
    setSubSnapshot(data);
    if (data.entitlements) setPlanEntitlements(data.entitlements);
    if (data.voice_quota) setVoiceQuota(data.voice_quota);
    if (data.rewards) setRewardsSnapshot(data.rewards);
  }, []);

  useEffect(() => {
    fetchSubscriptionStatus(token)
      .then((data) => {
        applySubscriptionSnapshot(data);
      })
      .catch(() => {
        if (trialEndsAt) {
          setSubSnapshot({
            subscription_active: true,
            subscription_status: "trial",
            trial_ends_at: trialEndsAt,
            is_trial: true,
          });
        }
      });
  }, [token, trialEndsAt, applySubscriptionSnapshot]);

  const openPendingReward = useCallback((rewards: RewardsSnapshot | null | undefined, force = false) => {
    const first = force
      ? rewards?.pending?.[0]
      : firstUnseenPendingReward(token, rewards);
    if (first) {
      setPendingLevelReward(first);
      setShowLevelRewardSheet(true);
    }
  }, [token]);

  const track = useCallback(async (action: string, path: string, label?: string, details?: Record<string, unknown>) => {
    const result = await logUserActivity(token, { action, path, label, details });
    if (result?.gamification) setGamification(result.gamification);
    if (result?.rewards) setRewardsSnapshot(result.rewards);
    if (result?.level_up && result.rewards?.pending?.length) {
      openPendingReward(result.rewards, true);
    }
    if (result?.points_awarded) {
      const ptsLabel = t("points", lang);
      showToast(`+${result.points_awarded} ${ptsLabel}`, "ok");
    }
  }, [token, lang, openPendingReward]);

  const accessExpiryInfo = useMemo(
    () => getAccessExpiryInfo(lang, trialEndsAt, subSnapshot),
    [lang, trialEndsAt, subSnapshot],
  );

  const activeRewardGrant = useMemo(() => {
    const grants = rewardsSnapshot?.active_grants || subSnapshot?.active_plan_grants || [];
    if (!grants.length) return null;
    let latest = grants[0];
    for (const g of grants) {
      if (new Date(g.ends_at).getTime() > new Date(latest.ends_at).getTime()) latest = g;
    }
    return latest;
  }, [rewardsSnapshot, subSnapshot]);

  const chatContextLimit = useMemo(
    () => chatContextDepth(planEntitlements, subSnapshot),
    [planEntitlements, subSnapshot],
  );
  const memoryContextLimit = useMemo(
    () => memoryContextCount(planEntitlements, subSnapshot),
    [planEntitlements, subSnapshot],
  );

  useEffect(() => {
    if (!accessExpiryInfo?.urgent) return;
    if (readExpiryPopupDismissed(accessExpiryInfo.accessEndsAt)) return;
    setShowAccessExpiryModal(true);
  }, [accessExpiryInfo]);

  const handleLevelRewardClaimed = useCallback((payload: {
    rewards: RewardsSnapshot;
    status?: SubscriptionSnapshot;
  }) => {
    setRewardsSnapshot(payload.rewards);
    if (payload.status) applySubscriptionSnapshot(payload.status);
    showToast(
      lang === "el" ? "Το δώρο ενεργοποιήθηκε! 🎁" : "Your gift is active! 🎁",
      "ok",
    );
    const next = payload.rewards.pending?.[0];
    if (next) {
      setPendingLevelReward(next);
      setShowLevelRewardSheet(true);
    } else {
      setPendingLevelReward(null);
    }
  }, [applySubscriptionSnapshot, lang]);

  // Threads state — bootstrap from full localStorage scan (all past JWT keys)
  const [threads, setThreads] = useState<Thread[]>(() => (bootLocalScan().threads as Thread[]) || []);
  const [messages, setMessages] = useState<Message[]>(() => (bootLocalScan().chat as Message[]) || []);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showNewThreadModal, setShowNewThreadModal] = useState(false);
  const [archiveTitle, setArchiveTitle] = useState("");
  const [showThreads, setShowThreads] = useState(false);

  const [memories, setMemories] = useState<Memory[]>(() => bootLocalScan().memories as Memory[]);
  const [memPendingPhoto, setMemPendingPhoto] = useState<string | null>(null);
  const awaitingMemoryPhotoRef = useRef(false);
  const [familyData, setFamilyData] = useState<FamilyData>(() => {
    const recovered = loadFamilyForToken(token);
    return recovered.children.length || recovered.members.length ? recovered : EMPTY_FAMILY;
  });
  /** Block cloud writes until local recovery + server hydrate finish. */
  const [cloudReady, setCloudReady] = useState(false);
  const [memoriesLocalReady, setMemoriesLocalReady] = useState(false);
  const [memoriesSaving, setMemoriesSaving] = useState(false);
  const [milestoneChecksMap, setMilestoneChecksMap] = useState<MilestoneChecksMap>(() => {
    const raw = (bootLocalScan().milestones_map || {}) as Record<string, unknown>;
    return raw as MilestoneChecksMap;
  });
  const [lastCheckedMap, setLastCheckedMap] = useState<Record<string, { stageId: string; idx: number } | null>>({});
  const [activeMilestoneRef, setActiveMilestoneRef] = useState<string|undefined>(undefined);
  const [docs, setDocs] = useState<DocEntry[]>(() => normalizeDocEntries(bootLocalScan().docs as unknown[]));
  const [shopItems, setShopItems] = useState<string[]>(() => {
    const s = bootLocalScan().shopitems;
    return s?.length ? s : ["Silicone teether","Travel crib","High contrast books","Floor gym"];
  });
  const [superItems, setSuperItems] = useState<string[]>(() => {
    const s = bootLocalScan().superitems;
    return s?.length ? s : ["Aptamil Stage 2 €18.90","Johnson Baby Shampoo €4.50","Pampers No3 €14.99","WaterWipes €9.99"];
  });

  const [tab, setTab] = useState<"profile"|"chat"|"family"|"memories"|"milestones"|"shopping"|"offers">("chat");

  useEffect(() => {
    track("view", appPath(tab));
  }, [tab, track]);

  const [input, setInput] = useState("");
  const [chatPendingAttachments, setChatPendingAttachments] = useState<ChatAttachment[]>([]);
  const [showChatAttachSheet, setShowChatAttachSheet] = useState(false);
  const [isCoarseMobile, setIsCoarseMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 699px), (pointer: coarse)");
    const update = () => setIsCoarseMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (tab !== "chat") setShowChatAttachSheet(false);
  }, [tab]);

  const [shopInput, setShopInput] = useState(""); const [superInput, setSuperInput] = useState("");
  const [loading, setLoading] = useState(false); const [playingIndex, setPlayingIndex] = useState<number|null>(null); const [recording, setRecording] = useState(false);
  const [micLevels, setMicLevels] = useState<number[]>(() => Array.from({ length: 32 }, () => 0.12));
  const [showLang, setShowLang] = useState(false); const [shopTab, setShopTab] = useState<"p"|"s"|"o">("p"); const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifReadIds, setNotifReadIds] = useState(() => readNotificationIds(token));
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [showAccountPrivacy, setShowAccountPrivacy] = useState(false);
  const [showHelpSupport, setShowHelpSupport] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [editName, setEditName] = useState(() => profile.name || "");
  const [editPhoto, setEditPhoto] = useState<string | null>(null);
  const [editNewPassword, setEditNewPassword] = useState("");
  const [editConfirmPassword, setEditConfirmPassword] = useState("");
  const [editCurrentPassword, setEditCurrentPassword] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const profilePhotoRef = useRef<HTMLInputElement>(null);

  const openProfileEditForm = () => {
    setEditName(profile.name || "");
    setEditNewPassword("");
    setEditConfirmPassword("");
    setEditCurrentPassword("");
    setEditPhoto(familyData.selfPhoto || null);
    setShowProfileEdit(true);
  };

  const saveProfileEdit = async () => {
    const nextName = editName.trim() || profile.name;
    const newPw = editNewPassword.trim();
    const confirmPw = editConfirmPassword.trim();
    if (newPw || confirmPw) {
      if (newPw.length < 6) {
        showToast(lang === "el" ? "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες." : "Password must be at least 6 characters.", "err");
        return;
      }
      if (newPw !== confirmPw) {
        showToast(lang === "el" ? "Οι κωδικοί δεν ταιριάζουν." : "Passwords do not match.", "err");
        return;
      }
      if (!editCurrentPassword.trim()) {
        showToast(lang === "el" ? "Βάλε τον τρέχοντα κωδικό σου." : "Enter your current password.", "err");
        return;
      }
    }
    setEditSaving(true);
    const updated: Profile = { ...profile, name: nextName };
    try {
      const synced = await syncProfileSafe({ ...updated, consentMarketing: profile.consentMarketing });
      if (!synced) return;
      localStorage.setItem(sk(token, "profile"), JSON.stringify(updated));
      onProfileUpdate(updated);
      if (editPhoto !== (familyData.selfPhoto || null)) {
        setFamilyData((cur) => {
          const next = { ...cur };
          if (editPhoto) next.selfPhoto = editPhoto;
          else delete next.selfPhoto;
          return next;
        });
      }
      if (newPw) {
        const res = await axios.post(
          `${API}/auth/change-password`,
          { password: newPw, current_password: editCurrentPassword.trim() },
          { headers: { "x-token": token } },
        );
        const nextToken = res.data?.token;
        if (typeof nextToken === "string" && nextToken) {
          setAuthToken(nextToken);
          onTokenUpdate?.(nextToken);
        }
      }
      showToast(t("profile_saved", lang), "ok");
    track("click", appPath("profile", "save"), "Save profile");
      setEditNewPassword("");
      setEditConfirmPassword("");
      setEditCurrentPassword("");
      setShowProfileEdit(false);
    } catch (e: any) {
      const msg = apiDetail(e?.response?.data, (e instanceof Error ? e.message : "") || t("save_failed", lang));
      showToast(msg, "err");
    } finally {
      setEditSaving(false);
    }
  };
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addrStreet, setAddrStreet] = useState(() => profile.address || "");
  const [addrCity, setAddrCity] = useState(() => profile.city || "");
  const [addrPostal, setAddrPostal] = useState(() => profile.postalCode || "");

  const saveAddress = async () => {
    if (!addrStreet.trim() || !addrCity.trim()) return;
    const updated: Profile = {
      ...profile,
      address: addrStreet.trim(),
      city: addrCity.trim(),
      postalCode: addrPostal.trim() || undefined,
    };
    try {
      const synced = await syncProfileSafe({ ...updated, consentMarketing: profile.consentMarketing });
      if (!synced) return;
      localStorage.setItem(sk(token,"profile"), JSON.stringify(updated));
      onProfileUpdate(updated);
      showToast(t("address_saved", lang), "ok");
      setShowAddressModal(false);
      setTab("shopping");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      showToast(msg || t("save_failed", lang), "err");
    }
  };
  const skipAddress = () => {
    setShowAddressModal(false);
    setTab("shopping");
  };
  const [showAddMember, setShowAddMember] = useState(false); const [newMemberName, setNewMemberName] = useState(""); const [newMemberRole, setNewMemberRole] = useState("Partner"); const [newMemberRelatedTo, setNewMemberRelatedTo] = useState(RELATED_TO_SELF); const [newMemberEmail, setNewMemberEmail] = useState(""); const [newMemberPhone, setNewMemberPhone] = useState(""); const [newMemberBirthDate, setNewMemberBirthDate] = useState(""); const [newMemberNote, setNewMemberNote] = useState("");
  const [showAddChild, setShowAddChild] = useState(false); const [newChildName, setNewChildName] = useState(""); const [newChildBirthDate, setNewChildBirthDate] = useState("");
  const [newChildDateMode, setNewChildDateMode] = useState<"birth"|"due">("birth");
  const [newChildGender, setNewChildGender] = useState<"girl"|"boy"|"surprise"|"">("");
  const openAddChildForm = () => {
    setNewChildName("");
    setNewChildBirthDate("");
    setNewChildDateMode("birth");
    setNewChildGender("");
    setShowAddChild(true);
  };
  const [showAddPet, setShowAddPet] = useState(false); const [newPetName, setNewPetName] = useState(""); const [newPetNote, setNewPetNote] = useState("");
  const [showMyFamily, setShowMyFamily] = useState(true);
  const [childDeleteConfirm, setChildDeleteConfirm] = useState<number | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [treeEdit, setTreeEdit] = useState<LaidOutNode | null>(null);
  const [treeEditName, setTreeEditName] = useState("");
  const [treeEditRole, setTreeEditRole] = useState("Family");
  const [treeEditRelatedTo, setTreeEditRelatedTo] = useState(RELATED_TO_SELF);
  const [treeEditBirthDate, setTreeEditBirthDate] = useState("");
  const [treeEditNote, setTreeEditNote] = useState("");
  const [familySaving, setFamilySaving] = useState(false);
  const treePhotoRef = useRef<HTMLInputElement>(null);
  const childBirthDateRef = useRef<HTMLInputElement>(null);
  /** null = no person selected (list hidden); "__general__" = self/general memories */
  const [activeMemRef, setActiveMemRef] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null); const recRef = useRef<any>(null); const recordingIntentRef = useRef(false); const recTranscriptRef = useRef(""); const recSendTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null); const micMeterRef = useRef<{ stream: MediaStream; ctx: AudioContext; raf: number } | null>(null); const fileRef = useRef<HTMLInputElement>(null); const chatFileRef = useRef<HTMLInputElement>(null); const chatCameraRef = useRef<HTMLInputElement>(null); const chatGalleryRef = useRef<HTMLInputElement>(null); const inputRef = useRef<HTMLInputElement>(null); const audioRef = useRef<HTMLAudioElement|null>(null);
  const profileChildren = useMemo(() => getAllChildren(profile), [profile]);
  const familyChildren = useMemo(
    () => getFamilyChildren(familyData, profileChildren),
    [familyData, profileChildren],
  );
  const partnerMember = useMemo(
    () => familyData.members.find((m) => /partner|spouse|husband|wife|σύζυγ|σύντροφ/i.test(m.relationship)),
    [familyData.members],
  );
  const relatedToOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: RELATED_TO_SELF, label: t("you_named", lang).replace("{name}", profile.name || "You") },
    ];
    if (partnerMember) {
      opts.push({
        value: RELATED_TO_PARTNER,
        label: t("partner_of", lang).replace("{name}", partnerMember.name),
      });
    } else {
      opts.push({
        value: RELATED_TO_PARTNER,
        label: t("partner_spouse", lang),
      });
    }
    familyChildren.forEach((c) => {
      opts.push({ value: c.name, label: t("child_of", lang).replace("{name}", c.name) });
    });
    familyData.members.forEach((m) => {
      if (/partner|spouse|husband|wife/i.test(m.relationship)) return;
      opts.push({
        value: memberMemoryRef(m.id),
        label: memberDisplayLabel(m, familyData.members),
      });
    });
    return opts;
  }, [lang, profile.name, partnerMember, familyChildren, familyData.members]);
  const allChildren = familyChildren;
  const primaryChild = allChildren[0];
  const displayAge = primaryChild ? formatChildAge(primaryChild.birthDate, lang) : profile.childAge;
  const primaryChildName = primaryChild?.name || "Baby";
  const pregnancyActive = !!profile.dueDate && !isDueDatePassed(profile.dueDate) && profile.pregnancyStatus !== "completed";
  const memoryCountsByRef = useMemo(() => {
    const counts: Record<string, number> = {};
    memories.forEach((m) => {
      const key = m.ref || "__general__";
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [memories]);
  const pregWeek = pregnancyWeekFromDueDate(profile.dueDate) ?? 1;

  const resolveStageIdForRef = useCallback(
    (ref: string): string => {
      if (ref === "pregnancy") return currentStageIdForPregnancy(pregWeek);
      const child = familyChildren.find((c) => c.name === ref);
      const months =
        (child ? ageMonthsFromBirthDate(child.birthDate) : null) ??
        parseAgeMonths(profile.childAge);
      return currentStageIdForChild(months ?? 0);
    },
    [pregWeek, familyChildren, profile.childAge],
  );

  const resolveMilestoneLabel = useCallback(
    (ref: string, stageId: string, idx: number): string | null => {
      return getMilestoneBullets(stageId, lang)[idx] ?? null;
    },
    [lang],
  );

  useEffect(() => {
    setMilestoneChecksMap((prev) => {
      if (!isLegacyMilestoneChecksMap(prev as unknown as Record<string, unknown>)) return prev;
      return migrateMilestoneChecksMap(prev as unknown as Record<string, unknown>, resolveStageIdForRef);
    });
  }, [resolveStageIdForRef]);

  useEffect(() => {
    if (!memoriesLocalReady) return;
    setMemories((prev) => {
      const next = migrateLegacyMilestoneMemories(prev, resolveStageIdForRef);
      if (next === prev) return prev;
      void persistMemoriesDurable(token, next);
      return next;
    });
  }, [memoriesLocalReady, resolveStageIdForRef, token]);

  const milestoneMemorySyncedRef = useRef(false);
  useEffect(() => {
    if (!memoriesLocalReady || milestoneMemorySyncedRef.current) return;
    milestoneMemorySyncedRef.current = true;
    setMemories((prev) => {
      const missing: Memory[] = [];
      for (const [ref, byStage] of Object.entries(milestoneChecksMap)) {
        for (const [stageId, checks] of Object.entries(byStage || {})) {
          (checks || []).forEach((checked, idx) => {
            if (!checked) return;
            const key = milestoneMemoryKey(ref, stageId, idx);
            if (prev.some((m) => m.milestoneKey === key)) return;
            const label = resolveMilestoneLabel(ref, stageId, idx);
            if (!label) return;
            missing.push(buildMilestoneMemory({ ref, stageId, idx, label, lang }));
          });
        }
      }
      if (!missing.length) return prev;
      const next = [...missing, ...prev];
      void persistMemoriesDurable(token, next);
      return next;
    });
  }, [memoriesLocalReady, milestoneChecksMap, resolveMilestoneLabel, lang, token]);

  const [offers, setOffers] = useState<any[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  useEffect(()=>{
    let cancelled=false;
    setOffersLoading(true);
    axios.get(`${API}/offers`,{params:{lang},headers:{"x-token":token}})
      .then(res=>{if(!cancelled)setOffers(res.data.offers||[]);})
      .catch(()=>{if(!cancelled)setOffers([]);})
      .finally(()=>{if(!cancelled)setOffersLoading(false);});
    return ()=>{cancelled=true;};
  },[lang, token]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages,loading]);

  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  /** Write family to stable localStorage only (fast, no UI state). */
  const saveFamilyLocal = useCallback((data: FamilyData) => {
    const payload = normalizeFamilyData(data);
    if (!payload.children.length && !payload.members.length && !payload.selfPhoto) return;
    safeLocalSet(sk(token, "family"), JSON.stringify(payload));
    clearBootLocalScanCache();
  }, [token]);

  /** Push family to cloud — used by explicit Save (sets saving indicator). */
  const saveFamilyCloud = useCallback(async (data: FamilyData, showFeedback = false) => {
    const payload = normalizeFamilyData(data);
    if (!payload.children.length && !payload.members.length && !payload.selfPhoto) return;
    if (!cloudReady) {
      if (showFeedback) {
        showToastRef.current(
          t("syncing_local", lang),
          "ok",
        );
      }
      return;
    }
    setFamilySaving(true);
    try {
      await axios.post(`${API}/userdata`, { key: "family", value: payload }, { headers: { "x-token": token } });
      if (showFeedback) {
        showToastRef.current(t("family_saved", lang), "ok");
      }
    } catch {
      if (showFeedback) {
        showToastRef.current(t("mem_save_fail", lang), "err");
      }
    } finally {
      setFamilySaving(false);
    }
  }, [token, cloudReady, lang]);

  const saveFamilyNow = useCallback(() => {
    saveFamilyLocal(familyData);
    void saveFamilyCloud(familyData, true);
  }, [familyData, saveFamilyLocal, saveFamilyCloud]);

  /** Write memories to IndexedDB + local meta (fast, no UI state). */
  const saveMemoriesLocal = useCallback((data: Memory[]) => {
    void persistMemoriesDurable(token, data);
  }, [token]);

  /** Push memories to cloud (compressed photos included for cross-device). */
  const saveMemoriesCloud = useCallback(async (data: Memory[], showFeedback = false) => {
    if (!cloudReady) {
      if (showFeedback) {
        showToastRef.current(t("saving", lang), "ok");
      }
      return;
    }
    setMemoriesSaving(true);
    try {
      const payload = data.length ? await memoriesForCloud(data) : [];
      await axios.post(`${API}/userdata`, { key: "memories", value: payload }, { headers: { "x-token": token } });
      if (showFeedback) {
        showToastRef.current(t("mem_saved", lang), "ok");
      }
    } catch {
      if (showFeedback) {
        showToastRef.current(t("mem_save_fail", lang), "err");
      }
    } finally {
      setMemoriesSaving(false);
    }
  }, [token, cloudReady, lang]);

  const saveMemoriesNow = useCallback(() => {
    saveMemoriesLocal(memories);
    void saveMemoriesCloud(memories, true);
  }, [memories, saveMemoriesLocal, saveMemoriesCloud]);

  const sbSave = useCallback(async (key: string, value: any) => {
    // Memories use IndexedDB — never jam full photo payloads into localStorage
    if (key !== "memories") {
      const raw = JSON.stringify(value);
      // Never overwrite a non-empty local blob with empty cloud-bound payload
      if (raw === "[]" || raw === "{}") {
        const existing = localStorage.getItem(sk(token, key));
        if (existing && existing !== "[]" && existing !== "{}") {
          /* keep existing local */
        } else {
          safeLocalSet(sk(token, key), raw);
        }
      } else {
        safeLocalSet(sk(token, key), raw);
      }
    }
    if (!cloudReady) return;
    // Never push empty arrays/objects to cloud (would wipe recovered data)
    if (value == null) return;
    if (Array.isArray(value) && value.length === 0) return;
    if (typeof value === "object" && !Array.isArray(value)) {
      const keys = Object.keys(value);
      if (
        (key === "family" && !(value.children?.length || value.members?.length)) ||
        (key === "milestones_map" && keys.length === 0)
      ) {
        return;
      }
    }
    try { await axios.post(`${API}/userdata`, { key, value }, { headers: { "x-token": token } }); } catch {}
  }, [token, cloudReady]);

  // Emergency restore: scan all local JWT keys + IDB, then merge cloud — then allow saves
  useEffect(() => {
    let cancelled = false;
    setCloudReady(false);
    setMemoriesLocalReady(false);

    (async () => {
      try {
        const local = await recoverAllLocalUserData(token);
        if (cancelled) return;

        if (local.memories.length) setMemories(local.memories as Memory[]);
        if (local.family.children.length || local.family.members.length) {
          setFamilyData(ensureFamilyMemberIds(local.family));
        }
        if (local.chat.length) setMessages(local.chat as Message[]);
        if (local.threads.length) setThreads(local.threads as Thread[]);
        if (local.docs.length) setDocs(normalizeDocEntries(local.docs as unknown[]));
        if (Object.keys(local.milestones_map).length) {
          setMilestoneChecksMap(local.milestones_map as unknown as MilestoneChecksMap);
        }
        if (local.shopitems?.length) setShopItems(local.shopitems);
        if (local.superitems?.length) setSuperItems(local.superitems);

        let cloudRaw: Record<string, unknown> = {};
        try {
          const res = await axios.get(`${API}/userdata`, { headers: { "x-token": token } });
          cloudRaw = res.data?.data || {};
        } catch {
          /* offline / auth — keep local */
        }
        if (cancelled) return;

        const merged = mergeCloudUserData(local, cloudRaw);
        const finalMemories = pickRicherMemories(
          local.memories,
          merged.memories,
        ) as Memory[];
        setMemories(finalMemories);
        setFamilyData(ensureFamilyMemberIds(merged.family));
        if (merged.chat.length) setMessages(merged.chat as Message[]);
        if (merged.threads.length) setThreads(merged.threads as Thread[]);
        if (merged.docs.length) setDocs(normalizeDocEntries(merged.docs as unknown[]));
        if (Object.keys(merged.milestones_map).length) {
          setMilestoneChecksMap(merged.milestones_map as unknown as MilestoneChecksMap);
        }
        if (merged.shopitems?.length) setShopItems(merged.shopitems);
        if (merged.superitems?.length) setSuperItems(merged.superitems);

        await rehomeRecoveredData(token, {
          ...merged,
          memories: finalMemories.length ? finalMemories : local.memories,
          family:
            merged.family.children.length + merged.family.members.length > 0
              ? merged.family
              : local.family,
        });
        // Only prune JWT memory keys after a successful non-empty re-home
        if (finalMemories.length > 0 || local.memories.length > 0) {
          pruneOrphanJwtMemoryKeys(token);
        }
        if (merged.family.children.length || merged.family.members.length) {
          pruneOrphanJwtFamilyKeys(token);
          safeLocalSet(sk(token, "family"), JSON.stringify(normalizeFamilyData(merged.family)));
          clearBootLocalScanCache();
        }

        // Push photo memories to Supabase so Vercel / other devices get images
        try {
          let cloudMemories = parseMemoriesJson(
            typeof cloudRaw.memories === "string" ? cloudRaw.memories : null,
          );
          if (!cloudMemories.length && Array.isArray(cloudRaw.memories)) {
            cloudMemories = cloudRaw.memories as Memory[];
          }
          if (
            memoriesHavePhotos(finalMemories) &&
            localMemoriesRicherThanCloud(finalMemories, cloudMemories)
          ) {
            const payload = await memoriesForCloud(finalMemories);
            await axios.post(
              `${API}/userdata`,
              { key: "memories", value: payload },
              { headers: { "x-token": token } },
            );
          }
        } catch (err) {
          console.warn("Memory photo cloud seed failed", err);
        }
      } catch (err) {
        console.error("User data recovery failed", err);
      } finally {
        if (!cancelled) {
          setMemoriesLocalReady(true);
          setCloudReady(true);
        }
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Deduplicate members once on load (fixes local+cloud id merge doubles)
  useEffect(() => {
    setFamilyData((prev) => ensureFamilyMemberIds(prev));
  }, []);

  useEffect(() => {
    if (!familyData.members.length) return;
    setMemories((prev) => migrateRefsToMemberIds(prev, familyData.members));
    setDocs((prev) => migrateRefsToMemberIds(prev, familyData.members));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyData.members.map((m) => m.id).join("|")]);

  // Migrate legacy profile-only children into user_data.family.children
  useEffect(() => {
    if (!cloudReady) return;
    setFamilyData((prev) => {
      if (prev.children.length > 0) return prev;
      if (profileChildren.length === 0) return prev;
      return {
        ...prev,
        children: profileChildren.map((c) => ({ name: c.name, birthDate: c.birthDate })),
      };
    });
  }, [profileChildren, cloudReady]);

  useEffect(()=>{ if (!cloudReady) return; void sbSave("chat", messages); },[messages, sbSave, cloudReady]);
  useEffect(()=>{ if (!cloudReady) return; void sbSave("threads", threads); },[threads, sbSave, cloudReady]);
  // Always persist memories locally (IDB); also sync to cloud with compressed photos
  useEffect(() => {
    if (!memoriesLocalReady) return;
    saveMemoriesLocal(memories);
  }, [memories, memoriesLocalReady, saveMemoriesLocal]);
  useEffect(() => {
    if (!cloudReady || !memoriesLocalReady || !memories.length) return;
    const timer = window.setTimeout(() => {
      void saveMemoriesCloud(memories, false);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [memories, cloudReady, memoriesLocalReady, saveMemoriesCloud]);
  useEffect(() => {
    saveFamilyLocal(familyData);
  }, [familyData, saveFamilyLocal]);
  useEffect(()=>{ if (!cloudReady) return; void sbSave("family", normalizeFamilyData(familyData)); },[familyData, sbSave, cloudReady]);
  useEffect(()=>{ if (!cloudReady) return; void sbSave("milestones_map", milestoneChecksMap); },[milestoneChecksMap, sbSave, cloudReady]);
  useEffect(()=>{ safeLocalSet(sk(token,"docs"), JSON.stringify(docs)); },[docs, token]);
  useEffect(() => {
    if (!cloudReady) return;
    const timer = window.setTimeout(() => {
      void sbSave("docs", docs);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [docs, cloudReady, sbSave]);
  useEffect(()=>{ if (!cloudReady) return; void sbSave("shopitems", shopItems); },[shopItems, sbSave, cloudReady]);
  useEffect(()=>{ if (!cloudReady) return; void sbSave("superitems", superItems); },[superItems, sbSave, cloudReady]);

  const sendMessage = async (text: string, attachments: ChatAttachment[] = []) => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    if (recordingIntentRef.current) {
      recordingIntentRef.current = false;
      const r = recRef.current;
      recRef.current = null;
      stopMicMeter();
      setRecording(false);
      try { r?.stop(); } catch { /* ignore */ }
    }
    const hasVideoAttachment = attachments.some((a) => a.kind === "video");
    track(
      "submit",
      hasVideoAttachment ? GAMIFICATION_CHAT_VIDEO_PATH : appPath("chat", "send"),
      attachments.length ? "Send message with attachment" : "Send message",
    );
    const userMsg: Message = { role: "user", content: trimmed, attachments: attachments.length ? attachments : undefined };
    const next = [...messages, userMsg]; setMessages(next); setInput(""); setChatPendingAttachments([]); setLoading(true);
    if (isLocalDemoToken(token)) {
      const msg = lang === "el"
        ? "Σε local demo η HeyMaa δεν μιλάει με το API. Για chat με φωτογραφίες/αρχεία χρειάζεται σύνδεση με πραγματικό λογαριασμό."
        : "Local demo cannot reach the chat API. Sign in with a real account to send photos and files.";
      const demoSuggestion = detectMemorySuggestion(trimmed, {
        profile: {
          childName: profile.childName,
          dueDate: profile.dueDate || null,
          children: familyChildren.map((c) => ({ name: c.name })),
        },
        recentMemories: memories.filter((m) => m.text && m.text !== "📷"),
        lang,
      });
      setMessages([...next, { role: "assistant", content: msg, memorySuggestion: demoSuggestion }]);
      setLoading(false);
      return;
    }
    // Recent memories (text only) for context — limit by plan
    const recentMemories = memories
      .slice(0, memoryContextLimit)
      .filter((m) => m.text && m.text !== "📷")
      .map((m) => ({ text: m.text, date: m.date, ref: m.ref }));
    const recentDocs = docs.slice(0,30).map(d=>({title:d.title,category:d.category,date:d.date,ref:d.ref}));
    const historyForApi = messages.slice(-chatContextLimit).map((m) => ({
      role: m.role,
      content: m.content || (m.attachments?.length ? `[${m.attachments.length} attachment(s)]` : ""),
    }));
    try {
      const res = await axios.post(
        `${API}/chat`,
        {
          message: trimmed,
          history: historyForApi,
          attachments: attachments.map(attachmentPayloadForApi),
          profile: {
            name: displayName || profile.name || null,
            childName: profile.childName,
            childAge: profile.childAge,
            childBirthDate: profile.childBirthDate || null,
            dueDate: profile.dueDate || null,
            lang: lang,
            children: familyChildren.map((c) => ({ name: c.name, birthDate: c.birthDate || null })),
            pregnancyStatus:
              profile.pregnancyStatus ||
              (profile.dueDate ? (isDueDatePassed(profile.dueDate) ? "awaiting_update" : "active") : undefined),
          },
          recentMemories,
          recentDocs: recentDocs.slice(0, 10),
        },
        { headers: { "x-token": token }, timeout: 60000 },
      );
      setMessages([
        ...next,
        {
          role: "assistant",
          content: res.data.reply,
          promo: res.data.promo || null,
          memorySuggestion: mapApiMemorySuggestion(res.data.memory_suggestion),
        },
      ]);
    } catch (err: any) {
      if (err.response?.status === 401) {
        const msg = lang === "el"
          ? "Η σύνδεσή σου έληξε ή δεν είναι έγκυρη. Συνδέσου ξανά για να μιλήσεις με την HeyMaa."
          : "Your session expired or is invalid. Please sign in again to chat with HeyMaa.";
        setMessages([...next, { role: "assistant", content: msg }]);
        showToast(msg, "err");
        window.setTimeout(() => onLogout(), 1200);
      } else if (err.response?.status === 402) onExpired();
      else {
        const detail = apiDetail(err.response?.data, "");
        const network = !err.response && (err.code === "ECONNABORTED" || /timeout/i.test(String(err.message || "")));
        const busy = /busy right now|try again in a minute/i.test(detail);
        let msg = t("chat_error", lang);
        if (network) {
          msg = lang === "el" ? "Η απάντηση άργησε πολύ. Δοκίμασε ξανά." : "The reply took too long. Please try again.";
        } else if (busy || err.response?.status === 503) {
          msg = lang === "el"
            ? (busy ? "Η HeyMaa είναι λίγο απασχολημένη. Δοκίμασε ξανά σε ένα λεπτό." : "Η HeyMaa δεν μπόρεσε να απαντήσει. Δοκίμασε ξανά σε λίγο.")
            : (detail || msg);
        } else if (detail && detail.length < 200) {
          msg = detail;
        }
        console.error("chat failed", err.response?.status, detail || err.message);
        setMessages([...next, { role: "assistant", content: msg }]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Prefill input and switch to chat without sending
  const prefillChat = (text: string) => {
    setTab("chat");
    setTimeout(()=>{ setInput(text); inputRef.current?.focus(); }, 80);
  };

  // Archive current thread
  const doArchive = () => {
    if (!messages.length) return;
    if (!canArchiveAnotherThread(planEntitlements, subSnapshot, threads.length)) return;
    const title = archiveTitle.trim() || messages[0].content.slice(0,40) + (messages[0].content.length>40?"…":"");
    const thread: Thread = { id: Date.now().toString(), title, date: new Date().toLocaleDateString(lang,{day:"numeric",month:"short",year:"numeric"}), messages: [...messages] };
    setThreads(prev=>[thread,...prev]); setMessages([]); setShowArchiveModal(false); setArchiveTitle("");
    showToast(lang === "el" ? "Η συνομιλία αρχειοθετήθηκε." : "Conversation archived.", "ok");
  };

  const requestNewThread = () => {
    if (!messages.length) return;
    setShowNewThreadModal(true);
  };

  const discardCurrentThread = () => {
    setMessages([]);
    setShowNewThreadModal(false);
    showToast(lang === "el" ? "Ξεκίνησε νέα συνομιλία." : "Started a new conversation.", "ok");
  };

  const openArchiveForNew = () => {
    setShowNewThreadModal(false);
    setShowArchiveModal(true);
  };

  const deleteThread = (threadId: string) => {
    setThreads((prev) => prev.filter((th) => th.id !== threadId));
  };

  const ttsQuotaTotal = voiceQuota?.limit ?? voiceListenQuotaForSnapshot(subSnapshot);
  const ttsUsedSafe = voiceQuota?.used ?? 0;
  const ttsRemaining = voiceQuota?.remaining ?? Math.max(0, ttsQuotaTotal - ttsUsedSafe);
  const openSubscriptionUpgrade = useCallback(() => {
    void fetchSubscriptionStatus(token)
      .then(applySubscriptionSnapshot)
      .catch(() => {});
    setShowSubscriptionSheet(true);
  }, [token, applySubscriptionSnapshot]);
  const archiveBlocked = !canArchiveAnotherThread(planEntitlements, subSnapshot, threads.length);

  const stripMd = (s: string) => s.replace(/\*\*(.+?)\*\*/g,"$1").replace(/\*(.+?)\*/g,"$1").replace(/#{1,6} /g,"").replace(/`(.+?)`/g,"$1").replace(/\[(.+?)\]\(.+?\)/g,"$1").trim();
  const stopAudio = () => { if(audioRef.current){audioRef.current.pause();audioRef.current=null;} setPlayingIndex(null); };
  const speak = async (text: string, idx: number) => {
    if(playingIndex===idx){stopAudio();return;}
    if(audioRef.current){audioRef.current.pause();audioRef.current=null;}
    if(ttsRemaining<=0){
      openSubscriptionUpgrade();
      return;
    }
    setPlayingIndex(idx);
    try {
      const ttsLang=lang;
      const clean=stripMd(text);
      const res=await axios.post(`${API}/tts`,{text:clean,lang:ttsLang},{headers:{"x-token":token}});
      if (res.data?.voice_quota) setVoiceQuota(res.data.voice_quota);
      const audio=new Audio(`data:audio/mp3;base64,${res.data.audio}`);
      audioRef.current=audio;
      audio.onended=()=>{setPlayingIndex(null);audioRef.current=null;};
      audio.play();
    } catch (err: unknown) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 429) {
        openSubscriptionUpgrade();
        fetchSubscriptionStatus(token).then((data) => {
          if (data.voice_quota) setVoiceQuota(data.voice_quota);
        }).catch(() => {});
      }
      setPlayingIndex(null);
    }
  };

  const stopMicMeter = () => {
    const meter = micMeterRef.current;
    micMeterRef.current = null;
    if (!meter) return;
    cancelAnimationFrame(meter.raf);
    meter.stream.getTracks().forEach((t) => t.stop());
    void meter.ctx.close().catch(() => {});
    setMicLevels(Array.from({ length: 32 }, () => 0.12));
  };

  const startMicMeter = () => {
    stopMicMeter();
    if (!navigator.mediaDevices?.getUserMedia) return;
    void navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then((stream) => {
      if (!recordingIntentRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const ctx: AudioContext = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.55;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const barCount = 32;
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const next: number[] = [];
        for (let i = 0; i < barCount; i++) {
          const idx = Math.min(data.length - 1, Math.floor((i / barCount) * data.length * 0.85) + 1);
          next.push(Math.max(0.08, Math.min(1, data[idx] / 210)));
        }
        setMicLevels(next);
        const handle = requestAnimationFrame(tick);
        if (micMeterRef.current) micMeterRef.current.raf = handle;
      };
      const raf = requestAnimationFrame(tick);
      micMeterRef.current = { stream, ctx, raf };
      void ctx.resume().catch(() => {});
    }).catch((err) => {
      console.error("Mic meter error", err);
    });
  };

  const startRec = () => {
    const SR = (window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!SR){alert("Για το μικρόφωνο άνοιξε το app στο http://127.0.0.1:3000");return;}
    if(recordingIntentRef.current) return;
    if(recSendTimerRef.current){ clearTimeout(recSendTimerRef.current); recSendTimerRef.current=null; }
    const r=new SR();
    r.lang=lang;
    r.continuous=true;
    r.interimResults=true;
    let finalBuf="";
    recTranscriptRef.current="";
    r.onresult=(e:any)=>{
      let interim="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        const piece=e.results[i][0].transcript;
        if(e.results[i].isFinal) finalBuf += (finalBuf && !/\s$/.test(finalBuf) ? " " : "") + piece.trim();
        else interim += piece;
      }
      const live=(finalBuf + (interim ? (finalBuf ? " " : "") + interim : "")).trim();
      recTranscriptRef.current=live;
      if(live) setInput(live);
    };
    r.onerror=(e:any)=>{
      console.error("SpeechRecognition error",e.error);
      if(e.error==="aborted"||e.error==="no-speech") return;
      recordingIntentRef.current=false;
      stopMicMeter();
      setRecording(false);
    };
    r.onend=()=>{
      // Browser may end after a pause — keep listening while the mic is held.
      if(recRef.current===r && recordingIntentRef.current){
        try { r.start(); } catch { recordingIntentRef.current=false; stopMicMeter(); setRecording(false); }
      } else {
        setRecording(false);
      }
    };
    recRef.current=r;
    recordingIntentRef.current=true;
    try {
      r.start();
      setRecording(true);
      startMicMeter();
    } catch(err){
      console.error(err);
      recordingIntentRef.current=false;
      stopMicMeter();
      setRecording(false);
    }
  };

  const stopRecAndSend = () => {
    if(!recordingIntentRef.current && !recording) return;
    recordingIntentRef.current = false;
    const r = recRef.current;
    recRef.current = null;
    stopMicMeter();
    setRecording(false);
    try { r?.stop(); } catch { /* ignore */ }
    if(recSendTimerRef.current) clearTimeout(recSendTimerRef.current);
    // Brief delay so the final speech chunk can land after stop().
    recSendTimerRef.current = setTimeout(() => {
      recSendTimerRef.current = null;
      const text = recTranscriptRef.current.trim();
      recTranscriptRef.current = "";
      if(text) void sendMessage(text);
    }, 350);
  };

  const handleChatFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const picked = Array.from(files).slice(0, 4);
    try {
      const next = await Promise.all(picked.map((f) => fileToChatAttachment(f)));
      setChatPendingAttachments((prev) => [...prev, ...next].slice(0, 4));
    } catch (err: any) {
      if (err?.message === "too_large") {
        showToast(lang === "el" ? "Το αρχείο είναι πολύ μεγάλο (μέγ. 6MB)." : "File is too large (max 6MB).", "err");
      } else {
        showToast(lang === "el" ? "Δεν ήταν δυνατή η ανάγνωση του αρχείου." : "Could not read that file.", "err");
      }
    }
  };

  const openChatAttachPicker = () => {
    if (loading || recording || chatPendingAttachments.length >= 4) return;
    setShowChatAttachSheet((open) => !open);
  };

  const pickChatAttachment = (target: "camera" | "gallery" | "file") => {
    setShowChatAttachSheet(false);
    window.setTimeout(() => {
      if (target === "camera") chatCameraRef.current?.click();
      else if (target === "gallery") chatGalleryRef.current?.click();
      else chatFileRef.current?.click();
    }, 0);
  };

  const acceptMemorySuggestion = (assistantIdx: number) => {
    const suggestion = messages[assistantIdx]?.memorySuggestion;
    if (!suggestion || suggestion.added || suggestion.dismissed) return;

    const dateIso = suggestion.dateIso || new Date().toISOString().slice(0, 10);
    const d = new Date(`${dateIso}T12:00:00`);
    const date = d.toLocaleDateString(lang, { day: "numeric", month: "short" });
    const createdAt = d.toISOString();
    const memoryRef =
      suggestion.ref && suggestion.ref !== "__general__" ? suggestion.ref : undefined;

    let isMilestone = suggestion.kind === "milestone";
    let milestoneKey: string | undefined;

    if (isMilestone && suggestion.ref) {
      const stageId = resolveStageIdForRef(suggestion.ref);
      const labels = getMilestoneBullets(stageId, lang);
      const matchIdx = findMatchingMilestoneIndex(suggestion.text, labels);
      if (matchIdx !== null) {
        const key = milestoneMemoryKey(suggestion.ref, stageId, matchIdx);
        if (!memories.some((m) => m.milestoneKey === key)) {
          milestoneKey = key;
          setMilestoneChecksMap((prev) =>
            setCheckForStage(prev, suggestion.ref!, stageId, matchIdx, true, labels.length),
          );
        }
      }
    }

    track("submit", appPath("chat", "add-memory-suggestion"), "Add memory from chat", {
      kind: suggestion.kind,
      ref: memoryRef,
    });

    setMemories((prev) => {
      const next: Memory[] = [{
        emoji: suggestion.emoji,
        text: suggestion.text,
        description: suggestion.description || undefined,
        date,
        createdAt,
        ref: memoryRef,
        source: "chat",
        isMilestone: isMilestone || !!milestoneKey,
        milestoneKey,
      }, ...prev];
      void persistMemoriesDurable(token, next);
      return next;
    });

    setMessages((prev) =>
      prev.map((m, i) =>
        i === assistantIdx && m.memorySuggestion
          ? { ...m, memorySuggestion: { ...m.memorySuggestion, added: true } }
          : m,
      ),
    );

    showToast(
      lang === "el" ? "Προστέθηκε στις Αναμνήσεις." : "Memory added to your journal.",
      "ok",
    );
  };

  const dismissMemorySuggestion = (assistantIdx: number) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === assistantIdx && m.memorySuggestion
          ? { ...m, memorySuggestion: { ...m.memorySuggestion, dismissed: true } }
          : m,
      ),
    );
  };

  const createMemoryFromForm = (values: MemoryFormValues, journalRef: string) => {
    if (values.img && !featureAllowed("full_memory", planEntitlements, subSnapshot)) {
      openSubscriptionUpgrade();
      return;
    }
    if (values.video && !featureAllowed("memory_video", planEntitlements, subSnapshot)) {
      openSubscriptionUpgrade();
      return;
    }
    const ref = journalRef === "__general__" ? undefined : journalRef;
    const d = new Date(values.dateIso);
    const date = d.toLocaleDateString(lang, { day: "numeric", month: "short" });
    const createdAt = d.toISOString();
    const pointPath = values.video
      ? appPath("memories", "add-video")
      : values.img
        ? appPath("memories", "add-photo")
        : appPath("memories", "add-note");
    track("submit", pointPath, values.img ? "Add photo memory" : "Add memory", { ref });
    const commit = (img?: string, video?: string) => {
      setMemories((prev) => {
        const next: Memory[] = [{
          emoji: values.emoji,
          text: values.text,
          description: values.description || undefined,
          date,
          createdAt,
          img,
          video,
          ref,
          source: "manual",
        }, ...prev];
        void persistMemoriesDurable(token, next);
        return next;
      });
    };
    if (values.img) {
      void compressImageDataUrl(values.img).then((img) => commit(img, undefined));
      return;
    }
    commit(undefined, values.video);
  };

  const updateMemoryFromForm = (index: number, values: MemoryFormValues) => {
    if (values.img && !featureAllowed("full_memory", planEntitlements, subSnapshot)) {
      openSubscriptionUpgrade();
      return;
    }
    if (values.video && !featureAllowed("memory_video", planEntitlements, subSnapshot)) {
      openSubscriptionUpgrade();
      return;
    }
    const d = new Date(values.dateIso);
    const date = d.toLocaleDateString(lang, { day: "numeric", month: "short" });
    const createdAt = d.toISOString();
    setMemories((prev) => {
      const next = prev.map((m, i) => {
        if (i !== index) return m;
        return {
          ...m,
          emoji: values.emoji,
          text: values.text,
          description: values.description || undefined,
          date,
          createdAt,
          img: values.img,
          video: values.video,
        };
      });
      void persistMemoriesDurable(token, next);
      return next;
    });
  };

  const pickMemoryPhoto = () => {
    if (!featureAllowed("full_memory", planEntitlements, subSnapshot)) {
      openSubscriptionUpgrade();
      return;
    }
    awaitingMemoryPhotoRef.current = true;
    fileRef.current?.click();
  };

  const findMemoryIndex = (m: Memory) =>
    memories.findIndex((x) =>
      (x.createdAt && m.createdAt && x.createdAt === m.createdAt) ||
      (x.img && m.img && x.img === m.img) ||
      (x.date === m.date && x.text === m.text && (x.ref || '') === (m.ref || '') && !!x.img === !!m.img),
    );

  const removeMemoryPhoto = (index: number) => {
    setMemories((prev) => prev.map((mem, i) => (i === index ? { ...mem, img: undefined, video: undefined } : mem)));
  };

  const deleteMemory = (index: number) => {
    const removed = memories[index];
    if (!removed) return;
    setMemories(memories.filter((_, j) => j !== index));
    showUndoToast(
      t("mem_deleted", lang),
      () => setMemories((prev) => {
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, removed);
        return next;
      }),
    );
  };

  const toggleMilestone = (ref: string, stageId: string, idx: number, label: string) => {
    const bullets = getMilestoneBullets(stageId, lang);
    const current = !!(milestoneChecksMap[ref]?.[stageId]?.[idx]);
    const key = milestoneMemoryKey(ref, stageId, idx);
    setMilestoneChecksMap((prev) => setCheckForStage(prev, ref, stageId, idx, !current, bullets.length));
    setLastCheckedMap((prev) => ({ ...prev, [ref]: current ? null : { stageId, idx } }));
    if (!current) {
      track("submit", appPath("milestones", "check"), "Milestone reached", { ref, stageId, idx });
      setMemories((prev) => {
        if (prev.some((m) => m.milestoneKey === key)) return prev;
        const next: Memory[] = [buildMilestoneMemory({ ref, stageId, idx, label, lang }), ...prev];
        void persistMemoriesDurable(token, next);
        return next;
      });
    } else {
      setMemories((prev) => {
        const next = prev.filter((m) => m.milestoneKey !== key);
        if (next.length !== prev.length) void persistMemoriesDurable(token, next);
        return next;
      });
    }
  };

  const addFamilyMember = () => {
    if(!newMemberName.trim())return;
    track("click", appPath("family", "add-member"), "Add family member");
    const member: FamilyMemberRecord = {
      id: newFamilyMemberId(),
      name: newMemberName.trim(),
      relationship: newMemberRole.trim() || "Family",
      relatedTo: newMemberRelatedTo || RELATED_TO_SELF,
      ...(newMemberEmail.trim() ? { email: newMemberEmail.trim() } : {}),
      ...(newMemberPhone.trim() ? { phone: newMemberPhone.trim() } : {}),
      ...(newMemberBirthDate.trim() ? { birthDate: newMemberBirthDate.trim() } : {}),
      ...(newMemberNote.trim() ? { note: newMemberNote.trim() } : {}),
    };
    setFamilyData((prev) => ({ ...prev, members: [...prev.members, member] }));
    setNewMemberName(""); setNewMemberRole("Partner"); setNewMemberRelatedTo(RELATED_TO_SELF); setNewMemberEmail(""); setNewMemberPhone(""); setNewMemberBirthDate(""); setNewMemberNote(""); setShowAddMember(false);
  };

  const addPet = () => {
    if (!newPetName.trim()) return;
    track("click", appPath("family", "add-pet"), "Add family pet");
    const member: FamilyMemberRecord = {
      id: newFamilyMemberId(),
      name: newPetName.trim(),
      relationship: "Pet",
      relatedTo: RELATED_TO_SELF,
      ...(newPetNote.trim() ? { note: newPetNote.trim() } : {}),
    };
    setFamilyData((prev) => ({ ...prev, members: [...prev.members, member] }));
    setNewPetName("");
    setNewPetNote("");
    setShowAddPet(false);
  };

  const addChild = () => {
    if(!newChildName.trim()||!newChildBirthDate)return;
    if(!newChildGender){
      showToast(lang==="el"?"Επίλεξε φύλο.":"Select gender.", "err");
      return;
    }
    track("click", appPath("family", "add-child"), "Add child");
    const updatedChildren = [...familyChildren, {
      name: newChildName.trim(),
      birthDate: newChildBirthDate,
      gender: newChildGender,
    }];
    setFamilyData((prev) => ({ ...prev, children: updatedChildren }));
    const updatedProfile: Profile = {
      ...profile,
      children: updatedChildren.map(({name, birthDate}) => ({name, birthDate})),
      childName: updatedChildren[0]?.name || profile.childName,
      childBirthDate: updatedChildren[0]?.birthDate || profile.childBirthDate,
      childAge: updatedChildren[0] ? formatChildAge(updatedChildren[0].birthDate, lang) : profile.childAge,
      pregnancyStatus: newChildDateMode === "birth" && profile.dueDate ? "completed" : profile.pregnancyStatus,
      ...(newChildDateMode === "due" ? { dueDate: newChildBirthDate, pregnancyStatus: "active" as const } : {}),
    };
    onProfileUpdate(updatedProfile);
    void syncProfileInBackground({ ...updatedProfile, consentMarketing: profile.consentMarketing });
    setNewChildName(""); setNewChildBirthDate(""); setNewChildGender(""); setNewChildDateMode("birth"); setShowAddChild(false);
    showToast(lang==="el"?"Το παιδί προστέθηκε":"Child added", "ok");
  };

  const deleteFamilyMember = (index: number) => {
    const removed = familyData.members[index];
    if (!removed) return;
    setFamilyData((prev) => ({ ...prev, members: prev.members.filter((_, j) => j !== index) }));
    showUndoToast(
      t("deleted_named", lang).replace("{name}", removed.name),
      () => setFamilyData((prev) => {
        const next = [...prev.members];
        next.splice(Math.min(index, next.length), 0, removed);
        return { ...prev, members: next };
      }),
    );
  };

  const changeMemberRelationship = (index: number, relationship: string) => {
    const prev = familyData.members[index];
    if (!prev || prev.relationship === relationship) return;
    const prevRel = prev.relationship;
    const prevRelatedTo = prev.relatedTo || RELATED_TO_SELF;
    const nextRelatedTo = defaultRelatedToForRelationship(relationship, familyData.members, prevRelatedTo);
    setFamilyData((cur) => ({
      ...cur,
      members: cur.members.map((m, j) =>
        j === index ? { ...m, relationship, relatedTo: nextRelatedTo } : m,
      ),
    }));
    const label = RELATIONSHIP_PRESETS.find((p) => p.value === relationship);
    showUndoToast(
      lang === "el"
        ? `Μετακινήθηκε ως ${label?.el || relationship}`
        : `Moved as ${label?.en || relationship}`,
      () => setFamilyData((cur) => ({
        ...cur,
        members: cur.members.map((m, j) =>
          j === index ? { ...m, relationship: prevRel, relatedTo: prevRelatedTo } : m,
        ),
      })),
    );
  };

  const changeMemberRelatedTo = (index: number, relatedTo: string) => {
    const prev = familyData.members[index]?.relatedTo || RELATED_TO_SELF;
    if (prev === relatedTo) return;
    setFamilyData((cur) => ({
      ...cur,
      members: cur.members.map((m, j) => (j === index ? { ...m, relatedTo } : m)),
    }));
    const partnerName = familyData.members.find((m) => m.relationship === "Partner" || /partner|spouse|husband|wife/i.test(m.relationship))?.name;
    showUndoToast(
      lang === "el"
        ? `Συγγενής του/της: ${relatedToLabel(relatedTo, lang, { youName: profile.name, partnerName, members: familyData.members })}`
        : `Relative of: ${relatedToLabel(relatedTo, lang, { youName: profile.name, partnerName, members: familyData.members })}`,
      () => setFamilyData((cur) => ({
        ...cur,
        members: cur.members.map((m, j) => (j === index ? { ...m, relatedTo: prev } : m)),
      })),
    );
  };

  const placeMembersOnTree = (nextMembers: typeof familyData.members) => {
    const prev = familyData.members;
    const nextFamily = { ...familyData, members: nextMembers };
    setFamilyData(nextFamily);
    showUndoToast(
      t("tree_updated", lang),
      () => {
        setFamilyData({ ...familyData, members: prev });
      },
    );
  };

  const openTreeEdit = (node: LaidOutNode) => {
    if (node.kind === "pregnancy") return;
    setTreeEdit(node);
    setTreeEditName(node.name);
    setTreeEditRole(node.kind === "self" || node.kind === "child" ? node.role : (node.role || "Family"));
    if (node.memberIndex != null) {
      const m = familyData.members[node.memberIndex];
      setTreeEditRole(m?.relationship || node.role || "Family");
      setTreeEditRelatedTo(m?.relatedTo || RELATED_TO_SELF);
      setTreeEditBirthDate(m?.birthDate || "");
      setTreeEditNote(m?.note || "");
    } else if (node.childIndex != null) {
      const c = familyChildren[node.childIndex];
      setTreeEditBirthDate(c?.birthDate || "");
      setTreeEditNote("");
      setTreeEditRelatedTo(RELATED_TO_SELF);
    } else {
      setTreeEditBirthDate("");
      setTreeEditNote("");
      setTreeEditRelatedTo(RELATED_TO_SELF);
    }
  };

  const openChildEdit = (childIndex: number) => {
    const child = familyChildren[childIndex];
    if (!child) return;
    openTreeEdit({
      id: `child-${childIndex}-${child.name}`,
      name: child.name,
      role: t("role_child", lang),
      kind: "child",
      side: "self",
      generation: 1,
      memoryCount: 0,
      color: logoPurple,
      childIndex,
      ref: child.name,
      photo: child.photo,
      x: 0,
      y: 0,
    });
  };

  const currentTreeEditPhoto = (): string | undefined => {
    if (!treeEdit) return undefined;
    if (treeEdit.kind === "self") return familyData.selfPhoto;
    if (treeEdit.childIndex != null) return familyChildren[treeEdit.childIndex]?.photo;
    if (treeEdit.memberIndex != null) return familyData.members[treeEdit.memberIndex]?.photo;
    return treeEdit.photo;
  };

  const readPhotoFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = String(reader.result || "");
        const img = new Image();
        img.onload = () => {
          const max = 360;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(raw);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = () => resolve(raw);
        img.src = raw;
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const applyTreePhoto = async (file: File | null) => {
    if (!file || !treeEdit) return;
    try {
      const photo = await readPhotoFile(file);
      if (treeEdit.kind === "self") {
        setFamilyData((cur) => ({ ...cur, selfPhoto: photo }));
      } else if (treeEdit.childIndex != null) {
        const idx = treeEdit.childIndex;
        setFamilyData((cur) => ({
          ...cur,
          children: cur.children.map((c, i) => (i === idx ? { ...c, photo } : c)),
        }));
      } else if (treeEdit.memberIndex != null) {
        const idx = treeEdit.memberIndex;
        setFamilyData((cur) => ({
          ...cur,
          members: cur.members.map((m, i) => (i === idx ? { ...m, photo } : m)),
        }));
      }
      setTreeEdit((n) => (n ? { ...n, photo } : n));
    } catch {
      /* ignore */
    }
  };

  const saveTreeEdit = () => {
    if (!treeEdit) return;
    const name = treeEditName.trim();
    if (!name) return;
    let nextFamily = familyData;
    if (treeEdit.kind === "self") {
      onProfileUpdate({ ...profile, name });
      syncProfileInBackground({ ...profile, name, consentMarketing: profile.consentMarketing });
    } else if (treeEdit.childIndex != null) {
      const idx = treeEdit.childIndex;
      const birthDate = treeEditBirthDate || familyChildren[idx]?.birthDate;
      if (!birthDate) return;
      nextFamily = {
        ...familyData,
        children: familyData.children.map((c, i) => (i === idx ? { ...c, name, birthDate } : c)),
      };
      setFamilyData(nextFamily);
    } else if (treeEdit.memberIndex != null) {
      const idx = treeEdit.memberIndex;
      const relationship = treeEditRole.trim() || "Family";
      nextFamily = {
        ...familyData,
        members: familyData.members.map((m, j) =>
          j === idx
            ? {
                ...m,
                name,
                relationship,
                relatedTo: treeEditRelatedTo || RELATED_TO_SELF,
                ...(treeEditBirthDate.trim() ? { birthDate: treeEditBirthDate.trim() } : {}),
                ...(treeEditNote.trim() ? { note: treeEditNote.trim() } : {}),
              }
            : m,
        ),
      };
      setFamilyData(nextFamily);
    }
    setTreeEdit(null);
  };

  const deleteChild = (index: number) => {
    const removed = familyChildren[index];
    if (!removed) return;
    const updatedChildren = familyChildren.filter((_, j) => j !== index);
    setFamilyData((prev) => ({ ...prev, children: updatedChildren }));
    const updatedProfile: Profile = {
      ...profile,
      children: updatedChildren,
      childName: updatedChildren[0]?.name || "",
      childBirthDate: updatedChildren[0]?.birthDate || "",
      childAge: updatedChildren[0] ? formatChildAge(updatedChildren[0].birthDate, lang) : "",
    };
    onProfileUpdate(updatedProfile);
    void syncProfileInBackground({ ...updatedProfile, consentMarketing: profile.consentMarketing });
    showUndoToast(
      t("deleted_named", lang).replace("{name}", removed.name),
      () => {
        const restored = [...updatedChildren];
        restored.splice(Math.min(index, restored.length), 0, removed);
        setFamilyData((prev) => ({ ...prev, children: restored }));
        const restoredProfile: Profile = {
          ...profile,
          children: restored,
          childName: restored[0]?.name || profile.childName,
          childBirthDate: restored[0]?.birthDate || profile.childBirthDate,
          childAge: restored[0] ? formatChildAge(restored[0].birthDate, lang) : profile.childAge,
        };
        onProfileUpdate(restoredProfile);
        syncProfileInBackground({ ...restoredProfile, consentMarketing: profile.consentMarketing });
      },
    );
  };

  const requestDeleteChild = (index: number) => {
    if (!familyChildren[index]) return;
    setChildDeleteConfirm(index);
  };

  const confirmDeleteChild = () => {
    if (childDeleteConfirm == null) return;
    const index = childDeleteConfirm;
    setChildDeleteConfirm(null);
    setTreeEdit(null);
    deleteChild(index);
  };

  const requestLogout = () => {
    setShowAccountMenu(false);
    setShowLogoutConfirm(true);
  };

  const openAccountPrivacy = () => {
    setShowProfileSettings(false);
    setShowAccountMenu(false);
    setShowAccountPrivacy(true);
  };

  const updateMarketingConsent = async (next: boolean): Promise<boolean> => {
    const updated: Profile = {
      ...profile,
      consentMarketing: next,
      consentDate: next ? new Date().toISOString() : profile.consentDate,
    };
    const ok = await syncProfileSafe(updated);
    if (ok) {
      onProfileUpdate(updated);
      localStorage.setItem(sk(token, "profile"), JSON.stringify(updated));
    }
    return ok;
  };

  const handleAccountDeleted = () => {
    setShowAccountPrivacy(false);
    onLogout();
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  const buildShoppingList = () => {
    return `🛍️ Shopping:\n${shopItems.map(i=>`• ${i}`).join("\n")}\n\n🛒 Supermarket:\n${superItems.map(i=>`• ${i}`).join("\n")}`;
  };

  const dir=L.d as "ltr"|"rtl";
  const card:React.CSSProperties={background:"#fff",borderRadius:14,padding:16,marginBottom:12,border:".5px solid rgba(43,58,103,.08)",maxWidth:"100%",boxSizing:"border-box"};
  const tabs: { id: AppNavTabId; label: string }[] = [
    { id: "profile", label: t("profile_tab", lang) },
    { id: "family", label: t("family", lang) },
    { id: "chat", label: t("heymaa_tab", lang) },
    { id: "memories", label: t("memories", lang) },
    { id: "milestones", label: t("milestones", lang) },
  ];

  const profilePlanLabel = useMemo(() => {
    const slot = displaySelectedPlanSlot(subSnapshot)
    if (slot === "trial") return lang === "el" ? "Δωρεάν" : "Free"
    if (slot === "starter") return "Starter"
    if (slot === "premium") return "Premium"
    if (slot === "annual") return lang === "el" ? "Ετήσιο Premium" : "Annual Premium"
    return lang === "el" ? "Δωρεάν" : "Free"
  }, [subSnapshot, lang]);

  const appNotifications = useMemo(
    () => buildAppNotifications(lang, trialEndsAt, subSnapshot),
    [lang, trialEndsAt, subSnapshot],
  );
  const notifUnreadCount = appNotifications.filter((n) => !notifReadIds.has(n.id)).length;
  const refreshNotifRead = useCallback(() => {
    setNotifReadIds(readNotificationIds(token));
  }, [token]);

  useEffect(() => {
    refreshNotifRead();
  }, [subSnapshot, refreshNotifRead]);

  const appBodyRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const { tabBarVisible, showTabBar } = useAutoHideTabBar(appBodyRef);

  const goToTourStep = useCallback((idx: number) => {
    const s = APP_TOUR_STEPS[idx];
    if (s?.tab) {
      showTabBar();
      setTab(s.tab);
    }
    setTourStep(idx);
  }, [showTabBar]);

  const startAppTour = useCallback((fromStep = 0) => {
    setShowProfileSettings(false);
    setShowAccountMenu(false);
    setShowNotifications(false);
    setTourOpen(true);
    goToTourStep(fromStep);
  }, [goToTourStep]);

  useEffect(() => {
    if (hasCompletedAppTour(token)) return;
    const t = window.setTimeout(() => startAppTour(0), 700);
    return () => window.clearTimeout(t);
  }, [token, startAppTour]);

  useEffect(() => {
    if (!tourOpen) return;
    setShowAccountMenu(false);
    setShowNotifications(false);
  }, [tourOpen]);

  const handleTourNext = useCallback(() => {
    if (tourStep >= APP_TOUR_STEPS.length - 1) {
      markAppTourCompleted(token);
      setTourOpen(false);
      return;
    }
    goToTourStep(tourStep + 1);
  }, [goToTourStep, token, tourStep]);

  const handleTourBack = useCallback(() => {
    if (tourStep <= 0) return;
    goToTourStep(tourStep - 1);
  }, [goToTourStep, tourStep]);

  const handleTourSkip = useCallback(() => {
    markAppTourCompleted(token);
    setTourOpen(false);
  }, [token]);

  useEffect(() => {
    showTabBar();
    const body = appBodyRef.current;
    if (body) body.scrollTop = 0;
  }, [tab, showTabBar]);

  useEffect(() => {
    const el = tabBarRef.current;
    if (!el) return;
    const syncInset = () => {
      document.documentElement.style.setProperty("--hm-tabbar-inset", `${el.offsetHeight}px`);
    };
    syncInset();
    const ro = new ResizeObserver(syncInset);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <>
    <div
      dir={dir}
      className={`hm-app-shell${tabBarVisible ? "" : " hm-tabbar-hidden"}${tab === "chat" ? " hm-tab-chat" : ""}`}
    >

      {/* PROFILE SETTINGS MENU */}
      <AppDialog
        open={showProfileSettings}
        onClose={() => setShowProfileSettings(false)}
        size="sm"
        ariaLabel={lang === "el" ? "Ρυθμίσεις" : "Settings"}
      >
        <DialogPanel variant="white" padding="md">
          <SheetHeader
            title={lang === "el" ? "Ρυθμίσεις" : "Settings"}
            onBack={() => setShowProfileSettings(false)}
            backLabel={lang === "el" ? "Πίσω" : "Back"}
            compact
          />
          <div className="hm-settings-list">
            {[
              {
                key: "edit",
                icon: "✏️",
                title: lang==="el"?"Επεξεργασία προφίλ":"Edit profile",
                subtitle: lang==="el"?"Όνομα, email, κωδικός":"Name, email, password",
                onClick: () => {
                  setShowProfileSettings(false);
                  openProfileEditForm();
                },
              },
              {
                key: "privacy",
                icon: "🔐",
                title: lang==="el"?"Απόρρητο & δεδομένα":"Privacy & data",
                subtitle: lang==="el"?"Marketing, εξαγωγή, διαγραφή":"Marketing, export, delete",
                onClick: openAccountPrivacy,
              },
              {
                key: "lang",
                icon: "🌐",
                title: lang==="el"?"Γλώσσα":"Language",
                subtitle: L.n,
                onClick: () => {
                  setShowProfileSettings(false);
                  setShowLang(true);
                },
              },
              {
                key: "sub",
                icon: "💳",
                title: lang==="el"?"Συνδρομή":"Subscription",
                subtitle: lang==="el"?"Πλάνα, πληρωμές, ανανέωση":"Plans, billing, renew",
                onClick: () => {
                  setShowProfileSettings(false);
                  openSubscriptionUpgrade();
                },
              },
              {
                key: "help",
                icon: "💬",
                title: lang==="el"?"Βοήθεια & υποστήριξη":"Help & support",
                subtitle: lang==="el"?"Συχνές ερωτήσεις, επικοινωνία":"FAQ, contact",
                onClick: () => {
                  setShowProfileSettings(false);
                  setOpenHelpFaq({ 0: true });
                  setHelpMessage("");
                  setShowHelpSupport(true);
                },
              },
              {
                key: "tour",
                icon: "🧭",
                title: lang==="el"?"Ξενάγηση εφαρμογής":"App tour",
                subtitle: lang==="el"?"Δες τις κύριες λειτουργίες":"See how the app works",
                onClick: () => startAppTour(0),
              },
            ].map(item => (
              <button key={item.key} type="button" className="hm-settings-tile" onClick={item.onClick}>
                <span className="hm-settings-tile__icon" aria-hidden="true">{item.icon}</span>
                <span className="hm-settings-tile__body">
                  <span className="hm-settings-tile__title">{item.title}</span>
                  <span className="hm-settings-tile__subtitle">{item.subtitle}</span>
                </span>
                <span className="hm-settings-tile__chevron" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
          <div className="hm-dialog-footer-links">
            <Link to={PRIVACY_URL} onClick={() => setShowProfileSettings(false)} className="hm-link-muted">
              🔒 {lang === "el" ? "Πολιτική Απορρήτου" : "Privacy Policy"}
            </Link>
            <Link to={TERMS_URL} onClick={() => setShowProfileSettings(false)} className="hm-link-muted">
              📄 {lang === "el" ? "Όροι Χρήσης" : "Terms of Use"}
            </Link>
          </div>
        </DialogPanel>
      </AppDialog>

      {showAccountPrivacy && (
        <AccountPrivacySheet
          open={showAccountPrivacy}
          lang={lang}
          token={token}
          consentMarketing={!!profile.consentMarketing}
          onConsentChange={updateMarketingConsent}
          onAccountDeleted={handleAccountDeleted}
          onClose={() => setShowAccountPrivacy(false)}
          onToast={showToast}
        />
      )}

      {/* HELP & SUPPORT POPUP */}
      <AppDialog
        open={showHelpSupport}
        onClose={() => setShowHelpSupport(false)}
        size="md"
        ariaLabel={lang === "el" ? "Βοήθεια & υποστήριξη" : "Help & support"}
      >
        <DialogPanel variant="cream" padding="md">
          <SheetHeader
            title={lang === "el" ? "Βοήθεια & υποστήριξη" : "Help & support"}
            subtitle={lang === "el" ? "Είμαστε εδώ για σένα" : "We're here for you"}
            onBack={() => setShowHelpSupport(false)}
            backLabel={lang === "el" ? "Πίσω" : "Back"}
          />

            <div className="hm-section-label">
              {displayUppercase(tHome("faq.label", { lng: homeLng }) || (lang==="el"?"Συχνές ερωτήσεις":"FAQ"), lang)}
            </div>
            <div className="hm-faq-list">
              {helpFaqItems.map((item, i) => {
                const open = !!openHelpFaq[i];
                return (
                  <div key={item.question} className="hm-faq-item">
                    <button
                      type="button"
                      className="hm-faq-trigger"
                      onClick={()=>setOpenHelpFaq(prev=>({...prev,[i]:!open}))}
                    >
                      <span className="hm-faq-trigger__q">{item.question}</span>
                      <span className={`hm-faq-trigger__chevron${open ? " hm-faq-trigger__chevron--open" : ""}`} aria-hidden="true">›</span>
                    </button>
                    {open ? (
                      <div className="hm-faq-answer">{item.answer}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="hm-section-label">
              {displayUppercase(lang==="el"?"Στείλε μας μήνυμα":"Send us a message", lang)}
            </div>
            <textarea
              className="hm-textarea hm-input--flush"
              value={helpMessage}
              onChange={e=>setHelpMessage(e.target.value)}
              placeholder={lang==="el"?"Γράψε την ερώτησή σου εδώ...":"Write your question here..."}
              rows={4}
              style={{ marginBottom: 10, resize: "vertical" }}
            />
            <button
              type="button"
              className="hm-btn hm-btn--primary hm-btn--block hm-btn--lg"
              style={{ marginBottom: 14 }}
              onClick={()=>{
                const body = helpMessage.trim();
                if (!body) {
                  showToast(lang==="el"?"Γράψε πρώτα το μήνυμά σου.":"Write your message first.", "err");
                  return;
                }
                window.open(`mailto:${helpEmail}?subject=${encodeURIComponent("HeyMaa Support")}&body=${encodeURIComponent(body)}`);
              }}
            >
              {lang==="el"?"Αποστολή μηνύματος":"Send message"}
            </button>

            <div className="hm-contact-card">
              <div className="hm-section-label">
                {displayUppercase(lang==="el"?"Επικοινωνία":"Contact", lang)}
              </div>
              <a
                href={`mailto:${helpEmail}?subject=${encodeURIComponent("HeyMaa Support")}`}
                className="hm-contact-row"
                style={{ color: "var(--hm-navy)", marginBottom: 10 }}
              >
                <span className="hm-contact-icon hm-contact-icon--warm" aria-hidden="true">✉️</span>
                <span>
                  <span style={{display:"block",fontSize:13,fontWeight:700}}>Email</span>
                  <span style={{display:"block",fontSize:12,color:"var(--hm-muted)",marginTop:2}}>{helpEmail}</span>
                </span>
              </a>
              <a
                href={`tel:${helpPhoneTel}`}
                className="hm-contact-row"
                style={{ color: "var(--hm-navy)", marginBottom: helpAddress ? 10 : 0 }}
              >
                <span className="hm-contact-icon hm-contact-icon--teal" aria-hidden="true">📞</span>
                <span>
                  <span style={{display:"block",fontSize:13,fontWeight:700}}>{lang==="el"?"Τηλέφωνο":"Phone"}</span>
                  <span style={{display:"block",fontSize:12,color:"var(--hm-muted)",marginTop:2}}>{helpPhone}</span>
                </span>
              </a>
              {helpAddress ? (
                <div className="hm-contact-row" style={{ color: "rgba(43,58,103,.7)" }}>
                  <span className="hm-contact-icon hm-contact-icon--muted" aria-hidden="true">📍</span>
                  <span style={{fontSize:12,lineHeight:1.45,paddingTop:6}}>{helpAddress}</span>
                </div>
              ) : null}
            </div>
        </DialogPanel>
      </AppDialog>

      {/* PROFILE EDIT — popup screen */}
      <AppDialog
        open={showProfileEdit}
        onClose={() => setShowProfileEdit(false)}
        size="md"
        ariaLabel={lang === "el" ? "Επεξεργασία προφίλ" : "Edit profile"}
        closeOnBackdrop={!editSaving}
      >
        <DialogPanel variant="cream" padding="lg">
            <input
              ref={profilePhotoRef}
              type="file"
              accept="image/*"
              style={{display:"none"}}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  const photo = await readPhotoFile(f);
                  setEditPhoto(photo);
                } catch { /* ignore */ }
              }}
            />
            <SheetHeader
              title={lang==="el"?"Επεξεργασία προφίλ":"Edit profile"}
              subtitle={lang==="el"?"Ενημέρωσε τα στοιχεία σου":"Update your details"}
              onBack={()=>setShowProfileEdit(false)}
              backLabel={lang==="el"?"Πίσω":"Back"}
            />

            <div style={{display:"flex",justifyContent:"center",marginBottom:22}}>
              <div style={{position:"relative",width:108,height:108}}>
                <div style={{
                  width:108,height:108,borderRadius:"50%",overflow:"hidden",background:"#fff",
                  boxShadow:"0 8px 24px rgba(43,58,103,0.08)",display:"flex",alignItems:"center",justifyContent:"center",
                }}>
                  {editPhoto ? (
                    <img src={editPhoto} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} />
                  ) : (
                    <div style={{
                      width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",
                      background:"var(--hm-logo-purple)",color:"var(--hm-navy)",fontSize:36,fontWeight:700,
                    }}>{displayInitial}</div>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={lang==="el"?"Αλλαγή φωτογραφίας":"Change photo"}
                  onClick={()=>profilePhotoRef.current?.click()}
                  style={{
                    position:"absolute",right:2,bottom:2,width:34,height:34,borderRadius:"50%",
                    border:"2px solid #fff",background:"var(--hm-navy)",color:"#fff",cursor:"pointer",
                    display:"flex",alignItems:"center",justifyContent:"center",padding:0,
                    boxShadow:"0 2px 8px rgba(43,58,103,.25)",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 20h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>

            {([
              {
                key: "name",
                label: lang==="el"?"Όνομα":"Name",
                node: (
                  <input
                    className="hm-input hm-input--flush"
                    value={editName}
                    onChange={e=>setEditName(e.target.value)}
                    placeholder={lang==="el"?"Το όνομά σου":"Your name"}
                  />
                ),
              },
              {
                key: "email",
                label: "Email",
                node: (
                  <input
                    className="hm-input hm-input--flush hm-input--readonly"
                    value={accountEmail}
                    readOnly
                    placeholder="email@example.com"
                  />
                ),
              },
              {
                key: "current_pw",
                label: lang==="el"?"Τρέχων κωδικός":"Current password",
                hint: lang==="el"?"Απαιτείται μόνο αν αλλάζεις κωδικό":"Required only when changing password",
                node: (
                  <input
                    className="hm-input hm-input--flush"
                    type="password"
                    value={editCurrentPassword}
                    onChange={e=>setEditCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                ),
              },
              {
                key: "new_pw",
                label: lang==="el"?"Νέος κωδικός":"New password",
                hint: lang==="el"?"Άφησέ το κενό αν δεν θέλεις να αλλάξεις κωδικό":"Leave blank if you don't want to change password",
                node: (
                  <input
                    className="hm-input hm-input--flush"
                    type="password"
                    value={editNewPassword}
                    onChange={e=>setEditNewPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                ),
              },
              {
                key: "confirm_pw",
                label: lang==="el"?"Επιβεβαίωση κωδικού":"Confirm password",
                node: (
                  <input
                    className="hm-input hm-input--flush"
                    type="password"
                    value={editConfirmPassword}
                    onChange={e=>setEditConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                ),
              },
            ] as {key:string;label:string;hint?:string;node:React.ReactNode}[]).map(field => (
              <div key={field.key} className="hm-form-field">
                <label className="hm-section-label" style={{ marginBottom: 8 }}>
                  {displayUppercase(field.label, lang)}
                </label>
                {field.node}
                {field.hint ? (
                  <div className="hm-form-field__hint">{field.hint}</div>
                ) : null}
              </div>
            ))}

            <button
              type="button"
              className="hm-btn hm-btn--primary hm-btn--block hm-btn--lg"
              onClick={saveProfileEdit}
              disabled={editSaving}
              style={{ marginTop: 4, opacity: editSaving ? 0.6 : 1 }}
            >
              {editSaving ? t("saving", lang) : t("save_ok", lang)}
            </button>
        </DialogPanel>
      </AppDialog>

      {/* ADD CHILD — in-app screen */}
      {showAddChild&&(
        <div className="hm-sheet-overlay">
          <div className="hm-sheet-panel" style={{background:cream}}>
            <div style={{flex:1,overflowY:"auto",padding:"16px 20px 12px",boxSizing:"border-box"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:22}}>
                <button
                  type="button"
                  aria-label={lang==="el"?"Πίσω":"Back"}
                  onClick={()=>{
                    setShowAddChild(false);
                    setNewChildName("");
                    setNewChildBirthDate("");
                    setNewChildGender("");
                    setNewChildDateMode("birth");
                  }}
                  style={{
                    width:36,height:36,borderRadius:"50%",border:"1px solid rgba(43,58,103,.12)",
                    background:"#fff",color:navy,cursor:"pointer",display:"flex",alignItems:"center",
                    justifyContent:"center",flexShrink:0,padding:0,marginTop:2,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div style={{minWidth:0,flex:1}}>
                  <h1 style={{margin:0,fontSize:26,fontWeight:700,color:navy,letterSpacing:-0.4,lineHeight:1.15}}>
                    {lang==="el"?"Πρόσθεσε παιδί":"Add a child"}
                  </h1>
                  <p style={{margin:"8px 0 0",fontSize:14,color:"rgba(43,58,103,.55)",lineHeight:1.4}}>
                    {lang==="el"?"Συμπλήρωσε τα βασικά στοιχεία":"Fill in the basic details"}
                  </p>
                </div>
              </div>

              {/* 1. Name */}
              <div style={{marginBottom:22}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <span style={{
                    width:22,height:22,borderRadius:"50%",background:navy,color:"#fff",
                    display:"inline-flex",alignItems:"center",justifyContent:"center",
                    fontSize:12,fontWeight:700,flexShrink:0,
                  }}>1</span>
                  <span style={{fontSize:12,fontWeight:700,color:navy,letterSpacing:0.6}}>
                    {displayUppercase(lang==="el"?"Όνομα / χαϊδευτικό μωρού":"Name / baby nickname", lang)}
                  </span>
                </div>
                <input
                  value={newChildName}
                  onChange={e=>setNewChildName(e.target.value)}
                  placeholder={lang==="el"?"π.χ. Μάνος":"e.g. Manos"}
                  style={{
                    width:"100%",padding:"14px 16px",border:"1.5px solid rgba(43,58,103,.12)",
                    borderRadius:14,background:"#fff",fontFamily:"'DM Sans',sans-serif",fontSize:15,
                    outline:"none",boxSizing:"border-box" as any,color:navy,
                  }}
                />
              </div>

              {/* 2. Birth / due date */}
              <div style={{marginBottom:22}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <span style={{
                    width:22,height:22,borderRadius:"50%",background:navy,color:"#fff",
                    display:"inline-flex",alignItems:"center",justifyContent:"center",
                    fontSize:12,fontWeight:700,flexShrink:0,
                  }}>2</span>
                  <span style={{fontSize:12,fontWeight:700,color:navy,letterSpacing:0.6}}>
                    {displayUppercase(
                      newChildDateMode==="due"
                        ? (lang==="el"?"Ημερομηνία τοκετού":"Due date")
                        : (lang==="el"?"Ημερομηνία γέννησης":"Date of birth"),
                      lang,
                    )}
                  </span>
                </div>
                <div style={{
                  display:"flex",background:"rgba(43,58,103,.06)",borderRadius:12,padding:3,marginBottom:10,gap:2,
                }}>
                  {([
                    { id: "birth" as const, label: lang==="el"?"Επιλογή ημερομηνίας":"Select date" },
                    { id: "due" as const, label: lang==="el"?"Ημ. Τοκετού":"Due date" },
                  ]).map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={()=>setNewChildDateMode(opt.id)}
                      style={{
                        flex:1,padding:"10px 8px",border:"none",borderRadius:10,cursor:"pointer",
                        fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,
                        background: newChildDateMode===opt.id ? "#fff" : "transparent",
                        color: newChildDateMode===opt.id ? navy : "rgba(43,58,103,.5)",
                        boxShadow: newChildDateMode===opt.id ? "0 1px 4px rgba(43,58,103,.08)" : "none",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <label
                  htmlFor="hm-add-child-birth-date"
                  onClick={(e) => {
                    e.preventDefault();
                    openNativeDatePicker(childBirthDateRef.current);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openNativeDatePicker(childBirthDateRef.current);
                    }
                  }}
                  style={{
                    position:"relative",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,
                    width:"100%",padding:"14px 16px",borderRadius:14,background:"#F2E6DC",
                    boxSizing:"border-box" as any,cursor:"pointer",overflow:"hidden",
                  }}
                >
                  <span style={{
                    fontSize:15,color: newChildBirthDate ? navy : "rgba(43,58,103,.4)",
                    fontFamily:"'DM Sans',sans-serif",letterSpacing:0.5,pointerEvents:"none",
                  }}>
                    {newChildBirthDate
                      ? (() => {
                          const [y, m, d] = newChildBirthDate.split("-");
                          return y && m && d ? `${d} / ${m} / ${y}` : newChildBirthDate;
                        })()
                      : "dd / mm / yyyy"}
                  </span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{flexShrink:0,opacity:0.55,pointerEvents:"none"}}>
                    <rect x="3" y="5" width="18" height="16" rx="2" stroke={navy} strokeWidth="1.6"/>
                    <path d="M3 9h18M8 3v4M16 3v4" stroke={navy} strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                  <input
                    id="hm-add-child-birth-date"
                    ref={childBirthDateRef}
                    type="date"
                    value={newChildBirthDate}
                    onChange={e=>setNewChildBirthDate(e.target.value)}
                    aria-label={
                      newChildDateMode === "due"
                        ? (lang === "el" ? "Ημερομηνία τοκετού" : "Due date")
                        : (lang === "el" ? "Ημερομηνία γέννησης" : "Date of birth")
                    }
                    style={{
                      position:"absolute",inset:0,opacity:0,width:"100%",height:"100%",cursor:"pointer",
                      fontSize:16,zIndex:2,margin:0,padding:0,border:"none",background:"transparent",
                      pointerEvents:"none",
                    }}
                    tabIndex={-1}
                  />
                </label>
              </div>

              {/* 3. Gender */}
              <div style={{marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <span style={{
                    width:22,height:22,borderRadius:"50%",background:navy,color:"#fff",
                    display:"inline-flex",alignItems:"center",justifyContent:"center",
                    fontSize:12,fontWeight:700,flexShrink:0,
                  }}>3</span>
                  <span style={{fontSize:12,fontWeight:700,color:navy,letterSpacing:0.6}}>
                    {displayUppercase(lang==="el"?"Φύλο":"Gender", lang)}
                  </span>
                </div>
                <div style={{display:"flex",gap:10}}>
                  {([
                    {
                      id: "girl" as const,
                      label: lang==="el"?"Κορίτσι":"Girl",
                      accent: "#E8A0B8",
                      icon: (
                        <svg width="36" height="36" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                          <circle cx="24" cy="14" r="7" fill="#F5C6D4"/>
                          <path d="M12 42c0-8 5.5-14 12-14s12 6 12 14" fill="#F5C6D4"/>
                          <path d="M18 28h12l2 14H16l2-14z" fill="#E891A8"/>
                        </svg>
                      ),
                    },
                    {
                      id: "boy" as const,
                      label: lang==="el"?"Αγόρι":"Boy",
                      accent: "#7EB8E8",
                      icon: (
                        <svg width="36" height="36" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                          <circle cx="24" cy="14" r="7" fill="#A8D0F0"/>
                          <path d="M14 28h20v6c0 4-4 8-10 8s-10-4-10-8v-6z" fill="#7EB8E8"/>
                          <rect x="16" y="34" width="6" height="10" rx="1" fill="#5A9FD4"/>
                          <rect x="26" y="34" width="6" height="10" rx="1" fill="#5A9FD4"/>
                        </svg>
                      ),
                    },
                    {
                      id: "surprise" as const,
                      label: lang==="el"?"Έκπληξη":"Surprise",
                      accent: "#C4A0E8",
                      icon: (
                        <svg width="36" height="36" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                          <rect x="10" y="20" width="28" height="20" rx="3" fill="#C4A0E8"/>
                          <path d="M10 28h28" stroke="#fff" strokeWidth="3"/>
                          <path d="M24 20v20" stroke="#fff" strokeWidth="3"/>
                          <path d="M18 20c0-4 3-7 6-7s4 2 4 4c0 3-4 5-4 5" stroke="#B07AD9" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
                          <path d="M30 20c0-4-3-7-6-7s-4 2-4 4" stroke="#B07AD9" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
                        </svg>
                      ),
                    },
                  ]).map(g => {
                    const selected = newChildGender === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={()=>setNewChildGender(g.id)}
                        style={{
                          flex:1,padding:"14px 8px 12px",borderRadius:14,cursor:"pointer",
                          background:"#fff",
                          border: selected ? `2px solid ${g.accent}` : "1.5px solid rgba(43,58,103,.1)",
                          boxShadow: selected ? `0 0 0 3px ${g.accent}33` : "0 1px 4px rgba(43,58,103,.04)",
                          display:"flex",flexDirection:"column",alignItems:"center",gap:8,
                          fontFamily:"'DM Sans',sans-serif",
                        }}
                      >
                        {g.icon}
                        <span style={{fontSize:13,fontWeight:600,color:navy}}>{g.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{flexShrink:0,padding:"12px 20px 20px",background:cream}}>
              <button
                type="button"
                onClick={addChild}
                disabled={!newChildName.trim()||!newChildBirthDate||!newChildGender}
                style={{
                  width:"100%",padding:16,background:
                    (!newChildName.trim()||!newChildBirthDate||!newChildGender) ? "rgba(43,58,103,.35)" : navy,
                  color:"#fff",border:"none",borderRadius:16,
                  fontFamily:"'DM Sans',sans-serif",fontSize:16,fontWeight:700,cursor:
                    (!newChildName.trim()||!newChildBirthDate||!newChildGender) ? "default" : "pointer",
                }}
              >
                {lang==="el"?"Αποθήκευση":"Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSubscriptionSheet && (
        <InAppSubscriptionSheet
          token={token}
          lang={lang}
          trialEndsAt={trialEndsAt}
          initialSnapshot={subSnapshot}
          onClose={() => setShowSubscriptionSheet(false)}
          onOpenHelp={() => {
            setShowSubscriptionSheet(false);
            setOpenHelpFaq({ 0: true });
            setHelpMessage("");
            setShowHelpSupport(true);
          }}
        />
      )}

      <LevelUpRewardSheet
        open={showLevelRewardSheet}
        lang={lang}
        token={token}
        reward={pendingLevelReward}
        onClose={() => {
          if (pendingLevelReward) dismissRewardLevel(token, pendingLevelReward.level_id);
          setShowLevelRewardSheet(false);
        }}
        onClaimed={handleLevelRewardClaimed}
      />

      <AccessExpiryModal
        open={showAccessExpiryModal}
        lang={lang}
        info={accessExpiryInfo}
        onClose={() => {
          if (accessExpiryInfo) dismissExpiryPopup(accessExpiryInfo.accessEndsAt);
          setShowAccessExpiryModal(false);
        }}
        onRenew={openSubscriptionUpgrade}
      />

      <AppDialog
        open={!!treeEdit}
        onClose={() => setTreeEdit(null)}
        size="lg"
        align="bottom"
        ariaLabel={lang === "el" ? "Επεξεργασία" : "Edit"}
      >
          <div className="hm-tree-edit-panel">
            <h2 className="hm-dialog-title" style={{ fontSize: 16, marginBottom: 12 }}>
              {lang==="el"?"Επεξεργασία":"Edit"} · {treeEdit?.name}
            </h2>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
              <button
                type="button"
                onClick={()=>treePhotoRef.current?.click()}
                style={{width:72,height:72,borderRadius:"50%",border:`2px dashed ${logoPurple}`,background:gl,overflow:"hidden",padding:0,cursor:"pointer",flexShrink:0}}
                title={lang==="el"?"Ανέβασε φωτογραφία":"Upload photo"}
              >
                {currentTreeEditPhoto() ? (
                  <img src={currentTreeEditPhoto()} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} />
                ) : (
                  <span style={{fontSize:11,color:navy,fontWeight:700}}>{lang==="el"?"Φωτο":"Photo"}</span>
                )}
              </button>
              <div style={{flex:1,fontSize:12,color:"rgba(43,58,103,.55)",lineHeight:1.45}}>
                {lang==="el"
                  ? "Πάτα τον κύκλο για να προσθέσεις ή αλλάξεις φωτογραφία στο δέντρο."
                  : "Tap the circle to add or change their photo on the tree."}
              </div>
            </div>
            <input
              ref={treePhotoRef}
              type="file"
              accept="image/*"
              style={{display:"none"}}
              onChange={(e)=>{ void applyTreePhoto(e.target.files?.[0] || null); e.target.value=""; }}
            />
            <input
              className="hm-input hm-input--compact"
              value={treeEditName}
              onChange={(e)=>setTreeEditName(e.target.value)}
              placeholder={lang==="el"?"Όνομα":"Name"}
              style={{ marginBottom: 8 }}
            />
            {treeEdit && treeEdit.memberIndex != null && (
              <>
                <div className="hm-section-label" style={{ fontSize: 11, marginBottom: 4 }}>
                  {lang==="el"?"Ρόλος / μετακίνηση στο δέντρο":"Role / move on tree"}
                </div>
                <select
                  className="hm-select hm-input--compact"
                  value={RELATIONSHIP_PRESETS.some(p=>p.value===treeEditRole)?treeEditRole:"Family"}
                  onChange={(e)=>{
                    const role = e.target.value;
                    setTreeEditRole(role);
                    const nextRelated = defaultRelatedToForRelationship(role, familyData.members, treeEditRelatedTo);
                    setTreeEditRelatedTo(nextRelated);
                    if (treeEdit.memberIndex != null) {
                      changeMemberRelationship(treeEdit.memberIndex, role);
                    }
                  }}
                  style={{ marginBottom: 8 }}
                >
                  {RELATIONSHIP_PRESETS.map(p=>(
                    <option key={p.value} value={p.value}>{lang==="el"?p.el:p.en}</option>
                  ))}
                </select>
                <div className="hm-section-label" style={{ fontSize: 11, marginBottom: 4 }}>
                  {lang==="el"?"Συγγενής του / της":"Relative of"}
                </div>
                <select
                  className="hm-select hm-input--compact"
                  value={treeEditRelatedTo}
                  onChange={(e)=>{
                    const next = e.target.value;
                    setTreeEditRelatedTo(next);
                    if (treeEdit.memberIndex != null) {
                      changeMemberRelatedTo(treeEdit.memberIndex, next);
                    }
                  }}
                  style={{ marginBottom: 8 }}
                >
                  {relatedToOptions.filter(o=>o.value!==memberMemoryRef(familyData.members[treeEdit.memberIndex!]?.id || "")).map(o=>(
                    <option key={o.value} value={o.value}>{lang==="el"?`Συγγενής του/της: ${o.label}`:`Relative of: ${o.label}`}</option>
                  ))}
                </select>
                <input className="hm-input hm-input--compact" value={treeEditBirthDate} onChange={(e)=>setTreeEditBirthDate(e.target.value)} type="date" style={{ marginBottom: 8 }} />
                <input className="hm-input hm-input--compact" value={treeEditNote} onChange={(e)=>setTreeEditNote(e.target.value)} placeholder={lang==="el"?"Σημείωση":"Note"} style={{ marginBottom: 8 }} />
              </>
            )}
            {treeEdit && treeEdit.childIndex != null && (
              <input className="hm-input hm-input--compact" value={treeEditBirthDate} onChange={(e)=>setTreeEditBirthDate(e.target.value)} type="date" style={{ marginBottom: 8 }} />
            )}
            <div className="hm-btn-row" style={{ marginTop: 4, flexWrap: "wrap" }}>
              <button type="button" className="hm-btn hm-btn--primary" onClick={saveTreeEdit} style={{ minWidth: 90 }}>{t("save",lang)}</button>
              {(treeEdit?.ref || treeEdit?.kind === "self") && (
                <button
                  type="button"
                  className="hm-btn hm-btn--outline"
                  style={{ minWidth: 90 }}
                  onClick={()=>{
                    setActiveMemRef(treeEdit!.kind === "self" ? "__general__" : (treeEdit!.ref ?? null));
                    setTreeEdit(null);
                    setTab("memories");
                  }}
                >
                  📝 {t("recentmem",lang)}
                </button>
              )}
              {(treeEdit?.memberIndex != null || treeEdit?.childIndex != null) && (
                <button
                  type="button"
                  className="hm-btn hm-btn--destructive-outline"
                  style={{ minWidth: 90 }}
                  onClick={()=>{
                    if (treeEdit!.memberIndex != null) {
                      deleteFamilyMember(treeEdit!.memberIndex);
                      setTreeEdit(null);
                    } else if (treeEdit!.childIndex != null) {
                      requestDeleteChild(treeEdit!.childIndex);
                    }
                  }}
                >
                  🗑 {t("delete_memory",lang)}
                </button>
              )}
              <button type="button" className="hm-btn hm-btn--secondary" onClick={()=>setTreeEdit(null)}>{t("cancel",lang)}</button>
            </div>
          </div>
      </AppDialog>

      {childDeleteConfirm != null && familyChildren[childDeleteConfirm] && (
        <ConfirmDialog
          open
          title={lang === "el" ? "Διαγραφή παιδιού" : "Delete child"}
          message={
            lang === "el"
              ? `Είσαι σίγουρη/ος ότι θέλεις να διαγράψεις τον/την ${familyChildren[childDeleteConfirm].name};`
              : `Are you sure you want to delete ${familyChildren[childDeleteConfirm].name}?`
          }
          confirmLabel={t("delete_memory", lang)}
          cancelLabel={t("cancel", lang)}
          variant="danger"
          onConfirm={confirmDeleteChild}
          onCancel={() => setChildDeleteConfirm(null)}
        />
      )}

      {showLogoutConfirm && (
        <ConfirmDialog
          open
          title={lang === "el" ? "Αποσύνδεση" : "Log out"}
          message={
            lang === "el"
              ? "Είσαι σίγουρη/ος ότι θέλεις να αποσυνδεθείς;"
              : "Are you sure you want to log out?"
          }
          confirmLabel={lang === "el" ? "Αποσύνδεση" : "Log out"}
          cancelLabel={t("cancel", lang)}
          variant="danger"
          onConfirm={confirmLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}

      {/* ADDRESS MODAL */}
      <AppDialog
        open={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        size="sm"
        ariaLabel={t("delivery_addr", lang)}
      >
        <DialogPanel variant="white" padding="md">
          <h2 className="hm-dialog-title" style={{ marginBottom: 6 }}>🏠 {t("delivery_addr", lang)}</h2>
          <p className="hm-dialog-subtitle" style={{ marginBottom: 16 }}>{t("delivery_hint", lang)}</p>
          <input className="hm-input" value={addrStreet} onChange={e=>setAddrStreet(e.target.value)} placeholder={t("street_ph",lang)} style={{ marginBottom: 10 }} />
          <div className="hm-input-row" style={{ marginBottom: 16 }}>
            <input className="hm-input hm-input--city" value={addrCity} onChange={e=>setAddrCity(e.target.value)} placeholder={t("city_ph",lang)} />
            <input className="hm-input" value={addrPostal} onChange={e=>setAddrPostal(e.target.value)} placeholder={t("post_ph",lang)} />
          </div>
          <button
            type="button"
            className="hm-btn hm-btn--primary hm-btn--block hm-btn--lg"
            onClick={saveAddress}
            disabled={!addrStreet.trim()||!addrCity.trim()}
            style={{ marginBottom: 10 }}
          >
            {t("save_continue", lang)}
          </button>
          <button type="button" className="hm-btn hm-btn--ghost hm-btn--block" onClick={skipAddress}>
            {t("skip_now", lang)}
          </button>
        </DialogPanel>
      </AppDialog>

      {/* NEW THREAD MODAL */}
      <AppDialog
        open={showNewThreadModal}
        onClose={() => setShowNewThreadModal(false)}
        size="sm"
        ariaLabel={t("newthread", lang)}
      >
        <DialogPanel variant="white" padding="md">
          <h2 className="hm-dialog-title" style={{ marginBottom: 6 }}>＋ {t("newthread", lang)}</h2>
          <p className="hm-dialog-subtitle" style={{ marginBottom: 16 }}>
            {lang === "el"
              ? "Θέλεις να αρχειοθετήσεις αυτή τη συνομιλία πριν ξεκινήσεις νέα;"
              : "Archive this conversation before starting a new one?"}
          </p>
          <div className="hm-btn-row">
            <button type="button" className="hm-btn hm-btn--primary" onClick={openArchiveForNew}>
              📁 {t("archivethread", lang)}
            </button>
            <button type="button" className="hm-btn hm-btn--secondary" onClick={discardCurrentThread}>
              {lang === "el" ? "Χωρίς αποθήκευση" : "Discard"}
            </button>
            <button type="button" className="hm-btn hm-btn--ghost" onClick={() => setShowNewThreadModal(false)}>
              {t("cancel", lang)}
            </button>
          </div>
        </DialogPanel>
      </AppDialog>

      {/* ARCHIVE MODAL */}
      <AppDialog
        open={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        size="sm"
        ariaLabel={t("nameyourthread", lang)}
      >
        <DialogPanel variant="white" padding="md">
          <h2 className="hm-dialog-title" style={{ marginBottom: 6 }}>📁 {t("nameyourthread", lang)}</h2>
          {archiveBlocked ? (
            <FeatureUpgradeGate
              lang={lang}
              featureLabel={featureLabel("archived_threads", lang)}
              requiredPlanLabel={featureRequiredPlanLabel("archived_threads", lang)}
              onUpgrade={() => {
                setShowArchiveModal(false);
                openSubscriptionUpgrade();
              }}
            />
          ) : (
            <>
          <p className="hm-dialog-subtitle" style={{ marginBottom: 16 }}>{t("archive_hint", lang)}</p>
          <input
            className="hm-input"
            value={archiveTitle}
            onChange={e=>setArchiveTitle(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&doArchive()}
            placeholder={messages[0]?.content.slice(0,40)||"Τίτλος..."}
            style={{ marginBottom: 12 }}
            autoFocus
          />
          <div className="hm-btn-row">
            <button type="button" className="hm-btn hm-btn--primary" onClick={doArchive}>{t("archivethread", lang)} ✓</button>
            <button type="button" className="hm-btn hm-btn--secondary" onClick={()=>setShowArchiveModal(false)}>{t("cancel", lang)}</button>
          </div>
            </>
          )}
        </DialogPanel>
      </AppDialog>

      {/* PAST THREADS PANEL */}
      <AppDialog
        open={showThreads}
        onClose={() => setShowThreads(false)}
        size="md"
        align="bottom"
        ariaLabel={t("pastthreads", lang)}
        panelClassName="hm-dialog--threads"
      >
        <div className="hm-threads-sheet">
          <div className="hm-dialog-title" style={{ textAlign: "center", paddingBottom: 12, borderBottom: "1px solid var(--hm-surface-muted)", marginBottom: 8 }}>
            📁 {t("pastthreads", lang)}
          </div>
          {threads.length===0 && <div className="hm-empty-state">{t("no_archived", lang)}</div>}
          {threads.map(th=>(
            <div key={th.id} className="hm-thread-item">
              <button
                type="button"
                className="hm-thread-item__main"
                onClick={()=>{setMessages(th.messages);setShowThreads(false);}}
              >
                <div className="hm-thread-item__title">{th.title}</div>
                <div className="hm-thread-item__meta">
                  {th.date} · {th.messages.length} {lang === "el" ? "μηνύματα" : "messages"}
                </div>
              </button>
              <button
                type="button"
                className="hm-thread-item__delete"
                aria-label={lang === "el" ? "Διαγραφή" : "Delete"}
                onClick={() => deleteThread(th.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </AppDialog>
      {showLang && (
        <LanguageFlagOverlay
          open={showLang}
          title={`🌐 ${t("selectlang", lang)}`}
          currentLang={lang}
          onClose={() => setShowLang(false)}
          onSelect={(code) => {
            const nextLang = writeStoredAppLang(code);
            const u = { ...profile, lang: nextLang };
            localStorage.setItem(sk(token, "profile"), JSON.stringify(u));
            syncProfileInBackground(u);
            onProfileUpdate(u);
          }}
        />
      )}

      {/* FILE INPUT (memories) */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > MAX_CHAT_FILE_BYTES) {
            showToast(lang === "el" ? "Το αρχείο είναι πολύ μεγάλο (μέγ. 6MB)." : "File is too large (max 6MB).", "err");
            e.target.value = "";
            return;
          }
          const r = new FileReader();
          r.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            const isVideo = f.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(f.name);
            if (awaitingMemoryPhotoRef.current) {
              awaitingMemoryPhotoRef.current = false;
              if (!featureAllowed("full_memory", planEntitlements, subSnapshot)) {
                openSubscriptionUpgrade();
                e.target.value = "";
                return;
              }
              if (isVideo) {
                showToast(lang === "el" ? "Μόνο φωτογραφίες στο άλμπουμ." : "Photos only for memories.", "err");
                e.target.value = "";
                return;
              }
              void compressImageDataUrl(dataUrl).then((img) => setMemPendingPhoto(img));
              e.target.value = "";
              return;
            }
            e.target.value = "";
          };
          r.readAsDataURL(f);
        }}
      />

      {/* FILE INPUT (chat — documents only) */}
      <input
        ref={chatFileRef}
        type="file"
        accept=".pdf,.txt,.md,.markdown,text/plain,application/pdf,video/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          void handleChatFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* FILE INPUT (chat — camera on mobile) */}
      <input
        ref={chatCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => {
          void handleChatFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* FILE INPUT (chat — photo library on mobile) */}
      <input
        ref={chatGalleryRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          void handleChatFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {showAccountMenu&&<div className="hm-header-popover-backdrop" onClick={()=>setShowAccountMenu(false)} />}
      {showNotifications&&<div className="hm-header-popover-backdrop" onClick={()=>setShowNotifications(false)} />}
      {/* HEADER */}
      <div className="hm-app-header" style={{background:navy,padding:"14px 18px 12px",flexShrink:0,width:"100%",boxSizing:"border-box"}}>
        <div className="hm-app-bar-inner hm-app-header-inner">
        <div className="hm-header-brand">
          <img src={AUTH_LOGO_SRC} alt="HeyMaa" className="hm-header-logo" />
        </div>
        <div className="hm-header-actions">
          <div data-tour="header-notifications">
          <AppNotificationsBell
            lang={lang}
            token={token}
            trialEndsAt={trialEndsAt}
            subSnapshot={subSnapshot}
            open={showNotifications}
            onOpenChange={(next) => {
              setShowNotifications(next);
              if (next) setShowAccountMenu(false);
            }}
            onOpenSubscriptionSheet={openSubscriptionUpgrade}
            onReadChange={refreshNotifRead}
          />
          </div>
          <button
            type="button"
            className="hm-header-avatar hm-header-avatar-btn"
            aria-label={lang === "el" ? "Λογαριασμός" : "Account"}
            aria-expanded={showAccountMenu}
            aria-haspopup="menu"
            onClick={() => { setShowNotifications(false); setShowAccountMenu((v) => !v); }}
          >
            {displayInitial}
            {showAccountMenu && (
              <div className="hm-header-account-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setShowAccountMenu(false); setShowProfileSettings(true); setTab("profile"); }}
                >
                  ⚙️ {lang === "el" ? "Ρυθμίσεις" : "Settings"}
                </button>
                <div className="hm-header-account-menu__divider" role="separator" />
                <button type="button" role="menuitem" className="hm-menuitem--danger" onClick={requestLogout}>
                  🚪 {lang === "el" ? "Αποσύνδεση" : "Log out"}
                </button>
              </div>
            )}
          </button>
        </div>
        </div>
      </div>

      <AppTrialBanner
        lang={lang}
        trialEndsAt={trialEndsAt}
        subSnapshot={subSnapshot}
        onOpenSubscriptionSheet={openSubscriptionUpgrade}
      />

      {gamification && (
        <div className="hm-gamification-bar" style={{background:"#243156",padding:"8px 18px 10px",flexShrink:0,borderBottom:`1px solid rgba(255,255,255,.08)`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",color:"rgba(255,255,255,.9)",marginBottom:5}}>
            <span>🏆 {levelName(gamification.level, lang)} · Lv.{gamification.level.number}</span>
            <span>{gamification.points} {lang==="el"?"πόντοι":"pts"}</span>
          </div>
          <div style={{height:6,borderRadius:99,background:"rgba(255,255,255,.12)",overflow:"hidden"}}>
            <div style={{height:"100%",width:`${gamification.progress_percent}%`,background:gamification.level.is_max?coral:teal,borderRadius:99,transition:"width .3s"}}/>
          </div>
          <div className="hm-gamification-sub" style={{color:"rgba(255,255,255,.55)",marginTop:4}}>
            {gamification.level.is_max
              ? (lang==="el"?"Μέγιστο επίπεδο · 0 ακόμα":"Max level · 0 to go")
              : gamification.next_level
                ? (lang==="el"
                  ? `${gamification.points_to_next} ακόμα για ${levelName(gamification.next_level, lang)}`
                  : `${gamification.points_to_next} more to ${levelName(gamification.next_level, lang)}`)
                : ""}
          </div>
        </div>
      )}

      {/* BODY */}
      <div className="hm-app-body" ref={appBodyRef}>
      <div className="hm-app-body-inner">

                {tab==="profile"&&(
          <AppTabPageShell
            title={lang==="el"?"Το προφίλ μου":"My profile"}
            action={(
              <button type="button" className="hm-icon-btn" aria-label={lang==="el"?"Ρυθμίσεις προφίλ":"Profile settings"} onClick={()=>setShowProfileSettings(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.7"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l-.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            )}
          >
            <div className="hm-tab-card" style={{display:"flex",alignItems:"center",gap:14,padding:"16px 18px"}}>
              {familyData.selfPhoto ? (
                <img
                  src={familyData.selfPhoto}
                  alt=""
                  style={{width:64,height:64,borderRadius:"50%",objectFit:"cover",flexShrink:0,display:"block"}}
                />
              ) : (
                <div style={{
                  width:64,height:64,borderRadius:"50%",background:"#BEB4CD",color:navy,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontFamily:"'DM Sans',sans-serif",fontSize:26,fontWeight:700,flexShrink:0,
                }}>
                  {displayInitial}
                </div>
              )}
              <div style={{minWidth:0,flex:1}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:17,fontWeight:700,color:navy,lineHeight:1.25}}>
                  {displayName || (lang==="el"?"Χωρίς όνομα":"No name")}
                </div>
                {accountEmail ? (
                  <div style={{fontSize:13,color:"rgba(43,58,103,.55)",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {accountEmail}
                  </div>
                ) : null}
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10}}>
                  {(familyChildren.length===0 && !pregnancyActive) && (
                    <span style={{fontSize:11,fontWeight:600,color:navy,background:"rgba(248,229,214,.55)",borderRadius:999,padding:"4px 10px"}}>
                      {lang==="el"?"Θέλω παιδί":"Want a child"}
                    </span>
                  )}
                  {pregnancyActive && (
                    <span style={{fontSize:11,fontWeight:600,color:navy,background:"rgba(190,180,205,.35)",borderRadius:999,padding:"4px 10px"}}>
                      {lang==="el"?`Εγκυμοσύνη · εβδ. ${pregWeek}`:`Pregnancy · wk ${pregWeek}`}
                    </span>
                  )}
                  <span style={{fontSize:11,fontWeight:600,color:navy,background:"rgba(43,58,103,.08)",borderRadius:999,padding:"4px 10px"}}>
                    {familyChildren.length} {lang==="el"?(familyChildren.length===1?"παιδί":"παιδιά"):(familyChildren.length===1?"child":"children")}
                  </span>
                </div>
              </div>
            </div>

            <ProfileGamificationCard
              lang={lang}
              gamification={gamification ?? defaultGamificationStatus()}
              referralCode={referralCode}
              activeGrantEndsAt={activeRewardGrant?.ends_at}
              activeGrantPlan={activeRewardGrant?.plan_slot}
              pendingRewards={rewardsSnapshot?.pending}
              onClaimPending={() => openPendingReward(rewardsSnapshot, true)}
            />

            <AppTabSection
              lang={lang}
              label={lang==="el"?"Τα παιδιά μου":"My children"}
              action={(
                <button
                  type="button"
                  onClick={openAddChildForm}
                  style={{background:"none",border:"none",color:navy,fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,cursor:"pointer",padding:0}}
                >
                  + {lang==="el"?"Προσθήκη":"Add"}
                </button>
              )}
            >
              {familyChildren.length===0 ? (
                <button
                  type="button"
                  onClick={openAddChildForm}
                  style={{
                    width:"100%",boxSizing:"border-box",border:"1.5px dashed rgba(43,58,103,.22)",
                    borderRadius:14,padding:"28px 16px",background:"transparent",cursor:"pointer",
                    display:"flex",flexDirection:"column",alignItems:"center",gap:8,
                    color:"rgba(43,58,103,.45)",fontFamily:"'DM Sans',sans-serif",
                  }}
                >
                  <span style={{fontSize:22,lineHeight:1,color:"rgba(43,58,103,.35)"}}>+</span>
                  <span style={{fontSize:13,fontWeight:500}}>{lang==="el"?"Πρόσθεσε το πρώτο παιδί":"Add your first child"}</span>
                </button>
              ) : (
                <div className="hm-tab-card hm-tab-card--flush">
                  {familyChildren.map((child, i) => (
                    <div
                      key={`${child.name}-${i}`}
                      style={{
                        display:"flex",alignItems:"center",gap:12,padding:"12px 14px",
                        borderBottom: i < familyChildren.length - 1 ? "1px solid "+gl : "none",
                      }}
                    >
                      <div style={{
                        width:40,height:40,borderRadius:"50%",background:logoPurple,color:navy,
                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,
                        overflow:"hidden",
                      }}>
                        {child.photo ? (
                          <img src={child.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} />
                        ) : "👶"}
                      </div>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontWeight:600,fontSize:14,color:navy}}>{child.name}</div>
                        <div style={{fontSize:12,color:"rgba(43,58,103,.5)",marginTop:2}}>
                          {formatChildAge(child.birthDate, lang) || child.birthDate || "—"}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                        <button
                          type="button"
                          className="hm-row-action-btn"
                          aria-label={lang==="el"?"Επεξεργασία παιδιού":"Edit child"}
                          onClick={() => openChildEdit(i)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M12 20h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="hm-row-action-btn hm-row-action-btn--danger"
                          aria-label={lang==="el"?"Διαγραφή παιδιού":"Delete child"}
                          onClick={() => requestDeleteChild(i)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M3 6h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                            <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                            <path d="M19 6l-.8 14.2A1.8 1.8 0 0 1 16.4 22H7.6a1.8 1.8 0 0 1-1.8-1.8L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                            <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AppTabSection>

            <AppTabSection lang={lang} label={lang==="el"?"Ρυθμίσεις":"Settings"}>
              <div className="hm-tab-card hm-tab-card--flush">
                {[
                  {
                    key: "alerts",
                    icon: "🔔",
                    iconBg: "rgba(255,193,7,.2)",
                    label: lang==="el"?"Ειδοποιήσεις εφαρμογής":"App alerts",
                    value: notificationSummaryLabel(lang, appNotifications.length, notifUnreadCount),
                    onClick: () => {
                      setTab("profile");
                      setShowNotifications(true);
                    },
                  },
                  {
                    key: "privacy",
                    icon: "🔐",
                    iconBg: "rgba(74,190,170,.18)",
                    label: lang==="el"?"Απόρρητο & δεδομένα":"Privacy & data",
                    value: profile.consentMarketing
                      ? (lang==="el"?"Marketing: ναι":"Marketing: on")
                      : (lang==="el"?"Marketing: όχι":"Marketing: off"),
                    onClick: openAccountPrivacy,
                  },
                  {
                    key: "language",
                    icon: "🌐",
                    iconBg: "rgba(91,127,232,.15)",
                    label: lang==="el"?"Γλώσσα":"Language",
                    value: L.n,
                    onClick: () => setShowLang(true),
                  },
                  {
                    key: "subscription",
                    icon: "💳",
                    iconBg: "rgba(43,58,103,.1)",
                    label: lang==="el"?"Συνδρομή":"Subscription",
                    value: profilePlanLabel,
                    onClick: openSubscriptionUpgrade,
                  },
                ].map((row, i, rows) => (
                  <button
                    key={row.key}
                    type="button"
                    onClick={row.onClick}
                    style={{
                      width:"100%",display:"flex",alignItems:"center",gap:12,padding:"13px 16px",
                      border:"none",background:"#fff",cursor:row.onClick?"pointer":"default",
                      fontFamily:"'DM Sans',sans-serif",textAlign:"left",
                      borderBottom: i < rows.length - 1 ? "1px solid "+gl : "none",
                    }}
                  >
                    <span
                      style={{
                        width:36,height:36,borderRadius:10,background:row.iconBg,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:17,flexShrink:0,
                      }}
                      aria-hidden="true"
                    >
                      {row.icon}
                    </span>
                    <span style={{flex:1,minWidth:0,fontSize:14,fontWeight:600,color:navy}}>{row.label}</span>
                    <span style={{fontSize:13,color:"rgba(43,58,103,.5)",marginRight:4}}>{row.value}</span>
                    <span style={{color:"rgba(43,58,103,.28)",fontSize:20,lineHeight:1}} aria-hidden="true">›</span>
                  </button>
                ))}
              </div>
            </AppTabSection>

            <button
              type="button"
              onClick={requestLogout}
              style={{
                width:"100%",padding:"14px 12px",marginTop:4,
                border:".5px solid rgba(43,58,103,.08)",background:"#fff",borderRadius:14,
                boxSizing:"border-box",
                color:"var(--hm-destructive)",fontFamily:"'DM Sans',sans-serif",fontSize:15,fontWeight:600,
                cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {lang==="el"?"Αποσύνδεση":"Log out"}
            </button>
          </AppTabPageShell>
        )}

        {/* ── CHAT ── */}
        {tab==="chat"&&(
          <div className="hm-chat-column" style={{display:"flex",flexDirection:"column"}}>
            <ChatMedicalDisclaimer lang={lang} />
            {/* Voice quota bar */}
            <div style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10.5,color:"rgba(43,58,103,.55)",marginBottom:4}}>
                <span>🔊 {t("voicequota",lang)}</span>
                <span>{ttsUsedSafe}/{ttsQuotaTotal}</span>
              </div>
              <div style={{height:6,borderRadius:99,background:gl,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${Math.min(100, Math.round((ttsUsedSafe/ttsQuotaTotal)*100))}%`,background:ttsRemaining>0?teal:"#E07B54",borderRadius:99,transition:"width .3s"}}/>
              </div>
              {ttsRemaining <= 0 && (
                <FeatureUpgradeGate
                  lang={lang}
                  featureLabel={featureLabel("voice_listen", lang)}
                  requiredPlanLabel={nextUpgradePlanLabel(subSnapshot, lang)}
                  onUpgrade={openSubscriptionUpgrade}
                  compact
                />
              )}
            </div>

            {/* Chat toolbar */}
            <div className="hm-chat-toolbar">
              <button
                type="button"
                className="hm-chat-toolbar__btn"
                onClick={requestNewThread}
                disabled={!messages.length}
                title={t("newthread", lang)}
              >
                ＋ {t("newthread", lang)}
              </button>
              {messages.length > 0 && (
                <button
                  type="button"
                  className="hm-chat-toolbar__btn"
                  onClick={() => setShowArchiveModal(true)}
                  title={t("archivethread", lang)}
                >
                  📁 {t("archivethread", lang)}
                </button>
              )}
              <button
                type="button"
                className="hm-chat-toolbar__btn hm-chat-toolbar__btn--secondary"
                onClick={() => setShowThreads(true)}
                title={t("pastthreads", lang)}
              >
                🗂️ {t("pastthreads", lang)}
                {threads.length > 0 && <span className="hm-chat-toolbar__count">{threads.length}</span>}
              </button>
            </div>
            <p className="hm-chat-context-hint">
              {lang === "el"
                ? `Η HeyMaa θυμάται τα τελευταία ${chatContextLimit} μηνύματα και ${memoryContextLimit} αποθηκευμένες αναμνήσεις (ανά πακέτο).`
                : `HeyMaa remembers your last ${chatContextLimit} messages and ${memoryContextLimit} saved memories (plan-based).`}
            </p>

            {messages.length===0&&(
              <div className="hm-tab-card" style={{textAlign:"center",padding:"20px 16px"}}>
                <div style={{margin:"0 auto 12px",width:52,height:52}}><HeyMaaAvatar size={52} /></div>
                <div className="hm-chat-greeting" style={{color:navy}}>{t("chatgreet",lang)} {vocativeName}! {t("chatgreet2",lang)}</div>
              </div>
            )}

            {messages.map((msg,i)=>(
              <div key={i}>
                {msg.role==="assistant"?(
                  <div className="hm-chat-message-row">
                    <HeyMaaAvatar size={32} />
                    <div className="hm-chat-message-row__body">
                      <div data-hm-bubble className="hm-chat-bubble hm-chat-bubble--assistant" style={{background:chatAssistantBg,color:navy}}>{msg.content}</div>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <button onClick={()=>speak(msg.content,i)} className="hm-chat-listen-btn" style={{color:ttsRemaining<=0?"#C8BFB8":playingIndex===i?coral:teal,cursor:"pointer"}}>{playingIndex===i?"⏸ Stop":t("listen",lang)}</button>
                      </div>
                    </div>
                  </div>
                ):(
                  <div className="hm-chat-message-row hm-chat-message-row--user">
                    <div data-hm-bubble className="hm-chat-bubble hm-chat-bubble--user" style={{background:navy,color:"#fff"}}>
                      {msg.attachments?.map((att, j) => (
                        att.kind === "image" && att.data ? (
                          <img
                            key={`${att.name}-${j}`}
                            src={att.data}
                            alt={att.name}
                            style={{display:"block",maxWidth:"100%",borderRadius:8,marginBottom: msg.content ? 8 : 0}}
                          />
                        ) : (
                          <div key={`${att.name}-${j}`} style={{display:"flex",alignItems:"center",gap:6,marginBottom: j < (msg.attachments?.length || 0) - 1 ? 6 : (msg.content ? 8 : 0),padding:"6px 8px",borderRadius:8,background:"rgba(255,255,255,.12)",fontSize:12}}>
                            <span aria-hidden="true">📎</span>
                            <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180}}>{att.name}</span>
                          </div>
                        )
                      ))}
                      {msg.content && (
                        <div>{msg.content}</div>
                      )}
                    </div>
                    <UserChatAvatar size={32} name={displayName} photo={familyData.selfPhoto} />
                  </div>
                )}
              {msg.role==="assistant"&&msg.memorySuggestion&&!msg.memorySuggestion.dismissed&&(
                <div className="hm-chat-memory-suggestion" role="region" aria-label={lang==="el"?"Πρόταση αναμνησης":"Memory suggestion"}>
                  {msg.memorySuggestion.added ? (
                    <div className="hm-chat-memory-suggestion__done">
                      <span aria-hidden="true">✓</span>
                      <span>{lang==="el"?"Προστέθηκε στις Αναμνήσεις":"Added to Memories"}</span>
                      <button
                        type="button"
                        className="hm-chat-memory-suggestion__link"
                        onClick={()=>{ if(msg.memorySuggestion?.ref) setActiveMemRef(msg.memorySuggestion.ref); else setActiveMemRef("__general__"); setTab("memories"); }}
                      >
                        {lang==="el"?"Δες →":"View →"}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="hm-chat-memory-suggestion__head">
                        <span className="hm-chat-memory-suggestion__emoji" aria-hidden="true">{msg.memorySuggestion.emoji}</span>
                        <div className="hm-chat-memory-suggestion__meta">
                          <span className={`hm-chat-memory-suggestion__badge${msg.memorySuggestion.kind==="milestone"?" hm-chat-memory-suggestion__badge--milestone":""}`}>
                            {msg.memorySuggestion.kind==="milestone"
                              ? (lang==="el"?"Ορόσημο":"Milestone")
                              : (lang==="el"?"Στιγμή":"Moment")}
                          </span>
                          <p className="hm-chat-memory-suggestion__title">{msg.memorySuggestion.text}</p>
                        </div>
                      </div>
                      {msg.memorySuggestion.description && (
                        <p className="hm-chat-memory-suggestion__desc">{msg.memorySuggestion.description}</p>
                      )}
                      <p className="hm-chat-memory-suggestion__prompt">
                        {lang==="el"?"Θέλεις να το αποθηκεύσεις στις Αναμνήσεις;":"Save this to your Memories?"}
                      </p>
                      <div className="hm-chat-memory-suggestion__actions">
                        <button type="button" className="hm-chat-memory-suggestion__btn hm-chat-memory-suggestion__btn--primary" onClick={()=>acceptMemorySuggestion(i)}>
                          {lang==="el"?"Ναι, πρόσθεσέ το":"Yes, add it"}
                        </button>
                        <button type="button" className="hm-chat-memory-suggestion__btn hm-chat-memory-suggestion__btn--ghost" onClick={()=>dismissMemorySuggestion(i)}>
                          {lang==="el"?"Όχι τώρα":"Not now"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {msg.role==="assistant"&&msg.promo&&(<div style={{margin:"4px 0 8px 36px",background:"#FFF8F3",border:"1.5px solid #E07B54",borderRadius:12,padding:"11px 13px",maxWidth:"85%"}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
                  {msg.promo.badge&&<span style={{fontSize:9,fontWeight:700,background:"#E07B54",color:"#fff",borderRadius:999,padding:"2px 8px",letterSpacing:.5}}>{displayUppercase(msg.promo.badge, lang)}</span>}
                  <span style={{fontWeight:700,fontSize:12.5,color:"#2B3A67"}}>{msg.promo.title}</span>
                </div>
                <div style={{fontSize:11.5,color:"#4A3F35",lineHeight:1.55,marginBottom:msg.promo.link?8:0}}>{msg.promo.body}</div>
                {msg.promo.link&&<a href={msg.promo.link} target="_blank" rel="noopener noreferrer" style={{display:"inline-block",marginTop:2,fontSize:11,fontWeight:700,color:"#E07B54",textDecoration:"none",border:"1px solid #E07B54",borderRadius:7,padding:"4px 10px"}}>{msg.promo.cta||"Μάθε περισσότερα →"}</a>}
              </div>)}
              </div>
            ))}
            {loading&&<div className="hm-chat-message-row" aria-live="polite" aria-busy="true" aria-label="…">
              <HeyMaaAvatar size={32} />
              <div className="hm-chat-bubble hm-chat-bubble--assistant hm-chat-bubble--typing" style={{background:chatAssistantBg}}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: "2.5px solid rgba(43,58,103,.18)",
                    borderTopColor: navy,
                    display: "inline-block",
                    animation: "hmThinkSpin .75s linear infinite",
                  }}
                />
              </div>
              <style>{`@keyframes hmThinkSpin{to{transform:rotate(360deg)}}`}</style>
            </div>}
            <div ref={bottomRef}/>
          </div>
        )}

        {/* ── FAMILY ── */}
        {tab==="family"&&(
          <AppTabPageShell title={t("family", lang)}>
          <FamilyTreePanel
            userName={displayName || profile.name}
            lang={lang}
            familyChildren={familyChildren}
            members={familyData.members}
            pregnancyActive={pregnancyActive}
            memoryCounts={memoryCountsByRef}
            selfPhoto={familyData.selfPhoto}
            selectedNodeId={treeEdit?.id}
            onEditNode={openTreeEdit}
            onNodeSelect={(ref) => { setActiveMemRef(ref ?? "__general__"); setTab("memories"); }}
            onPlaceMembers={placeMembersOnTree}
            onSave={saveFamilyNow}
            saving={familySaving}
          />
          <div className="hm-tab-card">
            <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
              <HeyMaaAvatar size={32} />
              <div>
                <div style={{background:gl,borderRadius:"0 11px 11px 11px",padding:"10px 12px",fontSize:12.5,lineHeight:1.5,color:navy}}>{t("chatgreet",lang)} {vocativeName}! {t("chatgreet2",lang)}</div>
                <button onClick={()=>prefillChat(lang === "el" ? `Πες μου για την ανάπτυξη μωρού ηλικίας ${displayAge}` : lang === "ar" ? `أخبريني عن تطور الطفل في عمر ${displayAge}` : lang === "zh" ? `告诉我${displayAge}宝宝的发育情况` : lang === "es" ? `Cuéntame sobre el desarrollo del bebé de ${displayAge}` : lang === "fr" ? `Parle-moi du développement de bébé à ${displayAge}` : lang === "de" ? `Erzähl mir über die Entwicklung eines Babys im Alter von ${displayAge}` : lang === "pt" ? `Fala-me sobre o desenvolvimento do bebé com ${displayAge}` : lang === "it" ? `Parlami dello sviluppo del bambino di ${displayAge}` : lang === "ru" ? `Расскажи мне о развитии ребёнка в возрасте ${displayAge}` : lang === "tr" ? `${displayAge} yaşındaki bebek gelişimi hakkında anlat` : lang === "ja" ? `${displayAge}の赤ちゃんの発達について教えて` : `Tell me about baby development for ${displayAge}`)} style={{background:"none",border:`1px solid ${navy}`,borderRadius:8,color:navy,fontSize:11,cursor:"pointer",padding:"5px 10px",marginTop:6,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{t("askmaa",lang)}</button>
              </div>
            </div>
          </div>
          <AppTabSection
            lang={lang}
            label={t("myfamily", lang)}
            action={(
              <button
                type="button"
                onClick={()=>setShowMyFamily(v=>!v)}
                style={{background:"none",border:"none",color:navy,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",flexShrink:0}}
              >
                {showMyFamily ? t("hide",lang) : t("show",lang)}
              </button>
            )}
          >
          <div className="hm-tab-card" style={{overflow:"hidden",maxWidth:"100%",boxSizing:"border-box" as any}}>
            {showMyFamily && (<>
            {profile.dueDate&&<div style={{display:"flex",alignItems:"center",gap:9,padding:"10px 11px",borderRadius:9,background:gl,marginBottom:6}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:logoPurple,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:18,color:navy,flexShrink:0}}>🤰</div>
              <div style={{minWidth:0,flex:1}}><div style={{fontWeight:600,fontSize:13,color:navy}}>{t("pregnancy_short",lang)}</div><div style={{fontSize:11,color:"rgba(43,58,103,.55)",marginTop:1}}>{t("duelabel",lang)}{profile.dueDate}</div></div>
            </div>}
            {familyChildren.map((child,i)=>{
              const age = formatChildAge(child.birthDate, lang);
              return (<div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 11px",borderRadius:9,background:gl,marginBottom:6}}>
                <div
                  onClick={() => {
                    const nodeLike = {
                      id: `child-${i}-${child.name}`,
                      name: child.name,
                      role: t("role_child", lang),
                      kind: "child" as const,
                      side: "self" as const,
                      generation: 1 as const,
                      memoryCount: 0,
                      color: logoPurple,
                      childIndex: i,
                      ref: child.name,
                      photo: child.photo,
                      x: 0,
                      y: 0,
                    };
                    openTreeEdit(nodeLike);
                  }}
                  style={{width:36,height:36,borderRadius:"50%",background:logoPurple,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:navy,flexShrink:0,overflow:"hidden",cursor:"pointer",padding:0}}
                >
                  {child.photo ? <img src={child.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} /> : child.name[0]?.toUpperCase()}
                </div>
                <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,color:navy}}>{child.name}</div><div style={{fontSize:11,color:"rgba(43,58,103,.55)",marginTop:1}}>{age}</div></div>
                <button type="button" className="hm-btn-ghost hm-btn-ghost--sm" onClick={()=>{setActiveMemRef(child.name);setTab("memories");}}>📝</button>
                <button type="button" className="hm-btn-ghost hm-btn-ghost--sm" onClick={()=>{setActiveMilestoneRef(child.name);setTab("milestones");}}>🏆</button>
                <button type="button" className="hm-btn hm-btn--danger-soft hm-btn--sm" onClick={()=>requestDeleteChild(i)} title={lang==="el"?"Διαγραφή":"Delete"} aria-label={lang==="el"?"Διαγραφή":"Delete"}>×</button>
              </div>);
            })}
            <div onClick={openAddChildForm} style={{border:"2px dashed #C8BFB8",borderRadius:9,padding:14,textAlign:"center",cursor:"pointer",color:"rgba(43,58,103,.55)",fontSize:13,marginBottom:8}}>{t("addchild",lang)}</div>
            {familyData.members.filter(m=>classifyKinship(m.relationship)==="pet").map((m)=>{
              const i = familyData.members.indexOf(m);
              return (
              <div key={`pet-${m.id}`} style={{display:"flex",flexDirection:"column",gap:6,padding:"10px 11px",borderRadius:9,background:gl,marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <div
                    onClick={() => {
                      openTreeEdit({
                        id: `member-${m.id}`,
                        name: m.name,
                        role: m.relationship,
                        kind: "pet",
                        side: "self",
                        generation: 1,
                        memoryCount: 0,
                        color: logoPurple,
                        memberIndex: i,
                        relatedTo: m.relatedTo,
                        ref: memberMemoryRef(m.id),
                        photo: m.photo,
                        x: 0,
                        y: 0,
                      });
                    }}
                    style={{width:36,height:36,borderRadius:"50%",background:logoPurple,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:navy,flexShrink:0,overflow:"hidden",cursor:"pointer",padding:0}}
                  >
                    {m.photo ? <img src={m.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} /> : "🐾"}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13,color:navy}}>{m.name}</div>
                    <div style={{fontSize:11,color:"rgba(43,58,103,.55)",marginTop:1}}>{lang==="el"?"Κατοικίδιο":"Family Pet"}</div>
                    {m.note && <div style={{fontSize:10,color:"#A89F98",marginTop:2,lineHeight:1.4,fontStyle:"italic"}}>{m.note}</div>}
                  </div>
                  <button onClick={()=>{setActiveMemRef(memberMemoryRef(m.id));setTab("memories");}} style={{background:"none",border:`1px solid ${navy}`,borderRadius:7,color:navy,fontSize:11,cursor:"pointer",padding:"4px 8px",fontFamily:"'DM Sans',sans-serif",fontWeight:600,flexShrink:0}}>📝</button>
                  <button onClick={()=>deleteFamilyMember(i)} title={lang==="el"?"Διαγραφή":"Delete"} style={{background:"rgba(224,123,84,0.10)",border:"none",borderRadius:7,color:coral,cursor:"pointer",fontSize:13,padding:"4px 6px",lineHeight:1,fontWeight:600,flexShrink:0}}>×</button>
                </div>
              </div>
            );})}
            {showAddPet&&<div style={{background:"#F8F5F2",borderRadius:10,padding:12,marginBottom:8}}>
              <input value={newPetName} onChange={e=>setNewPetName(e.target.value)} placeholder={lang==="el"?"Όνομα κατοικιδίου":"Pet name"} style={{width:"100%",padding:"9px 11px",border:`1.5px solid #DDD7D0`,borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box" as any}}/>
              <input value={newPetNote} onChange={e=>setNewPetNote(e.target.value)} placeholder={lang==="el"?"Σημείωση (προαιρετικό)":"Note (optional)"} style={{width:"100%",padding:"9px 11px",border:`1.5px solid #DDD7D0`,borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box" as any}}/>
              <div style={{display:"flex",gap:8}}>
                <button type="button" onClick={addPet} disabled={!newPetName.trim()} style={{flex:1,padding:9,background:!newPetName.trim()?"#C8BFB8":navy,color:"#fff",border:"none",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,cursor:!newPetName.trim()?"default":"pointer"}}>{t("save",lang)}</button>
                <button type="button" onClick={()=>{setShowAddPet(false);setNewPetName("");setNewPetNote("");}} style={{flex:1,padding:9,background:gl,color:navy,border:"none",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,cursor:"pointer"}}>{t("cancel",lang)}</button>
              </div>
            </div>}
            <div onClick={()=>{setShowAddPet(v=>!v);setShowAddMember(false);}} style={{border:"2px dashed #C8BFB8",borderRadius:9,padding:14,textAlign:"center",cursor:"pointer",color:"rgba(43,58,103,.55)",fontSize:13,marginBottom:8}}>{t("addpet",lang)}</div>
            {familyData.members.filter(m=>classifyKinship(m.relationship)!=="pet").map((m)=>{
              const i = familyData.members.indexOf(m);
              return (
              <div key={m.id||i} style={{display:"flex",flexDirection:"column",gap:6,padding:"10px 11px",borderRadius:9,background:gl,marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <div
                    onClick={() => {
                      openTreeEdit({
                        id: `member-${m.id}`,
                        name: m.name,
                        role: m.relationship,
                        kind: "other",
                        side: "self",
                        generation: 0,
                        memoryCount: 0,
                        color: logoPurple,
                        memberIndex: i,
                        relatedTo: m.relatedTo,
                        ref: memberMemoryRef(m.id),
                        photo: m.photo,
                        x: 0,
                        y: 0,
                      });
                    }}
                    style={{width:36,height:36,borderRadius:"50%",background:logoPurple,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:navy,flexShrink:0,overflow:"hidden",cursor:"pointer",padding:0}}
                  >
                    {m.photo ? <img src={m.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} /> : m.name[0]?.toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13,color:navy}}>{memberDisplayLabel(m, familyData.members)}</div>
                    {m.note && <div style={{fontSize:10,color:"#A89F98",marginTop:2,lineHeight:1.4,fontStyle:"italic"}}>{m.note}</div>}
                    {(m.email || m.phone) && (
                      <div style={{fontSize:10,color:"#A89F98",marginTop:2,lineHeight:1.4}}>
                        {m.email}{m.email && m.phone ? " · " : ""}{m.phone}
                      </div>
                    )}
                  </div>
                  <button onClick={()=>{setActiveMemRef(memberMemoryRef(m.id));setTab("memories");}} style={{background:"none",border:`1px solid ${navy}`,borderRadius:7,color:navy,fontSize:11,cursor:"pointer",padding:"4px 8px",fontFamily:"'DM Sans',sans-serif",fontWeight:600,flexShrink:0}}>📝</button>
                  <button onClick={()=>deleteFamilyMember(i)} title={lang==="el"?"Διαγραφή":"Delete"} style={{background:"rgba(224,123,84,0.10)",border:"none",borderRadius:7,color:coral,cursor:"pointer",fontSize:13,padding:"4px 6px",lineHeight:1,fontWeight:600,flexShrink:0}}>×</button>
                </div>
                <select
                  value={RELATIONSHIP_PRESETS.some(p=>p.value===m.relationship)?m.relationship:"Family"}
                  onChange={e=>changeMemberRelationship(i,e.target.value)}
                  style={{width:"100%",padding:"7px 10px",border:`1.5px solid #DDD7D0`,borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontSize:12,outline:"none",background:"#fff",color:navy,boxSizing:"border-box" as any}}
                >
                  {!RELATIONSHIP_PRESETS.some(p=>p.value===m.relationship) && (
                    <option value={m.relationship}>{m.relationship}</option>
                  )}
                  {RELATIONSHIP_PRESETS.map(p=>(
                    <option key={p.value} value={p.value}>{lang==="el"?p.el:p.en}</option>
                  ))}
                </select>
                <select
                  value={m.relatedTo || RELATED_TO_SELF}
                  onChange={e=>changeMemberRelatedTo(i,e.target.value)}
                  style={{width:"100%",padding:"7px 10px",border:`1.5px solid #DDD7D0`,borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontSize:12,outline:"none",background:"#fff",color:navy,boxSizing:"border-box" as any}}
                >
                  {!relatedToOptions.some(o=>o.value===(m.relatedTo||RELATED_TO_SELF)) && (
                    <option value={m.relatedTo || RELATED_TO_SELF}>
                      {relatedToLabel(m.relatedTo, lang, { youName: profile.name, partnerName: partnerMember?.name, members: familyData.members })}
                    </option>
                  )}
                  {relatedToOptions.filter(o=>o.value!==memberMemoryRef(m.id)).map(o=>(
                    <option key={o.value} value={o.value}>{lang==="el"?`Συγγενής του/της: ${o.label}`:`Relative of: ${o.label}`}</option>
                  ))}
                </select>
              </div>
            );})}
            {showAddMember&&<div style={{background:"#F8F5F2",borderRadius:10,padding:12,marginBottom:8}}>
              <input value={newMemberName} onChange={e=>setNewMemberName(e.target.value)} placeholder={t("membername",lang)} style={{width:"100%",padding:"9px 11px",border:`1.5px solid #DDD7D0`,borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box" as any}}/>
              <select value={newMemberRole} onChange={e=>{
                const role = e.target.value;
                setNewMemberRole(role);
                setNewMemberRelatedTo(
                  defaultRelatedToForRelationship(role, familyData.members, newMemberRelatedTo),
                );
              }} style={{width:"100%",padding:"9px 11px",border:`1.5px solid #DDD7D0`,borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box" as any,background:"#fff",color:"#2B3A67"}}>
                {RELATIONSHIP_PRESETS.map(p=>(
                  <option key={p.value} value={p.value}>{lang==="el"?p.el:p.en}</option>
                ))}
              </select>
              <select value={newMemberRelatedTo} onChange={e=>setNewMemberRelatedTo(e.target.value)} style={{width:"100%",padding:"9px 11px",border:`1.5px solid #DDD7D0`,borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box" as any,background:"#fff",color:"#2B3A67"}}>
                {relatedToOptions.map(o=>(
                  <option key={o.value} value={o.value}>{lang==="el"?`Συγγενής του/της: ${o.label}`:`Relative of: ${o.label}`}</option>
                ))}
              </select>
              <input value={newMemberBirthDate} onChange={e=>setNewMemberBirthDate(e.target.value)} type="date" placeholder={lang==="el"?"Ημ. γέννησης (προαιρετικό)":"Birth date (optional)"} style={{width:"100%",padding:"9px 11px",border:`1.5px solid #DDD7D0`,borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box" as any}}/>
              <input value={newMemberNote} onChange={e=>setNewMemberNote(e.target.value)} placeholder={lang==="el"?"Σημείωση / ενδιαφέρον γεγονός":"Note / interesting fact"} style={{width:"100%",padding:"9px 11px",border:`1.5px solid #DDD7D0`,borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box" as any}}/>
              <input value={newMemberEmail} onChange={e=>setNewMemberEmail(e.target.value)} type="email" placeholder={t("memberemail",lang)} style={{width:"100%",padding:"9px 11px",border:`1.5px solid #DDD7D0`,borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box" as any}}/>
              <input value={newMemberPhone} onChange={e=>setNewMemberPhone(e.target.value)} type="tel" placeholder={t("memberphone",lang)} style={{width:"100%",padding:"9px 11px",border:`1.5px solid #DDD7D0`,borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box" as any}}/>
              <div style={{display:"flex",gap:8}}>
                <button onClick={addFamilyMember} style={{flex:1,padding:9,background:navy,color:"#fff",border:"none",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,cursor:"pointer"}}>{t("save",lang)}</button>
                <button onClick={()=>setShowAddMember(false)} style={{flex:1,padding:9,background:gl,color:navy,border:"none",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:13,cursor:"pointer"}}>{t("cancel",lang)}</button>
              </div>
            </div>}
            <div onClick={()=>{setShowAddPet(false);setNewMemberRole("Partner");setShowAddMember(!showAddMember);}} style={{border:"2px dashed #C8BFB8",borderRadius:9,padding:14,textAlign:"center",cursor:"pointer",color:"rgba(43,58,103,.55)",fontSize:13}}>{t("addmember",lang)}</div>
            </>)}
          </div>
          </AppTabSection>
          <FamilyDocumentsPanel
            lang={lang}
            docs={docs}
            onDocsChange={setDocs}
            familyChildren={familyChildren}
            members={familyData.members}
            pregnancyActive={pregnancyActive}
            userName={displayName || profile.name}
            featureAllowed={featureAllowed("document_archive", planEntitlements, subSnapshot)}
            featureLabel={featureLabel("document_archive", lang)}
            requiredPlanLabel={featureRequiredPlanLabel("document_archive", lang)}
            onUpgrade={openSubscriptionUpgrade}
          />
        </AppTabPageShell>)}

        {/* ── MEMORIES ── */}
        {tab==="memories"&&(
          <MemoriesTab
            lang={lang}
            title={t("memories", lang)}
            memories={memories}
            profileName={displayName || profile.name}
            familyChildren={familyChildren}
            members={familyData.members}
            pregnancyActive={pregnancyActive}
            activeMemRef={activeMemRef}
            setActiveMemRef={setActiveMemRef}
            photoAllowed={featureAllowed("full_memory", planEntitlements, subSnapshot)}
            videoAllowed={featureAllowed("memory_video", planEntitlements, subSnapshot)}
            onUpgrade={openSubscriptionUpgrade}
            upgradeFeatureLabel={featureLabel("full_memory", lang)}
            upgradeRequiredPlanLabel={featureRequiredPlanLabel("full_memory", lang)}
            onCreateMemory={createMemoryFromForm}
            onUpdateMemory={updateMemoryFromForm}
            onDeleteMemory={deleteMemory}
            onPickPhoto={pickMemoryPhoto}
            pendingPhoto={memPendingPhoto}
            onClearPendingPhoto={() => setMemPendingPhoto(null)}
            onAlbumDownload={() => track("click", appPath("memories", "export-booklet"), "Download memories album")}
            onSaveMemories={saveMemoriesNow}
            memoriesSaving={memoriesSaving}
            onRemoveAlbumPhoto={(m) => {
              const idx = findMemoryIndex(m);
              if (idx >= 0) removeMemoryPhoto(idx);
            }}
            onDeleteAlbumMemory={(m) => {
              const idx = findMemoryIndex(m);
              if (idx >= 0) deleteMemory(idx);
            }}
          />
        )}

        {/* ── MILESTONES ── */}
        {tab==="milestones"&&(()=>{
          const msRefs: {label:string,value:string}[] = [];
          if(profile.dueDate) msRefs.push({label:"🤰 "+t("pregnancy_short",lang),value:"pregnancy"});
          familyChildren.forEach(ch=>msRefs.push({label:"👶 "+ch.name,value:ch.name}));
          const effectiveRef = (activeMilestoneRef&&msRefs.some(r=>r.value===activeMilestoneRef))?activeMilestoneRef:msRefs[0]?.value||"";
          const isPreg = effectiveRef==="pregnancy";
          const currentChild = isPreg?null:familyChildren.find(ch=>ch.name===effectiveRef);
          const childAgeMonths = currentChild
            ? (ageMonthsFromBirthDate(currentChild.birthDate) ?? parseAgeMonths(profile.childAge))
            : parseAgeMonths(profile.childAge);
          const currentDisplayAge = currentChild?formatChildAge(currentChild.birthDate,lang):displayAge;
          const currentChildName = currentChild?.name||primaryChildName;
          const msCopy = {
            milestones: t("milestones", lang),
            tickall: t("tickall", lang),
            pregTitle: t("pregnancymilestones_title", lang),
            pregSub: t("pregnancymilestones_sub", lang),
            pregCardTitle: t("pregnancycard_title", lang),
            pregCardBody: t("pregnancycard_body", lang),
            weekLabel: t("week_label", lang),
            lockedHint: t("ms_locked_hint", lang),
            progress: t("ms_period_progress", lang),
            currentPeriod: t("ms_current_period", lang),
            nextPreview: t("ms_next_preview", lang),
            pastPeriod: t("ms_past_period", lang),
            askaboutmile: t("askaboutmile", lang),
            askmaa: t("askmaa", lang),
            nochildyet: t("nochildyet", lang),
          };
          return (<AppTabPageShell title={t("milestones", lang)}>
            <MilestonesPanel
              lang={lang}
              refs={msRefs}
              activeRef={effectiveRef}
              onActiveRefChange={setActiveMilestoneRef}
              isPregnancy={isPreg}
              pregWeek={pregWeek}
              dueDate={profile.dueDate}
              ageMonths={childAgeMonths}
              displayAge={currentDisplayAge}
              childName={currentChildName}
              checksMap={milestoneChecksMap}
              lastChecked={lastCheckedMap[effectiveRef] ?? null}
              onToggle={toggleMilestone}
              pregMilestoneMsg={(i, total) => getPregnancyMilestoneMsg(i, total, lang)}
              childMilestoneMsg={(i, total) => getMilestoneMsg(i, total, lang)}
              copy={msCopy}
            />
            {effectiveRef && (
            <div className="hm-tab-card">
              <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                <HeyMaaAvatar size={32} />
                <div>
                  <div style={{background:gl,borderRadius:"0 11px 11px 11px",padding:"10px 12px",fontSize:12.5,lineHeight:1.5,color:navy}}>{t("askaboutmile",lang)}</div>
                  <button onClick={()=>prefillChat(isPreg?t("askmile_preg_q",lang).replace("{week}",String(pregWeek)):lang==="el"?"Ποια είναι τα επόμενα milestones για παιδί "+currentDisplayAge+";":"What are the next developmental milestones for a baby aged "+currentDisplayAge+"?")} style={{background:"none",border:"1px solid "+navy,borderRadius:8,color:navy,fontSize:11,cursor:"pointer",padding:"5px 10px",marginTop:6,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{t("askmaa",lang)}</button>
                </div>
              </div>
            </div>
            )}
          </AppTabPageShell>);
        })()}
        {/* ── SHOPPING ── */}
        {tab==="shopping"&&<div className="hm-tab-card">
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:15,color:navy,marginBottom:11,fontWeight:600}}>Shopping</div>
          <div style={{display:"flex",marginBottom:12,borderRadius:9,overflow:"hidden",border:"1.5px solid #E6E0D8"}}>
            <button onClick={()=>setShopTab("p")} style={{flex:1,padding:"8px 3px",fontSize:11,fontWeight:600,cursor:"pointer",background:shopTab==="p"?navy:"#fff",color:shopTab==="p"?"#fff":"rgba(43,58,103,.55)",border:"none",fontFamily:"'DM Sans',sans-serif"}}>🛍️ {t("products",lang)}</button>
            <button onClick={()=>setShopTab("s")} style={{flex:1,padding:"8px 3px",fontSize:11,fontWeight:600,cursor:"pointer",background:shopTab==="s"?navy:"#fff",color:shopTab==="s"?"#fff":"rgba(43,58,103,.55)",border:"none",fontFamily:"'DM Sans',sans-serif"}}>🛒 {t("supermarket",lang)}</button>
            <button onClick={()=>setShopTab("o")} style={{flex:1,padding:"8px 3px",fontSize:11,fontWeight:600,cursor:"pointer",background:shopTab==="o"?navy:"#fff",color:shopTab==="o"?"#fff":"rgba(43,58,103,.55)",border:"none",fontFamily:"'DM Sans',sans-serif",position:"relative" as any}}>🔔 {t("offers",lang)}{offers.length>0&&shopTab!=="o"&&<span style={{position:"absolute",top:4,right:4,width:7,height:7,borderRadius:"50%",background:coral}}/>}</button>
          </div>
          {shopTab==="p"&&(<>
            {shopItems.map((item,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid "+gl}}>
                <div style={{width:36,height:36,borderRadius:8,background:gl,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📦</div>
                <div style={{fontSize:12.5,fontWeight:600,color:"#2B3A67",flex:1}}>{item}</div>
                <button onClick={()=>setShopItems(shopItems.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#C8BFB8",cursor:"pointer",fontSize:18,padding:4}}>×</button>
              </div>
            ))}
            <div style={{display:"flex",gap:7,marginTop:10,paddingTop:10,borderTop:"1px solid "+gl}}>
              <input value={shopInput} onChange={e=>setShopInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&shopInput.trim()){setShopItems([...shopItems,shopInput.trim()]);setShopInput("");}}} placeholder={t("additem",lang)} style={{flex:1,padding:"8px 11px",border:"1.5px solid #DDD7D0",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:12.5,outline:"none"}}/>
              <button onClick={()=>{if(shopInput.trim()){setShopItems([...shopItems,shopInput.trim()]);setShopInput("");}}} style={{padding:"8px 13px",background:navy,color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>＋</button>
            </div>
            <div style={{background:navy,borderRadius:10,padding:"10px 12px",marginTop:10,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap" as any,gap:6}}>
              <span style={{fontSize:11,color:"rgba(255,255,255,.75)",fontWeight:500}}>{t("sendlist",lang)}</span>
              <div style={{display:"flex",gap:5}}>
                <button onClick={()=>window.open("https://wa.me/?text="+encodeURIComponent("🛍️ "+t("products",lang)+":\n"+shopItems.map(i=>"• "+i).join("\n")),"_blank")} style={{background:"#25D366",border:"none",borderRadius:6,color:"#fff",fontSize:10.5,fontWeight:600,padding:"4px 7px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>WhatsApp</button>
                <button onClick={()=>window.open("viber://forward?text="+encodeURIComponent("🛍️ "+t("products",lang)+":\n"+shopItems.map(i=>"• "+i).join("\n")),"_blank")} style={{background:"#7360F2",border:"none",borderRadius:6,color:"#fff",fontSize:10.5,fontWeight:600,padding:"4px 7px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Viber</button>
                <button onClick={()=>window.open("mailto:?subject="+t("products",lang)+"&body="+encodeURIComponent("🛍️ "+t("products",lang)+":\n"+shopItems.map(i=>"• "+i).join("\n")))} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.2)",borderRadius:6,color:"#fff",fontSize:10.5,fontWeight:600,padding:"4px 7px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Email</button>
                <button onClick={()=>navigator.share?navigator.share({text:"🛍️ "+t("products",lang)+":\n"+shopItems.map(i=>"• "+i).join("\n")}):window.open("sms:?body="+encodeURIComponent("🛍️ "+t("products",lang)+":\n"+shopItems.map(i=>"• "+i).join("\n")))} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.2)",borderRadius:6,color:"#fff",fontSize:10.5,fontWeight:600,padding:"4px 7px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>SMS</button>
              </div>
            </div>
          </>)}
          {shopTab==="s"&&(<>
            {superItems.map((item,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 0",borderBottom:"1px solid "+gl}}>
                <div style={{width:34,height:34,borderRadius:7,background:gl,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>🛒</div>
                <div style={{fontSize:12.5,fontWeight:600,color:"#2B3A67",flex:1}}>{item}</div>
                <button onClick={()=>setSuperItems(superItems.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#C8BFB8",cursor:"pointer",fontSize:18,padding:4}}>×</button>
              </div>
            ))}
            <div style={{display:"flex",gap:7,marginTop:10,paddingTop:10,borderTop:"1px solid "+gl}}>
              <input value={superInput} onChange={e=>setSuperInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&superInput.trim()){setSuperItems([...superItems,superInput.trim()]);setSuperInput("");}}} placeholder={t("addtolist",lang)} style={{flex:1,padding:"8px 11px",border:"1.5px solid #DDD7D0",borderRadius:9,fontFamily:"'DM Sans',sans-serif",fontSize:12.5,outline:"none"}}/>
              <button onClick={()=>{if(superInput.trim()){setSuperItems([...superItems,superInput.trim()]);setSuperInput("");}}} style={{padding:"8px 13px",background:navy,color:"#fff",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer"}}>＋</button>
            </div>
            <div style={{background:navy,borderRadius:10,padding:"10px 12px",marginTop:10,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap" as any,gap:6}}>
              <span style={{fontSize:11,color:"rgba(255,255,255,.75)",fontWeight:500}}>{t("sendlist",lang)}</span>
              <div style={{display:"flex",gap:5}}>
                <button onClick={()=>window.open("https://wa.me/?text="+encodeURIComponent(buildShoppingList()),"_blank")} style={{background:"#25D366",border:"none",borderRadius:6,color:"#fff",fontSize:10.5,fontWeight:600,padding:"4px 7px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>WhatsApp</button>
                <button onClick={()=>window.open("viber://forward?text="+encodeURIComponent(buildShoppingList()),"_blank")} style={{background:"#7360F2",border:"none",borderRadius:6,color:"#fff",fontSize:10.5,fontWeight:600,padding:"4px 7px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Viber</button>
                <button onClick={()=>window.open("mailto:?subject=Shopping List&body="+encodeURIComponent(buildShoppingList()))} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.2)",borderRadius:6,color:"#fff",fontSize:10.5,fontWeight:600,padding:"4px 7px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Email</button>
                <button onClick={()=>navigator.share?navigator.share({text:buildShoppingList()}):window.open("sms:?body="+encodeURIComponent(buildShoppingList()))} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.2)",borderRadius:6,color:"#fff",fontSize:10.5,fontWeight:600,padding:"4px 7px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>SMS</button>
              </div>
            </div>
          </>)}
          {shopTab==="o"&&<div>
            <div style={{fontSize:12,color:"rgba(43,58,103,.55)",marginBottom:12}}>{t("offers_sub",lang)}</div>
            {offersLoading&&<div style={{textAlign:"center",fontSize:12,color:"rgba(43,58,103,.55)"}}>{t("loading",lang)}</div>}
            {!offersLoading&&offers.length===0&&<div style={{textAlign:"center",fontSize:12,color:"rgba(43,58,103,.55)"}}>{t("offers_empty",lang)}</div>}
            {offers.map((o:any)=>(
              <div key={o.id} style={{background:gl,borderRadius:12,padding:12,marginBottom:10}}>
                {o.badge&&<div style={{display:"inline-block",fontSize:10,fontWeight:700,padding:"2px 9px",borderRadius:999,background:o.badge==="promo"?"#E07B54":o.badge==="sponsored"?"#2B3A67":"#BEB4CD",color:o.badge==="promo"||o.badge==="sponsored"?"#fff":"#2B3A67",marginBottom:6}}>{displayUppercase(o.badge, lang)}</div>}
                {o.image_url&&<img src={o.image_url} alt="" style={{width:"100%",maxHeight:160,objectFit:"cover",borderRadius:10,marginBottom:8,display:"block"}}/>}
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:navy,marginBottom:4,fontWeight:600}}>{o.title}</div>
                <div style={{fontSize:12.5,color:"rgba(43,58,103,.55)",lineHeight:1.55,marginBottom:8}}>{o.body}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap" as any}}>
                  {o.link&&<a href={o.link} target="_blank" rel="noopener noreferrer" style={{display:"inline-block",fontSize:11,fontWeight:600,color:navy,textDecoration:"none",border:"1px solid "+navy,borderRadius:8,padding:"5px 12px"}}>{t("learnmore",lang)} →</a>}
                  <button onClick={()=>setShopItems(prev=>[...prev,o.title])} style={{fontSize:11,fontWeight:600,color:navy,background:"#fff",border:"1px solid "+gl,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{t("add_to_products",lang)}</button>
                  <button onClick={()=>setSuperItems(prev=>[...prev,o.title])} style={{fontSize:11,fontWeight:600,color:navy,background:"#fff",border:"1px solid "+gl,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{t("add_to_super",lang)}</button>
                </div>
              </div>
            ))}
          </div>}
        </div>}
      </div>{/* end body inner */}
      </div>{/* end body */}

      {/* LANG MISMATCH HINT */}
      {tab==="chat"&&input.trim().length>3&&(()=>{const d=detectLang(input); if(d&&d!==lang){return (<div style={{padding:"8px 16px",background:"rgba(224,123,84,.1)",borderTop:"1px solid rgba(224,123,84,.2)",fontSize:11,color:"#B5562F",lineHeight:1.4,flexShrink:0}}>💬 {t("lang_mismatch",lang).replace("{flag}",L.f+" "+L.n)}</div>);} return null;})()}
      {/* CHAT INPUT */}
      {tab==="chat"&&<div className="hm-app-composer" data-tour="chat-composer" style={{background:"#fff",borderTop:".5px solid rgba(43,58,103,.08)"}}>
        {chatPendingAttachments.length > 0 && (
          <div className="hm-chat-attach-preview">
            {chatPendingAttachments.map((att, i) => (
              <div key={`${att.name}-${i}`} className="hm-chat-attach-preview__item">
                {att.kind === "image" && att.data ? (
                  <img src={att.data} alt="" className="hm-chat-attach-preview__thumb" />
                ) : att.kind === "video" && att.data ? (
                  <video src={att.data} className="hm-chat-attach-preview__thumb" muted playsInline />
                ) : (
                  <div className="hm-chat-attach-preview__file" aria-hidden="true">📎</div>
                )}
                <span className="hm-chat-attach-preview__name">{att.name}</span>
                <button
                  type="button"
                  className="hm-chat-attach-preview__remove"
                  aria-label={lang === "el" ? "Αφαίρεση" : "Remove"}
                  onClick={() => setChatPendingAttachments((prev) => prev.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="hm-app-composer-inner">
        <div className="hm-composer-plus-wrap">
          <button
            type="button"
            className={`hm-composer-action hm-composer-plus${showChatAttachSheet ? " hm-composer-plus--open" : ""}`}
            aria-label={showChatAttachSheet ? (lang === "el" ? "Κλείσιμο μενού" : "Close menu") : (lang === "el" ? "Προσθήκη" : "Add")}
            aria-expanded={showChatAttachSheet}
            aria-haspopup="menu"
            disabled={loading || recording || chatPendingAttachments.length >= 4}
            onClick={openChatAttachPicker}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          {showChatAttachSheet && !isCoarseMobile && (
            <>
              <div className="hm-chat-attach-backdrop" onClick={() => setShowChatAttachSheet(false)} aria-hidden="true" />
              <div className="hm-chat-attach-popover" role="menu">
                <button type="button" role="menuitem" className="hm-chat-attach-popover__item" onClick={() => pickChatAttachment("gallery")}>
                  <span className="hm-chat-attach-popover__icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.7"/><circle cx="9" cy="10" r="1.5" fill="currentColor"/><path d="M4 16l4.5-4.5 3 3L14 12l6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <span>{lang === "el" ? "Φωτογραφίες" : "Photos"}</span>
                </button>
                <button type="button" role="menuitem" className="hm-chat-attach-popover__item" onClick={() => pickChatAttachment("file")}>
                  <span className="hm-chat-attach-popover__icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M14 3H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9l-4-6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M14 3v6h6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
                  </span>
                  <span>{lang === "el" ? "Αρχεία" : "Files"}</span>
                </button>
              </div>
            </>
          )}
        </div>
        {recording ? (
          <div
            aria-hidden="true"
            style={{
              flex: 1,
              height: 38,
              borderRadius: 999,
              border: "1.5px solid rgba(43,58,103,.12)",
              background: "#F7F3EF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 2.5,
              padding: "0 14px",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {micLevels.map((level, i) => (
              <span
                key={i}
                style={{
                  width: 2.5,
                  height: `${Math.round(8 + level * 22)}px`,
                  borderRadius: 999,
                  background: navy,
                  opacity: 0.35 + level * 0.65,
                  flexShrink: 0,
                  transition: "height 60ms linear, opacity 60ms linear",
                }}
              />
            ))}
          </div>
        ) : (
          <input
            ref={inputRef}
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&void sendMessage(input, chatPendingAttachments)}
            placeholder={t("typehere",lang)}
            disabled={loading}
            className="hm-chat-composer-input"
            style={{
              color: navy,
            }}
          />
        )}
        <button
          type="button"
          aria-label={recording ? "Release to send" : "Hold to speak"}
          aria-pressed={recording}
          className={`hm-composer-action hm-composer-mic${recording ? " hm-composer-mic--recording" : ""}`}
          onContextMenu={(e)=>e.preventDefault()}
          onPointerDown={(e)=>{
            if(e.button!==0||loading) return;
            e.preventDefault();
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
            startRec();
          }}
          onPointerUp={()=>stopRecAndSend()}
          onPointerCancel={()=>stopRecAndSend()}
        >
          <ChatMicIcon active={recording} />
        </button>
        <button type="button" className="hm-composer-action hm-composer-send" onClick={()=>void sendMessage(input, chatPendingAttachments)} disabled={loading||(!input.trim()&&!chatPendingAttachments.length)||recording}>➤</button>
        </div>
      </div>}

      {tab === "chat" && (
        <AppDialog
          open={showChatAttachSheet && isCoarseMobile}
          onClose={() => setShowChatAttachSheet(false)}
          size="md"
          align="bottom"
          ariaLabel={lang === "el" ? "Προσθήκη" : "Add"}
          panelClassName="hm-dialog--attach"
        >
          <div className="hm-chat-attach-sheet">
            <div className="hm-chat-attach-sheet__title">
              {lang === "el" ? "Προσθήκη" : "Add"}
            </div>
            <div className="hm-chat-attach-sheet__grid" role="menu">
              <button type="button" role="menuitem" className="hm-chat-attach-sheet__tile" onClick={() => pickChatAttachment("camera")}>
                <span className="hm-chat-attach-sheet__tile-icon" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 7h3l1.5-2h7L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.7"/><circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.7"/></svg>
                </span>
                <span className="hm-chat-attach-sheet__tile-label">{lang === "el" ? "Κάμερα" : "Camera"}</span>
              </button>
              <button type="button" role="menuitem" className="hm-chat-attach-sheet__tile" onClick={() => pickChatAttachment("gallery")}>
                <span className="hm-chat-attach-sheet__tile-icon" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.7"/><circle cx="9" cy="10" r="1.5" fill="currentColor"/><path d="M4 16l4.5-4.5 3 3L14 12l6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <span className="hm-chat-attach-sheet__tile-label">{lang === "el" ? "Φωτογραφίες" : "Photos"}</span>
              </button>
              <button type="button" role="menuitem" className="hm-chat-attach-sheet__tile" onClick={() => pickChatAttachment("file")}>
                <span className="hm-chat-attach-sheet__tile-icon" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M14 3H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9l-4-6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M14 3v6h6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
                </span>
                <span className="hm-chat-attach-sheet__tile-label">{lang === "el" ? "Αρχεία" : "Files"}</span>
              </button>
            </div>
          </div>
        </AppDialog>
      )}

      {/* TAB BAR */}
      <div ref={tabBarRef} className={`hm-app-tabbar${tabBarVisible ? "" : " is-hidden"}`}>
        <div className="hm-tab-dock hm-app-bar-inner">
          {tabs.map(tb=>{
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                type="button"
                className="hm-tab-btn"
                data-tour={`tab-${tb.id}`}
                onClick={()=>{
                  showTabBar();
                  setTab(tb.id);
                }}
              >
                <span className={`hm-tab-icon${active ? " hm-tab-icon--active" : ""}`}>
                  <AppNavIcon id={tb.id} active={active} />
                </span>
                <span
                  className={`hm-tab-label${active ? " hm-tab-label--active" : " hm-tab-label--inactive"}`}
                >
                  {tb.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
    <AppTourGuide
      open={tourOpen}
      stepIndex={tourStep}
      lang={lang}
      userName={vocativeName || displayName}
      onNext={handleTourNext}
      onBack={handleTourBack}
      onSkip={handleTourSkip}
    />
    {toasts.length > 0 && (
      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
        onUndo={(toastItem) => {
          toastItem.undo?.();
          setToasts((prev) => prev.filter((x) => x.id !== toastItem.id));
          showToast(t("undone", lang), "ok");
        }}
        dismissLabel={lang === "el" ? "Κλείσιμο" : "Dismiss"}
      />
    )}
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────
function AppLoadingShell({ lang }: { lang?: string }) {
  const isEl = normalizeAppLang(lang || localStorage.getItem("hm_pre_lang") || "el", "el") === "el";
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F5F0EB",
        fontFamily: "'DM Sans', sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <img
          src="/logo192.png"
          alt=""
          width={52}
          height={52}
          style={{ borderRadius: "50%", marginBottom: 14, display: "block", marginLeft: "auto", marginRight: "auto" }}
        />
        <div style={{ fontSize: 15, color: "#2B3A67", fontWeight: 500 }}>
          {isEl ? "Φόρτωση…" : "Loading…"}
        </div>
      </div>
    </div>
  );
}

function ensureLocalDemoToken(): string | null {
  if (!isBrowserLocalHost()) return null
  const existing = getAuthToken()
  if (existing) return existing
  const lang = normalizeAppLang(localStorage.getItem("hm_pre_lang") || "el", "el")
  const profile: Profile = { name: "Mama", childName: "", childAge: "", lang }
  setAuthToken(LOCAL_DEMO_TOKEN)
  localStorage.setItem(sk(LOCAL_DEMO_TOKEN, "profile"), JSON.stringify(profile))
  return LOCAL_DEMO_TOKEN
}

export default function App() {
  const [token, setToken] = useState<string|null>(() => getAuthToken() || ensureLocalDemoToken());
  const [resetToken, setResetToken] = useState<string>(() => new URLSearchParams(window.location.search).get("reset") || "");
  const [profile, setProfile] = useState<Profile|null>(()=>{
    const tk=getAuthToken() || ensureLocalDemoToken(); if(!tk)return null;
    try{
      const stableRaw = localStorage.getItem(sk(tk,"profile"));
      if (stableRaw) return JSON.parse(stableRaw);
      const legacyRaw = localStorage.getItem(`hm_profile_${tk}`);
      return legacyRaw ? JSON.parse(legacyRaw) : null;
    }catch{return null;}
  });
  const [subActive, setSubActive] = useState<boolean|null>(() => (isLocalDemoToken(getAuthToken()) ? true : null));
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const handleLogout=()=>{void logoutUser(token).catch(()=>{});clearAuthToken();setToken(null);setProfile(null);setSubActive(null);setMustChangePassword(false);};
  const handleLogoutRef = useRef(handleLogout);
  handleLogoutRef.current = handleLogout;

  useEffect(() => {
    if (!token) { setProfile(null); setMustChangePassword(false); return; }
    if (isLocalDemoToken(token)) {
      setMustChangePassword(false);
      setSubActive(true);
      try {
        const raw = localStorage.getItem(sk(token, "profile"));
        if (raw) setProfile(JSON.parse(raw) as Profile);
        else {
          const lang = normalizeAppLang(localStorage.getItem("hm_pre_lang") || "el", "el");
          const p: Profile = { name: "Mama", childName: "", childAge: "", lang };
          localStorage.setItem(sk(token, "profile"), JSON.stringify(p));
          setProfile(p);
        }
      } catch {
        const lang = normalizeAppLang(localStorage.getItem("hm_pre_lang") || "el", "el");
        const p: Profile = { name: "Mama", childName: "", childAge: "", lang };
        setProfile(p);
      }
      return;
    }
    const cached = (() => {
      try {
        const stableRaw = localStorage.getItem(sk(token,"profile"));
        const legacyRaw = !stableRaw ? localStorage.getItem(`hm_profile_${token}`) : null;
        const raw = stableRaw || legacyRaw;
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Profile;
        const lang = normalizeAppLang(parsed.lang || localStorage.getItem("hm_pre_lang") || "en", "en");
        if (parsed.lang !== lang) {
          const fixed = { ...parsed, lang };
          localStorage.setItem(sk(token, "profile"), JSON.stringify(fixed));
          writeStoredAppLang(lang);
          return fixed;
        }
        writeStoredAppLang(lang);
        return { ...parsed, lang };
      } catch { return null; }
    })();
    axios.get(`${API}/auth/me`, { headers: { "x-token": token } })
      .then(res => {
        const u = res.data;
        setMustChangePassword(!!u.must_change_password);
        const apiName = String(u.name || "").trim();
        if (apiName) applyAuthUserName(token, apiName);
        if (cached) {
          if (apiName && cached.name !== apiName) {
            const fixed = { ...cached, name: apiName };
            localStorage.setItem(sk(token, "profile"), JSON.stringify(fixed));
            setProfile(fixed);
            return;
          }
          setProfile(cached);
          return;
        }
        if (!apiName) {
          // Prefer signup name while profile is still being created.
          try {
            const seeded = sessionStorage.getItem("hm_signup_name");
            if (seeded?.trim()) {
              const p: Profile = {
                name: seeded.trim(),
                childName: "",
                childAge: "",
                lang: normalizeAppLang(localStorage.getItem("hm_pre_lang") || "el", "el"),
              };
              localStorage.setItem(sk(token, "profile"), JSON.stringify(p));
              setProfile(p);
            }
          } catch { /* ignore */ }
          return;
        }
        const p: Profile = { name: apiName, childName: "", childAge: "", lang: normalizeAppLang(localStorage.getItem("hm_pre_lang") || "el", "el") };
        localStorage.setItem(sk(token,"profile"), JSON.stringify(p));
        setProfile(p);
      })
      .catch(() => {
        // Keep offline/local cached profile when the API is down.
        if (cached) setProfile(cached);
        else setProfile(null);
        setMustChangePassword(false);
      });
  }, [token]);

  useEffect(() => {
    if (!token) { setSubActive(null); setTrialEndsAt(null); return; }
    if (isLocalDemoToken(token)) { setSubActive(true); setTrialEndsAt(null); return; }
    let cancelled = false;
    axios.get(`${API}/auth/status`, { headers: { "x-token": token } })
      .then(res => {
        if (cancelled) return;
        setSubActive(res.data.subscription_active !== false);
        setTrialEndsAt(res.data.is_trial ? (res.data.trial_ends_at || null) : null);
      })
      .catch(err => {
        if (cancelled) return;
        if (err.response?.status === 401) { handleLogoutRef.current(); }
        else setSubActive(true); // fail open on network/server errors
      });
    return () => { cancelled = true; };
  }, [token]);

  if(resetToken)return <ResetScreen token={resetToken} onDone={()=>{setResetToken("");window.history.replaceState({},"","/app");}}/>;
  if(!token)return <Navigate to={`${APP_ROUTE}/auth`} replace />;
  if(mustChangePassword)return <ChangePasswordScreen token={token} lang={normalizeAppLang(profile?.lang||localStorage.getItem("hm_pre_lang")||"en","en")} onDone={tk=>{setAuthToken(tk);setToken(tk);setMustChangePassword(false);}} onLogout={handleLogout}/>;
  if(subActive===false)return <Navigate to="/subscription" replace />;
  if(!profile)return <Onboarding token={token} onDone={p=>setProfile(p)}/>;
  if(subActive===null && !isLocalDemoToken(token))return <AppLoadingShell lang={profile.lang}/>;
  return (
    <AppErrorBoundary lang={profile.lang}>
      <MainApp token={token} profile={profile} onLogout={handleLogout} onExpired={()=>setSubActive(false)} onProfileUpdate={p=>{setProfile(p);localStorage.setItem(sk(token,"profile"),JSON.stringify(p));}} onTokenUpdate={tk=>{setAuthToken(tk);setToken(tk);}} trialEndsAt={trialEndsAt}/>
    </AppErrorBoundary>
  );
}
