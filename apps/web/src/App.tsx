import { useState } from "react";
import { api, TOKEN_KEY } from "./api";
import { ConsumerApp } from "./consumer/ConsumerApp";
import { OperationsApp } from "./operations/OperationsApp";
import type { RequestState, Role } from "./product-types";
import { BrandMark, Notice } from "./ui";
import { LanguageSwitcher, useI18n } from "./i18n";

function Welcome({ onStart, state, error }: { onStart: () => void; state: RequestState; error: string }) {
  const { t } = useI18n();
  return (
    <main className="welcome-screen">
      <header className="welcome-header"><BrandMark /><LanguageSwitcher /></header>
      <div className="welcome-scene" aria-hidden="true">
        <svg viewBox="0 0 520 150">
          <path d="M6 132h508" />
          <path d="M60 132V96h34v36M74 96V78h24v54M132 132V64h44v68M146 82h9M146 98h9M146 114h9M196 132V90h32v42M318 132V72h40v60M330 88h8M330 104h8" />
          <path className="accent" d="M340 72v-14l14 5-14 5" />
          <path d="M232 108h60v24h-60zM232 118h60M240 132v6M284 132v6M240 100l6-8h32l6 8" />
          <circle cx="248" cy="126" r="2.6" /><circle cx="276" cy="126" r="2.6" />
          <path className="leaf" d="M32 132v-20m0 0c-9-6-9-15 0-19 9 4 9 13 0 19ZM414 132v-26m0 0c-11-7-11-18 0-23 11 5 11 16 0 23ZM478 132v-18m0 0c-8-5-8-13 0-17 8 4 8 12 0 17Z" />
          <path d="M440 114h22l-2 18h-18l-2-18Zm-3 0h28M447 108h8" />
          <circle className="accent" cx="486" cy="38" r="12" />
          <path className="accent" d="M486 18v-8M486 66v-4M466 38h-8M506 38h8M472 24l-5-5M500 24l5-5" />
        </svg>
      </div>
      <div className="welcome-copy"><h1>{t("ลดคาร์บอน รับคะแนน")}</h1><p>{t("ทำกิจกรรม · รับคะแนน · แลกรางวัล")}</p></div>
      <button className="primary-button welcome-button" disabled={state === "loading"} onClick={onStart}>{t(state === "loading" ? "กำลังเริ่ม…" : "เริ่มใช้งาน")}</button>
      <Notice state={state === "error" ? "error" : "idle"} error={error} />
      <small>{t("เวอร์ชันสาธิต")}</small>
    </main>
  );
}

export default function App() {
  const { t } = useI18n();
  const [role, setRole] = useState<Role>();
  const [state, setState] = useState<RequestState>("idle");
  const [error, setError] = useState("");

  async function login(nextRole: Role) {
    setState("loading");
    setError("");
    try {
      const result = await api<{ accessToken: string }>("/auth/demo-login", "POST", { role: nextRole });
      sessionStorage.setItem(TOKEN_KEY, result.accessToken);
      setRole(nextRole);
      setState("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("เข้าสู่ระบบไม่ได้"));
      setState("error");
    }
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setRole(undefined);
    setState("idle");
  }

  if (!role) return <Welcome onStart={() => void login("user")} state={state} error={error} />;
  if (role === "user") return <ConsumerApp onSwitchRole={(nextRole) => void login(nextRole)} onLogout={logout} />;
  return <OperationsApp role={role} onSwitchRole={(nextRole) => void login(nextRole)} onLogout={logout} />;
}
