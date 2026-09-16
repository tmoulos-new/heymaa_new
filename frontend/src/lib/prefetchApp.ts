/** Warm the lazy /app chunk while the user is on the login screen. */
export function prefetchAppChunk() {
  void import("../App");
}
