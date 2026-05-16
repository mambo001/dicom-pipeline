import { useEffect, useRef, useState } from "react";
import { Enums, RenderingEngine, StackViewport, init as initCornerstone } from "@cornerstonejs/core";
import dicomImageLoader, { init as initDicomImageLoader } from "@cornerstonejs/dicom-image-loader";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useIngestionStore } from "./use-ingestion-store";
import { Details, InfoCard } from "./shared/info-card";

type DicomDesktopApi = {
  readonly readDicomFile: (filePath: string) => Promise<{ readonly name: string; readonly data: ArrayBuffer }>;
};

let cornerstoneReady: Promise<void> | undefined;

function getDesktopApi(): DicomDesktopApi {
  return (window as Window & { readonly dicomDesktop: DicomDesktopApi }).dicomDesktop;
}

function ensureCornerstoneReady(): Promise<void> {
  if (!cornerstoneReady) {
    cornerstoneReady = (async () => {
      await initCornerstone();
      initDicomImageLoader({ maxWebWorkers: 1 });
    })();
  }
  return cornerstoneReady;
}

export function DicomViewerCard() {
  const selectedFile = useIngestionStore((s) => s.selectedFile);
  const dicomInspection = useIngestionStore((s) => s.dicomInspection);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cornerstoneElementRef = useRef<HTMLDivElement | null>(null);
  const renderingEngineRef = useRef<RenderingEngine | undefined>(undefined);
  const [cornerstoneStatus, setCornerstoneStatus] = useState<"idle" | "loading" | "rendered" | "failed">("idle");
  const [cornerstoneError, setCornerstoneError] = useState<string | undefined>(undefined);
  const preview = dicomInspection?.pixelPreview;

  useEffect(() => {
    const element = cornerstoneElementRef.current;
    if (!element || !selectedFile) {
      setCornerstoneStatus("idle");
      return;
    }

    let cancelled = false;
    const viewportId = "dicom-preview-viewport";
    const renderingEngineId = `dicom-preview-${selectedFile.sha256.slice(0, 12)}`;
    const renderWithCornerstone = async () => {
      setCornerstoneStatus("loading");
      setCornerstoneError(undefined);

      try {
        await ensureCornerstoneReady();
        const file = await getDesktopApi().readDicomFile(selectedFile.path);
        if (cancelled) {
          return;
        }

        const blob = new File([file.data], file.name, { type: "application/dicom" });
        const imageId = dicomImageLoader.wadouri.fileManager.add(blob);
        const renderingEngine = new RenderingEngine(renderingEngineId);
        renderingEngine.enableElement({
          element,
          viewportId,
          type: Enums.ViewportType.STACK
        });

        const viewport = renderingEngine.getViewport(viewportId) as StackViewport;
        await viewport.setStack([imageId]);
        renderingEngine.resize(true, true);
        viewport.render();
        renderingEngineRef.current = renderingEngine;
        setCornerstoneStatus("rendered");
      } catch (error) {
        setCornerstoneStatus("failed");
        setCornerstoneError(formatCornerstoneError(error));
      }
    };

    void renderWithCornerstone();

    return () => {
      cancelled = true;
      renderingEngineRef.current?.destroy();
      renderingEngineRef.current = undefined;
    };
  }, [selectedFile]);

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
              label={cornerstoneStatus === "rendered" ? "Cornerstone rendered" : "Cornerstone viewer"}
              color={cornerstoneStatus === "rendered" ? "success" : cornerstoneStatus === "failed" ? "warning" : "default"}
            />
            <Chip size="small" label={preview ? "Canvas fallback available" : "Canvas fallback unavailable"} color={preview ? "success" : "warning"} />
            <Chip size="small" label="Prototype viewer" variant="outlined" />
          </Stack>
          <Box
            ref={cornerstoneElementRef}
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
            {cornerstoneStatus === "loading" && (
              <Typography sx={{ color: "white", left: 24, position: "absolute", top: 24 }}>Loading Cornerstone viewer...</Typography>
            )}
            {cornerstoneStatus === "failed" && (
              <Typography sx={{ color: "white", left: 24, position: "absolute", right: 24, top: 24 }}>
                Cornerstone could not render this file. {cornerstoneError}
              </Typography>
            )}
          </Box>
          {cornerstoneStatus === "failed" && preview && (
            <Typography color="text.secondary">Showing the lightweight canvas fallback below.</Typography>
          )}
          {preview && cornerstoneStatus !== "rendered" ? (
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

function formatCornerstoneError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error) {
    const nestedError = "error" in error ? (error as { readonly error?: unknown }).error : undefined;
    if (nestedError) {
      return formatCornerstoneError(nestedError);
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "Cornerstone could not render this DICOM file.";
    }
  }

  return typeof error === "string" ? error : "Cornerstone could not render this DICOM file.";
}
