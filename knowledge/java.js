window.PZ_DIAGNOSTIC_KNOWLEDGE = (window.PZ_DIAGNOSTIC_KNOWLEDGE || []).concat([
  {
    id:"java-class-cast", category:"Java", severity:"error", confidence:"high",
    pattern:"ClassCastException",
    title:"Java type-cast exception",
    description:"Java code tried to convert an object into an incompatible type. The exception identifies the failed operation, not necessarily the mod that introduced the bad value.",
    causes:["A mod supplied an unexpected value to another component.","Two mods or versions disagree about the data type they exchange."],
    checks:["Read the complete exception message, including both class names.","Inspect the first relevant third-party frames in the stack trace.","Check whether the same exception occurs with the suspected addon disabled."],
    recommendation:"Use the stack trace to identify involved code, then test one suspected mod or addon at a time."
  },
  {
    id:"java-null-pointer", category:"Java", severity:"warning", confidence:"high",
    pattern:"NullPointerException",
    title:"Java null-pointer exception",
    description:"Java code attempted to use a reference that was null. This often points to an unexpected or missing object, but the responsible component needs to be identified from the stack trace.",
    causes:["An object was not initialized or could not be found.","A mod expected game data that was unavailable.","An earlier error left the game in an unexpected state."],
    checks:["Inspect the first non-game third-party stack frame.","Check the lines immediately before the exception for an earlier failure.","Compare with a test where only the suspected mod is disabled."],
    recommendation:"Do not remove mods based on this exception alone; use the stack trace and a controlled test."
  },
  {
    id:"java-no-such-method", category:"Java", severity:"warning", confidence:"high",
    pattern:"NoSuchMethodException|NoSuchMethodError",
    title:"Java method not found",
    description:"Code attempted to find or call a method that is unavailable in the class it was using. This can happen when an addon expects a different version of a dependency or game internals.",
    causes:["An addon and its required parent mod are incompatible.","A mod was built for a different Project Zomboid version.","A dependency is missing or an unexpected version is loaded."],
    checks:["Identify the class and exact method named in the exception.","Find the first third-party package in the stack trace.","Compare the installed versions of the addon and its dependency."],
    recommendation:"Verify the compatibility requirements before updating or removing anything. Test only the implicated addon."
  },
  {
    id:"java-out-of-memory", category:"Performance", severity:"error", confidence:"high",
    pattern:"OutOfMemoryError|Java heap space|GC overhead limit exceeded",
    title:"Java memory allocation failure",
    description:"The Java runtime could not allocate memory for an operation. The log alone does not show whether the heap limit, a leak, or unusually high workload is responsible.",
    causes:["The configured Java heap is insufficient for the current workload.","A mod or workload is retaining unusually large amounts of data.","The operating system cannot provide the requested memory."],
    checks:["Read the exact OutOfMemoryError subtype.","Check the configured maximum heap and available system memory.","Compare behavior with the same save and a reduced mod set only if other evidence points to mods."],
    recommendation:"Check heap settings and system memory first; avoid assigning a specific mod without supporting evidence."
  },
  {
    id:"java-linkage", category:"Compatibility", severity:"warning", confidence:"high",
    pattern:"NoClassDefFoundError|ClassNotFoundException|AbstractMethodError|IncompatibleClassChangeError",
    title:"Java class or binary compatibility problem",
    description:"Java could not load a required class or found an incompatible class definition. This commonly indicates a missing dependency or mismatched versions.",
    causes:["A required library or mod dependency is missing.","Two components provide incompatible versions of a class.","A mod targets a different game or Java environment."],
    checks:["Record the exact class named in the message.","Check the mod's listed dependencies and load requirements.","Inspect nearby log lines for the first loading failure."],
    recommendation:"Verify dependencies and version compatibility before changing the mod list."
  },
  {
    id:"java-thread-allocation", category:"Performance", severity:"error", confidence:"high",
    pattern:"unable to create native thread|OutOfMemoryError: unable to create",
    title:"Java could not create a native thread",
    description:"The runtime or operating system could not create another native thread. This is not the same as a normal Java heap exhaustion.",
    causes:["The process or system reached a thread/resource limit.","Native memory or system resources are exhausted.","A component is creating too many threads."],
    checks:["Check the full error message and system resource limits.","Look for repeated thread creation or related native-memory warnings.","Compare system memory and process limits at the time of failure."],
    recommendation:"Investigate system resources and thread usage; increasing -Xmx alone may not fix this error."
  }
]);