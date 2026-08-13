# Net-Zero Thailand: แนวทางนำเสนอเดโม

## ประโยคเปิด

Net-Zero Thailand เป็น MVP แบบ **ข้อมูลจำลอง (mock/synthetic) — สำหรับเดโมเท่านั้น** ที่สาธิตเส้นทางการบันทึกกิจกรรม การตรวจสถานะ การคำนวณ การลงบัญชีคะแนน voucher และการแสดงผล โดย core ใช้ API, state machines, PostgreSQL transactions, calculation, ledger, idempotency, RBAC และ voucher logic จริง

## สิ่งที่เดโมแสดง

- deterministic reset สร้าง mock owner/domain-reviewer approvals สำหรับ `bus`, `recycling`, `tree` ใน scope `mock_demo`
- ผู้ใช้ทำ flow ต้นไม้ รถโดยสาร และการนำวัสดุมาส่งด้วยหลักฐาน/เวลา/provider response แบบ synthetic
- รถโดยสารใช้ synthetic foreground GPS trace ทุก 30 วินาทีผ่าน browser automation; browser หรือ Pixel emulation ไม่ใช่หลักฐานจากอุปกรณ์จริง
- reviewer, calculation snapshot, carbon/points ledger, voucher ใช้ครั้งเดียว, dashboard และ leaderboard ทำงานผ่าน core จริง
- mock-demo readiness คาดว่าผ่านเมื่อข้อมูลเดโมครบ แต่ production readiness คาดว่าล้มเหลวแบบ fail-closed

## ขอบเขตของคำกล่าวอ้าง

ใช้ข้อความว่า **“ค่าประมาณ CO2e ที่อ้างอิงปัจจัย/ระเบียบวิธีของ TGO แบบมีเวอร์ชัน”** เท่านั้น ปัจจัยเป็น source-referenced candidates และ mock approval เป็นการอนุมัติเพื่อเดโม ไม่ใช่ TGO endorsement, certification, carbon credit หรือ offset

- รถโดยสาร: เป็นฮิวริสติกของ MVP ไม่ใช่ข้อพิสูจน์ว่าโดยสารจริงหรือป้องกันการทุจริตได้
- การนำวัสดุมาส่ง: เป็นหลักฐานการนำวัสดุมาส่ง ไม่ยืนยันว่ารีไซเคิลสำเร็จ
- ต้นไม้: เป็นค่าการกักเก็บที่คาดการณ์ไว้หนึ่งปี ไม่ยืนยันว่าต้นไม้จะอยู่รอด
- คะแนน: เป็นกลไกของผลิตภัณฑ์ แยกจากค่า CO2e

ไม่มีการเชื่อมต่อ provider, TGO, ระบบขนส่ง, AI, OIDC, ร้านค้า, payment หรือ partner จริง ไม่มีการ deploy ไป production และไม่มีการกล่าวอ้าง production readiness ข้อมูล mock/synthetic/demo-only ไม่ใช่ผลกระทบจริงของบุคคลหรือชุมชน

## วิธีอธิบายเกตความพร้อม

`pnpm demo:reset` เตรียม fixture ส่วน `TEST_DATABASE_URL=postgres://netzero:netzero@localhost:5432/netzero_test pnpm evidence:write` รัน complete flow และสร้าง readiness แบบ atomic; คำสั่ง readiness เดี่ยวถูกปฏิเสธเพื่อไม่ให้ factor-only state ถูกอ้างว่าพร้อม

`pnpm db:production-readiness` ต้องล้มเหลวแบบ fail-closed เพราะไม่มี human approval, physical-device evidence, production deployment หรือ real partner integration ผล mock-demo readiness ใช้แทน production readiness ไม่ได้

## ตัวเลขที่ยังใช้ใน pitch ไม่ได้จนกว่าจะมีแหล่งอ้างอิง

ห้ามนำเสนอรายการต่อไปนี้เป็นข้อเท็จจริงจนกว่าจะเพิ่มแหล่งอ้างอิงที่ตรวจสอบได้ วันที่เข้าถึง และขอบเขตของข้อมูล:

- ขนาดตลาด: **[ต้องใส่อ้างอิงก่อนใช้]**
- ผู้ใช้ 70M: **[ต้องใส่อ้างอิงก่อนใช้]**
- มูลค่า 500M: **[ต้องใส่อ้างอิงก่อนใช้]**
- อัตรา 40%: **[ต้องใส่อ้างอิงก่อนใช้]**

เมื่อมีแหล่งอ้างอิง ให้ระบุผู้เผยแพร่ ชื่อเอกสารหรือชุดข้อมูล ลิงก์ วันที่เผยแพร่หรือวันที่เข้าถึง นิยามตัวชี้วัด และเหตุผลที่นำมาใช้กับตลาดหรือกลุ่มเป้าหมายนี้ได้

## คำปิด

เดโมนี้แสดง trust boundary ที่ชัดเจน: mock/synthetic inputs เข้าสู่ core จริงและแสดงผลแบบ demo-only ขณะที่ production boundary ยังปฏิเสธข้อมูลชุดนี้แบบ fail-closed จึงไม่ควรตีความเดโมเป็นการรับรองจาก TGO, หลักฐานอุปกรณ์จริง, การเชื่อมต่อ partner หรือความพร้อมใช้งานใน production.
