import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Select } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "Select",
  component: Select,
  tags: ["autodocs"],
  argTypes: argTypesFor("Select"),
  args: { label: "Environment", placeholder: "Choose", size: "md" },
  parameters: { docs: { description: { component: `A single-value select with its label, description and error, in the shape of TextField. Options are Select.Item; Select.Group and Select.Label section them. ${classNameAllow("Select")}` } } },
  render: (args) => (
    <div style={{ width: "18rem" }}>
      <Select {...args}>
        <Select.Group>
          <Select.Label>Deployed</Select.Label>
          <Select.Item value="production">Production</Select.Item>
          <Select.Item value="staging">Staging</Select.Item>
        </Select.Group>
        <Select.Separator />
        <Select.Item value="local">Local</Select.Item>
        <Select.Item value="archived" disabled>
          Archived
        </Select.Item>
      </Select>
    </div>
  ),
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = { args: { defaultValue: "staging", description: "Where the next deploy goes." } };

export const Invalid: Story = { args: { error: "Pick an environment before deploying.", required: true } };

export const Disabled: Story = { args: { disabled: true, defaultValue: "production" } };

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-4)", width: "18rem" }}>
      {values("Select", "size").map((size) => (
        <Select key={size} {...args} size={size as never} label={`Size ${size}`}>
          <Select.Item value="one">One</Select.Item>
          <Select.Item value="two">Two</Select.Item>
        </Select>
      ))}
    </div>
  ),
};

/** Opening from the keyboard and choosing an option updates the trigger. */
export const ChoosesAnOption: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("combobox", { name: "Environment" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const listbox = within(document.body).getByRole("listbox");
    await userEvent.click(within(listbox).getByRole("option", { name: "Staging" }));
    await expect(trigger).toHaveTextContent("Staging");
  },
};
