import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import JournalPage from "@/app/journal/page";

const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: mocks.getClaims } }),
}));
vi.mock("@/components/journal-app", () => ({
  default: ({ cloudUserId }: { cloudUserId: string }) => <div data-testid="journal">{cloudUserId}</div>,
}));
vi.mock("@/components/journal-access-notice", () => ({
  default: () => <div role="status">Verification unavailable. Try again.</div>,
}));

describe("server journal access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClaims.mockReset();
    mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
  });

  it("renders the journal for a verified user", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "verified-user" } }, error: null });

    render(await JournalPage());

    expect(screen.getByTestId("journal")).toHaveTextContent("verified-user");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects a missing session to a sign-in page that cannot auto-bounce", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });

    await expect(JournalPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/?auth=session");
  });

  it("redirects an explicit missing-session error to sign-in", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: { name: "AuthSessionMissingError" } });

    await expect(JournalPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/?auth=session");
  });

  it.each([
    { name: "AuthRetryableFetchError", status: 0 },
    { name: "AuthRetryableFetchError", status: 503 },
    { name: "AuthApiError", status: 500 },
  ])("shows a stable retry notice for a returned $name with status $status", async error => {
    mocks.getClaims.mockResolvedValue({ data: null, error });

    render(await JournalPage());

    expect(screen.getByRole("status")).toHaveTextContent("Verification unavailable");
    expect(screen.queryByTestId("journal")).not.toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("shows a stable retry notice if token verification throws", async () => {
    mocks.getClaims.mockRejectedValue(new TypeError("fetch failed"));

    render(await JournalPage());

    expect(screen.getByRole("status")).toHaveTextContent("Verification unavailable");
    expect(screen.queryByTestId("journal")).not.toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "", 123])("does not pass an invalid verified subject (%s) into the journal", async sub => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub } }, error: null });

    await expect(JournalPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/?auth=session");
  });
});
