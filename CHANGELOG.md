# Changelog / ประวัติการเปลี่ยนแปลง

Changes to GC-AutoCapture are recorded here, newest first. Each entry includes
an English description and a short Thai summary for everyone on the team.

สรุปสิ่งที่เพิ่ม ปรับ และแก้ไข โดยรายการล่าสุดอยู่ด้านบน

## Unreleased / ยังไม่ออกเวอร์ชัน

These changes describe the local working copy updated on 2026-11-03.
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

- Route each EPS job's JPGs to a `YYYY-MM-DD/OID` folder under the selected output
  folder, using its `MMDD` filename prefix and the current local year. Reject
  missing or impossible dates for that job while later Batch jobs continue; keep
  the round log in the output root.
  - **ไทย:** แยกภาพตามวันที่ของ EPS แต่ละไฟล์ก่อนแยก OID และบันทึกข้อผิดพลาดเมื่อ DATE ใช้ไม่ได้
  - **Validation (2026-11-11):** Not tested. Static source and diff review only;
    Illustrator export and folder creation remain unverified.

- Add `HANDOFF.md` as a state map and issue knowledge base with evidence,
  resolution history, pending Illustrator checks and a reusable handoff template.
  - **ไทย:** เพิ่มคลังสมองสำหรับส่งต่อ state ปัญหา วิธีแก้ หลักฐาน และงานที่ยังต้องตรวจ
  - **Validation (2026-11-10):** Not tested. Documentation and diff review only.

- Add Select all and Select some radio buttons to the Batch source folder panel.
  Default to Select all and gray out the entire Optional range panel. Select some
  enables START EPS and END EPS; switching back ignores their retained values
  and includes all discovered EPS files.
  - **ไทย:** เลือกทุกไฟล์เป็นค่าเริ่มต้น และเปิดช่องช่วงไฟล์ทั้ง panel เมื่อเลือก Select some เท่านั้น
  - **Validation (2026-11-10):** Not tested. Static source and diff review only;
    Illustrator ScriptUI interaction remains unverified.

- Show every discovered Batch EPS in a scrollable, read-only text list. Indent
  folders by level and draw `├─` / `└─` only on EPS files under the same folder.
  Users can drag to select and copy filenames directly in the list. Mark files
  inside the optional START EPS / END EPS range and refresh on selection changes.
  - **ไทย:** เยื้องชื่อ Folder ตามระดับ และใช้เส้นกิ่งเฉพาะไฟล์ EPS ใต้ Folder เดียวกัน พร้อมลากเมาส์คัดลอกได้
  - **Validation (2026-11-10):** Not tested. Static source and diff review only;
    Illustrator ScriptUI selection and scrolling remain unverified.

- Show the total EPS count in a selected Batch source folder and its subfolders.
  Allow optional inclusive START EPS and END EPS filenames to select a range in
  sorted path order; show the selected count and reject missing, duplicate or
  reversed boundaries before export. Keep START available after each run so the
  same ScriptUI dialog can process another selection with a new log.
  - **ไทย:** แสดงจำนวน EPS ทั้งหมดและจำนวนในช่วงที่เลือก กำหนดไฟล์เริ่ม/จบได้ และกด START รอบใหม่ในหน้าต่างเดิมได้
  - **Validation (2026-11-09):** Not tested. Static source and diff review only;
    Illustrator ScriptUI and Batch export remain unverified.

- Parse the open or queued EPS filename into string fields for FN, DATE, SHOP,
  SKU, format and sequence. Show Job, FN, DATE, SHOP, combined SKU and No., and
  the current step in a persistent ScriptUI diagnostic panel. Record FN, DATE
  and SHOP in the job log; keep existing JPG naming rules.
  - **ไทย:** แยกค่าชื่อ EPS และแสดงสถานะ Job ปัจจุบันใน ScriptUI พร้อมบันทึก FN, DATE และ SHOP ใน log
  - **Validation (2026-11-09):** Not tested. Static source and diff review only;
    Illustrator UI and export remain unverified.


- Accept named Group items in the `Name` layer as positional markers, including
  nested Groups. Use each Group's geometric center like a Type marker; keep OID
  matching limited to TextFrames. Unnamed Groups are traversed for nested markers.
  - **ไทย:** ใช้ Group ที่ตั้งชื่อไว้ใน `Name` เป็นจุดระบุตำแหน่งได้ แม้งานถูกแปลงเป็นเส้นแล้ว
  - **Validation (2026-11-05):** Not tested. Static source and diff review only;
    Illustrator export and mock tests have not been run for this change.

