# App Functions & Calculation Logic Technical Reference

This document provides a comprehensive technical reference of all JavaScript functions defined in `public/app.js` (accurate as of version v1.6.1), including their exact line references, purposes, and calculation formulas.

---

## Core Calculation Logics & Formulas

### 1. Client FTEs
* **Tab Location**: Client FTE Summary (`tab-client-summary`)
* **Formula**:
  $$\text{Client FTEs} = \sum_{t \in \text{Towers}} \max_{r \in \text{Rows}(c, t)} (\text{Base FTE}_r)$$
  For each client, rows are grouped by unique towers. The maximum baseline FTE for each tower is identified, and these maximum values are summed to compute the overall baseline for that client.

### 2. Addressable FTE (Blank Value Treatment)
* **Function**: `getRowAddressableFte(row)`
* **Behavior**:
  * In table totals and the Client FTE Summary tab, empty or blank `addressableFte` inputs are evaluated as `0`.
  * For validation constraints (e.g. comparing AI Potential to Addressable FTE), a blank `addressableFte` defaults to the row's `baseFte` (Baseline FTE) to allow pipeline values up to baseline.

### 3. AI Potential %
* **Formula**:
  $$\text{AI Potential \%} = \frac{\text{Pipeline FTE}}{\text{Addressable FTE}} \times 100$$
  If `Addressable FTE` is `0` or blank, the result is `0.0%`.

### 4. Benefit %
* **Formula**:
  $$\text{Benefit \%} = \frac{\text{Est. FTE Benefit}}{\text{Pipeline FTE}} \times 100$$
  If `Pipeline FTE` is `0` or blank, the result is `0.0%`.

### 5. Variance %
* **Formula**:
  $$\text{Variance \%} = \text{Benefit \%} - \text{Benchmark \%}$$
  * `Benchmark %` is manually specified per row (defaults to 20%).
  * The result is highlighted in green if positive (e.g. `+31.7%`) or red if negative.

### 6. Remaining Potential
* **Formula**:
  $$\text{Remaining Potential} = \text{Pipeline FTE} - \text{Est. FTE Benefit}$$

### 7. Total Portfolio Calculations (Footer Row)
* **Total Baseline FTE**: $\sum \text{baseFte}$
* **Total Addressable FTE**: $\sum \text{getRowAddressableFte}(r)$
* **Total AI Potential FTE**: $\sum \text{pipelineFte}$
* **Total Realized FTE**: $\sum \text{realizedFte}$
* **Total Portfolio AI Potential %**:
  $$\text{Portfolio AI Potential \%} = \frac{\text{Total Pipeline}}{\text{Total Baseline}} \times 100$$
* **Total Portfolio Variance %**:
  $$\text{Portfolio Variance \%} = \text{Portfolio Benefit \%} - \text{Average Benchmark \%}$$
  where:
  $$\text{Portfolio Benefit \%} = \frac{\sum \text{estimatedFteBenefit}}{\text{Total Pipeline}}$$
  $$\text{Average Benchmark \%} = \frac{\sum \text{benchmark}}{\text{Count of benchmarked rows}}$$

---

## Function Directory & Line References

### 1. State Management & API Sync
| Line | Function | Description |
|------|----------|-------------|
| 100 | `setupNavigation()` | Sets up click listeners for the tabs to toggle visibility and load corresponding views. |
| 121 | `getApiUrl(path)` | Utility to return host-relative API endpoints. |
| 128 | `loadBackupsList()` | Fetches available backups from the `/api/backups` endpoint and updates the restore dropdown. |
| 147 | `handleRestoreBackup(fileName)` | Posts backup selection to `/api/restore` to overwrite the current database state. |
| 194 | `handleResetState()` | Clears client data, resets state, and resets table display after confirmation. |
| 221 | `loadData()` | Fetches active state from `/api/data` and initializes properties for backward compatibility. |
| 273 | `saveData(manual = false)` | Posts current state as JSON to `/api/data` and handles timestamped server backups. |
| 300 | `pollServer()` | Periodically syncs list of backups from server (auto-polling for data changes is disabled). |

