"use client";

import { createClient } from "@supabase/supabase-js";
import {
  Cake,
  Bell,
  Camera,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  HeartPulse,
  House,
  KeyRound,
  Lightbulb,
  LockKeyhole,
  Mic,
  Pencil,
  Phone,
  Pill,
  Plus,
  ShoppingCart,
  Siren,
  Users,
  Trash2,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

type Resident = {
  id: string;
  name: string;
  role: string;
  pin: string;
  color: string;
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
  start: () => void;
};

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
};

const STORAGE_KEY = "jtag-mvp-state-v2";
const LAST_RESIDENT_KEY = "jtag-last-resident-id-v2";
const CALENDAR_VIEW_KEY = "jtag-calendar-view-mode";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase =
  SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

type CalendarViewMode = "calendar" | "list";
type ReminderIcon = "general" | "shopping" | "lightbulb" | "medicine" | "home" | "document";

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

const defaultState: AppState = {
  household: null,
  residents: [],
  reminders: [],
  birthdays: [],
  emergencyContacts: [],
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
      residents: (parsed.residents ?? defaultState.residents).map((resident, index) => ({
        ...resident,
        color: resident.color ?? ["#e50914", "#2f80ed", "#f2994a", "#27ae60"][index % 4],
      })),
    };
  } catch {
    return defaultState;
  }
}

