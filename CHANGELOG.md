# Changelog / ประวัติการเปลี่ยนแปลง

Changes to GC-AutoCapture are recorded here, newest first. Each entry includes
an English description and a short Thai summary for everyone on the team.

สรุปสิ่งที่เพิ่ม ปรับ และแก้ไข โดยรายการล่าสุดอยู่ด้านบน

## Unreleased / ยังไม่ออกเวอร์ชัน

These changes describe the local working copy updated on 2026-11-02.
They have not been committed or assigned a release version.
SKU frame inference, Border visibility, flexible job names and export logs passed twenty-one Windows JScript mock integration test groups.
Actual export in Illustrator 28.6.0 passed for the open `1028(M)-TT-N012-16-01.eps` job:
four JPGs exported and visually checked, four empty positions skipped, document
state restored and the source EPS file hash unchanged.
The new native log and timestamp-free JPG names also passed a repeat Illustrator
export at the current 96 DPI setting (four 268x749 images, four skipped positions).
The historical checks above predate the new ScriptUI queue; ScriptUI validation
is paused at the user's request and has not been run.
Contributors and commit/PR references must be filled in when the work is committed.

รายการด้านล่างเป็นงานที่แก้ไว้ในเครื่อง ยังไม่ออกเวอร์ชัน ผลทดสอบเดิมของ job N012-16 เป็นประวัติก่อนเพิ่ม ScriptUI ซึ่งยังพักการทดสอบตามคำขอของผู้ใช้

### Added / เพิ่ม

- Add a ScriptUI dialog directly inside `GC-AutoCaputre.js` with explicit modes
  for the currently active EPS or a batch source folder. Batch mode recursively
  discovers EPS files in all subfolders. Require an existing destination folder
  for JPG and log output before processing can start.
  - **ไทย:** เพิ่ม ScriptUI สำหรับ EPS ที่เปิดอยู่หรือ Batch จาก Folder/Subfolder และบังคับเลือก Folder ปลายทางก่อนเริ่ม
- Write a UTF-8 `AutoCapture_Batch_*.txt` summary in the output folder alongside
  existing per-job logs. Create it before document validation or opening queued
  files so runtime errors are recorded before an Error Alert. Preserve previous
  logs and continue with later jobs after a per-job failure.
  Reuse already-open EPS documents. Open one queued EPS at a time, finish its
  export and close it without saving before opening the next file. Keep documents
  that were already open and restore the previously active document after the queue.
  - **ไทย:** เปิด EPS จากคิวครั้งละไฟล์ ส่งออกเสร็จแล้วปิดโดยไม่บันทึกก่อนเปิด Job ถัดไป และไม่ปิดเอกสารที่ผู้ใช้เปิดไว้ก่อน
  - **Validation (2026-11-02):** Not tested. Static source and diff review only;
    test files are absent. ScriptUI interaction, recursive discovery, sequential
    open/close behavior and EPS/JPG rendering in Illustrator remain unverified.

- Write a UTF-8 `AutoCapture_Log_yyyymmdd_HHMMSS.txt` beside exported JPGs.
  Record source, SKU, destination, settings, each completed image's local date/time,
  work number, OID, file and bounds, skipped-frame reasons, errors and final counts.
  Preserve partial progress and same-second logs; stop if logging fails.
  - **ไทย:** เพิ่ม log รายรอบพร้อมเวลาที่ส่งออกแต่ละภาพเสร็จ เหตุผลที่ข้าม และสรุปผลย้อนหลัง
- Accept job names with month/day (`MMDD`) and SKU as the minimum, such as
  `1028-N012-16.eps`. Shift `(M)`/`(N)`, platform and set number are optional.
  Preserve the complete SKU and original set suffix: `N012-16-01` stays `N012-16-01`
  in exported JPG filenames and log references. Do not add a set if absent.
  - **ไทย:** ไม่บังคับช่วงเวลา Platform หรือเลขชุดในชื่อ EPS

- Hide every layer named `Border`, including sublayers, during export and restore
  each layer's original visibility after success or failure. Missing Border layers
  do not prevent export.
  - **ไทย:** ซ่อน `Border` ระหว่างส่งออก แล้วคืนค่าการแสดงเดิมหลังจบงานหรือเกิดข้อผิดพลาด
  - **Validation:** All eight mock integration test groups passed; coverage includes visible, hidden, nested,
    duplicate and absent Border layers, cancellation and export failure.
