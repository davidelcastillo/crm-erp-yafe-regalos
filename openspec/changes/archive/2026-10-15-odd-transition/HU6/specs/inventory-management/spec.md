# Delta for inventory-management

## ADDED Requirements

### Requirement: Label Print Access from Inventory List

The `/inventario` page MUST include an "Imprimir Etiquetas" button in its page header that opens the LabelSelector modal for generating PDF labels.

#### Scenario: Button visible in header
- GIVEN the user is on /inventario
- WHEN the page renders
- THEN an "Imprimir Etiquetas" button SHALL be visible in the page header

#### Scenario: Button triggers label selector modal
- GIVEN the user is on /inventario
- WHEN clicking "Imprimir Etiquetas"
- THEN the LabelSelector modal SHALL open with product search available