#target illustrator

/**
 * GC-AutoCapture: export frame bounds from the active Illustrator document.
 * Keep this file standalone and ES3-compatible for Adobe ExtendScript.
 * Developer setup, behavior and manual checks are documented in README.md.
 * ส่งออกภาพ JPG ตามขอบเขตกรอบจากเอกสารที่กำลังเปิดอยู่ใน Illustrator
 * ใช้งานได้ด้วยไฟล์นี้ไฟล์เดียว โดยใช้ไวยากรณ์ ES3 ที่รองรับใน ExtendScript
 * ดูวิธีตั้งค่า แนวทางพัฒนาต่อ และรายการตรวจสอบก่อนส่งต่องานได้ที่ README.md
 */
(function () {
    // Change project defaults here. Illustrator uses 72 points per inch.
    // รวมค่าที่นักพัฒนาปรับได้ไว้ที่นี่ โดย Illustrator ใช้หน่วยพื้นฐาน 72 points ต่อหนึ่งนิ้ว
    var CONFIG = {
        // ชื่อ Layer ที่ใช้เก็บกรอบ ต้องตรงตัว รวมถึงตัวพิมพ์เล็กและใหญ่
        frameLayerNames: ["กรอบ", "Layout"],
        // DPI เป้าหมาย: ค่า 72 ให้สเกล 100% หากต้องการภาพละเอียดขึ้นให้ปรับค่านี้
        targetDPI: 72,
        // คุณภาพ JPG ตั้งได้ในช่วง 0–100
        jpegQuality: 100,
        // จำนวนหลักขั้นต่ำของเลขท้ายชื่อไฟล์ เช่น 2 หลักจะเริ่มที่ 01
        fileNumberDigits: 2,
        // ลำดับ Artboard ที่ใช้ส่งออก เริ่มนับจาก 0 และต้องมีอยู่ในเอกสาร
        exportArtboardIndex: 0,
        // Match a complete SKU token in the document name (case-insensitive).
        // เพิ่ม SKU ใหม่ที่นี่ ค่าระยะ/ขนาดเป็น points (72 pt = 1 inch)
        skuFrameRules: {
            N012: {
                additionalFrames: 1,
                // หากทราบจำนวนภาพทั้งหมด ให้ใส่แทน null เพื่อป้องกันการเพิ่มซ้ำ
                expectedFrameCount: null,
                width: null,       // null = ความกว้างกรอบสุดท้าย
                height: null,      // null = ความสูงกรอบสุดท้าย
                gap: 0,            // ระยะจากขอบขวาไปขอบซ้ายของกรอบใหม่
                topOffset: 0       // บวก = เลื่อนขึ้น จากกรอบสุดท้ายที่มีจริง
            }
        }
    };

    function findFrameLayer(doc) {
        // Preserve document order: use the first matching top-level layer.
        // เลือก Layer ระดับบนสุดตัวแรกที่ชื่อตรง โดยยึดลำดับ Layer ในเอกสาร
        // หากมีทั้งสองชื่อ จะใช้เพียง Layer ที่พบก่อน ไม่รวมกรอบจากหลาย Layer
        for (var i = 0; i < doc.layers.length; i++) {
            for (var j = 0; j < CONFIG.frameLayerNames.length; j++) {
                if (doc.layers[i].name === CONFIG.frameLayerNames[j]) {
                    return doc.layers[i];
                }
            }
        }
        return null;
    }

    // รวบรวมพิกัดกรอบไว้ก่อนเปลี่ยน Artboard แล้วเรียงลำดับสำหรับตั้งชื่อไฟล์
    function collectFrames(layer) {
        var frames = [];
        for (var i = 0; i < layer.pageItems.length; i++) {
            var item = layer.pageItems[i];
            // Preserve the original rule: every PathItem is a frame, even a
            // non-rectangle. Groups and compound paths are not traversed.
            // ใช้ PathItem ทุกตัวเป็นกรอบตามกฎเดิม แม้ไม่ใช่สี่เหลี่ยม
            // ไม่ไล่ค้นวัตถุที่อยู่ภายใน Group หรือ Compound Path เพิ่มเติม
            if (item.typename === "PathItem") {
                frames.push({
                    bounds: copyBounds(item.geometricBounds),
                    sourceIndex: i
                });
            }
        }
        frames.sort(function (a, b) {
            // Bounds are [left, top, right, bottom]. Break ties explicitly:
            // older ExtendScript engines do not guarantee a stable sort.
            // พิกัดเรียงเป็น [ซ้าย, บน, ขวา, ล่าง] โดยเรียงจากซ้ายไปขวาก่อน
            // หากพิกัดซ้ายเท่ากัน ให้ใช้ลำดับเดิม เพื่อให้ผลคงที่บน ExtendScript รุ่นเก่า
            return (a.bounds[0] - b.bounds[0]) || (a.sourceIndex - b.sourceIndex);
        });
        return frames;
    }

    function isFiniteNumber(value) {
        return typeof value === "number" && isFinite(value);
    }

    // Infer only explicitly configured trailing frames; never create document paths.
    // สร้างเฉพาะพิกัดสำหรับส่งออก ไม่เพิ่มวัตถุกรอบลงในเอกสาร
    function appendSkuFrames(documentName, frames) {
        var tokens = documentName.replace(/\.[^.]+$/, "").toUpperCase().split(/[^A-Z0-9]+/);
        var rule = null;
        var sku = "";
        for (var key in CONFIG.skuFrameRules) {
            if (!CONFIG.skuFrameRules.hasOwnProperty(key)) {
                continue;
            }
            for (var i = 0; i < tokens.length; i++) {
                if (tokens[i] === key.toUpperCase()) {
                    if (rule && sku !== key) {
                        throw new Error("พบหลาย SKU ในชื่อไฟล์ กรุณาระบุ SKU เดียว");
                    }
                    rule = CONFIG.skuFrameRules[key];
                    sku = key;
                    break;
                }
            }
        }
        if (!rule) {
            return;
        }
        var count = rule.additionalFrames;
        if (rule.expectedFrameCount !== null) {
            count = rule.expectedFrameCount;
            if (!isFiniteNumber(count) || count < 1 || Math.floor(count) !== count) {
                throw new Error("expectedFrameCount ไม่ถูกต้องสำหรับ " + sku);
            }
            count = Math.max(0, count - frames.length);
        }
        if (!isFiniteNumber(count) || count < 0 || Math.floor(count) !== count) {
            throw new Error("additionalFrames ไม่ถูกต้องสำหรับ " + sku);
        }
        if (count === 0) {
            return;
        }
        var reference = frames[frames.length - 1].bounds;
        var width = rule.width === null ? reference[2] - reference[0] : rule.width;
        var height = rule.height === null ? reference[1] - reference[3] : rule.height;
        if (!isFiniteNumber(width) || width <= 0 || !isFiniteNumber(height) || height <= 0 ||
                !isFiniteNumber(rule.gap) || !isFiniteNumber(rule.topOffset)) {
            throw new Error("ขนาดหรือระยะกรอบไม่ถูกต้องสำหรับ " + sku);
        }
        var right = reference[2];
        var top = reference[1] + rule.topOffset;
        for (var n = 0; n < count; n++) {
            var left = right + rule.gap;
            right = left + width;
            frames.push({ bounds: [left, top, right, top - height] });
        }
    }

    // สร้างอาร์เรย์พิกัดชุดใหม่ เพื่อเก็บค่าแยกจากอาร์เรย์ที่อ่านจาก Illustrator
    function copyBounds(bounds) {
        return [bounds[0], bounds[1], bounds[2], bounds[3]];
    }

    // ใช้โฟลเดอร์ของเอกสารเป็นจุดเริ่มต้นในหน้าต่างเลือกปลายทาง
    function getDefaultFolder(doc) {
        try {
            return doc.path;
        } catch (error) {
            // Unsaved documents may have no path; they can still be exported.
            // เอกสารที่ยังไม่บันทึกอาจอ่าน path ไม่ได้ จึงใช้ Documents แทน
            return Folder.myDocuments;
        }
    }

    // สร้างตัวเลือก JPG โดยแปลง DPI เป็นเปอร์เซ็นต์สเกล และตัดภาพตาม Artboard
    function createExportOptions() {
        var options = new ExportOptionsJPEG();
        var scale = (CONFIG.targetDPI / 72) * 100;
        options.antiAliasing = true;
        options.filterAppearance = true;
        options.qualitySetting = CONFIG.jpegQuality;
        options.horizontalScale = scale;
        options.verticalScale = scale;
        options.artBoardClipping = true;
        return options;
    }

    // สร้างตำแหน่งไฟล์ในรูปแบบ ชื่อเอกสาร_เลขลำดับ.jpg โดยยังไม่เขียนไฟล์จริง
    function createOutputFile(folder, baseName, number) {
        var suffix = String(number);
        // Minimum width only: 1000 must stay 1000, not wrap to 000.
        // เติมศูนย์เฉพาะเมื่อจำนวนหลักยังไม่ครบ ห้ามตัดเลขเมื่อเกินจำนวนหลักที่ตั้งไว้
        while (suffix.length < CONFIG.fileNumberDigits) {
            suffix = "0" + suffix;
        }
        return new File(folder + "/" + baseName + "_" + suffix + ".jpg");
    }

    // เก็บ Border ทุกชั้น รวม sublayer ก่อนเริ่มเปลี่ยน visibility
    function collectBorderLayers(layers, states) {
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            if (layer.name === "Border") {
                states.push({ layer: layer, visible: layer.visible });
            }
            if (layer.layers && layer.layers.length > 0) {
                collectBorderLayers(layer.layers, states);
            }
        }
    }

    // คืนสถานะที่เก็บไว้ก่อนส่งออก และส่งรายการข้อผิดพลาดกลับให้ผู้เรียกจัดการ
    function restoreDocumentState(doc, frameLayer, state) {
        var errors = [];
        // Attempt every restoration even if an earlier one fails.
        // แยก try/catch เพื่อให้ยังพยายามคืนค่าอื่นต่อ แม้การคืนค่าก่อนหน้าจะล้มเหลว
        // คืนขอบเขตเดิมของ Artboard ที่ใช้ส่งออก
        try {
            doc.artboards[CONFIG.exportArtboardIndex].artboardRect = state.bounds;
        } catch (boundsError) {
            errors.push("Artboard: " + boundsError.message);
        }
        try {
            // คืนการแสดงหรือซ่อน Layer ให้ตรงกับสถานะก่อนรัน
            frameLayer.visible = state.frameVisible;
        } catch (visibilityError) {
            errors.push("Layer: " + visibilityError.message);
        }
        for (var i = 0; i < state.borderLayers.length; i++) {
            try {
                state.borderLayers[i].layer.visible = state.borderLayers[i].visible;
            } catch (borderError) {
                errors.push("Border: " + borderError.message);
            }
        }
        try {
            // กลับไปเลือก Artboard ที่ผู้ใช้เลือกไว้ก่อนส่งออก
            doc.artboards.setActiveArtboardIndex(state.activeArtboardIndex);
        } catch (activeArtboardError) {
            errors.push("Active artboard: " + activeArtboardError.message);
        }
        try {
            // ให้หน้าจอ Illustrator แสดงสถานะหลังคืนค่า
            app.redraw();
        } catch (redrawError) {
            errors.push("Redraw: " + redrawError.message);
        }
        return errors;
    }

    // ส่งออกทีละกรอบ โดยเก็บสถานะเอกสารและคืนค่าผ่าน finally เสมอเมื่อเริ่มเปลี่ยนสถานะ
    function exportFrames(doc, frameLayer, frames, folder) {
        var artboard = doc.artboards[CONFIG.exportArtboardIndex];
        // เก็บค่าก่อนแก้เอกสาร เพื่อใช้ทั้งเมื่อส่งออกสำเร็จและเมื่อเกิดข้อผิดพลาด
        var state = {
            bounds: copyBounds(artboard.artboardRect),
            frameVisible: frameLayer.visible,
            activeArtboardIndex: doc.artboards.getActiveArtboardIndex(),
            borderLayers: []
        };
        collectBorderLayers(doc.layers, state.borderLayers);
        // ตัดเฉพาะนามสกุลสุดท้ายออก เช่น งาน.v2.eps จะเหลือ งาน.v2
        var baseName = doc.name.replace(/\.[^.]+$/, "");
        var options = createExportOptions();
        var exportError = null;
        var restoreErrors = [];

        try {
            // JPEG clipping uses the active artboard. Always select the board
            // whose bounds we resize, then restore the user's selection.
            // การตัดขอบ JPG อิง Artboard ที่ active จึงต้องเลือกตัวเดียวกับที่ปรับขอบเขต
            doc.artboards.setActiveArtboardIndex(CONFIG.exportArtboardIndex);
            // ซ่อนทั้ง Layer เพื่อไม่ให้เส้นกรอบติดไปในภาพที่ส่งออก
            frameLayer.visible = false;
            for (var b = 0; b < state.borderLayers.length; b++) {
                state.borderLayers[b].layer.visible = false;
            }
            for (var i = 0; i < frames.length; i++) {
                // ย้ายและปรับขนาด Artboard ให้พอดีกับกรอบก่อนส่งออกแต่ละภาพ
                artboard.artboardRect = frames[i].bounds;
                doc.exportFile(createOutputFile(folder, baseName, i + 1), ExportType.JPEG, options);
            }
        } catch (error) {
            exportError = error;
        } finally {
            restoreErrors = restoreDocumentState(doc, frameLayer, state);
        }

        // Preserve the export failure if cleanup also fails. Show success only
        // after restoration has completed without errors.
        // เก็บทั้งข้อผิดพลาดการส่งออกและการคืนสถานะ เพื่อไม่ให้ข้อมูลข้อผิดพลาดเดิมหายไป
        // จะแจ้งว่าสำเร็จได้ต่อเมื่อส่งออกและคืนสถานะครบโดยไม่มีข้อผิดพลาด
        var messages = [];
        if (exportError) {
            messages.push(exportError.message);
        }
        if (restoreErrors.length > 0) {
            messages.push("คืนสถานะเอกสารไม่ครบ:\n" + restoreErrors.join("\n"));
        }
        if (messages.length > 0) {
            throw new Error(messages.join("\n"));
        }
    }

    // ลำดับหลัก: ตรวจเอกสาร → หา Layer และกรอบ → เลือกปลายทาง → ส่งออก
    function run() {
        if (app.documents.length === 0) {
            alert("กรุณาเปิดเอกสารใน Illustrator ก่อนรันสคริปต์");
            return;
        }

        var doc = app.activeDocument;
        var frameLayer = findFrameLayer(doc);
        if (!frameLayer) {
            alert("ไม่พบ Layer ที่ชื่อ " + CONFIG.frameLayerNames.join(" หรือ ") + " ในไฟล์นี้");
            return;
        }

        var frames = collectFrames(frameLayer);
        if (frames.length === 0) {
            alert("ไม่พบ PathItem สำหรับใช้เป็นกรอบใน Layer '" + frameLayer.name + "'");
            return;
        }

        appendSkuFrames(doc.name, frames);

        // ให้ผู้ใช้เลือกปลายทางก่อนเริ่มเปลี่ยนสถานะเอกสาร
        var folder = Folder.selectDialog("เลือกโฟลเดอร์สำหรับบันทึกไฟล์ JPG", getDefaultFolder(doc));
        if (!folder) {
            // การกดยกเลิกให้จบการทำงานเงียบ ๆ โดยยังไม่ส่งออกหรือแก้ Artboard
            return;
        }

        exportFrames(doc, frameLayer, frames, folder);
        alert("Export เสร็จสิ้นทั้งหมด " + frames.length + " รูป\nบันทึกที่: " + folder.fsName);
    }

    // Keep application errors in one place, including failures before export.
    // The closure prevents helper names leaking into Illustrator's global scope.
    // เริ่มทำงานและรวมการแจ้งข้อผิดพลาดไว้จุดเดียว รวมถึงข้อผิดพลาดก่อนเริ่มส่งออก
    // ฟังก์ชันครอบด้านนอกช่วยจำกัดชื่อตัวแปรและ helper ไม่ให้ชนกับสคริปต์อื่น
    try {
        run();
    } catch (error) {
        alert("เกิดข้อผิดพลาด: " + error.message);
    }
}());
