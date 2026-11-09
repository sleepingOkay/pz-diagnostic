window.PZ_DIAGNOSTIC_KNOWLEDGE = (window.PZ_DIAGNOSTIC_KNOWLEDGE || []).concat([
  {
    id:"angelcode-font-texture-load",
    category:"Assets / Fonts",
    severity:"warning",
    confidence:"high",
    pattern:"AngelCodeFont\\.parseFnt[^\\r\\n]*AngelCodeFont failed to load page 0 texture",
    title:"A Project Zomboid font texture failed to load",
    description:"The log explicitly reports that the font parser could not load a font texture page. This is an asset-loading problem, but these messages alone do not establish that the game crashed or identify a mod as the cause.",
    causes:[
      "A referenced font texture is missing or cannot be read.",
      "The game installation or asset path may be incomplete or inaccessible.",
      "A resource-loading problem may be occurring independently of gameplay or mod code."
    ],
    checks:[
      "Record the exact texture path shown in the evidence.",
      "Check whether the named file exists in the Project Zomboid installation.",
      "If the file exists, verify the game files through Steam before changing mods.",
      "Check whether a separate Java exception or Lua stack trace appears at the actual failure point."
    ],
    recommendation:"Verify the named game asset first. Do not disable mods or treat this message as the crash cause unless another part of the log connects it to the failure."
  },
  {
    id:"world-dictionary-missing-script",
    category:"World loading / Mods",
    severity:"error",
    confidence:"high",
    pattern:"WorldDictionaryException[^\\r\\n]*|Missing dictionary script on client",
    requires:["WorldDictionary|SpriteConfigs"],
    title:"World loading blocked by a missing dictionary script",
    description:"Project Zomboid aborted world initialization because a script referenced by the world dictionary was unavailable on the client. This is a direct world-loading failure, not just a generic warning. The missing script name identifies the content to investigate, but does not by itself prove which mod introduced the bad reference.",
    causes:[
      "A mod or map references a script that is not present in the active client mod set.",
      "A mod providing the referenced content is missing, disabled, outdated, or not loaded correctly.",
      "A mod changed or removed a script while saved world or mod metadata still references it."
    ],
    checks:[
      "Record the exact missing dictionary script, such as Base.SMB_steps_FirePole.",
      "Inspect enabled mods and map/content mods that add or alter sprite configurations or script definitions.",
      "Check the lines before WorldDictionary.init for the first loading or dependency failure.",
      "Test only the implicated content mod or dependency at a time; do not remove unrelated mods."
    ],
    recommendation:"Resolve the missing script reference first. Compare the enabled client mods and the mod that supplies the referenced script, then retry world loading with one controlled change.",
    relatedMods:[{
      name:"SMB steps (SMB_steps)",
      requires:["Base\\.SMB_steps_FirePole"],
      reason:"The missing script name is SMB_steps_FirePole, and the available mod description identifies SMB steps as the ladder/fire-pole content mod. This is a strong candidate to verify, not proof that the mod itself is defective."
    }]
  },
  {
    id:"viewpoint-interior-surface-mismatch", category:"Viewpoint / Compatibility", severity:"warning", confidence:"high",
    pattern:"NoSuchMethodException[^\\r\\n]*WallMesher\\.back",
    requires:["ViewpointInteriorSurfaces|vpinteriors"],
    title:"ViewpointInteriorSurfaces integration mismatch",
    description:"The log contains a NoSuchMethodException naming WallMesher.back and also references ViewpointInteriorSurfaces. This is evidence of an addon integration mismatch, but it does not prove that the mismatch caused a separate crash.",
    causes:["The addon expects a method that is not present in the installed Viewpoint version.","The addon and main mod were built for different versions."],
    checks:["Confirm that both Viewpoint and ViewpointInteriorSurfaces are present in this log.","Compare the installed versions and stated compatibility requirements.","Temporarily disable only ViewpointInteriorSurfaces and repeat the same test."],
    recommendation:"Test with only ViewpointInteriorSurfaces disabled while keeping the rest of the setup unchanged. Compare the original crash separately.",
    special:"viewpoint-surface"
  },
  {
    id:"viewpoint-prefixed-error", category:"Viewpoint", severity:"warning", confidence:"medium",
    pattern:"\\[Viewpoint[^\\]]*\\][^\\r\\n]*(?:fail|error|unavailable|exception)",
    title:"Viewpoint reported an internal problem",
    description:"A Viewpoint-prefixed failure or error message was found. The exact message and surrounding stack trace are needed to decide whether it is fatal.",
    causes:["An internal Viewpoint operation failed.","An addon integration or version mismatch is present.","The message is a recoverable warning."],
    checks:["Read the full Viewpoint message and nearby lines.","Check for a Java exception and stack trace at the same time.","Compare the installed Viewpoint and addon versions."],
    recommendation:"Use the specific exception and controlled tests; do not assume every Viewpoint warning causes a crash."
  },
  {
    id:"viewpoint-wallmesher-float-boolean-observed",
    category:"Viewpoint / Java / Build 42.21.0",
    severity:"error",
    confidence:"medium",
    builds:["42.21.0"],
    verified:false,
    source:"Observed in one anonymized Build 42.21.0 console log; requires broader reproduction before this can be considered a confirmed compatibility rule.",
    scope:"This rule identifies a specific observed crash signature only. It does not prove that Viewpoint is universally incompatible with Build 42.21.0 or that another Viewpoint addon caused it.",
    pattern:"ClassCastException[\\s\\S]{0,500}Float cannot be cast to class java\\.lang\\.Boolean",
    requires:["viewpoint\\.world\\.WallMesher\\.wall|WallMesher\\.wall"],
    title:"Viewpoint WallMesher type-cast failure (observed signature)",
    description:"The log contains a Float-to-Boolean ClassCastException and the stack trace points to Viewpoint's WallMesher.wall method. This ties the failing call path to Viewpoint code in this report, but a single log cannot establish whether the defect is in Viewpoint itself, an interaction, or an unexpected value supplied by another component.",
    causes:[
      "The WallMesher code received a value of a different type than it expected.",
      "Another component or mod may have changed data used by this code path.",
      "The exception may be specific to the installed Viewpoint build or the game build."
    ],
    checks:[
      "Confirm the full exception and the WallMesher.wall stack frame in the same log.",
      "Record the exact Viewpoint version and all related Viewpoint addons.",
      "Repeat the same action with only related addons disabled, changing one component at a time.",
      "Compare whether the same Float-to-Boolean exception remains."
    ],
    recommendation:"Treat Viewpoint as involved in the failing call path, not as a proven sole cause. Test related addons individually and compare the exact exception before assigning blame."
  }

  ,
  {
    id:"advancedanimator-optional-mod-animation-folders",
    category:"Mods / Animation assets",
    severity:"info",
    confidence:"high",
    verified:false,
    source:"Observed repeatedly across several user-supplied Build 42 console logs.",
    pattern:"NoSuchFileException:[^\\r\\n]*\\\\media\\\\(?:AnimSets|actiongroups)",
    requires:["AdvancedAnimator\\$1\\.visitFileFailed"],
    title:"AdvancedAnimator scanned animation folders that some mods do not contain",
    description:"Project Zomboid's AdvancedAnimator scans common and build-specific animation folders inside installed mods. The log records NoSuchFileException when those optional-looking AnimSets or actiongroups folders are absent. In the supplied logs this repeats across many unrelated mods, so it is not evidence that each named mod is broken, that its Workshop download is incomplete, or that these messages caused a crash.",
    causes:[
      "A mod does not provide custom animation sets or action groups in that folder.",
      "The engine's media scan attempts to visit a conventional folder even when a mod does not use it."
    ],
    checks:[
      "Do not reinstall or disable a mod solely because one of these optional-looking folders is absent.",
      "Only investigate a specific mod if it is documented to provide custom animation sets and the corresponding animations fail in game.",
      "Look for a separate fatal exception or reproducible animation failure before changing the mod list."
    ],
    recommendation:"No action is recommended from these messages alone. Treat them as repeated media-scan noise unless a specific missing animation asset is tied to a visible failure.",
    suppressGenericJavaException:true
  },
  {
    id:"imported-skeleton-missing-bones",
    category:"Models / Animation skeletons",
    severity:"warning",
    confidence:"medium",
    verified:false,
    source:"Observed repeatedly in several user-supplied Build 42 console logs.",
    pattern:"ImportedSkeleton\\.collectBoneFrames[^\\r\\n]*Could not find bone index for node name",
    title:"An imported model skeleton is missing referenced bone names",
    description:"Project Zomboid's ImportedSkeleton could not find one or more bone names referenced while collecting animation bone frames. The supplied logs repeat names such as Bip01_Root, Bip01_Prop1_end, Bip01_Prop2_end, and HLPR helper bones. This points to a model/rig or animation-asset mismatch, but the log excerpt does not identify the specific model or mod and does not prove a game crash.",
    causes:[
      "An imported model or animation set may reference bones that are absent from its skeleton.",
      "A model, rig, or animation asset may have been authored for a different skeleton layout.",
      "A mod may contain an incomplete or mismatched animation/model asset."
    ],
    checks:[
      "Inspect the lines immediately before the first missing-bone message for the model or asset being loaded.",
      "Check whether the same model displays incorrect animation, missing attachments, or visual deformation in game.",
      "If a specific asset is implicated, test only its supplying mod or model pack and compare the same scene.",
      "Do not disable unrelated mods based only on repeated bone-name messages."
    ],
    recommendation:"Treat this as an animation/model compatibility lead. Identify the asset being imported before changing the mod list.",
    suppressEngineErrorsPattern:"ImportedSkeleton\\.collectBoneFrames[^\\r\\n]*Could not find bone index for node name"
  },
  {
    id:"viewpoint-qol-missing-thirdperson-hook",
    category:"Viewpoint / Add-on compatibility",
    severity:"warning",
    confidence:"medium",
    verified:false,
    source:"Observed in a user-supplied Build 42 console log.",
    pattern:"\\[ProjectViewpointQOL\\] Failed to hook ThirdPerson\\.active: java\\.lang\\.ClassNotFoundException: viewpoint\\.input\\.ThirdPerson",
    requires:["ProjectViewpointQOL"],
    title:"Viewpoint QOL could not find the ThirdPerson class",
    description:"Project Viewpoint QOL attempted to hook viewpoint.input.ThirdPerson.active, but that class was not present at runtime. This is evidence that this particular integration hook did not attach; it does not establish that all QOL features failed or that this message caused a crash.",
    causes:[
      "The installed Viewpoint version may not contain the class expected by this QOL hook.",
      "The addon and main Viewpoint mod may be built for different revisions.",
      "The hook may target an optional class or feature that is not loaded in this session."
    ],
    checks:[
      "Record the exact Project Viewpoint and Project Viewpoint QOL versions.",
      "Compare the add-on's stated compatibility with the installed Viewpoint revision.",
      "Check whether the feature associated with ThirdPerson actually fails in game.",
      "If testing compatibility, change only the QOL addon version and compare the same log section."
    ],
    recommendation:"Verify the Viewpoint and QOL version pairing. Do not treat one failed hook as proof that Viewpoint itself is broken."
  },
  {
    id:"translation-format-string-invalid",
    category:"Localization / UI",
    severity:"warning",
    confidence:"high",
    verified:false,
    source:"Observed in a user-supplied Build 42 console log.",
    pattern:"UnknownFormatConversionException: Conversion = '\\.'",
    requires:["Sandbox_WanderingHordes_MigrationFinalPopDistributionPercent_tooltip"],
    title:"A sandbox-option translation contains an invalid format placeholder",
    description:"Project Zomboid's translation formatter rejected the format string while processing the Wandering Hordes migration-distribution tooltip key. This points to a malformed or mismatched localization string; it is not, by itself, evidence of a crash.",
    causes:[
      "The translation value may contain a percent sign that is not escaped for Java-style formatting.",
      "The translation key and its format arguments may not match the expected placeholders."
    ],
    checks:[
      "Search the active translation files for Sandbox_WanderingHordes_MigrationFinalPopDistributionPercent_tooltip.",
      "Compare the translation value and its percent placeholders with the corresponding default-language entry.",
      "Check whether the warning disappears after updating the mod or translation that supplies the key."
    ],
    recommendation:"Treat this as a localization/tooltip formatting issue unless the log shows a separate failure tied to the same operation."
  }

  ,
  {
    id:"viewpoint-visceral-addon-reference",
    category:"Viewpoint / Mod reference",
    severity:"info",
    confidence:"high",
    verified:false,
    source:"Steam Workshop item 3820965001; metadata checked 7 Nov 2026.",
    pattern:"(?:VisceralViewpoint|3820965001)",
    title:"Viewpoint - Visceral is present in this log",
    description:"This identifies the Viewpoint gore add-on (Mod ID VisceralViewpoint). Its published requirements are Project Viewpoint and ZombieBuddy. The add-on provides 3D wounds, dismemberment, blood effects and ragdolls. Detection confirms only that the identifier appears in the log; it does not indicate an error or prove compatibility with every Viewpoint revision.",
    causes:[],
    checks:[
      "Confirm Project Viewpoint and ZombieBuddy are installed and enabled.",
      "If a shader or rendering failure occurs, inspect the exact shader/compiler message and GPU driver details.",
      "Do not disable Visceral unless an error or reproducible visual failure points to it."
    ],
    recommendation:"Treat this as a detected add-on, not a diagnosis. Use the specific exception or shader error to investigate a problem."
  },
  {
    id:"viewpoint-kk-shelves-addon-reference",
    category:"Viewpoint / Mod reference",
    severity:"info",
    confidence:"high",
    verified:false,
    source:"Steam Workshop item 3815931973; metadata and change notes checked 7 Nov 2026.",
    pattern:"(?:ProjectViewpointShelves|3815931973)",
    title:"Project Viewpoint: KK's Shelves in 3D is present in this log",
    description:"This identifies KK's Viewpoint shelf and cabinet model add-on (Mod ID ProjectViewpointShelves). Its published requirements are Project Viewpoint and ZombieBuddy. The author describes it as compatible with the 6244 3D model pack; 6244 is not a required dependency. Its display props indicate container stock levels and do not change inventory contents or capacity.",
    causes:[],
    checks:[
      "Confirm Project Viewpoint and ZombieBuddy are installed and enabled, then fully restart after mod updates.",
      "If shelf models are missing or overlapping, record the affected furniture/sprite and compare the model packs enabled in the same log.",
      "Do not infer a conflict merely because other Viewpoint model packs are installed."
    ],
    recommendation:"Treat this as a detected model add-on. Investigate only reproducible shelf/model issues or errors that name its assets."
  },
  {
    id:"viewpoint-surface-fix-addon-reference",
    category:"Viewpoint / Mod reference",
    severity:"info",
    confidence:"high",
    verified:false,
    source:"Steam Workshop item 3814398576 and PZ Hub error catalogue; checked 7 Nov 2026.",
    pattern:"(?:ViewpointSurface|3814398576)",
    title:"Surface Fix - Project Viewpoint is present in this log",
    description:"This identifies GamerKreep's Java patch for Viewpoint wall, window and ceiling textures (Mod ID ViewpointSurface). Its published requirements are Project Viewpoint and ZombieBuddy. The public error catalogue showed no errors raised by this add-on for the version it had indexed on 15 Oct 2026; that is limited community telemetry, not proof that the mod is bug-free or compatible with every later Viewpoint build.",
    causes:[],
    checks:[
      "Confirm the installed Surface Fix and Project Viewpoint revisions.",
      "If walls, windows or ceilings render incorrectly, capture the affected location and inspect nearby Java exceptions.",
      "Keep this mod distinct from other similarly named interior-surface add-ons; do not merge their error signatures."
    ],
    recommendation:"Treat this as a detected add-on. A presence match alone is not a compatibility failure."
  },
  {
    id:"viewpoint-living-props-addon-reference",
    category:"Viewpoint / Mod reference",
    severity:"info",    confidence:"high",
    verified:false,
    source:"Steam Workshop item 3816442251; metadata checked 7 Nov 2026.",
    pattern:"(?:ViewpointLivingProps|3816442251)",
    title:"Viewpoint: Living Props is present in this log",
    description:"This identifies the client-side Viewpoint model add-on (Mod ID ViewpointLivingProps). Its published requirements are Project Zomboid Build 42.21 or newer, Project Viewpoint 0.1.6 or newer, and ZombieBuddy. Its author explicitly recommends loading Living Props last when using multiple model packs because later-loaded packs can override its models.",
    causes:[],
    checks:[
      "Confirm the game is Build 42.21 or newer and Project Viewpoint is 0.1.6 or newer.",
      "Check that ZombieBuddy has approved the add-on's Java helper if prompted.",
      "If covered objects use the wrong model, check that Living Props is last among the relevant model packs.",
      "For performance complaints, reproduce in the same area and compare with only Living Props disabled; do not infer a crash from frame-time cost."
    ],
    recommendation:"Check the published version requirements and model-pack load order before changing other mods. Presence alone is not an error."
  },
  {
    id:"viewpoint-door-livingprops-overlap",
    category:"Viewpoint / Add-on interaction",
    severity:"warning",
    confidence:"medium",
    verified:false,
    source:"Steam Workshop item 3812151347 and its public discussion comments, checked 7 Nov 2026. Reports describe duplicate door sheets when Door Fix and Living Props are both enabled; these are community reports, not a confirmed universal failure.",
    pattern:"(?=[\\s\\S]*ViewpointLivingProps)(?:\\bViewpointDoor\\b|3812151347)",
    title:"Possible door-model overlap between Door Fix and Living Props",
    description:"The log contains both Door Fix - Project Viewpoint (Mod ID ViewpointDoor; Workshop 3812151347) and Viewpoint: Living Props. Public reports describe duplicate door sheets when both are enabled. This is a specific visual compatibility lead, not proof of a crash or a problem on every setup. The Door Fix listing also has reports of door interaction problems in online sessions and compatibility concerns after Viewpoint updates.",
    causes:[
      "Both add-ons may provide overlapping door-sheet or door-model assets.",
      "The Door Fix Java patch may not match the installed Project Viewpoint revision.",
      "A multiplayer door interaction issue may have a separate cause and needs its own reproduction."
    ],
    checks:[
      "If duplicate door sheets are visible, compare the same door with Door Fix disabled while leaving Living Props and all other mods unchanged.",
      "Record the exact Project Viewpoint version and whether the issue occurs in single-player, multiplayer, or both.",
      "Do not treat this visual overlap report as the cause of an unrelated Java or Lua crash."
    ],
    recommendation:"If the symptom is duplicate door sheets, isolate Door Fix first and compare the same location. If the symptom is a crash, use the exception and stack trace instead of this compatibility note."
  }

,
  {
    id:"viewpoint-renderer-start-failed-wrapper",
    category:"Viewpoint / Renderer startup",
    severity:"error",
    confidence:"high",
    verified:false,
    source:"Viewpoint crash reports and Project Zomboid console traces; wrapper signature alone does not identify the underlying failure.",
    pattern:"IllegalStateException: the renderer could not start",
    requires:["viewpoint\\.SceneDrawer\\.drawFrame"],
    title:"Viewpoint renderer failed to start (underlying cause still needed)",
    description:"Viewpoint reached SceneDrawer.drawFrame but could not start its renderer. This is a fatal renderer-startup failure, but this wrapper exception is not the root cause. The original shader, OpenGL, resource, or initialization error is usually recorded earlier in console.txt. A shortened log containing only the final lines is insufficient to identify the failing component.",
    causes:[
      "A shader failed to compile or link.",
      "The active OpenGL context or driver may not support a renderer feature required by this Viewpoint build.",
      "A renderer resource or initialization step may have failed before SceneDrawer.drawFrame reported the wrapper exception."
    ],
    checks:[
      "Search the full console.txt for the first shader compilation or linking error before the IllegalStateException.",
      "Record the GPU model, driver version, OpenGL version, GLSL version, and the exact Viewpoint build.",
      "Look for lines naming a shader file, such as model_gbuffer.frag, model_shadow.frag, model_glass.frag, or a specific add-on shader.",
      "Do not blame a model pack or Java add-on unless the preceding error names its shader, class, asset, or code path."
    ],
    recommendation:"Treat this as a confirmed renderer startup failure with an unknown root cause until the earlier console lines are available.",
    suppressGenericJavaException:true
  },
  {
    id:"viewpoint-glsl-variable-sampler-indexing",
    category:"Viewpoint / Shader compatibility",
    severity:"error",
    confidence:"medium",
    verified:false,
    source:"Community reproduction posted on The Indie Stone forums on 15 Oct 2026 for Viewpoint 0.1.6 and PZ 42.21.0; not established as universal across GPUs or drivers.",
    pattern:"variable indexing sampler array",
    requires:["viewpoint\\.SceneDrawer\\.drawFrame"],
    title:"Viewpoint shader compiler rejected variable sampler-array indexing",
    description:"The console reports that a shader uses variable indexing of a sampler array that the active GLSL version or enabled extensions do not support. A public Build 42.21.0 report associated this with Viewpoint's renderer startup failure on an AMD Radeon Vega driver. This is a concrete shader/compiler compatibility failure when the exact message is present, but it does not prove that every AMD GPU or every Viewpoint setup is affected.",
    causes:[
      "The shader's sampler-array indexing may require a newer GLSL version or a supported extension.",
      "The active GPU driver/compiler may enforce GLSL restrictions that another driver accepts.",
      "A shader supplied by Viewpoint or an add-on may not match the capabilities of the active OpenGL context."
    ],
    checks:[
      "Record the shader filename and line number printed immediately before the compiler error.",
      "Record GPU model, driver version, OpenGL version, and GLSL version from the same session.",
      "Check whether the rejected shader belongs to Viewpoint itself or a named add-on before attributing the failure.",
      "Compare with the default Viewpoint shader configuration only as a controlled test; preserve the original settings first."
    ],
    recommendation:"Treat the exact compiler rejection as the actionable failure. The later 'renderer could not start' exception is a consequence, not a separate diagnosis."
  },
  {
    id:"viewpoint-door-fix-addon-reference",
    category:"Viewpoint / Mod reference",
    severity:"info",
    confidence:"high",
    verified:false,
    source:"Steam Workshop item 3812151347; metadata checked 7 Nov 2026.",
    pattern:"(?:\\bViewpointDoor\\b|3812151347)",
    title:"Door Fix - Project Viewpoint is present in this log",
    description:"This identifies GamerKreep's Java patch for Viewpoint door lighting and textures (Mod ID ViewpointDoor). It requires Project Viewpoint and ZombieBuddy. The add-on changes door rendering; its presence alone does not establish a crash or a renderer-startup conflict.",
    causes:[],
    checks:[
      "Confirm the installed Door Fix and Project Viewpoint versions.",
      "If doors render incorrectly, compare the same door with Door Fix disabled while leaving other mods unchanged.",
      "Check whether the installed Viewpoint release already includes the relevant door fix before keeping an older external patch."
    ],
    recommendation:"Treat this as a detected add-on, not a diagnosis. Investigate it only when the log or a reproducible door-rendering issue points to it."
  }

  ,
  {
    id:"viewpoint-doorlighting-incompatible-model-shader",
    category:"Viewpoint / Shader compatibility",
    severity:"error",
    confidence:"high",
    verified:true,
    source:"Directly identified in a user-supplied Project Zomboid console log: Viewpoint reports that ViewpointDoorLighting's model shader is missing the expected vLight texelFetch expression, then aborts renderer startup because multiple programs did not link.",
    pattern:"\\[Viewpoint\\] (?:model|model shadow|model outline|model glass|vehicle|vehicle shadow|vehicle glass|glass flow) program: \\[ViewpointDoorLighting\\] Incompatible model shader; missing: vLight = texelFetch\\(uDraws, record \\+ LIGHT\\);",
    requires:["the renderer could not start","programs that did not link"],
    title:"ViewpointDoorLighting supplies an incompatible model shader",
    description:"This log explicitly names ViewpointDoorLighting as the source of an incompatible model shader. Viewpoint expects the expression 'vLight = texelFetch(uDraws, record + LIGHT);' but cannot find it in the add-on's shader. The same log then reports that the model, shadow, outline, glass, vehicle, and glass-flow programs did not link, so Viewpoint aborts renderer startup. This is direct evidence for this particular startup failure, not a claim that every version or installation of Door Fix is incompatible.",
    causes:[
      "The installed ViewpointDoorLighting shader is written for a different Viewpoint shader interface or revision.",
      "An older or otherwise incompatible Door Fix - Project Viewpoint shader is overriding or modifying Viewpoint's model shader.",
      "The add-on and main Viewpoint mod may have been updated independently and no longer agree on the required shader source."
    ],
    checks:[
      "Temporarily disable only ViewpointDoorLighting / Door Fix - Project Viewpoint and start the same game setup again.",
      "Keep Visceral, ZombieBuddy, and the other mods unchanged during this comparison so the test isolates Door Fix.",
      "If Viewpoint starts, update or leave disabled the incompatible Door Fix build and report the exact missing-expression message to its author.",
      "If the renderer still fails, inspect the next earliest shader compiler or linker error rather than assuming this was the only problem."
    ],
    recommendation:"Disable ViewpointDoorLighting as the first controlled test. The log directly ties its shader mismatch to the failed renderer programs; do not start by removing Visceral or unrelated mods."
  }


  ,
  {
    id:"viewpoint-surface-fix-compatibility-risk",
    category:"Viewpoint / Add-on compatibility",
    severity:"warning",
    confidence:"medium",
    verified:false,
    source:"Steam Workshop discussion for item 3814398576, comments dated 30 Oct–3 Nov 2026, plus the public mod catalogue. Reports include disappearing furniture interactions and ZombieBuddy Invalid Signature approval failures; other users report successful operation. A commenter says the standalone fix is integrated into the main mod, but this is not an author-confirmed universal status.",
    pattern:"(?:ViewpointSurface|3814398576)",
    title:"Surface Fix has reported compatibility and approval issues",
    description:"The log contains Surface Fix - Project Viewpoint (Mod ID ViewpointSurface; Workshop 3814398576). Recent community reports describe furniture interactions disappearing and some installations being blocked by ZombieBuddy with an Invalid Signature status. Other users report that it works correctly, so this is a compatibility warning rather than proof that the installed copy is broken. A community comment also says the fix has been integrated into the main Viewpoint mod; verify the current release notes before keeping a separate copy.",
    causes:[
      "The standalone Java patch may target a different Project Viewpoint revision.",
      "ZombieBuddy may reject the add-on's signature, preventing its Java code from loading.",
      "The patch may affect rendering or interaction behavior for objects outside its intended wall, window, and ceiling fixes."
    ],
    checks:[
      "Check ZombieBuddy's approval result for ViewpointSurface; do not bypass signature verification.",
      "If furniture interactions disappear, repeat the same interaction with only ViewpointSurface disabled.",
      "Check whether the installed Project Viewpoint release already includes the relevant surface fixes.",
      "Record the exact Project Viewpoint version and whether the problem is visual, interactive, or a startup failure."
    ],
    recommendation:"Treat Surface Fix as a compatibility risk to verify, not an automatic crash culprit. If furniture interactions or signature approval fail, test without this standalone patch and compare the same scene."
  },
  {
    id:"viewpoint-door-fix-current-compatibility-risk",
    category:"Viewpoint / Add-on compatibility",
    severity:"warning",
    confidence:"medium",
    verified:false,
    source:"Steam Workshop item 3812151347 discussion comments, including reports dated 18 Oct–7 Nov 2026 describing incompatibility with a newer Viewpoint release, duplicate door sheets with Living Props, Invalid Signature, and multiplayer door interaction problems. Separate direct console evidence for the ViewpointDoorLighting shader mismatch is handled by viewpoint-doorlighting-incompatible-model-shader.",
    pattern:"(?:\\bViewpointDoor\\b|3812151347)",
    title:"Door Fix has reported compatibility issues with newer Viewpoint builds",
    description:"The log contains Door Fix - Project Viewpoint (Mod ID ViewpointDoor; Workshop 3812151347). Recent community reports say it is incompatible with a newer Viewpoint version, describe duplicate door sheets when used with Living Props, and report door interaction problems in online sessions. These reports are not universal and do not prove a crash. If the log contains the exact ViewpointDoorLighting incompatible-shader message, the separate shader diagnosis is stronger and directly identifies the renderer failure.",
    causes:[
      "The Java or shader patch may target an older Viewpoint interface.",
      "Door Fix and Living Props may both provide overlapping door sheets.",
      "The add-on may fail ZombieBuddy signature approval or behave differently in multiplayer."
    ],
    checks:[
      "Check whether ZombieBuddy approved ViewpointDoor and whether its code actually loaded.",
      "If the renderer fails, search for the exact ViewpointDoorLighting incompatible-shader message.",
      "If duplicate door sheets appear, compare with only Door Fix disabled while keeping Living Props enabled.",
      "If doors cannot be interacted with, compare single-player and multiplayer separately."
    ],
    recommendation:"Verify Door Fix against the exact installed Viewpoint release. Do not keep an older patch solely because it used to fix door rendering; isolate it before changing Visceral or unrelated mods."
  },
  {
    id:"viewpoint-kk-shelves-living-props-model-overlap",
    category:"Viewpoint / Model-pack interaction",
    severity:"warning",
    confidence:"medium",
    verified:false,
    source:"Steam Workshop discussion for Project Viewpoint: KK's Shelves in 3D (3815931973), including a 16 Oct 2026 community report of some model variants failing to override when used with Living Props. The author replied that the models differ substantially; this is a limited report, not a confirmed universal incompatibility.",
    pattern:"(?:ProjectViewpointShelves|3815931973)",
    requires:["(?:ViewpointLivingProps|3816442251)"],
    title:"KK's Shelves and Living Props may overlap on some model variants",
    description:"The log contains both Project Viewpoint: KK's Shelves in 3D and Viewpoint: Living Props. A community report describes some model variants failing to override when both are enabled, while the author notes that the two packs use substantially different models. This is a limited model-selection/override lead, not evidence of a crash or a universal conflict. KK's Shelves is documented to coexist with the 6244 3D model pack; that does not establish compatibility with every other model pack.",
    causes:[
      "Both model packs may target overlapping furniture or container variants.",
      "Some variants may resolve to a different model depending on the active pack or asset mapping.",
      "The observed issue may affect only particular furniture variants rather than the entire add-on."
    ],
    checks:[
      "Record the exact shelf or cabinet variant that renders incorrectly.",
      "Compare the same object with only Living Props disabled, then restore it and test with only KK's Shelves disabled.",
      "Keep the 6244 model pack unchanged during the comparison unless it is independently implicated.",
      "Do not interpret this warning as a Java crash diagnosis."
    ],
    recommendation:"If shelves or cabinets display the wrong model, isolate the two packs with one controlled change at a time. Do not disable either mod based on presence alone."
  }


  ,
  {
    id:"immersive-snow-base-addon-reference",
    category:"Immersive Snow / Mod reference",
    severity:"info",
    confidence:"high",
    verified:false,
    source:"Steam Workshop item 3810071828, description and requirements checked 7 Nov 2026.",
    pattern:"(?:ImmersiveSnow\\b|3810071828)",
    title:"Immersive Snow (base mod) is detected — no failure indicated",
    description:"This is the base Immersive Snow mod (Workshop 3810071828; Mod ID ImmersiveSnow). The base mod works independently and provides the snow effects themselves. Its presence is not a compatibility failure and must not be blamed for a problem that occurs only in Viewpoint's 3D renderer. That integration is handled by the separate Immersive Snow - Viewpoint add-on (Workshop 3816586790).",
    causes:[],
    checks:[
      "Keep the base Immersive Snow enabled when testing the Viewpoint integration.",
      "Only investigate the base mod itself if its snow effects also fail outside Viewpoint's 3D view.",
      "For a Viewpoint-only problem, inspect Immersive Snow - Viewpoint separately."
    ],
    recommendation:"Treat the base Immersive Snow as working unless there is separate evidence of a base-mod failure. Do not report it as the incompatible component."
  },
  {
    id:"immersive-snow-viewpoint-addon-reference",
    category:"Viewpoint / Mod reference",
    severity:"info",
    confidence:"high",
    verified:false,
    source:"Steam Workshop item 3816586790, description and requirements checked 7 Nov 2026.",
    pattern:"(?:ImmersiveSnowViewpoint|3816586790)",
    title:"Immersive Snow - Viewpoint integration is detected",
    description:"This is the separate compatibility add-on (Workshop 3816586790; Mod ID ImmersiveSnowViewpoint) that connects Immersive Snow to Viewpoint's 3D renderer. Detecting it confirms that the integration is installed; it does not by itself prove that it loaded successfully or caused a crash.",
    causes:[],
    checks:[
      "Check the installed Project Viewpoint version against the add-on's supported version.",
      "Check the Immersive Snow version and ZombieBuddy approval/loading messages.",
      "If snow is missing only in the 3D view, test this add-on separately while leaving base Immersive Snow enabled."
    ],
    recommendation:"Treat this as the integration component, distinct from the working base snow mod. Evaluate its compatibility with the installed Viewpoint version."
  },
  {
    id:"immersive-snow-viewpoint-version-compatibility",
    category:"Viewpoint / Add-on version compatibility",
    severity:"warning",
    confidence:"high",
    verified:false,    source:"Steam Workshop item 3816586790 description, requirements and update behavior, checked 7 Nov 2026. The author states it was made for Viewpoint 0.1.6.1 (0.1.6 also works), requires Immersive Snow 0.5.2 Patch 5 or newer and ZombieBuddy, and stands down automatically when Viewpoint or Immersive Snow versions do not match.",
    pattern:"(?:ImmersiveSnowViewpoint|3816586790)",
    requires:["Project Viewpoint\\s+0\\.1\\.7-rc2"],
    title:"Immersive Snow - Viewpoint is incompatible with the detected Viewpoint 0.1.7-rc2 build",
    description:"The log identifies Immersive Snow - Viewpoint (Workshop 3816586790; Mod ID ImmersiveSnowViewpoint) together with Project Viewpoint 0.1.7-rc2. The add-on was made for Viewpoint 0.1.6.1 (0.1.6 is also listed as working), not 0.1.7-rc2. This is an integration-version compatibility problem: the base Immersive Snow mod (3810071828) is separate and should not be blamed. The add-on may automatically stand down, leaving snow hidden in Viewpoint's 3D view; that fallback is not itself proof of a crash.",
    causes:[
      "The installed Viewpoint 0.1.7-rc2 build is newer than the renderer interface this add-on was made for.",
      "The add-on's integration code may therefore stand down instead of rendering Immersive Snow effects in the 3D view.",
      "ZombieBuddy approval/loading or the required Immersive Snow version may also affect whether the integration initializes."
    ],
    checks:[
      "Confirm that the log reports Project Viewpoint 0.1.7-rc2 and ImmersiveSnowViewpoint.",
      "Keep base Immersive Snow (3810071828) enabled; disable only Immersive Snow - Viewpoint (3816586790) for the controlled comparison.",
      "Check that Immersive Snow is version 0.5.2 Patch 5 or newer and inspect ZombieBuddy approval/loading messages.",
      "If an actual crash occurred, require the exception and stack trace before calling this add-on the crash cause."
    ],
    recommendation:"Attribute the Viewpoint-only compatibility limitation to Immersive Snow - Viewpoint, not to base Immersive Snow. Do not label the documented stand-down behavior as a crash."
  }
  ,
  {
    id:"viewpoint-tile-fix-addon-reference",
    category:"Viewpoint / Mod reference",
    severity:"info",
    confidence:"high",
    verified:false,
    source:"Steam Workshop item 3814178814; listing and version notes checked 7 Nov 2026.",
    pattern:"(?:ViewpointTileFix|3814178814)",
    title:"Viewpoint Tile Fix is present in this log",
    description:"This identifies Viewpoint Tile Fix (Workshop 3814178814; Mod ID ViewpointTileFix), a Viewpoint model-pack add-on that adds missing roof pieces to the 3D view. The listing says it was checked with Viewpoint alpha-0.1.6. Its presence alone is not an error.",
    causes:[],
    checks:[
      "Confirm that Project Viewpoint has 3D model packs enabled and that Viewpoint Tile Fix is enabled in the model-pack list.",
      "If roof pieces are missing, check the model-pack distance setting and whether the relevant map area is covered.",
      "The published listing documents testing with alpha-0.1.6; compatibility with the 0.1.7 nightly line is not established by that note."
    ],
    recommendation:"Treat this as a detected model-pack add-on. Do not infer a crash from its presence."
  },
  {
    id:"viewpoint-tile-fix-nightly-compatibility-report",
    category:"Viewpoint / Add-on version compatibility",
    severity:"warning",
    confidence:"medium",
    verified:false,
    source:"User-reported incompatibility with Viewpoint nightly on 7 Nov 2026. The Workshop listing documents testing with alpha-0.1.6 but does not independently confirm the 0.1.7 result.",
    pattern:"(?:Project Viewpoint\\s+0\\.1\\.7|Viewpoint:\\s*0\\.1\\.7)",
    requires:["(?:ViewpointTileFix|3814178814)"],
    title:"Viewpoint Tile Fix has a reported compatibility issue with Viewpoint nightly",
    description:"The log identifies Viewpoint Tile Fix (Workshop 3814178814; Mod ID ViewpointTileFix) together with the Viewpoint 0.1.7 nightly line. A compatibility problem has been reported for this pairing. The Workshop listing only documents testing with alpha-0.1.6, so the nightly issue is recorded as a user-reported compatibility warning rather than an independently verified failure. This is not proof that the add-on caused a crash.",
    causes:[
      "Viewpoint Tile Fix may rely on model-pack behavior that changed in the 0.1.7 nightly line.",
      "The add-on may fail to load or render its roof models correctly with that nightly revision."
    ],
    checks:[
      "Confirm that the same log contains Workshop ID 3814178814 or Mod ID ViewpointTileFix and Viewpoint 0.1.7.",
      "For a controlled comparison, keep the save and other mods unchanged and test the add-on with the supported stable Viewpoint version.",
      "If the game crashed, inspect the fatal exception and stack trace separately before attributing the crash to this add-on."
    ],
    recommendation:"Show a compatibility warning when Viewpoint Tile Fix is used with Viewpoint 0.1.7 nightly. Do not label it as the confirmed crash cause without matching crash evidence."
  },
  {
    id:"mvdox-grass-viewpoint-addon-reference",
    category:"Viewpoint / Mod reference",
    severity:"info",
    confidence:"high",
    verified:false,
    source:"Steam Workshop item 3815166404: description, requirements, and author comment checked 7 Nov 2026. The author replied on 4 Nov 2026 that it does not work with the nightly build at that time.",
    pattern:"(?:Mvdox-Grass-v1|3815166404)",
    title:"Mvdox Grass is present in this log",
    description:"This identifies Mvdox Grass (Workshop 3815166404; Mod ID Mvdox-Grass-v1), an unofficial vegetation add-on for Project Viewpoint. Its presence alone is not an error. The author states that the mod does not work with the Viewpoint nightly build at the time of the 4 Nov 2026 comment.",
    causes:[],
    checks:[
      "Check the installed Project Viewpoint channel and version.",
      "Use a supported stable Viewpoint release if Mvdox Grass is required.",
      "Do not treat this detection alone as proof that the mod caused a crash."
    ],
    recommendation:"Treat this as an add-on reference unless a matching nightly version is also detected."
  },
  {
    id:"mvdox-grass-nightly-incompatibility",
    category:"Viewpoint / Add-on version compatibility",
    severity:"warning",
    confidence:"high",
    verified:false,
    source:"Steam Workshop item 3815166404 description and author comment checked 7 Nov 2026; the author explicitly stated on 4 Nov 2026 that Mvdox Grass does not work with the nightly build at that time.",
    pattern:"(?:Project Viewpoint\\s+0\\.1\\.7|Viewpoint:\\s*0\\.1\\.7)",
    requires:["(?:Mvdox-Grass-v1|3815166404)"],
    title:"Mvdox Grass is incompatible with the detected Viewpoint nightly build",
    description:"The log identifies Mvdox Grass (Workshop 3815166404; Mod ID Mvdox-Grass-v1) together with the Viewpoint 0.1.7 nightly line. The mod author stated on 4 Nov 2026 that Mvdox Grass did not work with the nightly build at that time. This is a documented version-compatibility warning, not proof that Mvdox Grass caused a crash.",
    causes:[
      "Mvdox Grass currently relies on Viewpoint behavior that is not compatible with the nightly build identified in the log.",
      "The add-on may fail to initialize or render correctly while used with that nightly version."
    ],
    checks:[
      "Confirm that the same log contains Workshop ID 3815166404 or Mod ID Mvdox-Grass-v1 and Viewpoint 0.1.7.",
      "If you need Mvdox Grass, test with a supported stable Viewpoint release rather than the nightly build.",
      "If the game actually crashed, inspect the fatal exception and stack trace separately; this compatibility warning alone does not establish crash causation."
    ],
    recommendation:"Flag Mvdox Grass as incompatible with the detected Viewpoint 0.1.7 nightly line. Do not label it as the confirmed crash cause without matching crash evidence."
  }
  ,
  {
    id:"kk-trees-viewpoint-addon-reference",
    category:"Viewpoint / Mod reference",
    severity:"info",
    confidence:"high",
    verified:false,
    source:"Steam Workshop item 3813172420: description, requirements and author discussion checked 7 Nov 2026. The author confirmed on 7 Nov 2026 that compatibility with Viewpoint Nightly is not yet implemented.",
    pattern:"(?:ProjectViewpointNearVegetation|3813172420)",
    title:"KK's Trees is present in this log",
    description:"This identifies Project Viewpoint: KK's TREE in 3D (Workshop 3813172420; Mod ID ProjectViewpointNearVegetation), an add-on that replaces nearby trees with animated 3D seasonal models. Its presence alone is not an error. The current public Workshop description requires a compatible rendering pipeline but does not explicitly document support for the 0.1.7 Nightly line.",
    causes:[],
    checks:[
      "Confirm that Project Viewpoint Nightly and KK's Trees are both enabled.",
      "For a controlled comparison, disable only KK's Trees and fully restart the game.",
      "If the log reports 'PVNV cannot patch lib/sample_sprite.glsl', preserve that exact message as direct evidence of the add-on's shader patch failure."
    ],
    recommendation:"Treat this as a detected Viewpoint add-on. Evaluate its compatibility with the installed Viewpoint version; do not infer a crash from its presence alone."
  },
  {
    id:"kk-trees-viewpoint-nightly-incompatibility",
    category:"Viewpoint / Add-on version compatibility",
    severity:"warning",
    confidence:"high",
    verified:false,
    source:"Steam Workshop item 3813172420 description and author discussion checked 7 Nov 2026. The author stated on 7 Nov 2026 that compatibility would be implemented once Viewpoint formally publishes the update; a user also reported the PVNV lib/sample_sprite.glsl patch failure on Nightly.",
    pattern:"(?:Project Viewpoint\\s+0\\.1\\.7|Viewpoint:\\s*0\\.1\\.7)",
    requires:["(?:ProjectViewpointNearVegetation|3813172420)"],
    title:"KK's Trees is incompatible with the detected Viewpoint Nightly build",
    description:"The log identifies KK's Trees (Workshop 3813172420; Mod ID ProjectViewpointNearVegetation) together with the Viewpoint 0.1.7 Nightly line. The Workshop description does not explicitly confirm compatibility with the 0.1.7 Nightly rendering pipeline. A user report also documents 'PVNV cannot patch lib/sample_sprite.glsl' on Nightly. This is a version-compatibility warning, not proof that KK's Trees caused every crash in the log.",
    causes:[
      "KK's Trees has not yet been updated for the changing Viewpoint Nightly rendering pipeline.",
      "Its PVNV shader patch may fail when the expected sampling operation in lib/sample_sprite.glsl is absent or ambiguous."
    ],
    checks:[
      "Confirm that the same log contains Workshop ID 3813172420 or Mod ID ProjectViewpointNearVegetation and Viewpoint 0.1.7 Nightly.",
      "Search the log for the exact message 'PVNV cannot patch lib/sample_sprite.glsl: expected sampling operation not found or ambiguous'.",
      "For a controlled comparison, disable only KK's Trees, fully exit the game, and restart with the same save and remaining mods.",
      "If the game crashed, inspect the fatal exception and stack trace separately before attributing the crash to this add-on."
    ],
    recommendation:"Flag KK's Trees as incompatible with the detected Viewpoint 0.1.7 Nightly line. Do not label it as the confirmed crash cause unless the log contains matching fatal evidence."
  }

  ,
  {
    id:"kk-trees-pvnv-shader-patch-failure",
    category:"Viewpoint / Shader patch failure",
    severity:"error",
    confidence:"high",
    verified:false,
    source:"Direct console evidence: the PVNV patch failure is followed by Viewpoint renderer startup failure.",
    pattern:"PVNV cannot patch lib/sample_sprite\\.glsl: expected sampling operation not found or ambiguous",
    requires:["(?:ProjectViewpointNearVegetation|3813172420)"],
    title:"KK's Trees (PVNV) shader patch failed during Viewpoint renderer startup",
    description:"The log contains the exact PVNV shader-patching failure for lib/sample_sprite.glsl. In this report, the same failure is identified as the last error preventing multiple Viewpoint shader programs from linking, and Viewpoint disables its renderer during preparation. This directly identifies the failed patch operation; it does not prove that KK's Trees is responsible for every other renderer message.",
    causes:[
      "KK's Trees is attempting to patch a sampling operation that is absent or ambiguous in the installed Viewpoint shader source.",
      "The add-on's shader patch has not been adapted to the installed Viewpoint rendering revision."
    ],
    checks:[
      "Confirm that ProjectViewpointNearVegetation or Workshop 3813172420 is present in the startup set.",
      "Keep the exact PVNV error and the renderer-startup exception together when reporting the issue.",
      "For a controlled comparison, disable only KK's Trees, fully restart the game, and check whether the PVNV patch error disappears.",
      "Do not attribute unrelated shader failures to KK's Trees without separate evidence."
    ],
    recommendation:"Flag this as a confirmed PVNV shader-patch failure and a renderer-startup blocker in this log. Test KK's Trees separately to verify causation."
  }


  ,
  {
    id:"viewpoint-light-fix-headlightgain-shader-api-failure",
    category:"Viewpoint / Runtime and shader API compatibility",
    severity:"error",
    confidence:"high",
    verified:false,
    builds:["42.21.0"],
    source:"Observed in a user-supplied Project Zomboid Build 42.21.0 console.txt on 8 Nov 2026. The log names Light Fix - Project Viewpoint (Workshop 3811344119; Mod ID ViewpointLight), reports its Java initializer disabled after ExceptionInInitializerError, then repeatedly fails GLSL compilation because headlightGain is undeclared in lib/spots.glsl and Viewpoint cannot link its renderer programs. This is a log-specific observed failure, not a universal compatibility claim.",
    pattern:"lib/spots\\.glsl:\\d+(?:\\(\\d+\\))?:\\s*error:\\s*['\"]headlightGain['\"]\\s+undeclared",
    requires:[
      "(?:3811344119|ViewpointLight|ViewpointHeadlightPlacement)",
      "Disabled after API error: java\\.lang\\.ExceptionInInitializerError",
      "the renderer could not start|could not start.*renderer"
    ],
    title:"Light Fix - Project Viewpoint triggered a headlight shader/API initialization failure",
    description:"This Build 42.21.0 log identifies Light Fix - Project Viewpoint (Workshop 3811344119; Mod ID ViewpointLight). Its Java component reports that it was disabled after ExceptionInInitializerError. The shader compiler then reports that headlightGain is undeclared in lib/spots.glsl, followed by cascading GLSL type/return errors and failures linking multiple Viewpoint renderer programs. Together, these messages strongly implicate the Light Fix / Viewpoint shader integration in this session's renderer failure. They do not prove that every Light Fix version, GPU, driver, or Viewpoint build is incompatible, nor do they exclude another shader-mod interaction.",
    causes:[
      "Light Fix's shader library may expect a headlightGain declaration or API that is absent from the active Viewpoint shader environment.",
      "The Java initializer failure may prevent the add-on from registering shader state required by lib/spots.glsl.",
      "Another shader-mod interaction or a mismatched add-on revision could contribute; this log alone cannot isolate every contributing component."
    ],
    checks:[
      "For a controlled test, disable only Light Fix (Workshop 3811344119 / Mod ID ViewpointLight), keep every other mod unchanged, fully exit the game, and relaunch.",
      "Compare whether the ExceptionInInitializerError, headlightGain undeclared error, and renderer link failures all disappear.",
      "If the renderer starts without Light Fix, report the exact Build 42.21.0, Viewpoint revision, GPU/driver, and first headlightGain compiler error to the add-on author.",
      "If the same shader failure remains, inspect which remaining mod supplies or patches lib/spots.glsl before assigning cause."
    ],
    recommendation:"Treat Light Fix as the leading suspect for this specific Build 42.21.0 renderer failure. Confirm with a one-mod-only disable test before marking the add-on universally incompatible."
  }


  ,
  {
    id:"barricade-fix-viewpoint-workshop-review",
    category:"Viewpoint / Workshop status review",
    severity:"warning",
    confidence:"high",
    verified:false,
    source:"Checked 8 Nov 2026: Steam Workshop item 3815033191 displays the removed-from-community notice and the generic 'item is incompatible with Project Zomboid' notice. Its description identifies it as a Java patch for Project Viewpoint requiring ZombieBuddy and Project Viewpoint. In the user's Build 42.21.0 console(10).txt, version 1.0.11 reports ready, its Java main method is invoked successfully, and its patches transform Viewpoint WorldMesher and PackGather. The Workshop status warrants review, but the supplied log does not demonstrate a runtime incompatibility.",
    pattern:"(?:steamapps/workshop/content/108600/3815033191|Workshop ID:?\\s*3815033191|ViewpointBarricades\\.jar)",
    requires:["vpbarricades|ViewpointBarricades|ViewpointBarricade"],
    title:"Barricade Fix - Project Viewpoint is flagged for review (runtime conflict unconfirmed)",
    description:"This log contains Barricade Fix - Project Viewpoint (Workshop 3815033191; Mod ID ViewpointBarricade). Steam's current Workshop page shows the item as removed and displays an incompatibility notice. However, the supplied Build 42.21.0 log shows Barricade Fix 1.0.11 reporting ready, its Java entry point invoked successfully, and its Viewpoint patch classes transforming WorldMesher and PackGather. Therefore this is a Workshop-status / compatibility-review warning, not proof that the mod failed at runtime or caused a crash.",
    causes:[
      "The Workshop item is currently removed and Steam displays its generic incompatibility notice.",
      "The mod patches internal Project Viewpoint Java classes, so compatibility can depend on the exact Viewpoint and game revisions.",
      "The current log shows successful Java startup and bytecode transformations; a gameplay-level visual or behavioral issue may still exist but is not demonstrated by these lines."
    ],
    checks:[
      "Check whether barricade placement and fence-sheet/tarp rendering are visibly incorrect in game.",
      "Record the exact Project Viewpoint revision and Barricade Fix version; the supplied log reports 1.0.11.",
      "For a controlled test, disable only Barricade Fix (Workshop 3815033191), restart the game, and compare the same barricade/fence-sheet cases.",
      "Do not classify it as a confirmed runtime incompatibility unless a reproducible failure or a specific exception/patch error is captured."
    ],
    recommendation:"Keep this add-on in a review-needed category because of its current Steam Workshop status. Do not report it as a confirmed runtime failure from this console alone; the logged Java initialization and patch transformations succeeded."
  }
  ,
  {
    id:"viewpoint-better-terrain-addon-reference",
    category:"Viewpoint / Mod reference",
    severity:"info",
    confidence:"high",
    verified:false,
    source:"Steam Workshop item 3815223174; listing and comments checked 8 Nov 2026. Steam currently displays the removed-from-community and incompatible notices. The published description targets Build 42.21; the latest visible change notes identify version 0.3.21 (Vehicle Terrain Contact Fix). Recent comments report green interior-light flicker, vehicle movement on slopes, and vehicle-lighting problems; these are community reports, not proof of a universal incompatibility.",
    pattern:"(?:\\bViewpointBetterTerrain\\b|3815223174)",
    title:"Viewpoint Better Terrain is present in this log",
    description:"This identifies Viewpoint Better Terrain (Workshop 3815223174; Mod ID ViewpointBetterTerrain), which adds physical hills, valleys, slopes and road embankments to the standard map. Its published description targets Build 42.21 and the latest visible change notes identify version 0.3.21. Steam currently displays the removed/incompatible notices. Recent community comments report green interior-light flicker and vehicle movement or lighting issues on slopes; these are reports to investigate, not proof that every installation fails.",
    causes:[],
    checks:[
      "Confirm the installed Better Terrain version; the latest visible Workshop change note is version 0.3.21 (Vehicle Terrain Contact Fix).",
      "Restart the game after enabling, updating or disabling the mod, as its listing instructs.",
      "Back up the save before upgrading from the earlier visual-only version to the physical-terrain release.",
      "The published description says the physical release has not been validated in multiplayer and does not support custom map terrain with its included standard-map data.",
      "If a world-loading, collision, vehicle, lighting or rendering issue occurs, preserve the first specific exception and compare with only Better Terrain disabled."
    ],
    recommendation:"Treat Viewpoint Better Terrain as a recognized terrain add-on. Do not classify it as incompatible from its presence alone; use the exact version and runtime error to determine whether its terrain integration is involved."
  }


]);