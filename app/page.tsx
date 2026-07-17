"use client";

import { createClient, type User } from "@supabase/supabase-js";
import {
  Cake,
  Bell,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Cloudy,
  FileText,
  HeartPulse,
  House,
  Info,
  KeyRound,
  Lightbulb,
  LockKeyhole,
  MapPin,
  Mic,
  Navigation,
  Pencil,
  Phone,
  Pill,
  Plus,
  Rainbow,
  ShoppingCart,
  Siren,
  Sun,
  Thermometer,
  Users,
  Trash2,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

type Resident = {
  id: string;
  name: string;
  role: string;
  pin: string;
  color: string;
  theme?: ProfileThemeId;
  photo?: string;
};

type Reminder = {
  id: string;
  residentId: string;
  text: string;
  date: string;
  icon?: ReminderIcon;
};

type Birthday = {
  id: string;
  name: string;
  date: string;
};

type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
};

type LocationShare = {
  id: string;
  residentId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  createdAt: string;
  expiresAt: string;
};

type Household = {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  ownerResidentId?: string;
  joinedByCode?: boolean;
};

type AppState = {
  household: Household | null;
  residents: Resident[];
  reminders: Reminder[];
  birthdays: Birthday[];
  emergencyContacts: EmergencyContact[];
  locationShares: LocationShare[];
};

type WeatherMood = "sunny" | "partly" | "cloudy" | "rain" | "storm" | "snow" | "fog" | "rainbow";

type TodayWeather = {
  status: "loading" | "ready" | "unavailable";
  temperature?: number;
  description: string;
  season: string;
  mood: WeatherMood;
};

type StarterResidentInput = {
  name: string;
  role: string;
  pin: string;
};

type ContactPickerContact = {
  name?: string[];
  tel?: string[];
};

type ContactPickerNavigator = Navigator & {
  contacts?: {
    select: (
      properties: Array<"name" | "tel">,
      options?: { multiple?: boolean },
    ) => Promise<ContactPickerContact[]>;
  };
};

type ShareNavigator = Navigator & {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
};

type ViewTransitionDocument = Document & {
  startViewTransition: (callback: () => void) => {
    finished: Promise<void>;
  };
};

type SpeechRecognitionResultEvent = Event & {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type SpeechRecognitionErrorEvent = Event & {
  error?: string;
};

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
};

const STORAGE_KEY = "jtag-mvp-state-v2";
const LAST_RESIDENT_KEY = "jtag-last-resident-id-v2";
const CALENDAR_VIEW_KEY = "jtag-calendar-view-mode";
const RECENT_HOUSEHOLDS_KEY = "jtag-recent-households-v1";
const LAST_AUTH_EMAIL_KEY = "jtag-last-auth-email-v1";
const DISMISSED_NOTIFICATIONS_KEY = "jtag-dismissed-notifications-v1";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
          storageKey: "jtag-auth-session-v1",
        },
      })
    : null;
const MODAL_EXIT_MS = 220;
const PREPARING_HOUSEHOLD_MS = 1450;
const WELCOME_HOUSEHOLD_MS = 3600;

type CalendarViewMode = "calendar" | "list";
type ReminderIcon = "general" | "shopping" | "lightbulb" | "medicine" | "home" | "document";
type ProfileThemeId = "default" | "blue-light" | "aurora" | "green-home" | "graphite";
type AppNotification = {
  id: string;
  kind: "reminder" | "birthday" | "location";
  title: string;
  body: string;
  action: "reminderCalendar" | "birthdayCalendar" | "location";
  locationShareId?: string;
};
type AvatarOption = {
  id: string;
  label: string;
  src: string;
};

type RecentHousehold = {
  id: string;
  name: string;
  code: string;
  lastAccessedAt: string;
};

type HouseholdMemberRow = {
  household_id: string;
  user_id: string;
  role: "owner" | "member";
};

type HouseholdRow = {
  id: string;
  name: string;
  code: string;
  owner_resident_id: string | null;
  created_at: string;
};

type ResidentRow = {
  id: string;
  household_id: string;
  name: string;
  role: string;
  pin: string;
  color: string;
  photo_url: string | null;
  theme?: string | null;
};

type ReminderRow = {
  id: string;
  household_id: string;
  resident_id: string;
  text: string;
  date: string;
  icon: string;
};

type BirthdayRow = {
  id: string;
  household_id: string;
  name: string;
  date: string;
};

type EmergencyContactRow = {
  id: string;
  household_id: string;
  name: string;
  phone: string;
};

type LocationShareRow = {
  id: string;
  household_id: string;
  resident_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  expires_at: string;
  created_at: string;
};

const reminderIconOptions: Array<{
  id: ReminderIcon;
  label: string;
  Icon: LucideIcon;
}> = [
  { id: "general", label: "Geral", Icon: Bell },
  { id: "shopping", label: "Compra", Icon: ShoppingCart },
  { id: "lightbulb", label: "Ideia", Icon: Lightbulb },
  { id: "medicine", label: "Remédio", Icon: Pill },
  { id: "home", label: "Casa", Icon: House },
  { id: "document", label: "Documento", Icon: FileText },
];

const reminderIconMap = Object.fromEntries(
  reminderIconOptions.map((option) => [option.id, option]),
) as Record<ReminderIcon, (typeof reminderIconOptions)[number]>;

const profileThemes: Array<{
  id: ProfileThemeId;
  label: string;
  swatches: [string, string, string];
}> = [
  {
    id: "default",
    label: "J-tag",
    swatches: ["#e50914", "#2f80ed", "#050505"],
  },
  {
    id: "blue-light",
    label: "Azul claro",
    swatches: ["#eaf6ff", "#4aa3ff", "#0f5fa8"],
  },
  {
    id: "aurora",
    label: "Aurora",
    swatches: ["#ff4fd8", "#7c5cff", "#080616"],
  },
  {
    id: "green-home",
    label: "Verde casa",
    swatches: ["#35d07f", "#c8ff8c", "#06130d"],
  },
  {
    id: "graphite",
    label: "Grafite",
    swatches: ["#d8dde4", "#f4b860", "#08090b"],
  },
];

function isProfileTheme(value: string): value is ProfileThemeId {
  return profileThemes.some((theme) => theme.id === value);
}

function getProfileTheme(value?: string | null): ProfileThemeId {
  return value && isProfileTheme(value) ? value : "default";
}

function getScreenShellClass(theme?: string | null) {
  return `screen-shell theme-${getProfileTheme(theme)}`;
}

const releaseNotes = {
  version: "v0.5",
  title: "Novidades do J-tag",
  date: "16/07/2026",
  items: [
    "Cada perfil agora pode escolher entre 5 temas visuais, incluindo o padrão J-tag e um tema claro azul.",
    "A troca de tema tem preview com view transition antes de salvar no perfil.",
    "Login fica salvo no aparelho e pode ir direto para a tela de boas-vindas quando a sessão existir.",
    "A tela de boas-vindas da casa ficou mais longa e suave antes de abrir o painel.",
    "Modais ganharam animações profissionais de abertura e fechamento.",
    "O convite por link ficou mais limpo e sem textos técnicos desnecessários.",
    "O dashboard agora mostra previsão do tempo com temperatura, estação do ano e ícones animados.",
    "A central de notificações agora reúne lembretes, aniversários e localização compartilhada.",
    "O modo lista dos calendários virou uma timeline vertical com dias vazios e eventos em sequência.",
    "Moradores podem compartilhar a localização por 10 minutos ou 1 hora com a família.",
  ],
};

function avatarDataUrl(seed: string, colors: [string, string, string], shape: string) {
  const [base, accent, glow] = colors;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="bg-${seed}" x1="22" y1="10" x2="142" y2="154" gradientUnits="userSpaceOnUse">
          <stop stop-color="${base}"/>
          <stop offset=".55" stop-color="#171717"/>
          <stop offset="1" stop-color="${accent}"/>
        </linearGradient>
        <radialGradient id="glow-${seed}" cx="54" cy="38" r="92" gradientUnits="userSpaceOnUse">
          <stop stop-color="${glow}" stop-opacity=".9"/>
          <stop offset=".58" stop-color="${glow}" stop-opacity=".12"/>
          <stop offset="1" stop-color="${glow}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="160" height="160" rx="26" fill="url(#bg-${seed})"/>
      <rect width="160" height="160" rx="26" fill="url(#glow-${seed})"/>
      <path d="${shape}" fill="${glow}" fill-opacity=".82"/>
      <path d="M28 126c20-18 84-18 104 0" stroke="white" stroke-opacity=".22" stroke-width="12" stroke-linecap="round"/>
      <circle cx="80" cy="66" r="28" fill="white" fill-opacity=".18"/>
      <circle cx="69" cy="61" r="6" fill="white" fill-opacity=".72"/>
      <circle cx="91" cy="61" r="6" fill="white" fill-opacity=".72"/>
      <path d="M68 82c8 7 16 7 24 0" stroke="white" stroke-width="5" stroke-linecap="round" fill="none" opacity=".74"/>
    </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}

const avatarOptions: AvatarOption[] = [
  {
    id: "ruby",
    label: "Vermelho",
    src: avatarDataUrl("ruby", ["#e50914", "#6b0710", "#ff7a84"], "M32 36c26-20 70-19 96 2-20 2-24 28-48 28S54 38 32 36Z"),
  },
  {
    id: "ocean",
    label: "Azul",
    src: avatarDataUrl("ocean", ["#1f6feb", "#0f3d68", "#8fc1ff"], "M34 74c16-34 77-44 96-8-31-10-50 28-82 8Z"),
  },
  {
    id: "forest",
    label: "Verde",
    src: avatarDataUrl("forest", ["#1f8f58", "#123b2a", "#87f0b1"], "M80 22c28 18 42 42 36 72-18-20-54-20-72 0-6-30 8-54 36-72Z"),
  },
  {
    id: "sunset",
    label: "Dourado",
    src: avatarDataUrl("sunset", ["#f2994a", "#6d3716", "#ffd38d"], "M30 70c18-30 32-42 50-42s32 12 50 42c-20 10-80 10-100 0Z"),
  },
  {
    id: "mono",
    label: "Grafite",
    src: avatarDataUrl("mono", ["#444", "#111", "#d7d7d7"], "M39 40h82v28c-24-10-58-10-82 0V40Z"),
  },
  {
    id: "rose",
    label: "Rosa",
    src: avatarDataUrl("rose", ["#db2777", "#5b1234", "#ffb3d0"], "M80 25c19 0 35 16 35 35 0 26-35 47-35 47S45 86 45 60c0-19 16-35 35-35Z"),
  },
];

const defaultState: AppState = {
  household: null,
  residents: [],
  reminders: [],
  birthdays: [],
  emergencyContacts: [],
  locationShares: [],
};

function mergeSeedItems<T extends { id: string }>(storedItems: T[] | undefined, seedItems: T[]) {
  const mergedItems = [...(storedItems ?? [])];
  const storedIds = new Set(mergedItems.map((item) => item.id));

  seedItems.forEach((item) => {
    if (!storedIds.has(item.id)) {
      mergedItems.push(item);
    }
  });

  return mergedItems;
}

function isReminderIcon(value: string): value is ReminderIcon {
  return value in reminderIconMap;
}

function inferReminderIcon(reminder: Reminder): ReminderIcon {
  if (reminder.icon && isReminderIcon(reminder.icon)) {
    return reminder.icon;
  }

  const normalizedText = reminder.text.toLowerCase();

  if (normalizedText.includes("compr")) {
    return "shopping";
  }

  if (
    normalizedText.includes("remedio") ||
    normalizedText.includes("remédio") ||
    normalizedText.includes("consulta")
  ) {
    return "medicine";
  }

  if (normalizedText.includes("document")) {
    return "document";
  }

  if (
    normalizedText.includes("luz") ||
    normalizedText.includes("lamp") ||
    normalizedText.includes("ideia")
  ) {
    return "lightbulb";
  }

  if (normalizedText.includes("casa")) {
    return "home";
  }

  return "general";
}

function normalizeReminder(reminder: Reminder): Reminder {
  return {
    ...reminder,
    icon: inferReminderIcon(reminder),
  };
}

function generateHouseholdCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function normalizeHouseholdCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8);
}

function buildInviteText(household: Household) {
  const inviteLink = buildInviteLink(household);
  return `Convite para entrar na família ${household.name} no J-tag. Código da casa: ${household.code}${inviteLink ? `\n${inviteLink}` : ""}`;
}

function buildInviteLink(household: Household) {
  if (typeof window === "undefined") {
    return "";
  }

  return `${window.location.origin}?lar=${household.code}`;
}

function loadState(): AppState {
  if (typeof window === "undefined") {
    return defaultState;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return defaultState;
  }

  try {
    const parsed = JSON.parse(stored) as AppState;

    return {
      ...defaultState,
      ...parsed,
      household: parsed.household ?? null,
      reminders: mergeSeedItems(parsed.reminders, defaultState.reminders).map(normalizeReminder),
      birthdays: mergeSeedItems(parsed.birthdays, defaultState.birthdays),
      emergencyContacts: parsed.emergencyContacts ?? [],
      locationShares: parsed.locationShares ?? [],
      residents: (parsed.residents ?? defaultState.residents).map((resident, index) => ({
        ...resident,
        color: resident.color ?? ["#e50914", "#2f80ed", "#f2994a", "#27ae60"][index % 4],
        theme: getProfileTheme(resident.theme),
      })),
    };
  } catch {
    return defaultState;
  }
}

function saveState(state: AppState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadRecentHouseholds() {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(RECENT_HOUSEHOLDS_KEY);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as RecentHousehold[];
    return parsed
      .filter((item) => item.id && item.name && item.code)
      .sort((left, right) => right.lastAccessedAt.localeCompare(left.lastAccessedAt))
      .slice(0, 4);
  } catch {
    return [];
  }
}

function saveRecentHouseholds(households: RecentHousehold[]) {
  window.localStorage.setItem(RECENT_HOUSEHOLDS_KEY, JSON.stringify(households.slice(0, 4)));
}

function rememberHousehold(household: Household) {
  const nextHousehold: RecentHousehold = {
    id: household.id,
    name: household.name,
    code: household.code,
    lastAccessedAt: new Date().toISOString(),
  };
  const existingHouseholds = loadRecentHouseholds().filter((item) => item.id !== household.id);
  saveRecentHouseholds([nextHousehold, ...existingHouseholds]);
}

function mapHousehold(row: HouseholdRow): Household {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    createdAt: row.created_at,
    ownerResidentId: row.owner_resident_id ?? undefined,
  };
}

function mapResident(row: ResidentRow): Resident {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    pin: row.pin,
    color: row.color,
    theme: getProfileTheme(row.theme),
    photo: row.photo_url ?? undefined,
  };
}

function mapReminder(row: ReminderRow): Reminder {
  return normalizeReminder({
    id: row.id,
    residentId: row.resident_id,
    text: row.text,
    date: row.date,
    icon: isReminderIcon(row.icon) ? row.icon : "general",
  });
}

function mapBirthday(row: BirthdayRow): Birthday {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
  };
}

function mapEmergencyContact(row: EmergencyContactRow): EmergencyContact {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
  };
}

