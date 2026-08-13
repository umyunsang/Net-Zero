# Net-Zero Rewards สำหรับประเทศไทย — Functional MVP

เอกสารข้อกำหนดผลิตภัณฑ์ (PRD) · ฉบับภาษาไทย

สถานะเอกสาร: ข้อกำหนดฐานก่อนเริ่มพัฒนา / อ้างอิงจากการสัมภาษณ์เชิงลึก

## 1. บทสรุป

Net-Zero Rewards คือ Functional MVP สำหรับประเทศไทยที่ให้ผู้ใช้ส่งหลักฐานกิจกรรมสีเขียว 3 ประเภท ได้แก่ การเดินทางด้วยรถโดยสาร การนำวัสดุรีไซเคิลมาส่ง และการปลูกต้นไม้ ระบบจะแปลงเฉพาะกิจกรรมที่ผ่านการตรวจสอบแล้วเป็นค่าประมาณผลกระทบคาร์บอนและคะแนน ก่อนเชื่อมต่อไปสู่รางวัล

ระบบสถานะการตรวจสอบ บัญชีคาร์บอนและคะแนน การออกและใช้ voucher ตลอดจน dashboard และ leaderboard ต้องทำงานจริง อนุญาตให้ใช้ stub หรือข้อมูล demo ที่ระบุชัดเจนได้เฉพาะบริการภายนอก เช่น ข้อมูลเส้นทางขนส่ง บริการ AI ตรวจภาพ ทะเบียน QR ของจุดรับวัสดุ และเครื่องสแกนของร้านค้าที่เข้าร่วม

ค่าคาร์บอนทั้งหมดเป็นค่าประมาณสำหรับผู้บริโภคที่อ้างอิงแนวทาง TGO เท่านั้น ห้ามเรียกว่า carbon credit, offset หรือผลที่ TGO รับรอง ระบบต้องแยก `estimated_avoided_co2e` ของรถโดยสารและรีไซเคิลออกจาก `projected_sequestration_co2e` ของต้นไม้ในฐานข้อมูล API หน้าจอ และยอดรวมทุกระดับ

## 2. ปัญหาและโอกาส

- การสร้างแรงจูงใจให้คนทำกิจกรรมสีเขียวเป็นเรื่องยาก และการพิสูจน์ว่ากิจกรรมเกิดขึ้นจริงโดยไม่รับเครดิตซ้ำก็ทำได้ยากเช่นกัน
- หากแสดงผลกระทบคาร์บอนเป็นตัวเลขรวมเดียว ความแตกต่างระหว่างการหลีกเลี่ยงการปล่อยในปัจจุบันกับการกักเก็บที่คาดการณ์ในอนาคตจะหายไปและอาจทำให้เข้าใจเกินจริง
- หากรางวัลเป็นเพียงหน้าจอจำลอง จะไม่สามารถแสดงศักยภาพในการนำไปใช้ต่อในภาคอุตสาหกรรมหรือภาครัฐหลังจบ hackathon ได้
- ผลิตภัณฑ์ต้องใช้บริบทและ emission factor ของประเทศไทย พร้อมเปิดเผยข้อจำกัดของ heuristic และ proxy ในระดับ MVP อย่างโปร่งใส

โอกาสของผลิตภัณฑ์คือการเชื่อมการส่งหลักฐาน การตรวจสอบอย่างระมัดระวัง การคำนวณคาร์บอนที่ตรวจสอบย้อนกลับได้ คะแนน และ voucher แบบใช้ครั้งเดียวให้เป็นวงจรเดียวกัน

## 3. เป้าหมายผลิตภัณฑ์และนิยามความสำเร็จ

### 3.1 เป้าหมาย

- เก็บหลักฐานและผลการตรวจสอบของกิจกรรมสีเขียวทั้งสามประเภท
- แปลงเฉพาะกิจกรรมที่ verified แล้วเป็นผลกระทบคาร์บอนด้วย factor และ formula ที่มี version
- แยก avoided emissions ออกจาก projected sequestration ระยะหนึ่งปีอย่างชัดเจน และให้คะแนนด้วยสูตรที่กำหนดแน่นอน
- ทำให้กระบวนการตั้งแต่หักคะแนนจนถึงใช้ voucher เป็นแบบใช้ครั้งเดียว atomic และ idempotent
- แสดงผลกระทบของบุคคลและชุมชนผ่าน dashboard และ leaderboard รายสัปดาห์แบบ opt-in
- เก็บ raw evidence เท่าที่จำเป็นและรองรับสิทธิ์ในการลบบัญชีและถอนตัวจาก leaderboard

### 3.2 นิยามความสำเร็จของ MVP