- Add configurable `CONFIG.outputFolderName` with `.AutoCapture` as the default.
  Use a selected folder directly when its name matches; otherwise create and use
  an `.AutoCapture` child folder for JPG, per-job logs and the batch log. Preserve
  an existing JPG by adding `_02`, `_03` and later suffixes to duplicate names.
  - **ไทย:** บังคับให้ผลลัพธ์อยู่ใน Folder `.AutoCapture` ที่ปรับชื่อได้ และเติมเลขท้ายเมื่อชื่อ JPG ซ้ำแทนการเขียนทับ
  - **Validation (2026-11-03):** Not tested. Static source and diff review only;
    test files are absent. Folder creation and duplicate JPG export in Illustrator
    remain unverified.

- Add a ScriptUI dialog directly inside `GC-AutoCaputre.js` with explicit modes
  for the currently active EPS or a batch source folder. Batch mode recursively
  discovers EPS files in all subfolders. Require an existing destination folder
  for JPG and log output before processing can start.
  - **ไทย:** เพิ่ม ScriptUI สำหรับ EPS ที่เปิดอยู่หรือ Batch จาก Folder/Subfolder และบังคับเลือก Folder ปลายทางก่อนเริ่ม
- Write a UTF-8 `AutoCapture_Batch_*.txt` summary in the output folder alongside
  existing per-job logs. Create it before document validation or opening queued
  files so runtime errors are recorded before an Error Alert. Preserve previous
  logs and continue with later jobs after a per-job failure. This two-log format
  is superseded by the single-log change under Changed below.
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

- Show the current Batch Job as its position within the selected EPS range over
  the selected count, starting at 1 when START EPS selects a later file.
  Give the Current Step label enough width for updated status text.
  - **ไทย:** ช่อง Job แสดงลำดับไฟล์ที่กำลังรันเทียบกับ EPS ที่เลือก และขยายช่อง Current Step เพื่อไม่ให้ข้อความถูกตัด
  - **Validation (2026-11-10):** Not tested. Static source and diff review only;
    Illustrator ScriptUI rendering remains unverified.

- Require every character of a `Name`/`NAME` Type marker whose object name ends
  in `-BC` or `_BC` (case-insensitive) to use Libre Barcode 128 Text Regular.
  Skip its frame with a log reason when the font is wrong or cannot be checked;
  other Type and Group markers keep their existing rules.
  - **ไทย:** Type marker ชื่อท้าย BC ต้องใช้ฟอนต์บาร์โค้ดที่กำหนดทุกตัวอักษร มิฉะนั้นข้ามกรอบและบันทึกเหตุผล
  - **Validation (2026-11-09):** Not tested. Static source and diff review only;
    Illustrator font detection and JPG export remain unverified.

- Sort export frames by their top Y coordinate from top to bottom, then by left
  X from left to right when Y matches, so numbering proceeds one row at a time.
  Keep collection order only when both coordinates match. Include each frame's
  top-left X/Y in exported and skipped log entries.
  - **ไทย:** เรียงกรอบจากแถวบนลงล่าง และจากซ้ายไปขวาในแถวเดียวกัน พร้อมบันทึก X/Y ใน log
  - **Validation (2026-11-07):** Not tested. Static source and diff review only;
    Illustrator export and the absent mock test suite remain unverified.

- Use each export frame's original left-to-right position as the JPG suffix and
  `Work` log value. Keep a Type object in `Name` as a positional marker, but do
  not parse or validate digits after `N` in its object name. A skipped frame does
  not renumber later frames; OID matching remains positional.
  - **ไทย:** เลขท้าย JPG และ `Work` ใช้ลำดับกรอบเดิม ชื่อ Type ใน `Name` ไม่ต้องมีเลขหลัง `N` แต่ยังต้องมี Type อยู่ในกรอบ
  - **Validation (2026-11-04):** Not tested. Static source and diff review only;
    Illustrator export and filename behavior remain unverified.

- Write one UTF-8 `AutoCapture_Log_YYYYMMDD_HHMMSS.txt` per run for both open EPS
  and Batch modes. Include queue events, per-job settings, exported and skipped
  frames, errors, per-job results and final totals in that file. Preserve existing
  logs with numbered suffixes and stop the queue if log writing fails.
  - **ไทย:** รวม log ทั้งรอบและรายละเอียดทุก Job ไว้ไฟล์เดียวต่อการกดเริ่มส่งออก
  - **Validation (2026-11-04):** Not tested. Static source and diff review only;
    Illustrator interaction and export remain unverified.

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

