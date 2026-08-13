import { type FormEvent, useEffect, useState } from "react";
import { api, idempotencyKey, openEvidence } from "../api";
import type { Activity, Claim, DemoReadiness, Factor, RequestState, Role } from "../product-types";
import { BrandMark, Notice, ThaiForm, UtilityPanel } from "../ui";
import { LanguageSwitcher, useI18n } from "../i18n";

type UtilityPage = "review" | "merchant" | "admin";

const roleLabels: Record<Role, string> = {
  user: "ผู้ใช้งาน",
  reviewer: "ผู้ตรวจสอบ",
  merchant: "ร้านค้า",
  admin: "ผู้ดูแล",
};

const activityLabels: Record<Activity, string> = {
  bus: "รถโดยสาร",
  recycling: "รีไซเคิล",
  tree: "ปลูกต้นไม้",
};

const claimStatusLabels: Record<Claim["claim"]["status"], string> = {
  submitted: "รับคำขอแล้ว",
  pending: "รอข้อมูลหรือการตรวจ",
  pending_review: "รอผู้ตรวจสอบ",
  verified: "ผ่าน",
  rejected: "ไม่ผ่าน",
};

const claimReasonLabels: Record<string, string> = {
  submitted: "ส่งคำขอแล้ว",
  bus_insufficient_coverage: "ข้อมูล GPS ครอบคลุมช่วงเวลาไม่เพียงพอ",
  bus_metric_unavailable: "ข้อมูลสำหรับตรวจรถโดยสารยังไม่ครบ",
  bus_speed_below_threshold: "รูปแบบความเร็วไม่ผ่านเกณฑ์รถโดยสาร",
  bus_stop_pattern_below_threshold: "รูปแบบจุดหยุดไม่ผ่านเกณฑ์รถโดยสาร",
  bus_route_match_below_threshold: "เส้นทางไม่ตรงกับเส้นทางรถโดยสารตามเกณฑ์",
  duplicate_evidence: "หลักฐานซ้ำกับรายการที่เคยส่ง",
  tree_wrong_type: "ภาพไม่ใช่ต้นไม้ตามกิจกรรมที่ส่ง",
  tree_ambiguous: "หลักฐานต้นไม้ยังคลุมเครือและต้องให้ผู้ตรวจสอบพิจารณา",
  tree_provider_unavailable: "ระบบตรวจภาพยังไม่พร้อม จึงส่งให้ผู้ตรวจสอบ",
  recycling_pending_review: "รอผู้ตรวจสอบยืนยันการนำวัสดุมาส่ง",
  recycling_rejected: "ผู้ตรวจสอบไม่ยืนยันรายการรีไซเคิล",
  reviewer_confirmed: "ผู้ตรวจสอบยืนยันแล้ว",
  reviewer_reduced: "ผู้ตรวจสอบปรับลดจำนวนตามหลักฐาน",
  reviewer_rejected: "ผู้ตรวจสอบไม่ยืนยันหลักฐาน",
  factor_approval_required: "รอการทบทวนปัจจัยตามขอบเขต",
};

const impactStatusLabels: Record<Claim["claim"]["impact_status"], string> = {
  pending: "รอคำนวณผลกระทบ",
  credited: "บันทึกผลกระทบแล้ว",
  blocked_factor_approval: "รอการทบทวนปัจจัยตามขอบเขต",
};

const factorStatusLabels: Record<Factor["status"], string> = {
  draft: "ฉบับร่าง",
  approved: "อนุมัติสำหรับใช้งานจริง",
  rejected: "ไม่อนุมัติ",
};

function UtilityDisclosure() {
  const { t } = useI18n();
  return <p className="utility-disclosure">{t("พื้นที่นี้ใช้สำหรับการปฏิบัติงานในเวอร์ชันสาธิต ข้อมูลจำลองแยกจากข้อมูลจริง และค่าประมาณไม่ใช่คาร์บอนเครดิตที่ได้รับการรับรอง")}</p>;
}

