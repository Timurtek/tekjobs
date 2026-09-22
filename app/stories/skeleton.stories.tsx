import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, Skeleton } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  argTypes: argTypesFor("Skeleton"),
  args: { variant: "text", lines: 1 },
  parameters: { docs: { description: { component: `A placeholder in the shape of the content that is loading. Hidden from assistive tech; announce loading on the region instead. ${classNameAllow("Skeleton")}` } } },
  render: (args) => (
    <div style={{ width: "20rem" }}>
      <Skeleton {...args} />
    </div>
  ),
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {};

export const Paragraph: Story = { args: { lines: 3 } };

export const Variants: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-4)", width: "20rem" }}>
      {values("Skeleton", "variant").map((variant) => (
        <div key={variant} style={{ display: "grid", gap: "var(--spacing-1)" }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>{variant}</span>
          <Skeleton {...args} variant={variant as never} />
        </div>
      ))}
    </div>
  ),
};

/** A card while its content loads: the same shapes it will have, so nothing jumps. */
export const LoadingCard: Story = {
  render: () => (
    <Card padding="md" style={{ width: "20rem" }} aria-busy="true" aria-label="Loading review">
      <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-3)", marginBottom: "var(--spacing-4)" }}>
        <Skeleton variant="circle" width="2.5rem" height="2.5rem" />
        <div style={{ flex: 1 }}>
          <Skeleton width="60%" />
        </div>
      </div>
      <Skeleton lines={3} />
    </Card>
  ),
};
