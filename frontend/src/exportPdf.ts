import jsPDF from "jspdf";
import type { Profile, AlertList, DailyIngestionStats, Organization } from "./api";

const MARGIN = 20;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

interface ReportData {
  org: Organization;
  profile: Profile;
  alerts: AlertList;
  ingestionStats: DailyIngestionStats[] | null;
  cyberRiskSummary: string | null;
}

export function exportReport(data: ReportData) {
  const { org, profile, alerts, ingestionStats, cyberRiskSummary } = data;
  const doc = new jsPDF();
  let y = MARGIN;

  const addPage = () => {
    doc.addPage();
    y = MARGIN;
  };

  const checkSpace = (needed: number) => {
    if (y + needed > 280) addPage();
  };

  // --- Title page ---
  y = 60;
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Dark Web Monitoring Report", MARGIN, y);
  y += 12;
  doc.setFontSize(18);
  doc.setFont("helvetica", "normal");
  doc.text(org.name, MARGIN, y);
  y += 8;
  if (org.domain) {
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(org.domain, MARGIN, y);
    y += 6;
  }
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, MARGIN, y);
  doc.setTextColor(0);

  // --- Executive Summary ---
  addPage();
  y = sectionHeading(doc, "Executive Summary", y);
  y = wrappedText(doc, profile.summary, MARGIN, y, CONTENT_WIDTH, 10);
  y += 8;

  // --- Ingestion Summary ---
  if (ingestionStats && ingestionStats.length > 0) {
    checkSpace(40);
    y = sectionHeading(doc, "Intelligence Collection Summary", y);
    const totalDw = ingestionStats.reduce((s, d) => s + d.darkweb_total, 0);
    const totalCr = ingestionStats.reduce((s, d) => s + d.cyber_risk_total, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Period: ${ingestionStats.length} days`, MARGIN, y); y += 5;
    doc.text(`Dark Web references: ${totalDw.toLocaleString()}`, MARGIN, y); y += 5;
    doc.text(`OSINT references: ${totalCr.toLocaleString()}`, MARGIN, y); y += 5;
    doc.text(`Total alerts generated: ${alerts.total}`, MARGIN, y); y += 10;
  }

  // --- Cyber Risk Assessment ---
  if (cyberRiskSummary) {
    checkSpace(30);
    y = sectionHeading(doc, "OSINT Cyber Risk Assessment", y);
    // Parse markdown-ish content
    const lines = cyberRiskSummary.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { y += 3; continue; }
      checkSpace(10);
      if (trimmed.startsWith("## ")) {
        y += 4;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(trimmed.slice(3), MARGIN, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        y = wrappedText(doc, `• ${trimmed.slice(2)}`, MARGIN + 4, y, CONTENT_WIDTH - 4, 10);
        y += 1;
      } else {
        y = wrappedText(doc, trimmed, MARGIN, y, CONTENT_WIDTH, 10);
        y += 1;
      }
    }
    y += 6;
  }

  // --- Organization Profile ---
  addPage();
  y = sectionHeading(doc, "Organization Profile", y);

  const grouped: Record<string, typeof profile.entries> = {};
  for (const entry of profile.entries) {
    if (!grouped[entry.category]) grouped[entry.category] = [];
    grouped[entry.category].push(entry);
  }

  for (const [category, entries] of Object.entries(grouped)) {
    checkSpace(20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    const catLabel = category.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    doc.text(catLabel, MARGIN, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    for (const entry of entries) {
      checkSpace(12);
      const keyLabel = entry.key.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      doc.setFont("helvetica", "bold");
      doc.text(`${keyLabel}:`, MARGIN + 2, y);
      const keyWidth = doc.getTextWidth(`${keyLabel}: `);
      doc.setFont("helvetica", "normal");
      y = wrappedText(doc, entry.value, MARGIN + 2 + keyWidth, y, CONTENT_WIDTH - keyWidth - 2, 9);
      if (entry.citation_url) {
        doc.setTextColor(80, 80, 180);
        doc.setFontSize(7);
        y = wrappedText(doc, entry.citation_url, MARGIN + 4, y + 1, CONTENT_WIDTH - 4, 7);
        doc.setTextColor(0);
        doc.setFontSize(9);
      }
      y += 3;
    }
    y += 4;
  }

  // --- Alerts ---
  addPage();
  y = sectionHeading(doc, `Alerts (${alerts.total})`, y);

  const severityOrder = ["critical", "high", "medium", "low", "info"];
  const sortedAlerts = [...alerts.alerts].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  );

  for (const alert of sortedAlerts) {
    checkSpace(35);

    // Severity badge
    const sevColors: Record<string, [number, number, number]> = {
      critical: [220, 50, 50],
      high: [230, 120, 30],
      medium: [200, 170, 30],
      low: [60, 120, 220],
      info: [120, 120, 120],
    };
    const color = sevColors[alert.severity] ?? [120, 120, 120];
    doc.setFillColor(...color);
    doc.roundedRect(MARGIN, y - 3.5, 18, 5, 1, 1, "F");
    doc.setFontSize(7);
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.text(alert.severity.toUpperCase(), MARGIN + 1.5, y);
    doc.setTextColor(0);

    // Title
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(alert.title, MARGIN + 22, y);
    y += 5;

    // Date + classification
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    const dateStr = new Date(alert.detected_at ?? alert.created_at).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric"
    });
    doc.text(
      `${dateStr}  |  ${alert.relevance.replace(/_/g, " ")}  |  ${alert.classification.replace(/_/g, " ")}  |  Score: ${(alert.relevance_score * 100).toFixed(0)}%`,
      MARGIN + 2, y
    );
    doc.setTextColor(0);
    y += 5;

    // Description
    doc.setFontSize(9);
    y = wrappedText(doc, alert.description, MARGIN + 2, y, CONTENT_WIDTH - 2, 9);
    y += 3;

    // AI reasoning
    doc.setFontSize(8);
    doc.setTextColor(80);
    y = wrappedText(doc, `Analysis: ${alert.ai_reasoning}`, MARGIN + 2, y, CONTENT_WIDTH - 2, 8);
    doc.setTextColor(0);
    y += 8;
  }

  // --- Footer on all pages ---
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Recorded Future AI  •  ${org.name}  •  Page ${i} of ${pageCount}`,
      PAGE_WIDTH / 2, 290,
      { align: "center" }
    );
  }

  doc.save(`${org.name.replace(/\s+/g, "_")}_DarkWeb_Report.pdf`);
}

function sectionHeading(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(text, MARGIN, y);
  y += 2;
  doc.setDrawColor(60, 130, 246);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  return y;
}

function wrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, fontSize: number): number {
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, maxWidth);
  for (const line of lines) {
    if (y > 280) {
      doc.addPage();
      y = MARGIN;
    }
    doc.text(line, x, y);
    y += fontSize * 0.45;
  }
  return y;
}
