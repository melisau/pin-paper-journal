import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthPage from "@/app/page";

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), replace: vi.fn(), restoreKey: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, push: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {
  getSession: async () => ({ data: { session: null } }),
  signInWithPassword: mocks.signIn,
} }) }));
vi.mock("@/lib/key-vault", () => ({
  isHighSecurityMode: () => false,
  restoreAccountMasterKey: mocks.restoreKey,
  setAccountMasterKey: vi.fn(),
  setHighSecurityMode: vi.fn(),
}));
vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: () => null,
  useLanguage: () => ({ t: (value: string) => value }),
}));

function submitCredentials() {
  render(<AuthPage/>);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Open my journals" }));
}

describe("sign-in failure handling", () => {
  beforeEach(() => {
    mocks.signIn.mockReset();
    mocks.replace.mockReset();
    mocks.restoreKey.mockResolvedValue(true);
  });

  it("shows a safe diagnostic code and permits retry after a request failure", async () => {
    mocks.signIn.mockRejectedValue(Object.assign(new Error("private network detail"), { name: "AuthRetryableFetchError" }));
    submitCredentials();
    expect(await screen.findByRole("status")).toHaveTextContent("AuthRetryableFetchError");
    expect(screen.getByRole("button", { name: "Open my journals" })).toBeEnabled();
    expect(screen.getByRole("status")).not.toHaveTextContent("private network detail");
  });

  it("still navigates if optional timing diagnostics fail", async () => {
    mocks.signIn.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const dispatch = vi.spyOn(window, "dispatchEvent").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    try {
      submitCredentials();
      await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/journal"));
    } finally {
      dispatch.mockRestore();
    }
  });
});
