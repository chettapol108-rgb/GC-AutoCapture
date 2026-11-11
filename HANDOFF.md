# คลังสมองและ handoff — GC-AutoCapture

เอกสารนี้บันทึกสถานะการทำงาน จุดวินิจฉัยปัญหา และวิธีแก้ที่ตรวจสอบย้อนกลับได้สำหรับ `GC-AutoCaputre.js` ใช้ [README.md](README.md) เป็นคู่มือพฤติกรรมปัจจุบัน และ [CHANGELOG.md](CHANGELOG.md) เป็นประวัติการเปลี่ยนแปลง การเปลี่ยนโค้ดหรือเอกสารใน working copy ยังไม่ถือว่าเป็นผลทดสอบ

## ภาพรวม state ปัจจุบัน

ชื่อในคอลัมน์ State เป็นชื่อใช้อ้างอิงใน handoff; ข้อความ `Current Step` และคำใน log ระบุแยกไว้ตามที่โค้ดใช้จริง

| State | จุดเข้า / หลักฐาน | สิ่งที่ต้องส่งต่อเมื่อหยุดหรือผิดพลาด |
| --- | --- | --- |
| S0 รอเลือกงาน | `showCaptureDialog()` แสดง Single/Batch; `Current Step: WAITING ...` แล้ว `รอเริ่มงาน` | โหมด, EPS ที่เปิดอยู่, source/destination ที่เลือก; การปิดหน้าต่างก่อน START ไม่มี log |
| S1 ค้นหาและเลือก EPS | Batch ใช้ `collectEpsFiles()` และ `getBatchFileSelection()`; UI แสดงจำนวนและ `[x]`/`[ ]` | path ต้นทาง, จำนวนที่พบ/เลือก, Select all หรือ Select range, START/END EPS, ข้อความ error หากชื่อซ้ำ/ไม่พบ/ลำดับกลับด้าน |
| S2 ตรวจปลายทาง | START ตรวจ source และ destination แล้ว `ensureOutputFolder()` | path ที่เลือกและ path `.AutoCapture` จริง; หากไม่ผ่าน UI แสดงข้อผิดพลาดและยังไม่สร้าง log |
| S3 เริ่มรอบและเปิด Job | `runSelection()` สร้าง log; `START`, `DISCOVERED`, `JOB START`; UI `Opening EPS...` | path log, โหมด, ลำดับ Job ในชุดที่เลือก, source EPS, เปิดอยู่เดิมหรือเปิดโดยสคริปต์ |
| S4 ตรวจข้อมูล Job | `getDocumentInfo()`, `executeJob()`, `findFrameContainer()`, `collectFrames()`, `prepareExports()`; UI `Filename Generating...`; log `JOB INFO`, `SKIPPED` | SKU/format/sequence, container กรอบ, จำนวน Frames/Planned/Skipped, เหตุผลและพิกัดของแต่ละกรอบที่ข้าม |
| S5 ส่งออกภาพ | `exportFrames()`; UI `Exporting .jpg n/total`; log `EXPORTED` หลัง `exportFile` สำเร็จ | Frame, Work, OID, bounds, path JPG, เวลาสำเร็จ, จำนวนที่ส่งออกแล้ว; JPG อยู่ในโฟลเดอร์ OID |
| S6 คืนสถานะและจบ Job | `finally` เรียก `restoreDocumentState()`; `JOB END` เป็น `SUCCESS`, `ALL_SKIPPED` หรือ `FAILED`; UI `Export Success !` เมื่อ `executeJob()` คืนผล | Artboard bounds/active index และ visibility ที่คืนได้หรือคืนไม่ได้, จำนวน Exported/Skipped/Not exported, การปิด EPS ที่สคริปต์เปิด |
| S7 จบรอบหรือผิดพลาด | log `END` หรือ `ALERT ERROR`; UI `JOB DONE` หรือ `เกิดข้อผิดพลาด` | จำนวน Job ที่สำเร็จ/ผิดพลาด, path log, first error, ไฟล์ที่ส่งออกสำเร็จก่อนหน้า, เอกสารที่ active หลัง Batch |

