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
      <AdSlot slot={process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_LOGIN} label="ログインページ広告" />
    </>
  );
}
