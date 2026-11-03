#target illustrator

/**
 * GC-AutoCapture: export frame bounds from an active EPS or a folder of EPS files.
 * Keep this file standalone and ES3-compatible for Adobe ExtendScript.
 * Developer setup, behavior and manual checks are documented in README.md.
 * ส่งออกภาพ JPG ตามขอบเขตกรอบจาก EPS ที่เปิดอยู่หรือจาก Folder แบบ Batch
 * ใช้งานได้ด้วยไฟล์นี้ไฟล์เดียว โดยใช้ไวยากรณ์ ES3 ที่รองรับใน ExtendScript
 * ดูวิธีตั้งค่า แนวทางพัฒนาต่อ และรายการตรวจสอบก่อนส่งต่องานได้ที่ README.md
 */
(function () {
    // Change project defaults here. Illustrator uses 72 points per inch.
    // รวมค่าที่นักพัฒนาปรับได้ไว้ที่นี่ โดย Illustrator ใช้หน่วยพื้นฐาน 72 points ต่อหนึ่งนิ้ว
    var CONFIG = {
        // ชื่อ Layer หรือ Group กรอบ เทียบชื่อเต็มโดยไม่แยกตัวพิมพ์และตัดช่องว่างหัวท้าย
        frameLayerNames: ["CutLine","Cut-Line","กรอบ", "Layout", "FrameLine"],
        // DPI เป้าหมาย: ค่า 72 ให้สเกล 100% หากต้องการภาพละเอียดขึ้นให้ปรับค่านี้
        targetDPI: 120,
        // คุณภาพ JPG ตั้งได้ในช่วง 0–100
        jpegQuality: 100,
        // จำนวนหลักขั้นต่ำของลำดับชิ้นงาน เช่น N12-BC จะได้ 012
        fileNumberDigits: 3,
        // ลำดับ Artboard ที่ใช้ส่งออก เริ่มนับจาก 0 และต้องมีอยู่ในเอกสาร
        exportArtboardIndex: 0,
        // ชื่อ Folder ที่ใช้เก็บ JPG และ log จริง หากเลือก Folder อื่นจะสร้าง Folder นี้ภายใน
        outputFolderName: ".AutoCapture",
        // ความกว้างของช่อง path ใน ScriptUI
        uiWidth: 520
    };

    function normalizeFrameContainerName(name) {
        // Use an ES3-compatible expression instead of String.trim().
        return String(name).replace(/^\s+|\s+$/g, "").toLowerCase();
    }

    function isFrameContainerName(name) {
        var normalizedName = normalizeFrameContainerName(name);
        for (var i = 0; i < CONFIG.frameLayerNames.length; i++) {
            if (normalizedName === normalizeFrameContainerName(CONFIG.frameLayerNames[i])) {
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
            isFiniteNumber(item.height) && item.height > 10;
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
        // Validate only the trailing SKU, format code and sequence. Date,
        // shift and platform prefixes are not required or interpreted here.
        var baseName = documentName.replace(/\.[^.]+$/, "");
        var match = /(?:^|-)([A-Z0-9]{4}-[A-Z0-9]{1,3}-\d{2})$/i.exec(baseName);
        if (!match) {
            return "";
        }
        // Preserve the complete identifier for the output filename.
        return match[1];
    }

    function trimName(item) {
        // Work markers use explicit object Names such as N3-BC or N3_BC.
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
        var oidItems = [];
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
        collectTextFrames(oidLayer, oidItems);
        for (var i = 0; i < frames.length; i++) {
            var number = null;
            var ambiguous = false;
            for (var j = 0; j < names.length; j++) {
                var match = /^N(\d+)(?:[-_]|$)/i.exec(trimName(names[j]));
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
            if (ambiguous || number === null) {
                skippedFrames.push({ bounds: frames[i].bounds, frame: i + 1, number: number,
                    reason: ambiguous ? "Ambiguous or invalid work number / overlapping frames" :
                        "No work number at export position" });
                continue;
            }

            var orderItem = null;
            var ambiguousOrder = false;
            for (var orderIndex = 0; orderIndex < oidItems.length; orderIndex++) {
                if (!containsTextCenter(frames[i].bounds, oidItems[orderIndex])) {
                    continue;
                }
                if (orderItem !== null) {
                    ambiguousOrder = true;
                }
                // An OID inside overlapping frames cannot identify one export.
                for (var frameIndex = 0; frameIndex < frames.length; frameIndex++) {
                    if (frameIndex !== i && containsTextCenter(frames[frameIndex].bounds, oidItems[orderIndex])) {
                        ambiguousOrder = true;
                    }
                }
                orderItem = oidItems[orderIndex];
            }
            if (ambiguousOrder || orderItem === null) {
                skippedFrames.push({ bounds: frames[i].bounds, frame: i + 1, number: number,
                    reason: ambiguousOrder ? "Ambiguous OID / overlapping frames" :
                        "No OID at export position" });
                continue;
            }

            var orderId = getOrderId(orderItem);
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

    // วันที่และเวลาบันทึกใน log แทนชื่อ JPG และเก็บ JPG เดิมไว้เมื่อชื่อซ้ำ
    function createOutputFile(folder, sku, frame) {
        var stem = folder + "/" + sku + "-" + frame.orderId + "-" +
            padNumber(frame.number, CONFIG.fileNumberDigits);
        var file = new File(stem + ".jpg");
        var duplicate = 2;
        while (file.exists) {
            file = new File(stem + "_" + padNumber(duplicate++, 2) + ".jpg");
        }
        return file;
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

    function parseSkuForLog(sku) {
        var match = /^([A-Z0-9]{4})-([A-Z0-9]{1,3})-(\d{2})$/i.exec(sku);
        if (!match) {
            return { sku: sku, format: "", sequence: "" };
        }
        return { sku: match[1], format: match[2], sequence: match[3] };
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
        var skuInfo = parseSkuForLog(sku);
        appendLog(log, "START | Source=" + source + " | SKU=" + skuInfo.sku +
            (skuInfo.format ? " | Format=" + skuInfo.format : "") +
            (skuInfo.sequence ? " | Sequence=" + skuInfo.sequence : "") + " | Output=" + folder.fsName +
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

    function executeJob(doc, folder) {
        var frameContainer = findFrameContainer(doc);
        if (!frameContainer) {
            throw new Error("ไม่พบ Layer หรือ Group ที่ชื่อ " + CONFIG.frameLayerNames.join(" หรือ ") + " ในไฟล์นี้");
        }

        var frames = collectFrames(frameContainer);
        if (frames.length === 0) {
            throw new Error("ไม่พบ Rectangle ที่มี Height มากกว่า 10 สำหรับใช้เป็นกรอบใน '" + frameContainer.name + "'");
        }

        var sku = getSku(doc.name);
        if (!sku) {
            throw new Error("ไม่พบรหัสท้ายชื่อเอกสารในรูปแบบ SKU 4 ตัว-รหัสรูปแบบ 1 ถึง 3 ตัว-ลำดับที่ 2 หลัก เช่น N012-11-01.eps หรือ 1102(M)-SP-L007-N02-01.eps");
        }
        var totalFrames = frames.length;
        var skippedFrames = [];
        frames = prepareExports(doc, frames, skippedFrames);
        var skipped = totalFrames - frames.length;
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
        return { exported: log.exported, skipped: skipped, logFile: log.file };
    }

    function createUniqueLogFile(folder, prefix) {
        var started = new Date();
        var stem = folder + "/" + prefix + formatDateTime(started, true);
        var file = new File(stem + ".txt");
        var duplicate = 2;
        while (file.exists) {
            file = new File(stem + "_" + padNumber(duplicate++, 2) + ".txt");
        }
        return file;
    }

    function createBatchLog(folder, mode) {
        var log = { file: createUniqueLogFile(folder, "AutoCapture_Batch_") };
        appendLog(log, "START | Mode=" + mode + " | Output=" + folder.fsName);
        return log;
    }

    function collectEpsFiles(folder, result) {
        var entries = folder.getFiles();
        for (var i = 0; i < entries.length; i++) {
            if (entries[i] instanceof Folder) {
                collectEpsFiles(entries[i], result);
            } else if (entries[i] instanceof File && /\.eps$/i.test(entries[i].name)) {
                result.push(entries[i]);
            }
        }
    }

    function sortFilesByPath(files) {
        files.sort(function (a, b) {
            var left = String(a.fsName).toLowerCase();
            var right = String(b.fsName).toLowerCase();
            return left < right ? -1 : (left > right ? 1 : 0);
        });
    }

    function getDocumentPath(doc) {
        try {
            return String(doc.fullName.fsName).toLowerCase();
        } catch (error) {
            return "";
        }
    }

    function findOpenDocument(file) {
        var path = String(file.fsName).toLowerCase();
        for (var i = 0; i < app.documents.length; i++) {
            if (getDocumentPath(app.documents[i]) === path) {
                return app.documents[i];
            }
        }
        return null;
    }

    function setUiError(label, message) {
        label.text = message;
        try {
            label.graphics.foregroundColor = label.graphics.newPen(label.graphics.PenType.SOLID_COLOR,
                [0.8, 0, 0], 1);
        } catch (colorError) {}
    }

    function ensureOutputFolder(selectedFolder) {
        var destination = selectedFolder;
        if (String(selectedFolder.name) !== CONFIG.outputFolderName) {
            destination = new Folder(selectedFolder.fsName + "/" + CONFIG.outputFolderName);
            if (!destination.exists && !destination.create()) {
                throw new Error("สร้าง Folder ปลายทางไม่สำเร็จ: " + destination.fsName + " " + destination.error);
            }
        }
        if (!destination.exists) {
            throw new Error("Folder ปลายทางไม่มีอยู่จริง: " + destination.fsName);
        }
        return destination;
    }

    function showCaptureDialog() {
        var dialog = new Window("dialog", "GC-AutoCapture");
        dialog.orientation = "column";
        dialog.alignChildren = "fill";

        var modePanel = dialog.add("panel", undefined, "โหมดการทำงาน");
        modePanel.orientation = "column";
        modePanel.alignChildren = "left";
        var openMode = modePanel.add("radiobutton", undefined, "EPS ที่เปิดอยู่ปัจจุบัน");
        var batchMode = modePanel.add("radiobutton", undefined, "Batch: EPS ทั้งหมดใน Folder และ Subfolder");
        var hasOpenEps = app.documents.length > 0 && /\.eps$/i.test(app.activeDocument.name);
        openMode.value = hasOpenEps;
        batchMode.value = !openMode.value;
        openMode.enabled = hasOpenEps;

        var sourcePanel = dialog.add("panel", undefined, "EPS files (Batch)");
        sourcePanel.orientation = "row";
        sourcePanel.alignChildren = ["fill", "center"];
        var sourcePath = sourcePanel.add("edittext", undefined, "");
        sourcePath.preferredSize.width = CONFIG.uiWidth;
        var sourceBrowse = sourcePanel.add("button", undefined, "Browse...");

        var destinationPanel = dialog.add("panel", undefined, "Folder ปลายทาง (Output และ Log)");
        destinationPanel.orientation = "row";
        destinationPanel.alignChildren = ["fill", "center"];
        var destinationPath = destinationPanel.add("edittext", undefined, "");
        destinationPath.preferredSize.width = CONFIG.uiWidth;
        var destinationBrowse = destinationPanel.add("button", undefined, "Browse...");

        var status = dialog.add("statictext", undefined, "ต้องเลือก Folder ปลายทางก่อนเริ่มทำงาน");
        status.characters = 80;
        var buttons = dialog.add("group");
        buttons.alignment = "right";
        var startButton = buttons.add("button", undefined, "เริ่มส่งออก");
        var cancelButton = buttons.add("button", undefined, "ยกเลิก", { name: "cancel" });
        var selection = null;

        function updateMode() {
            sourcePanel.enabled = batchMode.value;
        }
        openMode.onClick = updateMode;
        batchMode.onClick = updateMode;
        updateMode();

        sourceBrowse.onClick = function () {
            var selected = Folder.selectDialog("เลือก Folder ที่ต้องการค้นหา EPS รวม Subfolder");
            if (selected) {
                sourcePath.text = selected.fsName;
            }
        };
        destinationBrowse.onClick = function () {
            var initial = null;
            if (destinationPath.text) {
                initial = new Folder(destinationPath.text);
            } else if (app.documents.length > 0) {
                initial = getDefaultFolder(app.activeDocument);
            }
            var selected = Folder.selectDialog("เลือก Folder ปลายทางสำหรับ Output และ Log", initial);
            if (selected) {
                destinationPath.text = selected.fsName;
            }
        };
        startButton.onClick = function () {
            var selectedDestination = new Folder(destinationPath.text);
            if (!destinationPath.text || !selectedDestination.exists) {
                setUiError(status, "กรุณาเลือก Folder ปลายทางที่มีอยู่จริง");
                return;
            }
            var source = null;
            if (batchMode.value) {
                source = new Folder(sourcePath.text);
                if (!sourcePath.text || !source.exists) {
                    setUiError(status, "กรุณาเลือก Folder ต้นทางที่มีอยู่จริงสำหรับ Batch");
                    return;
                }
            } else if (app.documents.length === 0) {
                setUiError(status, "ไม่พบ EPS ที่เปิดอยู่ใน Illustrator");
                return;
            } else if (!/\.eps$/i.test(app.activeDocument.name)) {
                setUiError(status, "เอกสารที่เปิดอยู่ปัจจุบันไม่ใช่ไฟล์ EPS");
                return;
            }
            var destination = null;
            try {
                destination = ensureOutputFolder(selectedDestination);
            } catch (folderError) {
                setUiError(status, folderError.message);
                return;
            }
            selection = {
                mode: batchMode.value ? "BATCH" : "OPEN_EPS",
                source: source,
                destination: destination,
                document: batchMode.value ? null : app.activeDocument
            };
            dialog.close(1);
        };
        cancelButton.onClick = function () { dialog.close(0); };
        return dialog.show() === 1 ? selection : null;
    }

    function runSelectionWithLog(selection, batchLog) {
        var files = [];
        var completed = 0;
        var failed = 0;
        var exported = 0;
        var skipped = 0;
        var firstError = "";
        var originalDocument = app.documents.length > 0 ? app.activeDocument : null;

        if (selection.mode === "OPEN_EPS") {
            files.push(selection.document);
        } else {
            collectEpsFiles(selection.source, files);
            sortFilesByPath(files);
            appendLog(batchLog, "DISCOVERED | Source=" + selection.source.fsName + " | EPS files=" + files.length);
            if (files.length === 0) {
                failed = 1;
                firstError = "ไม่พบไฟล์ EPS ใน Folder หรือ Subfolder ที่เลือก";
                appendLog(batchLog, "ERROR | " + firstError);
            }
        }

        for (var i = 0; i < files.length; i++) {
            var doc = null;
            var openedByScript = false;
            var sourceName = selection.mode === "OPEN_EPS" ? files[i].name : files[i].fsName;
            try {
                if (selection.mode === "OPEN_EPS") {
                    doc = files[i];
                } else {
                    doc = findOpenDocument(files[i]);
                    if (!doc) {
                        doc = app.open(files[i]);
                        openedByScript = true;
                    } else {
                        doc.activate();
                    }
                }
                appendLog(batchLog, "JOB START | " + sourceName);
                var result = executeJob(doc, selection.destination);
                completed++;
                exported += result.exported;
                skipped += result.skipped;
                appendLog(batchLog, "JOB END | Status=SUCCESS | Source=" + sourceName +
                    " | Exported=" + result.exported + " | Skipped=" + result.skipped +
                    " | Log=" + result.logFile.fsName);
            } catch (jobError) {
                failed++;
                if (!firstError) {
                    firstError = sourceName + ": " + jobError.message;
                }
                appendLog(batchLog, "ERROR | Source=" + sourceName + " | " + jobError.message);
            } finally {
                if (openedByScript && doc) {
                    try {
                        doc.close(SaveOptions.DONOTSAVECHANGES);
                    } catch (closeError) {
                        failed++;
                        if (!firstError) {
                            firstError = sourceName + ": ปิด EPS ไม่สำเร็จ: " + closeError.message;
                        }
                        appendLog(batchLog, "ERROR | Source=" + sourceName + " | Close failed: " + closeError.message);
                    }
                }
            }
        }

        if (originalDocument) {
            try {
                originalDocument.activate();
            } catch (activateError) {
                failed++;
                if (!firstError) {
                    firstError = "คืนเอกสารเดิมไม่สำเร็จ: " + activateError.message;
                }
                appendLog(batchLog, "ERROR | Restore active document: " + activateError.message);
            }
        }
        appendLog(batchLog, "END | Status=" + (failed > 0 ? "FAILED" : "SUCCESS") +
            " | Jobs=" + files.length + " | Completed=" + completed + " | Failed=" + failed +
            " | Exported=" + exported + " | Skipped=" + skipped);

        if (failed > 0) {
            throw new Error("พบข้อผิดพลาด " + failed + " รายการ\n" + firstError + "\nBatch log: " + batchLog.file.fsName);
        }
        alert("Export เสร็จสิ้น\nJobs: " + completed + "\nJPG: " + exported + "\nข้าม: " + skipped +
            "\nปลายทาง: " + selection.destination.fsName + "\nBatch log: " + batchLog.file.fsName);
    }

    function runSelection(selection) {
        var batchLog = createBatchLog(selection.destination, selection.mode);
        try {
            runSelectionWithLog(selection, batchLog);
        } catch (error) {
            var message = error.message;
            try {
                appendLog(batchLog, "ALERT ERROR | " + message);
            } catch (logError) {
                message += "\nเขียน Batch log เพิ่มเติมไม่สำเร็จ: " + logError.message;
            }
            if (message.indexOf(batchLog.file.fsName) < 0) {
                message += "\nBatch log: " + batchLog.file.fsName;
            }
            throw new Error(message);
        }
    }

    // Destination is selected before processing so every runtime Error Alert can
    // refer to a UTF-8 batch log in that folder.
    try {
        var selection = showCaptureDialog();
        if (selection) {
            runSelection(selection);
        }
    } catch (error) {
        alert("เกิดข้อผิดพลาด: " + error.message);
    }
}());