ความสำเร็จของ MVP วัดจากการผ่านข้อกำหนดด้านฟังก์ชัน ข้อมูล การเปลี่ยนสถานะ และเกณฑ์การยอมรับในเอกสารนี้ ไม่ใช่จำนวนผู้ใช้หรือรายได้ ส่วน KPI ทางธุรกิจ เช่น adoption, retention และอัตราการใช้งานกับร้านค้าจริง จะกำหนดภายหลังเมื่อมี baseline จาก pilot ภาคสนาม

### 3.3 หลักการผลิตภัณฑ์

- Verified first: ไม่ออก CO2e หรือคะแนนก่อนกิจกรรมผ่านการตรวจสอบ
- Conservative claims: ไม่ใช้ข้อความที่กล่าวอ้างเกินกว่าสิ่งที่หลักฐานพิสูจน์ได้
- Separation by impact type: ไม่รวม avoided emissions กับ projected sequestration เป็นยอดเดียวโดยไม่มีป้ายกำกับ
- Reproducibility: ทุก ledger record ต้องคำนวณซ้ำได้ผลเดิมจาก input, formula, unit และ factor version ณ เวลานั้น
- Idempotency: retry, replay และคำขอพร้อมกันต้องไม่สร้าง claim, credit, refund หรือ redemption ซ้ำ
- Privacy by retention: ไม่เก็บ raw evidence แบบถาวรเป็นค่าเริ่มต้น

## 4. ขอบเขต MVP

### 4.1 สิ่งที่อยู่ในขอบเขต

- การตรวจสอบการเดินทางด้วยรถโดยสาร: GPS coverage, ช่วงความเร็ว, ระยะห่างป้าย, ความตรงกับเส้นทาง และการตรวจการเดินทางซ้ำ
- การตรวจสอบการนำวัสดุรีไซเคิลมาส่ง: one-time QR session, ภาพในแอป, การกันซ้ำ, ข้อจำกัด user/bin/day และ authorized review
- การตรวจสอบการปลูกต้นไม้: ภาพในแอป, GPS และเวลา, ผล AI, manual review และการตรวจซ้ำข้ามบัญชี
- บัญชีคาร์บอนและคะแนน: factor/proxy ที่มี version, formula, unit, assumption, impact type และ credit ครั้งเดียว
- รางวัล: การออก หักคะแนน ใช้ ยกเลิก และหมดอายุของ voucher แบบใช้ครั้งเดียว
- ผลกระทบและชุมชน: dashboard ส่วนบุคคล ยอดรวมชุมชนแบบไม่ระบุตัวตน และ leaderboard รายสัปดาห์แบบ opt-in

### 4.2 ขอบเขตที่อนุญาตให้ mock

- ผู้ให้บริการข้อมูลเส้นทางและป้ายรถโดยสาร
- ผู้ให้บริการ AI ตรวจภาพ
- ทะเบียน QR ของจุดรับวัสดุที่เชื่อถือได้
- demo merchant scanner และ demo reward catalog
- synthetic user/action data ที่ติดป้ายว่าเป็น demo อย่างชัดเจน

Mock ภายนอกต้องไม่ข้าม core business rules โดย verification state machine, carbon/points ledger, voucher lifecycle และ leaderboard projection ต้องทำงานจริง

## 5. ผู้ใช้และบทบาท

### 5.1 ผู้ใช้ทั่วไป

- ส่งหลักฐานกิจกรรมสีเขียว
- ดูสถานะ claim และเหตุผลที่ถูกปฏิเสธหรือรอตรวจสอบ
- ดูผลกระทบคาร์บอนที่ verified แล้วและยอดคะแนน
- ใช้คะแนนออก voucher และดูสถานะการใช้งาน
- จัดการการเข้าร่วม leaderboard และ pseudonym
- ขอให้ลบบัญชีได้

### 5.2 Authorized reviewer

- ยืนยันหรือลดประเภทและจำนวนวัสดุรีไซเคิลตามสิ่งที่เห็นในภาพ
- ตัดสิน tree claim ที่รอเนื่องจาก confidence ก้ำกึ่งหรือ provider ขัดข้อง
- เข้าถึง raw evidence ได้เฉพาะภายในสิทธิ์ที่ได้รับ
- บันทึก actor, timestamp และ reason code ของทุกการตัดสินใจเป็น audit metadata

### 5.3 Demo merchant

- สแกน voucher token ที่ออกแล้ว
- เปลี่ยน voucher สถานะ `issued` ที่ยังใช้ได้เป็น `redeemed` ได้เพียงครั้งเดียว
- ไม่สร้างผลข้างเคียงเพิ่มเมื่อ voucher ถูกใช้ หมดอายุ หรือยกเลิกแล้ว
- ไม่ประมวลผลการชำระเงินจริงหรือ settlement

