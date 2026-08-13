import { type FormEvent, lazy, Suspense, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  api,
  DEMO_BUS_ROUTE,
  idempotencyKey,
  SYNTHETIC_FIXTURE_ID,
  SYNTHETIC_SAMPLING_INTERVAL_MS,
  syntheticPhoto,
  TREE_FIXTURE_LOCATION,
  uploadGpsTrace,
  uploadPhoto,
} from "../api";
import type {
  Activity,
  CapturedPhoto,
  Claim,
  DashboardData,
  GpsSample,
  LeaderboardConsent,
  LeaderboardData,
  RequestState,
  Reward,
  Role,
  Voucher,
} from "../product-types";
import { IS_PUBLIC_PRESENTATION_DEMO } from "../public-demo";
import { formatCarbonTotal, formatCarbonValue, getPrimaryImpact } from "../carbon-impact";
import { ActivityIcon, BrandMark, Icon, Notice, ThaiForm } from "../ui";
import { CitySkyline, InkBurst, useCountUp } from "./motion";
import { estimateCarbonImpact, structureBudget } from "./cityGrowth";

/* three.js stays out of the entry chunk; the skyline covers load and no-WebGL */
const CityCanvas = lazy(() => import("./CityCanvas").then((module) => ({ default: module.CityCanvas })));
import { LanguageSwitcher, useI18n } from "../i18n";
import { localizeRewardTitle } from "../localization";

type ConsumerPage = "home" | "leaderboard" | "activities" | "history" | "wallet" | "voucher" | "profile" | "capture";

type Translate = (source: string, values?: Record<string, string | number>) => string;

function getActivityCopy(t: Translate): Record<Activity, { title: string; description: string; reward: string; detail: string }> {
  return {
    bus: { title: t("ขึ้นรถโดยสาร"), description: t("ขนส่งสาธารณะ"), reward: t("3 คะแนน"), detail: t("บันทึกการเดินทางด้วยขนส่งสาธารณะ") },
    recycling: { title: t("ส่งรีไซเคิล"), description: t("ขวด PET และวัสดุ"), reward: t("คะแนนตามจำนวนที่ตรวจสอบ"), detail: t("นำขวด PET ไปส่งและยืนยันจำนวน") },
    tree: { title: t("ปลูกต้นไม้"), description: t("รูป · ชนิด · ตำแหน่ง"), reward: t("15 คะแนน"), detail: t("ส่งรูปและตำแหน่งเพื่อรอตรวจสอบ") },
  };
}

function getClaimStatusCopy(t: Translate): Record<Claim["claim"]["status"], string> {
  return {
    submitted: t("กำลังตรวจสอบ"), pending: t("กำลังตรวจสอบ"), pending_review: t("กำลังตรวจสอบ"),
    verified: t("ผ่านการตรวจสอบ"), rejected: t("ต้องตรวจสอบอีกครั้ง"),
  };
}

const consumerReasonCopy: Record<string, string> = {
  submitted: "เราได้รับกิจกรรมของคุณแล้ว",
  bus_insufficient_coverage: "ข้อมูลการเดินทางยังไม่ต่อเนื่องพอ กรุณาลองบันทึกใหม่",
  bus_metric_unavailable: "ข้อมูลการเดินทางยังไม่ครบ กรุณารอตรวจสอบ",
  bus_speed_below_threshold: "รูปแบบการเดินทางยังไม่ตรงกับรถโดยสาร",
  bus_stop_pattern_below_threshold: "จุดหยุดระหว่างทางยังไม่ชัดเจน",
  bus_route_match_below_threshold: "เส้นทางที่บันทึกยังไม่ตรงกับเส้นทางรถโดยสาร",
  duplicate_evidence: "กิจกรรมนี้ซ้ำกับรายการที่ส่งไว้แล้ว",
  tree_wrong_type: "รูปที่ส่งยังไม่เห็นต้นไม้ชัดเจน",
  tree_ambiguous: "รูปต้นไม้ยังไม่ชัดเจน กรุณารอผู้ตรวจสอบ",
  tree_provider_unavailable: "กำลังรอผู้ตรวจสอบรูปต้นไม้",
  recycling_pending_review: "กำลังรอยืนยันจำนวนที่นำมาส่ง",
  recycling_rejected: "ยังยืนยันรายการรีไซเคิลไม่ได้",
  reviewer_confirmed: "ยืนยันกิจกรรมแล้ว",
  reviewer_reduced: "คะแนนปรับตามจำนวนที่ตรวจสอบได้",
  reviewer_rejected: "หลักฐานยังไม่เพียงพอ กรุณาลองใหม่",
  factor_approval_required: "กิจกรรมนี้ยังไม่พร้อมให้คะแนน",
};

const DEMO_BUS_PLAYBACK_INTERVAL_MS = 400;

function getNavItems(t: Translate): Array<{ id: ConsumerPage; label: string; icon: "home" | "activity" | "wallet" | "profile" }> {
  return [
    { id: "home", label: t("หน้าแรก"), icon: "home" },
    { id: "activities", label: t("ทำกิจกรรม"), icon: "activity" },
    { id: "wallet", label: t("กระเป๋า"), icon: "wallet" },
    { id: "profile", label: t("ฉัน"), icon: "profile" },
  ];
}

function primaryDestination(page: ConsumerPage): ConsumerPage {
  if (page === "capture" || page === "history") return "activities";
  if (page === "voucher") return "wallet";
  if (page === "leaderboard") return "home";
  return page;
}

