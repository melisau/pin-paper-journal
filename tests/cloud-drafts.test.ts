import { beforeEach, describe, expect, it } from "vitest";
import { decryptJson, generateEncryptionKey } from "@/lib/crypto";
import { cloudDraftKey, hasPendingCloudDraft, markCloudDraftSynced, readCloudDraft, writeCloudDraft } from "@/lib/cloud-drafts";
import type { PageData } from "@/lib/journal-model";

const page: PageData = {
  id: "14ca2633-3490-48b2-90f5-5d53a537a27e", pageName: "Page 1", pageDate: "", title: "Offline note", note: "Safe locally",
  placed: [], photos: [], drawingData: "", joys: [], joysVisible: true, pattern: "lined", paperColor: "#fffdf7", font: "hand", fontSize: 18, textColor: "#66564b",
};

describe("cloud draft queue", () => {
  let key: CryptoKey;
  beforeEach(async () => { localStorage.clear(); key = await generateEncryptionKey(); });

  it("encrypts offline edits at rest until cloud sync succeeds", async () => {
    await writeCloudDraft("journal-1", [page], "Blush", true, key);
    const raw = localStorage.getItem(cloudDraftKey("journal-1"))!;
    expect(raw).not.toContain("Safe locally");
    expect(raw).not.toContain("Offline note");
    const envelope = JSON.parse(raw);
    expect(envelope).toMatchObject({ format: "encrypted-cloud-draft", version: 3, pendingSync: true });
    await expect(decryptJson(envelope.payload, key)).resolves.toMatchObject({ journalId: "journal-1", document: { pages: [{ note: "Safe locally" }] } });
    expect(await hasPendingCloudDraft("journal-1", key)).toBe(true);
    await markCloudDraftSynced("journal-1", [page], "Blush", key);
    expect(await hasPendingCloudDraft("journal-1", key)).toBe(false);
  });

  it("ignores malformed or obsolete drafts", async () => {
    localStorage.setItem(cloudDraftKey("journal-2"), JSON.stringify({ version: 1, pages: [] }));
    expect(await readCloudDraft("journal-2", key)).toBeNull();
    localStorage.setItem(cloudDraftKey("journal-2"), "not-json");
    expect(await readCloudDraft("journal-2", key)).toBeNull();
  });

  it("migrates old readable drafts to ciphertext without losing their content", async () => {
    const legacy = { version: 2, pages: [page], theme: "Blush", updatedAt: new Date().toISOString(), pendingSync: true };
    localStorage.setItem(cloudDraftKey("journal-legacy"), JSON.stringify(legacy));
    const restored = await readCloudDraft("journal-legacy", key);
    const raw = localStorage.getItem(cloudDraftKey("journal-legacy"))!;
    expect(restored?.pages[0].note).toBe("Safe locally");
    expect(raw).not.toContain("Safe locally");
    expect(JSON.parse(raw)).toMatchObject({ format: "encrypted-cloud-draft", pendingSync: true });
  });

  it("keeps a legacy draft intact if encryption fails during migration", async () => {
    const legacyRaw = JSON.stringify({ version: 2, pages: [page], theme: "Blush", updatedAt: new Date().toISOString(), pendingSync: true });
    localStorage.setItem(cloudDraftKey("journal-legacy-failure"), legacyRaw);
    const decryptOnlyKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["decrypt"]);
    await expect(readCloudDraft("journal-legacy-failure", decryptOnlyKey)).rejects.toThrow();
    expect(localStorage.getItem(cloudDraftKey("journal-legacy-failure"))).toBe(legacyRaw);
  });

  it("does not reveal a tampered encrypted draft", async () => {
    await writeCloudDraft("journal-tampered", [page], "Blush", true, key);
    const raw = localStorage.getItem(cloudDraftKey("journal-tampered"))!;
    const envelope = JSON.parse(raw);
    const first = envelope.payload.ciphertext[0] === "A" ? "B" : "A";
    envelope.payload.ciphertext = `${first}${envelope.payload.ciphertext.slice(1)}`;
    localStorage.setItem(cloudDraftKey("journal-tampered"), JSON.stringify(envelope));
    expect(await readCloudDraft("journal-tampered", key)).toBeNull();
  });

  it("does not restore a draft with a different account key", async () => {
    await writeCloudDraft("journal-wrong-key", [page], "Blush", true, key);
    expect(await readCloudDraft("journal-wrong-key", await generateEncryptionKey())).toBeNull();
  });

  it("reopens encrypted media instead of reusing blob URLs from an old tab", async () => {
    await writeCloudDraft("journal-3", [{ ...page, photos: [{ id: 1, src: "blob:expired", assetId: "encrypted-photo", x: 10, y: 10, rotation: 0, framed: false, z: 1, size: 180, shape: "square" }], drawingAssetId: "encrypted-drawing", drawingData: "blob:expired-drawing" }], "Blush", true, key);
    const restored = (await readCloudDraft("journal-3", key))?.pages[0];
    expect(restored?.photos[0].src).toBe("");
    expect(restored?.drawingData).toBe("");
  });
});
