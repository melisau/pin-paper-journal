import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(), getUser: vi.fn(), updateUser: vi.fn(), single: vi.fn(), updateEq: vi.fn(),
  rewrap: vi.fn(), setMaster: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/lib/crypto", () => ({ rewrapAccountKeyWithRecovery: mocks.rewrap }));
vi.mock("@/lib/key-vault", () => ({ setAccountMasterKey: mocks.setMaster }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({
  auth: { getUser: mocks.getUser, updateUser: mocks.updateUser },
  from: () => ({
    select: () => ({ eq: () => ({ single: mocks.single }) }),
    update: () => ({ eq: mocks.updateEq }),
  }),
}) }));

import { RecoveryForm } from "@/components/recovery-form";

describe("password recovery form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.single.mockResolvedValue({ data: { wrapped_by_recovery: { ciphertext: "wrapped" } }, error: null });
    mocks.rewrap.mockResolvedValue({ masterKey: { type: "secret" }, wrappedByPassword: { ciphertext: "new-wrap" } });
    mocks.updateUser.mockResolvedValue({ error: null });
    mocks.updateEq.mockResolvedValue({ error: null });
  });

  it("updates auth, stores the new key wrap, and unlocks the journals", async () => {
    render(<RecoveryForm/>);
    fireEvent.change(screen.getByLabelText("Recovery code"), { target: { value: "recovery-secret" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-long-password" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "new-long-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password & unlock" }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/journal"));
    expect(mocks.rewrap).toHaveBeenCalledWith({ ciphertext: "wrapped" }, "recovery-secret", "new-long-password");
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "new-long-password" });
    expect(mocks.updateEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mocks.setMaster).toHaveBeenCalledWith({ type: "secret" });
    expect(mocks.updateUser.mock.invocationCallOrder[0]).toBeLessThan(mocks.updateEq.mock.invocationCallOrder[0]);
  });

  it("does not contact Supabase when password confirmation differs", () => {
    render(<RecoveryForm/>);
    fireEvent.change(screen.getByLabelText("Recovery code"), { target: { value: "recovery-secret" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-long-password" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "different-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password & unlock" }));
    expect(screen.getByRole("status")).toHaveTextContent("do not match");
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});
