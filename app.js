"use strict";

const TRACKED_VIEWPOINT_MODS = [
  { name:"Surface Fix", workshop:"3814398576", ids:["ViewpointSurface"], aliases:["Surface Fix - Project Viewpoint"] },
  { name:"Visceral", workshop:"3820965001", ids:["VisceralViewpoint"], aliases:["Viewpoint - Visceral"] },
  { name:"KK's Shelves", workshop:"3815931973", ids:["ProjectViewpointShelves"], aliases:["KK's Shelves in 3D","KKs Shelves"] },
  { name:"KK's TREE in 3D", workshop:"3813172420", ids:["ProjectViewpointNearVegetation"], aliases:["KK's Trees","KK's TREE in 3D"] },
  { name:"Door Fix", workshop:"3812151347", ids:["ViewpointDoor"], aliases:["Door Fix - Project Viewpoint"] },
  { name:"Immersive Snow - Viewpoint", workshop:"3816586790", ids:["ImmersiveSnowViewpoint"], aliases:["Immersive Snow - Viewpoint"] },
  { name:"Mvdox Grass", workshop:"3815166404", ids:["Mvdox-Grass-v1"], aliases:["Mvdox Grass"] },
  { name:"Viewpoint Tile Fix", workshop:"3814178814", ids:["ViewpointTileFix"], aliases:["Viewpoint Tile Fix"] },
  { name:"Barricade Fix", workshop:"3815033191", ids:["ViewpointBarricade","ViewpointBarricades"], aliases:["Barricade Fix - Project Viewpoint"] },
  { name:"Light Fix", workshop:"3811344119", ids:["ViewpointLight"], aliases:["Light Fix - Project Viewpoint"] },
  { name:"Viewpoint Better Terrain", workshop:"3815223174", ids:["ViewpointBetterTerrain"], aliases:["Viewpoint Better Terrain"] }
];

function detectTrackedMods(text) {
  const source = String(text || "");
  return TRACKED_VIEWPOINT_MODS.map(mod => {
    const identifiers = [mod.workshop, ...mod.ids];
    const foundById = identifiers.some(value =>
      new RegExp("(^|[^A-Za-z0-9])" + value + "($|[^A-Za-z0-9])", "i").test(source)
    );
    const foundByName = mod.aliases.some(value => source.toLowerCase().includes(value.toLowerCase()));
    return { name:mod.name, detected:foundById || foundByName };
  });
}

const fileInput = document.getElementById("file-input");
const uploadCard = document.getElementById("upload-card");
const selectedFile = document.getElementById("selected-file");
const results = document.getElementById("results");
const findingsList = document.getElementById("findings-list");
const environmentGrid = document.getElementById("environment-grid");
const modsList = document.getElementById("mods-list");
let currentReport = null;

fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (file) analyzeFile(file);
});
["dragenter", "dragover"].forEach(type => uploadCard.addEventListener(type, event => {
  event.preventDefault();
  uploadCard.classList.add("dragover");
}));
["dragleave", "drop"].forEach(type => uploadCard.addEventListener(type, event => {
  event.preventDefault();
  uploadCard.classList.remove("dragover");
}));
uploadCard.addEventListener("drop", event => {
  const file = event.dataTransfer && event.dataTransfer.files[0];
  if (file) analyzeFile(file);
});
document.getElementById("new-analysis").addEventListener("click", resetAnalyzer);

async function analyzeFile(file) {
  if (!/\.(txt|log)$/i.test(file.name) && file.type !== "text/plain") {
    showError("Please choose a .txt or .log file.");
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    showError("This file is larger than 50 MB. Please choose a smaller log.");
    return;
  }
  selectedFile.hidden = false;
  selectedFile.textContent = "Reading " + file.name + "…";
  try {
    const text = await file.text();
    currentReport = analyzeLog(text, file.name);
    renderReport(currentReport);
    selectedFile.textContent = file.name + " · " + formatBytes(file.size);
    results.hidden = false;
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showError("The file could not be analyzed: " + error.message);
  }
}