function formatDate(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(value: string, locale: string): string {
  return new Date(value).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

function impactValueCopy(t: Translate, activity: Activity, rawValue: number, horizonYears = 5): string {
  const count = formatCarbonValue(rawValue);
  if (activity === "bus") return t("น้อยกว่ารถยนต์ประมาณ {count} กก. CO₂", { count });
  if (activity === "recycling") return t("หลีกเลี่ยงประมาณ {count} กก. CO₂e", { count });
  return t("คาดว่าจะดูดซับประมาณ {count} กก. CO₂e ใน {years} ปี", { count, years: horizonYears });
}

function impactNoteCopy(t: Translate, activity: Activity): string {
  if (activity === "bus") return t("เปรียบเทียบการปล่อยช่วงใช้งานในระยะทางเดียวกัน");
  if (activity === "recycling") return t("ประเมินจากจำนวนขวด PET ที่ตรวจสอบแล้ว โดยสมมติว่ารีไซเคิลสำเร็จ");
  return t("ปรับตามอัตรารอด ไม่ใช่คาร์บอนเครดิตที่รับรองแล้ว");
}

function ClimateReceipt({ activity, impacts }: { activity: Activity; impacts: Claim["claim"]["impacts"] }) {
  const { t } = useI18n();
  const impact = getPrimaryImpact(activity, impacts);
  if (!impact) return null;
  return (
    <section className={`climate-receipt ${activity}`} aria-label={t("ผลกระทบคาร์บอนของฉัน")}>
      <div className="climate-receipt-value">
        <Icon name="activity" />
        <strong>{impactValueCopy(t, activity, Number(impact.kg_co2e), impact.horizon_years)}</strong>
      </div>
      <p>{impactNoteCopy(t, activity)}</p>
      <details>
        <summary>{t("คำนวณอย่างไร")}<Icon name="chevron" /></summary>
        <p>{t("เป็นค่าประมาณจากแนวทาง TGO ไม่ใช่คาร์บอนเครดิต")}</p>
      </details>
    </section>
  );
}

function BalanceImpactSummary({ avoided, projected }: { avoided: string; projected: string }) {
  const { t } = useI18n();
  return (
    <div className="balance-impact" role="region" aria-live="polite" aria-label={t("ผลกระทบคาร์บอนของฉัน")}>
      <h2>{t("ผลกระทบคาร์บอนของฉัน")}</h2>
      <dl>
        <div><dt>{t("การปล่อยที่หลีกเลี่ยง (โดยประมาณ)")}</dt><dd><strong>{formatCarbonTotal(Number(avoided))}</strong> kg CO₂e</dd></div>
        <div><dt>{t("การดูดซับที่คาดการณ์ (5 ปี)")}</dt><dd><strong>{formatCarbonTotal(Number(projected))}</strong> kg CO₂e</dd></div>
      </dl>
      <details>
        <summary>{t("คำนวณอย่างไร")}<Icon name="chevron" /></summary>
        <p>{t("เป็นค่าประมาณจากแนวทาง TGO ไม่ใช่คาร์บอนเครดิต")}</p>
      </details>
    </div>
  );
}

function PageHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  const { t } = useI18n();
  return (
    <header className="screen-heading">
      {onBack && <button className="icon-button back-button" type="button" onClick={onBack} aria-label={t("ย้อนกลับ")}><Icon name="back" /></button>}
      <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      {onBack && <span className="detail-help" aria-label={t("ข้อมูลช่วยเหลือ")}><Icon name="help" /></span>}
    </header>
  );
}

function BalanceModule({ points, reward, avoided, projected }: { points: number; reward?: Reward; avoided: string; projected: string }) {
  const { t, language } = useI18n();
  const displayPoints = useCountUp(points);
  const target = reward?.pointsCost ?? 20;
  const remaining = Math.max(0, target - points);
  const progress = Math.min(100, target === 0 ? 100 : (points / target) * 100);
  return (
    <section className="balance-module" aria-label={t("คะแนนของคุณ")}>
      <span className="balance-leaf-mark" aria-hidden="true"><Icon name="activity" /></span>
      <div className="balance-copy">
        <strong><span>{displayPoints}</span> {t("คะแนน")}</strong>
        <div className="progress-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        <p>{remaining === 0
          ? t("แลกได้แล้ว")
          : reward
            ? reward.titleThai.replace(/\s*\(สาธิต\)\s*$/, "") === "ส่วนลดสินค้า 20 บาท"
              ? t("อีก {count} คะแนน รับส่วนลด 20 บาท", { count: remaining })
              : t("อีก {count} คะแนน รับ{reward}", { count: remaining, reward: localizeRewardTitle(language, reward.titleThai) })
            : t("อีก {count} คะแนน ถึงรางวัล", { count: remaining })}</p>
      </div>
      <BalanceImpactSummary avoided={avoided} projected={projected} />
    </section>
  );
}

const compactSceneViewBox: Record<Activity, string> = {
  bus: "88 8 226 74",
  recycling: "216 8 142 74",
  tree: "188 8 100 74",
};

function ActivityScene({ activity, compact = false }: { activity: Activity; compact?: boolean }) {
  return (
    <span className={`activity-scene ${activity}${compact ? " compact-scene" : ""}`} aria-hidden="true">
      <svg viewBox={compact ? compactSceneViewBox[activity] : "0 0 360 82"} preserveAspectRatio="xMidYMid meet">
        <path d="M2 72h356M34 72V51m0 0c-14-9-14-24 0-31 14 7 14 22 0 31Zm274 21V48m0 0c-12-8-12-21 0-27 12 6 12 19 0 27Z" />
        {activity === "bus" && <><rect x="116" y="42" width="96" height="28" rx="5"/><circle cx="135" cy="71" r="8"/><circle cx="193" cy="71" r="8"/><path d="M126 49h65M212 54h17v16M256 72V39h25v33M264 49h6M264 59h6"/></>}
        {activity === "recycling" && <><path d="M238 30h48l-4 42h-40l-4-42Zm-6 0h60M252 20h20M252 48l9-9 8 9M269 48l-8 9-9-9"/><path d="M304 37h15v35h-15zM325 47h20v25h-20z"/></>}
        {activity === "tree" && <><path d="M232 72V31M232 38l-15-10M232 47l17-13M232 55l-18-9M220 24c-7-1-10-7-8-14 7 0 12 4 12 11M246 31c7-1 11-7 10-14-8-1-13 4-13 11M206 72v-15l-7-12h14l-7 12"/></>}
      </svg>
    </span>
  );
}

function ActivityRow({ activity, onClick, compact = false }: { activity: Activity; onClick: () => void; compact?: boolean }) {
  const { t } = useI18n();
  const activityCopy = getActivityCopy(t);
  const copy = activityCopy[activity];
  return (
    <button className={`activity-row${compact ? " compact" : ""}`} type="button" onClick={onClick}>
      <span className="activity-icon"><ActivityIcon activity={activity} /></span>
      <span className="activity-row-copy"><strong>{copy.title}</strong><small>{copy.detail}</small>{!compact && <em>{copy.reward}</em>}</span>
      <Icon className="chevron" name="chevron" />
      <ActivityScene activity={activity} compact={compact} />
    </button>
  );
}