function mapLocationShare(row: LocationShareRow): LocationShare {
  return {
    id: row.id,
    residentId: row.resident_id,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy ?? undefined,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

async function loadRemoteStateByHousehold(household: HouseholdRow): Promise<AppState | null> {
  if (!supabase) {
    return null;
  }

  const [residentsResult, remindersResult, birthdaysResult, contactsResult, locationsResult] = await Promise.all([
    supabase.from("residents").select("*").eq("household_id", household.id).order("created_at"),
    supabase.from("reminders").select("*").eq("household_id", household.id).order("created_at", { ascending: false }),
    supabase.from("birthdays").select("*").eq("household_id", household.id).order("created_at", { ascending: false }),
    supabase.from("emergency_contacts").select("*").eq("household_id", household.id).order("created_at"),
    supabase.from("location_shares").select("*").eq("household_id", household.id).order("created_at", { ascending: false }),
  ]);

  if (residentsResult.error || remindersResult.error || birthdaysResult.error || contactsResult.error) {
    return null;
  }

  return {
    household: mapHousehold(household),
    residents: ((residentsResult.data ?? []) as ResidentRow[]).map(mapResident),
    reminders: ((remindersResult.data ?? []) as ReminderRow[]).map(mapReminder),
    birthdays: ((birthdaysResult.data ?? []) as BirthdayRow[]).map(mapBirthday),
    emergencyContacts: ((contactsResult.data ?? []) as EmergencyContactRow[]).map(mapEmergencyContact),
    locationShares: locationsResult.error ? [] : ((locationsResult.data ?? []) as LocationShareRow[]).map(mapLocationShare),
  };
}

async function loadRemoteStateByCode(code: string) {
  if (!supabase || !code) {
    return null;
  }

  const { data, error } = await supabase
    .from("households")
    .select("*")
    .eq("code", normalizeHouseholdCode(code))
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return loadRemoteStateByHousehold(data as HouseholdRow);
}

async function loadRemoteStateById(householdId: string) {
  if (!supabase || !householdId) {
    return null;
  }

  const { data, error } = await supabase.from("households").select("*").eq("id", householdId).maybeSingle();

  if (error || !data) {
    return null;
  }

  return loadRemoteStateByHousehold(data as HouseholdRow);
}

async function loadAccountHouseholds(userId: string): Promise<RecentHousehold[]> {
  if (!supabase || !userId) {
    return [];
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id,user_id,role")
    .eq("user_id", userId);

  if (membershipError || !memberships?.length) {
    return [];
  }

  const householdIds = ((memberships ?? []) as HouseholdMemberRow[]).map((membership) => membership.household_id);
  const { data: households, error: householdError } = await supabase
    .from("households")
    .select("*")
    .in("id", householdIds);

  if (householdError || !households?.length) {
    return [];
  }

  return ((households ?? []) as HouseholdRow[]).map((household) => ({
    id: household.id,
    name: household.name,
    code: household.code,
    lastAccessedAt: new Date().toISOString(),
  }));
}

async function upsertRemoteHouseholdMember(householdId: string, userId: string, role: "owner" | "member") {
  if (!supabase || !householdId || !userId) {
    return false;
  }

  const { error } = await supabase.from("household_members").upsert(
    {
      household_id: householdId,
      user_id: userId,
      role,
    },
    { onConflict: "household_id,user_id" },
  );

  return !error;
}

async function createRemoteHousehold(household: Household, resident: Resident) {
  if (!supabase) {
    return false;
  }

  const { error: householdError } = await supabase.from("households").insert({
    id: household.id,
    name: household.name,
    code: household.code,
    created_at: household.createdAt,
  });

  if (householdError) {
    return false;
  }

  const residentPayload = {
    id: resident.id,
    household_id: household.id,
    name: resident.name,
    role: resident.role,
    pin: resident.pin,
    color: resident.color,
    photo_url: resident.photo ?? null,
    theme: getProfileTheme(resident.theme),
  };

  let { error: residentError } = await supabase.from("residents").insert(residentPayload);
  if (residentError && residentError.message.toLowerCase().includes("theme")) {
    const { theme: _theme, ...fallbackPayload } = residentPayload;
    const fallbackResult = await supabase.from("residents").insert(fallbackPayload);
    residentError = fallbackResult.error;
  }

  if (residentError) {
    return false;
  }

  await supabase.from("households").update({ owner_resident_id: resident.id }).eq("id", household.id);
  await supabase.from("household_invites").insert({
    household_id: household.id,
    code: household.code,
    created_by_resident_id: resident.id,
  });

  return true;
}

async function insertRemoteResident(householdId: string, resident: Resident) {
  if (!supabase) {
    return false;
  }

  const residentPayload = {
    id: resident.id,
    household_id: householdId,
    name: resident.name,
    role: resident.role,
    pin: resident.pin,
    color: resident.color,
    photo_url: resident.photo ?? null,
    theme: getProfileTheme(resident.theme),
  };

  let { error } = await supabase.from("residents").insert(residentPayload);
  if (error && error.message.toLowerCase().includes("theme")) {
    const { theme: _theme, ...fallbackPayload } = residentPayload;
    const fallbackResult = await supabase.from("residents").insert(fallbackPayload);
    error = fallbackResult.error;
  }

  return !error;
}

async function updateRemoteResident(resident: Resident) {
  if (!supabase) {
    return false;
  }

  const updatePayload = {
    name: resident.name,
    role: resident.role,
    pin: resident.pin,
    photo_url: resident.photo ?? null,
    theme: getProfileTheme(resident.theme),
  };

  let { error } = await supabase
    .from("residents")
    .update(updatePayload)
    .eq("id", resident.id);

  if (error && error.message.toLowerCase().includes("theme")) {
    const { theme: _theme, ...fallbackPayload } = updatePayload;
    const fallbackResult = await supabase.from("residents").update(fallbackPayload).eq("id", resident.id);
    error = fallbackResult.error;
  }

  return !error;
}

async function deleteRemoteResident(residentId: string) {
  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from("residents").delete().eq("id", residentId);
  return !error;
}

async function insertRemoteReminder(householdId: string, reminder: Reminder) {
  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from("reminders").insert({
    id: reminder.id,
    household_id: householdId,
    resident_id: reminder.residentId,
    text: reminder.text,
    date: reminder.date,
    icon: reminder.icon ?? "general",
  });

  return !error;
}

async function insertRemoteBirthday(householdId: string, birthday: Birthday) {
  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from("birthdays").insert({
    id: birthday.id,
    household_id: householdId,
    name: birthday.name,
    date: birthday.date,
  });

  return !error;
}

async function insertRemoteLocationShare(householdId: string, share: LocationShare) {
  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from("location_shares").insert({
    id: share.id,
    household_id: householdId,
    resident_id: share.residentId,
    latitude: share.latitude,
    longitude: share.longitude,
    accuracy: share.accuracy ?? null,
    expires_at: share.expiresAt,
    created_at: share.createdAt,
  });

  return !error;
}

async function deleteRemoteReminder(reminderId: string) {
  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from("reminders").delete().eq("id", reminderId);
  return !error;
}

async function deleteRemoteBirthday(birthdayId: string) {
  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from("birthdays").delete().eq("id", birthdayId);
  return !error;
}

async function insertRemoteEmergencyContact(householdId: string, contact: EmergencyContact) {
  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from("emergency_contacts").insert({
    id: contact.id,
    household_id: householdId,
    name: contact.name,
    phone: contact.phone,
  });

  return !error;
}

async function deleteRemoteEmergencyContact(contactId: string) {
  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from("emergency_contacts").delete().eq("id", contactId);
  return !error;
}

function saveLastResident(residentId: string) {
  window.localStorage.setItem(LAST_RESIDENT_KEY, residentId);
}

function clearLastResident() {
  window.localStorage.removeItem(LAST_RESIDENT_KEY);
}

function getSavedCalendarView(kind: "reminder" | "birthday") {
  if (typeof window === "undefined") {
    return "calendar";
  }

  const stored = window.localStorage.getItem(`${CALENDAR_VIEW_KEY}-${kind}`);
  return stored === "list" ? "list" : "calendar";
}

function saveCalendarView(kind: "reminder" | "birthday", mode: CalendarViewMode) {
  window.localStorage.setItem(`${CALENDAR_VIEW_KEY}-${kind}`, mode);
}

function loadDismissedNotifications() {
  try {
    const stored = window.localStorage.getItem(DISMISSED_NOTIFICATIONS_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

function saveDismissedNotifications(ids: string[]) {
  window.localStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify(ids));
}

function runScreenTransition(kind: "enter" | "back" | "soft", update: () => void) {
  if (typeof document === "undefined" || !("startViewTransition" in document)) {
    update();
    return;
  }

  const transitionDocument = document as ViewTransitionDocument;
  document.documentElement.dataset.transition = kind;
  const transition = transitionDocument.startViewTransition(() => {
    flushSync(update);
  });

  transition.finished.finally(() => {
    delete document.documentElement.dataset.transition;
  });
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatDateLabel(value: string) {
  if (!value) {
    return "Sem data";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  return value;
}

function formatBirthdayValue(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [, month, day] = value.split("-");
    return `${day}/${month}`;
  }

  return value;
}

function parseReminderDate(value: string) {
  const normalized = value.trim().toLowerCase();
  const today = startOfToday();

  if (!normalized || normalized === "sem data") {
    return null;
  }

  if (normalized === "hoje") {
    return today;
  }

  if (normalized === "amanha" || normalized === "amanhã") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  if (/^\d{2}\/\d{2}(\/\d{4})?$/.test(normalized)) {
    const [day, month, year] = normalized.split("/").map(Number);
    return new Date(year || today.getFullYear(), month - 1, day);
  }

  return null;
}

function parseBirthdayDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, day, month] = match;
  const today = startOfToday();
  return new Date(today.getFullYear(), Number(month) - 1, Number(day));
}

function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function formatDistanceLabel(distance: number) {
  if (distance === 0) {
    return "Hoje";
  }

  if (distance === 1) {
    return "Amanhã";
  }

  if (distance < 0) {
    return `${Math.abs(distance)}d atrás`;
  }

  return `Em ${distance}d`;
}

function getSouthernSeason(date = new Date()) {
  const marker = Number(`${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`);

  if (marker >= 1221 || marker <= 319) {
    return "Verão";
  }

  if (marker >= 320 && marker <= 620) {
    return "Outono";
  }

  if (marker >= 621 && marker <= 922) {
    return "Inverno";
  }

  return "Primavera";
}

function getWeatherMood(code: number): Pick<TodayWeather, "description" | "mood"> {
  if (code === 0) {
    return { description: "Sol aberto", mood: "sunny" };
  }

  if (code === 1) {
    return { description: "Sol suave", mood: "rainbow" };
  }

  if (code === 2) {
    return { description: "Sol e nuvens", mood: "partly" };
  }

  if (code === 3) {
    return { description: "Nublado", mood: "cloudy" };
  }

  if (code === 45 || code === 48) {
    return { description: "Neblina", mood: "fog" };
  }

  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return { description: "Chuva", mood: "rain" };
  }

  if (code >= 71 && code <= 77) {
    return { description: "Frio intenso", mood: "snow" };
  }

  if (code >= 95) {
    return { description: "Temporal", mood: "storm" };
  }

  return { description: "Clima do dia", mood: "partly" };
}

function getDefaultWeather(): TodayWeather {
  return {
    status: "loading",
    description: "Buscando clima",
    season: getSouthernSeason(),
    mood: "partly",
  };
}

function getReminderPreview(reminders: Reminder[]) {
  const today = startOfToday();
  const dated = reminders
    .map((reminder) => {
      const parsedDate = parseReminderDate(reminder.date);
      return parsedDate
        ? {
            ...reminder,
            parsedDate,
            distance: daysBetween(today, parsedDate),
          }
        : null;
    })
    .filter((reminder): reminder is Reminder & { parsedDate: Date; distance: number } =>
      Boolean(reminder),
    );

  const previous = dated
    .filter((reminder) => reminder.distance < 0)
    .sort((a, b) => b.distance - a.distance)[0];
  const current = dated
    .filter((reminder) => reminder.distance >= 0)
    .sort((a, b) => a.distance - b.distance)[0];
  const nextTwo = dated
    .filter((reminder) => reminder.id !== current?.id && reminder.distance > 0)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 2);

  return [previous, current, ...nextTwo].filter(Boolean);
}

function getBirthdayPreview(birthdays: Birthday[]) {
  const today = startOfToday();
  const dated = birthdays
    .map((birthday) => {
      const parsedDate = parseBirthdayDate(formatBirthdayValue(birthday.date));
      if (!parsedDate) {
        return null;
      }

      const distance = daysBetween(today, parsedDate);
      const nextDate = new Date(parsedDate);
      if (distance < 0) {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }

      return {
        ...birthday,
        distance,
        nextDistance: daysBetween(today, nextDate),
      };
    })
    .filter((birthday): birthday is Birthday & { distance: number; nextDistance: number } =>
      Boolean(birthday),
    );

  const previous = dated
    .filter((birthday) => birthday.distance < 0)
    .sort((a, b) => b.distance - a.distance)[0];
  const current = dated
    .filter((birthday) => birthday.distance >= 0)
    .sort((a, b) => a.nextDistance - b.nextDistance)[0];
  const nextTwo = dated
    .filter((birthday) => birthday.id !== current?.id)
    .sort((a, b) => a.nextDistance - b.nextDistance)
    .slice(0, 2);

  return [previous, current, ...nextTwo].filter(Boolean);
}

function getCalendarDays(referenceDate = startOfToday()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    return {
      date,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      key: date.toISOString().slice(0, 10),
    };
  });
}

function sameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function normalizeVoiceCommand(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isVoiceCancelCommand(value: string) {
  const command = normalizeVoiceCommand(value)
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return [
    "cancela",
    "cancelar",
    "cancelar isso",
    "cancela isso",
    "para",
    "parar",
    "desiste",
    "desistir",
    "nao quero",
    "nao precisa",
  ].some((cancelCommand) => command === cancelCommand || command.includes(`${cancelCommand} `));
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseSpokenNumber(value: string) {
  const normalized = normalizeVoiceCommand(value).trim();
  const numericValue = Number(normalized);

  if (Number.isInteger(numericValue) && numericValue > 0) {
    return numericValue;
  }

  const numbers: Record<string, number> = {
    um: 1,
    uma: 1,
    primeiro: 1,
    dois: 2,
    duas: 2,
    tres: 3,
    quatro: 4,
    cinco: 5,
    seis: 6,
    sete: 7,
    oito: 8,
    nove: 9,
    dez: 10,
    onze: 11,
    doze: 12,
    treze: 13,
    quatorze: 14,
    catorze: 14,
    quinze: 15,
    dezesseis: 16,
    dezassete: 17,
    dezessete: 17,
    dezoito: 18,
    dezenove: 19,
    vinte: 20,
    trinta: 30,
  };

  if (numbers[normalized]) {
    return numbers[normalized];
  }

  if (normalized.startsWith("vinte e ")) {
    return 20 + (numbers[normalized.replace("vinte e ", "")] ?? 0);
  }

  if (normalized.startsWith("trinta e ")) {
    return 30 + (numbers[normalized.replace("trinta e ", "")] ?? 0);
  }

  return null;
}

function parseSpokenDateParts(value: string) {
  const normalized = normalizeVoiceCommand(value)
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const today = startOfToday();
  const months: Record<string, number> = {
    janeiro: 1,
    fevereiro: 2,
    marco: 3,
    março: 3,
    abril: 4,
    maio: 5,
    junho: 6,
    julho: 7,
    agosto: 8,
    setembro: 9,
    outubro: 10,
    novembro: 11,
    dezembro: 12,
  };

  if (normalized === "hoje") {
    return { day: today.getDate(), month: today.getMonth() + 1, year: today.getFullYear() };
  }

  if (normalized === "amanha" || normalized === "amanhã") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { day: tomorrow.getDate(), month: tomorrow.getMonth() + 1, year: tomorrow.getFullYear() };
  }

  const slashMatch = normalized.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{4}))?$/);
  if (slashMatch) {
    return {
      day: Number(slashMatch[1]),
      month: Number(slashMatch[2]),
      year: slashMatch[3] ? Number(slashMatch[3]) : today.getFullYear(),
    };
  }

  const textMatch = normalized.match(/^(.+?) de ([a-zç]+)(?: de (\d{4}))?$/);
  if (textMatch) {
    const day = parseSpokenNumber(textMatch[1]);
    const month = months[textMatch[2]];

    if (day && month) {
      return {
        day,
        month,
        year: textMatch[3] ? Number(textMatch[3]) : today.getFullYear(),
      };
    }
  }

  return null;
}

function parseSpokenReminderDate(value: string) {
  const parts = parseSpokenDateParts(value);

  if (!parts || parts.day < 1 || parts.day > 31 || parts.month < 1 || parts.month > 12) {
    return null;
  }

  return formatDateInputValue(new Date(parts.year, parts.month - 1, parts.day));
}

