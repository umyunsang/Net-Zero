import { type FormEvent, useEffect, useRef, useState } from "react";
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
import { ActivityIcon, BrandMark, Icon, Notice, ThaiForm } from "../ui";

type ConsumerPage = "home" | "activities" | "history" | "wallet" | "voucher" | "profile" | "capture";

const activityCopy: Record<Activity, { title: string; description: string; reward: string }> = {
  bus: {
    title: "ขึ้นรถโดยสาร",
    description: "บันทึกการเดินทางด้วยขนส่งสาธารณะ",
    reward: "คะแนนตามระยะทางที่ตรวจสอบ",
  },
  recycling: {
    title: "ส่งรีไซเคิล",
    description: "นำขวด PET ไปส่งและยืนยันจำนวน",
    reward: "คะแนนตามจำนวนที่ตรวจสอบ",
  },
  tree: {
    title: "ปลูกต้นไม้",
    description: "ส่งรูปและตำแหน่งเพื่อรอตรวจสอบ",
    reward: "ตัวอย่างเดโม 23 คะแนน",
  },
};

const claimStatusCopy: Record<Claim["claim"]["status"], string> = {
  submitted: "กำลังตรวจสอบ",
  pending: "กำลังตรวจสอบ",
  pending_review: "กำลังตรวจสอบ",
  verified: "ผ่านการตรวจสอบ",
  rejected: "ต้องตรวจสอบอีกครั้ง",
};

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
  reviewer_confirmed: "ผู้ตรวจสอบยืนยันกิจกรรมแล้ว",
  reviewer_reduced: "คะแนนปรับตามจำนวนที่ตรวจสอบได้",
  reviewer_rejected: "หลักฐานยังไม่เพียงพอ กรุณาลองใหม่",
  factor_approval_required: "กิจกรรมนี้ยังไม่พร้อมให้คะแนน",
};

const navItems: Array<{ id: ConsumerPage; label: string; icon: "home" | "activity" | "wallet" | "profile" }> = [
  { id: "home", label: "หน้าแรก", icon: "home" },
  { id: "activities", label: "ทำกิจกรรม", icon: "activity" },
  { id: "wallet", label: "กระเป๋า", icon: "wallet" },
  { id: "profile", label: "ฉัน", icon: "profile" },
];

function primaryDestination(page: ConsumerPage): ConsumerPage {
  if (page === "capture" || page === "history") return "activities";
  if (page === "voucher") return "wallet";
  return page;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function PageHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return (
    <header className="screen-heading">
      {onBack && <button className="icon-button back-button" type="button" onClick={onBack} aria-label="ย้อนกลับ"><Icon name="back" /></button>}
      <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    </header>
  );
}

function BalanceModule({ points, reward }: { points: number; reward?: Reward }) {
  const target = reward?.pointsCost ?? 20;
  const remaining = Math.max(0, target - points);
  const progress = Math.min(100, target === 0 ? 100 : (points / target) * 100);
  return (
    <section className="balance-module" aria-label="คะแนนของคุณ">
      <div className="balance-copy">
        <strong><span>{points}</span> คะแนน</strong>
        <div className="progress-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        <p>{remaining === 0 ? `แลก${reward?.titleThai ?? "รางวัล"}ได้แล้ว` : `อีก ${remaining} คะแนน รับส่วนลด 20 บาท`}</p>
      </div>
      <div className="city-motif" aria-hidden="true">
        <svg viewBox="0 0 180 74"><path d="M3 66h174M18 66V42h22v24M28 42V28h18v38M58 66V21h30v45M70 34h6M70 44h6M70 54h6M101 66V40h22v26M134 66V31h25v35M141 41h5M141 51h5"/><path d="M9 66V52m0 0c-8-6-8-14 0-18 8 4 8 12 0 18Zm113 14V54m0 0c-7-5-7-12 0-16 7 4 7 11 0 16Zm45 12V48m0 0c-8-6-8-14 0-18 8 4 8 12 0 18Z"/></svg>
      </div>
    </section>
  );
}