Batch พยายามทำ Job ถัดไปหลังข้อผิดพลาดราย Job แต่หยุดเมื่อเขียน log ล้มเหลว ส่วนการยกเลิกก่อน START ไม่สร้าง log และไม่เริ่ม export การแสดง `JOB DONE` ใน UI คือจบรอบการประมวลผล จึงต้องอ่าน `JOB END`/`END` และจำนวน error ใน log เพื่อสรุปผลจริง

## หมวดปัญหาและจุดตรวจ

| หมวด | อาการ / หลักฐานที่ควรเก็บ | จุดตรวจและแนวแก้ |
| --- | --- | --- |
| UI และการเลือกคิว | ปุ่ม/รายการ EPS ผิด, จำนวนที่เลือกไม่ตรง, START/END หาไม่พบ | S0–S2; ตรวจโหมด, path, ชื่อซ้ำข้าม subfolder, ลำดับ path; ดู `showCaptureDialog()`, `getBatchFileSelection()` |
| ชื่อไฟล์และ SKU | `SKU: undefined`, ไม่พบ SKU, JPG ชื่อผิด | S4; เก็บชื่อ EPS เต็มและ `JOB INFO`; ดู `getSku()`, `getDocumentInfo()`, `parseSkuForLog()`, `createOutputFile()` |
| กรอบและลำดับ | ไม่พบกรอบ, กรอบเล็กถูกนับ, เลขท้ายไม่ตรง | S4; เก็บชื่อ container, height, bounds และลำดับ `Frame`; ดู `findFrameContainer()`, `collectFrames()` และเกณฑ์ `minFrameHeightCm` |
| Name/OID และฟอนต์ | `SKIPPED`, `EmptyOID`, กรอบซ้อน, barcode font ผิด | S4; เก็บชื่อ/contents/ชนิดวัตถุ, bounds ของ marker และ OID, เหตุผล `SKIPPED`; ดู `prepareExports()` |
| JPG และปลายทาง | export ล้มเหลว, path ผิด, ชื่อซ้ำ | S2/S5; เก็บ destination, OID, output path, DPI/quality, กรอบที่ล้มเหลว; ดู `ensureOutputFolder()`, `createOutputFile()`, `exportFrames()` |
| Log และการกู้ผล | log สร้าง/เขียนไม่ได้, สรุปไม่ตรง, งานหยุดกลางคิว | S3–S7; เก็บ log เต็มและภาพสุดท้ายที่มี `EXPORTED`; ดู `createLog()`, `appendLog()`, `runSelectionWithLog()` |
| สถานะ Illustrator | Artboard/visibility ไม่คืน, EPS ปิดไม่สำเร็จ | S5–S7; เก็บค่าก่อน/หลัง, error ทั้ง export และ restore; ดู `restoreDocumentState()` และ `finally` ในคิว |

## บันทึกวิธีแก้ที่มีหลักฐาน

รายการนี้สรุปจาก `CHANGELOG.md` ใน working copy วันที่ 2026-11-10 สถานะ validation ของแต่ละกรณีเป็นผลที่บันทึกไว้ใน changelog ณ เวลานั้น ไม่ใช่ผลทดสอบของเอกสารนี้

| ID / State | ปัญหา | วิธีแก้ที่บันทึกไว้ | สถานะหลักฐาน |
| --- | --- | --- | --- |
| KB-001 / S1 | คำสั่ง ScriptUI สำหรับ Batch เสียรูป และการเลือกช่วงไม่ตรงคู่มือ | ซ่อมคำสั่ง UI; ค่าเริ่มต้น Select all, Select some เปิดช่วง, รายชื่อ EPS เลือกข้อความได้ | `CHANGELOG.md` Fixed 2026-11-10: Not tested; รอตรวจ ScriptUI ใน Illustrator |
| KB-002 / S4 | `JOB INFO` แสดง `SKU: undefined` สำหรับ `1106(M)-SP-N012-03-01.eps` | อ่าน SKU 4 ตัวจาก identifier ที่ตรวจแล้ว | `CHANGELOG.md` Fixed 2026-11-09: มี log ของอาการเดิม; การรันซ้ำใน Illustrator ยังรออยู่ |
| KB-003 / S4 | OID ว่างหนึ่งรายการทำให้จับคู่กรอบที่มี OID จริงไม่ได้ | เลือก OID ที่มีค่าเพียงหนึ่งรายการก่อน placeholder ว่าง; คง `EmptyOID` เมื่อมีแต่ OID ว่างหนึ่งรายการ | `CHANGELOG.md` Fixed 2026-11-06: Not tested; ยังรอตรวจ export จริง |
| KB-004 / S4 | Rectangle เตี้ยไม่ควรกินลำดับกรอบ | กรอง PathItem เส้นปิด 4 จุดที่สูงกว่า `minFrameHeightCm` ก่อนเรียงและกำหนดเลข | `CHANGELOG.md` Fixed 2026-11-06: Not tested; ยังรอตรวจ Illustrator |
| KB-005 / S5–S6 | Artboard ที่ active อาจไม่ตรงกับกรอบส่งออก และการคืนค่าบางส่วนอาจล้มเหลว | เลือก Artboard ที่ปรับขอบก่อน export; คืน bounds, visibility และ active index แยกกัน พร้อมรวม error | `CHANGELOG.md` Fixed: ไม่มีผลตรวจใหม่เฉพาะรายการนี้ใน working copy; ต้องยืนยันใน Illustrator |

