// AgentStatusPanel - Agent status indicators for 3D HUD
// Shows status of Logic, Security, and Quality agents

interface AgentStatusPanelProps {
  hasProcessing?: boolean
}

export function AgentStatusPanel({ hasProcessing = false }: AgentStatusPanelProps) {
  return (
    <div className="space-y-2">
      <AgentRow name="LOGIC" color="#00f0ff" isActive={hasProcessing} />
      <AgentRow name="SECURITY" color="#ff00aa" isActive={hasProcessing} />
      <AgentRow name="QUALITY" color="#00ff88" isActive={false} />
    </div>
  )
}

function AgentRow({ name, color, isActive }: { name: string; color: string; isActive: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-2 h-2 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: isActive ? `0 0 8px ${color}` : 'none',
          animation: isActive ? 'pulse 1s infinite' : 'none',
        }}
      />
      <span className="text-[10px] text-gray-400 uppercase tracking-wider flex-1">
        {name}
      </span>
      <span
        className="text-[8px] uppercase"
        style={{ color: isActive ? color : '#666' }}
      >
        {isActive ? 'ACTIVE' : 'IDLE'}
      </span>
    </div>
  )
}
