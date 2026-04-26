import LoginForm from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

function getSearchParamValue(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const nextPath = getSearchParamValue(params.next);

  return <LoginForm nextPath={nextPath} />;
}
