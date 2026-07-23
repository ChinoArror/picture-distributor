# SnapClass UI Implementation Rules

## Visual Fidelity Requirement

This project must follow the provided design reference screenshots in `/design-references`.

The implementation must prioritize visual fidelity over creative redesign. Do not invent a new visual style.

## Design System

Use one consistent design system across all pages.

Core visual language:
- Clean modern SaaS dashboard style
- White and very light gray backgrounds
- Purple / indigo primary accent
- Rounded cards and buttons
- Soft shadows
- Spacious desktop layout
- Crisp typography
- Photography-oriented UI with image grids and gallery interactions

## Shared Layout Rules

Every page must include:
- Top header
- App icon and `SnapClass` wordmark on the top left
- Light/dark mode toggle in the top bar
- User avatar and username on the top right

Admin pages must include:
- Left admin sidebar
- Admin navigation
- Consistent active state
- Same card/table/button styles as the reference images

User pages must include:
- User sidebar where appropriate
- Gallery, My Downloads, Account navigation
- Face upload/selfie area
- Photo grid with selection checkboxes
- Download actions

## Components

Create reusable components for:
- AppHeader
- ThemeToggle
- UserMenu
- Sidebar
- Button
- Card
- PhotoCard
- PhotoGrid
- SelectionToolbar
- AdminTable
- VisibilitySwitch
- ModalLightbox

Do not duplicate styles separately for each page.

## Styling Constraints

Do not mix unrelated UI libraries or styles.
Do not use default browser-looking controls.
Do not use random colors.
Do not change the overall spacing system between pages.
Do not create inconsistent button sizes or corner radii.

Use design tokens for:
- colors
- typography
- spacing
- radii
- shadows
- borders

## Implementation Order

1. Extract design tokens from screenshots.
2. Build shared layout and components.
3. Implement landing page.
4. Implement user photo matching page.
5. Implement user photo preview modal.
6. Implement admin login page.
7. Implement admin class management page.
8. Implement admin class detail / photo management page.
9. Run the app and visually compare each page with the screenshots.
10. Fix spacing, colors, font sizes, and component inconsistencies.

## Acceptance Criteria

The UI is acceptable only if:
- Pages look like one coherent product.
- Header is consistent across all pages.
- Sidebar style is consistent across admin pages.
- Buttons, cards, switches, tables, and photo grids share the same visual system.
- The implementation resembles the screenshots closely.
- No page looks like a different template or unrelated design.