import DocsShell from "../components/docs/DocsShell";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`body { background: #F4F3EF !important; }`}</style>
      <DocsShell>{children}</DocsShell>
    </>
  );
}
