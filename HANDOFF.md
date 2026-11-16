# คลังสมองและ handoff — GC-AutoCapture

เอกสารนี้บันทึกสถานะการทำงาน จุดวินิจฉัยปัญหา และวิธีแก้ที่ตรวจสอบย้อนกลับได้สำหรับ `GC-AutoCaputre.js` ใช้ [README.md](README.md) เป็นคู่มือพฤติกรรมปัจจุบัน และ [CHANGELOG.md](CHANGELOG.md) เป็นประวัติการเปลี่ยนแปลง การเปลี่ยนโค้ดหรือเอกสารใน working copy ยังไม่ถือว่าเป็นผลทดสอบ

## ภาพรวม state ปัจจุบัน

ชื่อในคอลัมน์ State เป็นชื่อใช้อ้างอิงใน handoff; ข้อความ `Current Step` และคำใน log ระบุแยกไว้ตามที่โค้ดใช้จริง

| State | จุดเข้า / หลักฐาน | สิ่งที่ต้องส่งต่อเมื่อหยุดหรือผิดพลาด |
| --- | --- | --- |
| S0 รอเลือกงาน | `showCaptureDialog()` แสดง Single/Batch; `Current Step: WAITING ...` แล้ว `รอเริ่มงาน` | โหมด, EPS ที่เปิดอยู่, source/destination ที่เลือก; การปิดหน้าต่างก่อน START ไม่มี log |
| S1 ค้นหาและเลือก EPS | Batch ใช้ `collectEpsFiles()` และ `getBatchFileSelection()`; UI แสดงจำนวนและ `[x]`/`[ ]` | path ต้นทาง, จำนวนที่พบ/เลือก, Select all หรือ Select range, START/END EPS, ข้อความ error หากชื่อซ้ำ/ไม่พบ/ลำดับกลับด้าน |
| S2 ตรวจปลายทาง | START ตรวจ source และ destination แล้ว `ensureOutputFolder()` | path ที่เลือกและ path `.AutoCapture` จริง; หากไม่ผ่าน UI แสดงข้อผิดพลาดและยังไม่สร้าง log |
| S3 เริ่มรอบและเปิด Job | `runSelection()` สร้าง log ใน `logs/sessions`; `RUN START`, `DISCOVERED`, `JOB START`, `BEFORE`/`AFTER` ของ `OPEN_EPS`; UI `Opening EPS...` | path log, โหมด, ลำดับ Job ในชุดที่เลือก, source EPS, เปิดอยู่เดิมหรือเปิดโดยสคริปต์ |
| S4 ตรวจข้อมูล Job | `getDocumentInfo()`, `executeJob()`, `findFrameContainer()`, `collectFrames()`, `prepareExports()`; UI `Filename Generating...`; log `JOB INFO`, `SKIPPED` | SKU/format/sequence, container กรอบ, จำนวน Frames/Planned/Skipped, เหตุผลและพิกัดของแต่ละกรอบที่ข้าม |
| S5 ส่งออกภาพ | `exportFrames()`; UI `Exporting .jpg n/total`; log `EXPORTED` หลัง `exportFile` สำเร็จ | Frame, Work, OID, bounds, path JPG, เวลาสำเร็จ, จำนวนที่ส่งออกแล้ว; JPG อยู่ในโฟลเดอร์ OID |
| S6 คืนสถานะและจบ Job | `finally` เรียก `restoreDocumentState()`; `JOB END` เป็น `SUCCESS`, `ALL_SKIPPED` หรือ `FAILED`; UI `Export Success !` เมื่อ `executeJob()` คืนผล | Artboard bounds/active index และ visibility ที่คืนได้หรือคืนไม่ได้, จำนวน Exported/Skipped/Not exported, การปิด EPS ที่สคริปต์เปิด |
| S7 จบรอบหรือผิดพลาด | log `RUN END` หรือ `ALERT ERROR`; UI `JOB DONE` หรือ `เกิดข้อผิดพลาด` | จำนวน Job ที่สำเร็จ/ผิดพลาด, path log, first error, ไฟล์ที่ส่งออกสำเร็จก่อนหน้า, เอกสารที่ active หลัง Batch |

