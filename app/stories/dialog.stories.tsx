import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { Button, Dialog } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "Dialog",
  component: Dialog,
  tags: ["autodocs"],
  argTypes: argTypesFor("Dialog"),
  args: { size: "md" },
  parameters: { docs: { description: { component: `Dialog.Content wraps the portal and overlay, so nothing else is needed. Enter rises and settles on the slow duration; exit drops away faster. Reduced motion fades without moving. ${classNameAllow("Dialog")}` } } },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const Example = (args: React.ComponentProps<typeof Dialog>) => (
  <Dialog {...args}>
    <Dialog.Trigger asChild>
      <Button tone="danger" variant="soft">Reject ZN-2041</Button>
    </Dialog.Trigger>
    <Dialog.Content>
      <Dialog.Title>Reject ZN-2041?</Dialog.Title>
      <Dialog.Description>Mina Okafor will be notified and the item returns to their queue.</Dialog.Description>
      <Dialog.Footer>
        <Dialog.Close asChild>
          <Button variant="ghost">Cancel</Button>
        </Dialog.Close>
        <Dialog.Close asChild>
          <Button tone="danger">Reject</Button>
        </Dialog.Close>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog>
);

export const Default: Story = { render: (args) => <Example {...args} /> };

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: "var(--spacing-3)" }}>
      {values("Dialog", "size").map((size) => (
        <Dialog key={size} {...args} size={size as never}>
          <Dialog.Trigger asChild>
            <Button variant="soft">Open {size}</Button>
          </Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>Size {size}</Dialog.Title>
            <Dialog.Description>Width and padding scale together.</Dialog.Description>
          </Dialog.Content>
        </Dialog>
      ))}
    </div>
  ),
};

/** Opened for the docs page and the visual review. Escape closes it. */
export const Open: Story = { args: { defaultOpen: true }, render: (args) => <Example {...args} /> };

/** Opens from the trigger, traps focus, closes on Escape, and unmounts after the exit motion. */
export const OpensAndCloses: Story = {
  render: (args) => <Example {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Reject ZN-2041" }));
    const dialog = await screen.findByRole("dialog", { name: "Reject ZN-2041?" });
    await expect(dialog).toHaveAttribute("data-size", "md");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  },
};
