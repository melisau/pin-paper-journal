import type { Metadata } from "next";
import { headers } from "next/headers";
import { DM_Sans, Fraunces, Inter, Lora } from "next/font/google";
import { THEME_BOOTSTRAP } from "@/lib/theme";
import "./globals.css";
import "./themes.css";

const lora = Lora({ subsets: ["latin", "latin-ext"], variable: "--font-lora", display: "swap", preload: false });
const dmSans = DM_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-dm-sans", display: "swap", preload: false });
const fraunces = Fraunces({ subsets: ["latin", "latin-ext"], variable: "--font-fraunces", display: "swap", preload: false });
const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap", preload: false });

export const metadata: Metadata = {
  title: "Pin & Paper Journal",
  description: "A private, encrypted digital journal for memories, photos and little joys.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <html lang="en" suppressHydrationWarning className={`${lora.variable} ${dmSans.variable} ${fraunces.variable} ${inter.variable}`}><head><script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }}/></head><body>{children}</body></html>;
}
