import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: argTypesFor("Button"),
  args: { children: "Approve", variant: "solid", tone: "neutral", size: "md" },
  parameters: { docs: { description: { component: `Solid for the primary action in a group, soft for secondary, ghost for tertiary, link for inline. Tone is semantic: danger for destructive actions only. ${classNameAllow("Button")}` } } },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Every variant against every tone, straight from the manifest. A missing cell is a manifest bug. */
export const Variants: Story = {
  render: (args) => (
    <div style={{ display: "grid", gridTemplateColumns: `auto repeat(${values("Button", "tone").length}, auto)`, gap: "var(--spacing-3)", alignItems: "center", justifyContent: "start" }}>
      <span />
      {values("Button", "tone").map((tone) => (
        <span key={tone} style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{tone}</span>
      ))}
      {values("Button", "variant").map((variant) => (
        <>
          <span key={`${variant}-label`} style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>{variant}</span>
          {values("Button", "tone").map((tone) => (
            <Button key={`${variant}-${tone}`} {...args} variant={variant as never} tone={tone as never}>
              {args.children}
            </Button>
          ))}
        </>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-3)" }}>
      {values("Button", "size").map((size) => (
        <Button key={size} {...args} size={size as never} tone="primary">
          {size}
        </Button>
      ))}
    </div>
  ),
};

/** The label stays in the box, invisible, so the width does not jump while loading. */
export const Loading: Story = { args: { loading: true, tone: "primary" } };

export const Disabled: Story = { args: { disabled: true, tone: "primary" } };

const Plus = () => (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

export const WithIcons: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: "var(--spacing-3)" }}>
      <Button {...args} leadingIcon={<Plus />}>New item</Button>
      <Button {...args} trailingIcon={<Plus />} variant="soft">Add</Button>
    </div>
  ),
};

/** A link that looks like a button. The styling and data attributes land on the anchor. */
export const AsLink: Story = {
  args: { asChild: true, variant: "link", tone: "primary" },
  render: (args) => (
    <Button {...args}>
      <a href="#docs">Read the docs</a>
    </Button>
  ),
};
