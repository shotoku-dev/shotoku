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

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <div style={S.page}>
        <h1 style={S.h1}>Terms of Use</h1>
        <p style={S.meta}>Last updated June 27, 2026</p>

        <p style={S.p}>
          Shotoku is open-source software distributed under the MIT License. By using it
          you agree to these terms.
        </p>

        <hr style={S.divider} />

        <h2 style={S.h2}>Use of the software</h2>
        <p style={S.p}>
          Shotoku is provided as a developer tool for authorizing and auditing AI agent
          actions locally. You may use, copy, modify, and distribute it freely under the
          terms of the{" "}
          <a href="/license" style={{ color: "#DB0028", textDecoration: "none" }}>MIT License</a>.
        </p>
        <p style={S.p}>
          You are responsible for how you configure and deploy Shotoku. Policies you write,
          decisions you approve or deny, and actions your agents take are entirely under
          your control.
        </p>

        <h2 style={S.h2}>No warranty</h2>
        <p style={S.p}>
          Shotoku is provided "as is" without warranty of any kind. We make no guarantees
          about uptime, correctness, security, or fitness for any particular purpose.
          See the full MIT License for the complete disclaimer.
        </p>

        <h2 style={S.h2}>No custody, no payments</h2>
        <p style={S.p}>
          Shotoku is an authorization layer. It never holds funds, never stores private keys,
          and never initiates or settles payments on your behalf. Any payments made by your
          agents are your responsibility.
        </p>

        <h2 style={S.h2}>This website</h2>
        <p style={S.p}>
          This website (shotoku.dev) is informational. We reserve the right to change,
          update, or remove content at any time without notice.
        </p>

        <h2 style={S.h2}>Limitation of liability</h2>
        <p style={S.p}>
          To the maximum extent permitted by law, the authors of Shotoku shall not be liable
          for any direct, indirect, incidental, special, or consequential damages arising
          from the use or inability to use the software.
        </p>

        <hr style={S.divider} />

        <h2 style={S.h2}>Contact</h2>
        <p style={S.p}>
          Questions about these terms can be sent to{" "}
          <a href="mailto:peschardjulius03@gmail.com" style={{ color: "#DB0028", textDecoration: "none" }}>
            peschardjulius03@gmail.com
          </a>.
        </p>
      </div>
      <Footer />
    </>
  );
}
