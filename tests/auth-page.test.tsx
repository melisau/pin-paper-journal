import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthForm from "@/components/auth-form";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  restoreKey: vi.fn(),
  router: { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {
  getSession: mocks.getSession,
  refreshSession: mocks.refreshSession,
  signInWithPassword: mocks.signIn,
} }) }));
vi.mock("@/lib/key-vault", () => ({
  hasAccountMasterKey: () => false,
  isHighSecurityMode: () => false,
  restoreAccountMasterKey: mocks.restoreKey,
  setAccountMasterKey: vi.fn(),
  setHighSecurityMode: vi.fn(),
}));
vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: () => null,
  useLanguage: () => ({ t: (value: string) => value }),
}));

function fillAndSubmitCredentials() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Open my journals" }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signIn.mockReset();
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.refreshSession.mockReset();
  mocks.restoreKey.mockReset().mockResolvedValue(true);
  sessionStorage.clear();
  localStorage.clear();
});

describe("sign-in failure handling", () => {
  it("shows a safe diagnostic code and permits retry after a request failure", async () => {
    mocks.signIn.mockRejectedValue(Object.assign(new Error("private network detail"), { name: "AuthRetryableFetchError" }));
    render(<AuthForm/>);
    fillAndSubmitCredentials();
    expect(await screen.findByRole("status")).toHaveTextContent("AuthRetryableFetchError");
    expect(screen.getByRole("button", { name: "Open my journals" })).toBeEnabled();
    expect(screen.getByRole("status")).not.toHaveTextContent("private network detail");
  });

  it("still navigates if optional timing diagnostics fail", async () => {
    mocks.signIn.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const dispatch = vi.spyOn(window, "dispatchEvent").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    try {
      render(<AuthForm/>);
      fillAndSubmitCredentials();
      await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/journal"));
    } finally {
      dispatch.mockRestore();
    }
  });
});

describe("automatic sign-in redirect protection", () => {
  const existingSession = { data: { session: { user: { id: "user-1" } } }, error: null };

  it.each(["session", "key"])("keeps the sign-in form stable after an auth=%s redirect, including StrictMode", async authIssue => {
    mocks.getSession.mockResolvedValue(existingSession);
    render(<StrictMode><AuthForm authIssue={authIssue}/></StrictMode>);

    expect(await screen.findByRole("status")).not.toBeEmptyDOMElement();
    expect(screen.getByRole("button", { name: "Open my journals" })).toBeEnabled();
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.refreshSession).not.toHaveBeenCalled();
    expect(mocks.restoreKey).not.toHaveBeenCalled();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("restores a remembered session and navigates only once under StrictMode", async () => {
    mocks.getSession.mockResolvedValue(existingSession);
    render(<StrictMode><AuthForm/></StrictMode>);

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/journal"));
    expect(mocks.router.replace).toHaveBeenCalledTimes(1);
    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });

  it("cancels a pending key restore when the same sign-in page receives a session failure", async () => {
    const restore = deferred<boolean>();
    mocks.getSession.mockResolvedValue(existingSession);
    mocks.restoreKey.mockReturnValue(restore.promise);
    const view = render(<AuthForm/>);
    await waitFor(() => expect(mocks.restoreKey).toHaveBeenCalled());

    view.rerender(<AuthForm authIssue="session"/>);
    await act(async () => { restore.resolve(true); });

    expect(await screen.findByRole("status")).not.toBeEmptyDOMElement();
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });

  it("does not navigate when a key restore finishes after unmount", async () => {
    const restore = deferred<boolean>();
    mocks.getSession.mockResolvedValue(existingSession);
    mocks.restoreKey.mockReturnValue(restore.promise);
    const view = render(<AuthForm/>);
    await waitFor(() => expect(mocks.restoreKey).toHaveBeenCalled());

    view.unmount();
    await act(async () => { restore.resolve(true); });

    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("does not let a background key restore override a manual sign-in attempt", async () => {
    const restore = deferred<boolean>();
    mocks.getSession.mockResolvedValue(existingSession);
    mocks.restoreKey.mockReturnValue(restore.promise);
    mocks.signIn.mockResolvedValue({ data: { user: null }, error: { message: "Invalid login credentials" } });
    render(<AuthForm/>);
    await waitFor(() => expect(mocks.restoreKey).toHaveBeenCalled());

    fillAndSubmitCredentials();
    expect(await screen.findByRole("status")).toHaveTextContent("Invalid login credentials");
    await act(async () => { restore.resolve(true); });

    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Open my journals" })).toBeEnabled();
  });

  it("allows deliberate sign-in after an automatic redirect was blocked", async () => {
    mocks.signIn.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    render(<AuthForm authIssue="session"/>);
    await screen.findByRole("status");

    fillAndSubmitCredentials();

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/journal"));
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
    expect(mocks.router.replace).toHaveBeenCalledTimes(1);
  });
});
