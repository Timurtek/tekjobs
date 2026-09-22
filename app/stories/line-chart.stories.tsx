import type { Meta, StoryObj } from "@storybook/react-vite";
import { LineChart } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const DAYS = Array.from({ length: 30 }, (_, i) => `Aug ${i + 1}`);
const revenue = DAYS.map((_, i) => 12000 + i * 420 + Math.round(Math.sin(i / 3) * 1800));
const refunds = DAYS.map((_, i) => 900 + Math.round(Math.cos(i / 4) * 400) + (i % 7 === 0 ? 600 : 0));

const meta = {
  title: "LineChart",
  component: LineChart,
  tags: ["autodocs"],
  argTypes: argTypesFor("LineChart"),
  args: { series: [{ name: "Revenue", values: revenue }], labels: DAYS, height: 220, area: true, curve: "smooth", showGrid: true, showAxis: true, "aria-label": "Revenue, last 30 days" },
  parameters: { docs: { description: { component: `A line chart for values over an ordered axis. Series share one y axis; hovering shows every series' value at the nearest point. Colors come from the tone tokens. ${classNameAllow("LineChart")}` } } },
  render: (args) => (
    <div style={{ width: "40rem", maxWidth: "100%" }}>
      <LineChart {...args} />
    </div>
  ),
} satisfies Meta<typeof LineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Area: Story = {};

export const TwoSeries: Story = {
  args: { series: [{ name: "Revenue", values: revenue }, { name: "Refunds", values: refunds, tone: "danger" }], area: false },
};

export const Curves: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-6)", width: "40rem", maxWidth: "100%" }}>
      {values("LineChart", "curve").map((curve) => (
        <LineChart key={curve} {...args} curve={curve as never} height={140} aria-label={`Revenue, ${curve}`} />
      ))}
    </div>
  ),
};

export const Bare: Story = { args: { showAxis: false, showGrid: false, height: 120 } };
