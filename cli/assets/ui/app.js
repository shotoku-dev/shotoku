/**
 * The Shotoku dashboard page. Plain browser JavaScript, no build step.
 *
 * Every value from the ledger was written by an agent’s request, so nothing
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
  /** How long a row that just arrived stays highlighted. */
  const FRESH_MS = 2400;
  /** Money lines up on the right, digit under digit. */
  const RIGHT = "ag-right-aligned-cell amount";
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

  /** Something is wrong and stays wrong until it is fixed: shown in the page. */
  function showNotice(text, isError) {
    const notice = document.getElementById("notice");
    notice.textContent = text;
    notice.className = isError ? "notice error" : "notice";
    notice.hidden = !text;
  }

  /** Something you just did worked: said once, out of the layout’s way. */
  let toastTimer;
  function toast(text) {
    let node = document.getElementById("toast");
    if (!node) {
      node = el("div", "toast");
      node.id = "toast";
      node.setAttribute("role", "status");
      document.body.append(node);
    }
    node.textContent = text;
    // Restart the entrance when one message replaces another.
    node.classList.remove("toast-in");
    void node.offsetWidth;
    node.classList.add("toast-in");
    clearTimeout(toastTimer);
    // Long enough to read at an unhurried pace, never under three seconds.
    toastTimer = setTimeout(() => node.classList.remove("toast-in"), Math.max(3000, text.split(/\s+/).length * 330));
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
    headerBackgroundColor: "#0a0a0a",
    headerTextColor: "#8a8a85",
    headerFontSize: 12,
    headerFontWeight: 500,
    headerHeight: 38,
    rowHeight: 44,
    oddRowBackgroundColor: "#0a0a0a",
    rowHoverColor: "#121212",
    selectedRowBackgroundColor: "#161616",
    accentColor: "#f5f5f0",
    fontFamily: "inherit",
    fontSize: 13,
    wrapperBorderRadius: 0,
    borderRadius: 0,
    spacing: 6,
  });

  /** Rows that arrived since the page first rendered, by grid. */
  function freshTracker() {
    const seen = new Set();
    const fresh = new Set();
    let primed = false;
    return {
      isFresh: (id) => fresh.has(id),
      /** Call with every render’s ids. Returns the ones that are new. */
      note(ids, onExpire) {
        const arrived = [];
        for (const id of ids) {
          if (seen.has(id)) continue;
          seen.add(id);
          // Whatever is already there on first paint has not just arrived.
          if (!primed) continue;
          fresh.add(id);
          arrived.push(id);
          setTimeout(() => {
            fresh.delete(id);
            onExpire(id);
          }, FRESH_MS);
        }
        primed = true;
        return arrived;
      },
    };
  }

  const pendingFresh = freshTracker();
  const historyFresh = freshTracker();

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
    const percent = Math.round(share * 100);
    const track = el("div", "usage-track");
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", `${percent}% of the limit used`);
    const fill = el("div", "usage-fill");
    fill.style.transform = `scaleX(${share})`;
    track.append(fill);
    wrap.append(track, el("span", "usage-share", `${percent}%`));
    return wrap;
  }

  function actionsCell(params) {
    const row = params.data;
    const wrap = el("div", "actions");
    const what = `${row.amount !== undefined ? `${money(row.amount)} ` : ""}${row.resource}`;
    const approveButton = el("button", "btn btn-approve", "✓ Approve");
    const denyButton = el("button", "btn btn-deny", "✗ Deny");
    approveButton.type = "button";
    denyButton.type = "button";
    approveButton.setAttribute("aria-label", `Approve ${what}`);
    denyButton.setAttribute("aria-label", `Deny ${what}`);

    const decide = async (verb, button, busyLabel) => {
      approveButton.disabled = true;
      denyButton.disabled = true;
      button.textContent = busyLabel;
      try {
        await api(`/api/decisions/${encodeURIComponent(row.decisionId)}/${verb}`, "POST");
        showNotice("", false);
        toast(
          verb === "approve"
            ? `Approved ${what}. The agent’s identical retry goes through once.`
            : `Denied ${what}. Nothing is spent.`,
        );
      } catch (error) {
        showNotice(error.message, true);
      }
      refresh();
    };
    approveButton.addEventListener("click", () => decide("approve", approveButton, "Approving…"));
    denyButton.addEventListener("click", () => decide("deny", denyButton, "Denying…"));
    wrap.append(approveButton, denyButton);
    return wrap;
  }

  /**
   * On a phone a pending decision is a card, not a row: the amount, what it is
   * for, why it stopped, and two answers a thumb can hit.
   */
  function pendingCard(params) {
    const row = params.data;
    const card = el("div", "card");
    const top = el("div", "card-top");
    top.append(
      el("span", "card-amount amount", row.amount !== undefined ? money(row.amount) : "no amount"),
      el("span", "mono card-tool", row.resource),
    );
    card.append(
      top,
      el("p", "card-why", row.summary),
      el("p", "card-meta", `${row.actor} · waiting ${age(row.ageSeconds)}`),
      actionsCell(params),
    );
    return card;
  }

  function emptyState(title, hint) {
    return `<div class="empty"><span class="empty-title">${title}</span><span class="empty-hint">${hint}</span></div>`;
  }

  const common = {
    theme,
    domLayout: "autoHeight",
    animateRows: true,
    suppressCellFocus: true,
    suppressMovableColumns: true,
  };

  const narrow = window.matchMedia("(max-width: 720px)");

  const pendingGrid = agGrid.createGrid(document.getElementById("pending-grid"), {
    ...common,
    getRowHeight: () => (narrow.matches ? 166 : 52),
    isFullWidthRow: () => narrow.matches,
    fullWidthCellRenderer: pendingCard,
    defaultColDef: { sortable: true, resizable: true, filter: false },
    getRowId: (params) => params.data.decisionId,
    rowClassRules: { "row-fresh": (params) => pendingFresh.isFresh(params.data.decisionId) },
    overlayNoRowsTemplate: emptyState(
      "Nothing is waiting for you.",
      "A call that goes over a limit, or that no rule covers, stops here until you answer.",
    ),
    columnDefs: [
      { headerName: "Agent", field: "actor", width: 132 },
      { headerName: "Tool or vendor", field: "resource", flex: 1, minWidth: 226, cellClass: "mono", tooltipValueGetter: (p) => `${p.data.resource} · ${p.data.decisionId}` },
      { headerName: "Amount", field: "amount", width: 96, valueFormatter: (p) => money(p.value), type: "rightAligned", cellClass: `${RIGHT} amount-strong` },
      { headerName: "Why a human", field: "summary", flex: 1.6, minWidth: 226, tooltipValueGetter: (p) => [p.data.summary, p.data.amountSource].filter(Boolean).join(" · ") },
      { headerName: "Waiting", field: "ageSeconds", width: 88, valueFormatter: (p) => age(p.value), cellClass: "amount muted-cell" },
      { headerName: "", field: "decisionId", colId: "actions", width: 212, pinned: "right", sortable: false, resizable: false, cellRenderer: actionsCell },
    ],
  });

  const budgetsGrid = agGrid.createGrid(document.getElementById("budgets-grid"), {
    ...common,
    defaultColDef: { sortable: true, resizable: true, filter: false },
    getRowId: (params) => `${params.data.kind}|${params.data.actor}|${params.data.resource ?? ""}`,
    overlayNoRowsTemplate: emptyState(
      "No approved spend in the last 24 hours.",
      "Each agent budget and rule limit shows up here once something is spent against it.",
    ),
    columnDefs: [
      { headerName: "Scope", field: "kind", width: 130, valueFormatter: (p) => (p.value === "agent" ? "agent budget" : "rule limit") },
      { headerName: "Agent", field: "actor", width: 150 },
      { headerName: "Tool or vendor", field: "resource", flex: 1.2, minWidth: 140, valueFormatter: (p) => p.value ?? "all tools and vendors", cellClassRules: { mono: (p) => p.value !== undefined, "muted-cell": (p) => p.value === undefined } },
      { headerName: "Spent", field: "spent", width: 110, valueFormatter: (p) => money(p.value), type: "rightAligned", cellClass: RIGHT },
      { headerName: "Limit", field: "limit", width: 110, valueFormatter: (p) => money(p.value), type: "rightAligned", cellClass: `${RIGHT} muted-cell` },
      { headerName: "Remaining", field: "remaining", width: 120, valueFormatter: (p) => money(p.value), type: "rightAligned", cellClass: RIGHT },
      { headerName: "Used", colId: "usage", flex: 1, minWidth: 160, sortable: false, cellRenderer: usageCell },
    ],
  });

  /** The decision whose detail is open, if any. */
  let detailId = null;
  let pagerHidden = false;
  let latestHistory = [];

  const historyGrid = agGrid.createGrid(document.getElementById("history-grid"), {
    ...common,
    defaultColDef: { sortable: true, resizable: true, filter: true },
    getRowId: (params) => params.data.decisionId,
    rowClassRules: {
      "row-fresh": (params) => historyFresh.isFresh(params.data.decisionId),
      "row-open": (params) => params.data.decisionId === detailId,
    },
    overlayNoRowsTemplate: emptyState(
      "No decisions yet.",
      "Every call an agent makes through Shotoku is recorded here, with the reasons.",
    ),
    pagination: true,
    paginationPageSize: 20,
    paginationPageSizeSelector: [20, 50, 100],
    onRowClicked: (event) => openDetail(event.data.decisionId === detailId ? null : event.data.decisionId),
    columnDefs: [
      { headerName: "Time", field: "timestamp", width: 100, sort: "desc", valueFormatter: (p) => time(p.value), cellClass: "amount muted-cell", filter: false },
      { headerName: "Decision", field: "status", width: 130, cellRenderer: statusCell },
      { headerName: "Human answer", field: "resolution", width: 214, cellRenderer: resolutionCell, valueFormatter: (p) => (p.value ? `${p.value.verdict} ${p.value.via ?? "terminal"}` : "") },
      { headerName: "Agent", field: "actor", width: 150 },
      { headerName: "Tool or vendor", field: "resource", flex: 1.5, minWidth: 140, cellClass: "mono" },
      { headerName: "Amount", field: "amount", width: 110, valueFormatter: (p) => money(p.value), type: "rightAligned", cellClass: RIGHT },
    ],
  });

  document.getElementById("history-search").addEventListener("input", (event) => {
    historyGrid.setGridOption("quickFilterText", event.target.value);
  });

  // One view of the ledger at a time: what happened, or what is left to spend.
  const views = ["history", "budgets"].map((name) => ({
    tab: document.getElementById(`tab-${name}`),
    view: document.getElementById(`view-${name}`),
  }));

  function showView(chosen) {
    for (const entry of views) {
      const selected = entry === chosen;
      entry.tab.setAttribute("aria-selected", String(selected));
      entry.tab.tabIndex = selected ? 0 : -1;
      entry.view.hidden = !selected;
    }
    // The filter belongs to the history.
    document.getElementById("history-search").style.visibility = chosen === views[0] ? "" : "hidden";
  }

  for (const entry of views) {
    entry.tab.addEventListener("click", () => showView(entry));
    entry.tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const other = views[(views.indexOf(entry) + 1) % views.length];
      showView(other);
      other.tab.focus();
    });
  }

  // A phone gets the columns that answer "what, and how much"; the rest is
  // one tap away in the decision’s detail.
  function fitColumns() {
    const wide = !narrow.matches;
    // Between a phone and a full window, the agent’s name gives way first: it
    // is still in each decision’s detail, and the reason needs the room more.
    const roomy = wide && document.querySelector("main").clientWidth >= 1160;
    pendingGrid.setColumnsVisible(["actor"], roomy);
    budgetsGrid.setColumnsVisible(["actor"], roomy);
    historyGrid.setColumnsVisible(["actor"], roomy);
    pendingGrid.setGridOption("headerHeight", wide ? undefined : 0);
    pendingGrid.resetRowHeights();
    pendingGrid.redrawRows();
    budgetsGrid.setColumnsVisible(["kind", "limit", "usage"], wide);
    budgetsGrid.applyColumnState({
      state: [
        { colId: "spent", width: wide ? 110 : 84 },
        { colId: "remaining", width: wide ? 120 : 104 },
      ],
    });
    historyGrid.setColumnsVisible(["timestamp", "resolution"], wide);
    historyGrid.applyColumnState({
      state: [
        { colId: "status", width: wide ? 130 : 112 },
        { colId: "amount", width: wide ? 110 : 96 },
      ],
    });
  }
  narrow.addEventListener("change", fitColumns);
  let roomyNow = null;
  new ResizeObserver(() => {
    const roomy = document.querySelector("main").clientWidth >= 1160;
    if (roomy !== roomyNow) {
      roomyNow = roomy;
      fitColumns();
    }
  }).observe(document.querySelector("main"));
  fitColumns();

  // --- decision detail -------------------------------------------------------

  function field(list, label, value, className) {
    list.append(el("dt", "", label), el("dd", className || "", value));
  }

  function renderDetail() {
    const detail = document.getElementById("detail");
    const row = detailId ? latestHistory.find((entry) => entry.decisionId === detailId) : undefined;
    if (!row) {
      detail.hidden = true;
      detail.replaceChildren();
      return;
    }

    const status = STATUS[row.status];
    const head = el("div", "detail-head");
    const close = el("button", "btn detail-close", "Close");
    close.type = "button";
    close.addEventListener("click", () => openDetail(null));
    head.append(
      el("span", `status ${status.css}`, `${status.symbol} ${status.label}`),
      el("span", "mono detail-id", row.decisionId),
      close,
    );

    const facts = el("dl", "detail-facts");
    field(facts, "Agent", row.actor);
    field(facts, "Tool or vendor", row.resource, "mono");
    field(facts, "Action", row.action, "mono");
    if (row.amount !== undefined) {
      field(facts, "Amount", `${money(row.amount)}${row.amountSource ? `, from ${row.amountSource}` : ""}`);
    }
    field(facts, "Decided", new Date(row.timestamp).toLocaleString("en-US", { hour12: false }));
    if (row.resolution) {
      field(
        facts,
        "Human answer",
        `${row.resolution.verdict} as ${row.resolution.approvalId}` +
          `${row.resolution.via ? `, via ${row.resolution.via}` : ""}, at ${time(row.resolution.timestamp)}`,
        STATUS[row.resolution.verdict].css,
      );
    }

    const reasons = el("ul", "detail-reasons");
    for (const reason of row.reasons) reasons.append(el("li", "", reason));

    detail.replaceChildren(head, facts, el("h3", "detail-label", "Why"), reasons);
    detail.hidden = false;
  }

  function openDetail(id) {
    const previous = detailId;
    detailId = id;
    renderDetail();
    const nodes = [previous, id].map((rowId) => rowId && historyGrid.getRowNode(rowId)).filter(Boolean);
    if (nodes.length > 0) historyGrid.redrawRows({ rowNodes: nodes });
    if (id) document.getElementById("detail").scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  // --- refresh loop ----------------------------------------------------------

  function settle(grid) {
    return (id) => {
      const node = grid.getRowNode(id);
      if (node) grid.redrawRows({ rowNodes: [node] });
    };
  }

  function setText(id, text) {
    const node = document.getElementById(id);
    if (node.textContent !== text) node.textContent = text;
  }

  function render(state) {
    pendingFresh.note(state.pending.map((row) => row.decisionId), settle(pendingGrid));
    historyFresh.note(state.history.map((row) => row.decisionId), settle(historyGrid));
    latestHistory = state.history;

    pendingGrid.setGridOption("rowData", state.pending);
    budgetsGrid.setGridOption("rowData", state.budgets);
    historyGrid.setGridOption("rowData", state.history);
    document.getElementById("pending-grid").classList.toggle("is-empty", state.pending.length === 0);
    document.getElementById("budgets-grid").classList.toggle("is-empty", state.budgets.length === 0);
    document.getElementById("history-grid").classList.toggle("is-empty", state.history.length === 0);
    // A pager for a single page is a row of dead controls.
    const onePage = state.history.length <= historyGrid.paginationGetPageSize();
    if (onePage !== pagerHidden) {
      pagerHidden = onePage;
      historyGrid.setGridOption("suppressPaginationPanel", onePage);
    }

    setText("kpi-pending", String(state.totals.pending));
    setText("kpi-approved", String(state.totals.approved));
    setText("kpi-denied", String(state.totals.denied));
    setText("kpi-spent", money(state.totals.spent24h));
    document.getElementById("kpi-pending").classList.toggle("quiet", state.totals.pending === 0);
    document.getElementById("kpi-denied").classList.toggle("quiet", state.totals.denied === 0);

    const integrity = document.getElementById("integrity");
    if (state.integrity.ok) {
      setText("integrity", `✓ ledger intact · ${state.integrity.records} records`);
      integrity.className = "integrity ok";
    } else {
      setText("integrity", `✗ ledger broken: ${state.integrity.message}`);
      integrity.className = "integrity broken";
    }

    setText("refreshed", `updated ${time(state.generatedAt)}`);
    document.title = state.totals.pending > 0 ? `(${state.totals.pending}) Shotoku` : "Shotoku";

    // The open decision may have just been answered.
    if (detailId) renderDetail();
    if (state.policyError) showNotice(`Policy: ${state.policyError}`, true);
  }

  let inFlight = false;
  let loadFailed = false;
  async function refresh() {
    if (inFlight) return;
    inFlight = true;
    try {
      const state = await api("/api/state");
      if (loadFailed) showNotice("", false);
      loadFailed = false;
      render(state);
    } catch (error) {
      loadFailed = true;
      showNotice(`Could not load the ledger: ${error.message}`, true);
      // What is on screen is the last good read. It can no longer vouch for
      // the ledger, so the header stops saying it is intact.
      setText("integrity", "✗ ledger could not be read");
      document.getElementById("integrity").className = "integrity broken";
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
