import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useIngestionStore } from "./use-ingestion-store";
import { VirtualList } from "./shared/virtual-list";

export function WorkflowLogCard() {
  const messages = useIngestionStore((s) => s.messages);

  return (
    <Card>
      <CardContent>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="h2">Workflow Log</Typography>
          <Chip size="small" label={`${messages.length} events`} />
        </Stack>
        <Divider />
        {messages.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 1 }}>No workflow events yet.</Typography>
        ) : (
          <VirtualList height={240} items={messages} estimateSize={48}>
            {(message, index) => (
              <ListItem key={`${message.text}-${index}`} disableGutters sx={{ py: 0.5 }}>
                <Chip
                  size="small"
                  label={message.level}
                  color={message.level === "error" ? "error" : message.level === "success" ? "success" : "info"}
                  sx={{ mr: 1.5, minWidth: 72 }}
                />
                <ListItemText primary={message.text} />
              </ListItem>
            )}
          </VirtualList>
        )}
      </CardContent>
    </Card>
  );
}