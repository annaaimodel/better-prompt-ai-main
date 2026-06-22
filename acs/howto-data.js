/* =====================================================================
   GasPass — HOW-TO knowledge base (installation · servicing · repair)
   ---------------------------------------------------------------------
   Powers the "How-Tos" ask-a-question assistant (grounding context sent
   to api/ask.js in mode "howto") and the browsable guide list.

   Audience: GAS SAFE–REGISTERED engineers. This is professional field
   reference, NOT a licence to work on gas. Every procedure is generic
   best-practice built on current UK standards — the appliance's own
   MANUFACTURER INSTRUCTIONS (MI) always take precedence and are a legal
   requirement under GSIUR 1998. Verify figures against the CURRENT
   edition of each standard and the MI before relying on them.

   Standard editions current as of June 2026 (verified via web research):
     GSIUR 1998 (ACOP L56, 5th ed) · BS 6798:2014 · BS 6891:2015+A1:2019
     BS 5440-1:2023 · BS 5440-2:2023 · BS 7593:2019+A1:2024 · BS 7967:2015
     BS 5871-1/-2/-3/-4 · BS 6172:2010+A1:2017 · BS 669-1:2022
     BS EN 50291-1:2018 / BS EN 50292:2023 · BS 7671 (A3:2024; A4 Apr 2026)
     IGEM/UP/1B Ed 4 (mandatory 1 Oct 2026) · IGEM/G/11 Ed 2 (amdt Jul 2025)
     IGEM/G/13 · IGEM/G/1 Ed 3 (2025) · Boiler Plus (2018, England)
     Approved Docs (England): L (2021+2023; Future Homes Standard in force
     24 Mar 2027), J (2010 +2022 amdt), G/G3 (2015 +2016/2024). Devolved
     nations differ (Scotland New Build Heat Standard in force Apr 2024).
   ===================================================================== */