function ReviewQueue() {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<Claim[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [state, setState] = useState<RequestState>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<{ items: Claim[] }>("/review/claims?status=pending"),
      api<{ items: Claim[] }>("/review/claims?status=pending_review"),
    ]).then(([pending, manual]) => ({
      items: [...pending.items, ...manual.items].filter((row, index, all) => all.findIndex((other) => other.claim.id === row.claim.id) === index),
    })).then((result) => {
      setItems(result.items);
      setState("success");
    }).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : t("โหลดคำขอไม่ได้"));
      setState("error");
    });
  }, []);

  async function decide(item: Claim, decision: "approve" | "reduce" | "reject") {
    const approvedItemCount = Number(counts[item.claim.id]);
    if (item.claim.activity === "recycling" && decision !== "reject" && (!Number.isSafeInteger(approvedItemCount) || approvedItemCount < 0)) {
      setError(t("ระบุจำนวนที่อนุมัติก่อนตัดสินใจ"));
      setState("error");
      return;
    }
    try {
      await api(`/review/claims/${item.claim.id}`, "PATCH", {
        decision,
        ...(decision === "reject" ? { reason: "หลักฐานไม่เพียงพอ" } : {}),
        ...(item.claim.activity === "recycling" && decision !== "reject" ? { approvedItemCount } : {}),
      });
      setItems((current) => current.filter((row) => row.claim.id !== item.claim.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("บันทึกผลไม่ได้"));
      setState("error");
    }
  }

  async function handleOpenEvidence(id: string) {
    setError("");
    try {
      await openEvidence(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("เปิดหลักฐานจำลองไม่ได้"));
      setState("error");
    }
  }

  return (
    <>
      <header className="utility-page-heading"><p>{t("สิทธิ์ผู้ตรวจสอบ")}</p><h1>{t("คิวตรวจหลักฐาน")}</h1></header>
      <Notice state={state} error={error} />
      {state === "success" && items.length === 0 && <p className="utility-empty">{t("ไม่มีรายการ")}</p>}
      <ul className="utility-list">
        {items.map((item) => (
          <li key={item.claim.id}>
            <div className="utility-list-title"><strong>{t(activityLabels[item.claim.activity])}</strong><span className={`status ${item.claim.status}`}>{t(claimStatusLabels[item.claim.status])}</span></div>
            <span className="status mock-demo">{t("คำขอจำลอง")} · {item.claim.data_scope} · {t("เดโมเท่านั้น")}</span>
            {item.claim.fixture_id && <small>{t("ฟิกซ์เจอร์สังเคราะห์")} {item.claim.fixture_id}</small>}
            <small>{new Date(item.claim.submitted_at).toLocaleString(locale)} · {t(item.claim.reason_code ? claimReasonLabels[item.claim.reason_code] ?? "มีเหตุผลจากระบบที่ยังไม่รู้จัก" : "ยังไม่มีเหตุผลประกอบ")}</small>
            <small>{t("ผลกระทบ")}: {t(impactStatusLabels[item.claim.impact_status])} · {t("คะแนน")} {item.claim.awarded_points}</small>
            {item.claim.evidence_ids?.map((id) => <button className="secondary-button" key={id} onClick={() => void handleOpenEvidence(id)}>{t("เปิดหลักฐาน")} {id.slice(0, 8)}</button>)}
            {item.claim.activity === "bus" ? (
              <p className="utility-disclosure">{t("รายการรถโดยสารต้องผ่านกฎตรวจอัตโนมัติครบทุกข้อ ผู้ตรวจสอบไม่สามารถเปลี่ยนรายการนี้เป็นสถานะผ่านได้")}</p>
            ) : (
              <div className="review-actions">
                {item.claim.activity === "recycling" && <input aria-label={t("จำนวนที่อนุมัติ")} type="number" min="0" step="1" placeholder={t("จำนวนที่อนุมัติ")} value={counts[item.claim.id] ?? ""} onChange={(event) => setCounts((current) => ({ ...current, [item.claim.id]: event.target.value }))} />}
                <button onClick={() => void decide(item, "approve")}>{t("อนุมัติ")}</button>
                {item.claim.activity === "recycling" && <button onClick={() => void decide(item, "reduce")}>{t("ลดจำนวน")}</button>}
                <button className="secondary-button" onClick={() => void decide(item, "reject")}>{t("ปฏิเสธ")}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function MerchantWorkspace() {
  const { t } = useI18n();
  const [state, setState] = useState<RequestState>("idle");
  const [error, setError] = useState("");
  const [redemption, setRedemption] = useState<{ code: string; voucherId: string }>();

  async function scan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const code = String(form.get("code"));
    setState("loading");
    setError("");
    setRedemption(undefined);
    try {
      const result = await api<{ status: "redeemed"; voucherId: string }>("/merchant/vouchers/scan", "POST", { code }, { "idempotency-key": idempotencyKey() });
      setRedemption({ code, voucherId: result.voucherId });
      formElement.reset();
      setState("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("ใช้บัตรไม่ได้"));
      setState("error");
    }
  }

  async function cancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setState("loading");
    setError("");
    try {
      await api(`/merchant/vouchers/${String(form.get("voucherId"))}/cancel`, "POST", undefined, { "idempotency-key": idempotencyKey() });
      formElement.reset();
      setState("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("ยกเลิกบัตรไม่ได้"));
      setState("error");
    }
  }

  return (
    <>
      <header className="utility-page-heading"><p>{t("ร้านค้าสาธิต")}</p><h1>{t("ใช้หรือยกเลิกบัตรรางวัล")}</h1></header>
      <UtilityPanel title={t("สแกนเพื่อใช้ครั้งเดียว")}><ThaiForm onSubmit={scan}><label>{t("รหัสบัตร")}<input name="code" required autoFocus /></label><button>{t("ตรวจและใช้สิทธิ์")}</button></ThaiForm></UtilityPanel>
      <UtilityPanel title={t("ยกเลิกก่อนใช้และคืนคะแนน")}><ThaiForm onSubmit={cancel}><label>{t("รหัส UUID ของบัตร")}<input name="voucherId" type="text" required /></label><button className="secondary-button">{t("ยกเลิกบัตร")}</button></ThaiForm></UtilityPanel>
      <Notice state={state} error={error} success={t("ใช้สิทธิ์สำเร็จและปิดรหัสบัตรแล้ว")} />
      {redemption && <section className="redemption-receipt" aria-label={t("หลักฐานการใช้บัตร")}><div><span>{t("ผลการใช้บัตร")}</span><strong>{t("ใช้สิทธิ์สำเร็จ")}</strong></div><span className="status redeemed">{t("ใช้แล้ว")}</span><small>{t("รหัส")} {redemption.code} · {t("บัตร")} {redemption.voucherId}</small><p>{t("รหัสนี้ถูกปิดหลังใช้ครั้งแรก ร้านค้าสาธิตไม่สามารถใช้ซ้ำได้")}</p></section>}
      <p className="utility-disclosure">{t("บัตรที่ใช้แล้วหรือหมดอายุยกเลิกไม่ได้ และบัตรหมดอายุไม่คืนคะแนน")}</p>
    </>
  );
}

function AdminWorkspace() {
  const { t, locale } = useI18n();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [readiness, setReadiness] = useState<DemoReadiness>();
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<RequestState>("loading");
  const [error, setError] = useState("");

  function load() {
    Promise.all([api<{ items: Factor[] }>("/admin/factors"), api<DemoReadiness>("/admin/factors/demo-readiness")])
      .then(([catalog, status]) => { setFactors(catalog.items); setReadiness(status); setState("success"); })
      .catch((cause: unknown) => { setError(cause instanceof Error ? cause.message : t("โหลดปัจจัยไม่ได้")); setState("error"); });
  }

  useEffect(load, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    let assumptions: Record<string, unknown> = {};
    try {
      assumptions = JSON.parse(String(form.get("assumptions") || "{}")) as Record<string, unknown>;
    } catch {
      setError(t("สมมติฐานต้องเป็น JSON ที่ถูกต้อง"));
      setState("error");
      return;
    }
    try {
      await api("/admin/factors", "POST", {
        activity: form.get("activity"), code: form.get("code"), version: form.get("version"), value: form.get("value"), unit: form.get("unit"), sourceUrl: form.get("sourceUrl"), methodologyCode: form.get("methodologyCode"), effectiveAt: new Date(String(form.get("effectiveAt"))).toISOString(), assumptions, disclaimerThai: form.get("disclaimerThai"), proxyCopyThai: form.get("proxyCopyThai"),
      });
      formElement.reset();
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("สร้างปัจจัยไม่ได้"));
      setState("error");
    }
  }

  async function approve(id: string) {
    if (!confirmed[id]) {
      setError(t("ต้องยืนยันการตรวจทานครบทุกหัวข้อก่อนส่งตรวจทานเดโมจำลอง"));
      setState("error");
      return;
    }
    try {
      await api(`/admin/factors/${id}/approve`, "PATCH");
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("ส่งตรวจทานเดโมจำลองไม่ได้"));
      setState("error");
    }
  }

  return (
    <>
      <header className="utility-page-heading"><p>{t("ผู้ดูแลเดโมจำลอง")}</p><h1>{t("ปัจจัยคำนวณแบบปิดเมื่อไม่พร้อม")}</h1></header>
      <Notice state={state} error={error} />
      <UtilityPanel title={t("สถานะความพร้อมของเดโมจำลอง")}>
        <strong>{t(readiness?.mockDemoReady ? "ปัจจัยเดโมจำลองพร้อม" : "ปัจจัยเดโมจำลองยังไม่พร้อม")}</strong>
        {readiness?.databaseScope && <p>{t("ขอบเขตฐานข้อมูลที่สังเกต")}: {readiness.databaseScope}</p>}
        <p>{t("ปัจจัยสำหรับใช้งานจริง")}: {t(readiness?.productionFactorsReady ? "ครบเฉพาะปัจจัย" : "ยังไม่ครบ")}</p>
        <p>{t("ความพร้อมใช้งานจริง")}: {t(readiness?.productionReady ? "จริง" : "ไม่พร้อม")} · {t("การรับรองจาก อบก.")}: {t(readiness?.tgoEndorsed ? "มี" : "ไม่มี")} · {t("หลักฐานทางกายภาพ")}: {t(readiness?.physicalEvidence ? "มี" : "ไม่ได้เก็บ")}</p>
        <ul className="utility-list compact">
          {(["bus", "recycling", "tree"] as const).map((activity) => <li key={activity}><strong>{t(activityLabels[activity])}</strong><span>{t(readiness?.activities[activity]?.ready ? "พร้อมสำหรับเดโมจำลอง" : "ยังไม่พร้อมสำหรับเดโมจำลอง")}</span>{readiness?.activities[activity]?.factorId && <small>{t("ปัจจัย")} {readiness.activities[activity].factorId}</small>}</li>)}
        </ul>
      </UtilityPanel>
      <UtilityPanel title={t("เพิ่มปัจจัยฉบับร่าง")}>
        <ThaiForm onSubmit={create}>
          <label>{t("กิจกรรม")}<select name="activity"><option value="bus">{t("รถโดยสาร")}</option><option value="recycling">{t("รีไซเคิล")}</option><option value="tree">{t("ต้นไม้")}</option></select></label>
          <label>{t("รหัส")}<input name="code" required /></label><label>{t("เวอร์ชัน")}<input name="version" required /></label><label>{t("ค่า")}<input name="value" inputMode="decimal" required /></label><label>{t("หน่วย")}<input name="unit" required /></label><label>{t("URL แหล่งอ้างอิง")}<input name="sourceUrl" type="url" required /></label><label>{t("รหัสวิธีวิทยา")}<input name="methodologyCode" required /></label><label>{t("วันที่เริ่มใช้")}<input name="effectiveAt" type="datetime-local" required /></label><label>{t("สมมติฐาน JSON")}<textarea name="assumptions" defaultValue="{}" required /></label><label>{t("คำชี้แจงภาษาไทย")}<textarea name="disclaimerThai" required /></label><label>{t("ข้อความอธิบายพร็อกซีภาษาไทย")}<textarea name="proxyCopyThai" required /></label><button>{t("สร้างฉบับร่าง")}</button>
        </ThaiForm>
      </UtilityPanel>
      <ul className="utility-list factor-list">
        {factors.map((factor) => (
          <li key={factor.id}>
            <div className="utility-list-title"><strong>{t(activityLabels[factor.activity])} · {factor.code} · {factor.version}</strong><span className={`status ${factor.status}`}>{t(factor.status === "draft" ? "ฉบับร่างสำหรับใช้งานจริง" : factorStatusLabels[factor.status])}</span></div>
            {factor.mock_approval_scope === "mock_demo" && factor.mock_is_mock === true && factor.mock_demo_only === true && <span className="status mock-demo">{t("ทบทวน mock_demo แล้ว")} · {t("ใช้สำหรับเดโมเท่านั้น")}</span>}
            {factor.mock_approved_at && <small>{t("ผู้ทบทวนเดโม")} {factor.mock_approved_role} · {factor.mock_approved_by} · {new Date(factor.mock_approved_at).toLocaleString(locale)}</small>}
            {factor.mock_reviewed_digest && <small>{t("รหัสตรวจทาน")} {factor.mock_reviewed_digest}</small>}
            <small>{factor.value} {factor.unit} · {factor.methodology_code}</small><a href={factor.source_url} target="_blank" rel="noreferrer">{t("เปิดแหล่งอ้างอิง")}</a><p>{factor.proxy_copy_th}</p><p className="utility-disclosure">{factor.disclaimer_th}</p>
            {factor.status === "draft" && factor.mock_approval_scope !== "mock_demo" && <div className="review-actions"><label className="switch-row"><input type="checkbox" checked={confirmed[factor.id] ?? false} onChange={(event) => setConfirmed((current) => ({ ...current, [factor.id]: event.target.checked }))} />{t("ตรวจทานค่า หน่วย แหล่งอ้างอิง วิธีวิทยา เวอร์ชัน วันที่ สมมติฐาน และข้อความภาษาไทยแล้ว")}</label><button onClick={() => void approve(factor.id)}>{t("ส่งตรวจทานเดโมจำลอง")}</button></div>}
          </li>
        ))}
      </ul>
      <UtilityDisclosure />
    </>
  );
}

export function OperationsApp({ role, onSwitchRole, onLogout }: { role: Exclude<Role, "user">; onSwitchRole: (role: Role) => void; onLogout: () => void }) {
  const { t } = useI18n();
  const [page, setPage] = useState<UtilityPage>(role === "merchant" ? "merchant" : role === "admin" ? "admin" : "review");
  const links: Array<[UtilityPage, string]> = role === "merchant" ? [["merchant", t("ร้านค้า")]] : role === "admin" ? [["admin", t("ปัจจัย")], ["review", t("คิวตรวจ")]] : [["review", t("คิวตรวจ")]];
  const content = page === "merchant" ? <MerchantWorkspace /> : page === "admin" ? <AdminWorkspace /> : <ReviewQueue />;
  return (
    <div className="utility-shell">
      <header className="utility-topbar"><BrandMark /><div><small>{t("พื้นที่ปฏิบัติงาน")}</small><strong>{t(roleLabels[role])}</strong></div><LanguageSwitcher /><button className="secondary-button" onClick={() => onSwitchRole("user")}>{t("กลับไปแอปผู้ใช้")}</button><button className="text-button" onClick={onLogout}>{t("ออกจากระบบ")}</button></header>
      <nav className="utility-nav" aria-label={t("เมนูหลัก")}>{links.map(([id, label]) => <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}>{label}</button>)}</nav>
      <main>{content}</main>
      <footer><UtilityDisclosure /></footer>
    </div>
  );
}
