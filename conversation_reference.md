# AI Penetration Dashboard - Consolidated Project Reference

This document serves as a permanent, human-readable record of all requirements, implementation details, and design decisions made during the dashboard enhancement project.

---

## 📋 1. Core Feature Requirements & Implementations

### A. FTE Defaults & Addressable FTE Evaluation
* **FTE Defaults**: Changed the default value of **Baseline FTE** and **Addressable FTE** to empty strings (`""`). Manual row additions (`+ Add Row`), inline updates, and bulk spreadsheet uploads now allow fields to remain blank.
* **Group-Based Addressable Evaluation (Release 2.8)**: 
  * If at least one row in a client+tower combination has a specified (non-blank) `Addressable FTE`, other blank rows in that same combination are treated as `0`.
  * If all rows in a client+tower combination have blank `Addressable FTE` inputs, they default to their baseline values (so that no validation errors trigger and single-row defaults work as before).
  * This is handled by a helper function `getRowAddressableFte(row)` and group summation `getClientTowerAddressable(client, tower, ...)`.
* **Layout Sizing Updates**:
  * **Proposed Asset (`initiative`)**: Width reduced by 25% (from `140px` to `105px`).
  * **Stack (`stack`)**: Added a manually editable free-text text field (width `70px`, exactly 50% of the original Proposed Asset width) next to the Status column.
  * **Impl. Cost ($) & $ Savings**: Reduced column widths by 10% to prevent header text wrapping.

### B. Calculations & Column Rules
* **Benefit % (formerly Release %)**: Changed formula to `Estimated FTE Benefit / AI Potential FTE`.
* **AI Potential %**: Added a new column positioned before *Benefit %* with the formula `AI Potential FTE / Addressable FTE` (using `getRowAddressableFte(row)` for the denominator).
* **Conditional Formatting**: Colored cell backgrounds of *Status*, *Benefit %*, and *AI Potential %* columns dynamically based on percent thresholds:
  * `≥ 50%`: Green (`#70ad47`)
  - `≥ 40% and < 50%`: Orange (`#ffc000`)
  - `≥ 20% and < 40%`: Gray (`#a6a6a6`)
  - `≥ 10% and < 20%`: Light Green (`#c6efce`)

### C. Dropdown Colors & Status Logic
* **Status Column**:
  * Default option changed from `"Select"` to `"Ideation"` (with a `#FFF` white background).
  * Selection dropdowns are locked (frozen) unless **Assessment Status** is set to `"Completed"` or `"In Progress"`.
  * Removed cell container background colors; styles now apply strictly within the dropdown select elements.
* **Assessment Status Column**:
  * Background colors styled strictly inside dropdown select elements (keeping parent `td` cells clean).
  * `"Completed"` option styled as Green (`#70ad47`).
  * `"In Progress"` option styled as Amber (`#ffc000`).

### D. Multi-Row Validation & Constraints
* **Addressable FTE Constraint**: Enforces $\sum \text{Addressable FTE} \le \max(\text{Base FTE})$ for each unique `Client + Tower` combination. Checked dynamically in `validateClientTowerFteConstraint()` and during uploads in `handleBulkUpload()`.
* **Asset Grid Exclusions**: Excludes rows from the Tab 2 Asset Grid if their Assessment Status on the input page is `"Not Started"` or `"No Scale"`.
* **No Duplicate Row Constraints**: Removed all duplicate row checks (warnings, blockages, or reversion controls) on the input page. Users can edit fields freely and create duplicate row combinations without interruption.

### E. Filter Synchronization
* **Corrected Sync Logic**: Fixed a bug where selecting dropdown filters immediately reverted back to their previous values. The filter application sequence in `applyFilters()` now extracts the active selections before writing the synchronized state across input and asset grid tabs, keeping selections responsive and stable.
* **Expanded Filters (Release 3.1)**: Added additional filter dropdown selections for **Type** (matching `initiativeType`) and **Status** (matching `decision` / Client Approval Decision, resolving empty entries as `Ideation`) to the operations bars on both the Input Dashboard and the Asset Mapping Grid tabs. The active filter states are automatically synchronized across both pages.