- Add `CONFIG.skuFrameRules` to infer trailing export bounds from the last
  frame's right edge, with per-SKU count, expected total, size, gap, and vertical offset.
  Configure `N012` to append one same-size adjacent frame by default. Match complete
  case-insensitive SKU tokens in document names, without creating document paths.
  - **ไทย:** เติมภาพท้ายของ `N012` จากขอบขวากรอบล่าสุด และเตรียมค่าปรับสำหรับ SKU อื่น
  - **User action:** Verify N012 dimensions against the actual artwork; set
    `expectedFrameCount` when known to avoid extra exports in already complete files.
  - **Validation:** Seven mock integration test groups passed via
    `powershell.exe -NoProfile -File .\tests\run-tests.ps1`; Illustrator rendering not tested.
- Accept a top-level frame layer named `Layout` as well as `กรอบ`. Use the first
  matching layer in document order, without combining layers.
  - **ไทย:** ใช้ชั้นงานชื่อ `Layout` หรือ `กรอบ` ได้ โดยใช้ชั้นแรกที่พบ
- Centralize export settings in `CONFIG`: frame layer names, DPI, JPEG quality,
  filename number width, and the artboard used for export.
  - **ไทย:** รวมค่าตั้งไว้จุดเดียว ให้ทีมปรับงานได้ง่ายขึ้น
- Add usage instructions, configuration notes, and handoff checks in `README.md`.
  - **ไทย:** เพิ่มคู่มือใช้งานและรายการตรวจงานก่อนส่งต่อ
- Add this bilingual changelog and a reusable team entry template.
  - **ไทย:** เพิ่มประวัติการเปลี่ยนแปลงสองภาษาและแบบฟอร์มสำหรับทีม

### Changed / ปรับปรุง

- Match each OID TextFrame to the export frame containing its geometric center
  instead of building bottom-to-top OID slots and indexing them by work number.
  Require one unambiguous OID TextFrame per frame, and accept work marker Names
  with either a hyphen or underscore, such as `N1-BC` and `N1_BC`.
  - **ไทย:** จับคู่ OID ตามตำแหน่งในกรอบโดยตรง ไม่ใช้ลำดับช่อง และรองรับชื่อชิ้นงานทั้ง `N1-BC` กับ `N1_BC`
  - **Validation (2026-11-02):** Not tested. Test files are absent; static source
    and diff review only. Illustrator position matching remains pending.

- Parse the trailing job identifier as a four-character alphanumeric SKU, a
  one-to-three-character alphanumeric format code and a required two-digit
  sequence. Do not require or validate a month/day prefix. For example,
  `1102(M)-SP-L007-N02-01.eps` is parsed as `SKU=L007`, `Format=N02` and
  `Sequence=01`.
  - **ไทย:** แยก SKU 4 ตัว รหัสรูปแบบ 1–3 ตัว และลำดับที่เลข 2 หลัก โดยไม่บังคับหรือตรวจเดือน/วันในชื่อไฟล์
  - **Validation (2026-11-02):** Not tested. Static source and diff review only;
    test files are absent. Illustrator validation remains pending.

- Match frame Layer/Group names case-insensitively after trimming leading and
  trailing whitespace from both document names and `CONFIG.frameLayerNames`.
  Keep full-name matching, internal whitespace, punctuation and first-container
  selection unchanged. Other layer-name rules are unaffected.
  - **ไทย:** ชื่อกรอบรองรับตัวพิมพ์เล็ก–ใหญ่และช่องว่างหัวท้าย เช่น `CUTLINE` และ ` cutline ` โดยยังเทียบชื่อเต็ม
  - **Validation (2026-11-02):** Not tested. Static source and diff review only;
    test files are absent. Added manual matching cases to README; Illustrator
    validation remains pending.