function ActivityRow({ activity, onClick, compact = false }: { activity: Activity; onClick: () => void; compact?: boolean }) {
  const copy = activityCopy[activity];
  return (
    <button className={`activity-row${compact ? " compact" : ""}`} type="button" onClick={onClick}>
      <span className="activity-icon"><ActivityIcon activity={activity} /></span>
      <span className="activity-row-copy"><strong>{copy.title}</strong><small>{copy.description}</small>{!compact && <em>{copy.reward}</em>}</span>
      <Icon className="chevron" name="chevron" />
    </button>
  );
}

function HomeScreen({ onNavigate, onSelectActivity }: { onNavigate: (page: ConsumerPage) => void; onSelectActivity: (activity: Activity) => void }) {
  const [data, setData] = useState<DashboardData>();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [state, setState] = useState<RequestState>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<DashboardData>("/dashboard"), api<{ items: Reward[] }>("/rewards")])
      .then(([dashboard, catalog]) => {
        setData(dashboard);
        setRewards(catalog.items.filter((reward) => reward.active));
        setState("success");
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "โหลดหน้าแรกไม่ได้");
        setState("error");
      });
  }, []);

  if (!data) return <div className="screen-state"><Notice state={state} error={error} /></div>;
  const firstReward = rewards.reduce<Reward | undefined>((lowest, reward) => !lowest || reward.pointsCost < lowest.pointsCost ? reward : lowest, undefined);
  const latest = data.recent_claims?.[0];

  return (
    <div className="home-screen">
      <PageHeader title={data.points === 0 ? "เริ่มกิจกรรมแรกของคุณ" : "วันนี้คุณอยากทำอะไรต่อ?"} subtitle="ทำกิจกรรมที่ช่วยโลก แล้วรับคะแนนเมื่อผ่านการตรวจสอบ" />
      <BalanceModule points={data.points} reward={firstReward} />
      <button className="primary-button home-primary" onClick={() => onNavigate("activities")}><Icon name="activity" />ทำกิจกรรมรับคะแนน</button>
      <section className="content-section">
        <div className="section-heading"><h2>ทำอะไรได้บ้าง</h2></div>
        <div className="activity-list">
          {(["bus", "recycling", "tree"] as const).map((activity) => <ActivityRow key={activity} activity={activity} compact onClick={() => onSelectActivity(activity)} />)}
        </div>
      </section>
      <div className="home-secondary-grid">
        <section className="content-section reward-preview">
          <div className="section-heading"><h2>แลกของรางวัลแนะนำ</h2></div>
          {firstReward ? (
            <button className="reward-preview-row" onClick={() => onNavigate("wallet")}>
              <span className="reward-icon"><Icon name="ticket" /></span>
              <span><strong>{firstReward.titleThai}</strong><small>{firstReward.pointsCost} คะแนน</small></span>
              <Icon className="chevron" name="chevron" />
            </button>
          ) : <p className="empty-copy">ยังไม่มีรางวัลในขณะนี้</p>}
        </section>
        <section className="content-section recent-preview">
          <div className="section-heading"><h2>กิจกรรมล่าสุด</h2><button className="text-button" onClick={() => onNavigate("history")}>ดูประวัติ</button></div>
          {latest ? (
            <button className="recent-row" onClick={() => onNavigate("history")}>
              <ActivityIcon activity={latest.activity} />
              <span><strong>{activityCopy[latest.activity].title}</strong><small>{claimStatusCopy[latest.state]}</small></span>
              <Icon className="chevron" name="chevron" />
            </button>
          ) : (
            <div className="empty-state compact-empty"><Icon name="history" /><strong>ยังไม่มีกิจกรรม</strong></div>
          )}
        </section>
      </div>
    </div>
  );
}

function ActivityHub({ onSelect, onHistory }: { onSelect: (activity: Activity) => void; onHistory: () => void }) {
  return (
    <div>
      <PageHeader title="ทำกิจกรรม" subtitle="เลือกกิจกรรมที่คุณทำวันนี้" />
      <p className="trust-line"><Icon name="check" />คะแนนจะเพิ่มเมื่อกิจกรรมผ่านการตรวจสอบ</p>
      <div className="activity-hub-list">
        {(["bus", "recycling", "tree"] as const).map((activity) => (
          <ActivityRow key={activity} activity={activity} onClick={() => onSelect(activity)} />
        ))}
      </div>
      <button className="history-link-row" onClick={onHistory}><Icon name="history" /><span>ดูประวัติกิจกรรม</span><Icon name="chevron" /></button>
    </div>
  );
}

