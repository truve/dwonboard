import jsPDF from "jspdf";
import type { Profile, AlertList, DailyIngestionStats, Organization } from "./api";

const MARGIN = 20;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ReportData {
  org: Organization;
  profile: Profile;
  alerts: AlertList;
  ingestionStats: DailyIngestionStats[] | null;
  cyberRiskSummary: string | null;
  intelCard: any | null;
}

async function loadImageAsDataUrl(url: string, invert = false): Promise<string | null> {
  try {
    // Use Image element with crossOrigin to handle CORS (works for Clearbit, Google favicons)
    const dataUrl = await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        if (invert) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imageData.data;
          for (let i = 0; i < d.length; i += 4) {
            d[i] = 255 - d[i];
            d[i + 1] = 255 - d[i + 1];
            d[i + 2] = 255 - d[i + 2];
          }
          ctx.putImageData(imageData, 0, 0);
        }

        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
    return dataUrl;
  } catch {
    return null;
  }
}

export async function exportReport(data: ReportData) {
  const { org, profile, alerts, ingestionStats, cyberRiskSummary } = data;
  const doc = new jsPDF();
  let y = MARGIN;

  // Load logos in parallel
  const [rfLogoDataUrl, orgLogoDataUrl] = await Promise.all([
    loadImageAsDataUrl("/RFAIlogo.svg", false),
    org.logo_url ? loadImageAsDataUrl(`/api/v1/organizations/${org.id}/logo`) : Promise.resolve(null),
  ]);

  const addPage = () => {
    doc.addPage();
    y = MARGIN;
  };

  const checkSpace = (needed: number) => {
    if (y + needed > 280) addPage();
  };

  // --- Title page ---
  y = MARGIN;

  // RF AI logo at top of title page
  if (rfLogoDataUrl) {
    // Original is 1446x243 — render at ~60mm wide
    // SVG original: 311.56 x 34.21 — keep aspect ratio
    const rfLogoW = 60;
    const rfLogoH = rfLogoW * (34.21 / 311.56);
    doc.addImage(rfLogoDataUrl, "PNG", MARGIN, y, rfLogoW, rfLogoH);
    y += rfLogoH + 10;
  }

  y = Math.max(y, 50);

  // Row: org logo (left) | title + name (center-left) | risk gauge (right)
  const rowTop = y;
  const hasLogo = !!orgLogoDataUrl;
  const textX = hasLogo ? MARGIN + 32 : MARGIN;

  // Organization logo
  if (orgLogoDataUrl) {
    try {
      doc.addImage(orgLogoDataUrl, "PNG", MARGIN, rowTop, 25, 25);
    } catch { /* skip if format unsupported */ }
  }

  // Risk score gauge on the right
  const intelItem = data.intelCard?.result?.items?.[0] ?? data.intelCard?.items?.[0];
  const titleRiskScore = intelItem?.stats?.metrics?.riskScore;
  if (titleRiskScore != null) {
    drawRiskScoreGauge(doc, titleRiskScore, PAGE_WIDTH - MARGIN - 10, rowTop + 12, 10);
  }

  // Title text
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Dark Web Monitoring Report", textX, rowTop + 10);
  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.text(org.name, textX, rowTop + 20);

  y = rowTop + 30;

  if (org.domain) {
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(org.domain, textX, y);
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

    // --- Bar chart ---
    y = drawIngestionChart(doc, ingestionStats, y, checkSpace);
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

  // --- Intelligence Card ---
  if (data.intelCard) {
    y = drawIntelCard(doc, data.intelCard, y, checkSpace, addPage);
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

function drawIngestionChart(
  doc: jsPDF,
  stats: DailyIngestionStats[],
  startY: number,
  checkSpace: (n: number) => void,
): number {
  const sorted = [...stats].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const CHART_H = 70;
  const CHART_W = CONTENT_WIDTH - 20; // leave room for Y axis labels
  const AXIS_W = 20; // width for Y axis labels
  const BAR_GAP = 1;

  // Ensure chart fits on page
  checkSpace(CHART_H + 25);

  let y = startY;

  // Compute scale
  const rawMax = Math.max(...sorted.map((s) => Math.max(s.darkweb_total, s.cyber_risk_total)), 1);
  const step = niceStep(rawMax, 4);
  const maxVal = Math.ceil(rawMax / step) * step || 1;

  const chartLeft = MARGIN + AXIS_W;
  const chartTop = y;
  const chartBottom = y + CHART_H;

  // Y axis ticks & grid lines
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  const tickCount = Math.round(maxVal / step);
  for (let i = 0; i <= tickCount; i++) {
    const val = i * step;
    const tickY = chartBottom - (val / maxVal) * CHART_H;
    // label
    doc.setTextColor(120);
    const label = val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : String(val);
    doc.text(label, chartLeft - 2, tickY + 1, { align: "right" });
    // grid line
    if (i > 0) {
      doc.setDrawColor(230);
      doc.line(chartLeft, tickY, chartLeft + CHART_W, tickY);
    }
  }

  // Axes
  doc.setDrawColor(160);
  doc.setLineWidth(0.3);
  doc.line(chartLeft, chartTop, chartLeft, chartBottom); // Y axis
  doc.line(chartLeft, chartBottom, chartLeft + CHART_W, chartBottom); // X axis

  // Bars
  const groupWidth = CHART_W / sorted.length;
  const barWidth = (groupWidth - BAR_GAP * 2) / 2;

  const PURPLE: [number, number, number] = [167, 139, 250]; // purple-400
  const BLUE: [number, number, number] = [96, 165, 250];    // blue-400

  for (let i = 0; i < sorted.length; i++) {
    const day = sorted[i];
    const groupX = chartLeft + i * groupWidth + BAR_GAP;

    // Dark web bar
    const dwH = (day.darkweb_total / maxVal) * CHART_H;
    if (dwH > 0) {
      doc.setFillColor(...PURPLE);
      doc.rect(groupX, chartBottom - dwH, barWidth, dwH, "F");
    }

    // OSINT bar
    const crH = (day.cyber_risk_total / maxVal) * CHART_H;
    if (crH > 0) {
      doc.setFillColor(...BLUE);
      doc.rect(groupX + barWidth, chartBottom - crH, barWidth, crH, "F");
    }
  }

  y = chartBottom + 2;

  // X axis labels (show a subset to avoid crowding)
  doc.setFontSize(6);
  doc.setTextColor(120);
  const maxLabels = Math.floor(CHART_W / 15);
  const labelStep = Math.max(1, Math.ceil(sorted.length / maxLabels));
  for (let i = 0; i < sorted.length; i += labelStep) {
    const x = chartLeft + i * groupWidth + groupWidth / 2;
    const d = new Date(sorted[i].date + "T00:00:00");
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    doc.text(label, x, y + 3, { align: "center" });
  }
  y += 6;

  // Legend
  doc.setFontSize(8);
  const legendY = y + 2;
  doc.setFillColor(...PURPLE);
  doc.rect(chartLeft, legendY - 2.5, 4, 3, "F");
  doc.setTextColor(80);
  doc.text("Dark Web", chartLeft + 6, legendY);

  doc.setFillColor(...BLUE);
  doc.rect(chartLeft + 35, legendY - 2.5, 4, 3, "F");
  doc.text("OSINT", chartLeft + 41, legendY);

  doc.setTextColor(0);
  return legendY + 8;
}

function niceStep(max: number, targetTicks: number): number {
  const rough = max / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / mag;
  let nice: number;
  if (normalized <= 1.5) nice = 1;
  else if (normalized <= 3) nice = 2;
  else if (normalized <= 7) nice = 5;
  else nice = 10;
  return nice * mag || 1;
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

function drawRiskScoreGauge(doc: jsPDF, score: number, cx: number, cy: number, r: number) {
  // Background circle
  doc.setDrawColor(200);
  doc.setLineWidth(2);
  doc.circle(cx, cy, r, "S");

  // Score arc — draw as a thick colored arc
  const color = riskScoreColorRGB(score);
  doc.setDrawColor(...color);
  doc.setLineWidth(2.5);
  const arcEnd = (score / 100) * 360;
  // Approximate arc with line segments
  const steps = Math.max(Math.round(arcEnd / 5), 1);
  for (let i = 0; i < steps; i++) {
    const a1 = (-90 + (arcEnd * i) / steps) * (Math.PI / 180);
    const a2 = (-90 + (arcEnd * (i + 1)) / steps) * (Math.PI / 180);
    doc.line(
      cx + r * Math.cos(a1), cy + r * Math.sin(a1),
      cx + r * Math.cos(a2), cy + r * Math.sin(a2)
    );
  }

  // Score text
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...color);
  doc.text(String(score), cx, cy + 2, { align: "center" });
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
}

function riskScoreColorRGB(score: number): [number, number, number] {
  if (score >= 75) return [220, 50, 50];
  if (score >= 50) return [230, 120, 30];
  if (score >= 25) return [200, 170, 30];
  return [34, 197, 94];
}

function cleanEvidence(str: string): string {
  return str.replace(/<e[^>]*>/g, "").replace(/<\/e>/g, "");
}

function drawIntelCard(
  doc: jsPDF, intelCard: any, _startY: number,
  checkSpace: (n: number) => void,
  addPage: () => void
): number {
  const item = intelCard?.result?.items?.[0] ?? intelCard?.items?.[0] ?? intelCard;
  const outerStats = item?.stats ?? {};
  const metrics = outerStats?.metrics ?? {};
  const innerStats = outerStats?.stats ?? {};
  const evidenceDetails: any[] = innerStats?.evidenceDetails ?? outerStats?.evidenceDetails ?? [];
  const riskScore = metrics.riskScore;
  const riskSummary = innerStats?.riskSummary ?? outerStats?.riskSummary ?? "";

  addPage();
  let y = MARGIN;
  y = sectionHeading(doc, "Recorded Future Intelligence Card", y);

  // Risk score
  if (riskScore != null) {
    checkSpace(25);
    const color = riskScoreColorRGB(riskScore);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...color);
    doc.text(`Risk Score: ${riskScore}/100`, MARGIN, y);
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    y += 6;
    if (riskSummary) {
      doc.setFontSize(9);
      doc.text(riskSummary, MARGIN, y);
      y += 6;
    }
    y += 4;
  }

  // Key metrics
  const keyMetrics = [
    ["Dark Web Hits", metrics.darkWebHits],
    ["Underground Forum Hits", metrics.undergroundForumHits],
    ["Paste Hits", metrics.pasteHits],
    ["Cyber Attack Hits", metrics.cyberAttackHits],
    ["Social Media Hits", metrics.socialMediaHits],
    ["Total Hits", metrics.totalHits],
    ["7 Day Hits", metrics.sevenDaysHits],
    ["60 Day Hits", metrics.sixtyDaysHits],
    ["Risk Rules", `${metrics.rules} / ${metrics.maxRules}`],
  ].filter(([, v]) => v != null && v !== undefined);

  if (keyMetrics.length > 0) {
    checkSpace(20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Key Metrics", MARGIN, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    // Two-column layout
    const colWidth = CONTENT_WIDTH / 2;
    for (let i = 0; i < keyMetrics.length; i += 2) {
      checkSpace(6);
      const [label1, val1] = keyMetrics[i];
      doc.text(`${label1}: `, MARGIN, y);
      doc.setFont("helvetica", "bold");
      doc.text(String(typeof val1 === "number" ? val1.toLocaleString() : val1), MARGIN + 45, y);
      doc.setFont("helvetica", "normal");

      if (i + 1 < keyMetrics.length) {
        const [label2, val2] = keyMetrics[i + 1];
        doc.text(`${label2}: `, MARGIN + colWidth, y);
        doc.setFont("helvetica", "bold");
        doc.text(String(typeof val2 === "number" ? val2.toLocaleString() : val2), MARGIN + colWidth + 45, y);
        doc.setFont("helvetica", "normal");
      }
      y += 5;
    }
    y += 6;
  }

  // Reference Activity Chart
  const rawCounts: Record<string, number> = innerStats?.counts ?? outerStats?.counts ?? {};
  const byMonth: Record<string, number> = {};
  for (const [date, count] of Object.entries(rawCounts)) {
    const month = date.slice(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + (count as number);
  }
  const monthPoints = Object.entries(byMonth)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }));

  if (monthPoints.length >= 2) {
    const CHART_H = 55;
    const CHART_W = CONTENT_WIDTH - 20;
    const AXIS_W = 20;
    checkSpace(CHART_H + 30);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Reference Activity Over Time", MARGIN, y);
    y += 6;
    doc.setFont("helvetica", "normal");

    const chartLeft = MARGIN + AXIS_W;
    const chartTop = y;
    const chartBottom = y + CHART_H;
    const maxC = Math.max(...monthPoints.map((p) => p.count), 1);

    // Y axis
    doc.setFontSize(6);
    doc.setDrawColor(200);
    doc.setLineWidth(0.2);
    for (const tick of [0, Math.round(maxC / 2), maxC]) {
      const tickY = chartBottom - (tick / maxC) * CHART_H;
      doc.setTextColor(120);
      const label = tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : String(tick);
      doc.text(label, chartLeft - 2, tickY + 1, { align: "right" });
      doc.setDrawColor(230);
      doc.line(chartLeft, tickY, chartLeft + CHART_W, tickY);
    }

    // Axes
    doc.setDrawColor(160);
    doc.setLineWidth(0.3);
    doc.line(chartLeft, chartTop, chartLeft, chartBottom);
    doc.line(chartLeft, chartBottom, chartLeft + CHART_W, chartBottom);

    // Line + area fill
    const linePoints: [number, number][] = monthPoints.map((p, i) => [
      chartLeft + (i / (monthPoints.length - 1)) * CHART_W,
      chartBottom - (p.count / maxC) * CHART_H,
    ]);

    // Draw the line
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.8);
    for (let i = 0; i < linePoints.length - 1; i++) {
      doc.line(linePoints[i][0], linePoints[i][1], linePoints[i + 1][0], linePoints[i + 1][1]);
    }
    // Dots
    doc.setFillColor(59, 130, 246);
    for (const [px, py] of linePoints) {
      doc.circle(px, py, 0.8, "F");
    }

    y = chartBottom + 2;
    // X labels
    doc.setFontSize(5);
    doc.setTextColor(120);
    const labelStep2 = Math.max(1, Math.ceil(monthPoints.length / 8));
    for (let i = 0; i < monthPoints.length; i += labelStep2) {
      const x = chartLeft + (i / (monthPoints.length - 1)) * CHART_W;
      const [yr, mo] = monthPoints[i].month.split("-");
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      doc.text(`${months[parseInt(mo)-1]} ${yr.slice(2)}`, x, y + 3, { align: "center" });
    }
    doc.setTextColor(0);
    doc.setDrawColor(0);
    y += 10;
  }

  // Topics Pie Chart
  const rawTopics: Record<string, number> = innerStats?.topics ?? outerStats?.topics ?? {};
  const topicsSorted = Object.entries(rawTopics)
    .map(([name, count]) => ({ name, count: count as number }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);

  if (topicsSorted.length > 0) {
    checkSpace(75);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Reference Topics", MARGIN, y);
    y += 6;
    doc.setFont("helvetica", "normal");

    const top12 = topicsSorted.slice(0, 12);
    const otherCount = topicsSorted.slice(12).reduce((s, t) => s + t.count, 0);
    const slices = otherCount > 0 ? [...top12, { name: "Other", count: otherCount }] : top12;
    const totalTopics = slices.reduce((s, t) => s + t.count, 0);

    const pieColors: [number, number, number][] = [
      [59,130,246],[139,92,246],[236,72,153],[249,115,22],[234,179,8],
      [34,197,94],[6,182,212],[244,63,94],[168,85,247],[20,184,166],
      [99,102,241],[217,70,239],[132,204,22],
    ];

    const cx = MARGIN + 25;
    const cy = y + 25;
    const r = 20;

    let cumAngle = -Math.PI / 2;
    for (let i = 0; i < slices.length; i++) {
      const angle = (slices[i].count / totalTopics) * 2 * Math.PI;
      const startAngle = cumAngle;
      cumAngle += angle;

      const color = pieColors[i % pieColors.length];
      doc.setFillColor(...color);

      // Draw pie slice as triangle fan
      const steps = Math.max(Math.round((angle / (2 * Math.PI)) * 36), 1);
      for (let s = 0; s < steps; s++) {
        const a1 = startAngle + (angle * s) / steps;
        const a2 = startAngle + (angle * (s + 1)) / steps;
        const x1 = cx + r * Math.cos(a1);
        const y1v = cy + r * Math.sin(a1);
        const x2 = cx + r * Math.cos(a2);
        const y2v = cy + r * Math.sin(a2);
        // Triangle: center, point1, point2
        doc.triangle(cx, cy, x1, y1v, x2, y2v, "F");
      }
    }

    // Legend (to the right of pie)
    const legendX = MARGIN + 55;
    let legendY = y;
    doc.setFontSize(7);
    for (let i = 0; i < slices.length; i++) {
      const color = pieColors[i % pieColors.length];
      const pct = ((slices[i].count / totalTopics) * 100).toFixed(1);
      doc.setFillColor(...color);
      doc.rect(legendX, legendY - 2, 3, 3, "F");
      doc.setTextColor(60);
      doc.text(`${slices[i].name} (${pct}%)`, legendX + 5, legendY);
      legendY += 4;
    }

    doc.setTextColor(0);
    y = Math.max(cy + r + 8, legendY + 4);
  }

  // Risk Rules
  if (evidenceDetails.length > 0) {
    checkSpace(15);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Triggered Risk Rules (${evidenceDetails.length})`, MARGIN, y);
    y += 7;

    // Sort by criticality descending, then sightings descending
    const sortedRules = [...evidenceDetails].sort(
      (a: any, b: any) => (b.Criticality ?? 0) - (a.Criticality ?? 0)
        || (b.SightingsCount ?? 0) - (a.SightingsCount ?? 0)
    );

    for (const rule of sortedRules) {
      checkSpace(18);
      const critLabel = rule.CriticalityLabel ?? "Info";
      const ruleName = rule.Rule ?? rule.Name ?? "";
      const evidence = cleanEvidence(rule.EvidenceString ?? "");
      const sightings = rule.SightingsCount ?? 0;
      const timestamp = rule.Timestamp;

      // Criticality badge
      const critColor = critColorRGB(rule.Criticality ?? 0);
      doc.setFillColor(...critColor);
      const badgeWidth = doc.getTextWidth(critLabel) + 4;
      doc.roundedRect(MARGIN, y - 3.2, badgeWidth + 2, 4.5, 1, 1, "F");
      doc.setFontSize(7);
      doc.setTextColor(255);
      doc.setFont("helvetica", "bold");
      doc.text(critLabel.toUpperCase(), MARGIN + 1.5, y);
      doc.setTextColor(0);

      // Rule name
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(ruleName, MARGIN + badgeWidth + 5, y);
      doc.setFont("helvetica", "normal");
      y += 4.5;

      // Meta line
      doc.setFontSize(7);
      doc.setTextColor(100);
      const metaParts: string[] = [];
      if (sightings > 0) metaParts.push(`${sightings.toLocaleString()} sightings`);
      if (timestamp) {
        try { metaParts.push(new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })); } catch { /* */ }
      }
      if (metaParts.length > 0) {
        doc.text(metaParts.join("  |  "), MARGIN + 2, y);
        y += 3.5;
      }

      // Evidence text
      if (evidence) {
        doc.setFontSize(8);
        doc.setTextColor(80);
        y = wrappedText(doc, evidence, MARGIN + 2, y, CONTENT_WIDTH - 4, 8);
        y += 1;
      }

      doc.setTextColor(0);
      y += 3;
    }
  }

  // Recent sightings
  const sightingSource = innerStats.recentDarkWeb ? innerStats : outerStats;
  const sightings = [
    sightingSource.recentDarkWeb && { label: "Dark Web", ...sightingSource.recentDarkWeb },
    sightingSource.recentUndergroundForum && { label: "Underground Forum", ...sightingSource.recentUndergroundForum },
    sightingSource.recentSocialMedia && { label: "Social Media", ...sightingSource.recentSocialMedia },
    sightingSource.recentCyberAttack && { label: "Cyber Attack", ...sightingSource.recentCyberAttack },
    sightingSource.recentPaste && { label: "Paste Site", ...sightingSource.recentPaste },
  ].filter(Boolean) as any[];

  if (sightings.length > 0) {
    checkSpace(15);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Recent Notable Sightings", MARGIN, y);
    y += 7;

    for (const s of sightings) {
      checkSpace(15);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 130, 246);
      doc.text(s.label, MARGIN, y);
      doc.setTextColor(100);
      doc.setFont("helvetica", "normal");
      const srcName = s.source?.name ?? "";
      const dateStr = s.published ? new Date(s.published).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
      doc.text(`  ${srcName}  ${dateStr}`, MARGIN + doc.getTextWidth(s.label) + 2, y);
      y += 4;

      if (s.title) {
        doc.setFontSize(8);
        doc.setTextColor(40);
        doc.setFont("helvetica", "bold");
        y = wrappedText(doc, s.title, MARGIN + 2, y, CONTENT_WIDTH - 4, 8);
        doc.setFont("helvetica", "normal");
        y += 1;
      }
      if (s.fragment) {
        doc.setFontSize(7);
        doc.setTextColor(80);
        y = wrappedText(doc, s.fragment, MARGIN + 2, y, CONTENT_WIDTH - 4, 7);
        y += 1;
      }
      doc.setTextColor(0);
      y += 3;
    }
  }

  return y;
}

function critColorRGB(c: number): [number, number, number] {
  if (c >= 4) return [220, 50, 50];
  if (c >= 3) return [230, 120, 30];
  if (c >= 2) return [200, 170, 30];
  if (c >= 1) return [60, 120, 220];
  return [120, 120, 120];
}
