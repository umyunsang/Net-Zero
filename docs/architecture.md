# Architecture

## Decision

ระบบเป็น TypeScript modular monolith เพื่อให้ claim transition, immutable calculation, point balance, voucher และ leaderboard projection ใช้ PostgreSQL transaction boundary เดียวกัน External dependencies อยู่หลัง ports และ mock ได้เฉพาะขอบระบบ

## Modules

- `auth`: deterministic demo JWT, role authorization และ OIDC port ที่ยังไม่เชื่อม provider
- `evidence`: authenticated upload/read proxy, private objects, immediate revocation และ retention
- `claims`: bus/tree/recycling state machines และ authorized review
- `ledger`: versioned factors, immutable calculation/carbon/point entries และ balance authority
- `rewards`: atomic issue/debit, one-time redemption, cancellation/refund และ expiry
- `community`: separated impact dashboard, Bangkok weekly opt-in pseudonymous leaderboard
- `privacy`: purge jobs, account deletion, non-reversible duplicate records และ audit

## Invariants

1. เฉพาะ claim ที่ `verified` สร้าง value ได้ และหนึ่ง claim มี positive credit ได้ครั้งเดียว
2. `estimated_avoided_co2e` กับ `projected_sequestration_co2e` แยกกันใน storage, API และ UI
3. Calculation และ ledger rows เป็น append-only; การแก้ใช้ compensating entry
4. Point ledger เป็น audit source ส่วน per-user balance row เป็น concurrency authority; transaction เดียวกันต้องอัปเดตทั้งคู่
5. Voucher issue กับ debit เป็น atomic และ redemption สำเร็จได้ครั้งเดียว
6. Raw GPS/ภาพเข้าถึงผ่าน API ที่ตรวจ tombstone ทุกครั้ง และลบตามนโยบาย retention
7. Demo records ใช้ `is_demo=true` และไม่เข้า real-user aggregates
