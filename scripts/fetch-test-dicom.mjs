import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const fixtureDir = join(process.cwd(), "test", "fixtures", "dicom");
const samples = [
  {
    fileName: "pydicom-mr-siemens-overlays.dcm",
    url: "https://raw.githubusercontent.com/pydicom/pydicom-data/master/data_store/data/MR-SIEMENS-DICOM-WithOverlays.dcm"
  },
  {
    fileName: "pydicom-secondary-capture-rgb.dcm",
    url: "https://raw.githubusercontent.com/pydicom/pydicom-data/master/data_store/data/SC_rgb.dcm"
  },
  {
    fileName: "pydicom-palette-face.dcm",
    url: "https://raw.githubusercontent.com/pydicom/pydicom-data/master/data_store/data/OT-PAL-8-face.dcm"
  }
];

await mkdir(fixtureDir, { recursive: true });

for (const sample of samples) {
  const response = await fetch(sample.url);

  if (!response.ok) {
    throw new Error(`Failed to download ${sample.url}: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const path = join(fixtureDir, sample.fileName);

  await writeFile(path, buffer);
  console.info(`downloaded ${path} (${buffer.length.toLocaleString()} bytes)`);
}
