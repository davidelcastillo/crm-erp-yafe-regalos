import { renderHook, act } from "@testing-library/react";
import { useReloadKey } from "./useReloadKey";

describe("useReloadKey", () => {
  it("starts at 0 and increments on bump", () => {
    const { result } = renderHook(() => useReloadKey());

    expect(result.current[0]).toBe(0);

    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(1);

    act(() => {
      result.current[1]();
      result.current[1]();
    });
    expect(result.current[0]).toBe(3);
  });

  it("keeps a stable bump identity across renders", () => {
    const { result, rerender } = renderHook(() => useReloadKey());
    const firstBump = result.current[1];

    rerender();
    expect(result.current[1]).toBe(firstBump);
  });
});
