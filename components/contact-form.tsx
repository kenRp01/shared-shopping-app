"use client";

import { FormEvent, useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setStatus("sending");
    setMessage("");

    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        message: formData.get("message"),
      }),
    });

    const result = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setStatus("error");
      setMessage(result?.error ?? "送信できませんでした。時間をおいて再度お試しください。");
      return;
    }

    form.reset();
    setStatus("sent");
    setMessage("送信しました。内容を確認して返信します。");
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <label>
        <span>名前</span>
        <input name="name" autoComplete="name" maxLength={40} required />
      </label>

      <label>
        <span>返信先メール</span>
        <input name="email" type="email" autoComplete="email" maxLength={120} required />
      </label>

      <label>
        <span>内容</span>
        <textarea name="message" minLength={10} maxLength={1200} required rows={6} />
      </label>

      <button className="primary-button contact-submit" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "送信中" : "送信する"}
      </button>

      {message ? (
        <p className={status === "error" ? "notice-inline" : "success-inline"} role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
