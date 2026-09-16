import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';















export function DataTable({
  data,
  columns,
  isLoading,
  onRowClick,
  emptyMessage = "No records found"
}) {

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-white/50 backdrop-blur-md rounded-2xl border border-white/20">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
        <p className="text-sm text-gray-500 font-medium">Loading data...</p>
      </div>);

  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-white/50 backdrop-blur-md rounded-2xl border border-white/20">
        <p className="text-gray-500 font-medium">{emptyMessage}</p>
      </div>);

  }

  return (
    <div className="overflow-x-auto bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <table className="w-full text-sm text-left text-gray-700">
        <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-gray-100/50">
          <tr>
            {columns.map((col, i) =>
            <th key={i} scope="col" className={cn("px-6 py-4 font-semibold tracking-wider", col.className)}>
                {col.header}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100/50">
          {data.map((row, rowIndex) =>
          <tr
            key={rowIndex}
            onClick={() => onRowClick?.(row)}
            className={cn(
              "group transition-colors hover:bg-gray-50/50",
              onRowClick && "cursor-pointer"
            )}>
            
              {columns.map((col, colIndex) =>
            <td key={colIndex} className={cn("px-6 py-4 whitespace-nowrap", col.className)}>
                  {typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor]}
                </td>
            )}
            </tr>
          )}
        </tbody>
      </table>
    </div>);

}