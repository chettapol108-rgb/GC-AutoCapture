# คลังสมองและ handoff — GC-AutoCapture

## เพิ่มกฎกรอบ 001 จาก N1-OID (2026-11-23)

- **State/หมวด:** S4 ตรวจข้อมูล Job; การจับคู่ Name marker และ OID
- **หลักฐานก่อนแก้:** `prepareExports()` ยอมรับ Type `N1-OID` เป็น Name marker อยู่แล้ว แต่เมื่อมี Layer/Group `OID` แยก จะยังต้องหา OID จากที่นั้น จึงไม่สามารถใช้ค่าใน `N1-OID` แทนได้
- **วิธีแก้:** หากกรอบ 001 ไม่มี Type ชื่อลงท้าย `-BC`/`_BC` ให้ตรวจ Type `N1-OID`/`N1_OID` ใน Layer `Name`/`NAME` ที่มีจุดกึ่งกลางในกรอบ ใช้ `contents` เมื่อเป็น OID ที่ถูกต้อง และข้ามพร้อมเหตุผลเมื่อซ้ำ อยู่ในกรอบซ้อน หรือค่าไม่ถูกต้อง
- **ผลตรวจจริง:** Not tested; ตรวจเฉพาะ source และ diff ยังไม่ได้รันชุดทดสอบหรือส่งออกผ่าน Illustrator
- **งานค้าง:** ลองไฟล์สำเนาจริงทั้งกรณีมี/ไม่มี Layer `OID`, ค่า OID ว่าง/ผิดรูปแบบ, ชื่อซ้ำ และกรอบซ้อน เพื่อตรวจภาพกับ log

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
| S5 ส่งออกภาพ | `exportFrames()` และ `exportMixedGroups()`; UI `Exporting .jpg n/total` หรือ `Exporting mixed .png n/total`; log `EXPORTED`, `MIXED`, `MOVED` หลังแต่ละขั้นสำเร็จ | Frame, Work, OID, bounds, path JPG/PNG, ช่วงกรอบ, path JPG หลังย้าย; ไฟล์อยู่ใต้โฟลเดอร์ `YYYYMMDD/OID` |
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

### KB-016 — ยกเลิกโฟลเดอร์วันที่ของ JPG

- วันที่ / สถานะ: 2026-11-17; แก้แล้วรอตรวจใน Illustrator
- State / หมวด: S4–S5; JPG และปลายทาง
- อาการและวิธีทำซ้ำ: ส่งออก EPS แล้ว JPG อยู่ใต้ `YYYY-MM-DD/OID` หรือ `0000-MM-DD/OID` แทนที่จะอยู่ใต้ OID ของ output folder โดยตรง
- หลักฐานก่อนแก้: `executeJob()` เรียก `getJobDateFolderName()` และ `ensureDateFolder()` แล้วส่ง date folder ให้ `exportFrames()` ซึ่งสร้าง OID folder ต่อจาก path นั้น
- สาเหตุที่ยืนยันจากโค้ด: date folder ถูกแทรกเป็น parent ของ OID folder ก่อนส่งออกทุก Job ที่มีภาพ
- วิธีแก้: `executeJob()` ส่ง output folder ให้ `exportFrames()` โดยตรงและยังเรียก `validateJobDate()` เพื่อรักษาการตรวจ DATE; คำเตือนเมื่อไม่พบ DATE ไม่ระบุโฟลเดอร์วันที่อีกต่อไป
- ผลหลังแก้ / Validation: Not tested; ตรวจ source และ diff เท่านั้น ยังไม่ได้รันชุดทดสอบหรือส่งออกใน Illustrator
- งานค้าง / วิธีตรวจต่อ: ใช้ EPS สำเนาที่มี DATE ต่างกัน ไม่มี DATE และมี DATE ไม่จริงกับปลายทางทดสอบแยก ตรวจ JPG ใต้ `<output>/<OID>/`, ไม่มีโฟลเดอร์วันที่ใหม่, ข้อความ log และการทำ Batch ต่อเมื่อ DATE ไม่จริง
- อ้างอิง: `CHANGELOG.md` Unreleased / Changed; ย้อนการจัด path ใน KB-006, KB-013 และ KB-014 โดยคงการตรวจ DATE

### KB-017 — รวมกรอบ OID เดียวกันเป็น PNG

