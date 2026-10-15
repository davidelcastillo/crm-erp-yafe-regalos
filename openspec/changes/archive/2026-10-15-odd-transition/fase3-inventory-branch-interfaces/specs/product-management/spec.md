# Delta for Product Management

## ADDED Requirements

### Requirement: Category Selector in Product Form

The system MUST include a `CategorySelector` component in the product create/edit form. The selector SHALL list all categories, allow creating a new category inline via a modal, and display the selected category name.

#### Scenario: Select existing category
- GIVEN categories "General" and "Electronics" exist
- WHEN editing a product and clicking the category selector
- THEN the selector SHALL show both categories
- AND selecting "Electronics" SHALL update the form

#### Scenario: Create category inline
- GIVEN the product form is open and categories exist
- WHEN the user clicks "+ Nueva categoría"
- THEN a modal SHALL open to create a category
- AFTER creation, the new category SHALL be selected automatically

### Requirement: Product Active/Inactive Toggle

The system MUST provide an `active` toggle in the product edit form. Deactivating a product SHALL trigger a SweetAlert2 confirmation. Inactive products SHALL be excluded from product selectors in purchases, sales, and movements.

#### Scenario: Deactivate product with SweetAlert2
- GIVEN an admin editing an active product
- WHEN toggling active to false and confirming in SweetAlert2
- THEN the product SHALL have active=false
- AND it SHALL disappear from product selectors

#### Scenario: Inactive product excluded from selectors
- GIVEN Product A is inactive and Product B is active
- WHEN calling getProducts for purchase/sale selectors
- THEN only Product B SHALL be returned