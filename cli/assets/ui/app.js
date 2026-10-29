/**
 * The Shotoku dashboard page. Plain browser JavaScript, no build step.
 *
 * Every value from the ledger was written by an agent's request, so nothing
 * here goes through innerHTML: cell renderers build elements and set
 * textContent, and AG Grid renders plain values as text.
 *
 * The session token arrives in the URL fragment (#token=...), which browsers
 * never send to a server or put in a Referer. It is moved to sessionStorage
 * and wiped from the address bar.
 */
(function () {
  "use strict";

  const REFRESH_MS = 2000;
  const STATUS = {
    approved: { symbol: "✓", label: "APPROVED", css: "approved" },
    denied: { symbol: "✗", label: "DENIED", css: "denied" },
    pending_approval: { symbol: "◷", label: "PENDING", css: "pending" },
  };

  // --- session token ---------------------------------------------------------

  function readToken() {
    const match = window.location.hash.match(/token=([a-f0-9]+)/);
    if (match) {
      try {
        sessionStorage.setItem("shotoku-token", match[1]);
      } catch {
        // Storage can be blocked; the token still works for this page load.
      }
      history.replaceState(null, "", window.location.pathname);
      return match[1];
    }
    try {
      return sessionStorage.getItem("shotoku-token");
    } catch {
      return null;
    }
  }

  const token = readToken();

  // --- small DOM helpers -----------------------------------------------------

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function money(value) {
    if (value === undefined || value === null) return "";
    return `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  function age(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }

  function time(iso) {
    return new Date(iso).toLocaleTimeString("en-US", { hour12: false });
  }

  function showNotice(text, isError) {
    const notice = document.getElementById("notice");
    notice.textContent = text;
    notice.className = isError ? "notice error" : "notice";
    notice.hidden = !text;
  }

  // --- API -------------------------------------------------------------------

  async function api(path, method) {
    const response = await fetch(path, {
      method: method || "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  }

  // --- grids -----------------------------------------------------------------

  agGrid.ModuleRegistry.registerModules([agGrid.AllCommunityModule]);

  const theme = agGrid.themeQuartz.withPart(agGrid.colorSchemeDark).withParams({
    backgroundColor: "#0a0a0a",
    foregroundColor: "#f5f5f0",
    borderColor: "#1f1f1f",
    headerBackgroundColor: "#0f0f0f",
    oddRowBackgroundColor: "#0a0a0a",
    rowHoverColor: "#141414",
    selectedRowBackgroundColor: "#1a1a1a",
    accentColor: "#f5f5f0",
    fontFamily: "inherit",
    fontSize: 13,
    headerFontWeight: 600,
    wrapperBorderRadius: 0,
    borderRadius: 0,
    spacing: 6,
  });

  function statusCell(params) {
    const status = STATUS[params.value];
    if (!status) return el("span", "", String(params.value ?? ""));
    return el("span", `status ${status.css}`, `${status.symbol} ${status.label}`);
  }

  function resolutionCell(params) {
    const resolution = params.value;
    if (!resolution) return el("span", "muted", "");
    const status = STATUS[resolution.verdict];
    const via = resolution.via ? ` · ${resolution.via}` : " · terminal";
    return el("span", `status ${status.css}`, `${status.symbol} ${resolution.verdict}${via}`);
  }

  function usageCell(params) {
    const row = params.data;
    const wrap = el("div", "usage");
    if (row.limit === undefined) {
      wrap.append(el("span", "muted", "no limit"));
      return wrap;
    }
    const share = row.limit > 0 ? Math.min(1, row.spent / row.limit) : 1;
    const track = el("div", "usage-track");
    const fill = el("div", "usage-fill");
    fill.style.width = `${Math.round(share * 100)}%`;
    track.append(fill);
    wrap.append(track, el("span", "muted", `${Math.round(share * 100)}%`));
    return wrap;
  }

  function actionsCell(params) {
    const wrap = el("div", "actions");
    const approveButton = el("button", "btn btn-approve", "✓ Approve");
    const denyButton = el("button", "btn btn-deny", "✗ Deny");
    const decide = async (verb) => {
      approveButton.disabled = true;
      denyButton.disabled = true;
      try {
        await api(`/api/decisions/${encodeURIComponent(params.data.decisionId)}/${verb}`, "POST");
        showNotice("", false);
      } catch (error) {
        showNotice(error.message, true);
      }
      refresh();
    };
    approveButton.addEventListener("click", () => decide("approve"));
    denyButton.addEventListener("click", () => decide("deny"));
    wrap.append(approveButton, denyButton);
    return wrap;
  }

  const common = {
    theme,
    animateRows: false,
    suppressCellFocus: true,
    defaultColDef: { sortable: true, resizable: true, filter: true },
  };

  const pendingGrid = agGrid.createGrid(document.getElementById("pending-grid"), {
    ...common,
    getRowId: (params) => params.data.decisionId,
    overlayNoRowsTemplate: "No pending approvals.",
    columnDefs: [
      { headerName: "Decision", field: "decisionId", width: 150, cellClass: "status" },
      { headerName: "Agent", field: "actor", width: 140 },
      { headerName: "Tool or vendor", field: "resource", flex: 1, minWidth: 180 },
      { headerName: "Amount", field: "amount", width: 100, valueFormatter: (p) => money(p.value), type: "rightAligned" },
      { headerName: "Why a human", field: "summary", flex: 2, minWidth: 240, tooltipField: "amountSource" },
      { headerName: "Age", field: "ageSeconds", width: 80, valueFormatter: (p) => age(p.value) },
      { headerName: "", field: "decisionId", colId: "actions", width: 190, pinned: "right", sortable: false, filter: false, cellRenderer: actionsCell },
    ],
  });

  const budgetsGrid = agGrid.createGrid(document.getElementById("budgets-grid"), {
    ...common,
    getRowId: (params) => `${params.data.kind}|${params.data.actor}|${params.data.resource ?? ""}`,
    overlayNoRowsTemplate: "No approved spend in the last 24 hours.",
    columnDefs: [
      { headerName: "Scope", field: "kind", width: 110, valueFormatter: (p) => (p.value === "agent" ? "agent budget" : "rule limit") },
      { headerName: "Agent", field: "actor", width: 170 },
      { headerName: "Tool or vendor", field: "resource", flex: 1, minWidth: 180, valueFormatter: (p) => p.value ?? "all resources" },
      { headerName: "Spent", field: "spent", width: 110, valueFormatter: (p) => money(p.value), type: "rightAligned" },
      { headerName: "Limit", field: "limit", width: 110, valueFormatter: (p) => money(p.value), type: "rightAligned" },
      { headerName: "Remaining", field: "remaining", width: 120, valueFormatter: (p) => money(p.value), type: "rightAligned" },
      { headerName: "Used", colId: "usage", flex: 1, minWidth: 140, sortable: false, filter: false, cellRenderer: usageCell },
    ],
  });

  const historyGrid = agGrid.createGrid(document.getElementById("history-grid"), {
    ...common,
    getRowId: (params) => params.data.decisionId,
    overlayNoRowsTemplate: "No decisions yet.",
    pagination: true,
    paginationPageSize: 50,
    paginationPageSizeSelector: [20, 50, 100],
    rowSelection: { mode: "singleRow", checkboxes: false, enableClickSelection: true },
    onSelectionChanged: (event) => showDetail(event.api.getSelectedRows()[0]),
    columnDefs: [
      { headerName: "Time", field: "timestamp", width: 100, sort: "desc", valueFormatter: (p) => time(p.value) },
      { headerName: "Decision", field: "status", width: 130, cellRenderer: statusCell },
      { headerName: "Human answer", field: "resolution", width: 190, cellRenderer: resolutionCell, valueFormatter: (p) => (p.value ? `${p.value.verdict} ${p.value.via ?? "terminal"}` : "") },
      { headerName: "Agent", field: "actor", width: 140 },
      { headerName: "Tool or vendor", field: "resource", flex: 1, minWidth: 180 },
      { headerName: "Amount", field: "amount", width: 100, valueFormatter: (p) => money(p.value), type: "rightAligned" },
      { headerName: "Summary", field: "summary", flex: 2, minWidth: 240 },
    ],
  });

  document.getElementById("history-search").addEventListener("input", (event) => {
    historyGrid.setGridOption("quickFilterText", event.target.value);
  });

  function showDetail(row) {
    const detail = document.getElementById("detail");
    if (!row) {
      detail.hidden = true;
      return;
    }
    const lines = [
      `${STATUS[row.status].symbol} ${STATUS[row.status].label}  ${row.decisionId}`,
      `${row.actor} → ${row.resource}  (${row.action})`,
      `at ${new Date(row.timestamp).toLocaleString("en-US", { hour12: false })}`,
    ];
    if (row.amount !== undefined) {
      lines.push(`amount ${money(row.amount)}${row.amountSource ? ` · ${row.amountSource}` : ""}`);
    }
    lines.push("", ...row.reasons.map((reason) => `• ${reason}`));
    if (row.resolution) {
      lines.push(
        "",
        `${row.resolution.verdict} by a human as ${row.resolution.approvalId}` +
          `${row.resolution.via ? ` via ${row.resolution.via}` : ""} at ${time(row.resolution.timestamp)}`,
      );
    }
    detail.textContent = lines.join("\n");
    detail.hidden = false;
  }

  // --- refresh loop ----------------------------------------------------------

  function render(state) {
    pendingGrid.setGridOption("rowData", state.pending);
    budgetsGrid.setGridOption("rowData", state.budgets);
    historyGrid.setGridOption("rowData", state.history);

    document.getElementById("kpi-pending").textContent = String(state.totals.pending);
    document.getElementById("kpi-approved").textContent = String(state.totals.approved);
    document.getElementById("kpi-denied").textContent = String(state.totals.denied);
    document.getElementById("kpi-spent").textContent = money(state.totals.spent24h);

    const integrity = document.getElementById("integrity");
    if (state.integrity.ok) {
      integrity.textContent = `✓ ledger intact · ${state.integrity.records} records`;
      integrity.className = "integrity ok";
    } else {
      integrity.textContent = `✗ ledger broken: ${state.integrity.message}`;
      integrity.className = "integrity broken";
    }

    document.getElementById("refreshed").textContent = `updated ${time(state.generatedAt)}`;
    document.title = state.totals.pending > 0 ? `(${state.totals.pending}) Shotoku` : "Shotoku";

    if (state.policyError) showNotice(`Policy: ${state.policyError}`, true);
  }

  let inFlight = false;
  async function refresh() {
    if (inFlight) return;
    inFlight = true;
    try {
      render(await api("/api/state"));
    } catch (error) {
      showNotice(`Could not load the ledger: ${error.message}`, true);
    } finally {
      inFlight = false;
    }
  }

  if (!token) {
    showNotice("No session token. Open the link that shotoku ui printed in your terminal.", true);
    return;
  }

  refresh();
  setInterval(refresh, REFRESH_MS);
})();