### 5.4 ผู้ดูแลระบบ

- จัดการ version ของ factor/methodology, route corridor, stop geofence, AI threshold และ QR registry
- กำกับดูแลสิทธิ์และการทำงานของ retention policy
- ตรวจสอบการแยก demo account ออกจาก real-user aggregate

## 6. เส้นทางผู้ใช้หลัก

### 6.1 Claim การเดินทางด้วยรถโดยสาร

1. เมื่อผู้ใช้เริ่มบันทึกการเดินทาง ระบบเก็บ GPS โดยมีช่วงเป้าหมายทุก 30 วินาที
2. เมื่อจบการเดินทาง ระบบประเมิน coverage, non-stop speed windows, stop-pair spacing และ route match
3. หากข้อมูลหรือ dependency ไม่เพียงพอ ให้คง claim เดิมเป็น `pending` โดยไม่ให้คะแนน
4. หาก metric ที่ประเมินได้ไม่ผ่านแม้แต่หนึ่งข้อ ให้เป็น `rejected`
5. หากผ่านทุก metric และการตรวจซ้ำ ให้เป็น `verified`
6. คำนวณ avoided emissions เทียบกับรถยนต์มาตรฐาน และสร้าง carbon/points ledger credit เพียงครั้งเดียว

### 6.2 Claim การนำวัสดุรีไซเคิลมาส่ง

1. ผู้ใช้สแกน QR ของจุดรับที่เชื่อถือได้เพื่อเปิด one-time claim session
2. ผู้ใช้เลือกประเภทและจำนวนวัสดุ แล้วถ่ายภาพในแอป
3. ระบบตรวจ QR, session reuse, ภาพซ้ำ และข้อจำกัด user/bin/day
4. Claim ที่ผ่านการตรวจอัตโนมัติจะเข้าสู่ `pending review`
5. Authorized reviewer ยืนยันหรือลดประเภทและจำนวนตามที่มองเห็นได้
6. ใช้เฉพาะค่าที่อนุมัติแล้วในการคำนวณ avoided emissions และคะแนนของ claim ที่ verified

### 6.3 Claim การปลูกต้นไม้

1. ผู้ใช้ถ่ายภาพต้นกล้าที่ปลูกใหม่ในแอป พร้อมบันทึก GPS และ captured_at
2. AI provider ส่งผลประเภทต้นกล้า confidence และสัญญาณภาพซ้ำ
3. หากผ่าน versioned threshold และไม่ซ้ำ ให้เป็น `verified`
4. หากผิดประเภทชัดเจนหรือซ้ำ ให้เป็น `rejected`
5. หาก confidence ก้ำกึ่งหรือ provider ล้มเหลว ให้เป็น `pending review` เพื่อให้ authorized reviewer ตัดสิน
6. Claim ที่ verified จะบันทึก proxy หนึ่งปี 9.5 kgCO2e/ต้น เพียงครั้งเดียว โดยไม่อ้าง survival หรือ carbon credit

### 6.4 การออกและใช้ Voucher

1. เมื่อผู้ใช้เลือก reward ระบบตรวจยอดคะแนนและต้นทุน
2. การออก voucher และหักคะแนนต้องเกิดใน atomic transaction เดียวกัน
3. Voucher ที่ออกแล้วมีสถานะ `issued` และใช้ได้ 7 วัน
4. การสแกนของ demo merchant เปลี่ยนเป็น `redeemed` ได้เพียงคำขอเดียว
5. การลองสแกนซ้ำคืนผลเดิมโดยไม่เปลี่ยนสถานะเพิ่ม
6. หาก `cancelled` ก่อนใช้งาน ให้คืนคะแนนหนึ่งครั้ง แต่ไม่คืนคะแนนเมื่อ `expired`

### 6.5 Dashboard และ leaderboard

1. Dashboard แสดง verified impact และ points balance
2. แสดง avoided CO2e กับ projected sequestration แยกกัน
3. Leaderboard แสดงเฉพาะผู้ใช้ที่ opt in โดยใช้ pseudonym
4. สัปดาห์เริ่มวันจันทร์ 00:00 ตาม Asia/Bangkok และนับเฉพาะ verified weekly points
5. Demo account ไม่เข้าสู่อันดับจริง
6. เมื่อ opt out ให้ลบ pseudonym ออกจากอันดับปัจจุบันและอนาคตทันที แต่คงยอดรวมชุมชนแบบไม่ระบุตัวตน

## 7. ข้อกำหนดฟังก์ชันโดยละเอียด