function PhotoCapture({ activity, photo, onCapture }: { activity: "tree" | "recycling"; photo?: CapturedPhoto; onCapture: (photo: CapturedPhoto) => void }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function capture() {
    setLoading(true);
    setError("");
    try {
      onCapture(await syntheticPhoto(activity));
    } catch {
      setError("เตรียมรูปไม่ได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className={`capture-surface${photo ? " has-photo" : ""}`}>
      <div className="capture-illustration"><ActivityIcon activity={activity} /></div>
      <strong>{photo ? "เพิ่มรูปแล้ว" : activity === "tree" ? "เพิ่มรูปต้นไม้" : "เพิ่มรูปวัสดุรีไซเคิล"}</strong>
      <p>{photo ? "รูปพร้อมส่งเพื่อตรวจสอบ" : activity === "tree" ? "ถ่ายให้เห็นต้นไม้และบริเวณโดยรอบ" : "ถ่ายให้เห็นวัสดุและจุดรับอย่างชัดเจน"}</p>
      <button className="secondary-button" type="button" onClick={() => void capture()} disabled={loading}><Icon name="camera" />{loading ? "กำลังเตรียมรูป…" : "ถ่ายรูป"}</button>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

function ActivityCapture({ activity, onBack, onHistory }: { activity: Activity; onBack: () => void; onHistory: () => void }) {
  const [samples, setSamples] = useState<GpsSample[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [deviceGatePassed, setDeviceGatePassed] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState("พร้อมเริ่มบันทึกการเดินทาง");
  const [photo, setPhoto] = useState<CapturedPhoto>();
  const [state, setState] = useState<RequestState>("idle");
  const [error, setError] = useState("");
  const busTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (busTimer.current !== undefined) window.clearInterval(busTimer.current);
  }, []);

  function stopCapture(status?: string) {
    if (busTimer.current !== undefined) window.clearInterval(busTimer.current);
    busTimer.current = undefined;
    setCapturing(false);
    setDeviceStatus(status ?? (samples.length >= 2 ? "บันทึกการเดินทางแล้ว · พร้อมส่ง" : "หยุดบันทึกแล้ว · กรุณาลองใหม่"));
  }

  function startCapture() {
    if (document.visibilityState !== "visible") {
      setDeviceStatus("กรุณาเปิดหน้านี้ไว้ระหว่างบันทึกการเดินทาง");
      return;
    }
    const t0 = Date.now();
    const first = { sampleId: `${SYNTHETIC_FIXTURE_ID}-BUS-0`, recordedAt: new Date(t0).toISOString(), ...DEMO_BUS_ROUTE[0]!, accuracyMeters: "5" };
    setSamples([first]);
    setDeviceGatePassed(false);
    setCapturing(true);
    setDeviceStatus(`กำลังบันทึกการเดินทาง · เหลือประมาณ ${(DEMO_BUS_ROUTE.length - 1) * 30} วินาที`);
    let nextIndex = 1;
    busTimer.current = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        setDeviceGatePassed(false);
        stopCapture("หยุดบันทึกแล้ว เพราะแอปไม่ได้อยู่ด้านหน้า");
        return;
      }
      const index = nextIndex;
      const routePoint = DEMO_BUS_ROUTE[index];
      if (!routePoint) return;
      setSamples((current) => [...current, {
        sampleId: `${SYNTHETIC_FIXTURE_ID}-BUS-${index}`,
        recordedAt: new Date(t0 + index * SYNTHETIC_SAMPLING_INTERVAL_MS).toISOString(),
        ...routePoint,
        accuracyMeters: "5",
      }]);
      if (index === DEMO_BUS_ROUTE.length - 1) {
        window.clearInterval(busTimer.current);
        busTimer.current = undefined;
        setDeviceGatePassed(true);
        setCapturing(false);
        setDeviceStatus("บันทึกการเดินทางแล้ว · พร้อมส่ง");
        return;
      }
      nextIndex += 1;
    }, SYNTHETIC_SAMPLING_INTERVAL_MS);
  }

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" && capturing) {
        setDeviceGatePassed(false);
        stopCapture("หยุดบันทึกแล้ว เพราะแอปไม่ได้อยู่ด้านหน้า");
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [capturing]);

  async function submitBus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deviceGatePassed || samples.length < 2 || document.visibilityState !== "visible") {
      setError("กรุณาบันทึกการเดินทางให้เสร็จก่อนส่ง");
      setState("error");
      return;
    }
    setState("loading");
    setError("");
    try {
      const evidenceId = await uploadGpsTrace(samples);
      await api("/actions/bus", "POST", {
        evidenceIds: [evidenceId],
        routeName: "DEMO-BUS-01",
        boardedAt: samples[0]!.recordedAt,
        alightedAt: samples.at(-1)!.recordedAt,
        samples,
      }, { "idempotency-key": idempotencyKey() });
      stopCapture();
      setSamples([]);
      setState("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ส่งการเดินทางไม่ได้");
      setState("error");
    }
  }

  async function submitPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setState("loading");
    setError("");
    try {
      if (!photo) throw new Error("กรุณาเพิ่มรูปก่อนส่ง");
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
      await api(`/actions/${activity}`, "POST", payload, { "idempotency-key": idempotencyKey() });
      formElement.reset();
      setPhoto(undefined);
      setState("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ส่งกิจกรรมไม่ได้");
      setState("error");
    }
  }

  const title = activityCopy[activity].title;
  if (state === "success") {
    return (
      <div className="success-screen" aria-live="polite">
        <div className="success-icon"><Icon name="check" /></div>
        <h1>ส่งแล้ว · กำลังตรวจสอบ</h1>
        <p>คะแนนจะเพิ่มในกระเป๋าเมื่อกิจกรรมผ่านการตรวจสอบ</p>
        <button className="primary-button" onClick={onHistory}>ดูประวัติกิจกรรม</button>
        <button className="text-button" onClick={onBack}>กลับไปทำกิจกรรม</button>
      </div>
    );
  }

  return (
    <div className="capture-screen">
      <PageHeader title={title} subtitle={activity === "tree" ? "ส่งรูปและตำแหน่งเพื่อรอตรวจสอบ" : activity === "recycling" ? "ยืนยันสิ่งที่คุณนำมาส่ง" : "บันทึกการเดินทางด้วยขนส่งสาธารณะ"} onBack={onBack} />
      {activity === "bus" ? (
        <ThaiForm className="task-form" onSubmit={submitBus}>
          <div className={`bus-capture${capturing ? " is-capturing" : ""}`}>
            <span className="large-activity-icon"><Icon name="bus" /></span>
            <strong>{deviceStatus}</strong>
            <small>{samples.length > 0 ? `บันทึกแล้ว ${samples.length} จุด` : "เปิดหน้านี้ไว้ระหว่างบันทึก"}</small>
            <button className={capturing ? "secondary-button" : "primary-button"} type="button" onClick={capturing ? () => stopCapture() : startCapture}>{capturing ? "หยุดบันทึก" : "เริ่มบันทึกการเดินทาง"}</button>
          </div>
          <details className="disclosure-row"><summary><Icon name="info" />ตรวจอย่างไร<Icon name="chevron" /></summary><p>ระบบตรวจความต่อเนื่องของการเดินทางก่อนส่งให้คะแนน</p></details>
          <button className="primary-button" disabled={state === "loading" || capturing || !deviceGatePassed}>ส่งให้ตรวจสอบ</button>
        </ThaiForm>
      ) : (
        <ThaiForm className="task-form" onSubmit={submitPhoto}>
          <PhotoCapture activity={activity} photo={photo} onCapture={setPhoto} />
          {activity === "tree" ? (
            <>
              <label className="field-row"><span><Icon name="activity" />ชนิดต้นไม้</span><input name="speciesThaiName" placeholder="เช่น ตะแบก" required /></label>
              <div className="field-row static-field"><span><Icon name="pin" />ตำแหน่ง</span><strong>กรุงเทพฯ · พร้อมส่ง</strong></div>
              <div className="point-expectation"><Icon name="ticket" /><span>ตัวอย่างเดโม <strong>23 คะแนน</strong> เมื่อผ่านการตรวจสอบ</span></div>
            </>
          ) : (
            <>
              <label className="field-row"><span><Icon name="recycling" />วัสดุ</span><select name="material" defaultValue="plastic"><option value="plastic">ขวด PET</option><option value="paper">กระดาษ</option><option value="glass">แก้ว</option><option value="metal">โลหะ</option><option value="electronics">อิเล็กทรอนิกส์</option></select></label>
              <label className="field-row"><span>จำนวนชิ้น</span><input name="itemCount" type="number" min="1" step="1" inputMode="numeric" placeholder="เช่น 46" required /></label>
            </>
          )}
          <details className="disclosure-row"><summary><Icon name="info" />ตรวจอย่างไร<Icon name="chevron" /></summary><p>{activity === "tree" ? "ผู้ตรวจสอบจะดูรูป ชนิด และตำแหน่งก่อนเพิ่มคะแนน" : "ผู้ตรวจสอบจะยืนยันชนิดและจำนวนที่นำมาส่งก่อนเพิ่มคะแนน"}</p></details>
          <button className="primary-button" disabled={state === "loading"}>ส่งให้ตรวจสอบ</button>
        </ThaiForm>
      )}
      <Notice state={state} error={error} />
      <p className="post-review-note">คะแนนจะเพิ่มหลังผ่านการตรวจสอบ</p>
    </div>
  );
}

