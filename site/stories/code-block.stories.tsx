import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeBlock } from "@/components/ui";
import { argTypesFor, classNameAllow } from "./manifest";

const meta = {
  title: "CodeBlock",
  component: CodeBlock,
  tags: ["autodocs"],
  argTypes: argTypesFor("CodeBlock"),
  args: { code: 'import { Button } from "@/components/ui";\n\nexport function Save() {\n  return <Button tone="primary">Save</Button>;\n}', language: "tsx", showCopy: true },
  parameters: { docs: { description: { component: `Code as a model or a document presents it: monospace, scrollable, a language label, one-click copy. ${classNameAllow("CodeBlock")}` } } },
  render: (args) => (
    <div style={{ width: "32rem", maxWidth: "100%" }}>
      <CodeBlock {...args} />
    </div>
  ),
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Bare: Story = { args: { language: undefined, showCopy: false, code: "npm create zengin@latest acme -- --template chat" } };
