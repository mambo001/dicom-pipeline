# DICOM Fixtures

Generate local synthetic DICOM files:

```sh
npm run fixtures:dicom
```

Download public sample DICOM files from the pydicom test-data repository:

```sh
npm run fixtures:dicom:download
```

Generated and downloaded `.dcm` files are ignored by git. Use files in this directory for manual desktop upload testing.

Downloaded pydicom samples are grouped by expected viewer behavior:

- `renderable/`: Datasets expected to render in the Cornerstone viewer. This includes uncompressed, JPEG, JPEG2000, JPEG-LS, HTJ2K, RLE, RGB/YBR, palette, multi-frame, overlay, endian, deflate, and LUT-oriented image samples.
- `not-renderable/`: Malformed, metadata-stress, or non-standard pixel-data samples that are useful for parser resilience testing but are not expected to display in this prototype viewer.

If a `renderable/` sample fails in the app but works in the official Cornerstone local-file example, treat that as a viewer integration issue rather than an invalid DICOM file.