### 7.1 การตรวจสอบรถโดยสาร

- FR-BUS-01: ช่วงเป้าหมายในการเก็บ GPS คือทุก 30 วินาที
- FR-BUS-02: valid GPS sample ต้องไม่น้อยกว่า 80% ของ sample ที่คาดหวัง
- FR-BUS-03: อย่างน้อย 80% ของ speed window นอก stop geofence ต้องอยู่ระหว่าง 20–40 km/h
- FR-BUS-04: อย่างน้อย 80% ของ stop pair ที่ตรวจพบต้องห่างกัน 300–500 m
- FR-BUS-05: อย่างน้อย 80% ของ valid point ต้องอยู่ใน versioned route corridor
- FR-BUS-06: ต้องผ่านทั้งสี่ metric จึงเป็น `verified`; ข้อมูลไม่พอหรือ dependency ไม่พร้อมเป็น `pending`; metric ที่ประเมินได้แล้วไม่ผ่านเป็น `rejected`
- FR-BUS-07: retry/replay ต้องใช้ claim เดิม และ ledger credit เกิดได้ครั้งเดียว
- FR-BUS-08: Claim ใหม่ของผู้ใช้คนเดิมที่มีเวลาทับซ้อนและ normalized trace similarity ตั้งแต่ 80% ขึ้นไป ต้องเป็น duplicate โดยใช้ non-reversible trip fingerprint
- FR-BUS-09: Claim ที่ verified คำนวณ `estimated_avoided_co2e` จากส่วนต่างระหว่าง versioned car baseline กับ bus factor

### 7.2 การตรวจสอบรีไซเคิล

- FR-REC-01: QR ต้องผูกกับจุดรับที่เชื่อถือได้และสร้าง one-time session เท่านั้น
- FR-REC-02: ผู้ใช้ต้องระบุประเภทและจำนวน พร้อมถ่ายภาพในแอป
- FR-REC-03: ระบบต้องป้องกันการใช้ภาพเดิมและ session replay
- FR-REC-04: ผู้ใช้หนึ่งคนได้รับ credit ได้สูงสุดหนึ่ง claim ต่อจุดต่อวัน
- FR-REC-05: การผ่านการตรวจอัตโนมัติยังไม่ทำให้เป็น verified แต่เข้าสู่ `pending review`
- FR-REC-06: Authorized reviewer ยืนยันหรือลดประเภทและจำนวนได้เฉพาะตามหลักฐานที่เห็น
- FR-REC-07: หากภาพไม่พอ ให้คง `pending` หรือเป็น `rejected` พร้อม reason code
- FR-REC-08: Carbon/points ledger ใช้เฉพาะประเภทและจำนวนที่ reviewer อนุมัติ
- FR-REC-09: UI และ API ต้องเรียกผลลัพธ์ว่า “หลักฐานการนำวัสดุมาส่ง” ไม่ใช่ “รีไซเคิลสำเร็จ”

### 7.3 การตรวจสอบต้นไม้

- FR-TREE-01: การส่งต้องมีภาพในแอป GPS และ captured_at
- FR-TREE-02: ผล AI ต้องบันทึก provider, model/threshold version, confidence และ result
- FR-TREE-03: ต้องผ่าน versioned threshold และไม่ซ้ำจึงเป็น `verified`
- FR-TREE-04: การจำแนกผิดอย่างชัดเจนหรือ duplicate เป็น `rejected`
- FR-TREE-05: Confidence ก้ำกึ่งหรือ provider ขัดข้องเป็น `pending review` และไม่ให้คะแนน
- FR-TREE-06: Authorized reviewer เปลี่ยน pending claim เป็น verified หรือ rejected ได้
- FR-TREE-07: ข้ามทุกบัญชี หากระยะ GPS ไม่เกิน 5 m และ visual similarity ตั้งแต่ 90% ขึ้นไป ให้เป็น duplicate/rejected
- FR-TREE-08: หากตรงเพียงสัญญาณตำแหน่งหรือภาพอย่างใดอย่างหนึ่ง ให้เป็น `pending review`
- FR-TREE-09: Claim ที่ verified บันทึก versioned one-year proxy 9.5 kgCO2e/ต้น เป็น `projected_sequestration_co2e` เพียงครั้งเดียว

### 7.4 บัญชีคาร์บอนและคะแนน

