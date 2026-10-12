import { type PostSignal, postImageSchema } from "@call-my-bluff/domain";

/** Read only the outer post's photo links, excluding media inside quoted posts. */
export function postImages(article: HTMLElement, postId: string) {
  const images: PostSignal["images"] = [];
  for (const link of article.querySelectorAll<HTMLAnchorElement>(
    'a[href*="/photo/"]',
  )) {
    if (
      !new URL(link.href).pathname.match(
        new RegExp(`/status/${postId}/photo/[0-9]+$`),
      )
    )
      continue;
    for (const img of link.querySelectorAll<HTMLImageElement>("img")) {
      const parsed = postImageSchema.safeParse({
        url: img.currentSrc || img.src,
        alt: (img.alt || "Post image").slice(0, 120),
      });
      if (parsed.success && !images.some((i) => i.url === parsed.data.url))
        images.push(parsed.data);
      if (images.length === 4) return images;
    }
  }
  return images;
}
