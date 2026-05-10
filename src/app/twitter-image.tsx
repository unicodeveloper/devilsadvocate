// Twitter/X large-summary cards use the same 1.91:1 aspect ratio as OG.
// Re-export the OG handler so we stay DRY and the two images always match.
export {
  default,
  alt,
  size,
  contentType,
} from "./opengraph-image";
