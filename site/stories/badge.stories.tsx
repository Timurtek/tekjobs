import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: argTypesFor("Badge"),
  args: { children: "In review", tone: "primary", variant: "soft", size: "md" },
  parameters: { docs: { description: { component: `Status and labels. success, warning and danger for state; primary for emphasis; neutral for labels. ${classNameAllow("Badge")}` } } },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div style={{ display: "grid", gridTemplateColumns: `auto repeat(${values("Badge", "tone").length}, auto)`, gap: "var(--spacing-3)", alignItems: "center", justifyContent: "start" }}>
      <span />
      {values("Badge", "tone").map((tone) => (
        <span key={tone} style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{tone}</span>
      ))}
      {values("Badge", "variant").map((variant) => (
        <>
          <span key={`${variant}-label`} style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>{variant}</span>
          {values("Badge", "tone").map((tone) => (
            <Badge key={`${variant}-${tone}`} {...args} variant={variant as never} tone={tone as never}>
              {tone}
            </Badge>
          ))}
        </>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-3)" }}>
      {values("Badge", "size").map((size) => (
        <Badge key={size} {...args} size={size as never}>
          {size}
        </Badge>
      ))}
    </div>
  ),
};

/** The queue statuses from the review workspace example. */
export const ReviewStatuses: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "var(--spacing-2)" }}>
      <Badge tone="primary">Pending</Badge>
      <Badge tone="success">Approved</Badge>
      <Badge tone="warning">Needs changes</Badge>
      <Badge tone="danger">Rejected</Badge>
      <Badge tone="neutral" variant="outline">Draft</Badge>
    </div>
  ),
};