Batch พยายามทำ Job ถัดไปหลังข้อผิดพลาดราย Job แต่หยุดเมื่อเขียน log ล้มเหลว ส่วนการยกเลิกก่อน START ไม่สร้าง log และไม่เริ่ม export การแสดง `JOB DONE` ใน UI คือจบรอบการประมวลผล จึงต้องอ่าน `JOB END`/`RUN END` และจำนวน error ใน log เพื่อสรุปผลจริง

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

### KB-006 — แยกภาพตาม DATE ของแต่ละ EPS

- วันที่ / สถานะ: 2026-11-11; แก้แล้วรอตรวจ
- State / หมวด: S4–S5; JPG และปลายทาง
- อาการและวิธีทำซ้ำ: Batch ที่มี `1112(M)` และ `1113(N)` เคยส่ง JPG ลงโฟลเดอร์ OID ใต้ output เดียวกัน ไม่มีโฟลเดอร์วันที่ของแต่ละไฟล์
- หลักฐานก่อนแก้: `exportFrames()` เดิมเรียก `ensureOrderFolder(folder, orderId)` โดย `folder` เป็น destination กลาง; `getDocumentInfo()` อ่าน DATE จากชื่อ EPS อยู่แล้ว
- สาเหตุที่ยืนยัน: ขั้นตอนสร้าง path JPG ไม่ได้นำ DATE มาใช้
- วิธีแก้: `executeJob()` ตรวจ DATE แบบ MMDD กับปีปัจจุบันของเครื่อง แล้ว `ensureDateFolder()` สร้าง `YYYY-MM-DD` ก่อนส่งต่อให้ `exportFrames()` แยก OID; DATE ขาดหรือผิดพลาดทำให้ Job นั้นล้มเหลวและบันทึก error
- ผลหลังแก้: ตรวจ source และ diff แล้ว; ยังไม่มีผลส่งออกจริง
- Validation: Not tested; ไม่ได้รันชุดทดสอบหรือ Illustrator ตามข้อกำหนด repository
- งานค้าง / วิธีตรวจต่อ: ส่งออก Batch สองวันที่และวันผิดรูปแบบในโฟลเดอร์ทดสอบแยก ตรวจ path JPG, log, การทำ Job ถัดไป และการคืนสถานะเอกสาร
- อ้างอิง: `CHANGELOG.md` Unreleased / Added

### KB-007 — เขียนทับ JPG เมื่อส่งออกชื่อซ้ำ

- วันที่ / สถานะ: 2026-11-12; แก้แล้วรอตรวจ
- State / หมวด: S5; JPG และปลายทาง
- อาการและวิธีทำซ้ำ: ส่งออก EPS เดิมไปปลายทางเดิมซ้ำ ได้ JPG ชื่อใหม่ต่อท้าย `_02`, `_03` แทนการแทนที่ไฟล์ชื่อเดิม
- หลักฐานก่อนแก้: `createOutputFile()` วนตรวจ `file.exists` แล้วเติมเลขท้าย; README ระบุการเติม `_02`, `_03` สำหรับ JPG
- สาเหตุที่ยืนยัน: ขั้นตอนสร้าง path JPG เลี่ยงชื่อที่มีอยู่ก่อนเรียก `doc.exportFile()`
- วิธีแก้: ให้ `createOutputFile()` คืน path ชื่อมาตรฐานเดิมเสมอ เพื่อให้ Illustrator ส่งออกทับ JPG ชื่อซ้ำ; การเปลี่ยน log ภายหลังบันทึกใน KB-008
- ผลหลังแก้: ตรวจ source และ diff แล้ว; ยังไม่มีผลส่งออกจริง
- Validation: Not tested; ไม่ได้รันชุดทดสอบหรือ Illustrator ตามข้อกำหนด repository
- งานค้าง / วิธีตรวจต่อ: ใช้ EPS ตัวอย่างและโฟลเดอร์ทดสอบแยก ส่งออกซ้ำ ตรวจ JPG path เดิมถูกเขียนทับ ไม่มี JPG `_02` ใหม่ และตรวจ log ตาม KB-008
- อ้างอิง: `CHANGELOG.md` Unreleased / Changed

