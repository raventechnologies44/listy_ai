/**
 * ListyAI — Day 3 / Feature 1
 * WhatsApp enquiry workflow (integration-ready, no WhatsApp Business API)
 *
 * Path: src/pages/WhatsAppEnquiry.tsx
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { canAccessFeature, getPlan } from "../lib/plans";
import { FeatureGate } from "../components/FeatureGate";

type ListingIntent = "sale" | "rent" | "unknown";
type LeadSaveMode = "create" | "update";

interface ExtractedEnquiry {
  name: string;
  phone: string;
  email: string;
  budget: number | null;
  location: string;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: string;
  listingIntent: ListingIntent;
  requirements: string;
  enquirySummary: string;
  viewingRequested: boolean;
  availabilityQuestion: boolean;
  matchedPropertyHint: string;
}

interface PropertyMatch {
  id: string;
  title: string;
  location: string;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: string;
  listingType: string;
  status: string;
  score: number;
  reasons: string[];
}

interface ExistingLead {
  id: string;
  name: string;
  phone: string;
  email: string;
  stage: string;
  budget: number | null;
  requirements: string;
  notes: string;
  property_id: string | null;
}

interface PropertyRow {
  id?: string;
  agent_id?: string;
  title?: string;
  name?: string;
  description?: string;
  type?: string;
  property_type?: string;
  listing_type?: string;
  sale_rent?: string;
  purpose?: string;
  price?: number | string | null;
  location?: string;
  suburb?: string;
  city?: string;
  address?: string;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  size?: number | string | null;
  features?: string | string[] | null;
  status?: string;
}

interface LeadRow {
  id?: string;
  agent_id?: string;
  name?: string;
  phone?: string;
  email?: string;
  stage?: string;
  budget?: number | string | null;
  requirements?: string;
  notes?: string;
  property_id?: string | null;
}

interface LeadWrite {
  agent_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  budget: number | null;
  requirements: string;
  notes: string;
  stage: string;
  property_id: string | null;
  last_contact_at: string;
  next_follow_up_at: string;
}

const EMPTY_EXTRACTION: ExtractedEnquiry = {
  name: "",
  phone: "",
  email: "",
  budget: null,
  location: "",
  bedrooms: null,
  bathrooms: null,
  propertyType: "",
  listingIntent: "unknown",
  requirements: "",
  enquirySummary: "",
  viewingRequested: false,
  availabilityQuestion: false,
  matchedPropertyHint: "",
};

const PROPERTY_TYPES = [
  "house",
  "home",
  "cluster",
  "townhouse",
  "apartment",
  "flat",
  "cottage",
  "duplex",
  "stand",
  "plot",
  "land",
  "office",
  "warehouse",
  "commercial",
];

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatMoney(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "Not specified";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function isoNow(): string {
  return new Date().toISOString();
}

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

function phonesMatch(a: string, b: string): boolean {
  const left = normalizePhone(a).replace(/^\+?263/, "0");
  const right = normalizePhone(b).replace(/^\+?263/, "0");
  if (!left || !right) return false;
  return left === right || left.endsWith(right.slice(-9)) || right.endsWith(left.slice(-9));
}

function includesLoose(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase().trim());
}

function parseBudget(text: string): number | null {
  const patterns = [
    /(?:budget(?:\s+is)?|up to|around|max(?:imum)?|not more than|under|below)\s*:?\s*(?:usd|us\$|\$)?\s*([\d,]+(?:\.\d+)?)\s*(k|m|million|thousand)?/i,
    /(?:usd|us\$|\$)\s*([\d,]+(?:\.\d+)?)\s*(k|m|million|thousand)?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    let amount = Number(String(match[1]).replace(/,/g, ""));
    if (!Number.isFinite(amount)) continue;
    const suffix = (match[2] || "").toLowerCase();
    if (suffix === "k" || suffix === "thousand") amount *= 1000;
    if (suffix === "m" || suffix === "million") amount *= 1_000_000;
    return amount;
  }
  return null;
}

function parseCount(text: string, kind: "bed" | "bath"): number | null {
  const pattern =
    kind === "bed"
      ? /(\d+)\s*(?:bed(?:room)?s?|br|beds)\b/i
      : /(\d+(?:\.\d+)?)\s*(?:bath(?:room)?s?|ba)\b/i;
  const match = text.match(pattern);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parsePropertyType(text: string): string {
  const lower = text.toLowerCase();
  const found = PROPERTY_TYPES.find((type) => new RegExp(`\\b${type}s?\\b`, "i").test(lower));
  if (!found) return "";
  if (found === "home") return "house";
  if (found === "flat") return "apartment";
  if (found === "plot") return "stand";
  return found;
}

function parseLocation(text: string): string {
  const match = text.match(
    /\b(?:in|at|around|near|along)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?(?:\s+\d+)?)/,
  );
  if (match?.[1]) return match[1].trim();

  const known = [
    "Borrowdale",
    "Borrowdale Brooke",
    "Mount Pleasant",
    "Avondale",
    "Highlands",
    "Chisipite",
    "Glen Lorne",
    "Greendale",
    "Hatfield",
    "Belgravia",
    "Alexandra Park",
    "Newlands",
    "Mandara",
    "Gunhill",
    "Harare",
    "Bulawayo",
    "Victoria Falls",
  ];
  return known.find((place) => includesLoose(text, place)) || "";
}

function parseName(text: string): string {
  const patterns = [
    /(?:my name is|this is|i am|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*[:\-]/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1] && !/looking|interested|searching/i.test(match[1])) {
      return match[1].trim();
    }
  }
  return "";
}

function parsePhone(text: string): string {
  const match = text.match(
    /(?:\+?263|0)?[\s-]*7(?:[7-8]|1)\d[\s-]*\d{3}[\s-]*\d{3}|\+?\d{10,15}/,
  );
  return match ? normalizePhone(match[0]) : "";
}

function parseEmail(text: string): string {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}

function parseListingIntent(text: string): ListingIntent {
  if (/\b(rent|rental|to let|lease|let)\b/i.test(text)) return "rent";
  if (/\b(buy|buying|purchase|for sale|sale)\b/i.test(text)) return "sale";
  return "unknown";
}

function extractLocally(
  message: string,
  senderName: string,
  senderPhone: string,
): ExtractedEnquiry {
  const bedrooms = parseCount(message, "bed");
  const bathrooms = parseCount(message, "bath");
  const budget = parseBudget(message);
  const location = parseLocation(message);
  const propertyType = parsePropertyType(message);
  const viewingRequested = /\b(view|viewing|come see|can i see|available to see|tour)\b/i.test(
    message,
  );
  const availabilityQuestion =
    /\b(still available|is it available|available\??|has it been sold|taken)\b/i.test(message);

  const parts = [
    bedrooms ? `${bedrooms} bedroom` : "",
    propertyType,
    location ? `in ${location}` : "",
    budget ? `budget ${formatMoney(budget)}` : "",
  ].filter(Boolean);

  return {
    name: parseName(message) || senderName.trim(),
    phone: parsePhone(message) || normalizePhone(senderPhone),
    email: parseEmail(message),
    budget,
    location,
    bedrooms,
    bathrooms,
    propertyType,
    listingIntent: parseListingIntent(message),
    requirements: parts.join(" ").trim() || message.trim().slice(0, 180),
    enquirySummary: message.trim().replace(/\s+/g, " ").slice(0, 280),
    viewingRequested,
    availabilityQuestion,
    matchedPropertyHint: "",
  };
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractionFromAI(
  payload: Record<string, unknown>,
  fallback: ExtractedEnquiry,
): ExtractedEnquiry {
  const intent = asText(payload.listing_intent || payload.listingIntent).toLowerCase();
  return {
    name: asText(payload.name) || fallback.name,
    phone: asText(payload.phone) || fallback.phone,
    email: asText(payload.email) || fallback.email,
    budget: asNumber(payload.budget) ?? fallback.budget,
    location: asText(payload.location) || fallback.location,
    bedrooms: asNumber(payload.bedrooms) ?? fallback.bedrooms,
    bathrooms: asNumber(payload.bathrooms) ?? fallback.bathrooms,
    propertyType: asText(payload.property_type || payload.propertyType) || fallback.propertyType,
    listingIntent: intent === "rent" || intent === "sale" ? intent : fallback.listingIntent,
    requirements: asText(payload.requirements) || fallback.requirements,
    enquirySummary:
      asText(payload.enquiry_summary || payload.enquirySummary) || fallback.enquirySummary,
    viewingRequested:
      typeof payload.viewing_requested === "boolean"
        ? payload.viewing_requested
        : typeof payload.viewingRequested === "boolean"
          ? payload.viewingRequested
          : fallback.viewingRequested,
    availabilityQuestion:
      typeof payload.availability_question === "boolean"
        ? payload.availability_question
        : fallback.availabilityQuestion,
    matchedPropertyHint:
      asText(payload.matched_property_hint || payload.matchedPropertyHint) ||
      fallback.matchedPropertyHint,
  };
}

function buildExtractionPrompt(message: string, senderName: string, senderPhone: string): string {
  return [
    "You are ListyAI, an assistant for a real-estate agent.",
    "Extract structured buyer details from this WhatsApp enquiry.",
    "Return ONLY valid JSON with these keys:",
    '{ "name": string|null, "phone": string|null, "email": string|null, "budget": number|null, "location": string|null, "bedrooms": number|null, "bathrooms": number|null, "property_type": string|null, "listing_intent": "sale"|"rent"|"unknown", "requirements": string, "enquiry_summary": string, "viewing_requested": boolean, "availability_question": boolean, "matched_property_hint": string|null, "suggested_reply": string }',
    "If a field is missing, use null or false. Do not invent a budget, name, or phone.",
    `Sender name if known: ${senderName || "unknown"}`,
    `Sender phone if known: ${senderPhone || "unknown"}`,
    "Enquiry:",
    message,
  ].join("\n");
}

function buildReplyPrompt(extracted: ExtractedEnquiry, property: PropertyMatch | null): string {
  return [
    "Write a short, professional WhatsApp reply from a real-estate agent.",
    "Be warm, specific and concise (4-7 sentences). Do not use markdown.",
    "Do not claim a viewing is booked. Invite the buyer to confirm.",
    "Do not mention that this was generated by AI.",
    `Buyer name: ${extracted.name || "there"}`,
    `Requirements: ${extracted.requirements || extracted.enquirySummary}`,
    `Budget: ${formatMoney(extracted.budget)}`,
    `Location wanted: ${extracted.location || "not specified"}`,
    `Viewing requested: ${extracted.viewingRequested ? "yes" : "no"}`,
    `Availability asked: ${extracted.availabilityQuestion ? "yes" : "no"}`,
    property
      ? `Matched property: ${property.title}, ${property.location}, ${formatMoney(property.price)}, ${property.bedrooms ?? "?"} beds, status ${property.status}.`
      : "No property has been matched yet. Ask a clarifying question.",
  ].join("\n");
}

function readAIText(data: unknown): string | null {
  if (!data) return null;
  if (typeof data === "string") {
    const text = data.trim();
    return text || null;
  }
  if (typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const nestedContent =
    record.content && typeof record.content === "object"
      ? (record.content as Record<string, unknown>).text
      : null;
  const candidates = [
    record.content,
    record.text,
    record.result,
    record.message,
    record.output,
    record.completion,
    record.reply,
    nestedContent,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

async function callListyAI(prompt: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("ai-generate", {
    body: {
      prompt,
      task: "whatsapp-enquiry",
      type: "whatsapp-enquiry",
    },
  });
  if (error) return null;
  return readAIText(data);
}

function suggestedReplyFromExtraction(
  extracted: ExtractedEnquiry,
  property: PropertyMatch | null,
): string {
  const greeting = extracted.name ? `Hi ${extracted.name.split(" ")[0]},` : "Hi,";
  const need = extracted.requirements || "the property you asked about";

  if (property) {
    const viewingLine = extracted.viewingRequested
      ? `If you'd like, I can arrange a viewing for ${property.title} — tell me a day and time that suits you.`
      : `Would you like more details, photos, or to book a viewing for ${property.title}?`;
    const availabilityLine = extracted.availabilityQuestion
      ? `${property.title} in ${property.location} is currently marked as ${property.status.toLowerCase()}.`
      : `A close match is ${property.title} in ${property.location} at ${formatMoney(property.price)}.`;

    return [
      greeting,
      `Thanks for your WhatsApp enquiry about ${need}.`,
      availabilityLine,
      viewingLine,
      "Reply here and I’ll help you with the next step.",
    ].join(" ");
  }

  return [
    greeting,
    `Thanks for getting in touch about ${need}.`,
    extracted.location
      ? `I’m checking current ${extracted.propertyType || "property"} options in ${extracted.location}` +
        (extracted.budget ? ` around ${formatMoney(extracted.budget)}.` : ".")
      : "I’m checking the current listings that fit what you described.",
    extracted.viewingRequested
      ? "Once I confirm a suitable property, we can set a viewing."
      : "Could you confirm your preferred suburb, budget and whether you want to buy or rent?",
    "I’ll follow up shortly.",
  ].join(" ");
}

function scoreProperty(property: PropertyRow, extracted: ExtractedEnquiry): PropertyMatch | null {
  const id = asText(property.id);
  if (!id) return null;

  const title = asText(property.title || property.name) || "Untitled property";
  const location = [property.location, property.suburb, property.city, property.address]
    .map(asText)
    .filter(Boolean)
    .join(", ");
  const price = asNumber(property.price);
  const bedrooms = asNumber(property.bedrooms);
  const bathrooms = asNumber(property.bathrooms);
  const propertyType = asText(property.property_type || property.type);
  const listingType = asText(property.listing_type || property.sale_rent || property.purpose);
  const status = asText(property.status) || "Available";
  const blob = [title, location, propertyType, listingType, asText(property.description), status]
    .join(" ")
    .toLowerCase();

  let score = 0;
  const reasons: string[] = [];

  if (extracted.location && includesLoose(location, extracted.location)) {
    score += 40;
    reasons.push(`Location matches ${extracted.location}`);
  } else if (extracted.location && includesLoose(blob, extracted.location)) {
    score += 24;
    reasons.push(`Mentions ${extracted.location}`);
  }

  if (extracted.bedrooms !== null && bedrooms !== null) {
    if (bedrooms === extracted.bedrooms) {
      score += 25;
      reasons.push(`${bedrooms} bedrooms`);
    } else if (Math.abs(bedrooms - extracted.bedrooms) === 1) {
      score += 10;
      reasons.push("Similar bedroom count");
    }
  }

  if (extracted.budget !== null && price !== null) {
    if (price <= extracted.budget * 1.08) {
      score += 20;
      reasons.push("Within budget");
    } else if (price <= extracted.budget * 1.2) {
      score += 8;
      reasons.push("Slightly above budget");
    }
  }

  if (extracted.propertyType && includesLoose(propertyType || blob, extracted.propertyType)) {
    score += 15;
    reasons.push(`${extracted.propertyType} match`);
  }

  if (
    extracted.listingIntent !== "unknown" &&
    listingType &&
    includesLoose(listingType, extracted.listingIntent === "rent" ? "rent" : "sale")
  ) {
    score += 10;
    reasons.push(extracted.listingIntent === "rent" ? "To rent" : "For sale");
  }

  if (/available/i.test(status)) {
    score += 10;
    reasons.push("Available");
  } else if (/viewing|negotiation/i.test(status)) {
    score += 4;
    reasons.push(status);
  } else if (/sold|rented/i.test(status)) {
    score -= 25;
  }

  if (extracted.matchedPropertyHint && includesLoose(blob, extracted.matchedPropertyHint)) {
    score += 18;
    reasons.push("Matches enquiry hint");
  }

  if (score < 8) return null;

  return {
    id,
    title,
    location: location || "Location not set",
    price,
    bedrooms,
    bathrooms,
    propertyType: propertyType || "Property",
    listingType: listingType || "—",
    status,
    score,
    reasons: reasons.slice(0, 4),
  };
}

function pickLead(
  rows: LeadRow[],
  phone: string,
  email: string,
  name: string,
): ExistingLead | null {
  const byPhone = phone
    ? rows.find((row) => row.phone && phonesMatch(String(row.phone), phone))
    : undefined;
  const byEmail =
    !byPhone && email
      ? rows.find((row) => asText(row.email).toLowerCase() === email.toLowerCase())
      : undefined;
  const byName =
    !byPhone && !byEmail && name
      ? rows.find((row) => asText(row.name).toLowerCase() === name.toLowerCase())
      : undefined;
  const found = byPhone || byEmail || byName;
  if (!found?.id) return null;
  return {
    id: String(found.id),
    name: asText(found.name),
    phone: asText(found.phone),
    email: asText(found.email),
    stage: asText(found.stage) || "New",
    budget: asNumber(found.budget),
    requirements: asText(found.requirements),
    notes: asText(found.notes),
    property_id: found.property_id ? String(found.property_id) : null,
  };
}

function buildLeadNotes(
  message: string,
  extracted: ExtractedEnquiry,
  previousNotes?: string,
): string {
  const stamp = new Date().toLocaleString();
  const block = [
    `WhatsApp enquiry (${stamp})`,
    message.trim(),
    extracted.enquirySummary ? `Summary: ${extracted.enquirySummary}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (!previousNotes?.trim()) return block;
  return `${previousNotes.trim()}\n\n${block}`;
}

function buildLeadPayload(
  agentId: string,
  extracted: ExtractedEnquiry,
  propertyId: string | null,
  notes: string,
  existing?: ExistingLead | null,
): LeadWrite {
  return {
    agent_id: agentId,
    name: extracted.name || existing?.name || "WhatsApp enquiry",
    phone: emptyToNull(extracted.phone || existing?.phone || ""),
    email: emptyToNull(extracted.email || existing?.email || ""),
    budget: extracted.budget,
    requirements: extracted.requirements || existing?.requirements || extracted.enquirySummary,
    notes,
    stage: existing?.stage || "New",
    property_id: propertyId,
    last_contact_at: isoNow(),
    next_follow_up_at: isoDaysFromNow(extracted.viewingRequested ? 1 : 2),
  };
}

async function persistLead(
  mode: LeadSaveMode,
  leadId: string | null,
  payload: LeadWrite,
): Promise<{ id: string }> {
  if (mode === "update") {
    if (!leadId) throw new Error("No existing lead is selected to update.");
    const { data, error } = await supabase
      .from("leads")
      .update(payload)
      .eq("id", leadId)
      .eq("agent_id", payload.agent_id)
      .select("id")
      .single();
    if (error) throw error;
    return data as { id: string };
  }

  const { data, error } = await supabase.from("leads").insert(payload).select("id").single();
  if (error) throw error;
  return data as { id: string };
}

export default function WhatsAppEnquiry() {
  const { profile } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [message, setMessage] = useState("");
  const [extracted, setExtracted] = useState<ExtractedEnquiry>(EMPTY_EXTRACTION);
  const [matches, setMatches] = useState<PropertyMatch[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [existingLead, setExistingLead] = useState<ExistingLead | null>(null);
  const [saveMode, setSaveMode] = useState<LeadSaveMode>("create");
  const [suggestedReply, setSuggestedReply] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [aiUsed, setAiUsed] = useState(false);
  const [step, setStep] = useState<"paste" | "review">("paste");

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      if (authError) setError(authError.message);
      setUser(data.user ?? null);
      setAuthChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const selectedProperty = useMemo(
    () => matches.find((item) => item.id === selectedPropertyId) || null,
    [matches, selectedPropertyId],
  );

  const canProcess = message.trim().length >= 8 && !processing && !!user;
  const canSave = reviewed && !saving && !!user && !!extracted.enquirySummary;

  const resetWorkflow = () => {
    setExtracted(EMPTY_EXTRACTION);
    setMatches([]);
    setSelectedPropertyId("");
    setExistingLead(null);
    setSaveMode("create");
    setSuggestedReply("");
    setReviewed(false);
    setCopyState("idle");
    setError("");
    setNotice("");
    setAiUsed(false);
    setStep("paste");
  };

  const findExistingLead = useCallback(
    async (phone: string, email: string, name: string): Promise<ExistingLead | null> => {
      if (!user) return null;
      const { data, error: leadError } = await supabase
        .from("leads")
        .select("id, name, phone, email, stage, budget, requirements, notes, property_id")
        .eq("agent_id", user.id)
        .limit(200);

      if (leadError) throw leadError;
      return pickLead((data || []) as LeadRow[], phone, email, name);
    },
    [user],
  );

  const loadPropertyMatches = useCallback(
    async (details: ExtractedEnquiry): Promise<PropertyMatch[]> => {
      if (!user) return [];
      const { data, error: propertyError } = await supabase
        .from("properties")
        .select("*")
        .eq("agent_id", user.id)
        .limit(200);

      if (propertyError) throw propertyError;
      const rows = (data || []) as PropertyRow[];

      return rows
        .map((row) => scoreProperty(row, details))
        .filter((item): item is PropertyMatch => !!item)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    },
    [user],
  );

  const processEnquiry = async () => {
    if (!canProcess || !user) return;
    setProcessing(true);
    setError("");
    setNotice("");
    setReviewed(false);

    const local = extractLocally(message, senderName, senderPhone);
    let nextExtraction = local;
    let usedAI = false;
    let infoMessage = "";

    try {
      const aiRaw = await callListyAI(
        buildExtractionPrompt(message, senderName || local.name, senderPhone || local.phone),
      );
      if (aiRaw) {
        const parsed = extractJsonObject(aiRaw);
        if (parsed) {
          nextExtraction = extractionFromAI(parsed, local);
          usedAI = true;
        }
      }
    } catch (aiError) {
      infoMessage =
        aiError instanceof Error
          ? `AI extraction unavailable (${aiError.message}). Used structured parsing instead.`
          : "AI extraction unavailable. Used structured parsing instead.";
    }

    try {
      const [propertyMatches, lead] = await Promise.all([
        canAccessFeature(getPlan(profile), "ai_matching") ? loadPropertyMatches(nextExtraction) : Promise.resolve([]),
        findExistingLead(nextExtraction.phone, nextExtraction.email, nextExtraction.name),
      ]);

      const best = propertyMatches[0] || null;
      let finalReply = suggestedReplyFromExtraction(nextExtraction, best);

      if (usedAI) {
        try {
          const polished = await callListyAI(buildReplyPrompt(nextExtraction, best));
          if (polished && !polished.trim().startsWith("{")) finalReply = polished.trim();
        } catch {
          finalReply = suggestedReplyFromExtraction(nextExtraction, best);
        }
      }

      setMatches(propertyMatches);
      setSelectedPropertyId(best?.id || "");
      setExistingLead(lead);
      setSaveMode(lead ? "update" : "create");
      setExtracted(nextExtraction);
      setAiUsed(usedAI);
      setSuggestedReply(finalReply);
      setStep("review");
      setNotice(
        infoMessage ||
          (usedAI
            ? "AI extracted the enquiry. Review every field before saving."
            : "Extracted from the message. Review every field before saving."),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not match properties or leads.",
      );
      setExtracted(nextExtraction);
      setSuggestedReply(suggestedReplyFromExtraction(nextExtraction, null));
      setStep("review");
    } finally {
      setProcessing(false);
    }
  };

  const saveLead = async () => {
    if (!canSave || !user) return;
    setSaving(true);
    setError("");

    try {
      const notes = buildLeadNotes(message, extracted, existingLead?.notes);
      const payload = buildLeadPayload(
        user.id,
        extracted,
        selectedPropertyId || existingLead?.property_id || null,
        notes,
        saveMode === "update" ? existingLead : null,
      );

      const saved = await persistLead(
        saveMode,
        saveMode === "update" ? existingLead?.id || null : null,
        payload,
      );

      setNotice(
        saveMode === "update"
          ? `Existing lead updated (${saved.id}). Copy the reply when you are ready to send it in WhatsApp.`
          : `New lead created (${saved.id}). Copy the reply when you are ready to send it in WhatsApp.`,
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the lead.");
    } finally {
      setSaving(false);
    }
  };

  const copyReply = async () => {
    try {
      await navigator.clipboard.writeText(suggestedReply);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setError("Could not copy the reply. Select the text and copy it manually.");
    }
  };

  const updateField = <K extends keyof ExtractedEnquiry>(key: K, value: ExtractedEnquiry[K]) => {
    setExtracted((current) => ({ ...current, [key]: value }));
    setReviewed(false);
  };

  if (authChecking) {
    return (
      <div className="wa-enquiry-page">
        <style>{STYLES}</style>
        <div className="wa-shell">
          <div className="wa-card wa-empty">Checking your session…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="wa-enquiry-page">
        <style>{STYLES}</style>
        <div className="wa-shell">
          <div className="wa-card wa-empty">
            Sign in to process WhatsApp enquiries. This workflow uses your properties and leads only.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wa-enquiry-page">
      <style>{STYLES}</style>
      <div className="wa-shell">
        <header className="wa-header">
          <div>
            <p className="wa-kicker">ListyAI · Inbox</p>
            <h1>WhatsApp enquiry</h1>
            <p className="wa-sub">
              Paste a buyer message, review the extracted details, then save a lead. Nothing is sent
              to WhatsApp automatically.
            </p>
          </div>
          <div className="wa-steps" aria-label="Workflow steps">
            <span className={step === "paste" ? "active" : ""}>1. Paste</span>
            <span className={step === "review" ? "active" : ""}>2. Review & save</span>
          </div>
        </header>

        {error ? <div className="wa-banner error">{error}</div> : null}
        {notice ? <div className="wa-banner notice">{notice}</div> : null}

        <section className="wa-card">
          <div className="wa-card-head">
            <h2>Incoming message</h2>
            <p>Copy the WhatsApp chat into ListyAI. Add the sender details if they are not in the message.</p>
          </div>
          <div className="wa-grid two">
            <label>
              Sender name
              <input
                value={senderName}
                onChange={(event) => setSenderName(event.target.value)}
                placeholder="e.g. Tendai Moyo"
              />
            </label>
            <label>
              Sender phone
              <input
                value={senderPhone}
                onChange={(event) => setSenderPhone(event.target.value)}
                placeholder="e.g. +263 77 123 4567"
              />
            </label>
          </div>
          <label>
            WhatsApp enquiry
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={7}
              placeholder="Hi, I’m looking for a 3 bedroom house in Borrowdale. My budget is $100,000. Is the house you posted still available?"
            />
          </label>
          <div className="wa-actions">
            <button type="button" className="primary" disabled={!canProcess} onClick={processEnquiry}>
              {processing ? "Extracting…" : "Extract details"}
            </button>
            <button type="button" className="ghost" onClick={resetWorkflow} disabled={processing || saving}>
              Clear
            </button>
          </div>
        </section>

        {step === "review" ? (
          <>
            <section className="wa-card">
              <div className="wa-card-head">
                <h2>Extracted buyer information</h2>
                <p>
                  {aiUsed
                    ? "Generated with your existing ListyAI AI function. Edit anything that looks wrong."
                    : "Parsed from the message. Edit anything that looks wrong before saving."}
                </p>
              </div>
              <div className="wa-grid two">
                <label>
                  Name
                  <input value={extracted.name} onChange={(event) => updateField("name", event.target.value)} />
                </label>
                <label>
                  Phone
                  <input value={extracted.phone} onChange={(event) => updateField("phone", event.target.value)} />
                </label>
                <label>
                  Email
                  <input value={extracted.email} onChange={(event) => updateField("email", event.target.value)} />
                </label>
                <label>
                  Budget (USD)
                  <input
                    type="number"
                    value={extracted.budget ?? ""}
                    onChange={(event) =>
                      updateField("budget", event.target.value === "" ? null : Number(event.target.value))
                    }
                  />
                </label>
                <label>
                  Location
                  <input
                    value={extracted.location}
                    onChange={(event) => updateField("location", event.target.value)}
                  />
                </label>
                <label>
                  Property type
                  <input
                    value={extracted.propertyType}
                    onChange={(event) => updateField("propertyType", event.target.value)}
                    placeholder="house, apartment, townhouse…"
                  />
                </label>
                <label>
                  Bedrooms
                  <input
                    type="number"
                    value={extracted.bedrooms ?? ""}
                    onChange={(event) =>
                      updateField("bedrooms", event.target.value === "" ? null : Number(event.target.value))
                    }
                  />
                </label>
                <label>
                  Bathrooms
                  <input
                    type="number"
                    value={extracted.bathrooms ?? ""}
                    onChange={(event) =>
                      updateField("bathrooms", event.target.value === "" ? null : Number(event.target.value))
                    }
                  />
                </label>
              </div>
              <div className="wa-grid two">
                <label>
                  Buy or rent
                  <select
                    value={extracted.listingIntent}
                    onChange={(event) => updateField("listingIntent", event.target.value as ListingIntent)}
                  >
                    <option value="unknown">Not specified</option>
                    <option value="sale">Buy / sale</option>
                    <option value="rent">Rent</option>
                  </select>
                </label>
                <div className="wa-checks">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={extracted.viewingRequested}
                      onChange={(event) => updateField("viewingRequested", event.target.checked)}
                    />
                    Viewing requested
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={extracted.availabilityQuestion}
                      onChange={(event) => updateField("availabilityQuestion", event.target.checked)}
                    />
                    Asked if still available
                  </label>
                </div>
              </div>
              <label>
                Requirements
                <textarea
                  rows={3}
                  value={extracted.requirements}
                  onChange={(event) => updateField("requirements", event.target.value)}
                />
              </label>
              <label>
                Enquiry summary
                <textarea
                  rows={3}
                  value={extracted.enquirySummary}
                  onChange={(event) => updateField("enquirySummary", event.target.value)}
                />
              </label>
            </section>

            <section className="wa-card">
              <div className="wa-card-head">
                <h2>Matched property</h2>
                <p>Scored against your listings only. Choose the property before the lead is saved.</p>
              </div>
              {!canAccessFeature(getPlan(profile), "ai_matching") ? (
                <FeatureGate feature="ai_matching" compact />
              ) : matches.length === 0 ? (
                <div className="wa-empty subtle">
                  No strong property match yet. You can still save the lead and link a listing later.
                </div>
              ) : (
                <div className="wa-matches">
                  {matches.map((property) => {
                    const selected = property.id === selectedPropertyId;
                    return (
                      <button
                        key={property.id}
                        type="button"
                        className={selected ? "wa-match selected" : "wa-match"}
                        onClick={() => {
                          setSelectedPropertyId(property.id);
                          setReviewed(false);
                          setSuggestedReply(suggestedReplyFromExtraction(extracted, property));
                        }}
                      >
                        <div className="wa-match-top">
                          <strong>{property.title}</strong>
                          <span>{property.score}% fit</span>
                        </div>
                        <p>
                          {property.location} · {property.bedrooms ?? "?"} bed · {formatMoney(property.price)} ·{" "}
                          {property.status}
                        </p>
                        <small>{property.reasons.join(" · ")}</small>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedProperty ? (
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    setSelectedPropertyId("");
                    setReviewed(false);
                    setSuggestedReply(suggestedReplyFromExtraction(extracted, null));
                  }}
                >
                  Unlink {selectedProperty.title}
                </button>
              ) : null}
            </section>

            <section className="wa-card">
              <div className="wa-card-head">
                <h2>Lead action</h2>
                <p>ListyAI will not save until you review and confirm.</p>
              </div>
              {existingLead ? (
                <div className="wa-existing">
                  <p>
                    Existing lead found: <strong>{existingLead.name || "Unnamed lead"}</strong>
                    {existingLead.phone ? ` · ${existingLead.phone}` : ""} · {existingLead.stage || "New"}
                  </p>
                  <div className="wa-actions">
                    <label className="check">
                      <input
                        type="radio"
                        name="lead-mode"
                        checked={saveMode === "update"}
                        onChange={() => setSaveMode("update")}
                      />
                      Update this lead
                    </label>
                    <label className="check">
                      <input
                        type="radio"
                        name="lead-mode"
                        checked={saveMode === "create"}
                        onChange={() => setSaveMode("create")}
                      />
                      Create a new lead instead
                    </label>
                  </div>
                </div>
              ) : (
                <p className="wa-muted">
                  No matching lead on phone or email. This will create a new lead in stage New.
                </p>
              )}

              <label>
                Suggested WhatsApp reply
                <textarea
                  rows={6}
                  value={suggestedReply}
                  onChange={(event) => setSuggestedReply(event.target.value)}
                />
              </label>
              <p className="wa-muted">
                This reply is only copied for you. ListyAI does not send WhatsApp messages.
              </p>

              <label className="check review">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(event) => setReviewed(event.target.checked)}
                />
                I have reviewed the extracted details, property link and reply. Save to my leads.
              </label>

              <div className="wa-actions">
                <button type="button" className="primary" disabled={!canSave} onClick={saveLead}>
                  {saving ? "Saving…" : saveMode === "update" ? "Update lead" : "Create lead"}
                </button>
                <button type="button" className="ghost" onClick={copyReply} disabled={!suggestedReply}>
                  {copyState === "copied" ? "Reply copied" : "Copy reply"}
                </button>
              </div>
            </section>
          </>
        ) : (
          <section className="wa-card wa-empty subtle">
            Paste an enquiry and extract details to review buyer information, property matches and a
            suggested reply.
          </section>
        )}
      </div>
    </div>
  );
}

const STYLES = `
.wa-enquiry-page {
  --ink: #12233a;
  --muted: #5d6b7e;
  --line: #d9e0ea;
  --bg: #f4f7fb;
  --card: #ffffff;
  --brand: #0f4c5c;
  --brand-2: #19697c;
  --ok: #1f7a4d;
  --danger: #b42318;
  color: var(--ink);
  background: var(--bg);
  min-height: 100%;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
}
.wa-shell {
  max-width: 980px;
  margin: 0 auto;
  padding: 28px 20px 64px;
  display: grid;
  gap: 18px;
}
.wa-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.wa-kicker {
  margin: 0 0 6px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--brand);
  font-weight: 700;
}
.wa-header h1 {
  margin: 0;
  font-size: 28px;
  letter-spacing: -0.03em;
}
.wa-sub, .wa-muted, .wa-card-head p {
  color: var(--muted);
  margin: 6px 0 0;
  line-height: 1.5;
  font-size: 14px;
}
.wa-steps { display: flex; gap: 8px; }
.wa-steps span {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  color: var(--muted);
}
.wa-steps span.active {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
}
.wa-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 20px;
  display: grid;
  gap: 14px;
  box-shadow: 0 8px 30px rgba(18, 35, 58, 0.04);
}
.wa-card-head h2 { margin: 0; font-size: 18px; }
.wa-grid.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.wa-enquiry-page label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}
.wa-enquiry-page input,
.wa-enquiry-page textarea,
.wa-enquiry-page select {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 11px 12px;
  font: inherit;
  font-weight: 400;
  color: var(--ink);
  background: #fbfcfe;
}
.wa-enquiry-page textarea { resize: vertical; min-height: 84px; }
.wa-enquiry-page input:focus,
.wa-enquiry-page textarea:focus,
.wa-enquiry-page select:focus {
  outline: 2px solid rgba(15, 76, 92, 0.25);
  border-color: var(--brand);
  background: #fff;
}
.wa-actions, .wa-checks {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}
.wa-enquiry-page button.primary,
.wa-enquiry-page button.ghost,
.wa-enquiry-page button.link {
  border: 0;
  cursor: pointer;
  border-radius: 12px;
  padding: 11px 16px;
  font: inherit;
  font-weight: 700;
}
.wa-enquiry-page button.primary { background: var(--brand); color: #fff; }
.wa-enquiry-page button.primary:hover { background: var(--brand-2); }
.wa-enquiry-page button.ghost { background: #eef3f7; color: var(--ink); }
.wa-enquiry-page button.link {
  background: transparent;
  color: var(--brand);
  padding: 0;
  width: fit-content;
  font-weight: 600;
}
.wa-enquiry-page button:disabled { opacity: 0.5; cursor: not-allowed; }
.check {
  display: flex !important;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.check.review {
  padding: 12px;
  border: 1px dashed var(--line);
  border-radius: 12px;
  background: #f8fafc;
}
.wa-banner { padding: 12px 14px; border-radius: 12px; font-size: 14px; }
.wa-banner.error { background: #fdecea; color: var(--danger); }
.wa-banner.notice { background: #e9f6ef; color: var(--ok); }
.wa-empty { text-align: center; color: var(--muted); padding: 28px 16px; }
.wa-empty.subtle { border: 1px dashed var(--line); background: #fbfcfe; }
.wa-matches { display: grid; gap: 10px; }
.wa-match {
  text-align: left;
  border: 1px solid var(--line);
  background: #fbfcfe;
  border-radius: 14px;
  padding: 12px 14px;
  cursor: pointer;
}
.wa-match.selected {
  border-color: var(--brand);
  background: #eef7f8;
  box-shadow: inset 0 0 0 1px var(--brand);
}
.wa-match-top { display: flex; justify-content: space-between; gap: 8px; }
.wa-match p, .wa-match small { margin: 6px 0 0; color: var(--muted); }
.wa-existing {
  background: #fff8ea;
  border: 1px solid #f0e0b8;
  border-radius: 12px;
  padding: 12px;
}
@media (max-width: 720px) {
  .wa-grid.two { grid-template-columns: 1fr; }
  .wa-header h1 { font-size: 24px; }
  .wa-shell { padding: 18px 14px 48px; }
}
`;