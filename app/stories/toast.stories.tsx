import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Button, Toast, toast } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "Toast",
  component: Toast.Provider,
  tags: ["autodocs"],
  argTypes: argTypesFor("Toast"),
  args: { position: "bottom-right", duration: 5000 },
  parameters: { docs: { description: { component: `Mount one Toast.Provider near the root; call toast({ title }) from anywhere. Toasts announce politely, pause on hover, swipe to dismiss, and stack in the corner the provider chooses. ${classNameAllow("Toast")}` } } },
  render: (args) => (
    <Toast.Provider {...args}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--spacing-2)" }}>
        {values("Toast", "tone").map((tone) => (
          <Button key={tone} onClick={() => toast({ title: `Saved (${tone})`, description: "The review was sent back to the author.", tone: tone as never })}>
            {tone}
          </Button>
        ))}
        <Button variant="soft" onClick={() => toast({ title: "Item archived", action: { label: "Undo", onClick: () => toast({ title: "Restored", tone: "success" }) } })}>
          with action
        </Button>
        <Button variant="ghost" onClick={() => toast.dismiss()}>
          dismiss all
        </Button>
      </div>
    </Toast.Provider>
  ),
} satisfies Meta<typeof Toast.Provider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TopLeft: Story = { args: { position: "top-left" } };

/** A click shows a toast that announces its title. */
export const ShowsOnClick: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "success" }));
    await expect(within(document.body).getByText("Saved (success)")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "dismiss all" }));
  },
};