### 2. Helpers & Utilities
| Line | Function | Description |
|------|----------|-------------|
| 327 | `showStatus(text, type)` | Renders a toast message at the bottom right of the page. |
| 337 | `escHtml(s)` | Escapes HTML special characters to prevent cross-site scripting (XSS). |
| 341 | `isAssessmentActive(a)` | Returns true if the assessment is in `In Progress` or `Completed` states. |
| 345 | `getTowerBenchmark(tower)` | Resolves standard baseline benchmarks (e.g. RTR: 40%, PTP/OTC: 60%). |
| 354 | `getDecisionColorClass(d)` | Maps Client approval dropdown status to styling classes. |
| 363 | `getAssessmentColorClass(val)` | Maps Assessment status to CSS background colors. |
| 369 | `getPctColorClass(pctValue)` | Returns conditional format classes based on percentage thresholds. |
| 378 | `getCellStatusClass(s)` | Resolves CSS background color style for N×M cell allocation. |
| 386 | `getUniqueClientCount(...)` | Counts unique clients in the state (capped at 500 max). |
| 395 | `getTowerCountForClient(...)` | Validates that a single client doesn't exceed 8 towers. |
| 404 | `savePrev(key, val)` | Stores previous input values in memory for undo/revert actions. |
| 406 | `isDuplicateRow(...)` | Checks for key collisions (Client + Tower + Region + Asset). |
| 410 | `getFormattedDateTime()` | Formats current timestamp for export file naming. |
| 425 | `downloadJsonState()` | Prompts user to save JSON data backup file locally. |

### 3. Filter & Sort Logic
| Line | Function | Description |
|------|----------|-------------|
| 437 | `handleRegionChange(...)` | Updates region field on a row. |
| 449 | `updateFilterDropdowns()` | Re-populates filter selections based on active matching rows. |
| 528 | `getActiveFilters()` | Returns an array of keys representing active filters. |
| 541 | `applyFilters()` | Re-renders tabs and dashboards based on active selection filters. |
| 567 | `clearFilters()` | Resets all active selection filters to empty. |
| 590 | `getFilteredRows()` | Filters rows by matching dropdown selections. |
| 724 | `handleSort(col)` | Toggles sorting direction (asc, desc, null) on click. |
| 735 | `getSortedRows()` | Returns filtered rows sorted by active criteria. |

### 4. Addressable FTE & Validation Rules
| Line | Function | Description |
|------|----------|-------------|
| 615 | `makeColumnResizable(...)` | Binds drag handlers to column header cells to resize tables. |
| 658 | `getRowAddressableFte(row)` | Resolves a row's addressable FTE (returns 0 if empty). |
| 665 | `getClientTowerAddressable(...)` | Accumulates addressable FTE for a given client + tower. |
| 674 | `getMaxBaseFteForClientTower(...)` | Computes maximum baseline FTE defined for a client-tower combo. |
| 686 | `validateClientTowerFteConstraint(...)` | Enforces that total addressable FTE <= max baseline FTE. |

### 5. Input Table Rendering & Headers
| Line | Function | Description |
|------|----------|-------------|
| 769 | `renderInputTableHeader()` | Renders table headers with resizers and sort triggers. |
| 811 | `renderInputTable()` | Dynamically compiles input table rows, cells, and totals footer. |
| 1079 | `handleRowInputChange(...)` | Validates and saves edits on input cells. |
| 1094 | `validateRowUpdate(...)` | Enforces constraints prior to updating row data. |

### 6. Change Handlers (Inline Inputs)
| Line | Function | Description |
|------|----------|-------------|
| 1111 | `handleTowerChange(rowId, value)` | Validates and updates a row's tower. |
| 1124 | `handleClientChange(rowId, val)` | Updates a row's client, validating max tower bounds. |
| 1143 | `handleTowerChange(rowId, value)` | Enforces client tower thresholds. |
| 1178 | `handleProcessChange(rowId, value)` | Updates a row's process. |
| 1187 | `handleBaseFteChange(rowId, input)` | Handles edits to Base FTE, enforcing `Base >= Addressable` and `Base >= AI Potential`. |
| 1203 | `handleAddressableFteChange(rowId, input)` | Enforces `Addressable <= Base`, `Addressable >= AI Potential`, and sum threshold. |
| 1245 | `handlePipelineFteChange(rowId, input)` | Enforces `AI Potential <= Addressable`, `AI Potential >= Realized`, and `AI Potential >= Est. Benefit`. |
| 1281 | `handleRealizedFteChange(rowId, input)` | Enforces `Realized FTE <= AI Potential FTE`. |
| 1310 | `handleFteBenefitChange(rowId, valStr)` | Enforces `Est. Benefit <= AI Potential FTE` and syncs cell mappings. |
| 1351 | `handleAssessmentChange(rowId, value)` | Updates assessment status. |
| 1358 | `updateRowField(rowId, field, value)`| Generic cell field update handler. |
| 1365 | `handleSavingsChange(rowId, input)` | Processes implementation savings. |
| 1381 | `handleDecisionDropdownChange(rowId, value)` | Syncs client decisions and changes status background styling. |
| 1401 | `handleProposedAssetChange(rowId, val)` | Maps initiative changes. |

