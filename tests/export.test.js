// Windows JScript integration tests; no Illustrator or Node installation needed.
var fso = new ActiveXObject("Scripting.FileSystemObject");
var root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName));
var stream = new ActiveXObject("ADODB.Stream");
stream.Type = 2;
stream.Charset = "utf-8";
stream.Open();
stream.LoadFromFile(fso.BuildPath(root, "GC-AutoCaputre.js"));
var source = stream.ReadText().replace(/^\uFEFF/, "").replace(/^#target[^\r\n]*/, "");
stream.Close();
var passed = 0;
function assert(ok, message) {
    if (!ok) { throw new Error(message); }
}
function textItem(name, bounds, contents) {
    return { typename: "TextFrame", name: name, geometricBounds: bounds || [0, 0, 1, -1], contents: contents || "ignored" };
}
function group(items) {
    var result = { typename: "GroupItem", pageItems: items };
    for (var i = 0; i < items.length; i++) { items[i].parent = result; }
    return result;
}
function run(name, settings) {
    settings = settings || {};
    var initial = [0, 500, 500, 0];
    var board = { artboardRect: initial };
    var active = 1;
    var boards = [board, { artboardRect: [0, 1, 1, 0] }];
    boards.getActiveArtboardIndex = function () { return active; };
    boards.setActiveArtboardIndex = function (index) { active = index; };
    var paths = settings.paths || [[110, 100, 210, 40], [0, 100, 100, 40]];
    var layer = { name: "Layout", visible: true, pageItems: [] };
    for (var i = 0; i < paths.length; i++) {
        layer.pageItems.push({ typename: "PathItem", geometricBounds: paths[i] });
    }
    var output = [];
    var messages = [];
    var selected = 0;
    var border = { name: "Border", visible: true };
    var hiddenBorder = { name: "Border", visible: false };
    var nestedBorder = { name: "Border", visible: true };
    var artwork = { name: "Artwork", visible: true, layers: [nestedBorder] };
    var nameLayer = { name: "Name", pageItems: [group(settings.nameItems || [
        textItem("N1-BC", [40, 90, 60, 70]), textItem("N2-BC", [150, 90, 170, 70]),
        textItem("N3-BC", [250, 90, 270, 70]), textItem("N4-BC", [340, 80, 360, 60])
    ])] };
    var oidLayer = { name: "OID", pageItems: [group(settings.orderItems || [
        textItem("000444"), textItem("000333"), textItem("000222"), textItem("000111")
    ])] };
    var doc = {
        name: settings.documentName || "1028(M)-TT-" + name.replace(/\.[^.]+$/, "") + "-03-01.eps", path: "C:/input",
        layers: settings.noBorder ? [layer] : [layer, border, hiddenBorder, artwork], artboards: boards,
        exportFile: function (file, type, options) {
            assert(active === 0 && !layer.visible, "export state");
            if (!settings.noBorder) {
                assert(!border.visible && !hiddenBorder.visible && !nestedBorder.visible, "Border hidden during export");
                assert(artwork.visible, "artwork remains visible");
            }
            if (settings.failExport) { throw new Error("simulated export failure"); }
            output.push({ file: file.path, bounds: board.artboardRect.slice(0) });
        }
    };
    if (!settings.noName) { doc.layers.push(nameLayer); }
    if (!settings.noOid) { doc.layers.push(oidLayer); }
    if (settings.flattened) {
        // Layer collection exposes descendants too; traversal must not count twice.
        oidLayer.pageItems.push(oidLayer.pageItems[0].pageItems[3]);
        nameLayer.pageItems.push(nameLayer.pageItems[0].pageItems[0]);
    }
    var app = { documents: [doc], activeDocument: doc, redraw: function () {} };
    var Folder = {
        myDocuments: "C:/Documents",
        selectDialog: function () {
            selected++;
            return settings.cancel ? null : { fsName: "C:/out", toString: function () { return this.fsName; } };
        }
    };
    var File = function (path) { this.path = path; };
    var ExportOptionsJPEG = function () {};
    var ExportType = { JPEG: 1 };
    var alert = function (message) { messages.push(message); };
    var dateCalls = 0;
    var Date = function () {
        var fields = settings.dates ? settings.dates[dateCalls] : [2026, 10, 29, 15, 45, 23];
        dateCalls++;
        return {
            getFullYear: function () { return fields[0]; }, getMonth: function () { return fields[1] - 1; },
            getDate: function () { return fields[2]; }, getHours: function () { return fields[3]; },
            getMinutes: function () { return fields[4]; }, getSeconds: function () { return fields[5]; }
        };
    };
    var code = source;
    if (settings.rule) {
        code = code.replace("appendSkuFrames(doc.name, frames);",
            "CONFIG.skuFrameRules = " + settings.rule + "; appendSkuFrames(doc.name, frames);");
    }
    eval(code);
    assert(board.artboardRect.join() === initial.join() && layer.visible && active === 1, "document restored");
    assert(layer.pageItems.length === paths.length, "no paths added");
    assert(border.visible && !hiddenBorder.visible && nestedBorder.visible && artwork.visible, "Border visibility restored");
    return { output: output, messages: messages.join("\n"), selected: selected, dateCalls: dateCalls };
}
function test(label, action) {
    action();
    passed++;
    WScript.Echo("PASS " + label);
}
function rule(fields) {
    return "{N012:{additionalFrames:1,expectedFrameCount:null,width:null,height:null,gap:0,topOffset:0" + (fields ? "," + fields : "") + "}}";
}
try {
    test("Border layers hide during export and retain original visibility afterwards", function () {
        assert(run("N099.ai").output.length === 2, "export with Border");
        assert(run("N099.ai", { noBorder: true }).output.length === 2, "export without Border");
        assert(run("N099.ai", { cancel: true }).output.length === 0, "cancel preserves visibility");
        assert(run("N099.ai", { failExport: true }).messages.indexOf("simulated export failure") >= 0,
            "failure restores visibility");
    });
    test("N012 adds one frame at the last right edge after sorting", function () {
        var result = run("N012.eps");
        assert(result.output.length === 3, "three exports");
        assert(result.output[0].bounds.join() === "0,100,100,40", "sorted real frames");
        assert(result.output[2].bounds.join() === "210,100,310,40", "inferred bounds");
        assert(result.output[2].file === "C:/out/N012-03_000333_003_20261029154523.jpg", "filename");
    });
    test("SKU token matching supports case and separators", function () {
        assert(run("n012-v2.ai").output.length === 3, "token match");
        assert(run("N0120.eps").output.length === 2, "no prefix match");
        assert(run("XN012.eps").output.length === 2, "no suffix match");
        assert(run("N099.eps").output.length === 2, "unconfigured SKU");
    });
    test("custom dimensions, spacing, offset and multiple missing frames", function () {
        var result = run("N012.ai", { rule: rule("additionalFrames:2,width:80,height:40,gap:10,topOffset:-5") });
        assert(result.output[2].bounds.join() === "220,95,300,55", "custom bounds");
        assert(result.output[3].bounds.join() === "310,95,390,55", "constant vertical offset");
    });
    test("expected count avoids duplicates and fills only the deficit", function () {
        assert(run("N012.ai", { rule: rule("expectedFrameCount:2") }).output.length === 2, "already complete");
        assert(run("N012.ai", { rule: rule("expectedFrameCount:4") }).output.length === 4, "fill deficit");
    });
    test("future SKU configuration", function () {
        assert(run("N099.ai", { rule: rule("").replace("N012", "N099") }).output.length === 3, "new SKU");
    });
    test("invalid rules fail before destination selection", function () {
        var fields = ["width:0", "height:-1", "gap:NaN", "additionalFrames:1.5", "expectedFrameCount:0"];
        for (var i = 0; i < fields.length; i++) {
            var result = run("N012.ai", { rule: rule(fields[i]) });
            assert(result.output.length === 0 && result.selected === 0, fields[i]);
        }
    });
    test("cancel, absent reference and export failure preserve document", function () {
        assert(run("N012.ai", { cancel: true }).output.length === 0, "cancel");
        assert(run("N012.ai", { paths: [] }).selected === 0, "no reference");
        var result = run("N012.ai", { failExport: true });
        assert(result.messages.indexOf("simulated export failure") >= 0, "failure reported");
    });
    test("real job filename, spatial work numbers and bottom-up OID stacking", function () {
        var result = run("N099.eps", {
            documentName: "1028(M)-TT-N012-03-01.eps",
            nameItems: [group([textItem("N3-BC", [40, 90, 60, 70])]),
                textItem("N1-BC", [150, 90, 170, 70]), textItem("N2-BC", [250, 90, 270, 70])],
            // Position and contents deliberately disagree with stacking order / Name.
            orderItems: [textItem("12345678901234567890", [0, -100, 1, -101], "wrong"),
                group([textItem("000222"), textItem("000111")])]
        });
        assert(result.output.length === 3, "three matches");
        assert(result.output[0].file === "C:/out/N012-03_12345678901234567890_003_20261029154523.jpg", "work 3 maps to top OID");
        assert(result.output[1].file.indexOf("_000111_001_") >= 0, "work 1 maps to bottom OID");
        assert(result.output[2].file.indexOf("_000222_002_") >= 0, "inferred frame uses work 2");
    });
    test("empty and invalid OID slots never shift later pairs", function () {
        var result = run("N012.eps", { orderItems: [textItem("000333"), textItem(""), textItem("000111")] });
        assert(result.output.length === 2, "empty order skipped");
        assert(result.output[1].file.indexOf("_000333_003_") >= 0, "work 3 retains OID 3");
        assert(result.messages.indexOf("1") >= 0, "skip reported");
        assert(run("N099.eps", { orderItems: [textItem("bad/id"), textItem("", null, "")] }).output.length === 0,
            "invalid and empty OID skipped");
    });
    test("unnamed OID Type uses contents as displayed in the real EPS Layers panel", function () {
        var result = run("N012.eps", { orderItems: [textItem("", null, ""), textItem("", null, "586828930588247057"),
            textItem("", null, ""), textItem("", null, " 586825296410805461 ")] });
        assert(result.output.length === 2, "two populated orders, empty slots retained");
        assert(result.output[0].file.indexOf("_586825296410805461_001_") >= 0, "bottom contents maps to work 1");
        assert(result.output[1].file.indexOf("_586828930588247057_003_") >= 0, "work 3 not shifted");
        result = run("N099.eps", { orderItems: [textItem("bad/id", null, "12345"), textItem("000111", null, "999")] });
        assert(result.output.length === 1 && result.output[0].file.indexOf("_000111_001_") >= 0, "explicit Name takes priority");
    });
    test("missing metadata skips without destination prompt or document changes", function () {
        var cases = [{ noName: true }, { noOid: true }, { nameItems: [] }, { orderItems: [] },
            { nameItems: [textItem("", [40, 90, 60, 70], "N1-BC")] },
            { nameItems: [textItem("N12-BC", [40, 90, 60, 70])] },
            { nameItems: [textItem("N0-BC", [40, 90, 60, 70])] },
            { nameItems: [textItem("N1-BC", [400, 90, 420, 70])] }];
        for (var i = 0; i < cases.length; i++) {
            var result = run("N099.eps", cases[i]);
            assert(result.output.length === 0 && result.selected === 0 && result.dateCalls === 0, "missing metadata " + i);
        }
    });
    test("skipped frames retain work numbers and three-digit minimum width", function () {
        var result = run("N012.eps", { nameItems: [textItem("N3-BC", [150, 90, 170, 70])] });
        assert(result.output.length === 1 && result.output[0].file.indexOf("_000333_003_") >= 0, "no renumbering");
        var orders = [];
        for (var i = 0; i < 1000; i++) { orders.push(textItem("9")); }
        result = run("N099.eps", { orderItems: orders, nameItems: [textItem("N1000-BC", [40, 90, 60, 70])] });
        assert(result.output[0].file.indexOf("_9_1000_") >= 0, "four digits preserved");
        result = run("N099.eps", { orderItems: orders, nameItems: [textItem("N12-BC", [40, 90, 60, 70])] });
        assert(result.output[0].file.indexOf("_9_012_") >= 0, "twelve padded to 012");
    });
    test("timestamp is local and evaluated for every exported image", function () {
        var result = run("N099.eps", { dates: [[2026, 12, 31, 23, 59, 59], [2027, 1, 1, 0, 0, 0]] });
        assert(result.dateCalls === 2, "one clock read per export");
        assert(result.output[0].file.indexOf("_20261231235959.jpg") >= 0, "before midnight");
        assert(result.output[1].file.indexOf("_20270101000000.jpg") >= 0, "year rollover and zero padding");
    });
    test("ambiguous markers and overlapping frames skip instead of guessing", function () {
        var result = run("N099.eps", { nameItems: [textItem("N1-BC", [40, 90, 60, 70]), textItem("N2-BC", [40, 80, 60, 60])] });
        assert(result.output.length === 0 && result.selected === 0, "conflicting work numbers");
        result = run("N099.eps", { paths: [[0, 100, 100, 40], [0, 100, 100, 40]] });
        assert(result.output.length === 0, "overlapping frames");
    });
    test("flattened collections do not duplicate group descendants", function () {
        var result = run("N012.eps", { flattened: true });
        assert(result.output.length === 3, "three exports");
        assert(result.output[2].file.indexOf("_000333_003_") >= 0, "OID order not shifted");
    });
    test("invalid job names fail before destination selection", function () {
        var names = ["Untitled-1", "N012.eps", "1028(M)-TT-01.eps", "1028(M)-TT-N012-03-xx.eps"];
        for (var i = 0; i < names.length; i++) {
            var result = run("N099.eps", { documentName: names[i] });
            assert(result.output.length === 0 && result.selected === 0, "invalid job name " + names[i]);
        }
    });
    WScript.Echo("Passed " + passed + " integration tests.");
} catch (error) {
    WScript.Echo("FAIL " + error.message);
    WScript.Quit(1);
}