function analyzeLog(text, fileName) {
  const lines = text.split(/\r?\n/);
  const findings = [];
  const mods = new Set();
  const executedMods = new Set();
  const sessionMods = new Map();
  const addSessionMod = (name, source) => {
    const cleanName = String(name || "").trim();
    if (!cleanName || cleanName.length > 180) return;
    const key = cleanName.toLowerCase();
    const existing = sessionMods.get(key);
    if (existing) {
      if (!existing.sources.includes(source)) existing.sources.push(source);
    } else {
      sessionMods.set(key, { name:cleanName, sources:[source] });
    }
  };
  const gameVersion = firstMatch(text, [
    /Project Zomboid(?:\s+Build)?\s*[:=]?\s*(\d+\.\d+(?:\.\d+)?)/i,
    /version\s*[:=]\s*(\d+\.\d+(?:\.\d+)?)/i,
    /build\s*[:=]\s*(\d+\.\d+(?:\.\d+)?)/i
  ]);

  // Prefer version strings emitted by Viewpoint-aware runtime diagnostics.
  // The crash-report header is also accepted when included with console output.
  const viewpointVersion = detectViewpointVersion(text);
  const javaVersion = firstMatch(text, [
    /(?:java|jvm)(?: version)?\s*[:= ]\s*([\w.+-]+)/i,
    /openjdk\s+([\w.+-]+)/i
  ]);
  const os = firstMatch(text, [/(Windows\s+\d+[^\r\n]*|Linux[^\r\n]*|Mac OS X[^\r\n]*)/i]);
  const gpu = firstMatch(text, [/(?:GPU|Renderer|OpenGL renderer)\s*[:=]\s*([^\r\n]+)/i]);
  const memory = firstMatch(text, [/(?:Max(?:imum)?\s+heap|Heap\s+size|Memory)\s*[:=]\s*([^\r\n]+)/i]);

  // Prefer explicit Project Zomboid mod attribution over generic "loaded" words.
  for (const match of text.matchAll(/(?:Workshop ID|WorkshopID|workshop[id_]?)\s*[:=#]*(\d{8,})/gi)) mods.add("Workshop ID " + match[1]);

  // Viewpoint prints the complete startup set in one diagnostic line. These
  // mods were included in the session's startup set; this is not proof that
  // every one completed initialization.
  const viewpointStartupPattern = /\[Viewpoint[^\]]*\][^\r\n]*?startup set of mods is\s+(\d+)\s+mods:\s*\[([^\]]*)\]/gi;
  let viewpointStartupCount = null;
  for (const match of text.matchAll(viewpointStartupPattern)) {
    viewpointStartupCount = Math.max(viewpointStartupCount || 0, Number(match[1]) || 0);
    for (const name of match[2].split(",")) addSessionMod(name, "VIEWPOINT STARTUP SET");
  }

  for (const match of text.matchAll(/\|\s*MOD:\s*([^\r\n]+)/gi)) {
    const name = match[1].trim();
    if (name && name.length < 180) {
      mods.add(name);
      executedMods.add(name);
      addSessionMod(name, "RUNTIME EVIDENCE");
    }
  }
  // Lua(module) records are runtime evidence: code from this module was reached.
  for (const match of text.matchAll(/Lua\(([^)]+)\)/g)) {
    const name = match[1].trim();
    if (name && !/^(Vanilla|Base|Shared)$/i.test(name)) {
      mods.add(name);
      executedMods.add(name);
      addSessionMod(name, "RUNTIME EVIDENCE");
    }
  }
  for (const match of text.matchAll(/([\w.-]+\.jar)/gi)) mods.add(match[1]);
  for (const match of text.matchAll(/\[Viewpoint[^\]]*\][^\r\n]*/gi)) {
    if (/fail|error|unavailable|exception/i.test(match[0])) mods.add("Viewpoint-related component");
  }

  const exceptionMatches = collectMatches(lines, /(?:[A-Za-z_$][\w$]*(?:\.[\w$]+)*(?:Exception|Error)|Exception|Error):\s*[^\r\n]+/, 30);
  // Project Zomboid uses severity-prefixed records such as
  // "ERROR: General ... > message". Capture these even when they are
  // neither Java exceptions nor Lua errors, so real logs do not look clean.
  const engineErrors = collectMatches(lines, /^\s*ERROR\s*:/i, 50);
  const engineWarnings = collectMatches(lines, /^\s*WARN\s*:/i, 50);
  const luaMatches = collectMatches(lines, /(?:attempted index of|attempted to call|Lua error|function argument|stack traceback:|ERROR:.*\bLua\b)/i, 30);
  const viewpointFailures = collectMatches(lines, /\[Viewpoint[^\]]*\][^\r\n]*(?:fail|error|unavailable|exception)[^\r\n]*/i, 20);
  // GLSL compiler diagnostics can be fatal even when they are not Java or Lua exceptions.
  // Keep them visible without blaming a mod merely because its name appears nearby.
  const shaderCompilerErrors = collectMatches(lines,
    /(?:\.glsl|\.(?:vert|frag)):\d+(?:\(\d+\))?:\s*(?:error|warning):|(?:error|warning):[^\r\n]*(?:undeclared|not supported|no matching|type mismatch|cannot convert|syntax error)/i,
    40);
  const missingMethods = collectMatches(lines, /NoSuchMethodException[^\r\n]*/i, 15);
  const classCasts = collectMatches(lines, /ClassCastException[^\r\n]*/i, 15);
  const nullPointers = collectMatches(lines, /NullPointerException[^\r\n]*/i, 15);
  const stackTraces = extractStackTraces(lines);
  const luaStackTraces = extractLuaStackTraces(lines);

  if (classCasts.length) findings.push({
    id:"java-class-cast", severity:"error", title:"Java type-cast exception",
    description:"A Java component tried to treat one data type as another incompatible type. The exception alone does not identify which mod is responsible.",
    evidence:classCasts[0], count:classCasts.length
  });
  if (missingMethods.length) findings.push({
    id:"missing-method", severity:"warning", title:"Missing Java method",
    description:"A component tried to call a method that was not found. This can indicate that a mod expects a different version of another mod or game internals.",
    evidence:missingMethods[0], count:missingMethods.length
  });
  if (nullPointers.length) findings.push({
    id:"null-pointer", severity:"warning", title:"Null pointer exception",
    description:"Java code attempted to use an object reference that was not available. The stack trace helps identify the code path involved.",
    evidence:nullPointers[0], count:nullPointers.length
  });
  if (shaderCompilerErrors.length) findings.push({
    id:"shader-compiler-errors", severity:"error", category:"Graphics / GLSL",
    confidence:"medium", title:"Shader compilation or linking errors detected",
    description:"The log contains GLSL shader compiler diagnostics. These can prevent a renderer from starting, but the compiler message alone does not identify which mod supplied or changed the shader. Use the shader filename, first compiler error, and nearby initialization messages to trace the source.",
    evidence:shaderCompilerErrors.slice(0, 10).join("\\n"),
    count:shaderCompilerErrors.length,
    checks:[
      "Find the earliest compiler error; later type and return errors may be cascading consequences.",
      "Record the shader filename, line number, GPU, driver, OpenGL and GLSL versions.",
      "Attribute the shader to a mod only when the log names the component or a controlled one-mod-only test confirms it."
    ],
    recommendation:"Treat the first GLSL compiler error as the primary shader lead. Do not count every cascading compiler message as a separate incompatible mod."
  });
  if (viewpointFailures.length) findings.push({
    id:"viewpoint-errors", severity:"warning", title:"Viewpoint reported an internal problem",
    description:"The log contains Viewpoint-prefixed failure or error messages. Check the surrounding lines and compare installed versions.",
    evidence:viewpointFailures[0], count:viewpointFailures.length
  });
  if (luaMatches.length) findings.push({
    id:"lua-errors", severity:"warning",
    title:luaStackTraces[0] && luaStackTraces[0].mod
      ? "Lua stack trace references " + luaStackTraces[0].mod
      : "Lua error messages",
    description:luaStackTraces[0] && luaStackTraces[0].mod
      ? "A Lua stack frame names this mod. It is a concrete lead for investigation, not proof that the mod caused the original failure."
      : "The log contains Lua errors. Script names and stack context are needed to narrow down the source.",
    evidence:luaStackTraces.length ? luaStackTraces[0].evidence : luaMatches[0],
    count:luaMatches.length
  });
  if (stackTraces.length) {
    const primary = stackTraces[0];
    findings.push({
      id:"stack-trace", severity:"info",
      title: primary.component ? "Stack trace points to " + primary.component : "Java stack trace extracted",
      description: primary.component
        ? "This is the first non-standard Java frame found in the exception stack. It identifies code involved in the failing call path, not automatically the root cause."
        : "A Java stack trace was found, but its frames do not identify a third-party component with confidence.",
      evidence:primary.evidence,
      count:stackTraces.length
    });
  }
  if (exceptionMatches.length && !findings.some(item => item.evidence === exceptionMatches[0])) findings.push({
    id:"java-exceptions", severity:"warning", title:"Java exception detected",
    description:"The log contains Java exception or error messages. Review the stack trace to determine which code path failed.",
    evidence:exceptionMatches[0], count:exceptionMatches.length
  });
  if (engineErrors.length) findings.push({
    id:"pz-engine-errors", severity:"warning", category:"Project Zomboid log",
    confidence:"low", title:"Project Zomboid ERROR records need review",
    description:"The game log contains ERROR-level records that do not match a known Java or Lua diagnosis yet. Some are recoverable asset or resource messages; their presence alone does not prove they caused a crash. Review the examples and surrounding log context.",
    evidence:engineErrors.slice(0, 8).join("\n"),
    count:engineErrors.length,
    checks:["Check whether these messages appear during startup or immediately before the failure.","Look for a Java exception, Lua stack trace, or repeated failure after these records.","Compare the same operation with the relevant mod or asset changed only if other evidence points there."],
    recommendation:"Treat these as unclassified log errors, not as a confirmed crash cause. The analyzer should retain them so unknown signatures can be investigated."
  });
  if (engineWarnings.length) findings.push({
    id:"pz-engine-warnings", severity:"info", category:"Project Zomboid log",
    confidence:"low", title:"Project Zomboid warning records",
    description:"The log contains warning-level records. Warnings are retained for context but are not automatically treated as errors or crash causes.",
    evidence:engineWarnings.slice(0, 5).join("\n"),
    count:engineWarnings.length
  });
  if (/duplicate\s+(?:roomdef|room def)|duplicate.*metaid/i.test(text)) findings.push({
    id:"duplicate-roomdef", severity:"info", title:"Duplicate room definition warning",
    description:"The log reports duplicate room-definition metadata. This may be a mod/map data conflict, but it is not automatically the cause of a crash.",
    evidence:findLine(lines, /duplicate\s+(?:roomdef|room def)|duplicate.*metaid/i)
  });
  if (/out of memory|java heap space|unable to create new native thread/i.test(text)) findings.push({
    id:"memory", severity:"error", title:"Memory or thread allocation failure",
    description:"The log contains a memory or thread allocation failure. Check the full exception and available system resources.",
    evidence:findLine(lines, /out of memory|java heap space|unable to create new native thread/i)
  });
  // Consult the offline knowledge base after collecting raw signatures.
  const knowledgeFindings = matchKnowledgeBase(text, lines);
  // WorldDictionary wrapper exceptions are consequences of the first missing-script failure;
  // avoid presenting the same fatal loading chain as a second generic Java diagnosis.
  if (knowledgeFindings.some(item => item.id === "world-dictionary-missing-script" || item.suppressGenericJavaException) &&
      exceptionMatches.length && (knowledgeFindings.some(item => item.id === "world-dictionary-missing-script") || /NoSuchFileException/i.test(exceptionMatches[0]))) {
    for (let i = findings.length - 1; i >= 0; i--) {
      if (findings[i].id === "java-exceptions") findings.splice(i, 1);
    }
  }
  // A curated rule should replace the generic engine ERROR label for the
  // exact lines it explains, while unrelated ERROR records remain visible.
  const curatedEvidence = new Set(knowledgeFindings.flatMap(item =>
    String(item.evidence || "").split("\n")
  ));
  // AdvancedAnimator logs a wrapper ERROR line followed by the NoSuchFileException
  // on the next line. Correlate that pair so optional-folder scans are not duplicated.
  const coveredAdvancedAnimatorErrors = new Set();
  if (knowledgeFindings.some(item => item.id === "advancedanimator-optional-mod-animation-folders")) {
    for (const errorLine of engineErrors) {
      if (!/AdvancedAnimator\$1\.visitFileFailed/i.test(errorLine)) continue;
      const number = Number((errorLine.match(/^Line (\d+):/) || [])[1]);
      if (!Number.isFinite(number)) continue;
      const context = lines.slice(number, number + 3).join("\n");
      if (/NoSuchFileException:[^\r\n]*\\media\\(?:AnimSets|actiongroups)/i.test(context)) {
        coveredAdvancedAnimatorErrors.add(errorLine);
      }
    }
  }
  const curatedEngineSuppressors = knowledgeFindings
    .map(item => item.suppressEngineErrorsPattern)
    .filter(Boolean)
    .map(value => { try { return new RegExp(value, "i"); } catch (error) { return null; } })
    .filter(Boolean);
  const coveredByCuratedSignature = new Set(engineErrors.filter(line =>
    curatedEngineSuppressors.some(pattern => pattern.test(line))
  ));
  const genericEngineIndex = findings.findIndex(item => item.id === "pz-engine-errors");
  if (genericEngineIndex >= 0) {
    const remainingEngineErrors = engineErrors.filter(line => !curatedEvidence.has(line) && !coveredAdvancedAnimatorErrors.has(line) && !coveredByCuratedSignature.has(line));
    if (!remainingEngineErrors.length) {
      findings.splice(genericEngineIndex, 1);
    } else {
      findings[genericEngineIndex] = {
        ...findings[genericEngineIndex],
        evidence:remainingEngineErrors.slice(0, 8).join("\n"),
        count:remainingEngineErrors.length
      };
    }
  }
  for (const item of knowledgeFindings) {
    if (item.id === "viewpoint-interior-surface-mismatch") {
      // Keep the specific integration finding, but avoid repeating the same
      // NoSuchMethodException as a generic missing-method warning.
      for (let i = findings.length - 1; i >= 0; i--) {
        if (findings[i].id === "missing-method" && /WallMesher\.back/i.test(findings[i].evidence)) findings.splice(i, 1);
      }
    }
    const existingIndex = findings.findIndex(existing =>
      existing.id === item.id || (item.evidence && existing.evidence === item.evidence)
    );
    if (existingIndex >= 0) {
      // Enrich raw parser findings with curated confidence, causes,
      // checks, and recommendations from the knowledge base.
      findings[existingIndex] = {
        ...findings[existingIndex],
        ...item,
        count: Math.max(findings[existingIndex].count || 1, item.count || 1)
      };
    } else {
      findings.push(item);
    }
  }

  if (!findings.length) findings.push({
    id:"no-known-errors", severity:"info", title:"No recognized error pattern found",
    description:"This version did not recognize a known error signature. It does not mean the log is error-free.",
    evidence:"No matching signatures in " + lines.length.toLocaleString() + " lines."
  });

  const errorCount = findings.filter(item => item.severity === "error").length;
  const warningCount = findings.filter(item => item.severity === "warning").length;
  const infoCount = findings.filter(item => item.severity === "info").length;
  return {
    fileName, lineCount:lines.length, size:text.length,
    environment:{
      "Game version":gameVersion || "Not detected",
      "Java version":javaVersion || "Not detected",
      "Operating system":os || "Not detected",
      "Graphics device":gpu || "Not detected",
      "Memory detail":memory || "Not detected"
    },
    findings, mods:[...mods].sort(),
    executedMods:[...executedMods].sort((a, b) => a.localeCompare(b)),
    sessionMods:[...sessionMods.values()].sort((a, b) => a.name.localeCompare(b.name)),
    viewpointStartupCount,
    viewpointVersion,
    trackedMods:detectTrackedMods(text),
    recognizedMods:knowledgeFindings
      .filter(item => item.id !== "viewpoint-living-props-addon-reference")
      .filter(item => /(?:^|\s)Mod reference$/i.test(item.category || "") && /is present in this log$/i.test(item.title || ""))
      // A single Workshop/Mod ID can have multiple historical knowledge entries.
      // Keep one canonical reference per rule ID before deriving display names.
      .filter((item, index, list) => list.findIndex(other => other.id === item.id) === index)
      .map(item => ({
        name:item.title
          .replace(/\s+is present in this log$/i, "")
          .replace(/^Project Viewpoint:\s*/i, "")
          .replace(/^Viewpoint\s*-\s*/i, "")
          .replace(/\s*-\s*Project Viewpoint$/i, "")
          .trim()
      }))
      .filter((item, index, list) => list.findIndex(other => other.name === item.name) === index)
      .sort((a, b) => a.name.localeCompare(b.name)),
    errorCount, warningCount, infoCount,
    diagnosisFlags: {
      wallMesherMissing: /NoSuchMethodException:[^\r\n]*WallMesher\.back/i.test(text),
      viewpointInteriorSurfaces: /ViewpointInteriorSurfaces|vpinteriors/i.test(text),
      floatBooleanCast: /ClassCastException[\s\S]{0,300}Float cannot be cast to class java\.lang\.Boolean/i.test(text)
    }
  };
}

