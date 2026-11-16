"use client";

import { Clock, ImagePlus, MapPin, Tag, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, categoryName } from "@/lib/categories";
import {
  IMAGE_EXTENSIONS,
  IMAGE_BUCKET,
  LIMITS,
  checkImage,
  formatPrice,
  parsePrice,
  validateListing,
  type ListingErrors,
} from "@/lib/listings";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// One labelled field with its error message underneath.
function Field({
  id,
  label,
  error,
  required,
  counter,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  counter?: string; // e.g. "12/100": how much of the limit is used
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span aria-hidden> *</span>}
        </label>
        {counter && <span className="text-xs text-muted-foreground">{counter}</span>}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// The page for creating a listing: a form on the left, and a live preview of
// how the listing will look on the right.
export function ListingForm() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [priceText, setPriceText] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<ListingErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);

  // A temporary address so we can show a preview of the chosen photo.
  const previewUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl); // free the memory
    };
  }, [previewUrl]);

  function choosePhoto(file: File | undefined) {
    if (!file) return;
    const problem = checkImage(file);
    if (problem) {
      setPhoto(null);
      setErrors((e) => ({ ...e, hasPhoto: problem }));
      return;
    }
    setPhoto(file);
    setErrors((e) => ({ ...e, hasPhoto: undefined }));
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    choosePhoto(event.dataTransfer.files?.[0]);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitError(null);

    const found = validateListing({ title, category, price: priceText, location, email, description, hasPhoto: photo !== null });
    setErrors(found);
    const firstProblem = (["hasPhoto", "title", "category", "price", "email", "location", "description"] as const).find((k) => found[k]);
    if (firstProblem) {
      // Jump to the first field that needs fixing.
      document.getElementById(firstProblem === "hasPhoto" ? "photo" : firstProblem)?.focus();
      return;
    }
    const price = parsePrice(priceText);
    if (!supabase || !photo || price === null) return;

    setSubmitting(true);

    // Step 1: upload the photo under a random name (it can never overwrite
    // anyone else's photo, and the name can't be guessed).
    const imagePath = `${crypto.randomUUID()}.${IMAGE_EXTENSIONS[photo.type]}`;
    const { error: uploadError } = await supabase.storage.from(IMAGE_BUCKET).upload(imagePath, photo, {
      contentType: photo.type,
      cacheControl: "31536000", // photos never change, so browsers may keep them
      upsert: false,
    });
    if (uploadError) {
      console.error("Could not upload photo:", uploadError.message);
      setSubmitError("Sorry, your photo could not be uploaded. Please try again.");
      setSubmitting(false);
      return;
    }

    // Step 2: save the listing.
    const { data, error } = await supabase
      .from("listings")
      .insert({
        title: title.trim(),
        description: description.trim(),
        price,
        category,
        seller_email: email.trim(),
        image_path: imagePath,
        location: location.trim(),
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("Could not create listing:", error?.message);
      setSubmitError("Sorry, your listing could not be saved. Please try again.");
      setSubmitting(false);
      return;
    }
    // Clear the whole form BEFORE leaving. This version of Next.js keeps a page's
    // state alive in the background when you navigate away, so without this the
    // next "Create listing" would still show the last listing's photo and text,
    // and the button would still say "Creating...".
    clearPhoto();
    setTitle("");
    setCategory("");
    setPriceText("");
    setLocation("");
    setEmail("");
    setDescription("");
    setErrors({});
    setSubmitError(null);
    setDragging(false);
    setSubmitting(false);
    router.push(`/item/${data.id}`); // go and look at the new listing
  }

  // Forget the chosen photo. The file input itself must be emptied too, otherwise
  // the browser would ignore choosing the very same file a second time.
  function clearPhoto() {
    setPhoto(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  const shownPrice = parsePrice(priceText);
  const invalid = (key: keyof ListingErrors) => (errors[key] ? true : undefined);

  return (
    <main className="page-container flex-1 py-6">
      <Link href="/create" className="mb-4 inline-block text-sm text-primary hover:underline">
        ← Choose listing type
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Item for sale</h1>

      <div className="grid gap-6 lg:grid-cols-[clamp(22rem,28vw,30rem)_1fr]">
        <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          {/* Photo */}
          <div>
            <p className="mb-1 text-sm font-medium">
              Photo<span aria-hidden> *</span>
            </p>
            <input
              id="photo"
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={(e: ChangeEvent<HTMLInputElement>) => choosePhoto(e.target.files?.[0])}
              aria-invalid={invalid("hasPhoto")}
              className="peer sr-only"
            />
            {photo && previewUrl ? (
              <div className="relative overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element -- just a local preview */}
                <img src={previewUrl} alt="The photo you chose" className="max-h-52 w-full object-cover" />
                <button
                  type="button"
                  onClick={clearPhoto}
                  aria-label="Remove photo"
                  className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-destructive text-white shadow focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </div>
            ) : (
              <label
                htmlFor="photo"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-3 py-8 text-center text-sm transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                  dragging ? "border-primary bg-primary/10" : "border-input hover:bg-muted",
                )}
              >
                <ImagePlus aria-hidden className="size-7 text-muted-foreground" />
                <span className="font-medium">Add photo</span>
                <span className="text-xs text-muted-foreground">Click or drag and drop. JPG, PNG, GIF or WebP, up to 5 MB.</span>
              </label>
            )}
            {errors.hasPhoto && (
              <p role="alert" className="mt-1 text-sm text-destructive">
                {errors.hasPhoto}
              </p>
            )}
          </div>

          <Field id="title" label="Title" required error={errors.title} counter={`${title.length}/${LIMITS.title}`}>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.title} placeholder="What are you selling?" aria-invalid={invalid("title")} aria-describedby={errors.title ? "title-error" : undefined} />
          </Field>

          {/* Category and price side by side: shorter form, and they belong together. */}
          <div className="grid grid-cols-2 items-start gap-3">
          <Field id="category" label="Category" required error={errors.category}>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-invalid={invalid("category")}
              aria-describedby={errors.category ? "category-error" : undefined}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field id="price" label="Price" required error={errors.price}>
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input id="price" value={priceText} onChange={(e) => setPriceText(e.target.value)} inputMode="decimal" placeholder="0 = free" className="pl-6" aria-invalid={invalid("price")} aria-describedby={errors.price ? "price-error" : undefined} />
            </div>
          </Field>
          </div>

          <Field id="location" label="Location (optional)" error={errors.location}>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={LIMITS.location} placeholder="e.g. your campus or city" aria-invalid={invalid("location")} aria-describedby={errors.location ? "location-error" : undefined} />
          </Field>

          <Field id="email" label="Contact email" required error={errors.email}>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={LIMITS.email} placeholder="you@example.com" autoComplete="email" aria-invalid={invalid("email")} aria-describedby={errors.email ? "email-error" : "email-hint"} />
            <p id="email-hint" className="mt-1 text-xs text-muted-foreground">
              This email is shown publicly on your listing.
            </p>
          </Field>

          <Field id="description" label="Description" error={errors.description} counter={`${description.length}/${LIMITS.description}`}>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={LIMITS.description} rows={4} placeholder="Describe your item" aria-invalid={invalid("description")} aria-describedby={errors.description ? "description-error" : undefined} />
          </Field>

          {submitError && (
            <p role="alert" className="text-sm text-destructive">
              {submitError}
            </p>
          )}
          <Button type="submit" size="lg" disabled={submitting || !supabase} className="h-10 w-full text-base">
            {submitting ? "Creating…" : "Create listing"}
          </Button>
          {!supabase && (
            <p role="status" className="text-xs text-amber-800">
              Not connected to Supabase yet. See <code>.env.local.example</code>.
            </p>
          )}
        </form>

        {/* Preview: how the listing will look */}
        <section aria-label="Preview" className="min-w-0">
          <h2 className="mb-2 text-center text-lg font-bold">Preview</h2>
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex aspect-[4/3] items-center justify-center bg-[repeating-linear-gradient(135deg,var(--muted)_0_10px,transparent_10px_20px)] bg-muted">
              {photo && previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- just a local preview
                <img src={previewUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="rounded-md bg-card/80 px-3 py-1 text-sm text-muted-foreground">Your photo will appear here</span>
              )}
            </div>
            <div className="space-y-2 p-5">
              <h3 className="text-xl font-bold">{title.trim() || "Title"}</h3>
              <p className="text-lg font-semibold">{shownPrice !== null ? formatPrice(shownPrice) : "Price"}</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Clock aria-hidden className="size-4 shrink-0" />
                  <span>Listed just now</span>
                </li>
                {location.trim() && (
                  <li className="flex items-center gap-2">
                    <MapPin aria-hidden className="size-4 shrink-0" />
                    <span className="break-words">{location.trim()}</span>
                  </li>
                )}
                {category && (
                  <li className="flex items-center gap-2">
                    <Tag aria-hidden className="size-4 shrink-0" />
                    <span>{categoryName(category)}</span>
                  </li>
                )}
              </ul>
              {description.trim() && <p className="text-sm whitespace-pre-wrap break-words">{description.trim()}</p>}
              <div>
                <p className="text-sm font-semibold">Seller information</p>
                <p className="text-sm text-muted-foreground break-all">{email.trim() || "seller@email.com"}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
