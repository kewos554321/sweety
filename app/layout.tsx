import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sweety",
  description: "Your English learning buddy on LINE",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  );
}
