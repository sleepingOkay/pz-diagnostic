window.PZ_DIAGNOSTIC_KNOWLEDGE = (window.PZ_DIAGNOSTIC_KNOWLEDGE || []).concat([
  {
    id:"lua-stack-error", category:"Lua / Mods", severity:"warning", confidence:"medium",
    pattern:"\\b(?:attempted to (?:index|call|perform arithmetic on)|attempt to (?:index|call|perform arithmetic on)|Lua error|ERROR: .*\.lua:|function argument.*expected)\\b",
    title:"Lua script error",
    description:"The log contains a Lua runtime or script error. The file path, function name, and stack context are usually more useful than the generic error wording.",
    causes:["A script received an unexpected value.","A mod called an unavailable function or used outdated API behavior.","Two mods changed or replaced the same script behavior."],
    checks:["Find the .lua file path and line number in the error.","Inspect the complete Lua stack trace and nearby preceding errors.","Check whether another mod overrides the same script or feature."],
    recommendation:"Use the script path and stack context to narrow down the mod; a generic Lua error is not enough to name the culprit."
  },
  {
    id:"lua-missing-file", category:"Lua / Mods", severity:"warning", confidence:"medium",
    pattern:"(could not|cannot|can't|failed to) (?:open|read|load).*(?:\\.lua|media/lua)|missing.*\\.lua",
    title:"Lua script file could not be loaded",
    description:"The log suggests that a Lua script file was missing or could not be read.",
    causes:["A mod installation is incomplete or damaged.","A script path changed between mod versions.","A dependency or load-order requirement is not satisfied."],
    checks:["Capture the complete path named in the message.","Check which mod owns that path.","Verify the mod files and dependencies."],
    recommendation:"Verify the affected mod's installation and dependencies before reinstalling the entire game."
  }
]);