- วันที่ / สถานะ: 2026-11-17; แก้แล้วรอตรวจใน Illustrator
- State / หมวด: S5–S6; JPG และปลายทาง, Log และการกู้ผล, สถานะ Illustrator
- หลักฐานก่อนแก้: `exportFrames()` ส่งออก JPG ทีละกรอบใต้ `<output>/<OID>/` และไม่มีขั้นตอนรวมภาพหรือย้าย JPG; `prepareExports()` ให้เลขกรอบและ OID ที่ผ่านการจับคู่แล้ว
- วิธีแก้: หลังส่งออกและคืนสถานะเอกสาร ให้หา run ที่เลขกรอบต่อเนื่องและ OID เดียวกันอย่างน้อยสองกรอบ สร้างเอกสาร Illustrator ชั่วคราวเพื่อวาง JPG ชิดกันตามลำดับ ส่งออก PNG24 ที่สเกล DPI เดิม ปิดเอกสารชั่วคราวและกลับไปเอกสารต้นทาง แล้วคัดลอกและลบ JPG ต้นทางเพื่อย้ายเข้า `Individual Image` หลัง PNG สำเร็จ ใช้ `Mixed-01`, `Mixed-02` เมื่อ OID เดียวกันมีหลาย run
- ผลหลังแก้ / Validation: Not tested; ตรวจโค้ดและ diff เท่านั้น ไม่ได้รันชุดทดสอบหรือส่งออกจริง และ `tests/` ไม่อยู่ใน working tree
- งานค้าง / วิธีตรวจต่อ: ใช้ EPS สำเนาและ output แยก ตรวจคู่ 005–006, กลุ่มสามกรอบ, OID เดิมสอง run, กรอบข้าม, `EmptyOID`, ความสูงต่างกัน, ขนาดพิกเซลและรอยต่อ PNG, การย้าย JPG, การรันซ้ำ, log และการกลับไปเอกสารเดิมหลัง PNG หรือการย้ายผิดพลาด
- อ้างอิง: `CHANGELOG.md` Unreleased / Added

### KB-018 — ตั้งชื่อและเวอร์ชันหน้าต่าง ScriptUI

- วันที่ / สถานะ: 2026-11-17; แก้แล้วรอตรวจใน Illustrator
- State / หมวด: S0; UI และการเลือกคิว
- หลักฐานก่อนแก้: `showCaptureDialog()` กำหนด `AutoCapture v1.0.3` ตรงในคำสั่งสร้าง `Window` จึงต้องแก้ในส่วน UI ทุกครั้งที่เปลี่ยนชื่อหรือเวอร์ชัน
- วิธีแก้: เพิ่ม `CONFIG.uiTitle` และ `CONFIG.uiVersion` ที่ต้น `GC-AutoCapture.js`; นำสองค่ามาประกอบเป็น `<title> v<version>` เมื่อสร้างหน้าต่าง
- ผลหลังแก้ / Validation: Not tested; ตรวจ source และ diff เท่านั้น ยังไม่ได้เปิด ScriptUI ใน Illustrator
- งานค้าง / วิธีตรวจต่อ: เปิดสคริปต์ใน Illustrator แล้วตรวจชื่อหน้าต่างด้วยค่าเริ่มต้นและหลังแก้สองค่าใน CONFIG
- อ้างอิง: `CHANGELOG.md` Unreleased / Changed

### KB-019 — เพิ่ม DATE หน้าชื่อไฟล์ภาพส่งออก

- วันที่ / สถานะ: 2026-11-17; แก้แล้วรอตรวจใน Illustrator
- State / หมวด: S4–S5; ชื่อไฟล์และ SKU, JPG และปลายทาง
- อาการและหลักฐานก่อนแก้: `getDocumentInfo()` อ่าน DATE จากชื่อ EPS แล้ว แต่ `createOutputFile()` และ `exportMixedGroups()` ประกอบชื่อ JPG/PNG โดยเริ่มจาก SKU จึงไม่มี DATE ในชื่อภาพ
- วิธีแก้: ส่ง `info.date` ผ่าน `exportFrames()` ไปยังจุดสร้างชื่อ JPG และ PNG ภาพรวม แล้วนำ DATE ไว้หน้าสุด; เมื่อไม่มี pattern ใช้ค่า `0000` ที่ parser กำหนดอยู่แล้ว
- ผลหลังแก้ / Validation: Not tested; ตรวจ source และ diff เท่านั้น ยังไม่มีไฟล์ภาพจาก Illustrator หลังแก้
- งานค้าง / วิธีตรวจต่อ: ส่งออก EPS สำเนาที่มี DATE พร้อมรหัสกะและที่ไม่มี DATE ในปลายทางทดสอบแยก ตรวจชื่อ JPG, PNG ภาพรวม, JPG ใน `Individual Image` และ path ใน log
- อ้างอิง: `CHANGELOG.md` Unreleased / Changed

### KB-020 — เปิด ScriptUI ค้างระหว่างเปลี่ยน EPS

- วันที่ / สถานะ: 2026-11-19; แก้แล้วรอตรวจใน Illustrator
- State / หมวด: S0–S3; UI และการเลือกคิว
- อาการและหลักฐานก่อนแก้: `showCaptureDialog()` ใช้ `Window("dialog", ...)` ซึ่งบล็อกการทำงานใน Illustrator และ `openMode.enabled` ถูกกำหนดจาก EPS ที่ active เพียงตอนสร้างหน้าต่าง
- วิธีแก้: ใช้ `palette` ใน persistent engine, เปิดหน้าต่างเดิมเมื่อเรียกสคริปต์ซ้ำ, เปิดให้เลือก Single Mode ได้หลังเปิด EPS ใหม่ และอ่าน `app.activeDocument` ใหม่เมื่อกลับมาที่หน้าต่างและเมื่อกด START
- ผลหลังแก้ / Validation: Not tested; ตรวจ source และ diff เท่านั้น ใน working copy ไม่มีโฟลเดอร์ `tests` จึงไม่ได้เพิ่มกรณี mock และไม่ได้รันชุดทดสอบ
- งานค้าง / วิธีตรวจต่อ: เปิด palette ใน Illustrator, ปิด EPS เดิมและเปิด EPS ใหม่, ตรวจ Diagnostic และ START ว่าใช้ไฟล์ใหม่; ลองกรณีไม่มีเอกสาร, ไฟล์ที่ไม่ใช่ EPS, เรียกสคริปต์ซ้ำ และปิด palette โดยไม่สร้าง log
- อ้างอิง: `CHANGELOG.md` Unreleased / Changed

