/**
 * Deliberately bare.
 *
 * Overrides the admin layout for this one route so the gate is not itself gated, which would be a
 * loop, and so the locked page never touches the app shell or its data.
 */
export default function LockedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
