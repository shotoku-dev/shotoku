import DocsSidebar from "../components/docs/DocsSidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`body { background: #F4F3EF !important; }`}</style>
      <div
        style={{
          height:     "100vh",
          overflow:   "hidden",
          display:    "flex",
          background: "#F4F3EF",
        }}
      >
        <DocsSidebar />
        <main
          style={{
            flex:          1,
            display:       "flex",
            flexDirection: "column",
            padding:       "16px 16px 16px 0",
            overflow:      "hidden",
          }}
        >
          <div
            style={{
              flex:         1,
              background:   "#ffffff",
              borderRadius: 14,
              border:       "1px solid rgba(0,0,0,0.08)",
              overflowY:    "auto",
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