### KB-021 — อ่าน SKU FLX และประเภทงาน PRE

- วันที่ / สถานะ: 2026-11-19; แก้แล้วรอตรวจใน Illustrator
- State / หมวด: S4–S5; ชื่อไฟล์และ SKU, UI และ log
- อาการและหลักฐานก่อนแก้: `1117-ALL-PRE-FLX-0001-01.eps` ไม่ผ่าน `getSku()` เพราะรับ SKU เป็นตัวอักษรหนึ่งตัวกับเลขสามหลัก; `parseSkuForLog()` ไม่รองรับ format ตัวเลขสี่หลัก และ UI/log ยังไม่มีช่องประเภทงาน
- วิธีแก้: ให้ `getSku()` รับท้ายชื่อ `FLX-` ตามด้วย format สี่หลักและลำดับสองหลัก; ให้ `parseSkuForLog()` แยก `FLX`, `0001`, `01`; อ่าน `PRE` หลัง SHOP เป็น `jobType` เมื่อมี และแสดง `TYPE: -` เมื่องานไม่มีประเภท; ไม่ใส่ TYPE ในชื่อภาพ
- ผลหลังแก้ / Validation: Not tested; ตรวจ source และ diff เท่านั้น ยังไม่ได้เปิด ScriptUI หรือส่งออกภาพใน Illustrator และไม่มีโฟลเดอร์ `tests` ใน working copy
- งานค้าง / วิธีตรวจต่อ: ใช้ EPS สำเนาและปลายทางทดสอบแยก ตรวจชื่อที่มี/ไม่มี `PRE`, งาน SKU เดิม, ค่า UI/`JOB INFO`, ชื่อ JPG/PNG และชื่อผิดรูปแบบตามรายการใน README
- อ้างอิง: `CHANGELOG.md` Unreleased / Added

### KB-022 — ปุ่มใน palette ไม่ตอบสนอง

- วันที่ / สถานะ: 2026-11-19; แก้จุดเสี่ยงแล้วรอตรวจใน Illustrator
- State / หมวด: S0–S3; UI และการเลือกคิว
- อาการและหลักฐานก่อนแก้: ผู้ใช้พบว่า START ใน Single Mode และ Browse ปลายทางกดใช้งานไม่ได้หลังเปลี่ยน ScriptUI เป็น `palette`; โค้ดเรียก `dialog.update()` จาก `onActivate`, `Window.find()` คืนหน้าต่างเดิมเมื่อเรียกสคริปต์ซ้ำ และ Browse ส่ง argument สองตัวให้ `Folder.selectDialog()`
- สาเหตุที่ยืนยัน: `Window.find()` ทำให้ callback ของหน้าต่างเดิมค้างใน persistent engine; `Folder.selectDialog()` รองรับเพียง prompt ตามเอกสาร API ส่วนการที่ `onActivate` รบกวน click เป็นสมมติฐานจากลำดับ callback และพฤติกรรม `Window.update()`
- วิธีแก้: ปิด palette ที่ยังเปิดเมื่อเรียกสคริปต์ซ้ำแล้วสร้างใหม่; เอา `onActivate` ที่เรียก `dialog.update()` ออก; ใช้ `initial.selectDlg()` เมื่อมี Folder ตั้งต้น โดยยังอ่านเอกสาร active เมื่อเลือก Single Mode และกด START
- ผลหลังแก้ / Validation: Not tested; ตรวจ source และ diff เท่านั้น
- งานค้าง / วิธีตรวจต่อ: เรียกสคริปต์ไฟล์ใหม่อีกครั้งใน Illustrator แล้วลอง Browse ปลายทาง, START ใน Single Mode และ Batch, ปิด/เปิด EPS ระหว่างรอบ และเรียกสคริปต์ซ้ำ หากยังไม่ตอบสนองให้เก็บอาการว่า radio button และปุ่ม Close กดได้หรือไม่
- อ้างอิง: `CHANGELOG.md` Unreleased / Fixed

### KB-023 — กลับมาใช้ dialog

- วันที่ / สถานะ: 2026-11-19; แก้แล้วรอตรวจใน Illustrator
- State / หมวด: S0–S3; UI และการเลือกคิว
- อาการและหลักฐานก่อนแก้: ผู้ใช้พบว่าปุ่ม START และ Browse ใช้งานไม่ได้หลังเปลี่ยนเป็น `palette` และขอให้กลับมาใช้ `dialog`
- วิธีแก้: ใช้ `Window("dialog", ...)` อีกครั้ง เอา `#targetengine` และการค้นหา palette เดิมออก; Single Mode กลับไปเลือกได้เมื่อมี EPS active ตอนเปิด dialog; คงการแก้ Folder picker ที่ใช้ `selectDlg()`
- ผลหลังแก้ / Validation: Not tested; ตรวจ source และ diff เท่านั้น
- งานค้าง / วิธีตรวจต่อ: ปิด palette เดิมที่เปิดอยู่ใน Illustrator ก่อนเรียกสคริปต์ฉบับใหม่ ตรวจ START, Browse ปลายทาง, Batch และการปิด dialog แล้วเปิด EPS ใหม่
- อ้างอิง: `CHANGELOG.md` Unreleased / Changed; KB-020 และ KB-022 เป็นประวัติของ palette ที่ยกเลิกแล้ว

