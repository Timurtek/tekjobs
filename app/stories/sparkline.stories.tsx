import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, Sparkline } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const up = [12, 14, 13, 17, 18, 21, 20, 24, 27, 26, 30, 33];
const down = [33, 31, 30, 26, 27, 24, 21, 20, 18, 16, 13, 12];

const meta = {
  title: "Sparkline",
  component: Sparkline,
  tags: ["autodocs"],
  argTypes: argTypesFor("Sparkline"),
  args: { values: up, tone: "primary", height: 32, area: true, "aria-label": "Active users, last 12 weeks" },
  parameters: { docs: { description: { component: `A word-sized trend line beside a number: the last thirty days of a metric, no axes. Sets data-trend to up, down or flat. ${classNameAllow("Sparkline")}` } } },
  render: (args) => (
    <div style={{ width: "8rem" }}>
      <Sparkline {...args} />
    </div>
  ),
} satisfies Meta<typeof Sparkline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Tones: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-3)", width: "8rem" }}>
      {values("Sparkline", "tone").map((tone, i) => (
        <Sparkline key={tone} {...args} tone={tone as never} values={i % 2 ? down : up} aria-label={`${tone} trend`} />
      ))}
    </div>
  ),
};

/** The shape it is made for: a metric, its change, and the line beside them. */
export const InAStatCard: Story = {
  render: () => (
    <Card padding="md" style={{ width: "16rem" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--spacing-3)" }}>
        <div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Active users</div>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-weight-semibold)", lineHeight: "var(--leading-tight)" }}>3,318</div>
        </div>
        <div style={{ width: "6rem" }}>
          <Sparkline values={up} tone="success" aria-label="Active users, last 12 weeks" />
        </div>
      </div>
    </Card>
  ),
};