### KB-008 — ย้าย session log และยกเลิกเลขท้าย

- วันที่ / สถานะ: 2026-11-12; แก้แล้วรอตรวจ
- State / หมวด: S3–S7; Log และการกู้ผล
- อาการและวิธีทำซ้ำ: log อยู่ที่โฟลเดอร์ผลลัพธ์โดยตรง เป็น `.txt` และชื่อซ้ำในวินาทีเดียวกันถูกเติม `_02`
- หลักฐานก่อนแก้: `createUniqueLogFile()` สร้าง path `.txt` และวนตรวจ `file.exists`; `createLog()` ส่ง output root ให้ helper นี้
- สาเหตุที่ยืนยัน: path และนามสกุล log ถูกกำหนดใน helper เดิม และมีลูปหลบชื่อซ้ำ
- วิธีแก้: `createLog()` สร้าง `logs/sessions` ใต้โฟลเดอร์ผลลัพธ์ เปิดไฟล์ `.log` แบบ `w` เมื่อเริ่มรอบ แล้วเขียนรายการถัดไปแบบ append; ชื่อชนในวินาทีเดียวกันเขียนทับ log เดิม
- ผลหลังแก้: ตรวจ source และ diff แล้ว; ยังไม่มีผลสร้างโฟลเดอร์หรือ log จริงใน Illustrator
- Validation: Not tested; ไม่ได้รันชุดทดสอบหรือ Illustrator ตามข้อกำหนด repository
- งานค้าง / วิธีตรวจต่อ: ตรวจ path, UTF-8, การเขียนทับ log ในวินาทีเดียวกัน และการหยุดเมื่อสร้างโฟลเดอร์หรือ log ไม่สำเร็จด้วยปลายทางทดสอบแยก
- อ้างอิง: `CHANGELOG.md` Unreleased / Changed

### KB-009 — อัปเดตสคริปต์จาก NAS ไปยัง Illustrator หลายปี

- วันที่ / สถานะ: 2026-11-14; เพิ่มตัวอัปเดตแล้วรอตรวจบนเครื่องจริง

- State / หมวด: ก่อน S0; การติดตั้งและอัปเดตสคริปต์

- อาการและวิธีทำซ้ำ: แต่ละเครื่องมีโฟลเดอร์ `Adobe Illustrator 20xx` ต่างปีกัน จึงต้องคัดลอก `GC-AutoCaputre.js` จาก NAS ไปยัง `Presets\en_US\Scripts` ด้วยมือ

- หลักฐานก่อนแก้: ผู้ใช้ระบุ source `G:\004 Program\illustrator-Stuff\Auto Capture\GC-AutoCaputre.js` และปลายทางที่ปีเปลี่ยนตามเครื่อง; repository เดิมไม่มี updater

- วิธีแก้: เพิ่ม `updater/Update-Illustrator-Script.bat` ให้ตรวจ source, ค้นหา Illustrator 20xx ทุกโฟลเดอร์ใต้ `%ProgramFiles%\Adobe`, คัดลอกไฟล์ไปยังแต่ละ `en_US\Scripts` และสรุปผลสำเร็จ/ล้มเหลว ไม่สร้าง preset ภาษาอื่นโดยเดา

- ผลหลังแก้: ตรวจเนื้อหา `.bat` และ diff แล้ว; ยังไม่มีผลคัดลอกจาก NAS หรือเปิด Illustrator จริง