function HomeScreen({ onNavigate, onSelectActivity }: { onNavigate: (page: ConsumerPage) => void; onSelectActivity: (activity: Activity) => void }) {
  const { t, language } = useI18n();
  const activityCopy = getActivityCopy(t);
  const claimStatusCopy = getClaimStatusCopy(t);
  const [data, setData] = useState<DashboardData>();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData>();
  const [state, setState] = useState<RequestState>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<DashboardData>("/dashboard"), api<{ items: Reward[] }>("/rewards"), api<unknown>("/leaderboard/weekly")])
      .then(([dashboard, catalog, weekly]) => {
        setData(dashboard);
        setRewards(catalog.items.filter((reward) => reward.active));
        setLeaderboard(parseLeaderboardData(weekly));
        setState("success");
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : t("โหลดหน้าแรกไม่ได้"));
        setState("error");
      });
  }, [t]);

  if (!data) return <div className="screen-state"><Notice state={state} error={error} /></div>;
  const firstReward = rewards.reduce<Reward | undefined>((lowest, reward) => !lowest || reward.pointsCost < lowest.pointsCost ? reward : lowest, undefined);
  const latest = data.recent_claims?.[0];
  const viewerEntry = leaderboard?.viewer.pseudonym_th
    ? leaderboard.entries.find((entry) => entry.pseudonym_th === leaderboard.viewer.pseudonym_th)
    : undefined;
  const previewEntries = leaderboard
    ? [...leaderboard.entries.slice(0, 3), ...(viewerEntry && viewerEntry.rank > 3 ? [viewerEntry] : [])]
    : [];

  return (
    <div className="home-screen">
      <PageHeader title={data.points === 0 ? t("เริ่มกิจกรรมแรกของคุณ") : t("กลับมารับคะแนนกัน")} subtitle={t("ทำกิจกรรมที่ช่วยโลก แล้วรับคะแนนเมื่อผ่านการตรวจสอบ")} />
      <section className="home-hero">
        <BalanceModule points={data.points} reward={firstReward} avoided={data.personal.estimated_avoided_co2e} projected={data.personal.projected_sequestration_co2e} />
        <button className="primary-button home-primary" onClick={() => onNavigate("activities")}><Icon name="activity" />{t("ทำกิจกรรมรับคะแนน")}</button>
      </section>
      <section className="content-section">
        <div className="section-heading"><h2>{t("ทำอะไรได้บ้าง")}</h2></div>
        <div className="activity-list">
          {(["bus", "recycling", "tree"] as const).map((activity) => <ActivityRow key={activity} activity={activity} compact onClick={() => onSelectActivity(activity)} />)}
        </div>
      </section>
      <div className="home-secondary-grid">
        <section className="content-section reward-preview">
          <div className="section-heading"><h2>{t("แลกของรางวัลแนะนำ")}</h2></div>
          {firstReward ? (
            <button className="reward-preview-row" onClick={() => onNavigate("wallet")}>
              <span className="reward-icon"><Icon name="ticket" /></span>
              <span><strong>{localizeRewardTitle(language, firstReward.titleThai)}</strong></span>
              <em>{firstReward.pointsCost} {t("คะแนน")}</em>
              <Icon className="chevron" name="chevron" />
            </button>
          ) : <p className="empty-copy">{t("ยังไม่มีรางวัลในขณะนี้")}</p>}
        </section>
        <section className="content-section recent-preview">
          <div className="section-heading"><h2>{t("กิจกรรมล่าสุด")}</h2><button className="text-button" onClick={() => onNavigate("history")}>{t("ดูประวัติ")}</button></div>
          {latest ? (
            <button className="recent-row" onClick={() => onNavigate("history")}>
              <ActivityIcon activity={latest.activity} />
              <span><strong>{activityCopy[latest.activity].title}</strong><small>{claimStatusCopy[latest.state]}</small></span>
              <Icon className="chevron" name="chevron" />
            </button>
          ) : (
            <div className="empty-state compact-empty"><Icon name="history" /><strong>{t("ยังไม่มีกิจกรรม")}</strong></div>
          )}
        </section>
        <section className="content-section leaderboard-preview">
          <div className="section-heading"><h2>{t("อันดับประจำสัปดาห์")}</h2><button className="text-button" onClick={() => onNavigate("leaderboard")}>{t("ดูทั้งหมด")}</button></div>
          {previewEntries.length > 0 ? <ol className="leaderboard-list preview-list">{previewEntries.map((entry) => <li className={entry.pseudonym_th === leaderboard?.viewer.pseudonym_th ? "is-viewer" : ""} key={`${entry.rank}-${entry.pseudonym_th}`}><span>{entry.rank}</span><strong>{entry.pseudonym_th}</strong><em>{entry.weekly_points} {t("คะแนน")}</em></li>)}</ol> : <p className="empty-copy">{t("ชุมชนกำลังเริ่มต้น")}</p>}
        </section>
      </div>
    </div>
  );
}

function ActivityHub({ onSelect, onHistory }: { onSelect: (activity: Activity) => void; onHistory: () => void }) {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t("ทำกิจกรรม")} subtitle={t("เลือกกิจกรรมที่คุณทำวันนี้")} />
      <p className="trust-line"><Icon name="check" />{t("คะแนนจะเพิ่มเมื่อกิจกรรมผ่านการตรวจสอบ")}</p>
      <div className="activity-hub-list">
        {(["bus", "recycling", "tree"] as const).map((activity) => (
          <ActivityRow key={activity} activity={activity} onClick={() => onSelect(activity)} />
        ))}
      </div>
      <button className="history-link-row" onClick={onHistory}><Icon name="history" /><span>{t("ดูประวัติกิจกรรม")}</span><Icon name="chevron" /></button>
    </div>
  );
}

