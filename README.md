# Net-Zero Thailand

MVP แบบ **ข้อมูลจำลอง (mock/synthetic) — สำหรับเดโมเท่านั้น** เพื่อสาธิตการบันทึกกิจกรรม การตรวจสถานะ การคำนวณ การลงบัญชีคะแนน voucher และแดชบอร์ดผ่าน API, state machines, PostgreSQL transactions, calculation, ledger, idempotency, RBAC และตรรกะ voucher จริง

CO2e ที่แสดงเป็น **ค่าประมาณ CO2e ที่อ้างอิงปัจจัย/ระเบียบวิธีของ TGO แบบมีเวอร์ชัน** โดยปัจจัยเป็นเพียง source-referenced candidates และ mock approval มีขอบเขต `mock_demo` สำหรับเดโมเท่านั้น ไม่ใช่การรับรองหรือการสนับสนุนจาก TGO, carbon credit หรือ offset ทั้งไม่มีการกล่าวอ้างว่าป้องกันการทุจริตได้หรือพิสูจน์ว่าเกิดกิจกรรมจริง

## เทคโนโลยีที่ใช้

- Node.js 24, TypeScript, pnpm
- React/Vite PWA แบบ responsive
- NestJS/Fastify แบบ modular monolith
- PostgreSQL 17/PostGIS และ Graphile Worker
- ที่เก็บวัตถุส่วนตัวที่เข้ากันได้กับ S3; ใช้ MinIO สำหรับการพัฒนาในเครื่อง

## การตั้งค่าและรีเซ็ตเดโม

```sh
cp .env.example .env
pnpm install
docker compose up -d postgres minio
docker compose run --rm minio-init
pnpm demo:reset
pnpm dev
```

หน้าเว็บ: `http://localhost:5173`
สถานะเชิงปฏิบัติการของ API: `http://localhost:3000/health/ready` (ไม่ใช่ production-readiness gate)

`pnpm demo:reset` รีเซ็ตข้อมูลแบบ deterministic และสร้างผลการทบทวน fixture สำหรับ `bus`, `recycling`, `tree` ใน scope `mock_demo` โดยไม่ต้องมีบุคคล อุปกรณ์จริง หรือผู้ให้บริการภายนอก

คำสั่งข้อมูลเดโมปฏิเสธการทำงาน เว้นแต่ `MOCK_DEMO_ENABLED=true`, resource scopes ทั้งสองเป็น `mock_demo`, URL ฐานข้อมูล/object storage/web เป็น loopback และฐานข้อมูลมี persistent `mock_demo` marker ที่ตรงกัน `demo:reset` สร้าง marker ได้เฉพาะฐานใหม่ที่ business tables ทุกตารางว่าง ส่วน `db:seed-demo` ไม่สามารถสร้าง marker เองได้

บัญชีเดโมใช้ JWT และบทบาท `user`, `reviewer`, `merchant`, `admin` ตาม RBAC จริง ข้อมูล ตัวตน หลักฐาน เวลา ตำแหน่ง และคำตอบจาก provider ทั้งหมดเป็น mock/synthetic/demo-only ไม่มีการเชื่อมต่อ TGO, ระบบขนส่ง, AI, OIDC, ร้านค้า, payment หรือ partner จริง และไม่มีการ deploy หรือกล่าวอ้างความพร้อมใช้งานใน production

โทเค็น QR สำหรับเดโมใช้ได้ครั้งเดียว:

```text
DEMO-BIN-BKK-01:TOKEN-0001
DEMO-BIN-BKK-01:TOKEN-0002
DEMO-BIN-BKK-01:TOKEN-0003
```

## ขอบเขตความพร้อม

### Mock-demo readiness — คาดว่าผ่าน

```sh
TEST_DATABASE_URL=postgres://netzero:netzero@localhost:5432/netzero_test pnpm evidence:write
```

atomic verification รัน complete three-flow API test, typecheck/build/full tests/database-from-empty/E2E และ readiness ใน source เดียวกัน `pnpm db:demo-readiness` ปฏิเสธการรันเดี่ยวเพื่อไม่ให้ marker/factor-only state ถูกอ้างว่าเป็น readiness ผ่าน

### Production readiness — คาดว่าล้มเหลวแบบ fail-closed

รัน `pnpm db:production-readiness` เป็น negative check และคาดหวัง exit code ที่ไม่เป็นศูนย์ เพราะไม่มี human factor approval, physical-device evidence, production deployment หรือ real partner integration ห้ามใช้ผล mock-demo readiness เป็นหลักฐานแทน production readiness

Browser หรือ Pixel emulation ใช้ fixture เส้นทาง GPS สังเคราะห์ที่ช่วงเวลา 30 วินาทีเท่านั้น โดยไม่เรียก GPS/กล้องของอุปกรณ์ ไม่ใช่หลักฐานจากอุปกรณ์จริง และไม่ได้อ้างว่า physical-device ผ่าน

## การตรวจสอบเต็มชุดตามสัญญา

```sh
pnpm typecheck
pnpm build
pnpm test
TEST_DATABASE_URL=postgres://netzero:netzero@localhost:5432/netzero pnpm db:test-from-empty
pnpm test:e2e
```

รายการข้างต้นเป็นคำสั่งตรวจสอบที่คาดหวังตามสัญญา ไม่ใช่คำยืนยันว่าเอกสารนี้ได้รันหรือผ่านแล้ว

## ข้อจำกัดของผลลัพธ์

แค็ตตาล็อกปัจจัยและ resolver ทำงานแบบ fail-closed: หาก scope, ป้ายกำกับ, provenance หรือ approval ไม่ครบ ระบบต้องไม่สร้าง CO2e หรือคะแนน ผลรถโดยสารเป็นฮิวริสติกของ MVP; หลักฐานรีไซเคิลหมายถึงหลักฐานการนำวัสดุมาส่ง ไม่ยืนยันว่ารีไซเคิลสำเร็จ; ผลต้นไม้คือค่าการกักเก็บที่คาดการณ์ไว้หนึ่งปี ไม่ยืนยันว่าต้นไม้จะอยู่รอด
