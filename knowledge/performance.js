window.PZ_DIAGNOSTIC_KNOWLEDGE = (window.PZ_DIAGNOSTIC_KNOWLEDGE || []).concat([
  {
    id:"native-library-load", category:"Java / Native", severity:"warning", confidence:"medium",
    pattern:"UnsatisfiedLinkError|failed to load.*(?:native|library)|could not load.*(?:native|library)",
    title:"Native library loading failure",
    description:"Java could not load a native library. This can involve a missing library, incompatible architecture, or runtime environment problem.",
    causes:["A required native library is missing or inaccessible.","The library architecture does not match the runtime.","A system library dependency is unavailable."],
    checks:["Record the exact library name and full error text.","Check the Java architecture and operating system.","Look for the first underlying loader or filesystem error."],
    recommendation:"Investigate the named library and runtime environment before changing graphics or game settings."
  },
  {
    id:"graphics-context", category:"Graphics", severity:"warning", confidence:"medium",
    pattern:"GLFWError|OpenGL.*(?:error|failed)|context creation failed|failed to create.*(?:OpenGL|GL) context",
    title:"Graphics context or OpenGL initialization problem",
    description:"The log appears to report a graphics-context or OpenGL initialization failure. This may be driver-, runtime-, or configuration-related.",
    causes:["The graphics driver failed to create the requested context.","A graphics library or runtime component is unavailable.","The game is using an unexpected graphics device or driver path."],
    checks:["Capture the complete graphics error and renderer information.","Check the active GPU driver and game launch options.","Determine whether the error occurs at startup or after gameplay begins."],
    recommendation:"Verify the driver and graphics initialization path; do not assume a general performance issue from this signature."
  },
  {
    id:"disk-space", category:"System", severity:"warning", confidence:"high",
    pattern:"No space left on device|disk is full|not enough space",
    title:"Storage space exhausted",
    description:"The operating system or game could not write data because the target storage location appears to be full.",
    causes:["The game drive or user data partition has insufficient free space.","A save, cache, or log directory reached a quota or filesystem limit."],
    checks:["Identify the exact path in the message.","Check free space on the filesystem containing that path.","Check whether the path is writable."],
    recommendation:"Free space on the affected filesystem and verify write permissions before retrying."
  }
]);