type Cell = string | number;

export default function DataTable({ columns, rows }: { columns: string[]; rows: Cell[][] }) {
  return (
    <div className="w-full overflow-x-auto rounded border">
      <table className="min-w-full text-sm">
        <thead className="bg-black/5">
          <tr>
            {columns.map((column) => (
              <th key={column} className="whitespace-nowrap px-3 py-2 text-start font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="whitespace-nowrap px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}