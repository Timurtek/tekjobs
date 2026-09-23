import { useSyncExternalStore, type ComponentType, type SVGProps } from "react";

/**
 * The icon vocabulary: every name a component or a template draws by, each with Zengin UI's own line
 * drawing (16 units, 1.75 stroke, currentColor) as the default. `zengin icons <set>` rewrites this file
 * in a project so the same names come from a react-icons set instead; app code and components never
 * import a set directly, they import `Icon` from here. `setIconSet` swaps the drawings at runtime, which
 * the marketing site's previews use and a project never needs.
 */

const PATHS = {
  Search: "M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM10.5 10.5L14 14",
  Close: "M4 4l8 8M12 4l-8 8",
  Check: "M3.5 8.5l3 3 6-7",
  ChevronDown: "M4 6l4 4 4-4",
  ChevronUp: "M4 10l4-4 4 4",
  ChevronLeft: "M10 4L6 8l4 4",
  ChevronRight: "M6 4l4 4-4 4",
  ArrowUp: "M8 13V3M4 7l4-4 4 4",
  ArrowDown: "M8 3v10M4 9l4 4 4-4",
  ArrowLeft: "M13 8H3M7 4L3 8l4 4",
  ArrowRight: "M3 8h10M9 4l4 4-4 4",
  Plus: "M8 3v10M3 8h10",
  Minus: "M3 8h10",
  Trash: "M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5M6.8 7v4M9.2 7v4",
  Edit: "M11.5 2.5l2 2-8 8H3.5v-2l8-8z",
  Settings: "M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4",
  Menu: "M3 4.5h10M3 8h10M3 11.5h10",
  More: "M3 8a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0zM7.25 8a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0zM11.5 8a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0z",
  Home: "M2.5 7.5L8 2.5l5.5 5v6h-4v-4h-3v4h-4z",
  User: "M8 8a2.75 2.75 0 1 0 0-5.5A2.75 2.75 0 0 0 8 8zM3 14c.5-2.5 2.5-4 5-4s4.5 1.5 5 4",
  Users: "M6 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM1.5 13.5c.4-2.4 2.2-3.8 4.5-3.8s4.1 1.4 4.5 3.8M10.5 3.2a2.5 2.5 0 0 1 0 4.6M12 9.9c1.4.5 2.2 1.6 2.5 3.6",
  Bell: "M4.5 11V7a3.5 3.5 0 0 1 7 0v4l1 1.5h-9zM6.5 13.5a1.5 1.5 0 0 0 3 0",
  Info: "M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM8 7.5v4M8 5v.01",
  Warning: "M8 2.5l6 11H2zM8 6.5V10M8 12v.01",
  Error: "M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4",
  Success: "M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM5 8.3l2 2 4-4.3",
  Help: "M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM6 6.3a2 2 0 0 1 4 .2c0 1.3-2 1.5-2 3M8 12v.01",
  Copy: "M6 6h7v7H6zM3 10V3h7",
  ExternalLink: "M9 3h4v4M13 3L7 9M11 9v4H3V5h4",
  Download: "M8 2.5v8M4.5 7.5L8 11l3.5-3.5M2.5 13.5h11",
  Upload: "M8 11V3M4.5 6.5L8 3l3.5 3.5M2.5 13.5h11",
  Filter: "M2 3h12l-4.5 5.5v4l-3 1.5V8.5z",
  Sun: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1",
  Moon: "M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z",
  Loader: "M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.4 3.4l2.1 2.1M10.5 10.5l2.1 2.1M3.4 12.6l2.1-2.1M10.5 5.5l2.1-2.1",
  Grid: "M2.5 2.5H7V7H2.5zM9 2.5h4.5V7H9zM2.5 9H7v4.5H2.5zM9 9h4.5v4.5H9z",
  CreditCard: "M2 4.5h12v7H2zM2 7h12M4.5 9.5h2",
  Mail: "M2 4h12v8H2zM2 4.5l6 4.5 6-4.5",
  Calendar: "M2.5 4h11v9.5h-11zM2.5 7h11M5.5 2.5V5M10.5 2.5V5",
  Clock: "M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM8 4.5V8l2.5 1.5",
  Eye: "M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  EyeOff: "M2 2l12 12M6.5 6.6A2 2 0 0 0 9.4 9.5M4.6 4.7C2.6 6 1.5 8 1.5 8s2.5 4.5 6.5 4.5c1.2 0 2.3-.4 3.3-.9M6.9 3.6c.4 0 .7-.1 1.1-.1 4 0 6.5 4.5 6.5 4.5s-.7 1.3-2 2.5",
  Lock: "M3.5 7h9v6.5h-9zM5.5 7V5a2.5 2.5 0 0 1 5 0v2M8 10v1.5",
  LogOut: "M6 2.5H3v11h3M10 11l3-3-3-3M13 8H6.5",
  Star: "M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z",
  Send: "M14 2L2 6.5l5.5 2 2 5.5zM14 2L7.5 8.5",
  Paperclip: "M13 7.5l-5.2 5.2a3.2 3.2 0 0 1-4.5-4.5l5.6-5.6a2 2 0 0 1 2.8 2.8L6.1 11a.8.8 0 0 1-1.1-1.1L10 4.9",
  Sparkles: "M8 2l1.3 3.7L13 7l-3.7 1.3L8 12l-1.3-3.7L3 7l3.7-1.3zM13 11l.6 1.4 1.4.6-1.4.6L13 15l-.6-1.4-1.4-.6 1.4-.6z",
  Link: "M6.5 9.5l3-3M9 4.5l1.3-1.3a2.5 2.5 0 0 1 3.5 3.5L12.5 8M7 11.5l-1.3 1.3a2.5 2.5 0 0 1-3.5-3.5L3.5 8",
  Refresh: "M13.5 8a5.5 5.5 0 0 1-9.6 3.7M2.5 8a5.5 5.5 0 0 1 9.6-3.7M12.5 1.5v3h-3M3.5 14.5v-3h3",
  Globe: "M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM1.5 8h13M8 1.5c2 2 2 11 0 13M8 1.5c-2 2-2 11 0 13",
  File: "M4 1.5h5l3.5 3.5v9.5H4zM9 1.5V5h3.5",
  Folder: "M1.5 3.5H6l1.5 2h7v8h-13z",
  Tag: "M2 2h5.5l6.5 6.5-5.5 5.5L2 7.5zM5 5v.01",
  Inbox: "M2.5 2.5h11v11h-11zM2.5 9.5h3l1 2h3l1-2h3",
  Message: "M2.5 3h11v8h-6l-3 2.5V11h-2z",
  Code: "M5 4.5L1.5 8 5 11.5M11 4.5L14.5 8 11 11.5M9.5 2.5l-3 11",
  Terminal: "M2.5 4l4 4-4 4M8 12h5.5",
  Chart: "M2.5 13.5h11M4 11V7M8 11V3.5M12 11V9",
  Layers: "M8 2.5l6 3-6 3-6-3zM2 8.5l6 3 6-3M2 11.5l6 3 6-3",
  Database: "M8 5.5c3.3 0 6-1 6-2s-2.7-2-6-2-6 1-6 2 2.7 2 6 2zM2 3.5v9c0 1 2.7 2 6 2s6-1 6-2v-9M2 8c0 1 2.7 2 6 2s6-1 6-2",
  Shield: "M8 1.5l5.5 2V8c0 3.5-2.5 5.5-5.5 6.5C5 13.5 2.5 11.5 2.5 8V3.5z",
  Drag: "M6 4v.01M10 4v.01M6 8v.01M10 8v.01M6 12v.01M10 12v.01",
} as const;

