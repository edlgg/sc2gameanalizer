import { useMemo } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { Snapshot } from '../types';
import { formatTime } from '../utils/formatters';

interface CumulativeSpendingChartsProps {
  userSnapshots: Snapshot[];
  proSnapshotSets: Snapshot[][];
}

// Unit costs (minerals + gas)
const UNIT_COSTS: Record<string, number> = {
  // Terran
  SCV: 50, Marine: 50, Marauder: 125, Reaper: 75, Ghost: 225,
  Hellion: 100, Hellbat: 100, WidowMine: 100, SiegeTank: 200, Thor: 400,
  Viking: 200, Medivac: 200, Liberator: 200, Raven: 200, Banshee: 200, Battlecruiser: 550,

  // Protoss
  Probe: 50, Zealot: 100, Stalker: 175, Sentry: 100, Adept: 125, HighTemplar: 200,
  DarkTemplar: 175, Immortal: 325, Colossus: 400, Disruptor: 200, Archon: 175,
  Phoenix: 200, VoidRay: 325, Oracle: 200, Tempest: 400, Carrier: 500, Mothership: 600,
  Observer: 75, WarpPrism: 250,

  // Zerg
  Drone: 50, Zergling: 25, Baneling: 75, Roach: 100, Ravager: 150, Hydralisk: 125,
  Lurker: 250, Infestor: 150, SwarmHost: 150, Ultralisk: 375,
  Mutalisk: 125, Corruptor: 175, BroodLord: 275, Viper: 200,
  Overlord: 100, Overseer: 150, Queen: 150,
};

// Building costs
const BUILDING_COSTS: Record<string, number> = {
  // Terran
  CommandCenter: 400, OrbitalCommand: 150, PlanetaryFortress: 150,
  SupplyDepot: 100, Refinery: 75, Barracks: 150, Factory: 200, Starport: 150,
  EngineeringBay: 125, Armory: 150, GhostAcademy: 150, FusionCore: 150,
  Bunker: 100, MissileTurret: 100, SensorTower: 125,

  // Protoss
  Nexus: 400, Pylon: 100, Assimilator: 75, Gateway: 150, CyberneticsCore: 150,
  RoboticsFacility: 200, Stargate: 150, TwilightCouncil: 150, TemplarArchive: 150,
  DarkShrine: 150, RoboticsBay: 200, FleetBeacon: 300, Forge: 150,
  PhotonCannon: 150, ShieldBattery: 100,

  // Zerg
  Hatchery: 300, Lair: 150, Hive: 200, Extractor: 25, SpawningPool: 200,
  RoachWarren: 150, BanelingNest: 100, EvolutionChamber: 75, HydraliskDen: 100,
  LurkerDen: 150, InfestationPit: 100, Spire: 200, GreaterSpire: 150,
  UltraliskCavern: 150, NydusNetwork: 150, NydusCanal: 75,
  SpineCrawler: 100, SporeCrawler: 75,
};

// Upgrade costs (approximate average)
const UPGRADE_BASE_COST = 150; // Most upgrades are 100-200 resources

