export type SignedUpload = {
  readonly objectName: string;
  readonly signedUploadUrl: string;
  readonly expiresAt: string;
};

export type CreateSignedUploadInput = {
  readonly uploadSessionId: string;
  readonly correlationId: string;
  readonly fileName: string;
  readonly contentType: "application/dicom";
};

export type ObjectStorage = {
  readonly bucket: string;
  readonly createSignedUpload: (input: CreateSignedUploadInput) => Promise<SignedUpload>;
};