- Remove `CONFIG.skuFrameRules`, `appendSkuFrames()` and its call. Detect export
  frames only from the first container matching `CONFIG.frameLayerNames`, using
  the existing closed four-point PathItem filter with `height > 1` pt.
  All SKUs, including `N012`, now require actual frames for every export area.
  - **ไทย:** ยกเลิกการเติมกรอบทางขวาตาม SKU ใช้เฉพาะ Rectangle สูงกว่า 1 pt ที่พบจริงใน container ตามรายชื่อที่ตั้งไว้
  - **Validation (2026-11-02):** Not tested. Static source and diff review only;
    test files remain absent from the working tree. Actual Illustrator frame
    detection and export remain unverified for this change.

- Find the first Layer or Group, including nested containers, whose name matches
  `CONFIG.frameLayerNames`. Collect closed four-point Rectangle paths with
  `height > 1` from that container and its nested Groups/sublayers, and preserve
  Layer or Group visibility while exporting.
  - **ไทย:** หา Layer/Group ชื่อกรอบรวมระดับซ้อน และใช้เฉพาะ Rectangle เส้นปิด 4 จุดที่สูงกว่า 1 pt พร้อมคืนสถานะการแสดงเดิม
  - **Validation (2026-10-30):** Automated tests could not be run because the test files are absent from the current working tree. Illustrator export remains unverified.
- Separate the trailing set component from the SKU in the per-job log header;
  for example, write `SKU=N012-11, Set=01` for the filename SKU `N012-11-01`.
  Keep JPG filenames and SKU matching unchanged, and omit Set when absent.
  - **ไทย:** แยกเลขชุดท้ายออกจาก SKU ในหัว log โดยไม่เปลี่ยนชื่อ JPG หรือกฎจับคู่ SKU
  - **Validation (2026-10-30):** Automated tests and Illustrator export were not run.
- Accept numeric and ASCII alphanumeric Order IDs containing at least one digit,
  such as `123456` and `ABC123`. Export a matched work item with `EmptyOID` in
  the JPG filename when its OID slot is empty or invalid instead of skipping it.
  - **ไทย:** รองรับ OID แบบตัวเลขและอักษรอังกฤษผสมตัวเลข และใช้ `EmptyOID` เพื่อส่งออกภาพต่อเมื่อช่อง OID ว่างหรือไม่ถูกต้อง
  - **Validation (2026-10-30):** Automated tests were not run because the test
    files are absent from the current working tree. Illustrator export remains unverified.
- Export as `[SKU with original set suffix]-[Order ID]-[work number].jpg`,
  using hyphens between all filename parts; move export timestamps into the log.
  Extract `N012-03-01` from job names such as `1028(M)-TT-N012-03-01.eps`.
  Read work numbers from Type object Names such as `N3-BC` in the `Name` layer
  at each export position, and pair with Type object Names in `OID`, counting
  bottom to top. Fall back to Type contents when the OID Name is empty, matching
  the Layers panel display in the real EPS. Preserve empty OID slots and long numeric IDs as strings.
  Skip missing or ambiguous metadata; report exported and skipped counts.
  Read local completion time separately after each successful image export.
  - **ไทย:** ใช้ชื่อ SKU, เลขออเดอร์ และลำดับชิ้นงานอย่างน้อย 3 หลัก โดยย้ายเวลาไปไว้ใน log และข้ามกรอบที่จับคู่ข้อมูลไม่ได้
  - **Validation:** Twenty-one Windows JScript mock integration test groups passed,
    covering spatial matching, grouped stacking order, missing values, skipped
    numbering, long IDs, leading zeros, overlapping frames and year rollover.
- Split the script into focused helper functions within a private scope, retaining
  ES3 syntax for Adobe ExtendScript. Add English and Thai code comments.
  - **ไทย:** จัดระเบียบโค้ดและเพิ่มคำอธิบาย เพื่อให้ทีมแก้ไขต่อได้ง่าย

### Fixed / แก้ไข

- Preserve the complete output number when it exceeds the configured digit width,
  instead of truncating it and potentially reusing an earlier filename.
  - **ไทย:** เลขท้ายชื่อภาพไม่ถูกตัดเมื่อมีภาพจำนวนมาก ลดโอกาสชื่อซ้ำ
- Select the artboard being resized before JPEG export, then restore the previously
  active artboard along with the frame layer visibility and artboard bounds.
  - **ไทย:** ใช้หน้ากระดาษให้ตรงกับกรอบภาพ แล้วคืนค่าที่ใช้ก่อนเริ่มงาน
