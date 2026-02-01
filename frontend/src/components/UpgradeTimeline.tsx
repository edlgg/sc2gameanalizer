import { useMemo } from 'react';
import type { Snapshot } from '../types';

interface UpgradeTimelineProps {
  userSnapshots: Snapshot[];
  proSnapshotSets: Snapshot[][];
  proGameNames: { [key: string]: string };
  selectedProGameIds: number[];
  title?: string;
}

interface UpgradeMilestone {
  time: number;
  upgradeName: string;
  icon: string;
}

// Major upgrades to track by race (names match database format)
const IMPORTANT_UPGRADES: Record<string, string[]> = {
  Terran: [
    'Stimpack', 'ShieldWall', 'PunisherGrenades', // Combat Shield, Concussive Shells
    'TerranInfantryWeaponsLevel1', 'TerranInfantryWeaponsLevel2', 'TerranInfantryWeaponsLevel3',
    'TerranInfantryArmorsLevel1', 'TerranInfantryArmorsLevel2', 'TerranInfantryArmorsLevel3',
    'TerranVehicleWeaponsLevel1', 'TerranVehicleWeaponsLevel2', 'TerranVehicleWeaponsLevel3',
    'TerranVehicleAndShipArmorsLevel1', 'TerranVehicleAndShipArmorsLevel2', 'TerranVehicleAndShipArmorsLevel3',
    'PersonalCloaking', 'DrillClaws', 'SmartServos', 'HighCapacityBarrels'
  ],
  Protoss: [
    'WarpGateResearch', 'Charge', 'BlinkTech', 'ExtendedThermalLance', 'TempestGroundAttackUpgrade',
    'ProtossGroundWeaponsLevel1', 'ProtossGroundWeaponsLevel2', 'ProtossGroundWeaponsLevel3',
    'ProtossGroundArmorsLevel1', 'ProtossGroundArmorsLevel2', 'ProtossGroundArmorsLevel3',
    'ProtossShieldsLevel1', 'ProtossShieldsLevel2', 'ProtossShieldsLevel3',
    'ProtossAirWeaponsLevel1', 'ProtossAirWeaponsLevel2', 'ProtossAirWeaponsLevel3',
    'ProtossAirArmorsLevel1', 'ProtossAirArmorsLevel2', 'ProtossAirArmorsLevel3'
  ],
  Zerg: [
    'zerglingmovementspeed', 'zerglingattackspeed', // Metabolic Boost, Adrenal Glands
    'CentrificalHooks', 'GlialReconstitution', 'ChitinousPlating',
    'EvolveMuscularAugments', 'AnabolicSynthesis', 'overlordspeed',
    'ZergMeleeWeaponsLevel1', 'ZergMeleeWeaponsLevel2', 'ZergMeleeWeaponsLevel3',
    'ZergGroundArmorsLevel1', 'ZergGroundArmorsLevel2', 'ZergGroundArmorsLevel3',
    'ZergMissileWeaponsLevel1', 'ZergMissileWeaponsLevel2', 'ZergMissileWeaponsLevel3',
    'ZergFlyerWeaponsLevel1', 'ZergFlyerWeaponsLevel2', 'ZergFlyerWeaponsLevel3',
    'ZergFlyerArmorsLevel1', 'ZergFlyerArmorsLevel2', 'ZergFlyerArmorsLevel3'
  ]
};

