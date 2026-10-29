# Changelog / ประวัติการเปลี่ยนแปลง

Changes to GC-AutoCapture are recorded here, newest first. Each entry includes
an English description and a short Thai summary for everyone on the team.

สรุปสิ่งที่เพิ่ม ปรับ และแก้ไข โดยรายการล่าสุดอยู่ด้านบน

## Unreleased / ยังไม่ออกเวอร์ชัน

These changes describe the local working copy updated on 2026-10-29.
They have not been committed or assigned a release version.
SKU frame inference, Border visibility and order-aware naming passed seventeen Windows JScript mock integration test groups.
Actual export in Illustrator 28.6.0 passed for the open `1028(M)-TT-N012-16-01.eps` job:
four JPGs exported and visually checked, four empty positions skipped, document
state restored and the source EPS file hash unchanged.
Contributors and commit/PR references must be filled in when the work is committed.

รายการด้านล่างเป็นงานที่แก้ไว้ในเครื่อง ยังไม่ออกเวอร์ชัน ผ่านการทดสอบจำลองและส่งออกภาพจริง 4 ภาพจาก job N012-16 ใน Illustrator แล้ว

### Added / เพิ่ม

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

- Export as `[SKU]_[Order ID]_[work number]_[YYYYMMDDHHmmss].jpg`.
  Extract `N012-03` from job names such as `1028(M)-TT-N012-03-01.eps`.
  Read work numbers from Type object Names such as `N3-BC` in the `Name` layer
  at each export position, and pair with Type object Names in `OID`, counting
  bottom to top. Fall back to Type contents when the OID Name is empty, matching
  the Layers panel display in the real EPS. Preserve empty OID slots and long numeric IDs as strings.
  Skip missing or ambiguous metadata; report exported and skipped counts.
  Read local time separately immediately before each image export.
  - **ไทย:** ใช้ชื่อ SKU, เลขออเดอร์, ลำดับชิ้นงานอย่างน้อย 3 หลัก และเวลาส่งออกแต่ละภาพ โดยข้ามกรอบที่จับคู่ข้อมูลไม่ได้
  - **Validation:** Seventeen Windows JScript mock integration test groups passed,
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