### KB-024 — จัดภาพตามโฟลเดอร์วันที่และ OID

- วันที่ / สถานะ: 2026-11-19; แก้แล้วรอตรวจใน Illustrator
- State / หมวด: S4–S5; DATE, ชื่อไฟล์และปลายทางภาพ
- อาการและหลักฐานก่อนแก้: `executeJob()` ส่ง output folder ตรงเข้า `exportFrames()` ทำให้ `ensureOrderFolder()` สร้าง `<output>/<OID>/` และ JPG/PNG ไม่มีโฟลเดอร์วันที่ แม้ `validateJobDate()` ตรวจ DATE แล้ว; DATE ที่หายยังส่งออกได้ด้วย `0000`
- วิธีแก้: ให้ `validateJobDate()` คืนชื่อ `YYYYMMDD` จาก `MMDD` ในชื่อ EPS และปีปัจจุบันของเครื่อง พร้อมปฏิเสธ DATE ที่ขาดหรือไม่ใช่วันที่จริง; `ensureDateFolder()` ใช้โฟลเดอร์วันที่เดิมหรือสร้างใหม่ก่อนส่ง `dateFolder` เข้า `exportFrames()` เพื่อให้ JPG, PNG ภาพรวม และ `Individual Image` อยู่ใต้ `<output>/<YYYYMMDD>/<OID>/` ตาม OID ที่จับคู่ไว้
- ผลหลังแก้ / Validation: Not tested; ตรวจ source และ diff เท่านั้น ไม่ได้รันชุดทดสอบหรือส่งออกใน Illustrator; `tests/` ไม่อยู่ใน working tree
- งานค้าง / วิธีตรวจต่อ: ใช้ EPS สำเนาและปลายทางแยก ทดสอบวันที่ต่างกัน, โฟลเดอร์วันที่/OID ที่มีอยู่และยังไม่มี, หลาย OID ในวันเดียวกัน, DATE หายหรือไม่จริง, JPG/PNG ภาพรวมและ JPG ใน `Individual Image`, log และการทำ Batch ต่อหลัง Job ผิดพลาด
- อ้างอิง: `CHANGELOG.md` Unreleased / Changed; เปลี่ยนกฎ path ล่าสุดใน KB-016 โดยคงประวัติเดิม

### KB-025 — ไม่สร้างโฟลเดอร์วันที่ซ้อนเมื่อเลือกโฟลเดอร์วันที่

- วันที่ / สถานะ: 2026-11-19; แก้แล้วรอตรวจใน Illustrator
- State / หมวด: S5; ปลายทางภาพ
- อาการและหลักฐานก่อนแก้: เมื่อเลือกปลายทางที่ลงท้ายด้วยวันที่ของ Job เช่น `.../20261118`, `ensureDateFolder()` สร้าง `new Folder(folder.fsName + "/" + dateName)` เสมอ จึงได้ `.../20261118/20261118/<OID>/`
- สาเหตุที่ยืนยันจากโค้ด: helper ตรวจเฉพาะโฟลเดอร์ลูก ไม่ตรวจชื่อโฟลเดอร์ปลายทางที่เลือก
- วิธีแก้: `ensureDateFolder()` คืน `folder` เดิมเมื่อ `folder.name` ตรงกับ `dateName`; เมื่อชื่อไม่ตรงจึงใช้หรือสร้างโฟลเดอร์วันที่ลูกก่อนแยก OID
- ผลหลังแก้ / Validation: Not tested; ตรวจ source และ diff เท่านั้น ไม่ได้รันชุดทดสอบหรือส่งออกใน Illustrator
- งานค้าง / วิธีตรวจต่อ: เลือกโฟลเดอร์วันที่ที่ตรงกับ Job เป็นปลายทางแล้วตรวจ JPG/PNG ใต้ `<selected>/<OID>/` โดยไม่มีวันที่ซ้อน; ตรวจการเลือกโฟลเดอร์แม่และกรณี Batch ที่มีหลายวันที่ด้วยโฟลเดอร์ทดสอบแยก
- อ้างอิง: `CHANGELOG.md` Unreleased / Changed; ต่อจาก KB-024

### KB-026 — อ่าน Variable เมื่อชื่อ EPS ให้ DATE หรือ SKU ไม่ได้

