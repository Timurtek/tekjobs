import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Checkbox } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  argTypes: argTypesFor("Checkbox"),
  args: { label: "Notify the author", size: "md" },
  parameters: { docs: { description: { component: `A checkbox with its label and description. The box centres on the first line of the label however it wraps. Supports checked="indeterminate". ${classNameAllow("Checkbox")}` } } },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: { description: "Sends an email when the review is complete, even when the description wraps to a second line and the box must stay on the first." },
  render: (args) => (
    <div style={{ maxWidth: "20rem" }}>
      <Checkbox {...args} />
    </div>
  ),
};

export const Checked: Story = { args: { defaultChecked: true, label: "Checked" } };

export const Indeterminate: Story = { args: { checked: "indeterminate", label: "Some selected" } };

export const Disabled: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-3)" }}>
      <Checkbox {...args} disabled label="Disabled" />
      <Checkbox {...args} disabled defaultChecked label="Disabled, checked" />
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-3)" }}>
      {values("Checkbox", "size").map((size) => (
        <Checkbox key={size} {...args} size={size as never} label={`Size ${size}`} />
      ))}
    </div>
  ),
};

/** Clicking the label toggles the control, and the check draws in. */
export const TogglesFromLabel: Story = {
  args: { label: "Accept the terms" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const box = canvas.getByRole("checkbox", { name: "Accept the terms" });
    await expect(box).toHaveAttribute("data-state", "unchecked");
    await userEvent.click(canvas.getByText("Accept the terms"));
    await expect(box).toHaveAttribute("data-state", "checked");
  },
};