// Friendly names for upgrades (keys match database format)
const UPGRADE_DISPLAY_NAMES: Record<string, string> = {
  // Terran
  'Stimpack': 'Stim',
  'ShieldWall': 'Combat Shield',
  'PunisherGrenades': 'Concussive Shells',
  'TerranInfantryWeaponsLevel1': 'Infantry +1 Atk',
  'TerranInfantryWeaponsLevel2': 'Infantry +2 Atk',
  'TerranInfantryWeaponsLevel3': 'Infantry +3 Atk',
  'TerranInfantryArmorsLevel1': 'Infantry +1 Armor',
  'TerranInfantryArmorsLevel2': 'Infantry +2 Armor',
  'TerranInfantryArmorsLevel3': 'Infantry +3 Armor',
  'TerranVehicleWeaponsLevel1': 'Vehicle +1 Atk',
  'TerranVehicleWeaponsLevel2': 'Vehicle +2 Atk',
  'TerranVehicleWeaponsLevel3': 'Vehicle +3 Atk',
  'TerranVehicleAndShipArmorsLevel1': 'Mech +1 Armor',
  'TerranVehicleAndShipArmorsLevel2': 'Mech +2 Armor',
  'TerranVehicleAndShipArmorsLevel3': 'Mech +3 Armor',
  'PersonalCloaking': 'Cloak',
  'DrillClaws': 'Drill Claws',
  'SmartServos': 'Smart Servos',
  'HighCapacityBarrels': 'High Capacity',

  // Protoss
  'WarpGateResearch': 'Warp Gate',
  'Charge': 'Charge',
  'BlinkTech': 'Blink',
  'ExtendedThermalLance': 'Thermal Lance',
  'TempestGroundAttackUpgrade': 'Tempest Ground',
  'ProtossGroundWeaponsLevel1': 'Ground +1 Atk',
  'ProtossGroundWeaponsLevel2': 'Ground +2 Atk',
  'ProtossGroundWeaponsLevel3': 'Ground +3 Atk',
  'ProtossGroundArmorsLevel1': 'Ground +1 Armor',
  'ProtossGroundArmorsLevel2': 'Ground +2 Armor',
  'ProtossGroundArmorsLevel3': 'Ground +3 Armor',
  'ProtossShieldsLevel1': 'Shields +1',
  'ProtossShieldsLevel2': 'Shields +2',
  'ProtossShieldsLevel3': 'Shields +3',
  'ProtossAirWeaponsLevel1': 'Air +1 Atk',
  'ProtossAirWeaponsLevel2': 'Air +2 Atk',
  'ProtossAirWeaponsLevel3': 'Air +3 Atk',
  'ProtossAirArmorsLevel1': 'Air +1 Armor',
  'ProtossAirArmorsLevel2': 'Air +2 Armor',
  'ProtossAirArmorsLevel3': 'Air +3 Armor',

  // Zerg
  'zerglingmovementspeed': 'Zergling Speed',
  'zerglingattackspeed': 'Adrenal Glands',
  'CentrificalHooks': 'Centrifugal Hooks',
  'GlialReconstitution': 'Roach Speed',
  'ChitinousPlating': 'Ultralisk Armor',
  'EvolveMuscularAugments': 'Hydra Speed',
  'AnabolicSynthesis': 'Ultralisk Speed',
  'overlordspeed': 'Overlord Speed',
  'ZergMeleeWeaponsLevel1': 'Melee +1 Atk',
  'ZergMeleeWeaponsLevel2': 'Melee +2 Atk',
  'ZergMeleeWeaponsLevel3': 'Melee +3 Atk',
  'ZergGroundArmorsLevel1': 'Ground +1 Armor',
  'ZergGroundArmorsLevel2': 'Ground +2 Armor',
  'ZergGroundArmorsLevel3': 'Ground +3 Armor',
  'ZergMissileWeaponsLevel1': 'Ranged +1 Atk',
  'ZergMissileWeaponsLevel2': 'Ranged +2 Atk',
  'ZergMissileWeaponsLevel3': 'Ranged +3 Atk',
  'ZergFlyerWeaponsLevel1': 'Flyer +1 Atk',
  'ZergFlyerWeaponsLevel2': 'Flyer +2 Atk',
  'ZergFlyerWeaponsLevel3': 'Flyer +3 Atk',
  'ZergFlyerArmorsLevel1': 'Flyer +1 Armor',
  'ZergFlyerArmorsLevel2': 'Flyer +2 Armor',
  'ZergFlyerArmorsLevel3': 'Flyer +3 Armor',
};

