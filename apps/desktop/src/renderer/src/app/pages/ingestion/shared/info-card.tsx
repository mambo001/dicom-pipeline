import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";

export function InfoCard(props: {
  readonly title: string;
  readonly emptyText: string;
  readonly children?: ReactNode;
}) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="h2" sx={{ mb: 2 }}>
          {props.title}
        </Typography>
        {props.children ?? <Typography color="text.secondary">{props.emptyText}</Typography>}
      </CardContent>
    </Card>
  );
}

export function Details(props: { readonly rows: readonly (readonly [string, string])[] }) {
  return (
    <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "120px minmax(0, 1fr)", gap: 1 }}>
      {props.rows.map(([label, value]) => (
        <Box component="div" key={label} sx={{ display: "contents" }}>
          <Typography component="dt" color="text.secondary" sx={{ fontWeight: 800 }}>
            {label}
          </Typography>
          <Typography
            component="dd"
            sx={{ m: 0, overflowWrap: "anywhere", fontFamily: label.includes("ID") || label === "SHA-256" ? "monospace" : undefined }}
          >
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}