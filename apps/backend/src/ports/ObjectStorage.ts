export type SignedUpload = {
  readonly objectName: string;
  readonly signedUploadUrl: string;
  readonly expiresAt: string;
};

export type SignedRead = {
  readonly objectName: string;
  readonly signedReadUrl: string;
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
  readonly createSignedRead: (objectName: string) => Promise<SignedRead>;
};
