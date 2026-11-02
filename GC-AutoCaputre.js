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
        // ชื่อ Layer หรือ Group ที่ใช้เก็บกรอบ ต้องตรงตัว รวมถึงตัวพิมพ์เล็กและใหญ่
        frameLayerNames: ["CutLine","กรอบ", "Layout", "FrameLine"],
        // DPI เป้าหมาย: ค่า 72 ให้สเกล 100% หากต้องการภาพละเอียดขึ้นให้ปรับค่านี้
        targetDPI: 96,
        // คุณภาพ JPG ตั้งได้ในช่วง 0–100
        jpegQuality: 100,
        // จำนวนหลักขั้นต่ำของลำดับชิ้นงาน เช่น N12-BC จะได้ 012
        fileNumberDigits: 3,
        // ลำดับ Artboard ที่ใช้ส่งออก เริ่มนับจาก 0 และต้องมีอยู่ในเอกสาร
        exportArtboardIndex: 0
    };

    function isFrameContainerName(name) {
        for (var i = 0; i < CONFIG.frameLayerNames.length; i++) {
            if (name === CONFIG.frameLayerNames[i]) {
                return true;
            }
        }
        return false;
    }

    function findFrameContainerIn(container) {
        if (isFrameContainerName(container.name)) {
            return container;
        }
        var layers = container.layers || [];
        for (var i = 0; i < layers.length; i++) {
            var nestedLayer = findFrameContainerIn(layers[i]);
            if (nestedLayer) {
                return nestedLayer;
            }
        }
        var items = container.pageItems || [];
        for (var j = 0; j < items.length; j++) {
            var item = items[j];
            if (item.parent && item.parent !== container) {
                continue;
            }
            if (item.typename === "GroupItem") {
                var nestedGroup = findFrameContainerIn(item);
                if (nestedGroup) {
                    return nestedGroup;
                }
            }
        }
        return null;
    }

    function findFrameContainer(doc) {
        // Use only the first matching Layer or Group found in document order.
        // ใช้ Layer หรือ Group แรกที่ชื่อตรง และไม่รวมกรอบจากหลาย container
        for (var i = 0; i < doc.layers.length; i++) {
            var container = findFrameContainerIn(doc.layers[i]);
            if (container) {
                return container;
            }
        }
        return null;
    }

    function isRectangleFrame(item) {
        return item.typename === "PathItem" && item.closed === true &&
            item.pathPoints && item.pathPoints.length === 4 &&
            isFiniteNumber(item.height) && item.height > 1;
    }

    function collectRectangleFrames(container, frames, sourceIndex) {
        var items = container.pageItems || [];
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            // Illustrator Layer.pageItems may expose descendants as well.
            if (item.parent && item.parent !== container) {
                continue;
            }
            if (isRectangleFrame(item)) {
                frames.push({
                    bounds: copyBounds(item.geometricBounds),
                    sourceIndex: sourceIndex.value++
                });
            } else if (item.typename === "GroupItem") {
                collectRectangleFrames(item, frames, sourceIndex);
            }
        }
        var layers = container.layers || [];
        for (var j = 0; j < layers.length; j++) {
            collectRectangleFrames(layers[j], frames, sourceIndex);
        }
    }

    // รวบรวมพิกัดกรอบไว้ก่อนเปลี่ยน Artboard แล้วเรียงลำดับสำหรับตั้งชื่อไฟล์
    function collectFrames(container) {
        var frames = [];
        collectRectangleFrames(container, frames, { value: 0 });
        frames.sort(function (a, b) {
            // Bounds are [left, top, right, bottom]. Break ties explicitly:
            // older ExtendScript engines do not guarantee a stable sort.
            // พิกัดเรียงเป็น [ซ้าย, บน, ขวา, ล่าง] โดยเรียงจากซ้ายไปขวาก่อน
            // หากพิกัดซ้ายเท่ากัน ให้ใช้ลำดับเดิม เพื่อให้ผลคงที่บน ExtendScript รุ่นเก่า
            return (a.bounds[0] - b.bounds[0]) || (a.sourceIndex - b.sourceIndex);
        });
        return frames;
    }

    function getFrameContainerVisibility(container) {
        return container.typename === "Layer" ? container.visible : !container.hidden;
    }

    function setFrameContainerVisibility(container, visible) {
        if (container.typename === "Layer") {
            container.visible = visible;
        } else {
            container.hidden = !visible;
        }
    }

    function isFiniteNumber(value) {
        return typeof value === "number" && isFinite(value);
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

    function findNamedLayer(layers, name) {
        for (var i = 0; i < layers.length; i++) {
            if (layers[i].name === name) {
                return layers[i];
            }
            var nested = findNamedLayer(layers[i].layers || [], name);
            if (nested) {
                return nested;
            }
        }
        return null;
    }

    // Walk stacking order from top to bottom, including grouped Type objects.
    function collectTextFrames(container, result) {
        var items = container.pageItems || [];
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            // Some Illustrator collections expose descendants as well as children.
            if (item.parent && item.parent !== container) {
                continue;
            }
            if (item.typename === "TextFrame") {
                result.push(item);
            } else if (item.typename === "GroupItem") {
                collectTextFrames(item, result);
            }
        }
        var layers = container.layers || [];
        for (var j = 0; j < layers.length; j++) {
            collectTextFrames(layers[j], result);
        }
    }

    function getSku(documentName) {
        // MMDD and SKU are required; shift, platform and set are optional.
        var baseName = documentName.replace(/\.[^.]+$/, "");
        var match = /^(\d{2})(\d{2})(?:\([A-Z]+\))?-(?:[A-Z]+-)?([A-Z]+\d+(?:-[A-Z0-9]+)*)$/i.exec(baseName);
        if (!match) {
            return "";
        }
        var month = Number(match[1]);
        var day = Number(match[2]);
        var days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (month < 1 || month > 12 || day < 1 || day > days[month - 1]) {
            return "";
        }
        // Preserve the original set suffix: N012-16-01 stays N012-16-01.
        return match[3];
    }

    function trimName(item) {
        // Work markers use explicit object Names such as N3-BC.
        return String(item.name || "").replace(/^\s+|\s+$/g, "");
    }

    function getOrderId(item) {
        // Illustrator displays contents in the Layers panel when Name is empty.
        var name = trimName(item);
        return name || String(item.contents || "").replace(/^\s+|\s+$/g, "");
    }

    function containsTextCenter(bounds, item) {
        var textBounds = item.geometricBounds;
        var x = (textBounds[0] + textBounds[2]) / 2;
        var y = (textBounds[1] + textBounds[3]) / 2;
        // Shared edges belong to the frame on the right / below.
        return x >= bounds[0] && x < bounds[2] && y <= bounds[1] && y > bounds[3];
    }

    function prepareExports(doc, frames, skippedFrames) {
        var nameLayer = findNamedLayer(doc.layers, "Name");
        var oidLayer = findNamedLayer(doc.layers, "OID");
        var names = [];
        var orders = [];
        var exports = [];
        skippedFrames = skippedFrames || [];
        if (!nameLayer || !oidLayer) {
            for (var missing = 0; missing < frames.length; missing++) {
                skippedFrames.push({ bounds: frames[missing].bounds, frame: missing + 1,
                    reason: "Missing layer: " + (!nameLayer ? "Name " : "") + (!oidLayer ? "OID" : "") });
            }
            return exports;
        }
        collectTextFrames(nameLayer, names);
        collectTextFrames(oidLayer, orders);
        // Bottommost Type is order 1. Keep empty slots to avoid shifting pairs.
        orders.reverse();
        for (var i = 0; i < frames.length; i++) {
            var number = null;
            var ambiguous = false;
            for (var j = 0; j < names.length; j++) {
                var match = /^N(\d+)(?:-|$)/i.exec(trimName(names[j]));
                if (!match || !containsTextCenter(frames[i].bounds, names[j])) {
                    continue;
                }
                var value = Number(match[1]);
                if (!isFiniteNumber(value) || value < 1 || value > 9007199254740991) {
                    ambiguous = true;
                    continue;
                }
                if (number !== null && number !== value) {
                    ambiguous = true;
                }
                // A marker inside overlapping frames cannot identify one export.
                for (var k = 0; k < frames.length; k++) {
                    if (k !== i && containsTextCenter(frames[k].bounds, names[j])) {
                        ambiguous = true;
                    }
                }
                number = value;
            }
            if (ambiguous || number === null || number > orders.length) {
                skippedFrames.push({ bounds: frames[i].bounds, frame: i + 1, number: number,
                    reason: ambiguous ? "Ambiguous or invalid work number / overlapping frames" :
                        (number === null ? "No work number at export position" : "No matching OID slot") });
                continue;
            }
            var orderId = getOrderId(orders[number - 1]);
            // OID may be numeric or ASCII letters mixed with numbers. Keep invalid
            // values out of filenames, but still export the matched work item.
            if (!/^[A-Z0-9]*\d[A-Z0-9]*$/i.test(orderId)) {
                orderId = "EmptyOID";
            }
            exports.push({ bounds: frames[i].bounds, frame: i + 1, number: number, orderId: orderId });
        }
        return exports;
    }

    function padNumber(number, digits) {
        var text = String(number);
        while (text.length < digits) {
            text = "0" + text;
        }
        return text;
    }

    // วันที่และเวลาบันทึกใน log แทนชื่อ JPG
    function createOutputFile(folder, sku, frame) {
        return new File(folder + "/" + sku + "-" + frame.orderId + "-" +
            padNumber(frame.number, CONFIG.fileNumberDigits) + ".jpg");
    }

    function formatDateTime(date, compact) {
        var day = padNumber(date.getFullYear(), 4) + (compact ? "" : "-") +
            padNumber(date.getMonth() + 1, 2) + (compact ? "" : "-") + padNumber(date.getDate(), 2);
        var time = padNumber(date.getHours(), 2) + (compact ? "" : ":") +
            padNumber(date.getMinutes(), 2) + (compact ? "" : ":") + padNumber(date.getSeconds(), 2);
        return day + (compact ? "_" : " ") + time;
    }

    function appendLog(log, message, date) {
        log.file.encoding = "UTF-8";
        if (!log.file.open("a")) {
            throw new Error("เปิด log ไม่สำเร็จ: " + log.file.fsName + " " + log.file.error);
        }
        try {
            if (!log.file.writeln("[" + formatDateTime(date || new Date(), false) + "] " + message)) {
                throw new Error("เขียน log ไม่สำเร็จ: " + log.file.fsName + " " + log.file.error);
            }
        } finally {
            log.file.close();
        }
    }

    function splitSkuForLog(sku) {
        var parts = sku.split("-");
        if (parts.length < 3) {
            return { sku: sku, set: "" };
        }
        return { sku: parts.slice(0, parts.length - 1).join("-"), set: parts[parts.length - 1] };
    }

    function createLog(doc, folder, sku, total, planned, skipped) {
        var started = new Date();
        var stem = folder + "/AutoCapture_Log_" + formatDateTime(started, true);
        var file = new File(stem + ".txt");
        var duplicate = 2;
        while (file.exists) {
            file = new File(stem + "_" + padNumber(duplicate++, 2) + ".txt");
        }
        var source = doc.name;
        try { source = doc.fullName.fsName; } catch (unsavedError) {}
        var log = { file: file, total: total, planned: planned, skipped: skipped, exported: 0 };
        var skuInfo = splitSkuForLog(sku);
        appendLog(log, "START | Source=" + source + " | SKU=" + skuInfo.sku +
            (skuInfo.set ? ", Set=" + skuInfo.set : "") + " | Output=" + folder.fsName +
            " | DPI=" + CONFIG.targetDPI + " | JPEG quality=" + CONFIG.jpegQuality +
            " | Frames=" + total + " | Planned=" + planned + " | Skipped=" + skipped +
            " | Times use the computer's local timezone", started);
        return log;
    }

    function finishLog(log, status) {
        appendLog(log, "END | Status=" + status + " | Frames=" + log.total + " | Exported=" + log.exported +
            " | Skipped=" + log.skipped + " | Not exported=" + (log.planned - log.exported));
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
    function restoreDocumentState(doc, frameContainer, state) {
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
            // คืนการแสดงหรือซ่อน Layer/Group ให้ตรงกับสถานะก่อนรัน
            setFrameContainerVisibility(frameContainer, state.frameVisible);
        } catch (visibilityError) {
            errors.push("Frame container: " + visibilityError.message);
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
    function exportFrames(doc, frameContainer, frames, folder, sku, log) {
        var artboard = doc.artboards[CONFIG.exportArtboardIndex];
        // เก็บค่าก่อนแก้เอกสาร เพื่อใช้ทั้งเมื่อส่งออกสำเร็จและเมื่อเกิดข้อผิดพลาด
        var state = {
            bounds: copyBounds(artboard.artboardRect),
            frameVisible: getFrameContainerVisibility(frameContainer),
            activeArtboardIndex: doc.artboards.getActiveArtboardIndex(),
            borderLayers: []
        };
        collectBorderLayers(doc.layers, state.borderLayers);
        var options = createExportOptions();
        var exportError = null;
        var restoreErrors = [];

        try {
            // JPEG clipping uses the active artboard. Always select the board
            // whose bounds we resize, then restore the user's selection.
            // การตัดขอบ JPG อิง Artboard ที่ active จึงต้องเลือกตัวเดียวกับที่ปรับขอบเขต
            doc.artboards.setActiveArtboardIndex(CONFIG.exportArtboardIndex);
            // ซ่อน Layer หรือ Group กรอบ เพื่อไม่ให้เส้นกรอบติดไปในภาพที่ส่งออก
            setFrameContainerVisibility(frameContainer, false);
            for (var b = 0; b < state.borderLayers.length; b++) {
                state.borderLayers[b].layer.visible = false;
            }
            for (var i = 0; i < frames.length; i++) {
                // ย้ายและปรับขนาด Artboard ให้พอดีกับกรอบก่อนส่งออกแต่ละภาพ
                artboard.artboardRect = frames[i].bounds;
                var outputFile = createOutputFile(folder, sku, frames[i]);
                doc.exportFile(outputFile, ExportType.JPEG, options);
                log.exported++;
                // Record completion time after Illustrator has written this JPEG.
                appendLog(log, "EXPORTED | Frame=" + frames[i].frame + " | Work=" + frames[i].number +
                    " | OID=" + frames[i].orderId + " | File=" + outputFile.fsName +
                    " | Bounds=" + frames[i].bounds.join(","));
            }
        } catch (error) {
            exportError = new Error((typeof i === "number" && i < frames.length ?
                "Frame=" + frames[i].frame + " Work=" + frames[i].number + " OID=" + frames[i].orderId + ": " : "") + error.message);
        } finally {
            restoreErrors = restoreDocumentState(doc, frameContainer, state);
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

    // ลำดับหลัก: ตรวจเอกสาร → หา Layer/Group และกรอบ → เลือกปลายทาง → ส่งออก
    function run() {
        if (app.documents.length === 0) {
            alert("กรุณาเปิดเอกสารใน Illustrator ก่อนรันสคริปต์");
            return;
        }

        var doc = app.activeDocument;
        var frameContainer = findFrameContainer(doc);
        if (!frameContainer) {
            alert("ไม่พบ Layer หรือ Group ที่ชื่อ " + CONFIG.frameLayerNames.join(" หรือ ") + " ในไฟล์นี้");
            return;
        }

        var frames = collectFrames(frameContainer);
        if (frames.length === 0) {
            alert("ไม่พบ Rectangle ที่มี Height มากกว่า 1 สำหรับใช้เป็นกรอบใน '" + frameContainer.name + "'");
            return;
        }

        var sku = getSku(doc.name);
        if (!sku) {
            alert("ไม่พบเดือน วัน และ SKU ในชื่อเอกสาร ใช้รูปแบบ เช่น 1028-N012-03.eps หรือ 1028-TT-N012-03-01.eps");
            return;
        }
        var totalFrames = frames.length;
        var skippedFrames = [];
        frames = prepareExports(doc, frames, skippedFrames);
        var skipped = totalFrames - frames.length;

        // ให้ผู้ใช้เลือกปลายทางก่อนเริ่มเปลี่ยนสถานะเอกสาร
        var folder = Folder.selectDialog("เลือกโฟลเดอร์สำหรับบันทึกไฟล์ JPG", getDefaultFolder(doc));
        if (!folder) {
            // การกดยกเลิกให้จบการทำงานเงียบ ๆ โดยยังไม่ส่งออกหรือแก้ Artboard
            return;
        }

        var log = createLog(doc, folder, sku, totalFrames, frames.length, skipped);
        try {
            for (var s = 0; s < skippedFrames.length; s++) {
                var entry = skippedFrames[s];
                appendLog(log, "SKIPPED | Frame=" + entry.frame + " | Work=" +
                    (entry.number === undefined || entry.number === null ? "-" : entry.number) +
                    " | Reason=" + entry.reason + " | Bounds=" + entry.bounds.join(","));
            }
            if (frames.length > 0) {
                exportFrames(doc, frameContainer, frames, folder, sku, log);
            }
            finishLog(log, frames.length > 0 ? "SUCCESS" : "ALL_SKIPPED");
        } catch (error) {
            var message = error.message;
            try {
                appendLog(log, "ERROR | " + message);
                finishLog(log, "FAILED");
            } catch (logError) {
                message += "\n" + logError.message;
            }
            throw new Error(message + "\nLog: " + log.file.fsName);
        }
        alert("Export เสร็จสิ้นทั้งหมด " + frames.length + " รูป\nข้ามพื้นที่ว่าง " + skipped +
            " รูป\nบันทึกที่: " + folder.fsName + "\nLog: " + log.file.fsName);
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
