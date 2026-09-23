import type { Meta, StoryObj } from "@storybook/react-vite";
import { Markdown } from "@/components/ui";
import { argTypesFor, classNameAllow } from "./manifest";

const SAMPLE = `## Why the build failed

The token file references \`--color-brand\`, which **no theme defines**. Two ways out:

1. Rename it to \`--color-primary\`, the token the system has.
2. Add \`brand\` to *tokens.json* and re-run \`zengin tokens\`.

\`\`\`css
.hero { background-color: var(--color-primary); }
\`\`\`

> The engine flags the first option as exact and the second as nearest.

See [the rules](https://zengin.timurtek.com/#rules) for the full list.`;

const meta = {
  title: "Markdown",
  component: Markdown,
  tags: ["autodocs"],
  argTypes: argTypesFor("Markdown"),
  args: { text: SAMPLE, streaming: false },
  parameters: { docs: { description: { component: `Assistant text: the markdown subset models produce, rendered with the system's type and never as raw HTML. ${classNameAllow("Markdown")}` } } },
  render: (args) => (
    <div style={{ width: "36rem", maxWidth: "100%" }}>
      <Markdown {...args} />
    </div>
  ),
} satisfies Meta<typeof Markdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Streaming: Story = { args: { text: "The token file references `--color-brand`, which no theme def", streaming: true } };
