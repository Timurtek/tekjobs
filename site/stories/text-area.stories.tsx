import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextArea } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "TextArea",
  component: TextArea,
  tags: ["autodocs"],
  argTypes: argTypesFor("TextArea"),
  args: { label: "Reason", placeholder: "What should the author change?", size: "md", resize: "vertical", rows: 3 },
  parameters: { docs: { description: { component: `A multi-line text field with its label, description and error, in the shape of TextField. ${classNameAllow("TextArea")}` } } },
  render: (args) => (
    <div style={{ width: "24rem" }}>
      <TextArea {...args} />
    </div>
  ),
} satisfies Meta<typeof TextArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = { args: { description: "The author sees this with the rejection." } };

export const Invalid: Story = { args: { error: "A reason is required to reject.", required: true } };

export const Disabled: Story = { args: { disabled: true, defaultValue: "Locked while the review is closed." } };

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-4)", width: "24rem" }}>
      {values("TextArea", "size").map((size) => (
        <TextArea key={size} {...args} size={size as never} label={`Size ${size}`} rows={2} />
      ))}
    </div>
  ),
};

export const Resize: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-4)", width: "24rem" }}>
      {values("TextArea", "resize").map((resize) => (
        <TextArea key={resize} {...args} resize={resize as never} label={`Resize ${resize}`} rows={2} />
      ))}
    </div>
  ),
};
