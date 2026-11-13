import { renderHook, act } from "@testing-library/react";
import {
  PRODUCT_SORT_STORAGE_KEY,
  readStoredProductSort,
  useProductSortMode,
} from "./useProductSortMode";

const guardar = (value: string) => window.localStorage.setItem(PRODUCT_SORT_STORAGE_KEY, value);

beforeEach(() => {
  window.localStorage.clear();
});

describe("readStoredProductSort", () => {
  it("devuelve código cuando no hay nada guardado", () => {
    expect(readStoredProductSort()).toBe("code");
  });

  it("devuelve el modo guardado", () => {
    guardar("updated");
    expect(readStoredProductSort()).toBe("updated");
  });

  it("ignora un valor que no es un modo del sistema", () => {
    guardar("stock-desc");
    expect(readStoredProductSort()).toBe("code");
  });
});

describe("useProductSortMode", () => {
  it("arranca por código y cambia al modo pedido", () => {
    const { result } = renderHook(() => useProductSortMode());

    expect(result.current[0]).toBe("code");

    act(() => {
      result.current[1]("updated");
    });
    expect(result.current[0]).toBe("updated");
  });

  it("guarda el modo elegido para el próximo modal", () => {
    const { result } = renderHook(() => useProductSortMode());

    act(() => {
      result.current[1]("updated");
    });

    expect(window.localStorage.getItem(PRODUCT_SORT_STORAGE_KEY)).toBe("updated");
    // Un modal nuevo (montaje nuevo) lee lo que dejó el anterior.
    const otro = renderHook(() => useProductSortMode());
    expect(otro.result.current[0]).toBe("updated");
  });

  it("sigue funcionando si el navegador no deja guardar", () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("modo privado");
    });
    const { result } = renderHook(() => useProductSortMode());

    act(() => {
      result.current[1]("updated");
    });

    expect(result.current[0]).toBe("updated");
    setItem.mockRestore();
  });
});
