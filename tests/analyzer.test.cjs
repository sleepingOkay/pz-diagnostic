/**
 * Browser-independent regression tests for the PZ Diagnostic analyzer.
 * Run with: npm test
 *
 * The app is evaluated in a tiny DOM sandbox so the same analyzeLog()
 * implementation used by the website is tested without a browser dependency.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function createElement() {
  return {
    hidden: false,
    textContent: "",
    innerHTML: "",
    style: {},
    className: "",
    files: [],
    value: "",
    classList: { add() {}, remove() {} },
    addEventListener() {},
    scrollIntoView() {}
  };
}

function loadKnowledgeBase() {
  const context = { window: {} };
  vm.createContext(context);
  const knowledgeSource = fs.readFileSync(path.join(__dirname, "..", "knowledge", "compatibility.js"), "utf8");
  vm.runInContext(knowledgeSource, context, { filename: "knowledge/compatibility.js", timeout: 1000 });
  return context.window.PZ_DIAGNOSTIC_KNOWLEDGE;
}

function loadAnalyzer(knowledge = []) {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    }
  };
  const context = {
    document,
    window: { PZ_DIAGNOSTIC_KNOWLEDGE: knowledge },
    console,
    Set,
    Map,
    Math,
    Number,
    String,
    Object,
    Array,
    RegExp
  };
  vm.createContext(context);
  vm.runInContext(appSource + "\n;globalThis.__analyzeLogForTests = analyzeLog;", context, {
    filename: "app.js",
    timeout: 1000
  });
  return context.__analyzeLogForTests;
}

test("lists every recognized Viewpoint mod reference by name", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze(
    [
      "Project Zomboid Build 42.21.0",
      "VisceralViewpoint",
      "ProjectViewpointShelves",
      "ViewpointSurface",
      "ViewpointDoor"
    ].join("\n"),
    "mods.txt"
  );
  assert.deepEqual(
    Array.from(report.recognizedMods, item => item.name).sort(),
    ["Door Fix", "KK's Shelves in 3D", "Surface Fix", "Visceral"].sort()
  );
});

test("deduplicates Door Fix aliases by their shared knowledge rule ID", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze(
    [
      "Project Zomboid Build 42.21.0",
      "Workshop ID: 3812151347",
      "Mod ID: ViewpointDoor"
    ].join("\n"),
    "door-fix-alias.txt"
  );
  const doorFix = Array.from(report.recognizedMods, item => item.name)
    .filter(name => /door fix/i.test(name));
  assert.deepEqual(doorFix, ["Door Fix"]);
});

test("detects game build and basic Java exception", () => {
  const analyze = loadAnalyzer();
  const report = analyze(
    "Project Zomboid Build 42.21.0\njava.lang.IllegalStateException: broken state",
    "console.txt"
  );
  assert.equal(report.environment["Game version"], "42.21.0");
  assert.ok(report.findings.some(item => item.id === "java-exceptions"));
});

test("matches a build-scoped rule only on its supported build", () => {
  const rule = {
    id: "build-only-test",
    pattern: "SpecialFailure",
    builds: ["42.21.0"],
    title: "Build-specific observation",
    confidence: "medium",
    severity: "warning"
  };
  const analyze = loadAnalyzer([rule]);
  const supported = analyze("Project Zomboid Build 42.21.0\nSpecialFailure", "supported.txt");
  const unsupported = analyze("Project Zomboid Build 42.20.4\nSpecialFailure", "unsupported.txt");
  const unknown = analyze("SpecialFailure", "unknown-build.txt");
  assert.ok(supported.findings.some(item => item.id === "build-only-test"));
  assert.ok(!unsupported.findings.some(item => item.id === "build-only-test"));
  assert.ok(!unknown.findings.some(item => item.id === "build-only-test"));
});

test("requires all contextual signatures before matching a rule", () => {
  const analyze = loadAnalyzer([{
    id: "context-required",
    pattern: "ClassCastException",
    requires: ["WallMesher\\.wall", "Float cannot be cast"],
    title: "Contextual match"
  }]);
  const full = analyze(
    "Project Zomboid Build 42.21.0\nClassCastException: Float cannot be cast\n at viewpoint.world.WallMesher.wall(WallMesher.java:80)",
    "full.txt"
  );
  const partial = analyze("ClassCastException: Float cannot be cast", "partial.txt");
  assert.ok(full.findings.some(item => item.id === "context-required"));
  assert.ok(!partial.findings.some(item => item.id === "context-required"));
});

test("honors excludes and minimum occurrence count", () => {
  const analyze = loadAnalyzer([{
    id: "guarded-rule",
    pattern: "RepeatedSignal",
    excludes: ["KnownBenignContext"],
    minOccurrences: 2,
    title: "Repeated signal"
  }]);
  assert.ok(analyze("RepeatedSignal\nRepeatedSignal", "twice.txt").findings.some(x => x.id === "guarded-rule"));
  assert.ok(!analyze("RepeatedSignal", "once.txt").findings.some(x => x.id === "guarded-rule"));
  assert.ok(!analyze("RepeatedSignal\nRepeatedSignal\nKnownBenignContext", "excluded.txt").findings.some(x => x.id === "guarded-rule"));
});

test("extracts third-party Lua stack frame as a lead", () => {
  const analyze = loadAnalyzer();
  const report = analyze(
    "Project Zomboid Build 42.21.0\nERROR: Lua stack trace:\n    Lua(SomeMod).doThing(media/lua/client/SomeFile.lua:12)\n",
    "lua.txt"
  );
  const finding = report.findings.find(item => item.id === "lua-errors");
  assert.ok(finding);
  assert.match(finding.title, /SomeMod/);
  assert.ok(report.mods.includes("SomeMod"));
  assert.match(finding.description, /not proof/i);
});

test("does not attribute vanilla Lua frames as third-party mods", () => {
  const analyze = loadAnalyzer();
  const report = analyze(
    "Project Zomboid Build 42.21.0\nERROR: Lua stack trace:\n    Lua(Vanilla).doThing(media/lua/shared/SomeFile.lua:12)\n",
    "vanilla.txt"
  );
  assert.ok(!report.mods.includes("Vanilla"));
  assert.ok(!report.mods.includes("Base"));
  assert.ok(!report.mods.includes("Shared"));
});

test("extracts Java stack trace component without declaring it the cause", () => {
  const analyze = loadAnalyzer();
  const report = analyze(
    "Project Zomboid Build 42.21.0\njava.lang.IllegalStateException: failure\n    at example.mod.Worker.run(Worker.java:42)\n    at zombie.gameStates.MainState.update(MainState.java:10)\n",
    "java-stack.txt"
  );
  const finding = report.findings.find(item => item.id === "stack-trace");
  assert.ok(finding);
  assert.match(finding.title, /example\.mod/);
  assert.match(finding.description, /not automatically the root cause/i);
});

test("enriches an existing finding instead of duplicating a curated match", () => {
  const analyze = loadAnalyzer([{
    id: "curated-cast",
    pattern: "ClassCastException",
    title: "Curated cast finding",
    confidence: "high",
    causes: ["A curated possible cause"]
  }]);
  const report = analyze(
    "Project Zomboid Build 42.21.0\njava.lang.ClassCastException: mismatch",
    "enriched.txt"
  );
  const matching = report.findings.filter(item => item.id === "curated-cast");
  assert.equal(matching.length, 1);
  assert.deepEqual(Array.from(matching[0].causes), ["A curated possible cause"]);
});

test("does not blame a mod merely because its name appears in the log", () => {
  const analyze = loadAnalyzer();
  const report = analyze(
    "Project Zomboid Build 42.21.0\nLoaded mod: SomeMod\njava.lang.IllegalStateException: failure",
    "loaded-mod.txt"
  );
  assert.ok(!report.findings.some(item => /SomeMod.*cause|cause.*SomeMod/i.test(item.description)));
});

test("returns an explicit unknown-pattern result for unrecognized logs", () => {
  const analyze = loadAnalyzer();
  const report = analyze("Project Zomboid Build 42.21.0\nEverything started normally.", "clean.txt");
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].id, "no-known-errors");
});


test("retains Project Zomboid ERROR and WARN records without inventing a crash cause", () => {
  const analyze = loadAnalyzer();
  const report = analyze(
    [
      "Project Zomboid Build 42.21.0",
      "ERROR: General      f:0 at AngelCodeFont.parseFnt > AngelCodeFont failed to load page 0 texture media/mainfont_0.png",
      "ERROR: General      f:0 at AngelCodeFont.parseFnt > AngelCodeFont failed to load page 0 texture media/mainfont2_0.png",
      "WARN : General      f:0 at Log.warn > optional resource unavailable"
    ].join("\n"),
    "pz-engine-events.txt"
  );
  const errors = report.findings.find(item => item.id === "pz-engine-errors");
  const warnings = report.findings.find(item => item.id === "pz-engine-warnings");
  assert.ok(errors, "unclassified engine errors must not disappear");
  assert.equal(errors.count, 2);
  assert.match(errors.evidence, /AngelCodeFont\.parseFnt/);
  assert.match(errors.description, /does not prove/i);
  assert.ok(warnings);
  assert.equal(warnings.count, 1);
  assert.equal(warnings.severity, "info");
  assert.ok(!report.findings.some(item => item.id === "lua-errors"),
    "generic engine ERROR records must not be mislabeled as Lua errors");
  assert.ok(!report.findings.some(item => item.id === "java-exceptions"),
    "generic engine ERROR records must not be mislabeled as Java exceptions");
});

test("classifies a font texture load error without hiding unrelated engine errors", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze(
    [
      "Project Zomboid Build 42.21.0",
      "ERROR: General f:0 at AngelCodeFont.parseFnt > AngelCodeFont failed to load page 0 texture media/mainfont_0.png",
      "ERROR: General f:1 at SomeOtherSystem.update > unrelated engine failure"
    ].join("\n"),
    "font-assets.txt"
  );
  const font = report.findings.find(item => item.id === "angelcode-font-texture-load");
  const generic = report.findings.find(item => item.id === "pz-engine-errors");
  assert.ok(font, "the known font texture failure should receive a specific diagnosis");
  assert.match(font.description, /do not establish that the game crashed/i);
  assert.ok(generic, "unrelated engine errors must remain visible");
  assert.equal(generic.count, 1);
  assert.match(generic.evidence, /unrelated engine failure/);
  assert.doesNotMatch(generic.evidence, /AngelCodeFont/);
});

test("recognizes a fatal WorldDictionary missing-script failure", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze(
    [
      "Project Zomboid Build 42.21.0",
      "ERROR: General      f:0 st:0> WorldDictionary.init> Exception thrown",
      "zombie.world.WorldDictionaryException: [SpriteConfigs] Missing dictionary script on client: Base.SMB_steps_FirePole",
      "    Stack trace:",
      "    zombie.world.ScriptsDictionary$ScriptRegister.parseLoadListClient(ScriptsDictionary.java:253)",
      "    zombie.world.ScriptsDictionary.parseRegisters(ScriptsDictionary.java:395)",
      "    zombie.world.WorldDictionary.init(WorldDictionary.java:327)",
      "    zombie.iso.IsoWorld.init(IsoWorld.java:2081)",
      "ERROR: General      f:0 st:0> GameLoadingState$1.run> Exception thrown",
      "zombie.world.WorldDictionaryException: WorldDictionary: Cannot load world due to WorldDictionary error."
    ].join("\n"),
    "world-dictionary.txt"
  );
  const finding = report.findings.find(item => item.id === "world-dictionary-missing-script");
  assert.ok(finding, "the fatal world dictionary failure must be recognized");
  assert.equal(finding.severity, "error");
  assert.equal(finding.confidence, "high");
  assert.match(finding.evidence, /WorldDictionaryException/);
  assert.match(finding.description, /does not by itself prove which mod/i);
});


test("parses Project Zomboid stack frames without the Java 'at' prefix", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze(
    [
      "Project Zomboid Build 42.21.0",
      "ERROR: General f:0> WorldDictionary.init> Exception thrown",
      "zombie.world.WorldDictionaryException: [SpriteConfigs] Missing dictionary script on client: Base.SMB_steps_FirePole",
      "    Stack trace:",
      "    zombie.world.ScriptsDictionary$ScriptRegister.parseLoadListClient(ScriptsDictionary.java:253)",
      "    zombie.world.ScriptsDictionary.parseRegisters(ScriptsDictionary.java:395)",
      "    zombie.world.WorldDictionary.init(WorldDictionary.java:327)"
    ].join("\n"),
    "pz-stack-format.txt"
  );
  const stack = report.findings.find(item => item.id === "stack-trace");
  const dictionary = report.findings.find(item => item.id === "world-dictionary-missing-script");
  assert.ok(stack, "PZ-formatted Java frames should be extracted");
  assert.match(stack.evidence, /ScriptsDictionary\$ScriptRegister\.parseLoadListClient/);
  assert.ok(dictionary);
  assert.ok(!report.findings.some(item => item.id === "java-exceptions"),
    "the wrapper exception should not be repeated as a separate generic diagnosis");
  assert.equal(dictionary.relatedMods.length, 1);
  assert.equal(dictionary.relatedMods[0].name, "SMB steps (SMB_steps)");
  assert.match(dictionary.relatedMods[0].reason, /not proof/i);
});

test("does not suggest SMB steps for unrelated missing dictionary scripts", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze(
    [
      "Project Zomboid Build 42.21.0",
      "zombie.world.WorldDictionaryException: [SpriteConfigs] Missing dictionary script on client: Base.OtherMod_FirePole"
    ].join("\n"),
    "other-script.txt"
  );
  const dictionary = report.findings.find(item => item.id === "world-dictionary-missing-script");
  assert.ok(dictionary);
  assert.equal(dictionary.relatedMods.length, 0);
});


test("classifies repeated missing animation folders as media-scan noise", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze(
    [
      "Project Zomboid Build 42.21.0",
      "ERROR: General f:0> AdvancedAnimator$1.visitFileFailed> Exception thrown",
      "java.nio.file.NoSuchFileException: D:\\SteamLibrary\\steamapps\\workshop\\content\\108600\\3619862853\\mods\\ZombieBuddy\\common\\media\\AnimSets at WindowsException.translateToIOException(null:-1).",
      "ERROR: General f:0> AdvancedAnimator$1.visitFileFailed> Exception thrown",
      "java.nio.file.NoSuchFileException: D:\\SteamLibrary\\steamapps\\workshop\\content\\108600\\3423660713\\mods\\ModLoadOrderSorter_b42\\common\\media\\actiongroups at WindowsException.translateToIOException(null:-1).",
      "ERROR: General f:1> unrelated engine failure"
    ].join("\n"),
    "animation-scan.txt"
  );
  const finding = report.findings.find(item => item.id === "advancedanimator-optional-mod-animation-folders");
  const generic = report.findings.find(item => item.id === "pz-engine-errors");
  assert.ok(finding);
  assert.equal(finding.severity, "info");
  assert.equal(finding.count, 2);
  assert.match(finding.description, /not evidence that each named mod is broken/i);
  assert.ok(!report.findings.some(item => item.id === "java-exceptions"),
    "the same optional-directory scan should not be duplicated as a generic Java exception");
  assert.ok(generic, "unrelated engine errors must remain visible");
  assert.equal(generic.count, 1);
  assert.match(generic.evidence, /unrelated engine failure/);
  assert.doesNotMatch(generic.evidence, /AdvancedAnimator/);
});

test("recognizes Viewpoint QOL missing-class hook as a compatibility lead", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze(
    [
      "Project Zomboid Build 42.21.0",
      "[ProjectViewpointQOL] Failed to hook ThirdPerson.active: java.lang.ClassNotFoundException: viewpoint.input.ThirdPerson"
    ].join("\n"),
    "viewpoint-qol-hook.txt"
  );
  const finding = report.findings.find(item => item.id === "viewpoint-qol-missing-thirdperson-hook");
  assert.ok(finding);
  assert.equal(finding.severity, "warning");
  assert.match(finding.description, /does not establish that all QOL features failed/i);
});

test("recognizes invalid Wandering Hordes tooltip formatting", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze(
    [
      "Project Zomboid Build 42.21.0",
      "WARN : General f:0> Translator.reportMissingArgumentsFromPastAbuse> Exception thrown java.util.UnknownFormatConversionException: Conversion = '.' at Formatter.parse(null:-1). Message: ERROR: Formatting \"Sandbox_WanderingHordes_MigrationFinalPopDistributionPercent_tooltip\""
    ].join("\n"),
    "translation-format.txt"
  );
  const finding = report.findings.find(item => item.id === "translation-format-string-invalid");
  assert.ok(finding);
  assert.equal(finding.severity, "warning");
  assert.match(finding.description, /localization string/i);
});

 
test("classifies repeated ImportedSkeleton missing-bone errors without hiding unrelated errors", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze(
    [
      "Project Zomboid Build 42.21.0",
      'ERROR: General f:0 at ImportedSkeleton.collectBoneFrames > Could not find bone index for node name: "Bip01_Root"',
      'ERROR: General f:0 at ImportedSkeleton.collectBoneFrames > Could not find bone index for node name: "Bip01_Prop2_end"',
      "ERROR: General f:1> unrelated engine failure"
    ].join("\n"),
    "missing-bones.txt"
  );
  const finding = report.findings.find(item => item.id === "imported-skeleton-missing-bones");
  const generic = report.findings.find(item => item.id === "pz-engine-errors");
  assert.ok(finding);
  assert.equal(finding.severity, "warning");
  assert.equal(finding.count, 2);
  assert.match(finding.description, /does not prove a game crash/i);
  assert.ok(generic);
  assert.equal(generic.count, 1);
  assert.match(generic.evidence, /unrelated engine failure/);
  assert.doesNotMatch(generic.evidence, /ImportedSkeleton/);
});


test("recognizes the five requested Viewpoint add-ons as references, not errors", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze([
    "Project Zomboid Build 42.21.0",
    "Workshop ID: 3812151347",
    "Mod ID: ViewpointDoor",
    "Workshop ID: 3820965001",
    "Mod ID: VisceralViewpoint",
    "Workshop ID: 3815931973",
    "Mod ID: ProjectViewpointShelves",
    "Workshop ID: 3814398576",
    "Mod ID: ViewpointSurface",
    "Workshop ID: 3816442251",
    "Mod ID: ViewpointLivingProps"
  ].join("\n"), "viewpoint-addons.txt");
  for (const id of [
    "viewpoint-visceral-addon-reference",
    "viewpoint-living-props-addon-reference"
  ]) {
    const finding = report.findings.find(item => item.id === id);
    assert.ok(finding, "expected mod reference " + id);
    assert.equal(finding.severity, "info");
  }
  const shelvesOverlap = report.findings.find(item => item.id === "viewpoint-kk-shelves-living-props-model-overlap");
  assert.ok(shelvesOverlap, "the specific KK Shelves + Living Props warning must remain");
  assert.equal(shelvesOverlap.severity, "warning");
  const surfaceRisk = report.findings.find(item => item.id === "viewpoint-surface-fix-compatibility-risk");
  assert.ok(surfaceRisk, "the Surface Fix compatibility warning must remain");
  assert.equal(surfaceRisk.severity, "warning");
  assert.equal(report.errorCount, 0);
  assert.ok(
    !report.recognizedMods.some(item => /Living Props/i.test(item.name)),
    "Living Props must not appear in the incompatible-mods list"
  );
  assert.deepEqual(
    Array.from(report.recognizedMods, item => item.name).sort(),
    ["Door Fix", "KK's Shelves in 3D", "Surface Fix", "Visceral"].sort(),
    "other recognized add-ons must remain in the list"
  );
});

test("flags Door Fix and Living Props together only as a possible visual overlap", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const both = analyze([
    "Project Zomboid Build 42.21.0",
    "Workshop ID: 3812151347",
    "Mod ID: ViewpointDoor",
    "Workshop ID: 3816442251",
    "Mod ID: ViewpointLivingProps"
  ].join("\n"), "door-livingprops.txt");
  const warning = both.findings.find(item => item.id === "viewpoint-door-livingprops-overlap");
  assert.ok(warning);
  assert.equal(warning.severity, "warning");
  assert.match(warning.description, /not proof of a crash/i);
  const doorOnly = analyze([
    "Project Zomboid Build 42.21.0",
    "Workshop ID: 3812151347",
    "Mod ID: ViewpointDoor"
  ].join("\n"), "door-only.txt");
  assert.ok(!doorOnly.findings.some(item => item.id === "viewpoint-door-livingprops-overlap"),
    "the overlap warning requires both add-ons");
});


test("recognizes Viewpoint renderer startup wrapper without inventing its root cause", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze([
    "Project Zomboid Build 42.21.0",
    "java.lang.IllegalStateException: the renderer could not start",
    "at viewpoint.SceneDrawer.drawFrame(SceneDrawer.java:187)"
  ].join("\n"), "viewpoint-renderer-wrapper.txt");
  const finding = report.findings.find(item => item.id === "viewpoint-renderer-start-failed-wrapper");
  assert.ok(finding);
  assert.equal(finding.severity, "error");
  assert.match(finding.description, /not the root cause/i);
  assert.match(finding.recommendation, /unknown root cause/i);
});

test("recognizes the specific Viewpoint GLSL sampler-array compiler failure", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze([
    "Project Zomboid Build 42.21.0",
    "ERROR: model_gbuffer.frag:38: variable indexing sampler array is not supported for this version or the enabled extensions",
    "java.lang.IllegalStateException: the renderer could not start",
    "at viewpoint.SceneDrawer.drawFrame(SceneDrawer.java:187)"
  ].join("\n"), "viewpoint-glsl-sampler.txt");
  const finding = report.findings.find(item => item.id === "viewpoint-glsl-variable-sampler-indexing");
  assert.ok(finding);
  assert.equal(finding.severity, "error");
  assert.match(finding.description, /does not prove that every AMD GPU/i);
});

test("recognizes Door Fix independently without treating it as a crash", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze([
    "Project Zomboid Build 42.21.0",
    "Workshop ID: 3812151347",
    "Mod ID: ViewpointDoor"
  ].join("\n"), "viewpoint-door-fix.txt");
  const finding = report.findings.find(item => item.id === "viewpoint-door-fix-current-compatibility-risk");
  assert.ok(finding, "the current Door Fix compatibility warning must remain visible");
  assert.equal(finding.severity, "warning");
  assert.match(finding.description, /do not prove a crash/i);
  assert.equal(report.errorCount, 0);
});


test("identifies ViewpointDoorLighting shader mismatch as the renderer startup cause", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze([
    "Project Zomboid Build 42.21.0",
    "[Viewpoint] model program: [ViewpointDoorLighting] Incompatible model shader; missing: vLight = texelFetch(uDraws, record + LIGHT);",
    "[Viewpoint] model shadow program: [ViewpointDoorLighting] Incompatible model shader; missing: vLight = texelFetch(uDraws, record + LIGHT);",
    "[Viewpoint] vehicle program: [ViewpointDoorLighting] Incompatible model shader; missing: vLight = texelFetch(uDraws, record + LIGHT);",
    "[Visceral] Viewpoint's model shader would not build with Visceral's wounds on this GPU's driver, so the wounds are off and Viewpoint carries on as it is.",
    "[Viewpoint] disabled after error while preparing:",
    "java.lang.IllegalStateException: the renderer could not start: programs that did not link: model, model shadow, vehicle; the last error: glass flow program: [ViewpointDoorLighting] Incompatible model shader; missing: vLight = texelFetch(uDraws, record + LIGHT);"
  ].join("\n"), "doorlighting-shader.txt");
  const finding = report.findings.find(item => item.id === "viewpoint-doorlighting-incompatible-model-shader");
  assert.ok(finding, "the exact add-on shader mismatch must be recognized");
  assert.equal(finding.severity, "error");
  assert.equal(finding.confidence, "high");
  assert.match(finding.description, /explicitly names ViewpointDoorLighting/i);
  assert.match(finding.recommendation, /do not start by removing Visceral/i);
});


test("warns about reported Surface Fix compatibility risks without calling it a crash", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze([
    "Project Zomboid Build 42.21.0",
    "Workshop ID: 3814398576",
    "Mod ID: ViewpointSurface"
  ].join("\n"), "surface-fix-risk.txt");
  const finding = report.findings.find(item => item.id === "viewpoint-surface-fix-compatibility-risk");
  assert.ok(finding);
  assert.equal(finding.severity, "warning");
  assert.equal(finding.confidence, "medium");
  assert.match(finding.description, /furniture interactions disappearing/i);
  assert.match(finding.description, /rather than proof that the installed copy is broken/i);
  assert.equal(report.errorCount, 0);
});

test("warns about Door Fix compatibility reports independently of the exact shader failure", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze([
    "Project Zomboid Build 42.21.0",
    "Workshop ID: 3812151347",
    "Mod ID: ViewpointDoor"
  ].join("\n"), "door-fix-risk.txt");
  const finding = report.findings.find(item => item.id === "viewpoint-door-fix-current-compatibility-risk");
  assert.ok(finding);
  assert.equal(finding.severity, "warning");
  assert.match(finding.description, /newer Viewpoint version/i);
  assert.match(finding.description, /do not prove a crash/i);
  assert.equal(report.errorCount, 0);
});

test("warns about KK Shelves and Living Props together but not KK Shelves alone", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const together = analyze([
    "Project Zomboid Build 42.21.0",
    "Workshop ID: 3815931973",
    "Mod ID: ProjectViewpointShelves",
    "Workshop ID: 3816442251",
    "Mod ID: ViewpointLivingProps"
  ].join("\n"), "shelves-livingprops.txt");
  const warning = together.findings.find(item => item.id === "viewpoint-kk-shelves-living-props-model-overlap");
  assert.ok(warning);
  assert.equal(warning.severity, "warning");
  assert.match(warning.description, /not evidence of a crash/i);

  const shelvesOnly = analyze([
    "Project Zomboid Build 42.21.0",
    "Workshop ID: 3815931973",
    "Mod ID: ProjectViewpointShelves"
  ].join("\n"), "shelves-only.txt");
  assert.ok(!shelvesOnly.findings.some(item => item.id === "viewpoint-kk-shelves-living-props-model-overlap"));
});


test("recognizes base Immersive Snow as working and informational", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze([
    "Project Zomboid Build 42.21.0",
    "Workshop ID: 3810071828",
    "Mod ID: ImmersiveSnow"
  ].join("\n"), "immersive-snow-base.txt");
  const finding = report.findings.find(item => item.id === "immersive-snow-base-addon-reference");
  assert.ok(finding);
  assert.equal(finding.severity, "info");
  assert.match(finding.title, /no failure indicated/i);
  assert.match(finding.description, /works independently/i);
  assert.ok(!report.findings.some(item => item.id === "immersive-snow-viewpoint-version-compatibility"));
  assert.equal(report.errorCount, 0);
});

test("recognizes the Viewpoint bridge and flags its known 0.1.7-rc2 incompatibility, not a crash", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze([
    "Project Zomboid Build 42.21.0",
    "Project Viewpoint 0.1.7-rc2",
    "Workshop ID: 3816586790",
    "Mod ID: ImmersiveSnowViewpoint",
    "Workshop ID: 3810071828",
    "Mod ID: ImmersiveSnow",
    "ZombieBuddy"
  ].join("\n"), "immersive-snow-viewpoint.txt");
  const finding = report.findings.find(item => item.id === "immersive-snow-viewpoint-version-compatibility");
  assert.ok(finding);
  assert.equal(finding.severity, "warning");
  assert.equal(finding.confidence, "high");
  assert.match(finding.title, /incompatible.*0\.1\.7-rc2/i);
  assert.match(finding.description, /base Immersive Snow.*should not be blamed/i);
  assert.match(finding.description, /not itself proof of a crash/i);
  assert.equal(report.errorCount, 0);
});

test("does not report a compatibility failure for the add-on on its supported Viewpoint 0.1.6.1 version", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze([
    "Project Zomboid Build 42.21.0",
    "Project Viewpoint 0.1.6.1",
    "Workshop ID: 3816586790",
    "Mod ID: ImmersiveSnowViewpoint",
    "Workshop ID: 3810071828",
    "Mod ID: ImmersiveSnow"
  ].join("\n"), "immersive-snow-supported-version.txt");
  assert.ok(report.findings.some(item => item.id === "immersive-snow-viewpoint-addon-reference"));
  assert.ok(!report.findings.some(item => item.id === "immersive-snow-viewpoint-version-compatibility"));
});

test("recognizes Viewpoint Tile Fix and warns only for the reported nightly pairing", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const nightly = analyze([
    "Project Zomboid Build 42.21.0",
    "Project Viewpoint 0.1.7-rc2",
    "Viewpoint: 0.1.7-rc2, release, setup edition 2",
    "Workshop ID: 3814178814",
    "Mod ID: ViewpointTileFix"
  ].join("\n"), "viewpoint-tile-fix-nightly.txt");
  const reference = nightly.findings.find(item => item.id === "viewpoint-tile-fix-addon-reference");
  const warning = nightly.findings.find(item => item.id === "viewpoint-tile-fix-nightly-compatibility-report");
  assert.ok(reference, "Viewpoint Tile Fix should be recognized by Workshop ID / Mod ID");
  assert.equal(reference.severity, "info");
  assert.ok(warning, "the reported nightly compatibility warning should be shown");
  assert.equal(warning.severity, "warning");
  assert.match(warning.description, /not proof.*caused a crash/i);
  assert.ok(nightly.recognizedMods.some(item => item.name === "Viewpoint Tile Fix"));
  assert.equal(nightly.errorCount, 0);

  const stable = analyze([
    "Project Zomboid Build 42.21.0",
    "Project Viewpoint 0.1.6.1",
    "Viewpoint: 0.1.6.1, release, setup edition 2",
    "Workshop ID: 3814178814",
    "Mod ID: ViewpointTileFix"
  ].join("\n"), "viewpoint-tile-fix-stable.txt");
  assert.ok(stable.findings.some(item => item.id === "viewpoint-tile-fix-addon-reference"));
  assert.ok(!stable.findings.some(item => item.id === "viewpoint-tile-fix-nightly-compatibility-report"));
});

test("flags Mvdox Grass as incompatible with Viewpoint nightly, without claiming a crash", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze([
    "Project Zomboid Build 42.21.0",
    "Project Viewpoint 0.1.7-rc2",
    "Viewpoint: 0.1.7-rc2, release, setup edition 2",
    "Workshop ID: 3815166404",
    "Mod ID: Mvdox-Grass-v1"
  ].join("\n"), "mvdox-grass-nightly.txt");
  const reference = report.findings.find(item => item.id === "mvdox-grass-viewpoint-addon-reference");
  const warning = report.findings.find(item => item.id === "mvdox-grass-nightly-incompatibility");
  assert.ok(reference, "Mvdox Grass should be recognized by Workshop ID / Mod ID");
  assert.equal(reference.severity, "info");
  assert.ok(warning, "the nightly incompatibility warning should be shown");
  assert.equal(warning.severity, "warning");
  assert.match(warning.description, /not proof.*caused a crash/i);
  assert.equal(report.errorCount, 0);
});

test("does not flag Mvdox Grass as nightly-incompatible on stable Viewpoint 0.1.6.1", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze([
    "Project Zomboid Build 42.21.0",
    "Project Viewpoint 0.1.6.1",
    "Viewpoint: 0.1.6.1, release, setup edition 2",
    "Workshop ID: 3815166404",
    "Mod ID: Mvdox-Grass-v1"
  ].join("\n"), "mvdox-grass-stable.txt");
  assert.ok(report.findings.some(item => item.id === "mvdox-grass-viewpoint-addon-reference"));
  assert.ok(!report.findings.some(item => item.id === "mvdox-grass-nightly-incompatibility"));
});

test("does not flag base Immersive Snow as a Viewpoint integration failure when used alone", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze([
    "Project Zomboid Build 42.21.0",
    "Workshop ID: 3810071828",
    "Mod ID: ImmersiveSnow"
  ].join("\n"), "immersive-snow-without-bridge.txt");
  assert.ok(!report.findings.some(item => item.id === "immersive-snow-viewpoint-version-compatibility"));
});


test("imports the full Viewpoint startup set into the session mod list", () => {
  const analyze = loadAnalyzer();
  const names = Array.from({ length:68 }, (_, index) => "StartupMod" + (index + 1));
  const report = analyze([
    "Project Zomboid Build 42.21.0",
    "LOG  : General      f:0> [Viewpoint] addons: the startup set of mods is 68 mods: [" + names.join(", ") + "]",
    "LOG  : General      f:0> | MOD: StartupMod1"
  ].join("\n"), "viewpoint-startup-set.txt");

  assert.equal(report.viewpointStartupCount, 68);
  assert.equal(report.sessionMods.length, 68);
  assert.deepEqual(
    Array.from(report.sessionMods, item => item.name).sort(),
    names.slice().sort()
  );

  const duplicate = report.sessionMods.find(item => item.name === "StartupMod1");
  assert.ok(duplicate);
  assert.deepEqual(Array.from(duplicate.sources).sort(), ["RUNTIME EVIDENCE", "VIEWPOINT STARTUP SET"]);
});

test("keeps runtime-only evidence when Viewpoint startup set is absent", () => {
  const analyze = loadAnalyzer();
  const report = analyze("LOG: | MOD: ExampleRuntimeMod", "runtime-only.txt");
  assert.equal(report.sessionMods.length, 1);
  assert.equal(report.sessionMods[0].name, "ExampleRuntimeMod");
  assert.deepEqual(Array.from(report.sessionMods[0].sources), ["RUNTIME EVIDENCE"]);
  assert.equal(report.viewpointStartupCount, null);
});


test("detects the legacy stable Viewpoint version from QOL runtime evidence", () => {
  const analyze = loadAnalyzer();
  const report = analyze([
    "Project Zomboid Build 42.21.0",
    "LOG  : General f:0> [ProjectViewpointQOL] Project Viewpoint 0.1.6.1 detected (supported)."
  ].join("\n"), "viewpoint-stable.txt");
  assert.deepEqual(
    {version:report.viewpointVersion.version, channel:report.viewpointVersion.channel},
    {version:"0.1.6.1", channel:"stable"}
  );
});

test("detects the new Viewpoint 0.1.7 release-candidate/nightly line", () => {
  const analyze = loadAnalyzer();
  const report = analyze([
    "Project Zomboid Build 42.21.0",
    "LOG  : Lua f:1> [ProjectViewpointQOL] Project Viewpoint 0.1.7-rc2 is not supported: this mod is pinned to 0.1.6.1 only.",
    "Viewpoint: 0.1.7-rc2, release, setup edition 2"
  ].join("\n"), "viewpoint-nightly.txt");
  assert.deepEqual(
    {version:report.viewpointVersion.version, channel:report.viewpointVersion.channel},
    {version:"0.1.7-rc2", channel:"nightly"}
  );
});

test("does not infer a Viewpoint release channel from installed add-on names", () => {
  const analyze = loadAnalyzer();
  const report = analyze([
    "Project Zomboid Build 42.21.0",
    "Workshop ID: 3816586790",
    "Mod ID: ImmersiveSnowViewpoint",
    "LOG  : General f:0> [Viewpoint] addons: the startup set of mods is 4 mods: [ZombieBuddy, Viewpoint, ViewpointSurface, ImmersiveSnowViewpoint]"
  ].join("\n"), "viewpoint-version-unknown.txt");
  assert.equal(report.viewpointVersion, null);
});

test("recognizes KK's Trees and warns for the reported Viewpoint Nightly incompatibility", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const nightly = analyze([
    "Project Zomboid Build 42.21.0",
    "Project Viewpoint 0.1.7-rc2",
    "Viewpoint: 0.1.7-rc2, release, setup edition 2",
    "Workshop ID: 3813172420",
    "Mod ID: ProjectViewpointNearVegetation",
    "PVNV cannot patch lib/sample_sprite.glsl: expected sampling operation not found or ambiguous"
  ].join("\n"), "kk-trees-nightly.txt");
  const reference = nightly.findings.find(item => item.id === "kk-trees-viewpoint-addon-reference");
  const warning = nightly.findings.find(item => item.id === "kk-trees-viewpoint-nightly-incompatibility");
  assert.ok(reference, "KK's Trees should be recognized by Workshop ID / Mod ID");
  assert.equal(reference.severity, "info");
  assert.ok(warning, "the Nightly incompatibility warning should be shown");
  assert.equal(warning.severity, "warning");
  assert.match(warning.description, /not proof.*caused.*crash/i);
  assert.ok(nightly.recognizedMods.some(item => item.name === "KK's Trees"));
  assert.equal(nightly.errorCount, 0);
});

test("does not flag KK's Trees as Nightly-incompatible on stable Viewpoint 0.1.6.1", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const stable = analyze([
    "Project Zomboid Build 42.21.0",
    "Project Viewpoint 0.1.6.1",
    "Viewpoint: 0.1.6.1, release, setup edition 2",
    "Workshop ID: 3813172420",
    "Mod ID: ProjectViewpointNearVegetation"
  ].join("\n"), "kk-trees-stable.txt");
  assert.ok(stable.findings.some(item => item.id === "kk-trees-viewpoint-addon-reference"));
  assert.ok(!stable.findings.some(item => item.id === "kk-trees-viewpoint-nightly-incompatibility"));
});

test("analyzes the real Viewpoint crash-report layout and detects Surface Fix, Tile Fix, KK's Trees, and PVNV failure", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze([
    "Viewpoint crash report",
    "Game: 42.21.0 4a0e9546ec, Java 25.0.1",
    "Viewpoint: 0.1.7-rc3, release, setup edition 2",
    "addons.active=legacy.ViewpointTileFix",
    "LOG : General f:0> [Viewpoint] addons: the startup set of mods is 99 mods: [Viewpoint, ViewpointSurface, ViewpointTileFix, ProjectViewpointNearVegetation]",
    "LOG : General f:0> [ZB] pz.viewpointvegetation C:\\Workshop\\3813172420\\ProjectViewpointNearVegetation.jar",
    "LOG : General f:0> [ZB] vpinteriors C:\\Workshop\\3814398576\\ViewpointSurface.jar",
    "LOG : General f:0> [Viewpoint] far shell band program: PVNV cannot patch lib/sample_sprite.glsl: expected sampling operation not found or ambiguous",
    "LOG : General f:0> [Viewpoint] disabled after error while preparing:",
    "java.lang.IllegalStateException: the renderer could not start: far shell band program: PVNV cannot patch lib/sample_sprite.glsl: expected sampling operation not found or ambiguous"
  ].join("\n"), "real-viewpoint-layout.txt");

  assert.ok(report.recognizedMods.some(item => /Surface Fix/i.test(item.name)));
  assert.ok(report.recognizedMods.some(item => /Tile Fix/i.test(item.name)));
  assert.ok(report.recognizedMods.some(item => /KK's Trees/i.test(item.name)));
  assert.ok(report.findings.some(item => item.id === "viewpoint-tile-fix-nightly-compatibility-report"));
  assert.ok(report.findings.some(item => item.id === "kk-trees-viewpoint-nightly-incompatibility"));
  const shaderFailure = report.findings.find(item => item.id === "kk-trees-pvnv-shader-patch-failure");
  assert.ok(shaderFailure);
  assert.equal(shaderFailure.severity, "error");
  assert.ok(report.sessionMods.some(item => item.name === "ProjectViewpointNearVegetation"));
  assert.ok(report.sessionMods.some(item => item.name === "ViewpointSurface"));
  assert.ok(report.sessionMods.some(item => item.name === "ViewpointTileFix"));
});


test("recognizes Light Fix headlightGain shader/API failure only with its runtime context", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const log = [
    "Project Zomboid Build 42.21.0",
    "Workshop ID: 3811344119",
    "Mod ID: ViewpointLight",
    "[ViewpointHeadlightPlacement] Disabled after API error: java.lang.ExceptionInInitializerError",
    "lib/spots.glsl:116(9): error: 'headlightGain' undeclared",
    "lib/spots.glsl:117(12): error: operands to arithmetic operators must be numeric",
    "java.lang.IllegalStateException: the renderer could not start",
    "at viewpoint.SceneDrawer.drawFrame(SceneDrawer.java:187)"
  ].join("\n");
  const report = analyze(log, "light-fix-console.txt");
  const finding = report.findings.find(item => item.id === "viewpoint-light-fix-headlightgain-shader-api-failure");
  const genericShader = report.findings.find(item => item.id === "shader-compiler-errors");
  assert.ok(finding, "the combined Light Fix initializer and headlight shader failure must be recognized");
  assert.equal(finding.severity, "error");
  assert.match(finding.description, /do not prove that every Light Fix version/i);
  assert.ok(genericShader, "raw GLSL compiler evidence must remain visible");
  assert.ok(!report.findings.some(item => item.id === "no-known-errors"));
});

test("does not attribute headlightGain shader errors to Light Fix without its identity", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze([
    "Project Zomboid Build 42.21.0",
    "lib/spots.glsl:116(9): error: 'headlightGain' undeclared",
    "java.lang.IllegalStateException: the renderer could not start"
  ].join("\n"), "unknown-headlight-shader.txt");
  assert.ok(!report.findings.some(item => item.id === "viewpoint-light-fix-headlightgain-shader-api-failure"));
  assert.ok(report.findings.some(item => item.id === "shader-compiler-errors"));
});


test("flags Barricade Fix Workshop status without falsely calling its successful startup a runtime failure", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const log = [
    "Project Zomboid Build 42.21.0",
    "/steamapps/workshop/content/108600/3815033191/mods/ViewpointBarricade/42/media/java/client/ViewpointBarricades.jar",
    "vpbarricades /ViewpointBarricades.jar",
    "[ViewpointBarricades] 1.0.11 ready: fitted barricade artwork and blank stack layers supported",
    "[ViewpointFenceSheets] Barricade Fix 1.0.11: fence sheets and tarps",
    "[ZB] class vpbarricades.Main: method main() invoked successfully",
    "[ZB] Transformed: viewpoint.world.WorldMesher (retransformed)",
    "[ZB] Transformed: viewpoint.world.PackGather (retransformed)"
  ].join("\n");
  const report = analyze(log, "barricade-fix-console.txt");
  const finding = report.findings.find(item => item.id === "barricade-fix-viewpoint-workshop-review");
  assert.ok(finding, "Barricade Fix should be flagged for Workshop-status review");
  assert.equal(finding.severity, "warning");
  assert.match(finding.description, /not proof that the mod failed at runtime/i);
  assert.match(finding.recommendation, /Do not report it as a confirmed runtime failure/i);
});

test("does not flag Barricade Fix when its Workshop identity is absent", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze("Project Zomboid Build 42.21.0\nThe game started normally.", "no-barricade-fix.txt");
  assert.ok(!report.findings.some(item => item.id === "barricade-fix-viewpoint-workshop-review"));
});

test("recognizes Door Fix by its exact Mod ID without confusing ViewpointDoorLighting", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const doorFix = analyze([
    "Project Zomboid Build 42.21.0",
    "Workshop ID: 3812151347",
    "Mod ID: ViewpointDoor"
  ].join("\n"), "door-fix-exact-id.txt");
  assert.ok(doorFix.findings.some(item => item.id === "viewpoint-door-fix-addon-reference"));
  assert.ok(doorFix.findings.some(item => item.id === "viewpoint-door-fix-current-compatibility-risk"));
  assert.ok(doorFix.recognizedMods.some(item => /Door Fix - Project Viewpoint/i.test(item.name)));

  const lighting = analyze([
    "Project Zomboid Build 42.21.0",
    "Mod ID: ViewpointDoorLighting"
  ].join("\n"), "doorlighting-not-doorfix.txt");
  assert.ok(!lighting.findings.some(item => item.id === "viewpoint-door-fix-addon-reference"));
  assert.ok(!lighting.findings.some(item => item.id === "viewpoint-door-fix-current-compatibility-risk"));
});

test("recognizes Viewpoint Better Terrain without falsely reporting a compatibility failure", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze([
    "Project Zomboid Build 42.21.0",
    "Workshop ID: 3815223174",
    "Mod ID: ViewpointBetterTerrain"
  ].join("\n"), "viewpoint-better-terrain.txt");
  const finding = report.findings.find(item => item.id === "viewpoint-better-terrain-addon-reference");
  assert.ok(finding);
  assert.equal(finding.severity, "info");
  assert.ok(report.recognizedMods.some(item => /Viewpoint Better Terrain/i.test(item.name)));
  assert.equal(report.errorCount, 0);
});


test("tracks only the eleven requested Viewpoint add-ons by Workshop ID or exact Mod ID", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const log = [
    "Workshop ID: 3814398576",
    "Mod ID: VisceralViewpoint",
    "ProjectViewpointShelves",
    "ProjectViewpointNearVegetation",
    "Workshop ID: 3812151347",
    "ImmersiveSnowViewpoint",
    "Mvdox-Grass-v1",
    "ViewpointTileFix",
    "ViewpointBarricade",
    "ViewpointLight",
    "ViewpointBetterTerrain"
  ].join("\n");
  const report = analyze(log, "tracked-mods.txt");
  assert.equal(report.trackedMods.length, 11);
  assert.ok(report.trackedMods.every(mod => mod.detected));
  assert.deepEqual(Array.from(report.trackedMods, mod => mod.name), [
    "Surface Fix","Visceral","KK's Shelves","KK's TREE in 3D","Door Fix",
    "Immersive Snow - Viewpoint","Mvdox Grass","Viewpoint Tile Fix",
    "Barricade Fix","Light Fix","Viewpoint Better Terrain"
  ]);
});

test("shows all eleven requested mods as not found when their identifiers are absent", () => {
  const analyze = loadAnalyzer(loadKnowledgeBase());
  const report = analyze("Project Zomboid Build 42.21.0\nNo tracked mod identifiers here.", "empty-mod-list.txt");
  assert.equal(report.trackedMods.length, 11);
  assert.ok(report.trackedMods.every(mod => !mod.detected));
});
