import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const S = {
  page:    { paddingTop: 120, paddingBottom: 96, paddingLeft: 32, paddingRight: 32, maxWidth: 700, margin: "0 auto" } as React.CSSProperties,
  h1:      { fontSize: 28, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", letterSpacing: "-0.025em", marginBottom: 6, lineHeight: 1.2 } as React.CSSProperties,
  meta:    { fontSize: 13, color: "rgba(0,0,0,0.35)", fontFamily: "var(--font-geist), sans-serif", marginBottom: 48 } as React.CSSProperties,
  h2:      { fontSize: 17, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", letterSpacing: "-0.015em", marginTop: 40, marginBottom: 10 } as React.CSSProperties,
  p:       { fontSize: 14.5, lineHeight: 1.9, color: "rgba(0,0,0,0.62)", fontFamily: "var(--font-geist), Satoshi, sans-serif", marginBottom: 16 } as React.CSSProperties,
  ul:      { paddingLeft: 20, margin: "8px 0 16px" } as React.CSSProperties,
  li:      { fontSize: 14.5, lineHeight: 1.9, color: "rgba(0,0,0,0.62)", fontFamily: "var(--font-geist), Satoshi, sans-serif", marginBottom: 4 } as React.CSSProperties,
  divider: { border: "none", borderTop: "1px solid rgba(0,0,0,0.07)", margin: "36px 0" } as React.CSSProperties,
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <div style={S.page}>
        <h1 style={S.h1}>Privacy Policy</h1>
        <p style={S.meta}>Last updated June 27, 2026</p>

        <p style={S.p}>
          Shotoku is a local-first, open-source tool. This policy explains what data exists,
          where it goes, and what we do with it — which is very little.
        </p>

        <hr style={S.divider} />

        <h2 style={S.h2}>What Shotoku does with your data</h2>
        <p style={S.p}>
          Shotoku runs entirely on your machine. Authorization decisions, your policy file,
          and the decision ledger never leave your device unless you explicitly move them.
          We do not have servers that receive or store your decisions.
        </p>

        <h2 style={S.h2}>What we collect</h2>
        <p style={S.p}>We collect nothing automatically. Specifically:</p>
        <ul style={S.ul}>
          <li style={S.li}>No telemetry or usage analytics</li>
          <li style={S.li}>No crash reports</li>
          <li style={S.li}>No identifiers, device information, or IP addresses</li>
          <li style={S.li}>No policy file contents</li>
          <li style={S.li}>No decision ledger data</li>
        </ul>

        <h2 style={S.h2}>This website</h2>
        <p style={S.p}>
          This landing page (shotoku.dev) is a static site hosted on Vercel. Vercel may collect
          standard server access logs (IP address, request path, timestamp) as part of their
          infrastructure. We do not use cookies, tracking pixels, or third-party analytics.
        </p>

        <h2 style={S.h2}>GitHub</h2>
        <p style={S.p}>
          The Shotoku source code is hosted on GitHub. If you open an issue, submit a pull
          request, or interact with the repository, GitHub's own privacy policy applies to
          that activity.
        </p>

        <h2 style={S.h2}>npm</h2>
        <p style={S.p}>
          Installing Shotoku via npm goes through the npm registry. npm may log your IP
          address and the packages you download as part of their standard infrastructure.
          We do not receive this data.
        </p>

        <hr style={S.divider} />

        <h2 style={S.h2}>Contact</h2>
        <p style={S.p}>
          Questions about this policy can be sent to{" "}
          <a href="mailto:peschardjulius03@gmail.com" style={{ color: "#DB0028", textDecoration: "none" }}>
            peschardjulius03@gmail.com
          </a>.
        </p>
      </div>
      <Footer />
    </>
  );
}
