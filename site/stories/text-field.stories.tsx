import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextField } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "TextField",
  component: TextField,
  tags: ["autodocs"],
  argTypes: argTypesFor("TextField"),
  args: { label: "Email", placeholder: "you@company.com", size: "md" },
  parameters: { docs: { description: { component: `Label, input, description and error, wired together with ids so assistive technology reads them as one field. The presence of an error marks the field invalid. ${classNameAllow("TextField")}` } } },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = { args: { description: "We only use this for receipts." } };

/** role="alert" on the message, aria-invalid on the input, danger border and focus ring. */
export const Invalid: Story = { args: { label: "Amount", defaultValue: "-40", error: "Amount must be positive." } };

export const Required: Story = { args: { required: true, description: "Required fields are marked." } };

export const Disabled: Story = { args: { disabled: true, defaultValue: "Read me" } };

export const ReadOnly: Story = { args: { readOnly: true, defaultValue: "ZN-2041", description: "Assigned by the system." } };

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-4)", maxWidth: "20rem" }}>
      {values("TextField", "size").map((size) => (
        <TextField key={size} {...args} size={size as never} label={`Size ${size}`} />
      ))}
    </div>
  ),
};

const Search = () => (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const WithIcons: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-4)", maxWidth: "20rem" }}>
      <TextField {...args} label="Search" placeholder="Title, author or id" leadingIcon={<Search />} />
      <TextField {...args} label="Website" placeholder="example.com" trailingIcon={<Search />} />
    </div>
  ),
};
