#target illustrator

function exportByFrameLayer() {
    if (app.documents.length === 0) {
        alert("กรุณาเปิดไฟล์ .eps ในโปรแกรมก่อนรันสคริปต์");
        return;
    }

    var doc = app.activeDocument;

    // 1. ตรวจหา Layer ชื่อ "กรอบ"
    var frameLayer = null;
    for (var i = 0; i < doc.layers.length; i++) {
        if (doc.layers[i].name === "กรอบ") {
            frameLayer = doc.layers[i];
            break;
        }
    }

    if (!frameLayer) {
        alert("ไม่พบ Layer ที่ชื่อ 'กรอบ' ในไฟล์นี้");
        return;
    }

    // 2. รวบรวมวัตถุรูปทรงสี่เหลี่ยมทั้งหมดใน Layer กรอบ
    var frameRects = [];
    for (var j = 0; j < frameLayer.pageItems.length; j++) {
        var item = frameLayer.pageItems[j];
        if (item.typename === "PathItem") {
            frameRects.push(item);
        }
    }

    if (frameRects.length === 0) {
        alert("ไม่พบ Rectangle ใน Layer 'กรอบ'");
        return;
    }

    // 3. เรียงลำดับสี่เหลี่ยมจากซ้ายไปขวา (Left to Right) ตามแกน X
    // geometricBounds = [left, top, right, bottom]
    frameRects.sort(function(a, b) {
        return a.geometricBounds[0] - b.geometricBounds[0];
    });

    // 4. เลือกโฟลเดอร์สำหรับเซฟไฟล์ JPG
    var defaultFolder = doc.path;
    var destFolder = Folder.selectDialog("เลือกโฟลเดอร์สำหรับบันทึกไฟล์ JPG", defaultFolder);
    if (!destFolder) return;

    // ดึงชื่อไฟล์เดิมมาเป็น Base Name ตัด .eps ออก
    var baseName = doc.name.replace(/\.[^\.]+$/, "");

    // 5. ตั้งค่าการ Export JPG ที่ความละเอียด 300 DPI
    var exportOptions = new ExportOptionsJPEG();
    exportOptions.antiAliasing = true;
    exportOptions.filterAppearance = true;
    exportOptions.qualitySetting = 100;

    // สเกลขนาดจาก 72 DPI (ฐาน Vector) ให้เป็น DPI ที่ต้องการ ให้แก้ targetDPI 
    var targetDPI = 72
    var scale = (targetDPI / 72) * 100;
    exportOptions.horizontalScale = scale;
    exportOptions.verticalScale = scale;
    exportOptions.artBoardClipping = true; // บังคับตัดขอบตามขนาด Artboard พอดี

    function padZero(num, size) {
        var s = "00" + num;
        return s.substr(s.length - size);
    }

    // บันทึกขนาด Artboard และสถานะเดิมไว้
    var origArtboardRect = doc.artboards[0].artboardRect;
    var origFrameVisibility = frameLayer.visible;

    try {
        // ซ่อน Layer กรอบเพื่อไม่ให้เส้นสีแดง/เส้นประติดไปในภาพ
        frameLayer.visible = false;

        // 6. วนลูปย้ายขอบ Artboard ไปตามแต่ละ Rectangle แล้ว Export
        for (var r = 0; r < frameRects.length; r++) {
            var targetBounds = frameRects[r].geometricBounds;

            // กำหนดขอบเขตของ Artboard ให้เท่ากับตำแหน่งและขนาดของเส้นกรอบ
            doc.artboards[0].artboardRect = targetBounds;

            var indexStr = padZero(r + 1, 3);
            var outputFileName = baseName + "_" + indexStr + ".jpg";
            var targetFile = new File(destFolder + "/" + outputFileName);

            doc.exportFile(targetFile, ExportType.JPEG, exportOptions);
        }

        alert("Export เสร็จสิ้นทั้งหมด " + frameRects.length + " รูป\nบันทึกที่: " + destFolder.fsName);

    } catch (e) {
        alert("เกิดข้อผิดพลาด: " + e.message);
    } finally {
        // คืนค่า Artboard และ Layer กรอบให้กลับมาสภาพเดิม
        doc.artboards[0].artboardRect = origArtboardRect;
        frameLayer.visible = origFrameVisibility;
        app.redraw();
    }
}

exportByFrameLayer();