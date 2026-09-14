import type { PageData } from "@/lib/journal-model";

function fileName(title: string) {
  return `${title.replace(/[^a-z0-9]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "journal-page"}.journal.json`;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function exportJournalPage(page: PageData, title: string) {
  const blob = new Blob([JSON.stringify(page, null, 2)], { type: "application/json" });
  const name = fileName(title);
  const file = new File([blob], name, { type: "application/json" });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title, files: [file], text: "A page from my Pin & Paper journal" });
      return "shared" as const;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled" as const;
      // Browsers may expose Web Share but deny it in previews or desktop shells.
      // Falling back to a local download needs no sharing permission.
    }
  }

  download(blob, name);
  return "downloaded" as const;
}
