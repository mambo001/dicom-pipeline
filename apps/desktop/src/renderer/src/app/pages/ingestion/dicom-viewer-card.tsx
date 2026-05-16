import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useIngestionStore } from "./use-ingestion-store";
import { Details, InfoCard } from "./shared/info-card";

export function DicomViewerCard() {
  const dicomInspection = useIngestionStore((s) => s.dicomInspection);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const preview = dicomInspection?.pixelPreview;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !preview) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const imageData = context.createImageData(preview.width, preview.height);
    preview.pixels.forEach((value, index) => {
      const offset = index * 4;
      imageData.data[offset] = value;
      imageData.data[offset + 1] = value;
      imageData.data[offset + 2] = value;
      imageData.data[offset + 3] = 255;
    });
    context.putImageData(imageData, 0, 0);
  }, [preview]);

  return (
    <InfoCard title="DICOM Viewer" emptyText="Select a DICOM file to render a preview.">
      {dicomInspection && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <Chip size="small" label={preview ? "Pixel preview available" : "Pixel preview unavailable"} color={preview ? "success" : "warning"} />
            <Chip size="small" label="Prototype viewer" variant="outlined" />
          </Stack>
          {preview ? (
            <>
              <Box
                sx={{
                  bgcolor: "#020617",
                  borderRadius: 2,
                  border: "1px solid rgba(2,43,58,0.18)",
                  display: "grid",
                  minHeight: 280,
                  overflow: "hidden",
                  p: 2,
                  placeItems: "center"
                }}
              >
                <Box
                  component="canvas"
                  ref={canvasRef}
                  width={preview.width}
                  height={preview.height}
                  sx={{
                    imageRendering: "pixelated",
                    maxHeight: 360,
                    maxWidth: "100%",
                    width: preview.width >= preview.height ? "100%" : "auto"
                  }}
                />
              </Box>
              <Details
                rows={[
                  ["Source", `${preview.sourceWidth} x ${preview.sourceHeight}`],
                  ["Preview", `${preview.width} x ${preview.height}`],
                  ["Photometric", preview.photometricInterpretation ?? "not present"],
                  ["Bits", preview.bitsAllocated ? String(preview.bitsAllocated) : "not present"],
                  ["Samples", preview.samplesPerPixel ? String(preview.samplesPerPixel) : "not present"]
                ]}
              />
            </>
          ) : (
            <Typography color="text.secondary">
              This prototype renders uncompressed single-frame grayscale DICOM pixel data. Metadata and de-identification inspection still work when pixel preview is unavailable.
            </Typography>
          )}
        </Stack>
      )}
    </InfoCard>
  );
}
