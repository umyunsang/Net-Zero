import type { FormHTMLAttributes, ReactNode, SVGProps } from "react";
import type { Activity, RequestState } from "./product-types";

type IconName =
  | "home"
  | "activity"
  | "wallet"
  | "profile"
  | "bus"
  | "recycling"
  | "tree"
  | "chevron"
  | "history"
  | "camera"
  | "pin"
  | "ticket"
  | "lock"
  | "check"
  | "info"
  | "back"
  | "logout";

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
    ...props,
  };
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="M3.5 10.5 12 3l8.5 7.5"/><path d="M5.5 9.5V21h13V9.5M9.5 21v-7h5v7"/></>,
    activity: <><path d="M19.8 4.2C13 4.5 7.5 7.6 6 13.4c-.7 2.6.7 5.5 3.5 6.1 4 .8 7.2-2.4 8.2-6.4.7-2.8.8-5.9 2.1-8.9Z"/><path d="M4 21c2.6-5.4 6.2-8.7 11-11"/></>,
    wallet: <><path d="M4 6.5h14.5A1.5 1.5 0 0 1 20 8v11H5.5A2.5 2.5 0 0 1 3 16.5V7.8A2.8 2.8 0 0 1 5.8 5H17"/><path d="M15 11h6v5h-6a2.5 2.5 0 0 1 0-5Z"/><circle cx="16" cy="13.5" r=".6" fill="currentColor" stroke="none"/></>,
    profile: <><circle cx="12" cy="7.5" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
    bus: <><rect x="5" y="3" width="14" height="17" rx="3"/><path d="M5 13h14M8 7h8M8 20v2M16 20v2"/><circle cx="8.5" cy="16.5" r="1"/><circle cx="15.5" cy="16.5" r="1"/></>,
    recycling: <><path d="m9.2 4.1 2.5-1.4 2.2 3.8M13.2 5.8l3.2-.2 2.2 3.8"/><path d="m19.2 9.8.1 2.9-4.5.1M16 12.8l1.7 2.7-2.2 3.8"/><path d="m14.8 19.6-2.6 1.3-2.3-3.7M10.6 18.4l-1.5-2.8-4.5.1"/><path d="m4.3 15.3-1.6-2.4 2.2-3.8M5.2 11l1.5-2.8"/></>,
    tree: <><path d="M12 21v-7"/><path d="M8.5 15.5a4.5 4.5 0 0 1-1-8.8 5.5 5.5 0 0 1 10.5 2.2 3.7 3.7 0 0 1-2.5 6.6H8.5Z"/><path d="m12 16-3-4M12 14l3-3"/></>,
    chevron: <path d="m9 5 7 7-7 7"/>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    camera: <><path d="M4 7h3l1.5-2h7L17 7h3v12H4Z"/><circle cx="12" cy="13" r="3.5"/></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/></>,
    ticket: <><path d="M3 7.5A2.5 2.5 0 0 0 5.5 10 2.5 2.5 0 0 0 3 12.5V17h18v-4.5a2.5 2.5 0 0 0 0-5V3H3Z"/><path d="M14 3v14"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></>,
    back: <><path d="m15 5-7 7 7 7"/></>,
    logout: <><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export function ActivityIcon({ activity, ...props }: { activity: Activity } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return <Icon name={activity} {...props} />;
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-mark" aria-label="ก้าวลดคาร์บอน">
      <svg viewBox="0 0 38 38" aria-hidden="true">
        <path d="M30.5 5.5C18 6 8.7 11.8 7.8 22.7c-.4 5.4 3.8 9.6 9.2 8.7 8.1-1.3 12.7-10.7 13.5-25.9Z" fill="currentColor"/>
        <path d="M5.5 33C10.2 22.4 16 16.2 25.5 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="27.8" cy="4.8" r="2.7" fill="#E77800" stroke="white" strokeWidth="1.2"/>
      </svg>
      {!compact && <strong>ก้าวลดคาร์บอน</strong>}
    </span>
  );
}

export function Notice({ state, error, success = "บันทึกสำเร็จ" }: { state: RequestState; error: string; success?: string }) {
  if (state === "loading") return <p className="notice" role="status">กำลังดำเนินการ…</p>;
  if (state === "success") return <p className="notice success" role="status">{success}</p>;
  if (state === "error") return <p className="notice error" role="alert">{error}</p>;
  return null;
}

export function UtilityPanel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="utility-panel"><h2>{title}</h2>{children}</section>;
}

export function ThaiForm({ children, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      {...props}
      onInvalid={(event) => {
        const field = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const message = field.validity.valueMissing
          ? "กรุณากรอกข้อมูลช่องนี้"
          : field.validity.typeMismatch
            ? "รูปแบบข้อมูลไม่ถูกต้อง"
            : field.validity.rangeUnderflow
              ? "ค่าที่กรอกต่ำกว่าค่าต่ำสุดที่อนุญาต"
              : field.validity.rangeOverflow
                ? "ค่าที่กรอกสูงกว่าค่าสูงสุดที่อนุญาต"
                : field.validity.stepMismatch
                  ? "ค่าที่กรอกไม่ตรงกับช่วงที่อนุญาต"
                  : "กรุณาตรวจสอบข้อมูลช่องนี้";
        field.setCustomValidity(message);
        props.onInvalid?.(event);
      }}
      onInput={(event) => {
        (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).setCustomValidity("");
        props.onInput?.(event);
      }}
    >
      {children}
    </form>
  );
}