- Reserve enough width for the DATE, SHOP, SKU and No. diagnostic labels so
  values from each Batch EPS filename remain visible when the status updates.
  - **ไทย:** ขยายช่องข้อมูลชื่อไฟล์ใน Status ให้แสดงค่าระหว่าง Batch ได้ครบ
  - **Validation (2026-11-10):** Not tested. Static source and diff review only;
    Illustrator ScriptUI rendering remains unverified.

- Repair malformed ScriptUI statements in the local working copy and restore
  the documented Batch controls: Select all by default, Select some for the
  Optional range, and the directly copyable EPS list.
  - **ไทย:** ซ่อมโค้ดหน้าต่าง Batch ที่มีข้อความแทรกกลางคำสั่ง และให้ตัวเลือกกับรายชื่อไฟล์ตรงตามคู่มือ
  - **Validation (2026-11-10):** Not tested. Static source and diff review only;
    Illustrator ScriptUI interaction remains unverified.

- Derive the four-character SKU directly from the validated job identifier
  instead of a regex capture. A real Illustrator log for
  `1106(M)-SP-N012-03-01.eps` showed `SKU: undefined | 03 | 01` even though JPG
  filenames used `N012-03-01` correctly.
  - **ไทย:** แก้ SKU ใน `JOB INFO` ไม่ให้เป็น `undefined` โดยอ่าน `N012` จากรหัสที่ตรวจผ่านแล้ว
  - **Validation (2026-11-09):** Not tested. Static source and diff review only;
    the user-provided log shows the original failure, and Illustrator rerun is pending.


- Accept a format code without a sequence in document names, such as `N003-A`
  or `N003-R1`, alongside the three existing SKU forms. Interpret a lone two-digit
  suffix as the sequence. Keep numeric format codes when a sequence follows for
  existing jobs such as `N012-11-01`.
  - **ไทย:** รองรับชื่อ SKU-รหัสรูปแบบโดยไม่มีลำดับ และแยก `N003-01` เป็นลำดับตามเดิม
  - **Validation (2026-11-07):** Not tested. Static source and diff review only;
    mock tests are absent and Illustrator export remains unverified.

- Accept trailing document identifiers in all three forms: `SKU`, `SKU-SS`, and
  `SKU-F-SS`. Require the SKU to be one English letter followed by three digits;
  keep optional format and sequence parts in JPG names and log them only when present.
  - **ไทย:** ชื่อ EPS ใช้ SKU อย่างเดียว, SKU-ลำดับ หรือ SKU-รหัสรูปแบบ-ลำดับได้ โดย SKU ต้องเป็นอักษรอังกฤษตามด้วยเลข 3 หลัก
  - **Validation (2026-11-06):** Not tested. Static source and diff review only;
    mock tests are absent and Illustrator export remains unverified.

- Prefer the single populated OID TextFrame within a frame when empty OID
  TextFrames are also present. Keep `EmptyOID` for a lone empty TextFrame and
  skip frames with multiple populated OIDs, multiple empty OIDs without a
  populated OID, or overlapping selected OIDs.
  - **ไทย:** กรอบที่มี OID จริงหนึ่งอันและ TextFrame ว่างจะเลือก OID จริงแทนการข้าม
  - **Validation (2026-11-06):** Not tested. Static source and diff review only;
    Illustrator export remains unverified and mock test files are absent.

- Recognize `NAME` as well as `Name` when selecting the work-marker layer,
  including nested layers. Use the first matching layer in document order.
  - **ไทย:** ตรวจ marker ใน Layer `NAME` ได้ด้วย และใช้ Layer แรกที่พบเมื่อมีทั้งสองชื่อ
  - **Validation (2026-11-06):** Not tested. Static source and diff review only;
    Illustrator export has not been run and mock test files are absent.

- Count only closed four-point Rectangles taller than the configurable
  `minFrameHeightCm` (default 0.5 cm) as export frames. Convert the threshold to
  Illustrator points before comparing height. Exclude shorter or equal-height
  paths before sorting and numbering, so they do not consume frame positions.
  - **ไทย:** ใช้เกณฑ์ความสูงกรอบ 0.5 cm; กรอบที่สูงไม่เกินเกณฑ์ไม่กินเลขลำดับ
  - **Validation (2026-11-06):** Not tested. Static source and diff review only;
    the test files are absent and Illustrator export with the new threshold has not been run.

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
