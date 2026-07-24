import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { AdSlot } from "@/components/ad-slot";

export const metadata: Metadata = {
  title: "ログイン",
  description: "ShareShopiの共有買い物リストをGoogleログインまたはメールログインで安全に使えます。",
  alternates: {
    canonical: "/login",
  },
};

export default function LoginPage() {
  return (
    <>
      <AuthForm />
      <AdSlot placement="login" label="ログインページ広告" />
    </>
  );
}