- Validation: Not tested; ไม่ได้เรียกไฟล์ `.bat` หรือชุดทดสอบตามข้อกำหนด repository

- งานค้าง / วิธีตรวจต่อ: รันบนเครื่องที่เชื่อม `G:` ใน Command Prompt แบบ Administrator หลังปิด Illustrator ตรวจทุกปลายทางที่ติดตั้ง และเปิด Illustrator ใหม่เพื่อดูเมนู File > Scripts; หาก elevated session ไม่เห็น `G:` ให้ใช้ UNC path ที่เข้าถึงได้

- อ้างอิง: `CHANGELOG.md` Unreleased / Added

### KB-010 — ระบุสาเหตุเมื่อตัวอัปเดตล้มเหลว

- วันที่ / สถานะ: 2026-11-14; ปรับข้อความวินิจฉัยแล้วรอตรวจบนเครื่องจริง
- State / หมวด: ก่อน S0; การติดตั้งและอัปเดตสคริปต์
- อาการและหลักฐานก่อนแก้: ผู้ใช้ต้องการทราบเหตุผลที่ fail; ตัวอัปเดตเดิมซ่อนผล `mkdir` และ `copy` ด้วยการส่ง output ไป `nul` และรายงานเพียงว่าไม่พบ source หรือคัดลอกไม่สำเร็จ
- วิธีแก้: แยกข้อความเมื่อ `G:` ใช้ไม่ได้, โฟลเดอร์/ไฟล์ต้นทางหาย, Adobe หรือ `en_US` ไม่พบ และแสดงข้อความของ Windows จาก `mkdir`/`copy` โดยตรงก่อนบรรทัด `[ERROR]`
- ผลหลังแก้ / Validation: Not tested; ตรวจเนื้อหาและ diff เท่านั้น ยังไม่ได้เรียก `.bat`
- งานค้าง / วิธีตรวจต่อ: ลองแต่ละกรณีบนเครื่องทดสอบ รวมกรณีเปิดด้วย Administrator แล้วไม่เห็น `G:`, สิทธิ์เขียนไม่พอ และ NAS หลุดระหว่างคัดลอก
- อ้างอิง: `CHANGELOG.md` Unreleased / Changed

### KB-011 — ไล่ขั้นตอนส่งออกจาก session log

- วันที่ / สถานะ: 2026-11-14; เพิ่มจุดบันทึกแล้วรอตรวจใน Illustrator
- State / หมวด: S3–S7; Log และการกู้ผล, Name/OID, JPG และสถานะ Illustrator
- หลักฐานก่อนแก้: log ตัวอย่าง `MASTER_20261114_085853.log` แสดง `BEFORE | READ_XML_FILE` ตามด้วย `RUN ERROR` จึงเห็นจุดล้มเหลว; log ของสคริปต์นี้เดิมบันทึก `JOB INFO`, `EXPORTED`, `SKIPPED` และ `ERROR` แต่ไม่มี `BEFORE`/`AFTER` รอบขั้นตอนสำคัญ และชื่อ log ในวินาทีเดียวกันถูกเขียนทับ
- วิธีแก้: ใน `GC-AutoCapture.js` เพิ่มเวลาแบบมิลลิวินาที, `BEFORE`/`AFTER` พร้อมระยะเวลาและ Job/Step, `MATCH` รายกรอบ, การบันทึกผลคืนสถานะ และเลขท้ายชื่อ log เมื่อซ้ำ; เก็บเหตุการณ์หนึ่งบรรทัดเพื่อค้นย้อนหลัง
- ผลหลังแก้ / Validation: Not tested; ตรวจเนื้อหาและ diff เท่านั้น ยังไม่มี log จาก Illustrator หลังแก้
- งานค้าง / วิธีตรวจต่อ: ทดสอบด้วยสำเนา EPS และปลายทางแยกเมื่อผู้ใช้สั่ง ตรวจ Job สำเร็จ, กรอบที่ข้าม, เปิด EPS/ส่งออก/คืนสถานะผิดพลาด, log เขียนไม่ได้ และการเริ่มสองรอบในวินาทีเดียวกัน
- อ้างอิง: `CHANGELOG.md` Unreleased / Added

