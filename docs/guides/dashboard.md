# Dashboard

`shotoku ui` opens a local dashboard: what is waiting for you, what each agent has spent against its limits, and every decision in the ledger.

```bash
shotoku ui
```

```
Shotoku dashboard: http://127.0.0.1:4402/#token=9f2c…
  Ledger  /home/you/project/data/decisions.jsonl
  Policy  /home/you/project/policy.yaml
Open the link above; the token in it is this session's only key. Ctrl+C to stop.
```

Open the link. The page refreshes every two seconds.

## What it shows

- **Pending, approved, denied, spent in 24 hours**, at the top.
- **Pending approvals**: who wants to do what, for how much, and why a human is asked, with **Approve** and **Deny** buttons. Approving does what `shotoku approve` does: the agent's identical retry goes through, once. It is recorded with `"via": "dashboard"`.
- **Budgets**: each agent budget from your policy, and each agent's spend on each tool or vendor against the daily limit of the rule it matched, with what remains.
- **History**: every decision, newest first, with the human answer and where it came from (terminal, dashboard, or `telegram:<id>`). Sort, filter any column, or search them all. Click a row for its full reasons.
- **Ledger integrity**, top right: whether the hash chain still verifies.

The tables are [AG Grid Community](https://www.ag-grid.com/) (MIT), served from the installed package. The page loads nothing from the internet.

## Options

| Option | Default | |
|---|---|---|
| `--port <n>` | `4402` | Port on 127.0.0.1. `0` picks a free one. |
| `--policy <path>` | resolved as for every command | `shotoku where` shows which |
| `--ledger <path>` | resolved as for every command | |

## How it is locked down

The dashboard can approve spending, so:

- It listens on **127.0.0.1 only**, never on your network.
- Every API call needs the **session token** from the link. It is new each run, is printed only in your terminal, and is written to no file. The page moves it out of the address bar on load.
- A request must name `127.0.0.1` or `localhost` as its host, which stops a web page that rebinds its own domain to your machine.
- Approve and Deny are only accepted from the dashboard's own page (`Origin`), so another site cannot post to it.
- The page runs only its own scripts and cannot be framed.

What this does not stop: a process running as your user that can read the terminal the token was printed in. An agent with shell access on your machine is such a process. For a separation it cannot cross, answer on another device with [`shotoku telegram`](phone-approvals.md), and run the agent without access to Shotoku's files.