// Extracts frames belonging to each Java exception. Java/JDK and game-engine
// frames are not labelled as mods. Third-party package names are only leads.
function detectViewpointVersion(text) {
  const candidates = [];
  const patterns = [
    {
      regex: /\[ProjectViewpointQOL\][^\r\n]*?\bProject Viewpoint\s+(v?\d+\.\d+(?:\.\d+)*(?:-[0-9A-Za-z.-]+)?)/i,
      source: "VIEWPOINT QOL RUNTIME"
    },
    {
      regex: /^\s*Viewpoint:\s*(v?\d+\.\d+(?:\.\d+)*(?:-[0-9A-Za-z.-]+)?)(?:\s*,\s*([^,\r\n]+))?/i,
      source: "VIEWPOINT REPORT HEADER"
    }
  ];

  for (const line of String(text || "").split(/\r?\n/)) {
    for (const pattern of patterns) {
      const match = line.match(pattern.regex);
      if (match) candidates.push({
        version: match[1].replace(/^v/i, ""),
        source: pattern.source
      });
    }
  }

  if (!candidates.length) {
    if (/\bViewpoint\b[^\r\n]{0,100}\b(nightly|snapshot|development build)\b/i.test(text)) {
      return {version:"Not reported", channel:"nightly", label:"NIGHTLY", source:"EXPLICIT CHANNEL MARKER"};
    }
    return null;
  }

  const detected = candidates[candidates.length - 1];
  const version = detected.version;
  let channel = "unknown";
  let label = "VERSION FOUND · CHANNEL UNKNOWN";

  if (/^0\.1\.6(?:\.1)?$/i.test(version)) {
    channel = "stable";
    label = "STABLE · LEGACY";
  } else if (/^0\.1\.7(?:[-.]|$)/i.test(version) ||
             /(?:nightly|snapshot|dev|alpha|beta|rc)/i.test(version)) {
    channel = "nightly";
    label = "NIGHTLY · NEW LINE";
  }

  return {version, channel, label, source:detected.source};
}

