import "./globals.css";

export const metadata = {
  title: "Liv & Elle Learning Arcade",
  description: "Practice math, reading, and more — made for Liv & Elle.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-zinc-900">{children}</body>
    </html>
  );
}
