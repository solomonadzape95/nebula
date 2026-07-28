import { SiteFooter } from "@/components/site/footer";
import { Nav } from "@/components/site/nav";

/**
 * Chrome shared by every public page. The app and admin sections deliberately do not use this:
 * a marketing footer under a live position is noise.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <div className="dither-overlay" aria-hidden />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