function parseSpokenBirthdayDate(value: string) {
  const parts = parseSpokenDateParts(value);

  if (!parts || parts.day < 1 || parts.day > 31 || parts.month < 1 || parts.month > 12) {
    return null;
  }

  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}`;
}

function useModalClose(onClose: () => void) {
  const [isClosing, setIsClosing] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  function requestClose() {
    if (timerRef.current || isClosing) {
      return;
    }

    setIsClosing(true);
    timerRef.current = window.setTimeout(() => {
      onClose();
    }, MODAL_EXIT_MS);
  }

  return {
    backdropClassName: `modal-backdrop ${isClosing ? "modal-backdrop-closing" : ""}`,
    requestClose,
  };
}

export default function HomePage() {
  const [appState, setAppState] = useState<AppState>(defaultState);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [activeResident, setActiveResident] = useState<Resident | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [showNewResident, setShowNewResident] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showHouseholdInvite, setShowHouseholdInvite] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLocationShare, setShowLocationShare] = useState(false);
  const [selectedLocationShare, setSelectedLocationShare] = useState<LocationShare | null>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState("");
  const [authTransitionActive, setAuthTransitionActive] = useState(false);
  const [welcomeHouseholdName, setWelcomeHouseholdName] = useState("");
  const [recentHouseholds, setRecentHouseholds] = useState<RecentHousehold[]>([]);
  const [accountHouseholds, setAccountHouseholds] = useState<RecentHousehold[]>([]);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [todayWeather, setTodayWeather] = useState<TodayWeather>(() => getDefaultWeather());
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>([]);
  const [profileModal, setProfileModal] = useState<
    "reminder" | "birthday" | "edit" | "reminderCalendar" | "birthdayCalendar" | null
  >(null);
  const [newResidentPhoto, setNewResidentPhoto] = useState("");
  const [editResidentPhoto, setEditResidentPhoto] = useState("");
  const [themePreview, setThemePreview] = useState<ProfileThemeId | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const pendingVoiceHandlerRef = useRef<((transcript: string) => void) | null>(null);
  const activeRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const speechFallbackTimerRef = useRef<number | null>(null);
  const welcomeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const storedState = loadState();
    const lastResidentId = window.localStorage.getItem(LAST_RESIDENT_KEY);
    const lastResident = storedState.residents.find((resident) => resident.id === lastResidentId);
    const inviteCode = normalizeHouseholdCode(new URLSearchParams(window.location.search).get("lar") ?? "");
    const shouldStartFromInvite = Boolean(inviteCode);

    setRecentHouseholds(loadRecentHouseholds());
    setDismissedNotifications(loadDismissedNotifications());
    setAppState(shouldStartFromInvite ? defaultState : storedState);
    if (shouldStartFromInvite) {
      setPendingInviteCode(inviteCode);
      setActiveResident(null);
      setSelectedResident(null);
    } else if (storedState.household && lastResident) {
      setActiveResident(null);
    }

    async function hydrateRemoteState() {
      const sessionResult = supabase ? await supabase.auth.getSession() : null;
      const user = sessionResult?.data.session?.user ?? null;
      const userHouseholds = user ? await loadAccountHouseholds(user.id) : [];
      const defaultAccountHousehold = !storedState.household && !inviteCode && userHouseholds.length === 1
        ? userHouseholds[0]
        : null;
      const remoteState = inviteCode
        ? await loadRemoteStateByCode(inviteCode)
        : storedState.household
          ? await loadRemoteStateById(storedState.household.id)
          : defaultAccountHousehold
            ? await loadRemoteStateById(defaultAccountHousehold.id)
          : null;

      if (!isMounted) {
        return;
      }

      setAuthUser(user);
      setAccountHouseholds(userHouseholds);
      setAuthLoading(false);

      if (!remoteState) {
        return;
      }

      if (inviteCode) {
        setPendingInviteCode(inviteCode);
        const isAlreadyMember =
          Boolean(remoteState.household) &&
          userHouseholds.some((household) => household.id === remoteState.household?.id);

        if (!isAlreadyMember) {
          setAppState(defaultState);
          setActiveResident(null);
          setSelectedResident(null);
          return;
        }
      }

      setAppState(remoteState);
      if (remoteState.household) {
        rememberHousehold(remoteState.household);
        setRecentHouseholds(loadRecentHouseholds());
      }
      setActiveResident(null);
      if (inviteCode) {
        setPendingInviteCode(inviteCode);
      }
    }

    hydrateRemoteState();
    const { data: authSubscription } = supabase?.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setAuthUser(nextUser);
      setAuthLoading(false);
      if (!nextUser) {
        setAccountHouseholds([]);
        return;
      }

      void loadAccountHouseholds(nextUser.id).then((households) => {
        if (isMounted) {
          setAccountHouseholds(households);
        }
      });
    }) ?? { data: { subscription: null } };

    const timer = window.setTimeout(() => setShowSplash(false), 1350);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
      if (welcomeTimerRef.current) {
        window.clearTimeout(welcomeTimerRef.current);
      }
      authSubscription.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadWeather(latitude: number, longitude: number) {
      try {
        const params = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          current: "temperature_2m,weather_code",
          timezone: "auto",
        });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);

        if (!response.ok) {
          throw new Error("Weather request failed");
        }

        const data = (await response.json()) as {
          current?: {
            temperature_2m?: number;
            weather_code?: number;
          };
        };
        const code = Number(data.current?.weather_code ?? 2);
        const mood = getWeatherMood(code);

        if (isMounted) {
          setTodayWeather({
            status: "ready",
            temperature:
              typeof data.current?.temperature_2m === "number" ? Math.round(data.current.temperature_2m) : undefined,
            description: mood.description,
            season: getSouthernSeason(),
            mood: mood.mood,
          });
        }
      } catch {
        if (isMounted) {
          setTodayWeather({
            status: "unavailable",
            description: "Clima indisponível",
            season: getSouthernSeason(),
            mood: "partly",
          });
        }
      }
    }

    if (!navigator.geolocation) {
      setTodayWeather({
        status: "unavailable",
        description: "Sem localização",
        season: getSouthernSeason(),
        mood: "partly",
      });
      return () => {
        isMounted = false;
      };
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void loadWeather(position.coords.latitude, position.coords.longitude);
      },
      () => {
        if (isMounted) {
          setTodayWeather({
            status: "unavailable",
            description: "Permita localização",
            season: getSouthernSeason(),
            mood: "partly",
          });
        }
      },
      { enableHighAccuracy: false, maximumAge: 30 * 60 * 1000, timeout: 7000 },
    );

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      saveState(appState);
    }
  }, [appState]);

  useEffect(() => {
    function handleGlobalPointerDown(event: PointerEvent) {
      const target = event.target;
      const clickedVoiceButton =
        target instanceof Element && Boolean(target.closest(".voice-button"));

      if (clickedVoiceButton || (!activeRecognitionRef.current && !pendingVoiceHandlerRef.current)) {
        return;
      }

      cancelVoiceAssistant();
    }

    document.addEventListener("pointerdown", handleGlobalPointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", handleGlobalPointerDown, true);
    };
  }, []);

  const activeReminders = useMemo(() => {
    if (!activeResident) {
      return [];
    }

    return appState.reminders.filter((item) => item.residentId === activeResident.id);
  }, [activeResident, appState.reminders]);
  const reminderPreview = useMemo(() => getReminderPreview(activeReminders), [activeReminders]);
  const birthdayPreview = useMemo(() => getBirthdayPreview(appState.birthdays), [appState.birthdays]);
  const dashboardReminders = useMemo(() => {
    const today = startOfToday();
    const dated = activeReminders
      .map((reminder) => {
        const parsedDate = parseReminderDate(reminder.date);
        return parsedDate
          ? {
              ...reminder,
              distance: daysBetween(today, parsedDate),
            }
          : null;
      })
      .filter((reminder): reminder is Reminder & { distance: number } => Boolean(reminder));

    return {
      today: dated.filter((reminder) => reminder.distance === 0),
      next: dated.filter((reminder) => reminder.distance >= 0).sort((a, b) => a.distance - b.distance)[0],
      overdue: dated.filter((reminder) => reminder.distance < 0).length,
    };
  }, [activeReminders]);
  const dashboardBirthdays = useMemo(() => {
    const upcoming = birthdayPreview
      .filter((birthday) => birthday.nextDistance >= 0)
      .sort((a, b) => a.nextDistance - b.nextDistance);

    return {
      today: upcoming.filter((birthday) => birthday.nextDistance === 0),
      next: upcoming[0],
    };
  }, [birthdayPreview]);
  const notifications = useMemo(() => {
    const today = startOfToday();
    const reminderNotifications = activeReminders.flatMap((reminder) => {
        const parsedDate = parseReminderDate(reminder.date);

        if (!parsedDate) {
          return [];
        }

        const distance = daysBetween(today, parsedDate);
        if (distance > 0) {
          return [];
        }

        return [{
          id: `reminder-${reminder.id}-${distance < 0 ? "overdue" : "today"}`,
          kind: "reminder" as const,
          title: distance < 0 ? "Lembrete atrasado" : "Lembrete para hoje",
          body: reminder.text,
          action: "reminderCalendar" as const,
        }];
      });
    const birthdayNotifications = birthdayPreview
      .filter((birthday) => birthday.nextDistance >= 0 && birthday.nextDistance <= 7)
      .map((birthday) => ({
        id: `birthday-${birthday.id}-${new Date().getFullYear()}`,
        kind: "birthday" as const,
        title: birthday.nextDistance === 0 ? "Aniversário hoje" : "Aniversário próximo",
        body:
          birthday.nextDistance === 0
            ? `${birthday.name} faz aniversário hoje`
            : `${birthday.name} em ${birthday.nextDistance}d`,
        action: "birthdayCalendar" as const,
      }));
    const locationNotifications = appState.locationShares
      .filter((share) => share.residentId !== activeResident?.id && new Date(share.expiresAt).getTime() > Date.now())
      .map((share) => {
        const resident = appState.residents.find((item) => item.id === share.residentId);

        return {
          id: `location-${share.id}`,
          kind: "location" as const,
          title: "Localização compartilhada",
          body: `${resident?.name ?? "Alguém da casa"} compartilhou a localização`,
          action: "location" as const,
          locationShareId: share.id,
        };
      });

    return [...locationNotifications, ...reminderNotifications, ...birthdayNotifications].filter(
      (notification) => !dismissedNotifications.includes(notification.id),
    );
  }, [activeReminders, activeResident?.id, appState.locationShares, appState.residents, birthdayPreview, dismissedNotifications]);
  const quickAccessHouseholds = accountHouseholds.length ? accountHouseholds : recentHouseholds;
  const hasLocalHouseholdAccess = Boolean(appState.household);
  const currentTheme = themePreview ?? activeResident?.theme ?? selectedResident?.theme ?? "default";
  const screenShellClassName = getScreenShellClass(currentTheme);

  function handleOpenNotification(notification: AppNotification) {
    if (notification.action === "location" && notification.locationShareId) {
      const share = appState.locationShares.find((item) => item.id === notification.locationShareId);
      if (share) {
        setShowNotifications(false);
        setSelectedLocationShare(share);
      }
      return;
    }

    if (notification.kind === "location") {
      return;
    }

    saveCalendarView(notification.kind, "list");
    setShowNotifications(false);
    setProfileModal(notification.kind === "reminder" ? "reminderCalendar" : "birthdayCalendar");
  }

  function handleDismissNotification(notificationId: string) {
    setDismissedNotifications((current) => {
      const next = Array.from(new Set([...current, notificationId]));
      saveDismissedNotifications(next);
      return next;
    });
  }

  function handleDismissAllNotifications() {
    setDismissedNotifications((current) => {
      const next = Array.from(new Set([...current, ...notifications.map((notification) => notification.id)]));
      saveDismissedNotifications(next);
      return next;
    });
  }

  function handleShareLocation(durationMinutes: 10 | 60) {
    if (!activeResident || !appState.household) {
      return;
    }

    if (!navigator.geolocation) {
      showAssistantMessage("Este aparelho não liberou localização pelo navegador.");
      setShowLocationShare(false);
      return;
    }

    showAssistantMessage("Buscando sua localização...", false);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const now = new Date();
        const share: LocationShare = {
          id: crypto.randomUUID(),
          residentId: activeResident.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + durationMinutes * 60_000).toISOString(),
        };

        await insertRemoteLocationShare(appState.household!.id, share);
        setAppState((current) => ({
          ...current,
          locationShares: [share, ...current.locationShares],
        }));
        setShowLocationShare(false);
        showAssistantMessage(`Localização compartilhada por ${durationMinutes === 10 ? "10 min" : "1h"}.`);
      },
      () => {
        setShowLocationShare(false);
        showAssistantMessage("Não consegui acessar sua localização. Verifique a permissão do navegador.");
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 },
    );
  }

  async function refreshAccountHouseholds(userId = authUser?.id) {
    if (!userId) {
      setAccountHouseholds([]);
      return [] as RecentHousehold[];
    }

    const households = await loadAccountHouseholds(userId);
    setAccountHouseholds(households);
    return households;
  }

  function getPreferredResident(remoteState: AppState) {
    const lastResidentId = window.localStorage.getItem(LAST_RESIDENT_KEY);
    return remoteState.residents.find((resident) => resident.id === lastResidentId) ?? remoteState.residents[0] ?? null;
  }

  function enterHouseholdWithWelcome(remoteState: AppState, options: { fromAuth?: boolean } = {}) {
    if (!remoteState.household) {
      return;
    }

    if (welcomeTimerRef.current) {
      window.clearTimeout(welcomeTimerRef.current);
    }

    const preferredResident = getPreferredResident(remoteState);
    rememberHousehold(remoteState.household);
    setRecentHouseholds(loadRecentHouseholds());
    setPendingInviteCode("");
    setSelectedResident(null);

    welcomeTimerRef.current = window.setTimeout(() => {
      setAuthTransitionActive(false);
      setWelcomeHouseholdName(remoteState.household?.name ?? "");

      welcomeTimerRef.current = window.setTimeout(() => {
        runScreenTransition("enter", () => {
          setAppState(remoteState);
          setActiveResident(preferredResident);
          if (preferredResident) {
            saveLastResident(preferredResident.id);
          }
          setWelcomeHouseholdName("");
        });
      }, WELCOME_HOUSEHOLD_MS);
    }, options.fromAuth ? PREPARING_HOUSEHOLD_MS : 0);
  }

  async function handleAuthSubmit(mode: "sign-in" | "sign-up", email: string, password: string) {
    if (!supabase) {
      window.alert("Supabase não está configurado neste ambiente.");
      return;
    }

    setAuthTransitionActive(true);

    const credentials = {
      email: email.trim(),
      password,
    };
    const { data, error } =
      mode === "sign-up"
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);

    if (error) {
      setAuthTransitionActive(false);
      window.alert(error.message);
      return;
    }

    if (data.user) {
      setAuthUser(data.user);
      const households = await refreshAccountHouseholds(data.user.id);
      const inviteState = pendingInviteCode ? await loadRemoteStateByCode(pendingInviteCode) : null;
      const inviteMembership = inviteState?.household
        ? households.find((household) => household.id === inviteState.household?.id)
        : null;
      const autoHousehold = inviteMembership ?? (!pendingInviteCode && households.length === 1 ? households[0] : null);
      const remoteState = inviteState?.household && inviteMembership
        ? inviteState
        : autoHousehold
          ? await loadRemoteStateById(autoHousehold.id)
          : null;

      if (remoteState?.household) {
        enterHouseholdWithWelcome(remoteState, { fromAuth: true });
      } else {
        setAuthTransitionActive(false);
      }
    }

    if (mode === "sign-up" && !data.session) {
      setAuthTransitionActive(false);
      window.alert("Conta criada. Se o Supabase pedir confirmação, confirme o e-mail antes de entrar.");
    }
  }

  async function handleSignOut() {
    await supabase?.auth.signOut();
    clearLastResident();
    setAuthUser(null);
    setAccountHouseholds([]);
    setActiveResident(null);
    setSelectedResident(null);
    setAppState(defaultState);
  }

  function createResidentFromInput(input: StarterResidentInput, roleFallback: string) {
    const name = input.name.trim();
    const role = input.role.trim();
    const newPin = input.pin.trim();

    if (!name || newPin.length !== 4) {
      return null;
    }

    return {
      id: crypto.randomUUID(),
      name,
      role: role || roleFallback,
      pin: newPin,
      color: ["#e50914", "#2f80ed", "#f2994a", "#27ae60"][appState.residents.length % 4],
      theme: "default",
      photo: newResidentPhoto || undefined,
    } satisfies Resident;
  }

  async function handleCreateHousehold(householdNameValue: string, residentInput: StarterResidentInput) {
    const householdName = householdNameValue.trim();
    const resident = createResidentFromInput(residentInput, "Admin da casa");

    if (!householdName || !resident) {
      return;
    }

    const household: Household = {
      id: crypto.randomUUID(),
      name: householdName,
      code: generateHouseholdCode(),
      createdAt: new Date().toISOString(),
      ownerResidentId: resident.id,
    };

    await createRemoteHousehold(household, resident);
    if (authUser) {
      await upsertRemoteHouseholdMember(household.id, authUser.id, "owner");
      await refreshAccountHouseholds(authUser.id);
    }
    rememberHousehold(household);
    setRecentHouseholds(loadRecentHouseholds());
    saveLastResident(resident.id);
    runScreenTransition("enter", () => {
      setAppState({
        ...defaultState,
        household,
        residents: [resident],
      });
      setActiveResident(resident);
      setNewResidentPhoto("");
      setShowHouseholdInvite(true);
    });
  }

  async function handleJoinHousehold(codeValue: string, residentInput: StarterResidentInput) {
    const code = normalizeHouseholdCode(codeValue);
    const resident = createResidentFromInput(residentInput, "Morador");

    if (code.length < 4 || !resident) {
      return;
    }

    const remoteState = await loadRemoteStateByCode(code);
    const household: Household =
      remoteState?.household ?? {
        id: crypto.randomUUID(),
        name: `Lar ${code}`,
        code,
        createdAt: new Date().toISOString(),
        joinedByCode: true,
      };

    await insertRemoteResident(household.id, resident);
    if (authUser) {
      await upsertRemoteHouseholdMember(household.id, authUser.id, "member");
      await refreshAccountHouseholds(authUser.id);
    }
    rememberHousehold(household);
    setRecentHouseholds(loadRecentHouseholds());

    saveLastResident(resident.id);
    runScreenTransition("enter", () => {
      setAppState({
        ...(remoteState ?? defaultState),
        household,
        residents: [...(remoteState?.residents ?? []), resident],
      });
      setPendingInviteCode("");
      setActiveResident(resident);
      setNewResidentPhoto("");
    });
  }

  async function handleContinueHousehold(recentHousehold: RecentHousehold) {
    const remoteState = await loadRemoteStateById(recentHousehold.id);

    if (!remoteState?.household) {
      const nextRecentHouseholds = loadRecentHouseholds().filter((item) => item.id !== recentHousehold.id);
      saveRecentHouseholds(nextRecentHouseholds);
      setRecentHouseholds(nextRecentHouseholds);
      window.alert("Não consegui carregar esse lar. Tente entrar pelo código novamente.");
      return;
    }

    rememberHousehold(remoteState.household);
    enterHouseholdWithWelcome(remoteState);
  }

  async function copyHouseholdInvite() {
    if (!appState.household) {
      return;
    }

    await navigator.clipboard?.writeText(buildInviteText(appState.household));
  }

  async function shareHouseholdInvite() {
    if (!appState.household) {
      return;
    }

    const text = buildInviteText(appState.household);
    const shareNavigator = navigator as ShareNavigator;
    if (shareNavigator.share) {
      await shareNavigator.share({
        title: `Convite ${appState.household.name}`,
        text,
      });
      return;
    }

    await navigator.clipboard?.writeText(text);
  }

  async function handleRemoveHouseholdResident(residentId: string) {
    if (!activeResident || appState.household?.ownerResidentId !== activeResident.id) {
      return;
    }

    if (residentId === activeResident.id) {
      return;
    }

    const targetResident = appState.residents.find((resident) => resident.id === residentId);
    const shouldDelete = window.confirm(`Remover ${targetResident?.name ?? "este morador"} da família?`);

    if (!shouldDelete) {
      return;
    }

    await deleteRemoteResident(residentId);
    setAppState((current) => ({
      ...current,
      residents: current.residents.filter((resident) => resident.id !== residentId),
      reminders: current.reminders.filter((reminder) => reminder.residentId !== residentId),
    }));
  }

  function handleSelectResident(resident: Resident) {
    setSelectedResident(resident);
    setPin("");
    setPinError("");
  }

  function validateResidentPin(nextPin: string, resident: Resident) {
    if (nextPin.length !== 4) {
      return;
    }

    if (nextPin === resident.pin) {
      saveLastResident(resident.id);
      runScreenTransition("enter", () => {
        setActiveResident(resident);
        setSelectedResident(null);
        setPin("");
      });
    } else {
      setPinError("PIN incorreto.");
      window.setTimeout(() => setPin(""), 260);
    }
  }

  function handlePinDigit(digit: string) {
    if (!selectedResident || pin.length >= 4) {
      return;
    }

    const nextPin = `${pin}${digit}`;
    setPin(nextPin);
    validateResidentPin(nextPin, selectedResident);
  }

  function handleNativePinChange(value: string) {
    if (!selectedResident) {
      return;
    }

    const nextPin = value.replace(/\D/g, "").slice(0, 4);
    setPin(nextPin);
    setPinError("");
    validateResidentPin(nextPin, selectedResident);
  }

  async function handleAddResident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appState.household) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const role = String(form.get("role") ?? "").trim();
    const newPin = String(form.get("pin") ?? "").trim();

    if (!name || newPin.length !== 4) {
      return;
    }

    const resident: Resident = {
      id: crypto.randomUUID(),
      name,
      role: role || "Morador",
      pin: newPin,
      color: ["#e50914", "#2f80ed", "#f2994a", "#27ae60"][
        appState.residents.length % 4
      ],
      theme: "default",
      photo: newResidentPhoto || undefined,
    };

    await insertRemoteResident(appState.household.id, resident);
    setAppState((current) => ({
      ...current,
      residents: [...current.residents, resident],
    }));
    setNewResidentPhoto("");
    setShowNewResident(false);
  }

  async function handleAddReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeResident || !appState.household) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const text = String(form.get("text") ?? "").trim();
    const date = String(form.get("date") ?? "").trim();
    const icon = String(form.get("icon") ?? "general");

    if (!text) {
      return;
    }

    const reminder: Reminder = {
      id: crypto.randomUUID(),
      residentId: activeResident.id,
      text,
      date: date || "Hoje",
      icon: isReminderIcon(icon) ? icon : "general",
    };

    await insertRemoteReminder(appState.household.id, reminder);
    setAppState((current) => ({
      ...current,
      reminders: [reminder, ...current.reminders],
    }));
    setProfileModal(null);
  }

  async function handleAddBirthday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appState.household) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const date = String(form.get("date") ?? "").trim();

    if (!name || !date) {
      return;
    }

    const birthday: Birthday = {
      id: crypto.randomUUID(),
      name,
      date: formatBirthdayValue(date),
    };

    await insertRemoteBirthday(appState.household.id, birthday);
    setAppState((current) => ({
      ...current,
      birthdays: [birthday, ...current.birthdays],
    }));
    setProfileModal(null);
  }

  async function handleDeleteReminder(reminder: Reminder) {
    const shouldDelete = window.confirm(`Excluir o lembrete "${reminder.text}"?`);
    if (!shouldDelete) {
      return;
    }

    await deleteRemoteReminder(reminder.id);
    setAppState((current) => ({
      ...current,
      reminders: current.reminders.filter((item) => item.id !== reminder.id),
    }));
  }

  async function handleDeleteBirthday(birthday: Birthday) {
    const shouldDelete = window.confirm(`Excluir o aniversário de ${birthday.name}?`);
    if (!shouldDelete) {
      return;
    }

    await deleteRemoteBirthday(birthday.id);
    setAppState((current) => ({
      ...current,
      birthdays: current.birthdays.filter((item) => item.id !== birthday.id),
    }));
  }

  async function handleUpdateResident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeResident) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const role = String(form.get("role") ?? "").trim();
    const newPin = String(form.get("pin") ?? "").trim();
    const theme = getProfileTheme(String(form.get("theme") ?? activeResident.theme ?? "default"));

    if (!name || newPin.length !== 4) {
      return;
    }

    const updatedResident: Resident = {
      ...activeResident,
      name,
      role: role || "Morador",
      pin: newPin,
      theme,
      photo: editResidentPhoto || activeResident.photo,
    };

    await updateRemoteResident(updatedResident);
    setAppState((current) => ({
      ...current,
      residents: current.residents.map((resident) =>
        resident.id === activeResident.id ? updatedResident : resident,
      ),
    }));
    setActiveResident(updatedResident);
    setEditResidentPhoto("");
    setThemePreview(null);
    setProfileModal(null);
  }

  function handlePreviewTheme(theme: ProfileThemeId) {
    runScreenTransition("soft", () => {
      setThemePreview(theme);
    });
  }

  async function handleDeleteResident() {
    if (!activeResident) {
      return;
    }

    const shouldDelete = window.confirm(`Excluir o perfil ${activeResident.name}?`);
    if (!shouldDelete) {
      return;
    }

    await deleteRemoteResident(activeResident.id);
    setAppState((current) => ({
      ...current,
      residents: current.residents.filter((resident) => resident.id !== activeResident.id),
      reminders: current.reminders.filter((reminder) => reminder.residentId !== activeResident.id),
    }));
    clearLastResident();
    runScreenTransition("back", () => {
      setActiveResident(null);
      setEditResidentPhoto("");
      setProfileModal(null);
    });
  }

  async function addEmergencyContact(name: string, phone: string) {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (!cleanName || !cleanPhone) {
      return;
    }

    const contact: EmergencyContact = {
      id: crypto.randomUUID(),
      name: cleanName,
      phone: cleanPhone,
    };

    if (appState.household) {
      await insertRemoteEmergencyContact(appState.household.id, contact);
    }

    setAppState((current) => ({
      ...current,
      emergencyContacts: [...current.emergencyContacts, contact],
    }));
  }

  function handleAddEmergencyContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void addEmergencyContact(String(form.get("name") ?? ""), String(form.get("phone") ?? ""));
    event.currentTarget.reset();
  }

  async function handlePickDeviceContact() {
    const contactNavigator = navigator as ContactPickerNavigator;

    if (!contactNavigator.contacts?.select) {
      window.alert("Este navegador ainda não permite escolher contatos. Cadastre manualmente.");
      return;
    }

    const contacts = await contactNavigator.contacts.select(["name", "tel"], { multiple: false });
    const [contact] = contacts;
    const name = contact?.name?.[0] ?? "";
    const phone = contact?.tel?.[0] ?? "";

    await addEmergencyContact(name, phone);
  }

  async function handleRemoveEmergencyContact(contactId: string) {
    await deleteRemoteEmergencyContact(contactId);
    setAppState((current) => ({
      ...current,
      emergencyContacts: current.emergencyContacts.filter((contact) => contact.id !== contactId),
    }));
  }

  function handleSwitchProfile() {
    clearLastResident();
    runScreenTransition("back", () => {
      setActiveResident(null);
      setSelectedResident(null);
      setProfileModal(null);
      setPin("");
      setPinError("");
    });
  }

  function speakAssistant(message: string, onDone?: () => void) {
    if (speechFallbackTimerRef.current) {
      window.clearTimeout(speechFallbackTimerRef.current);
      speechFallbackTimerRef.current = null;
    }

    if (!("speechSynthesis" in window)) {
      onDone?.();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    let didFinish = false;
    const finish = () => {
      if (didFinish) {
        return;
      }

      didFinish = true;
      if (speechFallbackTimerRef.current) {
        window.clearTimeout(speechFallbackTimerRef.current);
        speechFallbackTimerRef.current = null;
      }
      onDone?.();
    };

    utterance.lang = "pt-BR";
    utterance.rate = 1;
    utterance.pitch = 1.05;
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
    speechFallbackTimerRef.current = window.setTimeout(
      finish,
      Math.max(1400, Math.min(4600, message.length * 55)),
    );
  }

  function showAssistantMessage(message: string, shouldSpeak = true) {
    setVoiceMessage(message);

    if (shouldSpeak) {
      speakAssistant(message);
    }
  }

  function cancelVoiceAssistant(message = "Tudo bem, cancelei. Nada foi salvo.") {
    pendingVoiceHandlerRef.current = null;

    if (speechFallbackTimerRef.current) {
      window.clearTimeout(speechFallbackTimerRef.current);
      speechFallbackTimerRef.current = null;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    const activeRecognition = activeRecognitionRef.current;
    activeRecognitionRef.current = null;
    if (activeRecognition) {
      try {
        activeRecognition.abort();
      } catch {
        try {
          activeRecognition.stop();
        } catch {
          // The browser may have already closed the recognizer.
        }
      }
    }

    setIsListening(false);
    showAssistantMessage(message);
  }

  function startVoiceRecognition(onTranscript: (transcript: string) => void) {
    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showAssistantMessage("Eu não consigo ouvir neste navegador. Use os botões + ou tente abrir no Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      activeRecognitionRef.current = recognition;
      setIsListening(true);
    };
    recognition.onend = () => {
      if (activeRecognitionRef.current === recognition) {
        activeRecognitionRef.current = null;
      }
      setIsListening(false);
    };
    recognition.onerror = (event) => {
      if (activeRecognitionRef.current !== recognition) {
        return;
      }

      activeRecognitionRef.current = null;
      setIsListening(false);
      showAssistantMessage(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Eu não tenho permissão para usar o microfone. Libere o acesso ou use os botões +."
          : "Não consegui ouvir direito. Tente de novo ou use os botões +.",
      );
    };
    recognition.onresult = (event) => {
      if (activeRecognitionRef.current !== recognition) {
        return;
      }

      const transcript = event.results[0]?.[0]?.transcript ?? "";
      activeRecognitionRef.current = null;
      pendingVoiceHandlerRef.current = null;
      onTranscript(transcript);
    };

    try {
      activeRecognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      showAssistantMessage("Não consegui iniciar o microfone aqui. Tente no Chrome ou use os botões +.");
    }
  }

  function askAssistant(message: string, onTranscript: (transcript: string) => void) {
    const guardedTranscript = (transcript: string) => {
      if (isVoiceCancelCommand(transcript)) {
        cancelVoiceAssistant();
        return;
      }

      onTranscript(transcript);
    };

    pendingVoiceHandlerRef.current = guardedTranscript;
    setVoiceMessage(message);
    speakAssistant(message, () => {
      if (pendingVoiceHandlerRef.current !== guardedTranscript) {
        return;
      }

      setVoiceMessage("Estou ouvindo... Se o iPhone não abrir o microfone, toque nele e responda.");
      startVoiceRecognition(guardedTranscript);
    });
  }

  async function addReminderFromVoice(text: string, date: string) {
    if (!activeResident || !appState.household) {
      showAssistantMessage("Escolha um perfil antes de criar lembretes por voz.");
      return;
    }

    const reminder: Reminder = {
      id: crypto.randomUUID(),
      residentId: activeResident.id,
      text,
      date,
      icon: inferReminderIcon({
        id: "voice",
        residentId: activeResident.id,
        text,
        date,
      }),
    };

    await insertRemoteReminder(appState.household.id, reminder);
    setAppState((current) => ({
      ...current,
      reminders: [reminder, ...current.reminders],
    }));
    showAssistantMessage(`Pronto, adicionei o lembrete: ${text}.`);
  }

  function askReminderDate(text: string) {
    askAssistant("Quando devo te lembrar?", (dateTranscript) => {
      const date = parseSpokenReminderDate(dateTranscript);

      if (!date) {
        askAssistant("Não entendi a data. Pode falar algo como amanhã, vinte de julho ou quinze de agosto?", (retry) => {
          const retryDate = parseSpokenReminderDate(retry);

          if (!retryDate) {
            showAssistantMessage("Ainda não entendi a data. Abri o formulário para você completar.");
            setProfileModal("reminder");
            return;
          }

          void addReminderFromVoice(text, retryDate);
        });
        return;
      }

      void addReminderFromVoice(text, date);
    });
  }

  function startReminderVoiceFlow() {
    askAssistant("Qual é o lembrete?", (textTranscript) => {
      const text = textTranscript.trim();

      if (!text) {
        showAssistantMessage("Não consegui entender o lembrete. Tente de novo pelo botão de microfone.");
        return;
      }

      askReminderDate(text);
    });
  }

  async function addBirthdayFromVoice(name: string, date: string) {
    if (!appState.household) {
      setProfileModal("birthday");
      return;
    }

    const birthday: Birthday = {
      id: crypto.randomUUID(),
      name,
      date,
    };

    await insertRemoteBirthday(appState.household.id, birthday);
    setAppState((current) => ({
      ...current,
      birthdays: [birthday, ...current.birthdays],
    }));
    showAssistantMessage(`Pronto, cadastrei o aniversário de ${name}.`);
  }

  function askBirthdayDate(name: string) {
    askAssistant(`Quando é o aniversário de ${name}?`, (dateTranscript) => {
      const date = parseSpokenBirthdayDate(dateTranscript);

      if (!date) {
        askAssistant("Não entendi a data. Pode falar algo como quinze de agosto ou vinte barra sete?", (retry) => {
          const retryDate = parseSpokenBirthdayDate(retry);

          if (!retryDate) {
            showAssistantMessage("Ainda não entendi a data. Abri o formulário para você completar.");
            setProfileModal("birthday");
            return;
          }

          void addBirthdayFromVoice(name, retryDate);
        });
        return;
      }

      void addBirthdayFromVoice(name, date);
    });
  }

  function startBirthdayVoiceFlow() {
    askAssistant("De quem é o aniversário?", (nameTranscript) => {
      const name = nameTranscript.trim();

      if (!name) {
        showAssistantMessage("Não consegui entender o nome. Tente de novo pelo botão de microfone.");
        return;
      }

      askBirthdayDate(name);
    });
  }

  function runVoiceCommand(transcript: string) {
    const command = normalizeVoiceCommand(transcript);

    if (isVoiceCancelCommand(transcript)) {
      cancelVoiceAssistant("Tudo bem, não tem nada em andamento para cancelar.");
      return;
    }

    if (command.includes("emergencia") || command.includes("socorro") || command.includes("ajuda")) {
      setShowEmergency(true);
      showAssistantMessage("Estou abrindo a emergencia.");
      return;
    }

    if (command.includes("calendario") && command.includes("lembrete")) {
      setProfileModal("reminderCalendar");
      showAssistantMessage("Vou te levar para o calendário de lembretes.");
      return;
    }

    if (command.includes("calendario") && command.includes("aniversario")) {
      setProfileModal("birthdayCalendar");
      showAssistantMessage("Vou te levar para o calendário de aniversários.");
      return;
    }

    if (command.includes("lembrete")) {
      startReminderVoiceFlow();
      return;
    }

    if (command.includes("aniversario")) {
      startBirthdayVoiceFlow();
      return;
    }

    showAssistantMessage("Eu não entendi ainda. Tente falar: adicionar lembrete.");
  }

  function handleVoiceAssistant() {
    if (isListening || pendingVoiceHandlerRef.current) {
      cancelVoiceAssistant();
      return;
    }

    showAssistantMessage("Estou tentando abrir o microfone...", false);
    setVoiceMessage("Estou ouvindo. Pode falar, por exemplo: adicionar lembrete.");
    startVoiceRecognition(runVoiceCommand);
  }

  if (authLoading) {
    return (
      <main className={screenShellClassName}>
        <section className="splash-screen" aria-label="Carregando J-Tag">
          <div className="splash-logo">
            <LogoMark size={76} />
          </div>
        </section>
      </main>
    );
  }

  if (authTransitionActive) {
    return (
      <main className={screenShellClassName}>
        <WelcomeHouseholdScreen preparing />
      </main>
    );
  }

  if (!authUser && !hasLocalHouseholdAccess) {
    return (
      <main className={screenShellClassName}>
        {showSplash ? (
          <section className="splash-screen" aria-label="Carregando J-Tag">
            <div className="splash-logo">
              <LogoMark size={76} />
            </div>
          </section>
        ) : null}

        <AuthGate
          hasInvite={Boolean(pendingInviteCode)}
          onSubmit={(mode, email, password) => void handleAuthSubmit(mode, email, password)}
          onShowReleaseNotes={() => setShowReleaseNotes(true)}
        />
        {showReleaseNotes ? <ReleaseNotesModal onClose={() => setShowReleaseNotes(false)} /> : null}
      </main>
    );
  }

  if (welcomeHouseholdName) {
    return (
      <main className={screenShellClassName}>
        <WelcomeHouseholdScreen householdName={welcomeHouseholdName} />
      </main>
    );
  }

  if (!appState.household) {
    return (
      <main className={screenShellClassName}>
        {showSplash ? (
          <section className="splash-screen" aria-label="Carregando J-Tag">
            <div className="splash-logo">
              <LogoMark size={76} />
            </div>
          </section>
        ) : null}

        <HouseholdSetup
          inviteCode={pendingInviteCode}
          photo={newResidentPhoto}
          recentHouseholds={quickAccessHouseholds}
          onCreate={handleCreateHousehold}
          onContinue={handleContinueHousehold}
          onJoin={handleJoinHousehold}
          onPhotoSelect={setNewResidentPhoto}
          onShowReleaseNotes={() => setShowReleaseNotes(true)}
        />
        {showReleaseNotes ? <ReleaseNotesModal onClose={() => setShowReleaseNotes(false)} /> : null}
      </main>
    );
  }

  if (activeResident) {
    return (
      <main className={screenShellClassName}>
        <section className="inside-view">
          <div className="inside-topbar">
            <button className="brand-button" type="button" onClick={() => setShowReleaseNotes(true)} aria-label="Ver novidades">
              <LogoMark size={24} />
            </button>
            <div className="topbar-actions">
              <button
                className="icon-glass-button"
                type="button"
                onClick={() => setShowLocationShare(true)}
                aria-label="Compartilhar localização"
              >
                <MapPin size={20} />
              </button>
              <button
                className="icon-glass-button"
                type="button"
                onClick={() => setShowHouseholdInvite(true)}
                aria-label="Convidar para o lar"
              >
                <Users size={20} />
              </button>
              <button
                className={`icon-glass-button voice-button ${isListening ? "listening" : ""}`}
                type="button"
                onClick={handleVoiceAssistant}
                aria-label="Assistente de voz"
              >
                <Mic size={20} />
              </button>
              <button
                className="icon-glass-button"
                type="button"
                onClick={() => {
                  setEditResidentPhoto("");
                  setThemePreview(getProfileTheme(activeResident.theme));
                  setProfileModal("edit");
                }}
                aria-label="Editar perfil"
              >
                <Pencil size={20} />
              </button>
              <button
                className={`icon-glass-button notification-button ${notifications.length ? "has-notifications" : ""}`}
                type="button"
                onClick={() => setShowNotifications(true)}
                aria-label="Ver notificações"
              >
                <Bell size={20} />
                {notifications.length ? <span>{notifications.length}</span> : null}
              </button>
            </div>
          </div>
          {voiceMessage ? (
            <div className={`voice-status ${isListening ? "voice-status-listening" : ""}`}>
              {isListening ? (
                <span className="voice-wave" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              ) : null}
              <span>{voiceMessage}</span>
            </div>
          ) : null}
          <div className="dashboard-hero">
            <div className="inside-hero">
              <Avatar resident={activeResident} variant="large" />
              <div>
                <p className="eyebrow">Dashboard do lar</p>
                <h1>{appState.household.name}</h1>
                <span>
                  {activeResident.name} · {activeResident.role}
                </span>
              </div>
            </div>
            <div className="dashboard-today-card">
              <div className="dashboard-today-copy">
                <span>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })}</span>
                <strong>
                  {dashboardReminders.today.length + dashboardBirthdays.today.length
                    ? `${dashboardReminders.today.length + dashboardBirthdays.today.length} item hoje`
                    : "Dia tranquilo"}
                </strong>
              </div>
              <WeatherWidget weather={todayWeather} />
            </div>
          </div>

          <div className="dashboard-grid">
            <button className="dashboard-card dashboard-card-primary" type="button" onClick={() => setProfileModal("reminderCalendar")}>
              <span className="dashboard-card-icon">
                <CalendarCheck size={20} />
              </span>
              <small>Lembretes</small>
              <strong>{dashboardReminders.next ? dashboardReminders.next.text : "Nada agendado"}</strong>
              <em>{dashboardReminders.next ? formatDistanceLabel(dashboardReminders.next.distance) : "Livre"}</em>
            </button>
            <button className="dashboard-card" type="button" onClick={() => setProfileModal("birthdayCalendar")}>
              <span className="dashboard-card-icon birthday-icon">
                <Cake size={20} />
              </span>
              <small>Aniversários</small>
              <strong>{dashboardBirthdays.next ? dashboardBirthdays.next.name : "Sem próximos"}</strong>
              <em>{dashboardBirthdays.next ? formatDistanceLabel(dashboardBirthdays.next.nextDistance) : "Adicionar data"}</em>
            </button>
            <button className="dashboard-card" type="button" onClick={() => setShowHouseholdInvite(true)}>
              <span className="dashboard-card-icon">
                <Users size={20} />
              </span>
              <small>Moradores</small>
              <strong>{appState.residents.length}</strong>
              <em>{appState.residents.length === 1 ? "perfil na casa" : "perfis na casa"}</em>
            </button>
            <button className="dashboard-card" type="button" onClick={() => setShowEmergency(true)}>
              <span className="dashboard-card-icon emergency-icon-mini">
                <HeartPulse size={20} />
              </span>
              <small>Emergência</small>
              <strong>{appState.emergencyContacts.length + 3}</strong>
              <em>contatos prontos</em>
            </button>
          </div>

          <div className="inside-grid">
            <InfoPanel
              title="Lembretes"
              onAdd={() => setProfileModal("reminder")}
              onOpen={() => setProfileModal("reminderCalendar")}
            >
              {reminderPreview.length ? (
                <div className="preview-fade-list">
                  {reminderPreview.map((item) => (
                  <div className={`inside-row ${item.distance === 0 ? "inside-row-today reminder-today" : ""}`} key={item.id}>
                    <span className="inside-row-main">
                      <ReminderIconBadge icon={item.icon} />
                      <span className="row-label">{item.text}</span>
                    </span>
                    <small className="row-date-with-icon">
                      {item.distance === 0 ? <CalendarCheck size={15} /> : null}
                      {formatDateLabel(item.date)}
                    </small>
                  </div>
                  ))}
                </div>
              ) : (
                <p>Nenhum lembrete cadastrado.</p>
              )}
            </InfoPanel>
            <InfoPanel
              title="Aniversários"
              onAdd={() => setProfileModal("birthday")}
              onOpen={() => setProfileModal("birthdayCalendar")}
            >
              {birthdayPreview.length ? (
                <div className="preview-fade-list">
                  {birthdayPreview.map((item) => (
                <div className={`inside-row ${item.distance === 0 ? "inside-row-today birthday-today" : ""}`} key={item.id}>
                  <span className="inside-row-main">
                    {item.distance === 0 ? <Cake size={17} /> : null}
                    <span className="row-label">{item.name}</span>
                  </span>
                  <small>{item.date}</small>
                </div>
                  ))}
                </div>
              ) : (
                <p>Nenhum aniversário cadastrado.</p>
              )}
            </InfoPanel>
          </div>

          <div className="profile-action-row">
            <button className="emergency-button inline" type="button" onClick={() => setShowEmergency(true)}>
              <HeartPulse size={20} />
              Emergência
            </button>
            <button className="switch-profile-button" type="button" onClick={handleSwitchProfile}>
              Trocar perfil
            </button>
          </div>
        </section>

        {showEmergency ? (
          <EmergencyModal
            contacts={appState.emergencyContacts}
            onAddContact={handleAddEmergencyContact}
            onClose={() => setShowEmergency(false)}
            onPickDeviceContact={handlePickDeviceContact}
            onRemoveContact={handleRemoveEmergencyContact}
          />
        ) : null}
        {profileModal === "reminder" ? (
          <ReminderModal onClose={() => setProfileModal(null)} onSubmit={handleAddReminder} />
        ) : null}
        {profileModal === "birthday" ? (
          <BirthdayModal onClose={() => setProfileModal(null)} onSubmit={handleAddBirthday} />
        ) : null}
        {profileModal === "edit" ? (
          <EditResidentModal
            photo={editResidentPhoto || activeResident.photo || ""}
            resident={activeResident}
            onClose={() => {
              setEditResidentPhoto("");
              setThemePreview(null);
              setProfileModal(null);
            }}
            onDelete={handleDeleteResident}
            onPhotoSelect={setEditResidentPhoto}
            onThemePreview={handlePreviewTheme}
            onSubmit={handleUpdateResident}
          />
        ) : null}
        {profileModal === "reminderCalendar" ? (
          <CalendarModal
            items={activeReminders}
            kind="reminder"
            onClose={() => setProfileModal(null)}
            onCreate={() => setProfileModal("reminder")}
            onDelete={(item) => void handleDeleteReminder(item as Reminder)}
            title="Calendário de lembretes"
          />
        ) : null}
        {profileModal === "birthdayCalendar" ? (
          <CalendarModal
            items={appState.birthdays}
            kind="birthday"
            onClose={() => setProfileModal(null)}
            onCreate={() => setProfileModal("birthday")}
            onDelete={(item) => void handleDeleteBirthday(item as Birthday)}
            title="Calendário de aniversários"
          />
        ) : null}
      {showHouseholdInvite ? (
        <HouseholdInviteModal
          activeResidentId={activeResident.id}
          canManageMembers={appState.household.ownerResidentId === activeResident.id}
          household={appState.household}
            residents={appState.residents}
            onClose={() => setShowHouseholdInvite(false)}
            onCopy={copyHouseholdInvite}
            onRemoveResident={handleRemoveHouseholdResident}
          onShare={shareHouseholdInvite}
        />
      ) : null}
        {showNotifications ? (
          <NotificationsModal
            notifications={notifications}
            onClose={() => setShowNotifications(false)}
            onDismissAll={handleDismissAllNotifications}
            onDismiss={handleDismissNotification}
            onOpen={handleOpenNotification}
          />
        ) : null}
        {showLocationShare ? (
          <LocationShareModal
            onClose={() => setShowLocationShare(false)}
            onShare={handleShareLocation}
          />
        ) : null}
        {selectedLocationShare ? (
          <LocationMapModal
            residents={appState.residents}
            share={selectedLocationShare}
            onClose={() => setSelectedLocationShare(null)}
          />
        ) : null}
        {showReleaseNotes ? <ReleaseNotesModal onClose={() => setShowReleaseNotes(false)} /> : null}
      </main>
    );
  }

  return (
    <main className={screenShellClassName}>
      {showSplash ? (
        <section className="splash-screen" aria-label="Carregando J-Tag">
          <div className="splash-logo">
            <LogoMark size={76} />
          </div>
        </section>
      ) : null}

      <section className="profile-stage">
        <header className="simple-header">
          <button className="brand-button" type="button" onClick={() => setShowReleaseNotes(true)} aria-label="Ver novidades">
            <LogoMark size={24} />
          </button>
          <button className="household-pill" type="button" onClick={() => setShowHouseholdInvite(true)}>
            <House size={17} />
            <span>{appState.household.name}</span>
            <strong>{appState.household.code}</strong>
          </button>
          <button className="secondary-mini-button" type="button" onClick={() => void handleSignOut()}>
            Sair
          </button>
        </header>

        <div className="profile-copy">
          <h1>Quem esta usando?</h1>
        </div>

        <div className="stream-profile-grid">
          {appState.residents.map((resident) => (
            <button
              className="stream-profile"
              key={resident.id}
              type="button"
              onClick={() => handleSelectResident(resident)}
            >
              <Avatar resident={resident} />
              <strong>{resident.name}</strong>
            </button>
          ))}

          <button className="stream-profile add-profile" type="button" onClick={() => setShowNewResident(true)}>
            <span className="avatar-frame avatar-empty">
              <Plus size={42} />
            </span>
            <strong>Novo</strong>
          </button>
        </div>

        <button className="emergency-button fixed" type="button" onClick={() => setShowEmergency(true)}>
          <Siren size={22} />
          Emergência
        </button>
      </section>

      {selectedResident ? (
        <PinModal
          pin={pin}
          error={pinError}
          resident={selectedResident}
          onClose={() => setSelectedResident(null)}
          onDigit={handlePinDigit}
          onErase={() => setPin((current) => current.slice(0, -1))}
          onNativePinChange={handleNativePinChange}
        />
      ) : null}

      {showNewResident ? (
        <NewResidentModal
          photo={newResidentPhoto}
          onClose={() => {
            setNewResidentPhoto("");
            setShowNewResident(false);
          }}
          onPhotoSelect={setNewResidentPhoto}
          onSubmit={handleAddResident}
        />
      ) : null}

      {showEmergency ? (
        <EmergencyModal
          contacts={appState.emergencyContacts}
          onAddContact={handleAddEmergencyContact}
          onClose={() => setShowEmergency(false)}
          onPickDeviceContact={handlePickDeviceContact}
          onRemoveContact={handleRemoveEmergencyContact}
        />
      ) : null}
      {showHouseholdInvite ? (
        <HouseholdInviteModal
          activeResidentId={undefined}
          canManageMembers={false}
          household={appState.household}
          residents={appState.residents}
          onClose={() => setShowHouseholdInvite(false)}
          onCopy={copyHouseholdInvite}
          onRemoveResident={handleRemoveHouseholdResident}
          onShare={shareHouseholdInvite}
        />
      ) : null}
      {showNotifications ? (
        <NotificationsModal
            notifications={notifications}
            onClose={() => setShowNotifications(false)}
            onDismissAll={handleDismissAllNotifications}
            onDismiss={handleDismissNotification}
            onOpen={handleOpenNotification}
          />
      ) : null}
      {showReleaseNotes ? <ReleaseNotesModal onClose={() => setShowReleaseNotes(false)} /> : null}
    </main>
  );
}

function WeatherWidget({ weather }: { weather: TodayWeather }) {
  const iconMap: Record<WeatherMood, LucideIcon> = {
    sunny: Sun,
    partly: CloudSun,
    cloudy: Cloudy,
    rain: CloudRain,
    storm: CloudLightning,
    snow: CloudSnow,
    fog: CloudFog,
    rainbow: Rainbow,
  };
  const WeatherIcon = iconMap[weather.mood];
  const temperature = typeof weather.temperature === "number" ? `${weather.temperature}°` : "--";

  return (
    <div className={`weather-widget weather-${weather.mood}`} aria-label={`Previsão do tempo: ${weather.description}`}>
      <div className="weather-orbit" aria-hidden="true">
        <WeatherIcon size={32} />
        {weather.mood === "rain" || weather.mood === "storm" ? <span className="weather-drops" /> : null}
      </div>
      <div className="weather-copy">
        <span>
          <Thermometer size={13} />
          {weather.status === "loading" ? "..." : temperature}
        </span>
        <strong>{weather.description}</strong>
        <em>{weather.season}</em>
      </div>
    </div>
  );
}

function NotificationsModal({
  notifications,
  onClose,
  onDismissAll,
  onDismiss,
  onOpen,
}: {
  notifications: AppNotification[];
  onClose: () => void;
  onDismissAll: () => void;
  onDismiss: (notificationId: string) => void;
  onOpen: (notification: AppNotification) => void;
}) {
  const { backdropClassName, requestClose } = useModalClose(onClose);

  return (
    <div className={backdropClassName}>
      <section className="dark-modal notifications-modal" role="dialog" aria-modal="true">
        <button className="close-button" type="button" onClick={requestClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <span className="modal-icon notification-modal-icon">
          <Bell size={30} />
        </span>
        <p className="eyebrow">Central</p>
        <div className="notification-title-row">
          <h2>Notificações</h2>
          {notifications.length ? (
            <button className="notification-clear-all" type="button" onClick={onDismissAll}>
              Limpar tudo
            </button>
          ) : null}
        </div>
        <div className="notification-list">
          {notifications.length ? (
            notifications.map((notification) => (
              <article className="notification-row" key={notification.id}>
                <button className="notification-content" type="button" onClick={() => onOpen(notification)}>
                  <span className={`notification-kind notification-kind-${notification.kind}`}>
                    {notification.kind === "birthday" ? (
                      <Cake size={17} />
                    ) : notification.kind === "location" ? (
                      <MapPin size={17} />
                    ) : (
                      <Bell size={17} />
                    )}
                  </span>
                  <span>
                    <strong>{notification.title}</strong>
                    <small>{notification.body}</small>
                  </span>
                </button>
                <button
                  className="notification-action notification-seen"
                  type="button"
                  onClick={() => onDismiss(notification.id)}
                  aria-label="Marcar como vista"
                >
                  <Check size={16} />
                </button>
                <button
                  className="notification-action notification-dismiss"
                  type="button"
                  onClick={() => onDismiss(notification.id)}
                  aria-label="Excluir notificação"
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))
          ) : (
            <div className="notification-empty">
              <Bell size={22} />
              <strong>Nada novo por aqui</strong>
              <span>Aniversários próximos e lembretes importantes vão aparecer neste sino.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function LocationShareModal({
  onClose,
  onShare,
}: {
  onClose: () => void;
  onShare: (durationMinutes: 10 | 60) => void;
}) {
  const { backdropClassName, requestClose } = useModalClose(onClose);

  return (
    <div className={backdropClassName}>
      <section className="dark-modal location-modal" role="dialog" aria-modal="true">
        <button className="close-button" type="button" onClick={requestClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <span className="modal-icon location-modal-icon">
          <Navigation size={30} />
        </span>
        <p className="eyebrow">Localização</p>
        <h2>Compartilhar agora</h2>
        <p className="location-modal-copy">
          Sua família receberá um aviso no sino e poderá abrir o mapa enquanto o compartilhamento estiver ativo.
        </p>
        <div className="location-duration-grid">
          <button type="button" onClick={() => onShare(10)}>
            <strong>10 min</strong>
            <span>Rápido</span>
          </button>
          <button type="button" onClick={() => onShare(60)}>
            <strong>1h</strong>
            <span>Temporário</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function LocationMapModal({
  residents,
  share,
  onClose,
}: {
  residents: Resident[];
  share: LocationShare;
  onClose: () => void;
}) {
  const { backdropClassName, requestClose } = useModalClose(onClose);
  const [addressLabel, setAddressLabel] = useState("Buscando rua próxima...");
  const resident = residents.find((item) => item.id === share.residentId);
  const mapUrl = `https://www.google.com/maps?q=${share.latitude},${share.longitude}`;
  const createdAt = new Date(share.createdAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  useEffect(() => {
    let isMounted = true;

    async function loadAddress() {
      try {
        const params = new URLSearchParams({
          format: "jsonv2",
          lat: String(share.latitude),
          lon: String(share.longitude),
          zoom: "18",
          addressdetails: "1",
          "accept-language": "pt-BR",
        });
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`);

        if (!response.ok) {
          throw new Error("reverse geocode failed");
        }

        const data = (await response.json()) as {
          display_name?: string;
          address?: {
            road?: string;
            pedestrian?: string;
            footway?: string;
            neighbourhood?: string;
            suburb?: string;
            city?: string;
            town?: string;
          };
        };
        const road = data.address?.road ?? data.address?.pedestrian ?? data.address?.footway;
        const area = data.address?.neighbourhood ?? data.address?.suburb;
        const city = data.address?.city ?? data.address?.town;
        const nextAddress = [road, area, city].filter(Boolean).join(" · ") || data.display_name || "Rua próxima indisponível";

        if (isMounted) {
          setAddressLabel(nextAddress);
        }
      } catch {
        if (isMounted) {
          setAddressLabel("Rua próxima indisponível");
        }
      }
    }

    void loadAddress();

    return () => {
      isMounted = false;
    };
  }, [share.latitude, share.longitude]);

  return (
    <div className={backdropClassName}>
      <section className="dark-modal location-modal" role="dialog" aria-modal="true">
        <button className="close-button" type="button" onClick={requestClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <span className="modal-icon location-modal-icon">
          <MapPin size={30} />
        </span>
        <p className="eyebrow">Mapa</p>
        <h2>{resident?.name ?? "Morador"} está aqui</h2>
        <div className="location-address-card">
          <MapPin size={16} />
          <span>{addressLabel}</span>
          <span className="walking-person" aria-hidden="true">
            <span className="walker-head" />
            <span className="walker-body" />
            <span className="walker-arm walker-arm-left" />
            <span className="walker-arm walker-arm-right" />
            <span className="walker-leg walker-leg-left" />
            <span className="walker-leg walker-leg-right" />
          </span>
        </div>
        <p className="location-modal-copy">
          Compartilhado em {createdAt}
          {share.accuracy ? ` · precisão aproximada ${Math.round(share.accuracy)}m` : ""}
        </p>
        <a className="primary-action location-map-link" href={mapUrl} target="_blank" rel="noreferrer">
          <Navigation size={18} />
          Abrir no mapa
        </a>
      </section>
    </div>
  );
}

function AuthGate({
  hasInvite,
  onShowReleaseNotes,
  onSubmit,
}: {
  hasInvite: boolean;
  onShowReleaseNotes: () => void;
  onSubmit: (mode: "sign-in" | "sign-up", email: string, password: string) => void;
}) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">(hasInvite ? "sign-up" : "sign-in");
  const [email, setEmail] = useState("");
  const isSignUp = mode === "sign-up";

  useEffect(() => {
    setEmail(window.localStorage.getItem(LAST_AUTH_EMAIL_KEY) ?? "");
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const emailValue = email.trim();
    const password = String(form.get("password") ?? "");

    if (!emailValue || password.length < 6) {
      return;
    }

    window.localStorage.setItem(LAST_AUTH_EMAIL_KEY, emailValue);
    onSubmit(mode, emailValue, password);
  }

  return (
    <section className="household-setup auth-setup">
      <header className="simple-header">
        <button className="brand-button" type="button" onClick={onShowReleaseNotes} aria-label="Ver novidades">
          <LogoMark size={24} />
        </button>
      </header>

      <div className="household-hero">
        <span className="household-icon">
          <Users size={32} />
        </span>
        <p className="eyebrow">{hasInvite ? "Convite de família" : "Conta J-tag"}</p>
        <h1>
          {hasInvite
            ? "Ingressar na família"
            : isSignUp
              ? "Criar sua conta"
              : "Entrar na sua conta"}
        </h1>
        <p>
          {hasInvite
            ? "Use sua própria conta. Depois disso, o convite continua sozinho e você cria seu perfil."
            : "Uma conta pode participar de uma ou mais famílias e ver os perfis delas."}
        </p>
      </div>

      <form className="household-card auth-card" onSubmit={handleSubmit}>
        <div className="view-toggle" role="group" aria-label="Tipo de acesso">
          <button className={!isSignUp ? "active" : ""} type="button" onClick={() => setMode("sign-in")}>
            Entrar
          </button>
          <button className={isSignUp ? "active" : ""} type="button" onClick={() => setMode("sign-up")}>
            Criar conta
          </button>
        </div>
        <div className="field">
          <label htmlFor="auth-email">E-mail</label>
          <input
            id="auth-email"
            name="email"
            autoComplete="email username"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@email.com"
            required
            value={email}
          />
        </div>
        <div className="field">
          <label htmlFor="auth-password">Senha</label>
          <input
            id="auth-password"
            name="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            minLength={6}
            placeholder="No mínimo 6 caracteres"
            type="password"
            required
          />
        </div>
        <button className="primary-action" type="submit">
          <Check size={18} />
          {hasInvite ? (isSignUp ? "Criar conta e continuar" : "Entrar e continuar") : isSignUp ? "Criar conta" : "Entrar"}
        </button>
      </form>
    </section>
  );
}

function WelcomeHouseholdScreen({
  householdName,
  preparing = false,
}: {
  householdName?: string;
  preparing?: boolean;
}) {
  const title = preparing ? "Preparando sua casa" : `Bem-vindo à casa ${householdName}`;

  return (
    <section className="welcome-household-screen" aria-label={title}>
      <div className="welcome-household-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="welcome-household-card">
        <div className="welcome-household-logo">
          <LogoMark size={34} />
        </div>
        <p className="eyebrow">{preparing ? "Entrando" : "Acesso liberado"}</p>
        <h1>{title}</h1>
        <div className="welcome-household-loader" aria-hidden="true">
          <span />
        </div>
      </div>
    </section>
  );
}

function HouseholdSetup({
  inviteCode,
  photo,
  recentHouseholds,
  onCreate,
  onContinue,
  onJoin,
  onPhotoSelect,
  onShowReleaseNotes,
}: {
  inviteCode: string;
  photo: string;
  recentHouseholds: RecentHousehold[];
  onCreate: (householdName: string, resident: StarterResidentInput) => void;
  onContinue: (household: RecentHousehold) => void;
  onJoin: (code: string, resident: StarterResidentInput) => void;
  onPhotoSelect: (photo: string) => void;
  onShowReleaseNotes: () => void;
}) {
  const hasInviteLink = Boolean(inviteCode);
  const [mode, setMode] = useState<"create" | "join">(inviteCode ? "join" : "create");
  const [step, setStep] = useState(hasInviteLink ? 3 : 1);
  const [householdName, setHouseholdName] = useState("");
  const [code, setCode] = useState(inviteCode);
  const [resident, setResident] = useState<StarterResidentInput>({
    name: "",
    role: "",
    pin: "",
  });
  const isCreateMode = mode === "create";
  const finalStep = isCreateMode ? 4 : 3;
  const visibleStep = hasInviteLink ? Math.max(1, step - 2) : step;
  const totalSteps = hasInviteLink ? 2 : finalStep;
  const stepTitle =
    hasInviteLink && step === 3
      ? "Ingressar na família"
      : step === 1
      ? "Como você quer começar?"
      : step === 2
        ? isCreateMode
          ? "Dê um nome para sua casa"
          : "Digite o código da casa"
        : step === 3
          ? "Crie seu perfil"
          : "Convide quem mora com você";
  const stepDescription =
    hasInviteLink && step === 3
      ? "O convite já trouxe o código do lar. Crie seu perfil para entrar."
      : step === 1
      ? "Escolha uma opção para preparar o acesso."
      : step === 2
        ? isCreateMode
          ? "Esse nome aparece para todos os moradores."
          : "Use o código enviado por alguém da casa."
      : step === 3
          ? "Esse PIN protege o perfil neste aparelho."
          : "Depois de finalizar, o código do lar fica pronto para compartilhar.";
  const canGoNext =
    step === 1 ||
    (step === 2 && (isCreateMode ? householdName.trim().length > 1 : normalizeHouseholdCode(code).length >= 4)) ||
    (step === 3 && resident.name.trim().length > 1 && /^\d{4}$/.test(resident.pin)) ||
    step === 4;

  function goNext() {
    if (!canGoNext) {
      return;
    }

    setStep((current) => Math.min(current + 1, finalStep));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, hasInviteLink ? 3 : 1));
  }

  function handleFinish() {
    if (isCreateMode) {
      onCreate(householdName, resident);
      return;
    }

    onJoin(code, resident);
  }

  function updateResident(field: keyof StarterResidentInput, value: string) {
    setResident((current) => ({
      ...current,
      [field]: field === "pin" ? value.replace(/\D/g, "").slice(0, 4) : value,
    }));
  }

  return (
    <section className="household-setup">
      <header className="simple-header">
        <button className="brand-button" type="button" onClick={onShowReleaseNotes} aria-label="Ver novidades">
          <LogoMark size={24} />
        </button>
      </header>

      <div className="household-hero">
        <span className="household-icon">
          {step === 1 ? <House size={32} /> : step === 2 ? <KeyRound size={32} /> : step === 3 ? <UserPlus size={32} /> : <Users size={32} />}
        </span>
        <p className="eyebrow">Passo {visibleStep} de {totalSteps}</p>
        <h1>{stepTitle}</h1>
        <p>{stepDescription}</p>
      </div>

      <div className="household-card" key={`${mode}-${step}`}>
        <div className="setup-progress" aria-label={`Passo ${visibleStep} de ${totalSteps}`}>
          {Array.from({ length: totalSteps }, (_, index) => (
            <span className={index + 1 <= visibleStep ? "active" : ""} key={index} />
          ))}
        </div>

        {step === 1 ? (
          <div className="setup-choice-grid">
            {recentHouseholds.length ? (
              <div className="recent-household-list">
                <p className="eyebrow">Acesso rápido</p>
                {recentHouseholds.map((household) => (
                  <button
                    className="recent-household-card"
                    key={household.id}
                    type="button"
                    onClick={() => onContinue(household)}
                  >
                    <span>
                      <House size={20} />
                    </span>
                    <strong>{household.name}</strong>
                    <small>Continuar nesta família</small>
                  </button>
                ))}
              </div>
            ) : null}
            <button
              className={`setup-choice ${isCreateMode ? "selected" : ""}`}
              type="button"
              onClick={() => {
                setMode("create");
                setStep(2);
              }}
            >
              <House size={24} />
              <strong>Criar um lar</strong>
              <span>Sou responsável pela casa e vou convidar moradores.</span>
            </button>
            <button
              className={`setup-choice ${!isCreateMode ? "selected" : ""}`}
              type="button"
              onClick={() => {
                setMode("join");
                setStep(2);
              }}
            >
              <KeyRound size={24} />
              <strong>Entrar com código</strong>
              <span>Já recebi o código da casa de alguém.</span>
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="household-form">
            <div className="field">
              <label htmlFor={isCreateMode ? "household-name" : "household-code"}>
                {isCreateMode ? "Nome do lar" : "Código da casa"}
              </label>
              {isCreateMode ? (
                <input
                  id="household-name"
                  name="household"
                  placeholder="Ex: Casa da família Ramos"
                  value={householdName}
                  onChange={(event) => setHouseholdName(event.target.value)}
                  required
                />
              ) : (
                <input
                  id="household-code"
                  name="code"
                  inputMode="text"
                  placeholder="Ex: A7K2P9"
                  value={code}
                  onChange={(event) => setCode(normalizeHouseholdCode(event.target.value))}
                  required
                />
              )}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <ResidentStarterFields
            photo={photo}
            resident={resident}
            rolePlaceholder={isCreateMode ? "Ex: Admin da casa" : "Ex: Morador"}
            onChange={updateResident}
            onPhotoSelect={onPhotoSelect}
          />
        ) : null}

        {step === 4 ? (
          <div className="setup-invite-preview">
            <span className="invite-preview-icon">
              <Users size={26} />
            </span>
            <strong>Convite pronto no próximo passo</strong>
            <p>
              Ao finalizar, o J-tag gera o código do lar e libera o botão para copiar ou mandar convite para outros moradores.
            </p>
          </div>
        ) : null}

        <div className="setup-nav">
          {step > (hasInviteLink ? 3 : 1) ? (
            <button className="secondary-action" type="button" onClick={goBack}>
              <ChevronLeft size={18} />
              Voltar
            </button>
          ) : null}
          {step === 1 ? null : step < finalStep ? (
            <button className="primary-action" type="button" onClick={goNext} disabled={!canGoNext}>
              Próximo
              <ChevronRight size={18} />
            </button>
          ) : (
            <button className="primary-action" type="button" onClick={handleFinish} disabled={!canGoNext}>
              <Check size={18} />
              {isCreateMode ? "Finalizar e gerar convite" : hasInviteLink ? "Ingressar na família" : "Entrar no lar"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function ResidentStarterFields({
  photo,
  resident,
  rolePlaceholder,
  onChange,
  onPhotoSelect,
}: {
  photo: string;
  resident: StarterResidentInput;
  rolePlaceholder: string;
  onChange: (field: keyof StarterResidentInput, value: string) => void;
  onPhotoSelect: (photo: string) => void;
}) {
  return (
    <div className="household-form">
      <AvatarPicker photo={photo} compact onSelect={onPhotoSelect} />
      <div className="field">
        <label htmlFor="starter-name">Seu nome</label>
        <input
          id="starter-name"
          name="name"
          placeholder="Ex: Julia"
          value={resident.name}
          onChange={(event) => onChange("name", event.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="starter-role">Descrição</label>
        <input
          id="starter-role"
          name="role"
          placeholder={rolePlaceholder}
          value={resident.role}
          onChange={(event) => onChange("role", event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="starter-pin">PIN de 4 dígitos</label>
        <input
          id="starter-pin"
          inputMode="numeric"
          maxLength={4}
          minLength={4}
          name="pin"
          pattern="[0-9]{4}"
          placeholder="1234"
          value={resident.pin}
          onChange={(event) => onChange("pin", event.target.value)}
          required
        />
      </div>
    </div>
  );
}

function HouseholdInviteModal({
  activeResidentId,
  canManageMembers,
  household,
  residents,
  onClose,
  onCopy,
  onRemoveResident,
  onShare,
}: {
  activeResidentId?: string;
  canManageMembers: boolean;
  household: Household;
  residents: Resident[];
  onClose: () => void;
  onCopy: () => void;
  onRemoveResident: (residentId: string) => void;
  onShare: () => void;
}) {
  const inviteLink = buildInviteLink(household);
  const { backdropClassName, requestClose } = useModalClose(onClose);

  return (
    <div className={backdropClassName}>
      <section className="dark-modal invite-modal" role="dialog" aria-modal="true">
        <button className="close-button" type="button" onClick={requestClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <span className="emergency-icon neutral-icon">
          <Users size={34} />
        </span>
        <div>
          <p className="eyebrow">Código da casa</p>
          <h2>{household.name}</h2>
        </div>
        <div className="household-code-card" aria-label={`Código ${household.code}`}>
          {household.code.split("").map((letter, index) => (
            <span key={`${letter}-${index}`}>{letter}</span>
          ))}
        </div>
        {inviteLink ? (
          <div className="invite-link-box">
            <KeyRound size={16} />
            <span>{inviteLink}</span>
          </div>
        ) : null}
        <div className="invite-actions">
          <button className="secondary-action" type="button" onClick={onCopy}>
            <KeyRound size={18} />
            Copiar link
          </button>
          <button className="primary-action" type="button" onClick={onShare}>
            <UserPlus size={18} />
            Mandar convite
          </button>
        </div>
        <div className="member-management">
          <div className="member-management-title">
            <strong>Membros da família</strong>
            {canManageMembers ? <span>Você pode remover outros perfis.</span> : <span>Apenas o criador pode remover membros.</span>}
          </div>
          <div className="member-list">
            {residents.map((resident) => {
              const isOwner = household.ownerResidentId === resident.id;
              const isSelf = activeResidentId === resident.id;

              return (
                <div className="member-row" key={resident.id}>
                  <Avatar resident={resident} />
                  <span>
                    <strong>{resident.name}</strong>
                    <small>{isOwner ? "Criador da família" : resident.role}</small>
                  </span>
                  {canManageMembers && !isSelf ? (
                    <button
                      aria-label={`Remover ${resident.name}`}
                      type="button"
                      onClick={() => onRemoveResident(resident.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function Avatar({
  resident,
  variant = "normal",
}: {
  resident: Resident;
  variant?: "normal" | "large";
}) {
  return (
    <span
      className={`avatar-frame ${variant === "large" ? "avatar-large" : ""}`}
      style={{ backgroundColor: resident.photo ? undefined : resident.color }}
    >
      {resident.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" src={resident.photo} />
      ) : (
        resident.name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

function InfoPanel({
  title,
  children,
  onAdd,
  onOpen,
}: {
  title: string;
  children: React.ReactNode;
  onAdd?: () => void;
  onOpen?: () => void;
}) {
  return (
    <article
      className={`inside-panel ${onOpen ? "inside-panel-clickable" : ""}`}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (!onOpen) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="panel-title-row">
        <h2>{title}</h2>
        {onAdd ? (
          <button
            className="panel-add-button"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAdd();
            }}
            aria-label={`Adicionar ${title}`}
          >
            <Plus size={18} />
          </button>
        ) : null}
      </div>
      <div className="inside-list">{children}</div>
    </article>
  );
}

function LogoMark({ size = 22 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      className="logo-mark"
      height={size}
      src="/icon.svg"
      style={{ height: size, width: size }}
      width={size}
    />
  );
}

function PinModal({
  resident,
  pin,
  error,
  onClose,
  onDigit,
  onErase,
  onNativePinChange,
}: {
  resident: Resident;
  pin: string;
  error: string;
  onClose: () => void;
  onDigit: (digit: string) => void;
  onErase: () => void;
  onNativePinChange: (value: string) => void;
}) {
  const [useNativeKeyboard, setUseNativeKeyboard] = useState(false);
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const { backdropClassName, requestClose } = useModalClose(onClose);

  useEffect(() => {
    const mediaQueries = [
      window.matchMedia("(pointer: coarse)"),
      window.matchMedia("(max-width: 720px)"),
    ];
    const updateKeyboardMode = () => {
      setUseNativeKeyboard(mediaQueries.some((query) => query.matches));
    };

    updateKeyboardMode();
    mediaQueries.forEach((query) => query.addEventListener("change", updateKeyboardMode));

    return () => {
      mediaQueries.forEach((query) => query.removeEventListener("change", updateKeyboardMode));
    };
  }, []);

  useEffect(() => {
    if (useNativeKeyboard) {
      nativeInputRef.current?.focus();
    }
  }, [useNativeKeyboard]);

  return (
    <div className={backdropClassName}>
      <section className="dark-modal" role="dialog" aria-modal="true" aria-label="Entrar com PIN">
        <button className="close-button" type="button" onClick={requestClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <Avatar resident={resident} variant="large" />
        <div>
          <p className="eyebrow">Entrar como</p>
          <h2>{resident.name}</h2>
        </div>
        <div className="pin-dots" aria-label={`${pin.length} dígitos informados`}>
          {[0, 1, 2, 3].map((item) => (
            <span className={`pin-dot ${pin.length > item ? "active" : ""}`} key={item} />
          ))}
        </div>
        {error ? <p className="modal-error">{error}</p> : null}
        {useNativeKeyboard ? (
          <input
            ref={nativeInputRef}
            aria-label="PIN de 4 dígitos"
            autoComplete="current-password"
            autoFocus
            className="native-pin-input"
            inputMode="numeric"
            maxLength={4}
            pattern="[0-9]*"
            type="password"
            value={pin}
            onChange={(event) => onNativePinChange(event.target.value)}
          />
        ) : (
          <div className="keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <button key={digit} type="button" onClick={() => onDigit(digit)}>
                {digit}
              </button>
            ))}
            <button type="button" onClick={onErase}>
              apagar
            </button>
            <button type="button" onClick={() => onDigit("0")}>
              0
            </button>
            <button type="button" disabled>
              <LockKeyhole size={18} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function AvatarPicker({
  compact = false,
  fallbackColor,
  photo,
  onSelect,
}: {
  compact?: boolean;
  fallbackColor?: string;
  photo: string;
  onSelect: (photo: string) => void;
}) {
  return (
    <div className={`avatar-picker ${compact ? "avatar-picker-compact" : ""}`}>
      <div
        className="avatar-frame avatar-large avatar-empty avatar-picker-preview"
        style={{ backgroundColor: photo ? undefined : fallbackColor }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" src={photo} />
        ) : (
          <Users size={compact ? 28 : 34} />
        )}
      </div>
      <div className="avatar-picker-copy">
        <strong>Escolha um avatar</strong>
        <span>Imagens prontas para o perfil.</span>
      </div>
      <div className="avatar-option-grid" role="list" aria-label="Avatares prontos">
        {avatarOptions.map((avatar) => {
          const isSelected = photo === avatar.src;

          return (
            <button
              aria-label={`Usar avatar ${avatar.label}`}
              aria-pressed={isSelected}
              className={`avatar-option ${isSelected ? "selected" : ""}`}
              key={avatar.id}
              type="button"
              onClick={() => onSelect(avatar.src)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" src={avatar.src} />
            </button>
          );
        })}
      </div>
      {photo ? (
        <button className="avatar-clear-button" type="button" onClick={() => onSelect("")}>
          Usar inicial do nome
        </button>
      ) : null}
    </div>
  );
}

function ReleaseNotesModal({ onClose }: { onClose: () => void }) {
  const { backdropClassName, requestClose } = useModalClose(onClose);

  return (
    <div className={backdropClassName}>
      <section className="dark-modal release-modal" role="dialog" aria-modal="true" aria-labelledby="release-title">
        <button className="close-button" type="button" onClick={requestClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <span className="release-icon">
          <Info size={30} />
        </span>
        <div className="release-heading">
          <p className="eyebrow">
            {releaseNotes.version} • {releaseNotes.date}
          </p>
          <h2 id="release-title">{releaseNotes.title}</h2>
        </div>
        <div className="release-list">
          {releaseNotes.items.map((item) => (
            <div className="release-row" key={item}>
              <span aria-hidden="true" />
              <p>{item}</p>
            </div>
          ))}
        </div>
        <button className="primary-action" type="button" onClick={requestClose}>
          <Check size={18} />
          Entendi
        </button>
      </section>
    </div>
  );
}

function NewResidentModal({
  photo,
  onClose,
  onPhotoSelect,
  onSubmit,
}: {
  photo: string;
  onClose: () => void;
  onPhotoSelect: (photo: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { backdropClassName, requestClose } = useModalClose(onClose);

  return (
    <div className={backdropClassName}>
      <form className="dark-modal" onSubmit={onSubmit}>
        <button className="close-button" type="button" onClick={requestClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <AvatarPicker photo={photo} onSelect={onPhotoSelect} />
        <div>
          <p className="eyebrow">Novo perfil</p>
          <h2>Adicionar morador</h2>
        </div>
        <div className="field">
          <label htmlFor="resident-name">Nome</label>
          <input id="resident-name" name="name" placeholder="Ex: Julia" required />
        </div>
        <div className="field">
          <label htmlFor="resident-role">Descrição</label>
          <input id="resident-role" name="role" placeholder="Ex: Admin" />
        </div>
        <div className="field">
          <label htmlFor="resident-pin">PIN de 4 dígitos</label>
          <input
            id="resident-pin"
            inputMode="numeric"
            maxLength={4}
            minLength={4}
            name="pin"
            pattern="[0-9]{4}"
            placeholder="1234"
            required
          />
        </div>
        <button className="primary-action" type="submit">
          <Check size={18} />
          Criar perfil
        </button>
      </form>
    </div>
  );
}

function ReminderModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { backdropClassName, requestClose } = useModalClose(onClose);

  return (
    <div className={backdropClassName}>
      <form className="dark-modal" onSubmit={onSubmit}>
        <button className="close-button" type="button" onClick={requestClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <span className="emergency-icon neutral-icon">
          <Plus size={34} />
        </span>
        <div>
          <p className="eyebrow">Novo item</p>
          <h2>Lembrete</h2>
        </div>
        <div className="field">
          <label htmlFor="reminder-text">Lembrete</label>
          <input id="reminder-text" name="text" placeholder="Ex: Tomar remédio às 20h" required />
        </div>
        <div className="field">
          <span className="field-label">Icone</span>
          <div className="reminder-icon-grid">
            {reminderIconOptions.map(({ id, label, Icon }) => (
              <label className="reminder-icon-choice" key={id}>
                <input defaultChecked={id === "general"} name="icon" type="radio" value={id} />
                <span>
                  <Icon size={18} />
                </span>
                <strong>{label}</strong>
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="reminder-date">Quando</label>
          <div className="date-field">
            <CalendarDays size={18} />
            <input id="reminder-date" name="date" type="date" />
          </div>
        </div>
        <button className="primary-action" type="submit">
          <Check size={18} />
          Salvar lembrete
        </button>
      </form>
    </div>
  );
}

function BirthdayModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { backdropClassName, requestClose } = useModalClose(onClose);

  return (
    <div className={backdropClassName}>
      <form className="dark-modal" onSubmit={onSubmit}>
        <button className="close-button" type="button" onClick={requestClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <span className="emergency-icon neutral-icon">
          <Plus size={34} />
        </span>
        <div>
          <p className="eyebrow">Novo item</p>
          <h2>Aniversário</h2>
        </div>
        <div className="field">
          <label htmlFor="birthday-name">Nome</label>
          <input id="birthday-name" name="name" placeholder="Ex: Mãe" required />
        </div>
        <div className="field">
          <label htmlFor="birthday-date">Data</label>
          <div className="date-field">
            <CalendarDays size={18} />
            <input id="birthday-date" name="date" type="date" required />
          </div>
        </div>
        <button className="primary-action" type="submit">
          <Check size={18} />
          Salvar aniversário
        </button>
      </form>
    </div>
  );
}

function EditResidentModal({
  photo,
  resident,
  onClose,
  onDelete,
  onPhotoSelect,
  onThemePreview,
  onSubmit,
}: {
  photo: string;
  resident: Resident;
  onClose: () => void;
  onDelete: () => void;
  onPhotoSelect: (photo: string) => void;
  onThemePreview: (theme: ProfileThemeId) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { backdropClassName, requestClose } = useModalClose(onClose);

  return (
    <div className={backdropClassName}>
      <form className="dark-modal" onSubmit={onSubmit}>
        <button className="close-button" type="button" onClick={requestClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <AvatarPicker fallbackColor={resident.color} photo={photo} onSelect={onPhotoSelect} />
        <div>
          <p className="eyebrow">Editar perfil</p>
          <h2>{resident.name}</h2>
        </div>
        <div className="field">
          <label htmlFor="edit-resident-name">Nome</label>
          <input id="edit-resident-name" name="name" defaultValue={resident.name} required />
        </div>
        <div className="field">
          <label htmlFor="edit-resident-role">Descrição</label>
          <input id="edit-resident-role" name="role" defaultValue={resident.role} />
        </div>
        <div className="field">
          <label htmlFor="edit-resident-pin">PIN de 4 dígitos</label>
          <input
            id="edit-resident-pin"
            inputMode="numeric"
            maxLength={4}
            minLength={4}
            name="pin"
            pattern="[0-9]{4}"
            defaultValue={resident.pin}
            required
          />
        </div>
        <div className="field">
          <span className="field-label">Tema do perfil</span>
          <div className="theme-choice-grid">
            {profileThemes.map((theme) => (
              <label className="theme-choice" key={theme.id}>
                <input
                  defaultChecked={getProfileTheme(resident.theme) === theme.id}
                  name="theme"
                  onChange={() => onThemePreview(theme.id)}
                  type="radio"
                  value={theme.id}
                />
                <span className="theme-swatch-row" aria-hidden="true">
                  {theme.swatches.map((swatch) => (
                    <i key={swatch} style={{ background: swatch }} />
                  ))}
                </span>
                <strong>{theme.label}</strong>
              </label>
            ))}
          </div>
        </div>
        <button className="primary-action" type="submit">
          <Check size={18} />
          Salvar perfil
        </button>
        <button className="danger-action" type="button" onClick={onDelete}>
          <Trash2 size={18} />
          Excluir perfil
        </button>
      </form>
    </div>
  );
}

function ListIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
      <path d="M5 4h8M5 8h8M5 12h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M2.5 4h.01M2.5 8h.01M2.5 12h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
    </svg>
  );
}

function ReminderIconBadge({ icon }: { icon?: ReminderIcon }) {
  const option = reminderIconMap[icon ?? "general"] ?? reminderIconMap.general;
  const Icon = option.Icon;

  return (
    <span className={`reminder-icon-badge reminder-icon-${option.id}`} aria-label={option.label}>
      <Icon size={15} />
    </span>
  );
}

type CalendarItem = (Reminder | Birthday) & { parsedDate: Date };

function CalendarModal({
  items,
  kind,
  onClose,
  onCreate,
  onDelete,
  title,
}: {
  items: Array<Reminder | Birthday>;
  kind: "reminder" | "birthday";
  onClose: () => void;
  onCreate: () => void;
  onDelete: (item: Reminder | Birthday) => void;
  title: string;
}) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() => getSavedCalendarView(kind));
  const today = startOfToday();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(today));
  const [selectedCalendarItem, setSelectedCalendarItem] = useState<CalendarItem | null>(null);
  const [monthMotionDirection, setMonthMotionDirection] = useState<"next" | "prev">("next");
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const { backdropClassName, requestClose } = useModalClose(onClose);
  const calendarDays = getCalendarDays(currentMonth);
  const monthLabel = currentMonth.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const calendarItems = items
    .map((item) => {
      const parsedDate =
        kind === "reminder"
          ? parseReminderDate((item as Reminder).date)
          : parseBirthdayDate(formatBirthdayValue((item as Birthday).date));

      if (parsedDate && kind === "birthday") {
        parsedDate.setFullYear(currentMonth.getFullYear());
      }

      return parsedDate
        ? {
            ...item,
            parsedDate,
          }
        : null;
    })
    .filter((item): item is (Reminder | Birthday) & { parsedDate: Date } => Boolean(item));

  const monthItems = calendarItems
    .filter(
      (item) =>
        item.parsedDate.getFullYear() === currentMonth.getFullYear() &&
        item.parsedDate.getMonth() === currentMonth.getMonth(),
    )
    .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
  const overdueReminderItems =
    kind === "reminder"
      ? calendarItems
          .filter((item) => daysBetween(today, item.parsedDate) < 0)
          .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())
      : [];
  const timelineStart = kind === "reminder" ? addDays(startOfMonth(currentMonth), -7) : startOfMonth(currentMonth);
  const timelineDayCount = kind === "reminder" ? 98 : 92;
  const timelineDays = Array.from({ length: timelineDayCount }, (_, index) => addDays(timelineStart, index));
  const timelineSections = timelineDays.map((date) => ({
    date,
    items: calendarItems.filter(
      (item) => sameCalendarDay(item.parsedDate, date) && !(kind === "reminder" && daysBetween(today, item.parsedDate) < 0),
    ),
  }));

  function getItemsForDay(day: Date) {
    return calendarItems.filter((item) => sameCalendarDay(item.parsedDate, day));
  }

  function handleViewModeChange(mode: CalendarViewMode) {
    setViewMode(mode);
    setSelectedCalendarItem(null);
    saveCalendarView(kind, mode);
  }

  function moveMonth(amount: number) {
    setSelectedCalendarItem(null);
    setMonthMotionDirection(amount > 0 ? "next" : "prev");
    setCurrentMonth((month) => addMonths(month, amount));
  }

  function handleTouchEnd(clientX: number) {
    if (touchStartX === null) {
      return;
    }

    const distance = clientX - touchStartX;
    setTouchStartX(null);

    if (Math.abs(distance) < 42) {
      return;
    }

    moveMonth(distance < 0 ? 1 : -1);
  }

  function handleDeleteSelectedItem() {
    if (!selectedCalendarItem) {
      return;
    }

    onDelete(selectedCalendarItem);
    setSelectedCalendarItem(null);
  }

  const monthNavigation = (
    <div className="calendar-month-nav">
      <button type="button" onClick={() => moveMonth(-1)} aria-label="Mes anterior">
        <ChevronLeft size={18} />
      </button>
      <span>{monthLabel}</span>
      <button type="button" onClick={() => moveMonth(1)} aria-label="Próximo mês">
        <ChevronRight size={18} />
      </button>
    </div>
  );

  return (
    <div className={backdropClassName}>
      <section className="dark-modal calendar-modal" role="dialog" aria-modal="true">
        <button className="close-button" type="button" onClick={requestClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <div className="calendar-modal-header">
          <span className={`calendar-modal-icon ${kind === "birthday" ? "birthday-icon" : ""}`}>
            {kind === "birthday" ? <Cake size={28} /> : <CalendarDays size={28} />}
          </span>
          <div>
            <p className="eyebrow">{monthLabel}</p>
            <h2>{title}</h2>
          </div>
        </div>

        <div className="view-toggle" role="group" aria-label="Modo de visualizacao">
          <button
            className={viewMode === "calendar" ? "active" : ""}
            type="button"
            onClick={() => handleViewModeChange("calendar")}
          >
            <CalendarDays size={16} />
            Calendário
          </button>
          <button
            className={viewMode === "list" ? "active" : ""}
            type="button"
            onClick={() => handleViewModeChange("list")}
          >
            <ListIcon />
            Lista
          </button>
        </div>

        <div className={`calendar-view-content calendar-view-${viewMode}`} key={viewMode}>
          {viewMode === "calendar" ? (
            <div
              className={`calendar-board calendar-board-${monthMotionDirection}`}
              key={`${kind}-${currentMonth.toISOString()}`}
              onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
              onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
            >
              {monthNavigation}
              <p className="calendar-mode-note">
                Arraste para trocar de mês. Toque no ícone para ver detalhes.
              </p>
              <div className="calendar-weekdays" aria-hidden="true">
                {["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => (
                  <span key={`${day}-${index}`}>{day}</span>
                ))}
              </div>
              <div className="calendar-grid">
                {calendarDays.map((day) => {
                  const dayItems = getItemsForDay(day.date);
                  const isToday = sameCalendarDay(day.date, today);

                  return (
                    <div
                      className={`calendar-day ${day.isCurrentMonth ? "" : "muted-day"} ${
                        isToday ? "calendar-day-today" : ""
                      } ${dayItems.length ? "calendar-day-marked" : ""}`}
                      key={day.key}
                    >
                      <span>{day.day}</span>
                      <div className="calendar-day-events" aria-hidden={!dayItems.length}>
                        {dayItems.slice(0, 2).map((item) => (
                          <button
                            className={`calendar-day-event ${kind === "birthday" ? "birthday-event" : ""}`}
                            type="button"
                            key={item.id}
                            onClick={() => setSelectedCalendarItem(item)}
                            aria-label={`Abrir ${kind === "birthday" ? "aniversário" : "lembrete"}`}
                          >
                            {kind === "birthday" ? (
                              <Cake size={14} />
                            ) : (
                              <ReminderIconBadge icon={(item as Reminder).icon} />
                            )}
                          </button>
                        ))}
                        {dayItems.length > 2 ? <small>+{dayItems.length - 2}</small> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {viewMode === "list" ? (
            <div
              className={`calendar-list-board calendar-board-${monthMotionDirection}`}
              key={`${kind}-list-${currentMonth.toISOString()}`}
              onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
              onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
            >
              {monthNavigation}
              <p className="calendar-mode-note">
                Arraste para trocar de mês. {kind === "reminder" ? "Atrasados ficam no topo." : "Veja os aniversários do mês."}
              </p>
              {overdueReminderItems.length ? (
                <div className="calendar-timeline-overdue">
                  <span>Lembretes atrasados</span>
                  {overdueReminderItems.map((item) => (
                    <button
                      className="calendar-agenda-row calendar-agenda-overdue"
                      key={`overdue-${item.id}`}
                      type="button"
                      onClick={() => setSelectedCalendarItem(item)}
                    >
                      <span className="inside-row-main">
                        <ReminderIconBadge icon={(item as Reminder).icon} />
                        <span className="row-label">{"text" in item ? item.text : item.name}</span>
                      </span>
                      <small>Atrasado</small>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="calendar-timeline calendar-agenda-list-mode">
                {timelineSections.map((section) => {
                  const distance = daysBetween(today, section.date);
                  const dayLabel =
                    distance === 0
                      ? "Hoje"
                      : distance === 1
                        ? "Amanhã"
                        : section.date.toLocaleDateString("pt-BR", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                          });
                  const isMutedDay = section.items.length === 0;

                  return (
                    <section
                      className={`calendar-timeline-day ${isMutedDay ? "calendar-timeline-empty" : ""}`}
                      key={section.date.toISOString()}
                    >
                      <div className="calendar-timeline-date">
                        <strong>{dayLabel}</strong>
                        <span>{section.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                      </div>
                      <div className="calendar-timeline-items">
                        {section.items.length ? (
                          section.items.map((item) => {
                            const isOverdueReminder = kind === "reminder" && daysBetween(today, item.parsedDate) < 0;

                            return (
                              <button
                                className={`calendar-agenda-row ${isOverdueReminder ? "calendar-agenda-overdue" : ""}`}
                                key={item.id}
                                type="button"
                                onClick={() => setSelectedCalendarItem(item)}
                              >
                                <span className="inside-row-main">
                                  {kind === "birthday" ? (
                                    <Cake size={16} />
                                  ) : (
                                    <ReminderIconBadge icon={(item as Reminder).icon} />
                                  )}
                                  <span className="row-label">{"text" in item ? item.text : item.name}</span>
                                </span>
                                <small>{isOverdueReminder ? "Atrasado" : kind === "birthday" ? formatBirthdayValue(item.date) : formatDateLabel(item.date)}</small>
                              </button>
                            );
                          })
                        ) : (
                          <span className="calendar-empty-day">Sem itens</span>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <button className="primary-action" type="button" onClick={onCreate}>
          <Plus size={18} />
          Adicionar
        </button>

        {selectedCalendarItem ? (
          <div className="calendar-detail-backdrop">
            <article className="calendar-detail-card">
              <button
                className="close-button"
                type="button"
                onClick={() => setSelectedCalendarItem(null)}
                aria-label="Fechar detalhe"
              >
                <X size={18} />
              </button>
              <span className={`calendar-detail-icon ${kind === "birthday" ? "birthday-detail-icon" : ""}`}>
                {kind === "birthday" ? (
                  <Cake size={26} />
                ) : (
                  <ReminderIconBadge icon={(selectedCalendarItem as Reminder).icon} />
                )}
              </span>
              <div>
                <p className="eyebrow">{kind === "birthday" ? "Aniversário" : "Lembrete"}</p>
                <h3>{"text" in selectedCalendarItem ? selectedCalendarItem.text : selectedCalendarItem.name}</h3>
                <small>
                  {kind === "birthday"
                    ? formatBirthdayValue((selectedCalendarItem as Birthday).date)
                    : formatDateLabel((selectedCalendarItem as Reminder).date)}
                </small>
              </div>
              <button className="calendar-delete-button" type="button" onClick={handleDeleteSelectedItem}>
                <Trash2 size={17} />
                Excluir
              </button>
            </article>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function EmergencyModal({
  contacts,
  onAddContact,
  onClose,
  onPickDeviceContact,
  onRemoveContact,
}: {
  contacts: EmergencyContact[];
  onAddContact: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  onPickDeviceContact: () => void;
  onRemoveContact: (contactId: string) => void;
}) {
  const [showContactForm, setShowContactForm] = useState(false);
  const { backdropClassName, requestClose } = useModalClose(onClose);

  return (
    <div className={backdropClassName}>
      <section className="dark-modal emergency-modal" role="dialog" aria-modal="true">
        <button className="close-button" type="button" onClick={requestClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <span className="emergency-icon">
          <HeartPulse size={34} />
        </span>
        <div>
          <p className="eyebrow">Emergência</p>
          <h2>Ajuda rapida</h2>
        </div>
        <div className="emergency-list">
          <a className="emergency-link" href="tel:192">
            <Phone size={18} />
            SAMU 192
          </a>
          <a className="emergency-link" href="tel:190">
            <Phone size={18} />
            Polícia 190
          </a>
          <a className="emergency-link" href="tel:193">
            <Phone size={18} />
            Bombeiros 193
          </a>
          {contacts.map((contact) => (
            <div className="emergency-contact-row" key={contact.id}>
              <a href={`tel:${contact.phone}`}>
                <strong>{contact.name}</strong>
                <span>{contact.phone}</span>
              </a>
              <button
                aria-label={`Remover ${contact.name}`}
                type="button"
                onClick={() => onRemoveContact(contact.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="emergency-actions">
          <button className="secondary-action" type="button" onClick={onPickDeviceContact}>
            <UserPlus size={18} />
            Usar contato
          </button>
          <button
            className="contact-add-button"
            type="button"
            onClick={() => setShowContactForm((current) => !current)}
            aria-label="Adicionar contato manualmente"
          >
            <Plus size={22} />
          </button>
        </div>

        {showContactForm ? (
          <form
            className="emergency-form"
            onSubmit={(event) => {
              onAddContact(event);
              setShowContactForm(false);
            }}
          >
            <div className="field">
              <label htmlFor="emergency-name">Nome</label>
              <input id="emergency-name" name="name" placeholder="Ex: Mãe" required />
            </div>
            <div className="field">
              <label htmlFor="emergency-phone">Telefone</label>
              <input
                id="emergency-phone"
                inputMode="tel"
                name="phone"
                placeholder="Ex: +55 11 99999-9999"
                required
                type="tel"
              />
            </div>
            <button className="primary-action" type="submit">
              <Check size={18} />
              Salvar contato
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}