export type IconName = keyof typeof PATHS;
export const iconNames = Object.keys(PATHS) as IconName[];

export interface IconProps extends SVGProps<SVGSVGElement> {
  /** Width and height; default 1em, so an icon follows the text it sits in. */
  size?: number | string;
}
export type IconComponent = ComponentType<IconProps>;
export type IconSet = Partial<Record<IconName, IconComponent>>;

let current: IconSet = {};
const listeners = new Set<() => void>();

/** Replaces the drawings at runtime. Every mounted icon re-renders. Pass `{}` to go back to the defaults. */
export function setIconSet(set: IconSet): void {
  current = set;
  for (const l of listeners) l();
}
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
const snapshot = () => current;

function Line({ d, size = "1em", ...props }: IconProps & { d: string }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d={d} />
    </svg>
  );
}

function make(name: IconName): IconComponent {
  const d = PATHS[name];
  const Component = (props: IconProps) => {
    const set = useSyncExternalStore(subscribe, snapshot, snapshot);
    const Swapped = set[name];
    return Swapped ? <Swapped aria-hidden="true" {...props} /> : <Line d={d} {...props} />;
  };
  Component.displayName = `Icon.${name}`;
  return Component;
}

/** `<Icon.Search />`, `<Icon.Close size={20} />`. One component per name, drawn by the current set. */
export const Icon = Object.fromEntries(iconNames.map((name) => [name, make(name)])) as Record<IconName, IconComponent>;
