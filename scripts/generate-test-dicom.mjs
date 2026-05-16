import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const fixtureDir = join(process.cwd(), "test", "fixtures", "dicom");

const examples = [
  {
    fileName: "synthetic-ct-head.dcm",
    patientName: "PIPELINE^CTHEAD",
    patientId: "PIPELINE-CT-001",
    birthDate: "19700101",
    studyDate: "20260516",
    modality: "CT",
    rows: 64,
    columns: 64
  },
  {
    fileName: "synthetic-mr-knee.dcm",
    patientName: "PIPELINE^MRKNEE",
    patientId: "PIPELINE-MR-002",
    birthDate: "19850520",
    studyDate: "20260516",
    modality: "MR",
    rows: 96,
    columns: 96
  },
  {
    fileName: "synthetic-us-abdomen.dcm",
    patientName: "PIPELINE^USABDOMEN",
    patientId: "PIPELINE-US-003",
    birthDate: "19920202",
    studyDate: "20260516",
    modality: "US",
    rows: 80,
    columns: 80
  }
];

await mkdir(fixtureDir, { recursive: true });

for (const [index, example] of examples.entries()) {
  const buffer = createDicomFile(example, index + 1);
  const path = join(fixtureDir, example.fileName);

  await writeFile(path, buffer);
  console.info(`wrote ${path}`);
}

function createDicomFile(example, seed) {
  const preamble = Buffer.alloc(128, 0);
  const prefix = Buffer.from("DICM", "ascii");
  const studyUid = `1.2.826.0.1.3680043.10.54321.${seed}.1`;
  const seriesUid = `1.2.826.0.1.3680043.10.54321.${seed}.2`;
  const sopUid = `1.2.826.0.1.3680043.10.54321.${seed}.3`;
  const pixelData = createPixelData(example.rows, example.columns, seed);

  return Buffer.concat([
    preamble,
    prefix,
    element("0002", "0010", "UI", "1.2.840.10008.1.2.1"),
    element("0008", "0016", "UI", "1.2.840.10008.5.1.4.1.1.7"),
    element("0008", "0018", "UI", sopUid),
    element("0008", "0020", "DA", example.studyDate),
    element("0008", "0060", "CS", example.modality),
    element("0010", "0010", "PN", example.patientName),
    element("0010", "0020", "LO", example.patientId),
    element("0010", "0030", "DA", example.birthDate),
    element("0020", "000D", "UI", studyUid),
    element("0020", "000E", "UI", seriesUid),
    element("0028", "0010", "US", example.rows),
    element("0028", "0011", "US", example.columns),
    element("0028", "0100", "US", 8),
    element("0028", "0101", "US", 8),
    element("0028", "0102", "US", 7),
    element("0028", "0103", "US", 0),
    element("7FE0", "0010", "OB", pixelData)
  ]);
}

function element(groupHex, elementHex, vr, value) {
  const group = Number.parseInt(groupHex, 16);
  const elementNumber = Number.parseInt(elementHex, 16);
  const valueBuffer = encodeValue(vr, value);
  const paddedValue = valueBuffer.length % 2 === 0 ? valueBuffer : Buffer.concat([valueBuffer, Buffer.from([paddingByte(vr)])]);
  const longVr = new Set(["OB", "OD", "OF", "OL", "OV", "OW", "SQ", "UC", "UR", "UT", "UN"]).has(vr);
  const header = Buffer.alloc(longVr ? 12 : 8);

  header.writeUInt16LE(group, 0);
  header.writeUInt16LE(elementNumber, 2);
  header.write(vr, 4, 2, "ascii");

  if (longVr) {
    header.writeUInt32LE(paddedValue.length, 8);
  } else {
    header.writeUInt16LE(paddedValue.length, 6);
  }

  return Buffer.concat([header, paddedValue]);
}

function encodeValue(vr, value) {
  if (vr === "US") {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(value, 0);
    return buffer;
  }

  if (Buffer.isBuffer(value)) {
    return value;
  }

  return Buffer.from(String(value), "ascii");
}

function paddingByte(vr) {
  return vr === "UI" || vr === "OB" ? 0 : 0x20;
}

function createPixelData(rows, columns, seed) {
  const buffer = Buffer.alloc(rows * columns);

  for (let index = 0; index < buffer.length; index += 1) {
    buffer[index] = (index + seed * 23) % 256;
  }

  return buffer;
}
