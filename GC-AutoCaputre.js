// #target illustrator

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
        // ความสูงขั้นต่ำของกรอบเป็นเซนติเมตร (Illustrator API คืนค่า height เป็น points)
        minFrameHeightCm: 0.5,
        // DPI เป้าหมาย: ค่า 72 ให้สเกล 100% หากต้องการภาพละเอียดขึ้นให้ปรับค่านี้
        targetDPI: 96,
        // คุณภาพ JPG ตั้งได้ในช่วง 0–100
        jpegQuality: 100,
        // จำนวนหลักขั้นต่ำของลำดับกรอบ เช่นกรอบที่ 12 จะได้ 012
        fileNumberDigits: 3,
        // ลำดับ Artboard ที่ใช้ส่งออก เริ่มนับจาก 0 และต้องมีอยู่ในเอกสาร
        exportArtboardIndex: 0,
        // ชื่อ Folder ที่ใช้เก็บ JPG และ log จริง หากเลือก Folder อื่นจะสร้าง Folder นี้ภายใน
        outputFolderName: ".AutoCapture",
        // outputFolderName: "",
        // Font required for Type markers whose object names end in -BC or _BC.
        barcodeFontFamily: "Libre Barcode 128 Text",
        barcodeFontStyle: "Regular",
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


    // แปลงเกณฑ์ cm เป็น points ก่อนเทียบกับความสูงจาก Illustrator
    function isRectangleFrame(item) {
        var recHeight = item.height;
        return item.typename === "PathItem" && item.closed === true &&
            item.pathPoints && item.pathPoints.length === 4 &&
            isFiniteNumber(recHeight) && recHeight > CONFIG.minFrameHeightCm * 72 / 2.54;
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
            // Sort rows by Y top to bottom, then frames by X left to right.
            // หาก X และ Y เท่ากัน ให้ใช้ลำดับเดิมเพื่อให้ผลคงที่บน ExtendScript รุ่นเก่า
            return (b.bounds[1] - a.bounds[1]) || (a.bounds[0] - b.bounds[0]) ||
                (a.sourceIndex - b.sourceIndex);
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

    function findNamedLayer(layers, name, alternateName) {
        for (var i = 0; i < layers.length; i++) {
            if (layers[i].name === name || (alternateName && layers[i].name === alternateName)) {
                return layers[i];
            }
            var nested = findNamedLayer(layers[i].layers || [], name, alternateName);
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

    function collectNameMarkers(container, result) {
        var items = container.pageItems || [];
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.parent && item.parent !== container) {
                continue;
            }
            if (item.typename === "TextFrame") {
                result.push(item);
            } else if (item.typename === "GroupItem") {
                // A named group can mark outlined artwork; still inspect nested Type objects.
                if (String(item.name || "").replace(/^\s+|\s+$/g, "") !== "") {
                    result.push(item);
                }
                collectNameMarkers(item, result);
            }
        }
        var layers = container.layers || [];
        for (var j = 0; j < layers.length; j++) {
            collectNameMarkers(layers[j], result);
        }
    }

    function getSku(documentName) {
        // A lone two-digit suffix is a sequence; a letter-led suffix is a format.
        // Numeric formats remain valid when followed by a sequence for old jobs.
        // Date, shift and platform prefixes are not interpreted here.
        var baseName = documentName.replace(/\.[^.]+$/, "");
        var match = /(?:^|-)([A-Z]\d{3}(?:-(?:[A-Z]\d{0,2}|\d{1,3})-\d{2}|-[A-Z]\d{0,2}|-\d{2})?)$/i.exec(baseName);
        if (!match) {
            return "";
        }
        // Preserve the complete identifier for the output filename.
        return match[1];
    }

    function getDocumentInfo(documentName) {
        var filename = String(documentName).replace(/\.[^.]+$/, "");
        var identifier = getSku(documentName);
        var skuInfo = parseSkuForLog(identifier);
        var prefix = identifier ? filename.substring(0, filename.length - identifier.length).replace(/-$/, "") : filename;
        var parts = prefix ? prefix.split("-") : [];
        var date = parts.length > 0 && /^\d{4}(?:\([A-Z]\))?$/i.test(parts[0]) ? parts[0] : "";
        var shop = date && parts.length > 1 && /^[A-Z0-9]+$/i.test(parts[1]) ? parts[1] : "";
        return { filename: filename, date: date, shop: shop, sku: skuInfo.sku,
            skuFormat: skuInfo.format, fileSequence: skuInfo.sequence, identifier: identifier };
    }

    function getOrderId(item) {
        // Illustrator displays contents in the Layers panel when Name is empty.
        var name = String(item.name || "").replace(/^\s+|\s+$/g, "");
        return name || String(item.contents || "").replace(/^\s+|\s+$/g, "");
    }

    function containsItemCenter(bounds, item) {
        var itemBounds = item.geometricBounds;
        var x = (itemBounds[0] + itemBounds[2]) / 2;
        var y = (itemBounds[1] + itemBounds[3]) / 2;
        // Shared edges belong to the frame on the right / below.
        return x >= bounds[0] && x < bounds[2] && y <= bounds[1] && y > bounds[3];
    }

    function hasRequiredBarcodeFont(item) {
        var characters;
        try {
            characters = item.textRange.characters;
            if (!characters || characters.length === 0) {
                return false;
            }
            // Check every character so a mixed-font barcode cannot pass.
            for (var i = 0; i < characters.length; i++) {
                var font = characters[i].characterAttributes.textFont;
                if (!font || font.family !== CONFIG.barcodeFontFamily ||
                        font.style !== CONFIG.barcodeFontStyle) {
                    return false;
                }
            }
        } catch (error) {
            return false;
        }
        return true;
    }

    function prepareExports(doc, frames, skippedFrames) {
        var nameLayer = findNamedLayer(doc.layers, "Name", "NAME");
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
        collectNameMarkers(nameLayer, names);
        collectTextFrames(oidLayer, oidItems);
        for (var i = 0; i < frames.length; i++) {
            var number = i + 1;
            var hasName = false;
            var ambiguousName = false;
            var invalidBarcodeFont = false;
            for (var j = 0; j < names.length; j++) {
                if (!containsItemCenter(frames[i].bounds, names[j])) {
                    continue;
                }
                hasName = true;
                if (names[j].typename === "TextFrame" && /[-_]bc$/i.test(String(names[j].name || "")) &&
                        !hasRequiredBarcodeFont(names[j])) {
                    invalidBarcodeFont = true;
                }
                // A marker inside overlapping frames cannot identify one export.
                for (var k = 0; k < frames.length; k++) {
                    if (k !== i && containsItemCenter(frames[k].bounds, names[j])) {
                        ambiguousName = true;
                    }
                }
            }
            if (ambiguousName || !hasName || invalidBarcodeFont) {
                skippedFrames.push({ bounds: frames[i].bounds, frame: i + 1, number: number,
                    reason: ambiguousName ? "Name marker in overlapping frames" :
                        !hasName ? "No Name marker at export position" :
                        "Name barcode marker requires Libre Barcode 128 Text Regular" });
                continue;
            }

            var orderItem = null;
            var emptyOrderItem = null;
            var orderCount = 0;
            var emptyOrderCount = 0;
            for (var orderIndex = 0; orderIndex < oidItems.length; orderIndex++) {
                if (!containsItemCenter(frames[i].bounds, oidItems[orderIndex])) {
                    continue;
                }
                if (getOrderId(oidItems[orderIndex]) === "") {
                    emptyOrderItem = oidItems[orderIndex];
                    emptyOrderCount++;
                } else {
                    orderItem = oidItems[orderIndex];
                    orderCount++;
                }
            }
            // Empty Type objects are placeholders when a populated OID is present.
            // Keep the existing EmptyOID fallback when the only OID is empty.
            if (orderCount === 0) {
                orderItem = emptyOrderItem;
                orderCount = emptyOrderCount;
            }
            var ambiguousOrder = orderCount > 1;
            if (orderItem !== null && !ambiguousOrder) {
                // An OID inside overlapping frames cannot identify one export.
                for (var frameIndex = 0; frameIndex < frames.length; frameIndex++) {
                    if (frameIndex !== i && containsItemCenter(frames[frameIndex].bounds, orderItem)) {
                        ambiguousOrder = true;
                    }
                }
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

    function ensureOrderFolder(folder, orderId) {
        // orderId ผ่านการตรวจใน prepareExports() แล้ว และคงเป็น string เพื่อรักษาศูนย์นำหน้า
        var destination = new Folder(folder.fsName + "/" + orderId);
        if (!destination.exists && !destination.create()) {
            throw new Error("สร้าง Folder สำหรับ OID: " + orderId + " ไม่สำเร็จ: " +
                destination.fsName + " " + destination.error);
        }
        if (!destination.exists) {
            throw new Error("ไม่พบ Folder สำหรับ OID: " + orderId + ": " + destination.fsName);
        }
        return destination;
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
        try {
            log.file.encoding = "UTF-8";
            if (!log.file.open("a")) {
                throw new Error("เปิด log ไม่สำเร็จ: " + log.file.fsName + " " + log.file.error);
            }
            var writeError = null;
            try {
                if (!log.file.writeln("[" + formatDateTime(date || new Date(), false) + "] " + message)) {
                    throw new Error("เขียน log ไม่สำเร็จ: " + log.file.fsName + " " + log.file.error);
                }
            } catch (error) {
                writeError = error;
            }
            var closed = log.file.close();
            if (writeError) {
                throw writeError;
            }
            if (!closed) {
                throw new Error("ปิด log ไม่สำเร็จ: " + log.file.fsName + " " + log.file.error);
            }
        } catch (logError) {
            log.failed = true;
            throw logError;
        }
    }

    function parseSkuForLog(sku) {
        var match = /^([A-Z]\d{3})(?:-([A-Z]\d{0,2}|\d{1,3})-(\d{2})|-([A-Z]\d{0,2})|-(\d{2}))?$/i.exec(sku);
        if (!match) {
            return { sku: sku, format: "", sequence: "" };
        }
        // The identifier was already validated by getSku(); use its first four
        // characters so the SKU does not depend on a regex capture in ExtendScript.
        return { sku: sku.substring(0, 4), format: match[2] || match[4] || "",
            sequence: match[3] || match[5] || "" };
    }

    // เก็บ Border ทุกชั้น รวม sublayer ก่อนเริ่มเปลี่ยน visibility
    function collectBorderLayers(layers, states) {
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            if (layer.name === "Border" || layer.name === "FC Frame Layer1") {
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
    function exportFrames(doc, frameContainer, frames, folder, sku, log, updateStatus) {
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
                updateStatus("Exporting .jpg " + (i + 1) + "/" + frames.length);
                var orderFolder = ensureOrderFolder(folder, frames[i].orderId);
                var outputFile = createOutputFile(orderFolder, sku, frames[i]);
                // ย้ายและปรับขนาด Artboard ให้พอดีกับกรอบก่อนส่งออกแต่ละภาพ
                artboard.artboardRect = frames[i].bounds;
                doc.exportFile(outputFile, ExportType.JPEG, options);
                log.exported++;
                // Record completion time after Illustrator has written this JPEG.
                appendLog(log, "EXPORTED | Frame[" + frames[i].frame +"]" + " | Work=" + frames[i].number +
                    " | OID: " + frames[i].orderId + " | \nOutput File: " + outputFile.fsName +
                    " | X=" + frames[i].bounds[0] + " | Y=" + frames[i].bounds[1] +
                    " | Bounds=" + frames[i].bounds.join(","));
            }
        } catch (error) {
            exportError = new Error((typeof i === "number" && i < frames.length ?
                "Frame[" + frames[i].frame +"]" + " | Work=" + frames[i].number + " OID: " + frames[i].orderId + ": " : "") + error.message);
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

    function executeJob(doc, folder, log, job, info, updateStatus) {
        var frameContainer = findFrameContainer(doc);
        if (!frameContainer) {
            throw new Error("ไม่พบ Layer หรือ Group ที่ชื่อ " + CONFIG.frameLayerNames.join(" หรือ ") + " ในไฟล์นี้");
        }

        var frames = collectFrames(frameContainer);
        if (frames.length === 0) {
            throw new Error("ไม่พบ Rectangle ที่มี Height มากกว่า " + CONFIG.minFrameHeightCm +
                " cm สำหรับใช้เป็นกรอบใน '" + frameContainer.name + "'");
        }

        var sku = info.identifier;
        if (!sku) {
            throw new Error("\nไม่พบรหัส SKU ในชื่อไฟล์\nต้องมี SKU เป็นตัวอักษรอังกฤษ 1 ตัวตามด้วยเลข 3 หลัก\nตัวอย่าง N012.eps, N012-A.eps, N012-01.eps หรือ L007-N02-01.eps");
        }
        var totalFrames = frames.length;
        var skippedFrames = [];
        frames = prepareExports(doc, frames, skippedFrames);
        var skipped = totalFrames - frames.length;
        job.total = totalFrames;
        job.planned = frames.length;
        job.skipped = skipped;
        log.skipped += skipped;
        appendLog(log, "JOB INFO || FN: " + info.filename + " | DATE: " + (info.date || "-") +
            " | SHOP: " + (info.shop || "-") + " | SKU: " + info.sku +
            (info.skuFormat ? " | " + info.skuFormat : "") +
            (info.fileSequence ? " | " + info.fileSequence : "") +
            " || DPI=" + CONFIG.targetDPI + " | JPEG quality=" + CONFIG.jpegQuality +
            " | Frames=" + totalFrames + " | Planned=" + frames.length + " | Skipped=" + skipped);
        for (var s = 0; s < skippedFrames.length; s++) {
            var entry = skippedFrames[s];
            appendLog(log, "SKIPPED | Frame[" + entry.frame +"]" + " | Work=" +
                (entry.number === undefined || entry.number === null ? "-" : entry.number) +
                " | Reason=" + entry.reason + " | X=" + entry.bounds[0] +
                " | Y=" + entry.bounds[1] + " | Bounds=" + entry.bounds.join(","));
        }
        if (frames.length > 0) {
            exportFrames(doc, frameContainer, frames, folder, sku, log, updateStatus);
        }
        return frames.length > 0 ? "SUCCESS" : "ALL_SKIPPED";
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

    function createLog(folder, mode) {
        var log = { file: createUniqueLogFile(folder, "AutoCapture_Log_"), exported: 0, skipped: 0, failed: false };
        appendLog(log, "START | [Mode] " + mode + " | Output=" + folder.fsName +
            " | Times use the computer's local timezone");
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

    function findEpsBoundary(files, input) {
        var name = String(input).replace(/^\s+|\s+$/g, "");
        if (!name) {
            return { index: -1, error: "" };
        }
        if (!/\.eps$/i.test(name)) {
            name += ".eps";
        }
        var index = -1;
        for (var i = 0; i < files.length; i++) {
            if (String(files[i].name).toLowerCase() === name.toLowerCase()) {
                if (index >= 0) {
                    return { index: -1, error: "!!! ERROR !!! พบชื่อ EPS ซ้ำใน Subfolder: " + name };
                }
                index = i;
            }
        }
        return { index: index, error: index < 0 ? "!!! ERROR !!! ไม่พบ EPS ชื่อ: " + name : "" };
    }

    function getBatchFileSelection(folder, startName, endName) {
        var files = [];
        collectEpsFiles(folder, files);
        sortFilesByPath(files);
        var start = findEpsBoundary(files, startName);
        var end = findEpsBoundary(files, endName);
        var error = start.error || end.error;
        if (!error && start.index >= 0 && end.index >= 0 && start.index > end.index) {
            error = "START EPS อยู่หลัง END EPS ตามลำดับ path";
        }
        var selected = [];
        var first = -1;
        var last = -1;
        if (!error) {
            first = start.index < 0 ? 0 : start.index;
            last = end.index < 0 ? files.length - 1 : end.index;
            for (var i = first; i <= last; i++) {
                selected.push(files[i]);
            }
        }
        return { files: selected, allFiles: files, total: files.length,
            first: first, last: last, error: error };
    }

    function appendEpsTreeLines(node, depth, lines) {
        for (var i = 0; i < node.children.length; i++) {
            var child = node.children[i];
            var indent = new Array(depth + 2).join("    ");
            if (child.isFolder) {
                lines.push(indent + child.name + "/");
                appendEpsTreeLines(child, depth + 1, lines);
            } else {
                var lastFile = true;
                for (var j = i + 1; j < node.children.length; j++) {
                    if (!node.children[j].isFolder) {
                        lastFile = false;
                        break;
                    }
                }
                lines.push(indent + (lastFile ? "└─ " : "├─ ") + child.mark + child.name);
            }
        }
    }

    function getEpsTreeText(folder, batch) {
        var root = { name: folder.name || folder.fsName, isFolder: true, children: [] };
        for (var i = 0; i < batch.allFiles.length; i++) {
            var relative = String(batch.allFiles[i].fsName).substring(String(folder.fsName).length);
            var parts = relative.replace(/^[\\\/]+/, "").split(/[\\\/]/);
            var parent = root;
            for (var p = 0; p < parts.length - 1; p++) {
                var childFolder = null;
                for (var j = 0; j < parent.children.length; j++) {
                    if (parent.children[j].isFolder && parent.children[j].name === parts[p]) {
                        childFolder = parent.children[j];
                        break;
                    }
                }
                if (!childFolder) {
                    childFolder = { name: parts[p], isFolder: true, children: [] };
                    parent.children.push(childFolder);
                }
                parent = childFolder;
            }
            var inRange = !batch.error && i >= batch.first && i <= batch.last;
            parent.children.push({ name: parts[parts.length - 1], isFolder: false,
                mark: inRange ? "[x] " : "[ ] " });
        }
        var lines = [root.name + "/"];
        appendEpsTreeLines(root, 0, lines);
        return lines.join("\r\n");
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
        //Version: เวอร์ชัน
        var dialog = new Window("dialog", "AutoCapture v1.0.0-beta.1");
        dialog.orientation = "column";
        dialog.alignChildren = "fill";

        var modePanel = dialog.add("panel", undefined, "Mode Selection");
        modePanel.orientation = "column";
        modePanel.alignChildren = "left";
        var openMode = modePanel.add("radiobutton", undefined, "Single Mode: ใช้งานกับไฟล์ที่กำลังเปิด");
        var batchMode = modePanel.add("radiobutton", undefined, "Batch Mode: ใช้งานกับหลายไฟล์ => เลือก Folder ต้นทาง");
        var hasOpenEps = app.documents.length > 0 && /\.eps$/i.test(app.activeDocument.name);
        openMode.value = hasOpenEps;
        batchMode.value = !openMode.value;
        openMode.enabled = hasOpenEps;

        var sourcePanel = dialog.add("panel", undefined, "Folder ต้นทาง");
        sourcePanel.orientation = "column";
        sourcePanel.alignChildren = "fill";
        var sourcePathGroup = sourcePanel.add("group");
        sourcePathGroup.orientation = "row";
        sourcePathGroup.alignChildren = ["fill", "center"];
        var sourcePath = sourcePathGroup.add("edittext", undefined, "");
        sourcePath.preferredSize.width = CONFIG.uiWidth;
        var sourceBrowse = sourcePathGroup.add("button", undefined, "Browse...");
        var sourceSelection = sourcePanel.add("group");
        sourceSelection.orientation = "row";
        var selectAll = sourceSelection.add("radiobutton", undefined, "ทุกไฟล์");
        var selectSome = sourceSelection.add("radiobutton", undefined, "เลือกช่วงไฟล์...");
        selectAll.value = true;
        selectSome.value = false;

        var rangePanel = dialog.add("panel", undefined, "โปรดระบุ:  ชื่อไฟล์ <เริ่มต้น>   ,   ชื่อไฟล์ <สุดท้าย>");
        // var rangePanel = dialog.add("panel", undefined, "");
        rangePanel.orientation = "row";
        rangePanel.alignChildren = ["left", "center"];
        rangePanel.add("statictext", undefined, "START EPS: ");
        var startEps = rangePanel.add("edittext", undefined, "");
        startEps.preferredSize.width = 190;
        rangePanel.add("statictext", undefined, "END EPS: ");
        var endEps = rangePanel.add("edittext", undefined, "");
        endEps.preferredSize.width = 190;
        var fileCount = dialog.add("statictext", undefined, "จำนวน EPS ที่พบ: - | จำนวนที่ถูกเลือก: -");
        fileCount.characters = 80;
        var fileListPanel = dialog.add("panel", undefined,
            "List ไฟล์ที่พบ (ลากเมาส์เลือกข้อความได้)  |  [x] = ถูกเลือก, [ ] = ไม่เลือก");
        fileListPanel.orientation = "column";
        fileListPanel.alignChildren = "fill";
        var fileList = fileListPanel.add("edittext", undefined, "",
            { multiline: true, scrollable: true, readonly: true });
        fileList.preferredSize = [CONFIG.uiWidth + 80, 220];

        var destinationPanel = dialog.add("panel", undefined, "Folder ปลายทาง (Output และ Log)");
        destinationPanel.orientation = "row";
        destinationPanel.alignChildren = ["fill", "center"];
        var destinationPath = destinationPanel.add("edittext", undefined, "");
        destinationPath.preferredSize.width = CONFIG.uiWidth;
        var destinationBrowse = destinationPanel.add("button", undefined, "Browse...");

        var status = dialog.add("statictext", undefined, "*** กรุณาระบุ <Folder ปลายทาง> ก่อนเริ่มทำงาน ***");
        status.characters = 80;
        var diagnostic = dialog.add("panel", undefined, "STATUS - Diagnostic");
        diagnostic.orientation = "column";
        diagnostic.alignChildren = "left";
        var jobLabel = diagnostic.add("statictext", undefined, "Job: -");
        jobLabel.characters = 20;
        var fnLabel = diagnostic.add("statictext", undefined, "FN: -");
        fnLabel.characters = 70;
        var dateLabel = diagnostic.add("statictext", undefined, "DATE: -");
        dateLabel.preferredSize.width = CONFIG.uiWidth + 80;
        var shopLabel = diagnostic.add("statictext", undefined, "SHOP: -");
        shopLabel.preferredSize.width = CONFIG.uiWidth + 80;
        var skuLabel = diagnostic.add("statictext", undefined, "SKU: -");
        skuLabel.preferredSize.width = CONFIG.uiWidth + 80;
        var numberLabel = diagnostic.add("statictext", undefined, "No.: -");
        numberLabel.preferredSize.width = CONFIG.uiWidth + 80;
        var stepLabel = diagnostic.add("statictext", undefined, "Current Step: WAITING ...");
        stepLabel.preferredSize.width = CONFIG.uiWidth + 80;
        var buttons = dialog.add("group");
        buttons.alignment = "right";
        var startButton = buttons.add("button", undefined, "START");
        var cancelButton = buttons.add("button", undefined, "Cancel", { name: "cancel" });

        var currentInfo = null;
        var currentJob = "-";
        function showDiagnostic(info, jobName, step) {
            currentInfo = info;
            currentJob = jobName;
            var sku = info && info.identifier ? info.sku : "";
            var format = info && info.skuFormat ? " - " + info.skuFormat : "";
            var sequence = info && info.fileSequence ? " - " + info.fileSequence : "";
            jobLabel.text = "Job: " + (jobName || "-");
            fnLabel.text = "FN: " + (info && info.filename ? info.filename : "-");
            dateLabel.text = "DATE: " + (info && info.date ? info.date : "-");
            shopLabel.text = "SHOP: " + (info && info.shop ? info.shop : "-");
            skuLabel.text = "SKU: " + (sku ? sku + format : "-");
            numberLabel.text = "No.: " + (sku ? sku + format + sequence : "-");
            stepLabel.text = "Current Step: " + step;
            try { dialog.update(); } catch (updateError) {}
        }

        function updateMode() {
            sourcePanel.enabled = batchMode.value;
            rangePanel.enabled = batchMode.value && selectSome.value;
            fileListPanel.enabled = batchMode.value;
            updateFileCount();
            showDiagnostic(openMode.value && hasOpenEps ? getDocumentInfo(app.activeDocument.name) : null,
                openMode.value && hasOpenEps ? "1/1" : "-", "รอเริ่มงาน");
        }
        function updateFileCount() {
            if (!batchMode.value || !sourcePath.text) {
                fileCount.text = "จำนวน EPS ที่พบ: - | จำนวนที่ถูกเลือก: -";
                fileList.text = "";
                return null;
            }
            var folder = new Folder(sourcePath.text);
            if (!folder.exists) {
                fileCount.text = "จำนวน EPS ที่พบ: - | Folder ต้นทางไม่ถูกต้อง";
                fileList.text = "";
                return null;
            }
            try {
                var batch = getBatchFileSelection(folder,
                    selectSome.value ? startEps.text : "", selectSome.value ? endEps.text : "");
                fileCount.text = "จำนวน EPS ที่พบ: " + batch.total + " | จำนวนที่ถูกเลือก: " +
                    (batch.error ? "- (" + batch.error + ")" : batch.files.length);
                fileList.text = getEpsTreeText(folder, batch);
                return batch;
            } catch (scanError) {
                fileCount.text = "ค้นหา EPS ไม่สำเร็จ: " + scanError.message;
                fileList.text = "";
                return { error: scanError.message };
            }
        }
        openMode.onClick = updateMode;
        batchMode.onClick = updateMode;
        function updateSourceSelection() {
            rangePanel.enabled = batchMode.value && selectSome.value;
            updateFileCount();
        }
        selectAll.onClick = updateSourceSelection;
        selectSome.onClick = updateSourceSelection;
        sourcePath.onChange = updateFileCount;
        startEps.onChange = updateFileCount;
        endEps.onChange = updateFileCount;
        updateMode();

        sourceBrowse.onClick = function () {
            var selected = Folder.selectDialog("เลือก Folder ที่ต้องการค้นหา EPS รวม Subfolder");
            if (selected) {
                sourcePath.text = selected.fsName;
                updateFileCount();
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
            var batchFiles = null;
            if (batchMode.value) {
                source = new Folder(sourcePath.text);
                if (!sourcePath.text || !source.exists) {
                    setUiError(status, "กรุณาเลือก Folder ต้นทางที่มีอยู่จริงสำหรับ Batch");
                    return;
                }
                batchFiles = updateFileCount();
                if (!batchFiles || batchFiles.error) {
                    setUiError(status, batchFiles ? batchFiles.error : "ค้นหา EPS ไม่สำเร็จ");
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
            var selection = {
                mode: batchMode.value ? "BATCH" : "ACTIVE_EPS",
                source: source,
                batchFiles: batchFiles,
                startEps: selectSome.value ? startEps.text : "",
                endEps: selectSome.value ? endEps.text : "",
                destination: destination,
                document: batchMode.value ? null : app.activeDocument,
                updateStatus: showDiagnostic
            };
            startButton.enabled = false;
            cancelButton.enabled = false;
            showDiagnostic(selection.document ? getDocumentInfo(selection.document.name) : null,
                selection.document ? "1/1" : "-", "เริ่มประมวลผล");
            try {
                var summary = runSelection(selection);
                showDiagnostic(currentInfo, currentJob, "Job เสร็จสิ้น");
                status.text = "ส่งออกเสร็จสิ้น";
                alert(summary);
            } catch (error) {
                stepLabel.text = "Current Step: เกิดข้อผิดพลาด";
                setUiError(status, error.message);
                alert("เกิดข้อผิดพลาด: " + error.message);
            } finally {
                startButton.enabled = true;
                cancelButton.enabled = true;
                cancelButton.text = "Close";
                try { dialog.update(); } catch (updateError) {}
            }
        };
        cancelButton.onClick = function () { dialog.close(0); };
        dialog.show();
    }

    function runSelectionWithLog(selection, log) {
        var files = [];
        var completed = 0;
        var failed = 0;
        var firstError = "";
        var fatalLogError = null;
        var originalDocument = app.documents.length > 0 ? app.activeDocument : null;

        if (selection.mode === "ACTIVE_EPS") {
            files.push(selection.document);
        } else {
            files = selection.batchFiles.files;
            appendLog(log, "DISCOVERED | Source=" + selection.source.fsName +
                " | EPS files=" + selection.batchFiles.total + " | Selected=" + files.length +
                " | START EPS=" + (selection.startEps || "-") + " | END EPS=" + (selection.endEps || "-"));
            if (files.length === 0) {
                failed = 1;
                firstError = "ไม่พบไฟล์ EPS ใน Folder หรือ Subfolder ที่เลือก";
                appendLog(log, "ERROR | " + firstError);
            }
        }

        for (var i = 0; i < files.length; i++) {
            var doc = null;
            var openedByScript = false;
            var sourceName = selection.mode === "ACTIVE_EPS" ? files[i].name : files[i].fsName;
            if (selection.mode === "ACTIVE_EPS") {
                try { sourceName = files[i].fullName.fsName; } catch (unsavedError) {}
            }
            var info = getDocumentInfo(files[i].name);
            var jobPosition = (i + 1) + "/" + files.length;
            var job = { total: 0, planned: 0, skipped: 0, exportedStart: log.exported };
            var jobStatus = "FAILED";
            try {
                selection.updateStatus(info, jobPosition, "Opening EPS...");
                appendLog(log,
                    "\n====================\n" +
                    " | JOB START | Source=" + sourceName+
                    "\n====================\n");
                if (selection.mode === "ACTIVE_EPS") {
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
                info = getDocumentInfo(doc.name);
                selection.updateStatus(info, jobPosition, "Filename Generating...");
                jobStatus = executeJob(doc, selection.destination, log, job, info, function (step) {
                    selection.updateStatus(info, jobPosition, step);
                });
                completed++;
                selection.updateStatus(info, jobPosition, "Export Success !");
            } catch (jobError) {
                if (log.failed) {
                    fatalLogError = jobError;
                } else {
                    failed++;
                    if (!firstError) {
                        firstError = sourceName + ": " + jobError.message;
                    }
                    try {
                        appendLog(log, "ERROR | Source=" + sourceName + " | " + jobError.message);
                    } catch (errorLogError) {
                        fatalLogError = errorLogError;
                    }
                }
            } finally {
                if (openedByScript && doc) {
                    try {
                        doc.close(SaveOptions.DONOTSAVECHANGES);
                    } catch (closeError) {
                        failed++;
                        if (!firstError) {
                            firstError = sourceName + ": ปิด EPS ไม่สำเร็จ: " + closeError.message;
                        }
                        if (!log.failed) {
                            try {
                                appendLog(log, "ERROR | Source=" + sourceName + " | Close failed: " + closeError.message);
                            } catch (closeLogError) {
                                fatalLogError = closeLogError;
                            }
                        }
                        jobStatus = "FAILED";
                    }
                }
            }
            if (fatalLogError || log.failed) {
                break;
            }
            try {
                appendLog(log,
                    "\n====================\n" +
                    " | JOB END | " +
                    "   Status=" + jobStatus + " | Source=" + sourceName +
                    " | Frames=" + job.total + " | Exported=" + (log.exported - job.exportedStart) +
                    " | Skipped=" + job.skipped + " | Not exported=" +
                    (job.planned - (log.exported - job.exportedStart))+
                    "\n====================\n");
            } catch (jobLogError) {
                fatalLogError = jobLogError;
                break;
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
                if (!log.failed) {
                    appendLog(log, "ERROR | Restore active document: " + activateError.message);
                }
            }
        }
        if (fatalLogError) {
            throw fatalLogError;
        }
        appendLog(log, "END | Status=" + (failed > 0 ? "FAILED" : "SUCCESS") +
            " | Jobs=" + files.length + " | Completed=" + completed + " | Failed=" + failed +
            " | Exported=" + log.exported + " | Skipped=" + log.skipped);

        if (failed > 0) {
            throw new Error("พบข้อผิดพลาด " + failed + " รายการ\n" + firstError + "\nLog: " + log.file.fsName);
        }
        return "Export เสร็จสิ้น\nJobs: " + completed + "\nJPG: " + log.exported + "\nข้าม: " + log.skipped +
            "\nปลายทาง: " + selection.destination.fsName + "\nLog: " + log.file.fsName;
    }

    function runSelection(selection) {
        var log = createLog(selection.destination, selection.mode);
        try {
            return runSelectionWithLog(selection, log);
        } catch (error) {
            var message = error.message;
            if (!log.failed) {
                try {
                    appendLog(log, "ALERT ERROR | " + message);
                } catch (logError) {
                    message += "\nเขียน log เพิ่มเติมไม่สำเร็จ: " + logError.message;
                }
            }
            if (message.indexOf(log.file.fsName) < 0) {
                message += "\nLog: " + log.file.fsName;
            }
            throw new Error(message);
        }
    }

    // Destination is selected before processing so runtime errors can refer to
    // the single UTF-8 log for this run.
    try {
        showCaptureDialog();
    } catch (error) {
        alert("เกิดข้อผิดพลาด: " + error.message);
    }
}());