function saveState(state: AppState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

async function loadRemoteStateByHousehold(household: HouseholdRow): Promise<AppState | null> {
  if (!supabase) {
    return null;
  }

  const [residentsResult, remindersResult, birthdaysResult, contactsResult] = await Promise.all([
    supabase.from("residents").select("*").eq("household_id", household.id).order("created_at"),
    supabase.from("reminders").select("*").eq("household_id", household.id).order("created_at", { ascending: false }),
    supabase.from("birthdays").select("*").eq("household_id", household.id).order("created_at", { ascending: false }),
    supabase.from("emergency_contacts").select("*").eq("household_id", household.id).order("created_at"),
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

  const { error: residentError } = await supabase.from("residents").insert({
    id: resident.id,
    household_id: household.id,
    name: resident.name,
    role: resident.role,
    pin: resident.pin,
    color: resident.color,
    photo_url: resident.photo ?? null,
  });

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

  const { error } = await supabase.from("residents").insert({
    id: resident.id,
    household_id: householdId,
    name: resident.name,
    role: resident.role,
    pin: resident.pin,
    color: resident.color,
    photo_url: resident.photo ?? null,
  });

  return !error;
}

async function updateRemoteResident(resident: Resident) {
  if (!supabase) {
    return false;
  }

  const { error } = await supabase
    .from("residents")
    .update({
      name: resident.name,
      role: resident.role,
      pin: resident.pin,
      photo_url: resident.photo ?? null,
    })
    .eq("id", resident.id);

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

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

export default function HomePage() {
  const [appState, setAppState] = useState<AppState>(defaultState);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [activeResident, setActiveResident] = useState<Resident | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [showNewResident, setShowNewResident] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showHouseholdInvite, setShowHouseholdInvite] = useState(false);
  const [pendingInviteCode, setPendingInviteCode] = useState("");
  const [profileModal, setProfileModal] = useState<
    "reminder" | "birthday" | "edit" | "reminderCalendar" | "birthdayCalendar" | null
  >(null);
  const [newResidentPhoto, setNewResidentPhoto] = useState("");
  const [editResidentPhoto, setEditResidentPhoto] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const pendingVoiceHandlerRef = useRef<((transcript: string) => void) | null>(null);
  const speechFallbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const storedState = loadState();
    const lastResidentId = window.localStorage.getItem(LAST_RESIDENT_KEY);
    const lastResident = storedState.residents.find((resident) => resident.id === lastResidentId);
    const inviteCode = normalizeHouseholdCode(new URLSearchParams(window.location.search).get("lar") ?? "");

    setAppState(storedState);
    if (storedState.household && lastResident) {
      setActiveResident(lastResident);
    }
    if (!storedState.household && inviteCode) {
      setPendingInviteCode(inviteCode);
    }

    async function hydrateRemoteState() {
      const remoteState = inviteCode
        ? await loadRemoteStateByCode(inviteCode)
        : storedState.household
          ? await loadRemoteStateById(storedState.household.id)
          : null;

      if (!isMounted || !remoteState) {
        return;
      }

      const remoteLastResident = remoteState.residents.find((resident) => resident.id === lastResidentId);
      setAppState(remoteState);
      if (remoteLastResident) {
        setActiveResident(remoteLastResident);
      }
      if (inviteCode) {
        setPendingInviteCode(inviteCode);
      }
    }

    hydrateRemoteState();

    const timer = window.setTimeout(() => setShowSplash(false), 1350);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      saveState(appState);
    }
  }, [appState]);

  const activeReminders = useMemo(() => {
    if (!activeResident) {
      return [];
    }

    return appState.reminders.filter((item) => item.residentId === activeResident.id);
  }, [activeResident, appState.reminders]);
  const reminderPreview = useMemo(() => getReminderPreview(activeReminders), [activeReminders]);
  const birthdayPreview = useMemo(() => getBirthdayPreview(appState.birthdays), [appState.birthdays]);

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

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const photo = await fileToDataUrl(file);
    setNewResidentPhoto(photo);
  }

  async function handleEditPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const photo = await fileToDataUrl(file);
    setEditResidentPhoto(photo);
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

  async function handleUpdateResident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeResident) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const role = String(form.get("role") ?? "").trim();
    const newPin = String(form.get("pin") ?? "").trim();

    if (!name || newPin.length !== 4) {
      return;
    }

    const updatedResident: Resident = {
      ...activeResident,
      name,
      role: role || "Morador",
      pin: newPin,
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
    setProfileModal(null);
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
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event) => {
      setIsListening(false);
      showAssistantMessage(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Eu não tenho permissão para usar o microfone. Libere o acesso ou use os botões +."
          : "Não consegui ouvir direito. Tente de novo ou use os botões +.",
      );
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      pendingVoiceHandlerRef.current = null;
      onTranscript(transcript);
    };

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      showAssistantMessage("Não consegui iniciar o microfone aqui. Tente no Chrome ou use os botões +.");
    }
  }

  function askAssistant(message: string, onTranscript: (transcript: string) => void) {
    pendingVoiceHandlerRef.current = onTranscript;
    setVoiceMessage(message);
    speakAssistant(message, () => {
      if (pendingVoiceHandlerRef.current !== onTranscript) {
        return;
      }

      setVoiceMessage("Estou ouvindo... Se o iPhone não abrir o microfone, toque nele e responda.");
      startVoiceRecognition(onTranscript);
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
    if (isListening) {
      return;
    }

    if (pendingVoiceHandlerRef.current) {
      const pendingHandler = pendingVoiceHandlerRef.current;
      setVoiceMessage("Estou ouvindo sua resposta...");
      startVoiceRecognition(pendingHandler);
      return;
    }

    showAssistantMessage("Estou tentando abrir o microfone...", false);
    setVoiceMessage("Estou ouvindo. Pode falar, por exemplo: adicionar lembrete.");
    startVoiceRecognition(runVoiceCommand);
  }

  if (!appState.household) {
    return (
      <main className="screen-shell">
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
          onCreate={handleCreateHousehold}
          onJoin={handleJoinHousehold}
          onPhotoChange={handlePhotoChange}
        />
      </main>
    );
  }

  if (activeResident) {
    return (
      <main className="screen-shell">
        <section className="inside-view">
          <div className="inside-topbar">
            <button className="brand-button" type="button" onClick={handleSwitchProfile} aria-label="Voltar para perfis">
              <LogoMark size={24} />
            </button>
            <div className="topbar-actions">
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
                  setProfileModal("edit");
                }}
                aria-label="Editar perfil"
              >
                <Pencil size={20} />
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
          <div className="inside-hero">
            <Avatar resident={activeResident} variant="large" />
            <div>
              <p className="eyebrow">Perfil ativo</p>
              <h1>{activeResident.name}</h1>
              <span>{activeResident.role}</span>
            </div>
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
              setProfileModal(null);
            }}
            onDelete={handleDeleteResident}
            onPhotoChange={handleEditPhotoChange}
            onSubmit={handleUpdateResident}
          />
        ) : null}
        {profileModal === "reminderCalendar" ? (
          <CalendarModal
            items={activeReminders}
            kind="reminder"
            onClose={() => setProfileModal(null)}
            onCreate={() => setProfileModal("reminder")}
            title="Calendário de lembretes"
          />
        ) : null}
        {profileModal === "birthdayCalendar" ? (
          <CalendarModal
            items={appState.birthdays}
            kind="birthday"
            onClose={() => setProfileModal(null)}
            onCreate={() => setProfileModal("birthday")}
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
      </main>
    );
  }

  return (
    <main className="screen-shell">
      {showSplash ? (
        <section className="splash-screen" aria-label="Carregando J-Tag">
          <div className="splash-logo">
            <LogoMark size={76} />
          </div>
        </section>
      ) : null}

      <section className="profile-stage">
        <header className="simple-header">
          <button className="brand-button" type="button" aria-label="Inicio">
            <LogoMark size={24} />
          </button>
          <button className="household-pill" type="button" onClick={() => setShowHouseholdInvite(true)}>
            <House size={17} />
            <span>{appState.household.name}</span>
            <strong>{appState.household.code}</strong>
          </button>
        </header>

        <div className="profile-copy">
          <p className="eyebrow">NFC conectado</p>
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
          onPhotoChange={handlePhotoChange}
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
    </main>
  );
}

