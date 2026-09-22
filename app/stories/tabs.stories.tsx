import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Badge, Tabs } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "Tabs",
  component: Tabs,
  tags: ["autodocs"],
  argTypes: argTypesFor("Tabs"),
  args: { variant: "line", size: "md", defaultValue: "mcp" },
  parameters: { docs: { description: { component: `Tabs switch between panels of related content. The root carries variant and size; Tabs.List, Tabs.Trigger and Tabs.Content are the parts. Arrow keys move between tabs. ${classNameAllow("Tabs")}` } } },
  render: (args) => (
    <Tabs {...args}>
      <Tabs.List aria-label="Surfaces">
        <Tabs.Trigger value="mcp">MCP server</Tabs.Trigger>
        <Tabs.Trigger value="hook">Hook</Tabs.Trigger>
        <Tabs.Trigger value="cli">
          CLI <Badge size="sm">CI</Badge>
        </Tabs.Trigger>
        <Tabs.Trigger value="rollup" disabled>
          Rollup
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="mcp">Tools the agent calls before and after it writes: check code, list violations, describe the system.</Tabs.Content>
      <Tabs.Content value="hook">Runs after every edit the agent makes. A violation with a fix blocks the edit and hands the fix back.</Tabs.Content>
      <Tabs.Content value="cli">The same engine in a terminal and in CI, with GitHub annotations on the lines that drifted.</Tabs.Content>
      <Tabs.Content value="rollup">Drift and adoption across every repository that consumes the system.</Tabs.Content>
    </Tabs>
  ),
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Line: Story = {};

export const Pill: Story = { args: { variant: "pill" } };

export const Variants: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-6)" }}>
      {values("Tabs", "variant").map((variant) =>
        values("Tabs", "size").map((size) => (
          <Tabs key={`${variant}-${size}`} {...args} variant={variant as never} size={size as never}>
            <Tabs.List aria-label={`${variant} ${size}`}>
              <Tabs.Trigger value="mcp">MCP</Tabs.Trigger>
              <Tabs.Trigger value="hook">Hook</Tabs.Trigger>
              <Tabs.Trigger value="cli">CLI</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="mcp">
              {variant}, {size}
            </Tabs.Content>
            <Tabs.Content value="hook">Hook panel</Tabs.Content>
            <Tabs.Content value="cli">CLI panel</Tabs.Content>
          </Tabs>
        )),
      )}
    </div>
  ),
};

/** Clicking a tab shows its panel; the arrow keys move focus and selection along the list. */
export const SwitchesWithKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: "Hook" }));
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent("Runs after every edit");
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("tab", { name: /CLI/ })).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent("GitHub annotations");
  },
};
