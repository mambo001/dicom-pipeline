provider "google" {
  project               = var.gcp_project_id
  region                = var.gcp_region
  billing_project       = var.gcp_project_id
  user_project_override = true
}