"use client";

import { createClient, type User } from "@supabase/supabase-js";
import {
  Cake,
  Bell,
  CalendarCheck,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Cloudy,
  FileText,
  Droplets,
  HeartPulse,
  History,
  House,
  Info,
  KeyRound,
  Lightbulb,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Maximize2,
  Mic,
  Minimize2,
  Moon,
  Navigation,
  Pencil,
  Phone,
  Pill,
  Plus,
  Rainbow,
  Send,
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
import { type CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  recurrence?: ReminderRecurrence;
  visibility?: ItemVisibility;
};

type Birthday = {
  id: string;
  name: string;
  date: string;
  residentId?: string;
  profileResidentId?: string;
  visibility?: ItemVisibility;
};

type ItemVisibility = "private" | "household";

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

type ActivityEvent = {
  id: string;
  residentId: string;
  kind: "reminder" | "location" | "birthday" | "resident" | "message";
  title: string;
  detail?: string;
  createdAt: string;
  locationShareId?: string;
  reminderId?: string;
  messageId?: string;
};

type DailyMessage = {
  id: string;
  residentId: string;
  message: string;
  photo?: string;
  createdAt: string;
  expiresAt?: string;
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
  activityEvents: ActivityEvent[];
  dailyMessages: DailyMessage[];
};

type WeatherMood = "sunny" | "partly" | "cloudy" | "rain" | "storm" | "snow" | "fog" | "rainbow" | "night" | "night-cloud";

type TodayWeather = {
  status: "loading" | "ready" | "unavailable";
  temperature?: number;
  description: string;
  season: string;
  mood: WeatherMood;
  isNight?: boolean;
  humidity?: number;
  forecast?: WeatherForecastDay[];
};

type WeatherForecastDay = {
  date: string;
  min: number;
  max: number;
  precipitation: number;
  mood: WeatherMood;
  description: string;
};

const weatherIconMap: Record<WeatherMood, LucideIcon> = {
  sunny: Sun,
  partly: CloudSun,
  cloudy: Cloudy,
  rain: CloudRain,
  storm: CloudLightning,
  snow: CloudSnow,
  fog: CloudFog,
  rainbow: Rainbow,
  night: Moon,
  "night-cloud": CloudMoon,
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
const LAST_AUTH_ID_KEY = "jtag-last-auth-id-v1";
const REMEMBER_AUTH_KEY = "jtag-remember-auth-v1";
const ACCOUNT_EMAIL_DOMAIN = "j-tag-indol.vercel.app";
const MAX_INLINE_STORY_PHOTO_LENGTH = 900_000;
const STORY_MEDIA_BUCKET = "story-media";
const MAX_STORY_UPLOAD_BYTES = 1_400_000;
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

function normalizeAccountId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

function accountIdToTechnicalEmail(value: string) {
  return `${normalizeAccountId(value)}@${ACCOUNT_EMAIL_DOMAIN}`;
}

type PreparedStoryPhoto = {
  blob: Blob;
  extension: "webp" | "jpg";
  previewUrl: string;
};

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

async function compressStoryPhoto(file: File): Promise<PreparedStoryPhoto> {
  const sourceUrl = URL.createObjectURL(file);
  const image = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Formato de imagem não suportado."));
      image.src = sourceUrl;
    });

    let maxDimension = 1920;
    let quality = 0.86;
    let output: Blob | null = null;
    let outputType = "image/webp";

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Não foi possível preparar a foto.");
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      output = await canvasToBlob(canvas, outputType, quality);

      if (!output) {
        outputType = "image/jpeg";
        output = await canvasToBlob(canvas, outputType, quality);
      }
      if (output && output.size <= MAX_STORY_UPLOAD_BYTES) {
        break;
      }

      quality = Math.max(0.58, quality - 0.07);
      if (attempt >= 3) {
        maxDimension = Math.max(1080, Math.round(maxDimension * 0.85));
      }
    }

    if (!output || output.size > MAX_STORY_UPLOAD_BYTES) {
      throw new Error("Não foi possível reduzir a foto para publicação.");
    }

    return {
      blob: output,
      extension: outputType === "image/webp" ? "webp" : "jpg",
      previewUrl: URL.createObjectURL(output),
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

type CalendarViewMode = "calendar" | "list";
type ReminderIcon = "general" | "shopping" | "lightbulb" | "medicine" | "home" | "document";
type ReminderRecurrence = "daily" | "weekly" | "monthly" | "yearly";
type ProfileThemeId = "default" | "blue-light" | "aurora" | "green-home" | "graphite";
type AppNotification = {
  id: string;
  kind: "reminder" | "birthday" | "location";
  title: string;
  body: string;
  action: "reminderCalendar" | "birthdayCalendar" | "location";
  locationShareId?: string;
  reminderId?: string;
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
  pin: string | number;
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
  recurrence?: string | null;
  visibility?: string | null;
};

type BirthdayRow = {
  id: string;
  household_id: string;
  name: string;
  date: string;
  resident_id?: string | null;
  profile_resident_id?: string | null;
  visibility?: string | null;
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

type ActivityEventRow = {
  id: string;
  resident_id: string;
  kind: ActivityEvent["kind"];
  title: string;
  detail: string | null;
  created_at: string;
  location_share_id: string | null;
  reminder_id: string | null;
  message_id?: string | null;
};

type DailyMessageRow = {
  id: string;
  resident_id: string;
  message: string;
  photo_url: string | null;
  created_at: string;
  expires_at?: string | null;
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

const reminderRecurrenceOptions: Array<{ id: ReminderRecurrence; label: string }> = [
  { id: "daily", label: "Todo dia" },
  { id: "weekly", label: "Toda semana" },
  { id: "monthly", label: "Todo mês" },
  { id: "yearly", label: "Todo ano" },
];

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
  version: "v0.8",
  title: "Novidades do J-tag",
  date: "18/07/2026",
  items: [
    "Contas novas agora usam ID e senha, e o cadastro exige um código válido da família.",
    "O acesso antigo por e-mail foi removido e o ID pode ficar lembrado com segurança no aparelho.",
    "Stories da casa agora avançam em sequência a cada 10 segundos, com progresso, navegação e gesto para fechar.",
    "Dias com vários lembretes ou aniversários mostram um único indicador e abrem uma lista organizada.",
    "O resumo do clima foi redesenhado com previsão mais ampla e colunas alinhadas de mínima e máxima.",
    "A seleção de perfis ficou mais compacta e consistente em celulares Samsung e outras telas altas.",
    "O card do dia agora abre um resumo com temperatura, umidade e previsão compacta para os próximos 5 dias.",
    "Modais, stories e detalhes do calendário ganharam transições suaves de entrada e saída.",
    "Avisos temporários, como a limitação de tela cheia no navegador, agora desaparecem com uma animação suave.",
    "Agora é possível enviar uma foto própria para o perfil; ao trocar, a imagem anterior é substituída automaticamente.",
    "A nova timeline da casa mostra os últimos acontecimentos, quem realizou cada ação e quando.",
    "Moradores, lembretes, aniversários, contatos, localizações e atividades agora sincronizam em tempo real entre aparelhos.",
    "A edição do perfil agora abre ao tocar na foto, deixando o topo mais limpo.",
    "O convite da casa ganhou um ícone de pessoa com sinal de mais.",
    "Toda a interface agora usa Poppins com pesos otimizados para leitura no celular.",
    "Lembretes agora podem ser editados depois de criados.",
    "Lembretes recorrentes podem repetir diariamente, semanalmente, mensalmente ou anualmente.",
    "Uma nova barra de arraste permite concluir lembretes e avançar automaticamente os recorrentes.",
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
  activityEvents: [],
  dailyMessages: [],
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

function isReminderRecurrence(value: string): value is ReminderRecurrence {
  return reminderRecurrenceOptions.some((option) => option.id === value);
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
    recurrence:
      reminder.recurrence && isReminderRecurrence(reminder.recurrence)
        ? reminder.recurrence
        : undefined,
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
      activityEvents: parsed.activityEvents ?? [],
      dailyMessages: (parsed.dailyMessages ?? []).map((message) => ({
        ...message,
        photo:
          message.photo && message.photo.length <= MAX_INLINE_STORY_PHOTO_LENGTH
            ? message.photo
            : undefined,
      })),
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
  try {
    const cacheState = {
      ...state,
      dailyMessages: state.dailyMessages.map((message) => ({
        ...message,
        photo: message.photo?.startsWith("data:") ? undefined : message.photo,
      })),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheState));
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }
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
    pin: String(row.pin).trim().padStart(4, "0").slice(-4),
    color: row.color,
    theme: getProfileTheme(row.theme),
    photo:
      row.photo_url && row.photo_url.length <= MAX_INLINE_STORY_PHOTO_LENGTH
        ? row.photo_url
        : undefined,
  };
}

function mapReminder(row: ReminderRow): Reminder {
  return normalizeReminder({
    id: row.id,
    residentId: row.resident_id,
    text: row.text,
    date: row.date,
    icon: isReminderIcon(row.icon) ? row.icon : "general",
    recurrence:
      row.recurrence && isReminderRecurrence(row.recurrence)
        ? row.recurrence
        : undefined,
    visibility: row.visibility === "private" ? "private" : "household",
  });
}

function mapBirthday(row: BirthdayRow): Birthday {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    residentId: row.resident_id ?? undefined,
    profileResidentId: row.profile_resident_id ?? undefined,
    visibility: row.visibility === "private" ? "private" : "household",
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

function mapActivityEvent(row: ActivityEventRow): ActivityEvent {
  return {
    id: row.id,
    residentId: row.resident_id,
    kind: row.kind,
    title: row.title,
    detail: row.detail ?? undefined,
    createdAt: row.created_at,
    locationShareId: row.location_share_id ?? undefined,
    reminderId: row.reminder_id ?? undefined,
    messageId: row.message_id ?? undefined,
  };
}

function mapDailyMessage(row: DailyMessageRow): DailyMessage {
  return {
    id: row.id,
    residentId: row.resident_id,
    message: row.message,
    photo: row.photo_url ?? undefined,
    createdAt: row.created_at,
    expiresAt: row.expires_at ?? undefined,
  };
}

function getDailyMessageExpiry(message: DailyMessage) {
  return message.expiresAt
    ? new Date(message.expiresAt).getTime()
    : new Date(message.createdAt).getTime() + 24 * 60 * 60 * 1000;
}

async function loadRemoteStateByHousehold(household: HouseholdRow): Promise<AppState | null> {
  if (!supabase) {
    return null;
  }

  const [residentsResult, remindersResult, birthdaysResult, contactsResult, locationsResult, activityResult, messagesResult] = await Promise.all([
    supabase.from("residents").select("*").eq("household_id", household.id).order("created_at"),
    supabase.from("reminders").select("*").eq("household_id", household.id).order("created_at", { ascending: false }),
    supabase.from("birthdays").select("*").eq("household_id", household.id).order("created_at", { ascending: false }),
    supabase.from("emergency_contacts").select("*").eq("household_id", household.id).order("created_at"),
    supabase.from("location_shares").select("*").eq("household_id", household.id).order("created_at", { ascending: false }),
    supabase.from("activity_events").select("*").eq("household_id", household.id).order("created_at", { ascending: false }).limit(100),
    supabase
      .from("daily_messages")
      .select("*")
      .eq("household_id", household.id)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(50),
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
    activityEvents: activityResult.error ? [] : ((activityResult.data ?? []) as ActivityEventRow[]).map(mapActivityEvent),
    dailyMessages: messagesResult.error ? [] : ((messagesResult.data ?? []) as DailyMessageRow[]).map(mapDailyMessage),
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

  const payload = {
    id: reminder.id,
    household_id: householdId,
    resident_id: reminder.residentId,
    text: reminder.text,
    date: reminder.date,
    icon: reminder.icon ?? "general",
    recurrence: reminder.recurrence ?? null,
    visibility: reminder.visibility ?? "household",
  };
  let { error } = await supabase.from("reminders").insert(payload);

  if (error && error.message.toLowerCase().includes("visibility")) {
    const { visibility: _visibility, ...fallbackPayload } = payload;
    const fallbackResult = await supabase.from("reminders").insert(fallbackPayload);
    error = fallbackResult.error;
  }

  if (error && error.message.toLowerCase().includes("recurrence")) {
    const { recurrence: _recurrence, visibility: _visibility, ...fallbackPayload } = payload;
    const fallbackResult = await supabase.from("reminders").insert(fallbackPayload);
    error = fallbackResult.error;
  }

  return !error;
}

async function updateRemoteReminder(reminder: Reminder) {
  if (!supabase) {
    return false;
  }

  const payload = {
    text: reminder.text,
    date: reminder.date,
    icon: reminder.icon ?? "general",
    recurrence: reminder.recurrence ?? null,
    visibility: reminder.visibility ?? "household",
  };
  let { error } = await supabase
    .from("reminders")
    .update(payload)
    .eq("id", reminder.id);

  if (error && error.message.toLowerCase().includes("visibility")) {
    const { visibility: _visibility, ...fallbackPayload } = payload;
    const fallbackResult = await supabase
      .from("reminders")
      .update(fallbackPayload)
      .eq("id", reminder.id);
    error = fallbackResult.error;
  }

  if (error && error.message.toLowerCase().includes("recurrence")) {
    const { recurrence: _recurrence, visibility: _visibility, ...fallbackPayload } = payload;
    const fallbackResult = await supabase
      .from("reminders")
      .update(fallbackPayload)
      .eq("id", reminder.id);
    error = fallbackResult.error;
  }

  return !error;
}

async function insertRemoteBirthday(householdId: string, birthday: Birthday) {
  if (!supabase) {
    return false;
  }

  const payload = {
    id: birthday.id,
    household_id: householdId,
    name: birthday.name,
    date: birthday.date,
    resident_id: birthday.residentId ?? null,
    profile_resident_id: birthday.profileResidentId ?? null,
    visibility: birthday.visibility ?? "household",
  };
  let { error } = await supabase.from("birthdays").insert(payload);

  if (error && (error.message.toLowerCase().includes("visibility") || error.message.toLowerCase().includes("resident_id"))) {
    const {
      visibility: _visibility,
      resident_id: _residentId,
      profile_resident_id: _profileResidentId,
      ...fallbackPayload
    } = payload;
    const fallbackResult = await supabase.from("birthdays").insert(fallbackPayload);
    error = fallbackResult.error;
  }

  return !error;
}

async function updateRemoteBirthday(birthday: Birthday) {
  if (!supabase) {
    return false;
  }

  const payload = {
    name: birthday.name,
    date: birthday.date,
    resident_id: birthday.residentId ?? null,
    profile_resident_id: birthday.profileResidentId ?? null,
    visibility: birthday.visibility ?? "household",
  };
  let { error } = await supabase.from("birthdays").update(payload).eq("id", birthday.id);

  if (error && (error.message.toLowerCase().includes("visibility") || error.message.toLowerCase().includes("resident_id"))) {
    const {
      visibility: _visibility,
      resident_id: _residentId,
      profile_resident_id: _profileResidentId,
      ...fallbackPayload
    } = payload;
    const fallbackResult = await supabase.from("birthdays").update(fallbackPayload).eq("id", birthday.id);
    error = fallbackResult.error;
  }

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

async function insertRemoteActivityEvent(householdId: string, event: ActivityEvent) {
  if (!supabase) {
    return false;
  }

  const payload = {
    id: event.id,
    household_id: householdId,
    resident_id: event.residentId,
    kind: event.kind,
    title: event.title,
    detail: event.detail ?? null,
    location_share_id: event.locationShareId ?? null,
    reminder_id: event.reminderId ?? null,
    message_id: event.messageId ?? null,
    created_at: event.createdAt,
  };
  let { error } = await supabase.from("activity_events").insert(payload);

  if (error && (error.message.toLowerCase().includes("reminder_id") || error.message.toLowerCase().includes("message_id"))) {
    const { reminder_id: _reminderId, message_id: _messageId, ...fallbackPayload } = payload;
    const fallbackResult = await supabase.from("activity_events").insert(fallbackPayload);
    error = fallbackResult.error;
  }

  return !error;
}

async function insertRemoteDailyMessage(householdId: string, message: DailyMessage) {
  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from("daily_messages").insert({
    id: message.id,
    household_id: householdId,
    resident_id: message.residentId,
    message: message.message,
    photo_url: message.photo ?? null,
    created_at: message.createdAt,
    expires_at: message.expiresAt ?? new Date(new Date(message.createdAt).getTime() + 24 * 60 * 60 * 1000).toISOString(),
  });

  return !error;
}

async function uploadStoryPhoto(householdId: string, messageId: string, photo: PreparedStoryPhoto) {
  if (!supabase) {
    return null;
  }

  const path = `${householdId}/${messageId}.${photo.extension}`;
  const { error } = await supabase.storage.from(STORY_MEDIA_BUCKET).upload(path, photo.blob, {
    cacheControl: "31536000",
    contentType: photo.blob.type,
    upsert: false,
  });

  if (error) {
    return null;
  }

  return {
    path,
    url: supabase.storage.from(STORY_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl,
  };
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

function formatBirthdayDateInput(value?: string) {
  if (!value) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const match = value.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) {
    return "";
  }

  const [, day, month] = match;
  return `${new Date().getFullYear()}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
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

function formatReminderDateInput(value: string) {
  const date = parseReminderDate(value);
  if (!date) {
    return "";
  }

  return formatDateInputValue(date);
}

function getReminderRecurrenceLabel(recurrence?: ReminderRecurrence) {
  return reminderRecurrenceOptions.find((option) => option.id === recurrence)?.label ?? "";
}

function getCurrentReminderOccurrence(reminder: Reminder) {
  const originalDate = parseReminderDate(reminder.date);
  if (!originalDate || !reminder.recurrence) {
    return originalDate;
  }

  const today = startOfToday();
  const occurrence = new Date(originalDate);

  if (occurrence.getTime() > today.getTime()) {
    return occurrence;
  }

  while (true) {
    const nextOccurrence = new Date(occurrence);
    if (reminder.recurrence === "daily") {
      nextOccurrence.setDate(nextOccurrence.getDate() + 1);
    } else if (reminder.recurrence === "weekly") {
      nextOccurrence.setDate(nextOccurrence.getDate() + 7);
    } else if (reminder.recurrence === "monthly") {
      nextOccurrence.setMonth(nextOccurrence.getMonth() + 1);
    } else if (reminder.recurrence === "yearly") {
      nextOccurrence.setFullYear(nextOccurrence.getFullYear() + 1);
    }

    if (nextOccurrence.getTime() > today.getTime()) {
      return occurrence;
    }

    occurrence.setTime(nextOccurrence.getTime());
  }
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

function isNightTime(date = new Date()) {
  const hour = date.getHours();
  return hour >= 18 || hour < 6;
}

function getWeatherDisplay(weather: TodayWeather, isNightFallback: boolean) {
  const shouldUseNightDisplay = weather.isNight ?? isNightFallback;

  if (!shouldUseNightDisplay) {
    return weather;
  }

  if (weather.mood === "sunny" || weather.mood === "rainbow") {
    return {
      ...weather,
      description: weather.status === "loading" ? weather.description : "Noite limpa",
      mood: "night" as WeatherMood,
    };
  }

  if (weather.mood === "partly" || weather.mood === "cloudy" || weather.mood === "fog") {
    return {
      ...weather,
      description: weather.status === "loading" ? weather.description : "Noite nublada",
      mood: "night-cloud" as WeatherMood,
    };
  }

  return weather;
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

let modalScrollLockCount = 0;
let modalScrollPosition = 0;
let previousBodyPosition = "";
let previousBodyTop = "";
let previousBodyWidth = "";
let previousBodyOverflow = "";
let previousHtmlOverflow = "";

function lockPageScroll() {
  modalScrollLockCount += 1;
  if (modalScrollLockCount > 1) {
    return;
  }

  modalScrollPosition = window.scrollY;
  previousBodyPosition = document.body.style.position;
  previousBodyTop = document.body.style.top;
  previousBodyWidth = document.body.style.width;
  previousBodyOverflow = document.body.style.overflow;
  previousHtmlOverflow = document.documentElement.style.overflow;

  document.documentElement.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.top = `-${modalScrollPosition}px`;
  document.body.style.width = "100%";
  document.body.style.overflow = "hidden";
}

function unlockPageScroll() {
  modalScrollLockCount = Math.max(0, modalScrollLockCount - 1);
  if (modalScrollLockCount > 0) {
    return;
  }

  document.documentElement.style.overflow = previousHtmlOverflow;
  document.body.style.position = previousBodyPosition;
  document.body.style.top = previousBodyTop;
  document.body.style.width = previousBodyWidth;
  document.body.style.overflow = previousBodyOverflow;
  window.scrollTo(0, modalScrollPosition);
}

function useModalClose(onClose: () => void) {
  const [isClosing, setIsClosing] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    lockPageScroll();

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      unlockPageScroll();
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
  const [selectedDailyMessage, setSelectedDailyMessage] = useState<DailyMessage | null>(null);
  const [eventStoryKind, setEventStoryKind] = useState<"reminder" | "birthday" | null>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState("");
  const [authTransitionActive, setAuthTransitionActive] = useState(false);
  const [welcomeHouseholdName, setWelcomeHouseholdName] = useState("");
  const [recentHouseholds, setRecentHouseholds] = useState<RecentHousehold[]>([]);
  const [accountHouseholds, setAccountHouseholds] = useState<RecentHousehold[]>([]);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [passwordRecoveryActive, setPasswordRecoveryActive] = useState(false);
  const [todayWeather, setTodayWeather] = useState<TodayWeather>(() => getDefaultWeather());
  const [isNightNow, setIsNightNow] = useState(() => isNightTime());
  const [dailyMessageNow, setDailyMessageNow] = useState(() => Date.now());
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>([]);
  const [profileModal, setProfileModal] = useState<
    "reminder" | "birthday" | "edit" | "reminderCalendar" | "birthdayCalendar" | "timeline" | "weather" | null
  >(null);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [newResidentPhoto, setNewResidentPhoto] = useState("");
  const [editResidentPhoto, setEditResidentPhoto] = useState("");
  const [themePreview, setThemePreview] = useState<ProfileThemeId | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [isVoiceMessageClosing, setIsVoiceMessageClosing] = useState(false);
  const [dailyMessageDraft, setDailyMessageDraft] = useState("");
  const [dailyMessagePhoto, setDailyMessagePhoto] = useState("");
  const [preparedDailyMessagePhoto, setPreparedDailyMessagePhoto] = useState<PreparedStoryPhoto | null>(null);
  const [isPublishingDailyMessage, setIsPublishingDailyMessage] = useState(false);
  const pendingVoiceHandlerRef = useRef<((transcript: string) => void) | null>(null);
  const activeRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const speechFallbackTimerRef = useRef<number | null>(null);
  const fullscreenMessageTimerRef = useRef<number | null>(null);
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
    const { data: authSubscription } = supabase?.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user ?? null;
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecoveryActive(true);
      }
      setAuthUser(nextUser);
      setAuthLoading(false);
      if (!nextUser) {
        setAccountHouseholds([]);
        return;
      }

      window.setTimeout(() => {
        void loadAccountHouseholds(nextUser.id).then((households) => {
          if (isMounted) {
            setAccountHouseholds(households);
          }
        });
      }, 0);
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
    const updateNightState = () => setIsNightNow(isNightTime());
    updateNightState();
    const timer = window.setInterval(updateNightState, 60 * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setDailyMessageNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadWeather(latitude: number, longitude: number) {
      try {
        const params = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          current: "temperature_2m,relative_humidity_2m,weather_code,is_day",
          daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
          forecast_days: "6",
          timezone: "auto",
        });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);

        if (!response.ok) {
          throw new Error("Weather request failed");
        }

        const data = (await response.json()) as {
          current?: {
            temperature_2m?: number;
            relative_humidity_2m?: number;
            weather_code?: number;
            is_day?: number;
          };
          daily?: {
            time?: string[];
            weather_code?: number[];
            temperature_2m_max?: number[];
            temperature_2m_min?: number[];
            precipitation_probability_max?: number[];
          };
        };
        const code = Number(data.current?.weather_code ?? 2);
        const mood = getWeatherMood(code);
        const forecast = (data.daily?.time ?? []).slice(1, 6).map((date, index) => {
          const dailyIndex = index + 1;
          const dailyMood = getWeatherMood(Number(data.daily?.weather_code?.[dailyIndex] ?? 2));

          return {
            date,
            min: Math.round(Number(data.daily?.temperature_2m_min?.[dailyIndex] ?? 0)),
            max: Math.round(Number(data.daily?.temperature_2m_max?.[dailyIndex] ?? 0)),
            precipitation: Math.round(Number(data.daily?.precipitation_probability_max?.[dailyIndex] ?? 0)),
            mood: dailyMood.mood,
            description: dailyMood.description,
          };
        });

        if (isMounted) {
          setTodayWeather({
            status: "ready",
            temperature:
              typeof data.current?.temperature_2m === "number" ? Math.round(data.current.temperature_2m) : undefined,
            description: mood.description,
            season: getSouthernSeason(),
            mood: mood.mood,
            isNight: typeof data.current?.is_day === "number" ? data.current.is_day === 0 : isNightTime(),
            humidity:
              typeof data.current?.relative_humidity_2m === "number"
                ? Math.round(data.current.relative_humidity_2m)
                : undefined,
            forecast,
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
    const householdId = appState.household?.id;

    if (!supabase || !householdId) {
      return;
    }

    const channel = supabase
      .channel(`household-live-${householdId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "residents", filter: `household_id=eq.${householdId}` },
        (payload) => {
          const row = payload.new as ResidentRow;
          const removedId = (payload.old as { id?: string }).id;

          setAppState((current) => ({
            ...current,
            residents:
              payload.eventType === "DELETE"
                ? current.residents.filter((item) => item.id !== removedId)
                : [
                    mapResident(row),
                    ...current.residents.filter((item) => item.id !== row.id),
                  ],
          }));

          if (payload.eventType !== "DELETE") {
            setActiveResident((current) => (current?.id === row.id ? mapResident(row) : current));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reminders", filter: `household_id=eq.${householdId}` },
        (payload) => {
          const row = payload.new as ReminderRow;
          const removedId = (payload.old as { id?: string }).id;

          setAppState((current) => ({
            ...current,
            reminders:
              payload.eventType === "DELETE"
                ? current.reminders.filter((item) => item.id !== removedId)
                : [
                    mapReminder(row),
                    ...current.reminders.filter((item) => item.id !== row.id),
                  ],
          }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "birthdays", filter: `household_id=eq.${householdId}` },
        (payload) => {
          const row = payload.new as BirthdayRow;
          const removedId = (payload.old as { id?: string }).id;

          setAppState((current) => ({
            ...current,
            birthdays:
              payload.eventType === "DELETE"
                ? current.birthdays.filter((item) => item.id !== removedId)
                : [
                    mapBirthday(row),
                    ...current.birthdays.filter((item) => item.id !== row.id),
                  ],
          }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "emergency_contacts", filter: `household_id=eq.${householdId}` },
        (payload) => {
          const row = payload.new as EmergencyContactRow;
          const removedId = (payload.old as { id?: string }).id;

          setAppState((current) => ({
            ...current,
            emergencyContacts:
              payload.eventType === "DELETE"
                ? current.emergencyContacts.filter((item) => item.id !== removedId)
                : [
                    mapEmergencyContact(row),
                    ...current.emergencyContacts.filter((item) => item.id !== row.id),
                  ],
          }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "location_shares", filter: `household_id=eq.${householdId}` },
        (payload) => {
          const row = payload.new as LocationShareRow;
          const removedId = (payload.old as { id?: string }).id;

          setAppState((current) => ({
            ...current,
            locationShares:
              payload.eventType === "DELETE"
                ? current.locationShares.filter((item) => item.id !== removedId)
                : [
                    mapLocationShare(row),
                    ...current.locationShares.filter((item) => item.id !== row.id),
                  ],
          }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_events", filter: `household_id=eq.${householdId}` },
        (payload) => {
          const row = payload.new as ActivityEventRow;
          const removedId = (payload.old as { id?: string }).id;

          setAppState((current) => ({
            ...current,
            activityEvents:
              payload.eventType === "DELETE"
                ? current.activityEvents.filter((item) => item.id !== removedId)
                : [
                    mapActivityEvent(row),
                    ...current.activityEvents.filter((item) => item.id !== row.id),
                  ].slice(0, 100),
          }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_messages", filter: `household_id=eq.${householdId}` },
        (payload) => {
          const row = payload.new as DailyMessageRow;
          const removedId = (payload.old as { id?: string }).id;

          setAppState((current) => ({
            ...current,
            dailyMessages:
              payload.eventType === "DELETE"
                ? current.dailyMessages.filter((item) => item.id !== removedId)
                  : [
                    mapDailyMessage(row),
                    ...current.dailyMessages.filter((item) => item.id !== row.id),
                  ].slice(0, 50),
          }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [appState.household?.id]);

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

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    handleFullscreenChange();

    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      if (fullscreenMessageTimerRef.current) {
        window.clearTimeout(fullscreenMessageTimerRef.current);
      }
    };
  }, []);

  const activeReminders = useMemo(() => {
    if (!activeResident) {
      return [];
    }

    return appState.reminders.filter(
      (item) => item.residentId === activeResident.id || item.visibility !== "private",
    );
  }, [activeResident, appState.reminders]);
  const visibleBirthdays = useMemo(() => {
    if (!activeResident) {
      return [];
    }

    return appState.birthdays.filter(
      (item) => item.residentId === activeResident.id || item.visibility !== "private",
    );
  }, [activeResident, appState.birthdays]);
  const birthdayPreview = useMemo(() => getBirthdayPreview(visibleBirthdays), [visibleBirthdays]);
  const activeDailyMessages = useMemo(
    () => appState.dailyMessages.filter((message) => getDailyMessageExpiry(message) > dailyMessageNow),
    [appState.dailyMessages, dailyMessageNow],
  );
  const latestDailyMessage = activeDailyMessages[0];
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
        const parsedDate = getCurrentReminderOccurrence(reminder);

        if (!parsedDate) {
          return [];
        }

        const distance = daysBetween(today, parsedDate);
        if (distance > 0) {
          return [];
        }

        return [{
          id: `reminder-${reminder.id}-${formatDateInputValue(parsedDate)}-${distance < 0 ? "overdue" : "today"}`,
          kind: "reminder" as const,
          title: distance < 0 ? "Lembrete atrasado" : "Lembrete para hoje",
          body: reminder.text,
          action: "reminderCalendar" as const,
          reminderId: reminder.id,
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

  function recordActivity(
    kind: ActivityEvent["kind"],
    title: string,
    detail?: string,
    locationShareId?: string,
    reminderId?: string,
    messageId?: string,
  ) {
    if (!activeResident || !appState.household) {
      return;
    }

    const event: ActivityEvent = {
      id: crypto.randomUUID(),
      residentId: activeResident.id,
      kind,
      title,
      detail,
      createdAt: new Date().toISOString(),
      locationShareId,
      reminderId,
      messageId,
    };

    void insertRemoteActivityEvent(appState.household.id, event);
    setAppState((current) => ({
      ...current,
      activityEvents: [event, ...current.activityEvents].slice(0, 100),
    }));
  }

  async function handleAddDailyMessage(messageText: string, preparedPhoto?: PreparedStoryPhoto | null) {
    if (!activeResident || !appState.household || !messageText.trim()) {
      return false;
    }

    setIsPublishingDailyMessage(true);
    const messageId = crypto.randomUUID();
    let uploadedPhoto: { path: string; url: string } | null = null;

    if (preparedPhoto) {
      uploadedPhoto = await uploadStoryPhoto(appState.household.id, messageId, preparedPhoto);
      if (!uploadedPhoto) {
        setIsPublishingDailyMessage(false);
        showAssistantMessage("Não foi possível enviar a foto. Confira o bucket story-media no Supabase.", false);
        return false;
      }
    }

    const message: DailyMessage = {
      id: messageId,
      residentId: activeResident.id,
      message: messageText.trim(),
      photo: uploadedPhoto?.url,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    const inserted = await insertRemoteDailyMessage(appState.household.id, message);
    if (!inserted) {
      if (uploadedPhoto && supabase) {
        await supabase.storage.from(STORY_MEDIA_BUCKET).remove([uploadedPhoto.path]);
      }
      setIsPublishingDailyMessage(false);
      showAssistantMessage("Não foi possível publicar a mensagem.", false);
      return false;
    }

    setAppState((current) => ({
      ...current,
      dailyMessages: [message, ...current.dailyMessages.filter((item) => item.id !== message.id)].slice(0, 50),
    }));
    recordActivity(
      "message",
      "publicou uma mensagem do dia",
      message.message,
      undefined,
      undefined,
      message.id,
    );
    setProfileModal(null);
    setIsPublishingDailyMessage(false);
    return true;
  }

  async function handleDailyMessagePhoto(file?: File) {
    if (!file) {
      return;
    }

    if (file.size > 30 * 1024 * 1024) {
      showAssistantMessage("Escolha uma foto de até 30 MB.", false);
      return;
    }

    try {
      const compressedPhoto = await compressStoryPhoto(file);
      if (preparedDailyMessagePhoto) {
        URL.revokeObjectURL(preparedDailyMessagePhoto.previewUrl);
      }
      setPreparedDailyMessagePhoto(compressedPhoto);
      setDailyMessagePhoto(compressedPhoto.previewUrl);
    } catch (error) {
      showAssistantMessage(error instanceof Error ? error.message : "Não foi possível preparar a foto.", false);
    }
  }

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
        recordActivity(
          "location",
          "compartilhou a localização",
          `Disponível por ${durationMinutes === 10 ? "10 minutos" : "1 hora"}`,
          share.id,
        );
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

  async function handleAuthSubmit(
    mode: "sign-in" | "sign-up",
    accountId: string,
    password: string,
    familyCode = "",
  ) {
    if (!supabase) {
      window.alert("Supabase não está configurado neste ambiente.");
      return;
    }

    const normalizedFamilyCode = normalizeHouseholdCode(familyCode || pendingInviteCode);
    if (mode === "sign-up") {
      if (normalizedFamilyCode.length < 4) {
        window.alert("Informe o código da família para criar sua conta.");
        return;
      }
      const invitedHousehold = await loadRemoteStateByCode(normalizedFamilyCode);
      if (!invitedHousehold?.household) {
        window.alert("Código da família não encontrado.");
        return;
      }
      setPendingInviteCode(normalizedFamilyCode);
    }

    setAuthTransitionActive(true);

    const credentials = {
      email: accountIdToTechnicalEmail(accountId),
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
      if (mode === "sign-up") {
        const handle = normalizeAccountId(accountId);
        const { error: accessError } = await supabase.from("account_access").insert({
          user_id: data.user.id,
          handle,
        });
        if (accessError) {
          await supabase.auth.signOut();
          setAuthUser(null);
          setAuthTransitionActive(false);
          window.alert(
            accessError.code === "23505"
              ? "Esse ID já está em uso. Escolha outro."
              : "Não foi possível registrar o ID de acesso.",
          );
          return;
        }
      }
      const households = await refreshAccountHouseholds(data.user.id);
      const effectiveInviteCode = normalizedFamilyCode || pendingInviteCode;
      const inviteState = effectiveInviteCode ? await loadRemoteStateByCode(effectiveInviteCode) : null;
      const inviteMembership = inviteState?.household
        ? households.find((household) => household.id === inviteState.household?.id)
        : null;
      const autoHousehold = inviteMembership ?? (!effectiveInviteCode && households.length === 1 ? households[0] : null);
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

  async function handleAddAccountEmail(email: string) {
    if (!supabase || !authUser) {
      return "Supabase não está configurado neste ambiente.";
    }
    const { error } = await supabase
      .from("account_access")
      .update({ recovery_email: email.trim() })
      .eq("user_id", authUser.id);
    return error?.message ?? null;
  }

  async function handleAddAccountPassword(password: string) {
    if (!supabase) {
      return "Supabase não está configurado neste ambiente.";
    }

    const { error } = await supabase.auth.updateUser({ password });
    return error?.message ?? null;
  }

  async function handleMigrateLegacyAccount(handleValue: string) {
    if (!supabase || !authUser?.email) {
      return "Não foi possível identificar a conta atual.";
    }

    const handle = normalizeAccountId(handleValue);
    if (handle.length < 4) {
      return "O ID precisa ter pelo menos 4 caracteres.";
    }

    const recoveryEmail = authUser.email;
    const { error: handleError } = await supabase.from("account_access").upsert(
      {
        user_id: authUser.id,
        handle,
        recovery_email: recoveryEmail,
      },
      { onConflict: "user_id" },
    );
    if (handleError) {
      return handleError.code === "23505" ? "Esse ID já está em uso." : handleError.message;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      return "Sua sessão expirou. Entre novamente pelo acesso antigo.";
    }

    const response = await fetch("/api/account/migrate", {
      body: JSON.stringify({ technicalEmail: accountIdToTechnicalEmail(handle) }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      return result.error ?? "Não foi possível atualizar o acesso.";
    }

    const { data: refreshedUser } = await supabase.auth.refreshSession();
    if (refreshedUser.user) {
      setAuthUser(refreshedUser.user);
    }
    return null;
  }

  async function handlePasswordUpdate(password: string) {
    if (!supabase) {
      return "Supabase não está configurado neste ambiente.";
    }

    const { error } = await supabase.auth.updateUser({ password });
    return error?.message ?? null;
  }

  function finishPasswordRecovery() {
    setPasswordRecoveryActive(false);
    window.history.replaceState({}, document.title, window.location.pathname);
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

    const storedPin = String(resident.pin).trim().padStart(4, "0").slice(-4);
    if (nextPin === storedPin) {
      saveLastResident(resident.id);
      if (supabase && authUser && !resident.id.startsWith("local-")) {
        void supabase
          .from("residents")
          .update({ auth_user_id: authUser.id })
          .eq("id", resident.id)
          .is("auth_user_id", null);
      }
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
    recordActivity("resident", `adicionou ${resident.name} à casa`, resident.role);
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
    const recurrence = String(form.get("recurrence") ?? "");
    const visibility = String(form.get("visibility") ?? "household");

    if (!text) {
      return;
    }

    const reminder: Reminder = {
      id: crypto.randomUUID(),
      residentId: activeResident.id,
      text,
      date: date || "Hoje",
      icon: isReminderIcon(icon) ? icon : "general",
      recurrence: isReminderRecurrence(recurrence) ? recurrence : undefined,
      visibility: visibility === "private" ? "private" : "household",
    };

    await insertRemoteReminder(appState.household.id, reminder);
    setAppState((current) => ({
      ...current,
      reminders: [reminder, ...current.reminders],
    }));
    if (reminder.visibility !== "private") {
      recordActivity(
        "reminder",
        "adicionou um lembrete para todos",
        `${reminder.text} · ${formatDateLabel(reminder.date)}`,
        undefined,
        reminder.id,
      );
    }
    setProfileModal(null);
  }

  async function handleUpdateReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingReminder) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const text = String(form.get("text") ?? "").trim();
    const date = String(form.get("date") ?? "").trim();
    const icon = String(form.get("icon") ?? "general");
    const recurrence = String(form.get("recurrence") ?? "");
    const visibility = String(form.get("visibility") ?? "household");

    if (!text) {
      return;
    }

    const updatedReminder: Reminder = {
      ...editingReminder,
      text,
      date: date || "Hoje",
      icon: isReminderIcon(icon) ? icon : "general",
      recurrence: isReminderRecurrence(recurrence) ? recurrence : undefined,
      visibility: visibility === "private" ? "private" : "household",
    };

    await updateRemoteReminder(updatedReminder);
    setAppState((current) => ({
      ...current,
      reminders: current.reminders.map((item) =>
        item.id === updatedReminder.id ? updatedReminder : item,
      ),
    }));
    setEditingReminder(null);
    setProfileModal("reminderCalendar");
  }

  function handleEditReminder(reminder: Reminder) {
    setEditingReminder(reminder);
    setProfileModal("reminder");
  }

  async function handleCompleteReminder(reminder: Reminder) {
    const relatedNotificationIds = notifications
      .filter(
        (notification) =>
          "reminderId" in notification && notification.reminderId === reminder.id,
      )
      .map((notification) => notification.id);

    if (relatedNotificationIds.length) {
      setDismissedNotifications((current) => {
        const next = Array.from(new Set([...current, ...relatedNotificationIds]));
        saveDismissedNotifications(next);
        return next;
      });
    }

    if (!reminder.recurrence) {
      await deleteRemoteReminder(reminder.id);
      setAppState((current) => ({
        ...current,
        reminders: current.reminders.filter((item) => item.id !== reminder.id),
      }));
    }
  }

  async function handleAddBirthday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeResident || !appState.household) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const date = String(form.get("date") ?? "").trim();
    const visibility = String(form.get("visibility") ?? "household");

    if (!name || !date) {
      return;
    }

    const birthday: Birthday = {
      id: crypto.randomUUID(),
      name,
      date: formatBirthdayValue(date),
      residentId: activeResident.id,
      visibility: visibility === "private" ? "private" : "household",
    };

    await insertRemoteBirthday(appState.household.id, birthday);
    setAppState((current) => ({
      ...current,
      birthdays: [birthday, ...current.birthdays],
    }));
    if (birthday.visibility !== "private") {
      recordActivity("birthday", "adicionou um aniversário para todos", `${birthday.name} · ${birthday.date}`);
    }
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
    const birthdayDate = String(form.get("birthday") ?? "").trim();
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

    if (birthdayDate && appState.household) {
      const existingBirthday = appState.birthdays.find(
        (birthday) => birthday.profileResidentId === activeResident.id,
      );
      const birthday: Birthday = existingBirthday
        ? {
            ...existingBirthday,
            name: updatedResident.name,
            date: formatBirthdayValue(birthdayDate),
          }
        : {
            id: crypto.randomUUID(),
            name: updatedResident.name,
            date: formatBirthdayValue(birthdayDate),
            residentId: activeResident.id,
            profileResidentId: activeResident.id,
            visibility: "household",
          };

      if (existingBirthday) {
        await updateRemoteBirthday(birthday);
      } else {
        await insertRemoteBirthday(appState.household.id, birthday);
      }

      setAppState((current) => ({
        ...current,
        birthdays: existingBirthday
          ? current.birthdays.map((item) => (item.id === birthday.id ? birthday : item))
          : [birthday, ...current.birthdays],
      }));

      if (!existingBirthday) {
        recordActivity(
          "birthday",
          "adicionou o próprio aniversário para todos",
          `${birthday.name} · ${birthday.date}`,
        );
      }
    }

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
    setIsVoiceMessageClosing(false);
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
      visibility: "household",
    };

    await insertRemoteReminder(appState.household.id, reminder);
    setAppState((current) => ({
      ...current,
      reminders: [reminder, ...current.reminders],
    }));
    recordActivity(
      "reminder",
      "adicionou um lembrete por voz para todos",
      `${reminder.text} · ${formatDateLabel(reminder.date)}`,
      undefined,
      reminder.id,
    );
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
    if (!activeResident || !appState.household) {
      setProfileModal("birthday");
      return;
    }

    const birthday: Birthday = {
      id: crypto.randomUUID(),
      name,
      date,
      residentId: activeResident.id,
      visibility: "household",
    };

    await insertRemoteBirthday(appState.household.id, birthday);
    setAppState((current) => ({
      ...current,
      birthdays: [birthday, ...current.birthdays],
    }));
    recordActivity("birthday", "adicionou um aniversário por voz para todos", `${birthday.name} · ${birthday.date}`);
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

  async function handleToggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch {
      const fullscreenMessage =
        "Seu navegador não permite tela cheia aqui. No iPhone, use Compartilhar e Adicionar à Tela de Início.";

      if (fullscreenMessageTimerRef.current) {
        window.clearTimeout(fullscreenMessageTimerRef.current);
      }

      setIsVoiceMessageClosing(false);
      setVoiceMessage(fullscreenMessage);
      fullscreenMessageTimerRef.current = window.setTimeout(() => {
        setIsVoiceMessageClosing(true);
        fullscreenMessageTimerRef.current = window.setTimeout(() => {
          setVoiceMessage((current) => (current === fullscreenMessage ? "" : current));
          setIsVoiceMessageClosing(false);
          fullscreenMessageTimerRef.current = null;
        }, 350);
      }, 9_650);
    }
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

  if (passwordRecoveryActive) {
    return (
      <main className={screenShellClassName}>
        <PasswordRecoveryScreen onContinue={finishPasswordRecovery} onSubmit={handlePasswordUpdate} />
      </main>
    );
  }

  if (authUser?.email && !authUser.email.endsWith(`@${ACCOUNT_EMAIL_DOMAIN}`)) {
    return (
      <main className={screenShellClassName}>
        <LegacyAccountMigrationScreen email={authUser.email} onSubmit={handleMigrateLegacyAccount} />
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
          onSubmit={(mode, accountId, password, familyCode) =>
            void handleAuthSubmit(mode, accountId, password, familyCode)
          }
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
                className={`icon-glass-button fullscreen-button ${isFullscreen ? "active" : ""}`}
                type="button"
                onClick={() => void handleToggleFullscreen()}
                aria-label={isFullscreen ? "Sair da tela cheia" : "Abrir em tela cheia"}
                title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              >
                {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
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
                <UserPlus size={20} />
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
            <div className={`voice-status ${isListening ? "voice-status-listening" : ""} ${isVoiceMessageClosing ? "voice-status-closing" : ""}`}>
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
              <button
                className="profile-avatar-button"
                type="button"
                onClick={() => {
                  setEditResidentPhoto("");
                  setThemePreview(getProfileTheme(activeResident.theme));
                  setProfileModal("edit");
                }}
                aria-label={`Editar perfil de ${activeResident.name}`}
                title="Editar perfil"
              >
                <Avatar resident={activeResident} variant="large" />
              </button>
              <div>
                <p className="eyebrow">Dashboard do lar</p>
                <h1>{appState.household.name}</h1>
                <span>
                  {activeResident.name} · {activeResident.role}
                </span>
              </div>
            </div>
            <button
              className="dashboard-today-card"
              type="button"
              onClick={() => setProfileModal("weather")}
              aria-label="Abrir resumo do dia e previsão do tempo"
            >
              <div className="dashboard-today-copy">
                <span>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })}</span>
                <strong>
                  {dashboardReminders.today.length + dashboardBirthdays.today.length
                    ? `${dashboardReminders.today.length + dashboardBirthdays.today.length} item hoje`
                    : "Dia tranquilo"}
                </strong>
              </div>
              <WeatherWidget weather={todayWeather} isNight={isNightNow} />
            </button>
          </div>

          <article
            className={`daily-message-card ${latestDailyMessage ? "daily-message-card-active" : ""}`}
            role={latestDailyMessage ? "button" : undefined}
            tabIndex={latestDailyMessage ? 0 : undefined}
            onClick={() => latestDailyMessage && setSelectedDailyMessage(latestDailyMessage)}
            onKeyDown={(event) => {
              if (
                event.target === event.currentTarget &&
                latestDailyMessage &&
                (event.key === "Enter" || event.key === " ")
              ) {
                event.preventDefault();
                setSelectedDailyMessage(latestDailyMessage);
              }
            }}
          >
            <span className="daily-message-icon">
              <MessageCircle size={20} />
            </span>
            <div className="daily-message-copy">
              <small>Mensagem do dia</small>
              <strong>{latestDailyMessage?.message ?? "Escreva algo para a família"}</strong>
              <em>
                {latestDailyMessage
                  ? appState.residents.find((resident) => resident.id === latestDailyMessage.residentId)?.name ?? "Alguém da casa"
                  : "Compartilhe um recado, carinho ou lembrete"}
              </em>
            </div>
            {latestDailyMessage?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="daily-message-thumbnail" src={latestDailyMessage.photo} alt="" loading="lazy" decoding="async" />
            ) : null}
            <form
              className="daily-message-composer"
              onClick={(event) => event.stopPropagation()}
              onSubmit={async (event) => {
                event.preventDefault();
                if (!dailyMessageDraft.trim() || isPublishingDailyMessage) {
                  return;
                }
                const published = await handleAddDailyMessage(dailyMessageDraft, preparedDailyMessagePhoto);
                if (published) {
                  setDailyMessageDraft("");
                  if (preparedDailyMessagePhoto) {
                    URL.revokeObjectURL(preparedDailyMessagePhoto.previewUrl);
                  }
                  setPreparedDailyMessagePhoto(null);
                  setDailyMessagePhoto("");
                }
              }}
            >
              <input
                aria-label="Escrever mensagem do dia"
                maxLength={240}
                placeholder="Escreva uma mensagem e pressione Enter"
                value={dailyMessageDraft}
                onChange={(event) => setDailyMessageDraft(event.target.value)}
              />
              <label className={`daily-message-camera ${dailyMessagePhoto ? "has-photo" : ""}`} aria-label="Adicionar foto">
                <input
                  accept="image/*"
                  type="file"
                  onChange={(event) => handleDailyMessagePhoto(event.target.files?.[0])}
                />
                {dailyMessagePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={dailyMessagePhoto} alt="" />
                ) : (
                  <Camera size={20} />
                )}
              </label>
              <button
                className="daily-message-send"
                type="submit"
                disabled={!dailyMessageDraft.trim() || isPublishingDailyMessage}
                aria-label="Enviar mensagem do dia"
              >
                <Send size={19} />
              </button>
            </form>
          </article>

          <div className="dashboard-grid">
            <article
              className="dashboard-card dashboard-card-primary dashboard-card-with-action"
              role="button"
              tabIndex={0}
              onClick={() =>
                activeReminders.length ? setEventStoryKind("reminder") : setProfileModal("reminderCalendar")
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activeReminders.length ? setEventStoryKind("reminder") : setProfileModal("reminderCalendar");
                }
              }}
            >
              <button
                className="dashboard-card-add"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setEditingReminder(null);
                  setProfileModal("reminder");
                }}
                aria-label="Adicionar lembrete"
              >
                <Plus size={18} />
              </button>
              <span className="dashboard-card-icon">
                <CalendarCheck size={20} />
              </span>
              <small>Lembretes</small>
              <strong>{dashboardReminders.next ? dashboardReminders.next.text : "Nada agendado"}</strong>
              <em>{dashboardReminders.next ? formatDistanceLabel(dashboardReminders.next.distance) : "Livre"}</em>
            </article>
            <article
              className="dashboard-card dashboard-card-with-action"
              role="button"
              tabIndex={0}
              onClick={() =>
                visibleBirthdays.length ? setEventStoryKind("birthday") : setProfileModal("birthdayCalendar")
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  visibleBirthdays.length ? setEventStoryKind("birthday") : setProfileModal("birthdayCalendar");
                }
              }}
            >
              <button
                className="dashboard-card-add"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setProfileModal("birthday");
                }}
                aria-label="Adicionar aniversário"
              >
                <Plus size={18} />
              </button>
              <span className="dashboard-card-icon birthday-icon">
                <Cake size={20} />
              </span>
              <small>Aniversários</small>
              <strong>{dashboardBirthdays.next ? dashboardBirthdays.next.name : "Sem próximos"}</strong>
              <em>{dashboardBirthdays.next ? formatDistanceLabel(dashboardBirthdays.next.nextDistance) : "Adicionar data"}</em>
            </article>
            <button className="dashboard-card" type="button" onClick={() => setShowHouseholdInvite(true)}>
              <span className="dashboard-card-icon">
                <Users size={20} />
              </span>
              <small>Moradores</small>
              <strong>{appState.residents.length}</strong>
              <em>{appState.residents.length === 1 ? "perfil na casa" : "perfis na casa"}</em>
            </button>
            <button className="dashboard-card dashboard-card-timeline" type="button" onClick={() => setProfileModal("timeline")}>
              <span className="dashboard-card-icon timeline-icon">
                <History size={20} />
              </span>
              <small>Timeline</small>
              <strong>{appState.activityEvents[0]?.title ?? "Tudo tranquilo"}</strong>
              <em>
                {appState.activityEvents[0]
                  ? formatActivityRelativeTime(appState.activityEvents[0].createdAt)
                  : "Os acontecimentos aparecem aqui"}
              </em>
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
          <ReminderModal
            reminder={editingReminder}
            onClose={() => {
              setEditingReminder(null);
              setProfileModal(null);
            }}
            onSubmit={editingReminder ? handleUpdateReminder : handleAddReminder}
          />
        ) : null}
        {profileModal === "birthday" ? (
          <BirthdayModal onClose={() => setProfileModal(null)} onSubmit={handleAddBirthday} />
        ) : null}
        {profileModal === "weather" ? (
          <WeatherSummaryModal weather={todayWeather} onClose={() => setProfileModal(null)} />
        ) : null}
        {profileModal === "edit" ? (
          <EditResidentModal
            accountEmail={authUser?.email ?? ""}
            isAnonymousAccount={Boolean(authUser?.email?.endsWith(`@${ACCOUNT_EMAIL_DOMAIN}`))}
            birthday={appState.birthdays.find((birthday) => birthday.profileResidentId === activeResident.id)}
            photo={editResidentPhoto || activeResident.photo || ""}
            resident={activeResident}
            onClose={() => {
              setEditResidentPhoto("");
              setThemePreview(null);
              setProfileModal(null);
            }}
            onDelete={handleDeleteResident}
            onAddAccountEmail={handleAddAccountEmail}
            onAddAccountPassword={handleAddAccountPassword}
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
            onCreate={() => {
              setEditingReminder(null);
              setProfileModal("reminder");
            }}
            onDelete={(item) => void handleDeleteReminder(item as Reminder)}
            onEdit={(item) => handleEditReminder(item as Reminder)}
            onComplete={(item) => void handleCompleteReminder(item as Reminder)}
            canManage={(item) => (item as Reminder).residentId === activeResident.id}
            title="Calendário de lembretes"
          />
        ) : null}
        {profileModal === "birthdayCalendar" ? (
          <CalendarModal
            items={visibleBirthdays}
            kind="birthday"
            onClose={() => setProfileModal(null)}
            onCreate={() => setProfileModal("birthday")}
            onDelete={(item) => void handleDeleteBirthday(item as Birthday)}
            onEdit={() => undefined}
            onComplete={() => undefined}
            canManage={(item) => !(item as Birthday).residentId || (item as Birthday).residentId === activeResident.id}
            title="Calendário de aniversários"
          />
        ) : null}
        {profileModal === "timeline" ? (
          <ActivityTimelineModal
            events={appState.activityEvents}
            messages={activeDailyMessages}
            residents={appState.residents}
            onClose={() => setProfileModal(null)}
            onOpenLocation={(shareId) => {
              const share = appState.locationShares.find((item) => item.id === shareId);
              if (share) {
                setProfileModal(null);
                setSelectedLocationShare(share);
              }
            }}
            onOpenReminder={() => {
              saveCalendarView("reminder", "list");
              setProfileModal("reminderCalendar");
            }}
            onOpenMessage={(messageId) => {
              const message = activeDailyMessages.find((item) => item.id === messageId);
              if (message) {
                setProfileModal(null);
                setSelectedDailyMessage(message);
              }
            }}
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
        {selectedDailyMessage ? (
          <DailyMessageStoryModal
            initialMessageId={selectedDailyMessage.id}
            messages={activeDailyMessages}
            residents={appState.residents}
            onClose={() => setSelectedDailyMessage(null)}
          />
        ) : null}
        {eventStoryKind ? (
          <EventStoryModal
            birthdays={visibleBirthdays}
            kind={eventStoryKind}
            reminders={activeReminders}
            onClose={() => setEventStoryKind(null)}
            onOpenCalendar={() => {
              const nextKind = eventStoryKind;
              setEventStoryKind(null);
              setProfileModal(nextKind === "reminder" ? "reminderCalendar" : "birthdayCalendar");
            }}
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

function WeatherWidget({ weather, isNight }: { weather: TodayWeather; isNight: boolean }) {
  const displayWeather = getWeatherDisplay(weather, isNight);
  const WeatherIcon = weatherIconMap[displayWeather.mood];
  const temperature = typeof displayWeather.temperature === "number" ? `${displayWeather.temperature}°` : "--";

  return (
    <div className={`weather-widget weather-${displayWeather.mood}`} aria-label={`Previsão do tempo: ${displayWeather.description}`}>
      <div className="weather-orbit" aria-hidden="true">
        <WeatherIcon size={32} />
        {displayWeather.mood === "rain" || displayWeather.mood === "storm" ? <span className="weather-drops" /> : null}
      </div>
      <div className="weather-copy">
        <span>
          <Thermometer size={13} />
          {displayWeather.status === "loading" ? "..." : temperature}
        </span>
        <strong>{displayWeather.description}</strong>
        <em>{displayWeather.season}</em>
      </div>
    </div>
  );
}

function WeatherSummaryModal({
  weather,
  onClose,
}: {
  weather: TodayWeather;
  onClose: () => void;
}) {
  const { backdropClassName, requestClose } = useModalClose(onClose);
  const displayWeather = getWeatherDisplay(weather, isNightTime());
  const CurrentIcon = weatherIconMap[displayWeather.mood];

  return (
    <div className={backdropClassName}>
      <section className="dark-modal weather-summary-modal" role="dialog" aria-modal="true" aria-labelledby="weather-summary-title">
        <button className="close-button" type="button" onClick={requestClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <header className="weather-summary-header">
          <span className="weather-summary-header-icon">
            <CurrentIcon size={22} />
          </span>
          <div>
            <p className="eyebrow">Resumo do dia</p>
            <h2 id="weather-summary-title">
              {weather.status === "ready" ? displayWeather.description : "Previsão indisponível"}
            </h2>
          </div>
        </header>

        <div className={`weather-summary-current weather-${displayWeather.mood}`}>
          <span className="weather-summary-main-icon">
            <CurrentIcon size={38} />
          </span>
          <div>
            <small>Agora</small>
            <strong>{typeof weather.temperature === "number" ? `${weather.temperature}°C` : "--"}</strong>
            <span>{weather.season}</span>
          </div>
          <div className="weather-humidity">
            <Droplets size={20} />
            <span>
              <small>Umidade</small>
              <strong>{typeof weather.humidity === "number" ? `${weather.humidity}%` : "--"}</strong>
            </span>
          </div>
        </div>

        <div className="weather-forecast-heading">
          <strong>Próximos 5 dias</strong>
          <span className="weather-temperature-labels" aria-hidden="true">
            <small>Mín.</small>
            <small>Máx.</small>
          </span>
        </div>
        <div className="weather-forecast-list">
          {weather.forecast?.length ? (
            weather.forecast.map((day) => {
              const ForecastIcon = weatherIconMap[day.mood];
              const date = new Date(`${day.date}T12:00:00`);

              return (
                <article key={day.date}>
                  <span>
                    <strong>{date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</strong>
                    <small>{date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</small>
                  </span>
                  <ForecastIcon size={24} />
                  <span className="weather-forecast-rain">
                    <Droplets size={13} />
                    {day.precipitation}%
                  </span>
                  <strong className="weather-forecast-temperature weather-forecast-min">{day.min}°</strong>
                  <strong className="weather-forecast-temperature weather-forecast-max">{day.max}°</strong>
                </article>
              );
            })
          ) : (
            <div className="weather-forecast-empty">A previsão dos próximos dias ainda não está disponível.</div>
          )}
        </div>
      </section>
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

function formatActivityRelativeTime(value: string) {
  const distance = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(distance / 60_000));

  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;

  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function ActivityTimelineModal({
  events,
  messages,
  residents,
  onClose,
  onOpenLocation,
  onOpenReminder,
  onOpenMessage,
}: {
  events: ActivityEvent[];
  messages: DailyMessage[];
  residents: Resident[];
  onClose: () => void;
  onOpenLocation: (shareId: string) => void;
  onOpenReminder: (reminderId: string) => void;
  onOpenMessage: (messageId: string) => void;
}) {
  const { backdropClassName, requestClose } = useModalClose(onClose);
  const iconMap: Record<ActivityEvent["kind"], LucideIcon> = {
    reminder: Bell,
    location: MapPin,
    birthday: Cake,
    resident: UserPlus,
    message: MessageCircle,
  };

  return (
    <div className={backdropClassName}>
      <section className="dark-modal activity-modal" role="dialog" aria-modal="true" aria-labelledby="activity-title">
        <button className="close-button" type="button" onClick={requestClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <span className="modal-icon activity-modal-icon">
          <History size={30} />
        </span>
        <p className="eyebrow">Histórico da casa</p>
        <h2 id="activity-title">Timeline</h2>
        <p className="activity-modal-copy">Os últimos acontecimentos, em ordem, com quem fez cada ação.</p>

        <div className="activity-timeline">
          {events.length ? (
            events.map((event, index) => {
              const resident = residents.find((item) => item.id === event.residentId);
              const EventIcon = iconMap[event.kind];
              const linkedMessage = event.messageId ? messages.find((item) => item.id === event.messageId) : undefined;
              const isInteractive = Boolean(event.locationShareId || event.reminderId || linkedMessage);
              const content = (
                <>
                  <span className={`activity-kind activity-kind-${event.kind}`}>
                    <EventIcon size={17} />
                  </span>
                  <span className="activity-content">
                    <span className="activity-title">
                      <strong>{resident?.name ?? "Alguém da casa"}</strong> {event.title}
                    </span>
                    {event.detail ? <small>{event.detail}</small> : null}
                    <time dateTime={event.createdAt}>{formatActivityRelativeTime(event.createdAt)}</time>
                  </span>
                  {linkedMessage?.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="activity-message-thumbnail" src={linkedMessage.photo} alt="" />
                  ) : null}
                  {isInteractive ? <ChevronRight size={18} className="activity-chevron" /> : null}
                </>
              );

              return (
                <article className="activity-entry" key={event.id} style={{ "--activity-index": index } as CSSProperties}>
                  {isInteractive ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (event.locationShareId) {
                          onOpenLocation(event.locationShareId);
                        } else if (event.reminderId) {
                          onOpenReminder(event.reminderId);
                        } else if (event.messageId) {
                          onOpenMessage(event.messageId);
                        }
                      }}
                      aria-label={
                        event.locationShareId
                          ? `Abrir localização compartilhada por ${resident?.name ?? "morador"}`
                          : event.messageId
                            ? `Abrir mensagem do dia: ${event.detail ?? ""}`
                            : `Abrir lembrete: ${event.detail ?? event.title}`
                      }
                    >
                      {content}
                    </button>
                  ) : (
                    <div>{content}</div>
                  )}
                </article>
              );
            })
          ) : (
            <div className="activity-empty">
              <History size={24} />
              <strong>A casa está tranquila</strong>
              <span>Novos lembretes, localizações e mudanças vão aparecer aqui.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function DailyMessageModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (message: string, photo?: string) => void | Promise<void>;
}) {
  const { backdropClassName, requestClose } = useModalClose(onClose);
  const [photo, setPhoto] = useState("");
  const [photoError, setPhotoError] = useState("");

  function handlePhoto(file?: File) {
    if (!file) {
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setPhotoError("Escolha uma foto de até 3 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(String(reader.result ?? ""));
      setPhotoError("");
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className={backdropClassName}>
      <form
        className="dark-modal daily-message-modal"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void onSubmit(String(form.get("message") ?? "").trim(), photo || undefined);
        }}
      >
        <button className="close-button" type="button" onClick={requestClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <span className="modal-icon daily-message-modal-icon">
          <MessageCircle size={30} />
        </span>
        <p className="eyebrow">Mural da casa</p>
        <h2>Mensagem do dia</h2>
        <div className="field">
          <label htmlFor="daily-message-text">Sua mensagem</label>
          <textarea
            id="daily-message-text"
            name="message"
            maxLength={240}
            placeholder="Ex: Boa prova hoje! Estamos torcendo por você."
            required
          />
        </div>
        <label className={`daily-photo-picker ${photo ? "has-photo" : ""}`}>
          <input accept="image/*" type="file" onChange={(event) => handlePhoto(event.target.files?.[0])} />
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Prévia da foto escolhida" />
          ) : (
            <>
              <Camera size={24} />
              <strong>Adicionar foto</strong>
              <small>Opcional · até 3 MB</small>
            </>
          )}
        </label>
        {photoError ? <p className="modal-error">{photoError}</p> : null}
        <button className="primary-action" type="submit">
          <Check size={18} />
          Publicar mensagem
        </button>
      </form>
    </div>
  );
}

function DailyMessageStoryModal({
  initialMessageId,
  messages,
  residents,
  onClose,
}: {
  initialMessageId: string;
  messages: DailyMessage[];
  residents: Resident[];
  onClose: () => void;
}) {
  const { backdropClassName, requestClose } = useModalClose(onClose);
  const initialIndex = Math.max(0, messages.findIndex((item) => item.id === initialMessageId));
  const [storyIndex, setStoryIndex] = useState(initialIndex);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const draggedStoryRef = useRef(false);
  const message = messages[storyIndex] ?? messages[0];
  const resident = residents.find((item) => item.id === message?.residentId);

  function showPrevious() {
    setStoryIndex((current) => Math.max(0, current - 1));
  }

  function showNext() {
    if (storyIndex >= messages.length - 1) {
      requestClose();
      return;
    }
    setStoryIndex((current) => current + 1);
  }

  useEffect(() => {
    if (!message) {
      onClose();
      return;
    }
    const remainingTime = getDailyMessageExpiry(message) - Date.now();
    if (remainingTime <= 0) {
      onClose();
      return;
    }

    const timer = window.setTimeout(showNext, Math.min(10_000, remainingTime));
    return () => window.clearTimeout(timer);
    // showNext intentionally resets whenever the active story changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message?.id, onClose]);

  if (!message) {
    return null;
  }

  return (
    <div className={`${backdropClassName} story-backdrop`}>
      <article
        className={`daily-story ${message.photo ? "daily-story-photo" : ""} ${dragOffset > 0 ? "daily-story-dragging" : ""}`}
        role="dialog"
        aria-modal="true"
        onPointerDown={(event) => {
          dragStartY.current = event.clientY;
          draggedStoryRef.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragStartY.current === null) return;
          const nextOffset = Math.max(0, event.clientY - dragStartY.current);
          draggedStoryRef.current = nextOffset > 8;
          setDragOffset(nextOffset);
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId);
          dragStartY.current = null;
          if (dragOffset > 90) {
            requestClose();
          } else {
            setDragOffset(0);
          }
        }}
        onPointerCancel={() => {
          dragStartY.current = null;
          draggedStoryRef.current = false;
          setDragOffset(0);
        }}
        style={{ "--story-drag-y": `${dragOffset}px` } as CSSProperties}
      >
        {message.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="daily-story-image" src={message.photo} alt="" />
        ) : null}
        <div className="daily-story-shade" />
        <div className="daily-story-progress-group" aria-hidden="true">
          {messages.map((item, index) => (
            <span className="daily-story-progress" key={item.id}>
              <i className={index < storyIndex ? "complete" : index === storyIndex ? "active" : ""} />
            </span>
          ))}
        </div>
        <button className="daily-story-close" type="button" onClick={requestClose} aria-label="Fechar story">
          <X size={22} />
        </button>
        <header className="daily-story-author">
          {resident ? <Avatar resident={resident} /> : null}
          <span>
            <strong>{resident?.name ?? "Alguém da casa"}</strong>
            <small>{formatActivityRelativeTime(message.createdAt)}</small>
          </span>
        </header>
        <div className="daily-story-message">
          <p>{message.message}</p>
        </div>
        <button
          className="daily-story-tap-zone daily-story-tap-previous"
          disabled={storyIndex === 0}
          onClick={() => {
            if (!draggedStoryRef.current) showPrevious();
          }}
          type="button"
          aria-label="Story anterior"
        />
        <button
          className="daily-story-tap-zone daily-story-tap-next"
          onClick={() => {
            if (!draggedStoryRef.current) showNext();
          }}
          type="button"
          aria-label={storyIndex === messages.length - 1 ? "Fechar stories" : "Próximo story"}
        />
      </article>
    </div>
  );
}

function EventStoryModal({
  birthdays,
  kind,
  reminders,
  onClose,
  onOpenCalendar,
}: {
  birthdays: Birthday[];
  kind: "reminder" | "birthday";
  reminders: Reminder[];
  onClose: () => void;
  onOpenCalendar: () => void;
}) {
  const { backdropClassName, requestClose } = useModalClose(onClose);
  const items = kind === "reminder" ? reminders : birthdays;
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const draggedRef = useRef(false);
  const item = items[index];

  function previous() {
    setIndex((current) => Math.max(0, current - 1));
  }

  function next() {
    if (index >= items.length - 1) {
      requestClose();
      return;
    }
    setIndex((current) => current + 1);
  }

  useEffect(() => {
    if (!item) {
      onClose();
      return;
    }
    const timer = window.setTimeout(next, 10_000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, onClose]);

  if (!item) return null;

  const isReminder = kind === "reminder";
  const reminder = isReminder ? (item as Reminder) : null;
  const birthday = !isReminder ? (item as Birthday) : null;
  const reminderOption = reminderIconMap[reminder?.icon ?? "general"] ?? reminderIconMap.general;
  const StoryIcon = isReminder ? reminderOption.Icon : Cake;
  const title = reminder?.text ?? birthday?.name ?? "";
  const dateLabel = isReminder
    ? formatDateLabel(reminder?.date ?? "")
    : formatBirthdayValue(birthday?.date ?? "");

  return (
    <div className={`${backdropClassName} story-backdrop`}>
      <article
        className={`daily-story event-story event-story-${kind} ${dragOffset > 0 ? "daily-story-dragging" : ""}`}
        role="dialog"
        aria-modal="true"
        style={{ "--story-drag-y": `${dragOffset}px` } as CSSProperties}
        onPointerDown={(event) => {
          dragStartY.current = event.clientY;
          draggedRef.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragStartY.current === null) return;
          const offset = Math.max(0, event.clientY - dragStartY.current);
          draggedRef.current = offset > 8;
          setDragOffset(offset);
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId);
          dragStartY.current = null;
          if (dragOffset > 90) requestClose();
          else setDragOffset(0);
        }}
        onPointerCancel={() => {
          dragStartY.current = null;
          draggedRef.current = false;
          setDragOffset(0);
        }}
      >
        <div className="event-story-atmosphere" aria-hidden="true" />
        <div className="daily-story-progress-group" aria-hidden="true">
          {items.map((storyItem, storyIndex) => (
            <span className="daily-story-progress" key={storyItem.id}>
              <i className={storyIndex < index ? "complete" : storyIndex === index ? "active" : ""} />
            </span>
          ))}
        </div>
        <button className="daily-story-close" type="button" onClick={requestClose} aria-label="Fechar story">
          <X size={22} />
        </button>

        <div className="event-story-kicker">
          <span>{isReminder ? "Lembrete" : "Aniversário"}</span>
          <small>
            {index + 1} de {items.length}
          </small>
        </div>

        <div className="event-story-content">
          <span className="event-story-icon">
            <i aria-hidden="true" />
            <StoryIcon size={68} strokeWidth={1.7} />
          </span>
          <p>{isReminder ? "Não esqueça" : "Uma data especial"}</p>
          <h2>{title}</h2>
          <strong>{dateLabel}</strong>
          {reminder?.recurrence ? (
            <small>{getReminderRecurrenceLabel(reminder.recurrence)}</small>
          ) : null}
        </div>

        <button
          className="event-story-calendar"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenCalendar();
          }}
        >
          <CalendarDays size={17} />
          Ver calendário
        </button>
        <button
          className="daily-story-tap-zone daily-story-tap-previous"
          disabled={index === 0}
          onClick={() => {
            if (!draggedRef.current) previous();
          }}
          type="button"
          aria-label="Story anterior"
        />
        <button
          className="daily-story-tap-zone daily-story-tap-next"
          onClick={() => {
            if (!draggedRef.current) next();
          }}
          type="button"
          aria-label={index === items.length - 1 ? "Fechar stories" : "Próximo story"}
        />
      </article>
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
  onSubmit: (mode: "sign-in" | "sign-up", accountId: string, password: string, familyCode: string) => void;
}) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">(hasInvite ? "sign-up" : "sign-in");
  const [email, setEmail] = useState("");
  const [familyCode, setFamilyCode] = useState(() =>
    typeof window === "undefined"
      ? ""
      : normalizeHouseholdCode(new URLSearchParams(window.location.search).get("lar") ?? ""),
  );
  const [rememberAccess, setRememberAccess] = useState(true);
  const isSignUp = mode === "sign-up";

  useEffect(() => {
    const shouldRemember = window.localStorage.getItem(REMEMBER_AUTH_KEY) !== "false";
    setRememberAccess(shouldRemember);
    setEmail(shouldRemember ? window.localStorage.getItem(LAST_AUTH_ID_KEY) ?? "" : "");
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const emailValue = normalizeAccountId(email);
    const password = String(form.get("password") ?? "");

    if (emailValue.length < 4 || password.length < 6 || (isSignUp && familyCode.length < 4)) {
      return;
    }

    window.localStorage.setItem(REMEMBER_AUTH_KEY, String(rememberAccess));
    if (rememberAccess) {
      window.localStorage.setItem(LAST_AUTH_ID_KEY, emailValue);
    } else {
      window.localStorage.removeItem(LAST_AUTH_ID_KEY);
    }
    onSubmit(mode, emailValue, password, familyCode);
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
          <label htmlFor="auth-email">ID de acesso</label>
          <input
            id="auth-email"
            name="username"
            autoCapitalize="none"
            autoComplete="username"
            minLength={4}
            onChange={(event) => setEmail(normalizeAccountId(event.target.value))}
            pattern="[a-z0-9._-]{4,}"
            placeholder="Ex: alcides.ramos"
            type="text"
            required
            value={email}
          />
          <small className="field-helper">Use letras minúsculas, números, ponto, hífen ou sublinhado.</small>
        </div>
        <label className="remember-access-check">
          <input
            checked={rememberAccess}
            onChange={(event) => setRememberAccess(event.target.checked)}
            type="checkbox"
          />
          <span>
            <strong>Lembrar meu acesso</strong>
            <small>Manter conectado e guardar o ID neste aparelho</small>
          </span>
        </label>
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
        {isSignUp ? (
          <div className="field">
            <label htmlFor="auth-family-code">Código da família</label>
            <div className="auth-family-code-field">
              <House size={18} />
              <input
                autoCapitalize="characters"
                id="auth-family-code"
                maxLength={8}
                onChange={(event) => setFamilyCode(normalizeHouseholdCode(event.target.value))}
                placeholder="Ex: ABC123"
                readOnly={hasInvite}
                required
                value={familyCode}
              />
            </div>
            <small className="field-helper">
              {hasInvite ? "Código preenchido pelo convite recebido." : "Peça este código para alguém da família."}
            </small>
          </div>
        ) : null}
        <button className="primary-action" type="submit">
          <Check size={18} />
          {hasInvite ? (isSignUp ? "Criar conta e continuar" : "Entrar e continuar") : isSignUp ? "Criar conta" : "Entrar"}
        </button>
      </form>
    </section>
  );
}

function PasswordRecoveryScreen({
  onContinue,
  onSubmit,
}: {
  onContinue: () => void;
  onSubmit: (password: string) => Promise<string | null>;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("passwordConfirmation") ?? "");

    if (password.length < 6) {
      setError("A nova senha precisa ter no mínimo 6 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As senhas digitadas não são iguais.");
      return;
    }

    setError("");
    setStatus("saving");
    const updateError = await onSubmit(password);
    if (updateError) {
      setStatus("idle");
      setError(updateError);
      return;
    }
    setStatus("saved");
  }

  return (
    <section className="household-setup auth-setup password-recovery-screen">
      <div className="household-hero">
        <span className="household-icon password-recovery-icon">
          <KeyRound size={32} />
        </span>
        <p className="eyebrow">Recuperação de acesso</p>
        <h1>{status === "saved" ? "Senha atualizada" : "Crie uma nova senha"}</h1>
        <p>
          {status === "saved"
            ? "Seu acesso está protegido novamente. Você já pode continuar para a sua casa."
            : "Escolha uma senha nova para entrar novamente em qualquer aparelho."}
        </p>
      </div>

      {status === "saved" ? (
        <div className="household-card auth-card password-recovery-success" role="status">
          <span>
            <Check size={24} />
          </span>
          <strong>Tudo certo</strong>
          <p>A nova senha já está valendo para esta conta.</p>
          <button className="primary-action" type="button" onClick={onContinue}>
            Continuar
          </button>
        </div>
      ) : (
        <form className="household-card auth-card" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="recovery-password">Nova senha</label>
            <input
              autoComplete="new-password"
              id="recovery-password"
              minLength={6}
              name="password"
              placeholder="No mínimo 6 caracteres"
              required
              type="password"
            />
          </div>
          <div className="field">
            <label htmlFor="recovery-password-confirmation">Confirmar nova senha</label>
            <input
              autoComplete="new-password"
              id="recovery-password-confirmation"
              minLength={6}
              name="passwordConfirmation"
              placeholder="Digite a senha novamente"
              required
              type="password"
            />
          </div>
          {error ? (
            <p className="auth-feedback auth-feedback-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="primary-action" disabled={status === "saving"} type="submit">
            <Check size={18} />
            {status === "saving" ? "Salvando…" : "Salvar nova senha"}
          </button>
        </form>
      )}
    </section>
  );
}

function LegacyAccountMigrationScreen({
  email,
  onSubmit,
}: {
  email: string;
  onSubmit: (handle: string) => Promise<string | null>;
}) {
  const [handle, setHandle] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("saving");
    const migrationError = await onSubmit(handle);
    if (migrationError) {
      setStatus("idle");
      setError(migrationError);
    }
  }

  return (
    <section className="household-setup auth-setup password-recovery-screen">
      <div className="household-hero">
        <span className="household-icon">
          <KeyRound size={32} />
        </span>
        <p className="eyebrow">Atualização de acesso</p>
        <h1>Escolha seu ID</h1>
        <p>Sua conta e todos os dados serão mantidos. Depois disso, você entrará somente com ID e senha.</p>
      </div>
      <form className="household-card auth-card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="migration-handle">Novo ID de acesso</label>
          <input
            autoCapitalize="none"
            autoComplete="username"
            id="migration-handle"
            minLength={4}
            onChange={(event) => setHandle(normalizeAccountId(event.target.value))}
            pattern="[a-z0-9._-]{4,}"
            placeholder="Ex: juliano.ramos"
            required
            value={handle}
          />
          <small className="field-helper">O e-mail {email} ficará guardado apenas para recuperação.</small>
        </div>
        {error ? <p className="auth-feedback auth-feedback-error">{error}</p> : null}
        <button className="primary-action" disabled={status === "saving"} type="submit">
          <Check size={18} />
          {status === "saving" ? "Atualizando…" : "Salvar ID e continuar"}
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
}: {
  resident: Resident;
  pin: string;
  error: string;
  onClose: () => void;
  onDigit: (digit: string) => void;
  onErase: () => void;
}) {
  const { backdropClassName, requestClose } = useModalClose(onClose);

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
  const [uploadError, setUploadError] = useState("");

  function handleUpload(file?: File) {
    if (!file) {
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setUploadError("Escolha uma foto de até 3 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onSelect(String(reader.result ?? ""));
      setUploadError("");
    };
    reader.readAsDataURL(file);
  }

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
        <span>Use uma imagem pronta ou envie sua foto.</span>
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
      <label className="avatar-upload-button">
        <input
          accept="image/*"
          type="file"
          onChange={(event) => handleUpload(event.target.files?.[0])}
        />
        <Camera size={17} />
        <span>{photo && !avatarOptions.some((avatar) => avatar.src === photo) ? "Trocar foto" : "Enviar minha foto"}</span>
      </label>
      {uploadError ? <small className="avatar-upload-error">{uploadError}</small> : null}
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
  reminder,
  onClose,
  onSubmit,
}: {
  reminder?: Reminder | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { backdropClassName, requestClose } = useModalClose(onClose);
  const [repeats, setRepeats] = useState(Boolean(reminder?.recurrence));

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
          <p className="eyebrow">{reminder ? "Editar item" : "Novo item"}</p>
          <h2>Lembrete</h2>
        </div>
        <div className="field">
          <label htmlFor="reminder-text">Lembrete</label>
          <input
            defaultValue={reminder?.text ?? ""}
            id="reminder-text"
            name="text"
            placeholder="Ex: Tomar remédio às 20h"
            required
          />
        </div>
        <div className="field">
          <span className="field-label">Icone</span>
          <div className="reminder-icon-grid">
            {reminderIconOptions.map(({ id, label, Icon }) => (
              <label className="reminder-icon-choice" key={id}>
                <input
                  defaultChecked={id === (reminder?.icon ?? "general")}
                  name="icon"
                  type="radio"
                  value={id}
                />
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
            <input
              defaultValue={reminder ? formatReminderDateInput(reminder.date) : ""}
              id="reminder-date"
              name="date"
              type="date"
            />
          </div>
        </div>
        <VisibilityPicker defaultValue={reminder?.visibility ?? "household"} />
        <div className="reminder-repeat-section">
          <label className="reminder-repeat-toggle">
            <span>
              <strong>Se repete</strong>
              <small>Cria a próxima ocorrência automaticamente</small>
            </span>
            <input
              checked={repeats}
              onChange={(event) => setRepeats(event.target.checked)}
              type="checkbox"
            />
            <i aria-hidden="true" />
          </label>
          {repeats ? (
            <div className="field reminder-recurrence-field">
              <label htmlFor="reminder-recurrence">Frequência</label>
              <select
                defaultValue={reminder?.recurrence ?? "daily"}
                id="reminder-recurrence"
                name="recurrence"
              >
                {reminderRecurrenceOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <button className="primary-action" type="submit">
          <Check size={18} />
          {reminder ? "Salvar alterações" : "Salvar lembrete"}
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
        <VisibilityPicker />
        <button className="primary-action" type="submit">
          <Check size={18} />
          Salvar aniversário
        </button>
      </form>
    </div>
  );
}

function VisibilityPicker({ defaultValue = "household" }: { defaultValue?: ItemVisibility }) {
  return (
    <fieldset className="visibility-picker">
      <legend>Quem pode ver</legend>
      <div className="visibility-options">
        <label>
          <input defaultChecked={defaultValue === "household"} name="visibility" type="radio" value="household" />
          <span>
            <Users size={18} />
            <strong>Todos da casa</strong>
            <small>Visível nos outros perfis</small>
          </span>
        </label>
        <label>
          <input defaultChecked={defaultValue === "private"} name="visibility" type="radio" value="private" />
          <span>
            <LockKeyhole size={18} />
            <strong>Só eu</strong>
            <small>Somente neste perfil</small>
          </span>
        </label>
      </div>
    </fieldset>
  );
}

function EditResidentModal({
  accountEmail,
  birthday,
  isAnonymousAccount,
  photo,
  resident,
  onClose,
  onDelete,
  onAddAccountEmail,
  onAddAccountPassword,
  onPhotoSelect,
  onThemePreview,
  onSubmit,
}: {
  accountEmail: string;
  birthday?: Birthday;
  isAnonymousAccount: boolean;
  photo: string;
  resident: Resident;
  onClose: () => void;
  onDelete: () => void;
  onAddAccountEmail: (email: string) => Promise<string | null>;
  onAddAccountPassword: (password: string) => Promise<string | null>;
  onPhotoSelect: (photo: string) => void;
  onThemePreview: (theme: ProfileThemeId) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { backdropClassName, requestClose } = useModalClose(onClose);
  const [accountStatus, setAccountStatus] = useState<"idle" | "saving" | "sent" | "saved">("idle");
  const [accountError, setAccountError] = useState("");

  async function handleAccountEmail() {
    const input = document.querySelector<HTMLInputElement>("#profile-account-email");
    const email = input?.value.trim() ?? "";
    if (!email) {
      setAccountError("Digite um e-mail válido.");
      return;
    }
    setAccountError("");
    setAccountStatus("saving");
    const error = await onAddAccountEmail(email);
    setAccountStatus(error ? "idle" : "sent");
    setAccountError(error ?? "");
  }

  async function handleAccountPassword() {
    const password = document.querySelector<HTMLInputElement>("#profile-account-password")?.value ?? "";
    const confirmation =
      document.querySelector<HTMLInputElement>("#profile-account-password-confirmation")?.value ?? "";
    if (password.length < 6 || password !== confirmation) {
      setAccountError(password.length < 6 ? "Use pelo menos 6 caracteres." : "As senhas não são iguais.");
      return;
    }
    setAccountError("");
    setAccountStatus("saving");
    const error = await onAddAccountPassword(password);
    setAccountStatus(error ? "idle" : "saved");
    setAccountError(error ?? "");
  }

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
          <label htmlFor="edit-resident-birthday">Meu aniversário</label>
          <div className="date-field">
            <Cake size={18} />
            <input
              defaultValue={formatBirthdayDateInput(birthday?.date)}
              id="edit-resident-birthday"
              name="birthday"
              type="date"
            />
          </div>
          <small className="field-helper">Ao salvar, a data entra automaticamente nos aniversários da casa.</small>
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
        <section className="profile-account-section">
          <div>
            <p className="eyebrow">Recuperação de acesso</p>
            <h3>{isAnonymousAccount ? "Adicione seu e-mail quando quiser" : "Conta protegida"}</h3>
          </div>
          {isAnonymousAccount ? (
            <>
              <p>O e-mail ficará opcional e será usado somente para recuperar o acesso.</p>
              <div className="field">
                <label htmlFor="profile-account-email">E-mail</label>
                <input
                  autoComplete="email"
                  id="profile-account-email"
                  inputMode="email"
                  placeholder="voce@email.com"
                  type="email"
                />
              </div>
              <button
                className="secondary-action"
                disabled={accountStatus === "saving" || accountStatus === "sent"}
                onClick={() => void handleAccountEmail()}
                type="button"
              >
                {accountStatus === "sent" ? "E-mail salvo" : "Salvar e-mail de recuperação"}
              </button>
              {accountStatus === "sent" ? (
                <p className="auth-feedback auth-feedback-success" role="status">
                  E-mail de recuperação salvo na sua conta.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p>{accountEmail ? `E-mail vinculado: ${accountEmail}` : "E-mail confirmado."}</p>
              <div className="field">
                <label htmlFor="profile-account-password">Criar ou alterar senha</label>
                <input id="profile-account-password" minLength={6} placeholder="No mínimo 6 caracteres" type="password" />
              </div>
              <div className="field">
                <label htmlFor="profile-account-password-confirmation">Confirmar senha</label>
                <input
                  id="profile-account-password-confirmation"
                  minLength={6}
                  placeholder="Digite novamente"
                  type="password"
                />
              </div>
              <button
                className="secondary-action"
                disabled={accountStatus === "saving"}
                onClick={() => void handleAccountPassword()}
                type="button"
              >
                {accountStatus === "saved" ? "Senha salva" : "Salvar senha de acesso"}
              </button>
            </>
          )}
          {accountError ? (
            <p className="auth-feedback auth-feedback-error" role="alert">
              {accountError}
            </p>
          ) : null}
        </section>
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

function CompleteReminderSlider({ onComplete }: { onComplete: () => void }) {
  const [value, setValue] = useState(0);

  function finishSlide() {
    if (value >= 85) {
      onComplete();
      return;
    }

    setValue(0);
  }

  return (
    <div className="complete-reminder-slider" style={{ "--slide-progress": `${value}%` } as CSSProperties}>
      <span className="complete-slider-knob" aria-hidden="true">
        {value >= 85 ? <Check size={18} /> : <ChevronRight size={22} strokeWidth={3} />}
      </span>
      <span className="complete-slider-label">Arraste para concluir</span>
      <input
        aria-label="Arraste para marcar o lembrete como concluído"
        max="100"
        min="0"
        onChange={(event) => setValue(Number(event.target.value))}
        onKeyUp={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            onComplete();
          }
        }}
        onPointerUp={finishSlide}
        type="range"
        value={value}
      />
      <Check className="complete-slider-finish" aria-hidden="true" size={18} />
    </div>
  );
}

function CalendarModal({
  canManage,
  items,
  kind,
  onClose,
  onCreate,
  onComplete,
  onDelete,
  onEdit,
  title,
}: {
  canManage: (item: Reminder | Birthday) => boolean;
  items: Array<Reminder | Birthday>;
  kind: "reminder" | "birthday";
  onClose: () => void;
  onCreate: () => void;
  onComplete: (item: Reminder | Birthday) => void;
  onDelete: (item: Reminder | Birthday) => void;
  onEdit: (item: Reminder | Birthday) => void;
  title: string;
}) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() => getSavedCalendarView(kind));
  const today = startOfToday();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(today));
  const [selectedCalendarItem, setSelectedCalendarItem] = useState<CalendarItem | null>(null);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<{
    date: Date;
    items: CalendarItem[];
  } | null>(null);
  const [isCalendarDetailClosing, setIsCalendarDetailClosing] = useState(false);
  const [isCalendarDayListClosing, setIsCalendarDayListClosing] = useState(false);
  const [monthMotionDirection, setMonthMotionDirection] = useState<"next" | "prev">("next");
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const { backdropClassName, requestClose } = useModalClose(onClose);
  const calendarDays = getCalendarDays(currentMonth);
  const monthLabel = currentMonth.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const canManageSelectedItem = selectedCalendarItem ? canManage(selectedCalendarItem) : false;

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
    setSelectedCalendarDay(null);
    saveCalendarView(kind, mode);
  }

  function moveMonth(amount: number) {
    setSelectedCalendarItem(null);
    setSelectedCalendarDay(null);
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

  function handleEditSelectedItem() {
    if (!selectedCalendarItem) {
      return;
    }

    onEdit(selectedCalendarItem);
    setSelectedCalendarItem(null);
  }

  function handleCompleteSelectedItem() {
    if (!selectedCalendarItem) {
      return;
    }

    onComplete(selectedCalendarItem);
    setSelectedCalendarItem(null);
  }

  function closeCalendarDetail() {
    if (isCalendarDetailClosing) {
      return;
    }

    setIsCalendarDetailClosing(true);
    window.setTimeout(() => {
      setSelectedCalendarItem(null);
      setIsCalendarDetailClosing(false);
    }, MODAL_EXIT_MS);
  }

  function closeCalendarDayList() {
    if (isCalendarDayListClosing) {
      return;
    }
    setIsCalendarDayListClosing(true);
    window.setTimeout(() => {
      setSelectedCalendarDay(null);
      setIsCalendarDayListClosing(false);
    }, MODAL_EXIT_MS);
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
                        {dayItems.length ? (
                          <button
                            className={`calendar-day-event ${kind === "birthday" ? "birthday-event" : ""}`}
                            type="button"
                            onClick={() => setSelectedCalendarDay({ date: day.date, items: dayItems })}
                            aria-label={`Abrir ${dayItems.length} ${
                              kind === "birthday" ? "aniversários" : "lembretes"
                            } deste dia`}
                          >
                            {kind === "birthday" ? (
                              <Cake size={14} />
                            ) : (
                              <ReminderIconBadge icon={(dayItems[0] as Reminder).icon} />
                            )}
                            {dayItems.length > 1 ? <small>{dayItems.length}</small> : null}
                          </button>
                        ) : null}
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
                        : ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][section.date.getDay()];
                  const isMutedDay = section.items.length === 0;

                  return (
                    <section
                      className={`calendar-timeline-day ${distance === 0 ? "calendar-timeline-today" : ""} ${
                        isMutedDay ? "calendar-timeline-empty" : ""
                      }`}
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

        {selectedCalendarDay ? (
          <div
            className={`calendar-detail-backdrop ${
              isCalendarDayListClosing ? "calendar-detail-backdrop-closing" : ""
            }`}
          >
            <article className="calendar-detail-card calendar-day-list-card">
              <button
                className="close-button"
                type="button"
                onClick={closeCalendarDayList}
                aria-label="Fechar eventos do dia"
              >
                <X size={18} />
              </button>
              <div className="calendar-day-list-header">
                <span className={`calendar-detail-icon ${kind === "birthday" ? "birthday-detail-icon" : ""}`}>
                  {kind === "birthday" ? <Cake size={24} /> : <CalendarDays size={24} />}
                </span>
                <div>
                  <p className="eyebrow">{kind === "birthday" ? "Aniversários do dia" : "Lembretes do dia"}</p>
                  <h3>
                    {selectedCalendarDay.date.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                    })}
                  </h3>
                </div>
              </div>
              <div className="calendar-day-list">
                {selectedCalendarDay.items.map((item) => (
                  <button
                    className="calendar-day-list-item"
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedCalendarDay(null);
                      setSelectedCalendarItem(item);
                    }}
                  >
                    <span>
                      {kind === "birthday" ? (
                        <Cake size={17} />
                      ) : (
                        <ReminderIconBadge icon={(item as Reminder).icon} />
                      )}
                    </span>
                    <strong>{"text" in item ? item.text : item.name}</strong>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
              <small className="calendar-day-list-count">
                {selectedCalendarDay.items.length}{" "}
                {selectedCalendarDay.items.length === 1
                  ? kind === "birthday"
                    ? "aniversário"
                    : "lembrete"
                  : kind === "birthday"
                    ? "aniversários"
                    : "lembretes"}
              </small>
            </article>
          </div>
        ) : null}

        {selectedCalendarItem ? (
          <div className={`calendar-detail-backdrop ${isCalendarDetailClosing ? "calendar-detail-backdrop-closing" : ""}`}>
            <article className="calendar-detail-card">
              <button
                className="close-button"
                type="button"
                onClick={closeCalendarDetail}
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
                {kind === "reminder" && (selectedCalendarItem as Reminder).recurrence ? (
                  <span className="calendar-detail-recurrence">
                    {getReminderRecurrenceLabel((selectedCalendarItem as Reminder).recurrence)}
                  </span>
                ) : null}
              </div>
              {kind === "reminder" && canManageSelectedItem ? (
                <CompleteReminderSlider onComplete={handleCompleteSelectedItem} />
              ) : null}
              {canManageSelectedItem ? (
                <div className="calendar-detail-actions">
                {kind === "reminder" ? (
                  <button className="calendar-edit-button" type="button" onClick={handleEditSelectedItem}>
                    <Pencil size={17} />
                    Editar
                  </button>
                ) : null}
                <button className="calendar-delete-button" type="button" onClick={handleDeleteSelectedItem}>
                  <Trash2 size={17} />
                  Excluir
                </button>
                </div>
              ) : (
                <span className="calendar-detail-recurrence">
                  <LockKeyhole size={14} />
                  Visível para a casa · somente o autor pode alterar
                </span>
              )}
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