function PhotoCapture({ activity, photo, onCapture }: { activity: "tree" | "recycling"; photo?: CapturedPhoto; onCapture: (photo: CapturedPhoto) => void }) {
  const { t } = useI18n();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function capture() {
    setLoading(true);
    setError("");
    try {
      onCapture(await syntheticPhoto(activity));
    } catch {
      setError(t("เตรียมรูปไม่ได้ กรุณาลองใหม่"));
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className={`capture-surface${photo ? " has-photo" : ""}`}>
      <div className="capture-illustration"><ActivityIcon activity={activity} /></div>
      <strong>{t(photo ? "เพิ่มรูปแล้ว" : activity === "tree" ? "เพิ่มรูปต้นไม้" : "เพิ่มรูปวัสดุรีไซเคิล")}</strong>
      <p>{t(photo ? activity === "recycling" ? "พร้อมส่ง" : "พร้อมตรวจสอบ" : activity === "tree" ? "ถ่ายให้เห็นต้นไม้และบริเวณโดยรอบ" : "ถ่ายให้เห็นวัสดุและจุดรับ")}</p>
      <button className="secondary-button" type="button" onClick={() => void capture()} disabled={loading}><Icon name="camera" />{t(loading ? "กำลังเตรียมรูป…" : "ถ่ายรูป")}</button>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

function ActivityCapture({ activity, onBack, onHistory }: { activity: Activity; onBack: () => void; onHistory: () => void }) {
  const { t } = useI18n();
  const activityCopy = getActivityCopy(t);
  const [samples, setSamples] = useState<GpsSample[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState("พร้อมเริ่มบันทึกการเดินทาง");
  const [photo, setPhoto] = useState<CapturedPhoto>();
  const [state, setState] = useState<RequestState>("idle");
  const [error, setError] = useState("");
  const [completion, setCompletion] = useState<{ status: Claim["claim"]["status"]; awardedPoints: number; impacts: Claim["claim"]["impacts"] }>();
  const busTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (busTimer.current !== undefined) window.clearInterval(busTimer.current);
  }, []);

  function stopCapture(status?: string) {
    if (busTimer.current !== undefined) window.clearInterval(busTimer.current);
    busTimer.current = undefined;
    setCapturing(false);
    setDeviceStatus(status ?? "หยุดบันทึกแล้ว · กรุณาลองใหม่");
  }

  function startCapture() {
    if (document.visibilityState !== "visible") {
      setDeviceStatus("กรุณาเปิดหน้านี้ไว้ระหว่างบันทึกการเดินทาง");
      return;
    }
    const t0 = Date.now();
    const first = { sampleId: `${SYNTHETIC_FIXTURE_ID}-BUS-0`, recordedAt: new Date(t0).toISOString(), ...DEMO_BUS_ROUTE[0]!, accuracyMeters: "5" };
    let collectedSamples: GpsSample[] = [first];
    setSamples(collectedSamples);
    setCompletion(undefined);
    setState("idle");
    setError("");
    setCapturing(true);
    setDeviceStatus("กำลังบันทึก · ประมาณ 3 วินาที");
    let nextIndex = 1;
    busTimer.current = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        stopCapture("หยุดบันทึกแล้ว เพราะแอปไม่ได้อยู่ด้านหน้า");
        return;
      }
      const index = nextIndex;
      const routePoint = DEMO_BUS_ROUTE[index];
      if (!routePoint) return;
      collectedSamples = [...collectedSamples, {
        sampleId: `${SYNTHETIC_FIXTURE_ID}-BUS-${index}`,
        recordedAt: new Date(t0 + index * SYNTHETIC_SAMPLING_INTERVAL_MS).toISOString(),
        ...routePoint,
        accuracyMeters: "5",
      }];
      setSamples(collectedSamples);
      if (index === DEMO_BUS_ROUTE.length - 1) {
        if (busTimer.current !== undefined) window.clearInterval(busTimer.current);
        busTimer.current = undefined;
        setCapturing(false);
        setDeviceStatus("กำลังยืนยันการเดินทาง…");
        void completeBus(collectedSamples);
        return;
      }
      nextIndex += 1;
    }, DEMO_BUS_PLAYBACK_INTERVAL_MS);
  }

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" && capturing) {
        stopCapture("หยุดบันทึกแล้ว เพราะแอปไม่ได้อยู่ด้านหน้า");
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [capturing]);

  async function completeBus(completedSamples: GpsSample[]) {
    if (completedSamples.length < 2 || document.visibilityState !== "visible") {
      setError(t("กรุณาบันทึกการเดินทางให้เสร็จอีกครั้ง"));
      setState("error");
      return;
    }
    setState("loading");
    setError("");
    try {
      const evidenceId = await uploadGpsTrace(completedSamples);
      const result = await api<Claim>("/actions/bus", "POST", {
        evidenceIds: [evidenceId],
        routeName: "DEMO-BUS-01",
        boardedAt: completedSamples[0]!.recordedAt,
        alightedAt: completedSamples.at(-1)!.recordedAt,
        samples: completedSamples,
      }, { "idempotency-key": idempotencyKey() });
      setCompletion({ status: result.claim.status, awardedPoints: result.claim.awarded_points, impacts: result.claim.impacts });
      setSamples([]);
      setState("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("ส่งการเดินทางไม่ได้"));
      setState("error");
    }
  }

  async function submitPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setState("loading");
    setError("");
    try {
      if (!photo) throw new Error(t("กรุณาเพิ่มรูปก่อนส่ง"));
      const form = new FormData(formElement);
      const position = activity === "tree" ? TREE_FIXTURE_LOCATION : undefined;
      const evidenceId = await uploadPhoto(photo, position);
      const payload = activity === "tree"
        ? {
            evidenceIds: [evidenceId],
            speciesThaiName: String(form.get("speciesThaiName")),
            plantedAt: photo.capturedAt,
            quantity: 1,
            latitude: String(position!.latitude),
            longitude: String(position!.longitude),
            demoAiResult: "pass",
          }
        : {
            evidenceIds: [evidenceId],
            binCode: "DEMO-BIN-BKK-01:TOKEN-0001",
            material: String(form.get("material")),
            itemCount: Number(form.get("itemCount")),
            droppedOffAt: photo.capturedAt,
          };
      const result = await api<Claim>(`/actions/${activity}`, "POST", payload, { "idempotency-key": idempotencyKey() });
      setCompletion({ status: result.claim.status, awardedPoints: result.claim.awarded_points, impacts: result.claim.impacts });
      formElement.reset();
      setPhoto(undefined);
      setState("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("ส่งกิจกรรมไม่ได้"));
      setState("error");
    }
  }

  const title = activityCopy[activity].title;
  if (state === "success") {
    const verified = completion?.status === "verified";
    const awardedPoints = completion?.awardedPoints ?? 0;
    return (
      <div className={`success-screen${verified ? " is-verified" : ""}`} aria-live="polite">
        <InkBurst />
        {verified ? (
          <>
            <div className="success-city-stage">
              <Suspense fallback={<span className="success-city-loading" />}>
                <CityCanvas points={awardedPoints} fallback="empty" growthMode="earned" />
              </Suspense>
            </div>
            <div className="success-copy">
              <span className="success-status"><Icon name="check" />{t("สำเร็จแล้ว")}</span>
              <h1>{t("เพราะคุณ ธรรมชาติจึงเติบโต")}</h1>
              <p className="success-points">{awardedPoints > 0 ? t("+{count} คะแนน", { count: awardedPoints }) : t("ยืนยันแล้ว")}</p>
            </div>
          </>
        ) : (
          <>
            <div className="success-icon"><Icon name="check" /></div>
            <h1>{t("ส่งแล้ว")}</h1>
            <p className="success-points">{t("รอตรวจสอบ")}</p>
          </>
        )}
        {verified && <ClimateReceipt activity={activity} impacts={completion?.impacts ?? []} />}
        <button className="primary-button" onClick={onHistory}>{t("ดูประวัติกิจกรรม")}</button>
        <button className="text-button" onClick={onBack}>{t("กลับไปทำกิจกรรม")}</button>
      </div>
    );
  }

  return (
    <div className="capture-screen">
      <PageHeader title={title} subtitle={t(activity === "tree" ? "รูป · ชนิด · ตำแหน่ง" : activity === "recycling" ? "รูป · วัสดุ · จำนวน" : "บันทึกเส้นทาง")} onBack={onBack} />
      {activity === "bus" ? (
        <div className="task-form">
          <div className={`bus-capture${capturing ? " is-capturing" : ""}`}>
            <span className="large-activity-icon"><Icon name="bus" /></span>
            <strong>{t(deviceStatus)}</strong>
            <small>{samples.length > 0 ? t("บันทึกแล้ว {count} จุด", { count: samples.length }) : t("เปิดหน้านี้ไว้ระหว่างบันทึก")}</small>
            <button className={capturing ? "secondary-button" : "primary-button"} type="button" onClick={capturing ? () => stopCapture() : startCapture} disabled={state === "loading"}>{t(capturing ? "หยุดบันทึก" : state === "loading" ? "กำลังยืนยัน…" : "เริ่มบันทึกการเดินทาง")}</button>
          </div>
          <details className="disclosure-row"><summary><Icon name="info" />{t("ตรวจอย่างไร")}<Icon name="chevron" /></summary><p>{t("ระบบตรวจเส้นทางและเพิ่มคะแนนอัตโนมัติ")}</p></details>
        </div>
      ) : (
        <ThaiForm className="task-form" onSubmit={submitPhoto}>
          <PhotoCapture activity={activity} photo={photo} onCapture={setPhoto} />
          {activity === "tree" ? (
            <>
              <label className="field-row"><span><Icon name="activity" />{t("ชนิดต้นไม้")}</span><input name="speciesThaiName" placeholder={t("เช่น ตะแบก")} required /></label>
              <div className="field-row static-field"><span><Icon name="pin" />{t("ตำแหน่ง")}</span><strong>{t("กรุงเทพฯ · พร้อมส่ง")}</strong></div>
              <div className="point-expectation"><Icon name="ticket" /><span>{t("ผ่านตรวจ · {count} คะแนน", { count: 15 })}</span></div>
            </>
          ) : (
            <>
              <label className="field-row"><span><Icon name="recycling" />{t("วัสดุ")}</span><select name="material" defaultValue="plastic"><option value="plastic">{t("ขวด PET")}</option><option value="paper">{t("กระดาษ")}</option><option value="glass">{t("แก้ว")}</option><option value="metal">{t("โลหะ")}</option><option value="electronics">{t("อิเล็กทรอนิกส์")}</option></select></label>
              <label className="field-row"><span>{t("จำนวนชิ้น")}</span><input name="itemCount" type="number" min="1" step="1" inputMode="numeric" placeholder={t("เช่น 46")} required /></label>
            </>
          )}
          <details className="disclosure-row"><summary><Icon name="info" />{t("ตรวจอย่างไร")}<Icon name="chevron" /></summary><p>{t(activity === "tree" ? "ผู้ตรวจสอบจะดูรูป ชนิด และตำแหน่งก่อนเพิ่มคะแนน" : "ส่งข้อมูลแล้ว ระบบจะยืนยันและเพิ่มคะแนนทันที")}</p></details>
          <button className="primary-button" disabled={state === "loading"}>{t(activity === "recycling" ? "ส่งรีไซเคิล" : "ส่งให้ตรวจสอบ")}</button>
        </ThaiForm>
      )}
      <Notice state={state} error={error} />
      <p className="post-review-note">{t("ผ่านตรวจ · รับคะแนน")}</p>
    </div>
  );
}

