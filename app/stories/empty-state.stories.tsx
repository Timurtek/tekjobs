import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, EmptyState, Icon } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  argTypes: argTypesFor("EmptyState"),
  args: { title: "No customers yet", description: "They will appear here as soon as the first one signs up.", size: "md", tone: "neutral" },
  parameters: {
    docs: {
      description: {
        component: `The screen when there is nothing to show. Every list, table and search has one, and it is usually written last and worst. ${classNameAllow("EmptyState")}`,
      },
    },
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Three states that look the same and mean different things: nothing yet, nothing matched, nothing left. */
export const TheThreeKinds: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "var(--spacing-4)" }}>
      <EmptyState icon={<Icon.Users />} title="No customers yet" description="They will appear here as soon as the first one signs up." action={<Button tone="primary">Invite someone</Button>} />
      <EmptyState icon={<Icon.Search />} title="Nothing matches “refund”" description="Try a shorter term, or clear the status filter." action={<Button variant="soft">Clear filters</Button>} />
      <EmptyState icon={<Icon.Check />} title="The queue is clear" description="Everything submitted today has been reviewed." />
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-4)" }}>
      {values("EmptyState", "size").map((size) => (
        <EmptyState key={size} {...args} size={size as "sm" | "md"} title={`Size ${size}`} />
      ))}
    </div>
  ),
};

/** A failure is not the same as an absence, and should not read like one. */
export const AfterAFailure: Story = {
  args: { tone: "danger", title: "Could not load customers", description: "The request timed out. Nothing was changed." },
  render: (args) => <EmptyState {...args} icon={<Icon.Warning />} action={<Button variant="soft">Try again</Button>} />,
};
