import { useEffect, useRef, useState } from "react";
import { Enums, RenderingEngine, StackViewport, init as initCornerstone } from "@cornerstonejs/core";
import dicomImageLoader, { init as initDicomImageLoader } from "@cornerstonejs/dicom-image-loader";

type DicomDesktopApi = {
  readonly readDicomFile: (filePath: string) => Promise<{ readonly name: string; readonly data: ArrayBuffer }>;
};

export type DicomImageSource =
  | { readonly type: "local"; readonly path: string; readonly sizeBytes: number }
  | { readonly type: "url"; readonly url: string };

export type CornerstoneViewerStatus = "idle" | "loading" | "rendered" | "failed";

const ENGINE_ID = "dicom-preview-engine";
const VIEWPORT_ID = "dicom-preview-viewport";

let cornerstoneReady: Promise<void> | undefined;

function getDesktopApi(): DicomDesktopApi {
  return (window as Window & { readonly dicomDesktop: DicomDesktopApi }).dicomDesktop;
}

function ensureCornerstoneReady(): Promise<void> {
  if (!cornerstoneReady) {
    cornerstoneReady = (async () => {
      initDicomImageLoader();
      await initCornerstone();
    })();
  }
  return cornerstoneReady;
}

async function createDicomImageId(source: DicomImageSource): Promise<string> {
  if (source.type === "url") {
    return `wadouri:${source.url}`;
  }

  const file = await getDesktopApi().readDicomFile(source.path);

  if (file.data.byteLength !== source.sizeBytes) {
    throw new Error(`Read ${file.data.byteLength} bytes, expected ${source.sizeBytes} bytes.`);
  }

  const bytes = new Uint8Array(file.data);
  if (bytes.length > 132 && String.fromCharCode(...bytes.slice(128, 132)) !== "DICM") {
    throw new Error("Read file bytes do not contain a DICOM preamble marker.");
  }

  const blob = new File([bytes], file.name, { type: "application/dicom" });
  return dicomImageLoader.wadouri.fileManager.add(blob);
}

async function prefetchImageMetadata(imageId: string): Promise<void> {
  await dicomImageLoader.wadouri.loadImage(imageId).promise;
}

export function useCornerstoneDicomViewer(imageSource: DicomImageSource | undefined) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const [status, setStatus] = useState<CornerstoneViewerStatus>("idle");
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !imageSource) {
      setStatus("idle");
      return;
    }

    let cancelled = false;

    const renderImage = async () => {
      setStatus("loading");
      setError(undefined);

      try {
        await ensureCornerstoneReady();
        if (cancelled) return;

        const imageId = await createDicomImageId(imageSource);
        if (cancelled) return;

        await prefetchImageMetadata(imageId);
        if (cancelled) return;

        const renderingEngine = getOrCreateRenderingEngine(renderingEngineRef, element);
        const viewport = renderingEngine.getViewport(VIEWPORT_ID) as StackViewport;

        await viewport.setStack([imageId]);
        if (cancelled) return;

        renderingEngine.resize(true, true);
        viewport.render();

        setStatus("rendered");
      } catch (caught) {
        if (!cancelled) {
          setStatus("failed");
          setError(formatCornerstoneError(caught));
        }
      }
    };

    void renderImage();

    return () => {
      cancelled = true;
    };
  }, [imageSource]);

  useEffect(() => {
    return () => {
      renderingEngineRef.current?.destroy();
      renderingEngineRef.current = null;
      dicomImageLoader.wadouri.dataSetCacheManager.purge();
      dicomImageLoader.wadouri.fileManager.purge();
    };
  }, []);

  return { elementRef, status, error };
}

function getOrCreateRenderingEngine(
  renderingEngineRef: React.MutableRefObject<RenderingEngine | null>,
  element: HTMLDivElement
): RenderingEngine {
  if (!renderingEngineRef.current) {
    const renderingEngine = new RenderingEngine(ENGINE_ID);
    renderingEngine.enableElement({ element, viewportId: VIEWPORT_ID, type: Enums.ViewportType.STACK });
    renderingEngineRef.current = renderingEngine;
  }
  return renderingEngineRef.current;
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
