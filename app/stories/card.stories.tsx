import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge, Button, Card } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "Card",
  component: Card,
  tags: ["autodocs"],
  argTypes: argTypesFor("Card"),
  args: { variant: "outlined", padding: "md" },
  parameters: { docs: { description: { component: `A surface. With Header, Body and Footer parts the padding applies per part; without them it applies to the card. ${classNameAllow("Card")}` } } },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Card {...args} style={{ maxWidth: "28rem" }}>
      <Card.Header>
        <span style={{ flex: 1 }}>Checkout: replace hardcoded brand blue</span>
        <Badge tone="primary">Pending</Badge>
      </Card.Header>
      <Card.Body>Swaps eleven literals for the token so the checkout follows the theme. No visual change in the default theme.</Card.Body>
      <Card.Footer>
        <Button variant="ghost" tone="danger" size="sm">Reject</Button>
        <Button tone="primary" size="sm">Approve</Button>
      </Card.Footer>
    </Card>
  ),
};

export const Variants: Story = {
  render: (args) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 14rem)", gap: "var(--spacing-4)" }}>
      {values("Card", "variant").map((variant) => (
        <Card key={variant} {...args} variant={variant as never}>
          <strong>{variant}</strong>
          <p style={{ margin: "var(--spacing-2) 0 0", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>Padding on the card itself, no parts.</p>
        </Card>
      ))}
    </div>
  ),
};

export const PaddingScale: Story = {
  render: (args) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 10rem)", gap: "var(--spacing-4)" }}>
      {values("Card", "padding").map((padding) => (
        <Card key={padding} {...args} padding={padding as never}>
          padding=&quot;{padding}&quot;
        </Card>
      ))}
    </div>
  ),
};

/** Lifts on hover and takes focus. The consumer gives it a role and a tab stop. */
export const Interactive: Story = {
  args: { interactive: true, variant: "elevated" },
  render: (args) => (
    <Card {...args} role="button" tabIndex={0} style={{ maxWidth: "20rem" }}>
      <strong>Open the queue</strong>
      <p style={{ margin: "var(--spacing-2) 0 0", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>Hover, then Tab to it.</p>
    </Card>
  ),
};
