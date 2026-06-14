export function isAuthorizedCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const url = new URL(request.url);
  const auth = request.headers.get("authorization");
  return (
    auth === `Bearer ${secret}` ||
    request.headers.get("x-cron-secret") === secret ||
    url.searchParams.get("secret") === secret
  );
}
