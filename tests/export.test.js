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
    var doc = {
        name: name, path: "C:/input",
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
    var code = source;
    if (settings.rule) {
        code = code.replace("appendSkuFrames(doc.name, frames);",
            "CONFIG.skuFrameRules = " + settings.rule + "; appendSkuFrames(doc.name, frames);");
    }
    eval(code);
    assert(board.artboardRect.join() === initial.join() && layer.visible && active === 1, "document restored");
    assert(layer.pageItems.length === paths.length, "no paths added");
    assert(border.visible && !hiddenBorder.visible && nestedBorder.visible && artwork.visible, "Border visibility restored");
    return { output: output, messages: messages.join("\n"), selected: selected };
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
        assert(result.output[2].file === "C:/out/N012_03.jpg", "filename");
    });
    test("SKU token matching supports case and separators", function () {
        assert(run("job_n012-v2.ai").output.length === 3, "token match");
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
    WScript.Echo("Passed " + passed + " integration tests.");
} catch (error) {
    WScript.Echo("FAIL " + error.message);
    WScript.Quit(1);
}
