/* =====================================================================
   GasPass — Recent Updates feed
   ---------------------------------------------------------------------
   Powers updates.html. We review UK gas standards, regulations and the
   law affecting engineers MONTHLY — add the newest items to the TOP of
   the `updates` array and bump `lastReviewed`.

   Each entry:
     date    "YYYY-MM-DD"  (when it takes/took effect, or was published)
     type    "Legal" | "Standard" | "Building Regs" | "Policy" | "Electrical" | "Metering"
     title   short headline
     detail  what changed, in plain English
     status  { text, tone }  tone: "live" | "upcoming" | "info"
     url, source   official/authoritative link
   ===================================================================== */
window.ACSUPDATES = {
  lastReviewed: "2026-06-22",          // ← update each monthly review
  reviewCadence: "monthly",
  updates: [
    {
      date: "2026-10-01", type: "Standard",
      title: "IGEM/UP/1B Edition 4 becomes mandatory (tightness testing)",
      detail: "From 1 Oct 2026 only Edition 4 may be used (Edition 3 withdrawn 30 Sep 2026). The permissible pressure drop is now set by Installation Volume (IV, in m³) — not meter size — and a pipework-only retest is a mandatory follow-on step when appliances are connected (any perceptible movement = fail). 'Gas tight' = ≤0.25 mbar fluid gauge / ≤0.2 mbar electronic.",
      status: { text: "Mandatory 1 Oct 2026", tone: "upcoming" },
      url: "https://www.igem.org.uk/resource/igem-up-1b-edition-4-tightness-testing-and-direct-purging-of-small-liquefied-petroleum-gas-air-ng-and-lpg-installations.html",
      source: "IGEM / Gas Safe ISU 133",
    },
    {
      date: "2027-03-24", type: "Building Regs",
      title: "Future Homes Standard (Part L & F 2026) takes effect",
      detail: "Published 24 Mar 2026, in force 24 Mar 2027 (higher-risk buildings 24 Sep 2027). NEW homes built to it cannot comply with a gas, oil, LPG or hydrogen-ready boiler — heat pump + solar PV become the default. EXISTING homes are unaffected: there is NO legal ban and no end-of-sale date for replacing a gas boiler (the old '2035 ban' was dropped).",
      status: { text: "In force 24 Mar 2027", tone: "upcoming" },
      url: "https://www.gov.uk/government/publications/the-future-homes-and-buildings-standards-building-circular-012026",
      source: "GOV.UK — Building Circular 01/2026",
    },
    {
      date: "2026-04-15", type: "Electrical",
      title: "BS 7671 Amendment 4 published (wiring regs)",
      detail: "Amendment 4 to the 18th Edition publishes April 2026 (current is A2:2022 + A3:2024). Relevant to the electrical safety checks and bonding gas operatives carry out. No 19th Edition in 2026.",
      status: { text: "Published Apr 2026", tone: "info" },
      url: "https://electrical.theiet.org/bs-7671",
      source: "IET",
    },
    {
      date: "2025-11-01", type: "Metering",
      title: "IGEM/G/1 Edition 3 — network / meter / pipework boundaries",
      detail: "New edition (Nov 2025) redefining the boundaries between the gas network, the primary meter installation and the consumer's installation pipework — i.e. where responsibility sits. Relevant to MET1.",
      status: { text: "In force", tone: "live" },
      url: "https://www.igem.org.uk/",
      source: "IGEM / Gas Safe ISU 132",
    },
    {
      date: "2025-07-01", type: "Standard",
      title: "IGEM/G/11 Edition 2 — July 2025 amendment (GIUSP)",
      detail: "Latest amendment to the Gas Industry Unsafe Situations Procedure. Two unsafe categories only — Immediately Dangerous (ID) and At Risk (AR). 'Not to Current Standards' (NCS) is NOT a GIUSP unsafe category (recorded/advised only, never on a warning notice).",
      status: { text: "In force", tone: "live" },
      url: "https://www.igem.org.uk/resource/igem-g-11-edition-2-gas-industry-unsafe-situations-procedure.html",
      source: "IGEM",
    },
    {
      date: "2025-04-01", type: "Legal",
      title: "Clean Heat Market Mechanism live",
      detail: "From 1 April 2025, boiler manufacturers must match a rising percentage of their boiler sales to heat-pump installations (6% in 2025–26, 8% in 2026–27) or pay a penalty. Doesn't change how you work, but is why boiler prices/heat-pump push are shifting.",
      status: { text: "Live since Apr 2025", tone: "live" },
      url: "https://www.gov.uk/government/publications/clean-heat-market-mechanism",
      source: "GOV.UK / DESNZ",
    },
    {
      date: "2024-11-30", type: "Standard",
      title: "BS 7593:2019+A1:2024 (central-heating water treatment)",
      detail: "Amendment A1 (Nov 2024) to the water-treatment code of practice — cleaning, flushing, inhibitor and in-line filter requirements. The plain 2019 version is superseded.",
      status: { text: "In force", tone: "live" },
      url: "https://knowledge.bsigroup.com/products/code-of-practice-for-the-preparation-commissioning-and-maintenance-of-domestic-central-heating-and-cooling-water-systems",
      source: "BSI",
    },
    {
      date: "2024-10-01", type: "Building Regs",
      title: "Approved Document G — 2024 amendments",
      detail: "Approved Document G (hot water safety, incl. unvented G3) now reads as the 2015 edition with 2016 and 2024 amendments. G3 competence (HWSS) still required, re-assessed every 5 years.",
      status: { text: "In force", tone: "live" },
      url: "https://www.gov.uk/government/publications/sanitation-hot-water-safety-and-water-efficiency-approved-document-g",
      source: "GOV.UK",
    },
    {
      date: "2024-04-01", type: "Legal",
      title: "Scotland — New Build Heat Standard",
      detail: "Since 1 April 2024, direct-emission heating (gas, oil, LPG boilers) is not permitted in new buildings in Scotland. Scotland is ahead of England's Future Homes Standard. If you work in Scotland, new-build heating is already low-carbon.",
      status: { text: "In force (Scotland)", tone: "live" },
      url: "https://www.gov.scot/publications/new-build-heat-standard-factsheet/",
      source: "gov.scot",
    },
    {
      date: "2023-05-31", type: "Standard",
      title: "BS EN 50292:2023 — CO alarm siting",
      detail: "Current guidance for the selection, installation, use and maintenance of CO alarms is the 2023 edition (there was no 2019 edition). Alarms themselves conform to BS EN 50291-1:2018. Site roughly 1–3 m from the appliance.",
      status: { text: "In force", tone: "live" },
      url: "https://knowledge.bsigroup.com/products/electrical-apparatus-for-the-detection-of-carbon-monoxide-in-domestic-premises-guide-on-the-selection-installation-use-and-maintenance",
      source: "BSI",
    },
    {
      date: "2023-12-31", type: "Standard",
      title: "BS 5440-1:2023 & BS 5440-2:2023 (flues & ventilation)",
      detail: "Both parts revised (in force 31 Dec 2023). Flue terminals: windows/vents/pathways are now all 'openings into a building'; a flue must not pass through a fire compartment or other dwelling; new lightwell/courtyard guidance — read the current Section 5 tables, not old figures.",
      status: { text: "In force", tone: "live" },
      url: "https://knowledge.bsigroup.com/",
      source: "BSI / Gas Safe ISU 121-122",
    },
    {
      date: "2022-10-01", type: "Legal",
      title: "CO alarm now required for gas & oil appliance installs (England)",
      detail: "Approved Document J (2022 amendment) + the Smoke and Carbon Monoxide Alarm (Amendment) Regulations 2022: a CO alarm is required when you install a new or replacement fixed combustion appliance burning solid fuel, GAS (excluding gas cookers) or oil — not just solid fuel. Wales and Scotland rules are broader.",
      status: { text: "In force", tone: "live" },
      url: "https://www.gov.uk/government/publications/combustion-appliances-and-fuel-storage-systems-approved-document-j",
      source: "GOV.UK",
    },
    {
      date: "2026-04-07", type: "Legal",
      title: "RIDDOR reform — consultation (not yet law)",
      detail: "HSE opened a consultation on reforming RIDDOR (Apr–Jun 2026). Nothing has changed yet — keep reporting under RIDDOR 2013. We'll update this entry if/when reform becomes law.",
      status: { text: "Consultation only", tone: "info" },
      url: "https://www.hse.gov.uk/gas/supply/gas-riddor-gsmr.htm",
      source: "HSE",
    },
  ],
};
