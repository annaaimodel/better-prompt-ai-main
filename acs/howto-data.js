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

   Standard editions current as of 2026 (verified via web research):
     GSIUR 1998 (ACOP L56, 5th ed) · BS 6798:2014 · BS 6891:2015+A1:2019
     BS 5440-1:2023 · BS 5440-2:2023 · BS 7593:2019 · BS 7967:2015
     BS 5871-1/-2/-3 · BS 6172 · BS 669-1 · Boiler Plus (2018, England)
     Approved Docs (England): L (2021, in force Jun 2022), J (2010 +amdts),
     P (2013), G/G3 (2015). Wales & Scotland differ.
   ===================================================================== */

window.ACSHOWTO = (function () {
  const appliances = [
    { id: "boiler", name: "Gas boilers",  full: "Combi, system & regular condensing boilers", icon: "🔥", color: "#4f9dde" },
    { id: "cooker", name: "Gas cookers",  full: "Freestanding, range, hobs & ovens",          icon: "🍳", color: "#e08a4f" },
    { id: "fire",   name: "Gas fires",    full: "Radiant, DFE/ILFE, room-sealed & flueless",  icon: "🔆", color: "#cf5f7a" },
  ];
  const tasks = [
    { id: "install", name: "Installation", icon: "🔧" },
    { id: "service", name: "Servicing",    icon: "🧰" },
    { id: "repair",  name: "Repair / fault-finding", icon: "🩺" },
  ];

  // ---- Current UK standards quick-reference (verified 2026) ----------
  const standards = [
    { ref: "GSIUR 1998", scope: "Gas Safety (Installation and Use) Regulations — the principal law. Gas Safe registration & competence are mandatory. ACOP/guidance L56 (5th ed)." },
    { ref: "BS 6798:2014", scope: "Selection, installation, inspection, commissioning, servicing & maintenance of gas boilers ≤70 kW net input." },
    { ref: "BS 6891:2015+A1:2019", scope: "Low-pressure installation pipework up to 35 mm. Max 1 mbar drop meter→appliance (NG)." },
    { ref: "BS 5440-1:2023", scope: "Chimneys/flues for gas appliances ≤70 kW net — design, install, commission, maintain. (Revised Dec 2023.)" },
    { ref: "BS 5440-2:2023", scope: "Ventilation / combustion-air provision for gas appliances ≤70 kW net. (Revised Dec 2023.)" },
    { ref: "BS 7593:2019", scope: "Preparation, commissioning & maintenance of CH water — cleaning, flushing, inhibitor, in-line filter, periodic inhibitor testing." },
    { ref: "BS 7967:2015", scope: "Use of electronic portable combustion gas analysers (FGA) — CO, CO/CO₂ ratio, combustion performance in dwellings. Generic action levels (TB143): CO ≤350 ppm AND CO/CO₂ ratio <0.004; 0.004–0.008 investigate; >0.008 do not leave in service. Manufacturer limits prevail." },
    { ref: "IGEM/UP/1B (Edition 4)", scope: "Domestic tightness testing & purging. Edition 4 is mandatory from 1 Oct 2026 — permissible pressure drop is now determined by Installation Volume (IV), not meter size. (Both editions valid during the 2026 transition.)" },
    { ref: "IGEM/G/11 Edition 2 (GIUSP, amended 2025)", scope: "Gas Industry Unsafe Situations Procedure — classify & act on unsafe situations (Immediately Dangerous / At Risk). NOTE: 'Not to Current Standards' (NCS) has been removed from GIUSP — it may be recorded/advised but must NOT appear on an unsafe-situations warning notice. Covers RIDDOR reporting." },
    { ref: "BS EN 50291 / 50292", scope: "CO alarms (50291) and their siting (50292). ADJ (2022) requires a CO alarm where a fuel-burning appliance is installed — but excludes cookers. A CO alarm is mandatory in the same room as a flueless fire." },
    { ref: "Gas Safe TB143 / TB157", scope: "TB143 = CO/CO₂ combustion checks at commissioning/service. TB157 = combustion checks on natural gas containing up to 20% hydrogen (grid blending)." },
    { ref: "BS 5871-1/-2/-3/-4", scope: "Installation of gas fires/heaters: -1 radiant/convector, stoves & fire/back boilers; -2 inset live fuel effect (ILFE) ≤15 kW; -3 decorative fuel effect (DFE) ≤20 kW; -4 flueless fires/heaters ≤6 kW (all 2005, -4 is 2007)." },
    { ref: "BS 6172:2010+A1:2017", scope: "Installation, servicing & maintenance of domestic gas cooking appliances (2nd & 3rd family gases) — includes the stability-device requirement." },
    { ref: "BS 669-1:2022", scope: "Strip-wound metallic flexible hoses & bayonet sockets for domestic gas cooking appliances (NG; BS 669-2 covers LPG)." },
    { ref: "Boiler Plus (2018, England)", scope: "Min 92% ErP; time & temperature control; combi must add one of FGHR / weather comp / load comp / smart controls." },
    { ref: "Approved Doc L (2021, in force Jun 2022)", scope: "Conservation of fuel & power. 55 °C max design flow temp for wet systems in new dwellings; min efficiencies." },
    { ref: "Approved Doc J (2010 +amdts)", scope: "Combustion appliances & fuel storage — air supply, flues, CO alarm requirements." },
    { ref: "Approved Doc G / G3 (2015)", scope: "Hot water safety; unvented hot water storage needs the separate G3 competence." },
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
        "Flush & cleanse the system to BS 7593:2019 (clean, flush, then add inhibitor); fit an in-line magnetic filter on the return. Record inhibitor concentration.",
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
      standards: ["BS 6798:2014", "BS 6891:2015+A1:2019", "BS 5440-1:2023", "BS 7593:2019", "BS 7967:2015", "Boiler Plus", "Approved Doc L/J", "GSIUR 1998"],
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
        "Check the sealed system: expansion vessel charge (with system depressurised), PRV operation, system pressure, and clean/check the magnetic filter; confirm inhibitor level (BS 7593:2019) and top up if low.",
        "Reassemble, re-prove gas tightness, then run and confirm gas rate against the data badge and correct operating/standing pressures.",
        "Post-service combustion analysis: confirm CO/CO₂ ratio and CO within the MI limits; investigate ventilation, flue or gas rate if out of spec.",
        "Carry out a flue/spillage check where applicable, complete the benchmark service record, and report any At Risk / Immediately Dangerous findings under GIUSP.",
      ],
      safety: [
        "Always renew combustion-circuit seals that have been disturbed — a poor seal can leak products of combustion / CO.",
        "If post-service combustion is out of limits, do not leave the appliance in use until resolved.",
        "Check the expansion vessel charge only with the system depressurised, or the reading is meaningless.",
      ],
      standards: ["BS 6798:2014", "BS 7967:2015", "BS 7593:2019", "BS 5440-1/-2:2023", "GSIUR 1998"],
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
        { symptom: "Banging / kettling / noisy", checks: ["Likely scale or sludge in the heat exchanger — check inhibitor & filter, clean/flush per BS 7593:2019", "Check pump operation and for trapped air / poor circulation"] },
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
        "Flexible hose (freestanding): use a hose to BS 669-1 of the correct rating and length; fit the bayonet so the hose hangs in a downward loop, free from the hotplate heat, sharp edges, kinking and the back of the appliance.",
        "Stability device: fit the stability chain/bracket per BS 6172 and the MI so the cooker cannot tip when weight is applied to an open oven door.",
        "Clearances: maintain the MI clearances to combustible surfaces, especially at the sides above hotplate level and to any overhead units/extractor.",
        "Ventilation: confirm the room meets BS 5440-2:2023 for a flueless appliance — adequate room volume and an openable window/door to outside; check any extract fan/hood won't cause spillage from other open-flued appliances.",
        "Level the appliance and check the oven door and shelves sit correctly.",
        "Tightness test the installation and check the connection for soundness (leak detection fluid / gauge).",
        "Commission: light each hotplate burner and confirm clean cross-lighting, check oven and grill ignition, and confirm the flame supervision device (FSD) holds the gas on and shuts off if the flame is extinguished.",
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
  ];

  return { appliances, tasks, standards, guides };
})();
