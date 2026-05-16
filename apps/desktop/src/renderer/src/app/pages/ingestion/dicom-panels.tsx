import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useIngestionStore } from "./use-ingestion-store";
import { InfoCard, Details } from "./shared/info-card";
import { metadataRows } from "./shared/format-helpers";

export function DicomMetadataCard() {
  const dicomInspection = useIngestionStore((s) => s.dicomInspection);

  return (
    <InfoCard title="DICOM Metadata" emptyText="Select a DICOM file to inspect metadata.">
      {dicomInspection && (
        <Stack spacing={2}>
          <Chip
            size="small"
            label={dicomInspection.isDicom ? "Parseable DICOM" : "DICOM not confirmed"}
            color={dicomInspection.isDicom ? "success" : "warning"}
            sx={{ alignSelf: "flex-start" }}
          />
          <Details rows={metadataRows(dicomInspection.metadata)} />
          {dicomInspection.warnings.map((warning) => (
            <Typography key={warning} color="warning.main">
              {warning}
            </Typography>
          ))}
        </Stack>
      )}
    </InfoCard>
  );
}

export function DeidentificationCard() {
  const dicomInspection = useIngestionStore((s) => s.dicomInspection);

  return (
    <InfoCard title="De-Identification Preview" emptyText="Metadata inspection will generate a de-id preview.">
      {dicomInspection && (
        <Stack spacing={2}>
          <Details rows={[["Ruleset", dicomInspection.deidentificationReport.rulesetId]]} />
          <List disablePadding>
            {dicomInspection.deidentificationReport.findings.length === 0 ? (
              <ListItem disableGutters>
                <ListItemText primary="No configured PHI tags found." />
              </ListItem>
            ) : (
              dicomInspection.deidentificationReport.findings.map((finding) => (
                <ListItem key={`${finding.tag}-${finding.name}`} disableGutters>
                  <Chip size="small" label={finding.action} sx={{ mr: 1.5, minWidth: 76 }} />
                  <ListItemText primary={finding.name} secondary={finding.tag} />
                </ListItem>
              ))
            )}
          </List>
          <Typography variant="caption" color="text.secondary">
            The uploaded file is scrubbed before transmission: patient identifiers are replaced with empty values in the DICOM binary. The local preview above shows the original values for operator review only.
          </Typography>
        </Stack>
      )}
    </InfoCard>
  );
}