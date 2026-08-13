import { useState } from "react";
import { api, TOKEN_KEY } from "./api";
import { ConsumerApp } from "./consumer/ConsumerApp";
import { OperationsApp } from "./operations/OperationsApp";
import type { RequestState, Role } from "./product-types";
import { BrandMark, Icon, Notice } from "./ui";

function Welcome({ onStart, state, error }: { onStart: () => void; state: RequestState; error: string }) {
  return (
    <main className="welcome-screen">
      <BrandMark />
      <div className="welcome-visual" aria-hidden="true"><Icon name="activity" /><Icon name="bus" /><Icon name="recycling" /><Icon name="tree" /></div>
      <div className="welcome-copy"><h1>เริ่มลดคาร์บอน<br />จากสิ่งที่ทำทุกวัน</h1><p>ทำกิจกรรม รับคะแนน แล้วแลกรางวัลที่ใช้ได้จริง</p></div>
      <button className="primary-button welcome-button" disabled={state === "loading"} onClick={onStart}>{state === "loading" ? "กำลังเริ่ม…" : "เริ่มใช้งาน"}</button>
      <Notice state={state === "error" ? "error" : "idle"} error={error} />
      <small>เวอร์ชันสาธิต · ภาษาไทย</small>
    </main>
  );
}

export default function App() {
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
      setError(cause instanceof Error ? cause.message : "เข้าสู่ระบบไม่ได้");
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
