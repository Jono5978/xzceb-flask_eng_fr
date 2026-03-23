import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'

const TaskNode = memo(function TaskNode({ data, selected }) {
  return (
    <div
      className={`bg-white rounded-lg border-2 shadow-sm w-44 transition-colors select-none ${
        selected
          ? 'border-blue-500 shadow-blue-100 shadow-md'
          : 'border-gray-300 hover:border-gray-400'
      }`}
    >
      {/* Incoming connection handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ width: 10, height: 10, background: '#94a3b8', border: '2px solid white' }}
      />

      <div className="px-3 py-2.5">
        <p className="font-semibold text-sm text-gray-800 truncate leading-tight">
          {data.name || <span className="text-gray-400 font-normal italic text-xs">Unnamed task</span>}
        </p>
        {data.duration ? (
          <p className="text-xs text-gray-500 mt-1">
            {data.duration} {data.timeUnit}
          </p>
        ) : (
          <p className="text-xs text-gray-300 mt-1 italic">No duration</p>
        )}
        {data.resourceName && (
          <p className="text-xs text-blue-600 mt-0.5 truncate">{data.resourceName}</p>
        )}
      </div>

      {/* Outgoing connection handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ width: 10, height: 10, background: '#94a3b8', border: '2px solid white' }}
      />
    </div>
  )
})

export default TaskNode