- FR-CARB-01: รถโดยสารและรีไซเคิลใช้ `estimated_avoided_co2e`; ต้นไม้ใช้ `projected_sequestration_co2e`
- FR-CARB-02: แยก impact type ทั้งสองใน storage, API, dashboard และ aggregates
- FR-CARB-03: Calculation record ต้องมี input, formula, unit, source URL, methodology code, version/effective date, proxy assumptions, impact type และ disclaimer
- FR-CARB-04: การเปลี่ยน factor version ต้องไม่แก้ ledger record ย้อนหลัง
- FR-CARB-05: การคำนวณซ้ำจาก record เดิมต้องได้ผลเดิม
- FR-PTS-01: Avoided points คือ `min(100, floor(kgCO2e / 0.1))`
- FR-PTS-02: Projected points คือ `min(100, floor((kgCO2e / 0.1) × 0.25))`
- FR-PTS-03: คะแนนสูงสุดต่อ claim คือ 100 และปัดเศษลง
- FR-PTS-04: เฉพาะ claim ที่ verified เท่านั้นที่สร้าง credit ได้หนึ่งครั้ง

### 7.5 Rewards

- FR-REW-01: การออก voucher และหักคะแนนต้องสำเร็จพร้อมกันหรือล้มเหลวพร้อมกัน
- FR-REW-02: สถานะ voucher คือ `issued`, `redeemed`, `expired`, `cancelled`
- FR-REW-03: Voucher หมดอายุ 7 วันหลังออก
- FR-REW-04: Redemption ต้องเป็น atomic และ idempotent
- FR-REW-05: จาก scan พร้อมกันหลายคำขอ สำเร็จได้เพียงหนึ่งคำขอ
- FR-REW-06: การสแกน voucher ที่ redeemed, expired หรือ cancelled แล้วต้องไม่เปลี่ยนสถานะหรือคะแนน
- FR-REW-07: Cancellation ก่อนใช้คืนคะแนนหนึ่งครั้ง ส่วน expiration ไม่คืนคะแนน
- FR-REW-08: MVP ไม่มี payment processing หรือ merchant settlement จริง

### 7.6 ผลกระทบ ชุมชน และความเป็นส่วนตัว

- FR-COM-01: Leaderboard ต้องเป็นแบบ opt-in และใช้ pseudonym
- FR-COM-02: อันดับใช้เฉพาะ verified points ในสัปดาห์ Asia/Bangkok
- FR-COM-03: แยก demo account ออกจากอันดับจริงและ real-user aggregate
- FR-COM-04: แสดง avoided CO2e และ projected sequestration แยกกัน
- FR-COM-05: Opt-out ต้องลบ pseudonym ออกจากอันดับปัจจุบันและอนาคตทันที
- FR-COM-06: หลัง opt-out ยังเก็บยอดรวมชุมชนแบบไม่ระบุตัวตนได้
- FR-PRIV-01: เก็บ raw GPS และภาพ 30 วันหลัง claim ถูกตัดสิน แล้วลบอัตโนมัติ
- FR-PRIV-02: เฉพาะเจ้าของข้อมูลและ authorized reviewer เท่านั้นที่เข้าถึง raw evidence ได้
- FR-PRIV-03: เมื่อลบบัญชี ให้ลบ raw evidence ทันที
- FR-PRIV-04: หลังการลบ ให้คงเฉพาะ non-reversible fingerprints, formula/ledger, audit metadata และ anonymized aggregates

## 8. โมเดลข้อมูลและการตรวจสอบย้อนหลัง

### 8.1 Record หลัก

- User: points balance, carbon totals ที่แยกประเภท, leaderboard opt-in, pseudonym, demo flag
- Claim: type, actor, evidence reference, status, reason codes, timestamps, idempotency key
- Verification Result: input/result ของแต่ละ check, configuration version, reviewer decision, evaluated_at
- Carbon Estimate: impact type, kgCO2e, baseline, factor reference, formula, assumptions, disclaimer
- Points Ledger Entry: source claim, conversion version, amount, balance delta, created_at
- Voucher: token, reward, points cost, state และ timestamps ของแต่ละสถานะ
- Redemption: voucher, merchant, request idempotency key, result, redeemed_at
- Retention Record: วันครบกำหนดลบหลักฐาน ผลการลบ และชนิด fingerprint ที่คงไว้

### 8.2 Invariant

- Claim หนึ่งรายการสร้าง carbon ledger entry และ points credit ได้อย่างละหนึ่งครั้งเท่านั้น
- Ledger record ต้องเก็บ immutable reference ไปยัง factor และ formula ตอนที่สร้าง
- Voucher state transition ต้องเชื่อมกับ points balance change แบบ atomic
- การลบ raw evidence ต้องไม่ทำให้การคำนวณ ledger ซ้ำหรือ anonymous aggregate สูญเสียความถูกต้อง
- Demo data ต้องแยกและระบุได้ในทุก aggregate และหน้าจอ

## 9. การเชื่อมต่อภายนอกและขอบเขต Mock

