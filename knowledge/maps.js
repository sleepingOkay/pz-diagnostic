window.PZ_DIAGNOSTIC_KNOWLEDGE = (window.PZ_DIAGNOSTIC_KNOWLEDGE || []).concat([
  {
    id:"map-missing-asset", category:"Maps / Assets", severity:"warning", confidence:"medium",
    pattern:"(file|asset|texture|tile|object).*(?:not found|missing|does not exist)|(?:not found|missing).*(?:\\.png|\\.pack|\\.lotpack|\\.tiles|\\.lua)",
    title:"Missing game or mod asset",
    description:"The log appears to reference an asset or file that could not be found. The path is needed to determine whether this is a harmless optional asset or a broken mod/map installation.",
    causes:["A mod or map references a file that is not included.","A dependency providing the asset is missing.","A file path changed or the installation is incomplete."],
    checks:["Capture the full missing path and nearby mod or map name.","Check whether the message repeats and whether it is followed by a fatal error.","Verify the owning workshop item and its dependencies."],
    recommendation:"Use the full path to identify the owning mod or map; a missing optional asset may not explain a crash."
  },
  {
    id:"map-room-definition", category:"Maps / Content", severity:"info", confidence:"medium",
    pattern:"duplicate\\s+(?:roomdef|room def)|duplicate.*metaid",
    title:"Duplicate room definition metadata",
    description:"The log reports duplicate room-definition metadata. This can occur with overlapping map content, but it is not automatically the cause of a crash.",
    causes:["Two map or building mods define overlapping room metadata.","A map package contains duplicate metadata.","The warning is non-fatal and unrelated to the reported crash."],
    checks:["Record the room or metaID and any map names nearby.","Check whether the same map area or mod is involved in the crash.","Look for a separate exception at the actual crash time."],
    recommendation:"Treat this as a lead only; prioritize a fatal exception or crash stack trace."
  },
  {
    id:"map-script-object-missing", category:"Maps / Content", severity:"info", confidence:"low",
    pattern:"(object|tile|room|zone).*(?:missing|not found|unknown)|(?:missing|not found).*(?:object|tile|room|zone)",
    title:"Missing map or world definition reference",
    description:"A map, zone, room, or object reference may be unavailable. This broad signature is intentionally low confidence because many such messages are harmless.",
    causes:["A map mod references content supplied by another mod.","A map or tile pack is absent or outdated.","The message is a non-fatal fallback warning."],
    checks:["Inspect the complete line for a file path, map name, or object identifier.","Check for repeated errors in the same area or from the same mod.","Look for a separate fatal exception before attributing a crash."],
    recommendation:"Do not disable map mods based on this broad warning alone."
  }
]);