### KB-012 — แยก Job ใน session log

- วันที่ / สถานะ: 2026-11-14; ปรับรูปแบบ log แล้วรอตรวจใน Illustrator
- State / หมวด: S3–S7; Log และการกู้ผล
- หลักฐานก่อนแก้: หลังเปลี่ยนเหตุการณ์ log เป็นหนึ่งบรรทัด `JOB END` กับ `JOB START` ถัดไปอยู่ติดกัน ทำให้แยกขอบเขต Job ด้วยสายตายาก
- วิธีแก้: `appendLog()` รับจำนวนบรรทัดว่าง และ `runSelectionWithLog()` เว้นสองบรรทัดก่อน `JOB START` ตั้งแต่ Job ที่สอง โดยยังเขียนและปิด log ในรอบเดียว
- ผลหลังแก้ / Validation: Not tested; ตรวจเนื้อหาและ diff เท่านั้น ยังไม่มี log ที่รันจาก Illustrator หลังแก้
- งานค้าง / วิธีตรวจต่อ: เมื่อผู้ใช้สั่งทดสอบ ให้รัน Batch หลาย Job แล้วตรวจช่องว่างก่อน Job ที่สองและถัดไป รวมกรณี Job แรกผิดพลาด
- อ้างอิง: `CHANGELOG.md` Unreleased / Changed

### KB-013 — ไม่มี pattern DATE ในชื่อ EPS

- วันที่ / สถานะ: 2026-11-16; แก้แล้วรอตรวจใน Illustrator
- State / หมวด: S4–S5; ชื่อไฟล์และ SKU, JPG และปลายทาง, Log และการกู้ผล
- อาการและวิธีทำซ้ำ: เปิด EPS ที่มี SKU แต่ไม่มี DATE ต้นชื่อ เช่น `N012-03-01.eps`; Job เดิมหยุดก่อนส่งออก
- หลักฐานก่อนแก้: `getDocumentInfo()` คืน DATE ว่าง และ `getJobDateFolderName()` โยนข้อผิดพลาดก่อน `JOB INFO`
- วิธีแก้: เก็บสถานะว่าพบ pattern DATE หรือไม่; เมื่อไม่พบให้แสดง DATE `0000`, ส่ง JPG ไปยัง `0000/OID` และบันทึก `WARNING` ว่าไม่พบ pattern วันที่ ส่วน DATE ที่ตรง pattern แต่เป็นวันที่ไม่จริงยังคงเป็นข้อผิดพลาด
- ผลหลังแก้ / Validation: Not tested; ตรวจ source และ diff เท่านั้น ไม่มีชุดทดสอบใน working tree และยังไม่ได้ส่งออกใน Illustrator
- งานค้าง / วิธีตรวจต่อ: ใช้สำเนา EPS ที่ไม่มี DATE และมี DATE ไม่จริงกับโฟลเดอร์ทดสอบแยก ตรวจค่าใน UI, path JPG, ข้อความ `WARNING`/`ERROR` ใน log และผล Batch ถัดไป
- อ้างอิง: `CHANGELOG.md` Unreleased / Fixed

### KB-014 — เติมเดือนและวันปัจจุบันในโฟลเดอร์สำรอง