- TGO factor/methodology source: pin official URL, code/version, effective date และ unit โดยไม่เชื่อม real-time registry
- Transit data: ให้ route, stop, corridor fixture และ dependency failure fixture โดยไม่เชื่อม production กับ BTS/MRT
- QR bin registry: ให้ trusted demo location และ one-time session issuance
- AI photo check: ให้ fixture สำหรับ verified, rejected, ambiguous, provider failure และ duplicate
- Merchant scanner: ให้ demo account ตรวจสถานะ voucher และเรียก idempotent redemption

ทุก response ภายนอกต้องบันทึก fixture version และ provider type ต้องมี flow สำหรับ pending, rejected และ failure ไม่ใช่เฉพาะ success response

## 10. หน้าจอผลิตภัณฑ์

- Action submission: เก็บและส่งหลักฐานของรถโดยสาร รีไซเคิล และต้นไม้
- Claim status: pending/verified/rejected, ผล check, reason code และการดำเนินการถัดไป
- Impact dashboard: CO2e ที่แยกประเภท, claim history, points balance และ estimate disclaimer
- Rewards catalog: รายละเอียด reward, points cost และอายุ voucher
- Voucher detail: token/QR, state, issued_at, expires_at และ redemption result
- Leaderboard: opt-in, pseudonym, weekly points, impact ที่แยกประเภท และคำอธิบายการตัด demo account
- Reviewer queue: pending recycling/tree claim, evidence และ action สำหรับปรับ อนุมัติ หรือปฏิเสธ
- Demo merchant scanner: ผล scan และสถานะ idempotent replay

## 11. ข้อกำหนดที่ไม่ใช่ฟังก์ชัน

- Consistency: points, voucher และ redemption ต้องใช้ transaction หรือการรับประกัน atomicity ที่เทียบเท่า
- Idempotency: ใช้ idempotency key กับ submission, reevaluation, credit, voucher issuance, redemption และ cancellation
- Reproducibility: เมื่อ factor และ configuration เหมือนกัน input เดิมต้องให้ผลเดิม
- Time: การคำนวณ leaderboard และ voucher ต้องจัดการ Asia/Bangkok อย่างชัดเจน
- Authorization: ใช้ role-based access control กับ raw evidence และ review action
- Privacy: ห้ามคัดลอก raw evidence ไปยัง log, analytics หรือ demo export
- Auditability: ทุก state transition และ manual decision ต้องเก็บ actor, before/after, reason และ timestamp
- Failure handling: เมื่อ external dependency ล้มเหลว ต้องไม่สูญเสีย core record และใช้ pending state ที่ retry ได้
- Claim accuracy: ใช้คำว่า estimate, proxy, demo และ non-certified อย่างสม่ำเสมอในหน้าจอและ pitch ที่เกี่ยวข้อง
- Accessibility: ไม่ใช้สีเพียงอย่างเดียวเพื่อสื่อสถานะ ต้องมี text label และ reason ด้วย

## 12. เกณฑ์การยอมรับ

