"use client";

import { Area } from "@/components/dither-kit/area";
import { AreaChart } from "@/components/dither-kit/area-chart";
import { Grid } from "@/components/dither-kit/grid";
import { Tooltip } from "@/components/dither-kit/tooltip";
import { XAxis } from "@/components/dither-kit/x-axis";
import { YAxis } from "@/components/dither-kit/y-axis";
import { formatNumber } from "@/lib/format";

export interface ChartPoint {
  /** Short label for the x axis and tooltip. */
  at: string;
  value: number;
}

/**
 * An interactive chart, as distinct from the decorative sparkline.
 *
 * `Sparkline` is Dither Kit's ornamental variant: it deliberately has no crosshair and no tooltip,
 * which is right for a card whose job is to say "this line goes up" and wrong for a chart someone
 * is trying to read a number off. Anywhere the exact value at a point matters, this is used
 * instead, and the axes and grid come with it so the shape has a scale.
 */
export function VaultChart({
  data,
  label,
  color = "green",
  decimals,
}: {
  data: ChartPoint[];
  label: string;
  color?: "green" | "blue" | "purple";
  /**
   * Decimal places for the axis and tooltip.
   *
   * A number rather than a formatter function: this is a client component rendered from a server
   * one, and functions cannot cross that boundary. Passing the precision and formatting on this
   * side keeps the prop serializable.
   */
  decimals: number;
}) {
  return (
    <AreaChart
      data={data}
      config={{ value: { label, color } }}
      className="h-full w-full"
      animate
      bloom="low"
      margins={{ left: 56, bottom: 28, top: 12, right: 12 }}
    >
      <Grid />
      <XAxis dataKey="at" />
      <YAxis tickFormatter={(value) => formatNumber(value, decimals)} />
      <Area dataKey="value" variant="gradient" />
      <Tooltip labelKey="at" valueFormatter={(value) => formatNumber(value, decimals)} />
    </AreaChart>
  );
}
