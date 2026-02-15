# ✅ Infrastructure GPU automatisée pour Yukpomnang
# Gère Compute Engine avec GPU, scaling automatique, budgets et monitoring

terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "europe-west1"
}

variable "zone" {
  description = "GCP Zone"
  type        = string
  default     = "europe-west1-b"
}

variable "gpu_type" {
  description = "Type de GPU (nvidia-t4, nvidia-a100)"
  type        = string
  default     = "nvidia-t4"
}

variable "gpu_count" {
  description = "Nombre de GPU par instance"
  type        = number
  default     = 1
}

variable "machine_type" {
  description = "Type de machine"
  type        = string
  default     = "n1-standard-4"
}

variable "min_instances" {
  description = "Nombre minimum d'instances"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Nombre maximum d'instances"
  type        = number
  default     = 3
}

variable "monthly_budget" {
  description = "Budget mensuel maximum (USD)"
  type        = number
  default     = 100.0
}

variable "preemptible" {
  description = "Utiliser des instances preemptible (économique)"
  type        = bool
  default     = true
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Instance template pour les workers GPU
resource "google_compute_instance_template" "gpu_worker_template" {
  name_prefix  = "yukpo-gpu-worker-"
  machine_type = var.machine_type
  region       = var.region

  disk {
    source_image = "ubuntu-os-cloud/ubuntu-2204-lts"
    auto_delete  = true
    boot         = true
    disk_size_gb = 50
  }

  network_interface {
    network = "default"
    access_config {
      # IP publique
    }
  }

  # Configuration GPU
  guest_accelerator {
    type  = var.gpu_type
    count = var.gpu_count
  }

  scheduling {
    preemptible       = var.preemptible
    automatic_restart = !var.preemptible
    on_host_maintenance = "TERMINATE"
  }

  service_account {
    email  = google_service_account.gpu_worker.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    startup-script = file("${path.module}/startup-script.sh")
  }

  tags = ["gpu-worker", "yukpomnang"]
}

# Service account pour les workers GPU
resource "google_service_account" "gpu_worker" {
  account_id   = "gpu-worker"
  display_name = "GPU Worker Service Account"
}

# IAM binding pour le service account
resource "google_project_iam_member" "gpu_worker_iam" {
  project = var.project_id
  role    = "roles/compute.instanceAdmin.v1"
  member  = "serviceAccount:${google_service_account.gpu_worker.email}"
}

# Instance group manager pour scaling automatique
resource "google_compute_instance_group_manager" "gpu_workers" {
  name               = "yukpo-gpu-workers"
  base_instance_name = "gpu-worker"
  zone               = var.zone
  target_size        = var.min_instances

  version {
    instance_template = google_compute_instance_template.gpu_worker_template.id
  }

  named_port {
    name = "http"
    port = 8080
  }

  auto_healing_policies {
    health_check      = google_compute_health_check.gpu_worker.id
    initial_delay_sec = 300
  }
}

# Health check pour les workers GPU
resource "google_compute_health_check" "gpu_worker" {
  name               = "gpu-worker-health-check"
  check_interval_sec = 30
  timeout_sec        = 10
  healthy_threshold  = 2
  unhealthy_threshold = 3

  http_health_check {
    port         = 8080
    request_path = "/health"
  }
}

# Autoscaler pour scaling automatique
resource "google_compute_autoscaler" "gpu_workers" {
  name   = "yukpo-gpu-autoscaler"
  zone   = var.zone
  target = google_compute_instance_group_manager.gpu_workers.id

  autoscaling_policy {
    max_replicas    = var.max_instances
    min_replicas    = var.min_instances
    cooldown_period = 300

    cpu_utilization {
      target = 0.7
    }

    load_balancing_utilization {
      target = 0.7
    }
  }
}

# Budget GCP pour contrôler les coûts
resource "google_billing_budget" "gpu_budget" {
  billing_account = data.google_billing_account.account.id
  display_name    = "GPU Workers Monthly Budget"

  budget_filter {
    projects = ["projects/${var.project_id}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units        = tostring(var.monthly_budget)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
    spend_basis       = "CURRENT_SPEND"
  }
  threshold_rules {
    threshold_percent = 0.9
    spend_basis       = "CURRENT_SPEND"
  }
  threshold_rules {
    threshold_percent = 1.0
    spend_basis    = "CURRENT_SPEND"
  }
}

data "google_billing_account" "account" {
  billing_account = var.project_id # À remplacer par le billing account ID réel
  open            = true
}

# Cloud Scheduler pour arrêt automatique
resource "google_cloud_scheduler_job" "stop_gpu_workers_nightly" {
  name             = "stop-gpu-workers-nightly"
  description      = "Arrête les workers GPU chaque nuit à 22h"
  schedule         = "0 22 * * *"
  time_zone        = "Europe/Paris"
  attempt_deadline = "320s"

  http_target {
    http_method = "POST"
    uri         = "https://compute.googleapis.com/compute/v1/projects/${var.project_id}/zones/${var.zone}/instanceGroupManagers/${google_compute_instance_group_manager.gpu_workers.name}/resize"
    body        = base64encode("size=0")

    oauth_token {
      service_account_email = google_service_account.gpu_worker.email
    }
  }
}

# Monitoring alert pour utilisation GPU
resource "google_monitoring_alert_policy" "gpu_utilization_low" {
  display_name = "GPU Utilization Low Alert"
  combiner     = "OR"

  conditions {
    display_name = "GPU utilization < 5% for 1 hour"

    condition_threshold {
      filter          = "resource.type=\"gce_instance\" AND metric.type=\"compute.googleapis.com/instance/gpu/utilization\""
      duration        = "3600s"
      comparison      = "COMPARISON_LT"
      threshold_value = 0.05

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
}

# Notification channel pour alertes
resource "google_monitoring_notification_channel" "email" {
  display_name = "Email Alerts"
  type         = "email"

  labels = {
    email_address = "admin@yukpomnang.com" # À remplacer par votre email
  }
}

output "gpu_instance_group" {
  value = google_compute_instance_group_manager.gpu_workers.id
}

output "gpu_autoscaler" {
  value = google_compute_autoscaler.gpu_workers.id
}

