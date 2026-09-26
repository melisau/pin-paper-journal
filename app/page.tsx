import AuthForm from "@/components/auth-form";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AuthPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  return <AuthForm
    authIssue={typeof params.auth === "string" ? params.auth : undefined}
    callbackError={typeof params.error === "string" ? params.error : undefined}
  />;
}
