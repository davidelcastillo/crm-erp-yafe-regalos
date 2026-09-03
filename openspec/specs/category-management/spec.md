# Category Management Specification

## Purpose

Enable CRUD management of product categories. Categories serve as a grouping mechanism for inventory filtering and organization. Deleting a category with associated products SHALL be blocked.

## Requirements

### Requirement: Create Category

The system MUST provide a Server Action to create a category with name (required), description, and color. Duplicate names MUST be rejected.

#### Scenario: Create category successfully
- GIVEN valid category data (name "Electronics", description "Electronic products")
- WHEN calling the create category action
- THEN a category SHALL be created with the given name and description
- AND the action SHALL return the created category with an id

#### Scenario: Duplicate name rejected
- GIVEN an existing category named "Electronics"
- WHEN creating another category with the same name
- THEN the action SHALL reject with DUPLICATE_NAME error

### Requirement: Read Categories

The system MUST list all categories sorted by name. A detail view SHALL return a single category by id.

#### Scenario: List all categories
- GIVEN 3 categories: "Electronics", "Food", "Clothing"
- WHEN calling list categories
- THEN all 3 SHALL return sorted alphabetically

### Requirement: Update Category

The system MUST update any editable field of an existing category.

#### Scenario: Update category details
- GIVEN an existing category "Electronics"
- WHEN updating the name to "Home Electronics"
- THEN the category SHALL reflect the new name

### Requirement: Delete Category

The system MUST NOT delete a category that has associated products. Only empty categories MAY be deleted.

#### Scenario: Delete category with products blocked
- GIVEN a category with 5 associated products
- WHEN attempting to delete
- THEN the action SHALL reject with HAS_PRODUCTS

#### Scenario: Delete empty category succeeds
- GIVEN a category with zero products
- WHEN deleting
- THEN the category SHALL be permanently removed