# Bugfix Requirements Document

## Introduction

The spot popup on the Jekyll site has a significantly different layout and content structure compared to the original Gatsby site design. The popup is missing key sections (category header, description, "Potentially Usable By" with bullet list), displays paddle craft types as raw slugs instead of translated names, uses icon-only copy buttons instead of text "Copy" buttons, and has different button labels. This affects both the `spot-popup.html` include template and the `spot-popup.js` JavaScript module that generates popups dynamically on the map.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a spot popup is displayed THEN the header row shows the spot icon and the spot title on the same line, with no separate category label (e.g., "Entry and Exit" or "Ein- und Ausstieg")

1.2 WHEN a spot popup is displayed for a spot with paddle craft types THEN the types are shown as comma-separated raw slugs (e.g., "seekajak, kanadier, stand-up-paddle-board") with a generic "Typ"/"Type" label instead of a "Potentially Usable By" / "Potenziell nutzbar für" label with a bullet list of human-readable translated names

1.3 WHEN a spot popup is displayed with GPS coordinates or an approximate address THEN the copy buttons show only an SVG clipboard icon with no visible "Copy" / "Kopieren" text label

1.4 WHEN a spot popup is displayed with GPS coordinates THEN the navigate button text reads "Navigieren" / "Navigate" instead of "Navigieren zu" / "Navigate To"

1.5 WHEN a spot popup is displayed THEN the overall layout order is: header (icon + title) → description → GPS → address → craft types → action buttons, which differs from the original design where the title appears large below the category header, and craft types appear as a labeled bullet list before the action buttons

### Expected Behavior (Correct)

2.1 WHEN a spot popup is displayed THEN the header row SHALL show the spot icon and the translated spot type category label (e.g., "Entry and Exit" / "Ein- und Ausstieg"), followed by a divider, and then the spot title displayed prominently below the header as a large heading

2.2 WHEN a spot popup is displayed for a spot with paddle craft types THEN the system SHALL show a "Potentially Usable By:" / "Potenziell nutzbar für:" label followed by a bullet list of human-readable translated paddle craft type names (e.g., "Sea Kayak", "Canoe", "Stand Up Paddle Board (SUP)")

2.3 WHEN a spot popup is displayed with GPS coordinates or an approximate address THEN the copy buttons SHALL be text-only buttons displaying translated text "Copy" / "Kopieren" with no clipboard icon, to maximise accessibility

2.4 WHEN a spot popup is displayed with GPS coordinates THEN the navigate button text SHALL read "Navigate To" / "Navigieren zu"

2.5 WHEN a spot popup is displayed THEN the layout order SHALL be: category header (icon + type label) → divider → large spot title → description → "Potentially Usable By" bullet list → GPS with copy button → approximate address with copy button → action buttons (Navigate To + More details)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a spot popup is displayed for a spot without a description THEN the system SHALL CONTINUE TO omit the description section

3.2 WHEN a spot popup is displayed for a spot without GPS coordinates THEN the system SHALL CONTINUE TO omit the GPS section and the navigate button

3.3 WHEN a spot popup is displayed for a spot without an approximate address THEN the system SHALL CONTINUE TO omit the address section

3.4 WHEN a spot popup is displayed for a spot without paddle craft types THEN the system SHALL CONTINUE TO omit the craft types section

3.5 WHEN a rejected spot popup is displayed THEN the system SHALL CONTINUE TO show the rejection-specific popup layout with no-entry icon and rejection reason

3.6 WHEN the "More details" link is clicked THEN the system SHALL CONTINUE TO navigate to the correct spot detail page with the proper locale prefix

3.7 WHEN the copy button for GPS or address is clicked THEN the system SHALL CONTINUE TO copy the correct value to the clipboard
