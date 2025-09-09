import React, { ReactNode } from "react";
import clsx from "clsx";

export type TableColumn<T> = {
  key: keyof T;
  label: string;
  render?: (value: any, row: T) => ReactNode;
};

export type TableProps<T extends object> = {
  data?: T[];
  columns?: TableColumn<T>[];
  children?: ReactNode;
  className?: string;
};

export function Table<T extends object>({
  data,
  columns,
  children,
  className,
}: TableProps<T>) {
  const isDynamic = data && columns;

  return (
    <div className="overflow-x-auto border rounded-lg shadow-sm">
      <table className={clsx("min-w-full divide-y divide-gray-200", className)}>
        {isDynamic ? (
          <>
            <thead className="bg-gray-100">
              <tr>
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-2 text-sm text-gray-700">
                      {col.render
                        ? col.render(row[col.key], row)
                        : String(row[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </>
        ) : (
          children // ✅ fallback manuel
        )}
      </table>
    </div>
  );
}

// ✅ Sous-composants facultatifs pour usage manuel
export const TableHead = ({ children }: { children: ReactNode }) => (
  <thead className="bg-gray-100">{children}</thead>
);

export const TableBody = ({ children }: { children: ReactNode }) => (
  <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>
);

export const TableRow = ({ children }: { children: ReactNode }) => (
  <tr className="hover:bg-gray-50">{children}</tr>
);

export const TableHeader = ({ children }: { children: ReactNode }) => (
  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
    {children}
  </th>
);

export const TableCell = ({ children }: { children: ReactNode }) => (
  <td className="px-4 py-2 text-sm text-gray-700">{children}</td>
);
