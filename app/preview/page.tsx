import { notFound } from "next/navigation";
import JournalApp from "@/components/journal-app";

export default function PreviewPage() {
  if (process.env.NODE_ENV !== "development" && process.env.ENABLE_E2E_PREVIEW !== "1") notFound();
  return <JournalApp/>;
}
