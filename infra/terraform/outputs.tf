output "backend_url" {
  description = "Cloud Run backend service URL"
  value       = google_cloud_run_v2_service.backend.uri
}

output "artifact_registry_repo" {
  description = "Artifact Registry Docker repository path"
  value       = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.backend.repository_id}"
}

output "bucket_name" {
  description = "GCS bucket name for DICOM storage"
  value       = google_storage_bucket.dicom.name
}