- Attempt each document restoration independently and report both export and
  restoration errors. Report success only after restoration completes without errors.
  - **ไทย:** พยายามคืนค่าทุกส่วน และแจ้งหากส่งออกหรือคืนค่าไม่สำเร็จ
- Use the Documents folder as the initial destination when the document has no
  saved path.
  - **ไทย:** งานที่ยังไม่เคยบันทึกสามารถเปิดหน้าต่างเลือกที่เก็บภาพได้
- Keep the original collection order when frames share the same left coordinate.
  - **ไทย:** กรอบที่อยู่แนวซ้ายตรงกันจะได้ลำดับภาพคงที่

## Initial development / เริ่มพัฒนา — 2026-10-28

These are development commits, not a tagged release. Names below are the Git
author names recorded on each commit.

เป็นประวัติเริ่มต้นจาก Git ยังไม่มีการระบุเวอร์ชันเผยแพร่

### Added / เพิ่ม

- Create the repository and the initial project title in `README.md`.
  - **ไทย:** สร้างพื้นที่เก็บโปรเจกต์และชื่อโครงการ
  - **Contributor:** chettapol108-rgb
  - **Reference:** [76ad9f0 — Initial commit](https://github.com/chettapol108-rgb/GC-AutoCapture/commit/76ad9f0d03001f1d5c1fff797ecdb9d4947743c1)
- Add the initial Illustrator script in `GC-AutoCaputre.js` to export JPG images
  from paths in the `กรอบ` layer, ordered from left to right, with a destination
  folder picker and numbered filenames. The commit describes the code as unfinished.
  - **ไทย:** เพิ่มสคริปต์ส่งออกภาพตามกรอบจากซ้ายไปขวา เป็นงานเริ่มต้นที่ยังไม่เสร็จ
  - **Contributor:** GC.Design2
  - **Reference:** [7285050 — Initial Code - not finish](https://github.com/chettapol108-rgb/GC-AutoCapture/commit/7285050eacf30d1214acd64dfb338d4603fb3f83)

## Team update guide / วิธีบันทึกสำหรับทีม

1. Add an entry under **Unreleased** with each meaningful change. Describe what
   users will notice, including any action they need to take.
   **ไทย:** แก้อะไรให้บันทึกไว้ พร้อมบอกว่าผู้ใช้ต้องทำอะไรเพิ่มไหม
2. Use **Added**, **Changed**, **Fixed**, **Removed**, or **Known issues** as needed.
   Write the English explanation first, then one short Thai sentence in plain language.
   **ไทย:** เลือกหมวดให้ตรง เขียนอังกฤษแล้วสรุปไทยสั้น ๆ เลี่ยงศัพท์เทคนิค
3. Record the contributor's name and a commit or PR link for each change or related
   group of changes. Use Git/PR history to confirm authorship; do not guess.
   **ไทย:** ใส่ชื่อผู้แก้และลิงก์งาน เพื่อย้อนดูรายละเอียดและสอบถามได้
4. Record actual validation results. Say **Not tested** if no check was run, and
   describe known limitations that affect users.
   **ไทย:** บอกว่าตรวจอะไรแล้ว หากยังไม่ได้ทดสอบให้ระบุตามจริง
5. When releasing, move the completed entries to a heading such as
   `## [version] — YYYY-MM-DD`, using the actual version and release date.
   Keep unfinished work under **Unreleased** and preserve older entries.
   **ไทย:** เมื่อออกเวอร์ชัน ให้ย้ายเฉพาะงานที่พร้อมไปไว้ใต้เลขเวอร์ชันและวันที่จริง

### Copyable entry / แบบฟอร์มสำหรับคัดลอก

Place this entry under the appropriate category in **Unreleased**. Replace every
placeholder before merging; use **Not tested** where applicable.

คัดลอกไปใส่หมวดที่เหมาะสมด้านบน แล้วกรอกข้อมูลให้ครบก่อนรวมงาน

```markdown
- **English:** [What changed and how it affects users.]
  - **ไทย:** [สรุปสั้น ๆ ว่าผู้ใช้ได้อะไรหรือควรรู้อะไร]
  - **Contributor:** [Name or GitHub username]
  - **Reference:** [Commit or PR link]
  - **Validation:** [Checks performed and results, or Not tested]
  - **User action:** [Required steps, or None]
```