window.ACSHOWTO = (function () {
  const appliances = [
    { id: "general",     name: "Core procedures", full: "Tests & procedures used on every gas job",      icon: "🧪", color: "#9a7bd6" },
    { id: "boiler",      name: "Gas boilers",     full: "Combi, system & regular condensing boilers",    icon: "🔥", color: "#4f9dde" },
    { id: "waterheater", name: "Water heaters",   full: "Instantaneous & storage gas water heaters",     icon: "🚿", color: "#46b7c6" },
    { id: "fire",        name: "Gas fires",       full: "Radiant, DFE/ILFE, room-sealed & flueless",     icon: "🔆", color: "#cf5f7a" },
    { id: "cooker",      name: "Gas cookers",     full: "Freestanding, range, hobs & ovens",             icon: "🍳", color: "#e08a4f" },
    { id: "warmair",     name: "Warm air heaters",full: "Gas-fired ducted warm air units",               icon: "🌀", color: "#7aa86b" },
    { id: "meter",       name: "Metering & supply",full: "Meter, ECV, regulator, bonding & emergency",   icon: "⛽", color: "#6bbf6b" },
  ];
  const tasks = [
    { id: "install",   name: "Installation",          icon: "🔧" },
    { id: "service",   name: "Servicing",             icon: "🧰" },
    { id: "repair",    name: "Repair / fault-finding", icon: "🩺" },
    { id: "procedure", name: "Test / procedure",      icon: "📋" },
  ];

  // ---- Current UK standards quick-reference (verified 2026) ----------
  const standards = [
    { ref: "GSIUR 1998", scope: "Gas Safety (Installation and Use) Regulations — the principal law. Gas Safe registration & competence are mandatory. ACOP/guidance L56 (5th ed)." },
    { ref: "BS 6798:2014", scope: "Selection, installation, inspection, commissioning, servicing & maintenance of gas boilers ≤70 kW net input." },
    { ref: "BS 6891:2015+A1:2019", scope: "Low-pressure installation pipework up to 35 mm. Max 1 mbar drop meter→appliance (NG)." },
    { ref: "BS 5440-1:2023", scope: "Chimneys/flues for gas appliances ≤70 kW net — design, install, commission, maintain. (Revised Dec 2023.)" },
    { ref: "BS 5440-2:2023", scope: "Ventilation / combustion-air provision for gas appliances ≤70 kW net. (Revised Dec 2023.)" },
    { ref: "BS 7593:2019+A1:2024", scope: "Preparation, commissioning & maintenance of CH water — cleaning, flushing, inhibitor, in-line filter, periodic inhibitor testing. (Amendment A1 published Nov 2024 — the plain 2019 version is superseded.)" },
    { ref: "BS 7967:2015", scope: "Use of electronic portable combustion gas analysers (FGA) — CO, CO/CO₂ ratio, combustion performance in dwellings. Generic action levels (TB143): CO ≤350 ppm AND CO/CO₂ ratio <0.004; 0.004–0.008 investigate; >0.008 do not leave in service. Manufacturer limits prevail." },
    { ref: "IGEM/UP/1B Edition 4", scope: "Domestic tightness testing & direct purging (installations up to IV 0.035 m³; above that IGE/UP/1). Mandatory from 1 Oct 2026 (Ed 3 withdrawn 30 Sep 2026; both valid in the transition). Permissible pressure drop is set by Installation Volume (IV in m³), NOT meter size. New: with appliances connected, a pipework-only retest is a mandatory follow-on step — any perceptible movement on it is a fail." },
    { ref: "IGEM/G/11 Edition 2 (GIUSP, amdts July 2022/June 2024/July 2025)", scope: "Gas Industry Unsafe Situations Procedure — TWO unsafe categories only: Immediately Dangerous (ID) and At Risk (AR). Objective: make safe & advise not to use; turn off (with permission) + 'DANGER — DO NOT USE' label, except situations not made safer by turning off (e.g. building over a PE service pipe, mis-sited LPG vessel) which are referred on. Leave a Warning Notice (Appendix 6); report qualifying ID situations under RIDDOR. NOTE: 'Not to Current Standards' (NCS) is NOT a GIUSP unsafe category — recorded/advised only, never on a warning notice." },
    { ref: "BS EN 50291-1:2018 / BS EN 50292:2023", scope: "CO alarms (50291-1:2018 performance) and their siting/selection (50292 — current is the 2023 edition, NOT 2019). England: Approved Doc J + Smoke & CO Alarm (Amendment) Regs 2022 (in force 1 Oct 2022) require a CO alarm on installing a new/replacement fixed combustion appliance burning solid fuel, GAS (excluding gas cookers) or oil. Wales/Scotland rules are broader. Site ~1–3 m from the appliance." },
    { ref: "Gas Safe TB143 / TB157", scope: "TB143 = CO/CO₂ combustion checks at commissioning/service. TB157 = combustion checks on natural gas containing up to 20% hydrogen (grid blending)." },
    { ref: "BS 5871-1/-2/-3/-4", scope: "Installation of gas fires/heaters: -1 radiant/convector, stoves & fire/back boilers; -2 inset live fuel effect (ILFE) ≤15 kW; -3 decorative fuel effect (DFE) ≤20 kW; -4 flueless fires/heaters ≤6 kW (all 2005, -4 is 2007)." },
    { ref: "BS 5546", scope: "Installation of gas hot water supplies for domestic purposes (2nd family gases) — instantaneous & storage gas water heaters." },
    { ref: "BS 5864", scope: "Installation & maintenance of gas-fired ducted warm air heaters of rated input not exceeding 70 kW net." },
    { ref: "BS 6172:2010+A1:2017", scope: "Installation, servicing & maintenance of domestic gas cooking appliances (2nd & 3rd family gases) — includes the stability-device requirement." },
    { ref: "BS 669-1:2022", scope: "Strip-wound metallic flexible hoses & bayonet sockets for domestic gas cooking appliances. The 2022 revision now also covers LPG (3rd family). BS 6172 accepts hoses to BS 669-1 OR BS EN 14800; BS 669-2 covers corrugated/catering hoses." },
    { ref: "Boiler Plus (2018, England)", scope: "Min 92% ErP; time & temperature control; combi must add one of FGHR / weather comp / load comp / smart controls." },
    { ref: "Approved Doc L (2021 + 2023 amdts) — current", scope: "Conservation of fuel & power (England). 55 °C max design flow temp for wet systems in new dwellings; min efficiencies. This is the operative edition for live work until the Future Homes Standard takes effect." },
    { ref: "Future Homes Standard / Part L & F 2026 — UPCOMING", scope: "Published 24 Mar 2026, in force 24 Mar 2027 (higher-risk buildings 24 Sep 2027). New homes built to it cannot comply with a gas, oil, LPG or hydrogen-ready boiler — heat pump + solar PV become the default. EXISTING homes are unaffected (boiler replacement still allowed). The earlier '2035 ban' on gas boilers in existing homes was dropped — there is no legal ban or end-of-sale date for existing dwellings." },
    { ref: "Approved Doc J (2010 +2010/2013/2022 amdts)", scope: "Combustion appliances & fuel storage — air supply, flues, hearths, and CO-alarm requirements (the 2022 amendment requires a CO alarm on new/replacement gas — excl. cookers — oil and solid-fuel appliance installs)." },
    { ref: "Approved Doc G / G3 (2015 + 2016 & 2024 amdts)", scope: "Hot water safety; unvented hot water storage needs the separate G3 / HWSS competence (re-assessed every 5 years)." },
    { ref: "IGEM/G/13 (Sept 2022 + amdts Aug 2023)", scope: "Domestic supply capacity & operating pressure at the meter outlet — acceptable meter-outlet working pressure is not less than 18.5 mbar and not more than 23 mbar after 1 min stabilisation; outside that, follow the gas emergency 'Reporting of Low Pressure' process." },
    { ref: "IGEM/G/1 Edition 3 (Nov 2025)", scope: "Defines the boundaries between the gas network, the primary meter installation and the installation pipework (ISU 132). Relevant to MET1 / where responsibility sits." },
    { ref: "BS 7671 (18th Edition: A2:2022, A3:2024; A4 due Apr 2026)", scope: "IET Wiring Regulations — basis for bonding/electrical safety checks. Main equipotential bonding 10 mm² min, within 600 mm of the meter outlet, before any branch. Amendment 4 (the 'brown/orange book') publishes April 2026." },
    { ref: "Liquid Gas UK Codes of Practice (formerly UKLPG)", scope: "LPG installation/use — e.g. CoP 1 'Design, installation & testing of LPG piping' (current July 2025), CoP 33 'Use of LPG cylinders'. LPG: propane ~37 mbar, butane ~28–30 mbar; LPG appliances must not be sited below ground (heavier than air)." },
    { ref: "Gas Safe Building Regs notification", scope: "England & Wales: notify a heat-producing appliance install within 30 days via the Competent Person Scheme; Gas Safe issues the Building Regs Compliance Certificate." },
  ];

  // ---- Guides --------------------------------------------------------
  // { id, appliance, task, title, summary, steps:[], safety:[], standards:[], faults?:[{ symptom, checks:[] }] }
  const guides = [

    // ===================== BOILERS — INSTALL =========================
    {
      id: "boiler-install",
      appliance: "boiler", task: "install",
      title: "Install & commission a domestic gas boiler",
      summary: "End-to-end install workflow for a condensing combi / system / regular boiler, finishing with a Benchmark commissioning.",
      steps: [
        "Survey & size: confirm boiler type suits the property (combi vs system vs regular), heat-loss / DHW demand, gas meter capacity and existing pipe sizing. Check incoming gas working pressure and that the meter (e.g. U6/G4) can supply total load.",
        "Position: site per MI — required clearances for service access, flue routing and condensate fall. Confirm wall is suitable and the location isn't a prohibited space.",
        "Gas supply: size and run pipework to BS 6891 so the drop from meter to appliance is ≤1 mbar at full rate; never undersize. Sleeve and protect penetrations; keep clear of cables.",
        "Flue: route and terminate to BS 5440-1:2023 and the MI — observe terminal clearances from openings, corners, ground and boundaries; maintain the correct fall back to the boiler (condensing flues) and support intervals.",
        "Condensate: connect to an internal soil/waste route where possible; if external, upsize (often ≥32 mm), keep short, insulate and protect against freezing. Provide an air break/trap per MI.",
        "Flush & cleanse the system to BS 7593:2019+A1:2024 (clean, flush, then add inhibitor); fit an in-line magnetic filter on the return. Record inhibitor concentration.",
        "Sealed system: fit/verify expansion vessel (check charge to static head, typically ~1 bar), PRV (usually 3 bar) discharging to a safe, visible external point, and a filling loop with double-check valve. Cold-fill to ~1–1.5 bar.",
        "Electrical: connect per MI, verify polarity, earth continuity and correct fusing; carry out the basic electrical safety checks.",
        "Controls (Boiler Plus, England): provide time & temperature control, and for a combi add one of flue gas heat recovery, weather compensation, load compensation, or smart controls with automation/optimisation. Min efficiency 92% ErP. (New dwellings: design to ≤55 °C flow per AD L 2021.)",
        "Tightness test the new gas pipework (no permitted drop on new work) and purge to IGEM/UP/1B.",
        "Commission: fill/vent, set system & DHW, check gas rate against the data badge and operating/standing pressures, then carry out combustion analysis (FGA) to BS 7967:2015 — confirm CO/CO₂ ratio within limits and per MI.",
        "Complete the Benchmark commissioning checklist in the installation & service record, demonstrate controls to the customer, leave the MI and benchmark book.",
        "Notify Building Control within 30 days via the Gas Safe Competent Person Scheme; the customer receives the Building Regs Compliance Certificate.",
      ],
      safety: [
        "Manufacturer instructions are legally required and take priority over any generic procedure.",
        "Prove the gas supply is sound (tightness test) before firing — no pressure drop is permitted on new pipework.",
        "PRV and condensate discharges must terminate safely so they can't scald, ice over a walkway, or discharge into an unsafe place.",
      ],
      standards: ["BS 6798:2014", "BS 6891:2015+A1:2019", "BS 5440-1:2023", "BS 7593:2019+A1:2024", "BS 7967:2015", "Boiler Plus", "Approved Doc L/J", "GSIUR 1998"],
    },

    // ===================== BOILERS — SERVICE =========================
    {
      id: "boiler-service",
      appliance: "boiler", task: "service",
      title: "Service a condensing gas boiler",
      summary: "Annual service / inspection routine following the MI, with a pre- and post-service combustion check.",
      steps: [
        "Talk to the customer: any faults, noises, lockouts? Check the benchmark/service history and the MI service schedule.",
        "Visual & environment: confirm correct ventilation (BS 5440-2:2023), flue condition & support (BS 5440-1:2023), condensate run, and that clearances/terminal positions are still satisfactory.",
        "Pre-service combustion check: run the boiler to temperature and record a flue gas analysis (CO, CO₂, CO/CO₂ ratio) to BS 7967:2015 as a baseline.",
        "Safe isolation: turn off gas at the appliance isolation valve, isolate electrically, and allow to cool before removing the case.",
        "Inspect & clean per MI: burner and heat exchanger (check for debris/corrosion/sooting), ignition and flame-sensing electrodes (gap & condition), condensate trap (clean and re-prime), and all combustion seals/gaskets — renew if disturbed or damaged.",
        "Check the fan, air/gas path and any air-pressure switch/venturi for blockage or wear.",
        "Check the sealed system: expansion vessel charge (with system depressurised), PRV operation, system pressure, and clean/check the magnetic filter; confirm inhibitor level (BS 7593:2019+A1:2024) and top up if low.",
        "Reassemble, re-prove gas tightness, then run and confirm gas rate against the data badge and correct operating/standing pressures.",
        "Post-service combustion analysis: confirm CO/CO₂ ratio and CO within the MI limits; investigate ventilation, flue or gas rate if out of spec.",
        "Carry out a flue/spillage check where applicable, complete the benchmark service record, and report any At Risk / Immediately Dangerous findings under GIUSP.",
      ],
      safety: [
        "Always renew combustion-circuit seals that have been disturbed — a poor seal can leak products of combustion / CO.",
        "If post-service combustion is out of limits, do not leave the appliance in use until resolved.",
        "Check the expansion vessel charge only with the system depressurised, or the reading is meaningless.",
      ],
      standards: ["BS 6798:2014", "BS 7967:2015", "BS 7593:2019+A1:2024", "BS 5440-1/-2:2023", "GSIUR 1998"],
    },

    // ===================== BOILERS — REPAIR ==========================
    {
      id: "boiler-repair",
      appliance: "boiler", task: "repair",
      title: "Fault-find a gas boiler",
      summary: "A systematic approach to diagnosing common boiler faults safely — work from the symptom and the fault/error code, always cross-referencing the MI fault chart.",
      steps: [
        "Gather evidence: note any displayed fault/error code, ask what happens and when, and check system pressure, power and gas supply are all present before stripping anything.",
        "Use the MI fault-code chart — codes differ by manufacturer; the MI (or the maker's technical line/app) maps each code to a procedure. Don't guess a code's meaning across brands.",
        "Work logically along the chain (power → controls demand → water pressure/flow → ignition sequence → flame → modulation) and confirm each stage before moving on.",
        "Confirm or eliminate the gas supply and correct operating pressure first — many 'ignition' faults are actually a gas/pressure issue.",
        "Prove your repair: after any work on the gas circuit, re-test for tightness and run a combustion analysis (BS 7967:2015) before handing back.",
      ],
      faults: [
        { symptom: "No heating or hot water / boiler won't fire", checks: ["Check power, time/temperature controls calling, and any displayed code", "Confirm gas supply on and operating pressure correct", "Check system pressure isn't too low (lockout) and the condensate isn't frozen/blocked"] },
        { symptom: "Ignition lockout / flame failure", checks: ["Inspect ignition & flame-sensing electrodes (gap, cracks, carbon)", "Confirm gas valve operation and inlet/burner pressures per MI", "Check polarity (reversed live/neutral can cause flame-sense failure) and earth", "Check flue is clear and condensate trap primed"] },
        { symptom: "Losing pressure / needs frequent topping up", checks: ["Look for visible leaks on system and around PRV discharge", "Check expansion vessel charge (depressurised) — a flat vessel causes pressure swings & PRV weeping", "Check the PRV isn't passing"] },
        { symptom: "Combi: hot water weak or goes cold", checks: ["Suspect a sticking/worn diverter valve or DHW flow sensor", "Check plate heat exchanger for scale/blockage (low DHW flow/temperature)", "Confirm incoming mains flow rate is adequate"] },
        { symptom: "Banging / kettling / noisy", checks: ["Likely scale or sludge in the heat exchanger — check inhibitor & filter, clean/flush per BS 7593:2019+A1:2024", "Check pump operation and for trapped air / poor circulation"] },
        { symptom: "Frozen condensate (common in cold snaps)", checks: ["Thaw the external condensate pipe and reset; advise upsizing/insulating or re-routing internally to prevent recurrence"] },
      ],
      safety: [
        "If you find an unsafe situation, classify and act under GIUSP (IGEM/G/11) — Immediately Dangerous or At Risk — and issue the appropriate warning notice (NCS is recorded/advised, not put on an unsafe-situations notice).",
        "Only fit manufacturer-specified parts; a wrong gas valve or injector is dangerous.",
        "Always re-prove gas tightness and combustion after a gas-side repair.",
      ],
      standards: ["BS 6798:2014", "BS 7967:2015", "GSIUR 1998 (GIUSP)"],
    },

    // ===================== COOKERS — INSTALL =========================
    {
      id: "cooker-install",
      appliance: "cooker", task: "install",
      title: "Install a domestic gas cooker / hob",
      summary: "Connecting and commissioning a freestanding cooker, range or built-in hob/oven safely to BS 6172.",
      steps: [
        "Confirm appliance type and connection method: freestanding cooker (usually bayonet + flexible hose) or built-in hob/oven (often rigid connection). Check the gas type (NG/LPG) matches the appliance.",
        "Provide a correctly positioned cooker connection point / isolation so the appliance can be isolated and moved for cleaning.",
        "Flexible hose (freestanding): use a hose to BS 669-1 (or BS EN 14800) of the correct rating and length; fit the bayonet so the hose hangs in a downward loop, free from the hotplate heat, sharp edges, kinking and the back of the appliance.",
        "Stability device: fit the stability chain/bracket per BS 6172 and the MI so the cooker cannot tip when weight is applied to an open oven door.",
        "Clearances: maintain the MI clearances to combustible surfaces, especially at the sides above hotplate level and to any overhead units/extractor.",
        "Ventilation: confirm the room meets BS 5440-2:2023 for a flueless appliance — adequate room volume and an openable window/door to outside; check any extract fan/hood won't cause spillage from other open-flued appliances.",
        "Level the appliance and check the oven door and shelves sit correctly.",
        "Tightness test the installation and check the connection for soundness (leak detection fluid / gauge).",
        "Commission: light each hotplate burner and confirm clean cross-lighting, check oven and grill ignition, and confirm the flame supervision device (FSD) holds the gas on and shuts off if the flame is extinguished. (New hobs in flats/multi-storey buildings must have an FSD on all burners — Gas Safe TB 015.)",
        "Check the flame picture (crisp blue, no lifting/sooting), demonstrate to the customer and leave the MI.",
      ],
      safety: [
        "A freestanding cooker with no stability bracket/chain is a recognised unsafe situation — a loaded open door can tip it.",
        "The flexible hose must clear the hotplate heat and not be kinked, strained or in contact with sharp edges.",
        "Confirm FSDs operate on every burner — a failed FSD can let unburnt gas escape.",
      ],
      standards: ["BS 6172", "BS 669-1", "BS 5440-2:2023", "GSIUR 1998"],
    },

    // ===================== COOKERS — SERVICE =========================
    {
      id: "cooker-service",
      appliance: "cooker", task: "service",
      title: "Service / safety-check a gas cooker",
      summary: "Inspection and service routine for hotplate, oven and grill, focused on combustion and safety devices.",
      steps: [
        "Tightness test and check the connection (hose/bayonet/rigid) for soundness and correct routing/condition.",
        "Inspect and clean burners, burner ports and injectors; clear any blockage that distorts the flame.",
        "Check the flame picture on each burner — should be stable and blue; yellow/sooty or lifting flames indicate aeration, injector or pressure problems.",
        "Test the flame supervision device (FSD) on each burner/oven/grill: the gas should cut off shortly after the flame is removed.",
        "Check ignition (spark/auto-ignition) and the gas taps for smooth, correct operation and that they shut off fully.",
        "Check the oven thermostat brings the oven to temperature and cycles correctly.",
        "Check the stability device is fitted and effective, and that ventilation/room conditions still satisfy BS 5440-2:2023.",
        "Reassemble, re-prove tightness, and confirm safe operation; record findings and raise any GIUSP unsafe situations.",
      ],
      safety: [
        "A cooker is flueless — confirm room ventilation and that any extract fan doesn't pull another open-flued appliance into spillage.",
        "Don't return a cooker to use with a failed FSD or a persistent yellow/sooty flame.",
      ],
      standards: ["BS 6172", "BS 5440-2:2023", "GSIUR 1998"],
    },

    // ===================== COOKERS — REPAIR ==========================
    {
      id: "cooker-repair",
      appliance: "cooker", task: "repair",
      title: "Fault-find a gas cooker",
      summary: "Diagnosing the common cooker faults — ignition, flame supervision, flame quality and oven temperature.",
      steps: [
        "Confirm the symptom and which part (hotplate burner, oven, grill) is affected, and check gas is present and the appliance is isolated correctly before working.",
        "Reference the MI for the specific model — injector sizes, FSD type and dismantling sequence vary.",
        "Re-test tightness and check the flame picture after any repair before handing back.",
      ],
      faults: [
        { symptom: "Burner won't light / no spark", checks: ["Check ignition leads/electrode and that the spark is present", "Check the burner ports/injector aren't blocked", "Confirm gas supply and tap operation"] },
        { symptom: "Burner lights but goes out when control released", checks: ["FSD/thermocouple not holding — check the probe is in the flame and the connection is sound", "Renew a faulty FSD/thermocouple per MI"] },
        { symptom: "Yellow, sooty or lifting flame", checks: ["Check/clean injector and burner ports", "Check aeration setting and that the burner is seated correctly", "Confirm correct operating pressure / correct injector for the gas type"] },
        { symptom: "Oven won't reach temperature", checks: ["Suspect the oven thermostat or FSD", "Check injector/burner and flame size", "Confirm the correct gas pressure"] },
        { symptom: "Smell of gas", checks: ["Isolate and tightness test", "Check the hose, bayonet and all joints with leak detection fluid", "Do not leave the appliance in use until proven sound — classify under GIUSP if needed"] },
      ],
      safety: [
        "Treat any smell of gas as an emergency — isolate, find and fix the leak, re-test, and apply GIUSP if it can't be made safe.",
        "Use only manufacturer-specified injectors/parts and the correct gas type.",
      ],
      standards: ["BS 6172", "BS 669-1", "GSIUR 1998 (GIUSP)"],
    },

    // ===================== FIRES — INSTALL ===========================
    {
      id: "fire-install",
      appliance: "fire", task: "install",
      title: "Install & commission a gas fire / space heater",
      summary: "Installing a radiant/convector, DFE/ILFE, room-sealed or flueless fire to BS 5871, with the essential flue and spillage checks.",
      steps: [
        "Match the fire to the flue/chimney: confirm the appliance is suitable for the chimney type (e.g. Class 1, Class 2, pre-cast, room-sealed) and follow the correct part of BS 5871 (-1 radiant/convector & DFE in builder's openings, -2 ILFE, -3 DFE within fireplaces) and the MI.",
        "Inspect the chimney/flue: check it's the right type, clear and sound. Carry out a flue flow (smoke) test to confirm it's clear and pulling before fitting.",
        "Catchment space: provide the required debris-collection (catchment) space below the flue connection where the MI/standard calls for it.",
        "Closure plate: fit a correctly sized and sealed closure/register/debris plate for open-flued fires set in a builder's opening, with any specified relief/ventilation openings.",
        "Hearth: confirm a suitable hearth (size, projection and non-combustibility) to protect the floor in front of and beneath the fire per the MI.",
        "Clearances: maintain MI clearances to combustible surrounds, shelves and decorations above and to the sides.",
        "Ventilation: provide any purpose-provided ventilation required by BS 5440-2:2023 / the MI; flueless fires have strict room-volume, prohibited-room and permanent-vent requirements and rely on an oxygen-depletion/atmosphere-sensing device (ODS).",
        "Connect the gas, tightness test the installation and prove the connection sound.",
        "Commission: light and check the flame picture and pilot/FSD operation, then carry out a spillage test on open-flued fires under worst-case conditions (doors/windows shut, any extract fans running) to confirm products clear the room.",
        "Demonstrate to the customer, leave the MI, and record the commissioning.",
      ],
      safety: [
        "Flue flow and spillage tests are essential on open-flued fires — a failed spillage test means products of combustion are entering the room (CO risk).",
        "Missing closure plate, missing catchment space, wrong hearth or a fire fitted to an unsuitable/blocked flue are classic unsafe situations.",
        "Flueless fires must not be fitted in prohibited rooms or below the stated room volume — check the MI and BS 5440-2:2023.",
      ],
      standards: ["BS 5871-1/-2/-3", "BS 5440-1:2023", "BS 5440-2:2023", "Approved Doc J", "GSIUR 1998"],
    },

    // ===================== FIRES — SERVICE ===========================
    {
      id: "fire-service",
      appliance: "fire", task: "service",
      title: "Service a gas fire / space heater",
      summary: "Cleaning and safety service for a gas fire, re-proving the flue and spillage before leaving.",
      steps: [
        "Discuss history/symptoms and check the MI service schedule.",
        "Inspect the flue/chimney condition, closure plate seal, catchment space and hearth; check ventilation still meets BS 5440-2:2023.",
        "Carefully remove and clean the burner, fuel bed/ceramics/coals and radiants, reinstating them in the exact MI layout (incorrect coal/ceramic placement causes sooting and CO).",
        "Clean the pilot assembly and flueways; check the pilot flame and the FSD/thermocouple (and ODS on flueless) operate correctly — gas cuts off when the pilot is out.",
        "Check ignition and the main flame picture for correct, sooting-free combustion.",
        "Reassemble, re-prove gas tightness, then re-run the flue flow and spillage tests to confirm safe clearance of products.",
        "Record the service and raise any At Risk / Immediately Dangerous findings under GIUSP.",
      ],
      safety: [
        "Fuel-bed/coal layout must follow the MI exactly — wrong placement is a leading cause of sooting and CO production.",
        "Always re-do the spillage test after servicing an open-flued fire.",
      ],
      standards: ["BS 5871-1/-2/-3", "BS 5440-1/-2:2023", "GSIUR 1998"],
    },

    // ===================== FIRES — REPAIR ============================
    {
      id: "fire-repair",
      appliance: "fire", task: "repair",
      title: "Fault-find a gas fire / space heater",
      summary: "Diagnosing the usual gas-fire faults — pilot/FSD, flame quality, sooting and spillage.",
      steps: [
        "Confirm the symptom and appliance type (open-flued, room-sealed, flueless), check gas supply and isolate safely.",
        "Reference the MI — pilot/FSD assemblies, ODS and dismantling differ by model.",
        "After any work, re-prove tightness and re-run flue flow/spillage tests before leaving an open-flued fire in service.",
      ],
      faults: [
        { symptom: "Pilot won't light", checks: ["Check for gas at the pilot and a good spark/ignition", "Clean a blocked pilot injector/assembly", "Confirm operating pressure"] },
        { symptom: "Pilot lights but won't stay lit when released", checks: ["FSD/thermocouple (or ODS) not holding — check the probe sits in the pilot flame and the connection/magnet unit is sound", "Renew a faulty thermocouple/FSD per MI"] },
        { symptom: "Sooting / black staining / poor flame", checks: ["Check the coal/ceramic/fuel-bed layout is exactly per MI", "Clean burner, ports and flueways", "Check for flue blockage/poor draught and confirm correct injector/pressure"] },
        { symptom: "Spillage / smell or staining around the fire", checks: ["Carry out flue flow and spillage tests", "Check chimney for blockage/poor draught and closure-plate seal", "If it spills, classify as Immediately Dangerous and make safe under GIUSP"] },
        { symptom: "Flueless fire keeps shutting down", checks: ["The ODS/atmosphere-sensing device is doing its job — check room ventilation/volume and the pilot/ODS assembly per MI"] },
      ],
      safety: [
        "A fire that fails a spillage test is Immediately Dangerous — make safe under GIUSP and issue a warning notice.",
        "Never defeat or bypass an ODS/FSD; renew with the manufacturer-specified part.",
      ],
      standards: ["BS 5871-1/-2/-3", "BS 5440-1:2023", "GSIUR 1998 (GIUSP)"],
    },

    // ===================== GENERAL — CORE PROCEDURES =================
    {
      id: "proc-tightness", appliance: "general", task: "procedure",
      title: "Tightness test a domestic installation",
      summary: "Prove the installation is gas-tight to IGEM/UP/1B before and after work.",
      steps: [
        "Confirm scope: domestic, low pressure, Installation Volume (IV) within IGEM/UP/1B (≤0.035 m³); above that use IGE/UP/1.",
        "Calculate the Installation Volume (IV) for the section under test — Edition 4 sets the permissible drop by IV (m³), not meter size.",
        "Connect a calibrated gauge (water U-gauge or electronic manometer) at a suitable test point.",
        "Carry out the let-by test on the ECV first to confirm it isn't passing gas (the gauge should not rise).",
        "Raise to test pressure, allow the stabilisation period, then time the test period and read the pressure drop.",
        "Compare against the permitted drop from the Edition 4 IV table/calculator. NEW pipework (no appliances): no drop permitted.",
        "New in Ed 4: with appliances connected, carry out the mandatory pipework-only retest — any perceptible movement is a fail.",
        "'No perceptible movement' = ≤0.25 mbar on a fluid gauge / ≤0.2 mbar on an electronic gauge.",
        "If it fails, trace the leak with leak-detection fluid, rectify, and re-test. Record the result.",
      ],
      safety: ["Never search for a leak with a flame — use leak-detection fluid or a gas detector.", "Don't commission an installation that fails tightness."],
      standards: ["IGEM/UP/1B Edition 4", "GSIUR 1998"],
    },
    {
      id: "proc-letby-purge", appliance: "general", task: "procedure",
      title: "Let-by test & direct purging",
      summary: "Confirm the emergency control valve seals, and purge air or gas safely.",
      steps: [
        "Let-by: with the gauge connected, reduce pressure and watch over the let-by period — a rise means the ECV is letting by (passing gas).",
        "Only proceed to the tightness test once the let-by result is satisfactory.",
        "Purging removes air after an install (or gas before work) — purge to a safe, ventilated place outside, away from ignition sources.",
        "Determine the purge volume per IGEM/UP/1B and purge until the line is fully air-free (or gas-free).",
        "Confirm with a gas detector — don't guess. Re-test for tightness after reconnection, then re-light/commission.",
      ],
      safety: ["Purge to outside air, never into an enclosed space; keep ignition sources well away.", "Use a gas detector to confirm the purge is complete."],
      standards: ["IGEM/UP/1B Edition 4", "GSIUR 1998"],
    },
    {
      id: "proc-gas-rate", appliance: "general", task: "procedure",
      title: "Calculate the gas rate (heat input)",
      summary: "Measure how much gas an appliance burns and compare it to the data badge.",
      steps: [
        "Run only the appliance under test at full rate; account for/turn off other appliances and pilots.",
        "Metric meter: time the gas used for a known volume — gas rate (m³/h) = 3600 ÷ time(s) × volume(m³).",
        "Convert to heat input: kW (gross) ≈ gas rate (m³/h) × CV (MJ/m³) ÷ 3.6. Use the CV from the bill (UK NG ≈ 39.5 MJ/m³).",
        "Imperial meter (legacy): kW ≈ ft³/h × CV(Btu/ft³) ÷ 3412 (NG CV ≈ 1040 Btu/ft³).",
        "Compare to the appliance data badge — a high rate means over-gassing, low means under-gassing; investigate pressure/injector/pipework.",
      ],
      safety: ["Use the bill's calorific value, not a textbook number.", "With smart/metric meters standard, learn the m³ method as primary."],
      standards: ["BS 7967:2015", "Appliance data badge", "IGEM/G/13"],
    },
    {
      id: "proc-pressure", appliance: "general", task: "procedure",
      title: "Check operating & standing pressure",
      summary: "Confirm the appliance is getting the correct gas pressure.",
      steps: [
        "Standing pressure: no appliances drawing gas — read at the meter outlet/test point (a little above working pressure).",
        "Working/operating pressure: appliance at full rate, read at the appliance test point — natural gas nominal 20 mbar (check the data badge).",
        "Meter-outlet working pressure (IGEM/G/13) should be 18.5–23 mbar after 1 min — outside that, follow the 'Reporting of Low Pressure' process.",
        "Max permitted drop across the installation pipework, meter to appliance, is 1 mbar (NG).",
        "Low working pressure points to undersized/partly-closed pipework, the meter/regulator, or the supply.",
      ],
      safety: ["The 1 mbar drop is across the WHOLE installation, not per appliance."],
      standards: ["IGEM/G/13", "BS 6891:2015+A1:2019", "Appliance data badge"],
    },
    {
      id: "proc-combustion", appliance: "general", task: "procedure",
      title: "Carry out combustion analysis (FGA)",
      summary: "Use a flue gas analyser to confirm safe, clean combustion.",
      steps: [
        "Confirm the analyser is within annual calibration; zero/calibrate it in fresh air, away from the appliance.",
        "Run the appliance to temperature; sample at the flue/test point per the MI with readings stable.",
        "Record CO, CO₂, the CO/CO₂ ratio, O₂ and flue temperature.",
        "Pass criteria (TB143/BS 7967, natural gas): CO ≤ 350 ppm AND CO/CO₂ ratio < 0.004. Ratio 0.004–0.008 = investigate; > 0.008 = do not leave in service. Manufacturer limits prevail.",
        "Check at high (and where required low) rate; investigate flue, ventilation and gas rate if out of spec.",
        "TB157: analysers approved to EN 50379 are unaffected by up to 20% hydrogen blend — no change to the criteria.",
      ],
      safety: ["A ratio above the limit is a combustion failure — don't leave it running.", "Record on the Benchmark log; re-check after any gas-side work."],
      standards: ["BS 7967:2015", "Gas Safe TB143 / TB157"],
    },
    {
      id: "proc-flue-spillage", appliance: "general", task: "procedure",
      title: "Flue flow & spillage tests (open-flued)",
      summary: "Prove an open flue is clear and clears products of combustion.",
      steps: [
        "Flue flow (smoke) test FIRST: warm the flue, then release smoke at the appliance position — it should be drawn up and discharge only at the correct terminal, with no leakage along the chimney.",
        "Spillage test: with the appliance at max rate and the room worst-case (doors/windows shut, extract fans on), apply smoke at the edge of the draught diverter/canopy within ~5 minutes of lighting.",
        "Apart from the odd wisp, all smoke should be drawn into the flue — continuous spillage is a fail.",
        "If it spills, run a further ~10 minutes and re-test; if it still spills, switch off, disconnect and rectify.",
        "Repeat with any extract fans running — a fan can pull an open-flued appliance into spillage.",
      ],
      safety: ["A failed spillage test is Immediately Dangerous — make safe under GIUSP.", "Flue flow before spillage, every time."],
      standards: ["BS 5440-1:2023", "BS 5871", "GSIUR 1998"],
    },
    {
      id: "proc-ventilation", appliance: "general", task: "procedure",
      title: "Size ventilation for a gas appliance",
      summary: "Work out the air supply an appliance needs (BS 5440-2).",
      steps: [
        "Identify the appliance type: room-sealed (no room vent normally needed), open-flued, or flueless.",
        "Open-flued: free air vent of 5 cm² per kW of net input ABOVE 7 kW (the first 7 kW is the adventitious allowance).",
        "Multi-appliance room: only ONE appliance gets the 7 kW allowance (TB 041) — size the rest from full input.",
        "Flueless cooker by room volume: <5 m³ = 100 cm², 5–10 m³ = 50 cm², >10 m³ = nil — plus an openable window in all cases.",
        "Flueless fires/heaters: strict room volume + permanent vent and an ODS; not in prohibited rooms (bathrooms/bedrooms below limits).",
        "Always use FREE area (effective), not the grille's outside size; confirm vents are unobstructed.",
      ],
      safety: ["These are common figures — verify against the current BS 5440-2 for the specific appliance.", "An extract fan can cause spillage from an open-flued appliance."],
      standards: ["BS 5440-2:2023", "Gas Safe TB 041"],
    },
    {
      id: "proc-giusp", appliance: "general", task: "procedure",
      title: "Classify & act on an unsafe situation (GIUSP)",
      summary: "Use IGEM/G/11 to categorise and make safe a dangerous installation.",
      steps: [
        "Two unsafe categories only: Immediately Dangerous (ID) and At Risk (AR). NCS is not a GIUSP unsafe category — recorded/advised only.",
        "ID: an immediate danger to life/property if left connected (e.g. failed tightness/spillage tests, serious flue/ventilation/combustion faults, gas escapes). Make safe — with permission turn off/disconnect, cap, label.",
        "AR: one or more faults that may become dangerous (e.g. inadequate ventilation). With permission turn off and attach a 'DANGER — DO NOT USE' label.",
        "Exception: situations not made safer by turning off (e.g. building over a PE service pipe, mis-sited LPG vessel) — refer to a responsible person/organisation; no DANGER label.",
        "Always get the responsible person's permission and explain the reasons; leave a Warning Notice (category, what's unsafe, actions, rectification, contacts).",
        "Report qualifying ID situations under RIDDOR; keep records.",
      ],
      safety: ["If permission to disconnect an ID situation is refused, follow the GIUSP escalation route — don't just leave.", "Only ID and AR go on an unsafe-situations warning notice."],
      standards: ["IGEM/G/11 Edition 2 (GIUSP)", "RIDDOR", "GSIUR 1998"],
    },
    {
      id: "proc-gas-escape", appliance: "general", task: "procedure",
      title: "Gas escape / smell of gas — response",
      summary: "Immediate actions for a reported or discovered gas escape.",
      steps: [
        "National Gas Emergency Service: 0800 111 999 (free, 24 h) — report any uncontrolled escape.",
        "Turn off at the ECV; do NOT operate electrical switches; extinguish naked flames; no smoking.",
        "Open doors and windows to ventilate.",
        "Find and fix the leak (tightness test, leak-detection fluid) only within your competence; if it can't be made safe, isolate, warn and apply GIUSP.",
        "The emergency service attends within set timescales (generally 1 h uncontrolled / 2 h controlled) under GSMR.",
      ],
      safety: ["Don't switch anything electrical on or off in a gas-filled space — a spark can ignite it.", "Never leave a known escape live."],
      standards: ["GSIUR 1998 reg 37", "GSMR 1996 (amended 2023)", "GIUSP"],
    },
    {
      id: "proc-co", appliance: "general", task: "procedure",
      title: "Suspected carbon monoxide — response",
      summary: "What to do when CO is suspected at a property.",
      steps: [
        "CO is colourless/odourless — suspect it from symptoms (flu-like, no temperature, easing away from the property), sooting/staining, yellow flames on appliances meant to burn blue, or an alarm.",
        "Get occupants out into fresh air; seek medical advice if anyone is unwell.",
        "Turn off the suspect appliance and ventilate; do not use it until checked.",
        "Investigate: combustion analysis, flue/ventilation, gas rate; treat a CO-producing appliance as Immediately Dangerous under GIUSP.",
        "CO alarms conform to BS EN 50291-1:2018 (siting BS EN 50292:2023) — required on new/replacement gas (excl. cookers), oil & solid-fuel installs in England.",
      ],
      safety: ["An alarm is a last line of defence, not a fix.", "Don't return a CO-producing appliance to use."],
      standards: ["BS EN 50291-1:2018 / 50292:2023", "Approved Doc J", "GIUSP"],
    },
    {
      id: "proc-electrical", appliance: "general", task: "procedure",
      title: "Basic electrical safety checks & bonding",
      summary: "The electrical checks a gas operative must make on appliances.",
      steps: [
        "Carry out the basic checks you're competent for: earth continuity, polarity (live/neutral not reversed), short circuit and resistance to earth.",
        "Confirm correct fusing and that exposed metalwork is earthed so a fault disconnects the supply.",
        "Main equipotential bonding: 10 mm² minimum, clamped to the consumer's hard metal pipework within 600 mm of the meter outlet, before any branch/tee/union.",
        "BS 7671 (18th Edition, A2:2022 + A3:2024; Amendment 4 April 2026) is the basis.",
        "If a fault is outside your competence/scope, isolate where dangerous and refer to a qualified electrician.",
      ],
      safety: ["Reversed polarity and missing/poorly-placed bonding are common defects.", "Prove dead before working on electrical parts."],
      standards: ["BS 7671", "Gas Safe TB 102", "GSIUR 1998"],
    },
    {
      id: "proc-isolation", appliance: "general", task: "procedure",
      title: "Safe isolation & leaving the installation safe",
      summary: "Isolate gas and electrics before work, and leave everything safe after.",
      steps: [
        "Inform the responsible person; identify the means of isolation (appliance isolation valve / ECV; electrical isolator/fused spur).",
        "Isolate gas at the appliance, and electrically isolate and prove dead before working on electrical parts.",
        "After work, re-prove gas tightness, re-establish the supply, purge as needed and re-light appliances per MI.",
        "Carry out combustion/spillage checks as applicable and confirm safe operation.",
        "Hand back: demonstrate to the customer, leave the MI/records, and raise any GIUSP findings.",
      ],
      safety: ["Never leave an appliance disconnected and uncapped, or live and unsafe.", "Re-prove tightness and combustion after gas-side work."],
      standards: ["GSIUR 1998", "IGEM/UP/1B Edition 4"],
    },

    // ===================== BOILER (extra) ============================
    {
      id: "boiler-flush", appliance: "boiler", task: "service",
      title: "Clean & flush a heating system (BS 7593)",
      summary: "Prepare and protect the system water against sludge and scale.",
      steps: [
        "On a new boiler, or where sludge is present, clean and flush the system to BS 7593:2019+A1:2024 before final dosing.",
        "Choose the method: chemical clean + mains/gravity flush, or a power flush where sludge is heavy.",
        "Add a quality inhibitor at the correct concentration; fit a permanent in-line magnetic filter (required on all systems) on the return.",
        "Record the inhibitor concentration; test annually and re-dose roughly every 5 years or after any system water loss/refill.",
        "Cold-fill the sealed system (~1–1.5 bar), check the expansion vessel charge and PRV, then vent.",
      ],
      safety: ["Skipping cleansing/inhibitor leads to kettling, cold-bottom radiators and component wear.", "Many warranties require BS 7593 compliance — record it on the Benchmark log."],
      standards: ["BS 7593:2019+A1:2024", "BS 6798:2014", "Manufacturer instructions"],
    },

    // ===================== WATER HEATERS ============================
    {
      id: "waterheater-install", appliance: "waterheater", task: "install",
      title: "Install a gas water heater",
      summary: "Instantaneous (multipoint/single-point) or storage gas water heater install & commission.",
      steps: [
        "Confirm type and suitability: instantaneous (heats on demand) vs storage; room-sealed vs open-flued; and that flow rate/output suits the demand.",
        "Position per MI with required clearances; route/terminate the flue (BS 5440-1) and provide ventilation (BS 5440-2) for the appliance type.",
        "Size the gas supply to BS 6891 (≤1 mbar drop); make water connections to current water regs; provide gas and water isolation.",
        "Stored hot water under mains pressure (unvented) is Building Regs G3 work — it needs the separate competence and its safety devices (T&P relief valve, expansion, tundish to a safe discharge).",
        "Tightness test, purge, then commission: gas rate & operating pressure, combustion analysis, and (open-flued) flue flow + spillage tests.",
        "Set the outlet temperature for scald/Legionella balance (store 60 °C, distribute generally ≥50 °C); demonstrate and leave the MI.",
      ],
      safety: ["Stored hot water under mains pressure is G3 work — not covered by a standard gas ticket alone.", "Open-flued water heaters need correct ventilation and a passing spillage test."],
      standards: ["BS 5546", "BS 5440-1/-2:2023", "Building Regs G3 (unvented)", "GSIUR 1998"],
    },
    {
      id: "waterheater-service", appliance: "waterheater", task: "service",
      title: "Service a gas water heater",
      summary: "Routine service for an instantaneous or storage gas water heater.",
      steps: [
        "Discuss history; check ventilation, flue condition and clearances; take a baseline combustion reading.",
        "Safely isolate and allow to cool.",
        "Inspect & clean per MI: burner, heat exchanger (descale where hard water and the MI allows), injector, electrodes/ignition, pilot/FSD and waterways.",
        "Check the water section: temperature control, any T&P/expansion devices (storage/unvented), and for scaling.",
        "Reassemble, re-prove tightness, confirm gas rate & pressures, take a post-service combustion reading, and re-do flue/spillage where applicable.",
        "Record; raise any GIUSP findings.",
      ],
      safety: ["Renew disturbed combustion seals.", "Don't leave combustion out of limits."],
      standards: ["BS 5546", "BS 7967:2015", "GSIUR 1998"],
    },
    {
      id: "waterheater-repair", appliance: "waterheater", task: "repair",
      title: "Fault-find a gas water heater",
      summary: "Diagnosing the common faults on instantaneous and storage gas water heaters.",
      steps: [
        "Confirm the symptom and any code; check gas and water supply; isolate safely; reference the MI.",
        "Re-prove tightness and combustion after any gas-side repair.",
      ],
      faults: [
        { symptom: "No hot water / won't light", checks: ["Check gas supply & operating pressure", "Instantaneous: check the water flow turbine/switch senses tap demand", "Check ignition/electrode and pilot/FSD"] },
        { symptom: "Lights then goes out", checks: ["FSD/thermocouple not holding — check probe position & connection", "Room-sealed: check flue/condensate and air-proving"] },
        { symptom: "Water not hot enough / scaled", checks: ["Check temperature setting and gas rate", "Descale the heat exchanger per MI (hard-water areas)"] },
        { symptom: "Sooting / poor flame", checks: ["Clean burner/injector; check aeration, ventilation and flue; confirm correct pressure"] },
        { symptom: "Leaking water", checks: ["Check heat exchanger, seals and any relief valve; isolate and renew per MI"] },
      ],
      safety: ["Re-prove tightness and combustion after gas-side work.", "Treat spillage/CO as Immediately Dangerous (GIUSP)."],
      standards: ["BS 5546", "BS 7967:2015", "GSIUR 1998 (GIUSP)"],
    },

    // ===================== WARM AIR HEATERS =========================
    {
      id: "warmair-install", appliance: "warmair", task: "install",
      title: "Install a gas warm air heater",
      summary: "Ducted gas-fired warm air unit install & commission.",
      steps: [
        "Confirm unit type (open-flued or room-sealed; natural or fan-assisted flue) and the duct layout; size to the heat loss.",
        "Position per MI; route/terminate the flue (BS 5440-1) and provide ventilation/combustion air (BS 5440-2) for the appliance type and compartment.",
        "Size the gas supply to BS 6891; provide the electrical supply and controls (fan, limit/overheat thermostats, time & temperature control).",
        "Connect supply/return ducting and filters; ensure return air is not drawn from a hazardous or appliance compartment.",
        "Tightness test, purge, then commission: gas rate & pressure, fan operation, the limit/overheat cut-out, combustion analysis, and flue flow + spillage (open-flued).",
        "Demonstrate and leave the MI/records.",
      ],
      safety: ["Overheat/limit thermostats are safety devices — confirm they operate.", "Open-flued units need correct ventilation and a passing spillage test."],
      standards: ["BS 5864", "BS 5440-1/-2:2023", "GSIUR 1998"],
    },
    {
      id: "warmair-service", appliance: "warmair", task: "service",
      title: "Service a gas warm air heater",
      summary: "Routine service for a gas-fired ducted warm air unit.",
      steps: [
        "Discuss history; check ventilation, flue and clearances; take a baseline combustion reading; isolate and cool.",
        "Clean per MI: burner, heat exchanger, injector, electrodes/ignition and pilot/FSD.",
        "Check and clean air filters and the fan; check return/supply airflow.",
        "Confirm the limit/overheat thermostat and fan controls operate correctly.",
        "Reassemble, re-prove tightness, confirm gas rate & pressures, take a post-service combustion reading, and re-do flue/spillage where applicable. Record.",
      ],
      safety: ["Confirm the overheat/limit cut-out operates.", "Inspect the heat exchanger — a crack lets products into the air stream (CO risk)."],
      standards: ["BS 5864", "BS 7967:2015", "GSIUR 1998"],
    },
    {
      id: "warmair-repair", appliance: "warmair", task: "repair",
      title: "Fault-find a gas warm air heater",
      summary: "Diagnosing the common warm-air heater faults.",
      steps: [
        "Confirm the symptom/code; check power, controls, gas supply and pressure; isolate safely; reference the MI.",
      ],
      faults: [
        { symptom: "No heat / won't fire", checks: ["Check power, controls calling, gas supply & pressure", "Check ignition/flame proving and any lockout code"] },
        { symptom: "Fires then cuts out on overheat", checks: ["Check airflow — blocked filter/ducts or fan fault — and the limit thermostat", "Check the heat exchanger for blockage"] },
        { symptom: "Fan won't run / runs constantly", checks: ["Check fan motor/capacitor, the fan-limit control and wiring"] },
        { symptom: "Poor combustion / sooting", checks: ["Clean burner/injector; check ventilation, flue and gas rate"] },
        { symptom: "Cracked heat exchanger suspected", checks: ["Investigate via combustion (CO in the airstream) — a cracked heat exchanger is Immediately Dangerous; condemn under GIUSP"] },
      ],
      safety: ["A cracked/leaking heat exchanger that puts products into the air stream is Immediately Dangerous.", "Re-prove tightness and combustion after work."],
      standards: ["BS 5864", "BS 7967:2015", "GSIUR 1998 (GIUSP)"],
    },

    // ===================== METERING & SUPPLY ========================
    {
      id: "meter-install", appliance: "meter", task: "install",
      title: "Meter installation & emergency controls",
      summary: "ECV, regulator, meter, emergency notice and bonding.",
      steps: [
        "The ECV is the consumer's main shut-off — accessible, clearly identifiable (on/off) and operable by the user.",
        "Display a gas emergency notice at/near the meter (what to do if you smell gas + 0800 111 999).",
        "A regulator (governor) reduces incoming pressure to the nominal supply pressure; the meter (e.g. U6/G4 diaphragm, or smart) measures volume.",
        "Support and protect the installation; external meters in a weatherproof box with consumer access.",
        "Boundaries between network, primary meter installation and installation pipework follow IGEM/G/1 Edition 3; no unauthorised connection upstream of the meter.",
        "Confirm main equipotential bonding (10 mm², within 600 mm of the meter outlet, before any branch).",
      ],
      safety: ["A buried, seized or obstructed ECV is a real defect — it must be usable by the consumer.", "Meter exchange/positioning may be the transporter/MOP's remit — confirm responsibilities."],
      standards: ["IGEM/G/1 Edition 3 (2025)", "IGEM/G/13", "GSIUR 1998"],
    },
    {
      id: "meter-inspect", appliance: "meter", task: "service",
      title: "Inspect the meter, ECV, regulator & bonding",
      summary: "Routine checks at the gas entry point.",
      steps: [
        "Check the ECV operates and is accessible/identifiable, with the emergency notice present.",
        "Check the meter and connections for damage/corrosion and soundness (tightness test the installation).",
        "Check the regulator/governor and that the meter-outlet working pressure is within IGEM/G/13 (18.5–23 mbar after 1 min).",
        "Check main bonding is present, 10 mm², correctly placed and in good condition.",
        "Record findings; raise any GIUSP unsafe situations.",
      ],
      safety: ["Report low/high supply pressure via the 'Reporting of Low Pressure' process.", "Missing or wrongly-placed bonding is a common defect."],
      standards: ["IGEM/G/13", "BS 7671 (bonding)", "GSIUR 1998"],
    },
  ];

  // ===== Brand / model fault-code & spec quick-reference (works OFFLINE) =====
  // Researched from manufacturer Multi-Functional Instructions (MIs) and
  // corroborated installer sources. Fault codes are the common ones engineers
  // look up; meanings are concise with first checks. EVERY figure still defers
  // to the appliance's own MI / data badge — combustion setpoints especially
  // vary by model, output and gas family, so several are shown as "see MI".
  const brands = [
    {
      id: "worcester", name: "Worcester Bosch", appliance: "boiler", color: "#4f9dde",
      note: "Two code generations: older Greenstar i/Si/CDi show 2-character codes; newer 2000/4000/8000 add a 3-digit service number (e.g. EA 229). Same letters can differ — 'EA' alone = ignition fail at start; 'EA 229' = flame lost mid-run.",
      reset: "Press & hold reset ~3s (older models: turn the rotary selector to the reset / flame-with-cross position). Reset ONCE — if the lockout returns, diagnose; repeated resets on EA/E9 are unsafe.",
      codes: [
        { code: "EA", meaning: "Ignition lockout — no flame after ignition (older i/Si/CDi). Check gas on, electrode & lead, flame sensor, frozen condensate, flue." },
        { code: "EA 229", meaning: "Flame LOST during a run (2000/4000/8000). Classic cause: frozen/blocked condensate; also gas supply & flame sense." },
        { code: "E9", meaning: "Overheat — safety temp limiter tripped. Check CH pressure, pump, circulation/airlock, blocked heat exchanger, closed valves." },
        { code: "C6", meaning: "Fan speed fault (too high/low). Check fan, wiring, air-pressure path." },
        { code: "C7", meaning: "Fan not running. Failed fan or air-pressure switch." },
        { code: "CE / D5", meaning: "Low system pressure (older ranges). Re-pressurise to 1.0–1.5 bar. (On some newer ranges D5 relates to condensate/pump — verify by model.)" },
        { code: "A1", meaning: "Pump running dry / low pressure / pump fault." },
        { code: "D1", meaning: "Return NTC sensor fault." },
        { code: "E2", meaning: "CH flow NTC sensor fault." },
        { code: "F0 / FA", meaning: "Internal/PCB or flame-detection fault — engineer." },
      ],
      specs: [
        { label: "CO₂ — CDi Classic (NG)", value: "~9.6% max / ~9.0% min (±0.4)" },
        { label: "CO₂ — Si Compact (NG)", value: "9.8% max / 9.2% min (±0.5)" },
        { label: "CO/CO₂ ratio", value: "< 0.002" },
        { label: "Expansion vessel pre-charge", value: "0.75 bar (i System) / 1.0 bar (8000) — see MI" },
        { label: "System pressure (cold)", value: "1.0–1.5 bar" },
        { label: "CO₂ — 2000/4000/8000", value: "see MI (model-specific)" },
      ],
    },
    {
      id: "vaillant", name: "Vaillant", appliance: "boiler", color: "#2e9b6b",
      note: "One common code system across ecoTEC plus/pro, ecoFIT pure, ecoTEC exclusive & Green iQ. F-codes = faults; S-codes = normal status (not faults).",
      reset: "Press & hold the reset button (crossed-out flame) > 3s; may take two attempts. Don't keep resetting a returning lockout.",
      codes: [
        { code: "F.0 / F.1", meaning: "Flow / return NTC open circuit. Check sensor & wiring." },
        { code: "F.10 / F.11", meaning: "Flow / return NTC short circuit." },
        { code: "F.20", meaning: "Overheat safety switch-off. Earth fault / faulty NTC / low water." },
        { code: "F.22", meaning: "Low water pressure / dry-fire. Check CH pressure, pump, pressure sensor." },
        { code: "F.23", meaning: "Temp difference too great. Pump under-performing, air, flow/return reversed." },
        { code: "F.24", meaning: "Temp rise too fast. Low flow: blocked/stuck pump, air, closed valves, sludge." },
        { code: "F.25", meaning: "Flue gas temp too high. Check flue/condensate, flue-gas NTC." },
        { code: "F.27", meaning: "Flame simulation (flame seen with no demand). Moisture on PCB, flame sensor, passing gas valve." },
        { code: "F.28", meaning: "No ignition at start-up. Gas off/at meter, gas valve, ignition leads/electrode, frozen condensate." },
        { code: "F.29", meaning: "Flame lost during operation. Intermittent gas, condensate/flue blockage, earthing." },
        { code: "F.32", meaning: "Fan fault. Fan plug, harness, seized fan, Hall sensor." },
        { code: "F.49", meaning: "eBUS fault. Short/overload/polarity on eBUS wiring." },
        { code: "F.61 / F.62", meaning: "Gas valve control / shut-off delay fault." },
        { code: "F.63", meaning: "EEPROM / PCB fault." },
        { code: "F.64 / F.65", meaning: "Electronics/NTC fault / PCB too hot." },
        { code: "F.70", meaning: "Invalid DSN (display & PCB replaced together) — re-enter appliance code." },
        { code: "F.73 / F.74", meaning: "Water pressure sensor signal too low / too high." },
        { code: "F.75", meaning: "No pressure change on pump start. Faulty pump or pressure sensor, air." },
        { code: "F.83", meaning: "Temp change at burner start too small (dry-fire / no circulation)." },
        { code: "F.85", meaning: "Flow & return NTC wrongly fitted / swapped." },
        { code: "S.31 / S.34", meaning: "STATUS (not a fault): summer mode / DHW-only, and frost protection active." },
      ],
      specs: [
        { label: "CO₂ — ecoTEC plus (G20)", value: "9.8% target (+0.2 / −0.8), measured case-off" },
        { label: "Expansion vessel pre-charge", value: "0.75 bar (ecoTEC pro 10 L; fill ≥0.2 bar above pre-charge)" },
        { label: "System pressure (cold)", value: "1.0–1.5 bar" },
        { label: "CO₂ — other ranges", value: "see MI" },
      ],
    },
    {
      id: "ideal", name: "Ideal", appliance: "boiler", color: "#e0673a",
      note: "Logic and Vogue share the L/F code architecture. L-codes = lockouts (often manual reset); F-codes = component faults (usually need an engineer).",
      reset: "Press & hold reset ~5–10s until it relights. F1/low pressure clears by topping up, not resetting. After 5 resets in 15 min, cycle mains power.",
      codes: [
        { code: "L1", meaning: "Low water flow / poor circulation. Pump, blockage, low pressure, air lock." },
        { code: "L2", meaning: "Flame loss / no flame (5 failed attempts → lockout). Gas on, pressure, ignition/flame leads, frozen condensate." },
        { code: "LF", meaning: "(Older Logic) ignition/flame fault — treat as L2." },
        { code: "L5", meaning: "Too many resets — cycle mains power." },
        { code: "L6", meaning: "False flame. Flame-sense electrode/gas valve, damp PCB." },
        { code: "L9", meaning: "PCB / config fault — engineer." },
        { code: "LA", meaning: "Overheat. Pump, flow, blockages." },
        { code: "F1", meaning: "Low system pressure. Top up to ~1.0–1.5 bar; check leaks/PRV." },
        { code: "F2", meaning: "Flame loss after ignition. Gas pressure, flue, gas valve, condensate." },
        { code: "F3", meaning: "Fan fault." },
        { code: "F4 / L4", meaning: "Flow thermistor fault." },
        { code: "F5 / L5", meaning: "Return thermistor fault / excess differential." },
        { code: "F6", meaning: "Outside sensor fault (weather comp)." },
        { code: "F7", meaning: "Low mains voltage." },
        { code: "F9", meaning: "PCB / communication fault — engineer." },
        { code: "C1 / C2", meaning: "Boiler Chip Card (BCC) fault — engineer." },
      ],
      specs: [
        { label: "CO₂ — Logic Max (G20)", value: "~9.3–9.5% max — see MI for exact" },
        { label: "CO/CO₂ ratio", value: "< 0.004; CO < 200 ppm" },
        { label: "Expansion vessel pre-charge", value: "0.75 bar (Logic 8 L / Vogue 10 L)" },
        { label: "System pressure (cold)", value: "fill ~1.0 bar; run 1.0–1.5 bar" },
      ],
    },
    {
      id: "baxi", name: "Baxi", appliance: "boiler", color: "#c0476a",
      note: "Baxi & Potterton share the same control platform — the E-code set is essentially identical across both. Combustion target (NG) ~9.0% CO₂ at all fan speeds.",
      reset: "Press & hold the Reset (R) button ~3–5s. Limit attempts (~5) then stop and diagnose; don't repeatedly reset a returning lockout.",
      codes: [
        { code: "E20", meaning: "CH flow (primary) NTC fault." },
        { code: "E28", meaning: "Flue / POC thermistor fault." },
        { code: "E40", meaning: "Return NTC fault." },
        { code: "E50", meaning: "DHW NTC fault." },
        { code: "E92", meaning: "Combustion out of band (during auto gas-valve set). Re-run combustion; check CO₂/gas, flue." },
        { code: "E109", meaning: "Poor circulation / no flow. Bleed air, check pump, filter, valves." },
        { code: "E110", meaning: "Overheat / rapid temp rise. Circulation, blockage; reset." },
        { code: "E118 / E119", meaning: "Low system pressure (< ~0.5 bar). Re-pressurise to 1.0–1.5 bar; check leaks. (Which one shows depends on model — same fault.)" },
        { code: "E125", meaning: "Circulation fault / no flow. Pump, sludge/blockage; may need a flush." },
        { code: "E128", meaning: "Flame lost during a run. Gas supply, flue/condensate, electrode, gas valve." },
        { code: "E131", meaning: "Flue / safety overheat lockout." },
        { code: "E133", meaning: "Ignition lockout — failed to ignite. Gas on, thaw frozen condensate, electrode/flue; reset once." },
        { code: "E160", meaning: "Fan fault / wiring." },
        { code: "E168", meaning: "General / PCB / flame-detection lockout — engineer." },
      ],
      specs: [
        { label: "CO₂ (NG)", value: "~9.0% (±0.7) at all fan speeds; CO < 350 ppm; CO/CO₂ < 0.004" },
        { label: "Expansion vessel pre-charge", value: "EcoBlue Advance 1.0 bar; other ranges — see MI" },
        { label: "System pressure (cold)", value: "1.0–1.5 bar; PRV 3 bar; lockout < ~0.5 bar" },
      ],
    },
    {
      id: "potterton", name: "Potterton", appliance: "boiler", color: "#7a8b3c",
      note: "Potterton (Promax, Assure, Gold, Titanium) is built on the same Baxi platform — the E-codes and ~9.0% CO₂ target match the Baxi list.",
      reset: "Press & hold Reset ~3–5s; limit attempts then diagnose.",
      codes: [
        { code: "E110", meaning: "Overheat / rapid temp rise. Check circulation, pump, blockage; reset." },
        { code: "E118 / E119", meaning: "Low system pressure (< ~0.5 bar). Re-pressurise 1.0–1.5 bar; check leaks." },
        { code: "E125", meaning: "Circulation fault / insufficient flow. Pump, sludge/blockage, air." },
        { code: "E128", meaning: "Flame lost during operation. Gas, flue/condensate, electrode." },
        { code: "E131", meaning: "Flue / overheat lockout." },
        { code: "E133", meaning: "Ignition lockout (gas/ignition fail or frozen condensate). Reset once." },
        { code: "E160", meaning: "Fan fault." },
        { code: "E168", meaning: "General / PCB / flame-detection lockout — engineer." },
      ],
      specs: [
        { label: "CO₂ (NG)", value: "~9.0% (±0.7) — see MI" },
        { label: "Expansion vessel pre-charge", value: "see MI (~0.5 bar min cold-fill cited)" },
        { label: "System pressure (cold)", value: "1.0–1.5 bar; shutdown < 0.5 bar" },
      ],
    },
    {
      id: "glowworm", name: "Glow-worm", appliance: "boiler", color: "#d98a2b",
      note: "Energy / Ultimate3 / Betacom4 / Easicom3 / Compact run the Vaillant-group platform — the F-codes match the Vaillant set. F.28/F.29 in winter are most often a frozen condensate pipe.",
      reset: "Press/hold the reset button (~1s, up to ~5–10s on some displays) once the fault clears; max ~3–5 resets before lockout.",
      codes: [
        { code: "F.0 / F.1", meaning: "Flow / return NTC open circuit." },
        { code: "F.10 / F.11", meaning: "Flow / return NTC short circuit." },
        { code: "F.20", meaning: "Overheat limiter (STB) tripped. Check pump/flow, sensor contact, air." },
        { code: "F.22", meaning: "Low water pressure / dry-fire. Top up to 1.0–1.5 bar; check pump + sensor." },
        { code: "F.23", meaning: "Temp spread too great. Pump direction, sensors transposed." },
        { code: "F.24", meaning: "Temp rising too fast. Pump seized/airlocked, sludge." },
        { code: "F.27", meaning: "False flame. Residual flame, gas valve, flame-sense circuit." },
        { code: "F.28", meaning: "No ignition at start-up. Gas on/credit, frozen condensate, ignition lead/electrode." },
        { code: "F.29", meaning: "Flame lost during operation / re-ignition failed." },
        { code: "F.49", meaning: "eBUS fault. Check eBUS wiring to controls/accessories." },
        { code: "F.61 / F.62", meaning: "Gas valve control / shut-off delay fault." },
        { code: "F.63", meaning: "EEPROM / PCB fault." },
        { code: "F.64 / F.65", meaning: "Electronics/NTC fault / PCB overheating." },
        { code: "F.75", meaning: "No pressure rise on pump start. Pressure sensor (sludge), pump, air." },
      ],
      specs: [
        { label: "CO₂ — Energy7 (G20)", value: "~9.0% (±1.0) — see MI" },
        { label: "Expansion vessel pre-charge", value: "0.75 bar" },
        { label: "System pressure (cold)", value: "1.0–1.5 bar (min 1.0)" },
      ],
    },
    {
      id: "main", name: "Main", appliance: "boiler", color: "#6a6fb0",
      note: "Main (Eco Compact / Eco Elite / Combi) is Vaillant-group — shares the F-code set with Glow-worm/Vaillant. Also shows some E.xxx service codes (e.g. E133 = ignition/gas lockout, often a prepay meter run dry).",
      reset: "Press/hold the panel reset button ~1s after the fault clears.",
      codes: [
        { code: "F.22", meaning: "Low water pressure / dry-fire. Re-pressurise 1.0–1.5 bar." },
        { code: "F.23", meaning: "Flow/return diff too great. Pump direction, sensors transposed." },
        { code: "F.24", meaning: "Temp rising too fast. Pump airlock/seized, sludge." },
        { code: "F.27", meaning: "False flame." },
        { code: "F.28", meaning: "Ignition failure at start-up. Gas on/credit, frozen condensate, electrode." },
        { code: "F.29", meaning: "Flame lost / re-ignition failed." },
        { code: "F.61 / F.62", meaning: "Gas valve control / shut-off delay fault." },
        { code: "F.63", meaning: "EEPROM / PCB fault." },
        { code: "F.64 / F.65", meaning: "Electronics/NTC fault / overheating." },
        { code: "F.75", meaning: "No pressure rise on pump start." },
        { code: "E133", meaning: "Ignition / gas-supply lockout (often prepay meter empty)." },
      ],
      specs: [
        { label: "CO₂ — Eco Compact (G20)", value: "9.0% max (+0.3 / −0.2) / 8.5% min (+0.1 / −0.4)" },
        { label: "Gas rate (G20)", value: "~2.71 m³/h (25) / ~3.26 m³/h (30)" },
        { label: "Expansion vessel pre-charge", value: "1.0 bar (Eco Compact)" },
        { label: "System pressure (cold)", value: "1.0–1.5 bar; PRV 3 bar" },
      ],
    },
    {
      id: "viessmann", name: "Viessmann", appliance: "boiler", color: "#d23f3f",
      note: "Modern Vitodens (050/100/111/200-W) use self-calibrating Lambda Pro combustion — you VERIFY CO₂ is in range, you don't set it. The 200-W (Vitotronic) uses a fuller hex/EI code set — use the official Viessmann fault-code checker for those.",
      reset: "Press & hold reset ~10s (don't reset repeatedly); some 050/111-W reset via MODE+OK or the menu. Clear the underlying fault first.",
      codes: [
        { code: "F2", meaning: "Flame lost / overheat-related (range-dependent). Circulation, gas, flue, electrode." },
        { code: "F4", meaning: "No flame established (ignition fault). Gas on, ignition lead/electrode, condensate trap, flue." },
        { code: "F5", meaning: "Fan / flue-gas sensor fault." },
        { code: "F6", meaning: "Sensor reading out of range." },
        { code: "F9", meaning: "Control / communication fault." },
        { code: "FF", meaning: "Control/electronics fault — power-cycle (mains off ~30s) then reset." },
        { code: "0F", meaning: "Service due (history only — informational)." },
        { code: "EI xx", meaning: "Blocking fault with sub-number (200-W). Use the official Viessmann checker for the exact number." },
      ],
      specs: [
        { label: "CO₂ (NG)", value: "Lambda Pro self-calibrating; acceptance window ~7.5–10.5% — verify in range, do NOT set" },
        { label: "Expansion vessel pre-charge", value: "~0.75 bar (100-W, 8 L) — confirm on data plate" },
        { label: "System pressure (cold)", value: "min 1.0 bar; 0.1–0.2 bar above vessel pre-charge" },
      ],
    },
    {
      id: "alpha", name: "Alpha", appliance: "boiler", color: "#3f86c4",
      note: "E-Tec / E-Tec Plus share the same platform, code set and reset (codes shown as two digits — E 01, E 10…). ProTec & CD are light-commercial and use different tables — confirm on the MI. Codes can vary by range; verify on the appliance.",
      reset: "Press & hold RESET ~5s until the display clears and it re-lights. If the fault recurs after one reset, investigate — don't keep resetting. (Holding reset ~8s with no demand forces a fixed output for combustion checking — not a reset.)",
      codes: [
        { code: "E 01", meaning: "Ignition failure / no flame at start-up. Gas on & at meter, ignition lead & electrode." },
        { code: "E 02", meaning: "Overheat boiler lockout. System pressure, pump, air-lock/circulation, overheat stat." },
        { code: "E 03", meaning: "High flue temp / fan or air-flow not detected. Flue & condensate blockage, fan & APS." },
        { code: "E 04", meaning: "Gas valve electrical connection fault." },
        { code: "E 05", meaning: "CH flow sensor fault." },
        { code: "E 06", meaning: "DHW sensor fault." },
        { code: "E 10", meaning: "Low system pressure. Re-pressurise 1.0–1.5 bar then reset; check leak / expansion vessel." },
        { code: "E 15", meaning: "Incorrect configuration / PCB parameters." },
        { code: "E 20", meaning: "Flame-sensing fault (flame not detected / flame loss). Flame electrode, gas, condensate." },
        { code: "E 24", meaning: "Control-panel button fault." },
      ],
      specs: [
        { label: "CO₂", value: "factory-set air/gas ratio — see MI (reject if CO/CO₂ > 0.003)" },
        { label: "Expansion vessel pre-charge", value: "1.0 bar (E-Tec 8 L; ProTec Plus 1.0 bar; CD 0.8 bar)" },
        { label: "System pressure (cold)", value: "1.0 bar fill; not above ~2.5 bar hot" },
      ],
    },
    {
      id: "vokera", name: "Vokèra", appliance: "boiler", color: "#46b7c6",
      note: "Newer ranges show 'A' lockout codes (A01…) on the display; some literature lists the same faults as 'E0xx'. Original Compact is LED-based (no numeric codes). Now Riello-owned.",
      reset: "Press & hold the Reset (R) button ~3–5s until the fault clears. A04 / low pressure: re-pressurise THEN reset. Older units: turn the mode selector to reset and back.",
      codes: [
        { code: "A01", meaning: "Ignition failure / no flame. Gas on, inlet pressure, ignition lead & electrode." },
        { code: "A02", meaning: "Limit (overheat) thermostat lockout. Pump, circulation, air locks." },
        { code: "A03", meaning: "Fan fault. Fan wiring/rotation, flue blockage." },
        { code: "A04", meaning: "Low system water pressure. Re-pressurise 1.0–1.5 bar then reset; check leaks." },
        { code: "A06", meaning: "DHW thermistor fault." },
        { code: "A07", meaning: "Primary flow thermistor / overtemperature. Circulation, sludge/limescale." },
        { code: "A08", meaning: "Return thermistor fault." },
        { code: "A09", meaning: "Flue sensor fault / service-hours reminder (verify on MI)." },
        { code: "A11", meaning: "False flame detected. Electrode, condensate, flame-sense." },
        { code: "A41", meaning: "Pressure transducer fault (can't read pressure)." },
        { code: "E041 (Evolve)", meaning: "Pressure below 0.3 bar safety threshold — open the filling tap, bring to 1–1.5 bar (user-resettable)." },
      ],
      specs: [
        { label: "CO₂ — Easi-Heat Plus 25C (NG)", value: "9.0% max / 9.5% min — see MI (NG vs LPG differ)" },
        { label: "Expansion vessel pre-charge", value: "1.0 bar (8 L)" },
        { label: "System pressure (cold)", value: "1.0–1.5 bar (min ~0.5 bar)" },
      ],
    },
  ];

  // Appliance-level quick reference for gas fires & cookers (no digital fault
  // codes — diagnose by symptom). Standards-anchored; confirm against the MI.
  const symptomRefs = [
    {
      id: "fire-ref", appliance: "fire", name: "Gas fires", color: "#cf5f7a",
      note: "Most gas fires have no fault display — diagnose by symptom. The ODS/oxypilot is atmosphere-sensing: never adjust or defeat it, and replace the pilot/oxypilot as a complete unit. Refit the fuel bed (coals/pebbles/logs) EXACTLY per the MI layout — wrong layout causes sooting and CO.",
      faults: [
        { symptom: "Pilot won't stay lit", checks: "Thermocouple/oxypilot not heated or worn; check the pilot flame envelops the tip, clean the ODS pilot air inlet (fixes most), replace the pilot/oxypilot as a unit." },
        { symptom: "ODS/oxypilot repeatedly cuts out", checks: "Pilot sensing low O₂ or a dirty inlet; check ventilation/spillage, clear the aeration hole, debris on burner. Never bypass the ODS — persistent cut-out can be a real flue/combustion fault." },
        { symptom: "Won't ignite / no spark", checks: "Piezo/spark generator, HT lead or electrode; check spark gap per MI, clean electrode (brass brush), check lead seating, look for a blue-white spark." },
        { symptom: "Spark but no light / delayed ignition", checks: "Electrode misaligned, low pressure, or partial blockage; check 20 mbar running, clear injector/ports, reposition the electrode." },
        { symptom: "Sooting / yellow flame", checks: "Incomplete combustion: most often wrong fuel-bed layout (DFE/ILFE), also blocked ports or wrong air/fuel mix. Reset the fuel bed per MI; investigate before leaving in service — CO risk." },
        { symptom: "Pilot lights but main burner won't", checks: "Faulty FSD/thermocouple, gas valve, or blocked injector." },
      ],
      specs: [
        { label: "Gas inlet (NG)", value: "nominally 20 mbar at the appliance, running" },
        { label: "ODS/oxypilot", value: "not adjustable — replace as a complete assembly" },
        { label: "Open-flued fires", value: "flue-flow (smoke) test then spillage test after install/service; fail = do not leave connected to gas" },
        { label: "Flueless fires", value: "catalytic converter + ODS; need purpose vent (~100 cm²) + openable window + CO alarm (BS EN 50291)" },
        { label: "Injectors & spark gaps", value: "model-specific — take from the MI / data badge" },
      ],
      standards: ["BS 5871-1/-2/-3", "BS 5871-4 (flueless)", "BS 5440-1 (flues/spillage)", "BS 5440-2 (ventilation)", "GSIUR 1998"],
    },
    {
      id: "cooker-ref", appliance: "cooker", name: "Gas cookers", color: "#e08a4f",
      note: "Gas cookers have no digital fault codes — diagnose by symptom and inspection. Since 2010 all NEW cookers have a flame-supervision device (FSD/FFD) on every burner; it can't be retrofitted, and only FSD-equipped cookers may go in flats/HMOs.",
      faults: [
        { symptom: "Burner won't light / no spark", checks: "Spark generator/module, cracked/dirty electrode, lead or spark switch; check electrode gap & cleanliness, lead continuity, clean ports/cap." },
        { symptom: "Spark but won't stay lit (FFD drops out)", checks: "Worn/misaligned thermocouple or weak valve magnet; flame must envelop the tip; hold knob ~10–20s; replace thermocouple." },
        { symptom: "Oven won't light (hob OK)", checks: "Oven FFD/thermocouple, thermostat/valve, oven electrode, or blocked oven injector." },
        { symptom: "Flame lifting off the burner", checks: "Too much primary air or pressure too high; check air shutter & inlet pressure." },
        { symptom: "Yellow / sooty flame", checks: "Under-aeration, blocked/partly blocked injector, dirty ports, or wrong injector for the gas family." },
        { symptom: "Uneven oven temperature", checks: "Thermostat drift, blocked oven ports, poor distribution, or door seal." },
        { symptom: "Gas smell at the appliance", checks: "Leak at bayonet/hose/union, loose injector, or unlit burner; LDF / tightness test, check hose condition & date — don't leave live." },
        { symptom: "Sparks continuously / won't stop clicking", checks: "Moisture in burner/igniter, misaligned cap, or stuck spark switch; dry & re-centre the cap, dry the electrode." },
      ],
      specs: [
        { label: "Inlet pressure", value: "NG 20 mbar; LPG propane 37 mbar (butane ~28–30 mbar) at the appliance" },
        { label: "Stability device", value: "free-standing cookers need an anti-tip bracket/chain (BS 6172/GSIUR)" },
        { label: "Flexible hose", value: "bayonet to BS 669-1; straight bayonet faces DOWN (hose hangs in a 'U'); socket ~750 mm from floor; off the floor" },
        { label: "Ventilation (BS 5440-2, by room volume)", value: "< 5 m³ = 100 cm²; 5–10 m³ = 50 cm²; > 10 m³ = nil — plus an openable window/door" },
        { label: "FSD", value: "mandatory on all new-cooker burners (2010); not retrofittable; required for flats/HMOs" },
      ],
      standards: ["BS 6172", "BS 5440-2", "BS 669-1 (cooker hoses)", "BS EN 30 (FSD)", "GSIUR 1998"],
    },
  ];

  return { appliances, tasks, standards, guides, brands, symptomRefs };
})();
