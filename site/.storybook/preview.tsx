import type { Decorator, Preview } from "@storybook/react-vite";
import "../src/styles/index.css";
import "../src/theme/brand.css";

/** Every story renders inside a themed surface. The toolbar switches data-theme, as a consumer would. */
const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals["theme"] as string) ?? "light";
  return (
    <div data-theme={theme} style={{ minHeight: "100%", padding: "var(--spacing-6)", background: "var(--color-surface)", color: "var(--color-text)", fontFamily: "var(--font-sans)" }}>
      <Story />
    </div>
  );
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Theme",
      toolbar: { title: "Theme", icon: "mirror", items: [{ value: "light", title: "Light" }, { value: "dark", title: "Dark" }], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [withTheme],
  parameters: { backgrounds: { disable: true }, controls: { expanded: true }, a11y: { test: "error" } },
};

export default preview;
