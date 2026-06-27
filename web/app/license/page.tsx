import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const S = {
  page:    { paddingTop: 120, paddingBottom: 96, paddingLeft: 32, paddingRight: 32, maxWidth: 700, margin: "0 auto" } as React.CSSProperties,
  h1:      { fontSize: 28, fontWeight: 500, fontFamily: "Satoshi, var(--font-geist), sans-serif", color: "#0A0A0A", letterSpacing: "-0.025em", marginBottom: 6, lineHeight: 1.2 } as React.CSSProperties,
  meta:    { fontSize: 13, color: "rgba(0,0,0,0.35)", fontFamily: "var(--font-geist), sans-serif", marginBottom: 48 } as React.CSSProperties,
  p:       { fontSize: 14.5, lineHeight: 1.9, color: "rgba(0,0,0,0.62)", fontFamily: "var(--font-geist), Satoshi, sans-serif", marginBottom: 16 } as React.CSSProperties,
  divider: { border: "none", borderTop: "1px solid rgba(0,0,0,0.07)", margin: "36px 0" } as React.CSSProperties,
};

export default function LicensePage() {
  return (
    <>
      <Navbar />
      <div style={S.page}>

        <h1 style={S.h1}>MIT License</h1>
        <p style={S.meta}>Shotoku is free and open-source software.</p>

        <p style={S.p}>Copyright (c) 2026 Julius Peschard</p>

        <hr style={S.divider} />

        <p style={S.p}>
          Permission is hereby granted, free of charge, to any person obtaining a copy
          of this software and associated documentation files (the &ldquo;Software&rdquo;), to deal
          in the Software without restriction, including without limitation the rights
          to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
          copies of the Software, and to permit persons to whom the Software is
          furnished to do so, subject to the following conditions:
        </p>

        <p style={S.p}>
          The above copyright notice and this permission notice shall be included in all
          copies or substantial portions of the Software.
        </p>

        <hr style={S.divider} />

        <p style={S.p}>
          THE SOFTWARE IS PROVIDED &ldquo;AS IS&rdquo;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
          IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
          FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
          AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
          LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
          OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
          SOFTWARE.
        </p>

        <hr style={S.divider} />

        <p style={S.p}>
          The full license is also available in the{" "}
          <a href="https://github.com/shotoku-dev/shotoku/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" style={{ color: "#DB0028", textDecoration: "none" }}>
            repository on GitHub
          </a>.
        </p>
      </div>
      <Footer />
    </>
  );
}
