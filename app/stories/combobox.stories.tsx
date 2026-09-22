import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Combobox, type ComboboxOption } from "@/components/ui";
import { argTypesFor, classNameAllow, values } from "./manifest";

const PEOPLE: ComboboxOption[] = [
  { value: "mina", label: "Mina Okafor", hint: "mina@northwind.dev", group: "Design" },
  { value: "ines", label: "Ines Berg", hint: "ines@northwind.dev", group: "Design" },
  { value: "rafa", label: "Rafa Silva", hint: "rafa@northwind.dev", group: "Engineering" },
  { value: "sam", label: "Sam Ojo", hint: "sam@northwind.dev", group: "Engineering" },
  { value: "dee", label: "Dee Castellanos", hint: "dee@northwind.dev", group: "Engineering" },
  { value: "arun", label: "Arun Patel", hint: "on leave until March", group: "Engineering", disabled: true },
];

function One() {
  const [value, setValue] = useState<string | null>(null);
  return <Combobox label="Assignee" placeholder="Search people" options={PEOPLE} value={value} onValueChange={setValue} description="Type to filter. Arrow keys move, Enter chooses." />;
}

function Many() {
  const [value, setValue] = useState<string[]>(["mina"]);
  return <Combobox multiple label="Reviewers" placeholder="Add a reviewer" options={PEOPLE} value={value} onValueChange={setValue} description="Backspace on an empty field removes the last one." />;
}

const meta = {
  title: "Combobox",
  component: Combobox,
  tags: ["autodocs"],
  argTypes: argTypesFor("Combobox"),
  args: { label: "Assignee", options: PEOPLE, placeholder: "Search people", size: "md" },
  parameters: {
    docs: {
      description: {
        component: `A text field that filters a list. Select is right up to a few dozen options; past that the answer is typing. Focus stays in the input and the active option is pointed at with aria-activedescendant, which is the part hand-rolled comboboxes usually get wrong. ${classNameAllow("Combobox")}`,
      },
    },
  },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = { render: () => <One /> };

export const Multiple: Story = { render: () => <Many /> };

export const Grouped: Story = {
  render: () => <Combobox label="Assignee" placeholder="Search people" options={PEOPLE} description="Options keep the groups they were given." />,
};

/** An option that cannot be chosen is shown and skipped by the arrow keys, not hidden. */
export const WithADisabledOption: Story = {
  render: () => <Combobox label="Assignee" placeholder="Search people" options={PEOPLE} description="Arun is on leave: listed, and not selectable." />,
};

export const Invalid: Story = {
  render: () => <Combobox label="Assignee" placeholder="Search people" options={PEOPLE} error="Pick someone before saving." />,
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-4)" }}>
      {values("Combobox", "size").map((size) => (
        <Combobox key={size} {...args} size={size as "sm" | "md" | "lg"} label={`Size ${size}`} />
      ))}
    </div>
  ),
};
