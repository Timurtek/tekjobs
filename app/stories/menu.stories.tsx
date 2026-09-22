import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { useState } from "react";
import { Button, Menu } from "@/components/ui";
import { argTypesFor, classNameAllow } from "./manifest";

const meta = {
  title: "Menu",
  component: Menu,
  tags: ["autodocs"],
  argTypes: argTypesFor("Menu"),
  args: { modal: true },
  parameters: { docs: { description: { component: `A dropdown menu of actions behind a trigger: row actions, the account menu, a "more" button. Parts: Trigger, Content, Item, CheckboxItem, RadioGroup, RadioItem, Label, Separator, Group. ${classNameAllow("Menu")}` } } },
  render: (args) => (
    <Menu {...args}>
      <Menu.Trigger asChild>
        <Button variant="soft">Actions</Button>
      </Menu.Trigger>
      <Menu.Content align="start">
        <Menu.Label>Review #418</Menu.Label>
        <Menu.Item shortcut="E">Edit</Menu.Item>
        <Menu.Item shortcut="D">Duplicate</Menu.Item>
        <Menu.Separator />
        <Menu.Item tone="danger">Delete</Menu.Item>
      </Menu.Content>
    </Menu>
  ),
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

function Preferences() {
  const [compact, setCompact] = useState(false);
  const [sort, setSort] = useState("updated");
  return (
    <Menu>
      <Menu.Trigger asChild>
        <Button variant="soft">View</Button>
      </Menu.Trigger>
      <Menu.Content align="start">
        <Menu.CheckboxItem checked={compact} onCheckedChange={(v) => setCompact(v === true)}>
          Compact rows
        </Menu.CheckboxItem>
        <Menu.Separator />
        <Menu.Label>Sort by</Menu.Label>
        <Menu.RadioGroup value={sort} onValueChange={setSort}>
          <Menu.RadioItem value="updated">Last updated</Menu.RadioItem>
          <Menu.RadioItem value="title">Title</Menu.RadioItem>
          <Menu.RadioItem value="author">Author</Menu.RadioItem>
        </Menu.RadioGroup>
      </Menu.Content>
    </Menu>
  );
}

export const CheckboxAndRadio: Story = { render: () => <Preferences /> };

/** Opening from the keyboard, arrowing to an item and pressing Enter selects it and closes the menu. */
export const SelectsWithKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Actions" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const menu = within(document.body).getByRole("menu");
    await expect(within(menu).getByRole("menuitem", { name: /Delete/ })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect(within(document.body).queryByRole("menu")).toBeNull();
  },
};