export default function CumulativeSpendingCharts({
  userSnapshots,
  proSnapshotSets,
}: CumulativeSpendingChartsProps) {

  // Calculate cumulative spending by category for a snapshot set
  const calculateCumulativeSpending = (snapshots: Snapshot[]) => {
    return snapshots.map((snap) => {
      // Parse JSON fields
      const units = typeof snap.units === 'string' ? JSON.parse(snap.units) : snap.units || {};
      const buildings = typeof snap.buildings === 'string' ? JSON.parse(snap.buildings) : snap.buildings || {};
      const upgrades = typeof snap.upgrades === 'string' ? JSON.parse(snap.upgrades) : snap.upgrades || {};

      // Calculate economy spending (workers + expansions)
      let economySpending = 0;
      const workerTypes = ['SCV', 'Probe', 'Drone'];
      workerTypes.forEach(worker => {
        if (units[worker]) {
          economySpending += (units[worker] || 0) * (UNIT_COSTS[worker] || 50);
        }
      });

      // Add expansion costs (bases beyond the starting one)
      const baseTypes = ['CommandCenter', 'OrbitalCommand', 'Nexus', 'Hatchery', 'Lair', 'Hive'];
      baseTypes.forEach(base => {
        if (buildings[base]) {
          const count = buildings[base] || 0;
          // Subtract 1 for starting base
          const builtBases = Math.max(0, count - (base === 'CommandCenter' || base === 'Nexus' || base === 'Hatchery' ? 1 : 0));
          economySpending += builtBases * (BUILDING_COSTS[base] || 400);
        }
      });

      // Calculate army spending (current army + units lost)
      const currentArmy = snap.army_value_minerals + snap.army_value_gas;
      const unitsLost = snap.units_lost_value || 0;
      const armySpending = currentArmy + unitsLost;

      // Calculate tech spending (buildings + upgrades)
      let techSpending = 0;

      // Add non-economy buildings
      Object.entries(buildings).forEach(([buildingName, count]) => {
        const buildingCount = count as number;
        if (!baseTypes.includes(buildingName) && buildingCount > 0) {
          techSpending += buildingCount * (BUILDING_COSTS[buildingName] || 150);
        }
      });

      // Add upgrades
      const upgradeCount = Object.keys(upgrades).length;
      techSpending += upgradeCount * UPGRADE_BASE_COST;

      // Total spending
      const totalSpending = economySpending + armySpending + techSpending;

      return {
        time: snap.game_time_seconds,
        timeFormatted: formatTime(snap.game_time_seconds),
        total: totalSpending,
        economy: economySpending,
        army: armySpending,
        tech: techSpending,
      };
    });
  };

  // Process all data
  const chartData = useMemo(() => {
    const userSpending = calculateCumulativeSpending(userSnapshots);

    // Get user's game length (last timestamp)
    const userGameLength = userSnapshots.length > 0
      ? userSnapshots[userSnapshots.length - 1].game_time_seconds
      : 0;

    // Calculate pro averages and ranges
    const proSpendingSets = proSnapshotSets.map(snapshots => calculateCumulativeSpending(snapshots));

    // Merge data by timestamp
    const timeMap = new Map<number, any>();

    userSpending.forEach(point => {
      timeMap.set(point.time, {
        time: point.time,
        timeFormatted: point.timeFormatted,
        userTotal: point.total,
        userEconomy: point.economy,
        userArmy: point.army,
        userTech: point.tech,
        proTotalValues: [],
        proEconomyValues: [],
        proArmyValues: [],
        proTechValues: [],
      });
    });

    // Add pro data - ONLY up to user's game length
    proSpendingSets.forEach(proSpending => {
      proSpending.forEach(point => {
        // Skip pro data beyond user's game length
        if (point.time > userGameLength) {
          return;
        }

        const existing = timeMap.get(point.time);
        if (existing) {
          existing.proTotalValues.push(point.total);
          existing.proEconomyValues.push(point.economy);
          existing.proArmyValues.push(point.army);
          existing.proTechValues.push(point.tech);
        } else {
          // Only create new entries within user's game length
          timeMap.set(point.time, {
            time: point.time,
            timeFormatted: point.timeFormatted,
            userTotal: 0,
            userEconomy: 0,
            userArmy: 0,
            userTech: 0,
            proTotalValues: [point.total],
            proEconomyValues: [point.economy],
            proArmyValues: [point.army],
            proTechValues: [point.tech],
          });
        }
      });
    });

    // Calculate averages and ranges
    const result = Array.from(timeMap.values()).map(point => {
      const calcStats = (values: number[]) => {
        if (values.length === 0) return { avg: 0, min: 0, max: 0 };
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        return { avg, min, max };
      };

      const totalStats = calcStats(point.proTotalValues);
      const economyStats = calcStats(point.proEconomyValues);
      const armyStats = calcStats(point.proArmyValues);
      const techStats = calcStats(point.proTechValues);

      return {
        time: point.time,
        timeFormatted: point.timeFormatted,
        userTotal: point.userTotal,
        userEconomy: point.userEconomy,
        userArmy: point.userArmy,
        userTech: point.userTech,
        proTotalAvg: totalStats.avg,
        proTotalMin: totalStats.min,
        proTotalMax: totalStats.max,
        proEconomyAvg: economyStats.avg,
        proEconomyMin: economyStats.min,
        proEconomyMax: economyStats.max,
        proArmyAvg: armyStats.avg,
        proArmyMin: armyStats.min,
        proArmyMax: armyStats.max,
        proTechAvg: techStats.avg,
        proTechMin: techStats.min,
        proTechMax: techStats.max,
      };
    });

    return result.sort((a, b) => a.time - b.time);
  }, [userSnapshots, proSnapshotSets]);

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toFixed(0);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded shadow-lg">
        <p className="text-slate-300 font-semibold mb-2">{payload[0].payload.timeFormatted}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  const renderChart = (title: string, userKey: string, proAvgKey: string, proMinKey: string, proMaxKey: string) => (
    <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
      <h4 className="text-sm font-semibold text-slate-300 mb-3">{title}</h4>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`gradient-${userKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id={`gradient-pro-${userKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#eab308" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="timeFormatted"
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickFormatter={formatCurrency}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Pro range band */}
          <Area
            type="monotone"
            dataKey={proMaxKey}
            stroke="none"
            fill={`url(#gradient-pro-${userKey})`}
            fillOpacity={0.3}
          />
          <Area
            type="monotone"
            dataKey={proMinKey}
            stroke="none"
            fill="#1e293b"
            fillOpacity={1}
          />

          {/* Pro average line */}
          <Line
            type="monotone"
            dataKey={proAvgKey}
            stroke="#eab308"
            strokeWidth={2}
            dot={false}
            name="Pro Avg"
          />

          {/* User line */}
          <Line
            type="monotone"
            dataKey={userKey}
            stroke="#0ea5e9"
            strokeWidth={3}
            dot={false}
            name="You"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-sc2-gold" />
        <h3 className="text-lg font-semibold">💰 Cumulative Spending Analysis</h3>
      </div>

      <p className="text-sm text-slate-400 mb-6">
        Track your resource allocation over time compared to {proSnapshotSets.length} pro {proSnapshotSets.length === 1 ? 'game' : 'games'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderChart('Total Spending', 'userTotal', 'proTotalAvg', 'proTotalMin', 'proTotalMax')}
        {renderChart('Economy Investment', 'userEconomy', 'proEconomyAvg', 'proEconomyMin', 'proEconomyMax')}
        {renderChart('Army Production', 'userArmy', 'proArmyAvg', 'proArmyMin', 'proArmyMax')}
        {renderChart('Tech Investment', 'userTech', 'proTechAvg', 'proTechMin', 'proTechMax')}
      </div>

      <div className="mt-4 text-xs text-slate-500 flex gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-sc2-blue"></div>
          <span>Your Spending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-sc2-gold"></div>
          <span>Pro Average</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-2 bg-gradient-to-b from-yellow-500/20 to-transparent"></div>
          <span>Pro Range</span>
        </div>
      </div>
    </div>
  );
}
