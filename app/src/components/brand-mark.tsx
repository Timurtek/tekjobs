import { brand } from "../brand";

/** The lockup: the glyph and the TEK/JOBS wordmark. Styled by .brand-mark in src/theme/brand.css. */
export function BrandMark({ href = "/" }: { href?: string }) {
  return (
    <a className="brand-mark" href={href} aria-label={brand.name}>
      {brand.logo && <img className="brand-mark__logo" src={brand.logo} alt="" />}
      <span aria-hidden="true">
        Tek<span className="brand-mark__accent">Jobs</span>
      </span>
    </a>
  );
}