function HouseholdSetup({
  inviteCode,
  photo,
  onCreate,
  onJoin,
  onPhotoChange,
}: {
  inviteCode: string;
  photo: string;
  onCreate: (householdName: string, resident: StarterResidentInput) => void;
  onJoin: (code: string, resident: StarterResidentInput) => void;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const [mode, setMode] = useState<"create" | "join">(inviteCode ? "join" : "create");
  const [step, setStep] = useState(1);
  const [householdName, setHouseholdName] = useState("");
  const [code, setCode] = useState(inviteCode);
  const [resident, setResident] = useState<StarterResidentInput>({
    name: "",
    role: "",
    pin: "",
  });
  const isCreateMode = mode === "create";
  const totalSteps = isCreateMode ? 4 : 3;
  const stepTitle =
    step === 1
      ? "Como você quer começar?"
      : step === 2
        ? isCreateMode
          ? "Dê um nome para sua casa"
          : "Digite o código da casa"
        : step === 3
          ? "Crie seu perfil"
          : "Convide quem mora com você";
  const stepDescription =
    step === 1
      ? "Escolha uma opção para preparar o acesso por NFC."
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

    setStep((current) => Math.min(current + 1, totalSteps));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 1));
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
        <button className="brand-button" type="button" aria-label="Inicio">
          <LogoMark size={24} />
        </button>
      </header>

      <div className="household-hero">
        <span className="household-icon">
          {step === 1 ? <House size={32} /> : step === 2 ? <KeyRound size={32} /> : step === 3 ? <UserPlus size={32} /> : <Users size={32} />}
        </span>
        <p className="eyebrow">Passo {step} de {totalSteps}</p>
        <h1>{stepTitle}</h1>
        <p>{stepDescription}</p>
      </div>

      <div className="household-card" key={`${mode}-${step}`}>
        <div className="setup-progress" aria-label={`Passo ${step} de ${totalSteps}`}>
          {Array.from({ length: totalSteps }, (_, index) => (
            <span className={index + 1 <= step ? "active" : ""} key={index} />
          ))}
        </div>

        {step === 1 ? (
          <div className="setup-choice-grid">
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
            onPhotoChange={onPhotoChange}
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
          {step > 1 ? (
            <button className="secondary-action" type="button" onClick={goBack}>
              <ChevronLeft size={18} />
              Voltar
            </button>
          ) : null}
          {step === 1 ? null : step < totalSteps ? (
            <button className="primary-action" type="button" onClick={goNext} disabled={!canGoNext}>
              Próximo
              <ChevronRight size={18} />
            </button>
          ) : (
            <button className="primary-action" type="button" onClick={handleFinish} disabled={!canGoNext}>
              <Check size={18} />
              {isCreateMode ? "Finalizar e gerar convite" : "Entrar no lar"}
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
  onPhotoChange,
}: {
  photo: string;
  resident: StarterResidentInput;
  rolePlaceholder: string;
  onChange: (field: keyof StarterResidentInput, value: string) => void;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="household-form">
      <label className="photo-picker compact-photo-picker">
        <span className="avatar-frame avatar-large avatar-empty">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" src={photo} />
          ) : (
            <Camera size={30} />
          )}
        </span>
        <input accept="image/*" name="photo" type="file" onChange={onPhotoChange} />
      </label>
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

  return (
    <div className="modal-backdrop">
      <section className="dark-modal invite-modal" role="dialog" aria-modal="true">
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar">
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
        <p className="invite-note">
          Quem abrir esse link consegue entrar na família e criar um perfil. No banco real, esse convite vai poder expirar e ter permissão.
        </p>
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
    <div className="modal-backdrop">
      <section className="dark-modal" role="dialog" aria-modal="true" aria-label="Entrar com PIN">
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar">
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

function NewResidentModal({
  photo,
  onClose,
  onPhotoChange,
  onSubmit,
}: {
  photo: string;
  onClose: () => void;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-backdrop">
      <form className="dark-modal" onSubmit={onSubmit}>
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <label className="photo-picker">
          <span className="avatar-frame avatar-large avatar-empty">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" src={photo} />
            ) : (
              <Camera size={34} />
            )}
          </span>
          <input accept="image/*" name="photo" type="file" onChange={onPhotoChange} />
        </label>
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
  return (
    <div className="modal-backdrop">
      <form className="dark-modal" onSubmit={onSubmit}>
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar">
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
  return (
    <div className="modal-backdrop">
      <form className="dark-modal" onSubmit={onSubmit}>
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar">
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
  onPhotoChange,
  onSubmit,
}: {
  photo: string;
  resident: Resident;
  onClose: () => void;
  onDelete: () => void;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-backdrop">
      <form className="dark-modal" onSubmit={onSubmit}>
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <label className="photo-picker">
          <span
            className="avatar-frame avatar-large avatar-empty"
            style={{ backgroundColor: photo ? undefined : resident.color }}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" src={photo} />
            ) : (
              <Camera size={34} />
            )}
          </span>
          <input accept="image/*" name="photo" type="file" onChange={onPhotoChange} />
        </label>
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
  title,
}: {
  items: Array<Reminder | Birthday>;
  kind: "reminder" | "birthday";
  onClose: () => void;
  onCreate: () => void;
  title: string;
}) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() => getSavedCalendarView(kind));
  const today = startOfToday();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(today));
  const [selectedCalendarItem, setSelectedCalendarItem] = useState<CalendarItem | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
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

  return (
    <div className="modal-backdrop">
      <section className="dark-modal calendar-modal" role="dialog" aria-modal="true">
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar">
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
              className="calendar-board"
              onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
              onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
            >
              <div className="calendar-month-nav">
                <button type="button" onClick={() => moveMonth(-1)} aria-label="Mes anterior">
                  <ChevronLeft size={18} />
                </button>
                <span>{monthLabel}</span>
                <button type="button" onClick={() => moveMonth(1)} aria-label="Próximo mês">
                  <ChevronRight size={18} />
                </button>
              </div>
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
            <div className="calendar-agenda calendar-agenda-list-mode">
              {monthItems.length ? (
                monthItems.map((item) => (
                  <button
                    className="calendar-agenda-row"
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
                    <small>{kind === "birthday" ? formatBirthdayValue(item.date) : formatDateLabel(item.date)}</small>
                  </button>
                ))
              ) : (
                <p>Nenhum item neste mês.</p>
              )}
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

  return (
    <div className="modal-backdrop">
      <section className="dark-modal emergency-modal" role="dialog" aria-modal="true">
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar">
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
