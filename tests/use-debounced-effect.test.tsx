import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebouncedEffect } from "@/lib/use-debounced-effect";

function Example({ onSave }: { onSave: (value: string) => void }) {
  const [value, setValue] = useState("");
  useDebouncedEffect(() => onSave(value), [value], 1000);
  return <input aria-label="Entry" value={value} onChange={event => setValue(event.target.value)} />;
}

describe("useDebouncedEffect", () => {
  afterEach(() => vi.useRealTimers());

  it("runs once 1000ms after editing stops and clears replaced timers", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    render(<Example onSave={onSave} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Entry" }), { target: { value: "a" } });
    act(() => vi.advanceTimersByTime(700));
    fireEvent.change(screen.getByRole("textbox", { name: "Entry" }), { target: { value: "ab" } });
    act(() => vi.advanceTimersByTime(999));
    expect(onSave).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenLastCalledWith("ab");
  });
});
