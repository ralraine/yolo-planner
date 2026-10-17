import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YOLO | Personal Planner",
  description: "YOLO — your customizable study and productivity planner",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