- วันที่ / สถานะ: 2026-11-20; แก้แล้วรอตรวจใน Illustrator
- State / หมวด: S4–S5; ข้อมูล Job และการตั้งชื่อภาพ
- อาการและหลักฐานก่อนแก้: `getDocumentInfo()` อ่านจาก `doc.name` เท่านั้น; เมื่อชื่อ EPS ขาด SKU หรือ DATE ไม่ถูกต้อง `executeJob()` โยนข้อผิดพลาด แม้ในเอกสารมี Variables `FN`, `DATE`, `SHOP` ที่ผูกกับ TextFrame อยู่
- วิธีแก้: เพิ่ม `readTextVariable()` เพื่ออ่าน `Variable.pageItems` และ `TextFrame.contents` โดยตรวจชื่อ Variable ซ้ำและข้อความที่ขัดกัน; `getJobInfo()` ใช้ค่า Variable เฉพาะเมื่อ DATE หรือ SKU จากชื่อ EPS ใช้ไม่ได้ รักษาส่วนของชื่อ EPS ที่ยังถูกต้อง และระบุแหล่งข้อมูลใน `JOB INFO`
- ผลหลังแก้ / Validation: Not tested; ตรวจ source และ diff เท่านั้น ไม่ได้รันชุดทดสอบหรือ Illustrator
- งานค้าง / วิธีตรวจต่อ: ใช้ EPS สำเนาที่ชื่อขาด DATE/ขาด SKU แต่ Variable ถูกต้อง, ค่า Variable ไม่จริง/ว่าง/ซ้ำ และ TextFrame ที่ผูกหลายตัวมีข้อความต่างกัน; ตรวจ Status, log, ชื่อ JPG, โฟลเดอร์วันที่ และการทำ Job ถัดไปใน Batch
- อ้างอิง: `CHANGELOG.md` Unreleased / Added

### KB-027 — จัด DATE, SHOP และ SKU ใน Status บรรทัดเดียว

- วันที่ / สถานะ: 2026-11-21; แก้แล้วรอตรวจใน Illustrator
- State / หมวด: S0–S7; UI และการเลือกคิว
- หลักฐานก่อนแก้: `showCaptureDialog()` เพิ่ม `dateLabel`, `shopLabel` และ `skuLabel` ลงใน `diagnostic` ที่มี `orientation = "column"` โดยตรง จึงแสดงแยกบรรทัด
- วิธีแก้: เพิ่ม `metadataRow` แบบ `row` สำหรับสามช่อง และกำหนดความกว้างแต่ละช่องเพื่อรองรับค่าระหว่าง Batch
- ผลหลังแก้ / Validation: Not tested; ตรวจ source และ diff เท่านั้น ไม่ได้เปิด ScriptUI ใน Illustrator
- งานค้าง / วิธีตรวจต่อ: เปิด ScriptUI ใน Illustrator และตรวจ DATE, SHOP, SKU ทั้งค่าเริ่มต้นและค่าจาก EPS หลายแบบ โดยเฉพาะ SKU แบบ FLX และ SHOP ที่ยาว ว่าไม่ถูกตัดหรือทำให้หน้าต่างล้น
- อ้างอิง: `CHANGELOG.md` Unreleased / Changed

### KB-028 — เปลี่ยน updater ให้ใช้ไฟล์ AutoCapture ที่มีเวอร์ชัน

- วันที่ / สถานะ: 2026-11-23; แก้แล้วรอตรวจบนเครื่องจริง
- State / หมวด: ก่อน S0; การติดตั้งและอัปเดตสคริปต์
- หลักฐานก่อนแก้: updater อ้างไฟล์ NAS ชื่อคงที่ `GC-AutoCaputre.js` และคัดลอกทับด้วยชื่อเดิม แต่ไฟล์ส่งมอบบนไดรฟ์ G ใช้ชื่อ `GC-AutoCapture vX.X.X.js`
- วิธีแก้: หาไฟล์ชื่อมีเวอร์ชันหนึ่งไฟล์ในโฟลเดอร์เดียวกับ updater, คัดลอกไปพักในโฟลเดอร์ชั่วคราวบน Desktop, ตรวจสิทธิ์ Administrator ก่อนลบเฉพาะชื่อ AutoCapture เดิมที่รู้จัก แล้ว `move` ไฟล์ที่พักเข้า Illustrator โดยคงชื่อเวอร์ชัน; หากมีไฟล์ต้นทางศูนย์หรือหลายไฟล์ ให้หยุดก่อนแก้ปลายทาง
- ผลหลังแก้ / Validation: ผู้ใช้รัน updater แบบ batch จริงแล้วพบ `Access is denied` ตอนย้ายไฟล์จาก Desktop เข้า `Program Files`; ตรวจ ACL พบว่า Users มีสิทธิ์ ReadAndExecute ส่วน Administrators มี FullControl และไฟล์เวอร์ชันยังอยู่บน Desktop การตรวจสิทธิ์ก่อนลบใน batch ยังไม่ได้รัน
- งานค้าง / วิธีตรวจต่อ: ใช้แนวทาง PowerShell ใน KB-029 แล้วตรวจบนเครื่องจริง
- อ้างอิง: `CHANGELOG.md` Unreleased / Changed

### KB-029 — ย้าย updater ไปทำงานด้วย PowerShell

