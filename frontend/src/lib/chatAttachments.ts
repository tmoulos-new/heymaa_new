import { compressImageDataUrl } from "./memoriesSync";

export type ChatAttachment = {
  kind: "image" | "file";
  name: string;
  mime: string;
  /** data URL for images (display); base64 without prefix for PDFs */
  data?: string;
  textPreview?: string;
};

export const MAX_CHAT_FILE_BYTES = 6 * 1024 * 1024;

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
    const compressed = await compressImageDataUrl(dataUrl, 1280, 0.72);
    return { kind: "image", name: file.name, mime: "image/jpeg", data: compressed };
  }
  if (file.type === "application/pdf" || lower.endsWith(".pdf")) {
    const dataUrl = await readAsDataURL(file);
    const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    return { kind: "file", name: file.name, mime: file.type || "application/pdf", data: b64 };
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
  if (att.kind === "image" && att.data) {
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

export function defaultMessageForAttachments(attachments: ChatAttachment[], lang: string): string {
  const hasImage = attachments.some((a) => a.kind === "image");
  const names = attachments.map((a) => a.name).join(", ");
  if (hasImage && attachments.length === 1) return lang === "el" ? "📷 Φωτογραφία" : "📷 Photo";
  if (hasImage) return lang === "el" ? `📷 ${names}` : `📷 ${names}`;
  return lang === "el" ? `📎 ${names}` : `📎 ${names}`;
}