export default function UpgradeTimeline({
  userSnapshots,
  proSnapshotSets,
  proGameNames,
  selectedProGameIds,
  title = '⬆️ Upgrade Completion Timeline',
}: UpgradeTimelineProps) {

  // Extract upgrade milestones from snapshots
  const extractUpgradeMilestones = (snapshots: Snapshot[]): UpgradeMilestone[] => {
    const milestones: UpgradeMilestone[] = [];
    const seenUpgrades = new Set<string>();

    // Get race from first snapshot
    const race = snapshots[0]?.race || 'Protoss';
    const importantUpgrades = IMPORTANT_UPGRADES[race] || [];

    snapshots.forEach(snap => {
      const upgrades = typeof snap.upgrades === 'string'
        ? JSON.parse(snap.upgrades)
        : snap.upgrades || {};

      Object.keys(upgrades).forEach(upgradeName => {
        // Check if this is an important upgrade and we haven't seen it yet
        if (!seenUpgrades.has(upgradeName) && importantUpgrades.some(u => upgradeName.includes(u))) {
          seenUpgrades.add(upgradeName);
          milestones.push({
            time: snap.game_time_seconds,
            upgradeName,
            icon: '⬆️',
          });
        }
      });
    });

    return milestones.sort((a, b) => a.time - b.time);
  };

  // Extract milestones for user and all pro games
  const userMilestones = useMemo(() => {
    return extractUpgradeMilestones(userSnapshots);
  }, [userSnapshots]);

  const proMilestonesList = useMemo(() => {
    return proSnapshotSets.map((snapshots, index) => ({
      gameId: selectedProGameIds[index],
      name: proGameNames[`pro${selectedProGameIds[index]}`] || `Pro ${index + 1}`,
      milestones: extractUpgradeMilestones(snapshots),
    }));
  }, [proSnapshotSets, selectedProGameIds, proGameNames]);

  // Calculate timeline bounds
  const timelineBounds = useMemo(() => {
    const allTimes: number[] = [];

    userMilestones.forEach(m => allTimes.push(m.time));
    proMilestonesList.forEach(pro => {
      pro.milestones.forEach(m => allTimes.push(m.time));
    });

    if (allTimes.length === 0) {
      return { minTime: 0, maxTime: 900, duration: 900 };
    }

    const minTime = 0;
    const maxTime = Math.max(...allTimes);
    const duration = maxTime - minTime;

    return { minTime, maxTime, duration };
  }, [userMilestones, proMilestonesList]);

  // Format time for display
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds) % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // Calculate position on timeline (percentage)
  const getTimelinePosition = (time: number) => {
    const { minTime, duration } = timelineBounds;
    if (duration === 0) return 0;
    return ((time - minTime) / duration) * 100;
  };

  // Generate time markers (every minute)
  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    const { maxTime } = timelineBounds;

    for (let t = 0; t <= maxTime; t += 60) {
      markers.push(t);
    }

    if (markers[markers.length - 1] !== maxTime) {
      markers.push(maxTime);
    }

    return markers;
  }, [timelineBounds]);

  // Get friendly upgrade name
  const getUpgradeName = (rawName: string): string => {
    // Try exact match first
    if (UPGRADE_DISPLAY_NAMES[rawName]) {
      return UPGRADE_DISPLAY_NAMES[rawName];
    }

    // Try partial match
    for (const [key, value] of Object.entries(UPGRADE_DISPLAY_NAMES)) {
      if (rawName.includes(key)) {
        return value;
      }
    }

    // Fallback: clean up the raw name
    return rawName
      .replace(/([A-Z])/g, ' $1') // Add spaces before capital letters
      .replace(/Research|Upgrade/gi, '') // Remove common suffixes
      .trim();
  };

  if (userMilestones.length === 0 && proMilestonesList.every(p => p.milestones.length === 0)) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <p className="text-slate-400 text-center py-8">No upgrade data available for this matchup</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-slate-400 mb-6">
        Visual timeline showing when each player completed key upgrades
      </p>

      <div className="relative">
        {/* Time markers at top */}
        <div className="relative h-8 mb-4 border-b border-slate-700">
          {timeMarkers.map((time) => (
            <div
              key={time}
              className="absolute top-0 h-full flex flex-col items-center"
              style={{ left: `${getTimelinePosition(time)}%` }}
            >
              <div className="text-xs text-slate-500 mb-1">{formatTime(time)}</div>
              <div className="w-px h-2 bg-slate-600"></div>
            </div>
          ))}
        </div>

        {/* User row */}
        <div className="mb-8">
          <div className="flex items-center mb-3">
            <div className="w-32 text-sm font-semibold text-sc2-blue">You</div>
            <div className="flex-1 relative h-12 bg-slate-800/30 rounded">
              {/* Timeline base line */}
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-700"></div>

              {/* Upgrade markers */}
              {userMilestones.map((milestone, index) => (
                <div
                  key={`user-${index}`}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
                  style={{ left: `${getTimelinePosition(milestone.time)}%` }}
                >
                  {/* Marker dot */}
                  <div className="w-3 h-3 bg-sc2-blue rounded-full border-2 border-slate-900 relative z-10"></div>

                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                    <div className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs shadow-lg">
                      <div className="flex items-center gap-1">
                        <span>{milestone.icon}</span>
                        <span className="text-slate-300">{getUpgradeName(milestone.upgradeName)}</span>
                      </div>
                      <div className="text-slate-500 text-center">@ {formatTime(milestone.time)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User upgrade list */}
          <div className="ml-32 flex flex-wrap gap-2">
            {userMilestones.map((milestone, index) => (
              <div
                key={`user-badge-${index}`}
                className="text-xs bg-sc2-blue/10 border border-sc2-blue/30 text-slate-300 px-2 py-1 rounded flex items-center gap-1"
              >
                <span>{milestone.icon}</span>
                <span className="font-medium">{getUpgradeName(milestone.upgradeName)}</span>
                <span className="text-slate-500">@ {formatTime(milestone.time)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pro game rows */}
        {proMilestonesList.map((proGame) => (
          <div key={proGame.gameId} className="mb-8">
            <div className="flex items-center mb-3">
              <div className="w-32 text-sm font-semibold text-sc2-gold truncate">{proGame.name}</div>
              <div className="flex-1 relative h-12 bg-slate-800/30 rounded">
                {/* Timeline base line */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-700"></div>

                {/* Upgrade markers */}
                {proGame.milestones.map((milestone, index) => (
                  <div
                    key={`pro-${proGame.gameId}-${index}`}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
                    style={{ left: `${getTimelinePosition(milestone.time)}%` }}
                  >
                    {/* Marker dot */}
                    <div className="w-3 h-3 bg-sc2-gold rounded-full border-2 border-slate-900 relative z-10"></div>

                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                      <div className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs shadow-lg">
                        <div className="flex items-center gap-1">
                          <span>{milestone.icon}</span>
                          <span className="text-slate-300">{getUpgradeName(milestone.upgradeName)}</span>
                        </div>
                        <div className="text-slate-500 text-center">@ {formatTime(milestone.time)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pro upgrade list */}
            <div className="ml-32 flex flex-wrap gap-2">
              {proGame.milestones.map((milestone, index) => (
                <div
                  key={`pro-badge-${proGame.gameId}-${index}`}
                  className="text-xs bg-sc2-gold/10 border border-sc2-gold/30 text-slate-300 px-2 py-1 rounded flex items-center gap-1"
                >
                  <span>{milestone.icon}</span>
                  <span className="font-medium">{getUpgradeName(milestone.upgradeName)}</span>
                  <span className="text-slate-500">@ {formatTime(milestone.time)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-slate-800">
        <p className="text-xs text-slate-500">
          <span className="text-slate-300 font-semibold">Note:</span> Timeline shows completion times for major combat and economic upgrades. Hover over dots for details.
        </p>
      </div>
    </div>
  );
}
