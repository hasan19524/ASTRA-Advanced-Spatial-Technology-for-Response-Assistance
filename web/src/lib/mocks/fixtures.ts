/**
 * In-memory fixtures (task 1.4) — Delhi NCR demo world (AD-13).
 * Everything here is SEED data: incidents, activity, stats, teams, alerts.
 * Real weather/road data is real; these are deliberately fake + repeatable.
 */
import type {
  AssessmentStatus,
  Category,
  LifecycleStatus,
  ResponsePhase,
  Sensitivity,
  Severity,
  VerificationStatus,
} from "@/lib/constants";

export interface MockIncident {
  id: string;
  category: Category;
  location: string;
  lat: number;
  lng: number;
  severity: Severity;
  assessment_status: AssessmentStatus;
  visibility: "HIDDEN" | "PUBLIC_UNVERIFIED";
  verification: VerificationStatus;
  response_phase: ResponsePhase;
  lifecycle: LifecycleStatus;
  sensitivity: Sensitivity;
  description: string;
  reported_by: string;
  updated_at: string;
  poll?: { correct: number; incorrect: number };
}

export const mockIncidents: MockIncident[] = [
  {
    id: "INC-2026-0187",
    category: "Fire",
    location: "Lajpat Nagar",
    lat: 28.5677,
    lng: 77.2433,
    severity: "Critical",
    assessment_status: "MAYBE_TRUE",
    visibility: "PUBLIC_UNVERIFIED",
    verification: "UNVERIFIED",
    response_phase: "COORDINATING",
    lifecycle: "OPEN",
    sensitivity: "PUBLIC",
    description: "Fire reported in a market complex. Smoke visible from two blocks away.",
    reported_by: "Citizen (Anonymous)",
    updated_at: "2 min ago",
    poll: { correct: 82, incorrect: 18 },
  },
  {
    id: "INC-2026-0186",
    category: "Accident",
    location: "Noida Sec 62",
    lat: 28.6266,
    lng: 77.3648,
    severity: "Major",
    assessment_status: "MAYBE_TRUE",
    visibility: "PUBLIC_UNVERIFIED",
    verification: "VERIFIED",
    response_phase: "ACTIVE",
    lifecycle: "OPEN",
    sensitivity: "PUBLIC",
    description: "Multi-vehicle pileup on the main carriageway. Traffic held both sides.",
    reported_by: "Citizen (Anonymous)",
    updated_at: "8 min ago",
    poll: { correct: 91, incorrect: 9 },
  },
  {
    id: "INC-2026-0185",
    category: "Flood/Waterlogging",
    location: "Gurgaon",
    lat: 28.4595,
    lng: 77.0266,
    severity: "Moderate",
    assessment_status: "MAYBE_TRUE",
    visibility: "PUBLIC_UNVERIFIED",
    verification: "VERIFIED",
    response_phase: "ACTIVE",
    lifecycle: "OPEN",
    sensitivity: "PUBLIC",
    description: "Underpass waterlogged after overnight rain. Two lanes impassable.",
    reported_by: "Citizen (Anonymous)",
    updated_at: "12 min ago",
    poll: { correct: 76, incorrect: 24 },
  },
  {
    id: "INC-2026-0184",
    category: "Structural collapse",
    location: "Dwarka, New Delhi",
    lat: 28.5921,
    lng: 77.046,
    severity: "Critical",
    assessment_status: "MAYBE_TRUE",
    visibility: "PUBLIC_UNVERIFIED",
    verification: "VERIFIED",
    response_phase: "ACTIVE",
    lifecycle: "OPEN",
    sensitivity: "PUBLIC",
    description:
      "A part of the under-construction building has collapsed. Multiple people might be trapped. Heavy dust and debris.",
    reported_by: "Citizen (Anonymous)",
    updated_at: "18 min ago",
    poll: { correct: 82, incorrect: 18 },
  },
  {
    id: "INC-2026-0183",
    category: "Utility outage",
    location: "Mayur Vihar",
    lat: 28.6086,
    lng: 77.2965,
    severity: "High",
    assessment_status: "MAYBE_TRUE",
    visibility: "PUBLIC_UNVERIFIED",
    verification: "UNVERIFIED",
    response_phase: "NONE",
    lifecycle: "OPEN",
    sensitivity: "PUBLIC",
    description: "Power outage affecting 4 blocks. Feeders reportedly tripped.",
    reported_by: "Citizen (Anonymous)",
    updated_at: "25 min ago",
  },
  {
    id: "INC-2026-0182",
    category: "Medical emergency",
    location: "Rohini",
    lat: 28.7495,
    lng: 77.0565,
    severity: "Major",
    assessment_status: "MAYBE_TRUE",
    visibility: "PUBLIC_UNVERIFIED",
    verification: "VERIFIED",
    response_phase: "ACTIVE",
    lifecycle: "OPEN",
    sensitivity: "PUBLIC",
    description: "Road accident with injuries. Ambulance dispatched.",
    reported_by: "Citizen (Anonymous)",
    updated_at: "1 hr ago",
  },
  {
    id: "INC-2026-0181",
    category: "Hazard/Other",
    location: "South Delhi",
    lat: 28.535,
    lng: 77.2245,
    severity: "Minor",
    assessment_status: "MAYBE_TRUE",
    visibility: "PUBLIC_UNVERIFIED",
    verification: "VERIFIED",
    response_phase: "RESOLVED",
    lifecycle: "OPEN",
    sensitivity: "PUBLIC",
    description: "Tree fall blocking one lane. Clearance crew on site.",
    reported_by: "Citizen (Anonymous)",
    updated_at: "1 hr ago",
  },
  {
    id: "INC-2026-0180",
    category: "Crime/Safety",
    location: "Karol Bagh",
    lat: 28.6519,
    lng: 77.1909,
    severity: "High",
    assessment_status: "DEFINITELY_FALSE",
    visibility: "HIDDEN",
    verification: "REJECTED",
    response_phase: "NONE",
    lifecycle: "CLOSED",
    sensitivity: "RESTRICTED",
    description: "Report assessed as definitely false — withheld from public map.",
    reported_by: "Citizen (Anonymous)",
    updated_at: "3 hr ago",
  },
  {
    id: "INC-2026-0179",
    category: "Fire",
    location: "Faridabad",
    lat: 28.4089,
    lng: 77.3178,
    severity: "Moderate",
    assessment_status: "MAYBE_TRUE",
    visibility: "PUBLIC_UNVERIFIED",
    verification: "UNVERIFIED",
    response_phase: "COORDINATING",
    lifecycle: "OPEN",
    sensitivity: "PUBLIC",
    description: "Warehouse fire. Fire & Rescue units en route.",
    reported_by: "Citizen (Anonymous)",
    updated_at: "3 hr ago",
  },
  {
    id: "INC-2026-0178",
    category: "Accident",
    location: "Ghaziabad",
    lat: 28.6692,
    lng: 77.4538,
    severity: "Minor",
    assessment_status: "MAYBE_TRUE",
    visibility: "PUBLIC_UNVERIFIED",
    verification: "VERIFIED",
    response_phase: "RESOLVED",
    lifecycle: "OPEN",
    sensitivity: "PUBLIC",
    description: "Minor two-wheeler collision. No injuries reported.",
    reported_by: "Citizen (Anonymous)",
    updated_at: "4 hr ago",
  },
  {
    id: "INC-2026-0177",
    category: "Water & Drainage" as Category,
    location: "Yamuna Floodplain",
    lat: 28.65,
    lng: 77.24,
    severity: "Major",
    assessment_status: "MAYBE_TRUE",
    visibility: "PUBLIC_UNVERIFIED",
    verification: "UNVERIFIED",
    response_phase: "COORDINATING",
    lifecycle: "OPEN",
    sensitivity: "PUBLIC",
    description: "Rising water levels near the floodplain. Monitoring underway.",
    reported_by: "Citizen (Anonymous)",
    updated_at: "5 hr ago",
  },
  {
    id: "INC-2026-0176",
    category: "Utility outage",
    location: "Noida Sec 18",
    lat: 28.5776,
    lng: 77.3211,
    severity: "Moderate",
    assessment_status: "MAYBE_TRUE",
    visibility: "PUBLIC_UNVERIFIED",
    verification: "VERIFIED",
    response_phase: "ACTIVE",
    lifecycle: "OPEN",
    sensitivity: "PUBLIC",
    description: "Electricity outage in the commercial sector. Repair crew assigned.",
    reported_by: "Citizen (Anonymous)",
    updated_at: "6 hr ago",
  },
];

