import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import { useIngestionStore } from "./use-ingestion-store";
import { HeaderCard } from "./header-card";
import { InstructionsCard } from "./instructions-card";
import { ActionCard } from "./action-card";
import { SelectedFileCard, UploadSessionCard } from "./upload-session-card";
import { DicomMetadataCard, DeidentificationCard } from "./dicom-panels";
import { DicomViewerCard } from "./dicom-viewer-card";
import { WorkflowLogCard } from "./workflow-log-card";
import { AuditTimelineCard } from "./audit-timeline-card";

export function IngestionWorkspace() {
  useIngestionStore();

  return (
    <Stack spacing={3}>
      <HeaderCard />
      <InstructionsCard />
      <ActionCard />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SelectedFileCard />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <UploadSessionCard />
        </Grid>
      </Grid>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <DicomMetadataCard />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <DeidentificationCard />
        </Grid>
      </Grid>
      <DicomViewerCard />
      <WorkflowLogCard />
      <AuditTimelineCard />
    </Stack>
  );
}