function HistoryScreen({ onBack }: { onBack: () => void }) {
  const { t, locale } = useI18n();
  const activityCopy = getActivityCopy(t);
  const claimStatusCopy = getClaimStatusCopy(t);
  const [items, setItems] = useState<Claim[]>([]);
  const [state, setState] = useState<RequestState>("loading");
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ items: Claim[] }>("/claims")
      .then((result) => { setItems(result.items); setState("success"); })
      .catch((cause: unknown) => { setError(cause instanceof Error ? cause.message : t("โหลดประวัติไม่ได้")); setState("error"); });
  }, [t]);
  return (
    <div>
      <PageHeader title={t("ประวัติ")} onBack={onBack} />
      <Notice state={state} error={error} />
      {state === "success" && items.length === 0 && <div className="empty-state"><Icon name="history" /><strong>{t("ยังไม่มีกิจกรรม")}</strong><p>{t("กิจกรรมที่ส่งแล้วจะปรากฏที่นี่")}</p></div>}
      <ul className="history-list">
        {items.map(({ claim }) => {
          const impact = getPrimaryImpact(claim.activity, claim.impacts);
          return (
            <li key={claim.id}>
              <span className="activity-icon"><ActivityIcon activity={claim.activity} /></span>
              <div className="history-copy">
                <strong>{activityCopy[claim.activity].title}</strong>
                <small>{formatDateTime(claim.submitted_at, locale)}</small>
                {claim.reason_code && <p>{t(consumerReasonCopy[claim.reason_code] ?? "กำลังตรวจสอบข้อมูลเพิ่มเติม")}</p>}
                {impact && Number(impact.kg_co2e) > 0 && <small className="history-impact">{impactValueCopy(t, claim.activity, Number(impact.kg_co2e), impact.horizon_years)}</small>}
              </div>
              <div className={`consumer-status ${claim.status}`}><span>{claimStatusCopy[claim.status]}</span>{claim.status === "verified" && <strong>{t("+{count} คะแนน", { count: claim.awarded_points })}</strong>}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function QRImage({ code }: { code: string }) {
  const { t } = useI18n();
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(code, { width: 244, margin: 1, errorCorrectionLevel: "M", color: { dark: "#151A17", light: "#FFFFFF" } })
      .then((url) => { if (active) setSrc(url); })
      .catch(() => { if (active) setSrc(""); });
    return () => { active = false; };
  }, [code]);
  return src ? <img className="voucher-qr" src={src} alt={t("คิวอาร์โค้ดบัตร {code}", { code })} /> : <div className="qr-loading" role="status">{t("กำลังสร้างคิวอาร์โค้ด…")}</div>;
}

function VoucherDetail({ voucher, balance, onBack }: { voucher: Voucher; balance: number; onBack: () => void }) {
  const { t, language, locale } = useI18n();
  const [shown, setShown] = useState(false);
  const active = voucher.state === "issued";
  const stateCopy = t(voucher.state === "redeemed" ? "ใช้แล้ว" : voucher.state === "expired" ? "หมดอายุ" : voucher.state === "cancelled" ? "ยกเลิกแล้ว" : "พร้อมใช้");
  return (
    <div className="voucher-detail-screen">
      <PageHeader title={t("บัตรของฉัน")} onBack={onBack} />
      <button className="balance-link-row" onClick={onBack}><span><Icon name="activity" />{t("คะแนนคงเหลือ")}</span><strong>{balance}</strong><Icon name="chevron" /></button>
      <article className={`voucher-ticket ${voucher.state}`}>
        <header><Icon name="ticket" /><div><h2>{localizeRewardTitle(language, voucher.titleThai)}</h2><strong>{stateCopy}</strong><p>{t("ใช้ได้ถึง {date}", { date: formatDate(voucher.expiresAt, locale) })}</p></div></header>
        {active ? <QRImage code={voucher.code} /> : <div className="voucher-terminal"><span><Icon name="check" /></span><strong>{stateCopy}</strong>{voucher.redeemedAt && <p>{formatDateTime(voucher.redeemedAt, locale)}</p>}</div>}
        <code>{voucher.code.replace(/[^A-Za-z0-9]/g, "").match(/.{1,4}/g)?.join(" ") ?? voucher.code}</code>
      </article>
      {active && <button className="primary-button show-merchant-button" onClick={() => setShown(true)}>{t("แสดงให้ร้านค้า")}</button>}
      {shown && <p className="notice success" role="status">{t("พร้อมให้ร้านค้าสแกน")}</p>}
      <p className="one-use-rule"><Icon name="info" />{t("ใช้ได้ครั้งเดียว")}</p>
      <details className="disclosure-row"><summary>{t("เงื่อนไขการใช้")}<Icon name="chevron" /></summary><p>{t("แสดงบัตรนี้ที่ร้านค้าก่อนวันหมดอายุ บัตรที่ใช้แล้วไม่สามารถใช้ซ้ำได้")}</p></details>
      <button className="text-button voucher-back" onClick={onBack}>{t("กลับไปดูกระเป๋า")}</button>
    </div>
  );
}

function WalletScreen({ onOpenVoucher, refreshKey }: { onOpenVoucher: (voucher: Voucher, balance: number) => void; refreshKey: number }) {
  const { t, language } = useI18n();
  const [catalog, setCatalog] = useState<Reward[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [balance, setBalance] = useState(0);
  const [state, setState] = useState<RequestState>("loading");
  const [actionState, setActionState] = useState<RequestState>("idle");
  const [error, setError] = useState("");
  const displayBalance = useCountUp(balance);

  function load() {
    Promise.all([
      api<{ items: Reward[] }>("/rewards"),
      api<Voucher[] | { items: Voucher[] }>("/rewards/vouchers"),
      api<DashboardData>("/dashboard"),
    ]).then(([rewards, result, dashboard]) => {
      setCatalog([...rewards.items].sort((left, right) => left.pointsCost - right.pointsCost || left.rewardId.localeCompare(right.rewardId)));
      setVouchers(Array.isArray(result) ? result : result.items);
      setBalance(dashboard.points);
      setState("success");
    }).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : t("โหลดกระเป๋าไม่ได้"));
      setState("error");
    });
  }

  useEffect(load, [refreshKey]);

  async function issue(rewardId: string) {
    setActionState("loading");
    setError("");
    try {
      const response = await api<{ voucher: Voucher }>("/rewards/vouchers", "POST", { rewardId }, { "idempotency-key": idempotencyKey() });
      const cost = catalog.find((reward) => reward.rewardId === rewardId)?.pointsCost ?? 0;
      setVouchers((current) => [response.voucher, ...current]);
      setBalance((current) => Math.max(0, current - cost));
      setActionState("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("แลกรางวัลไม่ได้"));
      setActionState("error");
    }
  }

  if (state !== "success") return <div className="screen-state"><Notice state={state} error={error} /></div>;
  return (
    <div>
      <PageHeader title={t("กระเป๋าของฉัน")} />
      <section className="wallet-balance" aria-label={t("คะแนนพร้อมใช้")}><span><Icon name="activity" /><strong>{displayBalance}</strong> {t("คะแนน")}</span><small>{t("พร้อมใช้")}</small><button className="text-button">{t("ดูประวัติคะแนน")}</button></section>
      <Notice state={actionState} error={error} success={t("ออกบัตรแล้ว")} />
      <div className="wallet-columns">
        <section className="content-section reward-catalog">
          <div className="section-heading"><h2>{t("รางวัล")}</h2></div>
          <div className="reward-card-list">
            {catalog.filter((reward) => reward.active).map((reward) => {
              const missing = Math.max(0, reward.pointsCost - balance);
              const available = missing === 0;
              return (
                <article className={`reward-card ${available ? "available" : "locked"}`} key={reward.rewardId}>
                  <span className="reward-icon"><Icon name={available ? "ticket" : "lock"} /></span>
                  <div><h3>{localizeRewardTitle(language, reward.titleThai)}</h3><strong>{reward.pointsCost} {t("คะแนน")}</strong><p>{available ? t("แลกได้ตอนนี้") : t("อีก {count} คะแนน", { count: missing })}</p>{!available && <div className="locked-progress"><span style={{ width: `${Math.min(100, balance / reward.pointsCost * 100)}%` }} /></div>}</div>
                  {available && <button className="primary-button small-button" disabled={actionState === "loading"} onClick={() => void issue(reward.rewardId)}>{t("แลกรางวัล")}</button>}
                </article>
              );
            })}
          </div>
          <p className="transaction-note"><Icon name="info" />{t("คะแนนจะถูกใช้เมื่อออกบัตรสำเร็จ")}</p>
        </section>
        <section className="content-section voucher-list-section">
          <div className="section-heading"><h2>{t("บัตรของฉัน")}</h2></div>
          {vouchers.length === 0 ? <div className="empty-state voucher-empty"><Icon name="ticket" /><strong>{t("ยังไม่มีบัตร")}</strong><p>{t("แลกรางวัลแล้วบัตรจะอยู่ที่นี่")}</p></div> : (
            <div className="voucher-list">
              {vouchers.map((voucher) => (
                <button key={voucher.voucherId} onClick={() => onOpenVoucher(voucher, balance)}>
                  <span className="reward-icon"><Icon name="ticket" /></span>
                  <span><strong>{localizeRewardTitle(language, voucher.titleThai)}</strong><small>{t(voucher.state === "issued" ? "พร้อมใช้" : voucher.state === "redeemed" ? "ใช้แล้ว" : voucher.state === "expired" ? "หมดอายุ" : "ยกเลิกแล้ว")}</small></span>
                  <Icon className="chevron" name="chevron" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function parseLeaderboardData(value: unknown): LeaderboardData {
  const candidate = value as Partial<LeaderboardData> | null;
  const viewer = candidate?.viewer;
  const entries = candidate?.entries;
  const totals = candidate?.community_totals;
  const validViewer = viewer !== null && typeof viewer === "object" && typeof viewer.opted_in === "boolean" && (viewer.pseudonym_th === null || typeof viewer.pseudonym_th === "string");
  const validEntries = Array.isArray(entries) && entries.every((entry) => Number.isInteger(entry.rank) && entry.rank > 0 && typeof entry.pseudonym_th === "string" && Number.isInteger(entry.weekly_points) && entry.weekly_points >= 0);
  const validTotals = totals !== null && typeof totals === "object"
    && typeof totals.estimated_avoided_co2e === "string"
    && typeof totals.projected_sequestration_co2e === "string"
    && Number.isInteger(totals.verified_weekly_points)
    && totals.verified_weekly_points >= 0;
  if (!candidate || typeof candidate.week_starts_at !== "string" || Number.isNaN(Date.parse(candidate.week_starts_at)) || (candidate.data_scope !== "demo" && candidate.data_scope !== "real") || typeof candidate.is_mock !== "boolean" || typeof candidate.demo_only !== "boolean" || !validViewer || !validEntries || !validTotals) throw new Error("ข้อมูลอันดับจากระบบไม่ถูกต้อง");
  return candidate as LeaderboardData;
}

function parseLeaderboardConsent(value: unknown): LeaderboardConsent {
  const candidate = value as Partial<LeaderboardConsent> | null;
  if (!candidate || typeof candidate.opted_in !== "boolean" || (candidate.pseudonym_th !== null && typeof candidate.pseudonym_th !== "string")) throw new Error("ผลการบันทึกความยินยอมจากระบบไม่ถูกต้อง");
  return candidate as LeaderboardConsent;
}

function formatWeekRange(value: string, locale: string): string {
  const start = new Date(value);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startCopy = start.toLocaleDateString(locale, { day: "numeric", month: "short" });
  const endCopy = end.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  return `${startCopy} – ${endCopy}`;
}

function leaderboardInitials(value: string): string {
  return Array.from(value.replace(/\s/g, "")).slice(0, 2).join("").toUpperCase();
}

function LeaderboardScreen({ onBack }: { onBack: () => void }) {
  const { t, locale } = useI18n();
  const [data, setData] = useState<LeaderboardData>();
  const [optedIn, setOptedIn] = useState(false);
  const [selectedPseudonym, setSelectedPseudonym] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const profileCardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    api<unknown>("/leaderboard/weekly")
      .then((value) => { const result = parseLeaderboardData(value); setData(result); setOptedIn(result.viewer.opted_in); })
      .catch((cause: unknown) => setError(t(cause instanceof Error ? cause.message : "โหลดข้อมูลชุมชนไม่ได้")));
  }, [t]);

  async function updateConsent(next: boolean) {
    const previous = optedIn;
    setOptedIn(next);
    setSaving(true);
    setError("");
    try {
      const consent = parseLeaderboardConsent(await api<unknown>("/leaderboard/consent", "PUT", { optedIn: next }));
      setOptedIn(consent.opted_in);
      setSelectedPseudonym(consent.opted_in ? consent.pseudonym_th : null);
      setData((current) => current && ({
        ...current,
        viewer: consent,
        entries: consent.opted_in ? current.entries : current.entries.filter((entry) => entry.pseudonym_th !== current.viewer.pseudonym_th),
      }));
      try {
        const refreshed = parseLeaderboardData(await api<unknown>("/leaderboard/weekly"));
        setData(refreshed);
        setOptedIn(refreshed.viewer.opted_in);
      } catch {
        setError(t("บันทึกความยินยอมแล้ว แต่โหลดอันดับล่าสุดไม่สำเร็จ"));
      }
    } catch (cause) {
      setOptedIn(previous);
      setError(t(cause instanceof Error ? cause.message : "บันทึกความยินยอมไม่ได้"));
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  }

  const heading = <PageHeader title={t("อันดับประจำสัปดาห์")} subtitle={t("เปรียบเทียบคะแนนกับชื่อเล่นของสมาชิกในชุมชน")} onBack={onBack} />;

  if (!data) return <div className="leaderboard-screen">{heading}<div className="screen-state"><Notice state={error ? "error" : "loading"} error={error} /></div></div>;
  const viewerEntry = data.viewer.pseudonym_th
    ? data.entries.find((entry) => entry.pseudonym_th === data.viewer.pseudonym_th)
    : undefined;
  const selectedEntry = data.entries.find((entry) => entry.pseudonym_th === selectedPseudonym) ?? viewerEntry ?? data.entries[0];
  const selectedIsViewer = selectedEntry?.pseudonym_th === data.viewer.pseudonym_th;
  const selectedGrowth = structureBudget(selectedEntry?.weekly_points ?? 0, "earned");
  const selectedImpact = estimateCarbonImpact(selectedEntry?.weekly_points ?? 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function selectEntry(pseudonym: string) {
    setSelectedPseudonym(pseudonym);
    setConfirming(false);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      window.requestAnimationFrame(() => profileCardRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
    }
  }

  return (
    <div className="leaderboard-screen">
      {heading}
      <p className="trust-line leaderboard-trust"><Icon name="check" />{t("คะแนนจากกิจกรรมที่ผ่านการตรวจสอบเท่านั้น")}</p>
      {error && <p className="notice error" role="alert">{error}</p>}
      <div className="leaderboard-meta">
        <span><strong>{t("สัปดาห์ปัจจุบัน")}</strong>{formatWeekRange(data.week_starts_at, locale)}</span>
        <span className={`leaderboard-status${optedIn ? " is-active" : ""}`}><Icon name={optedIn ? "check" : "profile"} />{t(optedIn ? "เข้าร่วมแล้ว" : "ไม่ได้เข้าร่วม")}</span>
      </div>
      <div className="leaderboard-layout">
        <section className="leaderboard-ranking" aria-label={t("อันดับประจำสัปดาห์")}>
          {!optedIn && <div className="leaderboard-opted-note"><Icon name="rank" /><div><strong>{t("คุณไม่ได้เข้าร่วมสัปดาห์นี้")}</strong><p>{t("คุณยังดูอันดับของชุมชนได้ และเข้าร่วมใหม่ได้ทุกเมื่อ")}</p></div></div>}
          <ol className="leaderboard-list full-list">
            {data.entries.map((entry) => {
              const isViewer = entry.pseudonym_th === data.viewer.pseudonym_th;
              const isSelected = entry.pseudonym_th === selectedEntry?.pseudonym_th;
              return <li className={`${entry.rank <= 3 ? "is-top " : ""}${isViewer ? "is-viewer " : ""}${isSelected ? "is-selected" : ""}`} aria-current={isViewer ? "true" : undefined} key={`${entry.rank}-${entry.pseudonym_th}`}>
                <button className="leaderboard-entry-button" type="button" aria-pressed={isSelected} aria-label={t("เลือก {name} เพื่อดูโปรไฟล์ประจำสัปดาห์", { name: entry.pseudonym_th })} onClick={() => selectEntry(entry.pseudonym_th)}>
                  <span className="leaderboard-rank">{entry.rank}</span>
                  <span className="leaderboard-avatar" aria-hidden="true">{leaderboardInitials(entry.pseudonym_th)}</span>
                  <strong>{entry.pseudonym_th}{isViewer && <small>{t("คุณ")}</small>}</strong>
                  <em>{entry.weekly_points} <small>{t("คะแนน")}</small></em>
                </button>
              </li>;
            })}
          </ol>
        </section>
        <aside className="leaderboard-participation" ref={profileCardRef} data-selected-profile={selectedEntry?.pseudonym_th}>
          <div className="leaderboard-city" aria-hidden="true">
            <Suspense fallback={null}><CityCanvas key={`${selectedEntry?.pseudonym_th}-${selectedEntry?.weekly_points}`} points={selectedEntry?.weekly_points ?? 0} fallback="empty" growthMode="earned" /></Suspense>
          </div>
          <div className="leaderboard-profile-heading">
            <span className="leaderboard-profile-mark" aria-hidden="true">{leaderboardInitials(selectedEntry?.pseudonym_th ?? "LR")}</span>
            <div><small>{t("โปรไฟล์ประจำสัปดาห์")}</small><h2>{selectedEntry?.pseudonym_th}</h2><p>{t("อันดับ {rank} · {points} คะแนน", { rank: selectedEntry?.rank ?? "–", points: selectedEntry?.weekly_points ?? 0 })}{selectedIsViewer && <strong>{t("คุณ")}</strong>}</p></div>
          </div>
          <dl className="leaderboard-impact-grid">
            <div><dt>{t("คะแนน")}</dt><dd>{selectedEntry?.weekly_points ?? 0}</dd></div>
            <div><dt>{t("อาคาร")}</dt><dd>{selectedGrowth.buildings}</dd></div>
            <div><dt>{t("ต้นไม้")}</dt><dd>{selectedGrowth.trees}</dd></div>
            <div><dt>{t("ผลกระทบคาร์บอนโดยประมาณ")}</dt><dd>{selectedImpact} <small>kg CO₂e</small></dd></div>
          </dl>
          <p className="leaderboard-impact-note">{t("ค่าประมาณจากคะแนนกิจกรรมประจำสัปดาห์สำหรับเดโม ไม่ใช่คาร์บอนเครดิต")}</p>
          {(selectedIsViewer || !optedIn) && <div className="leaderboard-consent-panel">
          {!selectedIsViewer && <strong>{t("การเข้าร่วมของคุณ")}</strong>}
          <span className={`leaderboard-status${optedIn ? " is-active" : ""}`}><Icon name={optedIn ? "check" : "profile"} />{t(optedIn ? "เข้าร่วมแล้ว" : "ไม่ได้เข้าร่วม")}</span>
          {confirming ? (
            <div className="leaderboard-confirm" role="group" aria-label={t("ออกจากอันดับประจำสัปดาห์?")}>
              <strong>{t("ออกจากอันดับประจำสัปดาห์?")}</strong>
              <p>{t("ชื่อเล่นและคะแนนของคุณจะไม่แสดงในสัปดาห์นี้ คุณเข้าร่วมใหม่ได้ทุกเมื่อ")}</p>
              <div><button className="secondary-button" type="button" onClick={() => setConfirming(false)}>{t("ยกเลิก")}</button><button className="primary-button" type="button" disabled={saving} onClick={() => void updateConsent(false)}>{t(saving ? "กำลังบันทึก…" : "ออกจากอันดับ")}</button></div>
            </div>
          ) : optedIn ? (
            <button className="secondary-button leaderboard-participation-action" type="button" onClick={() => setConfirming(true)}>{t("ออกจากอันดับสัปดาห์นี้")}</button>
          ) : (
            <button className="primary-button leaderboard-participation-action" type="button" disabled={saving} onClick={() => void updateConsent(true)}>{t(saving ? "กำลังบันทึก…" : "เข้าร่วมอีกครั้ง")}</button>
          )}
          </div>}
        </aside>
      </div>
    </div>
  );
}

function ProfileScreen({ onOpenLeaderboard, onSwitchRole, onLogout }: { onOpenLeaderboard: () => void; onSwitchRole: (role: Role) => void; onLogout: () => void }) {
  const { t } = useI18n();
  const [error, setError] = useState("");

  async function deleteAccount() {
    if (!window.confirm(t("ลบบัญชีและข้อมูลกิจกรรมหรือไม่ การดำเนินการนี้ย้อนกลับไม่ได้"))) return;
    try {
      await api("/account", "DELETE");
      onLogout();
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : "ลบบัญชีไม่สำเร็จ"));
    }
  }

  return (
    <div className="profile-screen">
      <PageHeader title={t("โปรไฟล์")} />
      <section className="profile-identity"><span>LR</span><div><strong>LotusRider</strong><small>{t("สาธิต")}</small></div></section>
      {error && <p className="notice error" role="alert">{error}</p>}
      <section className="profile-section">
        <div className="section-heading"><h2>{t("อันดับและความเป็นส่วนตัว")}</h2><Icon name="rank" /></div>
        <button className="settings-row profile-leaderboard-entry" type="button" onClick={onOpenLeaderboard}><span><strong>{t("อันดับประจำสัปดาห์")}</strong><small>{t("จัดการการเข้าร่วมและดูอันดับ")}</small></span><Icon name="chevron" /></button>
      </section>
      <section className="profile-section">
        <h2>{t("บัญชี")}</h2>
        <button className="settings-row" onClick={() => void deleteAccount()}><span>{t("ลบบัญชีและข้อมูล")}</span><Icon name="chevron" /></button>
      </section>
      <section className="profile-section subtle-section">
        <details className="settings-details"><summary>{t("เกี่ยวกับเวอร์ชันสาธิต")}<Icon name="chevron" /></summary><p>{t("ตัวตน หลักฐาน และการทำงานของผู้ให้บริการในเวอร์ชันนี้เป็นข้อมูลจำลอง ผลกระทบที่แสดงเป็นค่าประมาณและไม่ใช่คาร์บอนเครดิตที่ได้รับการรับรอง")}</p></details>
        {!IS_PUBLIC_PRESENTATION_DEMO && <details className="settings-details role-switcher"><summary>{t("สลับบทบาทสาธิต")}<Icon name="chevron" /></summary><div><button onClick={() => onSwitchRole("reviewer")}>{t("ผู้ตรวจสอบ")}</button><button onClick={() => onSwitchRole("merchant")}>{t("ร้านค้า")}</button><button onClick={() => onSwitchRole("admin")}>{t("ผู้ดูแล")}</button></div></details>}
        <button className="settings-row logout-row" onClick={onLogout}><span><Icon name="logout" />{t("ออกจากระบบสาธิต")}</span><Icon name="chevron" /></button>
      </section>
    </div>
  );
}

export function ConsumerApp({ onSwitchRole, onLogout }: { onSwitchRole: (role: Role) => void; onLogout: () => void }) {
  const { t } = useI18n();
  const [page, setPage] = useState<ConsumerPage>("home");
  const [activity, setActivity] = useState<Activity>("tree");
  const [voucher, setVoucher] = useState<Voucher>();
  const [voucherBalance, setVoucherBalance] = useState(0);
  const [walletRefreshKey, setWalletRefreshKey] = useState(0);
  const activeDestination = primaryDestination(page);
  const navItems = getNavItems(t);
  const isDetail = page === "capture" || page === "voucher" || page === "history";

  function navigate(next: ConsumerPage) {
    if (next === "wallet") setWalletRefreshKey((current) => current + 1);
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectActivity(next: Activity) {
    setActivity(next);
    navigate("capture");
  }

  let screen;
  if (page === "home") screen = <HomeScreen onNavigate={navigate} onSelectActivity={selectActivity} />;
  else if (page === "leaderboard") screen = <LeaderboardScreen onBack={() => navigate("home")} />;
  else if (page === "activities") screen = <ActivityHub onSelect={selectActivity} onHistory={() => navigate("history")} />;
  else if (page === "capture") screen = <ActivityCapture activity={activity} onBack={() => navigate("activities")} onHistory={() => navigate("history")} />;
  else if (page === "history") screen = <HistoryScreen onBack={() => navigate("activities")} />;
  else if (page === "wallet") screen = <WalletScreen refreshKey={walletRefreshKey} onOpenVoucher={(nextVoucher, balance) => { setVoucher(nextVoucher); setVoucherBalance(balance); navigate("voucher"); }} />;
  else if (page === "voucher" && voucher) screen = <VoucherDetail voucher={voucher} balance={voucherBalance} onBack={() => navigate("wallet")} />;
  else screen = <ProfileScreen onOpenLeaderboard={() => navigate("leaderboard")} onSwitchRole={onSwitchRole} onLogout={onLogout} />;

  return (
    <div className={`consumer-app${isDetail ? " is-detail" : ""}`}>
      <header className="consumer-header"><BrandMark /><LanguageSwitcher compact /><span className="demo-chip">{t("สาธิต")}</span><button className="profile-shortcut" onClick={() => navigate("profile")} aria-label={t("เปิดโปรไฟล์")}><Icon name="profile" /></button></header>
      <nav className="consumer-nav" aria-label={t("เมนูหลัก")}>
        {navItems.map((item) => <button key={item.id} className={activeDestination === item.id ? "active" : ""} onClick={() => navigate(item.id)}><Icon name={item.icon} /><span>{item.label}</span></button>)}
      </nav>
      <div className="consumer-rail-identity" aria-hidden="true"><span>LR</span><div><strong>LotusRider</strong><small>{t("สาธิต")}</small></div></div>
      <main className="consumer-main"><div className="screen-transition" key={page}>{screen}</div></main>
    </div>
  );
}
