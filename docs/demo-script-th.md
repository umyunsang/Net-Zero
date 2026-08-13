# สคริปต์เดโม Net-Zero Thailand

## ขอบเขตเดโม

เดโมนี้ใช้ข้อมูล **mock/synthetic/demo-only** แบบ deterministic ทั้งตัวตน หลักฐาน provider เวลา และตำแหน่ง แต่ผ่าน API, state machines, PostgreSQL transactions, calculation, ledger, idempotency, RBAC และ voucher logic จริง ไม่มีบุคคล อุปกรณ์จริง หรือ provider/partner ภายนอกในเส้นทางเดโม และไม่มีการกล่าวอ้าง production deployment หรือ production readiness

ค่าที่แสดงเป็น **ค่าประมาณ CO2e ที่อ้างอิงปัจจัย/ระเบียบวิธีของ TGO แบบมีเวอร์ชัน** จาก source-referenced candidates ที่มีผลการทบทวน fixture ใน scope `mock_demo` เท่านั้น ไม่ใช่ human/TGO approval, carbon credit หรือ offset ผลรถโดยสารเป็นฮิวริสติกของ MVP, หลักฐานรีไซเคิลเป็นเพียงหลักฐานการนำวัสดุมาส่ง และผลต้นไม้เป็นค่าการกักเก็บที่คาดการณ์ไว้หนึ่งปี

## เริ่มเดโมแบบอัตโนมัติ

1. รัน `pnpm demo:reset` เพื่อสร้างสถานะเดโมที่กำหนดตายตัว
2. ระบบสร้างผลการทบทวน fixture สำหรับ `bus`, `recycling`, `tree` พร้อมป้าย `mock`, `synthetic`, `demo-only` และ scope `mock_demo`; candidate ทั้งสามยังเป็น production draft
3. รัน `TEST_DATABASE_URL=postgres://netzero:netzero@localhost:5432/netzero_test pnpm evidence:write` เพื่อทดสอบ complete three-flow demo และสร้าง readiness ใน atomic run เดียว; readiness แบบ marker/factor-only จะไม่ผ่าน
4. รัน `pnpm db:production-readiness` เป็น negative check ซึ่งต้องล้มเหลวแบบ fail-closed: mock approval ไม่ใช่ human approval และไม่มี physical-device evidence, production deployment หรือ partner จริง

## ลำดับเดโมครบวงจร

### 1. ต้นไม้

1. ลงชื่อเข้าใช้เป็น `user` และเริ่มกิจกรรมต้นไม้ด้วยหลักฐานภาพและผลประเมินแบบ synthetic ที่ติดป้าย demo-only
2. ส่งกิจกรรมผ่าน state machine และแสดงสถานะตามผลประเมิน mock ที่กำหนดตายตัว
3. แสดงผลเป็น **ค่าการกักเก็บที่คาดการณ์ไว้หนึ่งปี** และคะแนนที่ ledger สร้างแยกกัน ไม่กล่าวว่าต้นไม้จะอยู่รอด

### 2. รถโดยสาร

1. เริ่มกิจกรรมรถโดยสารด้วย synthetic foreground GPS trace จาก controlled clock
2. แสดง ticks ที่ `t0`, `t0+30s`, `t0+60s` และต่อเนื่องทุก 30 วินาทีตาม fixture แล้วให้ bus oracle และ state machine จริงประเมินผล
3. แสดงว่า lifecycle แบบ background หรือ tick ที่หายไปต้องล้มเหลวแบบ fail-closed ตามกฎเดิม
4. ย้ำว่า browser หรือ Pixel emulation เป็น automation ของเดโม ไม่ใช่หลักฐานจากอุปกรณ์จริง และไม่มี physical-device pass

### 3. การนำวัสดุมาส่งและการตรวจ

1. เลือกกิจกรรมรีไซเคิล ใช้ QR เดโมหนึ่งรายการ และส่งภาพ/ข้อมูล synthetic ที่ติดป้าย demo-only
2. สลับเป็น `reviewer` เพื่อตัดสินรายการผ่านคิวและ state transition จริง
3. กลับเป็น `user` เพื่อแสดงผลคำตัดสินและยืนยันว่า QR เดิมใช้ซ้ำไม่ได้
4. เรียกข้อมูลนี้ว่า **หลักฐานการนำวัสดุมาส่ง** เท่านั้น ไม่กล่าวอ้างว่าการรีไซเคิลสำเร็จ

ใช้โทเค็นเดโมได้ครั้งเดียว:

```text
DEMO-BIN-BKK-01:TOKEN-0001
DEMO-BIN-BKK-01:TOKEN-0002
DEMO-BIN-BKK-01:TOKEN-0003
```

### 4. ผลลัพธ์ คะแนน และ voucher

1. เปิดผลลัพธ์ของกิจกรรมที่ผ่าน โดยแยก **ค่าหลีกเลี่ยงโดยประมาณ** ออกจาก **ค่าคาดการณ์** และ **คะแนน**
2. แสดงว่า CO2e เป็นค่าประมาณตาม factor version ใน snapshot ส่วนคะแนนเป็นกลไกผลิตภัณฑ์ ไม่ใช่หน่วย CO2e
3. ใช้บัญชี `user` แลกคะแนนเป็น voucher
4. สลับเป็น `merchant` เพื่อ redeem voucher หนึ่งครั้ง แล้วลอง redeem รหัสเดิมซ้ำเพื่อแสดง transaction/idempotency และกติกาใช้ครั้งเดียว

### 5. แดชบอร์ดและอันดับ

1. เปิด dashboard เพื่อแสดง avoided, projected และ points แบบแยกความหมาย
2. เปิด leaderboard จากข้อมูล mock/demo-only และแสดงว่าข้อมูลเดโมถูกแยกจาก aggregate ของผู้ใช้จริง
3. ชี้ป้าย mock/synthetic/demo-only บนหน้าผลลัพธ์ และย้ำว่าไม่มี TGO endorsement, ไม่มี partner/payment จริง และไม่มี production readiness claim

## การปิดเดโม

สรุปเส้นทาง: deterministic reset → mock approvals → tree/bus/recycling → review → calculation/ledger → voucher ใช้ครั้งเดียว → dashboard/leaderboard ขอบเขตนี้พิสูจน์การทำงานของ core ผ่านการทดสอบแยกต่างหาก ส่วน readiness CLI วัด marker/fixture ตามที่รายงานเท่านั้น; production readiness ต้องยังล้มเหลวแบบ fail-closed
