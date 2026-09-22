import type { Meta, StoryObj } from "@storybook/react-vite";
import { BarChart } from "@/components/ui";
import { argTypesFor, classNameAllow } from "./manifest";

const PLANS = ["Free", "Starter", "Team", "Business", "Enterprise"];

const meta = {
  title: "BarChart",
  component: BarChart,
  tags: ["autodocs"],
  argTypes: argTypesFor("BarChart"),
  args: { series: [{ name: "Signups", values: [820, 410, 265, 96, 18] }], labels: PLANS, height: 220, showGrid: true, showAxis: true, "aria-label": "Signups by plan, this month" },
  parameters: { docs: { description: { component: `A bar chart for values by category. Several series draw grouped bars per label; hovering a group shows its values. Colors come from the tone tokens. ${classNameAllow("BarChart")}` } } },
  render: (args) => (
    <div style={{ width: "40rem", maxWidth: "100%" }}>
      <BarChart {...args} />
    </div>
  ),
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Grouped: Story = {
  args: {
    series: [
      { name: "This month", values: [820, 410, 265, 96, 18] },
      { name: "Last month", values: [760, 380, 240, 88, 15], tone: "neutral" },
    ],
  },
};

export const Bare: Story = { args: { showAxis: false, showGrid: false, height: 120 } };