## งานค้างและจุดตรวจรอบถัดไป

- ScriptUI Batch, รายการ EPS ที่คัดลอกได้, ช่วง START/END, จำนวนที่เลือก และข้อความ Current Step ยังไม่มีผลทดสอบ Illustrator สำหรับการแก้ไขล่าสุดใน working copy
- การแก้ `SKU: undefined`, OID placeholder, เกณฑ์กรอบ และภาพ JPG หลังการเปลี่ยนแปลงล่าสุดยังต้องตรวจด้วย EPS ตัวอย่างและโฟลเดอร์ทดสอบแยก เมื่อผู้ใช้สั่งให้ทดสอบ
- หากพบปัญหาใหม่ ให้บันทึกอาการกับหลักฐานก่อนแก้ และเพิ่มผลตรวจจริงหลังแก้ ห้ามเปลี่ยนสถานะจาก “รอตรวจ” เป็น “ผ่าน” โดยอาศัยผลทดสอบเก่า

## แบบฟอร์ม handoff ทุกครั้งที่แก้ปัญหา

เพิ่มแถวในหมวดปัญหาเมื่อพบรูปแบบใหม่ แล้วเพิ่มรายการใหม่ท้ายหัวข้อนี้โดยไม่ลบประวัติเดิม ใช้หนึ่งรายการต่อหนึ่งอาการ/วิธีแก้ หากอาการเดิมกลับมาให้เพิ่มรายการใหม่และอ้าง ID เดิม

```markdown
### KB-XXX — [ชื่ออาการสั้น ๆ]

- วันที่ / สถานะ: YYYY-MM-DD; พบ / กำลังแก้ / แก้แล้วรอตรวจ / ยืนยันแล้ว
- State / หมวด: Sx; [หมวดจากตาราง]
- อาการและวิธีทำซ้ำ: [EPS, โหมด, การตั้งค่า, ขั้นตอน, ข้อความ UI/log]
- หลักฐานก่อนแก้: [บรรทัด log, path หรือภาพตัวอย่างที่ตรวจได้; ไม่ใส่ข้อมูลส่วนตัวลง repo]
- สาเหตุที่ยืนยัน: [ข้อเท็จจริงจากโค้ดหรือการทดสอบ; ถ้ายังไม่ยืนยันให้เขียนว่า “สมมติฐาน”]
- วิธีแก้: [ไฟล์/function และเหตุผล]
- ผลหลังแก้: [ผลที่สังเกตจริง, จำนวน exported/skipped/failed, path log]
- Validation: [คำสั่ง/Illustrator รุ่น/ไฟล์ตัวอย่างและผล หรือ Not tested]
- งานค้าง / วิธีตรวจต่อ: [รายการเฉพาะที่ยังต้องพิสูจน์]
- อ้างอิง: [CHANGELOG, issue, commit/PR เฉพาะที่มีจริง]
```

เมื่อส่งต่องาน ระบุ state ล่าสุดของแต่ละ Job ที่ค้าง, ID ปัญหา, สิ่งที่เปลี่ยน, ผลตรวจจริง และขั้นตอนถัดไปในคำตอบหรือ PR จากนั้นอัปเดต `CHANGELOG.md` สำหรับการเปลี่ยนแปลงที่มีนัยสำคัญตามรูปแบบของทีม