function extractStackTraces(lines) {
  const results = [];
  const header = /(?:Exception|Error)(?::|\s*:).*|Caused by:\s*[^\r\n]+/;
  const frame = /^\s*(?:at\s+)?([\w.$]+)\(([^)]*(?:\.java(?::\d+)?|Unknown Source))\)/;
  for (let i = 0; i < lines.length && results.length < 12; i++) {
    if (!header.test(lines[i])) continue;
    const frames = [];
    for (let j = i + 1; j < lines.length && j <= i + 35; j++) {
      const match = lines[j].match(frame);
      if (match) frames.push({ className:match[1], source:match[2], line:j + 1 });
      else if (frames.length && lines[j].trim() && !/^\s*(\.\.\. \d+ more|Caused by:)/.test(lines[j])) break;
    }
    if (!frames.length) continue;
    const external = frames.find(item => !/^(java|javax|jdk|sun|com\.sun|org\.lwjgl|org\.joml)\./.test(item.className)
      && !/^(zombie|se\.krka\.kahlua|fmod)\./.test(item.className));
    const component = external ? external.className.split(".").slice(0, 2).join(".") : null;
    const evidence = [
      "Exception: " + lines[i].trim().slice(0, 300),
      ...frames.slice(0, 6).map(item => "at " + item.className + "(" + item.source + ")")
    ].join("\n");
    results.push({ component, evidence, frames });
  }
  return results;
}


