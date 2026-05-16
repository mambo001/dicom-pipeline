import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const fixtureDir = join(process.cwd(), "test", "fixtures", "dicom");
const sourceBaseUrl = "https://raw.githubusercontent.com/pydicom/pydicom-data/master/data_store/data";
const sampleGroups = {
  renderable: [
    // Baseline metadata and overlay cases
    "MR-SIEMENS-DICOM-WithOverlays.dcm",

    // Uncompressed grayscale variants
    "693_UNCI.dcm",
    "693_UNCR.dcm",
    "MR2_UNCI.dcm",
    "MR2_UNCR.dcm",
    "RG1_UNCI.dcm",
    "RG1_UNCR.dcm",
    "RG3_UNCI.dcm",
    "RG3_UNCR.dcm",
    "US1_UNCI.dcm",
    "US1_UNCR.dcm",
    "emri_small.dcm",
    "liver.dcm",

    // Transfer syntax and compression coverage
    "JPEG-LL.dcm",
    "JPEG2000_UNC.dcm",
    "JPGLosslessP14SV1_1s_1f_8b.dcm",
    "693_J2KR.dcm",
    "MR2_J2KI.dcm",
    "MR2_J2KR.dcm",
    "RG1_J2KI.dcm",
    "RG1_J2KR.dcm",
    "RG3_J2KI.dcm",
    "RG3_J2KR.dcm",
    "US1_J2KI.dcm",
    "US1_J2KR.dcm",
    "emri_small_RLE.dcm",
    "emri_small_big_endian.dcm",
    "emri_small_jpeg_2k_lossless.dcm",
    "emri_small_jpeg_ls_lossless.dcm",

    // JPEG-LS and HTJ2K datasets
    "JLSL_08_07_0_1F.dcm",
    "JLSL_16_15_1_1F.dcm",
    "JLSL_RGB_ILV0.dcm",
    "JLSL_RGB_ILV1.dcm",
    "JLSL_RGB_ILV2.dcm",
    "JLSN_RGB_ILV0.dcm",
    "HTJ2K_08_RGB.dcm",
    "HTJ2KLossless_08_RGB.dcm",

    // RGB, YBR, palette, and multi-frame samples
    "SC_rgb.dcm",
    "SC_rgb_2frame.dcm",
    "SC_rgb_16bit.dcm",
    "SC_rgb_16bit_2frame.dcm",
    "SC_rgb_32bit.dcm",
    "SC_rgb_32bit_2frame.dcm",
    "SC_ybr_full_uncompressed.dcm",
    "OT-PAL-8-face.dcm",
    "color-pl.dcm",
    "color-px.dcm",
    "color3d_jpeg_baseline.dcm",

    // Big-endian, RLE, deflate, and non-byte-aligned edge cases
    "OBXXXX1A.dcm",
    "OBXXXX1A_2frame.dcm",
    "OBXXXX1A_expb.dcm",
    "OBXXXX1A_expb_2frame.dcm",
    "OBXXXX1A_rle.dcm",
    "OBXXXX1A_rle_2frame.dcm",
    "liver_deflate.dcm",
    "liver_j2k.dcm",
    "liver_nonbyte_aligned.dcm",
    "liver_nonbyte_aligned_deflate.dcm",
    "liver_nonbyte_aligned_j2k.dcm",
    "liver_nonbyte_aligned_rle.dcm",
    "liver_rle.dcm",

    // LUT-oriented cases
    "mlut_18.dcm",
    "vlut_04.dcm"
  ],
  "not-renderable": [
    // Malformed or metadata-stress datasets that are useful for parser resilience, not viewer display
    "bad_sequence.dcm",
    "explicit_VR-UN.dcm",

    // Floating-point parametric map pixel data is outside the standard scalar image path used here
    "parametric_map_float.dcm",
    "parametric_map_double_float.dcm"
  ]
};

const samples = Object.entries(sampleGroups).flatMap(([group, fileNames]) => fileNames.map((fileName) => ({
  group,
  fileName,
  url: `${sourceBaseUrl}/${fileName}`
})));

await mkdir(fixtureDir, { recursive: true });

for (const sample of samples) {
  const response = await fetch(sample.url);

  if (!response.ok) {
    throw new Error(`Failed to download ${sample.url}: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const targetDir = join(fixtureDir, sample.group);
  const path = join(targetDir, sample.fileName);

  await mkdir(targetDir, { recursive: true });
  await writeFile(path, buffer);
  console.info(`downloaded ${path} (${buffer.length.toLocaleString()} bytes)`);
}
