/**
 * @jest-environment jsdom
 *
 * Unit tests for BranchManager UI (delta branch-management-ui):
 *   - Checkbox "Sucursal pública" (isPublic) in create/edit modes
 *   - Badge "Pública" in the list, only for isPublic === true
 *   - Portal button linking to /sucursal/<id>/inventory
 *   - handleSubmit forwarding isPublic in create/update payloads
 *
 * Acceptance criteria sourced from:
 *   - openspec/specs/branch-management-ui/spec.md (scenarios 1-4)
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BranchManager } from "./BranchManager";

const mockCreateBranch = jest.fn();
const mockUpdateBranch = jest.fn();
const mockDeleteBranch = jest.fn();
const mockGetBranches = jest.fn();

jest.mock("@/app/actions/branch", () => ({
  createBranch: (...args: unknown[]) => mockCreateBranch(...args),
  updateBranch: (...args: unknown[]) => mockUpdateBranch(...args),
  deleteBranch: (...args: unknown[]) => mockDeleteBranch(...args),
  getBranches: (...args: unknown[]) => mockGetBranches(...args),
}));

jest.mock("next/link", () => {
  const MockLink = ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

jest.mock("sweetalert2", () => ({
  fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
}));

const branch = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: "Principal",
  address: null,
  phone: null,
  email: null,
  isActive: true,
  isPublic: false,
  code: "PRIN",
  ...overrides,
});

describe("BranchManager (delta branch-management-ui)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the Pública badge only for branches with isPublic === true", () => {
    render(
      <BranchManager
        branches={[
          branch({ id: 5, name: "Norte", isPublic: true }),
          branch({ id: 6, name: "Sur", isPublic: false }),
        ]}
      />
    );

    expect(screen.getByText("Norte")).toBeInTheDocument();
    expect(screen.getByText("Sur")).toBeInTheDocument();
    // Exactly one badge: the public branch, not the private one
    expect(screen.getAllByText("Pública")).toHaveLength(1);
  });

  it("links the Portal button to the public inventory route with a descriptive label", () => {
    render(
      <BranchManager
        branches={[branch({ id: 39, name: "Norte", isPublic: true })]}
      />
    );

    const portalLink = screen.getByRole("link", {
      name: "Ver portal de Norte",
    });
    expect(portalLink).toHaveAttribute("href", "/sucursal/39/inventory");
    expect(portalLink).toHaveTextContent("Portal");
  });

  it("renders the Sucursal pública checkbox unchecked in create mode (opt-in default)", () => {
    render(<BranchManager branches={[branch()]} />);
    fireEvent.click(screen.getByRole("button", { name: "Nueva sucursal" }));

    expect(screen.getByLabelText("Sucursal pública")).not.toBeChecked();
    // Existing isActive default stays true
    expect(screen.getByLabelText("Sucursal activa")).toBeChecked();
  });

  it("preloads isPublic from the branch when editing a public branch", () => {
    render(
      <BranchManager
        branches={[branch({ id: 7, name: "Sur", isPublic: true })]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Editar Sur" }));

    expect(screen.getByLabelText("Sucursal pública")).toBeChecked();
  });

  it("leaves the Sucursal pública checkbox unchecked when editing a private branch", () => {
    render(
      <BranchManager
        branches={[branch({ id: 8, name: "Este", isPublic: false })]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Editar Este" }));

    expect(screen.getByLabelText("Sucursal pública")).not.toBeChecked();
  });

  it("sends isPublic: true in the create payload when the checkbox is checked", async () => {
    mockCreateBranch.mockResolvedValue({
      success: false,
      error: "DUPLICATE_CODE",
    });
    render(<BranchManager branches={[branch()]} />);
    fireEvent.click(screen.getByRole("button", { name: "Nueva sucursal" }));

    fireEvent.change(screen.getByPlaceholderText("Nombre de la sucursal"), {
      target: { value: "Sucursal Test" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ej. CEN"), {
      target: { value: "TEST" },
    });
    fireEvent.click(screen.getByLabelText("Sucursal pública"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(mockCreateBranch).toHaveBeenCalledTimes(1));
    expect(mockCreateBranch).toHaveBeenCalledWith(
      expect.objectContaining({ isPublic: true })
    );
  });

  it("muestra cada sucursal como un ítem de la lista, con su nombre y su estado", () => {
    render(
      <BranchManager
        branches={[
          branch({ id: 1, name: "Central", isActive: true }),
          branch({ id: 9, name: "Depósito", isActive: false }),
        ]}
      />
    );

    // Una card por sucursal: la lista se lee como lista, no como divs sueltos.
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Central");
    expect(items[0]).toHaveTextContent("Principal");
    expect(items[1]).toHaveTextContent("Depósito");
    expect(items[1]).toHaveTextContent("Inactiva");
  });

  it("sends isPublic: false in the update payload when a public branch is un-checked", async () => {
    mockUpdateBranch.mockResolvedValue({
      success: false,
      error: "Error al actualizar la sucursal",
    });
    render(
      <BranchManager
        branches={[branch({ id: 7, name: "Sur", isPublic: true })]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Editar Sur" }));

    fireEvent.click(screen.getByLabelText("Sucursal pública")); // uncheck
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(mockUpdateBranch).toHaveBeenCalledTimes(1));
    expect(mockUpdateBranch).toHaveBeenCalledWith(
      expect.objectContaining({ isPublic: false })
    );
  });
});