- วันที่ / สถานะ: 2026-11-23; แก้แล้วรอตรวจบนเครื่องจริง
- State / หมวด: ก่อน S0; การติดตั้งและอัปเดตสคริปต์
- หลักฐานก่อนแก้: batch updater ย้ายไฟล์จาก Desktop เข้า `Program Files` ไม่สำเร็จเมื่อไม่ได้รันด้วยสิทธิ์ Administrator และไดรฟ์ `G:` ที่ mapped อาจไม่ปรากฏในหน้าต่างที่ยกระดับสิทธิ์
- วิธีแก้: เพิ่ม `updater/Update-Illustrator-Script.ps1` เป็นตัวทำงานหลักและคง `.bat` เป็นตัวเรียก คัดลอกไฟล์เวอร์ชันและ PowerShell updater ไปพักบน Desktop ก่อนขอ UAC เพื่อให้ elevated process ใช้ไฟล์บน Desktop แทน `G:` จากนั้นลบเฉพาะชื่อ AutoCapture เดิมและ `Move-Item` ไฟล์ใหม่เข้า Illustrator
- ผลหลังแก้ / Validation: ตรวจ PowerShell parser และ diff ผ่าน; ไม่ได้รัน UAC หรือการติดตั้งจริง
- งานค้าง / วิธีตรวจต่อ: เรียก `.ps1` หรือ `.bat` จากโฟลเดอร์เดียวกับไฟล์เวอร์ชันบน `G:` แล้วอนุมัติ UAC ตรวจผลทุก Illustrator, โฟลเดอร์ชั่วคราวบน Desktop และเมนู File > Scripts หลังเปิดใหม่; ลองไม่อนุมัติ UAC และกรณีย้ายไม่สำเร็จเพื่อยืนยันว่าสำเนายังอยู่
- อ้างอิง: `CHANGELOG.md` Unreleased / Changed

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
## การติดตามอาการค้างก่อนเปิดหน้าต่าง — 2026-11-21

- State / หมวด: เริ่มสคริปต์ก่อนแสดง ScriptUI; ผู้ใช้แจ้งว่าค้างกับบางไฟล์ก่อนเห็นหน้าต่าง
- หลักฐานก่อนแก้: session log สร้างหลังกด START จึงไม่มีข้อมูลช่วงเริ่มต้น; สคริปต์อ่านชื่อ active document และอัปเดต UI ก่อน `dialog.show()`
- วิธีแก้: เพิ่ม `AI_DEBUG.log` บน Desktop แบบ append พร้อมจุดก่อนและหลังสร้างหน้าต่าง อ่านเอกสาร อัปเดตโหมด และแสดง dialog; หากเขียนไม่ได้ให้ทำงานต่อ
- ผลตรวจ: Not tested; ตรวจ source และ diff เท่านั้น
- งานค้าง: เรียกสคริปต์กับไฟล์ที่มีอาการใน Illustrator แล้วดูหมายเลขล่าสุดใน log; ตรวจการสร้าง log บน Desktop และการแสดง dialog จริง

## เปลี่ยนตำแหน่ง debug log — 2026-11-21

- State / หมวด: การติดตามก่อนเปิด ScriptUI; เดิมเขียนรวมที่ `Desktop/AI_DEBUG.log`
- วิธีแก้: สร้าง `Desktop/log/debugger/` และเขียน `AutoCapture_Debug_YYYYMMDD_hhmmss.log` ตามเวลาเริ่ม; การเริ่มในวินาทีเดียวกันเขียนต่อไฟล์เดิม
- ผลตรวจ: Not tested; ตรวจ source และ diff เท่านั้น
- งานค้าง: ตรวจการสร้างโฟลเดอร์ ชื่อไฟล์ และบรรทัดล่าสุดกับ EPS ที่ค้างใน Illustrator

## Single Mode ไม่จำกัดนามสกุล — 2026-11-21

- State / หมวด: เลือกเอกสาร active; เดิมตรวจ `.eps` ทั้งตอนเปิด dialog และกด START
- วิธีแก้: ตรวจเพียงว่ามีเอกสารเปิดอยู่ และปรับข้อความสถานะกับแหล่ง metadata; Batch ยังค้นหา EPS
- ผลตรวจ: Not tested; ตรวจ source และ diff เท่านั้น ไม่มีชุดทดสอบใน working copy
- งานค้าง: ตรวจ Single Mode กับเอกสาร AI และ EPS รวมกรณีไม่มีเอกสารและชื่อหรือ Variables ไม่มี DATE/SKU ใน Illustrator

## Debug log ใต้ output — 2026-11-21

- State / หมวด: ตำแหน่ง startup debug log; เดิมเขียนบน Desktop ก่อนเลือกปลายทาง
- วิธีแก้: เก็บเหตุการณ์ในหน่วยความจำและเขียนใต้ `<output>/log/debugger/` หลัง START เตรียมปลายทางสำเร็จ; session log ปัจจุบันอยู่ใต้ `<output>/logs/sessions`
- ผลตรวจ: Not tested; ตรวจ source และ diff เท่านั้น
- งานค้าง: ตรวจการเขียน log และเปลี่ยนปลายทางใน Illustrator; อาการค้างก่อนเลือกปลายทางจะไม่มี debug log ให้ตรวจ

## Debug log ที่โฟลเดอร์กำหนด — 2026-11-21

- State / หมวด: ติดตามอาการค้างก่อน dialog; การรอ output path ทำให้ไม่สามารถเขียน log ก่อนค้าง
- วิธีแก้: กำหนด `CONFIG.debugFolderPath` เป็น `G:/047-Pearl/Work/Design/SITKA/autoCapture_Debugger` และเริ่มเขียนทันที
- ผลตรวจ: Not tested; ตรวจ source และ diff เท่านั้น
- งานค้าง: ตรวจการเข้าถึง G: และบรรทัดล่าสุดของ debug log ใน Illustrator โดยเฉพาะไฟล์ที่ค้าง

## แยกจุดค้างระหว่างตั้งค่าโหมด — 2026-11-21

