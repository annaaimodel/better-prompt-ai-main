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
  lastReviewed: "2026-07-21",          // ← update each monthly review
  reviewCadence: "monthly",
  updates: [
    {
      date: "2026-07-21", type: "Policy",
      title: "Boiler Upgrade Scheme — £9,000 for off-grid oil/LPG → heat pump",
      detail: "From 21 July 2026, off-gas-grid homes on oil or LPG that switch to an air- or ground-source heat pump get £9,000 (up from £7,500). Time-limited to 31 Mar 2027. Mains-gas and electric-heated homes stay at £7,500. Ofgem-administered — useful when advising customers on their options.",
      status: { text: "Live since 21 Jul 2026", tone: "live" },
      url: "https://www.gov.uk/government/publications/warm-homes-plan/warm-homes-plan-html",
      source: "GOV.UK / DESNZ · Ofgem (BUS)",
    },
    {
      date: "2026-06-30", type: "Legal",
      title: "RIDDOR reform — consultation now CLOSED",
      detail: "HSE's consultation on reforming RIDDOR closed on 30 June 2026 and HSE is analysing responses — no outcome published yet. Nothing has changed: keep reporting under RIDDOR 2013. Any legislative change is not expected before 2027–2028. We'll update this when a response is issued.",
      status: { text: "Closed 30 Jun 2026 — no change yet", tone: "info" },
      url: "https://press.hse.gov.uk/2026/04/07/hse-launches-consultation-on-workplace-injury-and-illness-reporting/",
      source: "HSE",
    },
    {
      date: "2026-06-15", type: "Policy",
      title: "Hydrogen blending — still no final decision",
      detail: "No mandate is in effect. 'Up to 20%' hydrogen blending into the distribution grid remains a strategic intention only; the transmission-network proposal is around 2%, and a June 2026 POSTnote points at lower blends (~5%). Government aims to decide during 2026 — nothing enacted, and no appliance/analyser change is required yet. (For work on gas already containing up to 20% H₂, use an ECGA per Gas Safe TB 157.)",
      status: { text: "Decision expected 2026", tone: "upcoming" },
      url: "https://www.gov.uk/government/consultations/hydrogen-blending-into-the-gb-gas-transmission-network",
      source: "DESNZ / HSE",
    },
    {
      date: "2026-05-13", type: "Standard",
      title: "IGEM/G/5 Edition 3 — April 2026 amendment (gas in multi-occupancy buildings)",
      detail: "IGEM/G/5 Edition 3 gained an April 2026 amendment, covered by Gas Safe Industry Standard Update ISU 134 (issued 13 May 2026). It's the standard for gas in flats/apartments and other multi-occupancy premises — risers, protected shafts, meter siting and escape routes. Relevant whenever you work on gas in blocks of flats.",
      status: { text: "In force", tone: "live" },
      url: "https://www.igem.org.uk/resource/igem-g-5.html",
      source: "IGEM / Gas Safe ISU 134",
    },
    {
      date: "2026-05-01", type: "Policy",
      title: "Scotland — Heat in Buildings Bill paused",
      detail: "The compulsory gas-boiler end-date / replacement element of Scotland's Heat in Buildings Bill has been dropped and the Bill paused, with plans to reintroduce after the May 2026 Holyrood election. There is currently NO obligation to replace an existing gas boiler in Scotland. (Scotland's New Build Heat Standard, banning direct-emission heating in NEW buildings, is unaffected and remains in force.)",
      status: { text: "Bill paused", tone: "info" },
      url: "https://www.gov.scot/publications/heat-in-buildings-plans/",
      source: "gov.scot",
    },
    {
      date: "2026-01-21", type: "Policy",
      title: "Warm Homes Plan published",
      detail: "DESNZ published the Warm Homes Plan (21 Jan 2026): a ~£15bn package aiming to upgrade around 5 million homes by 2030. Boiler Upgrade Scheme continues at £7,500 (plus the new oil/LPG uplift above), a Warm Homes Local Grant (up to £15,000 for low-income households), a Warm Homes Fund of low/zero-interest loans, and ECO4 extended to Dec 2026. Context for the ongoing shift toward low-carbon heat.",
      status: { text: "Published Jan 2026", tone: "info" },
      url: "https://www.gov.uk/government/publications/warm-homes-plan/warm-homes-plan-html",
      source: "GOV.UK / DESNZ",
    },
    {
      date: "2025-07-01", type: "Standard",
      title: "Liquid Gas UK CoP 22:2025 (LPG piping systems)",
      detail: "For engineers with LPG scope: Liquid Gas UK Code of Practice 22 was revised to a 2025 edition (July 2025) — design, installation and testing of LPG piping systems, with enhanced design/leak-rate/testing guidance; supersedes the 2020 version. (Note: BS 5482-1 for LPG pipework at dwellings is withdrawn — use CoP 22:2025.)",
      status: { text: "In force", tone: "live" },
      url: "https://www.liquidgasuk.org/codes/cops",
      source: "Liquid Gas UK",
    },
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
      detail: "Published 24 Mar 2026 (SI 2026/335), in force 24 Mar 2027 (higher-risk buildings 24 Sep 2027). NEW homes built to it cannot comply with a gas, oil, LPG or hydrogen-ready boiler — a heat pump is the default, and a NEW requirement (Part L3) mandates on-site renewable electricity (typically solar PV). Approved Document L is retitled around energy use and greenhouse-gas emissions. EXISTING homes are unaffected: there is NO legal ban and no end-of-sale date for replacing a gas boiler (the old '2035 ban' was dropped).",
      status: { text: "In force 24 Mar 2027", tone: "upcoming" },
      url: "https://www.gov.uk/government/publications/the-future-homes-and-buildings-standards-building-circular-012026",
      source: "GOV.UK — Building Circular 01/2026",
    },
    {
      date: "2026-04-15", type: "Electrical",
      title: "BS 7671:2018+A4:2026 published (wiring regs) — old version out 15 Oct 2026",
      detail: "Amendment 4 was published 15 Apr 2026 and is now the current standard (it consolidates A3:2024). The previous A2:2022+A3:2024 stays valid until it is WITHDRAWN on 15 Oct 2026 — from then, certs/checks should reference A4. Still the 18th Edition — no 19th Edition or A5 announced. Relevant to the bonding and electrical-safety checks gas operatives carry out.",
      status: { text: "A2/A3 withdrawn 15 Oct 2026", tone: "upcoming" },
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
  ],
};
