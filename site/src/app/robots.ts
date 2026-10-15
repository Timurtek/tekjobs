import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/flags";
import { robotsFor } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return robotsFor(appUrl);
}
