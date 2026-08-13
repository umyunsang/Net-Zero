# Privacy-Preserving Deduplication Gate

การพัฒนา fingerprint-dependent schema และ bus/tree flows ต้องหยุดหาก design นี้ไม่ผ่าน reconstruction-resistance และ decision-fixture tests

## Bus trip

- Normalize GPS samples ด้วยช่วงเวลา claim, timestamp และ stable sample ID ตามกฎ slot ของ domain
- ใช้ domain-separated HMAC tokens จาก coarse time/route/trace features เพื่อ candidate retrieval; ไม่เก็บ raw coordinates ใน fingerprint row
- Candidate ที่เป็นผู้ใช้เดียวกัน ช่วงเวลาทับซ้อน และ normalized trace similarity อย่างน้อย 80% เป็น duplicate
- เก็บ algorithm/config version, HMAC key ID และ non-reversible digest; ไม่เก็บ key material ในฐานข้อมูล
- Rotation สร้าง tokens ด้วย active key และค้นด้วย active + retiring key; historical key loss ทำให้ claim เป็น `pending` แทนการเดาผล

## Tree

- Candidate retrieval ใช้ keyed coarse spatial bucket โดยไม่เก็บ exact GPS หลัง raw purge
- เก็บ protected visual-signature tokens ที่ผ่าน reconstruction-resistance test ไม่เก็บภาพหรือ reversible embedding
- ระยะจริงไม่เกิน 5 เมตรและ visual similarity อย่างน้อย 90% เป็น duplicate/rejected
- ตรงเพียง location หรือ visual signal เป็น `pending_review`
- ทำงานข้ามทุกบัญชี แต่ reviewer ไม่เห็นเจ้าของ claim อื่น

## Raw purge and access

- Raw GPS/ภาพเก็บ 30 วันหลัง decision แล้วลบอัตโนมัติ
- Account deletion ลบ raw evidence ก่อนรายงาน success
- คงได้เฉพาะ non-reversible fingerprint, algorithm/key ID, decision/audit metadata และ anonymized ledger
- ทุก read/write ผ่าน authenticated proxy; ห้ามออก presigned capability ที่ยังใช้ได้หลัง deletion

## Gate tests

1. Same input ก่อนและหลัง raw purge ให้ duplicate decision เดิม
2. Boundary 80%, 5 m และ 90% เป็น inclusive ตามสเปก
3. Retained rows ไม่สามารถสร้าง trace, exact location หรือภาพที่ระบุตัวได้
4. Key rotation ไม่ทำให้เครดิตซ้ำ และไม่มี fallback เป็น verified
5. Account deletion พร้อม upload/read race ไม่เหลือ raw object หรือ active capability
