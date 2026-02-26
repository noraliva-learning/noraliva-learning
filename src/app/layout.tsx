import "./globals.css";

export const metadata = {
  title: "Liv & Elle Learning Arcade",
  description: "Elite adaptive learning platform (Phase 1 scaffold).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-zinc-900">{children}</body>
    </html>
  );
}