- วันที่ / สถานะ: 2026-11-16; แก้แล้วรอตรวจใน Illustrator
- State / หมวด: S4–S5; JPG และปลายทาง, Log และการกู้ผล
- หลักฐานก่อนแก้: KB-013 ใช้ `getJobDateFolderName()` คืน `0000` เมื่อไม่พบ pattern DATE จึงไม่มีเดือนและวันในชื่อโฟลเดอร์
- วิธีแก้: คืน `0000-MM-DD` โดยอ่านเดือนและวันจากเวลาเครื่องขณะเริ่ม Job; ใช้วันเดียวกันใน path JPG และข้อความ `WARNING` ของ log ค่า DATE ใน UI ยังคงเป็น `0000`
- ผลหลังแก้ / Validation: Not tested; ตรวจ source และ diff เท่านั้น ยังไม่ได้ส่งออกใน Illustrator
- งานค้าง / วิธีตรวจต่อ: ส่งออก EPS ที่ไม่มี DATE ในโฟลเดอร์ทดสอบ ตรวจชื่อโฟลเดอร์และ `WARNING` เทียบกับวันปัจจุบันของเครื่อง รวมกรณีข้ามเที่ยงคืนระหว่าง Job
- อ้างอิง: KB-013 และ `CHANGELOG.md` Unreleased / Fixed

### KB-015 — อ่าน OID จาก Group ใน Name เมื่อไม่มี OID container

- วันที่ / สถานะ: 2026-11-16; แก้แล้วรอตรวจใน Illustrator
- State / หมวด: S4; Name/OID และการจับคู่กรอบ
- หลักฐานก่อนแก้: `prepareExports()` ข้ามทุกกรอบทันทีเมื่อไม่พบ Layer `OID` และไม่ค้น Group `OID` หรือ Type ภายใน Group `N[ตัวเลข]` ของ Layer `Name`
- วิธีแก้: รองรับ Group `OID` เป็นแหล่งหลัก และเมื่อไม่มีทั้ง Layer/Group `OID` ให้หา Type ใน Group `N[ตัวเลข]` ที่อยู่ในกรอบเดียวกัน เลือก `N[เลข]-OID`/`N[เลข]_OID` ก่อน Type รหัสผสม 14–18 ตัว; กรณีขาด ผิดรูป หรือกำกวมบันทึกเหตุผลที่ข้าม
- ผลหลังแก้ / Validation: Not tested; ตรวจ source และ diff เท่านั้น ยังไม่ได้รันใน Illustrator
- งานค้าง / วิธีตรวจต่อ: ใช้ EPS สำเนาและโฟลเดอร์แยกตรวจทั้งสองรูปแบบ, กรอบซ้อน, หลาย candidate, ค่า OID ว่าง และ Group `OID` ที่มีอยู่จริง
- อ้างอิง: `CHANGELOG.md` Unreleased / Added

## งานค้างและจุดตรวจรอบถัดไป


- ตัวอัปเดต NAS ใน KB-009 ยังต้องตรวจบนเครื่องที่มี `G:` และ Illustrator จริง โดยปิด Illustrator ก่อน แล้วตรวจไฟล์ปลายทางและเมนูหลังเปิดใหม่

- ScriptUI Batch, รายการ EPS ที่คัดลอกได้, ช่วง START/END, จำนวนที่เลือก และข้อความ Current Step ยังไม่มีผลทดสอบ Illustrator สำหรับการแก้ไขล่าสุดใน working copy
- การแก้ `SKU: undefined`, OID placeholder, เกณฑ์กรอบ และภาพ JPG หลังการเปลี่ยนแปลงล่าสุดยังต้องตรวจด้วย EPS ตัวอย่างและโฟลเดอร์ทดสอบแยก เมื่อผู้ใช้สั่งให้ทดสอบ
- การเขียนทับ JPG ชื่อซ้ำตาม KB-007 ยังต้องตรวจใน Illustrator ด้วยปลายทางทดสอบแยก เมื่อผู้ใช้สั่งให้ทดสอบ
- session log ใน `logs/sessions` ตาม KB-008 ยังต้องตรวจใน Illustrator เมื่อผู้ใช้สั่งให้ทดสอบ
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