### 7. Owner & Action Plan Editors
| Line | Function | Description |
|------|----------|-------------|
| 1445 | `startOwnerEdit(rowId)` | Toggles dropdown edit mode for a row owner. |
| 1450 | `cancelOwnerEdit()` | Discards owner changes and exits edit mode. |
| 1455 | `handleOwnerDropdownChange(...)` | Saves selection for row owner. |
| 1465 | `startClientOwnerEdit(client)` | Toggles client owner dropdown edit on the Summary tab. |
| 1470 | `cancelClientOwnerEdit()` | Exits summary owner edit mode. |
| 1475 | `handleClientOwnerChange(...)` | Synchronizes owner across all rows of the client. |
| 1484 | `handleRowActionPlanChange(...)` | Enforces 35-word limit and saves row action plan. |
| 1498 | `handleClientActionPlanChange(...)` | Enforces 35-word limit and syncs action plan across client rows. |
| 1555 | `handleClientHelpRequiredChange(...)` | Enforces 35-word limit and syncs Help Required across all client rows. |
| 1568 | `handleClientHelpRequiredFromWhomChange(...)` | Enforces 35-word limit and syncs Help Required From Whom across all client rows. |

### 8. Autocomplete & Suggestions
| Line | Function | Description |
|------|----------|-------------|
| 1514 | `showInitiativeSuggestions(...)` | Placeholder autocomplete handler. |
| 1516 | `filterInitiativeSuggestions(...)` | Matches custom entries to the assets index. |
| 1528 | `selectInitiative(rowId, asset)` | Assigns suggestion to row. |
| 1536 | `handleInitiativeInputChange(...)` | Captures key events in the autocomplete text field. |

### 9. Row Operations
| Line | Function | Description |
|------|----------|-------------|
| 1592 | `handleAddRow()` | Adds a blank row to the state. |
| 1619 | `handleDeleteRow(rowId)` | Removes a row from memory and saves. |

### 10. Asset Grid Matrix Popover
| Line | Function | Description |
|------|----------|-------------|
| 1628 | `renderAssetGrid()` | Compiles the N×M matrix mapping. |
| 1718 | `toggleHeaderRotation(checked)` | Adjusts visual writing-mode style of column headers. |
| 1725 | `openCellPopover(...)` | Renders coordinates popover to allocate cell FTE. |
| 1741 | `selectPopoverStatus(s)` | Handles status selection inside popover. |
| 1743 | `updatePopoverBadgeSelection()` | Syncs popover buttons styling. |
| 1749 | `closePopover()` | Hides the allocation window. |
| 1754 | `handleSavePopover()` | Validates and stores popover allocation cell data. |

### 11. Executive Insights & Charts
| Line | Function | Description |
|------|----------|-------------|
| 1785 | `destroyChart(key)` | Safe chart.js instance destroyer. |
| 1790 | `calcAssetPenetration()` | Calculates how many assets are mapped to client towers. |
| 1833 | `penColorClass(pct)` | Resolves color badges for penetration index. |
| 1840 | `renderPenetrationBand(pen)` | Returns HSL gradients matching penetration. |
| 1867 | `renderInsights()` | Compiles executive charts and compiles dynamic text observations. |
| 1975 | `renderTowerChart(towerStats)` | Renders Pipeline vs Benchmark by Tower (Bar Chart). |
| 2001 | `renderApprovalChart()` | Renders Status Distribution (Doughnut Chart). |
| 2047 | `renderHeatmapChart()` | Renders Asset Penetration by Client (Horizontal Bar). |
| 2093 | `renderPotentialChart()` | Renders High Opportunity Targets (Awaiting Approval Bar). |
| 2156 | `renderBillingTypeChart()` | Renders AI Penetration by Billing Type (Radar/Polar Chart). |
| 2203 | `renderBenefitByAssetChart()` | Renders Top 10 Est. FTE Benefit by Asset (Vertical Bar). |
| 2273 | `renderInsightsList(...)` | Generates customizable and automated bullet point insights. |
| 2367 | `editAutoInsight(i)` | Toggles edit box for automated insights. |
| 2371 | `cancelAutoInsightEdit(i)` | Cancels edit. |
| 2375 | `saveAutoInsightEdit(...)` | Saves custom override for automated insight. |
| 2387 | `addCustomInsight()` | Toggles view to add a new insight. |
| 2393 | `cancelAddInsight()` | Discards new insight input. |
| 2399 | `saveNewInsight()` | Appends custom observation to portfolio list. |
| 2410 | `deleteCustomInsight(id)` | Deletes custom observation. |
| 2416 | `editCustomInsight(id)` | Toggles edit mode on custom observation. |
| 2420 | `cancelCustomInsightEdit(id)` | Discards edits. |
| 2424 | `saveCustomInsightEdit(id)` | Saves custom observation edits. |

