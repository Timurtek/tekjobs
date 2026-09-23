import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const PHOTO =
  "data:image/svg+xml," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0E7C6B"/><circle cx="32" cy="24" r="12" fill="#D3F2EA"/><path d="M8 64c2-16 12-22 24-22s22 6 24 22z" fill="#D3F2EA"/></svg>');

const meta = {
  title: "Avatar",
  component: Avatar,
  tags: ["autodocs"],
  argTypes: argTypesFor("Avatar"),
  args: { name: "Ada Lovelace", size: "md", shape: "circle" },
  parameters: { docs: { description: { component: `A picture of a person, a team or a workspace, with initials as the fallback. ${classNameAllow("Avatar")}` } } },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Initials: Story = {};

export const WithImage: Story = { args: { src: PHOTO } };

export const Square: Story = { args: { shape: "square", name: "Acme" } };

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-3)" }}>
      {values("Avatar", "size").map((size) => (
        <Avatar key={size} {...args} size={size as never} />
      ))}
      {values("Avatar", "size").map((size) => (
        <Avatar key={`img-${size}`} {...args} size={size as never} src={PHOTO} />
      ))}
    </div>
  ),
};