### F. Master List Dropdowns & Row Initializations
* **Client Master List (Modal)**: 
  * Seeding: Populated with all 59 client names from the user's dataset (ACCOR, Ahold, Alstom, Grupo Antolin, Danone, Sanofi, Trinseo, etc.).
  * Interactive Modal: Managed via a new `Clients` button inside the input page actions bar. Users can manually add, edit, and delete client names. Editing a client name automatically propagates to all rows mapped to it; deleting a client removes all corresponding rows.
* **Auto-Updates on Bulk Uploads**: Any new client name found in the uploaded spreadsheets is automatically added to the Client Master List, maintaining alphabetical order.
* **Input Grid Select Dropdowns**: Replaced the free-text input box in the Client Name and Proposed Asset columns of the main input dashboard grid with `<select>` dropdowns populated dynamically from the Client Master List and Assets master list respectively, guaranteeing clean data entry.
* **Proposed Asset Selection & Custom Entries**: The Proposed Asset dropdown contains all registered assets. It also features a `+ Enter Custom Asset...` option at the bottom. Selecting this option prompts the user for a custom asset name, automatically adds it to the Assets master list, and sets it as the row's initiative.
* **New Row Initial Values**: When clicking `+ Add Row`, the new row initializes with empty strings (`""`) for both Client Name and Tower (rendering `-- Select Client --` and `-- Select Tower --` as blank selections) instead of using static default values. This allows fields to remain blank initially without triggering premature validations.

---

## 📊 2. Tab Layout & Sharing Enhancements

### A. Client FTE Summary Tab
* Added a new page mapping:
  * **Client Name** (unique key).
  * **Client FTEs**: Calculated as $\sum \max(\text{Base FTE})$ grouped by unique `Client + Tower` combinations (to count only the maximum baseline headcount among duplicates).
  * **Total Addressable FTE**, **Total AI Potential FTE**, **Total Est. FTE Benefit**, and **Total Remaining Potential**: Simple column sums grouped by client (evaluating Addressable FTE via `getRowAddressableFte()`).
* **Width Restriction**: Table width is restricted to `50%` (max `960px`) to fit the left half of a 1080 screen, leaving the right half blank for future extensions.

### B. WhatsApp Sharing Integration
* Positioned directly in the operations subtitle bar next to the header title.
* Removed button backgrounds, padding, and borders to display the green/white SVG vector icon directly.
* Scaled the icon size up by 25% (to `20px`) for optimal inline proportion and added a smooth scale hover effect (`transform: scale(1.15);`).

---

## 🗃️ 3. Bulk Upload & Report Templates

* **Master Tracker Sheet**: Synced to reflect the new column order (`Stack` next to `Status`) and contains explicit tooltips stating that Baseline FTE and Addressable FTE can be whole numbers or left blank.
* **Instructions Tab**: Guidelines updated to document that empty cells for both Baseline and Addressable FTEs are parsed as blank in the system.
* **Asset Mapping Uploads**: Updated the spreadsheet parsing logic to map blank cells under "Addressable FTE" directly to empty strings in the dashboard data.
* **Robust Column Key Normalization**: The bulk upload parser now normalizes all headers in the uploaded Excel sheets by converting them to lowercase and removing all spaces, dots, ampersands, or parentheses. This guarantees that columns like `AI Potential FTE`, `Est FTE benefit`, `Client Name`, `Baseline FTE`, etc., are correctly mapped regardless of the user's spreadsheet casing or format variations.
* **Intelligent Sequential Upload Validations (Release 2.9)**:
  - Updates to `Baseline FTE`, `AI Potential FTE`, and `Estimated FTE Benefit` are parsed, compared, and applied in sequence.
  - Checks if a new `Baseline FTE` fits the current (or newly uploaded) `AI Potential FTE`, and if a new `AI Potential FTE` fits the new `Baseline FTE` and the current (or newly uploaded) `Estimated FTE Benefit`.
  - Ingests all valid updates, only discarding/reverting individual fields that explicitly breach control constraints rather than rejecting the whole row or creating inconsistent states.
  - Prevents missing columns from resetting existing values to `0`.
