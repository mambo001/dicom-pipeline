import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useIngestionStore } from "./use-ingestion-store";
import { useCornerstoneDicomViewer } from "./use-cornerstone-dicom-viewer";
import { Details, InfoCard } from "./shared/info-card";

export function DicomViewerCard() {
  const selectedFile = useIngestionStore((s) => s.selectedFile);
  const dicomInspection = useIngestionStore((s) => s.dicomInspection);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cornerstone = useCornerstoneDicomViewer(selectedFile);
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
      {selectedFile && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <Chip
              size="small"
              label={cornerstone.status === "rendered" ? "Cornerstone rendered" : "Cornerstone viewer"}
              color={cornerstone.status === "rendered" ? "success" : cornerstone.status === "failed" ? "warning" : "default"}
            />
            <Chip size="small" label={preview ? "Canvas fallback available" : "Canvas fallback unavailable"} color={preview ? "success" : "warning"} />
            <Chip size="small" label="Prototype viewer" variant="outlined" />
          </Stack>
          <Box
            ref={cornerstone.elementRef}
            sx={{
              bgcolor: "#020617",
              borderRadius: 2,
              border: "1px solid rgba(2,43,58,0.18)",
              height: 420,
              overflow: "hidden",
              position: "relative",
              width: "100%"
            }}
          >
            {cornerstone.status === "loading" && (
              <Typography sx={{ color: "white", left: 24, position: "absolute", top: 24 }}>Loading Cornerstone viewer...</Typography>
            )}
            {cornerstone.status === "failed" && (
              <Typography sx={{ color: "white", left: 24, position: "absolute", right: 24, top: 24 }}>
                Cornerstone could not render this file. {cornerstone.error}
              </Typography>
            )}
            {cornerstone.status === "failed" && dicomInspection?.metadata.transferSyntax && (
              <Typography sx={{ color: "#ff9800", fontSize: 12, left: 24, position: "absolute", right: 24, top: 56 }}>
                Transfer syntax: {dicomInspection.metadata.transferSyntax}
              </Typography>
            )}
          </Box>
          {cornerstone.status === "failed" && preview && (
            <Typography color="text.secondary">Showing the lightweight canvas fallback below.</Typography>
          )}
          {preview && cornerstone.status !== "rendered" ? (
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
          ) : !preview ? (
            <Typography color="text.secondary">
              The lightweight fallback only supports uncompressed single-frame grayscale pixel data. Cornerstone rendering can still work for compressed, color, or multi-frame files even when this fallback is unavailable.
            </Typography>
          ) : null}
        </Stack>
      )}
    </InfoCard>
  );
}
