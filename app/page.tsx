"use client";

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
  Lightbulb,
  LockKeyhole,
  Mic,
  Pencil,
  Phone,
  Pill,
  Plus,
  ShoppingCart,
  Siren,
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

type AppState = {
  residents: Resident[];
  reminders: Reminder[];
  birthdays: Birthday[];
  emergencyContacts: EmergencyContact[];
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

const STORAGE_KEY = "jtag-mvp-state";
const LAST_RESIDENT_KEY = "jtag-last-resident-id";
const CALENDAR_VIEW_KEY = "jtag-calendar-view-mode";

type CalendarViewMode = "calendar" | "list";
type ReminderIcon = "general" | "shopping" | "lightbulb" | "medicine" | "home" | "document";

const reminderIconOptions: Array<{
  id: ReminderIcon;
  label: string;
  Icon: LucideIcon;
}> = [
  { id: "general", label: "Geral", Icon: Bell },
  { id: "shopping", label: "Compra", Icon: ShoppingCart },
  { id: "lightbulb", label: "Ideia", Icon: Lightbulb },
  { id: "medicine", label: "Remedio", Icon: Pill },
  { id: "home", label: "Casa", Icon: House },
  { id: "document", label: "Documento", Icon: FileText },
];

const reminderIconMap = Object.fromEntries(
  reminderIconOptions.map((option) => [option.id, option]),
) as Record<ReminderIcon, (typeof reminderIconOptions)[number]>;

const defaultState: AppState = {
  residents: [
    {
      id: "julia",
      name: "Julia",
      role: "Admin",
      pin: "1234",
      color: "#e50914",
    },
    {
      id: "visitante",
      name: "Visitante",
      role: "Acesso rapido",
      pin: "0000",
      color: "#2f80ed",
    },
  ],
  reminders: [
    {
      id: "r1",
      residentId: "julia",
      text: "Comprar pilhas para as etiquetas NFC",
      date: "2026-07-15",
      icon: "shopping",
    },
    {
      id: "r2",
      residentId: "julia",
      text: "Separar documentos da consulta",
      date: "2026-07-14",
      icon: "document",
    },
    {
      id: "r3",
      residentId: "julia",
      text: "Ligar para confirmar entrega",
      date: "2026-07-16",
      icon: "general",
    },
    {
      id: "r4",
      residentId: "julia",
      text: "Comprar presente de aniversario",
      date: "2026-07-20",
      icon: "shopping",
    },
  ],
  birthdays: [
    { id: "b1", name: "Mae", date: "10/07" },
    { id: "b2", name: "Julia", date: "15/07" },
    { id: "b3", name: "Tio Carlos", date: "20/07" },
    { id: "b4", name: "Ana", date: "02/08" },
    { id: "b5", name: "Pedro", date: "12/09" },
  ],
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
  const [profileModal, setProfileModal] = useState<
    "reminder" | "birthday" | "edit" | "reminderCalendar" | "birthdayCalendar" | null
  >(null);
  const [newResidentPhoto, setNewResidentPhoto] = useState("");
  const [editResidentPhoto, setEditResidentPhoto] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");

  useEffect(() => {
    const storedState = loadState();
    const lastResidentId = window.localStorage.getItem(LAST_RESIDENT_KEY);
    const lastResident = storedState.residents.find((resident) => resident.id === lastResidentId);

    setAppState(storedState);
    if (lastResident) {
      setActiveResident(lastResident);
    }

    const timer = window.setTimeout(() => setShowSplash(false), 1350);

    return () => window.clearTimeout(timer);
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

  function handleAddResident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

    setAppState((current) => ({
      ...current,
      residents: [...current.residents, resident],
    }));
    setNewResidentPhoto("");
    setShowNewResident(false);
  }

  function handleAddReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeResident) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const text = String(form.get("text") ?? "").trim();
    const date = String(form.get("date") ?? "").trim();
    const icon = String(form.get("icon") ?? "general");

    if (!text) {
      return;
    }

    setAppState((current) => ({
      ...current,
      reminders: [
        {
          id: crypto.randomUUID(),
          residentId: activeResident.id,
          text,
          date: date || "Hoje",
          icon: isReminderIcon(icon) ? icon : "general",
        },
        ...current.reminders,
      ],
    }));
    setProfileModal(null);
  }

  function handleAddBirthday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const date = String(form.get("date") ?? "").trim();

    if (!name || !date) {
      return;
    }

    setAppState((current) => ({
      ...current,
      birthdays: [
        {
          id: crypto.randomUUID(),
          name,
          date: formatBirthdayValue(date),
        },
        ...current.birthdays,
      ],
    }));
    setProfileModal(null);
  }

  function handleUpdateResident(event: FormEvent<HTMLFormElement>) {
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

  function handleDeleteResident() {
    if (!activeResident) {
      return;
    }

    const shouldDelete = window.confirm(`Excluir o perfil ${activeResident.name}?`);
    if (!shouldDelete) {
      return;
    }

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

  function addEmergencyContact(name: string, phone: string) {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (!cleanName || !cleanPhone) {
      return;
    }

    setAppState((current) => ({
      ...current,
      emergencyContacts: [
        ...current.emergencyContacts,
        {
          id: crypto.randomUUID(),
          name: cleanName,
          phone: cleanPhone,
        },
      ],
    }));
  }

  function handleAddEmergencyContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    addEmergencyContact(String(form.get("name") ?? ""), String(form.get("phone") ?? ""));
    event.currentTarget.reset();
  }

  async function handlePickDeviceContact() {
    const contactNavigator = navigator as ContactPickerNavigator;

    if (!contactNavigator.contacts?.select) {
      window.alert("Este navegador ainda nao permite escolher contatos. Cadastre manualmente.");
      return;
    }

    const contacts = await contactNavigator.contacts.select(["name", "tel"], { multiple: false });
    const [contact] = contacts;
    const name = contact?.name?.[0] ?? "";
    const phone = contact?.tel?.[0] ?? "";

    addEmergencyContact(name, phone);
  }

  function handleRemoveEmergencyContact(contactId: string) {
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
    if (!("speechSynthesis" in window)) {
      onDone?.();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "pt-BR";
    utterance.rate = 1;
    utterance.pitch = 1.05;
    utterance.onend = () => onDone?.();
    utterance.onerror = () => onDone?.();
    window.speechSynthesis.speak(utterance);
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
      showAssistantMessage("Eu nao consigo ouvir neste navegador. Use os botoes + ou tente abrir no Chrome.");
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
          ? "Eu nao tenho permissao para usar o microfone. Libere o acesso ou use os botoes +."
          : "Nao consegui ouvir direito. Tente de novo ou use os botoes +.",
      );
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      onTranscript(transcript);
    };

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      showAssistantMessage("Nao consegui iniciar o microfone aqui. Tente no Chrome ou use os botoes +.");
    }
  }

  function askAssistant(message: string, onTranscript: (transcript: string) => void) {
    setVoiceMessage(message);
    speakAssistant(message, () => {
      setVoiceMessage("Estou ouvindo...");
      startVoiceRecognition(onTranscript);
    });
  }

  function addReminderFromVoice(text: string, date: string) {
    if (!activeResident) {
      showAssistantMessage("Escolha um perfil antes de criar lembretes por voz.");
      return;
    }

    setAppState((current) => ({
      ...current,
      reminders: [
        {
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
        },
        ...current.reminders,
      ],
    }));
    showAssistantMessage(`Pronto, adicionei o lembrete: ${text}.`);
  }

  function askReminderDate(text: string) {
    askAssistant("Quando devo te lembrar?", (dateTranscript) => {
      const date = parseSpokenReminderDate(dateTranscript);

      if (!date) {
        askAssistant("Nao entendi a data. Pode falar algo como amanhã, vinte de julho ou quinze de agosto?", (retry) => {
          const retryDate = parseSpokenReminderDate(retry);

          if (!retryDate) {
            showAssistantMessage("Ainda nao entendi a data. Abri o formulario para voce completar.");
            setProfileModal("reminder");
            return;
          }

          addReminderFromVoice(text, retryDate);
        });
        return;
      }

      addReminderFromVoice(text, date);
    });
  }

  function startReminderVoiceFlow() {
    askAssistant("Qual é o lembrete?", (textTranscript) => {
      const text = textTranscript.trim();

      if (!text) {
        showAssistantMessage("Nao consegui entender o lembrete. Tente de novo pelo botao de microfone.");
        return;
      }

      askReminderDate(text);
    });
  }

  function addBirthdayFromVoice(name: string, date: string) {
    setAppState((current) => ({
      ...current,
      birthdays: [
        {
          id: crypto.randomUUID(),
          name,
          date,
        },
        ...current.birthdays,
      ],
    }));
    showAssistantMessage(`Pronto, cadastrei o aniversario de ${name}.`);
  }

  function askBirthdayDate(name: string) {
    askAssistant(`Quando é o aniversario de ${name}?`, (dateTranscript) => {
      const date = parseSpokenBirthdayDate(dateTranscript);

      if (!date) {
        askAssistant("Nao entendi a data. Pode falar algo como quinze de agosto ou vinte barra sete?", (retry) => {
          const retryDate = parseSpokenBirthdayDate(retry);

          if (!retryDate) {
            showAssistantMessage("Ainda nao entendi a data. Abri o formulario para voce completar.");
            setProfileModal("birthday");
            return;
          }

          addBirthdayFromVoice(name, retryDate);
        });
        return;
      }

      addBirthdayFromVoice(name, date);
    });
  }

  function startBirthdayVoiceFlow() {
    askAssistant("De quem é o aniversario?", (nameTranscript) => {
      const name = nameTranscript.trim();

      if (!name) {
        showAssistantMessage("Nao consegui entender o nome. Tente de novo pelo botao de microfone.");
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
      showAssistantMessage("Vou te levar para o calendario de lembretes.");
      return;
    }

    if (command.includes("calendario") && command.includes("aniversario")) {
      setProfileModal("birthdayCalendar");
      showAssistantMessage("Vou te levar para o calendario de aniversarios.");
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

    showAssistantMessage("Eu nao entendi ainda. Tente falar: adicionar lembrete.");
  }

  function handleVoiceAssistant() {
    showAssistantMessage("Estou tentando abrir o microfone...", false);
    setVoiceMessage("Estou ouvindo. Pode falar, por exemplo: adicionar lembrete.");
    startVoiceRecognition(runVoiceCommand);
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
              title="Aniversarios"
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
                <p>Nenhum aniversario cadastrado.</p>
              )}
            </InfoPanel>
          </div>

          <div className="profile-action-row">
            <button className="emergency-button inline" type="button" onClick={() => setShowEmergency(true)}>
              <HeartPulse size={20} />
              Emergencia
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
            title="Calendario de lembretes"
          />
        ) : null}
        {profileModal === "birthdayCalendar" ? (
          <CalendarModal
            items={appState.birthdays}
            kind="birthday"
            onClose={() => setProfileModal(null)}
            onCreate={() => setProfileModal("birthday")}
            title="Calendario de aniversarios"
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
          Emergencia
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
    </main>
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
        <div className="pin-dots" aria-label={`${pin.length} digitos informados`}>
          {[0, 1, 2, 3].map((item) => (
            <span className={`pin-dot ${pin.length > item ? "active" : ""}`} key={item} />
          ))}
        </div>
        {error ? <p className="modal-error">{error}</p> : null}
        {useNativeKeyboard ? (
          <input
            ref={nativeInputRef}
            aria-label="PIN de 4 digitos"
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
          <label htmlFor="resident-role">Descricao</label>
          <input id="resident-role" name="role" placeholder="Ex: Admin" />
        </div>
        <div className="field">
          <label htmlFor="resident-pin">PIN de 4 digitos</label>
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
          <input id="reminder-text" name="text" placeholder="Ex: Tomar remedio as 20h" required />
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
          <h2>Aniversario</h2>
        </div>
        <div className="field">
          <label htmlFor="birthday-name">Nome</label>
          <input id="birthday-name" name="name" placeholder="Ex: Mae" required />
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
          Salvar aniversario
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
          <label htmlFor="edit-resident-role">Descricao</label>
          <input id="edit-resident-role" name="role" defaultValue={resident.role} />
        </div>
        <div className="field">
          <label htmlFor="edit-resident-pin">PIN de 4 digitos</label>
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
            Calendario
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
                <button type="button" onClick={() => moveMonth(1)} aria-label="Proximo mes">
                  <ChevronRight size={18} />
                </button>
              </div>
              <p className="calendar-mode-note">
                Arraste para trocar de mes. Toque no icone para ver detalhes.
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
                            aria-label={`Abrir ${kind === "birthday" ? "aniversario" : "lembrete"}`}
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
                <p>Nenhum item neste mes.</p>
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
                <p className="eyebrow">{kind === "birthday" ? "Aniversario" : "Lembrete"}</p>
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
          <p className="eyebrow">Emergencia</p>
          <h2>Ajuda rapida</h2>
        </div>
        <div className="emergency-list">
          <a className="emergency-link" href="tel:192">
            <Phone size={18} />
            SAMU 192
          </a>
          <a className="emergency-link" href="tel:190">
            <Phone size={18} />
            Policia 190
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
              <input id="emergency-name" name="name" placeholder="Ex: Mae" required />
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
