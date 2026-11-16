import { publicImageUrl } from "@/lib/supabase";

// A listing's photo, loaded from Supabase Storage. A plain <img> keeps this
// simple: Next.js's image optimiser would need extra setup for that address.
// "lazy" means photos far down the page load only when you scroll to them.
export function Photo({
  path,
  alt,
  className,
  eager = false,
}: {
  path: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const src = publicImageUrl(path);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={className}
    />
  );
}
