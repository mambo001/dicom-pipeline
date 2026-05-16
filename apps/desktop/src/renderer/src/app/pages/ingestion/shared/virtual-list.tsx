import { useRef } from "react";
import type { ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import Box from "@mui/material/Box";

export function VirtualList<T>(props: {
  readonly height: number;
  readonly items: readonly T[];
  readonly estimateSize: number;
  readonly getItemKey?: (item: T) => string;
  readonly children: (item: T, index: number) => ReactNode;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: props.items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => props.estimateSize,
    getItemKey: props.getItemKey ? (index) => props.getItemKey!(props.items[index]) : undefined
  });

  return (
    <Box ref={parentRef} sx={{ height: props.height, overflow: "auto" }}>
      <Box sx={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <Box
            key={virtualItem.key}
            sx={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualItem.start}px)` }}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
          >
            {props.children(props.items[virtualItem.index], virtualItem.index)}
          </Box>
        ))}
      </Box>
    </Box>
  );
}