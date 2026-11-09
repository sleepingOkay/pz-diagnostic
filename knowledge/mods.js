window.PZ_DIAGNOSTIC_KNOWLEDGE = (window.PZ_DIAGNOSTIC_KNOWLEDGE || []).concat([
  {
    id:"mod-dependency-missing", category:"Mods", severity:"warning", confidence:"medium",
    pattern:"(missing|required) (?:dependency|dependenc(?:y|ies))|dependency.*(?:not found|missing|unavailable)",
    title:"Possible missing mod dependency",
    description:"A log message appears to report a missing or unavailable dependency. Confirm the exact mod and dependency in the surrounding lines.",
    causes:["A required workshop item is not installed or enabled.","A dependency is disabled or loaded in an unexpected order.","The message is informational and not a fatal failure."],
    checks:["Read the full message to identify both mods.","Check the mod description for required workshop items.","Determine whether the message is followed by a fatal error."],
    recommendation:"Install or enable only a dependency explicitly required by the affected mod; do not assume every warning prevents startup."
  },
  {
    id:"mod-loading-failure", category:"Mods", severity:"warning", confidence:"medium",
    pattern:"(failed|failure|error) (?:while )?(?:loading|initiali[sz]ing) (?:mod|workshop)|(?:mod|workshop).*(?:failed to load|could not be loaded)",
    title:"Mod loading or initialization failure",
    description:"A mod or workshop component appears to have failed during loading. This can be a symptom of a missing dependency, incompatible version, or a problem inside the mod itself.",
    causes:["A required file or dependency is unavailable.","The mod is incompatible with the current game build.","The mod encountered an error during initialization."],
    checks:["Identify the exact mod name or workshop ID.","Inspect the first error immediately before or after this message.","Check whether the game continues loading or terminates."],
    recommendation:"Investigate the named mod and its dependencies; use the first underlying exception rather than the generic loading message."
  },
  {
    id:"mod-duplicate-id", category:"Mods / Content", severity:"warning", confidence:"medium",
    pattern:"duplicate (?:id|identifier|mod id)|already registered.*(?:id|mod)|duplicate.*workshop",
    title:"Duplicate mod identifier or registration",
    description:"The log appears to report a duplicate identifier or registration. This may indicate overlapping content or duplicate installations.",
    causes:["Two installed items register the same identifier.","A mod is present in more than one location.","A mod reports a duplicate registration that may be harmless."],
    checks:["Read the full duplicate identifier and the paths or mod names involved.","Check for duplicate copies in workshop and local mod folders.","See whether a later fatal error references the same content."],
    recommendation:"Resolve only confirmed duplicate installations; do not treat every duplicate warning as a crash cause."
  }
]);