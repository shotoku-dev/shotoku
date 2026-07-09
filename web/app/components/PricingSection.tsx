const CHECK = (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 4 }}>
    <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="#E54B4B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface Tier {
  name: string;
  price: string;
  priceNote?: string;
  description: string;
  features: string[];
  cta?: { label: string; href: string; external?: boolean };
  badge?: string;
  highlighted?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Open Source",
    price: "Free",
    priceNote: "forever",
    description: "Everything you need to authorize, approve, and audit agent actions on your machine.",
    features: [
      "authorize() core and policy engine",
      "Hash-chained decision ledger",
      "CLI and terminal UI",
      "MCP server for Claude, Cursor, and more",
      "x402 payment authorization",
      "Signed snapshots and verification",
    ],
    cta: { label: "Start building", href: "/docs/quickstart" },
    highlighted: true,
  },
  {
    name: "Team",
    price: "Coming soon",
    description: "Shared control for teams running multiple agents across projects.",
    features: [
      "Org-level policy hierarchy",
      "Approval routing to Slack",
      "Multi-approver rules",
      "Central ledger dashboard",
    ],
  },
  {
    name: "Enterprise",
    price: "Let's talk",
    description: "Governance, enforcement, and compliance for organizations where agents act at scale.",
    features: [
      "Signed decision receipts and enforcement integration",
      "RBAC on approvals",
      "Compliance export packs (EU AI Act, SOC 2)",
      "SSO / SAML / SCIM",
      "Support SLA",
    ],
    cta: {
      label: "Talk to us",
      href: "https://cal.eu/shotoku.julius/design-partner-collaboration",
      external: true,
    },
  },
];

function TierCard({ tier }: { tier: Tier }) {
  return (
    <div
      style={{
        background: "#F2F1ED",
        borderRadius: 8,
        padding: "28px 26px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        border: tier.highlighted ? "1px solid #E54B4B" : "1px solid transparent",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: "#0A0A0A", letterSpacing: "-0.01em" }}>
          {tier.name}
        </span>
        {tier.badge && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "rgba(0,0,0,0.45)",
              background: "rgba(0,0,0,0.06)",
              padding: "3px 8px",
              borderRadius: 99,
            }}
          >
            {tier.badge}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 26, fontWeight: 500, color: "#0A0A0A", letterSpacing: "-0.025em", lineHeight: 1.1 }}>
          {tier.price}
        </span>
        {tier.priceNote && (
          <span style={{ fontSize: 13, color: "rgba(0,0,0,0.4)" }}>{tier.priceNote}</span>
        )}
      </div>

      <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "rgba(0,0,0,0.55)", margin: "0 0 20px" }}>
        {tier.description}
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        {tier.features.map((f) => (
          <li key={f} style={{ display: "flex", gap: 8, fontSize: 13.5, lineHeight: 1.55, color: "rgba(0,0,0,0.62)" }}>
            {CHECK}
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {tier.cta ? (
        <a
          href={tier.cta.href}
          {...(tier.cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="transition-[background-color,scale] duration-150 ease-out active:scale-[0.97]"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "9px 14px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
            ...(tier.highlighted
              ? { background: "#E54B4B", color: "#ffffff" }
              : { background: "transparent", color: "#0A0A0A", border: "1px solid rgba(0,0,0,0.14)" }),
          }}
        >
          {tier.cta.label}
        </a>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "9px 14px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 500,
            color: "rgba(0,0,0,0.35)",
            border: "1px dashed rgba(0,0,0,0.14)",
            cursor: "default",
          }}
        >
          In development
        </div>
      )}
    </div>
  );
}

export default function PricingSection() {
  return (
    <section
      style={{ padding: "0 24px 48px", fontFamily: "Satoshi, var(--font-geist), sans-serif" }}
    >
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-3"
        style={{ maxWidth: 960, margin: "0 auto" }}
      >
        {TIERS.map((tier) => (
          <TierCard key={tier.name} tier={tier} />
        ))}
      </div>

      <p
        style={{
          maxWidth: 960,
          margin: "28px auto 0",
          fontSize: 13,
          lineHeight: 1.7,
          color: "rgba(0,0,0,0.4)",
          textAlign: "center",
        }}
      >
        The core authorization engine is open source and always will be. Team and Enterprise add
        collaboration and governance on top — your policies and ledger stay on your infrastructure.
      </p>
    </section>
  );
}
