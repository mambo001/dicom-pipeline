# ============================================================================
# Required GCP APIs
# ============================================================================

resource "google_project_service" "run" {
  project = var.gcp_project_id
  service = "run.googleapis.com"
}

resource "google_project_service" "artifactregistry" {
  project = var.gcp_project_id
  service = "artifactregistry.googleapis.com"
}

resource "google_project_service" "storage" {
  project = var.gcp_project_id
  service = "storage.googleapis.com"
}

resource "google_project_service" "iam" {
  project = var.gcp_project_id
  service = "iam.googleapis.com"
}

# ============================================================================
# GCS Bucket for DICOM storage
# ============================================================================

resource "google_storage_bucket" "dicom" {
  project                     = var.gcp_project_id
  name                        = "${var.gcp_project_id}-dicom"
  location                    = var.gcp_region
  uniform_bucket_level_access = true
  force_destroy               = false

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type = "Delete"
    }
  }
}

# ============================================================================
# Artifact Registry
# ============================================================================

resource "google_artifact_registry_repository" "backend" {
  project       = var.gcp_project_id
  location      = var.gcp_region
  repository_id = "dicom-pipeline-backend"
  format        = "DOCKER"

  depends_on = [google_project_service.artifactregistry]
}

# ============================================================================
# Service Account for Cloud Run
# ============================================================================

resource "google_service_account" "backend" {
  project      = var.gcp_project_id
  account_id   = "dicom-pipeline-backend"
  display_name = "DICOM Pipeline Backend Cloud Run Service Account"

  depends_on = [google_project_service.iam]
}

resource "google_service_account_iam_member" "backend_act_as" {
  service_account_id = google_service_account.backend.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:github-actions-deployer@${var.gcp_project_id}.iam.gserviceaccount.com"
}

# Grant the service account admin access to the DICOM bucket
resource "google_storage_bucket_iam_member" "backend_storage_admin" {
  bucket = google_storage_bucket.dicom.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.backend.email}"
}

# Grant the service account viewer access to bucket metadata
resource "google_storage_bucket_iam_member" "backend_storage_viewer" {
  bucket = google_storage_bucket.dicom.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.backend.email}"
}

# ============================================================================
# Cloud Run
# ============================================================================

resource "google_cloud_run_v2_service" "backend" {
  project  = var.gcp_project_id
  name     = "dicom-pipeline-backend"
  location = var.gcp_region
  ingress  = "INGRESS_TRAFFIC_ALL"

  lifecycle {
    ignore_changes = [
      client,
      client_version,
      template[0].containers[0].image,
    ]
  }

  template {
    service_account = google_service_account.backend.email
    max_instance_request_concurrency = 80
    scaling {
      max_instance_count = 1
    }

    containers {
      image = var.backend_image

      ports {
        container_port = 8080
      }

      env {
        name  = "APP_ENV"
        value = "production"
      }

      env {
        name  = "GCS_BUCKET"
        value = google_storage_bucket.dicom.name
      }

      env {
        name  = "GCS_SIGNED_URL_TTL_SECONDS"
        value = "900"
      }

      env {
        name  = "ALLOWED_ORIGINS"
        value = var.allowed_origins
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }
  }

  depends_on = [
    google_project_service.run,
    google_storage_bucket.dicom,
  ]
}

# Allow unauthenticated access to the backend API
resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.gcp_project_id
  location = google_cloud_run_v2_service.backend.location
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}