- State / หมวด: ก่อนแสดง ScriptUI; log เดิมคร่อม `updateMode()` ทั้งฟังก์ชัน
- หลักฐานก่อนแก้: `updateMode()` เรียก `showDiagnostic()` ซึ่งเรียก `dialog.update()` ก่อน `dialog.show()`; log `06`–`07` แยกจุดค้างไม่ได้
- วิธีแก้: ข้าม `dialog.update()` ก่อนแสดง dialog และเพิ่ม log `MODE` รอบการตั้ง panel, จำนวนไฟล์, ชื่อเอกสาร และ Diagnostic พร้อม log `UI` รอบการวาดหน้าต่างหลังเปิด
- ผลตรวจ: Not tested; ตรวจ source และ diff เท่านั้น
- งานค้าง: เปิดไฟล์ที่เคยค้างใน Illustrator, ดูบรรทัดสุดท้ายใน debug log และสลับ Single/Batch เพื่อตรวจ panel, สถานะ และปุ่ม START

## ค้างระหว่างอ่านชื่อเอกสารใน initial mode — 2026-11-21

- State / หมวด: `updateMode()` ก่อนเปิด dialog
- หลักฐานก่อนแก้: debug log จาก Illustrator หยุดที่ `MODE | Before reading document name`; บรรทัดถัดไปรวม `app.activeDocument.name` กับ `getDocumentInfo()` จึงยังแยกสาเหตุสองส่วนไม่ได้
- วิธีแก้: เลื่อนการอ่านและแยกชื่อไปหลังกด START พร้อม log ก่อนและหลังแต่ละส่วน; `updateMode()` แสดงข้อมูลว่างจนเริ่มงาน
- ผลตรวจ: Not tested; ตรวจ source และ diff เท่านั้น
- งานค้าง: เปิดไฟล์เดิม ตรวจ dialog และการสลับโหมด จากนั้นกด START ในปลายทางทดสอบและดูบรรทัด `START` ล่าสุด

## ค้างใน getDocumentInfo — 2026-11-21

- State / หมวด: START หลังอ่านชื่อเอกสาร
- หลักฐานก่อนแก้: log ผู้ใช้หยุดที่ `START | After reading active document name; before parsing` จึงยืนยันว่าการอ่าน `selection.document.name` ผ่านแล้ว แต่ `getDocumentInfo()` ยังไม่คืนค่า
- วิธีแก้: เพิ่มจุด `NAME` คร่อมการตัดนามสกุล หา SKU แยก SKU และ DATE/SHOP
- ผลตรวจ: Not tested; log เป็นหลักฐานก่อนแก้ ยังไม่ได้รันสคริปต์ที่เพิ่มจุดติดตาม
- งานค้าง: ใช้ไฟล์ที่มีอาการตรวจบรรทัด `NAME` ล่าสุด แล้วแก้เฉพาะขั้นที่ค้าง

## ค้างใน getSku — 2026-11-21

- State / หมวด: แยก SKU จากชื่อเอกสารหลัง START
- หลักฐานก่อนแก้: log ผู้ใช้หยุดที่ `NAME | Before finding SKU` สำหรับชื่อยาว 27 ตัวอักษร; จึงอยู่ใน `getSku()` แต่ยังไม่ทราบคำสั่งย่อยที่ค้าง
- วิธีแก้: แยกชื่อเป็น token จากท้ายและตรวจแต่ละ token ด้วยรูปแบบสั้น โดยรองรับ FLX, SKU เดี่ยว, format และ sequence ตามเดิม
- ผลตรวจ: Not tested; ตรวจ source และ diff เท่านั้น
- งานค้าง: เรียกสคริปต์กับไฟล์เดิม แล้วตรวจว่า log ผ่าน `NAME | After finding SKU`; ตรวจชื่อ JPG และข้อมูล UI ใน Illustrator

## SKU รวมรหัสท้ายและ PRE — 2026-11-21

- State / หมวด: แยกชื่อไฟล์และแสดง SKU
- หลักฐานก่อนแก้: ผู้ใช้ระบุว่า `N017-01-S`, `N017-24-MIX` และ `PRE-FLX-0001` เป็น SKU เต็ม; การแยก `format` หรือ `TYPE: PRE` ผิดความหมาย
- วิธีแก้: รับรูปแบบเหล่านี้ใน `getSku()` และแยกเฉพาะเลขลำดับท้ายใน `parseSkuForLog()`; เอา TYPE ออกจาก UI และ JOB INFO
- ผลตรวจ: Not tested; ตรวจ source และ diff เท่านั้น
- งานค้าง: ตรวจชื่อไฟล์ทั้งสามแบบ รวมรูปแบบเก่า ใน Illustrator พร้อมค่า Status, JOB INFO, JPG และ PNG
## คืนกฎ SKU เต็มใน working copy — 2026-11-21

- State / หมวด: parser SKU, Status และ JOB INFO
- หลักฐานก่อนแก้: working copy ยังใช้ regex ทั้งชื่อ, แยก format และ TYPE; ไม่รับตัวอย่าง `N017-01-S-01` หรือ `N017-24-MIX-01`
- วิธีแก้: ตรวจ token ท้ายชื่อ, เก็บ SKU ทุกส่วนก่อนเลขลำดับท้าย, รวม PRE ใน SKU และนำ TYPE ออกจากการแสดงผล
- ผลตรวจ: Not tested; ตรวจ source และ diff เท่านั้น
- งานค้าง: ตรวจชื่อ JPG/PNG, Status และ JOB INFO กับไฟล์จริงใน Illustrator
## ซ่อน Layer/Group ชื่อมี Frame ระหว่าง export — 2026-11-21

