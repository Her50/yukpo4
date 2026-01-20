output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "rds_address" {
  description = "RDS address (without port)"
  value       = aws_db_instance.main.address
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = aws_elasticache_replication_group.main.configuration_endpoint_address
  sensitive   = true
}

output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.backend.repository_url
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = aws_lb.main.dns_name
}

output "alb_arn" {
  description = "ALB ARN"
  value       = aws_lb.main.arn
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.backend.name
}

output "secrets_manager_arn" {
  description = "Secrets Manager secret ARN"
  value       = aws_secretsmanager_secret.backend_secrets.arn
  sensitive   = true
}

output "database_url" {
  description = "Database connection URL (for reference)"
  value       = "postgresql://${var.rds_username}:<password>@${aws_db_instance.main.endpoint}/${var.rds_database_name}"
  sensitive   = true
}

output "redis_url" {
  description = "Redis connection URL (for reference)"
  value       = "redis://${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
  sensitive   = true
}



