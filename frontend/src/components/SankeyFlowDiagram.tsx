import { ResponsiveSankey } from '@nivo/sankey';
import { formatResourceValue } from '../utils/combatAnalysis';
import type { ResourceFlowData } from '../utils/combatAnalysis';

interface SankeyFlowDiagramProps {
  data: ResourceFlowData;
  title: string;
  subtitle?: string;
  height?: number;
}

export default function SankeyFlowDiagram({
  data,
  title,
  subtitle,
  height = 400,
}: SankeyFlowDiagramProps) {
  // Transform data for @nivo/sankey format
  const sankeyData = {
    nodes: data.nodes.map(node => ({
      id: node.id,
      nodeColor: getNodeColor(node.id),
    })),
    links: data.links
      .filter(link => link.value > 0) // Only show links with value
      .map(link => ({
        source: link.source,
        target: link.target,
        value: link.value,
      })),
  };

  return (
    <div className="card">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>

      <div style={{ height: `${height}px` }}>
        <ResponsiveSankey
          data={sankeyData}
          margin={{ top: 20, right: 160, bottom: 20, left: 160 }}
          align="justify"
          colors={(node: any) => node.nodeColor || '#64748b'}
          nodeOpacity={1}
          nodeHoverOthersOpacity={0.35}
          nodeThickness={18}
          nodeSpacing={24}
          nodeBorderWidth={0}
          nodeBorderRadius={3}
          linkOpacity={0.5}
          linkHoverOthersOpacity={0.1}
          linkContract={3}
          enableLinkGradient={true}
          label={(node: any) => {
            const nodeData = data.nodes.find(n => n.id === node.id);
            return `${nodeData?.label || node.id}: ${formatResourceValue(nodeData?.value || 0)}`;
          }}
          labelPosition="outside"
          labelOrientation="horizontal"
          labelPadding={16}
          labelTextColor={{
            from: 'color',
            modifiers: [['brighter', 1.8]],
          }}
          theme={{
            background: 'transparent',
            text: {
              fill: '#cbd5e1',
              fontSize: 12,
            },
            tooltip: {
              container: {
                background: '#1e293b',
                color: '#f1f5f9',
                fontSize: 12,
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
                border: '1px solid #334155',
              },
            },
          }}
        />
      </div>

      {/* Metrics Summary */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Show Trade Efficiency if available, otherwise Army Loss Rate */}
        {data.metrics.tradeEfficiency > 0 ? (
          <MetricCard
            label="Trade Efficiency"
            value={
              data.metrics.tradeEfficiency > 100
                ? '∞'
                : data.metrics.tradeEfficiency.toFixed(2)
            }
            description={getEfficiencyDescription(data.metrics.tradeEfficiency)}
            color={getEfficiencyColor(data.metrics.tradeEfficiency)}
          />
        ) : (
          <MetricCard
            label="Army Loss Rate"
            value={`${data.metrics.armyLossRate.toFixed(1)}%`}
            description={getLossRateDescription(data.metrics.armyLossRate)}
            color={getLossRateColor(data.metrics.armyLossRate)}
          />
        )}
        <MetricCard
          label="Army Spending"
          value={`${data.metrics.resourcesIntoArmy.toFixed(1)}%`}
          description="of total resources"
          color="text-slate-300"
        />
        <MetricCard
          label="Economy Spending"
          value={`${data.metrics.resourcesIntoEconomy.toFixed(1)}%`}
          description="of total resources"
          color="text-slate-300"
        />
        <MetricCard
          label="Army Survival"
          value={`${data.metrics.armySurvivalRate.toFixed(1)}%`}
          description="of army survived"
          color={data.metrics.armySurvivalRate > 50 ? 'text-green-400' : 'text-red-400'}
        />
      </div>
    </div>
  );
}

// Helper components and functions

interface MetricCardProps {
  label: string;
  value: string;
  description: string;
  color: string;
}

function MetricCard({ label, value, description, color }: MetricCardProps) {
  return (
    <div className="stat-card">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{description}</div>
    </div>
  );
}

function getNodeColor(nodeId: string): string {
  const colorMap: { [key: string]: string } = {
    collected: '#64748b', // slate
    economy: '#22c55e', // green
    army: '#00a8ff', // sc2-blue
    tech: '#a855f7', // purple
    lost: '#ef4444', // red
    killed: '#ffd700', // gold
    survived: '#10b981', // emerald
  };
  return colorMap[nodeId] || '#64748b';
}

function getEfficiencyDescription(efficiency: number): string {
  if (efficiency >= 1.5) return 'Excellent trades';
  if (efficiency >= 1.0) return 'Favorable trades';
  if (efficiency >= 0.7) return 'Even trades';
  if (efficiency >= 0.5) return 'Poor trades';
  return 'Very inefficient';
}

function getEfficiencyColor(efficiency: number): string {
  if (efficiency >= 1.5) return 'text-green-400';
  if (efficiency >= 1.0) return 'text-emerald-400';
  if (efficiency >= 0.7) return 'text-yellow-400';
  if (efficiency >= 0.5) return 'text-orange-400';
  return 'text-red-400';
}

function getLossRateDescription(lossRate: number): string {
  if (lossRate <= 20) return 'Army preserved';
  if (lossRate <= 40) return 'Light losses';
  if (lossRate <= 60) return 'Moderate losses';
  if (lossRate <= 80) return 'Heavy losses';
  return 'Army decimated';
}

function getLossRateColor(lossRate: number): string {
  if (lossRate <= 20) return 'text-green-400';
  if (lossRate <= 40) return 'text-emerald-400';
  if (lossRate <= 60) return 'text-yellow-400';
  if (lossRate <= 80) return 'text-orange-400';
  return 'text-red-400';
}