- State / หมวด: export JPG และคืน visibility
- หลักฐานก่อนแก้: โค้ดซ่อนเฉพาะกรอบที่เลือกและ Layer Border; Layer/Group อื่นที่ชื่อมี Frame ยังติดไปในภาพ
- วิธีแก้: เก็บ visibility ของ Layer/Group ที่ชื่อมี `Frame` ทุกระดับก่อน export ซ่อนระหว่างส่งออก และคืนค่าแต่ละรายการใน `restoreDocumentState()`
- ผลตรวจ: Not tested; ตรวจ source และ diff เท่านั้น
- งานค้าง: ตรวจภาพ JPG และ visibility ก่อน/หลัง export สำเร็จและผิดพลาดใน Illustrator

## รองรับ OID ตัวเลขล้วนใน Group N — 2026-11-21

- State / หมวด: การจับคู่ OID ทางสำรองจาก Layer `Name`/`NAME`
- หลักฐานก่อนแก้: `collectNameOrderIds()` รับรหัสทั่วไปยาว 14–18 ตัวเฉพาะเมื่อมีทั้งอักษรอังกฤษและตัวเลข ทำให้รหัสตัวเลขล้วนถูกข้าม
- วิธีแก้: รับรหัสตัวเลขล้วนหรืออักษรอังกฤษผสมตัวเลขยาว 14–18 ตัวจาก Name หรือ contents ของ Type ใน Group `N[ตัวเลข]`; ยังคงให้ Type ชื่อ `N3-OID`/`N3_OID` มีลำดับก่อน
- ผลตรวจ: Not tested; ตรวจ source และ diff เท่านั้น ชุดทดสอบ `tests/` ไม่มีใน working copy
- งานค้าง: ตรวจการจับคู่และชื่อ JPG กับ OID ตัวเลขล้วน 14 และ 18 ตัวใน Illustrator รวมกรณีข้อมูลซ้ำหรืออยู่นอกช่วง
## คืนจุดติดตาม debugger — 2026-11-21

- State / หมวด: startup และการอ่านชื่อเอกสาร; working copy มีเพียง log 01–09 และอ่านชื่อก่อนเปิด dialog
- หลักฐานก่อนแก้: log ผู้ใช้ก่อนหน้าแสดงว่าหยุดใน `getSku()` และจุด MODE/START/NAME ที่เคยเพิ่มหายจากไฟล์ปัจจุบัน
- วิธีแก้: คืน log MODE, START, NAME และ UI; เลื่อนการอ่านชื่อไปหลังกด START และข้าม `dialog.update()` ก่อนแสดง dialog
- ผลตรวจ: Not tested; ตรวจ source และ diff เท่านั้น
- งานค้าง: ตรวจ log, การสลับโหมด และการส่งออกจากไฟล์ที่เคยค้างใน Illustrator

## ระบุชื่อโปรแกรมและเวอร์ชันใน log — 2026-11-23

- State / หมวด: startup และ S3; Log และการกู้ผล
- หลักฐานก่อนแก้: debug log บรรทัด `01 Script started` และ session log บรรทัด `START` ไม่มีชื่อโปรแกรมหรือเวอร์ชัน แม้มีค่าใน `CONFIG.uiTitle` และ `CONFIG.uiVersion`
- วิธีแก้: เพิ่มชื่อจาก `CONFIG.uiTitle` และเวอร์ชันจาก `CONFIG.uiVersion` เป็น `<name> Version <version>` ในบรรทัดเริ่มต้นของ log ทั้งสองชนิด
- ผลตรวจ: Not tested; ตรวจ source และ diff เท่านั้น
- งานค้าง: เปิด Illustrator แล้วตรวจบรรทัดเริ่มต้นของ debug log และ session log จากการส่งออกในปลายทางทดสอบ

## อ่าน DATE แบบช่วงวันและ SHOP จากชื่อไฟล์ — 2026-11-23

- State / หมวด: การแยก DATE และ SHOP จากชื่อ EPS หรือ FN
- หลักฐานก่อนแก้: `getDocumentInfo()` แยกชื่อด้วย `-` แล้วอ่าน token ที่สองเป็น SHOP ทำให้ `1121-22` ถูกอ่านเป็น DATE `1121` และ SHOP `22`
- วิธีแก้: รวม token วันที่และวันปลายทางก่อนอ่าน SHOP; รับ SHOP จากชื่อไฟล์เฉพาะ `SP`, `TT`, `ALL`; ตรวจว่าช่วงวันเรียงลำดับและอยู่ในเดือนเดียวกัน; แสดงและใช้ DATE เต็มใน log และชื่อภาพ โดยเลือกโฟลเดอร์จากวันแรก
- ผลตรวจ: Not tested; ตรวจ source และ diff เท่านั้น
- งานค้าง: ตรวจ `1121-22-SP-...`, `1121-22-TT-...`, `1121-22-ALL-...` และช่วงวันไม่ถูกต้องใน Illustrator จริง
