import { compressImageDataUrl } from "./memoriesSync";
import { newChatMediaId } from "./chatMediaSync";

export type ChatAttachment = {
  kind: "image" | "file" | "video";
  name: string;
  mime: string;
  /** data URL for images/video (display); base64 without prefix for PDFs */
  data?: string;
  textPreview?: string;
  /** IndexedDB key for durable Library blobs (images/videos/files). */
  mediaId?: string;
};

export const MAX_CHAT_FILE_BYTES = 6 * 1024 * 1024;
export const MAX_MEMORY_VIDEO_BYTES = 15 * 1024 * 1024;

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

export async function fileToChatAttachment(file: File): Promise<ChatAttachment> {
  if (file.size > MAX_CHAT_FILE_BYTES) {
    throw new Error("too_large");
  }
  const lower = file.name.toLowerCase();
  if (file.type.startsWith("image/") || /\.(jpe?g|png|gif|webp)$/i.test(lower)) {
    const dataUrl = await readAsDataURL(file);
    const compressed = await compressImageDataUrl(dataUrl, 1024, 0.68);
    return {
      kind: "image",
      name: file.name,
      mime: "image/jpeg",
      data: compressed,
      mediaId: newChatMediaId(),
    };
  }
  if (file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(lower)) {
    const dataUrl = await readAsDataURL(file);
    return {
      kind: "video",
      name: file.name,
      mime: file.type || "video/mp4",
      data: dataUrl,
      mediaId: newChatMediaId(),
    };
  }
  if (file.type === "application/pdf" || lower.endsWith(".pdf")) {
    const dataUrl = await readAsDataURL(file);
    const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    return {
      kind: "file",
      name: file.name,
      mime: file.type || "application/pdf",
      data: b64,
      mediaId: newChatMediaId(),
    };
  }
  const text = await file.text();
  return {
    kind: "file",
    name: file.name,
    mime: file.type || "text/plain",
    textPreview: text.slice(0, 8000),
  };
}

export function attachmentPayloadForApi(att: ChatAttachment) {
  if ((att.kind === "image" || att.kind === "video") && att.data) {
    const b64 = att.data.includes(",") ? att.data.split(",")[1] : att.data;
    return { kind: att.kind, name: att.name, mime: att.mime, data: b64 };
  }
  return {
    kind: att.kind,
    name: att.name,
    mime: att.mime,
    data: att.data,
    text_preview: att.textPreview,
  };
}

/** Drop binary payloads before localStorage / cloud sync (keeps names + mediaId for Library). */
export function chatMessagesForStorage<T extends { attachments?: ChatAttachment[] }>(messages: T[]): T[] {
  return messages.map((msg) => {
    if (!msg.attachments?.length) return msg
    return {
      ...msg,
      attachments: msg.attachments.map(({ kind, name, mime, mediaId, textPreview }) => ({
        kind,
        name,
        mime,
        ...(mediaId ? { mediaId } : {}),
        ...(kind === "file" && textPreview ? { textPreview } : {}),
      })),
    }
  })
}

export function threadsForStorage<T extends { messages: { attachments?: ChatAttachment[] }[] }>(
  threads: T[],
): T[] {
  return threads.map((th) => ({
    ...th,
    messages: chatMessagesForStorage(th.messages),
  }))
}

/** Ensure image/video/file attachments with binary data have a durable mediaId. */
export function ensureAttachmentMediaIds(attachments: ChatAttachment[]): ChatAttachment[] {
  return attachments.map((att) => {
    if (
      (att.kind === "image" || att.kind === "video" || att.kind === "file") &&
      att.data &&
      !att.mediaId
    ) {
      return { ...att, mediaId: newChatMediaId() }
    }
    return att
  })
}

export function defaultMessageForAttachments(attachments: ChatAttachment[], lang: string): string {
  const hasVideo = attachments.some((a) => a.kind === "video");
  const hasImage = attachments.some((a) => a.kind === "image");
  const names = attachments.map((a) => a.name).join(", ");
  if (hasVideo && attachments.length === 1) return lang === "el" ? "🎬 Βίντεο" : "🎬 Video";
  if (hasVideo) return lang === "el" ? `🎬 ${names}` : `🎬 ${names}`;
  if (hasImage && attachments.length === 1) return lang === "el" ? "📷 Φωτογραφία" : "📷 Photo";
  if (hasImage) return lang === "el" ? `📷 ${names}` : `📷 ${names}`;
  return lang === "el" ? `📎 ${names}` : `📎 ${names}`;
}
