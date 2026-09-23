import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Switch } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "Switch",
  component: Switch,
  tags: ["autodocs"],
  argTypes: argTypesFor("Switch"),
  args: { label: "Email me when a review completes", size: "md" },
  parameters: { docs: { description: { component: `An on/off control with its label and description. A Switch takes effect at once; use a Checkbox when the change waits for a submit. ${classNameAllow("Switch")}` } } },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const On: Story = { args: { defaultChecked: true } };

export const WithDescription: Story = {
  args: { description: "One message per review, never more than one an hour, even when the description wraps." },
  render: (args) => (
    <div style={{ maxWidth: "20rem" }}>
      <Switch {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-3)" }}>
      <Switch {...args} disabled label="Disabled" />
      <Switch {...args} disabled defaultChecked label="Disabled, on" />
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-3)" }}>
      {values("Switch", "size").map((size) => (
        <Switch key={size} {...args} size={size as never} label={`Size ${size}`} />
      ))}
    </div>
  ),
};

/** Clicking the label toggles the control. */
export const TogglesFromLabel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByRole("switch");
    await expect(control).toHaveAttribute("data-state", "unchecked");
    await userEvent.click(canvas.getByText("Email me when a review completes"));
    await expect(control).toHaveAttribute("data-state", "checked");
  },
};