function extractLuaStackTraces(lines) {
  const results = [];
  const framePattern = /Lua\(([^)]+)\)\.([^(]+)\(([^:)]*\.lua):(\d+)\)/i;
  for (let i = 0; i < lines.length && results.length < 20; i++) {
    const isHeader = /stack traceback:|lua stack trace|callframe at:/i.test(lines[i]);
    const firstFrame = lines[i].match(framePattern);
    if (!isHeader && !firstFrame) continue;
    const start = isHeader ? i : Math.max(0, i - 2);
    const frames = [];
    const captured = [];
    for (let j = isHeader ? i + 1 : i; j < lines.length && j <= i + 35; j++) {
      const line = lines[j];
      if (!line.trim() && captured.length) break;
      if (j > i && /^(?:ERROR:|Exception|Caused by:|\[\d{4}-\d{2}-\d{2})/i.test(line.trim())) break;
      captured.push(line.trim().slice(0, 300));
      const match = line.match(framePattern);
      if (match) frames.push({
        mod:match[1].trim(),
        functionName:match[2].trim(),
        file:match[3],
        line:Number(match[4])
      });
    }
    if (!frames.length) continue;
    const mod = frames.find(frame => !/^(Vanilla|Base|Shared)$/i.test(frame.mod));
    const evidence = [
      "Lua stack trace (starting near line " + (start + 1) + "):",
      ...captured.slice(0, 20)
    ].join("\n");
    results.push({mod:mod ? mod.mod : null, frames, evidence});
    i = Math.max(i, start + captured.length);
  }
  return results;
}

