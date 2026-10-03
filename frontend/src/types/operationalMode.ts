export type OperationalMode = 'DISASTER_RESPONSE' | 'MILITARY_LOGISTICS';

export interface ModeContextConfig {
  mode: OperationalMode;
  modeName: string;
  shortName: string;
  icon: string;
  themeColor: string;
  borderTheme: string;
  bgTheme: string;
  tagline: string;
  targetEntitiesTitle: string;
  targetEntitiesList: string[];
  supplyCategoriesTitle: string;
  supplyCategoriesList: string[];
  vehicleLabel: string;
  depotLabel: string;
  demandPointLabel: string;
  missionObjective: string;
  entityNameMap: Record<string, string>;
  supplyNameMap: Record<string, string>;
}

export const OPERATIONAL_MODES: Record<OperationalMode, ModeContextConfig> = {
  DISASTER_RESPONSE: {
    mode: 'DISASTER_RESPONSE',
    modeName: 'Disaster Response & Humanitarian Relief',
    shortName: 'DISASTER RESPONSE',
    icon: '🚨',
    themeColor: 'cyan',
    borderTheme: 'border-cyan-500/40',
    bgTheme: 'bg-cyan-950/20 text-cyan-300',
    tagline: 'Life-saving supply distribution to hospitals, relief camps, evacuation shelters, and disaster zones.',
    targetEntitiesTitle: 'Critical Humanitarian Relief Destinations',
    targetEntitiesList: [
      'Hospitals & Field Clinics',
      'Displaced Persons Relief Camps',
      'Evacuation & Community Shelters',
      'Search & Rescue Staging Sites',
    ],
    supplyCategoriesTitle: 'Emergency Humanitarian Relief Supplies',
    supplyCategoriesList: [
      'Medical Supplies & Trauma Kits',
      'Food & Rations Packs',
      'Potable Water & Water Purification',
      'Emergency Generator Fuel',
      'Emergency Rescue & Debris Equipment',
    ],
    vehicleLabel: 'Relief Convoys & Medical Transports',
    depotLabel: 'Central Aid Depots & Staging Grounds',
    demandPointLabel: 'Hospitals, Relief Camps & Shelters',
    missionObjective: 'Rapid Life-Saving Supply Distribution & Casualty Triage Support',
    entityNameMap: {
      'DEMAND-01': 'District Hospital H01 (Trauma Center)',
      'DEMAND-02': 'Flood Relief Camp C03 (Displaced Persons)',
      'DEMAND-03': 'Community Shelter S02 (Evacuation Hub)',
      'DEMAND-04': 'Emergency Clinic H04 (Triage Station)',
      'DEMAND-05': 'Refugee Transit Camp C07',
      'DEMAND-06': 'Regional Hospital H06 (Intensive Care)',
      'DEPOT-ALPHA': 'Central Humanitarian Aid Depot Alpha',
      'DEPOT-BRAVO': 'Logistics Aid Staging Depot Bravo',
      'DEPOT-CHARLIE': 'Emergency Stockpile Depot Charlie',
    },
    supplyNameMap: {
      medicine: 'Medical Supplies & Trauma Kits',
      water: 'Potable Water & Purification',
      food: 'Emergency Rations & Nutrition',
      fuel: 'Generator & Evacuation Fuel',
      equipment: 'Emergency Rescue & Search Gear',
    },
  },

  MILITARY_LOGISTICS: {
    mode: 'MILITARY_LOGISTICS',
    modeName: 'Military Logistics & Theater Sustainment',
    shortName: 'MILITARY LOGISTICS SUPPORT',
    icon: '🪖',
    themeColor: 'emerald',
    borderTheme: 'border-emerald-500/40',
    bgTheme: 'bg-emerald-950/20 text-emerald-300',
    tagline: 'Theater sustainment, convoy routing, and supply distribution for forward operating bases and vehicle fleets.',
    targetEntitiesTitle: 'Forward Operating Nodes & Sustainment Points',
    targetEntitiesList: [
      'Forward Operating Bases (FOB)',
      'Tactical Outposts & Security Positions',
      'Theater Logistics Transfer Hubs',
      'Convoy Refueling & Staging Points',
    ],
    supplyCategoriesTitle: 'General Theater Sustainment Classes',
    supplyCategoriesList: [
      'Fuel (Bulk JP-8 / Diesel)',
      'Food (Field Rations / MRE)',
      'Water (Bulk Potable Supplies)',
      'Medical (Field Trauma & Aid Packs)',
      'Equipment (Maintenance Spares & Tools)',
      'Vehicle Logistics (Fleet Maintenance & Parts)',
    ],
    vehicleLabel: 'Tactical Transport Fleet & Heavy Haulers',
    depotLabel: 'Theater Supply Depots & Main Logistics Bases',
    demandPointLabel: 'Forward Operating Bases & Logistics Nodes',
    missionObjective: 'Convoy Optimization, Fleet Readiness & Operational Sustainment',
    entityNameMap: {
      'DEMAND-01': 'Forward Operating Base Alpha (FOB-A)',
      'DEMAND-02': 'Tactical Logistics Outpost Bravo (OP-B)',
      'DEMAND-03': 'Theater Support Node Charlie (TSN-C)',
      'DEMAND-04': 'Advanced Staging Outpost Delta (OP-D)',
      'DEMAND-05': 'Forward Logistics Hub Echo (FLH-E)',
      'DEMAND-06': 'Strategic Defense Node Zulu (SDN-Z)',
      'DEPOT-ALPHA': 'Theater Supply Depot Alpha (Main Hub)',
      'DEPOT-BRAVO': 'Regional Logistics Depot Bravo',
      'DEPOT-CHARLIE': 'Forward Reserve Depot Charlie',
    },
    supplyNameMap: {
      medicine: 'Field Medical & Trauma Packs',
      water: 'Bulk Potable Water',
      food: 'Field Rations (MRE Packs)',
      fuel: 'Bulk Fuel (JP-8 / Diesel)',
      equipment: 'Maintenance Spares & Equipment',
    },
  },
};