1. แม้ใช้ external stub ระบบ verification state machine, carbon/points ledger, voucher lifecycle และ leaderboard projection ต้องทำงานจริง
2. Bus golden fixture ต้องครอบคลุม GPS coverage 80%, speed ratio 80% ที่ขอบ 20 และ 40 km/h, stop-spacing ratio 80% ที่ขอบ 300 และ 500 m และ route match 80%
3. ข้อมูล bus ไม่พอเป็น pending โดยไม่มีคะแนน, metric ใดไม่ผ่านเป็น rejected, ผ่านครบเป็น verified และได้ credit ครั้งเดียว
4. Bus retry/replay ไม่เพิ่ม claim หรือ credit และ claim ใหม่ที่เวลาทับซ้อนกับ trace similarity ตั้งแต่ 80% เป็น duplicate
5. Recycling QR session ใช้ได้ครั้งเดียว และผู้ใช้หนึ่งคนต่อจุดต่อวันได้รับ credit ได้ไม่เกินหนึ่ง claim
6. Recycling claim ไม่สร้าง carbon/points ก่อน reviewer อนุมัติ และ ledger ต้องไม่ใช้จำนวนสูงกว่าที่อนุมัติ
7. Recycling UI/API ต้องระบุว่าเป็น “หลักฐานการนำมาส่ง” และ CO2e เป็นค่าประมาณ
8. Tree fixture ต้องครอบคลุม verified, rejected, confidence ก้ำกึ่ง, provider failure, exact duplicate และ manual decision
9. Tree claim ข้ามบัญชีที่มี GPS ไม่เกิน 5 m และ visual similarity ตั้งแต่ 90% ต้องเป็น rejected; หากตรงเพียงสัญญาณเดียวให้เป็น pending review
10. Tree claim ที่ verified สร้าง projected sequestration หนึ่งปี 9.5 kgCO2e เพียงครั้งเดียว พร้อม disclaimer เรื่อง survival และ credit
11. Carbon ledger ต้องเก็บ factor/methodology source, version, unit, formula, assumptions และ impact type และคำนวณซ้ำได้ผลเดิม
12. Dashboard และ API ห้ามรวม avoided CO2e กับ projected sequestration เป็นยอดเดียวที่ไม่มีป้ายกำกับ
13. Points ใช้สูตรที่ล็อกไว้ ปัดลง จำกัด 100 points ต่อ claim และให้ credit หนึ่งครั้งต่อ verified claim
14. Voucher issuance และ point deduction ต้องสำเร็จพร้อมกันหรือล้มเหลวพร้อมกัน
15. จาก scan voucher พร้อมกัน สำเร็จได้ครั้งเดียว; retry คืนผลเดิม; scan หลังสถานะสิ้นสุดไม่มีผลข้างเคียง
16. Cancellation ก่อน redeem คืนคะแนนหนึ่งครั้ง ส่วน expiration หลัง 7 วันไม่คืนคะแนน
17. Leaderboard นับเฉพาะ verified points ในสัปดาห์ Asia/Bangkok ไม่รวม demo account และแสดงเฉพาะผู้ใช้ที่ opt in
18. Opt-out ลบ pseudonym ทันทีโดยไม่เปลี่ยน anonymized community totals
19. Raw GPS และภาพถูกลบอัตโนมัติ 30 วันหลัง decision และทันทีเมื่อลบบัญชี โดยคงเฉพาะ non-reversible fingerprint และ anonymous audit/ledger
20. ข้อความผู้ใช้และ pitch ต้องระบุว่าค่าคาร์บอนเป็น TGO-informed estimate ไม่ใช่ certified credit และ bus verification เป็น MVP heuristic
21. Demo ต้องแสดงทั้งสาม claim flow, carbon/points update, one-time voucher redemption, dashboard และ leaderboard โดยแยก demo data ออกจาก real-user aggregate

## 13. สถานการณ์ Demo สำหรับ Hackathon

1. เล่น bus fixture ที่ผ่านทั้งสี่ metric และแสดงว่า avoided CO2e กับ points เพิ่มขึ้นเพียงครั้งเดียว
2. แสดงว่า replay ของการเดินทางเดิมไม่สร้าง credit ซ้ำ
3. ส่ง QR และภาพรีไซเคิลให้เกิด pending review แล้วให้ reviewer ลดจำนวน โดย ledger ใช้เฉพาะค่าที่อนุมัติ
4. ใช้ tree photo fixture แสดงอย่างน้อยสองเส้นทางจาก verified, pending review และ duplicate/rejected
5. ยืนยันใน dashboard ว่า avoided impact และ projected impact แสดงแยกกัน
6. ใช้ points ออก voucher ให้ demo merchant redeem หนึ่งครั้ง แล้วแสดงว่า re-scan คืนผลสิ้นสุดเดิม
7. แสดง leaderboard opt-in/opt-out และการตัด demo account

## 14. สิ่งที่ไม่อยู่ในขอบเขต

- การออก carbon credit หรือ offset
- การเชื่อม TGO registry แบบ production หรือการอ้างว่า TGO รับรอง
- การอ้างว่า bus heuristic ผ่านการตรวจสอบทางวิทยาศาสตร์แล้วหรือ fraud-proof
- การรับประกันว่าต้นไม้จะอยู่รอดหรือให้ projected sequestration เกินหนึ่งปี
- การรับประกันว่าวัสดุที่นำมาส่งถูกรีไซเคิลสำเร็จจริง
- Payment, merchant settlement หรือ production discount จริง
- Production integration กับ BTS/MRT, supermarket, merchant หรือการดำเนินงานระดับประเทศ
- การขยายทั่วเอเชียตะวันออกเฉียงใต้และ production hardening ทั้งหมด

## 15. Roadmap

- ใช้ข้อมูลภาคสนาม calibrate และ validate bus heuristic, route corridor, stop geofence และ AI threshold
- ทบทวนขอบเขตการใช้ TGO factor และ proxy กับผู้เชี่ยวชาญ และกำหนด version governance อย่างเป็นทางการ
- ทำ pilot integration กับ BTS/MRT, ผู้รับรีไซเคิล, supermarket และร้านค้าที่เข้าร่วม
- วัด KPI ด้าน usability, engagement และ reward economics ใน pilot แล้วปรับ points conversion กับ reward catalog
- ทำ legal/privacy impact assessment และ production security review
- ประเมินการขยายในเอเชียตะวันออกเฉียงใต้หลังรูปแบบการดำเนินงานในประเทศไทยผ่านการพิสูจน์แล้ว