function HistoryScreen({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<Claim[]>([]);
  const [state, setState] = useState<RequestState>("loading");
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ items: Claim[] }>("/claims")
      .then((result) => { setItems(result.items); setState("success"); })
      .catch((cause: unknown) => { setError(cause instanceof Error ? cause.message : "โหลดประวัติไม่ได้"); setState("error"); });
  }, []);
  return (
    <div>
      <PageHeader title="ประวัติกิจกรรม" onBack={onBack} />
      <Notice state={state} error={error} />
      {state === "success" && items.length === 0 && <div className="empty-state"><Icon name="history" /><strong>ยังไม่มีกิจกรรม</strong><p>กิจกรรมที่ส่งแล้วจะปรากฏที่นี่</p></div>}
      <ul className="history-list">
        {items.map(({ claim }) => {
          const impact = claim.impacts?.reduce((total, row) => total + Number(row.kg_co2e), 0) ?? 0;
          return (
            <li key={claim.id}>
              <span className="activity-icon"><ActivityIcon activity={claim.activity} /></span>
              <div className="history-copy">
                <strong>{activityCopy[claim.activity].title}</strong>
                <small>{formatDateTime(claim.submitted_at)}</small>
                {claim.reason_code && <p>{consumerReasonCopy[claim.reason_code] ?? "กำลังตรวจสอบข้อมูลเพิ่มเติม"}</p>}
                {impact > 0 && <small>ค่าประมาณ {impact.toFixed(2)} กก. CO₂e</small>}
              </div>
              <div className={`consumer-status ${claim.status}`}><span>{claimStatusCopy[claim.status]}</span>{claim.status === "verified" && <strong>+{claim.awarded_points} คะแนน</strong>}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function QRImage({ code }: { code: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(code, { width: 244, margin: 1, errorCorrectionLevel: "M", color: { dark: "#151A17", light: "#FFFFFF" } })
      .then((url) => { if (active) setSrc(url); })
      .catch(() => { if (active) setSrc(""); });
    return () => { active = false; };
  }, [code]);
  return src ? <img className="voucher-qr" src={src} alt={`คิวอาร์โค้ดบัตร ${code}`} /> : <div className="qr-loading" role="status">กำลังสร้างคิวอาร์โค้ด…</div>;
}

function VoucherDetail({ voucher, balance, onBack }: { voucher: Voucher; balance: number; onBack: () => void }) {
  const [shown, setShown] = useState(false);
  const active = voucher.state === "issued";
  const stateCopy = voucher.state === "redeemed" ? "ใช้แล้ว" : voucher.state === "expired" ? "หมดอายุ" : voucher.state === "cancelled" ? "ยกเลิกแล้ว" : "พร้อมใช้";
  return (
    <div className="voucher-detail-screen">
      <PageHeader title="บัตรของฉัน" onBack={onBack} />
      <button className="balance-link-row" onClick={onBack}><span><Icon name="activity" />คะแนนคงเหลือ</span><strong>{balance}</strong><Icon name="chevron" /></button>
      <article className={`voucher-ticket ${voucher.state}`}>
        <header><Icon name="ticket" /><div><h2>{voucher.titleThai}</h2><strong>{stateCopy}</strong><p>ใช้ได้ถึง {formatDate(voucher.expiresAt)}</p></div></header>
        {active ? <QRImage code={voucher.code} /> : <div className="voucher-terminal"><span><Icon name="check" /></span><strong>{stateCopy}</strong>{voucher.redeemedAt && <p>{formatDateTime(voucher.redeemedAt)}</p>}</div>}
        <code>{voucher.code.match(/.{1,4}/g)?.join(" ") ?? voucher.code}</code>
      </article>
      {active && <button className="primary-button show-merchant-button" onClick={() => setShown(true)}>แสดงให้ร้านค้า</button>}
      {shown && <p className="notice success" role="status">พร้อมให้ร้านค้าสแกน</p>}
      <p className="one-use-rule"><Icon name="info" />ใช้ได้ครั้งเดียว</p>
      <details className="disclosure-row"><summary>เงื่อนไขการใช้<Icon name="chevron" /></summary><p>แสดงบัตรนี้ที่ร้านค้าก่อนวันหมดอายุ บัตรที่ใช้แล้วไม่สามารถใช้ซ้ำได้</p></details>
      <button className="text-button voucher-back" onClick={onBack}>กลับไปดูกระเป๋า</button>
    </div>
  );
}

function WalletScreen({ onOpenVoucher, refreshKey }: { onOpenVoucher: (voucher: Voucher, balance: number) => void; refreshKey: number }) {
  const [catalog, setCatalog] = useState<Reward[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [balance, setBalance] = useState(0);
  const [state, setState] = useState<RequestState>("loading");
  const [actionState, setActionState] = useState<RequestState>("idle");
  const [error, setError] = useState("");

  function load() {
    Promise.all([
      api<{ items: Reward[] }>("/rewards"),
      api<Voucher[] | { items: Voucher[] }>("/rewards/vouchers"),
      api<DashboardData>("/dashboard"),
    ]).then(([rewards, result, dashboard]) => {
      setCatalog(rewards.items);
      setVouchers(Array.isArray(result) ? result : result.items);
      setBalance(dashboard.points);
      setState("success");
    }).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "โหลดกระเป๋าไม่ได้");
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
      setError(cause instanceof Error ? cause.message : "แลกรางวัลไม่ได้");
      setActionState("error");
    }
  }

  if (state !== "success") return <div className="screen-state"><Notice state={state} error={error} /></div>;
  return (
    <div>
      <PageHeader title="กระเป๋าของฉัน" />
      <section className="wallet-balance" aria-label="คะแนนพร้อมใช้"><span><Icon name="activity" /><strong>{balance}</strong> คะแนน</span><small>พร้อมใช้</small><button className="text-button">ดูประวัติคะแนน</button></section>
      <Notice state={actionState} error={error} success="ออกบัตรแล้ว คะแนนคงเหลืออัปเดตแล้ว" />
      <div className="wallet-columns">
        <section className="content-section reward-catalog">
          <div className="section-heading"><h2>รางวัล</h2></div>
          <div className="reward-card-list">
            {catalog.filter((reward) => reward.active).map((reward) => {
              const missing = Math.max(0, reward.pointsCost - balance);
              const available = missing === 0;
              return (
                <article className={`reward-card ${available ? "available" : "locked"}`} key={reward.rewardId}>
                  <span className="reward-icon"><Icon name={available ? "ticket" : "lock"} /></span>
                  <div><h3>{reward.titleThai}</h3><strong>{reward.pointsCost} คะแนน</strong><p>{available ? "แลกได้ตอนนี้" : `อีก ${missing} คะแนน`}</p>{!available && <div className="locked-progress"><span style={{ width: `${Math.min(100, balance / reward.pointsCost * 100)}%` }} /></div>}</div>
                  {available && <button className="primary-button small-button" disabled={actionState === "loading"} onClick={() => void issue(reward.rewardId)}>แลกรางวัล</button>}
                </article>
              );
            })}
          </div>
          <p className="transaction-note"><Icon name="info" />คะแนนจะถูกใช้เมื่อออกบัตรสำเร็จ</p>
        </section>
        <section className="content-section voucher-list-section">
          <div className="section-heading"><h2>บัตรของฉัน</h2></div>
          {vouchers.length === 0 ? <div className="empty-state voucher-empty"><Icon name="ticket" /><strong>ยังไม่มีบัตร</strong><p>แลกรางวัลแล้วบัตรจะอยู่ที่นี่</p></div> : (
            <div className="voucher-list">
              {vouchers.map((voucher) => (
                <button key={voucher.voucherId} onClick={() => onOpenVoucher(voucher, balance)}>
                  <span className="reward-icon"><Icon name="ticket" /></span>
                  <span><strong>{voucher.titleThai}</strong><small>{voucher.state === "issued" ? "พร้อมใช้" : voucher.state === "redeemed" ? "ใช้แล้ว" : voucher.state === "expired" ? "หมดอายุ" : "ยกเลิกแล้ว"}</small></span>
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
  const validViewer = viewer !== null && typeof viewer === "object" && typeof viewer.opted_in === "boolean" && (viewer.pseudonym_th === null || typeof viewer.pseudonym_th === "string");
  const validEntries = Array.isArray(entries) && entries.every((entry) => Number.isInteger(entry.rank) && entry.rank > 0 && typeof entry.pseudonym_th === "string" && Number.isInteger(entry.weekly_points) && entry.weekly_points >= 0);
  if (!candidate || (candidate.data_scope !== "demo" && candidate.data_scope !== "real") || typeof candidate.is_mock !== "boolean" || typeof candidate.demo_only !== "boolean" || !validViewer || !validEntries) throw new Error("ข้อมูลอันดับจากระบบไม่ถูกต้อง");
  return candidate as LeaderboardData;
}

function parseLeaderboardConsent(value: unknown): LeaderboardConsent {
  const candidate = value as Partial<LeaderboardConsent> | null;
  if (!candidate || typeof candidate.opted_in !== "boolean" || (candidate.pseudonym_th !== null && typeof candidate.pseudonym_th !== "string")) throw new Error("ผลการบันทึกความยินยอมจากระบบไม่ถูกต้อง");
  return candidate as LeaderboardConsent;
}

function ProfileScreen({ onSwitchRole, onLogout }: { onSwitchRole: (role: Role) => void; onLogout: () => void }) {
  const [data, setData] = useState<LeaderboardData>();
  const [optedIn, setOptedIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<unknown>("/leaderboard/weekly")
      .then((value) => { const result = parseLeaderboardData(value); setData(result); setOptedIn(result.viewer.opted_in); })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "โหลดข้อมูลชุมชนไม่ได้"));
  }, []);

  async function toggle() {
    const previous = optedIn;
    const next = !optedIn;
    setOptedIn(next);
    setSaving(true);
    setError("");
    try {
      const consent = parseLeaderboardConsent(await api<unknown>("/leaderboard/consent", "PUT", { optedIn: next }));
      setOptedIn(consent.opted_in);
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
        setError("บันทึกความยินยอมแล้ว แต่โหลดอันดับล่าสุดไม่สำเร็จ");
      }
    } catch (cause) {
      setOptedIn(previous);
      setError(cause instanceof Error ? cause.message : "บันทึกความยินยอมไม่ได้");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    if (!window.confirm("ลบบัญชีและข้อมูลกิจกรรมหรือไม่ การดำเนินการนี้ย้อนกลับไม่ได้")) return;
    try {
      await api("/account", "DELETE");
      onLogout();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ลบบัญชีไม่สำเร็จ");
    }
  }

  return (
    <div className="profile-screen">
      <PageHeader title="ฉัน" />
      <section className="profile-identity"><span>LR</span><div><strong>LotusRider</strong><small>สาธิต</small></div></section>
      {error && <p className="notice error" role="alert">{error}</p>}
      <section className="profile-section">
        <h2>ชุมชนรายสัปดาห์</h2>
        <label className="switch-row"><span><strong>เข้าร่วมด้วยนามแฝง</strong><small>แสดงเฉพาะคะแนนที่ผ่านการตรวจสอบ</small></span><input type="checkbox" checked={optedIn} disabled={saving} onChange={() => void toggle()} /></label>
        {data && optedIn && <ol className="leaderboard-list">{data.entries.map((entry) => <li key={`${entry.rank}-${entry.pseudonym_th}`}><span>{entry.rank}</span><strong>{entry.pseudonym_th}</strong><em>{entry.weekly_points} คะแนน</em></li>)}</ol>}
      </section>
      <section className="profile-section">
        <h2>ความเป็นส่วนตัวและบัญชี</h2>
        <button className="settings-row" onClick={() => void deleteAccount()}><span>ลบบัญชีและข้อมูลกิจกรรม</span><Icon name="chevron" /></button>
      </section>
      <section className="profile-section subtle-section">
        <details className="settings-details"><summary>เกี่ยวกับเวอร์ชันสาธิต<Icon name="chevron" /></summary><p>ตัวตน หลักฐาน และการทำงานของผู้ให้บริการในเวอร์ชันนี้เป็นข้อมูลจำลอง ผลกระทบที่แสดงเป็นค่าประมาณและไม่ใช่คาร์บอนเครดิตที่ได้รับการรับรอง</p></details>
        <details className="settings-details role-switcher"><summary>สลับบทบาทสาธิต<Icon name="chevron" /></summary><div><button onClick={() => onSwitchRole("reviewer")}>ผู้ตรวจสอบ</button><button onClick={() => onSwitchRole("merchant")}>ร้านค้า</button><button onClick={() => onSwitchRole("admin")}>ผู้ดูแล</button></div></details>
        <button className="settings-row logout-row" onClick={onLogout}><span><Icon name="logout" />ออกจากระบบสาธิต</span><Icon name="chevron" /></button>
      </section>
    </div>
  );
}

export function ConsumerApp({ onSwitchRole, onLogout }: { onSwitchRole: (role: Role) => void; onLogout: () => void }) {
  const [page, setPage] = useState<ConsumerPage>("home");
  const [activity, setActivity] = useState<Activity>("tree");
  const [voucher, setVoucher] = useState<Voucher>();
  const [voucherBalance, setVoucherBalance] = useState(0);
  const [walletRefreshKey, setWalletRefreshKey] = useState(0);
  const activeDestination = primaryDestination(page);

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
  else if (page === "activities") screen = <ActivityHub onSelect={selectActivity} onHistory={() => navigate("history")} />;
  else if (page === "capture") screen = <ActivityCapture activity={activity} onBack={() => navigate("activities")} onHistory={() => navigate("history")} />;
  else if (page === "history") screen = <HistoryScreen onBack={() => navigate("activities")} />;
  else if (page === "wallet") screen = <WalletScreen refreshKey={walletRefreshKey} onOpenVoucher={(nextVoucher, balance) => { setVoucher(nextVoucher); setVoucherBalance(balance); navigate("voucher"); }} />;
  else if (page === "voucher" && voucher) screen = <VoucherDetail voucher={voucher} balance={voucherBalance} onBack={() => navigate("wallet")} />;
  else screen = <ProfileScreen onSwitchRole={onSwitchRole} onLogout={onLogout} />;

  return (
    <div className="consumer-app">
      <header className="consumer-header"><BrandMark /><span className="demo-chip">สาธิต</span><button className="profile-shortcut" onClick={() => navigate("profile")} aria-label="เปิดโปรไฟล์">LR</button></header>
      <nav className="consumer-nav" aria-label="เมนูหลัก">
        {navItems.map((item) => <button key={item.id} className={activeDestination === item.id ? "active" : ""} onClick={() => navigate(item.id)}><Icon name={item.icon} /><span>{item.label}</span></button>)}
      </nav>
      <div className="consumer-rail-identity" aria-hidden="true"><span>LR</span><div><strong>LotusRider</strong><small>สาธิต</small></div></div>
      <main className="consumer-main">{screen}</main>
    </div>
  );
}