* **Excel Decimal Percent Handling (Release 2.10)**:
  - Automatically scales decimal percentages (e.g. `0.6` representing `60%` in Excel cells formatted as percentages) by multiplying them by 100, ensuring they map correctly to numeric benchmarks in the UI inputs.

---

## 🔒 4. Manual Save Model & State Persistence (Release 3.0)

* **No Automated Server Saves**: Disabled all auto-saves to prevent network overhead and browser download loops. Saves occur strictly when the user clicks the "Save to File" button in the header.
* **Timestamped Backups**: Saving state on the server generates both `data.json` and a timestamped backup file (`data_YYYY-MM-DD_HH-MM-SS.json`) containing the complete snapshot.
* **Restore Dropdown**: Added a dropdown select `<select id="backupSelect">` next to the Save button. Populates with the 5 most recent timestamped backups. Selecting a backup prompts the user and executes an HTTP POST to `/api/restore` to revert the system database state.
* **Reset Button**: Added a Reset button (`#resetBtn`) styled in Accenture digital red. Confirms with the user and clears all rows and cell assignments from the active browser memory (does not write to the server, allowing recovery via page refresh).
* **Disabled Polling**: Suspended background polling (`pollServer`) to prevent server values from wiping out unsaved local edits during active entry.

---

## ✉️ 5. Direct Email Follow-up Integration (Release 3.0)

* **Static Owner Label**: Replaced editable text inputs for the Owner column with a styled static text label that displays the active owner's name.
* **Owner Directory Modal**: Users manage Owner names and corresponding Outlook email addresses in the "Owners" configuration modal.
* **Direct Mail Button**: Renders a unicode envelope mail icon (`✉`) next to the owner name. Clicking the icon opens the user's default mail composer (e.g., Microsoft Outlook) via a `mailto:` link.
* **Detailed Row Data Injection**: Pre-populates the email Subject and Body dynamically with all row metrics (Client, Region, Tower, Baseline FTE, Addressable FTE, Assessment Status, Pipeline FTE, Asset, Status, Stack, Cost, and Savings) formatted as a clean key-value summary.
* **Quick Owner Swap**: Added a pencil icon (`✎`) next to the mail envelope. Clicking it replaces the static text with a select dropdown to swap owners in place.

---

## 📏 6. Grid Header Rotation & Sizing Customizations (Release 3.0)

* **Manually Resizable Columns**:
  - Embedded drag handles (`.resize-handle`) on header cell boundaries for Client columns (on both Input and Grid pages) and every single column in the Asset Mapping Grid (Client, Region, Tower, Base FTE, Addressable FTE, all Asset columns, and Future State FTE).
  - Tracks and stores custom widths in `customColWidths` locally. Widths persist across tab switching and grid updates.
* **Rotate Headers Toggle**:
  - Added a "Rotate Headers" checkbox on the Asset Mapping Grid.
  - Toggling it rotates the asset headers vertically (`writing-mode: vertical-rl; transform: rotate(180deg)`), collapsing their column widths to `25px`.
  - This supports high-density presentation, fitting up to 100 asset columns on a single screen without wrapping cell contents or causing overflow.
* **Accenture Accent Color Coding**:
  - The asset columns headers are styled with Accenture digital blue (`#0072c6`) to visually segregate the asset allocation matrix from base operational columns (styled in dark navy `#1f497d`).

---

## 🛠️ 7. Active Source Files
All modifications reside in the following workspace locations:
- 💻 **UI Layout & Templates**: [public/index.html](file:///C:/Users/milind.sawai/.gemini/antigravity/scratch/ai-penetration-dashboard/public/index.html)
- 🎨 **Visual Stylesheets**: [public/styles.css](file:///C:/Users/milind.sawai/.gemini/antigravity/scratch/ai-penetration-dashboard/public/styles.css)
- ⚙️ **Controller & Calculations**: [public/app.js](file:///C:/Users/milind.sawai/.gemini/antigravity/scratch/ai-penetration-dashboard/public/app.js)
- 💾 **Stored Database**: [data.json](file:///C:/Users/milind.sawai/.gemini/antigravity/scratch/ai-penetration-dashboard/data.json)
