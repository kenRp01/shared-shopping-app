export function maskEmailAddress(email?: string | null) {
  const value = email?.trim() ?? "";
  const [local = "", domain = ""] = value.split("@");

  if (!local || !domain) {
    return "非公開";
  }

  const localChars = Array.from(local);
  const domainParts = domain.split(".");
  const domainHead = domainParts[0] ?? "";
  const suffix = domainParts.length > 1 ? `.${domainParts.slice(1).join(".")}` : "";

  const maskedLocal =
    localChars.length <= 2
      ? `${localChars[0] ?? ""}***`
      : `${localChars[0]}${localChars[1]}***${localChars[localChars.length - 1]}`;
  const maskedDomain = `${Array.from(domainHead)[0] ?? ""}***${suffix}`;

  return `${maskedLocal}@${maskedDomain}`;
}

export function privateMemberLabel(index: number, isCurrentUser: boolean) {
  return isCurrentUser ? "あなた" : `メンバー${index + 1}`;
}