function matchKnowledgeBase(text, lines) {
  const entries = Array.isArray(window.PZ_DIAGNOSTIC_KNOWLEDGE) ? window.PZ_DIAGNOSTIC_KNOWLEDGE : [];
  const found = [];
  const detectedBuild = firstMatch(text, [
    /Project Zomboid(?:\s+Build)?\s*[:=]?\s*(\d+\.\d+(?:\.\d+)?)/i,
    /(?:game\s+)?build\s*[:=]\s*(\d+\.\d+(?:\.\d+)?)/i
  ]);
  for (const entry of entries) {
    // A version-scoped rule is never applied when the log reports another
    // build or when its build cannot be established.
    if (Array.isArray(entry.builds) && (!detectedBuild || !entry.builds.includes(detectedBuild))) continue;
    let pattern;
    try { pattern = new RegExp(entry.pattern, "i"); } catch (error) { continue; }
    const match = pattern.exec(text);
    if (!match) continue;
    if (Array.isArray(entry.requires) && !entry.requires.every(value => {
      try { return new RegExp(value, "i").test(text); } catch (error) { return false; }
    })) continue;
    if (Array.isArray(entry.excludes) && entry.excludes.some(value => {
      try { return new RegExp(value, "i").test(text); } catch (error) { return false; }
    })) continue;
    const countPattern = new RegExp(entry.pattern, "gi");
    const count = (text.match(countPattern) || []).length;
    if (Number.isInteger(entry.minOccurrences) && count < entry.minOccurrences) continue;
    const matchedLines = collectMatches(lines, pattern, 8);
    found.push({
      id:entry.id, severity:entry.severity || "info", title:entry.title || "Known log signature",
      category:entry.category || "General", confidence:entry.confidence || "low",
      description:entry.description || "A known log signature was found.",
      evidence:matchedLines.length ? matchedLines.join("\n") : match[0].slice(0,500), causes:entry.causes || [],
      checks:entry.checks || [], recommendation:entry.recommendation || "",
      scope:entry.scope || "", source:entry.source || "",
      verified:entry.verified === true, builds:entry.builds || null, count,
      suppressGenericJavaException:entry.suppressGenericJavaException === true,
      suppressEngineErrorsPattern:entry.suppressEngineErrorsPattern || "",
      relatedMods:(entry.relatedMods || []).filter(item => !Array.isArray(item.requires) || item.requires.every(value => {
        try { return new RegExp(value, "i").test(text); } catch (error) { return false; }
      }))
    });
  }
  return found;
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return (match[1] || match[0]).trim().slice(0,180);
  }
  return null;
}
function collectMatches(lines, pattern, limit) {
  const found = [];
  for (let i=0;i<lines.length && found.length<limit;i++) {
    if (pattern.test(lines[i])) found.push("Line " + (i+1) + ": " + lines[i].trim().slice(0,500));
    pattern.lastIndex = 0;
  }
  return found;
}
function findLine(lines, pattern) {
  const index = lines.findIndex(line => pattern.test(line));
  return index >= 0 ? "Line " + (index+1) + ": " + lines[index].trim().slice(0,500) : "";
}