export const mockStats = {
  active_incidents: 24,
  under_verification: 8,
  in_response: 12,
  resolved_today: 6,
  deltas: { active: 3, verification: 2, response: 5, resolved: "+100%" },
};

export const mockActivity = [
  { id: "a1", text: "Fire reported — Lajpat Nagar", time: "2 min ago", tone: "critical" },
  { id: "a2", text: "Team T-3 dispatched", time: "5 min ago", tone: "info" },
  { id: "a3", text: "Incident verified by officer", time: "12 min ago", tone: "verified" },
  { id: "a4", text: "Road accident — Noida Sec 62", time: "18 min ago", tone: "high" },
  { id: "a5", text: "Marked as false report", time: "25 min ago", tone: "false" },
];

export const mockTeams = [
  { id: "T-1", name: "Fire Unit", status: "Available", members: "2/2" },
  { id: "T-2", name: "Medical Unit", status: "On Task", members: "1/2" },
  { id: "T-3", name: "Rescue Unit", status: "En Route", members: "2/3" },
  { id: "T-4", name: "Support Unit", status: "On Site", members: "3/3" },
];

export const mockTasks = [
  { id: "INC-2026-0186", title: "Road Accident — Noida Sec 62", status: "En Route", eta: "ETA: 12 min", tone: "info" },
  { id: "INC-2026-0181", title: "Medical Emergency — Rohini", status: "Moderate", eta: "ETA: 25 min", tone: "moderate" },
  { id: "INC-2026-0178", title: "Fire — Karol Bagh", status: "Queued", eta: "ETA: 40 min", tone: "neutral" },
];

export const mockAlerts = [
  { id: "AL-01", event: "Severe weather warning", severity: "High", area: "Delhi NCR", onset: "Today 14:00" },
  { id: "AL-02", event: "Waterlogging advisory", severity: "Moderate", area: "Gurgaon", onset: "Today 09:30" },
];

export const mockTimeline = [
  { id: "e1", text: "Report submitted", time: "10:30 PM", tone: "neutral" },
  { id: "e2", text: "AI marked as plausible", time: "10:44 PM", tone: "info" },
  { id: "e3", text: "Verified by officer", time: "10:52 PM", tone: "verified" },
  { id: "e4", text: "Response team dispatched", time: "10:55 PM", tone: "info" },
  { id: "e5", text: "Team on site", time: "11:01 PM", tone: "high" },
  { id: "e6", text: "Rescue in progress", time: "11:05 PM", tone: "critical" },
];