## 16. ความเสี่ยงหลักและการลดความเสี่ยง

- การจำแนกรถโดยสารผิด: ไม่ใช้ความเร็วเพียงอย่างเดียว แต่ใช้สี่ metric, pending state, duplicate fingerprint และ estimate disclaimer ร่วมกัน
- การแจ้งรีไซเคิลเกินจริง: Reviewer อนุมัติเฉพาะสิ่งที่เห็นและห้ามเพิ่มจำนวนจากที่ผู้ใช้แจ้ง
- ต้นไม้ซ้ำหรือกล่าวอ้างการอยู่รอดเกินจริง: ใช้ cross-account fingerprint และ proxy หนึ่งปีเพียงครั้งเดียว พร้อมห้าม survival claim
- การใช้ factor ผิด: pin source, version, effective date, unit และ assumptions และไม่แก้ ledger record ย้อนหลัง
- การใช้รางวัลซ้ำ: ใช้ atomic/idempotent state transition และ concurrency test
- การเก็บข้อมูลส่วนตัวนานเกินไป: ใช้ deletion job 30 วัน การลบทันทีเมื่อปิดบัญชี และ least-privilege access
- การสับสนระหว่าง demo กับผลจริง: ติดป้าย demo account และ fixture และตัดออกจาก real aggregate

## 17. ประเด็นที่ต้องตัดสินในแผนการพัฒนา

หัวข้อต่อไปนี้ไม่ใช่ความคลุมเครือของข้อกำหนดผลิตภัณฑ์ แต่เป็นทางเลือกในขั้นวางแผนการพัฒนา ทางเลือกใดก็ตามต้องไม่ทำให้เงื่อนไขด้าน verification, audit และ privacy ในเอกสารนี้อ่อนลง

- Technology stack สำหรับ frontend, backend, database และ hosting
- วิธีทำ authentication และ role-based access control
- Transit, AI, QR registry provider หรือรูปแบบ fixture
- ค่า factor ที่แน่นอนและกระบวนการอนุมัติสำหรับ bus และ recycling
- Versioned configuration เริ่มต้นของ route corridor, stop geofence และ AI threshold
- หน่วยงาน reviewer และ escalation SLA
- Reward catalog, รูปแบบ voucher token และ demo merchant UX
- วิธีทำ observability, deletion job และ audit export

## 18. แหล่งอ้างอิงและคำศัพท์

### 18.1 เอกสารฐาน

- T-VER-S-METH-03-01 — Modal Shift in Passenger Transportation
- T-VER-S-TOOL-01-01 — Calculation for Carbon Sequestration in Tree
- T-VER-S-METH-09-06 — Recovery and Recycling of Plastic from Solid Waste
- TGO project credit issuance process

เอกสารเหล่านี้เป็นจุดเริ่มต้นสำหรับตรวจสอบวิธีคำนวณและระดับการกล่าวอ้าง ค่าแต่ละค่าของ MVP ต้อง pin พร้อม source URL, methodology code/version, effective date และ unit เอกสารนี้ไม่อ้างการรับรองจาก TGO หรือการออก credit

### 18.2 คำศัพท์

- Claim: หน่วยหลักฐานและการประมวลผลสำหรับกิจกรรมสีเขียวหนึ่งครั้งของผู้ใช้
- Verified: สถานะที่ผ่านการตรวจและการตรวจซ้ำที่จำเป็นทั้งหมด
- Pending review: สถานะที่ยังไม่ให้ credit เพราะข้อมูล dependency confidence หรือ manual review ยังไม่เพียงพอ
- Estimated avoided CO2e: ค่าประมาณการปล่อยที่หลีกเลี่ยงเมื่อเทียบกับ baseline
- Projected sequestration CO2e: ค่าประมาณแบบ proxy ของการดูดซับในอนาคตหนึ่งปีของต้นไม้หนึ่งต้น
- Non-reversible fingerprint: ตัวระบุที่สกัดจากหลักฐานเพื่อใช้เทียบความซ้ำโดยไม่สามารถย้อนกลับเป็นหลักฐานต้นฉบับได้
- Voucher: สิทธิ์ส่วนลดแบบใช้ครั้งเดียว อายุ 7 วัน ซึ่งออกหลังหักคะแนน

รหัสการสัมภาษณ์ฐาน: 9b268646-d65a-439e-8129-7d48e7e83bdb