function renderTrackedMods(mods) {
  const list = document.getElementById("tracked-mods-list");
  const summary = document.getElementById("tracked-mods-summary");
  if (!list || !summary) return;
  const detected = mods.filter(mod => mod.detected).length;
  summary.textContent = detected + " of " + mods.length + " detected";
  list.replaceChildren();
  mods.forEach(mod => {
    const item = document.createElement("li");
    item.className = "tracked-mod-item " + (mod.detected ? "is-detected" : "not-detected");
    const name = document.createElement("span");
    name.className = "tracked-mod-name";
    name.textContent = mod.name;
    const status = document.createElement("span");
    status.className = "tracked-mod-status";
    status.textContent = mod.detected ? "DETECTED" : "NOT FOUND";
    item.append(name, status);
    list.append(item);
  });
}

function renderReport(report) {
  const viewpointVersion = report.viewpointVersion && report.viewpointVersion.version
    ? report.viewpointVersion.version
    : "Not detected";
  document.getElementById("result-title").textContent =
    report.fileName + " | Viewpoint version: " + viewpointVersion;
  renderTrackedMods(report.trackedMods || detectTrackedMods(""));
}
function summaryCard(label,value,note) {
  return '<div class="summary-card"><div class="summary-label">'+label+'</div><div class="summary-value">'+value+'</div><div class="summary-note">'+note+'</div></div>';
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + " KB";
  return (bytes/1024/1024).toFixed(1) + " MB";
}
function showError(message) {
  selectedFile.hidden = false;
  selectedFile.textContent = message;
  selectedFile.style.color = "var(--red)";
}
function resetAnalyzer() {
  fileInput.value = "";
  selectedFile.hidden = true;
  selectedFile.textContent = "";
  selectedFile.style.color = "";
  results.hidden = true;
  currentReport = null;
  uploadCard.scrollIntoView({behavior:"smooth",block:"center"});
}
