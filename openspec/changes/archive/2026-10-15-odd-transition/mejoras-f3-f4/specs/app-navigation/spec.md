# App Navigation Specification

## Purpose

Rules for the global navigation chrome (Navbar + BottomNav) per route, hiding the BottomNav on external branch portal paths while keeping the Navbar.

## Requirements

### Requirement: BottomNav oculto en /sucursal/*

The `BottomNav` SHALL NOT render when `usePathname()` starts with `/sucursal`. The `Navbar` SHALL remain visible on those paths. All other internal routes SHALL keep both chrome elements.

**Traza**: Item 6.

#### Scenario: Portal path hides BottomNav

- GIVEN the user is on /sucursal/5/inventory
- WHEN BottomNav evaluates the pathname
- THEN it SHALL render null

#### Scenario: Navbar kept on portal

- GIVEN the user is on /sucursal/5/inventory
- WHEN the page renders
- THEN the Navbar SHALL still be visible

#### Scenario: Internal routes unaffected

- GIVEN the user is on /inventario, /ventas, or /productos
- WHEN the pathname does not start with /sucursal
- THEN both Navbar and BottomNav SHALL render as usual

#### Scenario: Portal login also hidden

- GIVEN the user is on the portal login route under /sucursal/*
- WHEN the pathname starts with /sucursal
- THEN the BottomNav SHALL NOT render
