import type { Meta, StoryObj } from "@storybook/react-vite";
import { Progress } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "Progress",
  component: Progress,
  tags: ["autodocs"],
  argTypes: argTypesFor("Progress"),
  args: { value: 62, max: 100, label: "Storage", showValue: true, size: "md", tone: "primary" },
  parameters: { docs: { description: { component: `A bar for quota, upload, or a task with an end. Indeterminate when no value is known. ${classNameAllow("Progress")}` } } },
  render: (args) => (
    <div style={{ width: "20rem" }}>
      <Progress {...args} />
    </div>
  ),
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Indeterminate: Story = { args: { value: undefined, label: "Importing", showValue: false } };

export const Tones: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-4)", width: "20rem" }}>
      {values("Progress", "tone").map((tone, i) => (
        <Progress key={tone} {...args} tone={tone as never} label={tone} value={20 + i * 18} />
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-4)", width: "20rem" }}>
      {values("Progress", "size").map((size) => (
        <Progress key={size} {...args} size={size as never} label={`Size ${size}`} />
      ))}
    </div>
  ),
};
