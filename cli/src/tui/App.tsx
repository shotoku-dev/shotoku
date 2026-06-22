import { Box, Text, useApp, useInput } from "ink";
import { useEffect, useState } from "react";
import {
  approve,
  deny,
  readApprovals,
  readDecisions,
  toUserSafeMessage,
  type ApprovalEntry,
  type LedgerEntry,
} from "@shotoku/core";
import { Banner } from "./Banner.js";
import { PendingPanel } from "./PendingPanel.js";
import { HistoryPanel } from "./HistoryPanel.js";
import { Footer } from "./Footer.js";

interface AppProps {
  readonly ledgerPath: string;
}

export function App({ ledgerPath }: AppProps) {
  const { exit } = useApp();
  const [decisions, setDecisions] = useState<LedgerEntry[]>([]);
  const [approvals, setApprovals] = useState<ApprovalEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const actionedIds = new Set(approvals.map((a) => a.decisionId));
  const pending = decisions.filter(
    (d) =>
      d.response.status === "pending_approval" &&
      !actionedIds.has(d.decisionId),
  );

  async function loadData() {
    try {
      const [d, a] = await Promise.all([
        readDecisions(ledgerPath),
        readApprovals(ledgerPath),
      ]);
      setDecisions(d);
      setApprovals(a);
      setLoadError(null);
    } catch (error) {
      setLoadError(toUserSafeMessage(error));
    }
  }

  useEffect(() => {
    void loadData();
    const id = setInterval(() => void loadData(), 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (selectedIndex >= pending.length && pending.length > 0) {
      setSelectedIndex(pending.length - 1);
    }
  }, [pending.length, selectedIndex]);

  function showFlash(text: string, ok: boolean) {
    setFlash({ text, ok });
    setTimeout(() => setFlash(null), 5000);
  }

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
      setExpandedId(null);
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(Math.max(0, pending.length - 1), i + 1));
      setExpandedId(null);
      return;
    }
    if (key.return) {
      const entry = pending[selectedIndex];
      if (!entry) return;
      void approve(entry.decisionId, { ledgerPath })
        .then(() => {
          showFlash(`✓  Approved  ${entry.decisionId}`, true);
          void loadData();
        })
        .catch((err: unknown) => {
          showFlash(`✗  ${toUserSafeMessage(err)}`, false);
        });
      return;
    }
    if (input === "d") {
      const entry = pending[selectedIndex];
      if (!entry) return;
      void deny(entry.decisionId, { ledgerPath })
        .then(() => {
          showFlash(`✗  Denied  ${entry.decisionId}`, false);
          void loadData();
        })
        .catch((err: unknown) => {
          showFlash(`✗  ${toUserSafeMessage(err)}`, false);
        });
      return;
    }
    if (input === "e") {
      const entry = pending[selectedIndex];
      if (!entry) return;
      setExpandedId((id) => (id === entry.decisionId ? null : entry.decisionId));
      return;
    }
    if (input === "h") {
      setShowHistory((v) => !v);
      return;
    }
    if (input === "q") {
      exit();
    }
  });

  return (
    <Box flexDirection="column" alignItems="center">
      <Banner decisionCount={decisions.length} pendingCount={pending.length} />
      <Box flexDirection="column" paddingX={4} paddingTop={1}>
        {flash && (
          <Box marginBottom={1}>
            <Text color={flash.ok ? "green" : "red"}>{flash.text}</Text>
          </Box>
        )}
        {loadError && (
          <Box marginBottom={1}>
            <Text color="red">✗  {loadError}</Text>
          </Box>
        )}
        <PendingPanel
          entries={pending}
          selectedIndex={selectedIndex}
          expandedId={expandedId}
        />
        {showHistory && (
          <Box marginTop={1}>
            <HistoryPanel entries={decisions} approvals={approvals} />
          </Box>
        )}
      </Box>
      <Footer showHistory={showHistory} hasPending={pending.length > 0} />
    </Box>
  );
}
