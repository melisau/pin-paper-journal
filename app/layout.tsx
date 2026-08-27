import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pin & Paper Journal",
  description: "A private, encrypted digital journal for memories, photos and little joys.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
