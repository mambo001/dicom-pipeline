import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import Typography from "@mui/material/Typography";
import { useIngestionStore } from "./use-ingestion-store";
import { VirtualList } from "./shared/virtual-list";
import { formatTimestamp } from "./shared/format-helpers";

function RefreshIcon() {
  return (
    <SvgIcon fontSize="small">
      <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </SvgIcon>
  );
}

export function AuditTimelineCard() {
  const auditEvents = useIngestionStore((s) => s.auditEvents);
  const selectedFile = useIngestionStore((s) => s.selectedFile);
  const refreshTraceability = useIngestionStore((s) => s.refreshTraceability);

  return (
    <Card>
      <CardContent>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography variant="h2">Audit Timeline</Typography>
            {auditEvents.length > 0 && (
              <Chip size="small" label={`${auditEvents.length}`} color="primary" variant="outlined" />
            )}
          </Stack>
          <IconButton
            size="small"
            onClick={refreshTraceability}
            disabled={!selectedFile}
            title="Refresh trace"
          >
            <RefreshIcon />
          </IconButton>
        </Stack>
        <Divider />
        {auditEvents.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 1 }}>No persisted audit events loaded.</Typography>
        ) : (
          <VirtualList height={240} items={auditEvents} estimateSize={48} getItemKey={(event) => event.eventId}>
            {(event) => (
              <ListItem disableGutters sx={{ py: 0.5 }}>
                <Chip
                  size="small"
                  label={event.result}
                  color={event.result === "success" ? "success" : "error"}
                  sx={{ mr: 1.5, minWidth: 72 }}
                />
                <ListItemText
                  primary={event.action}
                  secondary={`${formatTimestamp(event.occurredAt)} | ${event.target.kind}: ${event.target.id}`}
                />
              </ListItem>
            )}
          </VirtualList>
        )}
      </CardContent>
    </Card>
  );
}