### 12. Modal Editors
| Line | Function | Description |
|------|----------|-------------|
| 2437 | `openModal(id)` | Opens configuration modals (Clients, Regions, Towers, Processes, Assets, Owners). |
| 2448 | `populateClientModalList()` | Renders active client list inside modal. |
| 2460 | `handleAddClient()` | Adds a new client to master. |
| 2475 | `handleDeleteClient(clientName)` | Deletes a client from master. |
| 2492 | `closeModal(id)` | Hides modal. |
| 2495 | `populateRegionModalList()` | Renders active regions. |
| 2506 | `handleAddRegion()` | Adds a region. |
| 2519 | `handleDeleteRegion(regionName)` | Deletes a region. |
| 2532 | `populateTowerModalList()` | Renders towers. |
| 2543 | `handleAddTower()` | Adds a tower. |
| 2561 | `handleDeleteTower(towerName)` | Deletes a tower. |
| 2631 | `populateProcessModalList()` | Renders processes list inside modal. |
| 2642 | `handleAddProcess()` | Adds a new process to master. |
| 2664 | `handleDeleteProcess(processName)` | Deletes a process from master. |
| 2676 | `populateTypeModalList()` | Renders types. |
| 2596 | `handleAddType()` | Adds an initiative type. |
| 2608 | `handleDeleteType(typeName)` | Deletes a type. |
| 2617 | `populateAssetModalList()` | Renders assets. |
| 2628 | `handleAddAsset()` | Adds an asset. |
| 2641 | `handleDeleteAsset(asset)` | Deletes an asset. |
| 2651 | `populateOwnerModalList()` | Renders owners. |
| 2663 | `handleAddOwner()` | Adds an owner. |
| 2675 | `handleDeleteOwner(name)` | Deletes an owner. |

### 13. File Import & Export
| Line | Function | Description |
|------|----------|-------------|
| 2686 | `normalizeKey(key)` | Normalizes column labels for spreadsheet headers mapping. |
| 2690 | `handleBulkUpload(event)` | Parses upload file and runs integrity rules. |
| 2966 | `downloadBulkTemplate()` | Builds styled blank XLS bulk template for users. |
| 3053 | `downloadXls()` | Exports active tables as Excel workbook containing `Master_Tracker`, `Asset_Mapping`, and `Client_Summary` worksheets. |
| 3169 | `downloadPpt()` | Generates PowerPoint deck summarizing executive findings. |

### 14. Client Summary Tab Rendering
| Line | Function | Description |
|------|----------|-------------|
| 3203 | `renderClientSummary()` | Compiles and groups client summaries, binds column resizing handles, and renders owner dropdowns and action plans. |

### 15. Technical Reference Tab Rendering
| Line | Function | Description |
|------|----------|-------------|
| 3478 | `renderReferenceTab()` | Initializes reference catalog rendering and runs initial calculation sandbox updates. |
| 3483 | `filterReferenceFunctions()` | Performs search-filtering on functions database based on input search values. |
| 3518 | `runSandboxCalculation()` | Evaluates sandbox inputs and executes math equations, showing status indicators for validation rules. |

### 16. AI Leaderboard Rendering
| Line | Function | Description |
|------|----------|-------------|
| 3620 | `renderLeaderboard()` | Compiles client-wise metrics, sorts and ranks them, and populates the Mapped AI Potential %, Est. FTE Benefit, and Benefit Realization Rate % columns. |

### 17. 4 Blocker Portfolio View Rendering
| Line | Function | Description |
|------|----------|-------------|
| 3747 | `renderBlocker()` | Compiles and renders the 2x2 grid quadrant view of all mapped AI solutions, reflecting FTE benefits in status-colored bubbles. |
| 3825 | `makeBlockerResizable()` | Attaches a drag handle to the right edge of the centered 4 blocker container to support manual width adjustment and local storage persistence. |
