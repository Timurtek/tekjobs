import Script from "next/script";
import { analyticsId } from "@/lib/flags";

/**
 * Google Analytics 4 for the marketing site. Renders nothing unless flags.ts gives an id, which it does only on
 * production deployments; GA4's enhanced measurement counts client-side navigations on its own, so one config
 * call is the whole setup. The privacy page names it.
 */
export function GoogleTag() {
  if (!analyticsId) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${analyticsId}`} strategy="afterInteractive" />
      <Script id="gtag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${analyticsId}');`}
      </Script>
    </>
  );
}
