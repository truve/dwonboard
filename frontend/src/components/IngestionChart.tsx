import type { DailyIngestionStats } from "../api";

interface Props {
  stats: DailyIngestionStats[];
}

export default function IngestionChart({ stats }: Props) {
  // Show oldest-to-newest (stats come newest-first from the API)
  const sorted = [...stats].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const rawMax = Math.max(
    ...sorted.map((s) => Math.max(s.darkweb_total, s.cyber_risk_total)),
    1
  );
  const ticks = yTicks(rawMax);
  const maxValue = ticks[0] || rawMax;

  const totals = sorted.reduce(
    (acc, s) => ({
      dwTotal: acc.dwTotal + s.darkweb_total,
      crTotal: acc.crTotal + s.cyber_risk_total,
    }),
    { dwTotal: 0, crTotal: 0 }
  );

  return (
    <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          References (Last {sorted.length} Days)
        </h3>
        <div className="flex items-center gap-5 text-xs flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-purple-400" />
            <span className="text-gray-300">
              Dark Web ({totals.dwTotal.toLocaleString()})
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-blue-400" />
            <span className="text-gray-300">
              OSINT ({totals.crTotal.toLocaleString()})
            </span>
          </span>
        </div>
      </div>

      {/* Bar chart with Y axis */}
      <div className="flex" style={{ height: 220 }}>
        {/* Y axis */}
        <div className="flex flex-col justify-between items-end pr-2 pb-5" style={{ width: 40 }}>
          {ticks.map((tick) => (
            <span key={tick} className="text-[10px] text-gray-400 font-mono leading-none">
              {formatTick(tick)}
            </span>
          ))}
        </div>

        {/* Chart area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-end gap-1.5 border-l border-b border-gray-600/50 relative">
            {/* Horizontal grid lines */}
            {ticks.slice(1).map((tick) => (
              <div
                key={tick}
                className="absolute left-0 right-0 border-t border-gray-700/50"
                style={{ bottom: `${(tick / maxValue) * 100}%` }}
              />
            ))}

            {sorted.map((day) => {
              const dwPct = (day.darkweb_total / maxValue) * 100;
              const crPct = (day.cyber_risk_total / maxValue) * 100;

              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center group relative z-10"
                  style={{ height: "100%" }}
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block z-20">
                    <div className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-xl">
                      <p className="text-white font-medium mb-1.5">{day.date}</p>
                      <p className="text-purple-300">
                        Dark Web: {day.darkweb_total.toLocaleString()}
                      </p>
                      <p className="text-blue-300">
                        OSINT: {day.cyber_risk_total.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Bars — 2 bars per day */}
                  <div className="w-full h-full flex items-end justify-center gap-0.5">
                    <div
                      className="w-2/5 bg-purple-400 rounded-t transition-all"
                      style={{ height: `${dwPct}%`, minHeight: dwPct > 0 ? 2 : 0 }}
                    />
                    <div
                      className="w-2/5 bg-blue-400 rounded-t transition-all"
                      style={{ height: `${crPct}%`, minHeight: crPct > 0 ? 2 : 0 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* X axis date labels */}
          <div className="flex gap-1.5 pt-1" style={{ marginLeft: 0 }}>
            {sorted.map((day) => (
              <div key={day.date} className="flex-1 text-center">
                <span className="text-[10px] text-gray-400 leading-none">
                  {formatDateLabel(day.date)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function yTicks(max: number): number[] {
  const step = niceStep(max, 4);
  const ticks: number[] = [];
  for (let v = Math.ceil(max / step) * step; v >= 0; v -= step) {
    ticks.push(v);
  }
  if (ticks[ticks.length - 1] !== 0) ticks.push(0);
  return ticks;
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

function formatTick(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}
